---
id: lesson-duel-masters-dm25-tcg-core-patterns
media_id: media-duel-masters-dm25
slug: tcg-core-patterns
title: TCG Core - Pattern del testo effetto
order: 20
segment_ref: tcg-core
difficulty: n4
status: active
tags: [core, grammar, rules-text, effects]
prerequisites: [lesson-duel-masters-dm25-tcg-core-overview]
summary: >-
  Dalla singola parola alla logica della frase: trigger, sequenza,
  opzionalità, sostituzione, condizione e restrizione nel testo effetto di
  Duel Masters.
---

# Obiettivo

In questa lesson passi dal lessico alla logica della frase. L'obiettivo è
capire come il testo effetto organizza le informazioni: prima il momento in cui
succede qualcosa, poi l'azione, poi eventuali condizioni, eccezioni o limiti.

## Contesto

Il giapponese delle carte non suona come una conversazione normale. È più
compatto, più tecnico e molto ripetitivo. Proprio per questo si può studiare
bene: certi blocchi tornano continuamente.

I pattern più utili da riconoscere sono
[～時 / ～た時](grammar:grammar-toki), [その後](grammar:grammar-sonoato),
[そうしたら](grammar:grammar-soushitara),
[～てもよい](grammar:grammar-temoyoi), [かわりに](grammar:grammar-kawarini),
[～なければ ... ない](grammar:grammar-nakereba),
[～ていれば](grammar:grammar-teireba),
[～以外の方法で](grammar:grammar-igai-no-houhou-de),
[～以下 / ～以上](grammar:grammar-ika-ijou),
[～のはじめに / ～の終わりに](grammar:grammar-turn-timing) e
[ただし](grammar:grammar-tadashi).

## Termini chiave

- [出る](term:term-deru)
- [出す](term:term-dasu)
- [置く](term:term-oku)
- [選ぶ](term:term-erabu)
- [離れる](term:term-hanareru)
- [扱う](term:term-atsukau)
- [攻撃](term:term-attack)
- [破壊](term:term-destroy)
- [タップ](term:term-tap)
- [アンタップ](term:term-untap)
- [重ねる](term:term-kasaneru)
- [コスト](term:term-cost)
- [パワー](term:term-power)

## Pattern grammaticali chiave

- [～時 / ～た時](grammar:grammar-toki)
- [その後](grammar:grammar-sonoato)
- [そうしたら](grammar:grammar-soushitara)
- [～てもよい](grammar:grammar-temoyoi)
- [かわりに](grammar:grammar-kawarini)
- [～なければ ... ない](grammar:grammar-nakereba)
- [～ていれば](grammar:grammar-teireba)
- [～以外の方法で](grammar:grammar-igai-no-houhou-de)
- [～以下 / ～以上](grammar:grammar-ika-ijou)
- [～のはじめに / ～の終わりに](grammar:grammar-turn-timing)
- [ただし](grammar:grammar-tadashi)

## Spiegazione

### 1. Trigger: prima il momento, poi l'effetto

Il pattern più importante è [～時 / ～た時](grammar:grammar-toki). Nelle carte lo
trovi in forme come `{{出|で}}た{{時|とき}}`, `{{攻撃|こうげき}}する{{時|とき}}`,
`{{離|はな}}れる{{時|とき}}`, `ブレイクされた{{時|とき}}`.

Quando lo vedi, fermati un attimo. Quella parte non ti sta ancora dicendo che
cosa fa la carta. Ti sta dicendo quando l'effetto si attiva.

Anche [～のはじめに / ～の終わりに](grammar:grammar-turn-timing) serve a questo:
fissa il momento preciso del turno. Forme come `{{自分|じぶん}}のターンのはじめに` o
`このクリーチャーの{{最初|さいしょ}}の{{攻撃|こうげき}}の{{終|お}}わりに` sono prima di tutto indicatori di
timing.

### 2. Sequenza: {{その後|そのあと}} e そうしたら non dicono la stessa cosa

[その後](grammar:grammar-sonoato) significa "poi" o "dopo quello". Segnala che
la frase continua con un secondo blocco.

Esempio:

`{{自分|じぶん}}の{{山札|やまふだ}}の{{上|うえ}}から4{{枚|まい}}を{{墓地|ぼち}}に{{置|お}}く。{{その後|そのあと}}、コスト4{{以下|いか}}のアビスを1{{枚|まい}}、{{自分|じぶん}}の{{墓地|ぼち}}から{{出|だ}}す。`

