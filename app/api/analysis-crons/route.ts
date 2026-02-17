import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { assertValidCronExpression } from "../../../lib/cron-expression";

export const runtime = "nodejs";

export async function GET() {
  const crons = await prisma.analysisCron.findMany({
    include: {
      scripts: {
        select: {
          id: true,
          name: true,
          triggerType: true,
          cronId: true,
        },
        orderBy: { name: "asc" },
      },
    },
    orderBy: [{ name: "asc" }],
  });
  return NextResponse.json({ crons });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    description?: string | null;
    cronExpression?: string;
    isRunning?: boolean;
  };

  if (!body.name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const cronExpression = body.cronExpression?.trim();
  if (!cronExpression) {
    return NextResponse.json(
      { error: "cronExpression is required" },
      { status: 400 }
    );
  }

  try {
    assertValidCronExpression(cronExpression);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }

  const cron = await prisma.analysisCron.create({
    data: {
      name: body.name,
      description: body.description ?? null,
      cronExpression,
      isRunning: Boolean(body.isRunning),
    },
    include: {
      scripts: {
        select: {
          id: true,
          name: true,
          triggerType: true,
          cronId: true,
        },
        orderBy: { name: "asc" },
      },
    },
  });

  return NextResponse.json({ cron }, { status: 201 });
}
