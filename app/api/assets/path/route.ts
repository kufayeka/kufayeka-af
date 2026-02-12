import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { resolveAssetPath } from "../../analysis/_utils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  const includeChildren = searchParams.get("includeChildren") !== "false";

  if (!path) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  try {
    const parts = path.split(".").filter(Boolean);
    const { asset } = await resolveAssetPath(parts);

    const assets = await prisma.asset.findMany({
      include: {
        attributes: {
          include: { templateItem: true },
          orderBy: { templateItem: { name: "asc" } },
        },
      },
    });

    const assetMap = new Map(assets.map((item) => [item.id, item]));
    const childrenMap = new Map<string | null, string[]>();
    assets.forEach((item) => {
      const key = item.parentAssetId ?? null;
      const list = childrenMap.get(key) ?? [];
      list.push(item.id);
      childrenMap.set(key, list);
    });

    const buildTree = (assetId: string): unknown => {
      const node = assetMap.get(assetId);
      if (!node) {
        return null;
      }
      if (!includeChildren) {
        return node;
      }
      const childIds = childrenMap.get(assetId) ?? [];
      return {
        ...node,
        children: childIds
          .map((childId) => buildTree(childId))
          .filter(Boolean),
      };
    };

    return NextResponse.json({
      asset: buildTree(asset.id),
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 404 }
    );
  }
}
