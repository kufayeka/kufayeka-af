import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import {
  normalizeTriggerType,
  validateInputsForTriggerType,
} from "../../analysis-run/_validation";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    name?: string;
    description?: string | null;
    script?: string;
    inputs?: unknown;
    triggerType?: "ON_REQUEST" | "SCHEDULED";
  };

  const existing = await prisma.analysisScriptTemplate.findUnique({
    where: { id },
    select: { triggerType: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const triggerType = normalizeTriggerType(body.triggerType ?? existing.triggerType);
  validateInputsForTriggerType(triggerType, body.inputs);

  const template = await prisma.analysisScriptTemplate.update({
    where: { id },
    data: {
      name: body.name ?? "",
      description: body.description ?? null,
      script: body.script ?? "",
      inputs: body.inputs ?? null,
      triggerType,
    },
  });

  return NextResponse.json({ template });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  await prisma.analysisScriptTemplate.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
