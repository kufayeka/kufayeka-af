import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { parseAttributeValue } from "../analysis/_utils";

export const runtime = "nodejs";

const dataTypes = [
  "STRING",
  "NUMBER",
  "BOOLEAN",
  "ARRAY",
  "OBJECT",
  "JSON",
] as const;
type AssetAttributeDataType = (typeof dataTypes)[number];

function parseValue(dataType: AssetAttributeDataType, rawValue: unknown) {
  return parseAttributeValue(dataType, rawValue);
}

export async function PUT(request: Request) {
  const body = (await request.json()) as {
    assetId?: string;
    attributes?: Array<{
      templateItemId: string;
      value: string | null;
    }>;
  };

  if (!body.assetId || !body.attributes?.length) {
    return NextResponse.json(
      { error: "assetId and attributes are required" },
      { status: 400 }
    );
  }

  const templateItemIds = body.attributes.map((attribute) =>
    attribute.templateItemId
  );

  const templateItems = await prisma.assetAttributeTemplateItem.findMany({
    where: { id: { in: templateItemIds } },
  });

  const templateItemMap = new Map(
    templateItems.map((item) => [item.id, item])
  );

  try {
    await Promise.all(
      body.attributes.map((attribute) => {
        const templateItem = templateItemMap.get(attribute.templateItemId);
        if (!templateItem) {
          throw new Error("Template item not found");
        }
        const parsed = parseValue(
          templateItem.dataType as AssetAttributeDataType,
          attribute.value
        );
        return prisma.assetAttribute.upsert({
          where: {
            assetId_templateItemId: {
              assetId: body.assetId as string,
              templateItemId: attribute.templateItemId,
            },
          },
          update: { value: parsed },
          create: {
            assetId: body.assetId as string,
            templateItemId: attribute.templateItemId,
            value: parsed,
          },
        });
      })
    );
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }

  const refreshed = await prisma.assetAttribute.findMany({
    where: { assetId: body.assetId },
    include: { templateItem: true },
    orderBy: { templateItem: { name: "asc" } },
  });

  return NextResponse.json({ attributes: refreshed });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    assetId?: string;
    templateItemId?: string;
    value?: unknown;
  };

  if (!body.assetId || !body.templateItemId) {
    return NextResponse.json(
      { error: "assetId and templateItemId are required" },
      { status: 400 }
    );
  }

  const templateItem = await prisma.assetAttributeTemplateItem.findUnique({
    where: { id: body.templateItemId },
  });

  if (!templateItem) {
    return NextResponse.json(
      { error: "Template item not found" },
      { status: 404 }
    );
  }

  try {
    const parsed = parseValue(
      templateItem.dataType as AssetAttributeDataType,
      body.value
    );
    const attribute = await prisma.assetAttribute.upsert({
      where: {
        assetId_templateItemId: {
          assetId: body.assetId,
          templateItemId: body.templateItemId,
        },
      },
      update: { value: parsed },
      create: {
        assetId: body.assetId,
        templateItemId: body.templateItemId,
        value: parsed,
      },
      include: { templateItem: true },
    });

    return NextResponse.json({ attribute }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as {
    assetId?: string;
    templateItemId?: string;
  };

  if (!body.assetId || !body.templateItemId) {
    return NextResponse.json(
      { error: "assetId and templateItemId are required" },
      { status: 400 }
    );
  }

  await prisma.assetAttribute.deleteMany({
    where: {
      assetId: body.assetId,
      templateItemId: body.templateItemId,
    },
  });

  return NextResponse.json({ success: true });
}
