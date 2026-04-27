# AGENTS.md – Japanese Custom Study

Webapp privata, single-user, locale-first per studiare media giapponesi (anime,
videogiochi, TCG, visual novel) prima di fruirli. L'utente impara il vocabolario
e la grammatica contestuale di un media tramite textbook, glossary e review
Anki-like.

Lo sviluppo è **100% AI-driven**: l'utente non legge mai il codice manualmente.
Ogni sessione deve essere completamente autonoma e lasciare il repo in stato
valido. Per i comandi Node/pnpm, per gli agenti il percorso canonico è
`./scripts/with-node.sh pnpm ...`: per modifiche al codice applicativo come
minimo `pnpm check` deve essere verde; per modifiche a routing, DB, importer,
auth, cache revalidation o flussi utente serve anche il gate completo
`./scripts/with-node.sh pnpm release:check`. I workflow editoriali/content-only
versionati nelle skill `.agents/skills/*` possono dichiarare gate mirati più
stretti e non devono far partire suite complete quando modificano solo bundle
contenuto, asset, pronunce o sidecar workflow del media.

---

## Stack

| Layer         | Tecnologia                                                |
| ------------- | --------------------------------------------------------- |
| Framework     | Next.js 16.1 (App Router)                                 |
| Linguaggio    | TypeScript 5.9 strict                                     |
| Frontend      | React 19.2, Server Components, Server Actions             |
| Runtime       | Node.js 22.x                                              |
| Database      | SQLite locale / LibSQL Turso remoto (@libsql/client 0.17) |
| ORM           | Drizzle ORM 0.45                                          |
| SRS           | ts-fsrs 5.2 (FSRS algorithm)                              |
| Content       | Markdown + YAML frontmatter, Unified/remark parser custom |
| Test unitari  | Vitest 4.0                                                |
| Test E2E      | Playwright 1.58                                           |
| Linter/Format | ESLint 9 + Prettier 3.8                                   |

---

## Mappa delle directory

