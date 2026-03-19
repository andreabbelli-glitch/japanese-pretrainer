# Specifica Contenuti Markdown

## 1. Scopo

Definire un formato Markdown stabile e importabile per:

- metadata del media;
- textbook;
- cards.

Il glossary non ha un file sorgente autonomo in v1: viene derivato dalle entita
presenti in textbook e cards.

## 2. Obiettivi del formato

- leggibile e scrivibile a mano;
- abbastanza strutturato da poter essere validato;
- compatibile con git diff e revisione testuale;
- basato su ID stabili;
- estendibile senza rompere gli import esistenti.

## 3. Struttura cartelle

```text
content/
  media/
    <media-slug>/
      media.md
      assets/
        ui/
          deck-edit.webp
        cards/
          abyss-bell.svg
        audio/
          term/
            term-taberu/
              term-taberu.ogg
      textbook/
        001-intro.md
        002-episode-01.md
        003-episode-02.md
      cards/
        001-core-vocab.md
        002-episode-01.md
      pronunciations.json
```

## 4. Regole generali

- Tutti i file devono usare frontmatter YAML.
- Tutti gli ID devono essere stabili nel tempo.
- Gli slug devono essere URL-safe.
- Le chiavi obbligatorie non possono essere omesse.
- I riferimenti devono puntare a ID esistenti oppure l'import deve fallire.
- Il contenuto testuale libero e permesso solo nelle zone previste.
- Gli asset di un media vanno salvati sotto `assets/` nello stesso bundle.

### 4.0 Regola di scope per gli ID editoriali

Per `term` e `grammar`, l'ID scritto nel Markdown e un **ID editoriale locale
al media**.

Regole:

- un `term.id` deve essere unico dentro lo stesso media;
- un `grammar.id` deve essere unico dentro lo stesso media;
- lo stesso `term.id` o `grammar.id` puo comparire anche in altri media del
  workspace, se ogni bundle resta coerente localmente;
- `media`, `lesson`, `cards-file` e `card` restano invece identificati con ID
  stabili del loro namespace.

Implementazione rilevante:

- il Markdown continua a usare l'ID editoriale locale, per esempio
  `term-cost` o `grammar-teiru`;
- il database importa anche una chiave tecnica persistente interna distinta
  dall'ID editoriale;
- la UI continua a trattare il media corrente come verita primaria.

### 4.0.1 Layer cross-media esplicito

In fase 2 esiste un terzo livello distinto dall'ID tecnico e dall'ID
editoriale locale:

- `cross_media_group`

Serve solo per collegare entry locali appartenenti a media diversi quando il
collegamento e intenzionale e dichiarato.

Regole:

- `cross_media_group` e opzionale;
- non sostituisce `term.id` o `grammar.id`;
- non cambia il routing pubblico, che resta `mediaSlug + source_id locale`;
- `meaning_it`, `notes_it`, lesson e card restano sempre locali al media;
- non va usato per unire automaticamente omografi, falsi amici o label UI
  simili ma editorialmente diverse;
- lo stesso `cross_media_group` puo essere riusato solo dallo stesso tipo di
  entry: o tutti `term`, o tutti `grammar`;
- dentro uno stesso media, uno stesso `cross_media_group` deve puntare a una
  sola entry locale per tipo.

Quando usarlo:

- lo stesso termine o pattern ricorre davvero in media diversi;
- vuoi mostrare "compare anche in altri media" nel detail e nella review;
- le sfumature locali restano diverse ma il collegamento editoriale e certo.
- il confronto aggiunge valore didattico reale, non solo somiglianza formale.

Quando non usarlo:

- due entry condividono solo lemma, kanji o reading;
- c'e il dubbio che si tratti di omografia o uso troppo diverso;
- stai cercando un fallback fuzzy per evitare di curare il contenuto.

### 4.1 Regola furigana per testo visibile

Se una stringa giapponese con kanji o composti poco trasparenti e visibile nel
reader, deve portare il furigana anche quando appare:

