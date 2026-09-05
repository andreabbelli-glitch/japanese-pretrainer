# Implementazione dell’audit giapponese — 5 settembre 2026

Le **131 proposte approvate sono state applicate**, oltre alle cinque
correzioni Migaku della fase iniziale. Il registro contiene ora, per tutte le
136 voci, il problema originale e una verifica concreta del testo risultante.

Le correzioni nei bundle sono state importate nel database remoto: **275
lezioni interessate in otto media, nove import riusciti e 373 documenti
sorgente aggiornati**. La cache è stata aggiornata dopo ogni import. Il
confronto finale, eseguito con il piano canonico in sola lettura, trova
**zero documenti ancora da sincronizzare**. Nessuna card, lezione o voce è
stata eliminata o archiviata dagli import.

## Correzioni applicate

| Media | Voci dell’audit |
| --- | ---: |
| Migaku Grammar | 8, di cui 5 già corrette nella fase iniziale |
| Duel Masters | 18 |
| Pokémon Scarlet / Violet | 59 |
| Crystal Hunters | 16 |
| Kaishi | 15 |
| Web giapponese | 9 |
| Gundam Arsenal Base | 2 |
| TCG generale | 1 |
| Katakana Speed | 8 |

In Duel Masters sono state corrette le regole di Blocker, Shinkarize, Abyss
Rush e Civil Count anche nelle spiegazioni del textbook. Sono stati riallineati
furigana, quantità, soggetti, destinazioni degli effetti e analisi delle frasi.
Le fonti ufficiali restano collegate alle singole voci del registro.

Negli altri media sono stati corretti significati e traduzioni, registri di
parlato, collocazioni, tempi verbali ed esempi costruiti attorno a situazioni
poco plausibili. Le modifiche inglesi di Kaishi conservano la lingua di
spiegazione configurata del deck. Nei file già rivisti sono stati inoltre
normalizzati oltre duecento accenti italiani.

## Flashcard Migaku

Le **121 card appartenenti ai 33 gruppi con fronti ambigui** hanno ora un
contesto che identifica l’uso o la coniugazione richiesta. Il controllo sul
corpus risultante trova **zero gruppi con fronte identico e retro diversi**.
Il registro JSON conserva il confronto dei fronti modificati.

Questo intervento corregge il bundle locale esistente. **Il corso originale
Migaku non è stato importato integralmente dal sito autenticato**: per quella
riproduzione occorre un export fornito dall’utente. Restano quindi aperte le
differenze d’inventario documentate nell’audit: il bundle locale non va
presentato come copia fedele del corso.

## Nomi Pokémon

Personaggi, Pokémon, luoghi, oggetti e funzioni nominate usano la lettura
giapponese romanizzata nel testo italiano. Le vocali lunghe hanno il macron.
Una descrizione breve può seguire il nome per chiarire il referente.

| Giapponese | Forma adottata |
| --- | --- |
| ネモ | Nemo |
| ペパー | Pepā |
| ボタン | Botan |
| クラベル | Kuraberu |
| テーブルシティ | Tēburu Shiti |
| モンスターボール | Monsutā Bōru |
| 二つ名パワー | Futatsuna Pawā; lettura ふたつなパワー |

