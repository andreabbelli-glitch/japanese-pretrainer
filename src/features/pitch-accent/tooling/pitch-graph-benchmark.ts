export type PitchBenchmarkSeries = {
  readonly label: string;
  readonly sampleIntervalMs: number;
  readonly timestampsMs?: readonly number[];
  readonly values: readonly number[];
};

export type PitchBenchmarkMetrics = {
  readonly grossPitchErrorRate: number | null;
  readonly maeCents: number | null;
  readonly matchedVoicedFrameCount: number;
  readonly octaveErrorRate: number | null;
  readonly referenceVoicedFrameCount: number;
  readonly rmseCents: number | null;
  readonly similarityScore: number;
  readonly voicingF1: number;
  readonly voicingPrecision: number;
  readonly voicingRecall: number;
};

export type PitchBenchmarkReportSample = {
  readonly audioHref: string;
  readonly durationMs: number;
  readonly extractors: readonly {
    readonly metrics: PitchBenchmarkMetrics | null;
    readonly series: PitchBenchmarkSeries | null;
    readonly status: "available" | "unavailable";
    readonly summary?: string;
  }[];
  readonly gender: "FEMALE" | "MALE";
  readonly reference: PitchBenchmarkSeries;
  readonly speaker: string;
  readonly utterance: string;
};

const grossPitchErrorThresholdCents = 1200 * Math.log2(1.2);
const octaveErrorThresholdCents = 600;

export function computePitchBenchmarkMetrics(input: {
  readonly candidate: PitchBenchmarkSeries;
  readonly reference: PitchBenchmarkSeries;
}): PitchBenchmarkMetrics {
  const frameCount = input.reference.values.length;
  let falseNegativeCount = 0;
  let falsePositiveCount = 0;
  let grossPitchErrorCount = 0;
  let matchedVoicedFrameCount = 0;
  let octaveErrorCount = 0;
  let referenceVoicedFrameCount = 0;
  let truePositiveCount = 0;
  const centsErrors: number[] = [];

  for (let index = 0; index < frameCount; index += 1) {
    const referenceValue = input.reference.values[index] ?? 0;
    const candidateValue = sampleSeriesAtReferenceIndex({
      reference: input.reference,
      referenceIndex: index,
      series: input.candidate
    });
    const referenceVoiced = isVoicedPitch(referenceValue);
    const candidateVoiced = isVoicedPitch(candidateValue);

    if (referenceVoiced) {
      referenceVoicedFrameCount += 1;
    }

    if (referenceVoiced && candidateVoiced) {
      truePositiveCount += 1;
      matchedVoicedFrameCount += 1;
      const centsError = Math.abs(
        1200 * Math.log2(candidateValue / referenceValue)
      );
      centsErrors.push(centsError);

      if (centsError > grossPitchErrorThresholdCents) {
        grossPitchErrorCount += 1;
      }
      if (centsError > octaveErrorThresholdCents) {
        octaveErrorCount += 1;
      }
    } else if (referenceVoiced && !candidateVoiced) {
      falseNegativeCount += 1;
    } else if (!referenceVoiced && candidateVoiced) {
      falsePositiveCount += 1;
    }
  }

  const voicingPrecision =
    truePositiveCount + falsePositiveCount === 0
      ? 0
      : truePositiveCount / (truePositiveCount + falsePositiveCount);
  const voicingRecall =
    truePositiveCount + falseNegativeCount === 0
      ? 0
      : truePositiveCount / (truePositiveCount + falseNegativeCount);
  const voicingF1 =
    voicingPrecision + voicingRecall === 0
      ? 0
      : (2 * voicingPrecision * voicingRecall) /
        (voicingPrecision + voicingRecall);
  const maeCents =
    centsErrors.length === 0
      ? null
      : centsErrors.reduce((sum, value) => sum + value, 0) / centsErrors.length;
  const rmseCents =
    centsErrors.length === 0
      ? null
      : Math.sqrt(
          centsErrors.reduce((sum, value) => sum + value * value, 0) /
            centsErrors.length
        );
  const pitchSimilarity =
    maeCents === null ? 0 : Math.max(0, 1 - maeCents / 400);

  return {
    grossPitchErrorRate:
      centsErrors.length === 0
        ? null
        : grossPitchErrorCount / centsErrors.length,
    maeCents,
    matchedVoicedFrameCount,
    octaveErrorRate:
      centsErrors.length === 0 ? null : octaveErrorCount / centsErrors.length,
    referenceVoicedFrameCount,
    rmseCents,
    similarityScore: Math.round(voicingF1 * pitchSimilarity * 1000) / 10,
    voicingF1,
    voicingPrecision,
    voicingRecall
  };
}

