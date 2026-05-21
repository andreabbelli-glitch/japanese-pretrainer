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

# Leggere la battaglia senza seguire solo le animazioni

Durante una partita di *Gundam Arsenal Base* lo schermo si riempie di unità,
effetti e tagli d'azione. Il giapponese utile, però, non sta solo nei nomi
spettacolari: sta nelle label che ti dicono chi sta vincendo la guerra di
risorse, quale obiettivo è sotto pressione e quale comando puoi usare adesso.

Il primo passo è leggere la schermata come una mappa di decisioni. Le gauge in
alto riassumono la tenuta dei due schieramenti, la minimappa comprime il caos
in posizioni leggibili, e i pannelli unità trasformano carte e risorse in azioni:
[{{出撃|しゅつげき}}](term:term-sortie), [アビリティ](term:term-ability) e
[{{戦術技|せんじゅつぎ}}](term:term-special-attack).

## Termini chiave

- [{{自軍|じぐん}}{{戦力|せんりょく}}ゲージ](term:term-friendly-strength-gauge) — barra della resistenza complessiva alleata
- [{{敵軍|てきぐん}}{{戦力|せんりょく}}ゲージ](term:term-enemy-strength-gauge) — barra della resistenza complessiva nemica
- [ユニット](term:term-unit) — unità composta da MS e PL
- [ミニマップ](term:term-minimap) — mappa ridotta della situazione generale
- [バトルフィールド](term:term-battlefield) — campo di battaglia mostrato in grande
- [{{作戦|さくせん}}カード](term:term-tactics-card) — carta tattica di supporto
- [コスト](term:term-cost) — risorsa che cresce e viene spesa per agire
- [SPゲージ](term:term-sp-gauge) — barra usata per le tecniche speciali

## Espressioni ricorrenti

- [{{出撃|しゅつげき}}](term:term-sortie) — far entrare una unità in campo
- [アビリティ](term:term-ability) — abilità speciale del MS
- [{{戦術技|せんじゅつぎ}}](term:term-special-attack) — tecnica speciale dell'unità
- [クライマックスブースト](term:term-climax-boost) — fase finale con recupero costo accelerato

## Etichette da riconoscere

- [{{殲滅|せんめつ}}](term:term-role-shoumetsu) — ruolo anti-unità
- [{{制圧|せいあつ}}](term:term-role-seiatsu) — ruolo che pressa basi e nave
- [{{防衛|ぼうえい}}](term:term-role-bouei) — ruolo che protegge un obiettivo
- [{{拠点|きょてん}}](term:term-base) — base intermedia della mappa
- [{{戦艦|せんかん}}](term:term-warship) — nave madre finale

## Pattern grammaticali chiave

- [～が{{表示|ひょうじ}}される](grammar:grammar-ga-hyouji-sareru) — X viene mostrato sullo schermo
- [～することで](grammar:grammar-suru-koto-de) — facendo X, si ottiene Y
- [～をタッチする](grammar:grammar-wo-tacchi-suru) — toccare l'elemento indicato

---

## 1. Gauge, mappa e primo ordine di lettura

La schermata sembra chiederti di guardare tutto insieme, ma il giapponese delle
label costruisce un ordine più stabile. Prima leggi
[{{自軍|じぐん}}{{戦力|せんりょく}}ゲージ](term:term-friendly-strength-gauge) e
[{{敵軍|てきぐん}}{{戦力|せんりょく}}ゲージ](term:term-enemy-strength-gauge):
`{{自軍|じぐん}}` dice "le proprie forze", `{{敵軍|てきぐん}}` dice "le forze
nemiche", e `{{戦力|せんりょく}}ゲージ` non misura la salute di una singola unità.
Riassume quanto reggono ancora [{{拠点|きょてん}}](term:term-base) e
[{{戦艦|せんかん}}](term:term-warship) nel loro insieme.

:::image
src: assets/ui/battle-screen-reference.webp
alt: "Schermata ufficiale di battaglia con gauge dei due lati, pannelli unità, costo, SP gauge e minimappa visibili nello stesso frame."
caption: >-
  Schermata ufficiale di battaglia: in alto leggi [{{自軍|じぐん}}{{戦力|せんりょく}}ゲージ](term:term-friendly-strength-gauge) e [{{敵軍|てきぐん}}{{戦力|せんりょく}}ゲージ](term:term-enemy-strength-gauge); in basso compaiono [コスト](term:term-cost), [SPゲージ](term:term-sp-gauge) e i pannelli [ユニット](term:term-unit); al centro resta la [ミニマップ](term:term-minimap).
