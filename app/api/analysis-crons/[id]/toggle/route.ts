import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = (await request.json()) as { isRunning?: boolean };
  const nextValue = Boolean(body.isRunning);

  const cron = await prisma.analysisCron.update({
    where: { id },
    data: { isRunning: nextValue },
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
