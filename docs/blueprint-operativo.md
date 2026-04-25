# Blueprint Operativo

## 1. Visione del prodotto

La webapp serve a preparare lo studio di un media giapponese prima della sua
fruizione reale. Ogni media e un pacchetto di studio autonomo con textbook,
glossary, review e progressi. L'app e privata, single-user, locale-first e deve
funzionare bene sia su desktop sia su mobile.

## 2. Obiettivi funzionali

- Organizzare i contenuti per media.
- Consentire una struttura del textbook variabile in base al tipo di media.
- Generare il glossary a partire da textbook e cards.
- Supportare review Anki-like con possibilita di marcare elementi come gia
  imparati manualmente.
- Allenare contrasti rapidi tra kanji e vocaboli confondibili tramite Kanji
  Clash, mantenendo stato e log separati dalla review standard.
- Mostrare furigana on demand e tooltip ricchi di contesto.
- Tracciare avanzamento textbook, copertura del lessico e storico review.

## 3. Non obiettivi iniziali

- Multi-user o collaborazione.
- Parsing di subtitle, OCR o import automatici indiscriminati da fonti esterne.
- Accesso remoto esposto pubblicamente senza hardening esplicito.
- Authoring visuale avanzato del contenuto dentro la webapp.

## 4. Principi architetturali

- Single source of truth: le entita canoniche devono essere normalizzate nel DB.
- Content-driven: i contenuti arrivano via Markdown validato e importato.
- Stable IDs: ogni media, lesson, term, grammar item e card deve avere un ID
  persistente.
- Derivazione, non duplicazione: glossary e review usano le stesse entita base.
- Local-first: il deploy iniziale e locale, semplice da avviare e da mantenere.
- Responsive-first: hover su desktop, tap/sheet su mobile.

## 5. Stack consigliato

### Frontend e server

- Next.js con App Router
- React + TypeScript
- Server Components per pagine data-heavy
- Route handlers / server actions per operazioni locali

Motivazione: stack unico, semplice da mantenere, buono per rendering server-side
del textbook e comodo da distribuire in locale.

### Database

- SQLite
- Drizzle ORM

Motivazione: perfetto per single-user locale, zero infrastruttura esterna,
migrazioni semplici, ottimo punto di partenza.

### Parsing e contenuti

- Markdown con frontmatter YAML
- Unified / remark / rehype
- Plugin custom per furigana, riferimenti semantici e blocchi card

### Search

- Campi normalizzati per kana e romaji
- Normalizzazione via libreria tipo `wanakana`
- FTS5 come evoluzione futura, da introdurre solo quando il corpus o i pattern
  di query lo richiedono davvero

### Test

- Vitest per parser, importer e logica review
- Playwright per search, tooltip, furigana toggle e review flow

## 6. Modello funzionale

### 6.1 Media

Ogni media ha:

- metadata generali;
- textbook composto da lesson ordinate;
- cards per vocaboli, frasi o grammatica;
- glossary derivato;
- statistiche e progressi.

La segmentazione dipende dal tipo di media:

- anime: episodi, archi, stagioni;
- videogiochi: capitoli, aree, route;
- TCG: mazzi, archetipi, match-up, set;
- custom: segmenti liberi definiti dal contenuto.

Questa segmentazione deve influenzare il textbook e la navigazione, non il core
model delle entita.

### 6.2 Entita core

- `media`
- `segment`
- `cross_media_group`
- `lesson`
- `term`
- `grammar_pattern`
- `example_sentence`
- `card`
- `entry_link`
- `card_entry_link`
- `entry_status`
- `review_subject_state`
- `review_subject_log`
- `kanji_clash_pair_state`
- `kanji_clash_pair_log`
- `kanji_clash_manual_contrast`
- `kanji_clash_manual_contrast_round_state`
- `kanji_clash_manual_contrast_round_log`
- `user_setting`
- `lesson_progress`
- `content_import`

### 6.3 Distinzione chiave

I progressi non vanno compressi in un solo numero:

- progress textbook: cosa hai letto / completato;
- progress glossary coverage: quante entita hai visto o studiato;
- progress review: padronanza SRS delle card.

## 7. Architettura applicativa

## 7.1 Flusso dei contenuti

