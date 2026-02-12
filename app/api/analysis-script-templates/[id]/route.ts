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
  };

  const template = await prisma.analysisScriptTemplate.update({
    where: { id },
    data: {
      name: body.name ?? "",
      description: body.description ?? null,
      script: body.script ?? "",
      inputs: body.inputs ?? null,
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
