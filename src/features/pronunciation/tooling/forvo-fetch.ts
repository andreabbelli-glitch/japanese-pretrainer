import { createInterface } from "node:readline/promises";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import type { Socket } from "node:net";
import { homedir, tmpdir } from "node:os";

import type { NormalizedMediaBundle } from "../../content/types.ts";
import { buildEntryKey } from "../../../features/study/model/entry-id.ts";
import { sleep } from "./fetch-throttle.ts";
import {
  loadValidatedManifest,
  mergePronunciationAudioManifestEntry,
  persistManifestEntries
} from "./manifest-helpers.ts";
import {
  buildForvoAudioAssetPath,
  buildForvoAttribution,
  buildForvoSearchQueries,
  buildForvoWordUrls,
  doesManualDownloadMatchEntry,
  resolveRequestedTargets,
  selectBestForvoCandidate,
  slugifyForvoSegment,
  type ForvoAudioCandidate,
  type ForvoCandidate
} from "./forvo-helpers.ts";
import {
  collectPronunciationTargets,
  type PronunciationTargetEntry
} from "../model/shared.ts";
import {
  addForvoKnownMissingEntry,
  hasForvoKnownMissingEntry,
  loadForvoKnownMissingRegistry,
  persistForvoKnownMissingRegistry,
  pruneForvoKnownMissingRegistry
} from "./forvo-known-missing.ts";
import {
  addForvoWordAddRequestEntry,
  buildForvoWordAddUrl,
  loadForvoWordAddRequestRegistry,
  persistForvoWordAddRequestRegistry,
  reconcileForvoWordAddRequestRegistry,
  type ForvoWordAddRequestRegistry
} from "./forvo-word-add.ts";

export type { ForvoCandidate } from "./forvo-helpers.ts";

export {
  buildForvoSearchQueries,
  buildForvoWordUrls,
  parseForvoCandidateText,
  parseForvoWordList,
  resolveRequestedTargets,
  scoreForvoCandidate,
  selectBestForvoCandidate
} from "./forvo-helpers.ts";

export type ForvoBrowserOptions = {
  ankiAppPath?: string;
  ankiBaseDir?: string;
  ankiPythonPath?: string;
  ankiRunRoot?: string;
  browserTimeoutMs?: number;
  entryDelayMs?: number;
  headless?: boolean;
  keepBrowserOpen?: boolean;
  knownMissingPath?: string;
  openWordAddOnMiss?: boolean;
  profileDir?: string;
  requestRegistryPath?: string;
  retryKnownMissing?: boolean;
};

export type ForvoManualOptions = {
  controlPort?: number;
  downloadsDir: string;
  entryDelayMs?: number;
  knownMissingPath?: string;
  openUrls?: boolean;
  openWordAddOnSkip?: boolean;
  requestRegistryPath?: string;
  retryKnownMissing?: boolean;
};

export type ForvoManualRuntimeOptions = {
  openWordAddOnSkip?: boolean;
  requireInteractiveTTY?: boolean;
  stdinIsTTY?: boolean;
  stdoutIsTTY?: boolean;
};

type SkipResolutionMode = "active" | "pending";

type ManualForvoCaptureResult =
  | {
      status: "downloaded";
      audioAttribution: string;
      audioLicense?: string;
      audioPageUrl: string;
      audioSpeaker?: string;
      audioSrc: string;
    }
  | {
      status: "skipped_known_missing";
    };

type ForvoAnkiBatchTarget = {
  entryId: string;
  entryKind: "grammar" | "term";
  label: string;
  mediaSlug: string;
  queries: string[];
  reading?: string;
};

type ForvoAnkiBatchCandidate = ForvoCandidate & {
  audioCandidates: ForvoAudioCandidate[];
};

type ForvoAnkiBatchEntryResult = {
  candidates?: ForvoAnkiBatchCandidate[];
  entryId: string;
  entryKind: "grammar" | "term";
  error?: string;
  label: string;
  mediaSlug: string;
  pageUrl?: string;
  queries: string[];
  query?: string;
  reading?: string;
  selected?: ForvoAnkiBatchCandidate | null;
  status:
    | "downloaded"
    | "no_queries"
    | "no_results"
    | "query_error"
    | "startup_error";
};

type ForvoAnkiBatchResult = {
  language: string;
  processed: number;
  results: ForvoAnkiBatchEntryResult[];
  status: "done" | "error" | "running";
  total: number;
};

type ForvoFetchResult =
  | {
      entryId: string;
      kind: "grammar" | "term";
      speaker?: string;
      status: "matched";
      votes?: number;
    }
  | {
      entryId: string;
      kind: "grammar" | "term";
      status: "miss" | "skipped_known_missing";
    };

const skipControlState: {
  currentSkipHandler: null | (() => void);
  pendingSkip: boolean;
  port: number | null;
  ready: Promise<string> | null;
  server: ReturnType<typeof createServer> | null;
  sockets: Set<Socket>;
} = {
  currentSkipHandler: null,
  pendingSkip: false,
  port: null,
  ready: null,
  server: null,
  sockets: new Set()
};

