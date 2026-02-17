type TriggerType = "ON_REQUEST" | "SCHEDULED";

type InputItem = {
  sourceType?: string;
};

export function normalizeTriggerType(value?: string | null): TriggerType {
  return value === "SCHEDULED" ? "SCHEDULED" : "ON_REQUEST";
}

export function validateInputsForTriggerType(
  triggerType: TriggerType,
  inputs: unknown
) {
  if (triggerType !== "SCHEDULED") {
    return;
  }
  const items = Array.isArray(inputs) ? (inputs as InputItem[]) : [];
  const hasHttpSource = items.some(
    (item) => item?.sourceType === "query" || item?.sourceType === "body"
  );
  if (hasHttpSource) {
    throw new Error(
      "Scheduled scripts/templates cannot use query or body input sources"
    );
  }
}
