import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import {
  normalizeTriggerType,
  validateInputsForTriggerType,
} from "../analysis-run/_validation";

export const runtime = "nodejs";

export async function GET() {
  const templates = await prisma.analysisScriptTemplate.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    description?: string | null;
    script?: string;
    inputs?: unknown;
    triggerType?: "ON_REQUEST" | "SCHEDULED";
  };

  if (!body.name || !body.script) {
    return NextResponse.json(
      { error: "Name and script are required" },
      { status: 400 }
    );
  }

  const triggerType = normalizeTriggerType(body.triggerType);
  validateInputsForTriggerType(triggerType, body.inputs);

  const template = await prisma.analysisScriptTemplate.create({
    data: {
      name: body.name,
      description: body.description ?? null,
      script: body.script,
      inputs: body.inputs ?? null,
      triggerType,
    },
  });

  return NextResponse.json({ template }, { status: 201 });
}
