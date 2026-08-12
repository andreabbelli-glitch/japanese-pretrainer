export const defaultVitestMaxWorkers = 4;

export function resolveVitestMaxWorkers(
  value = process.env.VITEST_MAX_WORKERS
) {
  const normalized = value?.trim();

  if (!normalized) {
    return defaultVitestMaxWorkers;
  }

  if (!/^[1-9]\d*$/u.test(normalized)) {
    throw new Error(
      "VITEST_MAX_WORKERS must be a positive integer when it is set."
    );
  }

  const workers = Number(normalized);

  if (!Number.isSafeInteger(workers)) {
    throw new Error("VITEST_MAX_WORKERS exceeds the safe integer range.");
  }

  return workers;
}
