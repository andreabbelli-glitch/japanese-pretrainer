export async function register() {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.NEXT_PHASE === "phase-production-build"
  ) {
    return;
  }

  try {
    process.env.JCS_ENABLE_EMBEDDED_REPLICA = "1";

    const { db, syncDatabaseClient } = await import("@/db");

    // Sync embedded replica from remote Turso before any reads.
    await syncDatabaseClient(db);

    const { getDashboardData, getMediaLibraryData } = await import(
      "@/lib/app-shell"
    );

    // Warm the heaviest caches so the first user request is instant.
    await Promise.all([getDashboardData(), getMediaLibraryData()]);
  } catch {
    // Warm-up failure is non-fatal — first user request will populate the cache.
  }
}
