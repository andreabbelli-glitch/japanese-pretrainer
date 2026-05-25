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

export type FetchKotuPitchBaselineCacheForOptionsResult = {
  readonly cache: KotuPitchBaselineCache;
  readonly fetchedCount: number;
  readonly matchedCount: number;
  readonly scannedQuestionCount: number;
};

type KotuMinimalPairQuestionOption = {
  readonly phrases?: readonly {
    readonly rawPronunciation?: string;
  }[];
  readonly pitchAccent?: number;
  readonly pronunciationID?: string;
};

export async function fetchKotuRawPitchBaseline(input: {
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
  readonly pronunciationId: string;
}): Promise<KotuPitchBaselineCacheEntry> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const baseUrl = input.baseUrl ?? "https://api.kotu.io/v2";
  const endpoint = buildKotuApiUrl(
    baseUrl,
    `/languages/ja/analysis/audio/pronunciations/${encodeURIComponent(
      input.pronunciationId
    )}/raw-pitch`
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

export async function fetchKotuPitchBaselineCacheForOptions(input: {
  readonly baseUrl?: string;
  readonly cache: KotuPitchBaselineCache;
  readonly delayMs?: number;
  readonly fetchImpl?: typeof fetch;
  readonly options: readonly PitchAccentPairOption[];
  readonly scanLimit?: number;
  readonly seed?: number;
}): Promise<FetchKotuPitchBaselineCacheForOptionsResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const baseUrl = input.baseUrl ?? "https://api.kotu.io/v2";
  const scanLimit = input.scanLimit ?? 1_000;
  const seed = input.seed ?? 2_012_583_632;
  const delayMs = input.delayMs ?? 250;
  const entries = [...input.cache.entries];
  const requestedTargetCount = new Set(
    input.options
      .map((option) => buildKotuTargetKey(option))
      .filter((key): key is string => key !== null)
  ).size;
  const remainingTargets = buildRemainingKotuTargets(input.options, entries);
  let fetchedCount = 0;
  let scannedQuestionCount = 0;

  for (
    let index = 0;
    index < scanLimit && remainingTargets.size > 0;
    index += 1
  ) {
    if (index > 0 && delayMs > 0) {
      await delay(delayMs);
    }

    const question = await fetchKotuMinimalPairsQuestion({
      baseUrl,
      fetchImpl,
      index,
      seed
    });
    scannedQuestionCount += 1;

    for (const option of collectQuestionOptions(question)) {
      const targetKey = buildKotuTargetKey({
        pitchAccent: option.pitchAccent,
        rawPronunciation: option.phrases?.[0]?.rawPronunciation
      });

      if (targetKey === null || !option.pronunciationID) {
        continue;
      }

      const target = remainingTargets.get(targetKey);

      if (!target) {
        continue;
      }

      const fetched = await fetchKotuRawPitchBaseline({
        baseUrl,
        fetchImpl,
        pronunciationId: option.pronunciationID
      });

      entries.push({
        ...fetched,
        pitchAccent: target.pitchAccent,
        rawPronunciation: target.rawPronunciation
      });
      fetchedCount += 1;
      remainingTargets.delete(targetKey);
    }
  }

  return {
    cache: {
      entries: dedupeKotuPitchBaselineEntries(entries),
      version: 1
    },
    fetchedCount,
    matchedCount: requestedTargetCount - remainingTargets.size,
    scannedQuestionCount
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
      normalizeKotuRawPronunciation(candidate.rawPronunciation) !==
        normalizeKotuRawPronunciation(input.option.rawPronunciation)
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

export function dedupeKotuPitchBaselineEntries(
  entries: readonly KotuPitchBaselineCacheEntry[]
) {
  const byId = new Map<string, KotuPitchBaselineCacheEntry>();

  for (const entry of entries) {
    byId.set(entry.kotuPronunciationId, entry);
  }

  return [...byId.values()].sort((left, right) =>
    left.kotuPronunciationId.localeCompare(right.kotuPronunciationId)
  );
}

function buildRemainingKotuTargets(
  options: readonly PitchAccentPairOption[],
  entries: readonly KotuPitchBaselineCacheEntry[]
) {
  const existingKeys = new Set(
    entries
      .map((entry) =>
        buildKotuTargetKey({
          pitchAccent: entry.pitchAccent,
          rawPronunciation: entry.rawPronunciation
        })
      )
      .filter((key): key is string => key !== null)
  );
  const targets = new Map<
    string,
    { readonly pitchAccent: number; readonly rawPronunciation: string }
  >();

  for (const option of options) {
    const targetKey = buildKotuTargetKey(option);

    if (targetKey && !existingKeys.has(targetKey)) {
      targets.set(targetKey, {
        pitchAccent: option.pitchAccent,
        rawPronunciation: normalizeKotuRawPronunciation(option.rawPronunciation)
      });
    }
  }

  return targets;
}

async function fetchKotuMinimalPairsQuestion(input: {
  readonly baseUrl: string;
  readonly fetchImpl: typeof fetch;
  readonly index: number;
  readonly seed: number;
}) {
  const endpoint = buildKotuApiUrl(
    input.baseUrl,
    "/languages/ja/tests/pitchAccent/perception/minimalPairs/v1/questions/next"
  );
  const response = await input.fetchImpl(endpoint, {
    body: JSON.stringify({
      config: {
        ambiguousDevoicingEnabled: false,
        atamadakaEnabled: true,
        backgroundNoise: false,
        heibanEnabled: true,
        index: input.index,
        itemCount: "infinite",
        lowPassEnabled: false,
        onlyDevoicedWords: false,
        otherNakadakaEnabled: true,
        playAudioInline: false,
        secondMoraAccentEnabled: true,
        secondToLastMoraAccentEnabled: true,
        seed: input.seed
      }
    }),
    headers: {
      accept: "application/json",
      "content-type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(
      `Kotu questions/next request failed (${response.status} ${response.statusText}).`
    );
  }

  return (await response.json()) as unknown;
}

function collectQuestionOptions(question: unknown) {
  const options: KotuMinimalPairQuestionOption[] = [];
  const root = question as {
    readonly lookahead?: unknown;
    readonly prompt?: unknown;
  };

  for (const prompt of [root.prompt, readNestedPrompt(root.lookahead)]) {
    const promptOptions = readQuestionPromptOptions(prompt);

    if (promptOptions) {
      options.push(...promptOptions);
    }
  }

  return options;
}

function readNestedPrompt(value: unknown) {
  return (value as { readonly prompt?: unknown } | null)?.prompt;
}

function readQuestionPromptOptions(prompt: unknown) {
  return (
    prompt as {
      readonly standard?: {
        readonly audioChoice?: {
          readonly options?: readonly KotuMinimalPairQuestionOption[];
        };
      };
    } | null
  )?.standard?.audioChoice?.options;
}

function buildKotuTargetKey(input: {
  readonly pitchAccent?: number;
  readonly rawPronunciation?: string;
}) {
  if (input.rawPronunciation === undefined || input.pitchAccent === undefined) {
    return null;
  }

  return `${normalizeKotuRawPronunciation(input.rawPronunciation)}:${input.pitchAccent}`;
}

function normalizeKotuRawPronunciation(value: string) {
  return value
    .normalize("NFC")
    .replaceAll("カ゚", "ガ")
    .replaceAll("キ゚", "ギ")
    .replaceAll("ク゚", "グ")
    .replaceAll("ケ゚", "ゲ")
    .replaceAll("コ゚", "ゴ");
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function buildKotuApiUrl(baseUrl: string, path: string) {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  return new URL(path.replace(/^\/+/u, ""), normalizedBaseUrl);
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
