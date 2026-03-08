# 07 — Canonical Language Layer / Content Restructure

## Cosa è stato implementato
- Refactor del runtime content da modello deck-first (`/content/items|cards|lessons`) a modello language-first con layer canonico riusabile e layer gioco/prodotto.
- Migrazione completa di SD1/SD2 su `SourceUnit` che referenziano `LanguageItem` canonici (nessun item linguistico duplicato sotto cartelle game/product).
- Loader runtime aggiornato per usare come sorgente di verità il nuovo albero `/content/language` + `/content/games`.
- Validatore contenuti aggiornato con regole canoniche (ID unici, reference integrity, unit con requiredItemIds, lesson con metadata minimi, blocco duplicati item in cartelle game).
- Documento mapping legacy→canonical creato in `docs/content-id-mapping-v1-to-canonical.md`.

## Final content tree
```text
/content
  /language
    /items/items.json
    /examples/examples.json
    /lessons/core/*.mdx
    /meta/language-config.json
    /meta/content-index.json (generato)

  /games
    /duel-masters
      /meta/game.json
      /lessons/*.mdx
      /products
        /dm25-sd1
          /meta/product.json
          /units/units.json
          /lessons/*.mdx
        /dm25-sd2
          /meta/product.json
          /units/units.json
          /lessons/*.mdx
```

## Canonical ID conventions adottate
- Language items:
  - `jp.k.###` (kanji)
  - `jp.v.###` (vocab/verb)
  - `jp.pat.###` (pattern)
  - `dm.kw.###` (keyword Duel Masters)
- Examples: `ex.dm.sd1.####`, `ex.dm.sd2.####`
- Lessons:
  - core: `lesson.core.*`
  - game: `lesson.dm.*`
  - product: `lesson.dm.sd1.*`, `lesson.dm.sd2.*`
- Game: `game.duel-masters`
- Products: `product.dm25-sd1`, `product.dm25-sd2`
- Units: `unit.dm.sd1.###`, `unit.dm.sd2.###`

## Old-to-new mapping strategy
- Mapping completo one-shot generato da legacy content in repo, con tabella esplicita in:
  - `docs/content-id-mapping-v1-to-canonical.md`
- Strategia:
  1. mappatura deterministica per prefissi (`K-*`→`jp.k.*`, `V-*`→`jp.v.*`, `P-*`→`jp.pat.*`, `KW-*`→`dm.kw.*`)
  2. conversione carte (`CARD-SD*-*`) in `unit.dm.sd*.*`
  3. conversione deck (`DECK-SD*`) in product IDs canonici
  4. conversione lesson IDs (`L-*`) in lesson layer-aware

## Compatibility shims
- Mantenute query/transitional types `StudyItem`, `StudyCard`, `StudyDeck`, `StudyExample` nel dominio content, ma derivate dal grafo canonico a runtime.
- Le pagine attuali continuano a compilare senza refactor UI massivo.
- Nessuna dual truth: il vecchio albero content legacy è stato rimosso; le viste legacy leggono solo proiezioni dal nuovo albero canonico.

## File principali toccati
- `content/**` (nuovo albero canonico)
- `src/domain/content/types.ts`
- `src/domain/content/schemas.ts`
- `src/domain/content/loader.ts`
- `src/domain/content/queries.ts`
- `scripts/content-io.ts`
- `scripts/validate-content.ts`
- `scripts/build-content-index.ts`
- `docs/content-id-mapping-v1-to-canonical.md`

## Follow-up work consigliato
1. Aggiornare naming UI/route da deck-specific a product/unit dove opportuno.
2. Rifinire ID lessicali da seriali numerici a slug semantici (es. `jp.v.deru`) mantenendo freeze della convenzione.
3. Aggiornare eventuali script di migrazione legacy (`scripts/migrate-study-guide.ts`) al nuovo schema.
4. Aggiungere test unit dedicati al validator canonico (reference integrity e duplicate guards).