:::

Il [バトルフィールド](term:term-battlefield) è la scena grande: ti mostra scontri,
movimenti e animazioni. La [ミニマップ](term:term-minimap), invece, è la frase
compressa della partita. Se vedi una corsia senza [{{防衛|ぼうえい}}](term:term-role-bouei),
un [{{制圧|せいあつ}}](term:term-role-seiatsu) vicino a un
[{{拠点|きょてん}}](term:term-base), o una pressione diretta sulla
[{{戦艦|せんかん}}](term:term-warship), la minimappa ti dice prima del campo
grande dove sta nascendo la decisione urgente.

:::example_sentence
jp: >-
  {{自軍|じぐん}}{{戦力|せんりょく}}ゲージが{{残|のこ}}っていても、{{戦艦|せんかん}}が{{落|お}}ちると{{敗北|はいぼく}}です。
translation_it: >-
  Anche se una parte della tua gauge resta, se cade la nave perdi.
:::

#### 🗺️ Anatomia della frase

- `{{自軍|じぐん}}{{戦力|せんりょく}}ゲージが{{残|のこ}}っていても` -> `～ても` crea concessione: "anche se la gauge alleata resta". La frase ti impedisce di leggere la barra come protezione assoluta.
- `{{戦艦|せんかん}}が{{落|お}}ちると` -> `～と` lega condizione e conseguenza automatica: se cade la nave, non importa cosa stava succedendo altrove.
- `{{敗北|はいぼく}}です` -> il risultato non è "svantaggio", ma sconfitta. La label tattica diventa una condizione di partita.

> [!NOTE]
> **⚖️ Contrasto operativo:** [{{自軍|じぐん}}{{戦力|せんりょく}}ゲージ](term:term-friendly-strength-gauge) e [{{敵軍|てきぐん}}{{戦力|せんりょく}}ゲージ](term:term-enemy-strength-gauge) non sono HP individuali. Leggile come stato complessivo degli obiettivi: una singola unità può vincere uno scontro locale mentre la tua [{{戦艦|せんかん}}](term:term-warship) sta già perdendo la partita.

## 2. Pannelli unità: quando una carta diventa azione

Sul lato dello schermo i pannelli [ユニット](term:term-unit) raccolgono ciò che
puoi fare davvero. Nel lessico di Arsenal Base un'unità non è una carta isolata:
nasce dalla coppia MS + PL e viene mandata sul campo quando scegli posizione,
timing e risorsa da spendere. Per questo [{{出撃|しゅつげき}}](term:term-sortie)
contiene `{{出|しゅつ}}`, "uscire", e `{{撃|げき}}`, "attacco": non è un generico
"seleziona", ma l'uscita armata di una unità nel match.

Le azioni base si distinguono dal gesto fisico che chiedono e dalla risorsa che
consumano. Con [{{出撃|しゅつげき}}](term:term-sortie) trascini il pannello nella
zona valida e paghi [コスト](term:term-cost). Con [アビリティ](term:term-ability)
attivi un effetto del MS, spesso ancora legato a costo, bersaglio o posizione.
Con [{{戦術技|せんじゅつぎ}}](term:term-special-attack) usi la tecnica speciale:
`{{戦術|せんじゅつ}}` è la tattica, `{{技|ぎ}}` è la tecnica, e la spesa non passa
dal costo normale ma dalla [SPゲージ](term:term-sp-gauge).

Nel manuale compare anche `{{敵|てき}}デッキ{{情報|じょうほう}}`, "informazioni sul
deck nemico". `{{情報|じょうほう}}` qui non è una notizia narrativa: è una zona
informativa che si riempie quando le unità avversarie entrano in campo. Serve a
riconoscere quali pezzi hai già visto, ma non sostituisce la lettura immediata
di minimappa, ruoli e gauge.

:::example_sentence
jp: >-
  ユニットを{{出撃|しゅつげき}}させることで、{{前線|ぜんせん}}の{{守|まも}}りを{{作|つく}}ります。
translation_it: >-
  Facendo uscire una unità, crei una difesa sulla prima linea.
:::

#### 🗺️ Anatomia della frase

