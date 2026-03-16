---
id: lesson-<media-slug>-<segment-slug>-<lesson-slug>
media_id: media-<media-slug>
slug: <lesson-slug>
title: <titolo-lesson>
order: <numero-ordine>
segment_ref: <segment-ref>
difficulty: <n5|n4|n3|custom>
status: active
tags: [<tag-1>, <tag-2>]
prerequisites: []
summary: >-
  <Una frase (max 160 caratteri) che descrive il risultato concreto di lettura.
  Viene mostrata nella card del textbook e nell'header della pagina.
  Se assente, il sistema genera automaticamente un excerpt dal corpo
  del documento (tagliato a 400 caratteri): meglio scriverla a mano. Non
  parlare del batch, della lesson come oggetto editoriale o del workflow.>
---

# Obiettivo

<Spiega in italiano quale testo, schermata o carta il lettore sapra leggere
meglio dopo questa lesson. Non parlare della lesson come prodotto editoriale
("questa lesson inaugura...", "qui faremo review..."): vai subito sul
giapponese e sul gioco.>

## Contesto

<Spiega in italiano in quale contesto del media compaiono questi termini o
pattern. Descrivi scena, carta, schermata o regola di gioco; evita meta-discorso
sul processo editoriale, sulla raccolta fonti o sul batch.>

## Termini chiave

- [<termine-1>](term:<term-id-1>)
- [<termine-2>](term:<term-id-2>)

## Pattern grammaticali chiave

- [<pattern-1>](grammar:<grammar-id-1>)
- [<pattern-2>](grammar:<grammar-id-2>)

## Spiegazione

<Testo libero in italiano. Usa riferimenti semantici quando richiami termini o
grammar gia dichiarati. Ogni blocco deve chiarire che cosa significa davvero
l'elemento giapponese e che cosa ti fa capire o fare nel media. Non basta
scrivere che e "utile" o "importante". Quando serve, usa questa sequenza:
forma giapponese -> significato letterale o tecnico -> effetto concreto nel
gioco / nell'interfaccia -> contrasto con la lettura sbagliata piu probabile.
Evita formule meta come "qui il punto", "conviene fissare", "cosa mandare in
review", "per questa pagina" o "per questo batch".>

Scrivi sempre in italiano naturale e corretto: usa gli accenti giusti (`è`,
`può`, `più`, `già`, `cioè`, `così`, `perché`), non sostituirli con apostrofi o
forme ASCII degradate.

Se proponi flashcard, ricordati che devono servire prima di tutto a imparare il
giapponese. La priorita e fissare parole giapponesi importanti e pattern
grammaticali importanti: kanji, lessico riusabile e grammatica. Non proporre
card che riassumono soltanto la meccanica del gioco senza un vero target
linguistico.
Evita anche card di puro katakana se non c'e un motivo forte di lettura:
vanno bene solo quando il termine e davvero ricorrente, opaco o rilevante nel
corpus, non quando e soltanto facilmente traslitterabile.

Anti-esempi da non usare mai:

- `Tre schermate reali mostrano in modo operativo il flusso di reclamo reward.`
- `In DM25-SD1 il testo Abyss mostra bene una sequenza tipica...`
- `Lo starter deck e una buona base di lettura operativa...`
- `Questo modulo usa tre schermate reali...`
- `Da qui in poi questa pagina non e piu una monografia su una sola carta: diventa l'archivio progressivo delle carte che incontro davvero durante il gioco.`
- `Il punto piu importante non e la keyword offensiva in se, ma il blocco タップ状態でいたら: qui non basta sapere cos'e タップ, bisogna riconoscere lo stato gia presente nel momento del controllo.`

Perche sono sbagliati:

- spiegano la lesson o il materiale scelto invece del giapponese;
- spiegano la pagina invece del giapponese;
- dicono che qualcosa e importante senza aprire la grammatica;
- non mostrano come si legge davvero la frase.

Forma corretta attesa:

