# Wireframe Low-Fi

## Nota d'uso

Questi wireframe sono contratti di layout e priorita, non mockup finali. Le
proporzioni sono indicative, ma la gerarchia, la posizione dei controlli
principali e i pattern desktop/mobile vanno mantenuti.

Legenda rapida:

- `[CTA]` azione primaria o secondaria
- `(chip)` filtro o stato
- `{sheet}` pannello mobile
- `*sticky*` elemento persistente durante lo scroll

## 1. Dashboard

### Desktop

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Top bar: logo | Home | Media | Review | Settings                 Profilo    │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────── Oggi sul tavolo ─────────────────────┬───────────┐
│ Frieren                                                          │ Review    │
│ Episodio 1 - Introduzione                                        │ 18 dovute │
│ Riprendi dal paragrafo "Termini chiave"                          │ 7 nuove   │
│ [Riprendi studio] [Apri glossary]                                │ ~12 min   │
│ 42% textbook  |  67 entry viste  |  12 due oggi                  │ [Avvia]   │
└───────────────────────────────────────────────────────────────────┴───────────┘

┌──────────────────────────── Media attivi ────────────────────────────────────┐
│ [Card media 1]   [Card media 2]   [Card media 3]                            │
│ titolo           titolo           titolo                                     │
│ ultima lesson    prossima review  stato generale                             │
└───────────────────────────────────────────────────────────────────────────────┘

┌──────────────────── Progressi calmi ────────────────────┬────────────────────┐
│ Textbook  [bar sottile] 42%                            │ Ultime attivita     │
│ Glossary  [bar sottile] 67/140                         │ - 3 card ripassate  │
│ Review    [bar sottile] 128 mature / 12 due            │ - 1 lesson chiusa   │
└─────────────────────────────────────────────────────────┴────────────────────┘
```

### Mobile

```text
┌────────────────────────────┐
│ Top bar: logo        ⚙     │
└────────────────────────────┘

┌──── Oggi sul tavolo ───────┐
│ Frieren                    │
│ Riprendi da Episodio 1     │
│ [Riprendi studio]          │
│ 42% textbook               │
└────────────────────────────┘

┌──── Review di oggi ────────┐
│ 18 dovute · ~12 min        │
│ [Avvia review]             │
└────────────────────────────┘

┌──── Media attivi ──────────┐
│ [Card media 1]             │
│ [Card media 2]             │
└────────────────────────────┘

┌──── Progressi ─────────────┐
│ Textbook [bar]             │
│ Glossary [bar]             │
│ Review   [bar]             │
└────────────────────────────┘

┌────────────────────────────┐
│ Bottom nav: Home Media Review Settings │
└────────────────────────────┘
```

### Note

- La dashboard ha una sola CTA primaria sopra la piega.
- Le metriche non competono con il resume card.
- Su mobile ogni blocco e autonomo, non compresso in una griglia miniaturizzata.

## 2. Media Detail Page

### Desktop

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Top bar globale                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────── Header media ──────────────────────────────────┐
│ Frieren                         anime · 12 lesson · attivo                   │
│ Pacchetto di studio fantasy con focus su lessico e pattern ricorrenti       │
│ Continua da: Episodio 1 - Introduzione                                      │
└──────────────────────────────────────────────────────────────────────────────┘

┌───────────────┬───────────────┬───────────────┬─────────────────────────────┐
│ Textbook      │ Glossary      │ Review        │ Progress                    │
│ ultima lesson │ 140 entry     │ 18 dovute     │ 42% / 67 / 128 mature      │
│ [Apri]        │ [Apri]        │ [Avvia]       │ [Apri]                      │
└───────────────┴───────────────┴───────────────┴─────────────────────────────┘

┌──────────────────────── Lesson e segmenti ───────────────┬──────────────────┐
│ Segmento 1                                               │ Entry recenti     │
│ > Ep01 Introduzione                                      │ 食べる            │
│   Ep02 Dialoghi base                                     │ 大丈夫            │
│ Segmento 2                                               │ ～ている          │
│   Ep03 ...                                               │ [Apri glossary]   │
└───────────────────────────────────────────────────────────┴──────────────────┘
```

