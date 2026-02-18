import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { resolveTagPath } from "../analysis/_utils";
import {
  enqueueHistorianWriteJob,
  waitForHistorianWriteJob,
} from "../../../lib/historian-write-queue";

export const runtime = "nodejs";
const DEFAULT_WAIT_MS = 10_000;

function parseWaitMs(raw: unknown) {
  if (raw === undefined || raw === null || raw === "") {
    return DEFAULT_WAIT_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_WAIT_MS;
  }
  return Math.max(0, Math.floor(parsed));
}

type HistorianRow = {
  ts: Date;
  value: unknown;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  const attributeId = searchParams.get("attributeId");
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const bucket = searchParams.get("bucket");

  if ((!path && !attributeId) || !start || !end) {
    return NextResponse.json(
      { error: "path or attributeId, start, and end are required" },
      { status: 400 }
    );
  }

  try {
    const resolved = path ? await resolveTagPath(path) : null;
    const resolvedAttributeId = attributeId ?? resolved?.assetAttributeId;

    if (!resolvedAttributeId) {
      return NextResponse.json(
        { error: "Attribute value not found" },
        { status: 404 }
      );
    }

    const startTs = new Date(start);
    const endTs = new Date(end);

    if (Number.isNaN(startTs.getTime()) || Number.isNaN(endTs.getTime())) {
      return NextResponse.json({ error: "Invalid time range" }, { status: 400 });
    }

    if (bucket) {
      const rows = await prisma.$queryRaw<HistorianRow[]>`
        SELECT
          time_bucket(${bucket}::interval, ts) AS ts,
          last(value, ts) AS value
        FROM asset_attribute_historian
        WHERE "assetAttributeId" = ${resolvedAttributeId}::uuid
          AND ts BETWEEN ${startTs} AND ${endTs}
        GROUP BY 1
        ORDER BY 1 ASC
      `;

      return NextResponse.json({
        assetId: resolved?.assetId ?? null,
        templateItemId: resolved?.templateItemId ?? null,
        assetAttributeId: resolvedAttributeId,
        data: rows,
      });
    }

    const rows = await prisma.$queryRaw<HistorianRow[]>`
      SELECT ts, value
      FROM asset_attribute_historian
      WHERE "assetAttributeId" = ${resolvedAttributeId}::uuid
        AND ts BETWEEN ${startTs} AND ${endTs}
      ORDER BY ts ASC
    `;

    return NextResponse.json({
      assetId: resolved?.assetId ?? null,
      templateItemId: resolved?.templateItemId ?? null,
      assetAttributeId: resolvedAttributeId,
      data: rows,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 404 }
    );
  }
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  let waitRaw: unknown = searchParams.get("waitMs") ?? searchParams.get("wait");

  const body = (await request.json()) as {
    path?: string;
    attributeId?: string;
    ts?: string | number | Date;
    value?: unknown;
    waitMs?: number;
    wait?: number;
  };

  if (waitRaw === undefined || waitRaw === null || waitRaw === "") {
    waitRaw = body.waitMs ?? body.wait ?? waitRaw;
  }

  if (!body.path && !body.attributeId) {
    return NextResponse.json(
      { error: "path or attributeId is required" },
      { status: 400 }
    );
  }

  if (body.value === undefined) {
    return NextResponse.json({ error: "value is required" }, { status: 400 });
  }

  if (!body.ts) {
    return NextResponse.json({ error: "ts (timestamp) is required" }, { status: 400 });
  }

  const timestamp = new Date(body.ts);
  if (Number.isNaN(timestamp.getTime())) {
    return NextResponse.json({ error: "Invalid ts value" }, { status: 400 });
  }

  const waitMs = parseWaitMs(waitRaw);
  const job = await enqueueHistorianWriteJob({
    items: [
      {
        path: body.path,
        attributeId: body.attributeId,
        value: body.value,
        ts: body.ts ?? null,
        updateCurrent: false,
      },
    ],
    source: "api:historian-post",
  });

  if (waitMs === 0) {
    return NextResponse.json(
      { accepted: true, jobId: job.id, status: "queued" },
      { status: 202 }
    );
  }

  try {
    await waitForHistorianWriteJob(job, waitMs);
    return NextResponse.json({
      accepted: true,
      jobId: job.id,
      status: "completed",
    });
  } catch (error) {
    const message = (error as Error).message;
    if (message.toLowerCase().includes("timed out")) {
      return NextResponse.json(
        { accepted: true, jobId: job.id, status: "queued" },
        { status: 202 }
      );
    }
    return NextResponse.json(
      { accepted: false, jobId: job.id, status: "failed", error: message },
      { status: 500 }
    );
  }
}
