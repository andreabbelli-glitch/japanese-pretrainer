# Audit Qualita Spiegazioni - Duel Masters

## Scopo

Registrare il criterio usato per l'audit del bundle `duel-masters-dm25` sui
casi in cui textbook e cards dichiaravano che un elemento era "utile" o
"importante" senza spiegare abbastanza bene che cosa significasse davvero e che
cosa cambiasse nella lettura del media.

## Criterio di audit

Una spiegazione e stata considerata insufficiente quando poteva essere ridotta a
una di queste forme:

- "X e utile da fissare";
- "X e importante";
- "X e una buona ancora mentale";
- "X ti allena a riconoscere ..."

senza chiarire almeno uno dei due punti seguenti:

- che cosa vuol dire davvero l'elemento giapponese;
- che cosa ti fa capire, distinguere o fare dentro Duel Masters / `デュエプレ`.

Per i nomi propri poco trasparenti il criterio e leggermente diverso: non sempre
si puo dare una glossa letterale forte, ma si deve almeno spiegare quale ruolo
ricorrente segnala il nome o quali componenti del nome conviene riconoscere.

## Aree riviste

- `content/media/duel-masters-dm25/textbook/005-duel-plays-app-overview.md`
- `content/media/duel-masters-dm25/textbook/006-duel-plays-app-decks-and-shop.md`
- `content/media/duel-masters-dm25/textbook/007-duel-plays-app-modes-and-progression.md`
- `content/media/duel-masters-dm25/textbook/002-tcg-core-patterns.md`
- `content/media/duel-masters-dm25/textbook/010-dm25-sd1-overview.md`
- `content/media/duel-masters-dm25/cards/001-tcg-core.md`
- `content/media/duel-masters-dm25/cards/005-duel-plays-app-core.md`
- `content/media/duel-masters-dm25/cards/010-dm25-sd1-core.md`
- `content/media/duel-masters-dm25/cards/020-dm25-sd2-core.md`

## Tipi di problema trovati

- Kanji o pattern UI descritti solo come utili, senza spiegare la funzione
  concreta. Esempi tipici: `{{編成|へんせい}}`, `～{{中|ちゅう}}`, `{{未|み}}～`.
- Pattern di rules text trattati come importanti senza esplicitare il contrasto
  operativo. Esempi tipici: [または](grammar:grammar-matawa),
  [～なければ ... ない](grammar:grammar-nakereba), [{{召喚|しょうかん}}](term:term-summon),
  [{{離れる|はなれる}}](term:term-hanareru).
- Nomi propri del deck trattati come "ancore" senza spiegare perche. Esempi
  tipici: [邪侵入](term:term-jashinnyuu),
  [アビスベル=ジャシン帝](term:term-abyssbell-jashintei),
  [進化設計図](term:term-shinka-sekkeizu).

## Intervento applicato

Le spiegazioni sono state riscritte con questa struttura minima:

1. `X` vuol dire `Y`.
2. Quando compare in questo contesto, ti segnala `Z`.

Formula estesa quando utile:

1. significato letterale o tecnico;
2. contrasto con termini vicini;
3. conseguenza pratica nel deck, nel rules text o nella UI.

## Regola riusabile per nuovi media

Una spiegazione passa il controllo solo se permette al lettore di dire entrambe
le cose:

- "ho capito che cosa sta dicendo davvero il giapponese";
- "ho capito che differenza fa quando lo incontro nel media".

Se una frase non arriva almeno a questo livello, va considerata ancora un draft.