- come testo normale;
- come label di un link semantico `[...](term:...)` o `[...](grammar:...)`;
- dentro inline code / backtick;
- dentro `caption` dei blocchi `:::image`;
- dentro note, esempi, checklist o spiegazioni.

Quindi non basta che esista una `reading` nella entry glossary: se il testo
mostrato al lettore contiene kanji, la forma visibile deve essere annotata con
`{{base|reading}}` quando la lettura non e banale.

Nei composti misti, il blocco furigana non deve inglobare kana gia visibili.
Annota solo i segmenti che richiedono davvero supporto di lettura, cioe kanji
e numeri.

Da ora, nei contenuti visibili al lettore, anche i numeri vanno annotati in
modo sistematico con la lettura corretta, non solo i casi "difficili".

Esempi:

- `{{4|よん}}`
- `{{5000|ごせん}}`
- `{{-3000|マイナスさんぜん}}`
- `{{3000円|さんぜんえん}}`
- `{{4以下|よんいか}}`

Questo vale anche per pattern misti kana+kanji, non solo per parole tutte in
kanji:

- scrivi `それ{{以外|いがい}}なら`, non `それ以外なら`;
- scrivi `その{{中|なか}}から`, non `その中から`.
- scrivi `{{受|う}}け{{取|と}}る`, non `{{受け取る|うけとる}}`;
- scrivi `{{構築|こうちく}}{{済|ず}}み`, non `{{構築済み|こうちくずみ}}`;
- scrivi `{{読|よ}}み{{込|こ}}み{{中|ちゅう}}`, non
  `{{読み込み中|よみこみちゅう}}`.

### 4.2 Regole di scrittura YAML sicura

Per evitare errori di import, i campi testuali descrittivi dentro frontmatter o
blocchi strutturati devono essere serializzati in modo conservativo.

Regole:

- i campi descrittivi come `notes_it`, `summary`, `description` e `notes`
  dovrebbero usare di default un block scalar `>-`, anche se stanno su una sola
  riga;
- i plain scalar vanno riservati a valori brevi e atomici come `title`,
  `slug`, `lemma`, `reading`, `romaji`, `meaning_it`;
- `front` e `back` delle flashcard non vanno trattati come eccezione: se
  contengono furigana, testo giapponese annotato o rules text, devono essere
  serializzati in modo sicuro;
- se un valore contiene uno qualsiasi di questi elementi, non deve essere
  lasciato come plain scalar:
  - `:` o `：`
  - furigana `{{base|reading}}`
  - link semantici `[...](term:...)` o `[...](grammar:...)`
  - backtick inline
  - frasi complete di testo carta / rules text
- quando c'e dubbio, usare `>-`;
- per valori brevi e monoriga come i lati di una flashcard, la forma piu
  sicura e spesso una stringa quotata `'...'`.

Esempio corretto:

```md
notes_it: >-
  {{山札|やまふだ}} vuol dire deck; nelle carte indica il mazzo da cui peschi.
```

Esempio corretto per `front` di una flashcard:

```md
front: '{{手|て}}{{持|も}}ち'
```

Esempio da evitare:

```md
notes_it: Lettura da fissare: {{山札|やまふだ}}.
```

Esempio da evitare per `front` di una flashcard:

```md
front: {{手持ち|てもち}}
```

### 4.3 Regole per furigana sui numeri

- tutti i numeri visibili al lettore vanno annotati con furigana, anche quando
  sono "semplici" e anche quando non hanno contatori;
- usare quindi `{{1|いち}}`, `{{4|よん}}`, `{{5000|ごせん}}`,
  `{{-3000|マイナスさんぜん}}`, non `1`, `4`, `5000` o `-3000` lasciati nudi;
- se il numero e seguito solo da kanji numerici / qualificatori in kanji
  (`枚`, `本`, `以下`, `以上`, `未満`, ecc.), il furigana puo restare sul chunk
  completo: `{{1枚|いちまい}}`, `{{3本|さんぼん}}`, `{{4以下|よんいか}}`,
  `{{2000以下|にせんいか}}`;
