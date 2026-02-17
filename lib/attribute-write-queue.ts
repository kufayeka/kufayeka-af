import { Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";

export type AttributeWriteJobData = {
  path: string;
  value: unknown;
  ts?: string | number | Date | null;
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
    console.error(
      `[attribute-write-queue] redis error ${redisHost}:${redisPort}/${redisDb} - ${error.message}`
    );
  });
  return client;
}

const queueConnection = createRedisConnection();
const queueEventsConnection = createRedisConnection();

export const ATTRIBUTE_WRITE_QUEUE_NAME = "attribute-write-jobs";

export const attributeWriteQueue = new Queue<AttributeWriteJobData>(
  ATTRIBUTE_WRITE_QUEUE_NAME,
  {
    connection: queueConnection,
    defaultJobOptions: {
      removeOnComplete: 1000,
      removeOnFail: 1000,
      attempts: 2,
      backoff: {
        type: "exponential",
        delay: 300,
      },
    },
  }
);

export const attributeWriteQueueEvents = new QueueEvents(ATTRIBUTE_WRITE_QUEUE_NAME, {
  connection: queueEventsConnection,
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
