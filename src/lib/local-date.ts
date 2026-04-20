const localIsoDateFormatter = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

const DEFAULT_LOCAL_TIME_BUCKET_MINUTES = 10;

export function formatLocalIsoDate(value: string) {
  const parsedDateOnly = normalizeIsoDateOnly(value);

  if (parsedDateOnly) {
    return parsedDateOnly;
  }

  const parsed = new Date(value);

  if (!Number.isFinite(parsed.getTime())) {
    return value.slice(0, 10);
  }

  return localIsoDateFormatter.format(parsed);
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

  const bucketStartMinute =
    Math.floor(parsed.getMinutes() / bucketMinutes) * bucketMinutes;
  const year = String(parsed.getFullYear());
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hour = String(parsed.getHours()).padStart(2, "0");
  const minute = String(bucketStartMinute).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}/bucket-${bucketMinutes}`;
}

function normalizeIsoDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/u.test(value) ? value : null;
}
