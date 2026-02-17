import { Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";

export type AnalysisRunJobData = {
  name: string;
  method: "GET" | "POST";
  query: Array<[string, string]>;
  body?: unknown;
};

const redisHost = process.env.REDIS_HOST ?? "127.0.0.1";
const redisPort = Number(process.env.REDIS_PORT ?? 6379);
const redisPassword = process.env.REDIS_PASSWORD;
const redisDb = Number(process.env.REDIS_DB ?? 0);

function createRedisConnection() {
  const client = new IORedis({
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    db: redisDb,
    maxRetriesPerRequest: null,
  });
  client.on("error", (error) => {
    console.error(`[analysis-queue] redis error ${redisHost}:${redisPort}/${redisDb} - ${error.message}`);
  });
  return client;
}

const queueConnection = createRedisConnection();
const queueEventsConnection = createRedisConnection();

export const ANALYSIS_QUEUE_NAME = "analysis-run-jobs";

export const analysisRunQueue = new Queue<AnalysisRunJobData>(ANALYSIS_QUEUE_NAME, {
  connection: queueConnection,
  defaultJobOptions: {
    removeOnComplete: 1000,
    removeOnFail: 1000,
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 500,
    },
  },
});

export const analysisRunQueueEvents = new QueueEvents(ANALYSIS_QUEUE_NAME, {
  connection: queueEventsConnection,
});

export async function enqueueAnalysisRunJob(data: AnalysisRunJobData) {
  return analysisRunQueue.add("analysis-run", data, {
    jobId: `${data.name}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
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
