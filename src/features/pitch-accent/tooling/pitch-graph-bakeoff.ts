import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildPitchGraphV2FromRawValues,
  computePitchGraphDisplayDomain,
  estimatePitchGraphFromPcm,
  type PitchAccentAudioPitchGraph,
  type PitchAccentMinimalPairsCorpus,
  type PitchAccentPairOption
} from "../model/index.ts";
import {
  matchKotuPitchBaselineCache,
  parseKotuPitchBaselineCache,
  type KotuPitchBaselineCache
} from "./kotu-baseline.ts";
import {
  decodeAudioToFloat32Pcm,
  readPitchAccentCorpusManifest,
  resolvePublicAudioPath
} from "./pitch-graph-generator.ts";

export type GeneratePitchGraphBakeoffReportResult = {
  readonly auditPath: string;
  readonly htmlPath: string;
  readonly targetCount: number;
};

export type GeneratePitchGraphBakeoffReportInput = {
  readonly kotuBaselineCache?: KotuPitchBaselineCache | null;
  readonly kotuBaselineCachePath?: string;
  readonly limit?: number;
  readonly manifestPath: string;
  readonly outDir: string;
  readonly pairIds?: readonly string[];
  readonly publicDir?: string;
  readonly requiredAudioSrcPrefix?: string;
  readonly sampleRate?: number;
};

type BakeoffTarget = {
  readonly corpusLabel: string;
  readonly kana: string;
  readonly option: PitchAccentPairOption;
  readonly pairId: string;
};

type BakeoffColumn =
  | {
      readonly graph: PitchAccentAudioPitchGraph;
      readonly status: "available";
      readonly summary?: string;
    }
  | {
      readonly reason: string;
      readonly status: "ambiguous" | "unavailable" | "unmatched";
      readonly summary?: string;
    };

type BakeoffAuditTarget = BakeoffTarget & {
  readonly audioHref: string;
  readonly audioSrc: string;
  readonly columns: Record<string, BakeoffColumn>;
  readonly durationMs: number;
  readonly pcmFingerprint: string;
};

const defaultProblematicPairIds = ["1z", "qb", "31", "94"] as const;
const defaultBakeoffPairLimit = 30;
const defaultSampleRate = 16_000;

const columnDefinitions = [
  {
    key: "currentStrict",
    label: "current strict graph"
  },
  {
    key: "worldHarvest",
    label: "WORLD Harvest raw"
  },
  {
    key: "praatRaw",
    label: "Praat raw"
  },
  {
    key: "pyinRaw",
    label: "pYIN raw"
  },
  {
    key: "worldCleanup",
    label: "WORLD cleanup standard"
  },
  {
    key: "localKotuLike",
    label: "local Kotu-like render"
  },
  {
    key: "localImproved",
    label: "local improved render"
  },
  {
    key: "kotuApiBaseline",
    label: "Kotu API baseline"
  }
] as const;

