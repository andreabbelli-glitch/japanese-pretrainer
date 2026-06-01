import path from "node:path";

import type { DatabaseClient } from "../../../db/client.ts";
import { buildEntryKey } from "../../../features/study/model/entry-id.ts";
import type { PronunciationTargetEntry } from "../model/shared.ts";
import {
  loadForvoKnownMissingRegistry,
  type ForvoKnownMissingEntry
} from "./forvo-known-missing.ts";
import {
  buildForvoWordAddUrl,
  hasCurrentForvoWordAddRequestForEntry,
  hasForvoWordAddRequestForEntry,
  loadForvoWordAddRequestRegistry,
  type ForvoWordAddRequestRegistry
} from "./forvo-word-add.ts";
import {
  selectPronunciationResolveTargets,
  type PronunciationResolveMode
} from "./resolve.ts";

export type ForvoPreflightStatus = "blocked" | "noop" | "ready" | "waiting";

export type ForvoPreflightTargetStatus =
  | "audio-ready"
  | "known-missing-blocked"
  | "known-missing-requested"
  | "known-missing-stale-request"
  | "known-missing-unrequested"
  | "needs-resolution"
  | "refresh-selected"
  | "retry-known-missing";

export type ForvoPreflightTarget = {
  blockedReason?: string;
  entryId: string;
  entryKind: "grammar" | "term";
  hasAudio: boolean;
  label: string;
  mediaSlug: string;
  reading?: string;
  requestUrl: string | null;
  status: ForvoPreflightTargetStatus;
};

export type ForvoPreflightTotals = {
  audioBacked: number;
  blocked: number;
  knownMissing: number;
  requestable: number;
  requestedCurrent: number;
  requestedStale: number;
  runnable: number;
  selected: number;
  unresolvedRequests: number;
  withoutAudio: number;
};

export type ForvoPreflightBundle = {
  audioBackedCount: number;
  blockedCount: number;
  knownMissingCount: number;
  lessonSlug?: string;
  mediaSlug: string;
  requestableCount: number;
  requestedCurrentCount: number;
  requestedStaleCount: number;
  runnableCount: number;
  selectedCount: number;
  targets: ForvoPreflightTarget[];
  withoutAudioCount: number;
};

export type ForvoPreflightReport = {
  bundles: ForvoPreflightBundle[];
  command: string;
  mode: PronunciationResolveMode;
  schema_version: 1;
  selectedMediaSlugs: string[];
  status: ForvoPreflightStatus;
  totals: ForvoPreflightTotals;
  unresolvedRequests: Array<{
    mediaSlug: string;
    raw: string;
    reason: string;
  }>;
  warnings: string[];
};

export type ForvoPreflightInput = {
  contentRoot: string;
  database?: DatabaseClient;
  entryIds?: string[];
  knownMissingPath?: string;
  lessonUrl?: string;
  limit?: number;
  mediaSlug?: string;
  mode: PronunciationResolveMode;
  refresh?: boolean;
  requestRegistryPath?: string;
  retryKnownMissing?: boolean;
  wordListPath?: string;
  wordListSource?: string;
  words?: string[];
};

const defaultContentRoot = "content";
const defaultKnownMissingPath = path.join("data", "forvo-known-missing.json");
const defaultRequestRegistryPath = path.join(
  "data",
  "forvo-requested-word-add.json"
);
const defaultTargetDisplayLimit = 20;

