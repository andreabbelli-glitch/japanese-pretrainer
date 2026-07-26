const localIsoDateFormatter = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});
const isoDateFormatterByTimeZone = new Map<string, Intl.DateTimeFormat>();

const DEFAULT_LOCAL_TIME_BUCKET_MINUTES = 10;

export function formatLocalIsoDate(value: string) {
  return formatIsoDate(value, localIsoDateFormatter);
}

/** Formats an instant in an explicit user/domain timezone, independent of the host. */
export function formatIsoDateInTimeZone(value: string, timeZone: string) {
  let formatter = isoDateFormatterByTimeZone.get(timeZone);

  if (!formatter) {
    formatter = new Intl.DateTimeFormat("sv-SE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone
    });
    isoDateFormatterByTimeZone.set(timeZone, formatter);
  }

  return formatIsoDate(value, formatter);
}

function formatIsoDate(value: string, formatter: Intl.DateTimeFormat) {
  const parsedDateOnly = normalizeIsoDateOnly(value);

  if (parsedDateOnly) {
    return parsedDateOnly;
  }

  const parsed = new Date(value);

  if (!Number.isFinite(parsed.getTime())) {
    return value.slice(0, 10);
  }

  return formatter.format(parsed);
}

export function getLocalIsoDateKey(value: Date | string) {
  return formatLocalIsoDate(
    value instanceof Date ? value.toISOString() : value
  );
}

export function getLocalIsoTimeBucketKey(
  value: Date | string,
  bucketMinutes: number = DEFAULT_LOCAL_TIME_BUCKET_MINUTES
) {
  const parsed = value instanceof Date ? value : new Date(value);

  if (!Number.isFinite(parsed.getTime())) {
    return `${formatLocalIsoDate(
      value instanceof Date ? value.toString() : value
    )}T00:00/bucket-${bucketMinutes}`;
  }

  if (!Number.isInteger(bucketMinutes) || bucketMinutes <= 0) {
    throw new Error("Time bucket minutes must be a positive integer.");
  }

  const bucketDurationMs = bucketMinutes * 60_000;
  const absoluteBucket = Math.floor(parsed.getTime() / bucketDurationMs);

  // Epoch buckets are host-timezone independent and remain unique across the
  // repeated local hour when daylight saving time ends.
  return `epoch-${absoluteBucket}/bucket-${bucketMinutes}`;
}

function normalizeIsoDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/u.test(value) ? value : null;
}
