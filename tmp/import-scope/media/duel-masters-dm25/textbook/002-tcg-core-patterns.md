---
id: lesson-duel-masters-dm25-tcg-core-patterns
media_id: media-duel-masters-dm25
slug: tcg-core-patterns
title: TCG Core - Montare il testo effetto
order: 20
segment_ref: tcg-core
difficulty: n4
status: active
tags: [core, grammar, rules-text, effects]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-overview,
    lesson-duel-masters-dm25-tcg-card-types,
  ]
summary: >-
  Seconda lezione core più tecnica: trigger, sequenza, opzionalità,
  sostituzione, controllo di stato e restrizioni del rules text di Duel
  Masters.
---

# Obiettivo

In questa lesson passi dall'orientamento alla meccanica della frase. L'obiettivo
è capire come il testo effetto monta le informazioni: prima il momento in cui
succede qualcosa, poi l'azione, poi eventuali dipendenze, eccezioni o limiti.

## Contesto

Il giapponese delle carte non suona come una conversazione normale. È più
compatto, più tecnico e soprattutto più sequenziale. Le carte ti costringono a
leggere in ordine: trigger, azione, bersaglio, filtro, eccezione.

I pattern più utili da riconoscere sono
[～時 / ～た時](grammar:grammar-toki), [その後](grammar:grammar-sonoato),
[そうしたら](grammar:grammar-soushitara),
[～てもよい](grammar:grammar-temoyoi), [かわりに](grammar:grammar-kawarini),
[～なければ ... ない](grammar:grammar-nakereba),
[～ていれば](grammar:grammar-teireba),
[～以外の方法で](grammar:grammar-igai-no-houhou-de),
[または](grammar:grammar-matawa),
[～以下 / ～以上](grammar:grammar-ika-ijou),
[～のはじめに / ～の終わりに](grammar:grammar-turn-timing) e
[ただし](grammar:grammar-tadashi).

Qui conviene fissare anche [{{効果|こうか}}](term:term-effect): è la parola con cui il
rules text nomina il blocco che sta davvero producendo un risultato o una
restrizione. Se leggi `この{{効果|こうか}}`, la carta sta facendo riferimento a un effetto
preciso, non alla carta in generale.

## Termini chiave

- [出る](term:term-deru)
- [出す](term:term-dasu)
- [置く](term:term-oku)
- [選ぶ](term:term-erabu)
- [離れる](term:term-hanareru)
- [残る](term:term-nokoru)
- [扱う](term:term-atsukau)
- [攻撃](term:term-attack)
- [破壊](term:term-destroy)
- [タップ](term:term-tap)
- [アンタップ](term:term-untap)
- [重ねる](term:term-kasaneru)
- [コスト](term:term-cost)
- [パワー](term:term-power)
- [合計](term:term-goukei)
- [{{効果|こうか}}](term:term-effect)

## Pattern grammaticali chiave

- [～時 / ～た時](grammar:grammar-toki)
- [その後](grammar:grammar-sonoato)
- [そうしたら](grammar:grammar-soushitara)
- [～てもよい](grammar:grammar-temoyoi)
- [かわりに](grammar:grammar-kawarini)
- [～なければ ... ない](grammar:grammar-nakereba)
- [～ていれば](grammar:grammar-teireba)
- [～以外の方法で](grammar:grammar-igai-no-houhou-de)
- [または](grammar:grammar-matawa)
- [～以下 / ～以上](grammar:grammar-ika-ijou)
- [～のはじめに / ～の終わりに](grammar:grammar-turn-timing)
- [ただし](grammar:grammar-tadashi)

## Spiegazione

### 1. Trigger: prima il momento, poi l'effetto

Il pattern più importante è [～時 / ～た時](grammar:grammar-toki). Nelle carte lo
trovi in forme come `{{出|で}}た{{時|とき}}`, `{{攻撃|こうげき}}する{{時|とき}}`,
`{{離|はな}}れる{{時|とき}}`, `ブレイクされた{{時|とき}}`.

Quando lo vedi, fermati un attimo. Quella parte non ti sta ancora dicendo che
cosa fa la carta. Ti sta dicendo *quando* l'effetto si attiva.

