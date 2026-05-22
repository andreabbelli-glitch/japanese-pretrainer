---
id: lesson-duel-masters-dm25-duel-plays-app-rewards-and-claim-flow
media_id: media-duel-masters-dm25
slug: duel-plays-app-rewards-and-claim-flow
title: Premi, scadenze e stage event in デュエプレ
order: 18
segment_ref: duel-plays-app
difficulty: n4
status: active
tags: [app, ui, rewards, progression, duel-plays]
prerequisites: [lesson-duel-masters-dm25-duel-plays-app-modes-and-progression]
summary: >-
  Leggere present box, stage select e popup reward in Duel Plays distinguendo
  claim aperti, scadenze, livelli, preview delle reward e risultato finale.
---

# Premi, scadenze e stage event in デュエプレ

Quando `デュエプレ` assegna premi da login, missioni o eventi, la UI non dice
solo "hai ottenuto qualcosa". Separa il contenitore, lo stato del claim, la
scadenza, lo stage da affrontare e il popup che certifica la ricezione finale.

La sequenza è molto leggibile se guardi i label come una catena: prima
[プレゼントボックス](term:term-present-box) ti mostra che cosa resta aperto,
poi [ステージ{{選択|せんたく}}](term:term-stage-select) ti fa scegliere dove
entrare, infine [{{報酬|ほうしゅう}}](term:term-reward) +
[{{受|う}}け{{取|と}}る](term:term-receive) chiudono il flusso. Il punto non è
memorizzare tutti i pulsanti, ma riconoscere se la schermata sta parlando di un
premio promesso, ritirabile o già ricevuto.

## Termini chiave

- [プレゼントボックス](term:term-present-box) — contenitore dei premi assegnati
  all'account
- [{{報酬|ほうしゅう}}](term:term-reward) — reward, premio ottenibile o già
  ricevuto
- [{{受|う}}け{{取|と}}る](term:term-receive) — ritirare, prendere in consegna
  il premio
- [{{獲得|かくとく}}](term:term-kakutoku) — ottenimento registrato dal sistema
- [{{日時|にちじ}}](term:term-datetime) — data e ora di un evento registrato
- [{{期限|きげん}}](term:term-deadline) — limite temporale, scadenza
- [ステージ{{選択|せんたく}}](term:term-stage-select) — schermata di scelta dello
  stage
- [{{挑戦|ちょうせん}}](term:term-challenge) — tentativo / ingresso nella sfida

## Espressioni ricorrenti

- [{{未|み}}{{受|う}}け{{取|と}}り](term:term-unclaimed) — premio non ancora
  ritirato
- [{{受|う}}け{{取|と}}り{{履歴|りれき}}](term:term-claim-history) — storico dei
  claim completati
- [{{一括|いっかつ}}{{受|う}}け{{取|と}}り](term:term-bulk-claim) — ritiro
  cumulativo
- [{{受|う}}け{{取|と}}り{{期限|きげん}}](term:term-claim-deadline) — scadenza del
  ritiro
- [{{既読|きどく}}](term:term-read-already) + [スキップ](term:term-skip) — storia
  già letta e quindi saltabile

## Pattern grammaticali chiave

- [{{未|み}}～](grammar:grammar-mi-prefix) — prefisso "non ancora"
- [～{{済|ず}}み](grammar:grammar-zumi) — stato già concluso o elaborato
- [～{{可能|かのう}}](grammar:grammar-kanou) — azione disponibile / possibile

## Etichette da riconoscere

- [{{初級|しょきゅう}}](term:term-beginner-class) — livello base dello stage
- [{{中級|ちゅうきゅう}}](term:term-intermediate-class) — livello intermedio dello
  stage
- [レジェンドスキル](term:term-legend-skill) — abilità speciale mostrata nel
  setup del confronto
- [{{対戦|たいせん}}{{開始|かいし}}](term:term-start-match) — avvio effettivo della
  partita
- `あと13日` — tempo residuo espresso come "ancora 13 giorni"

---

[～{{済|ず}}み](grammar:grammar-zumi) e [～{{可能|かのう}}](grammar:grammar-kanou) separano due stati di UI: il primo dice che qualcosa è già concluso, il secondo che un'azione è disponibile.

