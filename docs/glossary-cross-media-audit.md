# Audit Glossary Cross-Media And Card Gaps

Snapshot di lavoro: 2026-03-14

## Metodo

- letti `docs/glossary-portal-masterplan.md` e
  `docs/tasks/19-glossary-cross-media-data-backfill-and-alignment.md`;
- ispezionati i bundle reali sotto `content/media/**`;
- rigenerato un DB temporaneo coerente col repo corrente in
  `tmp/task19-audit.db`;
- confrontato il DB temporaneo con il DB locale di sviluppo
  `data/japanese-custom-study.db`.

## Stato cross-media

Nel contenuto corrente del repo esistono solo `2` media bundle reali:

- `duel-masters-dm25`
- `gundam-arsenal-base`

I soli gruppi cross-media editorialmente confermati nel corpus sono gia questi
4:

- `term-shared-cost-resource`
- `term-shared-deck-loadout`
- `term-shared-mission-progression`
- `term-shared-ranked-match`

Verifica fatta:

- i soli duplicati `term` davvero identici tra media per `lemma + reading` sono
  gia coperti dai 4 gruppi sopra;
- nel corpus corrente non emergono pattern grammaticali condivisi tra media con
  un match netto e sicuro;
- non risultano altri candidati da collegare senza introdurre inferenze deboli.

## Collegamenti lasciati intenzionalmente non creati

Non sono stati aggiunti nuovi `cross_media_group` nei file contenuto.

Motivi principali:

- `duel-masters-dm25` ha mode/event names come
  `term-legend-battle` e `term-tower-of-trials` che non hanno un equivalente
  editoriale diretto in Gundam;
- varie entry Gundam descrivono hardware arcade o oggetti della UI fisica
  (`term-button`, `term-card-reader`, `term-card-outlet`,
  `term-earphone-jack`) e non hanno un vero sibling didattico cross-media;
- non ci sono grammar pattern duplicati fra i due media con stesso nucleo
  didattico abbastanza chiaro da giustificare un gruppo condiviso.

## Voci senza card

Nel DB rigenerato dal repo:

- `21` term entries senza card collegate;
- `0` grammar entries senza card collegate.

### Lookup-only accettabili

Queste voci possono restare senza card senza creare un gap evidente:

- `duel-masters-dm25:term-legend-battle`
- `duel-masters-dm25:term-tower-of-trials`
- `gundam-arsenal-base:term-button`
- `gundam-arsenal-base:term-card-reader`
- `gundam-arsenal-base:term-card-outlet`
- `gundam-arsenal-base:term-earphone-jack`

Ragione pratica: sono nomi di contenuti specifici o etichette di orientamento
hardware utili nel glossary, ma meno adatti a review ricorrente rispetto al
vocabolario che guida decisioni ripetute di gioco o progressione.

### Candidati forti per future flashcard

Queste voci compaiono come termini strutturali di lettura del match, della
progressione o della configurazione iniziale e meritano follow-up editoriale:

- `gundam-arsenal-base:term-touch-panel`
- `gundam-arsenal-base:term-deck`
- `gundam-arsenal-base:term-starter-deck`
- `gundam-arsenal-base:term-main-slot`
- `gundam-arsenal-base:term-sub-slot`
- `gundam-arsenal-base:term-mission`
- `gundam-arsenal-base:term-casual-match`
- `gundam-arsenal-base:term-ve-raid-battle`
- `gundam-arsenal-base:term-rank-point`
- `gundam-arsenal-base:term-battlefield`
- `gundam-arsenal-base:term-minimap`
- `gundam-arsenal-base:term-base`
- `gundam-arsenal-base:term-warship`
- `gundam-arsenal-base:term-sp-gauge`

Ragione pratica: queste entry non sono solo lessico di orientamento. Nei
textbook guidano davvero la lettura del campo, delle modalita e delle risorse,
quindi la loro assenza da review riduce il valore didattico del portale.

### Caso da tenere conservativo per ora

- `gundam-arsenal-base:term-climax-boost`

La voce e utile e ben spiegata, ma nel corpus attuale resta piu situazionale
del lessico base di campo e progressione. Conviene promuoverla a flashcard solo
insieme a un batch battle-core dedicato, non in questo cleanup.

## Drift repo vs DB locale

Confronto fra `tmp/task19-audit.db` e `data/japanese-custom-study.db`:

- il repo corrente importa `2` media, `190` term, `26` grammar, `194` card,
  `224` card-entry links e `4` cross-media groups;
- il DB locale attuale contiene invece `3` media e `196` card;
- il delta e dovuto a un media legacy non piu presente nel repo:
  `frieren`;
- nel DB locale `frieren` ha `0` glossary entries ma `2` card residue da
  `media/frieren/cards/001-core.md`, con front `食べる` e `～ている`.

Per i bundle ancora presenti nel repo non risultano drift su term o grammar:

- nessun `term.source_id` in piu o in meno per
  `duel-masters-dm25` e `gundam-arsenal-base`;
- nessun `grammar.source_id` in piu o in meno per gli stessi media;
- nessun drift sui `cross_media_group` rispetto al contenuto corrente.

## Azione raccomandata sul DB locale

Per riallineare il DB di sviluppo al repo basta rigenerare o reimportare il
contenuto corrente, cosi da rimuovere il bundle legacy `frieren`.
