import { handleAnalysisRun } from "../_handler";
import { enqueueAnalysisRunJob, waitForAnalysisRunJob } from "../../../../lib/analysis-queue";

export const runtime = "nodejs";

const DEFAULT_WAIT_MS = 10_000;

function parseWaitMs(raw: unknown) {
  if (raw === undefined || raw === null || raw === "") {
    return DEFAULT_WAIT_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_WAIT_MS;
  }
  return Math.max(0, Math.floor(parsed));
}

export async function GET(request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") ?? "async";
  if (mode === "sync") {
    return handleAnalysisRun(request, name);
  }

  const waitMs = parseWaitMs(searchParams.get("waitMs") ?? searchParams.get("wait"));
  const query = Array.from(searchParams.entries()).filter(
    ([key]) => key !== "mode" && key !== "wait" && key !== "waitMs"
  );
  const job = await enqueueAnalysisRunJob({
    name,
    method: "GET",
    query,
  });

  if (waitMs === 0) {
    return Response.json(
      { accepted: true, jobId: job.id, status: "queued" },
      { status: 202 }
    );
  }

  try {
    const result = await waitForAnalysisRunJob(job, waitMs);
    return Response.json(result);
  } catch (error) {
    const message = (error as Error).message;
    if (message.toLowerCase().includes("timed out")) {
      return Response.json(
        { accepted: true, jobId: job.id, status: "queued" },
        { status: 202 }
      );
    }
    return Response.json(
      { accepted: false, jobId: job.id, status: "failed", error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  const { searchParams } = new URL(request.url);
  let mode = searchParams.get("mode") ?? "async";
  let waitRaw: unknown = searchParams.get("waitMs") ?? searchParams.get("wait");
  let body: unknown = undefined;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      body = await request.clone().json();
      if (body && typeof body === "object") {
        const bodyObj = body as Record<string, unknown>;
        if ("mode" in bodyObj) {
          const bodyMode = bodyObj.mode;
          if (bodyMode === "async") {
            mode = "async";
          } else if (bodyMode === "sync") {
            mode = "sync";
          }
        }
        if (waitRaw === undefined || waitRaw === null || waitRaw === "") {
          waitRaw = bodyObj.waitMs ?? bodyObj.wait ?? waitRaw;
        }
      }
    } catch {
      body = undefined;
    }
  }

  if (mode === "sync") {
    return handleAnalysisRun(request, name);
  }

  const waitMs = parseWaitMs(waitRaw);
  const query = Array.from(searchParams.entries()).filter(
    ([key]) => key !== "mode" && key !== "wait" && key !== "waitMs"
  );
  const payload =
    body && typeof body === "object"
      ? Object.fromEntries(
          Object.entries(body as Record<string, unknown>).filter(
            ([key]) => key !== "mode" && key !== "wait" && key !== "waitMs"
          )
        )
      : undefined;
  const job = await enqueueAnalysisRunJob({
    name,
    method: "POST",
    query,
    body: payload,
  });

  if (waitMs === 0) {
    return Response.json(
      { accepted: true, jobId: job.id, status: "queued" },
      { status: 202 }
    );
  }

  try {
    const result = await waitForAnalysisRunJob(job, waitMs);
    return Response.json(result);
  } catch (error) {
    const message = (error as Error).message;
    if (message.toLowerCase().includes("timed out")) {
      return Response.json(
        { accepted: true, jobId: job.id, status: "queued" },
        { status: 202 }
      );
    }
    return Response.json(
      { accepted: false, jobId: job.id, status: "failed", error: message },
      { status: 500 }
    );
  }
}