## 1. プレゼントボックス divide coda aperta e storico

Nel [プレゼントボックス](term:term-present-box), プレゼント non è solo "regalo"
in senso generico: dentro la UI diventa il contenitore dei premi assegnati ma
non necessariamente già trasferiti nel tuo inventario. Per leggerlo bene devi
separare tre cose: il premio, lo stato del claim e il bottone che esegue
l'azione.

:::image
src: assets/ui/present-box-unclaimed.png
alt: >-
  Schermata プレゼントボックス con tab premi da ritirare e storico
  riscossioni, pulsante di claim multiplo, righe reward con data ottenimento,
  scadenza claim e bottone di riscossione.
caption: >-
  Ogni riga del `プレゼントボックス` combina nome reward,
  `{{獲得|かくとく}}{{日時|にちじ}}`, `{{受|う}}け{{取|と}}り{{期限|きげん}}` e bottone
  `{{受|う}}け{{取|と}}る`: è una schermata di claim, non un semplice deposito
  di premi.
:::

- [{{未|み}}{{受|う}}け{{取|と}}り](term:term-unclaimed) combina il prefisso
  [{{未|み}}～](grammar:grammar-mi-prefix) con
  `{{受|う}}け{{取|と}}り`: il premio esiste già nella box, ma l'azione di
  prenderlo non è ancora stata completata. La lettura pratica è "coda aperta",
  non "premio mancante".
- [{{受|う}}け{{取|と}}り{{履歴|りれき}}](term:term-claim-history) guarda nella
  direzione opposta. `{{履歴|りれき}}` segnala storico: stai consultando claim
  già registrati, quindi non devi cercare un bottone di incasso sulla stessa
  riga.
- [{{一括|いっかつ}}{{受|う}}け{{取|と}}り](term:term-bulk-claim) non cambia il
  significato di [{{受|う}}け{{取|と}}る](term:term-receive), ma cambia la scala
  dell'azione. `{{一括|いっかつ}}` ti dice che l'app può trattare più righe
  aperte come un blocco unico, invece di farti premere
  [{{受|う}}け{{取|と}}る](term:term-receive) una reward alla volta.

:::example_sentence
jp: >-
  {{未|み}}{{受|う}}け{{取|と}}りの{{報酬|ほうしゅう}}が{{2件|にけん}}あるので、{{一括|いっかつ}}{{受|う}}け{{取|と}}りでまとめて{{受|う}}け{{取|と}}る。
translation_it: >-
  Ci sono due reward non ancora ritirate, quindi le ritiro tutte assieme con il claim cumulativo.
:::

#### 🗺️ Anatomia della frase

*   [{{未|み}}{{受|う}}け{{取|と}}り](term:term-unclaimed)の[{{報酬|ほうしゅう}}](term:term-reward) ➔ **Nome modificato dallo stato**: の collega "non ancora ritirato" a "reward", quindi non descrive il tipo di premio ma il suo stato operativo.
*   `{{2件|にけん}}あるので` ➔ **Motivo quantitativo**: il contatore `件` tratta le reward come pratiche o elementi di lista; `ので` trasforma quel numero nella ragione dell'azione successiva.
*   [{{一括|いっかつ}}{{受|う}}け{{取|と}}り](term:term-bulk-claim)で ➔ **Mezzo dell'azione**: で indica lo strumento usato per ritirare.
*   まとめて[{{受|う}}け{{取|と}}る](term:term-receive) ➔ **Azione finale**: まとめて rafforza l'idea di gruppo, mentre [{{受|う}}け{{取|と}}る](term:term-receive) chiude il claim.

#### ⚖️ Contrasto operativo

[{{未|み}}{{受|う}}け{{取|と}}り](term:term-unclaimed) non significa che la reward
non esiste ancora. Significa che è già stata assegnata alla box, ma manca il
passaggio di ritiro. [{{受|う}}け{{取|と}}り{{履歴|りれき}}](term:term-claim-history)
invece non promette nuove reward: registra quello che è già stato preso.