Qui il testo dice: prima fai una cosa, poi ne fai un'altra.

[そうしたら](grammar:grammar-soushitara) è più stretto. Di solito vuol dire:
"se fai davvero il primo passo, allora succede il secondo".

Esempio:

`{{自分|じぶん}}の{{山札|やまふだ}}の{{上|うえ}}から3{{枚|まい}}を{{墓地|ぼち}}に{{置|お}}いてもよい。そうしたら、...`

Per la lettura pratica:

- [その後](grammar:grammar-sonoato) = la frase continua;
- [そうしたら](grammar:grammar-soushitara) = il seguito dipende dal primo passo.

### 3. Opzionalità: ～てもよい

[～てもよい](grammar:grammar-temoyoi) indica un'azione opzionale. Quando lo
vedi, capisci subito che il giocatore può scegliere.

Questo cambia la lettura della frase. Non stai più leggendo un effetto
obbligatorio, ma una possibilità.

Il punto pratico è questo: individua bene quale parte è opzionale e quale parte
resta fissa.

### 4. Sostituzione: かわりに

[かわりに](grammar:grammar-kawarini) segnala spesso una sostituzione. In altre
parole, non vuol dire "e poi fai anche questo". Vuol dire "invece di quello,
fai quest'altro".

Schema tipico:

`このクリーチャーが{{離|はな}}れる{{時|とき}}、かわりに{{自分|じぶん}}の{{手札|てふだ}}を2{{枚|まい}}{{捨|す}}ててもよい。`

Qui il punto centrale è capire che scartare due carte prende il posto
dell'uscita della creatura.

### 5. Condizione negativa e controllo di stato

Un pattern molto utile è [～なければ ... ない](grammar:grammar-nakereba). Nelle
carte compare spesso in formule tecniche come:

`...なければ、クリーチャーとして{{扱|あつか}}わない。`

Se non riconosci [扱う](term:term-atsukau), la frase può sembrare oscura. Se la
leggi a blocchi, invece, il senso è semplice: se la condizione non è soddisfatta,
la carta non conta come creatura.

Un altro pattern utile è [～ていれば](grammar:grammar-teireba). Serve a controllare
uno stato già presente.

Esempio:

`タマシードから{{進化|しんか}}していれば、カードをもう1{{枚|まい}}{{引|ひ}}く。`

Qui la carta controlla prima una condizione già vera e poi concede un bonus.

### 6. Mezzo escluso e restrizioni

[～以外の方法で](grammar:grammar-igai-no-houhou-de) è una formula tecnica molto
comune. In frasi come
`{{召喚|しょうかん}}{{以外|いがい}}の{{方法|ほうほう}}でクリーチャーを{{出|だ}}した{{時|とき}}`, il punto non è il lessico difficile,
ma la struttura: "con un metodo diverso dalla [召喚](term:term-summon)".

Poi c'è [ただし](grammar:grammar-tadashi). Questo blocco va letto come una
limitazione finale.

Esempi:

- `ただし、コストは0{{以下|いか}}にはならない。`
- `ただし、その「S・トリガー」は{{使|つか}}えない。`

Metodo pratico: prima leggi l'effetto principale, poi leggi la parte che lo
restringe.

### 7. Numeri e filtri

[～以下 / ～以上](grammar:grammar-ika-ijou) compare ovunque:
`コスト4{{以下|いか}}`, `パワー2000{{以下|いか}}`,
`{{合計|ごうけい}}4つ{{以上|いじょう}}`.

Non è un dettaglio secondario. È il filtro che decide quali carte puoi
scegliere, distruggere o mettere in campo.

Per questo conviene allenarsi a vedere subito:

- [コスト](term:term-cost)
- [パワー](term:term-power)
- quantità
- zona
- bersaglio

Vale la pena fissare anche {{合計|ごうけい}} quando compare in questi filtri.

### 8. Frasi compatte: non tradurre tutto insieme

Le carte moderne mettono spesso più azioni nella stessa frase. Per esempio:

`{{各|かく}}ターン、このクリーチャーの{{最初|さいしょ}}の{{攻撃|こうげき}}の{{終|お}}わりに、このクリーチャーをアンタップし、{{一番上|いちばんうえ}}のカードを{{破壊|はかい}}する。`

Se la traduci tutta in un colpo solo, rischi di perderti. Se la separi, diventa
molto più chiara:

