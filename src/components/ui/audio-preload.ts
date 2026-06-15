const preloadedAudioElements = new Map<string, HTMLAudioElement>();
// Keep this near the review prefetch horizon: long-lived iOS sessions get
// unreliable when the page retains many media elements.
const MAX_PRELOADED_AUDIO_ELEMENTS = 24;
let lastPlayedAudioElement: HTMLAudioElement | null = null;

export function preloadAudioSources(
  sources: readonly (string | null | undefined)[]
) {
  if (typeof Audio === "undefined") {
    return;
  }

  for (const source of sources) {
    getOrCreatePreloadedAudioElement(source);
  }
}

export function playPreloadedAudioSource(source: string | null | undefined) {
  const audio = getOrCreatePreloadedAudioElement(source);

  if (!audio) {
    return false;
  }

  try {
    audio.currentTime = 0;
  } catch {
    // Some browsers reject seeking before enough metadata is available.
  }

  try {
    if (lastPlayedAudioElement && lastPlayedAudioElement !== audio) {
      stopAudioElement(lastPlayedAudioElement);
    }

    const playback = audio.play();
    lastPlayedAudioElement = audio;

    if (typeof playback.catch === "function") {
      void playback.catch(() => {});
    }

    return true;
  } catch {
    return false;
  }
}

function stopAudioElement(audio: HTMLAudioElement) {
  try {
    audio.pause();
  } catch {
    // Ignore browser-specific media state failures.
  }

  try {
    audio.currentTime = 0;
  } catch {
    // Some browsers reject seeking before enough metadata is available.
  }
}

function getOrCreatePreloadedAudioElement(
  source: string | null | undefined
) {
  if (typeof Audio === "undefined") {
    return null;
  }

  const normalizedSource = source?.trim();

  if (!normalizedSource) {
    return null;
  }

  const existingAudio = preloadedAudioElements.get(normalizedSource);

  if (existingAudio) {
    preloadedAudioElements.delete(normalizedSource);
    preloadedAudioElements.set(normalizedSource, existingAudio);
    return existingAudio;
  }

  while (preloadedAudioElements.size >= MAX_PRELOADED_AUDIO_ELEMENTS) {
    const oldestEntry = preloadedAudioElements.entries().next().value;

    if (!oldestEntry) {
      break;
    }

    const [oldestSource, oldestAudio] = oldestEntry;
    preloadedAudioElements.delete(oldestSource);
    releaseAudioElement(oldestAudio);
  }

  try {
    const audio = new Audio(normalizedSource);
    audio.preload = "auto";
    audio.load();
    preloadedAudioElements.set(normalizedSource, audio);
    return audio;
  } catch {
    preloadedAudioElements.delete(normalizedSource);
    return null;
  }
}

export function resetAudioPreloadCacheForTests() {
  for (const audio of preloadedAudioElements.values()) {
    releaseAudioElement(audio);
  }

  preloadedAudioElements.clear();
  lastPlayedAudioElement = null;
}

function releaseAudioElement(audio: HTMLAudioElement) {
  stopAudioElement(audio);

  try {
    audio.removeAttribute("src");
  } catch {
    // Ignore browser-specific media element teardown failures.
  }

  try {
    audio.load();
  } catch {
    // Reloading after clearing src lets browsers release media resources.
  }

  if (lastPlayedAudioElement === audio) {
    lastPlayedAudioElement = null;
  }
}
