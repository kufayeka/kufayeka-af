import { handleAnalysisRun } from "../_handler";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  return handleAnalysisRun(request, name);
}

export async function POST(request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  return handleAnalysisRun(request, name);
}
