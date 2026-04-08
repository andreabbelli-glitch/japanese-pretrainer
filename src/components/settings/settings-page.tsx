import { logoutAction } from "@/actions/auth";
import { saveStudySettingsAction } from "@/actions/settings";
import type { Route } from "next";
import Link from "next/link";
import { isAuthEnabled } from "@/lib/auth";
import type { FsrsOptimizerStatus } from "@/lib/fsrs-optimizer";
import type { StudySettings } from "@/lib/settings";
import { resolveReturnToContext, resolveReturnToLabel } from "@/lib/site";

import { StickyPageHeader } from "../layout/sticky-page-header";
import { Section } from "../ui/section";
import { SurfaceCard } from "../ui/surface-card";
import { FsrsOptimizerStatusPanel } from "./fsrs-optimizer-status-panel";
import { KanjiClashSettingsPanel } from "./kanji-clash-settings-panel";
import { SaveSettingsButton } from "./save-settings-button";

type SettingsPageProps = {
  fsrsOptimizerStatus: FsrsOptimizerStatus;
  returnTo?: Route | null;
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
    description: "Le mostra solo quando servono, per una lettura più pulita.",
    label: "Su richiesta",
    value: "hover"
  }
] as const;

const glossarySortOptions = [
  {
    description:
      "Segue il percorso del media e resta vicina all’ordine di studio.",
    label: "Ordine percorso",
    value: "lesson_order"
  },
  {
    description:
      "Ordina il glossary per forma giapponese in modo più consultivo.",
    label: "Alfabetico",
    value: "alphabetical"
  }
] as const;

const reviewFrontFuriganaOptions = [
  {
    description:
      "Mostra subito il furigana sopra il fronte della card durante la review.",
    label: "Visibile subito",
    value: "true"
  },
  {
    description:
      "Lascia il fronte senza ruby finche non riveli la risposta della card.",
    label: "Solo dopo risposta",
    value: "false"
  }
] as const;

const reviewLimitOptions = [10, 20, 30, 40, 60] as const;

export function SettingsPage({
  fsrsOptimizerStatus,
  returnTo,
  saved,
  settings
}: SettingsPageProps) {
  const returnContext = resolveReturnToContext(returnTo);
  const backLabel = resolveReturnToLabel(returnContext);
  const showAccountSettings = isAuthEnabled();

  return (
    <div className="settings-page">
      <StickyPageHeader
        backHref={returnContext?.href}
        backLabel={backLabel ?? undefined}
        eyebrow="Settings"
        title="Preferenze di studio"
        summary="Si applicano subito a reader, Glossary e Review."
        actions={
          returnContext && backLabel ? (
            <Link className="button button--ghost" href={returnContext.href}>
              {backLabel}
            </Link>
          ) : null
        }
      />

      <Section
        eyebrow="Preferenze"
        title="Impostazioni"
        description="Quattro controlli, effetto immediato."
      >
        <form action={saveStudySettingsAction} className="settings-form">
          {returnTo ? (
            <input name="returnTo" type="hidden" value={returnTo} />
          ) : null}
          {saved ? (
            <p className="settings-notice" role="status">
              Preferenze salvate.
            </p>
          ) : null}
          <SurfaceCard className="settings-panel">
            <div className="settings-panel__header">
              <div>
                <p className="eyebrow">Reader</p>
                <h3 className="settings-panel__title">Furigana</h3>
              </div>
              <p className="settings-panel__body">
                Vale per l&apos;indice del Textbook e per il reader delle
                lesson.
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
                  <span className="settings-choice-card__title">
                    {option.label}
                  </span>
                  <span className="settings-choice-card__body">
                    {option.description}
                  </span>
                </label>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard className="settings-panel">
            <div className="settings-panel__header">
              <div>
                <p className="eyebrow">Review</p>
                <h3 className="settings-panel__title">Furigana sul fronte</h3>
              </div>
              <p className="settings-panel__body">
                Decide se la review mostra subito la lettura sopra la card o
                solo dopo aver rivelato la risposta.
              </p>
            </div>
            <div className="settings-choice-grid settings-choice-grid--compact">
              {reviewFrontFuriganaOptions.map((option) => (
                <label key={option.value} className="settings-choice-card">
                  <input
                    defaultChecked={
                      settings.reviewFrontFurigana === (option.value === "true")
                    }
                    name="reviewFrontFurigana"
                    type="radio"
                    value={option.value}
                  />
                  <span className="settings-choice-card__title">
                    {option.label}
                  </span>
                  <span className="settings-choice-card__body">
                    {option.description}
                  </span>
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
                La review usa questo valore per decidere quante nuove card
                entrano nella coda quotidiana dopo le card da ripassare.
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

          <KanjiClashSettingsPanel settings={settings} />

          <SurfaceCard className="settings-panel">
            <div className="settings-panel__header">
              <div>
                <p className="eyebrow">Glossary</p>
                <h3 className="settings-panel__title">Ordine predefinito</h3>
              </div>
              <p className="settings-panel__body">
                Cambia l’ordine iniziale del Glossary, ma lascia invariata la
                qualità del ranking quando stai cercando qualcosa.
              </p>
            </div>
            <div className="settings-choice-grid settings-choice-grid--compact">
              {glossarySortOptions.map((option) => (
                <label key={option.value} className="settings-choice-card">
                  <input
                    defaultChecked={
                      settings.glossaryDefaultSort === option.value
                    }
                    name="glossaryDefaultSort"
                    type="radio"
                    value={option.value}
                  />
                  <span className="settings-choice-card__title">
                    {option.label}
                  </span>
                  <span className="settings-choice-card__body">
                    {option.description}
                  </span>
                </label>
              ))}
            </div>
          </SurfaceCard>

          <FsrsOptimizerStatusPanel status={fsrsOptimizerStatus} />

          <div className="settings-form__footer">
            <SaveSettingsButton />
          </div>
        </form>
      </Section>

      {showAccountSettings ? (
        <Section
          eyebrow="Account"
          title="Sessione"
          description="Opzioni usate raramente, tenute qui in fondo."
        >
          <SurfaceCard className="settings-panel" variant="quiet">
            <div className="settings-panel__header">
              <div>
                <p className="eyebrow">Accesso</p>
                <h3 className="settings-panel__title">
                  Esci dall&apos;account
                </h3>
              </div>
              <p className="settings-panel__body">
                Chiude la sessione corrente e ti riporta alla schermata di
                login.
              </p>
            </div>
            <div className="settings-form__footer">
              <form action={logoutAction}>
                <button
                  className="button button--ghost button--danger"
                  type="submit"
                >
                  Esci
                </button>
              </form>
            </div>
          </SurfaceCard>
        </Section>
      ) : null}
    </div>
  );
}
