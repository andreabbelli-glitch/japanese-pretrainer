# AGENTS.md – Japanese Custom Study

Webapp privata, single-user, locale-first per studiare media giapponesi (anime,
videogiochi, TCG, visual novel) prima di fruirli. L'utente impara il vocabolario
e la grammatica contestuale di un media tramite textbook, glossary e review
Anki-like.

Lo sviluppo è **100% AI-driven**: l'utente non legge mai il codice manualmente.
Ogni sessione deve essere completamente autonoma e lasciare il repo in stato
valido. Per i comandi Node/pnpm, per gli agenti il percorso canonico è
`./scripts/with-node.sh pnpm ...`: come minimo `pnpm check` deve essere verde;
per modifiche a routing, DB, importer, auth, workflow contenuti o flussi utente
serve anche il gate completo `./scripts/with-node.sh pnpm release:check`.

---

## Stack

| Layer | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router) |
| Linguaggio | TypeScript 5 strict |
| Frontend | React 19, Server Components, Server Actions |
| Runtime | Node.js 22 |
| Database | SQLite locale / LibSQL Turso remoto |
| ORM | Drizzle ORM |
| SRS | ts-fsrs (FSRS algorithm) |
| Content | Markdown + YAML frontmatter, Unified/remark parser custom |
| Test unitari | Vitest |
| Test E2E | Playwright |
| Linter/Format | ESLint + Prettier |

---

## Mappa delle directory

```
src/
  app/              Route Next.js (App Router): pagine, layout globali e route handlers
    api/            Endpoint server-side per feature trasversali
      glossary/     API per ricerca e autocomplete del glossary
        autocomplete/ API JSON per suggerimenti autocomplete del glossary globale
      internal/     Endpoint interni per manutenzione e invalidazione cache contenuti
    glossary/       Portal glossary globale e stati di caricamento
    login/          Pagina di accesso locale
    media/          Route dinamiche per media, glossary locale, textbook, review e progress
      [mediaSlug]/assets/ Asset route catch-all per file statici del media bundle
    review/         Coda review cross-media
    settings/       Pagina impostazioni utente
  components/       Componenti React organizzati per feature area
    auth/           Form di login
    dashboard/      Homepage e widget overview
    layout/         Shell globale (header, nav, sidebar)
    media/          Pagine dettaglio media
    glossary/       Indice e ricerca glossary
    review/         Sessione di review (card, grading, coda)
    textbook/       Reader delle lesson
    settings/       Pagina impostazioni utente
    ui/             Primitivi UI condivisi (bottoni, badge, ecc.)
  actions/          Server Actions Next.js (mutazioni DB lato server)
  db/
    schema/         Tabelle Drizzle (un file per entità)
    queries/        Prepared query riutilizzabili
    client.ts       Singleton del client LibSQL/SQLite
    config.ts       Configurazione connessione DB
    seed.ts         Seeder dati iniziali
    migrate.ts      Runner migrazioni
  domain/           Logica di dominio pura, zero dipendenze framework
  lib/              Utility e helper condivisi tra app/ e scripts/
    content/        Utility per parser, validazione e sync dei bundle Markdown
      importer/     Pipeline di import e rendering dei bundle nel modello applicativo
      parser/       Parsing Markdown/frontmatter e normalizzazione blocchi strutturati
    site/           Navigazione, href e utility di stato per il routing UI
  types/            Tipi TypeScript globali e interfacce condivise
  styles/           CSS globale e variabili

scripts/            CLI standalone (non fanno parte del server Next.js)
  start-e2e.ts            Avvia il server per i test E2E
  import-content.ts       Importa bundle media nel DB
  validate-content.ts     Valida formato Markdown prima dell'import
  fetch-pronunciations.ts Scarica audio pronuncia (Forvo)
  fetch-forvo-pronunciations.ts Fallback Forvo da sessione browser autenticata
  fetch-pitch-accents.ts  Scarica dati accento tonale
  reuse-pronunciations.ts Riusa audio già presenti tra bundle compatibili
  update-pronunciation-pending.ts Aggiorna il manifest dei pronunciations mancanti
  update-real-bundle-test-stats.ts Aggiorna fixture statistiche per test real bundle
  image-workflow-status.ts Riassume stato richieste e asset immagine
  apply-image-blocks.ts    Applica blocchi immagine generati ai contenuti derivati
  db-migrate.ts           Esegue migrazioni DB
  db-backfill-review-subject-state.ts Normalizza stati review legacy
  db-seed.ts              Esegue seed DB
  hash-auth-password.ts   Genera hash password per auth locale
  release-check.sh        Esegue il gate completo di release
  tooling-doctor.sh       Diagnostica rapida dell'ambiente locale
  with-node.sh            Wrapper shell per eseguire comandi con la versione Node del repo

tests/
  *.test.ts         Test Vitest (unit + integration)
  e2e/              Test Playwright end-to-end
    helpers/        Utility E2E condivise
  fixtures/         Dati statici per i test
    content/        Bundle validi e invalidi per parser/importer
  helpers/          Utility condivise dai test

content/
  media/<slug>/     Bundle media: Markdown + asset
    assets/         Asset statici associati al bundle del media
    pronunciations.json Manifest opzionale audio/pitch accent del media
    cards/          Sorgenti editoriali per card e dati derivati del media
    textbook/       Lesson Markdown e contenuti del textbook del media
    workflow/       File operativi e sidecar del workflow editoriale/produzione
                    Area protetta: modificarli solo tramite workflow/script
                    canonici o task editoriale esplicito

drizzle/
  *.sql             Migration SQL auto-generate – non modificare mai questi file
  meta/             Snapshot e journal generati da Drizzle Kit

docs/
  blueprint-operativo.md  Architettura e vision del prodotto
  database.md             Design del DB e strategia di persistenza
  content-format.md       Specifica del formato Markdown (30KB)
  design/                 Token di design e UX
  legacy/                 Materiale storico e template del workflow editoriale precedente
    content-briefs/       Brief editoriali legacy per bundle specifici
    prompts/              Prompt legacy usati nel workflow editoriale
    templates/            Template legacy per media, lesson, card e workflow immagini
  llm-kit/                Guide per integrazione LLM esterna
    general/              Template e regole riusabili cross-media
    media/                Brief e prompt specifici per singolo media
      <slug>/             Cartelle per-media con brief e prompt batchizzati
  tasks/                  Task definition per sessioni agente
```

