---
id: lesson-gundam-arsenal-base-modes-and-progression
media_id: media-gundam-arsenal-base
slug: modes-and-progression
title: "Modalità, profilo e deck: leggere il percorso fuori dalla battaglia"
order: 30
segment_ref: modes-and-progression
difficulty: n4
status: active
tags: [modes, progression, deck, beginner]
prerequisites: [lesson-gundam-arsenal-base-arcade-onboarding, lesson-gundam-arsenal-base-battle-screen-and-core-actions]
summary: >-
  Capisci modalità, rank, missioni, deck iniziale e prime scelte consigliate
  per progredire con scelte operative e priorità chiare.
---

# Modalità, profilo e deck: leggere il percorso fuori dalla battaglia

Dopo le prime partite, *Arsenal Base* smette di essere solo una schermata di
battaglia: diventa una rete di modalità, missioni, rank, deck e dati profilo.
Il giapponese qui non descrive lore, ma ti dice quale tipo di sessione stai per
iniziare, quale progresso viene misurato e quale preparazione conviene fare
prima di tornare al cabinato.

Le etichette da riconoscere stanno soprattutto in tre luoghi: selezione
modalità, [MY PAGE](term:term-mypage) e costruzione del [デッキ](term:term-deck).
Se le leggi come pezzi collegati, capisci quando il gioco ti sta chiedendo di
allenarti contro CPU, rischiare punti rank, controllare una
[ミッション](term:term-mission) o sistemare la struttura MS + PL.

## Termini chiave

- [デッキ](term:term-deck) — lista di carte usata in partita
- [スターターデッキ](term:term-starter-deck) — deck iniziale pronto
- [{{指揮官|しきかん}}レベル](term:term-commander-level) — livello del profilo comandante
- [ランクマッチ](term:term-rank-match) — modalità classificata
- [VEレイドバトル](term:term-ve-raid-battle) — raid cooperativo contro boss
- [チャレンジモード](term:term-challenge-mode) — modalità CPU con missioni
- [カジュアルマッチ](term:term-casual-match) — match senza variazione rank
- [ランクポイント](term:term-rank-point) — punti della classifica
- [ミッション](term:term-mission) — obiettivo di avanzamento
- [MY PAGE](term:term-mypage) — servizio web del profilo
- [EXバトル](term:term-ex-battle) — sistema EX citato in guide vecchie
- [{{作戦|さくせん}}カード](term:term-tactics-card) — carta tattica digitale
- [メイン{{枠|わく}}](term:term-main-slot) — slot tattico principale
- [サブ{{枠|わく}}](term:term-sub-slot) — slot tattico secondario
- [{{役割|やくわり}}](term:term-role) — funzione tattica dell'unità
- [{{殲滅|せんめつ}}](term:term-role-shoumetsu) — ruolo anti-unità
- [{{制圧|せいあつ}}](term:term-role-seiatsu) — ruolo di pressione sugli obiettivi
- [{{防衛|ぼうえい}}](term:term-role-bouei) — ruolo difensivo

## Pattern grammaticali chiave

- [～が{{解放|かいほう}}される](grammar:grammar-ga-kaihou-sareru) — X viene sbloccato
- [～が{{表示|ひょうじ}}される](grammar:grammar-ga-hyouji-sareru) — X viene mostrato
- [～することで](grammar:grammar-suru-koto-de) — facendo X, si ottiene Y

## Etichette da riconoscere

- `{{対戦|たいせん}}モード{{選択|せんたく}}` — pannello di scelta del tipo di match
- `CLEAR!!` — stato completato nelle missioni

---

## 1. Scegliere la modalità: che tipo di partita stai entrando

La selezione modalità è una schermata di orientamento, non una lista neutra di
nomi. [ランクマッチ](term:term-rank-match), [チャレンジモード](term:term-challenge-mode),
[カジュアルマッチ](term:term-casual-match) usano katakana trasparente, mentre label
evento come `リンクステージバトル` aggiungono un nome di contenuto specifico sopra
la stessa area di selezione. Ognuna cambia il rischio della sessione: punti,
allenamento, prova libera o battaglia evento.

