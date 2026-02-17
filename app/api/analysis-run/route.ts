import { handleAnalysisRun } from "./_handler";
import { enqueueAnalysisRunJob } from "../../../lib/analysis-queue";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");
  if (mode === "async") {
    const name = searchParams.get("name");
    if (!name) {
      return Response.json(
        { message: "error", result: { error: "name is required" } },
        { status: 400 }
      );
    }
    const query = Array.from(searchParams.entries()).filter(([key]) => key !== "mode");
    const job = await enqueueAnalysisRunJob({
      name,
      method: "GET",
      query,
    });
    return Response.json(
      { accepted: true, jobId: job.id, status: "queued" },
      { status: 202 }
    );
  }
  return handleAnalysisRun(request);
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  let mode = searchParams.get("mode");
  let body: unknown = undefined;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      body = await request.clone().json();
      if (!mode && body && typeof body === "object" && "mode" in (body as Record<string, unknown>)) {
        const bodyMode = (body as Record<string, unknown>).mode;
        if (bodyMode === "async") {
          mode = "async";
        }
      }
    } catch {
      body = undefined;
    }
  }

  if (mode === "async") {
    const name = searchParams.get("name");
    if (!name) {
      return Response.json(
        { message: "error", result: { error: "name is required" } },
        { status: 400 }
      );
    }
    const query = Array.from(searchParams.entries()).filter(([key]) => key !== "mode");
    const payload =
      body && typeof body === "object"
        ? Object.fromEntries(
            Object.entries(body as Record<string, unknown>).filter(([key]) => key !== "mode")
          )
        : undefined;
    const job = await enqueueAnalysisRunJob({
      name,
      method: "POST",
      query,
      body: payload,
    });
    return Response.json(
      { accepted: true, jobId: job.id, status: "queued" },
      { status: 202 }
    );
  }
  return handleAnalysisRun(request);
}