Anche [～のはじめに / ～の終わりに](grammar:grammar-turn-timing) serve a questo:
fissa il momento preciso del turno. Forme come `{{自分|じぶん}}のターンのはじめに` o
`このクリーチャーの{{最初|さいしょ}}の{{攻撃|こうげき}}の{{終|お}}わりに` sono prima di tutto indicatori di
timing.

Regola pratica: finché non hai capito il trigger, non leggere il resto come se
fosse un'azione immediata.

### 2. Sequenza: {{その後|そのあと}} e そうしたら non dicono la stessa cosa

[その後](grammar:grammar-sonoato) significa "poi" o "dopo quello". Segnala che
la frase continua con un secondo blocco.

Esempio:

:::example_sentence
jp: >-
  {{自分|じぶん}}の{{山札|やまふだ}}の{{上|うえ}}から{{4枚|よんまい}}を{{墓地|ぼち}}に{{置|お}}く。{{その後|そのあと}}、コスト{{4以下|よんいか}}のアビスを{{1枚|いちまい}}、{{自分|じぶん}}の{{墓地|ぼち}}から{{出|だ}}す。
translation_it: >-
  Metti le prime 4 carte del tuo mazzo nel cimitero. Poi metti in gioco 1
  Abyss di costo 4 o inferiore dal tuo cimitero.
:::

Qui il testo dice: prima fai una cosa, poi ne fai un'altra.

[そうしたら](grammar:grammar-soushitara) è più stretto. Di solito vuol dire:
"se fai davvero il primo passo, allora succede il secondo".

Esempio:

:::example_sentence
jp: >-
  {{自分|じぶん}}の{{山札|やまふだ}}の{{上|うえ}}から{{3枚|さんまい}}を{{墓地|ぼち}}に{{置|お}}いてもよい。そうしたら、...
translation_it: >-
  Puoi mettere le prime 3 carte del tuo mazzo nel cimitero. Se lo fai, ...
:::

Per la lettura pratica:

- [その後](grammar:grammar-sonoato) = la frase continua;
- [そうしたら](grammar:grammar-soushitara) = il seguito dipende dal primo passo.

Il punto non è solo grammaticale. Cambia la risoluzione dell'effetto.

### 3. Opzionalità: ～てもよい e dipendenze locali

[～てもよい](grammar:grammar-temoyoi) indica un'azione opzionale. Quando lo
vedi, capisci subito che il giocatore può scegliere.

Questo cambia la lettura della frase. Non stai più leggendo un effetto
obbligatorio, ma una possibilità.

Il punto pratico è questo: individua bene quale parte è opzionale e quale parte
resta fissa. In Duel Masters capita spesso che la scelta sia locale, non
globale: puoi scegliere un passaggio, ma il resto della frase continua a
contare.

### 4. Sostituzione: かわりに non aggiunge, rimpiazza

[かわりに](grammar:grammar-kawarini) segnala spesso una sostituzione. In altre
parole, non vuol dire "e poi fai anche questo". Vuol dire "invece di quello,
fai quest'altro".

Schema tipico:

:::example_sentence
jp: >-
  このクリーチャーが{{離|はな}}れる{{時|とき}}、かわりに{{自分|じぶん}}の{{手札|てふだ}}を{{2枚|にまい}}{{捨|す}}ててもよい。
translation_it: >-
  Quando questa creatura lascia il campo, al suo posto puoi scartare 2 carte
  dalla tua mano.
:::

Qui il punto centrale è capire che scartare due carte prende il posto
dell'uscita della creatura.

Se leggi `かわりに` come semplice "poi", sbagli la logica dell'effetto.

### 5. Condizione negativa e controllo di stato

Un pattern centrale è [～なければ ... ない](grammar:grammar-nakereba). Nelle
carte compare spesso in formule tecniche come:

:::example_sentence
jp: >-
  ...なければ、クリーチャーとして{{扱|あつか}}わない。
translation_it: >-
  ...altrimenti non viene trattata come una creatura.
:::

Se non riconosci [扱う](term:term-atsukau), la frase può sembrare oscura. Se la
leggi a blocchi, invece, il senso è semplice: se la condizione non è soddisfatta,
la carta non conta come creatura.

Un altro pattern centrale è [～ていれば](grammar:grammar-teireba). Non introduce
un'azione nuova: controlla uno stato già presente e decide se l'effetto può
proseguire.

