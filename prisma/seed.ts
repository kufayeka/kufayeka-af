import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set in .env");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

type AssetAttributeDataType =
  | "STRING"
  | "NUMBER"
  | "BOOLEAN"
  | "ARRAY"
  | "OBJECT"
  | "JSON";

async function ensureTemplateItem(
  assetAttributeTemplateId: string,
  name: string,
  dataType: AssetAttributeDataType,
  unit: string | null,
  description?: string,
  defaultValue?: unknown | null
) {
  const existing = await prisma.assetAttributeTemplateItem.findFirst({
    where: {
      assetAttributeTemplateId,
      name,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.assetAttributeTemplateItem.create({
    data: {
      assetAttributeTemplateId,
      name,
      description: description ?? null,
      dataType,
      unit,
      defaultValue: (defaultValue ?? null) as unknown as string | null,
    },
  });
}

async function main() {
  const pumpTemplate =
    (await prisma.assetAttributeTemplate.findFirst({
      where: { name: "Pump" },
    })) ??
    (await prisma.assetAttributeTemplate.create({
      data: {
        name: "Pump",
        description: "Template untuk asset tipe pump",
      },
    }));

  const templateItems = await Promise.all([
    ensureTemplateItem(
      pumpTemplate.id,
      "pressure",
      "NUMBER",
      "bar",
      "Tekanan operasi",
      0
    ),
    ensureTemplateItem(
      pumpTemplate.id,
      "temperature",
      "NUMBER",
      "°C",
      "Suhu operasi",
      0
    ),
    ensureTemplateItem(
      pumpTemplate.id,
      "speed",
      "NUMBER",
      "rpm",
      "Kecepatan putaran",
      0
    ),
    ensureTemplateItem(
      pumpTemplate.id,
      "metadata",
      "OBJECT",
      null,
      "Metadata JSON",
      { vendor: "ACME", model: "PX-1" }
    ),
  ]);

  const plantA =
    (await prisma.asset.findFirst({ where: { name: "Plant A" } })) ??
    (await prisma.asset.create({
      data: {
        name: "Plant A",
        description: "Area utama pabrik",
      },
    }));

  const pump01 =
    (await prisma.asset.findFirst({ where: { name: "Pump-01" } })) ??
    (await prisma.asset.create({
      data: {
        name: "Pump-01",
        description: "Pump utama",
        parentAssetId: plantA.id,
        assetAttributeTemplateId: pumpTemplate.id,
      },
    }));

  const defaultValuesByName: Record<string, number> = {
    pressure: 6.5,
    temperature: 80,
    speed: 1450,
  };

  await Promise.all(
    templateItems.map((item) =>
      prisma.assetAttribute.upsert({
        where: {
          assetId_templateItemId: {
            assetId: pump01.id,
            templateItemId: item.id,
          },
        },
        update: {},
        create: {
          assetId: pump01.id,
          templateItemId: item.id,
          value: (defaultValuesByName[item.name] ??
            (item.name === "metadata"
              ? { vendor: "ACME", model: "PX-1" }
              : null)) as unknown as string | null,
        },
      })
    )
  );

  try {
    const pressureItem = templateItems.find((item) => item.name === "pressure");
    const attribute = pressureItem
      ? await prisma.assetAttribute.findUnique({
          where: {
            assetId_templateItemId: {
              assetId: pump01.id,
              templateItemId: pressureItem.id,
            },
          },
        })
      : null;

    if (!attribute) {
      throw new Error("Asset attribute not found for historian seed.");
    }

    await prisma.$executeRaw`
      DELETE FROM asset_attribute_historian WHERE "assetAttributeId" = ${attribute.id}::uuid
    `;

    const now = Date.now();
    const historianPoints = Array.from({ length: 12 }, (_, index) => {
      const ts = new Date(now - index * 60 * 60 * 1000);
      return {
        ts,
        value: 6.5 + Math.sin(index / 2),
      };
    });

    for (const point of historianPoints) {
      await prisma.$executeRaw`
        INSERT INTO asset_attribute_historian (ts, "assetAttributeId", value)
        VALUES (${point.ts}, ${attribute.id}::uuid, ${point.value})
      `;
    }
  } catch (error) {
    console.warn("Historian table not available, skip historian seed.");
  }

  console.log("Seed selesai.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
