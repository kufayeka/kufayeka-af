import { Worker } from "bullmq";
import IORedis from "ioredis";
import { ANALYSIS_QUEUE_NAME, type AnalysisRunJobData } from "../lib/analysis-queue";
import { handleAnalysisRun } from "../app/api/analysis-run/_handler";

const redisHost = process.env.REDIS_HOST ?? "127.0.0.1";
const redisPort = Number(process.env.REDIS_PORT ?? 6379);
const redisPassword = process.env.REDIS_PASSWORD;
const redisDb = Number(process.env.REDIS_DB ?? 0);
const concurrency = Number(process.env.ANALYSIS_QUEUE_CONCURRENCY ?? 20);

const connection = new IORedis({
  host: redisHost,
  port: redisPort,
  password: redisPassword,
  db: redisDb,
  maxRetriesPerRequest: null,
});

const worker = new Worker<AnalysisRunJobData>(
  ANALYSIS_QUEUE_NAME,
  async (job) => {
    const params = new URLSearchParams(job.data.query);
    params.set("name", job.data.name);
    const url = `http://analysis.local/api/analysis-run?${params.toString()}`;

    const init: RequestInit = { method: job.data.method };
    if (job.data.method === "POST" && job.data.body !== undefined) {
      init.body = JSON.stringify(job.data.body);
      init.headers = { "content-type": "application/json" };
    }

    const request = new Request(url, init);
    const response = await handleAnalysisRun(request, job.data.name);
    const payload = await response.json();
    if (!response.ok) {
      const message =
        payload &&
        typeof payload === "object" &&
        "result" in (payload as Record<string, unknown>)
          ? ((payload as { result?: { error?: string } }).result?.error ?? "Analysis run failed")
          : "Analysis run failed";
      throw new Error(message);
    }
    return payload;
  },
  { connection, concurrency }
);

worker.on("completed", (job) => {
  console.log(`[analysis-queue] completed job=${job.id} name=${job.data.name}`);
});

worker.on("failed", (job, err) => {
  console.error(
    `[analysis-queue] failed job=${job?.id ?? "unknown"} name=${job?.data?.name ?? "unknown"} error=${err.message}`
  );
});

console.log(
  `[analysis-queue] worker started queue=${ANALYSIS_QUEUE_NAME} redis=${redisHost}:${redisPort}/${redisDb} concurrency=${concurrency}`
);
