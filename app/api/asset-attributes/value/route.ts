import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { resolveTagPath } from "../../analysis/_utils";
import {
  enqueueAttributeWriteJob,
  waitForAttributeWriteJob,
} from "../../../../lib/attribute-write-queue";
import { writeAssetAttributeByPath } from "../_write";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  try {
    const resolved = await resolveTagPath(path);
    const attribute = await prisma.assetAttribute.findUnique({
      where: {
        assetId_templateItemId: {
          assetId: resolved.assetId,
          templateItemId: resolved.templateItemId,
        },
      },
    });

    return NextResponse.json({
      assetId: resolved.assetId,
      templateItemId: resolved.templateItemId,
      assetAttributeId: resolved.assetAttributeId ?? attribute?.id ?? null,
      dataType: resolved.dataType,
      unit: resolved.unit,
      value: attribute?.value ?? null,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 404 });
  }
}

export async function PUT(request: Request) {
  const { searchParams } = new URL(request.url);
  let mode = searchParams.get("mode") ?? "async";
  let waitRaw: unknown = searchParams.get("waitMs") ?? searchParams.get("wait");

  const body = (await request.json()) as {
    path?: string;
    value?: unknown;
    ts?: string | number | Date;
    mode?: "sync" | "async";
    waitMs?: number;
    wait?: number;
  };

  if (body.mode === "sync") {
    mode = "sync";
  } else if (body.mode === "async") {
    mode = "async";
  }
  if (waitRaw === undefined || waitRaw === null || waitRaw === "") {
    waitRaw = body.waitMs ?? body.wait ?? waitRaw;
  }

  if (!body.path) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  if (body.value === undefined) {
    return NextResponse.json({ error: "value is required" }, { status: 400 });
  }

  if (mode === "sync") {
    try {
      const result = await writeAssetAttributeByPath({
        path: body.path,
        value: body.value,
        ts: body.ts,
        recordHistory: body.ts !== undefined && body.ts !== null,
        updateCurrent: true,
      });
      return NextResponse.json({
        success: true,
        assetId: result.resolved.assetId,
        templateItemId: result.resolved.templateItemId,
        assetAttributeId: result.attribute.id,
        value: result.value,
        ts: result.ts.toISOString(),
      });
    } catch (error) {
      const message = (error as Error).message;
      return NextResponse.json(
        { error: message },
        { status: message.includes("Value must") || message.includes("Invalid") ? 400 : 404 }
      );
    }
  }

  const waitMs = parseWaitMs(waitRaw);
  const job = await enqueueAttributeWriteJob({
    path: body.path,
    value: body.value,
    ts: body.ts ?? null,
  });

  if (waitMs === 0) {
    return NextResponse.json(
      { accepted: true, jobId: job.id, status: "queued" },
      { status: 202 }
    );
  }

  try {
    const result = await waitForAttributeWriteJob(job, waitMs);
    return NextResponse.json({
      accepted: true,
      jobId: job.id,
      status: "completed",
      result,
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
