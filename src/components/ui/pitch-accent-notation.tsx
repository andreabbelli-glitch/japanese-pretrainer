"use client";

import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type CSSProperties
} from "react";

import {
  formatPitchAccentLabel,
  type PitchAccentData
} from "@/lib/pitch-accent";

type PitchAccentNotationProps = {
  compact?: boolean;
  pitchAccent: PitchAccentData;
  showMeta?: boolean;
  variant?: "default" | "reading";
};

type AccentRail = {
  length: number;
  start: number;
  tail: boolean;
};

type AccentConnector = {
  boundary: number;
  kind: "drop" | "rise";
};

type MoraMeasurement = {
  left: number;
  width: number;
};

export function PitchAccentNotation({
  compact = false,
  showMeta = true,
  variant = "default",
  pitchAccent
}: PitchAccentNotationProps) {
  const graphRef = useRef<HTMLSpanElement | null>(null);
  const cellRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [measurements, setMeasurements] = useState<MoraMeasurement[] | null>(null);
  const upperRails = buildUpperRails(pitchAccent);
  const lowerRails = buildLowerRails(pitchAccent);
  const connectors = buildConnectors(pitchAccent);
  const fallbackUnits = pitchAccent.morae.map(getMoraVisualUnits);
  const moraKey = pitchAccent.morae.join("|");
  const fallbackUnitsKey = fallbackUnits.join("|");
  const fallbackGraphStyle = {
    gridTemplateColumns: fallbackUnits
      .map((unit) => `calc(${unit} * var(--pitch-accent-cell-size))`)
      .join(" ")
  } as CSSProperties;

  useEffect(() => {
    const graph = graphRef.current;

    if (!graph) {
      return;
    }

    const measure = () => {
      const graphRect = graph.getBoundingClientRect();
      const nextMeasurements = pitchAccent.morae.map((_, index) => {
        const cell = cellRefs.current[index];
        const rect = cell?.getBoundingClientRect();

        if (!rect) {
          return {
            left: sumMoraUnits(fallbackUnits, 0, index) * estimateCellSizePx(graph),
            width: fallbackUnits[index] * estimateCellSizePx(graph)
          };
        }

        return {
          left: rect.left - graphRect.left,
          width: rect.width
        };
      });

      startTransition(() => {
        setMeasurements((current) =>
          areMeasurementsEqual(current, nextMeasurements)
            ? current
            : nextMeasurements
        );
      });
    };

    measure();

    const resizeObserver = new ResizeObserver(() => {
      measure();
    });

    resizeObserver.observe(graph);

    for (const cell of cellRefs.current) {
      if (cell) {
        resizeObserver.observe(cell);
      }
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [fallbackUnits, fallbackUnitsKey, moraKey, pitchAccent.morae]);

  return (
    <div
      aria-label={`Pitch accent ${formatPitchAccentLabel(pitchAccent)}`}
      className={`pitch-accent${compact ? " pitch-accent--compact" : ""}${
        variant === "reading" ? " pitch-accent--reading" : ""
      }`}
    >
      <span
        ref={graphRef}
        className="pitch-accent__graph"
        style={measurements ? undefined : fallbackGraphStyle}
        aria-hidden="true"
      >
        {upperRails.map((upperRail, index) => (
          <span
            key={`upper-${upperRail.start}-${upperRail.length}-${index}`}
            className={`pitch-accent__rail pitch-accent__rail--upper${
              upperRail.tail ? " pitch-accent__rail--tail" : ""
            }`}
            style={buildRailStyle(upperRail, measurements, fallbackUnits)}
          />
        ))}
        {lowerRails.map((lowerRail, index) => (
          <span
            key={`lower-${lowerRail.start}-${lowerRail.length}-${index}`}
            className={`pitch-accent__rail pitch-accent__rail--lower${
              lowerRail.tail ? " pitch-accent__rail--tail" : ""
            }`}
            style={buildRailStyle(lowerRail, measurements, fallbackUnits)}
          />
        ))}
        {connectors.map((connector, index) => (
          <span
            key={`connector-${connector.kind}-${connector.boundary}-${index}`}
            className={`pitch-accent__connector pitch-accent__connector--${connector.kind}`}
            style={buildConnectorStyle(connector, measurements, fallbackUnits)}
          />
        ))}
        <span className="pitch-accent__cells">
          {pitchAccent.morae.map((mora, index) => (
            <span
              key={`${mora}-${index}`}
              ref={(node) => {
                cellRefs.current[index] = node;
              }}
              className="pitch-accent__cell"
            >
              <span className="pitch-accent__mora">{mora}</span>
            </span>
          ))}
        </span>
      </span>
      {!compact && showMeta ? (
        <span className="pitch-accent__meta">
          {formatPitchAccentLabel(pitchAccent)}
        </span>
      ) : null}
    </div>
  );
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

function buildRailStyle(
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
    "--pitch-accent-span-offset": String(sumMoraUnits(fallbackUnits, 0, rail.start)),
    "--pitch-accent-span-width": String(
      sumMoraUnits(fallbackUnits, rail.start, rail.start + rail.length)
    )
  } as CSSProperties;
}

function buildConnectorStyle(
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

function areMeasurementsEqual(
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

function estimateCellSizePx(graph: HTMLSpanElement) {
  const fontSize = Number.parseFloat(window.getComputedStyle(graph).fontSize);
  return Number.isFinite(fontSize) ? fontSize * 1.04 : 24.96;
}

function sumMoraUnits(moraUnits: number[], start: number, end: number) {
  if (moraUnits.length === 0) {
    return Math.max(end - start, 0);
  }

  return moraUnits.slice(start, end).reduce((total, unit) => total + unit, 0);
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
