import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

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

export async function POST(request: Request) {
  const body = (await request.json()) as {
    assetAttributeTemplateId?: string;
    name?: string;
    description?: string;
    dataType?: string;
    unit?: string;
    defaultValue?: string | null;
  };

  if (!body.assetAttributeTemplateId || !body.name || !body.dataType) {
    return NextResponse.json(
      { error: "Template, name, and dataType are required" },
      { status: 400 }
    );
  }

  if (!dataTypes.includes(body.dataType as AssetAttributeDataType)) {
    return NextResponse.json(
      { error: "Invalid data type" },
      { status: 400 }
    );
  }

  const parsedDefaultValue = parseDefaultValue(
    body.dataType as AssetAttributeDataType,
    body.defaultValue
  );

  const item = await prisma.assetAttributeTemplateItem.create({
    data: {
      assetAttributeTemplateId: body.assetAttributeTemplateId,
      name: body.name,
      description: body.description ?? null,
      dataType: body.dataType as AssetAttributeDataType,
      unit: body.unit ?? null,
      defaultValue: parsedDefaultValue,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}