- `ユニットを{{出撃|しゅつげき}}させる` -> `させる` rende l'unità ciò che fai uscire: non "l'unità parte da sola", ma il giocatore la manda in campo.
- `～することで` -> il pattern [～することで](grammar:grammar-suru-koto-de) collega azione e risultato: compiendo l'uscita, produci una conseguenza tattica.
- `{{前線|ぜんせん}}の{{守|まも}}り` -> la protezione è localizzata sulla frontline, non astratta. La frase chiede di leggere dove nasce la difesa.

> [!NOTE]
> **🧠 Gancio cognitivo:** pensa a [{{出撃|しゅつげき}}](term:term-sortie) come a "uscire per colpire". È un trucco mnemonico: non basta toccare una carta, devi immaginare quella unità che entra fisicamente nella corsia.

## 3. Ruoli: tre kanji per capire chi deve fare cosa

I ruoli non sono decorazioni da profilo. Sono etichette operative che cambiano
la frase mentale con cui leggi la corsia. [{{殲滅|せんめつ}}](term:term-role-shoumetsu)
indica eliminazione delle unità nemiche: se una difesa avversaria blocca il
percorso, questo ruolo serve a liberare la strada. [{{制圧|せいあつ}}](term:term-role-seiatsu)
indica pressione e controllo sugli obiettivi: quando la corsia è aperta, è il
ruolo che trasforma spazio libero in danno a [{{拠点|きょてん}}](term:term-base)
o [{{戦艦|せんかん}}](term:term-warship). [{{防衛|ぼうえい}}](term:term-role-bouei)
indica protezione: resta vicino all'obiettivo e rende più difficile convertirlo
in danno reale.

La relazione minima è stabile: [{{防衛|ぼうえい}}](term:term-role-bouei) rallenta
[{{制圧|せいあつ}}](term:term-role-seiatsu), [{{殲滅|せんめつ}}](term:term-role-shoumetsu)
rimuove [{{防衛|ぼうえい}}](term:term-role-bouei), e
[{{制圧|せいあつ}}](term:term-role-seiatsu) punisce una corsia lasciata senza
protezione. Quando questa triangolazione è chiara, il caos visivo diventa una
lettura di soggetti: chi sta bloccando, chi sta aprendo, chi sta convertendo.

:::example_sentence
jp: >-
  {{殲滅|せんめつ}}を{{先|さき}}に{{出|だ}}して{{防衛|ぼうえい}}をどかすと、{{制圧|せいあつ}}が{{拠点|きょてん}}を{{削|けず}}りやすくなります。
translation_it: >-
  Se fai uscire prima un ruolo di annientamento e togli la difesa, il ruolo di
  pressione riesce più facilmente a danneggiare la base.
:::

#### 🗺️ Anatomia della frase

- `{{殲滅|せんめつ}}を{{先|さき}}に{{出|だ}}して` -> `{{先|さき}}に` dà l'ordine tattico: prima esce il ruolo che pulisce la corsia.
- `{{防衛|ぼうえい}}をどかすと` -> `どかす` significa togliere di mezzo. Qui il bersaglio non è la base, ma il difensore che impedisce il danno.
- `{{制圧|せいあつ}}が{{拠点|きょてん}}を{{削|けず}}りやすくなります` -> `～やすくなる` indica che l'azione diventa più facile: il ruolo di pressione può erodere la base con meno ostacoli.

> [!WARNING]
> **⚖️ Contrasto operativo:** [{{制圧|せいあつ}}](term:term-role-seiatsu) non significa "vince ogni scontro". Se lo leggi come ruolo offensivo generico, rischi di mandarlo contro un blocco già protetto. Il suo valore nasce quando il percorso verso [{{拠点|きょてん}}](term:term-base) o [{{戦艦|せんかん}}](term:term-warship) è abbastanza aperto.

## 4. Risorse, tecnica speciale e finale accelerato

[コスト](term:term-cost) e [SPゲージ](term:term-sp-gauge) scandiscono due ritmi
diversi. Il costo cresce nel tempo e paga presenza sul campo: uscite, abilità,
alcuni cambi tattici. La SP gauge cresce per alimentare la
[{{戦術技|せんじゅつぎ}}](term:term-special-attack), cioè l'azione ad alto impatto
che conviene legare a un obiettivo davvero vulnerabile. Avere la barra pronta
non significa che la frase tattica sia pronta: devi ancora chiederti quale
bersaglio riceve valore da quella spesa.