1. I file Markdown vengono salvati in `content/media/<slug>/...`
2. Un importer locale li legge e li valida.
3. Il parser estrae metadata, lesson, card, riferimenti e sintassi custom.
4. Le entita canoniche vengono upsertate nel DB.
5. Viene generato contenuto renderizzabile per textbook e card detail.
6. Il glossary viene rigenerato a partire da textbook e cards.
7. I progressi utente restano intatti grazie agli ID stabili.

## 7.2 Scelta importante

Il runtime dell'app non deve dipendere direttamente dal parsing dei Markdown a
ogni request. I Markdown sono sorgente editoriale. Il DB e il layer applicativo
sono la sorgente operativa.

## 7.3 Routing UI consigliato

- `/`
- `/media`
- `/glossary`
- `/review` come queue globale
- `/media/[mediaSlug]`
- `/media/[mediaSlug]/textbook`
- `/media/[mediaSlug]/textbook/[lessonSlug]`
- `/glossary?media=[mediaSlug]` come vista globale filtrata per media; le route
  locali `/media/[mediaSlug]/glossary` non sono superfici supportate
- `/media/[mediaSlug]/review` come filtro verticale sullo stesso sistema, non
  come launcher indipendente
- `/kanji-clash` come workspace separato per contrasti automatici e drill
  manuale
- `/media/[mediaSlug]/progress`
- `/settings`

## 8. Comportamenti chiave UX

### 8.1 Furigana

Supporto nativo con tre modalita:

- `on`: sempre visibili;
- `off`: nascosti;
- `hover`: visibili al passaggio del mouse o all'interazione.

Implementazione:

- storage del testo annotato in AST o HTML serializzato;
- rendering con tag `ruby`, `rb`, `rt`;
- preferenza salvata in `user_setting`.

### 8.2 Tooltip

Desktop:

- hover card su parola o pattern.

Mobile:

- tap per aprire una sheet o popover.

Contenuto minimo tooltip:

- forma base;
- lettura;
- romaji;
- significato in italiano;
- categoria grammaticale;
- eventuali note;
- link al dettaglio;
- stato personale: nuovo, in review, imparato manualmente.

### 8.3 Search

Il glossary deve poter cercare almeno per:

- kanji;
- hiragana;
- katakana;
- romaji;
- significato italiano;
- tag media / segmento / difficolta.

Scelta tecnica:

- campi raw;
- campi normalizzati;
- query applicativa su campi normalizzati e ranking dedicato nel corpus attuale;
- FTS per testo libero come evoluzione futura, non come prerequisito gia
  implementato;
- matching prioritario exact > prefix > fuzzy leggero.

## 9. Review system

## 9.1 Obiettivo

Sistema Anki-like ma integrato nel modello dell'app, con controllo manuale per
segnare qualcosa come gia imparato.

## 9.2 Stati consigliati

- `new`
- `learning`
- `review`
- `relearning`
- `suspended`
- `known_manual`

## 9.3 Funzioni minime

- queue giornaliera;
- limite dei nuovi globale, non per media;
- grading stile Again / Hard / Good / Easy;
- scheduler SRS;
- cronologia risposte;
- mark as known;
- reset di una card;
- sospensione temporanea o permanente.

La review deve poter fondere il materiale cross-media quando una stessa entry o
pattern grammaticale compare in più media, mantenendo visibile il contesto
locale solo quando serve.

Il subject state canonico e `review_subject_state` e la cronologia canonica e
`review_subject_log`. Le migrazioni devono preservare lo storico esistente e il
conteggio dei nuovi introdotti nel giorno non deve azzerarsi sugli upgrade.

La migrazione SQL `0011_global_review_subjects.sql` introduce anche
`review_subject_log`; l'importer crea e riallinea `review_subject_state`
direttamente durante il sync del contenuto, mentre `pnpm db:migrate` non fa
piu backfill automatici dedicati. La
cleanup migration `0014_oval_expediter.sql` rimuove poi le vecchie tabelle
card-level `review_state` e `review_log`, dopo il consolidamento completo del
modello subject-level.

Sul fronte prodotto, `/review` resta la review globale reale sui subject,
mentre `/media/[mediaSlug]/review` è la vista filtrata locale. Dashboard e CTA
globali devono usare numeri globali reali; progress e media detail possono
mostrare anche numeri locali, ma senza etichettarli come globali.