export async function fetchForvoPronunciationsForBundle(input: {
  browser: ForvoBrowserOptions;
  bundle: NormalizedMediaBundle;
  dryRun?: boolean;
  limit?: number;
  refresh?: boolean;
  wordListSource?: string;
  words?: string[];
  entryIds?: string[];
}) {
  if (input.browser.openWordAddOnMiss === false) {
    throw new Error(
      "Forvo pronunciation workflow must keep word-add request prefill enabled so missing entries open the prefilled Forvo request tab and are recorded in data/forvo-requested-word-add.json."
    );
  }

  const preparedRun = await prepareForvoPronunciationRun({
    bundle: input.bundle,
    dryRun: input.dryRun,
    entryIds: input.entryIds,
    knownMissingPath: input.browser.knownMissingPath,
    limit: input.limit,
    refresh: input.refresh,
    requestRegistryPath: input.browser.requestRegistryPath,
    retryKnownMissing: input.browser.retryKnownMissing,
    wordListSource: input.wordListSource,
    words: input.words
  });
  const {
    manifestEntries,
    knownMissingRegistry,
    requestRegistry,
    knownMissingSkipped,
    requestedUnresolved,
    runnableTargets
  } = preparedRun;

  if (runnableTargets.length === 0) {
    return {
      matched: 0,
      missed: 0,
      knownMissingSkipped: knownMissingSkipped.map((entry) => ({
        entryId: entry.id,
        kind: entry.kind,
        status: "skipped_known_missing"
      })),
      requestedUnresolved,
      results: []
    };
  }

  const results: ForvoFetchResult[] = [];
  const ankiResult = await runForvoAnkiBatch({
    ankiAppPath: input.browser.ankiAppPath,
    ankiBaseDir:
      input.browser.ankiBaseDir ??
      input.browser.profileDir ??
      "data/forvo-anki-profile",
    ankiPythonPath: input.browser.ankiPythonPath,
    entryDelayMs: input.browser.entryDelayMs,
    keepAnkiOpen: input.browser.keepBrowserOpen,
    runRoot: input.browser.ankiRunRoot,
    targets: runnableTargets.map(buildForvoAnkiBatchTarget),
    timeoutMs: input.browser.browserTimeoutMs
  });
  const ankiResultByKey = new Map(
    ankiResult.results.map((result) => [
      buildEntryKey(result.entryKind, result.entryId),
      result
    ])
  );
  const newlyKnownMissing: ForvoFetchResult[] = [];

  for (const [index, entry] of runnableTargets.entries()) {
    const batchResult = ankiResultByKey.get(
      buildEntryKey(entry.kind, entry.id)
    );
    const selected = batchResult?.selected ?? null;

    if (!selected) {
      if (
        !batchResult ||
        (batchResult.status !== "no_results" &&
          batchResult.status !== "no_queries")
      ) {
        throw new Error(
          `Anki Forvo helper did not return usable candidates for ${buildEntryKey(entry.kind, entry.id)} (status=${batchResult?.status ?? "missing_result"}).`
        );
      }

      addForvoKnownMissingEntry(knownMissingRegistry, {
        entry,
        mediaSlug: input.bundle.mediaSlug
      });

      if (!input.dryRun) {
        await persistForvoKnownMissingRegistry(
          input.browser.knownMissingPath,
          knownMissingRegistry
        );
        await handleWordAddRequestAfterSkip({
          entry,
          mediaSlug: input.bundle.mediaSlug,
          openWordAddOnSkip: input.browser.openWordAddOnMiss ?? true,
          requestRegistry,
          requestRegistryPath: input.browser.requestRegistryPath
        });
      }

      const skipped = {
        entryId: entry.id,
        kind: entry.kind,
        status: "skipped_known_missing" as const
      };

      newlyKnownMissing.push(skipped);
      results.push(skipped);

      if (index < runnableTargets.length - 1) {
        await sleep(input.browser.entryDelayMs ?? 2500);
      }

      continue;
    }

    const entryKey = buildEntryKey(entry.kind, entry.id);
    const localAssetPath = buildForvoAudioAssetPath(entry, selected);
    const pageUrl =
      selected.pageUrl ??
      batchResult?.pageUrl ??
      buildForvoWordUrls(entry)[0] ??
      "https://forvo.com/";

    if (!input.dryRun) {
      const absoluteAssetPath = path.join(entry.mediaDirectory, localAssetPath);

      await downloadAndStoreForvoAudio({
        candidates: selected.audioCandidates,
        pageUrl,
        targetPath: absoluteAssetPath
      });
    }

    manifestEntries.set(
      entryKey,
      mergePronunciationAudioManifestEntry({
        audio: {
          audioAttribution: buildForvoAttribution(selected),
          audioLicense: undefined,
          audioPageUrl: pageUrl,
          audioSource: "forvo",
          audioSpeaker: selected.speaker,
          audioSrc: localAssetPath
        },
        entryId: entry.id,
        entryType: entry.kind,
        existing: manifestEntries.get(entryKey)
      })
    );

    if (!input.dryRun) {
      await persistManifestEntries(
        input.bundle.mediaDirectory,
        manifestEntries
      );

      const knownMissingChanged = removeForvoKnownMissingEntry({
        entry,
        knownMissingRegistry,
        mediaSlug: input.bundle.mediaSlug
      });
      const requestRegistryChanged = markForvoWordAddRequestResolved({
        audioSrc: localAssetPath,
        entry,
        mediaSlug: input.bundle.mediaSlug,
        requestRegistry
      });

      if (knownMissingChanged) {
        await persistForvoKnownMissingRegistry(
          input.browser.knownMissingPath,
          knownMissingRegistry
        );
      }

      if (requestRegistryChanged) {
        await persistForvoWordAddRequestRegistry(
          input.browser.requestRegistryPath,
          requestRegistry
        );
      }
    }

    results.push({
      entryId: entry.id,
      kind: entry.kind,
      speaker: selected.speaker,
      status: "matched",
      votes: selected.votes
    });

    if (index < runnableTargets.length - 1) {
      await sleep(input.browser.entryDelayMs ?? 2500);
    }
  }

  return {
    matched: results.filter((result) => result.status === "matched").length,
    missed: results.filter(
      (result) =>
        result.status === "miss" || result.status === "skipped_known_missing"
    ).length,
    knownMissingSkipped: [
      ...knownMissingSkipped.map((entry) => ({
        entryId: entry.id,
        kind: entry.kind,
        status: "skipped_known_missing"
      })),
      ...newlyKnownMissing
    ],
    requestedUnresolved,
    results
  };
}

export async function fetchForvoPronunciationsForBundleManual(input: {
  bundle: NormalizedMediaBundle;
  dryRun?: boolean;
  entryIds?: string[];
  limit?: number;
  manual: ForvoManualOptions;
  refresh?: boolean;
  wordListSource?: string;
  words?: string[];
}) {
  assertForvoManualRunCanStart({
    openWordAddOnSkip: input.manual.openWordAddOnSkip ?? true
  });

  const preparedRun = await prepareForvoPronunciationRun({
    bundle: input.bundle,
    dryRun: input.dryRun,
    entryIds: input.entryIds,
    knownMissingPath: input.manual.knownMissingPath,
    limit: input.limit,
    refresh: input.refresh,
    requestRegistryPath: input.manual.requestRegistryPath,
    retryKnownMissing: input.manual.retryKnownMissing,
    wordListSource: input.wordListSource,
    words: input.words
  });
  const {
    manifestEntries,
    knownMissingRegistry,
    requestRegistry,
    knownMissingSkipped,
    requestedUnresolved,
    runnableTargets
  } = preparedRun;

  if (runnableTargets.length === 0) {
    return {
      matched: 0,
      missed: 0,
      knownMissingSkipped: knownMissingSkipped.map((entry) => ({
        entryId: entry.id,
        kind: entry.kind,
        status: "skipped_known_missing"
      })),
      requestedUnresolved,
      results: []
    };
  }

  const results = [];

  try {
    for (const [index, entry] of runnableTargets.entries()) {
      const resolved = await captureManualForvoPronunciation({
        controlPort: input.manual.controlPort,
        downloadsDir: input.manual.downloadsDir,
        dryRun: input.dryRun,
        entry,
        knownMissingPath: input.manual.knownMissingPath,
        mediaSlug: input.bundle.mediaSlug,
        openUrl: input.manual.openUrls ?? true
      });

      if (!resolved) {
        results.push({
          entryId: entry.id,
          kind: entry.kind,
          status: "miss"
        });
        continue;
      }

      if (resolved.status === "skipped_known_missing") {
        addForvoKnownMissingEntry(knownMissingRegistry, {
          entry,
          mediaSlug: input.bundle.mediaSlug
        });

        if (!input.dryRun) {
          await persistForvoKnownMissingRegistry(
            input.manual.knownMissingPath,
            knownMissingRegistry
          );

          await handleWordAddRequestAfterSkip({
            entry,
            mediaSlug: input.bundle.mediaSlug,
            openWordAddOnSkip: input.manual.openWordAddOnSkip ?? true,
            requestRegistry,
            requestRegistryPath: input.manual.requestRegistryPath
          });
        }

        results.push({
          entryId: entry.id,
          kind: entry.kind,
          status: "skipped_known_missing"
        });
        continue;
      }

      const entryKey = buildEntryKey(entry.kind, entry.id);
      manifestEntries.set(
        entryKey,
        mergePronunciationAudioManifestEntry({
          audio: {
            audioAttribution: resolved.audioAttribution,
            audioLicense: resolved.audioLicense,
            audioPageUrl: resolved.audioPageUrl,
            audioSource: "forvo",
            audioSpeaker: resolved.audioSpeaker,
            audioSrc: resolved.audioSrc
          },
          entryId: entry.id,
          entryType: entry.kind,
          existing: manifestEntries.get(entryKey)
        })
      );

      if (!input.dryRun) {
        await persistManifestEntries(
          input.bundle.mediaDirectory,
          manifestEntries
        );
      }

      results.push({
        entryId: entry.id,
        kind: entry.kind,
        speaker: resolved.audioSpeaker,
        status: "matched"
      });

      if (index < runnableTargets.length - 1) {
        await sleep(input.manual.entryDelayMs ?? 2500);
      }
    }

    return {
      matched: results.filter((result) => result.status === "matched").length,
      missed: results.filter((result) => result.status === "miss").length,
      knownMissingSkipped: [
        ...knownMissingSkipped.map((entry) => ({
          entryId: entry.id,
          kind: entry.kind,
          status: "skipped_known_missing"
        })),
        ...results.filter((result) => result.status === "skipped_known_missing")
      ],
      requestedUnresolved,
      results
    };
  } finally {
    await closeSkipControlServer();
  }
}

