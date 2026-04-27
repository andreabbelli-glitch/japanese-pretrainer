# Katakana Speed

`Katakana Speed` e il workspace locale-first per rendere automatico il
riconoscimento di katakana visivamente o fonologicamente confondibili. Resta
separato da `/review`, dai media bundle e da Kanji Clash: non crea card FSRS,
non legge `content/media/**` e non modifica gli stati review esistenti.

## Route

- `/katakana-speed`: dashboard con tre azioni primarie (`Start 5 min`,
  `Diagnosi`, `Ripara debolezza`), fluency snapshot, punti deboli, top
  confusioni, top slow-correct e recap recente. Non esiste più un picker di
  modalità legacy/debug: la UI pubblica espone solo i tre training loop.
- `/katakana-speed/session/[sessionId]`: loop focalizzato per una sessione
  persistita. Lo shell globale viene nascosto per ridurre distrazioni.
- `/katakana-speed/recap/[sessionId]`: recap persistito con metriche
  mode-aware, diagnostica di sessione e log compatto dei tentativi.

La navbar espone solo la voce primaria `Katakana`; sessione e recap non sono
entry separate.

## Catalogo e logica

Il catalogo vive in TypeScript sotto
`src/features/katakana-speed/model/catalog.ts`, con il sotto-catalogo
pseudoword seed-driven in
`src/features/katakana-speed/model/pseudoword-catalog.ts` e il registry
operativo non-audio in
`src/features/katakana-speed/model/exercise-catalog.ts`. Gli ID sono stabili,
non sono sincronizzati da Markdown e non esiste una tabella catalogo nel DB. Il
set statico copre:

- chunk estesi core come `ティ`, `ディ`, `ファ`, `フィ`, `フェ`, `フォ`,
  `シェ`, `ジェ`, `チェ`, `ウェ`, `ウォ`;
- edge/rare come `トゥ`, `ドゥ`, `デュ`, `フュ`, `ウィ`, `ヴァ`,
  `ヴィ`, `ヴ`, `ヴェ`, `ヴォ`;
- cluster visivi `シ/ツ/ソ/ン`, `ノ/メ/ヌ`, `ワ/ウ/フ/ク`,
  `コ/ロ/ユ/ヨ`, `マ/ム`, `ラ/フ/ヲ/ワ`, `タ/ク/ケ`,
  `ハ/バ/パ`, dakuon core e long-vowel mark;
- mora base di fallback per opzioni e smoke test.
- word bank operativo completo dalla specifica non-audio, pseudoword seed e
  phrase bank `P01-P60`. Gli asset di supporto al catalogo restano dati
  statici, ma non definiscono modalità sessione autonome.

Il catalogo pseudoword materializza 45 chunk operativi per 6 frame statici
(`{chunk}トール`, `{chunk}リック`, `ア{chunk}ール`,
`メ{chunk}ラン`, `コ{chunk}ット`, `ラ{chunk}ス`) per 270 seed
targetable. Include inoltre 26 minimal pseudo-pair first-class: entrambi gli
estremi sono item pseudoword reali, i distractor diretti sono collegati tramite
cluster fonologici e gli estremi usati solo come distractor sono taggati
`targetable-false` per non entrare nei target del blocco di lettura. Il dedupe
avviene per superficie, fondendo tag e metadata; mora count e display
segmentation sono sempre derivati dal tokenizer.

Il modello puro include tokenizer, focus registry, generatore opzioni,
classificatore errori, scheduler item, scoring e generatore sessione. Le
modalità pubbliche sono:

- `daily`: sessione da circa 5 minuti in 3 blocchi: contrast sprint, lettura a
  tempo con parole/pseudoparole, transfer con RAN o repeated reading.
- `diagnostic_probe`: baseline breve con gli stessi tre blocchi, tarata per
  fotografare lentezza e confusioni.
- `repair`: loop focalizzato sulla debolezza principale con contrasti, lettura
  e verifica finale.

I trial persistiti usano i mode DB esistenti:

- `minimal_pair`: scelta tra quattro opzioni;
- `blink`: esposizione breve senza audio, con due opzioni.
- `word_naming`, `pseudoword_sprint`, `sentence_sprint`: timer automatico e
  self-check `clean / hesitated / wrong`;
- raw-choice text-only per contrast choice e mora contrast. Le opzioni raw sono
  codificate nel piano della sessione e corrette contro `expected_surface`,
  senza richiedere item catalogo fittizi.
- `repeated_reading_pass`: blocco aggregato a tre passaggi, due sulla stessa
  frase e uno di transfer su frase con focus chunk condiviso;
- `ran_grid`: griglia 5x5 con timer totale, celle sbagliate marcabili dopo
  stop e risultato aggregato con posizioni 0-based canonizzate.