```
src/
  app/              Route Next.js (App Router): pagine, layout globali e route handlers
    api/            Endpoint server-side per feature trasversali
      glossary/     API per ricerca e autocomplete del glossary
        autocomplete/ API JSON per suggerimenti autocomplete del glossary globale
      internal/     Endpoint interni per manutenzione e invalidazione cache contenuti
        content-cache/ API di invalidazione e refresh della cache contenuti
          revalidate/ API per revalidation mirata delle cache contenuti
    glossary/       Portal glossary globale e stati di caricamento
      grammar/      Pagine dettaglio per pattern grammaticali del glossary globale
        [surface]/  Route dettaglio grammar globale per superficie
      term/         Pagine dettaglio per termini del glossary globale
        [surface]/  Route dettaglio termine globale per superficie
    kanji-clash/    Modalita' allenamento kanji con sessioni dedicate
    katakana-speed/ Modalita' drill katakana con sessioni e recap dedicati
      recap/        Recap della sessione katakana speed
        [sessionId]/ Recap di una sessione katakana speed specifica
      session/      Esecuzione interattiva della sessione katakana speed
        [sessionId]/ Route sessione katakana speed specifica
    login/          Pagina di accesso locale
    media/          Route dinamiche per media, textbook, review e progress
      [mediaSlug]/assets/ Asset route del media bundle
        [...assetPath]/ Catch-all per servire file statici del media bundle
      [mediaSlug]/glossary/ Glossary locale filtrato per media
        grammar/    Pagine dettaglio grammatica del glossary locale media
          [entryId]/ Route dettaglio grammar locale per entry
        term/       Pagine dettaglio termini del glossary locale media
          [entryId]/ Route dettaglio termine locale per entry
      [mediaSlug]/progress/ Stato di avanzamento e metriche del media
      [mediaSlug]/review/ Vista review verticale sul sistema review globale
        card/           Vista dedicata alla review di una card nel contesto del media
          [cardId]/      Route della singola card review nel contesto del media
      [mediaSlug]/textbook/ Indice del textbook del media
        [lessonSlug]/   Lesson reader per la singola lesson del media
          tooltips/     Endpoint per i tooltip contestuali del lesson reader
    review/         Coda review cross-media
    settings/       Pagina impostazioni utente
  components/       Componenti React organizzati per feature area
    auth/           Form di login
    dashboard/      Homepage e widget overview
    layout/         Shell globale (header, nav, sidebar)
    media/          Pagine dettaglio media
    glossary/       Indice e ricerca glossary
    kanji-clash/    UI e interazioni della modalita' kanji clash
    katakana-speed/ UI e interazioni della modalita' katakana speed
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
  features/         Moduli feature-oriented condivisi tra route, componenti e test
    glossary/       Modello, ricerca, formattazione e loader server del glossary
      model/        Logica pura di filtro, search, format e detail helper
      server/       Loader e API server-side per glossary globale e locale
    kanji-clash/    Logica canonica della modalita' Kanji Clash
      model/        Pairing, queue, scheduler e utility pure
      server/       Loader sessione, token queue e contrasti manuali
      tooling/      Generazione dataset kanji simili e override editoriali
    katakana-speed/ Logica canonica della modalita' Katakana Speed
      model/        Catalogo, tokenizer, scheduler e stato sessione
      server/       Persistenza e loader server-side delle sessioni
    textbook/       Contratti e helper del textbook reader
      client/       Stato e adapter client-side del reader
      server/       API server-side e loader condivisi del textbook
  lib/              Utility e helper condivisi tra app/ e scripts/
    content/        Utility per parser, validazione e sync dei bundle Markdown
      importer/     Pipeline di import e rendering dei bundle nel modello applicativo
      parser/       Parsing Markdown/frontmatter e normalizzazione blocchi strutturati
    e2e/            Helper condivisi per bootstrap e utility dei test end-to-end
    kanji-clash/    Shim di compatibilita' verso src/features/kanji-clash
    site/           Navigazione, href e utility di stato per il routing UI
  types/            Tipi TypeScript globali e interfacce condivise
  styles/           CSS globale e variabili

scripts/            CLI standalone (non fanno parte del server Next.js)
  start-e2e-config.ts     Helper condiviso per configurare DB/env sicuri dei test E2E
  start-e2e.ts            Avvia il server per i test E2E
  import-content.ts       Importa bundle media nel DB
  validate-content.ts     Valida formato Markdown prima dell'import
  fetch-pronunciations.ts Scarica audio pronuncia (Forvo)
  resolve-pronunciations.ts Risolve pronunce mancanti per review/lesson con workflow guidato
  fetch-forvo-pronunciations.ts Fallback Forvo da sessione browser autenticata
  request-forvo-word-add.ts Richiede l'aggiunta di lemmi mancanti su Forvo
  fetch-pitch-accents.ts  Scarica dati accento tonale
  reuse-pronunciations.ts Riusa audio già presenti tra bundle compatibili
  update-pronunciation-pending.ts Aggiorna il manifest dei pronunciations mancanti
  update-real-bundle-test-stats.ts Aggiorna fixture statistiche per test real bundle
  fsrs-optimize.ts        Ottimizza i parametri FSRS sui log review
  fsrs-optimize-if-needed.ts Esegue l'ottimizzazione FSRS solo se necessaria
  generate-kanji-clash-similar-kanji-dataset.ts Genera il dataset di kanji simili per kanji clash
  image-workflow-status.ts Riassume stato richieste e asset immagine
  apply-image-blocks.ts    Applica blocchi immagine generati ai contenuti derivati
  load-env.ts              Helper condiviso per caricare variabili ambiente negli script
  db-migrate.ts           Esegue migrazioni DB
  db-backfill-review-subject-state.ts Normalizza stati review legacy
  db-seed.ts              Esegue seed DB
  hash-auth-password.ts   Genera hash password per auth locale
  start-e2e-snapshot.ts   Avvia il server E2E con snapshot del database di test
  forvo-word-add-helper.user.js User script di supporto per il workflow richieste Forvo
  release-check.sh        Esegue il gate completo di release
  tooling-doctor.sh       Diagnostica rapida dell'ambiente locale
  with-node.sh            Wrapper shell per eseguire comandi con la versione Node del repo

tests/
  *.test.ts         Test Vitest (unit + integration)
  e2e/              Test Playwright end-to-end
    helpers/        Utility E2E condivise
  fixtures/         Dati statici per i test
    content/        Fixture content bundle per parser/importer
      invalid/      Bundle volutamente invalidi per test di validazione
      valid/        Bundle validi usati nei test di parsing e import
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
  content-format.md       Specifica del formato Markdown (30KB)
  content-parser.md       Dettagli del parser contenuti e blocchi Markdown
  database.md             Design del DB e strategia di persistenza
  design/                 Token, direzione UX e wireframe
  dev-tooling.md          Note sugli strumenti e comandi di sviluppo locali
  forvo-pronunciation-fetch.md Workflow fallback Forvo autenticato
  importer-sync-strategy.md Strategia di import e sync dei bundle contenuto
  kanji-clash.md          Specifica della modalita' Kanji Clash
  katakana-speed.md        Specifica della modalita' Katakana Speed
  llm-kit/                Guide per integrazione LLM esterna
    README.md             Indice e regole del kit LLM
    general/              Template e regole riusabili cross-media
    media/                Brief e prompt specifici per singolo media
      <slug>/             Cartelle per-media con brief e prompt batchizzati
  local-verification-notes.md Note per verifiche locali e troubleshooting
  pitch-accent-workflow.md Workflow dati accento tonale
  pronunciation-fetch.md  Workflow di fetch pronunce dai provider
  pronunciation-workflow.md Workflow editoriale e tecnico delle pronunce
  qa-manual-checklist.md  Checklist QA manuale
  tasks/                  Task operative e note di lavoro per manutenzione e backlog
  drift-report.md         Report periodico di drift tra codice e docs strategiche

prompts/                  Prompt locali ignorati da git
  automations/            Prompt per automazioni Codex locali

.agents/
  skills/          Skill Codex repo-scoped, versionate insieme ai workflow che
                   mantengono; non duplicarle manualmente in ~/.codex/skills
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
./scripts/with-node.sh pnpm fsrs:optimize   # ottimizza i parametri FSRS sui log review
./scripts/with-node.sh pnpm fsrs:optimize:if-needed # esegue l'ottimizzazione FSRS solo se necessaria
./scripts/with-node.sh pnpm auth:hash-password # genera hash password per auth locale
./scripts/with-node.sh pnpm content:test-stats # aggiorna fixture statistiche per bundle reali
./scripts/with-node.sh pnpm content:import  # importa bundle media nel DB
./scripts/with-node.sh pnpm content:validate # valida formato Markdown
./scripts/with-node.sh pnpm pronunciations:fetch # scarica pronunce dai provider configurati
./scripts/with-node.sh pnpm pronunciations:resolve # risolve backlog pronunce per review o lesson con workflow guidato
./scripts/with-node.sh pnpm pronunciations:pending # aggiorna il backlog pronunce mancanti
./scripts/with-node.sh pnpm pronunciations:reuse # riusa pronunce già presenti
./scripts/with-node.sh pnpm pronunciations:forvo # esegue il fallback Forvo autenticato
./scripts/with-node.sh pnpm pronunciations:forvo:request # prepara richieste di nuovi lemmi per Forvo
./scripts/with-node.sh pnpm pitch-accents:fetch # scarica dati di pitch accent
./scripts/with-node.sh pnpm image:status    # mostra stato workflow immagini
./scripts/with-node.sh pnpm image:apply     # applica blocchi immagine ai contenuti derivati
./scripts/with-node.sh pnpm kanji-clash:generate-similar-kanji # genera il dataset di kanji simili per kanji clash
```