export async function buildForvoPreflight(input: ForvoPreflightInput) {
  const selection = await selectPronunciationResolveTargets({
    contentRoot: input.contentRoot,
    database: input.database,
    entryIds: input.entryIds,
    lessonUrl: input.lessonUrl,
    mediaSlug: input.mediaSlug,
    mode: input.mode,
    wordListSource: input.wordListSource,
    words: input.words
  });
  const knownMissingRegistry = await loadForvoKnownMissingRegistry(
    input.knownMissingPath ?? defaultKnownMissingPath
  );
  const requestRegistry = await loadForvoWordAddRequestRegistry(
    input.requestRegistryPath ?? defaultRequestRegistryPath
  );
  const knownMissingByTarget = new Map(
    knownMissingRegistry.entries.map((entry) => [
      buildRegistryTargetKey(entry.mediaSlug, entry.entryKind, entry.entryId),
      entry
    ])
  );
  const bundles = selection.bundles.map((bundleSelection) => {
    const targets = bundleSelection.targets.map((target) =>
      classifyPreflightTarget({
        knownMissingEntry: knownMissingByTarget.get(
          buildRegistryTargetKey(target.mediaSlug, target.kind, target.id)
        ),
        refresh: input.refresh,
        requestRegistry,
        retryKnownMissing: input.retryKnownMissing,
        target
      })
    );
    const summary = summarizeTargets(targets);

    return {
      audioBackedCount: summary.audioBacked,
      blockedCount: summary.blocked,
      knownMissingCount: summary.knownMissing,
      lessonSlug: bundleSelection.lessonSlug,
      mediaSlug: bundleSelection.bundle.mediaSlug,
      requestableCount: summary.requestable,
      requestedCurrentCount: summary.requestedCurrent,
      requestedStaleCount: summary.requestedStale,
      runnableCount: applyLimit(summary.runnable, input.limit),
      selectedCount: summary.selected,
      targets,
      withoutAudioCount: summary.withoutAudio
    } satisfies ForvoPreflightBundle;
  });
  const totals = summarizeBundles(
    bundles,
    selection.requestedUnresolved.length
  );

  return {
    bundles,
    command: buildRecommendedResolveCommand(input),
    mode: selection.mode,
    schema_version: 1,
    selectedMediaSlugs: selection.selectedMediaSlugs,
    status: resolvePreflightStatus(totals),
    totals,
    unresolvedRequests: selection.requestedUnresolved,
    warnings: buildPreflightWarnings(input)
  } satisfies ForvoPreflightReport;
}

export function formatForvoPreflightReport(
  report: ForvoPreflightReport,
  options: { targetLimit?: number } = {}
) {
  const targetLimit = Math.max(
    0,
    options.targetLimit ?? defaultTargetDisplayLimit
  );
  const lines = [
    [
      "FORVO_PREFLIGHT",
      report.status,
      `mode=${report.mode}`,
      `media=${report.selectedMediaSlugs.join(",") || "none"}`,
      `selected=${report.totals.selected}`,
      `runnable=${report.totals.runnable}`,
      `audio=${report.totals.audioBacked}`,
      `known_missing=${report.totals.knownMissing}`,
      `requested=${report.totals.requestedCurrent}`,
      `blocked=${report.totals.blocked}`
    ].join(" "),
    `COMMAND ${report.command}`
  ];

  for (const bundle of report.bundles) {
    lines.push(
      [
        "BUNDLE",
        bundle.mediaSlug,
        `selected=${bundle.selectedCount}`,
        `runnable=${bundle.runnableCount}`,
        `audio=${bundle.audioBackedCount}`,
        `known_missing=${bundle.knownMissingCount}`
      ].join(" ")
    );

    if (bundle.lessonSlug) {
      lines.push(`LESSON ${bundle.lessonSlug}`);
    }

    for (const target of bundle.targets.slice(0, targetLimit)) {
      lines.push(formatTargetLine(target));
    }

    if (bundle.targets.length > targetLimit) {
      lines.push(
        `NOTE targets truncated; ${bundle.targets.length - targetLimit} more in --json output.`
      );
    }
  }

  for (const unresolved of report.unresolvedRequests.slice(0, 10)) {
    lines.push(
      `UNRESOLVED ${unresolved.mediaSlug}:${quoteForLine(unresolved.raw)} reason=${unresolved.reason}`
    );
  }

  if (report.unresolvedRequests.length > 10) {
    lines.push(
      `NOTE unresolved requests truncated; ${report.unresolvedRequests.length - 10} more in --json output.`
    );
  }

  for (const warning of report.warnings) {
    lines.push(`WARNING ${warning}`);
  }

  return `${lines.join("\n")}\n`;
}

