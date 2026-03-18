---
id: lesson-duel-masters-dm25-duel-plays-app-rewards-and-claim-flow
media_id: media-duel-masters-dm25
slug: duel-plays-app-rewards-and-claim-flow
title: デュエプレ App 4 - Present box, stage select e popup reward
order: 18
segment_ref: duel-plays-app
difficulty: n4
status: active
tags: [app, ui, rewards, progression, duel-plays]
prerequisites: [lesson-duel-masters-dm25-duel-plays-app-modes-and-progression]
summary: >-
  Approfondimento guidato su present box, stage select evento e popup reward:
  come leggere stato di riscossione, scadenze, livelli, preview delle reward e
  risultato finale direttamente nella UI di Duel Plays.
---

# Obiettivo

- distinguere ciò che è ancora da riscuotere da ciò che è già stato incassato;
- leggere date, livelli e costo d'ingresso senza perdere il senso pratico;
- capire quando un popup richiede ancora un'azione e quando certifica un risultato
  già registrato.

## Contesto

Nell'interfaccia di `デュエプレ`, i claim sono comunicati da label compatte:

- stato della reward;
- storico;
- scadenza;
- livello dello stage;
- bottone finale di riscossione o avvio.

Questi elementi vanno letti in sequenza:

1. vedi che cosa è pronto;
2. controlli se scade;
3. scegli dove entrare;
4. incassi davvero.

## Termini chiave

- [プレゼントボックス](term:term-present-box)
- [{{未|み}}{{受|う}}け{{取|と}}り](term:term-unclaimed)
- [{{受|う}}け{{取|と}}り{{履歴|りれき}}](term:term-claim-history)
- [{{一括|いっかつ}}{{受|う}}け{{取|と}}り](term:term-bulk-claim)
- [{{受|う}}け{{取|と}}り{{期限|きげん}}](term:term-claim-deadline)
- [{{期限|きげん}}](term:term-deadline)
- [{{獲得|かくとく}}](term:term-kakutoku)
- [{{日時|にちじ}}](term:term-datetime)
- [ステージ{{選択|せんたく}}](term:term-stage-select)
- [{{初級|しょきゅう}}](term:term-beginner-class)
- [{{中級|ちゅうきゅう}}](term:term-intermediate-class)
- [{{挑戦|ちょうせん}}](term:term-challenge)
- [{{既読|きどく}}](term:term-read-already)
- [スキップ](term:term-skip)
- [レジェンドスキル](term:term-legend-skill)
- [{{報酬|ほうしゅう}}](term:term-reward)
- [{{受|う}}け{{取|と}}る](term:term-receive)

## Pattern grammaticali chiave

- [{{未|み}}～](grammar:grammar-mi-prefix)
- [～{{済|ず}}み](grammar:grammar-zumi)
- [～{{可能|かのう}}](grammar:grammar-kanou)

## Spiegazione

### 1. Il present box è una coda di claim, non un semplice archivio

:::image
src: assets/ui/present-box-unclaimed.png
alt: >-
  Schermata プレゼントボックス con tab premi da ritirare e storico
  riscossioni, pulsante di claim multiplo, righe reward con data ottenimento,
  scadenza claim e bottone di riscossione.
caption: >-
  Ogni riga del `プレゼントボックス` combina nome reward,
  `{{獲得日時|かくとくにちじ}}`, `{{受|う}}け{{取|と}}り{{期限|きげん}}` e bottone
  `{{受|う}}け{{取|と}}る`: è una schermata di claim, non un semplice deposito
  di premi.
:::

[プレゼントボックス](term:term-present-box) mostra lo stato operativo della
reward:
- nella coda dei claim da completare;
- nello storico delle reward già completate.

Ogni riga espone tutti i dati operativi della singola reward:

- che premio è;
- da dove arriva;
- quando è stato ottenuto (`{{獲得|かくとく}}{{日時|にちじ}}`);
- fino a quando puoi ritirarlo (`{{受|う}}け{{取|と}}り{{期限|きげん}}`);
- quale bottone chiude la singola azione (`{{受|う}}け{{取|と}}る`).

Qui i due label da separare subito sono:

- [{{未|み}}{{受|う}}け{{取|と}}り](term:term-unclaimed): la reward è dentro la box ma
  devi ancora incassarla;
- [{{受|う}}け{{取|と}}り{{履歴|りれき}}](term:term-claim-history): l'incasso è già
  stato registrato e stai guardando lo storico, non il residuo aperto.

Anche [{{一括|いっかつ}}{{受|う}}け{{取|と}}り](term:term-bulk-claim) è più
operativo di quanto sembri. Il label ti dice che l'app può elaborare più reward
insieme, non una alla volta.

### 2. `{{受|う}}け{{取|と}}り{{期限|きげん}}` e `獲得日時` ti dicono quanto è urgente il claim

Nella stessa schermata compaiono due informazioni temporali diverse:

- [{{受|う}}け{{取|と}}り{{期限|きげん}}](term:term-claim-deadline) = fino a quando
  puoi ancora ritirare quel premio;
- `{{獲得|かくとく}}{{日時|にちじ}}` = quando quella reward è entrata nella box.

