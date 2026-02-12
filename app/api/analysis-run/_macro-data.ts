import { prisma } from "../../../lib/prisma";

type AssetRow = {
  id: string;
  name: string;
  description: string | null;
  parentAssetId: string | null;
  assetAttributeTemplateId: string | null;
  attributes: Array<{
    id: string;
    value: unknown | null;
    templateItem: {
      id: string;
      name: string;
      dataType: string;
      unit: string | null;
      description: string | null;
    };
  }>;
};

export type MacroData = {
  assetsByPath: Record<string, {
    id: string;
    name: string;
    description: string | null;
    parentAssetId: string | null;
    assetAttributeTemplateId: string | null;
  }>;
  attributesByPath: Record<string, {
    assetId: string;
    templateItemId: string;
    assetAttributeId: string;
    name: string;
    dataType: string;
    unit: string | null;
    value: unknown | null;
    path: string;
  }>;
};

function buildAssetPath(assetId: string, map: Map<string, AssetRow>) {
  const parts: string[] = [];
  let current = map.get(assetId) ?? null;
  while (current) {
    parts.unshift(current.name);
    current = current.parentAssetId ? map.get(current.parentAssetId) ?? null : null;
  }
  return parts.join(".");
}

export async function buildMacroData(): Promise<MacroData> {
  const assets = await prisma.asset.findMany({
    include: {
      attributes: {
        include: { templateItem: true },
      },
    },
  });

  const assetMap = new Map(assets.map((asset) => [asset.id, asset as AssetRow]));
  const assetsByPath: MacroData["assetsByPath"] = {};
  const attributesByPath: MacroData["attributesByPath"] = {};

  assets.forEach((asset) => {
    const path = buildAssetPath(asset.id, assetMap);
    assetsByPath[path] = {
      id: asset.id,
      name: asset.name,
      description: asset.description ?? null,
      parentAssetId: asset.parentAssetId ?? null,
      assetAttributeTemplateId: asset.assetAttributeTemplateId ?? null,
    };

    (asset.attributes ?? []).forEach((attribute) => {
      const attributePath = `${path}.${attribute.templateItem.name}`;
      attributesByPath[attributePath] = {
        assetId: asset.id,
        templateItemId: attribute.templateItem.id,
        assetAttributeId: attribute.id,
        name: attribute.templateItem.name,
        dataType: attribute.templateItem.dataType,
        unit: attribute.templateItem.unit ?? null,
        value: attribute.value ?? null,
        path: attributePath,
      };
    });
  });

  return { assetsByPath, attributesByPath };
}