:::image
src: assets/ui/mode-select-screen.webp
alt: "Schermata ufficiale di selezione modalità con riquadri per Rank Match, Challenge Mode, Casual Match e Link Stage Battle, più il pannello di selezione versus."
caption: >-
  Schermata ufficiale di selezione modalità: riconosci [ランクマッチ](term:term-rank-match), [チャレンジモード](term:term-challenge-mode), [カジュアルマッチ](term:term-casual-match) e il label evento `リンクステージバトル`, più il pannello `{{対戦|たいせん}}モード{{選択|せんたく}}` che decide come cercare l'avversario.
:::

- [ランクマッチ](term:term-rank-match) contiene `ランク`, cioè rank, e `マッチ`,
  match: la parola ti avvisa che la partita muove classifica e
  [ランクポイント](term:term-rank-point). Qui il risultato non è solo "vittoria o
  sconfitta", ma variazione di posizione stagionale. Nei rank iniziali ブロンズ e
  シルバー una sconfitta non sottrae [ランクポイント](term:term-rank-point), quindi
  il label suona più minaccioso del rischio reale delle prime prove.
- [チャレンジモード](term:term-challenge-mode) mette davanti `チャレンジ`,
  "sfida", ma nel flusso da principiante è soprattutto la modalità in cui la CPU
  rende leggibili input, tempi e [{{役割|やくわり}}](term:term-role). Se vuoi
  capire cosa fa una [{{制圧|せいあつ}}](term:term-role-seiatsu) senza pressione
  da ladder, questo label indica il posto giusto.
- [カジュアルマッチ](term:term-casual-match) usa `カジュアル` per togliere il peso
  del rank: le regole base restano quelle del match, ma non c'è movimento di
  classifica. È la cornice naturale per provare un [デッキ](term:term-deck),
  cambiare apertura o testare ruoli senza leggere ogni errore come perdita di
  punti.
- [VEレイドバトル](term:term-ve-raid-battle) sposta il frame su `レイドバトル`,
  cioè scontro cooperativo contro boss. L'etichetta non indica una normale
  corsia uno contro uno: prima di entrarci devi già distinguere
  [{{殲滅|せんめつ}}](term:term-role-shoumetsu),
  [{{制圧|せいあつ}}](term:term-role-seiatsu) e
  [{{防衛|ぼうえい}}](term:term-role-bouei), perché il boss cambia il peso di
  target e cooperazione.

:::example_sentence
jp: >-
  ランクマッチではランクポイントが{{増|ふ}}えたり{{減|へ}}ったりします。
translation_it: >-
  Nel Rank Match i rank point aumentano o diminuiscono.
:::

#### 🗺️ Anatomia della frase

- `ランクマッチでは` -> `では` imposta la cornice: la regola vale dentro quella
  modalità, non in ogni partita.
- `ランクポイントが` -> `が` marca ciò che cambia: non il deck, ma i punti rank.
- `{{増|ふ}}えたり{{減|へ}}ったりします` -> la coppia `たり...たり` elenca esiti
  possibili: aumentare o diminuire.

> [!NOTE]
> **⚖️ Contrasto operativo:** `マッチ` da solo dice "partita"; `ランクマッチ`
> aggiunge classifica, mentre `カジュアルマッチ` la rimuove. Quando vedi il
> prefisso, hai già il tipo di pressione della sessione.

## 2. Progressione: sblocchi, missioni e lettura da MY PAGE

Fuori dalla partita, la lingua diventa più amministrativa: livello profilo,
missioni, stato completato, dati recenti. [{{指揮官|しきかん}}レベル](term:term-commander-level)
non descrive il pilota in campo, ma il profilo giocatore; [ミッション](term:term-mission)
non è una missione narrativa, ma un obiettivo che avanza; [MY PAGE](term:term-mypage)
è il luogo dove questi dati restano leggibili con calma dopo la sala giochi.

:::image
src: assets/ui/missions-progress-screen.webp
alt: "Schermata ufficiale delle missioni in MY PAGE con tab di categoria, stato CLEAR e riquadri ricompensa visibili."
caption: >-
  Schermata missioni di [MY PAGE](term:term-mypage): categorie, stato `CLEAR!!` e riquadri premio ti fanno rileggere con calma [ミッション](term:term-mission) e avanzamento del profilo fuori dalla sala giochi.
:::

[{{指揮官|しきかん}}レベル](term:term-commander-level) è un composto ibrido:
`{{指揮官|しきかん}}` è il comandante, `レベル` è il livello. La schermata non sta
valutando la forza di un singolo MS o PL, ma l'avanzamento generale del tuo
profilo. Quando quel livello sale, la formula grammaticale tipica è
[～が{{解放|かいほう}}される](grammar:grammar-ga-kaihou-sareru): una funzione che
prima era bloccata diventa disponibile.