## 2. 獲得日時 e 受け取り期限 separano passato e urgenza

La stessa riga del present box contiene due tempi diversi. Se li leggi entrambi
come "data del premio", perdi la funzione della schermata.

- [{{獲得|かくとく}}](term:term-kakutoku) dice che il sistema ha registrato
  l'ottenimento. Quando si unisce a [{{日時|にちじ}}](term:term-datetime), forma
  `{{獲得|かくとく}}{{日時|にちじ}}`: il momento in cui quella reward è entrata
  nella tua coda.
- [{{受|う}}け{{取|と}}り{{期限|きげん}}](term:term-claim-deadline) guarda al
  limite futuro. [{{期限|きげん}}](term:term-deadline) non racconta da dove viene
  il premio; ti dice fino a quando puoi ancora completare il claim.
- [{{日時|にちじ}}](term:term-datetime) è neutro e cronologico: data + ora.
  [{{期限|きげん}}](term:term-deadline) è operativo: se passa quel limite,
  l'azione può non essere più disponibile.

:::example_sentence
jp: >-
  {{獲得|かくとく}}{{日時|にちじ}}を{{見|み}}てから、{{受|う}}け{{取|と}}り{{期限|きげん}}が{{切|き}}れる{{前|まえ}}に{{報酬|ほうしゅう}}を{{受|う}}け{{取|と}}る。
translation_it: >-
  Dopo aver controllato data e ora di ottenimento, ritiro la reward prima che scada il limite di claim.
:::

#### 🗺️ Anatomia della frase

*   [{{獲得|かくとく}}](term:term-kakutoku)[{{日時|にちじ}}](term:term-datetime)を{{見|み}}てから ➔ **Controllo preliminare**: てから mette la verifica temporale prima dell'azione principale.
*   [{{受|う}}け{{取|と}}り{{期限|きげん}}](term:term-claim-deadline)が{{切|き}}れる{{前|まえ}}に ➔ **Limite prima della scadenza**: が marca la scadenza come soggetto di {{切|き}}れる, e {{前|まえ}}に impone di agire prima di quel momento.
*   [{{報酬|ほうしゅう}}](term:term-reward)を[{{受|う}}け{{取|と}}る](term:term-receive) ➔ **Oggetto + azione**: を marca ciò che entra effettivamente in tuo possesso.

#### ⚖️ Contrasto operativo

`{{獲得|かくとく}}{{日時|にちじ}}` risponde a "quando è arrivato nella box?".
[{{受|う}}け{{取|と}}り{{期限|きげん}}](term:term-claim-deadline) risponde a
"entro quando devo prenderlo?". Il primo guarda indietro, il secondo mette un
timer davanti al bottone.

#### 🧠 Gancio cognitivo

Come trucco mnemonico, leggi [{{獲得|かくとく}}](term:term-kakutoku) come il
timbro d'ingresso e [{{期限|きげん}}](term:term-deadline) come il timer. Non è
un'etimologia: è un modo pratico per ricordare quale data descrive il passato e
quale data crea urgenza.

## 3. ステージ選択 comprime difficoltà, costo e reward preview

:::image
src: assets/ui/stage-select-collab-event.png
alt: >-
  Schermata stage select con lista stage a sinistra, livelli beginner e
  intermediate, costo in ticket, NEXT REWARD, checkbox di skip storia già
  letta e pulsanti verifica reward e avvio sfida.
caption: >-
  In [ステージ{{選択|せんたく}}](term:term-stage-select) scegli lo stage a
  sinistra e, a destra, controlli avversario, reward, opzioni di skip e
  pulsanti come `{{報酬|ほうしゅう}}{{確認|かくにん}}` e
  [{{対戦|たいせん}}{{開始|かいし}}](term:term-start-match).
:::

In [ステージ{{選択|せんたく}}](term:term-stage-select), la UI cambia registro:
non stai più guardando premi già assegnati, ma un contenuto da scegliere e
affrontare. Il giapponese qui deve farti capire livello, costo, reward futura e
stato della storia.

