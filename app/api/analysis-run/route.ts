import { handleAnalysisRun } from "./_handler";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleAnalysisRun(request);
}

export async function POST(request: Request) {
  return handleAnalysisRun(request);
}