Esempio:

:::example_sentence
jp: >-
  タマシードから{{進化|しんか}}していれば、カードをもう{{1枚|いちまい}}{{引|ひ}}く。
translation_it: >-
  Se si è evoluta da un Tamashido, pesca 1 carta in più.
:::

Qui la carta controlla prima una condizione già vera e poi concede un bonus.

Qui conviene fissare anche [残る](term:term-nokoru), perché nel rules text di
Duel Masters segnala spesso che qualcosa resta ancora sul campo dopo che un
altro pezzo della situazione è cambiato.

:::example_sentence
jp: >-
  そのクリーチャーが{{離|はな}}れても、このカードは{{残|のこ}}る。
translation_it: >-
  Anche se quella creatura lascia il campo, questa carta resta.
:::

- [離れる](term:term-hanareru) = una carta esce dalla zona.
- [残る](term:term-nokoru) = un'altra carta continua a restare dov'è.

Questi due pattern sono centrali perché non descrivono un'azione nuova:
descrivono *quando un effetto conta davvero*.

### 6. Mezzo escluso, alternative, filtri e restrizioni

[～以外の方法で](grammar:grammar-igai-no-houhou-de) è una formula tecnica molto
comune. In frasi come
`{{召喚|しょうかん}}{{以外|いがい}}の{{方法|ほうほう}}でクリーチャーを{{出|だ}}した{{時|とき}}`, il punto non è il lessico difficile,
ma la struttura: "con un metodo diverso dalla [召喚](term:term-summon)".

[または](grammar:grammar-matawa) è il connettore di alternativa che conviene
fissare prima nel rules text. In pratica vuol dire "oppure / o", ma nelle carte
conviene leggerlo in modo più tecnico: collega due categorie o due bersagli che
valgono entrambi per lo stesso filtro.

Esempio tipico:

- `{{闇|やみ}}のクリーチャーまたは{{闇|やみ}}のタマシード`

Qui non stai leggendo due frasi. Stai leggendo un solo blocco di selezione con
due strade valide. Il punto pratico è capire subito:

- che cosa c'è a sinistra di [または](grammar:grammar-matawa);
- che cosa c'è a destra;
- quale numero, condizione o verbo si applica a entrambe le parti.

Quando [または](grammar:grammar-matawa) compare insieme a
[合計](term:term-goukei) o a un filtro numerico, le due categorie entrano nello
stesso conteggio. Non sono due controlli separati.

Poi c'è [ただし](grammar:grammar-tadashi). Questo blocco va letto come una
limitazione finale.

Esempi:

- `ただし、コストは{{0以下|ぜろいか}}にはならない。`
- `ただし、その「S・トリガー」は{{使|つか}}えない。`

Metodo pratico: prima leggi l'effetto principale, poi leggi la parte che lo
restringe.

### 7. Numeri e filtri non sono dettagli secondari

[～以下 / ～以上](grammar:grammar-ika-ijou) compare ovunque:
`コスト{{4以下|よんいか}}`, `パワー{{2000以下|にせんいか}}`,
`{{合計|ごうけい}}{{4つ以上|よっついじょう}}`.

Non è un dettaglio secondario. È il filtro che decide quali carte puoi
scegliere, distruggere o mettere in campo.

[合計](term:term-goukei) merita attenzione a parte perché cambia il modo in cui
conti. Non ti chiede di verificare ogni categoria da sola: ti chiede di sommare
gli elementi ammessi e guardare il totale finale.

Per questo conviene allenarsi a vedere subito:

- [コスト](term:term-cost)
- [パワー](term:term-power)
- quantità
- [合計](term:term-goukei), se presente
- zona
- bersaglio

Vale la pena fissare [合計](term:term-goukei) quando compare in questi filtri,
perché spesso è il punto che decide se il controllo è separato o aggregato.

### 8. Keyword, parentesi e frasi compatte

Le carte moderne mettono spesso più azioni nella stessa frase. Inoltre molte
keyword si aprono con una parentesi che spiega il funzionamento reale. Per
esempio:

