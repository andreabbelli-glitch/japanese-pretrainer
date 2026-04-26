const PSEUDO_FRAMES = [
  "{chunk}トール",
  "{chunk}リック",
  "ア{chunk}ール",
  "メ{chunk}ラン",
  "コ{chunk}ット",
  "ラ{chunk}ス",
  "{chunk}ミア",
  "オ{chunk}レス"
] as const;

export function generateKatakanaSpeedPseudoWord(input: {
  chunk: string;
  seed: number | string;
}): string {
  const seed =
    typeof input.seed === "number"
      ? input.seed
      : hashString(`${input.chunk}:${input.seed}`);
  const frame = PSEUDO_FRAMES[positiveModulo(seed, PSEUDO_FRAMES.length)];

  return frame.replace("{chunk}", input.chunk);
}

export function generateKatakanaSpeedPseudoWords(input: {
  chunk: string;
  count: number;
  seed: number | string;
}): string[] {
  return Array.from({ length: Math.max(0, input.count) }, (_, index) =>
    generateKatakanaSpeedPseudoWord({
      chunk: input.chunk,
      seed: `${input.seed}:${index}`
    })
  );
}

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
