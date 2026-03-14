# Task 19 - Glossary Cross-Media Data Backfill And Alignment

## Tipo

Content / data quality

## Obiettivo

Aumentare il valore reale del portale glossary globale allineando i dati
cross-media e ripulendo le discrepanze tra repository contenuti e database di
sviluppo.

## Input

- [Masterplan Glossary Portal](../glossary-portal-masterplan.md)
- `05`
- `11`

## Scope

- audit dei `cross_media_group` mancanti per termini e pattern grammaticali
  veramente condivisi;
- proposta o applicazione di backfill nei file contenuto;
- verifica delle voci senza card per decidere se restano lookup-only o se
  richiedono nuove flashcard;
- riallineamento tra contenuti presenti nel repo e database locale di sviluppo;
- aggiornamento minimo della documentazione authoring se emergono regole
  pratiche nuove.

## Fuori scope

- cambi di prodotto sul portale globale;
- modifiche alla UI non necessarie al data cleanup;
- collegamenti cross-media inferiti automaticamente senza verifica editoriale.

## Deliverable

- elenco ragionato di gap cross-media e gap card;
- eventuale backfill dei `cross_media_group` nei bundle interessati;
- note operative per distinguere voci `lookup-only` da voci da cardare;
- DB locale rigenerabile coerentemente dal contenuto corrente.

## Dipendenze

- `05`
- `11`

## File probabili da toccare

- `content/media/**/cards/*.md`
- `content/media/**/textbook/*.md` se servono riferimenti coerenti
- documentazione contenuti se necessaria

## Criteri di accettazione

- i gruppi cross-media aggiunti sono editorialmente giustificati, non inferiti
  solo per somiglianza superficiale;
- eventuali pattern grammaticali condivisi rilevanti hanno un piano di
  collegamento chiaro;
- e possibile rigenerare il DB e ottenere dati coerenti con il repo;
- il portale globale beneficia di dati piu ricchi senza introdurre ambiguita.

## Note implementative

- Questo task puo procedere in parallelo ai task applicativi, ma non deve
  bloccare la release tecnica della V1.
- Se emergono bundle legacy non piu presenti nel repo ma ancora nel DB locale,
  documentare il problema e risolverlo tramite rigenerazione/import pulito.
