import type { CSSProperties } from "react";

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

export function PitchAccentNotation({
  compact = false,
  showMeta = true,
  variant = "default",
  pitchAccent
}: PitchAccentNotationProps) {
  const graphStyle = {
    "--pitch-accent-mora-count": String(pitchAccent.morae.length)
  } as CSSProperties;
  const upperRail = buildUpperRail(pitchAccent);
  const lowerRail = buildLowerRail(pitchAccent);
  const connector = buildConnector(pitchAccent);

  return (
    <div
      aria-label={`Pitch accent ${formatPitchAccentLabel(pitchAccent)}`}
      className={`pitch-accent${compact ? " pitch-accent--compact" : ""}${
        variant === "reading" ? " pitch-accent--reading" : ""
      }`}
    >
      <span className="pitch-accent__graph" style={graphStyle} aria-hidden="true">
        {upperRail ? (
          <span
            className={`pitch-accent__rail pitch-accent__rail--upper${
              upperRail.tail ? " pitch-accent__rail--tail" : ""
            }`}
            style={buildSpanStyle(upperRail.start, upperRail.length)}
          />
        ) : null}
        {lowerRail ? (
          <span
            className={`pitch-accent__rail pitch-accent__rail--lower${
              lowerRail.tail ? " pitch-accent__rail--tail" : ""
            }`}
            style={buildSpanStyle(lowerRail.start, lowerRail.length)}
          />
        ) : null}
        {connector ? (
          <span
            className={`pitch-accent__connector pitch-accent__connector--${connector.kind}`}
            style={buildBoundaryStyle(connector.boundary)}
          />
        ) : null}
        {pitchAccent.morae.map((mora, index) => (
          <span
            key={`${mora}-${index}`}
            className="pitch-accent__cell"
            style={{ gridColumn: String(index + 1) }}
          >
            <span className="pitch-accent__mora">{mora}</span>
          </span>
        ))}
      </span>
      {!compact && showMeta ? (
        <span className="pitch-accent__meta">
          {formatPitchAccentLabel(pitchAccent)}
        </span>
      ) : null}
    </div>
  );
}

function buildUpperRail(pitchAccent: PitchAccentData) {
  if (pitchAccent.downstep === 0) {
    return {
      length: Math.max(pitchAccent.morae.length - 1, 0),
      start: 1,
      tail: true
    };
  }

  if (pitchAccent.downstep === 1) {
    return {
      length: 1,
      start: 0,
      tail: false
    };
  }

  return {
    length: pitchAccent.downstep,
    start: 0,
    tail: pitchAccent.downstep === pitchAccent.morae.length
  };
}

function buildLowerRail(pitchAccent: PitchAccentData) {
  if (pitchAccent.downstep === 0) {
    return {
      length: 1,
      start: 0,
      tail: false
    };
  }

  if (pitchAccent.downstep >= pitchAccent.morae.length) {
    return null;
  }

  return {
    length: pitchAccent.morae.length - pitchAccent.downstep,
    start: pitchAccent.downstep,
    tail: true
  };
}

function buildConnector(pitchAccent: PitchAccentData) {
  if (pitchAccent.downstep === 0) {
    return {
      boundary: 1,
      kind: "rise" as const
    };
  }

  if (pitchAccent.downstep < pitchAccent.morae.length) {
    return {
      boundary: pitchAccent.downstep,
      kind: "drop" as const
    };
  }

  return {
    boundary: pitchAccent.morae.length,
    kind: "drop" as const
  };
}

function buildSpanStyle(start: number, length: number) {
  return {
    "--pitch-accent-span-length": String(length),
    "--pitch-accent-span-start": String(start)
  } as CSSProperties;
}

function buildBoundaryStyle(boundary: number) {
  return {
    "--pitch-accent-boundary": String(boundary)
  } as CSSProperties;
}
