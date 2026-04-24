import { readInternalHref } from "@/lib/site";

export function readRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing form field: ${key}`);
  }

  return value.trim();
}

export function readOptionalInternalHref(formData: FormData, key: string) {
  return readInternalHref(
    formData
      .getAll(key)
      .filter((value): value is string => typeof value === "string")
  );
}