:::example_sentence
jp: >-
  {{侵略|しんりゃく}}：{{火|ひ}}のコマンド（{{自分|じぶん}}の{{火|ひ}}のコマンドが{{攻撃|こうげき}}する{{時|とき}}、{{自分|じぶん}}の{{手札|てふだ}}にあるこのクリーチャーをその{{上|うえ}}に{{重|かさ}}ねてもよい）
translation_it: >-
  Invasione: comando di fuoco (quando un tuo comando di fuoco attacca, puoi
  sovrapporre su di esso questa creatura che hai in mano).
:::

Qui devi separare così:

- [侵略](term:term-invasion) = nome della keyword;
- `{{火|ひ}}のコマンド` = requisito;
- parentesi = istruzione concreta;
- [攻撃](term:term-attack) + [重ねる](term:term-kasaneru) =
  finestra pratica in cui succede tutto.

Poi ci sono frasi come questa:

:::example_sentence
jp: >-
  {{各|かく}}ターン、このクリーチャーの{{最初|さいしょ}}の{{攻撃|こうげき}}の{{終|お}}わりに、このクリーチャーをアンタップし、{{一番上|いちばんうえ}}のカードを{{破壊|はかい}}する。
translation_it: >-
  A ogni turno, alla fine del primo attacco di questa creatura, STAPpa questa
  creatura e distruggi la carta in cima.
:::

Se la traduci tutta in un colpo solo, rischi di perderti. Se la separi, diventa
molto più chiara:

- [～のはじめに / ～の終わりに](grammar:grammar-turn-timing) = quando succede;
- [アンタップ](term:term-untap) = prima azione;
- [破壊](term:term-destroy) = seconda azione;
- `{{一番上|いちばんうえ}}` = quale carta viene colpita.

Regola semplice: separa prima timing, poi azione, poi bersaglio.

### 9. Una ricetta di parsing che puoi riusare subito

Quando una frase ti sembra troppo densa, prova sempre questo ordine:

1. trova il trigger;
2. trova il verbo principale;
3. trova bersaglio e zona;
4. controlla se c'è un'alternativa (`または`);
5. controlla se c'è una sequenza (`その後`, `そうしたら`);
6. controlla se c'è una scelta (`～てもよい`);
7. leggi per ultime restrizioni e filtri (`ただし`, `～以下 / ～以上`).

È una procedura molto più affidabile della traduzione lineare.

## Esempi guidati

**Esempio 1**

:::example_sentence
jp: >-
  このクリーチャーが{{出|で}}た{{時|とき}}、{{自分|じぶん}}の{{山札|やまふだ}}の{{上|うえ}}から{{1枚目|いちまいめ}}を{{墓地|ぼち}}に{{置|お}}く。
translation_it: >-
  Quando questa creatura entra, metti la prima carta del tuo mazzo nel
  cimitero.
:::

- [出る](term:term-deru) + [～時 / ～た時](grammar:grammar-toki) = trigger.
- [山札](term:term-deck) + [墓地](term:term-graveyard) + [置く](term:term-oku)
  = movimento di zona.

**Esempio 2**

:::example_sentence
jp: >-
  {{自分|じぶん}}の{{山札|やまふだ}}の{{上|うえ}}から{{4枚|よんまい}}を{{墓地|ぼち}}に{{置|お}}く。{{その後|そのあと}}、コスト{{4以下|よんいか}}のアビスを{{1枚|いちまい}}、{{自分|じぶん}}の{{墓地|ぼち}}から{{出|だ}}す。
translation_it: >-
  Metti le prime 4 carte del tuo mazzo nel cimitero. Poi metti in gioco 1
  Abyss di costo 4 o inferiore dal tuo cimitero.
:::

- [その後](grammar:grammar-sonoato) = la frase continua.
- [アビス](term:term-abyss) + [墓地](term:term-graveyard) + [出す](term:term-dasu)
  = recupero in campo.

**Esempio 3**

:::example_sentence
jp: >-
  {{自分|じぶん}}の{{山札|やまふだ}}の{{上|うえ}}から{{3枚|さんまい}}を{{墓地|ぼち}}に{{置|お}}いてもよい。そうしたら、アビスを{{1枚|いちまい}}、{{自分|じぶん}}の{{墓地|ぼち}}から{{手札|てふだ}}に{{戻|もど}}してもよい。
