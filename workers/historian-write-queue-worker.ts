import "dotenv/config";
import { Worker, type Job } from "bullmq";
import {
  HISTORIAN_QUEUE_NAME,
  type HistorianWriteItem,
  type HistorianWriteJobData,
} from "../lib/historian-write-queue";
import { createRedisConnection, redisAddress } from "../lib/redis-connection";
import {
  writeAssetAttributeById,
  writeAssetAttributeByPath,
} from "../app/api/asset-attributes/_write";

function envInt(name: string, fallback: number, min = 0) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.floor(parsed));
}

const concurrency = envInt("HISTORIAN_QUEUE_CONCURRENCY", 20, 1);
const batchSize = envInt("HISTORIAN_WORKER_BATCH_SIZE", 500, 1);
const flushMs = envInt("HISTORIAN_WORKER_FLUSH_MS", 200, 1);
const writeParallel = envInt("HISTORIAN_WORKER_WRITE_PARALLEL", 50, 1);

const connection = createRedisConnection({
  logPrefix: "[historian-write-queue-worker]",
});

type BufferedJob = {
  job: Job<HistorianWriteJobData>;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

const buffer: BufferedJob[] = [];
let flushTimer: NodeJS.Timeout | null = null;
let flushInProgress = false;

async function writeItem(item: HistorianWriteItem) {
  if (item.path) {
    await writeAssetAttributeByPath({
      path: item.path,
      value: item.value,
      ts: item.ts ?? null,
      recordHistory: true,
      updateCurrent: item.updateCurrent === true,
    });
    return;
  }
  if (item.attributeId) {
    await writeAssetAttributeById({
      attributeId: item.attributeId,
      value: item.value,
      ts: item.ts ?? null,
      recordHistory: true,
      updateCurrent: item.updateCurrent === true,
    });
    return;
  }
  throw new Error("Historian write item must have path or attributeId");
}

async function processWrites(items: HistorianWriteItem[]) {
  for (let start = 0; start < items.length; start += writeParallel) {
    const slice = items.slice(start, start + writeParallel);
    await Promise.all(slice.map((item) => writeItem(item)));
  }
}

function scheduleFlush() {
  if (flushTimer || flushInProgress) {
    return;
  }
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushBuffer();
  }, flushMs);
}

async function flushBuffer() {
  if (flushInProgress || buffer.length === 0) {
    return;
  }
  flushInProgress = true;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  const jobs = buffer.splice(0, batchSize);
  const items = jobs.flatMap((entry) => entry.job.data.items ?? []);
  const now = new Date().toISOString();

  try {
    await processWrites(items);
    jobs.forEach((entry) =>
      entry.resolve({
        success: true,
        batchJobs: jobs.length,
        processedItems: items.length,
        flushedAt: now,
      })
    );
  } catch (error) {
    const err = error as Error;
    jobs.forEach((entry) => entry.reject(err));
  } finally {
    flushInProgress = false;
    if (buffer.length > 0) {
      if (buffer.length >= batchSize) {
        void flushBuffer();
      } else {
        scheduleFlush();
      }
    }
  }
}

const worker = new Worker<HistorianWriteJobData>(
  HISTORIAN_QUEUE_NAME,
  async (job) =>
    new Promise((resolve, reject) => {
      if (!Array.isArray(job.data.items) || job.data.items.length === 0) {
        resolve({
          success: true,
          batchJobs: 1,
          processedItems: 0,
          flushedAt: new Date().toISOString(),
        });
        return;
      }

      buffer.push({ job, resolve, reject });
      if (buffer.length >= batchSize) {
        void flushBuffer();
      } else {
        scheduleFlush();
      }
    }),
  { connection, concurrency }
);

worker.on("completed", (job, result) => {
  console.log(
    `[historian-write-queue] completed job=${job.id} items=${job.data.items?.length ?? 0} result=${JSON.stringify(result)}`
  );
});

worker.on("failed", (job, err) => {
  console.error(
    `[historian-write-queue] failed job=${job?.id ?? "unknown"} items=${job?.data?.items?.length ?? 0} error=${err.message}`
  );
});

console.log(
  `[historian-write-queue] worker started queue=${HISTORIAN_QUEUE_NAME} redis=${redisAddress} concurrency=${concurrency} batchSize=${batchSize} flushMs=${flushMs} writeParallel=${writeParallel}`
);
