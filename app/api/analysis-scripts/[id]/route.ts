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

  const script = await prisma.analysisScript.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description ?? null,
      script: body.script ?? "",
      inputs: body.inputs ?? null,
      templateId: body.templateId ?? null,
    },
  });

  return NextResponse.json({ script });
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
