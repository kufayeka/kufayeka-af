import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { buildVariableBindings } from "./_bindings";
import { runInPool } from "./_pool";
import { buildMacroData } from "./_macro-data";
import { parseAttributeValue, resolveTagPath } from "../analysis/_utils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");

  if (!name) {
    return NextResponse.json(
      { message: "error", result: { error: "name is required" } },
      { status: 400 }
    );
  }

  const script = await prisma.analysisScript.findFirst({
    where: { name },
    select: {
      script: true,
      templateId: true,
      inputs: true,
      template: { select: { script: true, inputs: true } },
    },
  });

  if (!script) {
    return NextResponse.json(
      { message: "error", result: { error: "analysis not found" } },
      { status: 404 }
    );
  }

  try {
    const inputs =
      (script.inputs as unknown[]) ??
      (script.template?.inputs as unknown[]) ??
      [];
    const bindings = await buildVariableBindings(inputs as never[]);
    const macroData = await buildMacroData();

    const effectiveScript = script.templateId
      ? script.template?.script ?? script.script
      : script.script;
    const wrapped = `(function(){\n${effectiveScript}\n})()`;
    const { result, writes } = await runInPool(wrapped, bindings, macroData);

    if (writes.length > 0) {
      const historianQueries = writes.filter(
        (write) => (write as { target?: string }).target === "historianQuery"
      );
      const historianWrites = writes.filter(
        (write) => (write as { target?: string }).target === "historian"
      );
      const attributeWrites = writes.filter(
        (write) => !(write as { target?: string }).target
      );

      if (attributeWrites.length > 0) {
        await Promise.all(
          attributeWrites.map(async (write) => {
            const resolved = await resolveTagPath(write.path);
            const parsedValue = parseAttributeValue(
              resolved.dataType,
              write.value
            );
            await prisma.assetAttribute.upsert({
              where: {
                assetId_templateItemId: {
                  assetId: resolved.assetId,
                  templateItemId: resolved.templateItemId,
                },
              },
              update: { value: parsedValue },
              create: {
                assetId: resolved.assetId,
                templateItemId: resolved.templateItemId,
                value: parsedValue,
              },
            });
          })
        );
      }

      if (historianWrites.length > 0) {
        await Promise.all(
          historianWrites.map(async (write) => {
            const resolved = await resolveTagPath(write.path);
            const parsedValue = parseAttributeValue(
              resolved.dataType,
              write.value
            );
            const timestamp = write.ts ? new Date(write.ts) : new Date();
            if (Number.isNaN(timestamp.getTime())) {
              throw new Error("Invalid ts value");
            }
            if (!resolved.assetAttributeId) {
              throw new Error("Attribute value not found");
            }
            await prisma.$executeRaw`
              INSERT INTO asset_attribute_historian (ts, "assetAttributeId", value)
              VALUES (${timestamp}, ${resolved.assetAttributeId}::uuid, ${parsedValue})
              ON CONFLICT ("assetAttributeId", ts)
              DO UPDATE SET value = EXCLUDED.value
            `;
            await prisma.assetAttribute.update({
              where: { id: resolved.assetAttributeId },
              data: { value: parsedValue },
            });
          })
        );
      }

      if (historianQueries.length > 0) {
        const historianRows: Array<{ path: string; ts: Date; value: unknown }> = [];

        await Promise.all(
          historianQueries.map(async (query) => {
            const startTs = new Date(query.start);
            const endTs = new Date(query.end);
            if (
              Number.isNaN(startTs.getTime()) ||
              Number.isNaN(endTs.getTime())
            ) {
              return;
            }
            await Promise.all(
              (query.paths as string[]).map(async (path) => {
                const resolved = await resolveTagPath(path);
                if (!resolved.assetAttributeId) {
                  return;
                }
                if (query.bucket) {
                  const rows = await prisma.$queryRaw`
                    SELECT
                      time_bucket(${query.bucket}::interval, ts) AS ts,
                      last(value, ts) AS value
                    FROM asset_attribute_historian
                    WHERE "assetAttributeId" = ${resolved.assetAttributeId}::uuid
                      AND ts BETWEEN ${startTs} AND ${endTs}
                    GROUP BY 1
                    ORDER BY 1 ASC
                  `;
                  (rows as Array<{ ts: Date; value: unknown }>).forEach((row) => {
                    historianRows.push({ path, ts: row.ts, value: row.value });
                  });
                  return;
                }
                const rows = await prisma.$queryRaw`
                  SELECT ts, value
                  FROM asset_attribute_historian
                  WHERE "assetAttributeId" = ${resolved.assetAttributeId}::uuid
                    AND ts BETWEEN ${startTs} AND ${endTs}
                  ORDER BY ts ASC
                `;
                (rows as Array<{ ts: Date; value: unknown }>).forEach((row) => {
                  historianRows.push({ path, ts: row.ts, value: row.value });
                });
              })
            );
          })
        );

        const useIso = historianQueries.some(
          (query) => query.format === "iso" || query.iso === true
        );
        const byTime = new Map<string, Record<string, unknown>>();
        historianRows.forEach((row) => {
          const date = new Date(row.ts);
          if (Number.isNaN(date.getTime())) {
            return;
          }
          const timeValue = useIso ? date.toISOString() : date.getTime();
          const keyTime = String(timeValue);
          if (!byTime.has(keyTime)) {
            byTime.set(keyTime, { time: timeValue });
          }
          const key = row.path.split(".").pop() ?? row.path;
          byTime.get(keyTime)![key] = row.value;
        });

        const historian = Array.from(byTime.values()).sort((a, b) => {
          const ta = useIso
            ? new Date(a.time as string).getTime()
            : (a.time as number);
          const tb = useIso
            ? new Date(b.time as string).getTime()
            : (b.time as number);
          return ta - tb;
        });

        return NextResponse.json(historian);
      }
    }

    return NextResponse.json({
      message: "success",
      result: result ?? {},
    });
  } catch (error) {
    return NextResponse.json(
      { message: "error", result: { error: (error as Error).message } },
      { status: 500 }
    );
  }
}
