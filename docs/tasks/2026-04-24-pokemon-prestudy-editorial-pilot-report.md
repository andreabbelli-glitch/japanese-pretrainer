# Pokémon pre-study editorial pilot report - 2026-04-24

## Scopo

Pilot editoriale su 6 pacchetti Pokémon Scarlet/Violet pre-study scelti
worst-first. L'obiettivo era ridurre metadiscorso, esempi artificiali e note da
template, mantenendo però tutte le flashcard esistenti.

File guida aggiornati:

- `docs/llm-kit/general/09-editorial-quality-rubric.md`
- `docs/llm-kit/general/05-template-cards-file.md`
- `docs/llm-kit/general/02-llm-content-handoff.md`

La rubrica ora blocca esplicitamente formule come `Termine tipico di...`,
`Parola-cerniera utile`, `Verbo ad alta frequenza`, `ti aiuta a leggere`,
`ti orienta`, esempi `これはXです` e spiegazioni grammaticali senza frame.

## Pacchetti riscritti

| Slug | Textbook | Card preservate | Term | Grammar |
| --- | --- | ---: | ---: | ---: |
| `049-sv-prestudy-l34b-scarlet-violet-sistema-e-menu` | sì | 24/24 | 26 | 0 |
| `048-sv-prestudy-l34a-luoghi-e-mappe-dlc-e-contenuti-extra` | sì | 9/9 | 27 | 0 |
| `041-sv-prestudy-l29b-sistema-e-menu-scuola-e-storia` | sì | 28/28 | 32 | 0 |
| `040-sv-prestudy-l29a-dlc-e-contenuti-extra-sistema-e-menu` | sì | 23/23 | 33 | 1 |
| `042-sv-prestudy-l29c-scarlet-violet-battaglia` | sì | 28/28 | 32 | 0 |
| `036-sv-prestudy-l23a-verbi-operativi-sistema-e-menu` | sì | 21/21 | 23 | 3 |

Totale card preservate: 133/133.

Campi identitari verificati rispetto a `HEAD` per ogni `:::card`: `id`,
`lesson_id`, `entry_id`, `entry_type`, `card_type`.

## Cosa è cambiato

- I textbook sono stati riscritti per spiegare forma giapponese, collocazione e
  funzione nel media invece di descrivere il batch in astratto.
- Le card deboli sono state riabilitate senza eliminazioni: `back`, `notes_it`,
  `example_jp` e `example_it` sono stati resi più concreti dove serviva.
- Gli esempi ora partono da frasi naturali nel dominio Pokémon/UI/dialoghi:
  battaglia, menu, mappe, DLC, Accademia, picnic, Team Star.
- Le traduzioni italiane sono state riallineate alla frase giapponese, evitando
  aggiunte creative non presenti nell'originale.
- I pattern grammaticali rimasti nel pilot mostrano frame leggibili, non solo il
  nome della regola.

## Esempi prima/dopo

