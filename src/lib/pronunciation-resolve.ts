import path from "node:path";

import {
  getLessonIdBySlug,
  listLessonsByMediaId
} from "../db/queries/lessons.ts";
import { getMediaBySlug } from "../db/queries/media.ts";
import {
  listLessonPronunciationCards,
  listPronunciationEntryRefsByCardIds,
  listReviewPronunciationCards
} from "../db/queries/pronunciation-resolve.ts";
import type { DatabaseClient } from "../db/index.ts";
import { parseContentRoot, parseMediaDirectory } from "./content/index.ts";
import type { NormalizedMediaBundle } from "./content/types.ts";
import { buildEntryKey } from "./entry-id.ts";
import { loadValidatedManifest } from "./manifest-helpers.ts";
import {
  createPronunciationReuseContext,
  fetchForvoPronunciationsForBundleManual,
  fetchPronunciationsForBundle,
  loadForvoKnownMissingRegistry,
  loadForvoWordAddRequestRegistry,
  persistForvoWordAddRequestRegistry,
  reconcileForvoWordAddRequestRegistry,
  refreshPronunciationReuseContextBundle,
  reuseCrossMediaPronunciationsForBundle,
  summarizeBundlePronunciationPending,
  writeBundlePronunciationPendingSummary,
  type ForvoManualOptions,
  type PronunciationFetchNetworkOptions,
  type PronunciationReuseContext
} from "./pronunciation.ts";
import {
  collectPronunciationTargets,
  type PronunciationTargetEntry
} from "./pronunciation-shared.ts";

export type PronunciationResolveMode = "review" | "next-lesson" | "lesson-url";

export type SelectedPronunciationBundle = {
  bundle: NormalizedMediaBundle;
  lessonSlug?: string;
  targets: PronunciationTargetEntry[];
};

export type PronunciationResolveSelection = {
  allBundles: NormalizedMediaBundle[];
  bundles: SelectedPronunciationBundle[];
  mode: PronunciationResolveMode;
  selectedMediaSlugs: string[];
};

export type BundleResolveExecutionSummary = {
  currentBundle: NormalizedMediaBundle;
  finalEntryIds: string[];
  forvoSummary: Awaited<
    ReturnType<typeof fetchForvoPronunciationsForBundleManual>
  > | null;
  knownMissingSkipped: string[];
  offlineSummary: Awaited<ReturnType<typeof fetchPronunciationsForBundle>>;
  pendingSummary: Awaited<
    ReturnType<typeof writeBundlePronunciationPendingSummary>
  >;
  reuseSummary: Awaited<
    ReturnType<typeof reuseCrossMediaPronunciationsForBundle>
  >;
};

type ExecutePronunciationResolveForBundleInput = {
  bundle: NormalizedMediaBundle;
  dryRun?: boolean;
  fetchForvoManual: (input: {
    bundle: NormalizedMediaBundle;
    dryRun?: boolean;
    entryIds?: string[];
    manual: ForvoManualOptions;
    refresh?: boolean;
  }) => Promise<
    Awaited<ReturnType<typeof fetchForvoPronunciationsForBundleManual>>
  >;
  fetchOffline: (input: {
    bundle: NormalizedMediaBundle;
    cacheRoot: string;
    dryRun?: boolean;
    limit?: number;
    network?: PronunciationFetchNetworkOptions;
    onlyTargets?: PronunciationTargetEntry[];
    refresh?: boolean;
  }) => Promise<Awaited<ReturnType<typeof fetchPronunciationsForBundle>>>;
  forvoManualOptions?: ForvoManualOptions;
  knownMissingEntryIds: Set<string>;
  limit?: number;
  retryKnownMissing?: boolean;
  refresh?: boolean;
  refreshBundleState: (
    bundle: NormalizedMediaBundle
  ) => Promise<NormalizedMediaBundle>;
  reuseContext: PronunciationReuseContext;
  reuseCrossMedia: (input: {
    bundle: NormalizedMediaBundle;
    dryRun?: boolean;
    onlyTargets?: PronunciationTargetEntry[];
    reuseContext?: PronunciationReuseContext;
  }) => Promise<
    Awaited<ReturnType<typeof reuseCrossMediaPronunciationsForBundle>>
  >;
  selectedTargets: PronunciationTargetEntry[];
  updatePendingSummary: (input: {
    bundle: NormalizedMediaBundle;
    write: boolean;
  }) => Promise<
    Awaited<ReturnType<typeof writeBundlePronunciationPendingSummary>>
  >;
};

