import { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { parseAttributeValue, resolveTagPath } from "../analysis/_utils";

type WriteAssetAttributeInput = {
  path: string;
  value: unknown;
  ts?: string | number | Date | null;
  recordHistory?: boolean;
  updateCurrent?: boolean;
};

type WriteAssetAttributeByIdInput = {
  attributeId: string;
  value: unknown;
  ts?: string | number | Date | null;
  recordHistory?: boolean;
  updateCurrent?: boolean;
};

function parseTimestamp(ts?: string | number | Date | null) {
  const timestamp = ts === undefined || ts === null ? new Date() : new Date(ts);
  if (ts !== undefined && ts !== null && Number.isNaN(timestamp.getTime())) {
    throw new Error("Invalid ts value");
  }
  return timestamp;
}

export async function writeAssetAttributeByPath(input: WriteAssetAttributeInput) {
  const resolved = await resolveTagPath(input.path);
  const parsedValue = parseAttributeValue(resolved.dataType, input.value);
  const timestamp = parseTimestamp(input.ts);

  const attribute = await prisma.$transaction(async (tx) => {
    const upserted = await tx.assetAttribute.upsert({
      where: {
        assetId_templateItemId: {
          assetId: resolved.assetId,
          templateItemId: resolved.templateItemId,
        },
      },
      update: {},
      create: {
        assetId: resolved.assetId,
        templateItemId: resolved.templateItemId,
        value: parsedValue as Prisma.InputJsonValue,
      },
    });

    if (input.updateCurrent !== false) {
      await tx.assetAttribute.update({
        where: { id: upserted.id },
        data: { value: parsedValue as Prisma.InputJsonValue },
      });
    }

    if (input.recordHistory !== false) {
      await tx.assetAttributeHistorian.upsert({
        where: {
          assetAttributeId_ts: {
            assetAttributeId: upserted.id,
            ts: timestamp,
          },
        },
        update: {
          value: parsedValue as Prisma.InputJsonValue,
        },
        create: {
          assetAttributeId: upserted.id,
          ts: timestamp,
          value: parsedValue as Prisma.InputJsonValue,
        },
      });
    }

    return tx.assetAttribute.findUniqueOrThrow({
      where: { id: upserted.id },
    });
  });

  return {
    resolved,
    attribute,
    value: parsedValue,
    ts: timestamp,
  };
}

export async function writeAssetAttributeById(input: WriteAssetAttributeByIdInput) {
  const timestamp = parseTimestamp(input.ts);

  const existing = await prisma.assetAttribute.findUnique({
    where: { id: input.attributeId },
    include: { templateItem: { select: { dataType: true, unit: true } } },
  });

  if (!existing) {
    throw new Error("Attribute value not found");
  }

  const parsedValue = parseAttributeValue(existing.templateItem.dataType, input.value);

  const attribute = await prisma.$transaction(async (tx) => {
    if (input.updateCurrent !== false) {
      await tx.assetAttribute.update({
        where: { id: existing.id },
        data: { value: parsedValue as Prisma.InputJsonValue },
      });
    }

    if (input.recordHistory !== false) {
      await tx.assetAttributeHistorian.upsert({
        where: {
          assetAttributeId_ts: {
            assetAttributeId: existing.id,
            ts: timestamp,
          },
        },
        update: {
          value: parsedValue as Prisma.InputJsonValue,
        },
        create: {
          assetAttributeId: existing.id,
          ts: timestamp,
          value: parsedValue as Prisma.InputJsonValue,
        },
      });
    }

    return tx.assetAttribute.findUniqueOrThrow({
      where: { id: existing.id },
    });
  });

  return {
    resolved: {
      assetId: existing.assetId,
      templateItemId: existing.templateItemId,
      assetAttributeId: existing.id,
      dataType: existing.templateItem.dataType,
      unit: existing.templateItem.unit ?? null,
    },
    attribute,
    value: parsedValue,
    ts: timestamp,
  };
}
