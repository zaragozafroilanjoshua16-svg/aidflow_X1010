import { RequestError } from "@/lib/http";
export function object(value: unknown, keys: string[]) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !keys.includes(k))
  )
    throw new RequestError(400, "VALIDATION", "Unexpected request fields.");
  return value as Record<string, unknown>;
}
export function text(value: unknown, min: number, max: number) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  )
    throw new RequestError(
      400,
      "VALIDATION",
      `Text must contain ${min}–${max} characters.`,
    );
  return value.trim();
}
export function uuid(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      value,
    )
  )
    throw new RequestError(400, "VALIDATION", "Invalid record identifier.");
  return value;
}
