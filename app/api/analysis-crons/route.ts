import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

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
    intervalSecond?: number;
    isRunning?: boolean;
  };

  if (!body.name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const intervalSecond = Math.max(1, Math.floor(Number(body.intervalSecond ?? 60)));

  const cron = await prisma.analysisCron.create({
    data: {
      name: body.name,
      description: body.description ?? null,
      intervalSecond,
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