export async function generatePitchGraphBakeoffReportForCorpus(
  input: GeneratePitchGraphBakeoffReportInput
): Promise<GeneratePitchGraphBakeoffReportResult> {
  const publicDir = path.resolve(input.publicDir ?? "public");
  const outDir = path.resolve(input.outDir);
  const sampleRate = input.sampleRate ?? defaultSampleRate;
  const corpus = await readPitchAccentCorpusManifest(input.manifestPath, {
    requiredAudioSrcPrefix: input.requiredAudioSrcPrefix
  });
  const kotuBaselineCache =
    input.kotuBaselineCache ??
    (input.kotuBaselineCachePath
      ? parseKotuPitchBaselineCache(
          await readFile(input.kotuBaselineCachePath, "utf8")
        )
      : null);
  const targets = selectBakeoffTargets(corpus, {
    limit: input.limit ?? defaultBakeoffPairLimit,
    pairIds: input.pairIds
  });
  const auditTargets: BakeoffAuditTarget[] = [];

  for (const target of targets) {
    const audioPath = resolvePublicAudioPath(publicDir, target.option.audioSrc);
    const samples = await decodeAudioToFloat32Pcm(audioPath, sampleRate);
    const currentStrict = estimatePitchGraphFromPcm(samples, sampleRate);
    const pcmFingerprint = buildPcmFingerprint(samples);
    const baseGraphInput = {
      durationMs: currentStrict.durationMs,
      extractor: "autocorrelation-v1" as const,
      moraCount: target.option.moraCount,
      pitchAccent: target.option.pitchAccent,
      rawValues: currentStrict.values,
      sampleIntervalMs: currentStrict.sampleIntervalMs
    };
    const columns: Record<string, BakeoffColumn> = {
      currentStrict: {
        graph: currentStrict,
        status: "available",
        summary: "Current autocorrelation graph with null gaps."
      },
      kotuApiBaseline: buildKotuApiBaselineColumn({
        cache: kotuBaselineCache,
        durationMs: currentStrict.durationMs,
        option: target.option,
        pcmFingerprint
      }),
      localImproved: {
        graph: buildPitchGraphV2FromRawValues({
          ...baseGraphInput,
          strategy: "local-improved"
        }),
        status: "available",
        summary: "Compressed-baseline V2 render with short-gap interpolation."
      },
      localKotuLike: {
        graph: buildPitchGraphV2FromRawValues({
          ...baseGraphInput,
          strategy: "local-kotu-like"
        }),
        status: "available",
        summary:
          "Uniform timeline render using baseline continuity for non-voiced frames."
      },
      praatRaw: unavailableExternalExtractor("Praat"),
      pyinRaw: unavailableExternalExtractor("pYIN"),
      worldCleanup: unavailableExternalExtractor("WORLD cleanup"),
      worldHarvest: unavailableExternalExtractor("WORLD Harvest")
    };

    auditTargets.push({
      ...target,
      audioHref: buildReportAudioHref({
        audioSrc: target.option.audioSrc,
        outDir,
        publicDir
      }),
      audioSrc: target.option.audioSrc,
      columns,
      durationMs: currentStrict.durationMs,
      pcmFingerprint
    });
  }

  await mkdir(outDir, { recursive: true });

  const auditPath = path.join(outDir, "audit.json");
  const htmlPath = path.join(outDir, "report.html");
  const audit = {
    generatedAt: new Date().toISOString(),
    manifestPath: input.manifestPath,
    problematicSeedPairIds: defaultProblematicPairIds,
    targetCount: auditTargets.length,
    targets: auditTargets
  };

  await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`);
  await writeFile(htmlPath, renderBakeoffHtml(auditTargets));

  return {
    auditPath,
    htmlPath,
    targetCount: auditTargets.length
  };
}

function selectBakeoffTargets(
  corpus: PitchAccentMinimalPairsCorpus,
  input: {
    readonly limit: number;
    readonly pairIds?: readonly string[];
  }
): readonly BakeoffTarget[] {
  const pairLimit = Math.max(1, Math.floor(input.limit));
  const selectedPairs =
    input.pairIds && input.pairIds.length > 0
      ? input.pairIds
          .map((pairId) => corpus.pairs.find((pair) => pair.id === pairId))
          .filter((pair) => pair !== undefined)
      : selectDefaultBakeoffPairs(corpus, pairLimit);

  return selectedPairs.slice(0, pairLimit).flatMap((pair) =>
    pair.options.map((option) => ({
      corpusLabel: corpus.source.repository,
      kana: pair.kana,
      option,
      pairId: pair.id
    }))
  );
}

function selectDefaultBakeoffPairs(
  corpus: PitchAccentMinimalPairsCorpus,
  limit: number
) {
  const selected = new Map(
    defaultProblematicPairIds
      .map((pairId) => corpus.pairs.find((pair) => pair.id === pairId))
      .filter((pair) => pair !== undefined)
      .map((pair) => [pair.id, pair])
  );

  for (const pair of corpus.pairs) {
    if (selected.size >= limit) {
      break;
    }
    if (!selected.has(pair.id)) {
      selected.set(pair.id, pair);
    }
  }

  return [...selected.values()];
}

function buildKotuApiBaselineColumn(input: {
  readonly cache: KotuPitchBaselineCache | null;
  readonly durationMs: number;
  readonly option: PitchAccentPairOption;
  readonly pcmFingerprint: string;
}): BakeoffColumn {
  const match = matchKotuPitchBaselineCache({
    audioSha256: input.option.audioSha256,
    cache: input.cache,
    durationMs: input.durationMs,
    option: input.option,
    pcmFingerprint: input.pcmFingerprint
  });

  if (match.status === "matched") {
    return {
      graph: buildPitchGraphV2FromRawValues({
        durationMs: input.durationMs,
        extractor: "kotu-api",
        moraCount: input.option.moraCount,
        pitchAccent: input.option.pitchAccent,
        rawValues: match.entry.rawPitchValues,
        sampleIntervalMs: Math.max(
          1,
          Math.round(input.durationMs / match.entry.rawPitchValues.length)
        ),
        strategy: "local-kotu-like"
      }),
      status: "available",
      summary: `Matched Kotu baseline by ${match.strategy}.`
    };
  }

  if (match.status === "ambiguous") {
    return {
      reason: `${match.candidates.length} Kotu baseline cache entries matched metadata.`,
      status: "ambiguous"
    };
  }

  return {
    reason:
      "No authorized Kotu baseline cache entry matched this audio. Pass --kotu-cache after an opt-in fetch.",
    status: "unmatched"
  };
}

function unavailableExternalExtractor(name: string): BakeoffColumn {
  return {
    reason: `${name} is not configured in this local bake-off run.`,
    status: "unavailable"
  };
}

function buildPcmFingerprint(samples: Float32Array) {
  return createHash("sha256")
    .update(Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength))
    .digest("hex");
}

function renderBakeoffHtml(targets: readonly BakeoffAuditTarget[]) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pitch Graph V2 Bake-off</title>
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0;
      padding: 24px;
      background: #191b1f;
      color: #f6efe6;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    h1, h2, h3, p { margin: 0; }
    h1 { font-size: 28px; }
    h2 { margin-top: 10px; color: #b6aea4; font-size: 16px; font-weight: 600; }
    .target {
      margin-top: 24px;
      padding: 22px;
      border: 1px solid rgba(255, 250, 242, 0.16);
      border-radius: 10px;
      background: #222426;
    }
    .meta { margin-top: 6px; color: #b6aea4; }
    audio {
      width: min(100%, 520px);
      margin-top: 14px;
      display: block;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 520px), 1fr));
      gap: 18px;
      margin-top: 18px;
    }
    .column {
      min-width: 0;
      padding: 16px;
      border: 1px solid rgba(255, 250, 242, 0.14);
      border-radius: 8px;
      background: #1b1d1f;
    }
    .column h3 {
      font-size: 14px;
      line-height: 1.3;
    }
    .status {
      margin-top: 8px;
      color: #b6aea4;
      font-size: 13px;
      line-height: 1.4;
    }
    details {
      margin-top: 16px;
      color: #b6aea4;
    }
    summary {
      cursor: pointer;
      font-weight: 700;
    }
    .diagnostics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
      gap: 10px;
      margin-top: 12px;
    }
    .diagnostic {
      padding: 10px;
      border: 1px solid rgba(255, 250, 242, 0.11);
      border-radius: 6px;
      background: rgba(255, 250, 242, 0.03);
    }
    svg {
      width: 100%;
      height: auto;
      margin-top: 10px;
      overflow: visible;
    }
    .grid-line {
      stroke: rgba(255, 250, 242, 0.14);
      stroke-dasharray: 4 6;
    }
    .axis {
      fill: rgba(255, 250, 242, 0.58);
      font-size: 10px;
      text-anchor: middle;
    }
    .pitch {
      fill: none;
      stroke: #d19848;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 3;
    }
  </style>
</head>
<body>
  <h1>Pitch Graph V2 Bake-off</h1>
  <h2>WORLD/Praat/pYIN raw columns are included as explicit extractor slots; Kotu API baseline is cache-backed and opt-in.</h2>
  ${targets.map(renderBakeoffTargetHtml).join("\n")}
</body>
</html>
`;
}

