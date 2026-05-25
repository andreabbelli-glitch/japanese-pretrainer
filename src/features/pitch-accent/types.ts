export type PitchAccentPatternKey =
  | "pitch0"
  | "pitch1"
  | "pitch2"
  | "pitch3"
  | "pitch4";

export type PitchAccentPatternFilter = {
  readonly onlyDevoiced: boolean;
  readonly patternKeys: readonly PitchAccentPatternKey[];
  readonly strictPairFinding: boolean;
};

export type PitchAccentPairOption = {
  readonly accentedMora: number;
  readonly audioAttribution?: string;
  readonly audioLicense?: string;
  readonly audioMime?: string;
  readonly audioPageUrl?: string;
  readonly audioSha256?: string;
  readonly audioSrc: string;
  readonly byteLength?: number;
  readonly homophoneSource?: string;
  readonly id: string;
  readonly moraCount: number;
  readonly pitchAccent: number;
  readonly pitchAccentSource?: string;
  readonly rawPronunciation: string;
  readonly reading?: string;
  readonly silencedMoras: readonly number[];
  readonly sourceCorpus?: string;
  readonly surface?: string;
};

export type PitchAccentAudioPitchGraph = {
  readonly durationMs: number;
  readonly sampleIntervalMs: number;
  readonly values: readonly (number | null)[];
};

export type PitchAccentPitchGraphManifest = {
  readonly graphs: Readonly<Record<string, PitchAccentAudioPitchGraph>>;
  readonly version: 1;
};

export type PitchAccentMinimalPair = {
  readonly hasDevoiced: boolean;
  readonly id: string;
  readonly kana: string;
  readonly optionCount: number;
  readonly options: readonly PitchAccentPairOption[];
  readonly patternKeys: readonly PitchAccentPatternKey[];
};

export type PitchAccentMinimalPairsCorpus = {
  readonly pairs: readonly PitchAccentMinimalPair[];
  readonly source: {
    readonly importedAt: string;
    readonly license: string;
    readonly repository: string;
    readonly revision: string;
  };
  readonly version: 1;
};

export type PitchAccentSessionTrialPlan = {
  readonly correctOptionId: string;
  readonly correctPatternKey: PitchAccentPatternKey;
  readonly kana: string;
  readonly options: readonly PitchAccentPairOption[];
  readonly pairId: string;
  readonly sessionId: string;
  readonly sortOrder: number;
  readonly trialId: string;
};

export type PitchAccentSessionStatus = "active" | "completed" | "abandoned";

export type PitchAccentTrialStatus = "planned" | "answered" | "skipped";