- se dopo il numero compaiono kana gia visibili, il kana resta fuori dal ruby e
  annoti solo i segmenti necessari: `{{2|ふた}}つ`,
  `{{4|よっ}}つ{{以上|いじょう}}`, `{{300|さんびゃく}}ポイント`;
- non scrivere `1{{枚|まい}}`, `4{{以下|いか}}` o
  `{{4つ|よっつ}}{{以上|いじょう}}`;
- quando c'e un contatore, non indovinare mai la lettura per composizione:
  va usata la pronuncia corretta del chunk davvero annotato, per esempio
  `{{1体|いったい}}`, `{{2|ふた}}つ`, `{{2回|にかい}}`, `{{4枚|よんまい}}`;
- se il numero ha segni, unita o suffissi rilevanti, annota almeno tutta la
  parte non trasparente: `{{-3000|マイナスさんぜん}}`, `{{3000円|さんぜんえん}}`,
  `{{300|さんびゃく}}ポイント`, `{{2000以下|にせんいか}}`.

### 4.4 Regola di qualita esplicativa

Ogni spiegazione libera in `textbook/` o in `notes_it` deve fare piu che dire
che un termine o un pattern e "utile", "importante" o "da fissare".

Minimo richiesto:

- chiarire che cosa vuol dire davvero l'elemento giapponese nel corpus;
- chiarire che cosa ti fa capire, distinguere o fare quando compare nel media;
- se l'elemento compare dentro un composto, distinguere il significato del
  singolo componente da quello del label intero;
- se l'elemento e un nome proprio opaco, spiegare almeno quale ruolo ricorrente
  segnala o quali componenti del nome conviene riconoscere.

Esempi da evitare:

- `{{編成|へんせい}}` e un kanji utile da fissare.
- `または` e importante nel rules text.

Esempi accettabili:

- in `デッキ{{編成|へんせい}}`, `デッキ` nomina il mazzo e `{{編成|へんせい}}`
  aggiunge l'idea di organizzazione / composizione; il composto intero indica la
  schermata di deckbuilding.
- `または` vuol dire "oppure", ma nelle carte collega due categorie che valgono
  entrambe per lo stesso filtro.

### 4.4.1 Regola per micro-elementi strutturali

Quando selezioni nuove entry o nuove flashcard, non fermarti a kanji vistosi,
keyword appariscenti o chunk lunghi di rules text.

Se un elemento piccolo ma frequente controlla davvero la lettura della frase,
puo meritare una entry e una card dedicate, purché non esista gia una copertura
equivalente nello stesso media.

Casi tipici:

- marcatori di scope o totalita come `すべて`, `各`, `全部`;
- riprese referenziali come `それ`, `それら`, `その中`;
- filtri o snodi che cambiano davvero il parsing operativo della frase.

Regola pratica:

- se senza quell'elemento leggeresti male bersagli, quantita, referente o
  insieme colpito, trattalo come candidato serio da glossary/review;
- se esiste gia una entry che copre davvero lo stesso compito di lettura, riusa
  quella invece di duplicare.

### 4.5 Regola anti-meta-editoriale

Il contenuto finale non deve parlare del proprio processo di produzione,
revisione o studio.

Da evitare nel textbook e in `notes_it`:

- "questa lesson";
- "qui il punto e";
- "conviene fissare / mettere in review";
- "per questo batch / per questo test";
- "la fonte ufficiale dice..." come frase principale della spiegazione.
- `Da qui in poi questa pagina non e piu una monografia su una sola carta:
  diventa l'archivio progressivo delle carte che incontro davvero durante il
  gioco.`
- `Il punto piu importante non e la keyword offensiva in se, ma il blocco
  タップ状態でいたら: qui non basta sapere cos'e タップ, bisogna riconoscere lo
  stato gia presente nel momento del controllo.`

### 4.6 Regola di correttezza dell'italiano

