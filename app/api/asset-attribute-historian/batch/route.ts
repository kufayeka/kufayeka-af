import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { resolveTagPath } from "../../analysis/_utils";

export const runtime = "nodejs";

type HistorianRow = {
  ts: Date;
  value: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json()) as {
    paths?: string[];
    start?: string;
    end?: string;
    bucket?: string;
  };

  if (!body.paths?.length || !body.start || !body.end) {
    return NextResponse.json(
      { error: "paths, start, and end are required" },
      { status: 400 }
    );
  }

  const startTs = new Date(body.start);
  const endTs = new Date(body.end);

  if (Number.isNaN(startTs.getTime()) || Number.isNaN(endTs.getTime())) {
    return NextResponse.json({ error: "Invalid time range" }, { status: 400 });
  }

  const results = await Promise.all(
    body.paths.map(async (path) => {
      try {
        const resolved = await resolveTagPath(path);
        if (!resolved.assetAttributeId) {
          return { path, error: "Attribute value not found" };
        }

        if (body.bucket) {
          const rows = await prisma.$queryRaw<HistorianRow[]>`
            SELECT
              time_bucket(${body.bucket}::interval, ts) AS ts,
              last(value, ts) AS value
            FROM asset_attribute_historian
            WHERE "assetAttributeId" = ${resolved.assetAttributeId}::uuid
              AND ts BETWEEN ${startTs} AND ${endTs}
            GROUP BY 1
            ORDER BY 1 ASC
          `;
          return {
            path,
            assetId: resolved.assetId,
            templateItemId: resolved.templateItemId,
            assetAttributeId: resolved.assetAttributeId,
            data: rows,
          };
        }

        const rows = await prisma.$queryRaw<HistorianRow[]>`
          SELECT ts, value
          FROM asset_attribute_historian
          WHERE "assetAttributeId" = ${resolved.assetAttributeId}::uuid
            AND ts BETWEEN ${startTs} AND ${endTs}
          ORDER BY ts ASC
        `;

        return {
          path,
          assetId: resolved.assetId,
          templateItemId: resolved.templateItemId,
          assetAttributeId: resolved.assetAttributeId,
          data: rows,
        };
      } catch (error) {
        return { path, error: (error as Error).message };
      }
    })
  );

  return NextResponse.json({ results });
}