- [～のはじめに / ～の終わりに](grammar:grammar-turn-timing) = quando succede;
- [アンタップ](term:term-untap) = prima azione;
- [破壊](term:term-destroy) = seconda azione;
- `{{一番上|いちばんうえ}}` = quale carta viene colpita.

Regola semplice: separa prima timing, poi azione, poi bersaglio.

## Esempi guidati

1. `このクリーチャーが{{出|で}}た{{時|とき}}、{{自分|じぶん}}の{{山札|やまふだ}}の{{上|うえ}}から1{{枚目|まいめ}}を{{墓地|ぼち}}に{{置|お}}く。`  
   - [出る](term:term-deru) + [～時 / ～た時](grammar:grammar-toki) = trigger.  
   - [山札](term:term-deck) + [墓地](term:term-graveyard) + [置く](term:term-oku)
     = movimento di zona.

2. `{{自分|じぶん}}の{{山札|やまふだ}}の{{上|うえ}}から4{{枚|まい}}を{{墓地|ぼち}}に{{置|お}}く。{{その後|そのあと}}、コスト4{{以下|いか}}のアビスを1{{枚|まい}}、{{自分|じぶん}}の{{墓地|ぼち}}から{{出|だ}}す。`  
   - [その後](grammar:grammar-sonoato) = la frase continua.  
   - [アビス](term:term-abyss) + [墓地](term:term-graveyard) + [出す](term:term-dasu)
     = recupero in campo.

3. `{{自分|じぶん}}の{{山札|やまふだ}}の{{上|うえ}}から3{{枚|まい}}を{{墓地|ぼち}}に{{置|お}}いてもよい。そうしたら、アビスを1{{枚|まい}}、{{自分|じぶん}}の{{墓地|ぼち}}から{{手札|てふだ}}に{{戻|もど}}してもよい。`  
   - [～てもよい](grammar:grammar-temoyoi) = scelta.  
   - [そうしたら](grammar:grammar-soushitara) = il secondo effetto dipende dal primo.  
   - [墓地](term:term-graveyard) + [手札](term:term-hand) +
     [戻す](term:term-modosu) = recupero in mano.

4. `{{相手|あいて}}が{{召喚|しょうかん}}{{以外|いがい}}の{{方法|ほうほう}}でクリーチャーを{{出|だ}}した{{時|とき}}、そのクリーチャーを{{破壊|はかい}}する。`  
   - [～以外の方法で](grammar:grammar-igai-no-houhou-de) = esclusione di mezzo.  
   - [出す](term:term-dasu) e [破壊](term:term-destroy) sono le due azioni chiave.

5. `{{自分|じぶん}}の{{闇|やみ}}のクリーチャーまたは{{闇|やみ}}のタマシードが{{合計|ごうけい}}4つ{{以上|いじょう}}なければ、バトルゾーンにあるこのタマシードはクリーチャーとして{{扱|あつか}}わない。`  
   - [～なければ ... ない](grammar:grammar-nakereba) = condizione negativa.  
   - [扱う](term:term-atsukau) qui significa "contare come".

6. `{{各|かく}}ターン、このクリーチャーの{{最初|さいしょ}}の{{攻撃|こうげき}}の{{終|お}}わりに、このクリーチャーをアンタップし、{{一番上|いちばんうえ}}のカードを{{破壊|はかい}}する。`  
   - [～のはじめに / ～の終わりに](grammar:grammar-turn-timing) = timing.  
   - [アンタップ](term:term-untap) e [破壊](term:term-destroy) sono azioni in
     sequenza.

7. `{{侵略|しんりゃく}}：{{火|ひ}}のコマンド（{{自分|じぶん}}の{{火|ひ}}のコマンドが{{攻撃|こうげき}}する{{時|とき}}、{{自分|じぶん}}の{{手札|てふだ}}にあるこのクリーチャーをその{{上|うえ}}に{{重|かさ}}ねてもよい）`  
   - [侵略](term:term-invasion) = keyword.  
   - [コマンド](term:term-command) = requisito sul tipo di attaccante.  
   - [重ねる](term:term-kasaneru) + [～てもよい](grammar:grammar-temoyoi) =
     sovrapposizione opzionale.

## Nota finale

La difficoltà del testo effetto non sta solo nel vocabolario. Sta soprattutto
nel modo in cui la frase è montata.

Se impari a separare trigger, sequenza, condizione, azione e restrizione, anche
un testo che sembra pesante diventa molto più leggibile.
