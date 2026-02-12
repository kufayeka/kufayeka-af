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

  if (!body.name || !body.script) {
    return NextResponse.json(
      { error: "Name and script are required" },
      { status: 400 }
    );
  }

  const script = await prisma.analysisScript.create({
    data: {
      name: body.name,
      description: body.description ?? null,
      script: body.script,
      inputs: body.inputs ?? null,
      templateId: body.templateId ?? null,
    },
  });

  return NextResponse.json({ script }, { status: 201 });
}
