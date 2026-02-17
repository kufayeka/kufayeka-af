import cron from "node-cron";

export function isValidCronExpression(expression: string) {
  const normalized = expression.trim();
  if (!normalized) {
    return false;
  }
  const fields = normalized.split(/\s+/);
  if (fields.length !== 6) {
    return false;
  }
  return cron.validate(normalized);
}

export function assertValidCronExpression(expression: string) {
  if (!isValidCronExpression(expression)) {
    throw new Error(
      "Invalid cron expression. Use 6 fields: second minute hour day-of-month month day-of-week"
    );
  }
}
