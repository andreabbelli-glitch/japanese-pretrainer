# AGENTS.md - Japanese Custom Study

Webapp privata, single-user, locale-first per studiare media giapponesi
(anime, videogiochi, TCG, visual novel) prima di fruirli. L'utente impara
vocabolario e grammatica contestuale tramite textbook, glossary e review
Anki-like.

Lo sviluppo e' **100% AI-driven**: l'utente non legge mai il codice
manualmente. Ogni sessione deve essere autonoma, completa e lasciare il repo in
stato valido.

Orientamento rapido per agenti: [`docs/agent-orientation.md`](docs/agent-orientation.md)
e' generato da `./scripts/with-node.sh pnpm docs:agent-orientation` e va usato
come classificatore iniziale dei task.

---

## Regole operative non negoziabili

1. Usa sempre il wrapper canonico per comandi Node/pnpm:
   `./scripts/with-node.sh pnpm ...`.
2. Dopo modifiche a codice o logica applicativa, `./scripts/with-node.sh pnpm check`
   deve passare.
3. Esegui anche `./scripts/with-node.sh pnpm release:check` quando tocchi routing,
   DB, importer/sync contenuti, auth, cache revalidation o superfici utente
   coperte da E2E.
4. Per task editoriali/content-only gestiti da skill repo-scoped in
   `.agents/skills/*`, segui la sezione `Verification` della skill invece dei
   gate completi: deve usare solo validazioni/import/test mirati al media o al
   workflow toccato.
5. Minimizza sempre lo scope di `content:import`: usa l'import lesson-scoped
   con `--media-slug <media-slug> --lesson-slug <lesson-slug>` ogni volta che le
   lesson toccate sono note. Ripeti `--lesson-slug` per piu lesson dello stesso
   media. Usa import media-scoped o full solo quando il cambio e' davvero
   media-wide, richiede archive/prune fuori dalle lesson note, oppure e' un setup
   o recovery intenzionale.
6. Se una verifica richiesta non e' eseguibile, dichiaralo nel riepilogo finale
   con il motivo concreto.
7. Non eliminare test in `tests/`.
8. Non introdurre multi-tenancy o auth complessa: il prodotto resta single-user
   locale-first salvo milestone dedicata.
9. Per contenuti, inventari flashcard, glossary e decisioni editoriali, la
   source of truth e' sempre `content/media/**` validato. Il DB SQLite locale
   sotto `data/` e' una cache/runtime disposable di sviluppo: puo' essere stale,
   parziale o contenere residui/fixture, quindi non usarlo come autorita'
   editoriale salvo dopo un import intenzionale dello scope rilevante.

---

## Aree protette

| Area                           | Regola                                                                                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `content/`                     | Read-only per task applicativi, bugfix e refactor. Modificabile solo per task editoriali/asset/pronunce espliciti o tramite workflow canonici. |
| `content/media/**/workflow/**` | Area protetta: niente edit manuali arbitrari. Modificare solo se il task lo richiede esplicitamente o tramite script/workflow canonici.        |
| `drizzle/`                     | Gestito da `pnpm db:generate`; non editare SQL o snapshot a mano.                                                                              |
| ID stabili                     | Non rinominare `mediaSlug`, `lessonSlug`, `termId` o equivalenti senza migrazione DB.                                                          |

Workflow canonici autorizzati su contenuti quando pertinenti:
`image:apply`, `pronunciations:*`, `pitch-accents:fetch`, `content:validate`,
`content:import`. Per `content:import`, parti sempre dallo scope minimo
sufficiente: lesson-scoped quando possibile, poi media-scoped, full solo se
necessario.

---

## Matrice verifiche

| Tipo modifica                                                           | Verifica minima                                                                                   |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Solo documentazione non operativa                                       | Nessun gate applicativo obbligatorio; usa un controllo mirato se utile.                           |
| Codice o logica applicativa                                             | `./scripts/with-node.sh pnpm check`                                                               |
| Routing, DB, importer/sync, auth, cache revalidation, flussi utente E2E | `./scripts/with-node.sh pnpm release:check` oltre al gate minimo, se non gia' incluso.            |
| Content-only via skill repo-scoped                                      | Gate indicati dalla skill (`content:validate`, `content:import`, pronunce/accenti o test mirati). |
| Modifica a setup locale, env, QA o workflow                             | Aggiorna anche la documentazione pertinente.                                                      |

