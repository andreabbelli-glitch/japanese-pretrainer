export { buildPronunciationData } from "./model/data.ts";
export type { PronunciationData } from "./model/data.ts";

export type {
  EntryKind,
  PronunciationFetchNetworkOptions,
  PronunciationTargetEntry
} from "./model/shared.ts";

export {
  createPronunciationReuseContext,
  refreshPronunciationReuseContextBundle,
  reuseCrossMediaPronunciationsForBundle,
  reusePronunciationsAcrossMedia
} from "./tooling/reuse.ts";
export type {
  PronunciationReuseContext,
  PronunciationReuseResult
} from "./tooling/reuse.ts";

export {
  loadForvoKnownMissingRegistry,
  summarizeBundlePronunciationPending,
  writeBundlePronunciationPendingSummary,
  pronunciationPendingFileName,
  pronunciationWorkflowDirectoryName
} from "./tooling/workflow.ts";
export type {
  ForvoKnownMissingEntry,
  ForvoKnownMissingRegistry,
  MediaPronunciationPendingSummary,
  PronunciationPendingEntry
} from "./tooling/workflow.ts";

export {
  assertForvoManualRunCanStart,
  fetchForvoPronunciationsForBundle,
  fetchForvoPronunciationsForBundleManual,
  parseForvoCandidateText,
  parseForvoWordList,
  resolveRequestedTargets,
  scoreForvoCandidate
} from "./tooling/forvo-fetch.ts";
export type {
  ForvoBrowserOptions,
  ForvoCandidate,
  ForvoManualOptions,
  ForvoManualRuntimeOptions
} from "./tooling/forvo-fetch.ts";

export {
  addForvoWordAddRequestEntry,
  buildForvoWordAddRequestLabel,
  buildForvoWordAddPrefill,
  buildForvoWordAddUrl,
  hasCurrentForvoWordAddRequestForEntry,
  hasForvoWordAddRequestForEntry,
  loadForvoWordAddRequestRegistry,
  normalizeForvoWordAddLabel,
  persistForvoWordAddRequestRegistry,
  reconcileForvoWordAddRequestRegistry
} from "./tooling/forvo-word-add.ts";
export type {
  ForvoWordAddPrefill,
  ForvoWordAddRequestEntry,
  ForvoWordAddRequestRegistry
} from "./tooling/forvo-word-add.ts";