async function prepareForvoPronunciationRun(input: {
  bundle: NormalizedMediaBundle;
  dryRun?: boolean;
  entryIds?: string[];
  knownMissingPath?: string;
  limit?: number;
  refresh?: boolean;
  requestRegistryPath?: string;
  retryKnownMissing?: boolean;
  wordListSource?: string;
  words?: string[];
}) {
  const { entries: manifestEntries } = await loadValidatedManifest(
    input.bundle.mediaDirectory,
    input.bundle.mediaSlug
  );
  const allTargets = collectPronunciationTargets(input.bundle);
  const isStillMissing = (entry: PronunciationTargetEntry) =>
    input.refresh ||
    !(
      entry.audioSrc ||
      manifestEntries.get(buildEntryKey(entry.kind, entry.id))?.audioSrc
    );
  const filteredTargets = allTargets.filter(isStillMissing);
  const hasExplicitRequests =
    (input.entryIds?.length ?? 0) > 0 ||
    (input.words?.length ?? 0) > 0 ||
    typeof input.wordListSource === "string";
  const requestedTargets = resolveRequestedTargets({
    bundle: input.bundle,
    entryIds: input.entryIds,
    refresh: input.refresh,
    wordListSource: input.wordListSource,
    words: input.words
  });
  const selectedTargets = (
    hasExplicitRequests ? requestedTargets.targets : filteredTargets
  ).filter(isStillMissing);
  const limitedTargets =
    typeof input.limit === "number" && input.limit >= 0
      ? selectedTargets.slice(0, input.limit)
      : selectedTargets;
  const knownMissingRegistry = await loadForvoKnownMissingRegistry(
    input.knownMissingPath
  );
  const requestRegistry = await loadForvoWordAddRequestRegistry(
    input.requestRegistryPath
  );
  const resolvedRequestCount = reconcileForvoWordAddRequestRegistry(
    requestRegistry,
    allTargets.map((entry) => {
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
  const knownMissingPruned = pruneForvoKnownMissingRegistry(
    knownMissingRegistry,
    allTargets,
    input.bundle.mediaSlug
  );
  if (knownMissingPruned && !input.dryRun) {
    await persistForvoKnownMissingRegistry(
      input.knownMissingPath,
      knownMissingRegistry
    );
  }
  if (resolvedRequestCount > 0 && !input.dryRun) {
    await persistForvoWordAddRequestRegistry(
      input.requestRegistryPath,
      requestRegistry
    );
  }
  const knownMissingSkipped = input.retryKnownMissing
    ? []
    : limitedTargets.filter((entry) =>
        hasForvoKnownMissingEntry(
          knownMissingRegistry,
          entry,
          input.bundle.mediaSlug
        )
      );
  const runnableTargets =
    knownMissingSkipped.length > 0
      ? limitedTargets.filter(
          (entry) =>
            !hasForvoKnownMissingEntry(
              knownMissingRegistry,
              entry,
              input.bundle.mediaSlug
            )
        )
      : limitedTargets;

  return {
    knownMissingRegistry,
    requestRegistry,
    knownMissingSkipped,
    manifestEntries,
    requestedUnresolved: requestedTargets.unresolved,
    runnableTargets
  };
}

export function assertForvoManualRunCanStart(
  input: ForvoManualRuntimeOptions = {}
) {
  const issues: string[] = [];

  if (input.openWordAddOnSkip === false) {
    issues.push(
      "Forvo pronunciation workflow must keep word-add request prefill enabled so missing entries open the prefilled Forvo request tab and are recorded in data/forvo-requested-word-add.json. Remove --no-open-word-add-on-skip."
    );
  }

  if (input.requireInteractiveTTY ?? true) {
    const stdinIsTTY = input.stdinIsTTY ?? process.stdin.isTTY === true;
    const stdoutIsTTY = input.stdoutIsTTY ?? process.stdout.isTTY === true;

    if (!stdinIsTTY || !stdoutIsTTY) {
      issues.push(
        "Manual Forvo mode requires an interactive TTY so the /skip control server can be exposed. In Codex, run exec_command with tty:true or use .agents/skills/forvo-pronunciations/scripts/run_forvo_fetch.sh from an interactive terminal."
      );
    }
  }

  if (issues.length > 0) {
    throw new Error(issues.join("\n"));
  }
}

function buildForvoAnkiBatchTarget(
  entry: PronunciationTargetEntry
): ForvoAnkiBatchTarget {
  return {
    entryId: entry.id,
    entryKind: entry.kind,
    label: entry.label,
    mediaSlug: entry.mediaSlug,
    queries: buildForvoSearchQueries(entry),
    reading: entry.reading
  };
}

async function runForvoAnkiBatch(input: {
  ankiAppPath?: string;
  ankiBaseDir: string;
  ankiPythonPath?: string;
  entryDelayMs?: number;
  keepAnkiOpen?: boolean;
  runRoot?: string;
  targets: ForvoAnkiBatchTarget[];
  timeoutMs?: number;
}): Promise<ForvoAnkiBatchResult> {
  const ankiBaseDir = path.resolve(input.ankiBaseDir);
  const runRoot = path.resolve(
    input.runRoot ?? path.join("data", "forvo-anki-runs")
  );
  const ankiPythonPath = await resolveAnkiPythonPath(input.ankiPythonPath);
  const ankiCommandPath = await resolveAnkiCommandPath(input.ankiAppPath);

  await mkdir(runRoot, { recursive: true });
  await ensureForvoAnkiProfileReady({
    ankiBaseDir,
    ankiPythonPath: ankiPythonPath ?? undefined
  });
  await installForvoAnkiHelperAddon(ankiBaseDir);

  const runDir = await mkdtemp(path.join(runRoot, "run-"));
  const targetsPath = path.join(runDir, "targets.json");
  const resultPath = path.join(runDir, "result.json");

  await writeFile(
    targetsPath,
    JSON.stringify({ targets: input.targets }, null, 2),
    "utf8"
  );
  const runConfigPath = await writeForvoAnkiHelperRunConfig({
    ankiBaseDir,
    entryDelayMs: input.entryDelayMs,
    keepAnkiOpen: input.keepAnkiOpen,
    renderTimeoutMs: input.timeoutMs,
    resultPath,
    targetsPath
  });

  const child = spawn(ankiCommandPath, buildForvoAnkiLaunchArgs(ankiBaseDir), {
    env: buildForvoAnkiBatchEnvironment({
      ankiBaseDir,
      entryDelayMs: input.entryDelayMs,
      keepAnkiOpen: input.keepAnkiOpen,
      runConfigPath,
      resultPath,
      targetsPath
    }),
    stdio: ["ignore", "ignore", "pipe"]
  });
  let stderr = "";

  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
  });

  return waitForForvoAnkiResult({
    child,
    resultPath,
    stderr: () => stderr,
    timeoutMs: input.timeoutMs ?? 120000
  });
}

function buildForvoAnkiLaunchArgs(ankiBaseDir: string) {
  return ["-b", ankiBaseDir, "-p", "User 1"];
}

async function resolveAnkiCommandPath(explicitPath?: string) {
  const candidates = [
    explicitPath,
    process.env.ANKI_APP,
    path.join(
      homedir(),
      "Library",
      "Application Support",
      "AnkiProgramFiles",
      ".venv",
      "bin",
      "anki"
    ),
    "/Applications/Anki.app/Contents/MacOS/launcher"
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "Anki executable not found. Install Anki or pass --anki-app with the launcher/script path."
  );
}

function buildForvoAnkiBatchEnvironment(input: {
  ankiBaseDir: string;
  entryDelayMs?: number;
  keepAnkiOpen?: boolean;
  runConfigPath: string;
  resultPath: string;
  targetsPath: string;
}) {
  return {
    env: {
      ...process.env,
      ANKI_BASE: input.ankiBaseDir,
      JCS_FORVO_ENTRY_DELAY_MS: String(input.entryDelayMs ?? 2500),
      JCS_FORVO_KEEP_OPEN: input.keepAnkiOpen ? "1" : "0",
      JCS_FORVO_LANGUAGE: "ja",
      JCS_FORVO_RESULT_PATH: input.resultPath,
      JCS_FORVO_RUN_CONFIG_PATH: input.runConfigPath,
      JCS_FORVO_TARGETS_PATH: input.targetsPath
    }
  }.env;
}

async function installForvoAnkiHelperAddon(ankiBaseDir: string) {
  const addonDir = path.join(ankiBaseDir, "addons21", "jcs_forvo_batch");

  await mkdir(addonDir, { recursive: true });
  await rm(path.join(addonDir, "__pycache__"), {
    force: true,
    recursive: true
  });
  await writeFile(
    path.join(addonDir, "__init__.py"),
    forvoAnkiHelperAddonSource,
    "utf8"
  );
}

async function writeForvoAnkiHelperRunConfig(input: {
  ankiBaseDir: string;
  entryDelayMs?: number;
  keepAnkiOpen?: boolean;
  renderTimeoutMs?: number;
  resultPath: string;
  targetsPath: string;
}) {
  const addonDir = path.join(input.ankiBaseDir, "addons21", "jcs_forvo_batch");
  const configPath = path.join(addonDir, "run-config.json");

  await writeFile(
    configPath,
    JSON.stringify(
      {
        entryDelayMs: input.entryDelayMs ?? 2500,
        keepOpen: Boolean(input.keepAnkiOpen),
        language: "ja",
        renderTimeoutMs: input.renderTimeoutMs ?? 120000,
        resultPath: input.resultPath,
        targetsPath: input.targetsPath
      },
      null,
      2
    ),
    "utf8"
  );

  return configPath;
}

async function ensureForvoAnkiProfileReady(input: {
  ankiBaseDir: string;
  ankiPythonPath?: string;
}) {
  const prefsPath = path.join(input.ankiBaseDir, "prefs21.db");
  const collectionPath = path.join(
    input.ankiBaseDir,
    "User 1",
    "collection.anki2"
  );

  if ((await pathExists(prefsPath)) && (await pathExists(collectionPath))) {
    return;
  }

  const ankiPythonPath = await resolveAnkiPythonPath(input.ankiPythonPath);

  if (!ankiPythonPath) {
    throw new Error(
      `Anki profile '${input.ankiBaseDir}' is not initialized and the Anki Python runtime was not found. Open Anki once with this base directory or pass --anki-python.`
    );
  }

  await mkdir(input.ankiBaseDir, { recursive: true });
  await runAnkiProfileBootstrap({
    ankiBaseDir: input.ankiBaseDir,
    ankiPythonPath
  });
}

async function resolveAnkiPythonPath(explicitPath?: string) {
  const candidates = [
    explicitPath,
    process.env.ANKI_PYTHON,
    path.join(
      homedir(),
      "Library",
      "Application Support",
      "AnkiProgramFiles",
      ".venv",
      "bin",
      "python"
    )
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

function runAnkiProfileBootstrap(input: {
  ankiBaseDir: string;
  ankiPythonPath: string;
}) {
  const source = String.raw`
import os
import pathlib
import pickle
import sqlite3
import sys

from anki.collection import Collection
from aqt.profiles import metaConf, profileConf

base = pathlib.Path(sys.argv[1])
profile_dir = base / "User 1"
collection_path = profile_dir / "collection.anki2"
prefs_path = base / "prefs21.db"

base.mkdir(parents=True, exist_ok=True)
profile_dir.mkdir(parents=True, exist_ok=True)
(profile_dir / "collection.media").mkdir(parents=True, exist_ok=True)

meta = dict(metaConf)
meta["firstRun"] = False
meta["defaultLang"] = meta.get("defaultLang") or "en"
profile = dict(profileConf)

connection = sqlite3.connect(prefs_path)
try:
    connection.execute(
        "create table if not exists profiles (name text primary key collate nocase, data blob not null)"
    )
    connection.execute(
        "insert or replace into profiles values (?, ?)",
        ("_global", pickle.dumps(meta, protocol=4)),
    )
    connection.execute(
        "insert or ignore into profiles values (?, ?)",
        ("User 1", pickle.dumps(profile, protocol=4)),
    )
    connection.commit()
finally:
    connection.close()

if not collection_path.exists():
    collection = Collection(str(collection_path))
    collection.close(downgrade=True)
`;

  return new Promise<void>((resolve, reject) => {
    const child = spawn(
      input.ankiPythonPath,
      ["-c", source, input.ankiBaseDir],
      {
        stdio: ["ignore", "ignore", "pipe"]
      }
    );
    let stderr = "";

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          stderr.trim() || `Anki profile bootstrap exited with code ${code}`
        )
      );
    });
  });
}

