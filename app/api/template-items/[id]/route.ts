import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { Prisma } from "@prisma/client";

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

function parseDefaultValue(
  dataType: AssetAttributeDataType,
  rawValue: unknown
) {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return null;
  }

  if (dataType === "JSON" || dataType === "ARRAY" || dataType === "OBJECT") {
    if (typeof rawValue === "string") {
      try {
        const parsed = JSON.parse(rawValue);
        if (dataType === "ARRAY" && !Array.isArray(parsed)) {
          return rawValue;
        }
        if (
          dataType === "OBJECT" &&
          (parsed === null || Array.isArray(parsed) || typeof parsed !== "object")
        ) {
          return rawValue;
        }
        return parsed;
      } catch {
        return rawValue;
      }
    }
    if (dataType === "ARRAY" && !Array.isArray(rawValue)) {
      return rawValue;
    }
    if (
      dataType === "OBJECT" &&
      (rawValue === null || Array.isArray(rawValue) || typeof rawValue !== "object")
    ) {
      return rawValue;
    }
    return rawValue;
  }

  if (dataType === "NUMBER") {
    const numberValue = Number(rawValue);
    return Number.isNaN(numberValue) ? null : numberValue;
  }

  if (dataType === "BOOLEAN") {
    if (typeof rawValue === "boolean") {
      return rawValue;
    }
    if (typeof rawValue === "string") {
      return rawValue.toLowerCase() === "true";
    }
    return Boolean(rawValue);
  }

  return String(rawValue);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    name?: string;
    description?: string;
    dataType?: string;
    unit?: string;
    defaultValue?: string | null;
  };

  if (body.dataType && !dataTypes.includes(body.dataType as AssetAttributeDataType)) {
    return NextResponse.json(
      { error: "Invalid data type" },
      { status: 400 }
    );
  }

  const parsedDefaultValue = body.dataType
    ? parseDefaultValue(body.dataType as AssetAttributeDataType, body.defaultValue)
    : body.defaultValue;

  const item = await prisma.assetAttributeTemplateItem.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description ?? null,
      dataType: body.dataType as AssetAttributeDataType | undefined,
      unit: body.unit ?? null,
      defaultValue: parsedDefaultValue ?? null,
    },
  });

  return NextResponse.json({ item });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.assetAttributeHistorian.deleteMany({
        where: {
          assetAttribute: {
            templateItemId: id,
          },
        },
      });

      await tx.assetAttribute.deleteMany({
        where: { templateItemId: id },
      });

      await tx.assetAttributeTemplateItem.delete({
        where: { id },
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return NextResponse.json(
        {
          error:
            "Template item masih direferensikan data lain. Hapus dependensi terkait dulu.",
        },
        { status: 409 }
      );
    }
    throw error;
  }

  return NextResponse.json({ success: true });
}
