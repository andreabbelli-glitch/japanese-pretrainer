"use client";

import {
  startTransition,
  useEffect,
  useRef,
  useState
} from "react";

import {
  formatPitchAccentLabel,
  type PitchAccentData
} from "@/lib/pitch-accent";
import {
  areMeasurementsEqual,
  buildConnectorStyle,
  buildRailStyle,
  estimateCellSizePx,
  getPitchAccentLayoutModel,
  type MoraMeasurement
} from "./pitch-accent-layout";

type PitchAccentNotationProps = {
  compact?: boolean;
  pitchAccent: PitchAccentData;
  showMeta?: boolean;
  variant?: "default" | "reading";
};

export function PitchAccentNotation({
  compact = false,
  showMeta = true,
  variant = "default",
  pitchAccent
}: PitchAccentNotationProps) {
  const graphRef = useRef<HTMLSpanElement | null>(null);
  const cellRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [measurements, setMeasurements] = useState<MoraMeasurement[] | null>(
    null
  );
  const moraKey = pitchAccent.morae.join("|");
  const {
    connectors,
    fallbackGraphStyle,
    fallbackOffsets,
    fallbackUnits,
    lowerRails,
    upperRails
  } = getPitchAccentLayoutModel(pitchAccent, moraKey);

  useEffect(() => {
    const graph = graphRef.current;

    if (!graph) {
      return;
    }

    const measure = () => {
      const graphRect = graph.getBoundingClientRect();
      const estimatedCellSize = estimateCellSizePx(graph);
      const nextMeasurements = fallbackUnits.map((_, index) => {
        const cell = cellRefs.current[index];
        const rect = cell?.getBoundingClientRect();

        if (!rect) {
          return {
            left: fallbackOffsets[index] * estimatedCellSize,
            width: fallbackUnits[index] * estimatedCellSize
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
  }, [fallbackOffsets, fallbackUnits, moraKey]);

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
