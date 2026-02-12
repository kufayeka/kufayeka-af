import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const templates = await prisma.assetAttributeTemplate.findMany({
    include: { items: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    description?: string;
    items?: Array<{
      name: string;
      description?: string;
      dataType: string;
      unit?: string;
      defaultValue?: string | null;
    }>;
  };

  if (!body.name) {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400 }
    );
  }

  const template = await prisma.assetAttributeTemplate.create({
    data: {
      name: body.name,
      description: body.description ?? null,
      items: body.items?.length
        ? {
            create: body.items.map((item) => ({
              name: item.name,
              description: item.description ?? null,
              dataType: item.dataType,
              unit: item.unit ?? null,
              defaultValue: item.defaultValue ?? null,
            })),
          }
        : undefined,
    },
    include: { items: true },
  });

  return NextResponse.json({ template }, { status: 201 });
}
