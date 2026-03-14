# Task 17 - Global Results To Local Detail Integration

## Tipo

Backend + frontend integration

## Obiettivo

Collegare il portale globale ai detail page locali in modo coerente, spiegando
in quale media conviene aprire una voce e come navigare tra le occorrenze.

## Input

- [Masterplan Glossary Portal](../glossary-portal-masterplan.md)
- `08`
- `14`
- `15`

## Scope

- definire e implementare `bestLocalHref` per i risultati globali;
- stabilire la priorita di scelta del media di atterraggio;
- mostrare nel risultato globale il media principale o le occorrenze rilevanti;
- aggiungere affordance come `Vedi media` o equivalente quando una voce compare
  in piu media;
- preservare il dettaglio locale come fonte primaria di contesto.

## Fuori scope

- detail page globale canonico unico;
- fusione editoriale dei significati tra media;
- nuova tassonomia cross-media oltre ai gruppi gia esistenti.

## Deliverable

- deep-link stabile dal portale globale al miglior dettaglio locale;
- gestione coerente dei casi con piu media;
- surface minima per vedere che una voce esiste in piu contesti;
- nessuna regressione sul comportamento locale quando `source_id` e riusato.

## Dipendenze

- `08`
- `14`
- `15`

## File probabili da toccare

- `src/lib/glossary.ts`
- `src/components/glossary/glossary-page.tsx`
- `src/components/glossary/glossary-detail-page.tsx`
- `tests/glossary.test.ts`

## Criteri di accettazione

- da un risultato globale si apre sempre un dettaglio locale valido;
- se la voce compare in piu media, il sistema sceglie un target secondo
  priorita documentata;
- l'utente puo capire che esistono altre versioni locali della stessa voce;
- i test di regressione sui source id riusati tra media diversi restano verdi.

## Note implementative

Ordine di priorita consigliato per la scelta del target:

1. media che ha prodotto il match principale;
2. media con card collegate;
3. primo media alfabetico.