La convenzione è stata applicata a card, glossario, esempi e prosa. È stata
aggiunta anche al [brief del media](../llm-kit/media/pokemon-scarlet-violet/01-brief.md)
per mantenere la scelta nelle prossime lezioni. Le grafie dei personaggi e dei
contenuti aggiuntivi sono confrontabili con la
[presentazione ufficiale](https://www.pokemon.co.jp/ex/sv/ja/character/) e il
[sito del DLC](https://www.pokemon.co.jp/ex/sv_dlc/ja/).

Sei esempi derivati da dialoghi danneggiati sono stati sostituiti con frasi
didattiche complete, contrassegnate come tali nelle card e nel textbook:
JA-041, JA-042, JA-046, JA-047, JA-048 e JA-067. Sono riscritture didattiche;
non costituiscono trascrizioni certificate delle battute originali.

## Recupero degli import remoti

Durante la pubblicazione, Turso ha interrotto alcuni tentativi con
`SQLITE_BUSY` per inattività della transazione; il successivo rollback ne
mascherava talvolta la causa. Un tentativo su Kaishi ha inoltre ricevuto un
HTTP 404 dal servizio. Tutti gli scope sono stati infine importati e
verificati con successo.

Il commit `a8957592` limita la lettura dei corpi delle lezioni allo scope
selezionato e divide letture e scritture in gruppi di cinque. Gli stati di
consolidamento vengono aggiornati in gruppi di 40: sui 1.270 stati presenti,
quel passaggio richiede 32 scritture anziché 1.270. I valori degli stati e i
metadati necessari alle decisioni di archiviazione restano conservati.
La [documentazione di Turso](https://docs.turso.tech/sdk/ts/reference)
descrive i limiti delle transazioni interattive.

| Media | Lezioni nello scope | Documenti aggiornati |
| --- | ---: | ---: |
| Crystal Hunters | 12 | 18 |
| Duel Masters | 19 | 17 |
| Gundam Arsenal Base | 4 | 2 |
| Kaishi | 13 | 13 |
| Migaku Grammar | 123 | 125 |
| Pokémon Scarlet / Violet | 97 | 187 |
| TCG generale | 1 | 2 |
| Web giapponese | 6 | 9 |

Gli ID degli import, gli orari e gli esiti sono nel registro JSON. Il confronto
sorgente/runtime è stato completato alle **15:17 del 5 settembre 2026**, ora
italiana. Le modifiche Katakana Speed sono nel codice applicativo e sono
coperte dai test e dalla build.

## Verifiche e limiti

- Parser e validazione: **8 media, 1.244 file validi**.
- Inventario: invariati gli ID e l’ordine delle **664 lezioni**, delle
  **3.807 card** e delle **3.883 voci**. Gli esempi del textbook sono ora
  **2.967**, con due esempi aggiunti per mantenere la copertura didattica.
- `pnpm check`: passati file-size, lint, typecheck e **1.790 test in 296 file**.
- `pnpm release:check`: passato, inclusi import completo su DB locale isolato,
  build di produzione, validazione dei corpus Pitch Accent e **37 test E2E**.
- Regressione import/consolidamento: **52 test mirati passati**, con 1.600 stati
  migrati conservando tentativi, esiti, date e riferimenti alla lezione.
- `pnpm test:real-bundle`: **11 test passati**. La fixture dei conteggi è stata
  aggiornata con il comando canonico: le riscritture modificano il numero dei
  collegamenti, senza rimuovere card o voci.
- `pnpm agent:check -- --allow-protected-paths`: passato; l’opzione corrisponde
  al task editoriale esplicitamente autorizzato.
- Workflow audio eseguito su 12 voci Duel Masters, 7 Web e 二つ名パワー.
  Per Blocker manca ancora l’audio: la richiesta Forvo era già registrata il
  11 aprile 2026. Nessuna nuova richiesta è stata inviata.
- Fetch degli accenti eseguito sulle stesse voci, conservando gli esiti
  esistenti. Nessun accento è stato assegnato senza evidenza.

Il lint editoriale dei gruppi di lezioni interessati ha **347 avvisi**,
esaminati prima dell’importazione con `--allow-editorial-warnings`. Include
falsi positivi su SEED FREEDOM, sulle lezioni scolastiche di Pokémon e su
`これは重要な書類です`, oltre a contrasti didattici e debito stilistico già
inventariato. Non equivale a 347 errori di giapponese e non è stato dichiarato
un lint globale privo di avvisi.

L’audit non certifica l’ascolto di tutte le registrazioni o tutti gli accenti.
Anche il file audio già associato a 二つ名パワー è stato conservato senza
attribuirgli una verifica d’ascolto non eseguita.

Il [registro delle correzioni](2026-09-05-japanese-editorial-findings.md) e il
[JSON con i confronti](2026-09-05-japanese-editorial-audit.json) contengono le
singole modifiche e gli ID stabili.
