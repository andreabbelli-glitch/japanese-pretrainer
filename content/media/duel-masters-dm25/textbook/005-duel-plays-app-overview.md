---
id: lesson-duel-masters-dm25-duel-plays-app-overview
media_id: media-duel-masters-dm25
slug: duel-plays-app-overview
title: デュエプレ App 1 - Home, premi e schermate base
order: 15
segment_ref: duel-plays-app
difficulty: n4
status: active
tags: [app, ui, navigation, duel-plays]
prerequisites: []
summary: >-
  `デュエプレ` in prima schermata: home, scorciatoie e label operativi per
  distinguere missioni, premi, conferme e azioni di claim.
---

# Obiettivo

Usa la home di `デュエプレ` per distinguere subito cosa descrive lo schermo e
quale elemento avvia un'azione.

All'apertura della home, ti serve riconoscere:

- le etichette-base della schermata iniziale;
- dove sono missioni, avvisi, premi e impostazioni;
- la differenza tra label di stato e bottone che finalizza un'azione;
- l'interazione tra inglese di navigazione e giapponese operativo.

## Contesto

Nel testo scritto il problema è interpretare la frase. In app il problema è
operativo: identificare cosa informa e cosa apre davvero un nuovo passaggio.

Nella home di `デュエプレ`, se non separi bene
[ミッション](term:term-mission), [プレゼント](term:term-present),
[{{報酬|ほうしゅう}}](term:term-reward) e
[{{受け取る|うけとる}}](term:term-receive), rischi di riconoscere il vocabolo
ma non l'azione da fare.

La barra bassa è quasi sempre bilingue (`Home`, `Solo play`, `Battle`, `Shop`),
mentre banner, popup e titoli interni restano in giapponese. Prima di
interagire, controlla sempre posizione, icona e label insieme.

La regola pratica è questa:

- alcune parole indicano la sezione raggiunta;
- altre indicano lo stato del contenuto;
- altre ancora indicano un'azione da toccare.

## Termini chiave

- [ホーム](term:term-home)
- [ミッション](term:term-mission)
- [ログインボーナス](term:term-login-bonus)
- [プレゼント](term:term-present)
- [{{お知らせ|おしらせ}}](term:term-news)
- [ショップ](term:term-shop)
- [{{設定|せってい}}](term:term-settings)
- [{{その他|そのた}}](term:term-etc)
- [{{開|ひら}}く](term:term-open)
- [{{確認|かくにん}}](term:term-confirm)
- [{{報酬|ほうしゅう}}](term:term-reward)
- [{{受け取る|うけとる}}](term:term-receive)

## Pattern grammaticali chiave

- [～{{一覧|いちらん}}](grammar:grammar-ichiran)
- [～{{中|ちゅう}}](grammar:grammar-ui-chuu)
- [～{{済|ず}}み](grammar:grammar-zumi)
- [{{未|み}}～](grammar:grammar-mi-prefix)

## Spiegazione

### 1. La home non è contenuto: è una mappa di tap e stato

:::image
src: assets/ui/home-screen.png
alt: >-
  Schermata home di デュエプレ con barra bassa quasi bilingue, fila di icone in
  alto e banner centrali per eventi, missioni e scorciatoie.
caption: >-
  La home di `デュエプレ` mescola navigazione persistente, icone rapide e banner
  centrali: ogni elemento va letto in base al ruolo (`informazione` o `azione`).
:::

[ホーム](term:term-home) è il punto di orientamento della home. Appena arrivato,
controlla se la scritta indica solo stato o se il tap porta a un altro screen.

Nello screenshot ci sono tre livelli:

- la barra bassa, che indica la macro-area attiva;
- la fila di icone in alto, con scorciatoie rapide;
- i banner e i pannelli centrali, con eventi, missioni e campagne attive.

La domanda operativa è:
"Questo elemento mi informa o mi porta in un'altra schermata?"

Usa subito queste etichette:

- [ミッション](term:term-mission)
- [ログインボーナス](term:term-login-bonus)
- [プレゼント](term:term-present)
- [{{お知らせ|おしらせ}}](term:term-news)
- [ショップ](term:term-shop)
- [{{設定|せってい}}](term:term-settings)
- [{{その他|そのた}}](term:term-etc)

Quando queste etichette sono chiare, la UI resta leggibile già al primo accesso.

`{{その他|そのた}}` compare spesso anche come `Etc.` sotto un'icona. Non va
scambiato con [{{設定|せってい}}](term:term-settings):
apre un menu "altro / varie" con funzioni secondarie.

Nella UI reale molti accessi sono icone, badge e banner, non sempre bottoni con
testo pieno. Per questo il titolo della schermata che si apre conferma subito il
contesto corretto.

