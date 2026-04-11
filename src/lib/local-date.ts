const localIsoDateFormatter = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

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

function normalizeIsoDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/u.test(value) ? value : null;
}