Tutto il testo italiano finale nei contenuti importabili deve essere
grammaticalmente corretto e ortograficamente rifinito.

Regole minime:

- usa gli accenti corretti (`è`, `può`, `più`, `già`, `cioè`, `così`,
  `perché`);
- non usare apostrofi o forme ASCII degradate al posto degli accenti richiesti;
- vale per `summary`, `meaning_it`, `notes_it`, `example_it`, caption, alt
  text e prosa libera del textbook.

Un contenuto formalmente valido ma scritto in italiano scorretto non e
accettabile.

### 4.7 Regola obiettivo flashcard

Le flashcard servono prima di tutto, e in modo prioritario, a imparare il
giapponese.

Questa e la regola primaria del sistema:

- lo scopo principale non e memorizzare regole del gioco;
- lo scopo principale e fissare parole giapponesi importanti e pattern
  grammaticali importanti;
- la priorita va al giapponese piu spendibile e riusabile possibile, non al
  dettaglio piu verticale del singolo media;
- se devi scegliere tra una card di meccanica e una card di giapponese, scegli
  la card di giapponese.

Quindi una `:::card` e giustificata quando allena almeno uno di questi aspetti:

- riconoscimento di kanji o letture importanti;
- lessico o chunk giapponesi importanti e riusabili;
- pattern grammaticali importanti che aiutano a leggere altre frasi del corpus;
- termini che hanno buona spendibilita anche fuori da una singola scena,
  schermata, decklist o prodotto;
- un chunk effetto completo, ma solo se il valore didattico sta nella sua forma
  giapponese e non in un riassunto astratto della regola.

Regola complementare:

- se un termine, una keyword o una sigla serve per capire il media corrente o
  per interagirci correttamente ma non ha abbastanza valore di riuso, spiegalo
  nel textbook e non forzarlo in flashcard.

Da evitare:

- flashcard che insegnano solo "cosa fa la carta" senza allenare una forma
  giapponese precisa;
- back che riassumono la regola di gioco ma non aiutano a leggere il testo;
- chunk creati solo per memorizzare la meccanica, senza valore su kanji,
  lessico o grammatica.
- flashcard di puro katakana quando il contenuto non allena altro oltre alla
  semplice traslitterazione.
- flashcard su sigle, acronimi, codici prodotto, nomi evento o dettagli che
  spiegano il singolo media ma non costruiscono literacy generale.
- scelte che lasciano fuori una parola giapponese importante o un pattern
  grammaticale importante per fare spazio a una card di sola meccanica.

Eccezione stretta:

- una card su katakana puro ha senso solo se il termine e davvero opaco,
  ricorrente e necessario per leggere il corpus, e se la card allena anche il
  suo ruolo o uso concreto, non solo la pronuncia.

Se una fonte serve, va usata solo per sostenere una spiegazione sul testo, sulla
regola o sulla schermata. La frase visibile all'utente deve restare centrata su:

- che cosa significa il giapponese;
- che cosa succede nel gioco / nell'interfaccia;
- quale contrasto o ambiguita conviene sciogliere.

Se stai per scrivere una frase simile agli ultimi due anti-esempi, fermati e
riscrivila come parsing concreto di:

- forma grammaticale;
- condizione;
- timing;
- soggetto / bersaglio;
- effetto operativo.

## 5. `media.md`

Definisce il contenitore del media.

Esempio:

```md
---
id: media-sample-anime
slug: sample-anime
title: Sample Anime
media_type: anime
segment_kind: episode
language: ja
base_explanation_language: it
status: active
---

# Sample Anime

Lessico e dialoghi ricorrenti della serie.
```

Campi obbligatori:

- `id`
- `slug`
- `title`
- `media_type`
- `segment_kind`
- `language`
- `base_explanation_language`

Campi opzionali:

- `subtitle`
- `description`
- `tags`
- `cover_image`
- `notes`

Note:
- `description` viene mostrato direttamente nell'UI del media; se contiene
  giapponese learner-facing, puo usare furigana `{{base|reading}}`.