Quando cambi comportamento, setup locale, variabili ambiente, flussi QA o
workflow contenuti, aggiorna nella stessa modifica i documenti pertinenti, tra:
`README.md`, `docs/local-verification-notes.md`,
`docs/qa-manual-checklist.md`, `docs/dev-tooling.md`,
`docs/agent-orientation.md`, `.agents/skills/*/SKILL.md`,
`docs/pronunciation-workflow.md`, `docs/forvo-pronunciation-fetch.md`,
`.env.example`.

---

## Invarianti di prodotto

- `/review` e' la review globale reale: dedup cross-media e daily limit globale.
- `/media/[mediaSlug]/review` e' un filtro verticale locale sullo stesso sistema,
  non un launcher verso un altro media.
- Dashboard e CTA globali devono mostrare numeri globali reali.
- Le superfici del media possono mostrare numeri locali solo se etichettati
  chiaramente come tali.
- Le CTA di resume textbook (`Continua il percorso` o equivalenti) puntano al
  primo step non completato del percorso, non semplicemente all'ultima lesson
  visitata o `in_progress`.

---

## Stack

| Layer         | Tecnologia                                                  |
| ------------- | ----------------------------------------------------------- |
| Framework     | Next.js 16.1, App Router                                    |
| Linguaggio    | TypeScript 5.9 strict                                       |
| Frontend      | React 19.2, Server Components, Server Actions               |
| Runtime       | Node.js 22.x                                                |
| Database      | SQLite locale / LibSQL Turso remoto (`@libsql/client` 0.17) |
| ORM           | Drizzle ORM 0.45                                            |
| SRS           | `ts-fsrs` 5.2                                               |
| Content       | Markdown + YAML frontmatter, Unified/remark parser custom   |
| Test unitari  | Vitest 4.0                                                  |
| Test E2E      | Playwright 1.58                                             |
| Linter/Format | ESLint 9 + Prettier 3.8                                     |

---

## Architettura e directory

```text
src/
  app/          Route Next.js App Router, layout, route handlers e pagine
  components/   Componenti React per feature e primitivi UI condivisi
  actions/      Server Actions Next.js
  db/           Client, config, schema, query, seed e migrazioni runtime
  domain/       Logica di dominio pura, senza dipendenze framework
  features/     Moduli feature-oriented condivisi tra route, componenti e test
  styles/       CSS globale e variabili
  types/        Tipi TypeScript globali

scripts/        CLI standalone e workflow operativi
tests/          Vitest, Playwright E2E, fixtures e helper
content/        Bundle media versionati: textbook, cards, asset, pronunce
drizzle/        Migration SQL e meta generati da Drizzle Kit
docs/           Specifiche, workflow, QA, design e note operative
prompts/        Prompt locali ignorati da git
.agents/skills/ Skill Codex repo-scoped versionate con i workflow che mantengono
```

### Route principali

- `src/app/`: dashboard/home con stato globale e CTA di resume.
- `src/app/media/` e `src/app/media/[mediaSlug]/`: libreria, dettaglio media,
  textbook, progress/overview e filtro review locale; gli asset dei bundle sono
  serviti da `src/app/media/[mediaSlug]/assets/[...assetPath]/`.
- `src/app/review/`: coda review cross-media globale.
- `src/app/consolidation/`: hub, sessioni lesson-scoped e retraining prima della
  review.
- `src/app/glossary/`: glossary globale e pagine dettaglio term/grammar.
- `src/app/kanji-clash/`, `src/app/katakana-speed/`, `src/app/pitch-accent/`:
  modalita' drill con sessioni e recap.
- `src/app/settings/`: preferenze studio e stato FSRS optimizer.
- `src/app/login/`: entrypoint auth locale.
- `src/app/api/`: API server-side, inclusi glossary autocomplete,
  invalidazione cache contenuti e `src/app/api/internal/fsrs-optimizer/run/`.

### Feature principali

- `src/features/dashboard/`, `media/`, `textbook/`, `progress/`: home, media,
  reader e avanzamento studio.
- `src/features/study/`, `settings/`, `fsrs-optimizer/`: modello studio,
  preferenze utente e ottimizzazione FSRS.
- `src/features/glossary/`, `review/`, `consolidation/`: lookup, SRS globale e
  consolidamento pre-review/retraining.
- `src/features/kanji-clash/`, `katakana-speed/`, `pitch-accent/`: modalita'
  pratica, sessioni, recap e tooling dataset/corpus.
- `src/features/content/`, `pronunciation/`, `image-workflow/`: parser/import
  contenuti, pronunce/accenti e workflow asset.