Qui [{{獲得|かくとく}}](term:term-kakutoku) marca l'ora di registrazione del
premio; [{{受|う}}け{{取|と}}り{{期限|きげん}}](term:term-claim-deadline) marca
l'ultima ora valida per reclamare. Le due etichette sono usate per decidere se la
reward è ancora recuperabile.

In pratica, [{{期限|きげん}}](term:term-deadline) ti parla di urgenza.
[{{日時|にちじ}}](term:term-datetime) ti parla di provenienza e
cronologia.

### 3. La stage select comprime livello, costo e reward preview

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
  [{{対戦開始|たいせんかいし}}](term:term-start-match).
:::

In [ステージ{{選択|せんたく}}](term:term-stage-select) la UI concentra molte
decisioni nello stesso spazio.

La schermata ti fa leggere tre blocchi insieme:

- la colonna sinistra, che contiene stage e difficoltà;
- il pannello destro alto, che riassume avversario e condizioni del contenuto;
- il pannello destro basso, che mostra `NEXT REWARD`, punti attuali e opzioni
  di avanzamento.

Le etichette operative da distinguere sono:

- [{{初級|しょきゅう}}](term:term-beginner-class) e
  [{{中級|ちゅうきゅう}}](term:term-intermediate-class): non indicano un corso
  di lingua, ma il livello previsto dello stage;
- [{{挑戦|ちょうせん}}](term:term-challenge): è l'atto di entrare davvero nello
  stage, spesso con un costo espresso in ticket;
- [{{既読|きどく}}](term:term-read-already) + [スキップ](term:term-skip): la
  coppia ti dice che il contenuto di storia è già stato letto e che puoi
  saltarlo;
- [レジェンドスキル](term:term-legend-skill): qui compare come informazione di
  setup del confronto, non come testo decorativo.

`あと13日` indica tempo residuo (`13 giorni rimasti`) e non una data assoluta.

Anche i pulsanti in basso fanno lavori diversi:

- `ステージ詳細` ti spiega meglio lo stage;
- `報酬確認` ti fa controllare le reward;
- [{{対戦開始|たいせんかいし}}](term:term-start-match) avvia davvero la sfida.

### 4. Il popup finale conferma che il claim è già avvenuto

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

Questo popup non richiede conferma utente: certifica che il claim è già stato
eseguito.

Quando leggi `{{以下|いか}}の{{報酬|ほうしゅう}}を{{受|う}}け{{取|と}}りました`,
la spia decisiva è il passato `ました`: l'azione è già avvenuta e i premi sono
già entrati nell'account. L'app ti mostra *quali* reward hai incassato, non ti
chiede *se* vuoi incassarle.

Regola operativa:

- [{{受|う}}け{{取|と}}る](term:term-receive) come verbo in etichetta/interfaccia = azione ancora da fare;
- `{{受|う}}け{{取|と}}りました` come forma già coniugata = azione già completata.

## Esempi guidati

**Esempio 1**

:::example_sentence
jp: >-
  {{未|み}}{{受|う}}け{{取|と}}りの{{報酬|ほうしゅう}}が{{2件|にけん}}ある。
translation_it: >-
  Ci sono 2 reward ancora da riscuotere.
:::

- [{{未|み}}{{受|う}}け{{取|と}}り](term:term-unclaimed) ti dice subito che
  l'incasso non è stato ancora completato.
- Qui il contrasto non è il tipo di premio, ma lo stato del claim: la reward è
  già presente nella box, però non è ancora stata trasferita al tuo inventario.

**Esempio 2**

:::example_sentence
jp: >-
  {{一括|いっかつ}}{{受|う}}け{{取|と}}りで{{全部|ぜんぶ}}{{受|う}}け{{取|と}}る。
translation_it: >-
  Riscuoti tutto in una volta.
:::

- [{{一括|いっかつ}}{{受|う}}け{{取|と}}り](term:term-bulk-claim) non descrive lo
  stato della reward, ma la modalità del claim.
- `{{一括|いっかつ}}` ti dice che il bottone applica la stessa riscossione a
  tutte le reward aperte, invece di fartene ritirare una per una.

**Esempio 3**

:::example_sentence
jp: >-
  {{中級|ちゅうきゅう}}にチケット{{2枚|にまい}}で{{挑戦|ちょうせん}}する。
translation_it: >-
  Sfida il livello intermedio usando 2 ticket.
:::

- [{{中級|ちゅうきゅう}}](term:term-intermediate-class) definisce il livello.
- [{{挑戦|ちょうせん}}](term:term-challenge) è il verbo che fa partire davvero lo
  stage: conferma il livello scelto e consuma il costo in ticket mostrato
  accanto.

**Esempio 4**

:::example_sentence
jp: >-
  {{既読|きどく}}ストーリーをスキップする。
translation_it: >-
  Salta le scene di storia già lette.
:::

- [{{既読|きどく}}](term:term-read-already) ti dice che quel contenuto non è
  nuovo per l'account.
- [スキップ](term:term-skip) è l'azione che questa condizione ti sblocca.

## Nota finale

Questa sequenza di schermate separa quattro stati operativi:
- reward presenti in coda ma non ancora riscossa;
- reward con scadenza monitorata;
- stage scelto con costo, livello e reward preview;
- popup di conferma dopo claim completato.
