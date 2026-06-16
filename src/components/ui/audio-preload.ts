type ReviewAudioSlotRole = "current" | "next";

type ReviewAudioSlot = {
  audio: HTMLAudioElement;
  errorHandler: () => void;
  playToken: number;
  role: ReviewAudioSlotRole;
  source: string | null;
};

export type AudioPreloadOptions = {
  role?: ReviewAudioSlotRole;
};

const audioSlots: Record<ReviewAudioSlotRole, ReviewAudioSlot | null> = {
  current: null,
  next: null
};
let lastCurrentSource: string | null = null;
let lastNextSource: string | null = null;
let lifecycleListenersInstalled = false;

export function preloadAudioSources(
  sources: readonly (string | null | undefined)[],
  options: AudioPreloadOptions = {}
) {
  const normalizedSource = firstNormalizedAudioSource(sources);

  if (!normalizedSource || !canCreateAudioElement()) {
    return;
  }

  ensureLifecycleListeners();

  const role = options.role ?? "current";
  if (role === "current") {
    lastCurrentSource = normalizedSource;
  } else {
    lastNextSource = normalizedSource;
  }

  armAudioSlot(role, normalizedSource);
}

export function playPreloadedAudioSource(source: string | null | undefined) {
  const normalizedSource = normalizeAudioSource(source);

  if (!normalizedSource || !canCreateAudioElement()) {
    return false;
  }

  ensureLifecycleListeners();

  if (
    audioSlots.next?.source === normalizedSource &&
    audioSlots.current?.source !== normalizedSource
  ) {
    promoteNextAudioSlot();
  }

  let slot = audioSlots.current;
  if (slot?.audio.error) {
    releaseAudioSlot("current");
    slot = null;
  }

  if (!slot || slot.source !== normalizedSource) {
    lastCurrentSource = normalizedSource;
    slot = armAudioSlot("current", normalizedSource);
  }

  if (!slot) {
    return false;
  }

  const audio = slot.audio;
  const playToken = (slot.playToken += 1);

  seekAudioElementToStart(audio);

  try {
    const playback = audio.play();

    if (typeof playback.catch === "function") {
      void playback.catch(() => {
        handlePlaybackFailure(slot, playToken);
      });
    }

    return true;
  } catch {
    handlePlaybackFailure(slot, playToken);
    return false;
  }
}

function firstNormalizedAudioSource(
  sources: readonly (string | null | undefined)[]
) {
  for (const source of sources) {
    const normalizedSource = normalizeAudioSource(source);

    if (normalizedSource) {
      return normalizedSource;
    }
  }

  return null;
}

function normalizeAudioSource(source: string | null | undefined) {
  const normalizedSource = source?.trim();

  return normalizedSource ? normalizedSource : null;
}

function canCreateAudioElement() {
  return (
    (typeof document !== "undefined" &&
      typeof document.createElement === "function") ||
    typeof Audio !== "undefined"
  );
}

function armAudioSlot(role: ReviewAudioSlotRole, source: string) {
  let slot = audioSlots[role];

  if (slot?.audio.error) {
    releaseAudioSlot(role);
    slot = null;
  }

  if (!slot) {
    slot = createAudioSlot(role);
    audioSlots[role] = slot;
  }

  if (!slot) {
    return null;
  }

  if (slot.source === source && !slot.audio.error) {
    slot.audio.preload = "auto";
    return slot;
  }

  if (slot.source !== null) {
    stopAudioElement(slot.audio);
  }
  slot.source = source;
  slot.playToken += 1;
  slot.audio.preload = "auto";
  setAudioElementSource(slot.audio, source);
  loadAudioElement(slot.audio);

  return slot;
}

function createAudioSlot(role: ReviewAudioSlotRole): ReviewAudioSlot | null {
  const audio = createAudioElement(role);

  if (!audio) {
    return null;
  }

  const slot: ReviewAudioSlot = {
    audio,
    errorHandler: () => {
      if (audioSlots[slot.role] === slot) {
        releaseAudioSlot(slot.role);
      }
    },
    playToken: 0,
    role,
    source: null
  };

  audio.addEventListener?.("error", slot.errorHandler);

  return slot;
}