async function pathExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function waitForForvoAnkiResult(input: {
  child: ReturnType<typeof spawn>;
  resultPath: string;
  stderr: () => string;
  timeoutMs: number;
}) {
  const startedAt = Date.now();
  const childExit: {
    value: { code: number | null; signal: NodeJS.Signals | null } | null;
  } = {
    value: null
  };

  input.child.on("exit", (code, signal) => {
    childExit.value = { code, signal };
  });

  while (Date.now() - startedAt < input.timeoutMs) {
    const result = await readForvoAnkiResult(input.resultPath);

    if (result?.status === "done") {
      return result;
    }

    if (result?.status === "error") {
      throw new Error(
        `Anki Forvo helper failed: ${JSON.stringify(result.results.at(-1) ?? result)}`
      );
    }

    if (childExit.value && childExit.value.code !== 0) {
      throw new Error(
        `Anki exited before producing a completed Forvo result (code=${childExit.value.code ?? "null"} signal=${childExit.value.signal ?? "null"} status=${result?.status ?? "missing_result"}). ${input.stderr()}`
      );
    }

    await sleep(500);
  }

  input.child.kill();
  throw new Error(
    `Timed out waiting for Anki Forvo helper after ${input.timeoutMs} ms. ${input.stderr()}`
  );
}

async function readForvoAnkiResult(resultPath: string) {
  try {
    const parsed = JSON.parse(await readFile(resultPath, "utf8")) as unknown;

    return normalizeForvoAnkiBatchResult(parsed);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }

    return null;
  }
}

function normalizeForvoAnkiBatchResult(
  value: unknown
): ForvoAnkiBatchResult | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<ForvoAnkiBatchResult>;
  const rawResults = Array.isArray(candidate.results) ? candidate.results : [];
  const results = rawResults
    .filter(isForvoAnkiBatchEntryResult)
    .map((result) => {
      const candidates = (result.candidates ?? []).filter(
        isForvoAnkiBatchCandidate
      );

      return {
        ...result,
        candidates,
        selected:
          candidates.length > 0
            ? (selectBestForvoCandidate(candidates) as ForvoAnkiBatchCandidate)
            : null
      };
    });

  if (
    candidate.status !== "done" &&
    candidate.status !== "error" &&
    candidate.status !== "running"
  ) {
    return null;
  }

  return {
    language:
      typeof candidate.language === "string" ? candidate.language : "ja",
    processed:
      typeof candidate.processed === "number"
        ? candidate.processed
        : results.length,
    results,
    status: candidate.status,
    total:
      typeof candidate.total === "number" ? candidate.total : results.length
  };
}

