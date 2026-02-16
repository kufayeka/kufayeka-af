import { prisma } from "../../../lib/prisma";
import { resolveTagPath } from "../analysis/_utils";

type BindingSourceType = "attribute" | "constant" | "query" | "body";

type BindingDataType = "number" | "boolean" | "string" | "array" | "object";

type BindingInput = {
  variableName: string;
  sourceType: BindingSourceType;
  constantType?: BindingDataType;
  constantValue?: string | number | boolean;
  attributePath?: string | null;
  attributeKey?: string | null;
  paramKey?: string | null;
  required?: boolean;
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
  required?: boolean;
};

export class BindingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BindingValidationError";
  }
}

const variableNamePattern = /^[A-Za-z_$][\w$]*$/;

function parseConstantValue(input: BindingInput): unknown {
  const raw = input.constantValue ?? "";
  const type = input.constantType ?? "string";

  if (type === "number") {
    const numberValue = Number(raw);
    if (Number.isNaN(numberValue)) {
      throw new BindingValidationError(
        `Invalid number constant for ${input.variableName}`
      );
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
    throw new BindingValidationError(
      `Invalid boolean constant for ${input.variableName}`
    );
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
        throw new BindingValidationError(
          `Invalid JSON constant for ${input.variableName}`
        );
      }
    }
    return raw;
  }

  return String(raw);
}

function parseAttributeKey(attributeKey: string) {
  const [assetId, templateItemId] = attributeKey.split("::");
  if (!assetId || !templateItemId) {
    throw new BindingValidationError("Invalid attributeKey format");
  }
  return { assetId, templateItemId };
}

function parseTypedValue(
  type: BindingDataType,
  raw: unknown,
  variableName: string
): unknown {
  if (raw === undefined || raw === null || raw === "") {
    return null;
  }

  if (type === "number") {
    const numberValue = Number(raw);
    if (Number.isNaN(numberValue)) {
      throw new BindingValidationError(
        `Invalid number for ${variableName}`
      );
    }
    return numberValue;
  }

  if (type === "boolean") {
    if (typeof raw === "boolean") {
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
    throw new BindingValidationError(`Invalid boolean for ${variableName}`);
  }

  if (type === "array" || type === "object") {
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (type === "array" && !Array.isArray(parsed)) {
          throw new BindingValidationError(`Expected array for ${variableName}`);
        }
        if (
          type === "object" &&
          (parsed === null || Array.isArray(parsed) || typeof parsed !== "object")
        ) {
          throw new BindingValidationError(`Expected object for ${variableName}`);
        }
        return parsed;
      } catch (error) {
        if (error instanceof BindingValidationError) {
          throw error;
        }
        throw new BindingValidationError(`Invalid JSON for ${variableName}`);
      }
    }
    if (type === "array" && !Array.isArray(raw)) {
      throw new BindingValidationError(`Expected array for ${variableName}`);
    }
    if (
      type === "object" &&
      (raw === null || Array.isArray(raw) || typeof raw !== "object")
    ) {
      throw new BindingValidationError(`Expected object for ${variableName}`);
    }
    return raw;
  }

  return String(raw);
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
      throw new BindingValidationError(
        `Attribute value not found for ${input.variableName}`
      );
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
    throw new BindingValidationError(
      `Attribute path required for ${input.variableName}`
    );
  }

  const resolved = await resolveTagPath(input.attributePath);
  if (!resolved.assetAttributeId) {
    throw new BindingValidationError(
      `Attribute value not found for ${input.variableName}`
    );
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

type BindingContext = {
  query?: URLSearchParams;
  body?: unknown;
};

function resolveRequestValue(
  input: BindingInput,
  context: BindingContext
): unknown {
  const key = input.paramKey?.trim();
  if (!key) {
    throw new BindingValidationError(
      `Param key required for ${input.variableName}`
    );
  }

  if (input.sourceType === "query") {
    return context.query?.get(key) ?? undefined;
  }

  const body = context.body;
  if (!body || typeof body !== "object") {
    return undefined;
  }
  return (body as Record<string, unknown>)[key];
}

export async function buildVariableBindings(
  inputs: BindingInput[],
  context: BindingContext = {}
) {
  const bindings: Record<string, BindingValue> = {};

  for (const input of inputs) {
    const variableName = input.variableName?.trim();
    if (!variableName) {
      continue;
    }
    if (!variableNamePattern.test(variableName)) {
      throw new BindingValidationError(`Invalid variable name: ${variableName}`);
    }

    if (input.sourceType === "constant") {
      bindings[variableName] = {
        sourceType: "constant",
        value: parseConstantValue(input),
        required: input.required ?? false,
      };
      continue;
    }

    if (input.sourceType === "query" || input.sourceType === "body") {
      const rawValue = resolveRequestValue(input, context);
      const isMissing = rawValue === undefined || rawValue === null || rawValue === "";
      if (input.required && isMissing) {
        throw new BindingValidationError(
          `${variableName} is required but missing`
        );
      }
      bindings[variableName] = {
        sourceType: input.sourceType,
        value: isMissing
          ? null
          : parseTypedValue(
              input.constantType ?? "string",
              rawValue,
              variableName
            ),
        dataType: input.constantType ?? "string",
        required: input.required ?? false,
        path: input.paramKey ?? null,
      };
      continue;
    }

    bindings[variableName] = await resolveAttributeBinding(input);
  }

  return bindings;
}
