# Workflow pitch accent

Questo documento descrive il flusso automatico per popolare `pitch_accent`.

## Obiettivo

Popolare `pitch_accent` in modo semplice e sequenziale:

- si prova prima lo snapshot locale `Kanjium`;
- se Kanjium non risolve o e ambiguo, si prova `Shirabe Jisho` se installato;
- poi si prova `Jiten`;
- poi `Wiktionary`;
- infine `OJAD`;
- ogni check viene salvato subito su `pronunciations.json`;
- quando una fonte risolve, si salva subito il valore;
- insieme al valore si salvano anche `fonte` e `link` della pagina usata.
- i casi ambigui o fuzzy vengono stampati come `review_required` e non vengono
  salvati nel manifest.

## Comando

```bash
./scripts/with-node.sh pnpm pitch-accents:fetch -- --media <media-slug>
```

Comandi utili:

```bash
./scripts/with-node.sh pnpm pitch-accents:fetch -- --media <media-slug> --dry-run
./scripts/with-node.sh pnpm pitch-accents:fetch -- --media <media-slug> --limit 20
./scripts/with-node.sh pnpm pitch-accents:fetch -- --media <media-slug> --refresh
./scripts/with-node.sh pnpm pitch-accents:fetch -- --media <media-slug> --retry-misses
./scripts/with-node.sh pnpm pitch-accents:fetch -- --media <media-slug> --retry-misses --source jiten
./scripts/with-node.sh pnpm pitch-accents:fetch -- --media <media-slug> --source kanjium --source shirabe
./scripts/with-node.sh pnpm pitch-accents:fetch -- --media <media-slug> --shirabe-app-path /Applications/Shirabe\ Jisho.app
./scripts/with-node.sh pnpm pitch-accents:fetch -- --media <media-slug> --entry term-taberu
./scripts/with-node.sh pnpm pitch-accents:fetch -- --media <media-slug> --word 食べる --word 設定
./scripts/with-node.sh pnpm pitch-accents:fetch -- --media <media-slug> --words-file tmp/pitch-accent-targets.tsv
./scripts/with-node.sh pnpm pitch-accents:fetch -- --entry-delay-ms 300000 --request-delay-ms 5000
```

`--entry-delay-ms` inserisce una pausa tra una entry e la successiva. E utile
quando si vuole procedere molto lentamente, per esempio un termine ogni 5
minuti.

Il comando fallisce subito se riceve argomenti non riconosciuti oppure valori
mancanti/non validi, cosi un typo nei flag non avvia un batch piu ampio del
previsto.

## Modalita mirata

Per i workflow editoriali locali, quando sono state appena create o riviste
solo alcune flashcard, non lanciare di default il fetch sull'intero media.
Passa invece solo le entry nuove o aggiornate:

```bash
./scripts/with-node.sh pnpm pitch-accents:fetch -- --media <media-slug> --entry <term-or-grammar-id>
```

Se non hai ancora una lista affidabile di ID, puoi passare le parole:

```bash
./scripts/with-node.sh pnpm pitch-accents:fetch -- --media <media-slug> --word 食べる --word 設定
```

`--words-file` accetta:

- una parola per riga, per esempio `食べる`;
- `word<TAB>reading`;
- `word<TAB>reading<TAB>entry_id`;
- un ID diretto `term-...` o `grammar-...` su una riga singola;
- un array JSON di stringhe o oggetti `{ "word": "...", "reading": "...",
  "entry_id": "..." }`.

Nel riepilogo, righe non risolte contro il glossary del bundle vengono
stampate come `skipped <raw> (...)` e non interrogano le fonti. Le righe
`review_required` indicano candidati plausibili ma non abbastanza sicuri per un
salvataggio automatico.

## Ordine delle fonti

Per ogni entry:

1. si prova `Kanjium` da `data/pitch-accents/kanjium-accents.txt`;
2. se Kanjium non risolve o restituisce piu accenti, si prova `Shirabe Jisho`;
3. se serve ancora una fonte, si prova `Jiten`;
4. poi `Wiktionary`;
5. infine `OJAD`;
6. se una fonte risolve in modo univoco, si aggiorna `pronunciations.json`.

Kanjium e Shirabe usano lookup offline/locali. Shirabe e opzionale: se l'app non
e presente viene saltato senza errore. Puoi indicare un bundle specifico con
`--shirabe-app-path` o con `SHIRABE_JISHO_APP_PATH`.

Il fallback Jiten usa solo le API vocabulary per leggere `pitchAccents`; non
scarica o genera audio.

`--source` limita le fonti da interrogare e puo essere passato piu volte. I
valori supportati sono `kanjium`, `shirabe`, `jiten`, `wiktionary` e `ojad`.
Senza `--source`, il comando usa l'ordine completo sopra.

Se Kanjium trova piu valori e una fonte successiva converge su uno di quei
valori, il fetch salva quel valore con una fonte composita, per esempio
`Kanjium + Jiten`. Se invece il match e fuzzy, per esempio una variante grafica
non presente come alias locale, il risultato resta `review_required`.

Quando compare `review_required`, l'LLM deve valutare i candidati stampati,
consultare un'altra fonte se c'e dubbio, e salvare manualmente `pitch_accent`
in `pronunciations.json` solo quando il valore e giustificato. Il comando non
scrive `miss` per questi casi, quindi restano ritentabili.

## Stati possibili

- `resolved`: una fonte ha risolto il valore; il manifest viene aggiornato.
- `miss`: la entry e stata controllata ma nessuna fonte ha risolto il valore.
- `source_error`: il check non e conclusivo per problemi di rete o risposta; la
  entry va ritentata.
- `review_required`: il comando ha trovato candidati plausibili ma ambigui o
  fuzzy; non viene persistito in `pronunciations.json`.
- `skipped_existing`: l'entry ha gia un `pitch_accent` e non si e usato
  `--refresh`.

## Nota attuale

`pitch_accent` e indipendente dall'audio. Una entry in `pronunciations.json`
puo contenere:

- solo `pitch_accent`;
- `pitch_accent` con `pitch_accent_source` e `pitch_accent_page_url`;
- solo `pitch_accent_status` per tracciare `miss` o `source_error`;
- solo metadati audio;
- entrambi.

Quando il fetch riparte senza `--refresh`:

- le entry `resolved` vengono saltate;
- le entry `miss` vengono saltate, perche sono gia state controllate;
- le entry `source_error` vengono ritentate.

Usa `--retry-misses` quando vuoi riprovare le entry gia marcate `miss`, per
esempio dopo l'aggiunta o l'aggiornamento di una fonte offline o online.
