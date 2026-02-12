import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { resolveAssetPath } from "../../analysis/_utils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  try {
    const parts = path.split(".").filter(Boolean);
    const { asset, hierarchy } = await resolveAssetPath(parts);
    const assetIds = hierarchy.map((item) => item.id);

    const assets = await prisma.asset.findMany({
      where: { id: { in: assetIds } },
      include: {
        attributes: {
          include: { templateItem: true },
          orderBy: { templateItem: { name: "asc" } },
        },
      },
    });

    const assetMap = new Map(assets.map((item) => [item.id, item]));
    const orderedHierarchy = hierarchy
      .map((item) => assetMap.get(item.id))
      .filter(Boolean);

    return NextResponse.json({
      asset: assetMap.get(asset.id) ?? null,
      hierarchy: orderedHierarchy,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 404 }
    );
  }
}