### Mobile

```text
┌────────────────────────────┐
│ Back          Frieren   ⋯  │
└────────────────────────────┘

┌──── Header media ──────────┐
│ Frieren                    │
│ anime · 12 lesson          │
│ Continua da Ep01           │
└────────────────────────────┘

┌──── Entry point ───────────┐
│ [Textbook]                 │
│ [Glossary]                 │
│ [Review]                   │
│ [Progress]                 │
└────────────────────────────┘

┌──── Segmenti ──────────────┐
│ > Ep01 Introduzione        │
│   Ep02 Dialoghi base       │
└────────────────────────────┘

┌──── Entry recenti ─────────┐
│ 食べる                     │
│ ～ている                   │
└────────────────────────────┘
```

### Note

- Gli entry point restano card o righe grandi, non tab stretti.
- La pagina deve rispondere a "cosa faccio adesso?" prima che a "quanti dati ho?".

## 3. Textbook Reader

### Desktop

```text
┌──────────────────────────────── *sticky study header* ───────────────────────┐
│ Back | Frieren / Textbook             Ep01 - Introduzione                    │
│ 2/12 lesson lette                    [Off][Hover][On]         [Completa]     │
└───────────────────────────────────────────────────────────────────────────────┘

┌────────────── *sticky rail* ──────────────┬──────────── Reader article ──────┐
│ Segmento 1                                │ # Obiettivo                       │
│ > Ep01 Introduzione                       │ In questa lezione vediamo...      │
│   Ep02 Dialoghi base                      │                                   │
│                                           │ ## Termini chiave                 │
│ Segmento 2                                │ - 食べる  - 大丈夫               │
│   Ep03 ...                                │                                   │
│                                           │ La forma 魔法 ricorre spesso...   │
│ 42% textbook                              │                                   │
│ [Apri tutte le lesson]                    │ [callout grammaticale]            │
│                                           │                                   │
│                                           │ [Prev]                [Next]      │
└───────────────────────────────────────────┴───────────────────────────────────┘

                 ┌──────────── Hover card / click lock ─────────────┐
                 │ 食べる                                            │
                 │ たべる · taberu                                   │
                 │ mangiare                                          │
                 │ verbo ichidan                                     │
                 │ stato: in review                                  │
                 │ [Apri entry]                                      │
                 └───────────────────────────────────────────────────┘
```

### Mobile

```text
┌────────────────────────────┐
│ Back        Ep01       ⋯   │
└────────────────────────────┘

┌──────── *sticky strip* ────┐
│ [Lezioni]  [Furigana: On]  │
│ 2/12 lette                 │
└────────────────────────────┘

┌──────── Reader article ────┐
│ # Obiettivo                │
│ In questa lezione...       │
│                            │
│ 食べる  大丈夫             │
│                            │
│ [callout grammaticale]     │
└────────────────────────────┘

┌──────── Footer lesson ─────┐
│ [Prev]      [Completa]     │
│             [Next]         │
└────────────────────────────┘
```

### Mobile sheet per token

```text
{sheet}
┌────────────────────────────┐
│ handle                     │
│ 食べる                     │
│ たべる · taberu            │
│ mangiare                   │
│ stato: in review           │
│ note / categoria           │
│                            │
│ [Apri entry] [Gia noto]    │
└────────────────────────────┘
```

### Mobile sheet per lesson rail

```text
{sheet}
┌────────────────────────────┐
│ handle                     │
│ Lezioni                    │
│ > Ep01 Introduzione        │
│   Ep02 Dialoghi base       │
│   Ep03 ...                 │
└────────────────────────────┘
```

### Note

- Il reader desktop usa rail + colonna di lettura; niente tre pannelli obbligati.
- Il token attivo deve essere visibile anche senza tooltip aperto.
- Il footer lesson compare come chiusura naturale del flusso, non come toolbar fissa costante.
- Su mobile il controllo furigana resta sempre raggiungibile dalla study strip.

## 4. Glossary

### Desktop

