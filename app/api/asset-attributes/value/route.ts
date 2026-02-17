import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { resolveTagPath } from "../../analysis/_utils";
import { writeAssetAttributeByPath } from "../_write";

export const runtime = "nodejs";

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
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 404 }
    );
  }
}

export async function PUT(request: Request) {
  const body = (await request.json()) as {
    path?: string;
    value?: unknown;
    ts?: string | number | Date;
  };

  if (!body.path) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  if (body.value === undefined) {
    return NextResponse.json({ error: "value is required" }, { status: 400 });
  }

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