---

## Entità core del DB

`media` → `segment` → `lesson` → contenuto Markdown renderizzato
`term` / `grammar_pattern` → `card` → `review_subject_state` / `review_subject_log`
`glossary_terms` / `glossary_grammar` → indice ricercabile cross-media
`lesson_progress` → avanzamento textbook per media
`user_setting` → preferenze utente (furigana mode, ecc.)

---

## Invarianti di prodotto

- `/review` è la review globale reale: dedup cross-media e daily limit globale.
- `/media/[mediaSlug]/review` è un filtro verticale locale sullo stesso sistema,
  non un launcher verso un altro media.
- Dashboard e CTA globali devono mostrare numeri globali reali; le superfici del
  media possono mostrare numeri locali solo se etichettati chiaramente come tali.
- Le CTA di resume textbook (`Continua il percorso` o equivalenti) puntano al
  primo step non completato del percorso, non semplicemente all'ultima lesson
  visitata o `in_progress`.

---

## Comandi canonici

```bash
./scripts/with-node.sh pnpm dev             # avvia Next.js in sviluppo
./scripts/with-node.sh pnpm build           # build di produzione Next.js
./scripts/with-node.sh pnpm start           # avvia il build di produzione
./scripts/with-node.sh pnpm start:e2e       # avvia il server app per Playwright
./scripts/with-node.sh pnpm check           # lint + typecheck + test (gate veloce minimo)
./scripts/with-node.sh pnpm release:check   # gate completo definito in scripts/release-check.sh
./scripts/with-node.sh pnpm lint            # ESLint (zero warning tollerati)
./scripts/with-node.sh pnpm format          # Prettier (auto-fix)
./scripts/with-node.sh pnpm format:check    # verifica formattazione Prettier
./scripts/with-node.sh pnpm typecheck       # tsc --noEmit
./scripts/with-node.sh pnpm test            # solo Vitest
./scripts/with-node.sh pnpm test:watch      # Vitest in watch mode
./scripts/with-node.sh pnpm test:e2e:runner # esegue Playwright senza build preliminare
./scripts/with-node.sh pnpm test:e2e        # solo Playwright (richiede build)
./scripts/with-node.sh pnpm db:generate     # genera migration Drizzle da schema aggiornato
./scripts/with-node.sh pnpm db:migrate      # applica migrazioni DB
./scripts/with-node.sh pnpm db:backfill-review-subject-state # backfill stati review normalizzati
./scripts/with-node.sh pnpm db:seed         # esegue seed DB
./scripts/with-node.sh pnpm db:setup        # migra e popola il DB locale
./scripts/with-node.sh pnpm db:studio       # apre Drizzle Studio
./scripts/with-node.sh pnpm auth:hash-password # genera hash password per auth locale
./scripts/with-node.sh pnpm content:test-stats # aggiorna fixture statistiche per bundle reali
./scripts/with-node.sh pnpm content:import  # importa bundle media nel DB
./scripts/with-node.sh pnpm content:validate # valida formato Markdown
./scripts/with-node.sh pnpm pronunciations:fetch # scarica pronunce dai provider configurati
./scripts/with-node.sh pnpm pronunciations:pending # aggiorna il backlog pronunce mancanti
./scripts/with-node.sh pnpm pronunciations:reuse # riusa pronunce già presenti
./scripts/with-node.sh pnpm pronunciations:forvo # esegue il fallback Forvo autenticato
./scripts/with-node.sh pnpm pitch-accents:fetch # scarica dati di pitch accent
./scripts/with-node.sh pnpm image:status    # mostra stato workflow immagini
./scripts/with-node.sh pnpm image:apply     # applica blocchi immagine ai contenuti derivati
```