translation_it: >-
  Puoi mettere le prime 3 carte del tuo mazzo nel cimitero. Se lo fai, puoi
  riprendere 1 Abyss dal tuo cimitero nella tua mano.
:::

- [～てもよい](grammar:grammar-temoyoi) = scelta.
- [そうしたら](grammar:grammar-soushitara) = il secondo effetto dipende dal primo.
- [墓地](term:term-graveyard) + [手札](term:term-hand) + [戻す](term:term-modosu)
  = recupero in mano.

**Esempio 4**

:::example_sentence
jp: >-
  {{相手|あいて}}が{{召喚|しょうかん}}{{以外|いがい}}の{{方法|ほうほう}}でクリーチャーを{{出|だ}}した{{時|とき}}、そのクリーチャーを{{破壊|はかい}}する。
translation_it: >-
  Quando il tuo avversario mette in gioco una creatura con un metodo diverso
  dall'evocazione, distruggi quella creatura.
:::

- [～以外の方法で](grammar:grammar-igai-no-houhou-de) = esclusione di mezzo.
- [出す](term:term-dasu) e [破壊](term:term-destroy) sono le due azioni chiave.

**Esempio 5**

:::example_sentence
jp: >-
  {{自分|じぶん}}の{{闇|やみ}}のクリーチャーまたは{{闇|やみ}}のタマシードが{{合計|ごうけい}}{{4つ以上|よっついじょう}}なければ、バトルゾーンにあるこのタマシードはクリーチャーとして{{扱|あつか}}わない。
translation_it: >-
  Se non hai in totale almeno 4 creature oscure o Tamashido oscuri, questo
  Tamashido nel battle zone non viene trattato come creatura.
:::

- [～なければ ... ない](grammar:grammar-nakereba) = condizione negativa.
- [または](grammar:grammar-matawa) = le due categorie entrano nello stesso
  filtro.
- [合計](term:term-goukei) = il conteggio richiesto è totale, non separato.
- [扱う](term:term-atsukau) qui significa "contare come".

**Esempio 6**

:::example_sentence
jp: >-
  {{各|かく}}ターン、このクリーチャーの{{最初|さいしょ}}の{{攻撃|こうげき}}の{{終|お}}わりに、このクリーチャーをアンタップし、{{一番上|いちばんうえ}}のカードを{{破壊|はかい}}する。
translation_it: >-
  A ogni turno, alla fine del primo attacco di questa creatura, STAPpa questa
  creatura e distruggi la carta in cima.
:::

- [～のはじめに / ～の終わりに](grammar:grammar-turn-timing) = timing.
- [アンタップ](term:term-untap) e [破壊](term:term-destroy) sono azioni in
  sequenza.

**Esempio 7**

:::example_sentence
jp: >-
  {{侵略|しんりゃく}}：{{火|ひ}}のコマンド（{{自分|じぶん}}の{{火|ひ}}のコマンドが{{攻撃|こうげき}}する{{時|とき}}、{{自分|じぶん}}の{{手札|てふだ}}にあるこのクリーチャーをその{{上|うえ}}に{{重|かさ}}ねてもよい）
translation_it: >-
  Invasione: comando di fuoco (quando un tuo comando di fuoco attacca, puoi
  sovrapporre su di esso questa creatura che hai in mano).
:::

- [侵略](term:term-invasion) = keyword.
- [コマンド](term:term-command) = requisito sul tipo di attaccante.
- [重ねる](term:term-kasaneru) + [～てもよい](grammar:grammar-temoyoi) =
  sovrapposizione opzionale.

**Esempio 8**

:::example_sentence
jp: >-
  この{{効果|こうか}}で{{相手|あいて}}のクリーチャーを{{1体|いったい}}{{破壊|はかい}}する。
translation_it: >-
  Con questo effetto distruggi 1 creatura del tuo avversario.
:::

- [{{効果|こうか}}](term:term-effect) = la carta punta al blocco di testo che risolve.
- [相手](term:term-opponent) + [破壊](term:term-destroy) = bersaglio e risultato
  concreto dell'effetto.

## Nota finale

La difficoltà del testo effetto non sta tanto nel singolo vocabolo. Sta nel
modo in cui la frase è montata. Se impari a separare trigger, sequenza,
condizione, azione e restrizione, anche un testo denso smette di sembrare
caotico.
