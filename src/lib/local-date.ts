const localIsoDateFormatter = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

export function formatLocalIsoDate(value: string) {
  const parsed = new Date(value);

  if (!Number.isFinite(parsed.getTime())) {
    return value.slice(0, 10);
  }

  return localIsoDateFormatter.format(parsed);
}
