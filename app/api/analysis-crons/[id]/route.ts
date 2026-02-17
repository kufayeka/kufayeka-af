import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { assertValidCronExpression } from "../../../../lib/cron-expression";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    name?: string;
    description?: string | null;
    cronExpression?: string;
    isRunning?: boolean;
  };

  const cronExpression =
    body.cronExpression === undefined ? undefined : body.cronExpression.trim();

  if (cronExpression !== undefined) {
    try {
      assertValidCronExpression(cronExpression);
    } catch (error) {
      return NextResponse.json(
        { error: (error as Error).message },
        { status: 400 }
      );
    }
  }

  const cron = await prisma.analysisCron.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description ?? null,
      cronExpression,
      isRunning: body.isRunning,
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

  return NextResponse.json({ cron });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  await prisma.analysisScript.updateMany({
    where: { cronId: id },
    data: { cronId: null, triggerType: "ON_REQUEST" },
  });

  await prisma.analysisCron.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
