import "dotenv/config";
import { Worker } from "bullmq";
import {
  ATTRIBUTE_WRITE_QUEUE_NAME,
  type AttributeWriteJobData,
} from "../lib/attribute-write-queue";
import { writeAssetAttributeByPath } from "../app/api/asset-attributes/_write";
import { createRedisConnection, redisAddress } from "../lib/redis-connection";

const concurrency = Number(process.env.ATTRIBUTE_WRITE_QUEUE_CONCURRENCY ?? 100);

const connection = createRedisConnection({
  logPrefix: "[attribute-write-queue-worker]",
});

const worker = new Worker<AttributeWriteJobData>(
  ATTRIBUTE_WRITE_QUEUE_NAME,
  async (job) => {
    const result = await writeAssetAttributeByPath({
      path: job.data.path,
      value: job.data.value,
      ts: job.data.ts ?? null,
      recordHistory: job.data.ts !== undefined && job.data.ts !== null,
      updateCurrent: true,
    });

    return {
      success: true,
      assetId: result.resolved.assetId,
      templateItemId: result.resolved.templateItemId,
      assetAttributeId: result.attribute.id,
      value: result.value,
      ts: result.ts.toISOString(),
    };
  },
  { connection, concurrency }
);

worker.on("completed", (job) => {
  console.log(`[attribute-write-queue] completed job=${job.id} path=${job.data.path}`);
});

worker.on("failed", (job, err) => {
  console.error(
    `[attribute-write-queue] failed job=${job?.id ?? "unknown"} path=${job?.data?.path ?? "unknown"} error=${err.message}`
  );
});

console.log(
  `[attribute-write-queue] worker started queue=${ATTRIBUTE_WRITE_QUEUE_NAME} redis=${redisAddress} concurrency=${concurrency}`
);
