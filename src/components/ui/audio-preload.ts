const preloadedAudioSources = new Set<string>();

export function preloadAudioSources(
  sources: readonly (string | null | undefined)[]
) {
  if (typeof Audio === "undefined") {
    return;
  }

  for (const source of sources) {
    const normalizedSource = source?.trim();

    if (!normalizedSource || preloadedAudioSources.has(normalizedSource)) {
      continue;
    }

    preloadedAudioSources.add(normalizedSource);

    try {
      const audio = new Audio(normalizedSource);
      audio.preload = "auto";
      audio.load();
    } catch {
      preloadedAudioSources.delete(normalizedSource);
    }
  }
}

export function resetAudioPreloadCacheForTests() {
  preloadedAudioSources.clear();
}
