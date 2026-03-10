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
  Dalla singola parola alla logica della frase: trigger, sequenza, opzionalità,
  sostituzione, condizione e restrizione nei pattern del testo effetto Duel Masters.
---

# Obiettivo

In questa lesson passi dalla singola parola alla logica della frase. L'obiettivo
e riconoscere i pattern che fanno funzionare il testo effetto di Duel Masters:
trigger, sequenza, opzionalita, sostituzione, condizione e restrizione.

## Contesto

Il giapponese delle carte non suona come una conversazione normale. E un
linguaggio molto compresso, costruito con blocchi come
[～時 / ～た時](grammar:grammar-toki), [その後](grammar:grammar-sonoato),
[そうしたら](grammar:grammar-soushitara),
[～てもよい](grammar:grammar-temoyoi), [かわりに](grammar:grammar-kawarini) e
[ただし](grammar:grammar-tadashi). Saperli segmentare bene e piu utile che
tradurre tutto parola per parola.

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

### 1. Trigger: quando succede qualcosa

Il pattern piu importante in assoluto e [～時 / ～た時](grammar:grammar-toki).
Nelle carte lo trovi in forme come `出た時`, `攻撃する時`, `離れる時`,
`ブレイクされた時`. La prima cosa da fare e fermarti li e capire il timing:
non stai ancora leggendo l'effetto, stai leggendo il momento in cui l'effetto si
attiva.

Un secondo blocco di timing molto frequente e
[～のはじめに / ～の終わりに](grammar:grammar-turn-timing). Forme come
`自分のターンのはじめに` o `このクリーチャーの最初の攻撃の終わりに` ti dicono
quando la frase va risolta dentro il turno. Qui vale la pena memorizzare subito
{{最初|さいしょ}} e {{終わり|おわり}}.

### 2. Sequenza: その後 e そうしたら non sono uguali

[その後](grammar:grammar-sonoato) significa "poi, dopo questo". Nelle carte
segnala il passo successivo della risoluzione. Per esempio, una frase puo dire:

`自分の山札の上から4枚を墓地に置く。その後、コスト4以下のアビスを1枚、自分の墓地から出す。`

Qui il testo ti sta dicendo che c'e un secondo blocco da leggere come passo
successivo. E utile riconoscere subito [アビス](term:term-abyss) come oggetto del
secondo effetto.

[そうしたら](grammar:grammar-soushitara) e piu stretto. In pratica vuol dire
"se lo fai, allora...". Per esempio:

`自分の山札の上から3枚を墓地に置いてもよい。そうしたら、...`

Qui il secondo effetto dipende davvero dall'azione prima. Per la lettura pratica:
[その後](grammar:grammar-sonoato) = continua la sequenza;
[そうしたら](grammar:grammar-soushitara) = la sequenza condiziona il seguito.

### 3. Opzionalita: ～てもよい

Molti effetti non obbligano, ma permettono. Il marker piu chiaro e
[～てもよい](grammar:grammar-temoyoi). Se lo vedi, il giocatore puo scegliere.
Questo cambia parecchio la lettura, perche l'effetto non e "fisso", ma
decisionale.

Un buon riflesso e leggere subito quale parte e opzionale e quale no. In una
frase con [その後](grammar:grammar-sonoato), per esempio, l'azione opzionale puo
stare nella prima meta, mentre la seconda meta resta il seguito logico della
frase.

### 4. Sostituzione: かわりに

[かわりに](grammar:grammar-kawarini) segnala quasi sempre una sostituzione. Non
e semplicemente "e poi fai anche quest'altro": e "invece di quello, fai
quest'altro". Su carte dell'area [アビス](term:term-abyss) e frequentissimo insieme
a [離れる](term:term-hanareru).

Schema tipico:

`このクリーチャーが離れる時、かわりに自分の手札を2枚捨ててもよい。`

Qui il cuore della frase e capire che scartare sostituisce l'uscita della carta.

### 5. Condizioni: stato richiesto o eccezione negativa

Un pattern molto utile, ma piu avanzato, e
[～なければ ... ない](grammar:grammar-nakereba). Nelle carte Duel Masters appare
spesso in formule tecniche come:

`...なければ、クリーチャーとして扱わない。`

Se non riconosci [扱う](term:term-atsukau), la frase sembra opaca. Se invece la
spezzi bene, diventa leggibile: "se la condizione non e soddisfatta, non conta
come creatura".

Un altro pattern chiave e [～ていれば](grammar:grammar-teireba), che controlla uno
stato gia realizzato. Esempio tipico:

`タマシードから進化していれば、カードをもう1枚引く。`

Qui la carta prima verifica una condizione passata o gia presente, poi concede
un effetto extra.

### 6. Mezzo escluso e restrizioni