- [{{初級|しょきゅう}}](term:term-beginner-class) e
  [{{中級|ちゅうきゅう}}](term:term-intermediate-class) sono classi di
  difficoltà dello stage. Non indicano "lezione base/intermedia" in senso
  scolastico: nella schermata funzionano come filtri di sfida.
- [{{挑戦|ちょうせん}}](term:term-challenge) porta l'idea di affrontare un
  tentativo. Se compare accanto a ticket o costo, la parola ti dice che non
  stai solo aprendo un dettaglio: stai spendendo l'ingresso per entrare nello
  stage.
- [{{既読|きどく}}](term:term-read-already) + [スキップ](term:term-skip) separa
  storia e battaglia. [{{既読|きどく}}](term:term-read-already) dice che il testo
  narrativo è già stato letto; [スキップ](term:term-skip) è l'azione resa
  possibile da quello stato.
- [レジェンドスキル](term:term-legend-skill) non è una decorazione del pannello:
  è informazione di setup. Quando appare vicino all'avversario o allo stage,
  prepara la lettura della partita che stai per iniziare.
- `あと13日` usa `あと` come "ancora / rimanenti": è tempo residuo dell'evento,
  non una data assoluta da calendario.

:::example_sentence
jp: >-
  {{既読|きどく}}のストーリーをスキップして、{{中級|ちゅうきゅう}}のステージにチケット{{2枚|にまい}}で{{挑戦|ちょうせん}}する。
translation_it: >-
  Salto la storia già letta e sfido lo stage intermedio usando due ticket.
:::

#### 🗺️ Anatomia della frase

*   [{{既読|きどく}}](term:term-read-already)のストーリーを ➔ **Oggetto già letto**: の trasforma "già letto" in modificatore di ストーリー.
*   [スキップ](term:term-skip)して ➔ **Prima azione collegata**: la forma in -te unisce lo skip all'azione successiva senza farne il risultato finale.
*   [{{中級|ちゅうきゅう}}](term:term-intermediate-class)のステージに ➔ **Destinazione della sfida**: に marca lo stage verso cui entri.
*   チケット{{2枚|にまい}}で[{{挑戦|ちょうせん}}](term:term-challenge)する ➔ **Mezzo / costo + azione**: で legge i due ticket come risorsa usata per affrontare lo stage.

#### ⚖️ Contrasto operativo

`ステージ{{詳細|しょうさい}}` e `{{報酬|ほうしゅう}}{{確認|かくにん}}` aprono
informazioni: dettagli e preview. [{{対戦|たいせん}}{{開始|かいし}}](term:term-start-match)
chiude invece la preparazione e fa partire la partita. [{{挑戦|ちょうせん}}](term:term-challenge)
sta dalla stessa parte operativa dell'ingresso: non è semplice lettura, è il
tentativo che consuma il costo mostrato.

## 4. Il popup 報酬受け取り certifica un claim già riuscito

:::image
src: assets/ui/reward-claim-popup.png
alt: >-
  Popup di claim reward con frase centrale di conferma dell'incasso e bottone
  OK.
caption: >-
  Il titolo dice `{{報酬|ほうしゅう}}{{受|う}}け{{取|と}}り`, ma la frase
  `{{以下|いか}}の{{報酬|ほうしゅう}}を{{受|う}}け{{取|と}}りました`
  conferma che l'incasso è già stato registrato.
:::

Il popup finale cambia ancora il tempo della frase. Il titolo
`{{報酬|ほうしゅう}}{{受|う}}け{{取|と}}り` nomina il flusso, ma la frase centrale
usa il passato cortese: `{{受|う}}け{{取|と}}りました`. Quando vedi `ました`, il
claim non è una richiesta futura; è un risultato già registrato.

:::example_sentence
jp: >-
  {{以下|いか}}の{{報酬|ほうしゅう}}を{{受|う}}け{{取|と}}りました。
translation_it: >-
  Hai ricevuto le reward seguenti.
:::

#### 🗺️ Anatomia della frase

