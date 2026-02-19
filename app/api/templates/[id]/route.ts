import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    name?: string;
    description?: string | null;
  };

  const template = await prisma.assetAttributeTemplate.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description ?? null,
    },
    include: { items: true },
  });

  return NextResponse.json({ template });
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
            templateItem: {
              assetAttributeTemplateId: id,
            },
          },
        },
      });

      await tx.assetAttribute.deleteMany({
        where: {
          templateItem: {
            assetAttributeTemplateId: id,
          },
        },
      });

      await tx.assetAttributeTemplateItem.deleteMany({
        where: { assetAttributeTemplateId: id },
      });

      await tx.assetAttributeTemplate.delete({
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
            "Template masih direferensikan data lain (mis. asset). Lepaskan relasi dulu sebelum delete.",
        },
        { status: 409 }
      );
    }
    throw error;
  }

  return NextResponse.json({ success: true });
}
