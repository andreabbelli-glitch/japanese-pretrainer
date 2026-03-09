import { saveStudySettingsAction } from "@/actions/settings";
import type { StudySettings } from "@/lib/settings";

import { StickyPageHeader } from "../layout/sticky-page-header";
import { Section } from "../ui/section";
import { SurfaceCard } from "../ui/surface-card";

type SettingsPageProps = {
  saved: boolean;
  settings: StudySettings;
};

const furiganaOptions = [
  {
    description: "Mostra sempre la lettura nel reader.",
    label: "Sempre visibili",
    value: "on"
  },
  {
    description: "Nasconde del tutto il ruby per leggere più pulito.",
    label: "Nascoste",
    value: "off"
  },
  {
    description: "Le mostra al bisogno nel reader e resta la modalità più sobria.",
    label: "Su richiesta",
    value: "hover"
  }
] as const;

const glossarySortOptions = [
  {
    description: "Segue il percorso del media e resta vicina all’ordine di studio.",
    label: "Ordine percorso",
    value: "lesson_order"
  },
  {
    description: "Ordina il glossary per forma giapponese in modo più consultivo.",
    label: "Alfabetico",
    value: "alphabetical"
  }
] as const;

const reviewLimitOptions = [10, 20, 30, 40, 60] as const;

export function SettingsPage({ saved, settings }: SettingsPageProps) {
  return (
    <div className="settings-page">
      <StickyPageHeader
        eyebrow="Settings"
        title="Preferenze di studio"
        summary="Poche decisioni persistenti, con effetti reali su reader, glossary e review."
        meta={
          <>
            <span>Locale-first</span>
            <span>Single-user</span>
            <span>Persistenza su DB</span>
          </>
        }
      />

      <section className="hero-grid hero-grid--detail">
        <SurfaceCard className="settings-hero" variant="hero">
          <p className="eyebrow">Esperienza quotidiana</p>
          <h2 className="settings-hero__title">
            Mantieni lo studio leggibile, coerente e facile da riprendere.
          </h2>
          <p className="settings-hero__summary">
            Le preferenze qui sotto non restano nel client: aggiornano `user_setting`
            e si riflettono davvero sulle schermate di studio già presenti.
          </p>
          <div className="settings-hero__chips">
            <span className="chip">Furigana: {settings.furiganaMode}</span>
            <span className="chip">Review nuove: {settings.reviewDailyLimit}</span>
            <span className="chip">
              Glossary:{" "}
              {settings.glossaryDefaultSort === "lesson_order"
                ? "ordine percorso"
                : "alfabetico"}
            </span>
          </div>
          {saved ? (
            <p className="settings-notice" role="status">
              Preferenze salvate. Le viste di studio useranno subito i nuovi valori.
            </p>
          ) : null}
        </SurfaceCard>

        <SurfaceCard className="settings-side">
          <p className="eyebrow">Impatto reale</p>
          <div className="stack-list stack-list--tight">
            <div className="summary-row">
              <span>Reader</span>
              <strong>Furigana persistenti</strong>
            </div>
            <div className="summary-row">
              <span>Glossary</span>
              <strong>Ordine predefinito</strong>
            </div>
            <div className="summary-row">
              <span>Review</span>
              <strong>Limite nuove giornaliere</strong>
            </div>
          </div>
        </SurfaceCard>
      </section>

      <Section
        eyebrow="Preferenze"
        title="Controlli sobri, ma operativi"
        description="Ogni gruppo modifica una parte già esistente dell’app, senza introdurre pannelli tecnici o stati finti."
      >
        <form action={saveStudySettingsAction} className="settings-form">
          <SurfaceCard className="settings-panel">
            <div className="settings-panel__header">
              <div>
                <p className="eyebrow">Reader</p>
                <h3 className="settings-panel__title">Furigana</h3>
              </div>
              <p className="settings-panel__body">
                Vale per il textbook index e per il reader lesson.
              </p>
            </div>
            <div className="settings-choice-grid">
              {furiganaOptions.map((option) => (
                <label key={option.value} className="settings-choice-card">
                  <input
                    defaultChecked={settings.furiganaMode === option.value}
                    name="furiganaMode"
                    type="radio"
                    value={option.value}
                  />
                  <span className="settings-choice-card__title">{option.label}</span>
                  <span className="settings-choice-card__body">{option.description}</span>
                </label>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard className="settings-panel">
            <div className="settings-panel__header">
              <div>
                <p className="eyebrow">Review</p>
                <h3 className="settings-panel__title">Nuove card al giorno</h3>
              </div>
              <p className="settings-panel__body">
                La review usa questo valore per decidere quante nuove card entrano
                nella coda quotidiana dopo le dovute.
              </p>
            </div>
            <label className="settings-field">
              <span className="settings-field__label">Limite giornaliero</span>
              <select
                className="settings-field__control"
                defaultValue={String(settings.reviewDailyLimit)}
                name="reviewDailyLimit"
              >
                {reviewLimitOptions.map((value) => (
                  <option key={value} value={value}>
                    {value} nuove
                  </option>
                ))}
              </select>
            </label>
          </SurfaceCard>

          <SurfaceCard className="settings-panel">
            <div className="settings-panel__header">
              <div>
                <p className="eyebrow">Glossary</p>
                <h3 className="settings-panel__title">Ordine predefinito</h3>
              </div>
              <p className="settings-panel__body">
                Resta un’impostazione essenziale: cambia l’ordine iniziale del glossary,
                ma lascia invariata la qualità del ranking quando stai cercando qualcosa.
              </p>
            </div>
            <div className="settings-choice-grid settings-choice-grid--compact">
              {glossarySortOptions.map((option) => (
                <label key={option.value} className="settings-choice-card">
                  <input
                    defaultChecked={settings.glossaryDefaultSort === option.value}
                    name="glossaryDefaultSort"
                    type="radio"
                    value={option.value}
                  />
                  <span className="settings-choice-card__title">{option.label}</span>
                  <span className="settings-choice-card__body">{option.description}</span>
                </label>
              ))}
            </div>
          </SurfaceCard>

          <div className="settings-form__footer">
            <button className="button button--primary" type="submit">
              Salva preferenze
            </button>
          </div>
        </form>
      </Section>
    </div>
  );
}
