import { prisma } from "../../../lib/prisma";
import { resolveTagPath } from "../analysis/_utils";

type BindingSourceType = "attribute" | "constant";

type BindingInput = {
  variableName: string;
  sourceType: BindingSourceType;
  constantType?: "number" | "boolean" | "string" | "array" | "object";
  constantValue?: string | number | boolean;
  attributePath?: string | null;
  attributeKey?: string | null;
};

type BindingValue = {
  sourceType: BindingSourceType;
  value: unknown;
  dataType?: string | null;
  unit?: string | null;
  assetId?: string | null;
  templateItemId?: string | null;
  assetAttributeId?: string | null;
  path?: string | null;
};

const variableNamePattern = /^[A-Za-z_$][\w$]*$/;

function parseConstantValue(input: BindingInput): unknown {
  const raw = input.constantValue ?? "";
  const type = input.constantType ?? "string";

  if (type === "number") {
    const numberValue = Number(raw);
    if (Number.isNaN(numberValue)) {
      throw new Error(`Invalid number constant for ${input.variableName}`);
    }
    return numberValue;
  }

  if (type === "boolean") {
    if (raw === true || raw === false) {
      return raw;
    }
    if (typeof raw === "string") {
      if (raw.toLowerCase() === "true") {
        return true;
      }
      if (raw.toLowerCase() === "false") {
        return false;
      }
    }
    throw new Error(`Invalid boolean constant for ${input.variableName}`);
  }

  if (type === "array" || type === "object") {
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (type === "array" && !Array.isArray(parsed)) {
          throw new Error("Expected array");
        }
        if (
          type === "object" &&
          (parsed === null || Array.isArray(parsed) || typeof parsed !== "object")
        ) {
          throw new Error("Expected object");
        }
        return parsed;
      } catch {
        throw new Error(`Invalid JSON constant for ${input.variableName}`);
      }
    }
    return raw;
  }

  return String(raw);
}

function parseAttributeKey(attributeKey: string) {
  const [assetId, templateItemId] = attributeKey.split("::");
  if (!assetId || !templateItemId) {
    throw new Error("Invalid attributeKey format");
  }
  return { assetId, templateItemId };
}

async function resolveAttributeBinding(input: BindingInput): Promise<BindingValue> {
  if (input.attributeKey) {
    const { assetId, templateItemId } = parseAttributeKey(input.attributeKey);
    const attribute = await prisma.assetAttribute.findUnique({
      where: {
        assetId_templateItemId: { assetId, templateItemId },
      },
      include: { templateItem: true },
    });

    if (!attribute) {
      throw new Error(`Attribute value not found for ${input.variableName}`);
    }

    return {
      sourceType: "attribute",
      value: attribute.value ?? null,
      dataType: attribute.templateItem.dataType,
      unit: attribute.templateItem.unit ?? null,
      assetId,
      templateItemId,
      assetAttributeId: attribute.id,
      path: input.attributePath ?? null,
    };
  }

  if (!input.attributePath) {
    throw new Error(`Attribute path required for ${input.variableName}`);
  }

  const resolved = await resolveTagPath(input.attributePath);
  if (!resolved.assetAttributeId) {
    throw new Error(`Attribute value not found for ${input.variableName}`);
  }

  const attribute = await prisma.assetAttribute.findUnique({
    where: {
      assetId_templateItemId: {
        assetId: resolved.assetId,
        templateItemId: resolved.templateItemId,
      },
    },
  });

  return {
    sourceType: "attribute",
    value: attribute?.value ?? null,
    dataType: resolved.dataType,
    unit: resolved.unit,
    assetId: resolved.assetId,
    templateItemId: resolved.templateItemId,
    assetAttributeId: resolved.assetAttributeId,
    path: input.attributePath ?? null,
  };
}

export async function buildVariableBindings(inputs: BindingInput[]) {
  const bindings: Record<string, BindingValue> = {};

  for (const input of inputs) {
    const variableName = input.variableName?.trim();
    if (!variableName) {
      continue;
    }
    if (!variableNamePattern.test(variableName)) {
      throw new Error(`Invalid variable name: ${variableName}`);
    }

    if (input.sourceType === "constant") {
      bindings[variableName] = {
        sourceType: "constant",
        value: parseConstantValue(input),
      };
      continue;
    }

    bindings[variableName] = await resolveAttributeBinding(input);
  }

  return bindings;
}
