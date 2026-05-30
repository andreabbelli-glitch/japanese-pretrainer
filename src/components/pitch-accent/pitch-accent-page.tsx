"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { startPitchAccentSessionAction } from "@/actions/pitch-accent";
import {
  pitchAccentPatternKeys,
  type PitchAccentPatternKey
} from "@/features/pitch-accent/model";
import type { PitchAccentPageData } from "@/features/pitch-accent/server/contracts";

import { StatBlock } from "../ui/stat-block";
import { SurfaceCard } from "../ui/surface-card";
import {
  formatPitchAccentCount,
  formatPitchAccentPercent
} from "./pitch-accent-shared";

type PitchAccentPageProps = {
  data: PitchAccentPageData;
};

export function PitchAccentPage({ data }: PitchAccentPageProps) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [selectedPatterns, setSelectedPatterns] = useState<
    readonly PitchAccentPatternKey[]
  >(pitchAccentPatternKeys);
  const [selectedMoraCounts, setSelectedMoraCounts] = useState<
    readonly number[]
  >(data.availableMoraCounts);
  const [onlyDevoiced, setOnlyDevoiced] = useState(false);
  const [strictPairFinding, setStrictPairFinding] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const recentHref: Route | null = data.recentSession
    ? ((data.recentSession.status === "active"
        ? `/pitch-accent/session/${data.recentSession.sessionId}`
        : `/pitch-accent/recap/${data.recentSession.sessionId}`) as Route)
    : null;

  async function startSession() {
    setStarting(true);
    setClientError(null);

    try {
      const session = await startPitchAccentSessionAction({
        filters: {
          moraCounts: selectedMoraCounts,
          onlyDevoiced,
          patternKeys: selectedPatterns,
          strictPairFinding
        }
      });
      router.push(`/pitch-accent/session/${session.sessionId}` as Route);
    } catch (error) {
      setClientError(
        error instanceof Error
          ? error.message
          : "Impossibile avviare la sessione pitch accent."
      );
      setStarting(false);
    }
  }

  function togglePattern(patternKey: PitchAccentPatternKey) {
    setSelectedPatterns((current) => {
      if (current.includes(patternKey)) {
        const next = current.filter((key) => key !== patternKey);
        return next.length > 0 ? next : current;
      }

      return [...current, patternKey].sort(
        (left, right) =>
          pitchAccentPatternKeys.indexOf(left) -
          pitchAccentPatternKeys.indexOf(right)
      );
    });
  }

  function toggleMoraCount(moraCount: number) {
    setSelectedMoraCounts((current) => {
      if (current.includes(moraCount)) {
        const next = current.filter((count) => count !== moraCount);
        return next.length > 0 ? next : current;
      }

      return [...current, moraCount].sort((left, right) => left - right);
    });
  }

  return (
    <div className="pitch-accent-page">
      <section className="pitch-accent-hero">
        <SurfaceCard className="pitch-accent-panel" variant="hero">
          <div className="pitch-accent-copy">
            <p className="pitch-accent-eyebrow">Minimal pairs</p>
            <h1 className="pitch-accent-title">Pitch Accent</h1>
            <p className="pitch-accent-summary">
              Allenamento di percezione su coppie minime giapponesi con audio
              locale e risposta sulla posizione del drop.
            </p>
          </div>
          <div className="pitch-accent-actions">
            <button
              className="button button--primary"
              disabled={starting}
              onClick={startSession}
              type="button"
            >
              {starting ? "Avvio..." : "Avvia sessione"}
            </button>
            {recentHref ? (
              <Link className="button button--ghost" href={recentHref}>
                {data.recentSession?.status === "active"
                  ? "Riprendi"
                  : "Ultimo recap"}
              </Link>
            ) : null}
          </div>
          {clientError ? (
            <p className="kanji-clash-stage__error" role="alert">
              {clientError}
            </p>
          ) : null}
        </SurfaceCard>

        <SurfaceCard className="pitch-accent-panel">
          <p className="pitch-accent-eyebrow">Corpus</p>
          <div className="stats-grid stats-grid--compact">
            <StatBlock
              detail="Corpus statici"
              label="Coppie"
              value={formatPitchAccentCount(data.corpusPairCount)}
            />
            <StatBlock detail="20 trial" label="Sessione" value="finita" />
          </div>
          <p className="pitch-accent-muted">
            Corpus vendorizzati con attribution e licenze nei NOTICE locali.
          </p>
        </SurfaceCard>
      </section>

      <section className="pitch-accent-grid" aria-label="Filtri sessione">
        <SurfaceCard className="pitch-accent-panel pitch-accent-panel--wide">
          <p className="pitch-accent-eyebrow">Pattern</p>
          <div className="pitch-accent-filter-grid">
            {pitchAccentPatternKeys.map((patternKey) => (
              <label className="pitch-accent-check" key={patternKey}>
                <input
                  checked={selectedPatterns.includes(patternKey)}
                  onChange={() => togglePattern(patternKey)}
                  type="checkbox"
                />
                <span>{patternLabel(patternKey)}</span>
              </label>
            ))}
          </div>
        </SurfaceCard>

        {data.availableMoraCounts.length > 0 ? (
          <SurfaceCard className="pitch-accent-panel pitch-accent-panel--wide">
            <p className="pitch-accent-eyebrow">Mora</p>
            <div className="pitch-accent-filter-grid">
              {data.availableMoraCounts.map((moraCount) => (
                <label className="pitch-accent-check" key={moraCount}>
                  <input
                    checked={selectedMoraCounts.includes(moraCount)}
                    onChange={() => toggleMoraCount(moraCount)}
                    type="checkbox"
                  />
                  <span>{moraCountLabel(moraCount)}</span>
                </label>
              ))}
            </div>
          </SurfaceCard>
        ) : null}

        <SurfaceCard className="pitch-accent-panel">
          <p className="pitch-accent-eyebrow">Opzioni</p>
          <div className="pitch-accent-toggle-stack">
            <label className="pitch-accent-check">
              <input
                checked={onlyDevoiced}
                onChange={(event) => setOnlyDevoiced(event.target.checked)}
                type="checkbox"
              />
              <span>Solo coppie con devoicing</span>
            </label>
            <label className="pitch-accent-check">
              <input
                checked={strictPairFinding}
                onChange={(event) => setStrictPairFinding(event.target.checked)}
                type="checkbox"
              />
              <span>Coppie solo tra pattern selezionati</span>
            </label>
          </div>
        </SurfaceCard>

        {data.recentSession ? (
          <SurfaceCard className="pitch-accent-panel">
            <p className="pitch-accent-eyebrow">Ultima sessione</p>
            <p className="pitch-accent-muted">
              {data.recentSession.totalAttempts} risposte, accuratezza{" "}
              {formatPitchAccentPercent(
                data.recentSession.correctAttempts,
                data.recentSession.totalAttempts
              )}
              .
            </p>
          </SurfaceCard>
        ) : null}
      </section>
    </div>
  );
}

function moraCountLabel(moraCount: number) {
  return moraCount === 1 ? "1 mora" : `${moraCount} mora`;
}

function patternLabel(patternKey: PitchAccentPatternKey) {
  if (patternKey === "pitch0") {
    return "Heiban / Odaka";
  }
  if (patternKey === "pitch1") {
    return "Atamadaka";
  }

  return `Nakadaka ${patternKey.replace("pitch", "")}`;
}