Ogni trial V2 salva in `featuresJson`/`metricsJson` metadata derivabili senza
migration: `focusId`, `exerciseFamily`, `correctnessSource`,
`showReadingDuringTrial`, `targetMsPerMora` e, dopo self-check, `msPerMora`.
Non sono inclusi audio, voice recognition, shadowing, export, chart avanzate o
integrazione con `/review`. Dashboard e recap mostrano superfici kana e metriche
diagnostiche azionabili. Nelle sessioni il romaji resta nascosto durante il
trial; la lettura compare dopo risposta, feedback o stop del timer.

Il refactor non mantiene adapter per vecchie `sessionMode` come `rare_combo`,
`mora_trap`, `tile_builder`, `chunk_spotting`, `variant_normalization` o mode
standalone per RAN/pseudoword. La feature e recente e i dati reali possono
essere rigenerati; una sessione pre-refactor puo essere scartata invece di
tenere codice di compatibilita.

## Persistenza

Le tabelle runtime sono:

- `katakana_item_state`: stato per item statico, streak, lapse, tempi recenti e
  tag errore.
- `katakana_session`: sessioni con rollup di accuratezza, tempi e focus
  consigliato.
- `katakana_trial`: piano persistito della sessione.
- `katakana_attempt_log`: tentativi idempotenti, uno per trial.
- `katakana_exercise_block`: blocchi persistiti dentro la sessione per
  raggruppare trial choice, self-check e aggregati.
- `katakana_exercise_result`: risultati aggregati per RAN Grid e repeated
  reading.
- `katakana_confusion_edge`: confusioni direzionali osservate nei choice drill.

Il submit valida sempre sessione attiva e trial appartenente alla sessione
prima di trattare una risposta come idempotente. I risultati aggregati validano
sessione, blocco, esercizio e trial opzionale; quando salvati marcano answered
tutti i trial del blocco senza creare attempt artificiali. Le sessioni attive
riprese partono dal primo trial non ancora risposto usando `answeredCount`.

## Flusso utente

1. Da `/katakana-speed`, `Start 5 min` crea una sessione daily focalizzata:
   blocco contrasti, blocco lettura a tempo, blocco transfer. `Diagnosi` e
   `Ripara debolezza` usano lo stesso focus engine con conteggi diversi.
2. I choice drill accettano tasti `1`-`4` e tap/click sulle opzioni.
3. Mora contrast e contrasti raw usano choice text-only; non ci sono flussi di
   costruzione tessere, chunk spotting standalone o varianti normative.
4. Durante il trial non viene mostrato romaji. Dopo risposta o stop, `Space` o
   il toggle dedicato possono mostrare/nascondere la lettura. Il timer parte
   automaticamente nei drill temporizzati.
5. I self-check drill usano `1`-`3` per il rating: `clean` e `hesitated`
   avanzano automaticamente dopo il salvataggio, `wrong` resta sul trial con
   feedback e richiede `Enter` o `Continua`.
6. Repeated reading e RAN usano `Enter` per fermare il timer e poi avanzare o
   salvare il blocco. RAN abilita tap/click sulle celle sbagliate solo dopo lo
   stop; se ci sono celle segnate come errore, il feedback resta visibile fino
   al continue manuale.
7. A fine sessione o con `Abbandona e salva recap`, il rollup viene scritto in
   `katakana_session` e il recap resta raggiungibile.
8. Dashboard e recap derivano analytics server-side da log e snapshot gia
   persistiti: accuratezza, fluenza, tempi per mora quando disponibili, RAN
   items/sec, celle RAN sbagliate, confusioni top, slow item, focus consigliato
   e family progress. Non serve una migration dedicata per queste viste.

## Verifica

Per modifiche alla feature:

```sh
./scripts/with-node.sh pnpm exec vitest run tests/katakana-speed-catalog-tokenizer.test.ts tests/katakana-speed-options-errors.test.ts tests/katakana-speed-scheduler-session.test.ts tests/katakana-speed-session-persistence.test.ts tests/katakana-speed-persistence-expansion.test.ts tests/katakana-speed-expansion-actions.test.ts tests/katakana-speed-interactions.test.ts tests/katakana-speed-route.test.ts
./scripts/with-node.sh pnpm exec vitest run tests/katakana-speed-focus.test.ts tests/katakana-speed-operational-catalog.test.ts tests/katakana-speed-operational-planner.test.ts tests/katakana-speed-raw-answer.test.ts tests/katakana-speed-analytics.test.ts
./scripts/with-node.sh pnpm check
./scripts/with-node.sh pnpm release:check
```

Il gate completo e richiesto per cambi a route, DB, Server Actions o UI di
sessione perche la feature tocca routing, migrazioni e flussi utente.