function isForvoAnkiBatchEntryResult(
  value: unknown
): value is ForvoAnkiBatchEntryResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ForvoAnkiBatchEntryResult>;

  return (
    (candidate.entryKind === "grammar" || candidate.entryKind === "term") &&
    typeof candidate.entryId === "string" &&
    typeof candidate.label === "string" &&
    typeof candidate.mediaSlug === "string" &&
    Array.isArray(candidate.queries) &&
    typeof candidate.status === "string"
  );
}

function isForvoAnkiBatchCandidate(
  value: unknown
): value is ForvoAnkiBatchCandidate {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ForvoAnkiBatchCandidate>;

  return (
    Array.isArray(candidate.audioCandidates) &&
    candidate.audioCandidates.length > 0 &&
    candidate.audioCandidates.every(isForvoAudioCandidate) &&
    typeof candidate.candidateIndex === "number" &&
    typeof candidate.pageUrl === "string" &&
    typeof candidate.sectionIndex === "number" &&
    typeof candidate.text === "string"
  );
}

function isForvoAudioCandidate(value: unknown): value is ForvoAudioCandidate {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ForvoAudioCandidate>;

  return (
    (candidate.format === "mp3" || candidate.format === "ogg") &&
    candidate.source === "anki-play" &&
    typeof candidate.url === "string"
  );
}

async function downloadAndStoreForvoAudio(input: {
  candidates: ForvoAudioCandidate[];
  pageUrl?: string;
  targetPath: string;
}) {
  const errors: string[] = [];

  await mkdir(path.dirname(input.targetPath), { recursive: true });

  for (const candidate of input.candidates) {
    try {
      const buffer = await downloadForvoAudio(candidate.url, input.pageUrl);

      if (candidate.format === "mp3") {
        await writeFile(input.targetPath, buffer);
        return;
      }

      await convertForvoAudioBufferToMp3({
        buffer,
        format: candidate.format,
        targetPath: input.targetPath
      });
      return;
    } catch (error) {
      errors.push(
        `${candidate.url}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  throw new Error(
    `No downloadable Forvo audio candidate worked for '${input.targetPath}'. ${errors.join("; ")}`
  );
}

async function downloadForvoAudio(url: string, pageUrl?: string) {
  const response = await fetch(url, {
    headers: {
      Referer: pageUrl ?? "https://forvo.com/",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Safari/537.36"
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function convertForvoAudioBufferToMp3(input: {
  buffer: Buffer;
  format: string;
  targetPath: string;
}) {
  const tempDir = await mkdtemp(path.join(tmpdir(), "forvo-audio-"));
  const sourcePath = path.join(tempDir, `source.${input.format}`);

  try {
    await writeFile(sourcePath, input.buffer);
    await runFfmpeg([
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      sourcePath,
      "-codec:a",
      "libmp3lame",
      "-q:a",
      "2",
      input.targetPath
    ]);
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args, {
      stdio: ["ignore", "ignore", "pipe"]
    });
    let stderr = "";

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
    });
  });
}

async function captureManualForvoPronunciation(input: {
  controlPort?: number;
  downloadsDir: string;
  dryRun?: boolean;
  entry: PronunciationTargetEntry;
  knownMissingPath?: string;
  mediaSlug: string;
  openUrl: boolean;
}): Promise<ManualForvoCaptureResult | null> {
  const forvoUrl = buildForvoWordUrls(input.entry)[0];
  const startedAt = Date.now();

  if (!forvoUrl) {
    return null;
  }

  console.info("");
  console.info(
    `Manual Forvo step for ${buildEntryKey(input.entry.kind, input.entry.id)}`
  );
  console.info(`  word: ${input.entry.label}`);
  if (input.entry.reading) {
    console.info(`  reading: ${input.entry.reading}`);
  }
  console.info(`  url: ${forvoUrl}`);

  if (input.openUrl) {
    await openUrlInDefaultBrowser(forvoUrl);
  }

  console.info(
    `  waiting for a new audio file in ${input.downloadsDir} to continue automatically`
  );
  console.info(
    "  type 's' then Enter to mark this entry missing on Forvo and skip it"
  );

  const outcome = await waitForManualDownloadOrSkip({
    afterMs: startedAt,
    controlPort: input.controlPort,
    downloadsDir: input.downloadsDir
  });

  if (outcome?.status === "skipped_known_missing") {
    return outcome;
  }

  const downloadedFile = outcome?.downloadedFile;

  if (!downloadedFile) {
    throw new Error(
      `No new audio download detected in ${input.downloadsDir} for '${input.entry.label}'.`
    );
  }

  if (!doesManualDownloadMatchEntry(downloadedFile, input.entry)) {
    throw new Error(
      `Detected '${path.basename(downloadedFile)}' while waiting for '${input.entry.label}', but the filename does not match the expected entry. The file was left in Downloads on purpose so it can be retried or inspected.`
    );
  }

  const extension = path.extname(downloadedFile).toLowerCase() || ".mp3";
  const shouldConvertToMp3 = extension === ".ogg" || extension === ".oga";
  const safeLabel = slugifyForvoSegment(
    input.entry.reading ?? input.entry.label
  );
  const localAssetPath = `assets/audio/${input.entry.kind}/${input.entry.id}/forvo-manual-${safeLabel}${shouldConvertToMp3 ? ".mp3" : extension}`;

  if (!input.dryRun) {
    const absoluteAssetPath = path.join(
      input.entry.mediaDirectory,
      localAssetPath.replace(/^assets\//u, "assets/")
    );

    await mkdir(path.dirname(absoluteAssetPath), { recursive: true });

    if (shouldConvertToMp3) {
      await convertForvoAudioBufferToMp3({
        buffer: await readFile(downloadedFile),
        format: extension.slice(1),
        targetPath: absoluteAssetPath
      });
    } else {
      await copyFile(downloadedFile, absoluteAssetPath);
    }
  }

  return {
    status: "downloaded",
    audioAttribution: "Downloaded manually from Forvo",
    audioLicense: undefined,
    audioPageUrl: forvoUrl,
    audioSpeaker: undefined,
    audioSrc: localAssetPath
  };
}

async function handleWordAddRequestAfterSkip(input: {
  entry: PronunciationTargetEntry;
  mediaSlug: string;
  openWordAddOnSkip: boolean;
  requestRegistry: ForvoWordAddRequestRegistry;
  requestRegistryPath?: string;
}) {
  const requestUrl = buildForvoWordAddUrl({
    entryId: input.entry.id,
    entryKind: input.entry.kind,
    label: input.entry.label,
    reading: input.entry.reading
  });

  if (!requestUrl) {
    console.info(
      `  skipped word-add request for ${input.mediaSlug}:${input.entry.kind}:${input.entry.id} because no Japanese Forvo query could be derived`
    );
    return;
  }

  const requestAdded = addForvoWordAddRequestEntry(input.requestRegistry, {
    entryId: input.entry.id,
    entryKind: input.entry.kind,
    label: input.entry.label,
    mediaSlug: input.mediaSlug,
    reading: input.entry.reading
  });

  if (requestAdded) {
    await persistForvoWordAddRequestRegistry(
      input.requestRegistryPath,
      input.requestRegistry
    );
  }

  if (input.openWordAddOnSkip) {
    await openUrlInDefaultBrowser(requestUrl);
    console.info(`  opened word-add request URL -> ${requestUrl}`);
    return;
  }

  if (requestAdded) {
    console.info(`  request URL recorded -> ${requestUrl}`);
  }
}

function removeForvoKnownMissingEntry(input: {
  entry: PronunciationTargetEntry;
  knownMissingRegistry: Awaited<
    ReturnType<typeof loadForvoKnownMissingRegistry>
  >;
  mediaSlug: string;
}) {
  const initialLength = input.knownMissingRegistry.entries.length;

  input.knownMissingRegistry.entries =
    input.knownMissingRegistry.entries.filter(
      (candidate) =>
        !(
          candidate.mediaSlug === input.mediaSlug &&
          candidate.entryKind === input.entry.kind &&
          candidate.entryId === input.entry.id
        )
    );

  return input.knownMissingRegistry.entries.length !== initialLength;
}

function markForvoWordAddRequestResolved(input: {
  audioSrc: string;
  entry: PronunciationTargetEntry;
  mediaSlug: string;
  requestRegistry: ForvoWordAddRequestRegistry;
}) {
  const match = input.requestRegistry.entries.find(
    (candidate) =>
      candidate.mediaSlug === input.mediaSlug &&
      candidate.entryKind === input.entry.kind &&
      candidate.entryId === input.entry.id
  );

  if (!match) {
    return false;
  }

  match.resolvedAt = match.resolvedAt ?? new Date().toISOString();
  match.resolvedAudioSource = "forvo";
  match.resolvedAudioSrc = input.audioSrc;

  return true;
}

async function waitForManualDownloadOrSkip(input: {
  afterMs: number;
  controlPort?: number;
  downloadsDir: string;
}) {
  const timeoutAt = Date.now() + 5 * 60 * 1000;

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    assertForvoManualRunCanStart();
  }

  return await new Promise<
    | { downloadedFile: string; status: "downloaded" }
    | { status: "skipped_known_missing" }
    | null
  >((resolve) => {
    const readline = createInterface({
      input: process.stdin,
      output: process.stdout
    });
    let resolved = false;

    const finish = (
      value:
        | { downloadedFile: string; status: "downloaded" }
        | { status: "skipped_known_missing" }
        | null
    ) => {
      if (resolved) {
        return;
      }

      resolved = true;
      clearInterval(interval);
      releaseSkipWaiter(skipHandler);
      closeInteractiveReadline(readline);
      resolve(value);
    };

    const skipHandler = () => finish({ status: "skipped_known_missing" });
    const skipReady = ensureSkipControlServer(input.controlPort ?? 3210);

    armSkipWaiter(skipHandler);

    if (skipControlState.pendingSkip) {
      skipControlState.pendingSkip = false;
      queueMicrotask(skipHandler);
    }

    skipReady
      .then((url) => {
        console.info(`  browser skip URL: ${url}`);
      })
      .catch((error) => {
        console.warn(`Skip control URL unavailable: ${String(error)}`);
      });

    readline.on("line", (line) => {
      const normalized = line.trim().toLowerCase();

      if (normalized === "s") {
        finish({ status: "skipped_known_missing" });
      }
    });

    const interval = setInterval(async () => {
      if (resolved) {
        return;
      }

      if (Date.now() >= timeoutAt) {
        finish(null);
        return;
      }

      try {
        const candidate = await findNewestCompletedAudioFile({
          afterMs: input.afterMs,
          downloadsDir: input.downloadsDir
        });

        if (!candidate) {
          return;
        }

        const stable = await waitForFileToStabilize(candidate);

        if (stable) {
          finish({
            downloadedFile: candidate,
            status: "downloaded"
          });
        }
      } catch {
        finish(null);
      }
    }, 1000);
  });
}

function closeInteractiveReadline(
  readline: ReturnType<typeof createInterface>
) {
  readline.close();

  if (process.stdin.isTTY) {
    process.stdin.pause();
  }
}

async function findNewestCompletedAudioFile(input: {
  afterMs: number;
  downloadsDir: string;
}) {
  const entries = await readdir(input.downloadsDir, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const absolutePath = path.join(input.downloadsDir, entry.name);
        const metadata = await stat(absolutePath);

        return {
          absolutePath,
          mtimeMs: metadata.mtimeMs,
          size: metadata.size
        };
      })
  );

  return files
    .filter((file) => {
      const extension = path.extname(file.absolutePath).toLowerCase();

      return (
        file.mtimeMs >= input.afterMs &&
        file.size > 0 &&
        isCompletedDownload(file.absolutePath) &&
        [".mp3", ".ogg", ".oga", ".wav", ".m4a"].includes(extension)
      );
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs)[0]?.absolutePath;
}

function isCompletedDownload(filePath: string) {
  return !/\.crdownload$|\.download$|\.part$/iu.test(filePath);
}

function ensureSkipControlServer(port: number) {
  if (
    skipControlState.server &&
    skipControlState.ready &&
    skipControlState.port === port
  ) {
    return skipControlState.ready;
  }

  const server = createServer((request, response) => {
    if (request.url?.startsWith("/skip")) {
      const mode = triggerSkipResolution();
      response.writeHead(200, {
        Connection: "close",
        "Content-Type": "text/html; charset=utf-8"
      });
      response.end(
        mode === "active"
          ? "<!doctype html><title>Skipped</title><body>Current entry marked as missing on Forvo. You can close this tab.<script>window.close()</script></body>"
          : "<!doctype html><title>Skip Armed</title><body>Skip armed for the next active entry. You can close this tab.<script>window.close()</script></body>"
      );
      return;
    }

    response.writeHead(200, {
      Connection: "close",
      "Content-Type": "text/plain; charset=utf-8"
    });
    response.end(
      "Forvo batch control is running.\nUse /skip to mark the current entry as missing.\n"
    );
  });

  server.on("connection", (socket) => {
    skipControlState.sockets.add(socket);
    socket.on("close", () => {
      skipControlState.sockets.delete(socket);
    });
  });

  const ready = new Promise<string>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(`http://127.0.0.1:${port}/skip`);
    });
  });

  skipControlState.port = port;
  skipControlState.ready = ready;
  skipControlState.server = server;

  return ready;
}

