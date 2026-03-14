# Task 15 - Global Glossary Query Layer And Contract

## Tipo

Backend / query layer

## Obiettivo

Estrarre e generalizzare il query layer del glossary in modo che possa servire
sia la vista locale per media sia il nuovo portale globale cross-media.

## Input

- [Masterplan Glossary Portal](../glossary-portal-masterplan.md)
- `03`
- `08`
- `09`

## Scope

- rifattorizzare il caricamento delle glossary entry per supportare
  `mediaSlug` opzionale;
- introdurre una page data globale, per esempio `getGlobalGlossaryPageData`;
- mantenere invariato il ranking esistente per kanji, kana, romaji, significato
  e alias;
- esporre in output segnali espliciti su flashcard e copertura cross-media;
- definire un contratto dati stabile per UI globale e locale.

## Fuori scope

- rifinitura visuale della nuova pagina;
- migrazioni schema non strettamente necessarie;
- dettaglio globale canonico obbligatorio.

## Deliverable

- loader comune per glossary locale e globale;
- supporto filtri `media`, `cards`, `study`, `entryType`;
- risultato che espone almeno `hasCards`, `cardCount`, `mediaCount`,
  `mediaHits`, `bestLocalHref`;
- test aggiornati sul ranking e sui nuovi filtri.

## Dipendenze

- `03`
- `08`
- `09`

## File probabili da toccare

- `src/lib/glossary.ts`
- `src/db/queries/glossary.ts`
- eventuali helper in `src/lib/study-entry.ts` o `src/lib/study-search.ts`
- `tests/glossary.test.ts`

## Criteri di accettazione

- la query globale restituisce risultati da piu media;
- il filtro `with_cards` mostra solo voci con almeno una card collegata;
- il filtro `without_cards` mostra solo voci senza card collegate;
- il ranking romaji/kana/italiano non regredisce rispetto ai test attuali;
- la vista locale continua a funzionare con il nuovo query layer comune.

## Note implementative

- Per la dimensione attuale del corpus va bene una soluzione applicativa senza
  FTS dedicato.
- Il contratto dati deve evitare ambiguita tra:
  - presenza di card;
  - stato review;
  - presenza di sibling cross-media.
