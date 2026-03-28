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
| Database | SQLite locale / LibSQL Turso remoto |
| ORM | Drizzle ORM |
| SRS | ts-fsrs (FSRS algorithm) |
| Content | Markdown + YAML frontmatter, plugin remark custom |
| Test unitari | Vitest |
| Test E2E | Playwright |
| Linter/Format | ESLint + Prettier |

---

## Mappa delle directory

```
src/
  app/              Route Next.js (App Router): pages + API route handlers
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
  types/            Tipi TypeScript globali e interfacce condivise
  styles/           CSS globale e variabili

scripts/            CLI standalone (non fanno parte del server Next.js)
  import-content.ts       Importa bundle media nel DB
  validate-content.ts     Valida formato Markdown prima dell'import
  fetch-pronunciations.ts Scarica audio pronuncia (Forvo)
  fetch-pitch-accents.ts  Scarica dati accento tonale
  db-migrate.ts           Esegue migrazioni DB
  db-seed.ts              Esegue seed DB

tests/
  *.test.ts         Test Vitest (unit + integration)
  e2e/              Test Playwright end-to-end
  fixtures/         Dati statici per i test
  helpers/          Utility condivise dai test

content/
  media/<slug>/     Bundle media: Markdown + asset
                    SOURCE OF TRUTH editoriale – non modificare mai questi file

drizzle/
  *.sql             Migration SQL auto-generate – non modificare mai questi file

docs/
  blueprint-operativo.md  Architettura e vision del prodotto
  database.md             Design del DB e strategia di persistenza
  content-format.md       Specifica del formato Markdown (30KB)
  design/                 Token di design e UX
  llm-kit/                Guide per integrazione LLM esterna
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
pnpm check           # lint + typecheck + test (gate veloce, sempre eseguire dopo modifiche)
pnpm release:check   # gate completo: lint + typecheck + test + build + content:validate + E2E
pnpm test            # solo Vitest
pnpm test:e2e        # solo Playwright (richiede build)
pnpm lint            # ESLint (zero warning tollerati)
pnpm typecheck       # tsc --noEmit
pnpm format          # Prettier (auto-fix)
pnpm db:migrate      # applica migrazioni DB
pnpm content:import  # importa bundle media nel DB
pnpm content:validate # valida formato Markdown
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
