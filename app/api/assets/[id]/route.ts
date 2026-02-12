import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      assetAttributeTemplate: {
        include: { items: true },
      },
      attributes: {
        include: { templateItem: true },
        orderBy: { templateItem: { name: "asc" } },
      },
    },
  });

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  return NextResponse.json({ asset });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    name?: string;
    description?: string | null;
    parentAssetId?: string | null;
    assetAttributeTemplateId?: string | null;
  };

  const existing = await prisma.asset.findUnique({
    where: { id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const asset = await prisma.asset.update({
    where: { id },
    data: {
      name: body.name ?? existing.name,
      description: body.description ?? existing.description,
      parentAssetId: body.parentAssetId ?? null,
      assetAttributeTemplateId: body.assetAttributeTemplateId ?? null,
    },
  });

  const templateChanged =
    body.assetAttributeTemplateId !== undefined &&
    body.assetAttributeTemplateId !== existing.assetAttributeTemplateId;

  if (templateChanged) {
    await prisma.assetAttribute.deleteMany({
      where: { assetId: asset.id },
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
  }

  return NextResponse.json({ asset });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  await prisma.assetAttribute.deleteMany({
    where: { assetId: id },
  });

  await prisma.asset.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
