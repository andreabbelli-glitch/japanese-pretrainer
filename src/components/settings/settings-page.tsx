import { logoutAction } from "@/actions/auth";
import { saveStudySettingsAction } from "@/actions/settings";
import type { Route } from "next";
import Link from "next/link";
import { isAuthEnabled } from "@/features/auth/server";
import type {
  FsrsOptimizerStatus,
  FsrsReschedulePreview
} from "@/features/fsrs-optimizer/server";
import type { StudySettings } from "@/features/settings/server";
import { resolveReturnToContext, resolveReturnToLabel } from "@/features/navigation";

import { StickyPageHeader } from "../layout/sticky-page-header";
import { Section } from "../ui/section";
import { SurfaceCard } from "../ui/surface-card";
import {
  FsrsManualReschedulePanel,
  type FsrsRescheduleStatus
} from "./fsrs-manual-reschedule-panel";
import { FsrsOptimizerStatusPanel } from "./fsrs-optimizer-status-panel";
import { KanjiClashSettingsPanel } from "./kanji-clash-settings-panel";
import { SaveSettingsButton } from "./save-settings-button";

type SettingsPageProps = {
  fsrsOptimizerStatus: FsrsOptimizerStatus;
  fsrsReschedulePreview: FsrsReschedulePreview;
  fsrsRescheduleStatus?: FsrsRescheduleStatus | null;
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

const reviewAutoplayAudioOptions = [
  {
    description:
      "Quando riveli una card con pronuncia, prova a far partire subito l'audio.",
    label: "Riproduci subito",
    value: "true"
  },
  {
    description:
      "Lascia l'audio manuale: userai il player della card quando ti serve.",
    label: "Solo manuale",
    value: "false"
  }
] as const;

const reviewLimitOptions = [10, 20, 30, 40, 60] as const;

export function SettingsPage({
  fsrsOptimizerStatus,
  fsrsReschedulePreview,
  fsrsRescheduleStatus,
  returnTo,
  saved,
  settings
}: SettingsPageProps) {
  const returnContext = resolveReturnToContext(returnTo);
  const backLabel = resolveReturnToLabel(returnContext);
  const showAccountSettings = isAuthEnabled();
  const displayedReviewLimitOptions = buildReviewLimitOptions(
    settings.reviewDailyLimit
  );

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
        description="Cinque controlli, effetto immediato."
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
                <h3 className="settings-panel__title">Audio alla risposta</h3>
              </div>
              <p className="settings-panel__body">
                Decide se la review prova a riprodurre la pronuncia appena
                riveli il retro della card.
              </p>
            </div>
            <div className="settings-choice-grid settings-choice-grid--compact">
              {reviewAutoplayAudioOptions.map((option) => (
                <label key={option.value} className="settings-choice-card">
                  <input
                    defaultChecked={
                      settings.reviewAutoplayAudioOnReveal ===
                      (option.value === "true")
                    }
                    name="reviewAutoplayAudioOnReveal"
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
                {displayedReviewLimitOptions.map((value) => (
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

          <div className="settings-form__footer">
            <SaveSettingsButton />
          </div>
        </form>
      </Section>

      <Section
        eyebrow="Review"
        title="FSRS"
        description="Stato optimizer e riallineamento manuale del calendario."
      >
        <div className="settings-form">
          <FsrsOptimizerStatusPanel status={fsrsOptimizerStatus} />
          <FsrsManualReschedulePanel
            preview={fsrsReschedulePreview}
            returnTo={returnTo}
            status={fsrsRescheduleStatus}
          />
        </div>
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

function buildReviewLimitOptions(currentLimit: number) {
  const options = new Set<number>(reviewLimitOptions);

  options.add(currentLimit);

  return [...options].sort((left, right) => left - right);
}