## 6. File textbook

Ogni file in `textbook/` rappresenta una lesson.

Anche nel textbook la priorita resta insegnare il giapponese. Il media, il
gioco o la scena servono come contesto per chiarire significato, funzione e
conseguenza pratica del testo, non come obiettivo principale autonomo.

Esempio:

```md
---
id: lesson-sample-anime-ep01-intro
media_id: media-sample-anime
slug: ep01-intro
title: Episodio 1 - Introduzione
order: 10
segment_ref: episode-01
difficulty: n5
status: active
summary: >-
  Riconoscere 食べる, 大丈夫 e 魔法 come lessico di azione, rassicurazione e causa in una scena
  fantasy.
---

# Obiettivo

Capire quando il dialogo parla di mangiare, rassicurare qualcuno o attribuire
un evento alla magia.

## Contesto

In una scena fantasy iniziale questi tre elementi non stanno sullo stesso
piano: [食べる](term:term-taberu) descrive l'azione concreta, [大丈夫](term:term-daijoubu)
controlla se la situazione e sotto controllo, {{魔法|まほう}} spiega invece la
causa soprannaturale di cio che succede.

## Termini chiave

- [食べる](term:term-taberu)
- [大丈夫](term:term-daijoubu)

## Spiegazione

[食べる](term:term-taberu) indica l'azione di mangiare. In dialogo non serve
solo a nominare il cibo: spesso distingue cio che viene davvero consumato da
un semplice invito o da un'offerta.

[大丈夫](term:term-daijoubu) qui non va letto come formula vaga positiva. Di
solito segnala che qualcuno sta verificando se va tutto bene o se un problema e
gestibile.

{{魔法|まほう}} non va trattato come decorazione fantasy generica. Quando
compare, di solito ti dice che la causa dell'evento non e fisica o ordinaria,
ma soprannaturale.

## Nota finale

Quando questi elementi compaiono vicini, la scena alterna spesso azione
pratica, verifica dello stato e spiegazione della causa.
```

Questo esempio serve a mostrare il livello minimo di sostanza atteso: niente
meta-discorso, niente frasi del tipo "e utile/importante", sempre significato +
funzione concreta.

Campi obbligatori:

- `id`
- `media_id`
- `slug`
- `title`
- `order`

Campi opzionali:

- `segment_ref`
- `difficulty`
- `tags`
- `status`
- `summary`
- `prerequisites`

## 7. File cards

Ogni file in `cards/` contiene una o piu card dichiarate come blocchi
strutturati.

Esempio:

```md
---
id: cards-sample-anime-ep01
media_id: media-sample-anime
slug: ep01-cards
title: Episodio 1
order: 10
segment_ref: episode-01
---

:::card
id: card-taberu-recognition
entry_type: term
entry_id: term-taberu
card_type: recognition
front: '{{食|た}}べる'
back: mangiare
example_jp: >-
  パンを{{食|た}}べる。
example_it: >-
  Mangio il pane.
tags: [verb, core]
:::

:::card
id: card-teiru-core
entry_type: grammar
entry_id: grammar-teiru
card_type: concept
front: ～ている
back: azione in corso / stato risultante
example_jp: >-
  いまカードを{{見|み}}ている。
example_it: >-
  In questo momento sto guardando la carta.
tags: [grammar, core]
:::
```

Campi frontmatter obbligatori:

- `id`
- `media_id`
- `slug`
- `title`
- `order`

Ogni blocco `:::card` deve contenere:

- `id`
- `entry_type`
- `entry_id`
- `card_type`
- `front`
- `back`
- `example_jp`
- `example_it`

Regola review obbligatoria per `:::card`:

- ogni card deve avere sia `example_jp` sia `example_it`;
- i due campi si compilano sempre insieme e non vanno omessi;
- `example_jp` deve essere una frase giapponese completa e contestuale, non una
  parola isolata, non una pseudo-definizione e non una semplice ripetizione del
  `front`;