export async function selectPronunciationResolveTargets(input: {
  contentRoot: string;
  database: DatabaseClient;
  lessonUrl?: string;
  mediaSlug?: string;
  mode: PronunciationResolveMode;
}): Promise<PronunciationResolveSelection> {
  const parseResult = await parseContentRoot(path.resolve(input.contentRoot));

  if (!parseResult.ok) {
    throw new Error(
      [
        "Content validation failed. Fix these issues first:",
        ...parseResult.issues.map(
          (issue) =>
            `- [${issue.category}] ${issue.code} at ${issue.location.filePath}: ${issue.message}`
        )
      ].join("\n")
    );
  }

  const bundles = parseResult.data.bundles;
  const bundleByMediaId = new Map(
    bundles
      .filter((bundle) => bundle.media)
      .map((bundle) => [bundle.media!.frontmatter.id, bundle] as const)
  );

  if (input.mode === "review") {
    return selectReviewTargets({
      bundleByMediaId,
      bundles,
      database: input.database,
      mediaSlug: input.mediaSlug
    });
  }

  if (input.mode === "next-lesson") {
    if (!input.mediaSlug) {
      throw new Error("Mode 'next-lesson' requires --media.");
    }

    return selectNextLessonTargets({
      bundleByMediaId,
      bundles,
      database: input.database,
      mediaSlug: input.mediaSlug
    });
  }

  if (!input.lessonUrl) {
    throw new Error("Mode 'lesson-url' requires --lesson-url.");
  }

  return selectLessonUrlTargets({
    bundleByMediaId,
    bundles,
    database: input.database,
    lessonUrl: input.lessonUrl
  });
}