export function renderPitchBenchmarkReportHtml(input: {
  readonly generatedAt: string;
  readonly samples: readonly PitchBenchmarkReportSample[];
}) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PTDB-TUG F0 Benchmark</title>
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
    h2 { color: #f6efe6; font-size: 20px; }
    .lead { margin-top: 8px; max-width: 900px; color: #b6aea4; line-height: 1.5; }
    .sample {
      margin-top: 24px;
      padding: 22px;
      border: 1px solid rgba(255, 250, 242, 0.16);
      border-radius: 10px;
      background: #222426;
    }
    .meta { margin-top: 8px; color: #b6aea4; }
    audio {
      width: min(100%, 560px);
      margin-top: 14px;
      display: block;
    }
    table {
      width: 100%;
      margin-top: 18px;
      border-collapse: collapse;
      font-size: 13px;
    }
    th, td {
      padding: 8px 10px;
      border-bottom: 1px solid rgba(255, 250, 242, 0.12);
      text-align: right;
    }
    th:first-child, td:first-child { text-align: left; }
    th { color: #f6efe6; font-weight: 800; }
    td { color: #d8d0c7; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 520px), 1fr));
      gap: 18px;
      margin-top: 18px;
    }
    .card {
      min-width: 0;
      padding: 16px;
      border: 1px solid rgba(255, 250, 242, 0.14);
      border-radius: 8px;
      background: #1b1d1f;
    }
    .reference-card {
      border-color: rgba(91, 214, 255, 0.45);
      background: #172027;
    }
    .status {
      margin-top: 8px;
      color: #b6aea4;
      font-size: 13px;
      line-height: 1.4;
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
    .reference-line {
      fill: none;
      stroke: #5bd6ff;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 3.5;
    }
    .candidate-line {
      fill: none;
      stroke: #d19848;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 2.6;
    }
    .legend {
      display: flex;
      gap: 16px;
      margin-top: 10px;
      color: #b6aea4;
      font-size: 13px;
    }
    .swatch {
      display: inline-block;
      width: 10px;
      height: 10px;
      margin-right: 6px;
      border-radius: 50%;
    }
    .ref { background: #5bd6ff; }
    .cand { background: #d19848; }
  </style>
</head>
<body>
  <h1>PTDB-TUG F0 Benchmark</h1>
  <p class="lead">Five microphone recordings are compared against PTDB-TUG reference F0 extracted from laryngograph data. Similarity is our review index: voiced-frame F1 multiplied by pitch closeness in cents; higher is better.</p>
  <p class="lead">The overlay and metrics use extractor timestamps when available, so model outputs with non-10ms frame centers are not forced onto index zero.</p>
  <p class="lead">Generated at ${escapeHtml(input.generatedAt)}.</p>
  ${input.samples.map(renderBenchmarkSampleHtml).join("\n")}
</body>
</html>
`;
}

function renderBenchmarkSampleHtml(sample: PitchBenchmarkReportSample) {
  const availableExtractors = sample.extractors
    .filter(
      (extractor) => extractor.status === "available" && extractor.metrics
    )
    .sort(
      (left, right) =>
        (right.metrics?.similarityScore ?? 0) -
        (left.metrics?.similarityScore ?? 0)
    );

  return `<section class="sample">
  <h2>${escapeHtml(sample.speaker)} ${escapeHtml(sample.utterance)}</h2>
  <p class="meta">${escapeHtml(sample.gender)} · ${sample.durationMs}ms · reference voiced frames: ${sample.reference.values.filter(isVoicedPitch).length}/${sample.reference.values.length}</p>
  <audio controls preload="metadata" src="${escapeHtml(sample.audioHref)}"></audio>
  ${renderMetricsTable(availableExtractors)}
  <div class="grid">
    <article class="card reference-card">
      <h3>Validated PTDB-TUG F0</h3>
      ${renderPitchOverlaySvg({ reference: sample.reference })}
      <p class="status">Reference F0 from PTDB-TUG laryngograph track. Blue line is the scientific baseline for this benchmark.</p>
    </article>
    ${sample.extractors.map((extractor) => renderExtractorCard(sample.reference, extractor)).join("\n")}
  </div>
</section>`;
}

function renderMetricsTable(
  extractors: readonly {
    readonly metrics: PitchBenchmarkMetrics | null;
    readonly series: PitchBenchmarkSeries | null;
    readonly status: "available" | "unavailable";
  }[]
) {
  return `<table>
    <thead>
      <tr>
        <th>Extractor</th>
        <th>Similarity</th>
        <th>MAE cents</th>
        <th>RMSE cents</th>
        <th>Voicing F1</th>
        <th>GPE</th>
        <th>Octave err</th>
      </tr>
    </thead>
    <tbody>
      ${extractors
        .map((extractor) => {
          const metrics = extractor.metrics!;

          return `<tr>
            <td>${escapeHtml(extractor.series!.label)}</td>
            <td>${metrics.similarityScore.toFixed(1)}</td>
            <td>${formatNullableNumber(metrics.maeCents)}</td>
            <td>${formatNullableNumber(metrics.rmseCents)}</td>
            <td>${formatPercent(metrics.voicingF1)}</td>
            <td>${formatNullablePercent(metrics.grossPitchErrorRate)}</td>
            <td>${formatNullablePercent(metrics.octaveErrorRate)}</td>
          </tr>`;
        })
        .join("\n")}
    </tbody>
  </table>`;
}

function renderExtractorCard(
  reference: PitchBenchmarkSeries,
  extractor: PitchBenchmarkReportSample["extractors"][number]
) {
  if (extractor.status === "unavailable" || !extractor.series) {
    return `<article class="card">
      <h3>${escapeHtml(extractor.series?.label ?? "Extractor unavailable")}</h3>
      <p class="status">${escapeHtml(extractor.summary ?? "No output produced.")}</p>
    </article>`;
  }

  return `<article class="card">
    <h3>${escapeHtml(extractor.series.label)}</h3>
    ${renderPitchOverlaySvg({ candidate: extractor.series, reference })}
    <div class="legend">
      <span><span class="swatch ref"></span>validated F0</span>
      <span><span class="swatch cand"></span>${escapeHtml(extractor.series.label)}</span>
    </div>
    <p class="status">${extractor.metrics ? `Similarity ${extractor.metrics.similarityScore.toFixed(1)} · MAE ${formatNullableNumber(extractor.metrics.maeCents)} cents · voiced ${extractor.metrics.matchedVoicedFrameCount}/${extractor.metrics.referenceVoicedFrameCount}` : ""}</p>
    ${extractor.summary ? `<p class="status">${escapeHtml(extractor.summary)}</p>` : ""}
  </article>`;
}

function renderPitchOverlaySvg(input: {
  readonly candidate?: PitchBenchmarkSeries;
  readonly reference: PitchBenchmarkSeries;
}) {
  const allValues = [
    ...input.reference.values,
    ...(input.candidate?.values ?? [])
  ].filter(isVoicedPitch);
  const minValue = Math.max(40, Math.min(...allValues) - 20);
  const maxValue = Math.max(minValue + 1, Math.max(...allValues) + 20);
  const bounds = {
    bottom: 194,
    left: 58,
    right: 612,
    top: 18
  };
  const height = bounds.bottom - bounds.top;
  const durationMs = Math.max(
    getSeriesDurationMs(input.reference),
    input.candidate ? getSeriesDurationMs(input.candidate) : 0
  );
  const valueToY = (value: number) =>
    bounds.bottom - ((value - minValue) / (maxValue - minValue)) * height;
  const ticks = [minValue, (minValue + maxValue) / 2, maxValue];

  return `<svg viewBox="0 0 640 230" role="img" aria-label="pitch benchmark graph">
    ${ticks
      .map((tick) => {
        const y = roundSvgCoordinate(valueToY(tick));

        return `<line class="grid-line" x1="${bounds.left}" x2="${bounds.right}" y1="${y}" y2="${y}" />`;
      })
      .join("\n")}
    ${ticks
      .map(
        (tick) =>
          `<text class="axis" x="${bounds.left - 18}" y="${roundSvgCoordinate(
            valueToY(tick) + 4
          )}">${tick.toFixed(1)}</text>`
      )
      .join("\n")}
    ${seriesToSvgPaths({
      bounds,
      className: "reference-line",
      durationMs,
      series: input.reference,
      valueToY
    })}
    ${
      input.candidate
        ? seriesToSvgPaths({
            bounds,
            className: "candidate-line",
            durationMs,
            series: input.candidate,
            valueToY
          })
        : ""
    }
  </svg>`;
}

function seriesToSvgPaths(input: {
  readonly bounds: { readonly left: number; readonly right: number };
  readonly className: string;
  readonly durationMs: number;
  readonly series: PitchBenchmarkSeries;
  readonly valueToY: (value: number) => number;
}) {
  const width = input.bounds.right - input.bounds.left;
  const paths: string[] = [];
  let currentPath = "";

  input.series.values.forEach((value, index) => {
    if (!isVoicedPitch(value)) {
      if (currentPath) {
        paths.push(currentPath);
        currentPath = "";
      }

      return;
    }

    const x = roundSvgCoordinate(
      input.bounds.left +
        (getSeriesTimeMs(input.series, index) / input.durationMs) * width
    );
    const y = roundSvgCoordinate(input.valueToY(value));
    currentPath = currentPath ? `${currentPath} L ${x} ${y}` : `M ${x} ${y}`;
  });

  if (currentPath) {
    paths.push(currentPath);
  }

  return paths
    .map((path) => `<path class="${input.className}" d="${path}" />`)
    .join("\n");
}

function sampleSeriesAtReferenceIndex(input: {
  readonly reference: PitchBenchmarkSeries;
  readonly referenceIndex: number;
  readonly series: PitchBenchmarkSeries;
}) {
  const timeMs = getSeriesTimeMs(input.reference, input.referenceIndex);

  if (hasTimestamps(input.series)) {
    return sampleSeriesAtTimeMs(input.series, timeMs);
  }

  const candidateIndex = Math.round(timeMs / input.series.sampleIntervalMs);

  return input.series.values[candidateIndex] ?? 0;
}

function sampleSeriesAtTimeMs(series: PitchBenchmarkSeries, timeMs: number) {
  if (!hasTimestamps(series)) {
    const candidateIndex = Math.round(timeMs / series.sampleIntervalMs);

    return series.values[candidateIndex] ?? 0;
  }

  const timestamps = series.timestampsMs;
  const intervalMs = getSeriesIntervalMs(series);
  const firstTimestamp = timestamps[0] ?? 0;
  const lastTimestamp = timestamps[timestamps.length - 1] ?? 0;

  if (
    timeMs < firstTimestamp - intervalMs / 2 ||
    timeMs > lastTimestamp + intervalMs / 2
  ) {
    return 0;
  }

  const index = findNearestTimestampIndex(timestamps, timeMs);

  return series.values[index] ?? 0;
}

function findNearestTimestampIndex(
  timestampsMs: readonly number[],
  timeMs: number
) {
  let low = 0;
  let high = timestampsMs.length - 1;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);

    if ((timestampsMs[middle] ?? 0) < timeMs) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  const rightIndex = low;
  const leftIndex = Math.max(0, rightIndex - 1);
  const leftDistance = Math.abs((timestampsMs[leftIndex] ?? 0) - timeMs);
  const rightDistance = Math.abs((timestampsMs[rightIndex] ?? 0) - timeMs);

  return leftDistance <= rightDistance ? leftIndex : rightIndex;
}

function getSeriesTimeMs(series: PitchBenchmarkSeries, index: number) {
  return hasTimestamps(series)
    ? (series.timestampsMs[index] ?? index * series.sampleIntervalMs)
    : index * series.sampleIntervalMs;
}

function getSeriesDurationMs(series: PitchBenchmarkSeries) {
  if (!hasTimestamps(series)) {
    return series.values.length * series.sampleIntervalMs;
  }

  const lastTimestamp = series.timestampsMs[series.timestampsMs.length - 1] ?? 0;

  return lastTimestamp + getSeriesIntervalMs(series);
}

function getSeriesIntervalMs(series: PitchBenchmarkSeries) {
  if (!hasTimestamps(series) || series.timestampsMs.length < 2) {
    return series.sampleIntervalMs;
  }

  const diffs = series.timestampsMs
    .slice(1)
    .map((timestamp, index) => timestamp - (series.timestampsMs?.[index] ?? 0))
    .filter((diff) => Number.isFinite(diff) && diff > 0)
    .sort((left, right) => left - right);

  return diffs[Math.floor(diffs.length / 2)] ?? series.sampleIntervalMs;
}

function hasTimestamps(
  series: PitchBenchmarkSeries
): series is PitchBenchmarkSeries & { readonly timestampsMs: readonly number[] } {
  return series.timestampsMs?.length === series.values.length;
}

function isVoicedPitch(value: number) {
  return Number.isFinite(value) && value > 0;
}

function formatNullableNumber(value: number | null) {
  return value === null ? "n/a" : value.toFixed(1);
}

function formatNullablePercent(value: number | null) {
  return value === null ? "n/a" : formatPercent(value);
}

function formatPercent(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

function roundSvgCoordinate(value: number) {
  return Math.round(value * 10) / 10;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
