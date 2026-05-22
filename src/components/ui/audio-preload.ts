const preloadedAudioSources = new Set<string>();
const MAX_PRELOADED_AUDIO_SOURCE_MARKERS = 128;

export function preloadAudioSources(
  sources: readonly (string | null | undefined)[]
) {
  if (typeof Audio === "undefined") {
    return;
  }

  for (const source of sources) {
    const normalizedSource = source?.trim();

    if (!normalizedSource || !rememberAudioSource(normalizedSource)) {
      continue;
    }

    try {
      const audio = new Audio(normalizedSource);
      audio.preload = "auto";
      audio.load();
    } catch {
      preloadedAudioSources.delete(normalizedSource);
    }
  }
}

function rememberAudioSource(source: string) {
  if (preloadedAudioSources.has(source)) {
    preloadedAudioSources.delete(source);
    preloadedAudioSources.add(source);
    return false;
  }

  while (preloadedAudioSources.size >= MAX_PRELOADED_AUDIO_SOURCE_MARKERS) {
    const oldestSource = preloadedAudioSources.values().next().value;

    if (!oldestSource) {
      break;
    }

    preloadedAudioSources.delete(oldestSource);
  }

  preloadedAudioSources.add(source);
  return true;
}

export function resetAudioPreloadCacheForTests() {
  preloadedAudioSources.clear();
}