- `src/features/auth/`, `cache/`, `navigation/`, `security/`, `shared/`: auth
  locale, cache, href/return-to, primitive server-side e helper condivisi.

---

## Entita' core del DB

```text
media -> segment -> lesson -> contenuto Markdown renderizzato
term / grammar_pattern + alias -> card -> review_subject_state / review_subject_log
cross_media_group -> layer canonico per glossary e review cross-media
lesson_progress -> avanzamento textbook per media
user_setting -> preferenze utente
```

---

## Comandi canonici

### Sviluppo

```bash
./scripts/with-node.sh pnpm dev
./scripts/with-node.sh pnpm build
./scripts/with-node.sh pnpm start
./scripts/with-node.sh pnpm start:e2e
```

### Verifica

```bash
./scripts/with-node.sh pnpm check
./scripts/with-node.sh pnpm release:check
./scripts/with-node.sh pnpm agent:check
./scripts/with-node.sh pnpm agent:verify
./scripts/with-node.sh pnpm lint
./scripts/with-node.sh pnpm format
./scripts/with-node.sh pnpm format:check
./scripts/with-node.sh pnpm typecheck
./scripts/with-node.sh pnpm file-size:check
./scripts/with-node.sh pnpm test
./scripts/with-node.sh pnpm test:real-bundle
./scripts/with-node.sh pnpm test:watch
./scripts/with-node.sh pnpm test:e2e
./scripts/with-node.sh pnpm test:e2e:runner
```

### Database

```bash
./scripts/with-node.sh pnpm db:generate
./scripts/with-node.sh pnpm db:migrate
./scripts/with-node.sh pnpm db:backfill-review-subject-state
./scripts/with-node.sh pnpm db:seed
./scripts/with-node.sh pnpm db:setup
./scripts/with-node.sh pnpm db:studio
```

### Content e media workflow

```bash
./scripts/with-node.sh pnpm content:validate
./scripts/with-node.sh pnpm content:lookup
./scripts/with-node.sh pnpm content:lookup-batch
./scripts/with-node.sh pnpm content:entry-brief
./scripts/with-node.sh pnpm content:entry-usage
./scripts/with-node.sh pnpm content:lesson-brief
./scripts/with-node.sh pnpm content:editorial-lint
./scripts/with-node.sh pnpm content:lesson-workflow-check
./scripts/with-node.sh pnpm content:scope
./scripts/with-node.sh pnpm content:next-id
./scripts/with-node.sh pnpm content:scaffold
./scripts/with-node.sh pnpm content:import
./scripts/with-node.sh pnpm content:test-stats
./scripts/with-node.sh pnpm content:canary-diff
./scripts/with-node.sh pnpm dm:card-fetch
./scripts/with-node.sh pnpm dm:live-card-scaffold
./scripts/with-node.sh pnpm dm:official-text-compare
./scripts/with-node.sh pnpm image:status
./scripts/with-node.sh pnpm image:apply
```

### Pronunce e accenti

```bash
./scripts/with-node.sh pnpm pronunciations:pending
./scripts/with-node.sh pnpm pronunciations:resolve
./scripts/with-node.sh pnpm pronunciations:resolve-entries
./scripts/with-node.sh pnpm pronunciations:reuse
./scripts/with-node.sh pnpm forvo:preflight
./scripts/with-node.sh pnpm pronunciations:forvo
./scripts/with-node.sh pnpm pronunciations:forvo:request
./scripts/with-node.sh pnpm pronunciations:forvo:import-requested
./scripts/with-node.sh pnpm pronunciations:tofugu:sync
./scripts/with-node.sh pnpm pitch-accents:fetch
./scripts/with-node.sh pnpm pitch-accent:import-minimal-pairs
./scripts/with-node.sh pnpm pitch-accent:generate-tofugu-pairs
./scripts/with-node.sh pnpm pitch-accent:validate-corpus
./scripts/with-node.sh pnpm pitch-accent:validate-tofugu-pairs
```

### Tooling feature

```bash
./scripts/with-node.sh pnpm app:progress-brief
./scripts/with-node.sh pnpm docs:agent-orientation
./scripts/with-node.sh pnpm docs:agent-orientation:check
./scripts/with-node.sh pnpm fsrs:optimize
./scripts/with-node.sh pnpm fsrs:optimize:if-needed
./scripts/with-node.sh pnpm auth:hash-password
./scripts/with-node.sh pnpm kanji-clash:generate-similar-kanji
```