[～以外の方法で](grammar:grammar-igai-no-houhou-de) e un formalismo molto comune
del linguaggio carta. In frasi come
`召喚以外の方法でクリーチャーを出した時`, il punto non e il lessico raro, ma la
struttura: "con un metodo diverso dalla [召喚](term:term-summon)".

Infine c'e [ただし](grammar:grammar-tadashi). Questo blocco va letto come una
barra di sicurezza o una limitazione finale. Esempi tipici:

- `ただし、コストは0以下にはならない。`
- `ただし、その「S・トリガー」は使えない。`

In pratica: prima leggi l'effetto, poi leggi cosa non puoi estendere oltre quel
limite.

### 7. Numeri e filtri

[～以下 / ～以上](grammar:grammar-ika-ijou) compaiono ovunque: `コスト4以下`,
`パワー2000以下`, `合計4つ以上`. Non sono dettagli marginali; sono il filtro che
decide cosa puoi bersagliare, distruggere o far uscire.

Per questo conviene allenarsi a riconoscere subito:
[コスト](term:term-cost), [パワー](term:term-power), quantita, zona e bersaglio.
Vale la pena memorizzare anche {{合計|ごうけい}} quando compare in queste soglie.

### 8. Catene tecniche molto compatte

Le carte moderne comprimono spesso piu azioni in una frase sola. Una struttura
come:

`各ターン、このクリーチャーの最初の攻撃の終わりに、このクリーチャーをアンタップし、一番上のカードを破壊する。`

va letta in blocchi:

- [～のはじめに / ～の終わりに](grammar:grammar-turn-timing) = timing;
- [アンタップ](term:term-untap) = prima azione;
- [破壊](term:term-destroy) = seconda azione;
- `一番上` = bersaglio o porzione della pila di carte.

In altre parole: non tradurre tutto insieme. Segmenta la frase per ordine di
risoluzione.

## Esempi guidati

1. `このクリーチャーが出た時、自分の山札の上から1枚目を墓地に置く。`  
   - [出る](term:term-deru) + [～時 / ～た時](grammar:grammar-toki) = trigger.  
   - [山札](term:term-deck) + [墓地](term:term-graveyard) + [置く](term:term-oku)
     = movimento di zona.

2. `自分の山札の上から4枚を墓地に置く。その後、コスト4以下のアビスを1枚、自分の墓地から出す。`  
   - [その後](grammar:grammar-sonoato) = continua a leggere il blocco seguente.  
   - [アビス](term:term-abyss) + [墓地](term:term-graveyard) + [出す](term:term-dasu)
     = recupero in campo.

3. `自分の山札の上から3枚を墓地に置いてもよい。そうしたら、アビスを1枚、自分の墓地から手札に戻してもよい。`  
   - [～てもよい](grammar:grammar-temoyoi) = scelta.  
   - [そうしたら](grammar:grammar-soushitara) = il recupero dipende dal primo
     passo.  
   - [墓地](term:term-graveyard) + [手札](term:term-hand) +
     [戻す](term:term-modosu) = recupero in mano.

4. `相手が召喚以外の方法でクリーチャーを出した時、そのクリーチャーを破壊する。`  
   - [～以外の方法で](grammar:grammar-igai-no-houhou-de) = esclusione di mezzo.  
   - [出す](term:term-dasu) e [破壊](term:term-destroy) sono le due azioni chiave.

5. `自分の闇のクリーチャーまたは闇のタマシードが合計4つ以上なければ、バトルゾーンにあるこのタマシードはクリーチャーとして扱わない。`  
   - [～なければ ... ない](grammar:grammar-nakereba) = condizione negativa.  
   - [扱う](term:term-atsukau) qui significa "contare come / essere trattato
     come".

6. `各ターン、このクリーチャーの最初の攻撃の終わりに、このクリーチャーをアンタップし、一番上のカードを破壊する。`  
   - [～のはじめに / ～の終わりに](grammar:grammar-turn-timing) = timing.  
   - [アンタップ](term:term-untap) e [破壊](term:term-destroy) sono azioni in
     sequenza nello stesso blocco.

7. `侵略：火のコマンド（自分の火のコマンドが攻撃する時、自分の手札にあるこのクリーチャーをその上に重ねてもよい）`  
   - [侵略](term:term-invasion) = keyword.  
   - [コマンド](term:term-command) = condizione sul tipo di attaccante.  
   - [重ねる](term:term-kasaneru) + [～てもよい](grammar:grammar-temoyoi) =
     azione opzionale di sovrapposizione.

## Nota finale

La difficolta del testo effetto non sta solo nel vocabolario, ma nel montaggio
logico della frase. Se separi trigger, azione, sequenza, condizione e
restrizione, la carta smette di sembrare molto piu difficile di quanto sia.