Quando il match entra nel finale, [クライマックスブースト](term:term-climax-boost)
accelera il recupero del [コスト](term:term-cost). La parola
`クライマックス` segnala il culmine della partita, mentre `ブースト` dice che il
ritmo viene spinto in avanti. Le finestre di scelta diventano più strette:
un [{{出撃|しゅつげき}}](term:term-sortie) in ritardo, una
[{{戦術技|せんじゅつぎ}}](term:term-special-attack) su un bersaglio protetto o un
[{{防衛|ぼうえい}}](term:term-role-bouei) dimenticato pesano più di quanto
pesassero a inizio match.

:::example_sentence
jp: >-
  SPゲージが{{溜|た}}まっても、{{守|まも}}られている{{拠点|きょてん}}に{{戦術技|せんじゅつぎ}}を{{切|き}}るより、{{開|あ}}いた{{場所|ばしょ}}に{{合|あ}}わせたほうが{{強|つよ}}いです。
translation_it: >-
  Anche con la barra SP piena, usare la tecnica speciale su una base protetta è
  spesso peggio che usarla nel punto davvero aperto.
:::

#### 🗺️ Anatomia della frase

- `SPゲージが{{溜|た}}まっても` -> ancora un `～ても`: anche se la risorsa è pronta, la frase non autorizza automaticamente l'uso.
- `{{守|まも}}られている{{拠点|きょてん}}に` -> `～られている` descrive uno stato passivo: la base è protetta in quel momento.
- `{{戦術技|せんじゅつぎ}}を{{切|き}}るより` -> `{{切|き}}る` in questo contesto è "spendere / usare una risorsa forte". Il confronto con `より` prepara l'alternativa migliore.
- `{{開|あ}}いた{{場所|ばしょ}}に{{合|あ}}わせたほうが{{強|つよ}}い` -> `～たほうが` consiglia la scelta più forte: allineare la tecnica al punto aperto.

> [!NOTE]
> **⚖️ Contrasto operativo:** [SPゲージ](term:term-sp-gauge) pronta e [{{戦術技|せんじゅつぎ}}](term:term-special-attack) utile non sono la stessa cosa. La prima è una condizione di risorsa; la seconda richiede bersaglio, timing e stato della corsia.

## Esempi guidati di riepilogo

Quando la schermata si muove velocemente, ricombina le label in piccole frasi
operative: chi è sotto pressione, quale ruolo apre la corsia, quale risorsa
trasforma la lettura in comando.

:::example_sentence
jp: >-
  {{敵軍|てきぐん}}{{戦力|せんりょく}}ゲージが{{少|すく}}ないときは、{{戦艦|せんかん}}への{{道|みち}}を{{見|み}}ます。
translation_it: >-
  Quando la gauge nemica è bassa, guardi la strada verso la nave.
:::

:::example_sentence
jp: >-
  ミニマップに{{制圧|せいあつ}}が{{表示|ひょうじ}}されると、{{拠点|きょてん}}への{{圧力|あつりょく}}が{{見|み}}えます。
translation_it: >-
  Quando sulla minimappa compare un ruolo di pressione, vedi la pressione sulla base.
:::

:::example_sentence
jp: >-
  コストを{{使|つか}}うことで、{{必要|ひつよう}}な{{場所|ばしょ}}にユニットを{{出撃|しゅつげき}}させます。
translation_it: >-
  Spendendo costo, fai uscire una unità nel punto necessario.
:::

:::example_sentence
jp: >-
  クライマックスブースト{{中|ちゅう}}は、{{防衛|ぼうえい}}の{{遅|おく}}れが{{戦艦|せんかん}}の{{危険|きけん}}につながります。
translation_it: >-
  Durante il Climax Boost, un ritardo in difesa si collega al pericolo per la nave.
:::

## Nota finale

La lettura della battaglia parte da poche relazioni: gauge per lo stato
complessivo, minimappa per la pressione, ruoli per capire chi deve agire e
risorse per decidere quando farlo. Se riconosci
[{{殲滅|せんめつ}}](term:term-role-shoumetsu),
[{{制圧|せいあつ}}](term:term-role-seiatsu),
[{{防衛|ぼうえい}}](term:term-role-bouei), [コスト](term:term-cost) e
[SPゲージ](term:term-sp-gauge) come parti della stessa frase, la schermata non è
più solo animazione: diventa una serie di istruzioni leggibili.
