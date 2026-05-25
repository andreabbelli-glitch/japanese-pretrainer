import type { PitchAccentPairOption } from "../types.ts";

export type KotuPitchBaselineCacheEntry = {
  readonly audioSha256?: string;
  readonly durationMs?: number;
  readonly fetchedAt?: string;
  readonly kotuPronunciationId: string;
  readonly pcmFingerprint?: string;
  readonly pitchAccent?: number;
  readonly rawPitchValues: readonly number[];
  readonly rawPronunciation?: string;
  readonly sourceUrl?: string;
};

export type KotuPitchBaselineCache = {
  readonly entries: readonly KotuPitchBaselineCacheEntry[];
  readonly version: 1;
};

export type KotuPitchBaselineMatch =
  | {
      readonly entry: KotuPitchBaselineCacheEntry;
      readonly status: "matched";
      readonly strategy: "audio-sha256" | "pcm-fingerprint" | "metadata";
    }
  | {
      readonly candidates: readonly KotuPitchBaselineCacheEntry[];
      readonly status: "ambiguous";
      readonly strategy: "metadata";
    }
  | {
      readonly status: "unmatched";
    };

export async function fetchKotuRawPitchBaseline(input: {
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
  readonly pronunciationId: string;
}): Promise<KotuPitchBaselineCacheEntry> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const baseUrl = input.baseUrl ?? "https://kotu.io";
  const endpoint = new URL(
    `/languages/ja/analysis/audio/pronunciations/${encodeURIComponent(
      input.pronunciationId
    )}/raw-pitch`,
    baseUrl
  );
  const response = await fetchImpl(endpoint, {
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Kotu raw-pitch request failed (${response.status} ${response.statusText}).`
    );
  }

  return {
    fetchedAt: new Date().toISOString(),
    kotuPronunciationId: input.pronunciationId,
    rawPitchValues: parseKotuRawPitchPayload(await response.json()),
    sourceUrl: endpoint.toString()
  };
}

export function parseKotuPitchBaselineCache(
  source: string
): KotuPitchBaselineCache {
  const parsed = JSON.parse(source) as KotuPitchBaselineCache;

  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.entries)) {
    throw new Error("Kotu baseline cache must include version 1 and entries.");
  }

  return {
    entries: parsed.entries.map((entry) => ({
      ...entry,
      rawPitchValues: parseKotuRawPitchPayload(entry.rawPitchValues)
    })),
    version: 1
  };
}

export function matchKotuPitchBaselineCache(input: {
  readonly audioSha256?: string;
  readonly cache: KotuPitchBaselineCache | null;
  readonly durationMs: number;
  readonly option: PitchAccentPairOption;
  readonly pcmFingerprint?: string;
}): KotuPitchBaselineMatch {
  const entries = input.cache?.entries ?? [];

  if (entries.length === 0) {
    return { status: "unmatched" };
  }

  if (input.audioSha256) {
    const entry = entries.find(
      (candidate) => candidate.audioSha256 === input.audioSha256
    );

    if (entry) {
      return {
        entry,
        status: "matched",
        strategy: "audio-sha256"
      };
    }
  }

  if (input.pcmFingerprint) {
    const entry = entries.find(
      (candidate) => candidate.pcmFingerprint === input.pcmFingerprint
    );

    if (entry) {
      return {
        entry,
        status: "matched",
        strategy: "pcm-fingerprint"
      };
    }
  }

  const metadataCandidates = entries.filter((candidate) => {
    if (
      candidate.rawPronunciation &&
      candidate.rawPronunciation !== input.option.rawPronunciation
    ) {
      return false;
    }
    if (
      candidate.pitchAccent !== undefined &&
      candidate.pitchAccent !== input.option.pitchAccent
    ) {
      return false;
    }
    if (
      candidate.durationMs !== undefined &&
      Math.abs(candidate.durationMs - input.durationMs) > 80
    ) {
      return false;
    }

    return true;
  });

  if (metadataCandidates.length === 1) {
    return {
      entry: metadataCandidates[0]!,
      status: "matched",
      strategy: "metadata"
    };
  }
  if (metadataCandidates.length > 1) {
    return {
      candidates: metadataCandidates,
      status: "ambiguous",
      strategy: "metadata"
    };
  }

  return { status: "unmatched" };
}

function parseKotuRawPitchPayload(payload: unknown): readonly number[] {
  const values = Array.isArray(payload)
    ? payload
    : extractRawPitchArrayFromObject(payload);

  if (!values || values.length === 0) {
    throw new Error("Kotu raw-pitch payload did not include pitch values.");
  }

  return values.map((value) => {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new Error("Kotu raw-pitch payload includes an invalid value.");
    }

    return Number.parseFloat(value.toFixed(1));
  });
}

function extractRawPitchArrayFromObject(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as {
    readonly pitch?: unknown;
    readonly rawPitch?: unknown;
    readonly rawPitchValues?: unknown;
    readonly values?: unknown;
  };

  if (Array.isArray(candidate.rawPitchValues)) {
    return candidate.rawPitchValues;
  }
  if (Array.isArray(candidate.rawPitch)) {
    return candidate.rawPitch;
  }
  if (Array.isArray(candidate.pitch)) {
    return candidate.pitch;
  }
  if (Array.isArray(candidate.values)) {
    return candidate.values;
  }

  return null;
}
