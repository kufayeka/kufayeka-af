import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { buildVariableBindings } from "./_bindings";
import { runInPool } from "./_pool";
import { buildMacroData } from "./_macro-data";
import { parseAttributeValue, resolveTagPath } from "../analysis/_utils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");

  if (!name) {
    return NextResponse.json(
      { message: "error", result: { error: "name is required" } },
      { status: 400 }
    );
  }

  const script = await prisma.analysisScript.findFirst({
    where: { name },
    select: {
      script: true,
      templateId: true,
      inputs: true,
      template: { select: { script: true, inputs: true } },
    },
  });

  if (!script) {
    return NextResponse.json(
      { message: "error", result: { error: "analysis not found" } },
      { status: 404 }
    );
  }

  try {
    const inputs =
      (script.inputs as unknown[]) ??
      (script.template?.inputs as unknown[]) ??
      [];
    const bindings = await buildVariableBindings(inputs as never[]);
    const macroData = await buildMacroData();

    const effectiveScript = script.templateId
      ? script.template?.script ?? script.script
      : script.script;
    const wrapped = `(function(){\n${effectiveScript}\n})()`;
    const { result, writes } = await runInPool(wrapped, bindings, macroData);

    if (writes.length > 0) {
      await Promise.all(
        writes.map(async (write) => {
          const resolved = await resolveTagPath(write.path);
          const parsedValue = parseAttributeValue(resolved.dataType, write.value);
          await prisma.assetAttribute.upsert({
            where: {
              assetId_templateItemId: {
                assetId: resolved.assetId,
                templateItemId: resolved.templateItemId,
              },
            },
            update: { value: parsedValue },
            create: {
              assetId: resolved.assetId,
              templateItemId: resolved.templateItemId,
              value: parsedValue,
            },
          });
        })
      );
    }

    return NextResponse.json({
      message: "success",
      result: result ?? {},
    });
  } catch (error) {
    return NextResponse.json(
      { message: "error", result: { error: (error as Error).message } },
      { status: 500 }
    );
  }
}