:::example_sentence
jp: >-
  {{指揮官|しきかん}}レベルが{{上|あ}}がると、{{使|つか}}える{{機能|きのう}}が{{増|ふ}}えていきます。
translation_it: >-
  Quando sale il livello comandante, aumentano anche le funzioni che puoi usare.
:::

#### 🗺️ Anatomia della frase

- `{{指揮官|しきかん}}レベルが{{上|あ}}がると` -> `と` crea una condizione stabile:
  quando il livello sale, succede la seconda parte.
- `{{使|つか}}える{{機能|きのう}}が` -> `{{使|つか}}える` restringe le funzioni a
  quelle utilizzabili, non a qualunque voce del menu.
- `{{増|ふ}}えていきます` -> `ていく` fa sentire la crescita progressiva nel tempo.

Le [{{作戦|さくせん}}カード](term:term-tactics-card) entrano esattamente in questa
logica di sblocco. `{{作戦|さくせん}}` significa operazione o piano tattico; nel
gioco non occupa lo stesso spazio di [MSカード](term:term-ms-card) e
[PLカード](term:term-pl-card), ma diventa una carta digitale da equipaggiare.
Quando il sistema ti parla di [メイン{{枠|わく}}](term:term-main-slot) e
[サブ{{枠|わく}}](term:term-sub-slot), `{{枠|わく}}` è il "riquadro/slot": il
testo sta distinguendo dove mettere l'effetto principale e dove quello di
supporto.

> [!NOTE]
> **⚖️ Contrasto operativo:** `{{解放|かいほう}}される` non è "mostrare sullo
> schermo". Per quello trovi [～が{{表示|ひょうじ}}される](grammar:grammar-ga-hyouji-sareru).
> `{{解放|かいほう}}` cambia disponibilità; `{{表示|ひょうじ}}` cambia visibilità.

In [MY PAGE](term:term-mypage), invece, il centro è rileggere. La parola
[ミッション](term:term-mission) indica obiettivi di avanzamento, `CLEAR!!`
segnala che uno di quegli obiettivi è completato, e
[{{進行|しんこう}}](term:term-progress) descrive quanto una missione è avanzata.
Se trovi [{{戦績|せんせき}}](term:term-battle-record), il kanji `{{戦|せん}}`
riporta alla battaglia e `{{績|せき}}` al risultato accumulato: non è una nota
decorativa del profilo, ma il record delle partite già giocate.

## 3. Deck iniziale: leggere struttura prima della rarità

Il primo [デッキ](term:term-deck) non va letto come un mazzo da cui peschi carte
durante la partita. In *Arsenal Base* è una lista preparata: [MSカード](term:term-ms-card)
e [PLカード](term:term-pl-card) si accoppiano per formare [ユニット](term:term-unit).
Uno [スターターデッキ](term:term-starter-deck) serve perché ti consegna una
struttura completa: invece di collezionare nomi forti a caso, puoi leggere subito
quali ruoli coprono le unità.

La triade da tenere insieme è [{{殲滅|せんめつ}}](term:term-role-shoumetsu),
[{{制圧|せいあつ}}](term:term-role-seiatsu) e
[{{防衛|ぼうえい}}](term:term-role-bouei). Tutte e tre sono
[{{役割|やくわり}}](term:term-role), ma non fanno lo stesso lavoro:
[{{殲滅|せんめつ}}](term:term-role-shoumetsu) rimuove unità nemiche,
[{{制圧|せいあつ}}](term:term-role-seiatsu) trasforma una corsia aperta in danno
a basi o nave, [{{防衛|ぼうえい}}](term:term-role-bouei) protegge i tuoi
obiettivi. Una distribuzione iniziale molto lineare è
{{2枚|にまい}} / {{2枚|にまい}} / {{1枚|いちまい}}: due
[{{殲滅|せんめつ}}](term:term-role-shoumetsu), due
[{{制圧|せいあつ}}](term:term-role-seiatsu), una
[{{防衛|ぼうえい}}](term:term-role-bouei).

