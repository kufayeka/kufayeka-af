import "dotenv/config";
import cron, { type ScheduledTask } from "node-cron";
import { prisma } from "../lib/prisma";
import { enqueueAnalysisRunJobWithId } from "../lib/analysis-queue";
import { isValidCronExpression } from "../lib/cron-expression";
import { createRedisConnection, redisAddress } from "../lib/redis-connection";

const lockTtlMs = Math.max(1000, Number(process.env.CRON_WORKER_LOCK_TTL_MS ?? 180000));
const reconcileMs = Math.max(1000, Number(process.env.CRON_WORKER_RECONCILE_MS ?? 5000));
const lockPrefix = "analysis-cron-slot-lock";

const redis = createRedisConnection({
  logPrefix: "[analysis-cron-worker]",
});

type CronScript = {
  id: string;
  name: string;
};

type CronTaskState = {
  expression: string;
  isRunning: boolean;
  scripts: CronScript[];
  task: ScheduledTask;
};

const tasks = new Map<string, CronTaskState>();
const activeCronRuns = new Set<string>();

function toSafeJobId(value: string) {
  return value.replace(/:/g, "__");
}

function signaturesEqual(current: CronTaskState, next: Omit<CronTaskState, "task">) {
  if (current.expression !== next.expression) return false;
  if (current.isRunning !== next.isRunning) return false;
  if (current.scripts.length !== next.scripts.length) return false;
  for (let i = 0; i < current.scripts.length; i += 1) {
    const left = current.scripts[i];
    const right = next.scripts[i];
    if (!left || !right || left.id !== right.id || left.name !== right.name) {
      return false;
    }
  }
  return true;
}

async function runCron(cronId: string, cronName: string) {
  if (activeCronRuns.has(cronId)) {
    return;
  }
  activeCronRuns.add(cronId);
  try {
    const state = tasks.get(cronId);
    if (!state || !state.isRunning) {
      return;
    }

    const secondSlot = Math.floor(Date.now() / 1000);
    const lockKey = `${lockPrefix}:${cronId}:${secondSlot}`;
    const locked = await redis.set(lockKey, "1", "PX", lockTtlMs, "NX");
    if (locked !== "OK") {
      return;
    }

    for (const script of state.scripts) {
      const jobId = toSafeJobId(
        `cron__${cronId}__script__${script.id}__slot__${secondSlot}`
      );
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
          `[analysis-cron-worker] enqueue failed cron=${cronName} script=${script.name} jobId=${jobId} error=${(error as Error).message}`
        );
      }
    }
  } finally {
    activeCronRuns.delete(cronId);
  }
}

function buildTask(cronId: string, cronName: string, expression: string) {
  return cron.schedule(
    expression,
    () => {
      void runCron(cronId, cronName);
    },
    {
      scheduled: false,
    }
  );
}

async function reconcileCrons() {
  const cronRows = await prisma.analysisCron.findMany({
    include: {
      scripts: {
        where: { triggerType: "SCHEDULED" },
        select: { id: true, name: true },
        orderBy: { id: "asc" },
      },
    },
    orderBy: { id: "asc" },
  });

  const seen = new Set<string>();

  for (const row of cronRows) {
    const expression = row.cronExpression.trim();
    if (!isValidCronExpression(expression)) {
      console.error(
        `[analysis-cron-worker] invalid cronExpression cron=${row.name} expression="${row.cronExpression}"`
      );
      const invalidCurrent = tasks.get(row.id);
      if (invalidCurrent) {
        invalidCurrent.task.stop();
      }
      continue;
    }

    seen.add(row.id);

    const nextStateBase = {
      expression,
      isRunning: row.isRunning,
      scripts: row.scripts,
    };
    const current = tasks.get(row.id);

    if (!current) {
      const task = buildTask(row.id, row.name, expression);
      const created: CronTaskState = { ...nextStateBase, task };
      tasks.set(row.id, created);
      if (created.isRunning) {
        created.task.start();
      }
      continue;
    }

    if (signaturesEqual(current, nextStateBase)) {
      continue;
    }

    const expressionChanged = current.expression !== nextStateBase.expression;
    if (expressionChanged) {
      current.task.stop();
      current.task.destroy();
      current.task = buildTask(row.id, row.name, expression);
    }

    current.expression = nextStateBase.expression;
    current.scripts = nextStateBase.scripts;
    current.isRunning = nextStateBase.isRunning;

    if (current.isRunning) {
      current.task.start();
    } else {
      current.task.stop();
    }
  }

  for (const [cronId, state] of tasks.entries()) {
    if (seen.has(cronId)) {
      continue;
    }
    state.task.stop();
    state.task.destroy();
    tasks.delete(cronId);
  }
}

let reconcileInProgress = false;

async function reconcileTick() {
  if (reconcileInProgress) {
    return;
  }
  reconcileInProgress = true;
  try {
    await reconcileCrons();
  } catch (error) {
    console.error(`[analysis-cron-worker] reconcile failed: ${(error as Error).message}`);
  } finally {
    reconcileInProgress = false;
  }
}

console.log(
  `[analysis-cron-worker] started redis=${redisAddress} scheduler=node-cron reconcileMs=${reconcileMs}`
);

void reconcileTick();
setInterval(() => {
  void reconcileTick();
}, reconcileMs);
