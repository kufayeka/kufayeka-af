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
  assetsById: Record<string, {
    id: string;
    name: string;
    description: string | null;
    parentAssetId: string | null;
    assetAttributeTemplateId: string | null;
    path: string;
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
  attributesByAssetPath: Record<string, Array<{
    assetId: string;
    templateItemId: string;
    assetAttributeId: string;
    name: string;
    dataType: string;
    unit: string | null;
    value: unknown | null;
    path: string;
  }>>;
  eventsById: Record<string, {
    id: string;
    assetId: string;
    assetPath: string | null;
    parentEventId: string | null;
    eventCode: string;
    status: string;
    startTimestamp: string;
    endTimestamp: string | null;
    durationSeconds: number | null;
    context: unknown | null;
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
  const assetsById: MacroData["assetsById"] = {};
  const attributesByPath: MacroData["attributesByPath"] = {};
  const attributesByAssetPath: MacroData["attributesByAssetPath"] = {};

  assets.forEach((asset) => {
    const path = buildAssetPath(asset.id, assetMap);
    assetsByPath[path] = {
      id: asset.id,
      name: asset.name,
      description: asset.description ?? null,
      parentAssetId: asset.parentAssetId ?? null,
      assetAttributeTemplateId: asset.assetAttributeTemplateId ?? null,
    };
    assetsById[asset.id] = {
      id: asset.id,
      name: asset.name,
      description: asset.description ?? null,
      parentAssetId: asset.parentAssetId ?? null,
      assetAttributeTemplateId: asset.assetAttributeTemplateId ?? null,
      path,
    };

    attributesByAssetPath[path] = [];

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

      attributesByAssetPath[path].push(attributesByPath[attributePath]);
    });
  });

  const events = await prisma.event.findMany({
    select: {
      id: true,
      assetId: true,
      parentEventId: true,
      eventCode: true,
      status: true,
      startTimestamp: true,
      endTimestamp: true,
      durationSeconds: true,
      context: true,
    },
  });

  const eventsById: MacroData["eventsById"] = {};
  events.forEach((event) => {
    eventsById[event.id] = {
      id: event.id,
      assetId: event.assetId,
      assetPath: assetsById[event.assetId]?.path ?? null,
      parentEventId: event.parentEventId ?? null,
      eventCode: event.eventCode,
      status: event.status,
      startTimestamp: event.startTimestamp.toISOString(),
      endTimestamp: event.endTimestamp
        ? event.endTimestamp.toISOString()
        : null,
      durationSeconds: event.durationSeconds ?? null,
      context: event.context ?? null,
    };
  });

  return { assetsByPath, assetsById, attributesByPath, attributesByAssetPath, eventsById };
}
