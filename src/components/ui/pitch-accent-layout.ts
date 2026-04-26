import type { CSSProperties } from "react";

import type { PitchAccentData } from "@/lib/pitch-accent";

export type AccentRail = {
  length: number;
  start: number;
  tail: boolean;
};

export type AccentConnector = {
  boundary: number;
  kind: "drop" | "rise";
};

export type MoraMeasurement = {
  left: number;
  width: number;
};

export type PitchAccentLayoutModel = {
  connectors: AccentConnector[];
  fallbackGraphStyle: CSSProperties;
  fallbackOffsets: number[];
  fallbackUnits: number[];
  lowerRails: AccentRail[];
  upperRails: AccentRail[];
};

const pitchAccentLayoutCache = new Map<string, PitchAccentLayoutModel>();

export function buildRailStyle(
  rail: AccentRail,
  measurements: MoraMeasurement[] | null,
  fallbackUnits: number[]
) {
  if (measurements) {
    const segment = getMeasuredSegment(measurements, rail.start, rail.length);

    return {
      left: `calc(${segment.left}px + var(--pitch-accent-rail-start-inset))`,
      width: rail.tail
        ? `calc(${segment.width}px - var(--pitch-accent-tail-end-trim, 0px))`
        : `calc(${segment.width}px - var(--pitch-accent-rail-end-trim))`
    } as CSSProperties;
  }

  return {
    "--pitch-accent-span-offset": String(
      sumMoraUnits(fallbackUnits, 0, rail.start)
    ),
    "--pitch-accent-span-width": String(
      sumMoraUnits(fallbackUnits, rail.start, rail.start + rail.length)
    )
  } as CSSProperties;
}

export function buildConnectorStyle(
  connector: AccentConnector,
  measurements: MoraMeasurement[] | null,
  fallbackUnits: number[]
) {
  if (measurements) {
    const boundaryLeft = getBoundaryLeft(measurements, connector.boundary);

    return {
      left: `calc(${boundaryLeft}px - var(--pitch-accent-trace-size))`
    } as CSSProperties;
  }

  return {
    "--pitch-accent-boundary-offset": String(
      sumMoraUnits(fallbackUnits, 0, connector.boundary)
    )
  } as CSSProperties;
}

export function areMeasurementsEqual(
  current: MoraMeasurement[] | null,
  next: MoraMeasurement[]
) {
  if (!current || current.length !== next.length) {
    return false;
  }

  return current.every((measurement, index) => {
    const candidate = next[index];

    if (!candidate) {
      return false;
    }

    return (
      Math.abs(measurement.left - candidate.left) < 0.5 &&
      Math.abs(measurement.width - candidate.width) < 0.5
    );
  });
}

export function estimateCellSizePx(graph: HTMLSpanElement) {
  const fontSize = Number.parseFloat(window.getComputedStyle(graph).fontSize);
  return Number.isFinite(fontSize) ? fontSize * 1.04 : 24.96;
}

export function getPitchAccentLayoutModel(
  pitchAccent: PitchAccentData,
  moraKey: string
): PitchAccentLayoutModel {
  const cacheKey = `${moraKey}:${pitchAccent.downstep}`;
  const cached = pitchAccentLayoutCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const fallbackUnits = pitchAccent.morae.map(getMoraVisualUnits);
  const computed: PitchAccentLayoutModel = {
    connectors: buildConnectors(pitchAccent),
    fallbackGraphStyle: {
      gridTemplateColumns: fallbackUnits
        .map((unit) => `calc(${unit} * var(--pitch-accent-cell-size))`)
        .join(" ")
    },
    fallbackOffsets: buildMoraUnitOffsets(fallbackUnits),
    fallbackUnits,
    lowerRails: buildLowerRails(pitchAccent),
    upperRails: buildUpperRails(pitchAccent)
  };

  pitchAccentLayoutCache.set(cacheKey, computed);
  return computed;
}