---

## Verifiche richieste

- Sempre: eseguire almeno `./scripts/with-node.sh pnpm check` dopo modifiche al
  codice o alla logica.
- Eseguire anche `./scripts/with-node.sh pnpm release:check` quando la modifica
  tocca routing, DB, importer/sync contenuti, auth, cache revalidation o
  superfici utente coperte da E2E.
- Per task editoriali/content-only gestiti da skill repo-scoped, seguire invece
  la sezione `Verification` della skill: deve indicare solo `content:validate`,
  `content:import`, workflow pronunce/accenti e test mirati realmente necessari
  per il media o sottosistema toccato.
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
5. `./scripts/with-node.sh pnpm check` deve passare al termine delle sessioni
   che modificano codice o logica applicativa; per le aree a maggior impatto
   vale anche il gate `release:check`. Le sessioni content-only coperte da una
   skill seguono i gate mirati della skill.
6. I test in `tests/` sono la rete di sicurezza – non eliminarli.
7. Il deploy è single-user locale-first: non aggiungere multi-tenancy o auth
   complessa senza una milestone dedicata.
8. Se cambi comportamento, setup locale, variabili ambiente, flussi QA o
   workflow contenuti, aggiorna nella stessa modifica la documentazione
   pertinente: almeno `README.md`, `docs/local-verification-notes.md`,
   `docs/qa-manual-checklist.md`, `docs/dev-tooling.md`,
   `docs/pronunciation-workflow.md`, `docs/forvo-pronunciation-fetch.md` e
   `.env.example` secondo impatto reale.