function classifyPreflightTarget(input: {
  knownMissingEntry?: ForvoKnownMissingEntry;
  refresh?: boolean;
  requestRegistry: ForvoWordAddRequestRegistry;
  retryKnownMissing?: boolean;
  target: PronunciationTargetEntry;
}) {
  const { target } = input;
  const requestUrl = buildForvoWordAddUrl({
    entryId: target.id,
    entryKind: target.kind,
    label: target.label,
    reading: target.reading
  });
  const hasCurrentRequest = hasCurrentForvoWordAddRequestForEntry(
    input.requestRegistry,
    {
      entryId: target.id,
      entryKind: target.kind,
      label: target.label,
      mediaSlug: target.mediaSlug,
      reading: target.reading
    }
  );
  const hasAnyRequest = hasForvoWordAddRequestForEntry(input.requestRegistry, {
    entryId: target.id,
    entryKind: target.kind,
    mediaSlug: target.mediaSlug
  });
  const status = resolveTargetStatus({
    hasAnyRequest,
    hasAudio: Boolean(target.audioSrc),
    hasCurrentRequest,
    knownMissingEntry: input.knownMissingEntry,
    refresh: input.refresh,
    retryKnownMissing: input.retryKnownMissing
  });

  return {
    blockedReason: input.knownMissingEntry?.wordAddBlockedReason,
    entryId: target.id,
    entryKind: target.kind,
    hasAudio: Boolean(target.audioSrc),
    label: target.label,
    mediaSlug: target.mediaSlug,
    reading: target.reading,
    requestUrl,
    status
  } satisfies ForvoPreflightTarget;
}

function resolveTargetStatus(input: {
  hasAnyRequest: boolean;
  hasAudio: boolean;
  hasCurrentRequest: boolean;
  knownMissingEntry?: ForvoKnownMissingEntry;
  refresh?: boolean;
  retryKnownMissing?: boolean;
}): ForvoPreflightTargetStatus {
  if (input.hasAudio && !input.refresh) {
    return "audio-ready";
  }

  if (input.knownMissingEntry?.wordAddBlockedReason) {
    return input.retryKnownMissing
      ? "retry-known-missing"
      : "known-missing-blocked";
  }

  if (input.knownMissingEntry && input.retryKnownMissing) {
    return "retry-known-missing";
  }

  if (input.knownMissingEntry && input.hasCurrentRequest) {
    return "known-missing-requested";
  }

  if (input.knownMissingEntry && input.hasAnyRequest) {
    return "known-missing-stale-request";
  }

  if (input.knownMissingEntry) {
    return "known-missing-unrequested";
  }

  if (input.hasAudio && input.refresh) {
    return "refresh-selected";
  }

  return "needs-resolution";
}

function summarizeTargets(targets: ForvoPreflightTarget[]) {
  return targets.reduce((totals, target) => {
    totals.selected += 1;

    if (target.hasAudio) {
      totals.audioBacked += 1;
    } else {
      totals.withoutAudio += 1;
    }

    if (target.requestUrl) {
      totals.requestable += 1;
    }

    if (isKnownMissingStatus(target.status)) {
      totals.knownMissing += 1;
    }

    if (target.status === "known-missing-requested") {
      totals.requestedCurrent += 1;
    }

    if (target.status === "known-missing-stale-request") {
      totals.requestedStale += 1;
    }

    if (target.status === "known-missing-blocked") {
      totals.blocked += 1;
    }

    if (isRunnableStatus(target.status)) {
      totals.runnable += 1;
    }

    return totals;
  }, createEmptyTotals());
}

function summarizeBundles(
  bundles: ForvoPreflightBundle[],
  unresolvedRequestCount: number
) {
  const totals = createEmptyTotals();

  for (const bundle of bundles) {
    totals.audioBacked += bundle.audioBackedCount;
    totals.blocked += bundle.blockedCount;
    totals.knownMissing += bundle.knownMissingCount;
    totals.requestable += bundle.requestableCount;
    totals.requestedCurrent += bundle.requestedCurrentCount;
    totals.requestedStale += bundle.requestedStaleCount;
    totals.runnable += bundle.runnableCount;
    totals.selected += bundle.selectedCount;
    totals.withoutAudio += bundle.withoutAudioCount;
  }

  totals.unresolvedRequests = unresolvedRequestCount;

  return totals;
}

