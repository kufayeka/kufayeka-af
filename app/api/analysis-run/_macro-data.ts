import { prisma } from "../../../lib/prisma";

type AssetRow = {
  id: string;
  name: string;
  description: string | null;
  parentAssetId: string | null;
  assetAttributeTemplateId: string | null;
};

type AttributeRow = {
  id: string;
  assetId: string;
  templateItemId: string;
  value: unknown | null;
  templateItem: {
    id: string;
    name: string;
    dataType: string;
    unit: string | null;
    description: string | null;
  };
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

export type BuildMacroDataOptions = {
  assetPaths?: string[];
  attributePaths?: string[];
  includeAllAssets?: boolean;
  includeAllAttributes?: boolean;
  includeAllEvents?: boolean;
};

function normalizePath(value: string) {
  return value
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(".");
}

function buildAssetPath(
  assetId: string,
  map: Map<string, AssetRow>,
  cache: Map<string, string>
) {
  const cached = cache.get(assetId);
  if (cached !== undefined) {
    return cached;
  }
  const asset = map.get(assetId);
  if (!asset) {
    return "";
  }
  const parentPath = asset.parentAssetId
    ? buildAssetPath(asset.parentAssetId, map, cache)
    : "";
  const path = parentPath ? `${parentPath}.${asset.name}` : asset.name;
  cache.set(assetId, path);
  return path;
}

export async function buildMacroData(
  options: BuildMacroDataOptions = {}
): Promise<MacroData> {
  const assets = (await prisma.asset.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      parentAssetId: true,
      assetAttributeTemplateId: true,
    },
  })) as AssetRow[];

  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
  const pathCache = new Map<string, string>();
  const pathByAssetId = new Map<string, string>();
  const assetByPath = new Map<string, AssetRow>();
  assets.forEach((asset) => {
    const path = buildAssetPath(asset.id, assetMap, pathCache);
    if (!path) {
      return;
    }
    pathByAssetId.set(asset.id, path);
    assetByPath.set(path, asset);
  });

  const requestedAssetPaths = new Set<string>();
  (options.assetPaths ?? []).forEach((path) => {
    const normalized = normalizePath(path);
    if (normalized) {
      requestedAssetPaths.add(normalized);
    }
  });
  const requestedAttributePaths = new Set<string>();
  (options.attributePaths ?? []).forEach((path) => {
    const normalized = normalizePath(path);
    if (!normalized) {
      return;
    }
    requestedAttributePaths.add(normalized);
    const parts = normalized.split(".");
    if (parts.length > 1) {
      requestedAssetPaths.add(parts.slice(0, -1).join("."));
    }
  });

  const includeAllAssets = options.includeAllAssets === true;
  const selectedAssets = includeAllAssets
    ? assets
    : Array.from(requestedAssetPaths)
        .map((path) => assetByPath.get(path))
        .filter((asset): asset is AssetRow => Boolean(asset));

  const selectedAssetIds = new Set(selectedAssets.map((asset) => asset.id));
  const assetsByPath: MacroData["assetsByPath"] = {};
  const assetsById: MacroData["assetsById"] = {};
  const attributesByPath: MacroData["attributesByPath"] = {};
  const attributesByAssetPath: MacroData["attributesByAssetPath"] = {};

  selectedAssets.forEach((asset) => {
    const path = pathByAssetId.get(asset.id);
    if (!path) {
      return;
    }
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
  });

  const includeAllAttributes = options.includeAllAttributes === true;
  let attributes: AttributeRow[] = [];
  if (includeAllAttributes && selectedAssetIds.size > 0) {
    attributes = (await prisma.assetAttribute.findMany({
      where: {
        assetId: { in: Array.from(selectedAssetIds) },
      },
      include: { templateItem: true },
    })) as AttributeRow[];
  } else if (requestedAttributePaths.size > 0) {
    const attributeNames = new Set<string>();
    const attributeAssetIds = new Set<string>();
    requestedAttributePaths.forEach((attributePath) => {
      const parts = attributePath.split(".");
      if (parts.length < 2) {
        return;
      }
      const attributeName = parts[parts.length - 1];
      const assetPath = parts.slice(0, -1).join(".");
      const asset = assetByPath.get(assetPath);
      if (!asset) {
        return;
      }
      attributeNames.add(attributeName);
      attributeAssetIds.add(asset.id);
    });

    if (attributeNames.size > 0 && attributeAssetIds.size > 0) {
      attributes = (await prisma.assetAttribute.findMany({
        where: {
          assetId: { in: Array.from(attributeAssetIds) },
          templateItem: { name: { in: Array.from(attributeNames) } },
        },
        include: { templateItem: true },
      })) as AttributeRow[];
    }
  }

  attributes.forEach((attribute) => {
    const assetPath = pathByAssetId.get(attribute.assetId);
    if (!assetPath) {
      return;
    }
    if (!(assetPath in attributesByAssetPath)) {
      return;
    }
    const attributePath = `${assetPath}.${attribute.templateItem.name}`;
    attributesByPath[attributePath] = {
      assetId: attribute.assetId,
      templateItemId: attribute.templateItem.id,
      assetAttributeId: attribute.id,
      name: attribute.templateItem.name,
      dataType: attribute.templateItem.dataType,
      unit: attribute.templateItem.unit ?? null,
      value: attribute.value ?? null,
      path: attributePath,
    };
    attributesByAssetPath[assetPath].push(attributesByPath[attributePath]);
  });

  const eventsById: MacroData["eventsById"] = {};
  if (options.includeAllEvents === true) {
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

    events.forEach((event) => {
      eventsById[event.id] = {
        id: event.id,
        assetId: event.assetId,
        assetPath: pathByAssetId.get(event.assetId) ?? null,
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
  }

  return { assetsByPath, assetsById, attributesByPath, attributesByAssetPath, eventsById };
}