---

## Verifiche richieste

- Sempre: eseguire almeno `./scripts/with-node.sh pnpm check` dopo modifiche al
  codice o alla logica.
- Eseguire anche `./scripts/with-node.sh pnpm release:check` quando la modifica
  tocca routing, DB, importer/sync contenuti, auth, cache revalidation,
  workflow contenuti o superfici utente coperte da E2E.
- Se una verifica non è eseguibile, dichiararlo esplicitamente nel riepilogo
  finale e spiegare il motivo.

---

## Invarianti da non violare mai

1. `content/` va trattato come read-only per task applicativi, bugfix e
   refactor. Fanno eccezione solo task editoriali/asset/pronunce esplicitamente
   richiesti e i workflow canonici del repo (`image:apply`,
   `pronunciations:*`), limitatamente ai file previsti dal workflow.
2. `content/media/**/workflow/**` è area protetta: niente edit manuali
   arbitrari. Modificarla solo se il task lo richiede esplicitamente o tramite
   script/workflow canonici che la aggiornano.
3. `drizzle/` è gestito da `pnpm db:generate` – non editare SQL a mano.
4. Gli ID (`mediaSlug`, `lessonSlug`, `termId`, ecc.) sono stabili per design.
   Non rinominarli senza una migrazione DB.
5. `./scripts/with-node.sh pnpm check` deve passare al termine di ogni sessione;
   per le aree a maggior impatto vale anche il gate `release:check`.
6. I test in `tests/` sono la rete di sicurezza – non eliminarli.
7. Il deploy è single-user locale-first: non aggiungere multi-tenancy o auth
   complessa senza una milestone dedicata.
8. Se cambi comportamento, setup locale, variabili ambiente, flussi QA o
   workflow contenuti, aggiorna nella stessa modifica la documentazione
   pertinente: almeno `README.md`, `docs/local-verification-notes.md`,
   `docs/qa-manual-checklist.md`, `docs/dev-tooling.md`,
   `docs/pronunciation-workflow.md`, `docs/forvo-pronunciation-fetch.md` e
   `.env.example` secondo impatto reale.
