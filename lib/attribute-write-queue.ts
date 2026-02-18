import { Queue, QueueEvents } from "bullmq";
import { createRedisConnection } from "./redis-connection";

export type AttributeWriteJobData = {
  path: string;
  value: unknown;
  ts?: string | number | Date | null;
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

const attributeQueueAttempts = envInt("ATTRIBUTE_QUEUE_ATTEMPTS", 2, 1);
const attributeQueueBackoffMs = envInt("ATTRIBUTE_QUEUE_BACKOFF_MS", 300, 0);
const attributeQueueKeepCompletedCount = envInt(
  "ATTRIBUTE_QUEUE_KEEP_COMPLETED_COUNT",
  1000,
  0
);
const attributeQueueKeepCompletedAgeSec = envInt(
  "ATTRIBUTE_QUEUE_KEEP_COMPLETED_AGE_SEC",
  21600,
  0
);
const attributeQueueKeepFailedCount = envInt(
  "ATTRIBUTE_QUEUE_KEEP_FAILED_COUNT",
  1000,
  0
);
const attributeQueueKeepFailedAgeSec = envInt(
  "ATTRIBUTE_QUEUE_KEEP_FAILED_AGE_SEC",
  172800,
  0
);
const attributeQueueEventsMaxLen = envInt(
  "ATTRIBUTE_QUEUE_EVENTS_MAXLEN",
  10000,
  100
);
const attributeQueueRemoveCompletedImmediately = envBool(
  "ATTRIBUTE_QUEUE_REMOVE_COMPLETED_IMMEDIATELY",
  true
);
const attributeQueueRemoveFailedImmediately = envBool(
  "ATTRIBUTE_QUEUE_REMOVE_FAILED_IMMEDIATELY",
  false
);

const queueConnection = createRedisConnection({
  logPrefix: "[attribute-write-queue]",
});
const queueEventsConnection = createRedisConnection({
  logPrefix: "[attribute-write-queue-events]",
});

export const ATTRIBUTE_WRITE_QUEUE_NAME = "attribute-write-jobs";

export const attributeWriteQueue = new Queue<AttributeWriteJobData>(
  ATTRIBUTE_WRITE_QUEUE_NAME,
  {
    connection: queueConnection,
    streams: {
      events: {
        maxLen: attributeQueueEventsMaxLen,
      },
    },
    defaultJobOptions: {
      removeOnComplete: attributeQueueRemoveCompletedImmediately
        ? true
        : {
            count: attributeQueueKeepCompletedCount,
            age: attributeQueueKeepCompletedAgeSec,
          },
      removeOnFail: attributeQueueRemoveFailedImmediately
        ? true
        : {
            count: attributeQueueKeepFailedCount,
            age: attributeQueueKeepFailedAgeSec,
          },
      attempts: attributeQueueAttempts,
      backoff: {
        type: "exponential",
        delay: attributeQueueBackoffMs,
      },
    },
  }
);

export const attributeWriteQueueEvents = new QueueEvents(ATTRIBUTE_WRITE_QUEUE_NAME, {
  connection: queueEventsConnection,
  streams: {
    events: {
      maxLen: attributeQueueEventsMaxLen,
    },
  },
});

function toSafeJobId(value: string) {
  return value.replace(/:/g, "__");
}

export async function enqueueAttributeWriteJob(data: AttributeWriteJobData) {
  return attributeWriteQueue.add("attribute-write", data, {
    jobId: toSafeJobId(
      `${data.path}__${Date.now()}__${Math.random().toString(36).slice(2)}`
    ),
  });
}

export async function waitForAttributeWriteJob(
  job: Awaited<ReturnType<typeof enqueueAttributeWriteJob>>,
  waitMs: number
) {
  return job.waitUntilFinished(attributeWriteQueueEvents, waitMs);
}

export async function getAttributeWriteJob(jobId: string) {
  const job = await attributeWriteQueue.getJob(jobId);
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
