import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import {
  normalizeTriggerType,
  validateInputsForTriggerType,
} from "../analysis-run/_validation";

export const runtime = "nodejs";

export async function GET() {
  const scripts = await prisma.analysisScript.findMany({
    include: {
      cron: {
        select: { id: true, name: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ scripts });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    description?: string | null;
    script?: string;
    inputs?: unknown;
    templateId?: string | null;
    triggerType?: "ON_REQUEST" | "SCHEDULED";
    cronId?: string | null;
  };

  if (!body.name) {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400 }
    );
  }

  let script = body.script ?? "";
  const triggerType = normalizeTriggerType(body.triggerType);
  validateInputsForTriggerType(triggerType, body.inputs);
  if (!script && body.templateId) {
    const template = await prisma.analysisScriptTemplate.findUnique({
      where: { id: body.templateId },
      select: { script: true, triggerType: true },
    });
    script = template?.script ?? "";
    if (template?.triggerType === "SCHEDULED" && body.triggerType === undefined) {
      validateInputsForTriggerType("SCHEDULED", body.inputs);
    }
  }

  if (!script) {
    return NextResponse.json(
      { error: "Script is required when no template is selected" },
      { status: 400 }
    );
  }

  if (triggerType === "SCHEDULED" && !body.cronId) {
    return NextResponse.json(
      { error: "cronId is required for scheduled scripts" },
      { status: 400 }
    );
  }

  const created = await prisma.analysisScript.create({
    data: {
      name: body.name,
      description: body.description ?? null,
      script,
      inputs: body.inputs ?? [],
      templateId: body.templateId ?? null,
      triggerType,
      cronId: triggerType === "SCHEDULED" ? body.cronId ?? null : null,
    },
    include: {
      cron: {
        select: { id: true, name: true },
      },
    },
  });

  return NextResponse.json({ script: created }, { status: 201 });
}