:::example_sentence
jp: >-
  {{最初|さいしょ}}のデッキは、{{殲滅|せんめつ}}{{2枚|にまい}}・{{制圧|せいあつ}}{{2枚|にまい}}・{{防衛|ぼうえい}}{{1枚|いちまい}}くらいだと{{役割|やくわり}}が{{見|み}}えやすいです。
translation_it: >-
  In un primo deck, una ripartizione di circa 2 annientamenti, 2 pressioni e 1
  difesa rende le funzioni più leggibili.
:::

#### 🗺️ Anatomia della frase

- `{{最初|さいしょ}}のデッキは` -> `は` presenta il tema: non tutti i deck, ma il
  primo deck da cui partire.
- `{{殲滅|せんめつ}}{{2枚|にまい}}・{{制圧|せいあつ}}{{2枚|にまい}}・{{防衛|ぼうえい}}{{1枚|いちまい}}くらい`
  -> `くらい` indica una misura approssimativa, non una legge fissa.
- `{{役割|やくわり}}が{{見|み}}えやすい` -> letteralmente "i
  ruoli sono facili da vedere": il criterio è leggibilità tattica, non rarità.

> [!NOTE]
> **🧠 Gancio cognitivo:** pensa ai tre ruoli come tre verbi impliciti:
> [{{殲滅|せんめつ}}](term:term-role-shoumetsu) "toglie di mezzo",
> [{{制圧|せいあつ}}](term:term-role-seiatsu) "spinge sull'obiettivo",
> [{{防衛|ぼうえい}}](term:term-role-bouei) "tiene la porta". È un trucco di
> memoria operativo, non un'etimologia.

## 4. Vecchie guide e sistemi non più centrali

[EXバトル](term:term-ex-battle) è una buona etichetta da riconoscere quando
leggi guide passate, ma non va confusa con il percorso attuale. `EX` la marca
come modalità speciale o extra, mentre `バトル` resta "battaglia"; il problema è
temporale, non linguistico. Se una guida lo presenta come passo necessario, stai
probabilmente leggendo materiale precedente alle stagioni UNITRIBE SEASON:01.

:::example_sentence
jp: >-
  {{古|ふる}}い{{記事|きじ}}でEXバトルを{{見|み}}ても、{{現在|げんざい}}のプレイ{{導線|どうせん}}とは{{別物|べつもの}}として{{読|よ}}んでください。
translation_it: >-
  Anche se trovi EX Battle in un articolo vecchio, leggilo come un sistema
  diverso dal percorso di gioco attuale.
:::

#### 🗺️ Anatomia della frase

- `{{古|ふる}}い{{記事|きじ}}で` -> la fonte è un articolo vecchio: il tempo della
  fonte cambia il valore operativo dell'etichetta.
- `EXバトルを{{見|み}}ても` -> `ても` concede il caso: anche se lo vedi, non
  devi inserirlo automaticamente nel percorso attuale.
- `{{別物|べつもの}}として{{読|よ}}んでください` -> `として` dà il ruolo di lettura:
  trattalo come "cosa diversa".

## Esempi guidati di riepilogo

:::example_sentence
jp: >-
  {{指揮官|しきかん}}レベルが{{5|ご}}になると、{{作戦|さくせん}}カードが{{解放|かいほう}}されます。
translation_it: >-
  Quando il livello comandante arriva a 5, le carte tattiche vengono sbloccate.
:::

:::example_sentence
jp: >-
  ミッションの{{進行|しんこう}}は、{{帰宅後|きたくご}}にMY PAGEで{{確認|かくにん}}できます。
translation_it: >-
  L'avanzamento delle missioni può essere controllato su MY PAGE dopo essere
  tornati a casa.
:::

:::example_sentence
jp: >-
  ランクマッチの{{前|まえ}}に、カジュアルマッチでデッキの{{役割|やくわり}}を{{確認|かくにん}}します。
translation_it: >-
  Prima del Rank Match, controllo i ruoli del deck in Casual Match.
:::

## Nota finale

Quando leggi modalità e progressione, cerca prima il frame: `ランク` ti parla di
classifica, [ミッション](term:term-mission) di obiettivi,
[～が{{解放|かいほう}}される](grammar:grammar-ga-kaihou-sareru) di funzioni che
diventano disponibili, [デッキ](term:term-deck) di struttura MS + PL. La scelta
pratica nasce da lì: allenarti, controllare dati, sbloccare tattiche o entrare
davvero nel rank.