## 9.4 Nota progettuale

Il mark-as-known non deve cancellare la cronologia. Deve produrre uno stato
esplicito, distinguibile da una card davvero stabilizzata via review.

Inoltre, l'override manuale deve esistere anche a livello di entita canonica
(`term` o `grammar_pattern`), non solo a livello di card, perche una stessa
entry puo avere piu card collegate.

## 10. Kanji Clash

Kanji Clash e un workspace principale ma separato da `/review`: serve a
discriminare rapidamente vocaboli che condividono kanji o che differiscono per
kanji visivamente simili. Usa solo materiale canonico gia presente nel DB e non
richiede doppioni editoriali per creare nuove coppie.

Il workspace vive su `/kanji-clash`, con scope globale di default e filtro
media solo quando `media=<slug>` e valido. Supporta modalita automatica e drill
manuale; entrambe scrivono in tabelle Kanji Clash dedicate, senza alterare
queue, log o contatori della review standard.

La Review puo comunque forzare un contrasto quando l'utente segnala una
confusione tramite `+ Contrasto`. In quel caso grading review e upsert del
contrasto devono restare nella stessa transazione: il contrasto non e un
best-effort sacrificabile. I contrasti forzati hanno una chiave unordered a
livello di contrasto, due round direzionali schedulabili e lifecycle esplicito
`active` / `archived` / restore.

## 11. Security e accesso remoto

Deploy iniziale:

- solo locale;
- nessun requisito di auth complessa.

Se in futuro l'app viene esposta via port forwarding:

- aggiungere autenticazione;
- usare reverse proxy;
- limitare IP o proteggere via tunnel/VPN quando possibile;
- non esporre SQLite e processi di sviluppo;
- passare a cookie sicuri e CSRF protection complete.

Questo va trattato come una milestone separata, non come un toggle banale.

## 12. Roadmap operativa

### Fase 0 - Fondazione

- inizializzare app Next.js + TypeScript;
- configurare lint, format e test;
- impostare SQLite e schema iniziale;
- creare importer e validatore dei contenuti.

### Fase 1 - Content engine

- parser Markdown con frontmatter;
- sintassi custom per furigana e riferimenti;
- import di media, lesson e cards;
- rigenerazione glossary;
- gestione versioni import.

### Fase 2 - Reader textbook

- layout responsive reader;
- rendering textbook;
- furigana toggle;
- tooltip engine;
- progress lesson.

### Fase 3 - Glossary

- indice e ricerca;
- filtri per segmento e tipologia;
- pagina dettaglio term / grammar item;
- collegamenti a lesson e cards.

### Fase 4 - Review

- queue giornaliera;
- grading Anki-like;
- stati learning/review;
- mark as known;
- statistiche minime.

### Fase 4b - Kanji Clash

- workspace `/kanji-clash` separato dalla review standard;
- pair automatiche da termini consolidati e kanji simili;
- drill manuale con sessioni deterministiche;
- contrasti forzati dalla Review con archive/restore;
- stato SRS e log dedicati.

### Fase 5 - Dashboard e rifinitura

- homepage con media recenti;
- metriche progresso;
- mobile polish;
- backup/export locale.

## 13. Deliverable di progettazione

I documenti da mantenere nel repo in questa fase sono:

- questo blueprint operativo;
- la specifica del formato contenuti;
- lo schema dati iniziale;
- la roadmap di implementazione.

## 14. Decisioni gia prese

- Glossary derivato da textbook e cards.
- Segmentazione per media flessibile e dipendente dal tipo di contenuto.
- Supporto desktop e mobile.
- Deploy iniziale locale.
- Review system Anki-like con override manuale dello stato appreso.
- Kanji Clash come workspace stabile, collegato alla Review solo tramite
  contrasti manuali transazionali e con persistenza separata.
- Spiegazioni e tooltip principalmente in italiano.
- Audio locale e immagini supportati; niente parsing avanzato o pipeline media
  completamente automatica in v1.

## 15. Prime milestone pratiche

1. Creare lo scheletro del progetto applicativo.
2. Definire schema DB e import model.
3. Implementare la specifica Markdown v1.
4. Costruire un media demo con contenuti fittizi.
5. Sviluppare textbook reader e glossary.
6. Aggiungere review e progress tracking.