*   {{以下|いか}}の[{{報酬|ほうしゅう}}](term:term-reward)を ➔ **Oggetto elencato sotto**: {{以下|いか}}の prepara la lista che segue nel popup, e を marca quelle reward come oggetto ricevuto.
*   [{{受|う}}け{{取|と}}りました](term:term-receive) ➔ **Azione conclusa**: il verbo composto [{{受|う}}け{{取|と}}る](term:term-receive) è al passato cortese ました, quindi l'app sta comunicando un esito, non chiedendo una scelta.

#### ⚖️ Contrasto operativo

[{{受|う}}け{{取|と}}る](term:term-receive) su un bottone è un invito
all'azione: "ritira". `{{受|う}}け{{取|と}}りました` in una frase di popup è una
conferma: "hai ritirato". La differenza non sta nel sostantivo
[{{報酬|ほうしゅう}}](term:term-reward), ma nella forma verbale che accompagna il
claim.

#### 🧠 Gancio cognitivo

Leggi il flusso come tre cartellini: [{{未|み}}～](grammar:grammar-mi-prefix)
apre ciò che non è ancora completato, [{{期限|きげん}}](term:term-deadline) mette
un limite, `ました` timbra l'azione conclusa. È un gancio mnemonico per la UI:
non sostituisce il parsing, ma ti aiuta a riconoscere subito in quale fase del
claim ti trovi.

## Esempi guidati di riepilogo

:::example_sentence
jp: >-
  {{未|み}}{{受|う}}け{{取|と}}りの{{報酬|ほうしゅう}}が{{2件|にけん}}あるので、{{受|う}}け{{取|と}}り{{期限|きげん}}が{{切|き}}れる{{前|まえ}}にボタンを{{押|お}}す。
translation_it: >-
  Ci sono 2 ricompense non ritirate, quindi premo il bottone prima che scada il periodo per il ritiro.
:::

:::example_sentence
jp: >-
  アイテムが{{多|おお}}すぎる{{時|とき}}は、{{一括|いっかつ}}{{受|う}}け{{取|と}}りボタンで{{全部|ぜんぶ}}{{受|う}}け{{取|と}}る。
translation_it: >-
  Quando ci sono troppi item, ricevo tutto assieme cliccando sul tasto del ritiro cumulativo.
:::

:::example_sentence
jp: >-
  ストーリーの{{中級|ちゅうきゅう}}にチケット{{2枚|にまい}}で{{挑戦|ちょうせん}}して、ボスを{{倒|たお}}す。
translation_it: >-
  Sfido il livello intermedio della storia consumando 2 ticket e sconfiggo il boss.
:::

:::example_sentence
jp: >-
  {{時間|じかん}}がない{{時|とき}}は、{{既読|きどく}}ストーリーをスキップしてバトルだけ{{楽|たの}}しむ。
translation_it: >-
  Quando non si ha tempo, si salta la storia già letta per godersi solamente il combattimento.
:::

In queste frasi, i pezzi lavorano insieme: [{{未|み}}{{受|う}}け{{取|と}}り](term:term-unclaimed)
dice che il claim è aperto, [{{受|う}}け{{取|と}}り{{期限|きげん}}](term:term-claim-deadline)
dà urgenza, [{{一括|いっかつ}}{{受|う}}け{{取|と}}り](term:term-bulk-claim)
cambia la scala dell'azione, [{{中級|ちゅうきゅう}}](term:term-intermediate-class)
e [{{挑戦|ちょうせん}}](term:term-challenge) portano nello stage, mentre
[{{既読|きどく}}](term:term-read-already) + [スキップ](term:term-skip) separano
la storia già letta dalla battaglia.

## Nota finale

Le schermate reward di `デュエプレ` diventano chiare quando leggi ogni label
come stato del flusso: [プレゼントボックス](term:term-present-box) contiene ciò
che è stato assegnato, [{{未|み}}{{受|う}}け{{取|と}}り](term:term-unclaimed)
marca ciò che resta da ritirare, [{{受|う}}け{{取|と}}り{{期限|きげん}}](term:term-claim-deadline)
mette il limite, [ステージ{{選択|せんたく}}](term:term-stage-select) sposta la
lettura verso la sfida, e `{{受|う}}け{{取|と}}りました` chiude il percorso come
risultato già registrato.