- `example_jp` deve essere centrata il piu possibile sul media attuale: la frase
  deve usare il contesto, il lessico e le situazioni del media in cui la card
  vive, non scenari generici scollegati;
- `example_jp` non deve contenere kanji che non hanno una flashcard associata nel
  corpus di studio (indipendentemente dal media e dallo stato di studio della
  card); anticipare leggermente e ammesso, usare kanji completamente fuori dal
  corpus no;
- `example_it` deve tradurre quella stessa frase in italiano in modo utile per
  il retro review.
- `front` e `example_jp` devono usare i furigana ogni volta che compare un
  kanji che il learner deve davvero leggere.
- Se in `notes_it` citi giapponese con kanji come parte del punto didattico,
  annotalo con furigana anche li.
- Nei composti misti, lascia fuori dal ruby i kana gia visibili:
  `{{受|う}}け{{取|と}}る`, `{{手|て}}{{持|も}}ち`, `メイン{{枠|わく}}`.
- Per numeri con contatori o qualificatori, annota il chunk corretto senza
  inglobare kana gia visibili: `{{1枚|いちまい}}`, `{{1体|いったい}}`,
  `{{2|ふた}}つ`, `{{2回|にかい}}`, `{{4以下|よんいか}}`,
  `{{4|よっ}}つ{{以上|いじょう}}`.
- Non inferire in modo meccanico le letture dei contatori: vanno sempre
  verificate e scritte nella forma corretta.
- Il valore review della card deve restare linguistico: la carta deve aiutare a
  leggere kanji, lessico o grammatica giapponese, non solo a ricordare una
  regola del gioco.
- Se una sezione introduce un pattern grammaticale importante o una parola
  giapponese importante che non e ancora coperta, la default action e creare la
  flashcard relativa.
- Una card con `front` in puro katakana non e di default una buona card: va
  evitata se non allena anche un uso ricorrente, una distinzione utile nel
  corpus o un reale ostacolo di lettura.

Campi opzionali del blocco `:::card`:

- `notes_it`
- `tags`

## 8. Entita dichiarabili nel contenuto

Per generare il glossary servono entita canoniche. In v1 sono supportate due
tipologie minime:

- `term`
- `grammar`

Le entita possono essere dichiarate in textbook o cards tramite blocchi
strutturati.

### 8.1 Blocco `term`

```md
:::term
id: term-taberu
cross_media_group: shared-taberu-core
lemma: 食べる
reading: たべる
romaji: taberu
pos: ichidan-verb
meaning_it: mangiare
notes_it: >-
  Verbo di base molto frequente.
level_hint: n5
aliases: [たべる, taberu]
audio_src: assets/audio/term/term-taberu/term-taberu.ogg
audio_source: lingua_libre
audio_speaker: Example Speaker
audio_license: CC BY-SA 4.0
audio_attribution: Example Speaker via Lingua Libre / Wikimedia Commons
audio_page_url: https://commons.wikimedia.org/wiki/File:LL-Q188_(jpn)-Example_Speaker-%E9%A3%9F%E3%81%B9%E3%82%8B.ogg
:::
```

Campi obbligatori:

- `id`
- `lemma`
- `reading`
- `romaji`
- `meaning_it`

Campi opzionali:

- `pos`
- `cross_media_group`
- `meaning_literal_it`
- `notes_it`
- `level_hint`
- `aliases`
- `segment_ref`
- `audio_src`
- `audio_source`
- `audio_speaker`
- `audio_license`
- `audio_attribution`
- `audio_page_url`

Regole audio:

- l'audio e opzionale;
- se presente, `audio_src` deve puntare a un file locale sotto `assets/`;
- sono ammessi `mp3`, `ogg`, `wav`, `m4a`;
- `audio_source`, `audio_speaker`, `audio_license`, `audio_attribution` e
  `audio_page_url` sono metadata opzionali di provenance;
- se compare qualunque metadata audio, `audio_src` deve esistere e il file deve
  essere presente nel bundle locale;
