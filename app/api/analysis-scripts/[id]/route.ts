import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

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
  };

  const data: {
    name?: string;
    description?: string | null;
    script?: string;
    inputs?: unknown;
    templateId?: string | null;
  } = {
    name: body.name,
    description: body.description ?? null,
    inputs: body.inputs ?? null,
    templateId: body.templateId ?? null,
  };

  if (body.script !== undefined) {
    data.script = body.script;
  }

  if (!data.script && data.templateId) {
    const template = await prisma.analysisScriptTemplate.findUnique({
      where: { id: data.templateId },
      select: { script: true },
    });
    data.script = template?.script ?? data.script;
  }

  const updated = await prisma.analysisScript.update({
    where: { id },
    data,
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
