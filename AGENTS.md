# AGENTS.md – Japanese Custom Study

Webapp privata, single-user, locale-first per studiare media giapponesi (anime,
videogiochi, TCG, visual novel) prima di fruirli. L'utente impara il vocabolario
e la grammatica contestuale di un media tramite textbook, glossary e review
Anki-like.

Lo sviluppo è **100% AI-driven**: l'utente non legge mai il codice manualmente.
Ogni sessione deve essere completamente autonoma e lasciare il repo in stato
valido (`pnpm check` verde, commit su `main`).

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
    glossary/       Portal glossary globale e stati di caricamento
    login/          Pagina di accesso locale
    media/          Route dinamiche per media, glossary locale, textbook, review e progress
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
    content/        Parser, validator e sync pipeline dei bundle Markdown
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
                    SOURCE OF TRUTH editoriale – non modificare mai questi file

drizzle/
  *.sql             Migration SQL auto-generate – non modificare mai questi file
  meta/             Snapshot e journal generati da Drizzle Kit

docs/
  blueprint-operativo.md  Architettura e vision del prodotto
  database.md             Design del DB e strategia di persistenza
  content-format.md       Specifica del formato Markdown (30KB)
  design/                 Token di design e UX
  legacy/                 Materiale storico e template del workflow editoriale precedente
  llm-kit/                Guide per integrazione LLM esterna
    general/              Template e regole riusabili cross-media
    media/                Brief e prompt specifici per singolo media
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

## Comandi canonici

```bash
pnpm dev             # avvia Next.js in sviluppo
pnpm build           # build di produzione Next.js
pnpm start           # avvia il build di produzione
pnpm start:e2e       # avvia il server app per Playwright
pnpm check           # lint + typecheck + test (gate veloce, sempre eseguire dopo modifiche)
pnpm release:check   # gate completo definito in scripts/release-check.sh
pnpm lint            # ESLint (zero warning tollerati)
pnpm format          # Prettier (auto-fix)
pnpm format:check    # verifica formattazione Prettier
pnpm typecheck       # tsc --noEmit
pnpm test            # solo Vitest
pnpm test:watch      # Vitest in watch mode
pnpm test:e2e:runner # esegue Playwright senza build preliminare
pnpm test:e2e        # solo Playwright (richiede build)
pnpm db:generate     # genera migration Drizzle da schema aggiornato
pnpm db:migrate      # applica migrazioni DB
pnpm db:backfill-review-subject-state # backfill stati review normalizzati
pnpm db:seed         # esegue seed DB
pnpm db:setup        # migra e popola il DB locale
pnpm db:studio       # apre Drizzle Studio
pnpm auth:hash-password # genera hash password per auth locale
pnpm content:test-stats # aggiorna fixture statistiche per bundle reali
pnpm content:import  # importa bundle media nel DB
pnpm content:validate # valida formato Markdown
pnpm pronunciations:fetch # scarica pronunce dai provider configurati
pnpm pronunciations:pending # aggiorna il backlog pronunce mancanti
pnpm pronunciations:reuse # riusa pronunce già presenti
pnpm pronunciations:forvo # esegue il fallback Forvo autenticato
pnpm pitch-accents:fetch # scarica dati di pitch accent
pnpm image:status    # mostra stato workflow immagini
pnpm image:apply     # applica blocchi immagine ai contenuti derivati
```

---

## Invarianti da non violare mai

1. `content/` è sola lettura – contiene i Markdown dei media. Non modificare.
2. `drizzle/` è gestito da `pnpm db:generate` – non editare SQL a mano.
3. Gli ID (`mediaSlug`, `lessonSlug`, `termId`, ecc.) sono stabili per design.
   Non rinominarli senza una migrazione DB.
4. `pnpm check` deve passare al termine di ogni sessione.
5. I test in `tests/` sono la rete di sicurezza – non eliminarli.
6. Il deploy è single-user locale-first: non aggiungere multi-tenancy o auth
   complessa senza una milestone dedicata.