async function closeSkipControlServer() {
  const server = skipControlState.server;
  const sockets = [...skipControlState.sockets];

  skipControlState.currentSkipHandler = null;
  skipControlState.pendingSkip = false;
  skipControlState.port = null;
  skipControlState.ready = null;
  skipControlState.server = null;
  skipControlState.sockets = new Set();

  if (!server) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    for (const socket of sockets) {
      socket.destroy();
    }

    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function armSkipWaiter(onSkip: () => void) {
  skipControlState.currentSkipHandler = onSkip;
}

function releaseSkipWaiter(onSkip: () => void) {
  if (skipControlState.currentSkipHandler === onSkip) {
    skipControlState.currentSkipHandler = null;
  }
}

function triggerSkipResolution(): SkipResolutionMode {
  if (skipControlState.currentSkipHandler) {
    const handler = skipControlState.currentSkipHandler;
    skipControlState.currentSkipHandler = null;
    handler();
    return "active";
  }

  skipControlState.pendingSkip = true;
  return "pending";
}

async function waitForFileToStabilize(filePath: string) {
  let previousSize = -1;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const metadata = await stat(filePath);

    if (metadata.size > 0 && metadata.size === previousSize) {
      return true;
    }

    previousSize = metadata.size;
    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  return false;
}

async function openUrlInDefaultBrowser(url: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("open", [url], {
      stdio: "ignore"
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(`Failed to open browser URL ${url} (exit ${code ?? -1}).`)
      );
    });
  });
}

