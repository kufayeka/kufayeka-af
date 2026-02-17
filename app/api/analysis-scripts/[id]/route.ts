import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import type { Prisma } from "@prisma/client";
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
    templateId?: string | null;
    triggerType?: "ON_REQUEST" | "SCHEDULED";
    cronId?: string | null;
  };

  const existing = await prisma.analysisScript.findUnique({
    where: { id },
    select: { triggerType: true, cronId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Analysis script not found" }, { status: 404 });
  }

  const nextTriggerType = normalizeTriggerType(body.triggerType ?? existing.triggerType);
  validateInputsForTriggerType(nextTriggerType, body.inputs);
  const nextCronId = body.cronId === undefined ? existing.cronId : body.cronId;
  if (nextTriggerType === "SCHEDULED" && !nextCronId) {
    return NextResponse.json(
      { error: "cronId is required for scheduled scripts" },
      { status: 400 }
    );
  }

  const data: Prisma.AnalysisScriptUpdateInput = {
    name: body.name,
    description: body.description ?? null,
    inputs: body.inputs ?? [],
    triggerType: nextTriggerType,
    cron: nextTriggerType === "SCHEDULED"
      ? nextCronId
        ? { connect: { id: nextCronId } }
        : { disconnect: true }
      : { disconnect: true },
  };

  if (body.templateId !== undefined) {
    data.template = body.templateId
      ? { connect: { id: body.templateId } }
      : { disconnect: true };
  }

  if (body.script !== undefined) {
    data.script = body.script;
  }

  if (!data.script && body.templateId) {
    const template = await prisma.analysisScriptTemplate.findUnique({
      where: { id: body.templateId },
      select: { script: true, triggerType: true },
    });
    data.script = template?.script ?? data.script;
    if (body.triggerType === undefined && template?.triggerType === "SCHEDULED") {
      data.triggerType = "SCHEDULED";
      validateInputsForTriggerType("SCHEDULED", body.inputs);
    }
  }

  const updated = await prisma.analysisScript.update({
    where: { id },
    data,
    include: {
      cron: {
        select: { id: true, name: true },
      },
    },
  });

  return NextResponse.json({ script: updated });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  await prisma.analysisScript.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