function buildUpperRails(pitchAccent: PitchAccentData): AccentRail[] {
  if (pitchAccent.downstep === 0) {
    return [
      {
        length: Math.max(pitchAccent.morae.length - 1, 0),
        start: 1,
        tail: true
      }
    ];
  }

  if (pitchAccent.downstep === 1) {
    return [
      {
        length: 1,
        start: 0,
        tail: false
      }
    ];
  }

  return [
    {
      length: Math.max(pitchAccent.downstep - 1, 0),
      start: 1,
      tail: pitchAccent.downstep === pitchAccent.morae.length
    }
  ];
}

function buildLowerRails(pitchAccent: PitchAccentData): AccentRail[] {
  const rails: AccentRail[] = [];

  if (pitchAccent.downstep === 0) {
    rails.push({
      length: 1,
      start: 0,
      tail: false
    });
    return rails;
  }

  if (pitchAccent.downstep > 1) {
    rails.push({
      length: 1,
      start: 0,
      tail: false
    });
  }

  if (pitchAccent.downstep < pitchAccent.morae.length) {
    rails.push({
      length: pitchAccent.morae.length - pitchAccent.downstep,
      start: pitchAccent.downstep,
      tail: true
    });
  }

  return rails;
}

function buildConnectors(pitchAccent: PitchAccentData): AccentConnector[] {
  const connectors: AccentConnector[] = [];

  if (pitchAccent.downstep === 0) {
    connectors.push({
      boundary: 1,
      kind: "rise"
    });
    return connectors;
  }

  if (pitchAccent.downstep > 1) {
    connectors.push({
      boundary: 1,
      kind: "rise"
    });
  }

  if (pitchAccent.downstep < pitchAccent.morae.length) {
    connectors.push({
      boundary: pitchAccent.downstep,
      kind: "drop"
    });
    return connectors;
  }

  connectors.push({
    boundary: pitchAccent.morae.length,
    kind: "drop"
  });

  return connectors;
}

function getMeasuredSegment(
  measurements: MoraMeasurement[],
  start: number,
  length: number
) {
  const first = measurements[start];
  const last = measurements[start + length - 1];

  if (!first || !last) {
    return {
      left: 0,
      width: 0
    };
  }

  return {
    left: first.left,
    width: last.left + last.width - first.left
  };
}

function getBoundaryLeft(measurements: MoraMeasurement[], boundary: number) {
  if (boundary <= 0) {
    return 0;
  }

  const cell = measurements[boundary];

  if (!cell) {
    const last = measurements.at(-1);
    return last ? last.left + last.width : 0;
  }

  return cell.left;
}

function buildMoraUnitOffsets(moraUnits: number[]) {
  const offsets = new Array<number>(moraUnits.length);
  let total = 0;

  for (let index = 0; index < moraUnits.length; index += 1) {
    offsets[index] = total;
    total += moraUnits[index] ?? 0;
  }

  return offsets;
}

function sumMoraUnits(moraUnits: number[], start: number, end: number) {
  if (moraUnits.length === 0) {
    return Math.max(end - start, 0);
  }

  let total = 0;

  for (
    let index = Math.max(start, 0);
    index < Math.min(end, moraUnits.length);
    index += 1
  ) {
    total += moraUnits[index] ?? 0;
  }

  return total;
}

function getMoraVisualUnits(mora: string) {
  let units = 0;

  for (const char of mora) {
    units += getKanaVisualUnit(char);
  }

  return Math.max(units, 1);
}

function getKanaVisualUnit(char: string) {
  if (smallKana.has(char)) {
    return 0.38;
  }

  if (narrowKana.has(char)) {
    return 0.82;
  }

  if (char === "ー") {
    return 0.92;
  }

  return 1;
}

const smallKana = new Set([
  "ぁ",
  "ぃ",
  "ぅ",
  "ぇ",
  "ぉ",
  "ゃ",
  "ゅ",
  "ょ",
  "ゎ",
  "ァ",
  "ィ",
  "ゥ",
  "ェ",
  "ォ",
  "ャ",
  "ュ",
  "ョ",
  "ヮ"
]);

const narrowKana = new Set(["っ", "ッ"]);