| Pacchetto | Target | Prima | Dopo |
| --- | --- | --- | --- |
| 049 | `不良` | `これは {{不良\|ふりょう}} です。` | `スター{{団\|だん}}には {{不良\|ふりょう}}と よばれる {{生徒\|せいと}}も いる。` |
| 049 | `被害` | `ダメージが {{大\|おお}}きいです。` | `あばれた ポケモンの せいで {{町\|まち}}に {{被害\|ひがい}}が {{出\|で}}た。` |
| 048 | `模様` | `これは {{模様\|もよう}} です。` | `ポケモンの {{模様\|もよう}}を {{図鑑\|ずかん}}で {{見\|み}}ます。` |
| 048 | `変身` | `これは {{変身\|へんしん}} です。` | `メタモンが ピカチュウに {{変身\|へんしん}}します。` |
| 041 | `集中` | `これは {{集中\|しゅうちゅう}} です。` | `{{授業中\|じゅぎょう.ちゅう}}は {{先生\|せんせい}}の {{説明\|せつめい}}に {{集中\|しゅうちゅう}}します。` |
| 041 | `注文` | `メニューで {{注文\|ちゅうもん}}を {{見\|み}}ます。` | `{{宝食堂\|たからしょくどう}}で いつもの メニューを {{注文\|ちゅうもん}}します。` |
| 040 | `大作戦` | `これは {{大作戦\|だい.さく.せん}} です。` | `オーガポンを さがす {{大作戦\|だい.さく.せん}}が はじまります。` |
| 040 | `受付` | `これは {{受付\|うけつけ}} です。` | `{{受付\|うけつけ}}で ルールを {{確認\|かくにん}}します。` |
| 042 | `確率` | `バトルで 確率を見ます。` | `この {{技\|わざ}}は {{相手\|あいて}}を {{混乱\|こんらん}}させる {{確率\|かくりつ}}が ある。` |
| 042 | `用意` | `準備をします。` | `{{勝負\|しょうぶ}}の {{用意\|ようい}}が できたら ジムリーダーに {{話\|はな}}しかける。` |
| 036 | `通信交換` | `{{通信交換\|つう.しん.こう.かん}}を します。` | `{{友\|とも}}だちと {{通信交換\|つう.しん.こう.かん}}をします。` |
| 036 | `図鑑完成` | `{{図鑑完成\|ず.かん.かん.せい}}です。` | `{{図鑑完成\|ず.かん.かん.せい}}まで あと {{一匹\|いっぴき}}です。` |

## Controlli editoriali fatti

- Nessuna `:::card` rimossa o accorpata.
- Nessun cambio ai campi identitari delle card.
- Ricerca sui 12 file pilot per i pattern vietati: nessun match residuo.
- Controllo target negli esempi: i casi segnalati automaticamente sono
  coniugazioni o pattern legittimi (`与える` -> `与えます`, `進む` ->
  `進みます`, `～ほうがいい` senza tilde nell'esempio).
- Un residuo di frase-template in `036` (`Accanto a questo nucleo...`) è stato
  riscritto in una spiegazione concreta sulle etichette di menu.

## Verifiche tecniche

- `./scripts/with-node.sh pnpm content:validate -- --media-slug pokemon-scarlet-violet`: OK
  - 101 file scansionati, 51 lesson, 49 file cards, 934 term, 123 grammar, 967 card.
- `./scripts/with-node.sh pnpm check`: OK
  - lint, typecheck, 106 test file, 698 test.
- `./scripts/with-node.sh pnpm release:check`: OK
  - build produzione, validazione contenuti globale, 24 test E2E.

## Rischi residui

- Molti esempi sono naturali e contestuali, ma non citazioni verificate da
  screenshot o transcript del gioco.
- Alcune card molto verticali restano nel deck perché il vincolo del pilot era
  preservare tutte le flashcard; sono state rese card di riconoscimento
  contestuale, non eliminate.
- Il pilot migliora 6 pacchetti, ma la ricerca ampia mostra che pattern simili
  esistono ancora in lesson fuori scope. Questo report non certifica l'intero
  bundle Pokémon.
- Le traduzioni dei nomi DLC/localizzazioni sono state tenute pragmatiche e
  orientate allo studio; una revisione terminologica finale può ancora decidere
  se uniformarle a una forma ufficiale italiana in ogni punto.

## Checklist per approvazione utente

- [ ] Le frasi giapponesi suonano naturali abbastanza per lo studio pre-play.
- [ ] Le note spiegano giapponese e funzione nel media, non il processo
      editoriale.
- [ ] Le card verticali rimaste hanno valore di riconoscimento in schermata o
      scena.
- [ ] `example_it` non aggiunge dettagli assenti da `example_jp`.
- [ ] La rubrica aggiornata chiarisce bene gli anti-pattern da vietare nei
      prossimi batch.
- [ ] Il pilot è una base accettabile per procedere lesson-by-lesson sugli altri
      pacchetti Pokémon.
