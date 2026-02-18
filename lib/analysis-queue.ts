import { Queue, QueueEvents } from "bullmq";
import { createRedisConnection } from "./redis-connection";

export type AnalysisRunJobData = {
  name: string;
  method: "GET" | "POST";
  query: Array<[string, string]>;
  body?: unknown;
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

const analysisQueueAttempts = envInt("ANALYSIS_QUEUE_ATTEMPTS", 2, 1);
const analysisQueueBackoffMs = envInt("ANALYSIS_QUEUE_BACKOFF_MS", 500, 0);
const analysisQueueKeepCompletedCount = envInt(
  "ANALYSIS_QUEUE_KEEP_COMPLETED_COUNT",
  1000,
  0
);
const analysisQueueKeepCompletedAgeSec = envInt(
  "ANALYSIS_QUEUE_KEEP_COMPLETED_AGE_SEC",
  86400,
  0
);
const analysisQueueKeepFailedCount = envInt(
  "ANALYSIS_QUEUE_KEEP_FAILED_COUNT",
  1000,
  0
);
const analysisQueueKeepFailedAgeSec = envInt(
  "ANALYSIS_QUEUE_KEEP_FAILED_AGE_SEC",
  259200,
  0
);
const analysisQueueEventsMaxLen = envInt(
  "ANALYSIS_QUEUE_EVENTS_MAXLEN",
  5000,
  100
);
const analysisQueueRemoveCompletedImmediately = envBool(
  "ANALYSIS_QUEUE_REMOVE_COMPLETED_IMMEDIATELY",
  false
);
const analysisQueueRemoveFailedImmediately = envBool(
  "ANALYSIS_QUEUE_REMOVE_FAILED_IMMEDIATELY",
  false
);

const queueConnection = createRedisConnection({ logPrefix: "[analysis-queue]" });
const queueEventsConnection = createRedisConnection({
  logPrefix: "[analysis-queue-events]",
});

export const ANALYSIS_QUEUE_NAME = "analysis-run-jobs";

export const analysisRunQueue = new Queue<AnalysisRunJobData>(ANALYSIS_QUEUE_NAME, {
  connection: queueConnection,
  streams: {
    events: {
      maxLen: analysisQueueEventsMaxLen,
    },
  },
  defaultJobOptions: {
    removeOnComplete: analysisQueueRemoveCompletedImmediately
      ? true
      : {
          count: analysisQueueKeepCompletedCount,
          age: analysisQueueKeepCompletedAgeSec,
        },
    removeOnFail: analysisQueueRemoveFailedImmediately
      ? true
      : {
          count: analysisQueueKeepFailedCount,
          age: analysisQueueKeepFailedAgeSec,
        },
    attempts: analysisQueueAttempts,
    backoff: {
      type: "exponential",
      delay: analysisQueueBackoffMs,
    },
  },
});

export const analysisRunQueueEvents = new QueueEvents(ANALYSIS_QUEUE_NAME, {
  connection: queueEventsConnection,
  streams: {
    events: {
      maxLen: analysisQueueEventsMaxLen,
    },
  },
});

function toSafeJobId(value: string) {
  return value.replace(/:/g, "__");
}

export async function enqueueAnalysisRunJob(data: AnalysisRunJobData) {
  return analysisRunQueue.add("analysis-run", data, {
    jobId: toSafeJobId(
      `${data.name}__${Date.now()}__${Math.random().toString(36).slice(2)}`
    ),
  });
}

export async function enqueueAnalysisRunJobWithId(
  data: AnalysisRunJobData,
  jobId: string
) {
  return analysisRunQueue.add("analysis-run", data, {
    jobId: toSafeJobId(jobId),
  });
}

export async function waitForAnalysisRunJob(
  job: Awaited<ReturnType<typeof enqueueAnalysisRunJob>>,
  waitMs: number
) {
  return job.waitUntilFinished(analysisRunQueueEvents, waitMs);
}

export async function getAnalysisRunJob(jobId: string) {
  const job = await analysisRunQueue.getJob(jobId);
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
