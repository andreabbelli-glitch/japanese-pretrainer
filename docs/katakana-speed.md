# Katakana Speed

`Katakana Speed` e il workspace locale-first per rendere automatico il
riconoscimento di katakana visivamente o fonologicamente confondibili. Resta
separato da `/review`, dai media bundle e da Kanji Clash: non crea card FSRS,
non legge `content/media/**` e non modifica gli stati review esistenti.

## Route

- `/katakana-speed`: dashboard con quick start adattivo, mode picker compatto,
  fluency snapshot, family cards, top confusioni, top slow-correct, weak spots e
  recap recente.
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
- word bank operativo completo dalla specifica non-audio, pseudoword seed,
  trap moraiche, variant pair, chunk spotting target, ladder verticali e phrase
  bank `P01-P60`.

Il catalogo pseudoword materializza 45 chunk operativi per 6 frame statici
(`{chunk}トール`, `{chunk}リック`, `ア{chunk}ール`,
`メ{chunk}ラン`, `コ{chunk}ット`, `ラ{chunk}ス`) per 270 seed
targetable. Include inoltre 26 minimal pseudo-pair first-class: entrambi gli
estremi sono item pseudoword reali, i distractor diretti sono collegati tramite
cluster fonologici e gli estremi usati solo come distractor sono taggati
`targetable-false` per non entrare nei target di `pseudoword_transfer`. Gli 8
ID legacy dell'MVP restano preservati e il dedupe avviene per superficie,
fondendo tag e metadata; mora count e display segmentation sono sempre derivati
dal tokenizer.

Il modello puro include tokenizer, generatore opzioni, classificatore errori,
scheduler item, scoring e generatore sessione. La feature supporta:

- `minimal_pair`: scelta tra quattro opzioni;
- `blink`: esposizione breve senza audio, con due opzioni.
- `word_naming`, `pseudoword_sprint`, `sentence_sprint`: timer manuale e
  self-check `clean / hesitated / wrong`;
- raw-choice text-only per same/different, mora trap, long/sokuon pair race,
  variant normalization e vertical ladder. Le opzioni raw sono codificate nel
  piano della sessione e corrette contro `expected_surface`, senza richiedere
  item catalogo fittizi.
- `segment_select` per chunk spotting e `tile_builder` per scrambled loanword
  builder; entrambi riusano la session route e il submit answer esistente.
- `repeated_reading_pass`: blocco aggregato a tre passaggi, due sulla stessa
  frase e uno di transfer su frase con focus chunk condiviso;
- `ran_grid`: griglia 5x5 con timer totale, celle sbagliate marcabili dopo
  stop e risultato aggregato con posizioni 0-based canonizzate.

I mode avviabili dall'hub includono `diagnostic_probe`, `mora_trap`,
`chunk_spotting`, `loanword_decoder`, `tile_builder`, `confusion_ladder` e
`variant_normalization`, oltre ai mode gia esistenti. Non sono inclusi audio,
voice recognition, shadowing, export, chart avanzate o integrazione con
`/review`. Dashboard e recap mostrano solo superfici kana e metriche
diagnostiche: romaji/reading restano dati interni e hard mode no-romaji e il
default.

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

1. Da `/katakana-speed`, `Start drill` crea una sessione daily locale con mix
   blitz non-audio; il mode picker compatto avvia baseline, transfer e repair
   mirati.
2. I choice drill accettano tasti `1`-`4` e tap/click sulle opzioni.
3. Same/different, trap, variant e ladder usano choice raw text-only. Chunk
   spotting usa segmenti tappabili; tile builder usa tile kana tappabili con
   reset e salvataggio.
4. I self-check drill usano `Space` per avviare/fermare il timer, `1`-`3` per
   il rating e `Enter` per continuare.
5. Repeated reading usa `Space` per ogni passaggio ed `Enter` per avanzare o
   salvare il blocco; RAN usa `Space` per start/stop, poi tap/click sulle
   celle sbagliate. Il count errori e derivato dalle celle selezionate e viene
   salvato come un solo risultato aggregato.
6. A fine sessione o con `Abbandona e salva recap`, il rollup viene scritto in
   `katakana_session` e il recap resta raggiungibile.
7. Dashboard e recap derivano analytics server-side da log e snapshot gia
   persistiti: rare accuracy, pseudo transfer, sentence flow, repeated-reading
   gain, RAN items/sec, celle RAN sbagliate quando disponibili, confusioni top,
   slow item e family progress. Non serve una migration dedicata per queste
   viste.

## Verifica

Per modifiche alla feature:

```sh
./scripts/with-node.sh pnpm exec vitest run tests/katakana-speed-catalog-tokenizer.test.ts tests/katakana-speed-options-errors.test.ts tests/katakana-speed-scheduler-session.test.ts tests/katakana-speed-session-persistence.test.ts tests/katakana-speed-persistence-expansion.test.ts tests/katakana-speed-expansion-actions.test.ts tests/katakana-speed-interactions.test.ts tests/katakana-speed-route.test.ts
./scripts/with-node.sh pnpm exec vitest run tests/katakana-speed-operational-catalog.test.ts tests/katakana-speed-operational-planner.test.ts tests/katakana-speed-raw-answer.test.ts
./scripts/with-node.sh pnpm check
./scripts/with-node.sh pnpm release:check
```

Il gate completo e richiesto per cambi a route, DB, Server Actions o UI di
sessione perche la feature tocca routing, migrazioni e flussi utente.
