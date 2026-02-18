import { Queue, QueueEvents } from "bullmq";
import { createRedisConnection } from "./redis-connection";

export type HistorianWriteItem = {
  path?: string;
  attributeId?: string;
  value: unknown;
  ts?: string | number | Date | null;
  updateCurrent?: boolean;
};

export type HistorianWriteJobData = {
  items: HistorianWriteItem[];
  source?: string;
};

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

function envBool(name: string, fallback: boolean) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

const historianQueueAttempts = envInt("HISTORIAN_QUEUE_ATTEMPTS", 3, 1);
const historianQueueBackoffMs = envInt("HISTORIAN_QUEUE_BACKOFF_MS", 500, 0);
const historianQueueKeepCompletedCount = envInt(
  "HISTORIAN_QUEUE_KEEP_COMPLETED_COUNT",
  100,
  0
);
const historianQueueKeepCompletedAgeSec = envInt(
  "HISTORIAN_QUEUE_KEEP_COMPLETED_AGE_SEC",
  300,
  0
);
const historianQueueKeepFailedCount = envInt(
  "HISTORIAN_QUEUE_KEEP_FAILED_COUNT",
  500,
  0
);
const historianQueueKeepFailedAgeSec = envInt(
  "HISTORIAN_QUEUE_KEEP_FAILED_AGE_SEC",
  3600,
  0
);
const historianQueueEventsMaxLen = envInt("HISTORIAN_QUEUE_EVENTS_MAXLEN", 10000, 100);
const historianQueueRemoveCompletedImmediately = envBool(
  "HISTORIAN_QUEUE_REMOVE_COMPLETED_IMMEDIATELY",
  true
);
const historianQueueRemoveFailedImmediately = envBool(
  "HISTORIAN_QUEUE_REMOVE_FAILED_IMMEDIATELY",
  false
);

const queueConnection = createRedisConnection({ logPrefix: "[historian-write-queue]" });
const queueEventsConnection = createRedisConnection({
  logPrefix: "[historian-write-queue-events]",
});

export const HISTORIAN_QUEUE_NAME = "historian-write-jobs";

export const historianWriteQueue = new Queue<HistorianWriteJobData>(HISTORIAN_QUEUE_NAME, {
  connection: queueConnection,
  streams: {
    events: {
      maxLen: historianQueueEventsMaxLen,
    },
  },
  defaultJobOptions: {
    removeOnComplete: historianQueueRemoveCompletedImmediately
      ? true
      : {
          count: historianQueueKeepCompletedCount,
          age: historianQueueKeepCompletedAgeSec,
        },
    removeOnFail: historianQueueRemoveFailedImmediately
      ? true
      : {
          count: historianQueueKeepFailedCount,
          age: historianQueueKeepFailedAgeSec,
        },
    attempts: historianQueueAttempts,
    backoff: {
      type: "exponential",
      delay: historianQueueBackoffMs,
    },
  },
});

export const historianWriteQueueEvents = new QueueEvents(HISTORIAN_QUEUE_NAME, {
  connection: queueEventsConnection,
  streams: {
    events: {
      maxLen: historianQueueEventsMaxLen,
    },
  },
});

function toSafeJobId(value: string) {
  return value.replace(/:/g, "__");
}

export async function enqueueHistorianWriteJob(data: HistorianWriteJobData) {
  const source = data.source ?? "unknown";
  return historianWriteQueue.add("historian-write", data, {
    jobId: toSafeJobId(
      `hist__${source}__${Date.now()}__${Math.random().toString(36).slice(2)}`
    ),
  });
}

export async function waitForHistorianWriteJob(
  job: Awaited<ReturnType<typeof enqueueHistorianWriteJob>>,
  waitMs: number
) {
  return job.waitUntilFinished(historianWriteQueueEvents, waitMs);
}

export async function getHistorianWriteJob(jobId: string) {
  const job = await historianWriteQueue.getJob(jobId);
  if (!job) {
    return null;
  }
  const state = await job.getState();
  return {
    id: job.id as string,
    name: job.name,
    state,
    attemptsMade: job.attemptsMade,
    createdAt: job.timestamp,
    processedOn: job.processedOn ?? null,
    finishedOn: job.finishedOn ?? null,
    failedReason: job.failedReason ?? null,
    data: job.data,
    result: job.returnvalue ?? null,
  };
}
