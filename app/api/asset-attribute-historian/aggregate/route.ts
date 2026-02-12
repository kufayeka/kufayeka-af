import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { resolveTagPath } from "../../analysis/_utils";

export const runtime = "nodejs";

const allowedAgg = new Set(["avg", "min", "max", "sum", "count", "first", "last"]);

type AggregateRow = {
  value: number | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const agg = (searchParams.get("agg") ?? "avg").toLowerCase();

  if (!path || !start || !end) {
    return NextResponse.json(
      { error: "path, start, and end are required" },
      { status: 400 }
    );
  }

  if (!allowedAgg.has(agg)) {
    return NextResponse.json({ error: "Invalid agg" }, { status: 400 });
  }

  try {
    const resolved = await resolveTagPath(path);
    if (!resolved.assetAttributeId) {
      throw new Error("Attribute value not found");
    }

    const startTs = new Date(start);
    const endTs = new Date(end);

    if (Number.isNaN(startTs.getTime()) || Number.isNaN(endTs.getTime())) {
      return NextResponse.json({ error: "Invalid time range" }, { status: 400 });
    }

    if (agg === "first" || agg === "last") {
      const order = agg === "first" ? "ASC" : "DESC";
      const rows = await prisma.$queryRawUnsafe<AggregateRow[]>(
        `SELECT (value)::double precision AS value
         FROM asset_attribute_historian
         WHERE "assetAttributeId" = $1::uuid AND ts BETWEEN $2 AND $3
         ORDER BY ts ${order}
         LIMIT 1`,
        resolved.assetAttributeId,
        startTs,
        endTs
      );

      return NextResponse.json({
        assetId: resolved.assetId,
        value: rows[0]?.value ?? null,
      });
    }

    const rows = await prisma.$queryRawUnsafe<AggregateRow[]>(
      `SELECT ${agg}((value)::double precision) AS value
       FROM asset_attribute_historian
       WHERE "assetAttributeId" = $1::uuid AND ts BETWEEN $2 AND $3`,
      resolved.assetAttributeId,
      startTs,
      endTs
    );

    return NextResponse.json({
      assetId: resolved.assetId,
      value: rows[0]?.value ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 404 }
    );
  }
}