function renderBakeoffTargetHtml(target: BakeoffAuditTarget) {
  const primaryColumnKeys = [
    "currentStrict",
    "localKotuLike",
    "localImproved",
    ...(target.columns.kotuApiBaseline?.status === "available"
      ? ["kotuApiBaseline"]
      : [])
  ];
  const diagnosticColumnKeys = columnDefinitions
    .map((definition) => definition.key)
    .filter((key) => !primaryColumnKeys.includes(key));

  return `<section class="target">
  <h2>${escapeHtml(target.kana)} / ${escapeHtml(target.option.rawPronunciation)} pitch ${target.option.pitchAccent}</h2>
  <p class="meta">${escapeHtml(target.pairId)} · ${escapeHtml(target.option.id)} · ${escapeHtml(target.audioSrc)} · ${target.durationMs}ms</p>
  <audio controls preload="metadata" src="${escapeHtml(target.audioHref)}"></audio>
  <div class="grid">
    ${primaryColumnKeys
      .map((key) =>
        renderBakeoffColumnHtml(
          columnDefinitions.find((definition) => definition.key === key)!.label,
          target.columns[key]
        )
      )
      .join("\n")}
  </div>
  <details>
    <summary>Extractor non disponibili / baseline non matchata</summary>
    <div class="diagnostics">
      ${diagnosticColumnKeys
        .map((key) =>
          renderDiagnosticColumnHtml(
            columnDefinitions.find((definition) => definition.key === key)!
              .label,
            target.columns[key]
          )
        )
        .join("\n")}
    </div>
  </details>
</section>`;
}