function createEmptyTotals() {
  return {
    audioBacked: 0,
    blocked: 0,
    knownMissing: 0,
    requestable: 0,
    requestedCurrent: 0,
    requestedStale: 0,
    runnable: 0,
    selected: 0,
    unresolvedRequests: 0,
    withoutAudio: 0
  } satisfies ForvoPreflightTotals;
}

function resolvePreflightStatus(totals: ForvoPreflightTotals) {
  if (totals.runnable > 0) {
    return "ready";
  }

  if (totals.withoutAudio === 0) {
    return "noop";
  }

  if (totals.blocked > 0) {
    return "blocked";
  }

  return "waiting";
}

function buildPreflightWarnings(input: ForvoPreflightInput) {
  const warnings: string[] = [];

  if (input.mode !== "targeted") {
    warnings.push(
      "selection uses the local DB; run the relevant content:import first if Markdown changed recently."
    );
  }

  return warnings;
}

function buildRecommendedResolveCommand(input: ForvoPreflightInput) {
  const args = [
    "./scripts/with-node.sh",
    "pnpm",
    "pronunciations:resolve",
    "--"
  ];

  if (!isDefaultPath(input.contentRoot, defaultContentRoot)) {
    args.push("--content-root", input.contentRoot);
  }

  args.push("--mode", input.mode);

  if (input.mediaSlug) {
    args.push("--media", input.mediaSlug);
  }

  if (input.lessonUrl) {
    args.push("--lesson-url", input.lessonUrl);
  }

  for (const entryId of input.entryIds ?? []) {
    args.push("--entry", entryId);
  }

  for (const word of input.words ?? []) {
    args.push("--word", word);
  }

  if (input.wordListPath) {
    args.push("--words-file", input.wordListPath);
  }

  if (typeof input.limit === "number") {
    args.push("--limit", String(input.limit));
  }

  if (input.refresh) {
    args.push("--refresh");
  }

  if (input.retryKnownMissing) {
    args.push("--retry-known-missing");
  }

  if (
    input.knownMissingPath &&
    !isDefaultPath(input.knownMissingPath, defaultKnownMissingPath)
  ) {
    args.push("--known-missing-file", input.knownMissingPath);
  }

  if (
    input.requestRegistryPath &&
    !isDefaultPath(input.requestRegistryPath, defaultRequestRegistryPath)
  ) {
    args.push("--request-registry-file", input.requestRegistryPath);
  }

  return args.map(quoteShellArg).join(" ");
}

function formatTargetLine(target: ForvoPreflightTarget) {
  const fields = [
    "TARGET",
    `${target.mediaSlug}:${target.entryKind}:${target.entryId}`,
    target.status,
    `label=${quoteForLine(target.label)}`,
    target.reading ? `reading=${quoteForLine(target.reading)}` : null,
    target.blockedReason ? `blocked=${target.blockedReason}` : null
  ];

  return fields.filter((field): field is string => field !== null).join(" ");
}

function isKnownMissingStatus(status: ForvoPreflightTargetStatus) {
  return (
    status === "known-missing-blocked" ||
    status === "known-missing-requested" ||
    status === "known-missing-stale-request" ||
    status === "known-missing-unrequested" ||
    status === "retry-known-missing"
  );
}

function isRunnableStatus(status: ForvoPreflightTargetStatus) {
  return (
    status === "needs-resolution" ||
    status === "refresh-selected" ||
    status === "retry-known-missing"
  );
}

function applyLimit(count: number, limit: number | undefined) {
  if (typeof limit !== "number") {
    return count;
  }

  return Math.min(count, Math.max(0, limit));
}

function buildRegistryTargetKey(
  mediaSlug: string,
  entryKind: "grammar" | "term",
  entryId: string
) {
  return `${mediaSlug}:${buildEntryKey(entryKind, entryId)}`;
}

function isDefaultPath(value: string, defaultValue: string) {
  return path.resolve(value) === path.resolve(defaultValue);
}

function quoteForLine(value: string) {
  return JSON.stringify(value);
}

function quoteShellArg(value: string) {
  if (/^[A-Za-z0-9_/:=.,@%+-]+$/u.test(value)) {
    return value;
  }

  return `'${value.replace(/'/gu, "'\\''")}'`;
}
