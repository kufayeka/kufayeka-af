import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

const typeMap: Record<string, { type: string }> = {
  string: { type: "string" },
  number: { type: "number" },
  boolean: { type: "boolean" },
  array: { type: "array" },
  object: { type: "object" },
};

type ScriptInput = {
  variableName?: string;
  sourceType?: string;
  constantType?: string;
  paramKey?: string | null;
  required?: boolean;
};

function buildSchema(type?: string) {
  return typeMap[type ?? "string"] ?? { type: "string" };
}

function buildRequestBody(inputs: ScriptInput[]) {
  const bodyInputs = inputs.filter((input) => input.sourceType === "body");
  if (bodyInputs.length === 0) {
    return undefined;
  }
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  bodyInputs.forEach((input) => {
    const key = input.paramKey ?? input.variableName;
    if (!key) return;
    properties[key] = buildSchema(input.constantType);
    if (input.required) {
      required.push(key);
    }
  });
  return {
    required: bodyInputs.some((input) => input.required),
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties,
          required: required.length ? required : undefined,
        },
      },
    },
  };
}

function buildQueryParameters(inputs: ScriptInput[]) {
  return inputs
    .filter((input) => input.sourceType === "query")
    .map((input) => {
      const name = input.paramKey ?? input.variableName ?? "param";
      return {
        name,
        in: "query",
        required: Boolean(input.required),
        schema: buildSchema(input.constantType),
      };
    });
}

export async function GET() {
  const scripts = await prisma.analysisScript.findMany({
    select: { name: true, inputs: true, description: true },
    orderBy: { name: "asc" },
  });

  const paths: Record<string, unknown> = {};

  scripts.forEach((script) => {
    const inputs = (script.inputs ?? []) as ScriptInput[];
    const queryParams = buildQueryParameters(inputs);
    const requestBody = buildRequestBody(inputs);
    const path = `/api/analysis-run/${script.name}`;

    paths[path] = {
      get: {
        operationId: `runAnalysis_${script.name}_get`,
        summary: `Run analysis ${script.name} (GET)`,
        description: script.description ?? undefined,
        parameters: [
          ...queryParams,
        ],
        responses: {
          "200": { description: "Success" },
          "400": { description: "Validation error" },
          "404": { description: "Analysis not found" },
        },
      },
      post: {
        operationId: `runAnalysis_${script.name}_post`,
        summary: `Run analysis ${script.name} (POST)`,
        description: script.description ?? undefined,
        parameters: [
          ...queryParams,
        ],
        requestBody,
        responses: {
          "200": { description: "Success" },
          "400": { description: "Validation error" },
          "404": { description: "Analysis not found" },
        },
      },
    };
  });

  const spec = {
    openapi: "3.0.3",
    info: {
      title: "Analysis Run API",
      version: "1.0.0",
    },
    servers: [{ url: "/" }],
    paths,
  };

  return NextResponse.json(spec);
}