### 2. Missioni, bonus e premi: una catena, non tre sinonimi

[ミッション](term:term-mission) è il compito da completare.
[ログインボーナス](term:term-login-bonus) è la reward legata all'accesso.
[プレゼント](term:term-present) è la casella da cui ritirare oggetti o premi.

In uso pratico:

- la missione definisce cosa fare;
- il login bonus dice cosa ricevi;
- [プレゼント](term:term-present) ti mostra dove è custodito il premio assegnato;
- [{{受け取る|うけとる}}](term:term-receive) conclude il flusso di claim.

Non basta identificare [{{報酬|ほうしゅう}}](term:term-reward):
devi verificare dove viene depositato e se resta un bottone attivo da premere.

### 3. I label di stato valgono quasi come frasi complete

L'interfaccia compatta giapponese rende utili questi marker:

- [～{{一覧|いちらん}}](grammar:grammar-ichiran) = vista lista;
- [～{{中|ちゅう}}](grammar:grammar-ui-chuu) = stato attivo / in corso;
- [～{{済|ず}}み](grammar:grammar-zumi) = già fatto o riscattato;
- [{{未|み}}～](grammar:grammar-mi-prefix) = non pronto o non sbloccato.

Questi marker ti indicano se una sezione richiede un'azione ora o è già chiusa.

### 4. `{{確認|かくにん}}` e `{{受け取る|うけとる}}`: distinzione tra verifica e claim

[{{確認|かくにん}}](term:term-confirm) e
[{{受け取る|うけとる}}](term:term-receive) non fanno la stessa operazione.

- [{{確認|かくにん}}](term:term-confirm) serve a controllare o confermare un
  dettaglio;
- [{{受け取る|うけとる}}](term:term-receive) chiude la reward mostrata e la
  rende disponibile.

In pratica: `確認` cambia stato informativo, `受け取る` finalizza il flusso.

### 5. `{{お知らせ|おしらせ}}`, `{{設定|せってい}}` e `{{その他|そのた}}`: tre aree da distinguere

[{{お知らせ|おしらせ}}](term:term-news) porta a informazioni ufficiali,
campagne, eventi e aggiornamenti.
[{{設定|せってい}}](term:term-settings) apre preferenze e impostazioni dell'app.
[{{その他|そのた}}](term:term-etc) è un contenitore "altro / etc." con voci
secondarie.

Conferma sempre:

- [{{お知らせ|おしらせ}}](term:term-news) per contesto e comunicazioni;
- [{{設定|せってい}}](term:term-settings) per preferenze;
- [{{その他|そのた}}](term:term-etc) per voci eterogenee.

L'accesso avviene spesso via icona. In apertura schermata, il titolo ti conferma
l'area vera in cui sei entrato.

## Esempi guidati

**Esempio 1**

:::example_sentence
jp: >-
  ミッション{{一覧|いちらん}}
translation_it: >-
  Elenco delle missioni.
:::

- [～{{一覧|いちらん}}](grammar:grammar-ichiran) indica una lista.
- Non stai leggendo una sola missione, ma la schermata che ti fa scegliere un
  elemento.

**Esempio 2**

:::example_sentence
jp: >-
  {{開催中|かいさいちゅう}}のイベント
translation_it: >-
  Evento attualmente in corso.
:::

- [{{開催中|かいさいちゅう}}](term:term-ongoing) segnala uno stato attivo.
- [～{{中|ちゅう}}](grammar:grammar-ui-chuu) ti dice che l'elemento vale ora.

**Esempio 3**

:::example_sentence
jp: >-
  {{報酬|ほうしゅう}}を{{受け取る|うけとる}}
translation_it: >-
  Ritira la ricompensa.
:::

- [{{報酬|ほうしゅう}}](term:term-reward) = ciò che ottieni;
- [{{受け取る|うけとる}}](term:term-receive) = chiusura concreta del claim.
- Insieme, indicano che c'è un premio da riscattare e quindi un'azione da
  completare.

**Esempio 4**

:::example_sentence
jp: >-
  {{未達成|みたっせい}}
translation_it: >-
  Non ancora completato.
:::

- [{{未|み}}～](grammar:grammar-mi-prefix) indica stato non ancora raggiunto.
- `{{未達成|みたっせい}}` conferma che la missione non
  è ancora chiusa.

## Nota finale

Schema da applicare a ogni schermata:

1) `informazione` → leggi e passa oltre;
2) `stato` → valuta subito se il contenuto è aperto o concluso;
3) `azione` ([{{確認|かくにん}}](term:term-confirm), [{{受け取る|うけとる}}](term:term-receive)) → tocca solo se il flusso richiede una conferma
   o un claim.

Con questa lettura, `デュエプレ` diventa prevedibile: meno popup ambiguo, più
azione concreta.
