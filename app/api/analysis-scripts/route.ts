import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const scripts = await prisma.analysisScript.findMany({
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
  };

  if (!body.name) {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400 }
    );
  }

  let script = body.script ?? "";
  if (!script && body.templateId) {
    const template = await prisma.analysisScriptTemplate.findUnique({
      where: { id: body.templateId },
      select: { script: true },
    });
    script = template?.script ?? "";
  }

  if (!script) {
    return NextResponse.json(
      { error: "Script is required when no template is selected" },
      { status: 400 }
    );
  }

  const created = await prisma.analysisScript.create({
    data: {
      name: body.name,
      description: body.description ?? null,
      script,
      inputs: body.inputs ?? null,
      templateId: body.templateId ?? null,
    },
  });

  return NextResponse.json({ script: created }, { status: 201 });
}
