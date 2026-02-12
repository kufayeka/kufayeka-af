import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const assets = await prisma.asset.findMany({
    orderBy: { name: "asc" },
    include: {
      attributes: {
        include: { templateItem: true },
        orderBy: { templateItem: { name: "asc" } },
      },
    },
  });

  return NextResponse.json({ assets });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    description?: string;
    parentAssetId?: string | null;
    assetAttributeTemplateId?: string | null;
  };

  if (!body.name) {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400 }
    );
  }

  const asset = await prisma.asset.create({
    data: {
      name: body.name,
      description: body.description ?? null,
      parentAssetId: body.parentAssetId ?? null,
      assetAttributeTemplateId: body.assetAttributeTemplateId ?? null,
    },
  });

  if (asset.assetAttributeTemplateId) {
    const items = await prisma.assetAttributeTemplateItem.findMany({
      where: { assetAttributeTemplateId: asset.assetAttributeTemplateId },
    });

    if (items.length > 0) {
      await prisma.assetAttribute.createMany({
        data: items.map((item) => ({
          assetId: asset.id,
          templateItemId: item.id,
          value: item.defaultValue ?? null,
        })),
        skipDuplicates: true,
      });
    }
  }

  return NextResponse.json({ asset }, { status: 201 });
}