function renderBakeoffColumnHtml(label: string, column: BakeoffColumn) {
  return `<article class="column">
  <h3>${escapeHtml(label)}</h3>
  ${
    column.status === "available"
      ? renderGraphSvg(column.graph)
      : `<p class="status">${escapeHtml(column.reason)}</p>`
  }
  ${column.status === "available" ? renderGraphMetrics(column.graph) : ""}
  ${column.summary ? `<p class="status">${escapeHtml(column.summary)}</p>` : ""}
</article>`;
}

function renderDiagnosticColumnHtml(label: string, column: BakeoffColumn) {
  return `<article class="diagnostic">
  <h3>${escapeHtml(label)}</h3>
  <p class="status">${
    column.status === "available"
      ? "Available; shown in the primary comparison."
      : escapeHtml(column.reason)
  }</p>
</article>`;
}

function renderGraphSvg(graph: PitchAccentAudioPitchGraph) {
  const domain = computePitchGraphDisplayDomain(graph);

  if (!domain) {
    return `<p class="status">Pitch graph non disponibile.</p>`;
  }

  const bounds = {
    bottom: 194,
    left: 58,
    right: 612,
    top: 18
  };
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  const range = Math.max(domain.maxYValue - domain.minYValue, 1);
  const durationSeconds = Math.max(graph.durationMs / 1000, 0.01);
  const valueToY = (value: number) =>
    bounds.bottom - ((value - domain.minYValue) / range) * height;
  const indexToX = (index: number) =>
    bounds.left +
    ((index * graph.sampleIntervalMs) / 1000 / durationSeconds) * width;
  const paths: string[] = [];
  let currentPath = "";

  graph.values.forEach((value, index) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      if (currentPath) {
        paths.push(currentPath);
        currentPath = "";
      }
      return;
    }

    const x = roundSvgCoordinate(indexToX(index));
    const y = roundSvgCoordinate(valueToY(value));
    currentPath = currentPath ? `${currentPath} L ${x} ${y}` : `M ${x} ${y}`;
  });
  if (currentPath) {
    paths.push(currentPath);
  }

  return `<svg viewBox="0 0 640 230" role="img" aria-label="pitch graph">
  ${domain.ticks
    .map(
      (tick) =>
        `<line class="grid-line" x1="${bounds.left}" x2="${bounds.right}" y1="${roundSvgCoordinate(
          valueToY(tick)
        )}" y2="${roundSvgCoordinate(valueToY(tick))}" />`
    )
    .join("\n")}
  ${domain.ticks
    .map(
      (tick) =>
        `<text class="axis" x="${bounds.left - 18}" y="${roundSvgCoordinate(
          valueToY(tick) + 4
        )}">${tick.toFixed(1)}</text>`
    )
    .join("\n")}
  ${paths.map((line) => `<path class="pitch" d="${line}" />`).join("\n")}
</svg>`;
}

function renderGraphMetrics(graph: PitchAccentAudioPitchGraph) {
  const voicedCount = graph.values.filter(
    (value) => typeof value === "number" && Number.isFinite(value) && value > 0
  ).length;
  const totalCount = graph.values.length;
  const coverage =
    totalCount > 0 ? Math.round((voicedCount / totalCount) * 100) : 0;
  const quality =
    graph.qualityScore === undefined
      ? "n/a"
      : `${Math.round(graph.qualityScore * 100)}%`;

  return `<p class="status">frames: ${voicedCount}/${totalCount} (${coverage}%) · quality: ${quality}</p>`;
}

function buildReportAudioHref(input: {
  readonly audioSrc: string;
  readonly outDir: string;
  readonly publicDir: string;
}) {
  const audioPath = path.join(input.publicDir, input.audioSrc.slice(1));
  const relativePath = path.relative(input.outDir, audioPath);

  return relativePath.split(path.sep).join("/");
}

function roundSvgCoordinate(value: number) {
  return Number.parseFloat(value.toFixed(2));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
