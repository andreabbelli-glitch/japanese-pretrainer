# 03 — Content Migration / Canonical Content Graph

## Cosa è stato implementato
- Migrazione del contenuto dallo study guide markdown a un content graph canonico versionato sotto `/content`.
- Dataset separati per item (`kanji`, `vocab`, `keyword`, `pattern`), esempi, carte, metadata deck e lesson scaffold MDX (L1–L8).
- Script introdotti:
  - `scripts/migrate-study-guide.ts`
  - `scripts/validate-content.ts`
  - `scripts/build-content-index.ts`
  - `scripts/content-io.ts` (helper condiviso per script content)
- Loader TypeScript lato dominio in `src/domain/content/` con:
  - modelli (`types.ts`)
  - parsing/guard robusti (`schemas.ts`)
  - loader filesystem (`loader.ts`)
  - barrel export (`index.ts`)
- Index derivato scritto in `content/meta/content-index.json`.

## Struttura finale `/content`
- `content/items/kanji.json`
- `content/items/vocab.json`
- `content/items/keyword.json`
- `content/items/pattern.json`
- `content/examples/examples.json`
- `content/cards/cards.json`
- `content/meta/decks.json`
- `content/meta/source-map.json`
- `content/meta/content-index.json`
- `content/lessons/l-01-...mdx` fino a `l-08-...mdx`

## Convenzioni ID adottate
- `K-001...` per kanji (`K01...` legacy preservato in `legacyId`)
- `V-001...` per lessico/keyword (`V39+` classificati come keyword)
- `P-001...` per pattern
- `EX-0001...` per esempi
- `L-01...L-08` per lezioni
- `CARD-SD1-001...` / `CARD-SD2-001...` per carte
- `DECK-SD1`, `DECK-SD2` per deck

## Cosa è stato migrato automaticamente
- Tabelle K/V/P dal markdown sorgente (termine, lettura, significato, esempi, fonti).
- Tabella “Guida carta per carta” (senso rapido, frase guida, mapping item/pattern per carta).
- Mapping URL carta da appendice sorgenti ufficiali.
- Generazione bidirezionale relazioni base:
  - item -> examples/cards/lessons
  - card -> items/lessons
  - lesson -> items/cards

## Cosa è stato rifinito a mano
- Normalizzazione ID stabili nel formato masterplan (`K-001`, `V-001`, ...).
- Segmentazione lesson scaffold L1–L8 con frontmatter pronto per textbook runtime.
- Costruzione metadata deck con `totalCards=40` e mappa completa delle **carte uniche** nel corpus SD1/SD2.
- Nota esplicita in `decks.json` sulle quantità per singola carta non presenti nel file sorgente.

## Validazione implementata
`validate-content` fallisce su:
- ID duplicati
- riferimenti rotti tra item/card/example/lesson/deck
- item senza collegamenti utili
- card senza `itemIds`
- lesson senza metadati minimi

## Quantità migrate (attuali)
- Item totali: 144
  - Kanji: 56
  - Vocab: 38
  - Keyword: 24
  - Pattern: 26
- Carte: 24 (SD1 + SD2)
- Esempi: 168
- Lezioni scaffold: 8

## TODO / lacune residue
1. Integrare (se disponibile da fonte ufficiale strutturata) le quantità copie per carta nei deck `cardCopies`.
2. Arricchire i body MDX delle lezioni con contenuto didattico completo (struttura già pronta).
3. Eventuale miglioramento parser frontmatter (attualmente custom semplice, sufficiente per scaffold corrente).

## Blocker reali
- In questo ambiente non è stato possibile reinstallare dipendenze npm aggiuntive (403 su registry), quindi i check globali (`lint`, `typecheck`) dipendenti da tool non presenti restano limitati dall’ambiente.