```text
┌────────────────────────────── *sticky search bar* ───────────────────────────┐
│ Cerca: [ 食べる / taberu / mangiare ____________________ ] (segmento) (stato)│
└───────────────────────────────────────────────────────────────────────────────┘

┌──────────── Risultati ────────────┬──────────── Preview detail ──────────────┐
│ 24 risultati                      │ 食べる                                    │
│                                   │ たべる · taberu                           │
│ > 食べる                          │ mangiare                                  │
│   たべる · verbo                  │ introdotto in Ep01                        │
│   stato: in review                │ note / alias / esempi                     │
│                                   │                                           │
│   大丈夫                          │ Lesson collegate                          │
│   だいじょうぶ                    │ - Ep01 Introduzione                       │
│                                   │ Card collegate                            │
│                                   │ - recognition                             │
└───────────────────────────────────┴───────────────────────────────────────────┘
```

### Mobile

```text
┌────────────────────────────┐
│ Back        Glossary    ⚙  │
└────────────────────────────┘

┌──── Ricerca ───────────────┐
│ [ cerca lemma/romaji... ]  │
│ (tutti) (segmento) (stato) │
└────────────────────────────┘

┌──── Risultati ─────────────┐
│ 食べる                     │
│ たべる · mangiare          │
│ intro: Ep01                │
│ stato: in review           │
├────────────────────────────┤
│ ～ている                   │
│ azione in corso            │
└────────────────────────────┘
```

### Mobile detail entry

```text
┌────────────────────────────┐
│ Back        食べる      ⋯   │
└────────────────────────────┘

┌──── Entry header ──────────┐
│ 食べる                     │
│ たべる · taberu            │
│ mangiare                   │
│ stato: in review           │
└────────────────────────────┘

┌──── Collegamenti ──────────┐
│ Lesson: Ep01               │
│ Card: recognition          │
└────────────────────────────┘
```

### Note

- Su desktop il split view accelera lookup e confronto.
- Su mobile il detail non deve vivere in una colonna compressa: meglio route o sheet piena.
- I filtri si leggono come strumenti di studio, non come faccette da catalogo.

## 5. Review Session

### Desktop, stato A: prima del reveal

```text
┌──────────────────────────── Session header ──────────────────────────────────┐
│ Review di oggi                         8 / 18                    [Esci]       │
│ progress bar sottile                                                     ⋯    │
└───────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────── Review stage ──────────────────────────────────┐
│ 食べる                                                                      │
│                                                                              │
│ frase o prompt opzionale                                                     │
│                                                                              │
│                                            [Mostra risposta]                 │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Desktop, stato B: risposta visibile

```text
┌────────────────────────────── Review stage ──────────────────────────────────┐
│ 食べる                                                                      │
│ たべる · taberu                                                             │
│ mangiare                                                                    │
│ nota breve / pattern                                                        │
└───────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────── Answer dock ───────────────────────────────────┐
│ [Again  <10m] [Hard  1g] [Good  3g] [Easy  6g]                              │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Mobile, stato A: prima del reveal

```text
┌────────────────────────────┐
│ 8 / 18             [Esci]  │
│ progress bar              │
└────────────────────────────┘

┌──────── Review stage ──────┐
│ 食べる                     │
│                            │
│ prompt opzionale           │
└────────────────────────────┘

┌──── *sticky action dock* ──┐
│ [Mostra risposta]          │
└────────────────────────────┘
```

### Mobile, stato B: risposta visibile

```text
┌──────── Review stage ──────┐
│ 食べる                     │
│ たべる · taberu            │
│ mangiare                   │
│ nota breve                 │
└────────────────────────────┘

┌──── *sticky grading dock* ─┐
│ [Again <10m] [Hard 1g]     │
│ [Good 3g ] [Easy 6g]       │
└────────────────────────────┘
```

### Secondary actions

```text
{sheet/menu}
┌────────────────────────────┐
│ Segna come gia noto        │
│ Reset card                 │
│ Sospendi                   │
└────────────────────────────┘
```

### Note

- `Mostra risposta` e l'unica azione primaria prima del reveal.
- I quattro voti devono comparire tutti insieme, con intervalli leggibili.
- Su mobile il dock grading 2x2 e una scelta intenzionale: evita quattro pillole troppo strette in fila.
- Le azioni distruttive o definitive non stanno mai vicine ai voti principali.
