import "dotenv/config";
import IORedis from "ioredis";
import { prisma } from "../lib/prisma";
import { enqueueAnalysisRunJobWithId } from "../lib/analysis-queue";

const redisHost = process.env.REDIS_HOST ?? "127.0.0.1";
const redisPort = Number(process.env.REDIS_PORT ?? 6379);
const redisPassword = process.env.REDIS_PASSWORD;
const redisDb = Number(process.env.REDIS_DB ?? 0);
const tickMs = Math.max(250, Number(process.env.CRON_WORKER_TICK_MS ?? 1000));
const lockTtlMs = Math.max(1000, Number(process.env.CRON_WORKER_LOCK_TTL_MS ?? 180000));
const lockPrefix = "analysis-cron-slot-lock";

const redis = new IORedis({
  host: redisHost,
  port: redisPort,
  password: redisPassword,
  db: redisDb,
  maxRetriesPerRequest: null,
});

redis.on("error", (error) => {
  console.error(`[analysis-cron-worker] redis error: ${error.message}`);
});

let tickInProgress = false;

function toSafeJobId(value: string) {
  return value.replace(/:/g, "__");
}

async function processTick(now: number) {
  const crons = await prisma.analysisCron.findMany({
    where: { isRunning: true },
    include: {
      scripts: {
        where: { triggerType: "SCHEDULED" },
        select: { id: true, name: true, triggerType: true },
      },
    },
  });

  for (const cron of crons) {
    const intervalSecond = Math.max(1, cron.intervalSecond);
    const slot = Math.floor(now / (intervalSecond * 1000));
    const lockKey = `${lockPrefix}:${cron.id}:${slot}`;

    const locked = await redis.set(lockKey, "1", "PX", lockTtlMs, "NX");
    if (locked !== "OK") {
      continue;
    }

    for (const script of cron.scripts) {
      const jobId = toSafeJobId(`cron__${cron.id}__script__${script.id}__slot__${slot}`);
      try {
        await enqueueAnalysisRunJobWithId(
          {
            name: script.name,
            method: "GET",
            query: [],
          },
          jobId
        );
      } catch (error) {
        const message = (error as Error).message.toLowerCase();
        if (message.includes("jobid") && message.includes("exists")) {
          continue;
        }
        console.error(
          `[analysis-cron-worker] enqueue failed cron=${cron.name} script=${script.name} jobId=${jobId} error=${(error as Error).message}`
        );
      }
    }
  }
}

async function tick() {
  if (tickInProgress) {
    return;
  }
  tickInProgress = true;
  try {
    await processTick(Date.now());
  } catch (error) {
    console.error(`[analysis-cron-worker] tick failed: ${(error as Error).message}`);
  } finally {
    tickInProgress = false;
  }
}

console.log(
  `[analysis-cron-worker] started redis=${redisHost}:${redisPort}/${redisDb} tickMs=${tickMs}`
);
void tick();
setInterval(() => {
  void tick();
}, tickMs);
