export async function readContentCacheRevalidationErrorDetails(
  response: Response
) {
  const text = await response.text().catch(() => "");
  const trimmed = text.trim();

  if (!trimmed) {
    return "No error details returned.";
  }

  try {
    const payload = JSON.parse(trimmed) as { error?: unknown };
    const error = typeof payload.error === "string" ? payload.error.trim() : "";

    return error || trimmed;
  } catch {
    return trimmed;
  }
}
