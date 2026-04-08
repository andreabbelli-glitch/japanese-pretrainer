import type { StudySettings } from "@/lib/settings";
import { kanjiClashManualDefaultSizeOptions } from "@/lib/settings";

import { SurfaceCard } from "../ui/surface-card";

type KanjiClashSettingsPanelProps = {
  settings: Pick<
    StudySettings,
    | "kanjiClashDailyNewLimit"
    | "kanjiClashDefaultScope"
    | "kanjiClashManualDefaultSize"
  >;
};

const dailyNewLimitOptions = [0, 1, 3, 5, 10, 20] as const;
const scopeOptions = [
  {
    description:
      "Parte sempre dalla vista globale. Se vuoi restringere, lo farai poi nella sessione.",
    label: "Globale",
    value: "global"
  },
  {
    description:
      "Prova a partire dal media attivo; se manca un media esplicito il runtime torna a globale.",
    label: "Media",
    value: "media"
  }
] as const;

export function KanjiClashSettingsPanel({
  settings
}: KanjiClashSettingsPanelProps) {
  return (
    <SurfaceCard className="settings-panel">
      <div className="settings-panel__header">
        <div>
          <p className="eyebrow">Kanji Clash</p>
          <h3 className="settings-panel__title">Default di sessione</h3>
        </div>
        <p className="settings-panel__body">
          Impostazioni separate per la modalità di confronto. Lo scope media
          torna automaticamente a globale se non c&apos;è un media esplicito nel
          contesto.
        </p>
      </div>

      <label className="settings-field">
        <span className="settings-field__label">Nuove coppie al giorno</span>
        <select
          className="settings-field__control"
          defaultValue={String(settings.kanjiClashDailyNewLimit)}
          name="kanjiClashDailyNewLimit"
        >
          {dailyNewLimitOptions.map((value) => (
            <option key={value} value={value}>
              {value} coppie
            </option>
          ))}
        </select>
      </label>

      <label className="settings-field">
        <span className="settings-field__label">
          Dimensione predefinita drill manuale
        </span>
        <select
          className="settings-field__control"
          defaultValue={String(settings.kanjiClashManualDefaultSize)}
          name="kanjiClashManualDefaultSize"
        >
          {kanjiClashManualDefaultSizeOptions.map((value) => (
            <option key={value} value={value}>
              {value} round
            </option>
          ))}
        </select>
      </label>

      <div className="settings-choice-grid settings-choice-grid--compact">
        {scopeOptions.map((option) => (
          <label key={option.value} className="settings-choice-card">
            <input
              defaultChecked={settings.kanjiClashDefaultScope === option.value}
              name="kanjiClashDefaultScope"
              type="radio"
              value={option.value}
            />
            <span className="settings-choice-card__title">{option.label}</span>
            <span className="settings-choice-card__body">
              {option.description}
            </span>
          </label>
        ))}
      </div>
    </SurfaceCard>
  );
}
