import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { parseAttributeValue, resolveTagPath } from "../analysis/_utils";

export const runtime = "nodejs";

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
  const body = (await request.json()) as {
    path?: string;
    attributeId?: string;
    ts?: string | number | Date;
    value?: unknown;
  };

  if (!body.path && !body.attributeId) {
    return NextResponse.json(
      { error: "path or attributeId is required" },
      { status: 400 }
    );
  }

  if (body.value === undefined) {
    return NextResponse.json({ error: "value is required" }, { status: 400 });
  }

  const timestamp = body.ts ? new Date(body.ts) : new Date();
  if (Number.isNaN(timestamp.getTime())) {
    return NextResponse.json({ error: "Invalid ts value" }, { status: 400 });
  }

  try {
    const resolved = body.path ? await resolveTagPath(body.path) : null;
    const attributeId = body.attributeId ?? resolved?.assetAttributeId;
    if (!attributeId) {
      return NextResponse.json(
        { error: "Attribute value not found" },
        { status: 404 }
      );
    }

    const parsedValue = resolved
      ? parseAttributeValue(resolved.dataType, body.value)
      : body.value;

    await prisma.$transaction([
      prisma.$executeRaw`
        INSERT INTO asset_attribute_historian (ts, "assetAttributeId", value)
        VALUES (${timestamp}, ${attributeId}::uuid, ${parsedValue})
      `,
      prisma.assetAttribute.update({
        where: { id: attributeId },
        data: { value: parsedValue },
      }),
    ]);

    return NextResponse.json(
      {
        success: true,
        ts: timestamp.toISOString(),
        assetId: resolved?.assetId ?? null,
        templateItemId: resolved?.templateItemId ?? null,
        assetAttributeId: attributeId,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes("Record to update not found")) {
      return NextResponse.json(
        { error: "Attribute value not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: message },
      { status: message.includes("Value must") || message.includes("Invalid") ? 400 : 404 }
    );
  }
}