- `タップ状態` = sintagma nominale, "stato tapped"`
- `でいる` = essere in quello stato
- `〜たら` = se / quando
- `このターンの後に` = dopo questo turno

Puoi usare furigana inline con la sintassi `{{base|reading}}`, per esempio
`{{<kanji>|<reading>}}`. Se c'e un composto numerico con contatore o
qualificatore, annota tutto il blocco: `{{1枚|いちまい}}`, `{{4以下|よんいか}}`,
`{{4つ以上|よっついじょう}}`; non scrivere `1{{枚|まい}}`,
`4{{以下|いか}}` o `{{4つ|よっつ}}{{以上|いじょう}}`. Se il numero e
complesso, annota il composto intero: `{{2000以下|にせんいか}}`.

Se un riferimento semantico ha un label con kanji, annota anche il label:
`[{{報酬|ほうしゅう}}](term:term-reward)`, non `[報酬](term:term-reward)`.
Vale anche per inline code: `` `{{未解放|みかいほう}}` `` e non `` `未解放` ``.

## Esempi guidati

<Inserisci esempi di lettura o analisi.>

Per una frase giapponese con traduzione italiana apribile a toggle, usa:

```md
:::example_sentence
jp: >-
  {{自分|じぶん}}の{{墓地|ぼち}}からクリーチャーを{{1体|いったい}}{{出|だ}}す。
translation_it: >-
  Metti in gioco 1 creatura dal tuo cimitero.
:::
```

Per inserire una schermata o una carta di supporto visivo gia presente nel
bundle, usa:

```md
:::image
src: assets/ui/deck-edit.webp
alt: Schermata di deckbuilding nell'app.
caption: >-
  Qui il label [{{編成|へんせい}}](term:term-formation) indica la schermata di
  deckbuilding.
:::
```

`alt` resta testo semplice: niente furigana, niente link e niente kanji nudi.
`caption` invece e testo visibile nel reader: se citi un termine con kanji,
annotalo con furigana e, se esiste gia una entry glossary / flashcard,
collegalo con il relativo link semantico.

## Nota finale

<Nota didattica breve, ancora centrata su testo e gioco. Niente meta-commenti
sul workflow di studio, sulla review o sulla produzione del contenuto.>

<!--
Usa blocchi :::term o :::grammar solo se devi introdurre una entry nuova non
ancora dichiarata altrove. Se una entry esiste gia, referenzia il suo ID.
Se dichiari una entry nuova che ha gia una sorella editoriale in un altro media,
puoi aggiungere `cross_media_group`, ma solo se il collegamento e certo.
Se lo usi, preferisci uno slug stabile con prefisso del tipo, per esempio
`term-shared-ranked-match`.
Usa :::example_sentence quando vuoi una frase con traduzione italiana
collassabile nel reader.
Se l'asset non esiste ancora, non usare subito :::image: crea prima una voce in
`workflow/image-requests.yaml`.
Quella voce non deve essere una nota vaga: deve fissare posizione nel flow,
immagine scelta, obiettivo visivo e criteri di recupero.
Usa :::image solo se esiste gia un asset reale sotto `assets/`; non inventare
path immagine.
Non inventare campi audio nel testo editoriale: l'audio, se serve, viene
arricchito in seguito dalla pipeline locale con asset e provenance reali.
Se aggiungi campi descrittivi YAML nel frontmatter, come `summary`, usa `>-`.
Una spiegazione debole del tipo "X e utile da fissare" non basta: scrivi
"X vuol dire Y; qui ti segnala Z".
- Evita nel testo finale frasi sul processo editoriale o di studio come
  "questa lesson", "qui facciamo review", "per questo test", "conviene mettere
  in review" o "verifichiamo la fonte": se una fonte serve, usala solo per
  sostenere una spiegazione sul testo o sulla regola.
- Anti-esempi aggiuntivi da evitare sempre:
  `Da qui in poi questa pagina non e piu una monografia...`
  `Il punto piu importante non e la keyword offensiva in se...`
  Se un testo somiglia a questi esempi, riscrivilo come analisi di grammatica,
  timing, condizione, target o funzione nel rules text.
-->