const forvoAnkiHelperAddonSource = String.raw`
import aqt
import base64
import json
import os
import re
import time
import traceback
import urllib.parse
import urllib.request
from pathlib import Path
from urllib.error import HTTPError

from aqt import gui_hooks
from aqt.qt import QDialog, QTimer, QUrl, QVBoxLayout, QWebEngineView
from bs4 import BeautifulSoup


ADDON_DIR = Path(__file__).parent
DEBUG_LOG_PATH = ADDON_DIR / "startup.log"


def log_debug(message):
    try:
        with open(DEBUG_LOG_PATH, "a", encoding="utf8") as handle:
            handle.write(f"{time.time():.3f} {message}\n")
    except Exception:
        pass


log_debug("imported jcs_forvo_batch")


def read_run_config():
    config_path = os.environ.get("JCS_FORVO_RUN_CONFIG_PATH") or str(
        ADDON_DIR / "run-config.json"
    )

    try:
        with open(config_path, encoding="utf8") as handle:
            payload = json.load(handle)

        if isinstance(payload, dict):
            return payload
    except Exception:
        return {}

    return {}


def config_bool(value):
    if isinstance(value, bool):
        return value

    return str(value or "").lower() in ("1", "true", "yes")


RUN_CONFIG = read_run_config()
TARGETS_PATH = os.environ.get("JCS_FORVO_TARGETS_PATH") or RUN_CONFIG.get("targetsPath")
RESULT_PATH = os.environ.get("JCS_FORVO_RESULT_PATH") or RUN_CONFIG.get("resultPath")
TARGET_LANGUAGE = (
    os.environ.get("JCS_FORVO_LANGUAGE") or RUN_CONFIG.get("language") or "ja"
)
ENTRY_DELAY_MS = int(
    os.environ.get("JCS_FORVO_ENTRY_DELAY_MS")
    or RUN_CONFIG.get("entryDelayMs")
    or "2500"
)
FORVO_RENDER_TIMEOUT_MS = int(
    os.environ.get("JCS_FORVO_RENDER_TIMEOUT_MS")
    or RUN_CONFIG.get("renderTimeoutMs")
    or "45000"
)
FORVO_RENDER_MIN_WAIT_MS = int(
    os.environ.get("JCS_FORVO_RENDER_MIN_WAIT_MS")
    or RUN_CONFIG.get("renderMinWaitMs")
    or "2500"
)
FORVO_RENDER_POLL_MS = 750
KEEP_OPEN = config_bool(
    os.environ.get("JCS_FORVO_KEEP_OPEN") or RUN_CONFIG.get("keepOpen")
)
PREFERRED_USERS = ["strawberrybrown", "mezashi"]

state = {
    "index": 0,
    "results": [],
    "started": False,
    "targets": [],
    "views": [],
}


def normalize_text(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def write_result(status="running"):
    if not RESULT_PATH:
        return

    payload = {
        "language": TARGET_LANGUAGE,
        "processed": len(state["results"]),
        "results": state["results"],
        "status": status,
        "total": len(state["targets"]),
    }
    Path(os.path.dirname(RESULT_PATH)).mkdir(parents=True, exist_ok=True)
    with open(RESULT_PATH, "w", encoding="utf8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)


def read_targets():
    with open(TARGETS_PATH, encoding="utf8") as handle:
        payload = json.load(handle)

    if isinstance(payload, dict):
        return payload.get("targets", [])

    return payload


def finish(status="done"):
    write_result(status)

    if KEEP_OPEN:
        return

    main_window = aqt.mw

    if main_window is not None:
        QTimer.singleShot(1500, main_window.close)


def decode_audio_candidates(onclick):
    candidates = []
    text = str(onclick or "")
    mp3_match = re.search(r"Play\(\d+,'.+','.+',\w+,'([^']+)", text)

    if mp3_match:
        append_audio_candidate(candidates, "mp3", mp3_match.group(1))

    ogg_match = re.search(r"Play\(\d+,'[^']+','([^']+)", text)

    if ogg_match:
        append_audio_candidate(candidates, "ogg", ogg_match.group(1))

    return candidates


def append_audio_candidate(candidates, fmt, token):
    try:
        decoded = base64.b64decode(token).decode("utf8")
    except Exception:
        return

    base_url = (
        "https://audio00.forvo.com/audios/mp3/"
        if fmt == "mp3"
        else "https://audio00.forvo.com/ogg/"
    )
    url = base_url + decoded

    if any(candidate.get("url") == url for candidate in candidates):
        return

    candidates.append(
        {
            "decodedPath": decoded,
            "format": fmt,
            "source": "anki-play",
            "url": url,
        }
    )


def enrich_candidate(raw, query, section_index):
    audio_candidates = decode_audio_candidates(raw.get("onclick"))

    if not audio_candidates:
        return None

    origin = normalize_text(raw.get("origin"))
    speaker_country = raw.get("speakerCountry")
    speaker_gender = raw.get("speakerGender")

    if (not speaker_country or not speaker_gender) and origin:
        match = re.search(r"(Male|Female)(?:\s+from\s+([^)]+))?", origin)

        if match:
            speaker_gender = speaker_gender or match.group(1)
            speaker_country = speaker_country or match.group(2)

    return {
        "audioCandidates": audio_candidates,
        "candidateIndex": int(raw.get("candidateIndex") or section_index),
        "downloadUrl": audio_candidates[0]["url"],
        "forvoId": raw.get("forvoId"),
        "pageUrl": raw.get("pageUrl"),
        "query": query,
        "sectionIndex": section_index,
        "speaker": raw.get("speaker"),
        "speakerCountry": speaker_country,
        "speakerGender": speaker_gender,
        "text": normalize_text(raw.get("text")),
        "votes": raw.get("votes"),
    }


def preferred_rank(candidate):
    speaker = normalize_text(candidate.get("speaker")).lower()

    try:
        return PREFERRED_USERS.index(speaker)
    except ValueError:
        return len(PREFERRED_USERS)


def select_candidate(candidates):
    if not candidates:
        return None

    def sort_key(candidate):
        country = normalize_text(candidate.get("speakerCountry")).lower()
        gender = normalize_text(candidate.get("speakerGender"))
        votes = int(candidate.get("votes") or 0)
        native_bonus = 80 if "japan" in country else 0
        gender_bonus = 4 if gender else 0
        section_score = max(0, 40 - int(candidate.get("sectionIndex") or 0) * 2)
        score = native_bonus + gender_bonus + section_score + votes * 18

        return (
            preferred_rank(candidate),
            -score,
            int(candidate.get("sectionIndex") or 0),
        )

    return sorted(candidates, key=sort_key)[0]


def append_result(result):
    state["results"].append(result)
    write_result("running")


def build_page_url(query):
    return "https://forvo.com/word/" + urllib.parse.quote(query, safe="") + "/#ja"


def is_cloudflare_challenge_html(text):
    lowered = str(text or "").lower()

    return (
        "cf-browser-verification" in lowered
        or "checking your browser" in lowered
        or "just a moment" in lowered
    )


def has_forvo_pronunciation_container(text):
    return f'language-container-{TARGET_LANGUAGE}' in str(text or "")


def summarize_rendered_html(text):
    normalized = re.sub(r"\s+", " ", str(text or "")).strip()

    if not normalized:
        return "<empty>"

    return normalized[:500]


def load_rendered_forvo_html(query, on_success, on_error):
    main_window = aqt.mw

    if main_window is None:
        on_error("Anki main window is not ready for the Forvo browser.")
        return

    dialog = main_window.jcs_forvo_dialog = QDialog(main_window)
    dialog.setWindowTitle("JCS Forvo Browser")
    dialog.resize(1024, 768)
    layout = QVBoxLayout(dialog)
    view = main_window.jcs_forvo_view = QWebEngineView(dialog)
    layout.addWidget(view)
    state["views"].append(dialog)
    started_at = time.monotonic()
    result = {
        "done": False,
        "html": "",
        "loaded": False,
        "polling": False,
    }

    def cleanup():
        try:
            state["views"].remove(dialog)
        except ValueError:
            pass
        dialog.close()
        view.deleteLater()
        dialog.deleteLater()

    def complete(html):
        if result["done"]:
            return

        result["done"] = True
        result["html"] = html or result["html"]
        cleanup()
        on_success(result["html"])

    def fail(message):
        if result["done"]:
            return

        result["done"] = True
        cleanup()
        on_error(message)

    def read_html(callback):
        def handle_html(html):
            if html:
                result["html"] = html
            callback(result["html"])

        view.page().toHtml(handle_html)

    def poll_html():
        if result["done"]:
            return

        def after_html(html):
            if result["done"]:
                return

            elapsed_ms = int((time.monotonic() - started_at) * 1000)

            if has_forvo_pronunciation_container(html):
                complete(html)
                return

            if (
                result["loaded"]
                and elapsed_ms >= FORVO_RENDER_MIN_WAIT_MS
                and not is_cloudflare_challenge_html(html)
            ):
                complete(html)
                return

            if elapsed_ms >= FORVO_RENDER_TIMEOUT_MS:
                if html and not is_cloudflare_challenge_html(html):
                    complete(html)
                    return

                fail(
                    (
                        "Forvo page did not finish rendering in the Anki Qt "
                        f"browser. Rendered HTML preview: {summarize_rendered_html(html)}"
                    ),
                )
                return

            QTimer.singleShot(FORVO_RENDER_POLL_MS, poll_html)

        read_html(after_html)

    def ensure_polling():
        if result["polling"]:
            return

        result["polling"] = True
        QTimer.singleShot(FORVO_RENDER_POLL_MS, poll_html)

    def handle_load_finished(ok):
        result["loaded"] = True
        ensure_polling()

    view.loadFinished.connect(handle_load_finished)
    view.load(QUrl(build_page_url(query)))
    dialog.show()
    dialog.raise_()
    dialog.activateWindow()
    ensure_polling()


def load_forvo_soup(query, on_success, on_error):
    def handle_html(text):
        on_success(BeautifulSoup(text, "html.parser"))

    load_rendered_forvo_html(query, handle_html, on_error)


def extract_raw_candidates(soup, query):
    containers = soup.find_all(id=re.compile(r"^language-container-\w{2,4}$"))
    container = None

    for candidate in containers:
        language = re.sub(r"^language-container-", "", candidate.get("id", ""))
        language = language.replace("_", "")

        if language == TARGET_LANGUAGE:
            container = candidate
            break

    if container is None:
        return []

    rows = container.select(".pronunciations-list li")
    raw_candidates = []

    for index, row in enumerate(rows):
        play = row.find(id=re.compile(r"^play_\d+"))
        onclick = play.get("onclick", "") if play else ""

        if not onclick:
            continue

        text = normalize_text(row.get_text(" ", strip=True))
        info_node = row.select_one(".info")
        info_text = normalize_text(
            info_node.get_text(" ", strip=True) if info_node else text
        )
        origin_node = row.select_one(".from")
        origin = normalize_text(
            origin_node.get_text(" ", strip=True) if origin_node else ""
        )
        speaker_match = re.search(
            r"Pronunciation by\s+(.+?)(?:\s+\((?:Male|Female)|$)",
            info_text,
            flags=re.I,
        ) or re.search(
            r"Pronunciation by\s+(.+?)(?:\s+\((?:Male|Female)|$)",
            text,
            flags=re.I,
        )
        gender_country_match = re.search(
            r"(Male|Female)(?:\s+from\s+([^)]+))?",
            origin or text,
            flags=re.I,
        )
        vote_node = row.select_one(".num_votes span") or row.select_one(".num_votes")
        vote_text = normalize_text(
            vote_node.get_text(" ", strip=True) if vote_node else ""
        )
        vote_match = re.search(r"-?\d+", vote_text) or re.search(
            r"(-?\d+)\s+votes?",
            text,
            flags=re.I,
        )
        forvo_id = None

        for link in row.select(".ofLink"):
            for name, value in link.attrs.items():
                if re.match(r"^data-p\d+$", name) and re.match(r"^\d+$", str(value)):
                    forvo_id = int(value)
                    break

            if forvo_id is not None:
                break

        raw_candidates.append(
            {
                "candidateIndex": index,
                "forvoId": forvo_id,
                "onclick": onclick,
                "origin": origin,
                "pageUrl": build_page_url(query),
                "speaker": normalize_text(speaker_match.group(1))
                if speaker_match
                else None,
                "speakerCountry": normalize_text(gender_country_match.group(2))
                if gender_country_match
                else None,
                "speakerGender": normalize_text(gender_country_match.group(1))
                if gender_country_match
                else None,
                "text": text,
                "votes": int(vote_match.group(0)) if vote_match else None,
            }
        )

    return raw_candidates


def run_next():
    if state["index"] >= len(state["targets"]):
        finish("done")
        return

    target = state["targets"][state["index"]]
    state["index"] += 1
    queries = [
        normalize_text(query)
        for query in target.get("queries", [])
        if normalize_text(query)
    ]

    if not queries:
        append_result({**target, "queries": queries, "status": "no_queries"})
        QTimer.singleShot(ENTRY_DELAY_MS, run_next)
        return

    run_query(target, queries, 0)


def run_query(target, queries, query_index):
    if query_index >= len(queries):
        append_result(
            {
                **target,
                "candidates": [],
                "queries": queries,
                "status": "no_results",
            }
        )
        QTimer.singleShot(ENTRY_DELAY_MS, run_next)
        return

    query = queries[query_index]

    def handle_query_error(message):
        append_result(
            {
                **target,
                "error": str(message),
                "queries": queries,
                "query": query,
                "status": "query_error",
            }
        )
        QTimer.singleShot(ENTRY_DELAY_MS, run_next)

    def handle_soup(soup):
        try:
            raw_rows = extract_raw_candidates(soup, query)
            candidates = []

            for index, raw in enumerate(raw_rows):
                candidate = enrich_candidate(raw, query, index)

                if candidate:
                    candidates.append(candidate)
        except Exception:
            traceback.print_exc()
            append_result(
                {
                    **target,
                    "error": traceback.format_exc(),
                    "queries": queries,
                    "query": query,
                    "status": "query_error",
                }
            )
            QTimer.singleShot(ENTRY_DELAY_MS, run_next)
            return

        if not candidates:
            QTimer.singleShot(500, lambda: run_query(target, queries, query_index + 1))
            return

        selected = select_candidate(candidates)
        append_result(
            {
                **target,
                "candidates": candidates,
                "pageUrl": candidates[0].get("pageUrl"),
                "queries": queries,
                "query": query,
                "selected": selected,
                "status": "downloaded",
            }
        )
        QTimer.singleShot(ENTRY_DELAY_MS, run_next)

    load_forvo_soup(query, handle_soup, handle_query_error)


def start_batch():
    log_debug("start_batch called")

    if state["started"]:
        log_debug("start_batch skipped: already started")
        return

    state["started"] = True

    if not TARGETS_PATH or not RESULT_PATH:
        log_debug("start_batch skipped: missing paths")
        return

    try:
        state["targets"] = read_targets()
        log_debug(f"loaded {len(state['targets'])} target(s)")
        write_result("running")
        run_next()
    except Exception:
        traceback.print_exc()
        log_debug("start_batch failed")
        append_result({"error": traceback.format_exc(), "status": "startup_error"})
        finish("error")


def schedule_start_batch():
    log_debug("schedule_start_batch called")

    if state["started"]:
        log_debug("schedule_start_batch skipped: already started")
        return

    if aqt.mw is None:
        log_debug("schedule_start_batch waiting for mw")
        QTimer.singleShot(500, schedule_start_batch)
        return

    log_debug("schedule_start_batch scheduled start")
    QTimer.singleShot(2000, start_batch)


def register_start_hook(name):
    hook = getattr(gui_hooks, name, None)

    if hook is not None:
        log_debug(f"registered hook {name}")
        hook.append(lambda *args: schedule_start_batch())
    else:
        log_debug(f"missing hook {name}")


if TARGETS_PATH and RESULT_PATH:
    register_start_hook("profile_did_open")
    register_start_hook("main_window_did_init")
    QTimer.singleShot(1000, schedule_start_batch)
`;
