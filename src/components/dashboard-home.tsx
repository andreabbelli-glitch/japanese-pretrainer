import Link from "next/link";

import {
  activeMedia,
  foundationNotes,
  progressTracks,
  todaySession
} from "@/lib/site";

export function DashboardHome() {
  return (
    <div className="dashboard">
      <section className="hero-grid">
        <article className="panel panel--hero">
          <div className="eyebrow">Oggi sul tavolo</div>
          <div className="hero-copy">
            <p className="kicker">読む・拾う・定着させる</p>
            <h1>{todaySession.title}</h1>
            <p className="hero-summary">{todaySession.summary}</p>
            <p className="hero-resume">{todaySession.lesson}</p>
          </div>

          <div className="hero-actions">
            <Link className="button button--primary" href="/media">
              Riprendi studio
            </Link>
            <Link className="button button--ghost" href="/review">
              Apri review
            </Link>
          </div>

          <ul className="hero-metrics" aria-label="Metriche attuali">
            {todaySession.metrics.map((metric) => (
              <li key={metric}>{metric}</li>
            ))}
          </ul>
        </article>

        <aside className="panel panel--focus">
          <div className="eyebrow">Review di oggi</div>
          <h2>Una sola decisione sopra la piega</h2>
          <dl className="focus-stats">
            <div>
              <dt>Due</dt>
              <dd>{todaySession.review.due}</dd>
            </div>
            <div>
              <dt>Nuove</dt>
              <dd>{todaySession.review.fresh}</dd>
            </div>
            <div>
              <dt>Tempo stimato</dt>
              <dd>{todaySession.review.estimate}</dd>
            </div>
          </dl>
          <p className="panel-note">
            La shell espone la review come destinazione chiara senza simulare
            ancora il flusso SRS.
          </p>
        </aside>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <div className="eyebrow">Media attivi</div>
          <h2>Percorsi aperti, tono editoriale</h2>
        </div>

        <div className="media-grid">
          {activeMedia.map((item) => (
            <article key={item.title} className="panel media-card">
              <div className="media-card__top">
                <span className="chip">{item.type}</span>
                <span className="status-pill">{item.status}</span>
              </div>
              <h3>{item.title}</h3>
              <p className="media-card__step">{item.nextStep}</p>
              <p className="panel-note">{item.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="content-section content-section--split">
        <div className="panel">
          <div className="section-heading">
            <div className="eyebrow">Progressi calmi</div>
            <h2>Metriche orientative, non rumorose</h2>
          </div>

          <div className="progress-list">
            {progressTracks.map((track) => (
              <article key={track.label} className="progress-item">
                <div className="progress-item__header">
                  <div>
                    <h3>{track.label}</h3>
                    <p>{track.note}</p>
                  </div>
                  <strong>{track.value}</strong>
                </div>
                <div aria-hidden="true" className="progress-bar">
                  <span style={{ width: `${track.progress}%` }} />
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="panel panel--quiet">
          <div className="section-heading">
            <div className="eyebrow">Fondamenta pronte</div>
            <h2>Il bootstrap resta stretto di scope</h2>
          </div>

          <div className="notes-list">
            {foundationNotes.map((note) => (
              <article key={note.title} className="note-item">
                <h3>{note.title}</h3>
                <p>{note.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
