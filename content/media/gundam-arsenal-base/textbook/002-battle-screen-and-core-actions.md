---
id: lesson-gundam-arsenal-base-battle-screen-and-core-actions
media_id: media-gundam-arsenal-base
slug: battle-screen-and-core-actions
title: Schermata di battaglia e azioni base
order: 20
segment_ref: battle-core
difficulty: n4
status: active
tags: [battle, ui, roles, resources]
prerequisites: [lesson-gundam-arsenal-base-arcade-onboarding]
summary: >-
  Leggi la schermata di battaglia, distingui risorse e ruoli, e capisci quando
  usare sortie, abilità e tecniche tattiche.
---

# Obiettivo

Questa pagina insegna a leggere la schermata di battaglia senza farsi distrarre
dalle animazioni. L'obiettivo operativo è identificare rapidamente cosa guardare
per primo, cosa comunicano gauge e minimappa, e quali condizioni attivano
in modo pratico [{{出撃|しゅつげき}}](term:term-sortie),
[アビリティ](term:term-ability) e
[{{戦術技|せん.じゅつ.ぎ}}](term:term-special-attack).

## Contesto

Questi termini compaiono durante il match. Sono la lingua operativa del campo:
barre in alto, unità sul lato, mappa, obiettivi e comandi che consumano risorse.
La lettura è centrata su campo e termini, non su meta generale o teoria esterna alle
decisioni della partita.

## Termini chiave

- [{{自軍|じぐん}}{{戦力|せんりょく}}ゲージ](term:term-friendly-strength-gauge)
- [{{敵軍|てきぐん}}{{戦力|せんりょく}}ゲージ](term:term-enemy-strength-gauge)
- [ユニット](term:term-unit)
- [ミニマップ](term:term-minimap)
- [バトルフィールド](term:term-battlefield)
- [{{作戦|さくせん}}カード](term:term-tactics-card)
- [{{出撃|しゅつげき}}](term:term-sortie)
- [アビリティ](term:term-ability)
- [{{戦術技|せん.じゅつ.ぎ}}](term:term-special-attack)
- [コスト](term:term-cost)
- [SPゲージ](term:term-sp-gauge)
- [{{殲滅|せんめつ}}](term:term-role-shoumetsu)
- [{{制圧|せいあつ}}](term:term-role-seiatsu)
- [{{防衛|ぼうえい}}](term:term-role-bouei)
- [{{拠点|きょてん}}](term:term-base)
- [{{戦艦|せんかん}}](term:term-warship)
- [クライマックスブースト](term:term-climax-boost)

## Pattern grammaticali chiave

- [～が{{表示|ひょうじ}}される](grammar:grammar-ga-hyouji-sareru)
- [～することで](grammar:grammar-suru-koto-de)
- [～をタッチする](grammar:grammar-wo-tacchi-suru)

## Spiegazione

La schermata sembra piena di informazioni, ma non va letta tutta insieme. L'ordine
utile è questo: prima guarda dove sono [{{殲滅|せんめつ}}](term:term-role-shoumetsu),
[{{制圧|せいあつ}}](term:term-role-seiatsu) e
[{{防衛|ぼうえい}}](term:term-role-bouei); poi individua quale
[{{拠点|きょてん}}](term:term-base) o [{{戦艦|せんかん}}](term:term-warship) sta per
subire pressione; solo dopo controlla i dettagli delle singole carte. Se
cerchi di processarle tutte insieme, la lettura delle priorità tende a rallentare
l'identificazione delle reali azioni urgenti.

:::image
src: assets/ui/battle-screen-reference.webp
alt: "Schermata ufficiale di battaglia con gauge dei due lati, pannelli unità, costo, SP gauge e minimappa visibili nello stesso frame."
caption: >-
  Schermata ufficiale di battaglia: in alto leggi [{{自軍|じぐん}}{{戦力|せんりょく}}ゲージ](term:term-friendly-strength-gauge) e [{{敵軍|てきぐん}}{{戦力|せんりょく}}ゲージ](term:term-enemy-strength-gauge); in basso compaiono [コスト](term:term-cost), [SPゲージ](term:term-sp-gauge) e i pannelli [ユニット](term:term-unit); al centro resta la [ミニマップ](term:term-minimap).
:::

Le barre in alto non sono semplici indicatori generici di HP. La
[{{自軍|じぐん}}{{戦力|せんりょく}}ゲージ](term:term-friendly-strength-gauge)
e la [{{敵軍|てきぐん}}{{戦力|せんりょく}}ゲージ](term:term-enemy-strength-gauge)
riassumono la resistenza di [{{戦艦|せんかん}}](term:term-warship) e
[{{拠点|きょてん}}](term:term-base). Se la
[{{戦艦|せんかん}}](term:term-warship) nemica viene distrutta, vinci subito. Se
il tempo finisce, vince chi conserva più gauge. Se invece cade la tua
[{{戦艦|せんかん}}](term:term-warship), perdi anche se in altre zone della mappa
stai ancora combattendo bene.

La [ミニマップ](term:term-minimap) è il riassunto più rapido del match. Serve a
capire dove una corsia è aperta, dove c'è una difesa e dove il tuo
[{{制圧|せいあつ}}](term:term-role-seiatsu) sta per arrivare davvero su un
obiettivo. Il [バトルフィールド](term:term-battlefield) ti fa vedere la scena in
grande e ti permette di spostare o zoomare la camera, ma se guardi solo quello
rischi di seguire l'animazione sbagliata e di perdere la lettura globale.

