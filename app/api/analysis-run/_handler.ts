import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { BindingValidationError, buildVariableBindings } from "./_bindings";
import { runInPool, type PoolWriteItem } from "./_pool";
import { buildMacroData } from "./_macro-data";
import { resolveAssetPath, resolveTagPath } from "../analysis/_utils";
import { writeAssetAttributeByPath } from "../asset-attributes/_write";
import { enqueueHistorianWriteJob } from "../../../lib/historian-write-queue";
import { randomUUID } from "crypto";


type HistorianQueryWrite = PoolWriteItem & {
  paths: string[];
  start: string;
  end: string;
  bucket?: string;
  format?: string;
  iso?: boolean;
};
type HistorianInsertWrite = PoolWriteItem & {
  path: string;
  value: unknown;
  ts?: string | Date | null;
};

type EventGenerateWrite = PoolWriteItem & {
  id?: string;
  timestamp?: string | Date | null;
  parentEventId?: string | null;
  asset?: unknown;
  eventCode?: string | null;
  status?: string | null;
  context?: unknown | null;
};

type EventEndWrite = PoolWriteItem & {
  id?: string;
  timestamp?: string | Date | null;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolveAssetRef(input: unknown) {
  if (!input) {
    throw new Error("Asset is required for event");
  }
  if (typeof input === "string") {
    if (uuidPattern.test(input)) {
      const asset = await prisma.asset.findUnique({ where: { id: input } });
      if (!asset) {
        throw new Error("Asset not found for event");
      }
      return asset;
    }
    const resolved = await resolveAssetPath(String(input).split("."));
    return resolved.asset;
  }
  if (typeof input === "object") {
    const obj = input as {
      id?: string;
      path?: string;
      assetId?: string;
      value?: { id?: string; path?: string; assetId?: string };
    };
    const candidateId = obj.id ?? obj.assetId ?? obj.value?.id ?? obj.value?.assetId;
    const candidatePath = obj.path ?? obj.value?.path;
    if (candidateId) {
      const asset = await prisma.asset.findUnique({ where: { id: candidateId } });
      if (!asset) {
        throw new Error("Asset not found for event");
      }
      return asset;
    }
    if (candidatePath) {
      const resolved = await resolveAssetPath(String(candidatePath).split("."));
      return resolved.asset;
    }
  }
  throw new Error("Invalid asset reference for event");
}

async function readRequestBody(request: Request) {
  if (request.method === "GET") {
    return undefined;
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return undefined;
  }
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function normalizePath(value: string) {
  return value
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(".");
}

function collectBindingPathHints(bindings: Record<string, unknown>) {
  const assetPaths = new Set<string>();
  const attributePaths = new Set<string>();

  Object.values(bindings).forEach((binding) => {
    if (!binding || typeof binding !== "object") {
      return;
    }
    const item = binding as { sourceType?: string; path?: string | null };
    const path = typeof item.path === "string" ? normalizePath(item.path) : "";
    if (!path) {
      return;
    }
    if (item.sourceType === "asset") {
      assetPaths.add(path);
      return;
    }
    if (item.sourceType === "attribute") {
      attributePaths.add(path);
    }
  });

  return { assetPaths, attributePaths };
}

function collectScriptPathHints(script: string) {
  const assetPaths = new Set<string>();
  const attributePaths = new Set<string>();
  let includeAllAssets = false;
  let includeAllAttributes = false;
  let includeAllEvents = false;

  const addLiteralMatches = (regex: RegExp, target: Set<string>) => {
    for (const match of script.matchAll(regex)) {
      const path = normalizePath(match[1] ?? "");
      if (path) {
        target.add(path);
      }
    }
  };

  addLiteralMatches(/Attribute\.get\(\s*["'`]([^"'`]+)["'`]\s*\)/g, attributePaths);
  addLiteralMatches(/Asset\.get\(\s*["'`]([^"'`]+)["'`]\s*\)/g, assetPaths);
  addLiteralMatches(/Asset\.getHierarchy\(\s*["'`]([^"'`]+)["'`]\s*\)/g, assetPaths);
  addLiteralMatches(/Attribute\.list\(\s*["'`]([^"'`]+)["'`]\s*\)/g, assetPaths);

  for (const match of script.matchAll(
    /(?:Attribute|Historian)\.getMany\(\s*\[([\s\S]*?)\]\s*(?:,|\))/g
  )) {
    const rawArray = match[1] ?? "";
    for (const item of rawArray.matchAll(/["'`]([^"'`]+)["'`]/g)) {
      const path = normalizePath(item[1] ?? "");
      if (path) {
        attributePaths.add(path);
      }
    }
  }

  if (/Asset\.(list|query)\s*\(/.test(script)) {
    includeAllAssets = true;
  }
  if (
    (/(Asset\.(get|getHierarchy)\s*\()/.test(script) && assetPaths.size === 0) ||
    (/Attribute\.list\(\s*[^)]*\)/.test(script) && !/Attribute\.list\(\s*["'`]/.test(script))
  ) {
    includeAllAssets = true;
  }
  if (/Attribute\.list\(\s*\)/.test(script)) {
    includeAllAttributes = true;
    includeAllAssets = true;
  }
  if (
    (/(Attribute\.(get|getMany)\s*\()/.test(script) && attributePaths.size === 0) ||
    (/Attribute\.list\(\s*[^)]*\)/.test(script) && !/Attribute\.list\(\s*\)/.test(script))
  ) {
    includeAllAttributes = true;
    includeAllAssets = true;
  }
  if (/Event\.get\s*\(/.test(script)) {
    includeAllEvents = true;
  }

  return {
    assetPaths,
    attributePaths,
    includeAllAssets,
    includeAllAttributes,
    includeAllEvents,
  };
}

export async function handleAnalysisRun(request: Request, nameOverride?: string) {
  const { searchParams } = new URL(request.url);
  const name = nameOverride ?? searchParams.get("name");

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
    const body = await readRequestBody(request);
    const bindings = await buildVariableBindings(inputs as never[], {
      query: searchParams,
      body,
    });
    const effectiveScript = script.templateId
      ? script.template?.script ?? script.script
      : script.script;
    const bindingHints = collectBindingPathHints(bindings);
    const scriptHints = collectScriptPathHints(effectiveScript);
    const combinedAssetPaths = new Set<string>([
      ...bindingHints.assetPaths,
      ...scriptHints.assetPaths,
    ]);
    const combinedAttributePaths = new Set<string>([
      ...bindingHints.attributePaths,
      ...scriptHints.attributePaths,
    ]);
    const macroData = await buildMacroData({
      assetPaths: Array.from(combinedAssetPaths),
      attributePaths: Array.from(combinedAttributePaths),
      includeAllAssets: scriptHints.includeAllAssets,
      includeAllAttributes: scriptHints.includeAllAttributes,
      includeAllEvents: scriptHints.includeAllEvents,
    });

    const wrapped = `(function(){\n${effectiveScript}\n})()`;
    const { result, writes } = await runInPool(wrapped, bindings, macroData);

    if (writes.length > 0) {
      const historianQueries = writes.filter(
        (write) => write.target === "historianQuery"
      ) as HistorianQueryWrite[];
      const historianWrites = writes.filter(
        (write) => write.target === "historian"
      ) as HistorianInsertWrite[];
      const eventGenerateWrites = writes.filter(
        (write) => write.target === "eventGenerate"
      ) as EventGenerateWrite[];
      const eventEndWrites = writes.filter(
        (write) => write.target === "eventEnd"
      ) as EventEndWrite[];
      const attributeWrites = writes.filter((write) => !write.target);

      if (attributeWrites.length > 0) {
        await Promise.all(
          attributeWrites.map(async (write) => {
            if (!write.path) {
              throw new Error("Attribute path is required");
            }
            await writeAssetAttributeByPath({
              path: write.path,
              value: write.value,
              recordHistory: false,
              updateCurrent: true,
            });
          })
        );
      }

      if (historianWrites.length > 0) {
        const validItems = historianWrites
          .filter((write) => typeof write.path === "string" && write.path.length > 0)
          .map((write) => ({
            path: write.path,
            value: write.value,
            ts: write.ts ?? null,
            updateCurrent: false,
          }));

        if (validItems.length !== historianWrites.length) {
          throw new Error("Historian path is required");
        }

        await enqueueHistorianWriteJob({
          items: validItems,
          source: `analysis:${name}`,
        });
      }

      if (eventGenerateWrites.length > 0) {
        await Promise.all(
          eventGenerateWrites.map(async (write) => {
            const asset = await resolveAssetRef(write.asset);
            const id = write.id ?? randomUUID();
            const timestamp = write.timestamp ? new Date(write.timestamp) : new Date();
            if (Number.isNaN(timestamp.getTime())) {
              throw new Error("Invalid event timestamp");
            }
            const eventCode = write.eventCode ?? "PRODUCTION";
            const status = write.status ?? "open";
            const parentEventId = write.parentEventId || null;

            await prisma.event.upsert({
              where: { id },
              update: {
                assetId: asset.id,
                parentEventId,
                eventCode,
                status,
                startTimestamp: timestamp,
                context: write.context ?? null,
              },
              create: {
                id,
                assetId: asset.id,
                parentEventId,
                eventCode,
                status,
                startTimestamp: timestamp,
                context: write.context ?? null,
              },
            });
          })
        );
      }

      if (eventEndWrites.length > 0) {
        await Promise.all(
          eventEndWrites.map(async (write) => {
            if (!write.id) {
              throw new Error("Event id is required to end event");
            }
            const timestamp = write.timestamp ? new Date(write.timestamp) : new Date();
            if (Number.isNaN(timestamp.getTime())) {
              throw new Error("Invalid event timestamp");
            }
            const existing = await prisma.event.findUnique({
              where: { id: write.id },
              select: { startTimestamp: true },
            });
            if (!existing) {
              throw new Error("Event not found");
            }
            const durationSeconds = Math.max(
              0,
              Math.floor(
                (timestamp.getTime() - existing.startTimestamp.getTime()) / 1000
              )
            );
            await prisma.event.update({
              where: { id: write.id },
              data: {
                status: "closed",
                endTimestamp: timestamp,
                durationSeconds,
              },
            });
          })
        );
      }

      if (historianQueries.length > 0) {
        const historianRows: Array<{ path: string; ts: Date; value: unknown }> = [];

        await Promise.all(
          historianQueries.map(async (query: HistorianQueryWrite) => {
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
          (query: HistorianQueryWrite) =>
            query.format === "iso" || query.iso === true
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
    const status = error instanceof BindingValidationError ? 400 : 500;
    return NextResponse.json(
      { message: "error", result: { error: (error as Error).message } },
      { status }
    );
  }
}

