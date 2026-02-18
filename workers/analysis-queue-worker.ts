import "dotenv/config";
import { Worker } from "bullmq";
import { ANALYSIS_QUEUE_NAME, type AnalysisRunJobData } from "../lib/analysis-queue";
import { createRedisConnection, redisAddress } from "../lib/redis-connection";

const concurrency = Number(process.env.ANALYSIS_QUEUE_CONCURRENCY ?? 20);

const connection = createRedisConnection({
  logPrefix: "[analysis-queue-worker]",
});

const worker = new Worker<AnalysisRunJobData>(
  ANALYSIS_QUEUE_NAME,
  async (job) => {
    const { handleAnalysisRun } = await import("../app/api/analysis-run/_handler");
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
  `[analysis-queue] worker started queue=${ANALYSIS_QUEUE_NAME} redis=${redisAddress} concurrency=${concurrency}`
);
