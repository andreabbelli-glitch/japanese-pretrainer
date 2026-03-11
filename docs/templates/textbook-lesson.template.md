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
grammar gia dichiarati.>

Puoi usare furigana inline con la sintassi `{{base|reading}}`, per esempio
`{{<kanji>|<reading>}}`. Se c'e un composto numerico con contatore o
qualificatore, annota tutto il blocco: `{{1枚|いちまい}}`, `{{4以下|よんいか}}`,
`{{4つ以上|よっついじょう}}`; non scrivere `1{{枚|まい}}`,
`4{{以下|いか}}` o `{{4つ|よっつ}}{{以上|いじょう}}`. Se il numero e
complesso, annota il composto intero: `{{2000以下|にせんいか}}`.

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

## Nota finale

<Nota didattica breve.>

<!--
Usa blocchi :::term o :::grammar solo se devi introdurre una entry nuova non
ancora dichiarata altrove. Se una entry esiste gia, referenzia il suo ID.
Usa :::example_sentence quando vuoi una frase con traduzione italiana
collassabile nel reader.
Se aggiungi campi descrittivi YAML nel frontmatter, come `summary`, usa `>-`.
-->
