export {
  buildPronunciationData
} from "./pronunciation-data.ts";
export type {
  PronunciationData
} from "./pronunciation-data.ts";

export {
  fetchPronunciationsForBundle,
  extractCommonsFileTitlesFromWiktionaryWikitext,
  extractSpokenTextFromCommonsTitle,
  resolvePronunciationForEntry,
  scorePronunciationCandidate,
  selectBestPronunciationCandidate
} from "./pronunciation-fetch.ts";
export type {
  EntryKind,
  PronunciationCandidate,
  PronunciationFetchNetworkOptions,
  PronunciationTargetEntry
} from "./pronunciation-fetch.ts";

export {
  createPronunciationReuseContext,
  refreshPronunciationReuseContextBundle,
  reuseCrossMediaPronunciationsForBundle,
  reusePronunciationsAcrossMedia
} from "./pronunciation-reuse.ts";
export type {
  PronunciationReuseContext,
  PronunciationReuseResult
} from "./pronunciation-reuse.ts";

export {
  loadForvoKnownMissingRegistry,
  summarizeBundlePronunciationPending,
  writeBundlePronunciationPendingSummary,
  pronunciationPendingFileName,
  pronunciationWorkflowDirectoryName
} from "./pronunciation-workflow.ts";
export type {
  ForvoKnownMissingEntry,
  ForvoKnownMissingRegistry,
  MediaPronunciationPendingSummary,
  PronunciationPendingEntry
} from "./pronunciation-workflow.ts";

export {
  fetchForvoPronunciationsForBundle,
  fetchForvoPronunciationsForBundleManual,
  parseForvoCandidateText,
  parseForvoWordList,
  resolveRequestedTargets,
  scoreForvoCandidate
} from "./forvo-pronunciation-fetch.ts";
export type {
  ForvoBrowserOptions,
  ForvoCandidate,
  ForvoManualOptions
} from "./forvo-pronunciation-fetch.ts";

export {
  addForvoWordAddRequestEntry,
  buildForvoWordAddPrefill,
  buildForvoWordAddUrl,
  hasForvoWordAddRequestForEntry,
  loadForvoWordAddRequestRegistry,
  normalizeForvoWordAddLabel,
  persistForvoWordAddRequestRegistry,
  reconcileForvoWordAddRequestRegistry
} from "./forvo-word-add.ts";
export type {
  ForvoWordAddPrefill,
  ForvoWordAddRequestEntry,
  ForvoWordAddRequestRegistry
} from "./forvo-word-add.ts";