- non usare TTS o placeholder sintetici.

### 8.2 Blocco `grammar`

```md
:::grammar
id: grammar-teiru
cross_media_group: shared-progressive-state
pattern: ～ている
title: Forma in -te iru
meaning_it: azione in corso o stato risultante
notes_it: >-
  Compare molto spesso nel parlato e nei testi descrittivi.
level_hint: n4
audio_src: assets/audio/grammar/grammar-teiru/grammar-teiru.mp3
audio_source: wikimedia_commons
audio_speaker: Example Speaker
audio_license: CC BY 4.0
:::
```

Campi obbligatori:

- `id`
- `pattern`
- `title`
- `meaning_it`

Campi opzionali:

- `cross_media_group`
- `notes_it`
- `level_hint`
- `aliases`
- `segment_ref`
- `audio_src`
- `audio_source`
- `audio_speaker`
- `audio_license`
- `audio_attribution`
- `audio_page_url`

### 8.3 Blocco `example_sentence`

Usalo quando vuoi mostrare una frase giapponese completa con traduzione
italiana collassabile nel reader.

```md
:::example_sentence
jp: >-
  {{自分|じぶん}}の{{墓地|ぼち}}からクリーチャーを{{1体|いったい}}{{出|だ}}す。
translation_it: >-
  Metti in gioco 1 creatura dal tuo cimitero.
:::
```

Campi obbligatori:

- `jp`
- `translation_it`

### 8.4 Blocco `image`

Usalo nel textbook quando una schermata, una carta o un dettaglio visivo aiuta
davvero la lettura.

```md
:::image
src: assets/ui/deck-edit.webp
alt: Schermata di deckbuilding nell'app Duel Masters Play's.
caption: >-
  Qui il label [{{編成|へんせい}}](term:term-formation) compare nella UI di
  deckbuilding.
:::
```

Campi obbligatori:

- `src`
- `alt`

Campi opzionali:

- `caption`

Regole:

- `src` deve essere un path relativo al media bundle e deve iniziare con
  `assets/`;
- il file deve esistere davvero sotto `content/media/<slug>/assets/`;
- sono ammessi formati immagine comuni: `png`, `jpg`, `jpeg`, `webp`, `gif`,
  `svg`, `avif`;
- `alt` resta testo semplice: non supporta furigana o riferimenti semantici,
  quindi evita kanji nudi e preferisci una descrizione italiana o una lettura
  in kana / katakana;
- `caption`, se presente, supporta furigana e riferimenti semantici inline;
- `caption` e testo visibile nel reader: se contiene kanji, annotali con
  furigana; se richiama una entry glossary / flashcard, collega il termine e
  annota anche il label visibile quando contiene kanji;
- il blocco `image` e ammesso nel textbook, non nei file `cards/`.

## 9. Riferimenti semantici inline

Per attivare tooltip e linking si usano link con schema custom.

Sintassi:

```md
[食べる](term:term-taberu)
[～ている](grammar:grammar-teiru)
```

Regole:

- il target deve esistere;
- il renderer sostituisce il link con un componente interattivo;
- il componente apre tooltip su desktop e sheet su mobile.

## 10. Furigana inline

Sintassi v1:

```md
{{日本語|にほんご}}
{{大丈夫|だいじょうぶ}}
```

Regole:

- il parser converte in nodi `ruby`;
- il testo base resta sempre disponibile;
- la visualizzazione dipende dalla preferenza utente;
- nei composti misti, `base` deve contenere solo i segmenti che richiedono
  davvero ruby, non i kana gia visibili;
- quindi scrivi `{{受|う}}け{{取|と}}る` e `{{2|ふた}}つ`, non
  `{{受け取る|うけとる}}` o `{{2つ|ふたつ}}`;
- la sintassi e valida anche dentro paragrafi o liste.

## 11. Glossary derivato

Il glossary viene costruito unendo:

- entita `term` dichiarate nei file;
- entita `grammar` dichiarate nei file;
- riferimenti da lesson e cards;
- metadata di card e segmenti;
- eventuale metadata audio locale.

Per ogni entry del glossary il sistema deve poter risalire a:

- file sorgente;
- lesson di introduzione;
- cards collegate;
- segmenti collegati;
- alias di ricerca.

## 11.1 Manifest opzionale `pronunciations.json`

Per l'enrichment offline e disponibile un manifest JSON opzionale nel root del
bundle media. Serve soprattutto per salvare audio scaricato via CLI senza
riscrivere i blocchi Markdown editoriali.

Formato minimo:

```json
{
  "version": 1,
  "entries": [
    {
      "entry_type": "grammar",
      "entry_id": "grammar-teiru",
      "audio_src": "assets/audio/grammar/grammar-teiru/grammar-teiru.mp3",
      "audio_source": "wikimedia_commons",
      "audio_speaker": "Example Speaker",
      "audio_license": "CC BY 4.0",
      "audio_attribution": "Example Speaker via Wikimedia Commons",
      "audio_page_url": "https://commons.wikimedia.org/wiki/File:Ja-%E3%81%A6%E3%81%84%E3%82%8B.mp3"
    }
  ]
}
```

Regole:

- `entry_type` deve essere `term` o `grammar`;
- `entry_id` usa l'ID editoriale locale del blocco sorgente;
- il manifest integra i campi audio del Markdown;
- se Markdown e manifest definiscono la stessa entry, il Markdown ha priorita
  sui campi gia presenti;
- il manifest viene validato durante `content:validate` e `content:import`.

## 12. Regole di import

- Import fallisce se manca un campo obbligatorio.
- Import fallisce se ci sono ID duplicati nello stesso namespace locale.
- Import fallisce se un riferimento inline punta a un ID inesistente.
- Import fallisce se due entita con lo stesso ID editoriale nello stesso media
  hanno campi incompatibili.
- Import aggiorna il contenuto senza azzerare gli stati review esistenti.
- I link semantici `term:...` e `grammar:...` vengono risolti nel contesto del
  media corrente.

## 13. Regole di naming

- prefisso suggerito per media: `media-`
- prefisso suggerito per lesson: `lesson-`
- prefisso suggerito per term: `term-`
- prefisso suggerito per grammar: `grammar-`
- prefisso suggerito per card: `card-`
- formato suggerito per `cross_media_group`: slug descrittivo ASCII, per esempio
  `shared-taberu-core` o `shared-progressive-state`
- convenzione pratica consigliata per il corpus reale: prefisso del tipo +
  nucleo condiviso, per esempio `term-shared-ranked-match` o
  `grammar-shared-progressive-state`

Esempio:

- `media-sample-anime`
- `lesson-sample-anime-ep01-intro`
- `term-taberu`
- `grammar-teiru`
- `card-taberu-recognition`

## 14. Vincoli v1

- Nessun HTML libero obbligatorio.
- Nessuna logica condizionale nel Markdown.
- Nessuna definizione implicita basata solo sul testo libero.
- Nessun riferimento senza ID.

## 15. Estensioni future possibili

- `sentence` come entita canonica esplicita;
- workflow piu ricchi e automatizzati per audio e immagini;
- note grammaticali piu ricche;
- campi di frequency / priority;
- deck dinamici e card generate;
- sync con dizionari esterni.

## 16. Decisione pratica per v1

Per partire velocemente:

- le `cards` sono la sede preferita per definire le entita canoniche;
- il `textbook` dovrebbe di norma referenziare entita gia dichiarate;
- il `textbook` puo comunque dichiarare entita nuove quando necessario;
- il glossary nasce dalla fusione delle entita dichiarate e dei riferimenti;
- se una entry e critica per il glossary, va dichiarata esplicitamente come
  `term` o `grammar`, non solo nominata nel testo.
- se una entry locale compare anche in altri media con collegamento editoriale
  certo, aggiungi `cross_media_group` invece di riusare o forzare un ID
  globale.
