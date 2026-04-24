# All media editorial sweep report - 2026-04-25

## Scopo

Sweep editoriale a tappeto sui contenuti Markdown di tutti i media, partendo
dalla rubrica del pilot Pokémon pre-study del 2026-04-24.

Obiettivo: rimuovere formule meta-linguistiche o da template e sostituirle con
spiegazioni centrate sul giapponese reale: forma, collocazione, funzione nella
schermata/scena, condizione, target e risultato.

## Scope modificato

| Media | File content modificati | Textbook | Cards | Media overview |
| --- | ---: | ---: | ---: | ---: |
| `pokemon-scarlet-violet` | 94 | 49 | 44 | 1 |
| `duel-masters-dm25` | 6 | 4 | 1 | 1 |
| `gundam-arsenal-base` | 3 | 2 | 0 | 1 |
| `web-giapponese` | 2 | 1 | 0 | 1 |

Totale contenuti modificati: 105 file Markdown.

La rubrica/prompt editoriale era già stata irrigidita nel pilot in:

- `docs/llm-kit/general/09-editorial-quality-rubric.md`
- `docs/llm-kit/general/05-template-cards-file.md`
- `docs/llm-kit/general/02-llm-content-handoff.md`

## Flashcard preservate

Nessuna flashcard è stata rimossa, accorpata o rinominata.

Controllo strutturale sui file `cards/` modificati:

| Media | File cards modificati | Card preservate |
| --- | ---: | ---: |
| `pokemon-scarlet-violet` | 44 | 881/881 |
| `duel-masters-dm25` | 1 | 44/44 |
| `gundam-arsenal-base` | 0 | 0/0 |
| `web-giapponese` | 0 | 0/0 |

Totale sui file modificati: 925/925 card preservate.

Per ogni `:::card` modificata sono stati verificati invariati rispetto a `HEAD`:
`id`, `lesson_id`, `entry_id`, `entry_type`, `card_type`.

## Cosa è stato corretto

- Note tipo `Termine tipico di Scarlet/Violet`, `Parola-cerniera utile`,
  `Verbo ad alta frequenza`, `Termine soprattutto utile nei DLC`.
- Frasi textbook tipo `Qui il focus è...`, `Accanto a questo nucleo...`,
  `Questo blocco...`, `ti aiuta a leggere`, `ti orienta`.
- Esempi artificiali tipo `これはXです`, `Xがだいじです`,
  `メニューでXを見ます`.
- Traduzioni italiane che aggiungevano tono, lore o dettagli non presenti nel
  giapponese.
- Pattern grammaticali spiegati senza frame o senza conseguenza concreta nella
  frase.
- Overview dei media che descrivevano il bundle invece della lettura operativa
  delle forme giapponesi.

## Esempi rappresentativi

| Media | Prima | Dopo |
| --- | --- | --- |
| Pokémon | `{{相手|あいて}}は つよい です。` | `{{相手|あいて}}の タイプを {{見|み}}てから わざを {{選|えら}}ぼう。` |
| Pokémon | `これは {{大事|だいじ}} です。` | `{{大事|だいじ}}な {{道具|どうぐ}}を {{持|も}}っています。` |
| Pokémon | `メニューで {{条件|じょうけん}}を {{見|み}}ます。` | `この {{条件|じょうけん}}を {{満|み}}たすと {{参加|さんか}}できます。` |
| Pokémon | `これは {{風紀|ふうき}} です。` | `{{風紀|ふうき}}を {{守|まも}}るために {{校則|こうそく}}があります。` |
| Pokémon | `メニューで {{買|か}}い{{取|と}}りを {{見|み}}ます。` | `{{買|か}}い{{取|と}}り{{価格|かかく}}を {{確認|かくにん}}します。` |
| Duel Masters | `Qui il focus è leggerli...` | `La lettura parte dalla forma giapponese: chi agisce, quale zona o bersaglio viene nominato...` |
| Gundam | `ti aiuta a separare subito schermo...` | `lo schermo corrisponde al タッチパネル, la fila orizzontale ai カードスロット...` |
| Web Giapponese | esempio artificiale su `評価と性能` | label reali della pagina: `バニーシャルルの評価と性能`, `攻撃種：精神ダメージ`, `バニーシャルルの強さと使い道` |

## Audit finale

Ricerca sui contenuti `content/media/**` escluso `workflow/**`: zero match
residui per i pattern vietati usati nello sweep.

Pattern controllati:

- `Termine tipico di`, `Termine utile per`, `Verbo ad alta frequenza`,
  `Parola-cerniera utile`, `Termine soprattutto utile`, `Nome di luogo utile`
- `Qui il focus è/e su`, `Accanto a questo nucleo`, `Questo blocco`,
  `In questo blocco conta/contano`
- `ti aiuta a`, `ti orienta`
- `これは ... です/だ/なんだ`
- `メニューで ... 見/使`

## Verifiche tecniche

- `git diff --check`: OK
- controllo strutturale card vs `HEAD`: OK, 925/925 preservate
- `./scripts/with-node.sh pnpm content:validate`: OK
  - 4 media bundle validati, 222 file scansionati
- `./scripts/with-node.sh pnpm check`: OK
  - lint, typecheck, 106 test file, 699 test
- `./scripts/with-node.sh pnpm release:check`: OK
  - build produzione, validazione contenuti globale, 24 test E2E

## Rischi residui

- Gli esempi nuovi sono naturali e contestuali, ma nella maggior parte dei casi
  non sono citazioni verificate da screenshot o transcript.
- Lo sweep ha rimosso i pattern espliciti catturabili e ha migliorato molti
  esempi deboli; non equivale a una revisione linguistica umana frase per frase
  di ogni singolo paragrafo.
- Alcune card molto verticali restano perché il vincolo era preservare tutte le
  flashcard. Sono state rese card di riconoscimento contestuale quando possibile.
- Le lesson live di Duel Masters erano già più real-first; lo sweep si è
  concentrato sui residui di overview/UI emersi dall'audit automatico.

## Prossimo standard operativo

Per i prossimi batch editoriali:

- partire sempre da audit regex + lettura mirata dei file peggiori;
- lavorare in write scope disgiunti;
- preservare card e campi identitari;
- chiudere con `content:validate`, `pnpm check`, audit anti-pattern e, se il
  contenuto tocca superfici user-facing, `release:check`;
- riportare esempi prima/dopo e rischi residui in `docs/tasks/`.
