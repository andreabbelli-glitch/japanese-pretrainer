const PROMPT_FIT_MAX_CQI = 20;
const PROMPT_FIT_TARGET_CQI = 88;

export function getKatakanaSpeedPromptFitSize(prompt: string) {
  const visibleUnits = Math.max(1, Array.from(prompt.trim()).length);
  const fitSize = Math.min(
    PROMPT_FIT_MAX_CQI,
    PROMPT_FIT_TARGET_CQI / visibleUnits
  );

  return `${Number(fitSize.toFixed(3))}cqi`;
}