Sul lato dello schermo trovi i pannelli dei tuoi [ユニット](term:term-unit). È lì
che decidi tre azioni base. Nel PDF ufficiale compare anche
`{{敵|てき}}デッキ{{情報|じょうほう}}`: è una zona che si riempie man mano che
le unità nemiche entrano in campo, utile per leggere quali pezzi hai già visto,
ma non è la tua prima priorità mentale.

Le tre azioni base funzionano così.

- [{{出撃|しゅつげき}}](term:term-sortie): trascini un
  [ユニット](term:term-unit) sulla zona valida della mappa e paghi
  [コスト](term:term-cost). La decisione vera non è solo "farlo uscire", ma
  scegliere quale corsia vuoi aprire o difendere.
- [アビリティ](term:term-ability): attivi l'effetto speciale del MS pagando
  ancora [コスト](term:term-cost). Alcune abilità chiedono anche una posizione
  precisa sulla mappa, quindi qui la lettura dello spazio conta davvero.
- [{{戦術技|せん.じゅつ.ぎ}}](term:term-special-attack): la attivi con uno
  slide verso il basso e consumi [SPゲージ](term:term-sp-gauge). Durante
  l'animazione compare un minigioco col bottone che può aumentare il danno o
  ridurre quello subito.

I tre ruoli base vanno letti come funzioni del campo, non come etichette
astratte.

- [{{殲滅|せんめつ}}](term:term-role-shoumetsu) vuol dire che l'unità punta prima
  ai nemici. In pratica è il ruolo che libera la strada rimuovendo unità
  avversarie, soprattutto quando una difesa ti sta bloccando.
- [{{制圧|せいあつ}}](term:term-role-seiatsu) vuol dire che l'unità cerca
  [{{拠点|きょてん}}](term:term-base) e
  [{{戦艦|せんかん}}](term:term-warship). In pratica è il ruolo che trasforma una
  corsia aperta in danno reale alla gauge.
- [{{防衛|ぼうえい}}](term:term-role-bouei) vuol dire che l'unità difende il
  punto vicino. Quando protegge un obiettivo, la sua difesa sale; l'ufficiale
  specifica anche che mettere due difensori sullo stesso punto non aggiunge un
  secondo bonus di difesa.

Nell'analisi della scena corrente, la relazione operativa di base è:
[{{防衛|ぼうえい}}](term:term-role-bouei) rallenta il
[{{制圧|せいあつ}}](term:term-role-seiatsu); il
[{{殲滅|せんめつ}}](term:term-role-shoumetsu) serve a togliere il
[{{防衛|ぼうえい}}](term:term-role-bouei); il
[{{制圧|せいあつ}}](term:term-role-seiatsu) punisce subito una corsia rimasta
senza protezione. È una relazione minimale usata in fase di lettura rapida
dell'interfaccia.

Le risorse che scandiscono il ritmo sono [コスト](term:term-cost) e
[SPゲージ](term:term-sp-gauge). La prima cresce nel tempo e permette di far
uscire unità o usare abilità. La seconda cresce nel tempo e alimenta
[{{戦術技|せん.じゅつ.ぎ}}](term:term-special-attack). In base allo stato della
mappa, la spesa di risorse si orienta in base a una domanda operativa: cambia
l'orientamento della pressione immediata di un corridoio obiettivo?
In finale di partita, il
[クライマックスブースト](term:term-climax-boost) accelera il recupero del
[コスト](term:term-cost). Ufficialmente entra quando il match arriva davvero in
zona finale, per esempio con 60 secondi o meno, con una delle due
[{{戦艦|せんかん}}](term:term-warship) al 50% o meno, oppure quando le due
[{{拠点|きょてん}}](term:term-base) di un lato sono già state distrutte. Da quel
momento le finestre di decisione diventano più corte e gli errori si pagano più
in fretta.

## Esempi guidati

:::example_sentence
jp: >-
  {{自軍|じぐん}}{{戦力|せんりょく}}ゲージが{{残|のこ}}っていても、{{戦艦|せんかん}}が{{落|お}}ちると{{敗北|はいぼく}}です。
translation_it: >-
  Anche se una parte della tua gauge resta, se cade la nave perdi.
:::

:::example_sentence
jp: >-
  {{殲滅|せんめつ}}を{{先|さき}}に{{出|だ}}して{{防衛|ぼうえい}}をどかすと、{{制圧|せいあつ}}が{{拠点|きょてん}}を{{削|けず}}りやすくなります。
translation_it: >-
  Se fai uscire prima un ruolo di annientamento e togli la difesa, il ruolo di
  pressione riesce più facilmente a danneggiare la base.
:::

:::example_sentence
jp: >-
  SPゲージが{{溜|た}}まっても、{{守|まも}}られている{{拠点|きょてん}}に{{戦術技|せん.じゅつ.ぎ}}を{{切|き}}るより、{{開|あ}}いた{{場所|ばしょ}}に{{合|あ}}わせたほうが{{強|つよ}}いです。
translation_it: >-
  Anche con la barra SP piena, usare la tecnica speciale su una base protetta è
  spesso peggio che usarla nel punto davvero aperto.
:::

## Nota finale

Nell'analisi finale del turno, priorità di verifica:
[{{殲滅|せんめつ}}](term:term-role-shoumetsu),
[{{制圧|せいあつ}}](term:term-role-seiatsu) e
[{{防衛|ぼうえい}}](term:term-role-bouei), più l'obiettivo vicino al punto di
carenza più immediata.