function createAudioElement(role: ReviewAudioSlotRole) {
  let audio: HTMLAudioElement | null = null;

  if (
    typeof document !== "undefined" &&
    typeof document.createElement === "function"
  ) {
    audio = document.createElement("audio");
    audio.setAttribute("aria-hidden", "true");
    audio.setAttribute("data-review-audio-slot", role);
    audio.style.display = "none";
    audio.tabIndex = -1;
    document.body?.appendChild(audio);
  } else if (typeof Audio !== "undefined") {
    audio = new Audio("");
  }

  if (!audio) {
    return null;
  }

  audio.preload = "auto";
  audio.controls = false;

  return audio;
}

function promoteNextAudioSlot() {
  const currentSlot = audioSlots.current;
  const nextSlot = audioSlots.next;

  if (!nextSlot) {
    return;
  }

  audioSlots.current = nextSlot;
  setAudioSlotRole(nextSlot, "current");
  audioSlots.next = currentSlot;

  if (currentSlot) {
    setAudioSlotRole(currentSlot, "next");
  }

  lastCurrentSource = nextSlot.source;
  lastNextSource = currentSlot?.source ?? null;
}

function setAudioSlotRole(slot: ReviewAudioSlot, role: ReviewAudioSlotRole) {
  slot.role = role;

  try {
    slot.audio.setAttribute("data-review-audio-slot", role);
  } catch {
    // Some test doubles only implement the media subset we need.
  }
}

function setAudioElementSource(audio: HTMLAudioElement, source: string) {
  try {
    audio.src = source;
    return;
  } catch {
    // Fall through to setAttribute for unusual media element implementations.
  }

  try {
    audio.setAttribute("src", source);
  } catch {
    // play() will report the outcome if the source could not be assigned.
  }
}

function loadAudioElement(audio: HTMLAudioElement) {
  try {
    audio.load();
  } catch {
    // Ignore browser-specific media loading failures; play() reports the outcome.
  }
}

function stopAudioElement(audio: HTMLAudioElement) {
  try {
    audio.pause();
  } catch {
    // Ignore browser-specific media state failures.
  }

  seekAudioElementToStart(audio);
}

function seekAudioElementToStart(audio: HTMLAudioElement) {
  try {
    audio.currentTime = 0;
  } catch {
    // Some browsers reject seeking before enough metadata is available.
  }
}

function handlePlaybackFailure(slot: ReviewAudioSlot, playToken: number) {
  if (slot.playToken !== playToken || audioSlots[slot.role] !== slot) {
    return;
  }

  releaseAudioSlot(slot.role);
}

function releaseAudioSlot(role: ReviewAudioSlotRole) {
  const slot = audioSlots[role];

  if (!slot) {
    return;
  }

  slot.playToken += 1;
  slot.audio.removeEventListener?.("error", slot.errorHandler);
  releaseAudioElement(slot.audio);
  audioSlots[role] = null;
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

  try {
    audio.remove();
  } catch {
    // Test doubles and old browsers may not implement remove().
  }
}

function releaseAllAudioSlots() {
  releaseAudioSlot("current");
  releaseAudioSlot("next");
}

function ensureLifecycleListeners() {
  if (lifecycleListenersInstalled || typeof window === "undefined") {
    return;
  }

  window.addEventListener("pagehide", handlePageHide);
  window.addEventListener("pageshow", handlePageShow);

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }

  lifecycleListenersInstalled = true;
}

function removeLifecycleListeners() {
  if (!lifecycleListenersInstalled || typeof window === "undefined") {
    lifecycleListenersInstalled = false;
    return;
  }

  window.removeEventListener("pagehide", handlePageHide);
  window.removeEventListener("pageshow", handlePageShow);

  if (typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  }

  lifecycleListenersInstalled = false;
}

function handlePageHide() {
  releaseAllAudioSlots();
}

function handlePageShow() {
  restoreKnownAudioSlots();
}

function handleVisibilityChange() {
  if (typeof document === "undefined") {
    return;
  }

  if (document.hidden) {
    releaseAllAudioSlots();
    return;
  }

  restoreKnownAudioSlots();
}

function restoreKnownAudioSlots() {
  if (lastCurrentSource) {
    armAudioSlot("current", lastCurrentSource);
  }

  if (lastNextSource) {
    armAudioSlot("next", lastNextSource);
  }
}

export function resetAudioPreloadCacheForTests() {
  releaseAllAudioSlots();
  lastCurrentSource = null;
  lastNextSource = null;
  removeLifecycleListeners();
}