export function parseTextbookLessonUrl(value: string) {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new Error("Unsupported lesson URL: empty value.");
  }

  const pathname = hasUrlProtocol(trimmed)
    ? new URL(trimmed).pathname
    : trimmed;
  const match = pathname.match(/^\/media\/([^/]+)\/textbook\/([^/?#]+)\/?$/u);

  if (!match) {
    throw new Error(`Unsupported lesson URL: '${value}'.`);
  }

  return {
    lessonSlug: decodeURIComponent(match[2] ?? ""),
    mediaSlug: decodeURIComponent(match[1] ?? "")
  };
}

export async function executePronunciationResolveForBundle(
  input: ExecutePronunciationResolveForBundleInput
): Promise<BundleResolveExecutionSummary> {
  let currentBundle = input.bundle;
  const limit =
    typeof input.limit === "number" && input.limit >= 0
      ? input.limit
      : undefined;
  const actionableTargets = await filterAudioBackedTargets(
    currentBundle,
    input.selectedTargets,
    input.refresh
  );
  const knownMissingSkipped = input.retryKnownMissing
    ? []
    : actionableTargets
        .filter((target) =>
          input.knownMissingEntryIds.has(buildEntryKey(target.kind, target.id))
        )
        .map((target) => target.id);
  const candidateTargets = input.retryKnownMissing
    ? actionableTargets
    : actionableTargets.filter(
        (target) =>
          !input.knownMissingEntryIds.has(buildEntryKey(target.kind, target.id))
      );
  const limitedTargets =
    typeof limit === "number"
      ? candidateTargets.slice(0, limit)
      : candidateTargets;

  const reuseSummary = await input.reuseCrossMedia({
    bundle: currentBundle,
    dryRun: input.dryRun,
    onlyTargets: limitedTargets,
    reuseContext: input.reuseContext
  });
  let remainingTargets = removeTargetsByEntryIds(
    limitedTargets,
    reuseSummary.results
      .filter((result) => result.status === "reused")
      .map((result) => buildEntryKey(result.kind, result.entryId))
  );

  if (!input.dryRun && reuseSummary.reused > 0) {
    currentBundle = await input.refreshBundleState(currentBundle);
  }

  const offlineSummary = await input.fetchOffline({
    bundle: currentBundle,
    cacheRoot: path.resolve(process.cwd(), "data", "pronunciations-cache"),
    dryRun: input.dryRun,
    onlyTargets: remainingTargets,
    refresh: input.refresh
  });
  remainingTargets = removeTargetsByEntryIds(
    remainingTargets,
    offlineSummary.results
      .filter((result) => result.status === "matched")
      .map((result) => buildEntryKey(result.kind, result.entryId))
  );

  if (!input.dryRun && offlineSummary.matched > 0) {
    currentBundle = await input.refreshBundleState(currentBundle);
  }

  const forvoTargets = remainingTargets;
  let forvoSummary: Awaited<
    ReturnType<typeof fetchForvoPronunciationsForBundleManual>
  > | null = null;

  if (forvoTargets.length > 0) {
    forvoSummary = await input.fetchForvoManual({
      bundle: currentBundle,
      dryRun: input.dryRun,
      entryIds: forvoTargets.map((target) => target.id),
      manual: input.forvoManualOptions ?? buildDefaultForvoManualOptions(),
      refresh: input.refresh
    });

    if (!input.dryRun && forvoSummary.matched > 0) {
      currentBundle = await input.refreshBundleState(currentBundle);
    }
  }

  if (!input.dryRun) {
    await syncResolvedForvoRequests(
      currentBundle,
      (input.forvoManualOptions ?? buildDefaultForvoManualOptions())
        .requestRegistryPath
    );
  }

  const pendingSummary = await input.updatePendingSummary({
    bundle: currentBundle,
    write: !input.dryRun
  });

  return {
    currentBundle,
    finalEntryIds: forvoTargets.map((target) => target.id),
    forvoSummary,
    knownMissingSkipped,
    offlineSummary,
    pendingSummary,
    reuseSummary
  };
}

export async function resolvePronunciations(input: {
  contentRoot: string;
  database: DatabaseClient;
  dryRun?: boolean;
  forvoManualOptions?: ForvoManualOptions;
  knownMissingPath?: string;
  lessonUrl?: string;
  limit?: number;
  mediaSlug?: string;
  mode: PronunciationResolveMode;
  network?: PronunciationFetchNetworkOptions;
  refresh?: boolean;
  retryKnownMissing?: boolean;
}) {
  const selection = await selectPronunciationResolveTargets({
    contentRoot: input.contentRoot,
    database: input.database,
    lessonUrl: input.lessonUrl,
    mediaSlug: input.mediaSlug,
    mode: input.mode
  });
  const knownMissingRegistry = await loadForvoKnownMissingRegistry(
    input.knownMissingPath
  );
  const reuseContext = await createPronunciationReuseContext(
    selection.allBundles
  );
  let liveBundles = selection.allBundles;
  const summaries: Array<
    SelectedPronunciationBundle & { execution: BundleResolveExecutionSummary }
  > = [];

  for (const bundleSelection of selection.bundles) {
    const knownMissingEntryIds = new Set(
      knownMissingRegistry.entries
        .filter((entry) => entry.mediaSlug === bundleSelection.bundle.mediaSlug)
        .map((entry) => buildEntryKey(entry.entryKind, entry.entryId))
    );
    const execution = await executePronunciationResolveForBundle({
      bundle: bundleSelection.bundle,
      dryRun: input.dryRun,
      fetchForvoManual: (params) =>
        fetchForvoPronunciationsForBundleManual({
          bundle: params.bundle,
          dryRun: params.dryRun,
          entryIds: params.entryIds,
          manual: params.manual,
          refresh: params.refresh
        }),
      fetchOffline: (params) =>
        fetchPronunciationsForBundle({
          bundle: params.bundle,
          cacheRoot: params.cacheRoot,
          dryRun: params.dryRun,
          limit: params.limit,
          network: input.network,
          onlyTargets: params.onlyTargets,
          refresh: params.refresh
        }),
      forvoManualOptions: input.forvoManualOptions,
      knownMissingEntryIds,
      limit: input.limit,
      retryKnownMissing: input.retryKnownMissing,
      refresh: input.refresh,
      refreshBundleState: async (bundle) => {
        const refreshed = await refreshBundleState(bundle);
        await refreshPronunciationReuseContextBundle(reuseContext, refreshed);
        liveBundles = liveBundles.map((candidate) =>
          candidate.mediaSlug === refreshed.mediaSlug ? refreshed : candidate
        );
        return refreshed;
      },
      reuseContext,
      reuseCrossMedia: (params) =>
        reuseCrossMediaPronunciationsForBundle({
          bundle: params.bundle,
          bundles: liveBundles,
          dryRun: params.dryRun,
          onlyTargets: params.onlyTargets,
          reuseContext: params.reuseContext
        }),
      selectedTargets: bundleSelection.targets,
      updatePendingSummary: ({ bundle, write }) =>
        write
          ? writeBundlePronunciationPendingSummary({
              bundle,
              knownMissingPath: input.knownMissingPath,
              knownMissingRegistry
            })
          : summarizeBundlePronunciationPending({
              bundle,
              knownMissingPath: input.knownMissingPath,
              knownMissingRegistry
            })
    });

    summaries.push({
      ...bundleSelection,
      execution
    });
  }

  return {
    mode: selection.mode,
    selectedMediaSlugs: selection.selectedMediaSlugs,
    summaries
  };
}

async function selectReviewTargets(input: {
  bundleByMediaId: Map<string, NormalizedMediaBundle>;
  bundles: NormalizedMediaBundle[];
  database: DatabaseClient;
  mediaSlug?: string;
}) {
  const media = input.mediaSlug
    ? await getRequiredMedia(input.database, input.mediaSlug)
    : null;
  const cards = await listReviewPronunciationCards(
    input.database,
    media?.id ?? undefined
  );

  return buildSelectionFromCards({
    bundleByMediaId: input.bundleByMediaId,
    bundles: input.bundles,
    cards,
    database: input.database,
    mode: "review"
  });
}

async function selectNextLessonTargets(input: {
  bundleByMediaId: Map<string, NormalizedMediaBundle>;
  bundles: NormalizedMediaBundle[];
  database: DatabaseClient;
  mediaSlug: string;
}) {
  const media = await getRequiredMedia(input.database, input.mediaSlug);
  const lessons = await listLessonsByMediaId(input.database, media.id);
  const targetLesson = lessons.find(
    (lesson) => lesson.progress?.status !== "completed"
  );

  if (!targetLesson) {
    throw new Error(
      `Media '${input.mediaSlug}' has no pending textbook lesson.`
    );
  }

  const cards = await listLessonPronunciationCards(
    input.database,
    targetLesson.id
  );

  return buildSelectionFromCards({
    bundleByMediaId: input.bundleByMediaId,
    bundles: input.bundles,
    cards,
    database: input.database,
    lessonSlug: targetLesson.slug,
    mode: "next-lesson"
  });
}

async function selectLessonUrlTargets(input: {
  bundleByMediaId: Map<string, NormalizedMediaBundle>;
  bundles: NormalizedMediaBundle[];
  database: DatabaseClient;
  lessonUrl: string;
}) {
  const { lessonSlug, mediaSlug } = parseTextbookLessonUrl(input.lessonUrl);
  const media = await getRequiredMedia(input.database, mediaSlug);
  const lesson = await getLessonIdBySlug(input.database, media.id, lessonSlug);

  if (!lesson) {
    throw new Error(
      `Lesson '${lessonSlug}' was not found for media '${mediaSlug}'.`
    );
  }

  const cards = await listLessonPronunciationCards(input.database, lesson.id);

  return buildSelectionFromCards({
    bundleByMediaId: input.bundleByMediaId,
    bundles: input.bundles,
    cards,
    database: input.database,
    lessonSlug,
    mode: "lesson-url"
  });
}

async function buildSelectionFromCards(input: {
  bundleByMediaId: Map<string, NormalizedMediaBundle>;
  bundles: NormalizedMediaBundle[];
  cards: Array<{ cardId: string; mediaId: string }>;
  database: DatabaseClient;
  lessonSlug?: string;
  mode: PronunciationResolveMode;
}) {
  const entryRefs = await listPronunciationEntryRefsByCardIds(
    input.database,
    input.cards.map((card) => card.cardId)
  );
  const refsByMediaId = new Map<
    string,
    Array<{ entryId: string; entryType: "term" | "grammar" }>
  >();

  for (const ref of entryRefs) {
    const existing = refsByMediaId.get(ref.mediaId);

    if (existing) {
      existing.push({
        entryId: ref.entryId,
        entryType: ref.entryType
      });
      continue;
    }

    refsByMediaId.set(ref.mediaId, [
      {
        entryId: ref.entryId,
        entryType: ref.entryType
      }
    ]);
  }

  const selectedBundles: SelectedPronunciationBundle[] = [];

  for (const [mediaId, refs] of refsByMediaId.entries()) {
    const bundle = input.bundleByMediaId.get(mediaId);

    if (!bundle) {
      throw new Error(
        `Bundle for media id '${mediaId}' is missing from content/.`
      );
    }

    selectedBundles.push({
      bundle,
      lessonSlug: input.lessonSlug,
      targets: resolveTargetsForEntryRefs(bundle, refs)
    });
  }

  if (selectedBundles.length === 0) {
    throw new Error("No pronunciation targets matched the selected scope.");
  }

  return {
    allBundles: input.bundles,
    bundles: selectedBundles,
    mode: input.mode,
    selectedMediaSlugs: selectedBundles.map((bundle) => bundle.bundle.mediaSlug)
  } satisfies PronunciationResolveSelection;
}

async function getRequiredMedia(database: DatabaseClient, mediaSlug: string) {
  const media = await getMediaBySlug(database, mediaSlug);

  if (!media) {
    throw new Error(`Media '${mediaSlug}' was not found.`);
  }

  return media;
}

async function filterAudioBackedTargets(
  bundle: NormalizedMediaBundle,
  targets: PronunciationTargetEntry[],
  refresh?: boolean
) {
  if (refresh) {
    return targets;
  }

  const manifest = await loadValidatedManifest(
    bundle.mediaDirectory,
    bundle.mediaSlug
  );

  return targets.filter(
    (target) =>
      !(
        target.audioSrc ||
        manifest.entries.get(buildEntryKey(target.kind, target.id))?.audioSrc
      )
  );
}

function removeTargetsByEntryIds(
  targets: PronunciationTargetEntry[],
  entryKeys: string[]
) {
  if (entryKeys.length === 0) {
    return targets;
  }

  const skipped = new Set(entryKeys);
  return targets.filter(
    (target) => !skipped.has(buildEntryKey(target.kind, target.id))
  );
}

function buildDefaultForvoManualOptions(): ForvoManualOptions {
  return {
    controlPort: 3210,
    downloadsDir: path.join(process.env.HOME ?? process.cwd(), "Downloads"),
    knownMissingPath: path.join("data", "forvo-known-missing.json"),
    openUrls: true,
    openWordAddOnSkip: true,
    requestRegistryPath: path.join("data", "forvo-requested-word-add.json"),
    retryKnownMissing: false
  };
}

function hasUrlProtocol(value: string) {
  return /^[a-z][a-z0-9+.-]*:\/\//iu.test(value);
}

function resolveTargetsForEntryRefs(
  bundle: NormalizedMediaBundle,
  entryRefs: Array<{ entryId: string; entryType: "term" | "grammar" }>
) {
  const targetsByKey = new Map(
    collectPronunciationTargets(bundle).map((target) => [
      buildEntryKey(target.kind, target.id),
      target
    ])
  );
  const seen = new Set<string>();
  const targets: PronunciationTargetEntry[] = [];

  for (const ref of entryRefs) {
    const key = buildEntryKey(ref.entryType, ref.entryId);

    if (seen.has(key)) {
      continue;
    }

    const target = targetsByKey.get(key);

    if (!target) {
      throw new Error(
        `Entry '${ref.entryType}:${ref.entryId}' was selected from the database but not found in bundle '${bundle.mediaSlug}'.`
      );
    }

    seen.add(key);
    targets.push(target);
  }

  return targets;
}

async function refreshBundleState(bundle: NormalizedMediaBundle) {
  const refreshed = await parseMediaDirectory(bundle.mediaDirectory);

  if (!refreshed.ok) {
    throw new Error(
      `Content validation failed for '${bundle.mediaSlug}' after pronunciation updates.`
    );
  }

  return refreshed.data;
}

async function syncResolvedForvoRequests(
  bundle: NormalizedMediaBundle,
  requestRegistryPath?: string
) {
  if (!requestRegistryPath) {
    return;
  }

  const { entries: manifestEntries } = await loadValidatedManifest(
    bundle.mediaDirectory,
    bundle.mediaSlug
  );
  const requestRegistry =
    await loadForvoWordAddRequestRegistry(requestRegistryPath);
  const changed = reconcileForvoWordAddRequestRegistry(
    requestRegistry,
    collectPronunciationTargets(bundle).map((entry) => {
      const manifestEntry = manifestEntries.get(
        buildEntryKey(entry.kind, entry.id)
      );

      return {
        audioSource: manifestEntry?.audioSource,
        audioSrc: manifestEntry?.audioSrc ?? entry.audioSrc,
        entryId: entry.id,
        entryKind: entry.kind,
        mediaSlug: entry.mediaSlug
      };
    })
  );

  if (changed > 0) {
    await persistForvoWordAddRequestRegistry(
      requestRegistryPath,
      requestRegistry
    );
  }
}
