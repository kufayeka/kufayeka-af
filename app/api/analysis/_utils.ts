import { prisma } from "../../../lib/prisma";

type TagResolution = {
  assetId: string;
  templateItemId: string;
  assetAttributeId: string | null;
  dataType: string;
  unit: string | null;
};

type AssetRow = {
  id: string;
  name: string;
  parentAssetId: string | null;
  assetAttributeTemplateId: string | null;
};

export async function resolveTagPath(tagPath: string): Promise<TagResolution> {
  const parts = tagPath.split(".").filter(Boolean);
  if (parts.length < 2) {
    throw new Error("Invalid tag path");
  }

  const attributeName = parts[parts.length - 1];
  const assetPath = parts.slice(0, -1);

  const { asset } = await resolveAssetPath(assetPath);

  if (!asset.assetAttributeTemplateId) {
    throw new Error("Asset has no template");
  }

  const templateItem = await prisma.assetAttributeTemplateItem.findFirst({
    where: {
      assetAttributeTemplateId: asset.assetAttributeTemplateId,
      name: attributeName,
    },
    select: { id: true, dataType: true, unit: true },
  });

  if (!templateItem) {
    throw new Error("Attribute not found");
  }

  const assetAttribute = await prisma.assetAttribute.findUnique({
    where: {
      assetId_templateItemId: {
        assetId: asset.id,
        templateItemId: templateItem.id,
      },
    },
    select: { id: true },
  });

  return {
    assetId: asset.id,
    templateItemId: templateItem.id,
    assetAttributeId: assetAttribute?.id ?? null,
    dataType: templateItem.dataType,
    unit: templateItem.unit ?? null,
  };
}

export async function resolveAssetPath(assetPath: string[]) {
  if (assetPath.length === 0) {
    throw new Error("Invalid asset path");
  }

  const assets = await prisma.asset.findMany({
    select: { id: true, name: true, parentAssetId: true, assetAttributeTemplateId: true },
  });

  const childrenMap = new Map<string | null, AssetRow[]>();
  (assets as AssetRow[]).forEach((asset: AssetRow) => {
    const key = asset.parentAssetId ?? null;
    const list = childrenMap.get(key) ?? [];
    list.push(asset);
    childrenMap.set(key, list);
  });

  const hierarchy: AssetRow[] = [];
  let current: AssetRow | undefined;
  let parentId: string | null = null;
  for (const segment of assetPath) {
    const siblings: AssetRow[] = childrenMap.get(parentId) ?? [];
    current = siblings.find((asset: AssetRow) => asset.name === segment);
    if (!current) {
      throw new Error("Asset path not found");
    }
    hierarchy.push(current);
    parentId = current.id;
  }

  if (!current) {
    throw new Error("Asset not found");
  }

  return { asset: current, hierarchy };
}

export function parseAttributeValue(dataType: string, rawValue: unknown) {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return null;
  }

  if (dataType === "JSON" || dataType === "ARRAY" || dataType === "OBJECT") {
    if (typeof rawValue === "string") {
      try {
        const parsed = JSON.parse(rawValue);
        if (dataType === "ARRAY" && !Array.isArray(parsed)) {
          throw new Error("Value must be an array");
        }
        if (
          dataType === "OBJECT" &&
          (parsed === null || Array.isArray(parsed) || typeof parsed !== "object")
        ) {
          throw new Error("Value must be an object");
        }
        return parsed;
      } catch {
        throw new Error("Invalid JSON value");
      }
    }
    if (dataType === "ARRAY" && !Array.isArray(rawValue)) {
      throw new Error("Value must be an array");
    }
    if (
      dataType === "OBJECT" &&
      (rawValue === null || Array.isArray(rawValue) || typeof rawValue !== "object")
    ) {
      throw new Error("Value must be an object");
    }
    return rawValue;
  }

  if (dataType === "NUMBER") {
    const numberValue = Number(rawValue);
    if (Number.isNaN(numberValue)) {
      throw new Error("Value must be a number");
    }
    return numberValue;
  }

  if (dataType === "BOOLEAN") {
    if (typeof rawValue === "boolean") {
      return rawValue;
    }
    if (typeof rawValue === "string") {
      if (rawValue.toLowerCase() === "true") {
        return true;
      }
      if (rawValue.toLowerCase() === "false") {
        return false;
      }
      throw new Error("Value must be boolean");
    }
    throw new Error("Value must be boolean");
  }

  return String(rawValue);
}
