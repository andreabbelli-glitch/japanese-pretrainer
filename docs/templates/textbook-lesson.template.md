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
---

# Obiettivo

<Spiega in italiano cosa imparera l'utente in questa lesson.>

## Contesto

<Spiega in italiano in quale contesto del media compaiono questi termini o
pattern.>

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
scrivere che e "utile" o "importante".>

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
alt: Schermata デッキ編成 nell'app.
caption: >-
  Qui il label [{{編成|へんせい}}](term:term-formation) indica la schermata di
  deckbuilding.
:::
```

## Nota finale

<Nota didattica breve.>

<!--
Usa blocchi :::term o :::grammar solo se devi introdurre una entry nuova non
ancora dichiarata altrove. Se una entry esiste gia, referenzia il suo ID.
Usa :::example_sentence quando vuoi una frase con traduzione italiana
collassabile nel reader.
Se l'asset non esiste ancora, non usare subito :::image: crea prima una voce in
`workflow/image-requests.yaml`.
Usa :::image solo se esiste gia un asset reale sotto `assets/`; non inventare
path immagine.
Se aggiungi campi descrittivi YAML nel frontmatter, come `summary`, usa `>-`.
Una spiegazione debole del tipo "X e utile da fissare" non basta: scrivi
"X vuol dire Y; qui ti segnala Z".
-->
