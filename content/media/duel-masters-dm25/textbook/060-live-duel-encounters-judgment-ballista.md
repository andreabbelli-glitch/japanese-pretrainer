---
id: lesson-duel-masters-dm25-live-duel-encounters-judgment-ballista
media_id: media-duel-masters-dm25
slug: live-duel-encounters-judgment-ballista
title: "Judgment Ballista: da fuori mano a nuovo scudo"
order: 88
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags:
  [live-duel, card-encounter, blocker, shield-addition, metallica, duel-masters]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-live-duel-encounters-savark-dg
  ]
summary: >-
  Leggere vincoli di attacco, protezione durante il battle e trigger che
  trasformano la cima del mazzo in uno scudo coperto.
---

# Judgment Ballista: da fuori mano a nuovo scudo

「{{戒律|かいりつ}}の{{大弓|だいきゅう}}」 è una creatura difensiva che concentra tre letture diverse in poche righe: limita chi può essere attaccato, protegge se stessa durante un battle preciso e poi reagisce quando una creatura avversaria entra da una provenienza diversa dalla mano.

La carta diventa leggibile quando separi i quattro assi del rules text: bersaglio, finestra, origine e stato finale. できない non spegne ogni attacco, バトル{{中|ちゅう}} non dura tutto il turno, [どこからでも](grammar:grammar-dokokarademo) allarga la provenienza dopo un'esclusione e [{{裏向|うらむ}}きのまま](grammar:grammar-uramuki-no-mama) conserva lo stato coperto della carta che diventa scudo.


## Termini chiave

- [ブロッカー](term:term-blocker) — keyword difensiva: la creatura può intercettare un attacco quando le regole lo permettono.
- [{{攻撃|こうげき}}](term:term-attack) — attacco; qui è il verbo che riceve il divieto con できない.
- [{{破壊|はかい}}](term:term-destroy) — distruzione; nella frase appare come passivo negativo, quindi il risultato "essere distrutta" non avviene.
- [コスト](term:term-cost) — costo; nell'ultimo effetto diventa un filtro sui candidati avversari.
- [{{手札|てふだ}}](term:term-hand) — mano; è la provenienza esclusa prima che どこからでも allarghi tutte le altre.
- [{{山札|やまふだ}}](term:term-deck) — mazzo; fornisce la carta precisa che verrà messa nello shield zone.
- [{{置|お}}く](term:term-oku) — mettere o collocare una carta nella zona indicata.

## Espressioni ricorrenti

- {{相手|あいて}}プレイヤーを[{{攻撃|こうげき}}](term:term-attack)できない — non può attaccare il giocatore avversario; il divieto riguarda quel bersaglio.
- {{火|ひ}}の[クリーチャー](term:term-creature)とバトル{{中|ちゅう}} — mentre è in battle con una creatura Fire; il timing è interno a quel battle.
- [{{手札|てふだ}}](term:term-hand){{以外|いがい}}の[どこからでも](grammar:grammar-dokokarademo) — da qualunque posto diverso dalla mano; prima esclude, poi riallarga.
- [{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から{{1枚目|いちまいめ}} — la prima carta dalla cima del mazzo, non una carta scelta.
- [{{裏向|うらむ}}きのまま](grammar:grammar-uramuki-no-mama)、{{新|あたら}}しいシールドとして — lasciandola coperta, con il nuovo ruolo di scudo.
- [シールドゾーン](term:term-shield-zone)に[{{置|お}}いて](term:term-oku)もよい — puoi metterla nello shield zone; l'azione è permessa, non obbligatoria.

## Pattern grammaticali chiave

- [{{時|とき}}](grammar:grammar-toki) — trasforma l'evento precedente nella finestra che fa partire il trigger.
- [どこからでも](grammar:grammar-dokokarademo) — allarga la provenienza a qualunque zona valida.
- [{{裏向|うらむ}}きのまま](grammar:grammar-uramuki-no-mama) — mantiene invariato lo stato face-down durante il movimento.
- [～てもよい](grammar:grammar-temoyoi) — concede una possibilità: puoi fare l'azione, ma il testo non la impone.

## Etichette da riconoscere

- [クリーチャー](term:term-creature) — oggetto controllato dai filtri di costo, civiltà e ingresso.
- [バトルゾーン](term:term-battle-zone) — zona di arrivo della creatura avversaria che apre il trigger.
- [シールドゾーン](term:term-shield-zone) — zona finale della carta presa dalla cima del mazzo.
- `{{火|ひ}}` — civiltà Fire; qui `火` qui filtra le creature di civilta' Fire.
- [{{出|で}}る](term:term-deru) — uscire / entrare in gioco

---

:::image
src: assets/cards/live-duel/judgment-ballista.jpg
alt: "Judgment Ballista card."
caption: >-
  「{{戒律|かいりつ}}の{{大弓|だいきゅう}}」。 La carta usa [ブロッカー](term:term-blocker)
  come base difensiva, poi restringe bersagli e timing prima di arrivare al
  trigger sugli ingressi da fuori [{{手札|てふだ}}](term:term-hand).
:::

## 1. Bersaglio e ruolo difensivo: cosa non può attaccare

La prima riga sembra un divieto molto ampio, ma il giapponese lo restringe con precisione. このクリーチャーは mette Judgment Ballista come tema, {{相手|あいて}}プレイヤーを marca il bersaglio vietato e [{{攻撃|こうげき}}](term:term-attack)できない chiude con la forma potenziale negativa: "non può attaccare".

`を` mostra che il divieto punta al giocatore avversario come bersaglio d'attacco. Per questo [ブロッカー](term:term-blocker) resta coerente con la carta. Il testo non sta dicendo che Judgment Ballista non partecipa al combattimento; sta bloccando una direzione offensiva precisa.

:::example_sentence
jp: >-
  このクリーチャーは、{{相手|あいて}}プレイヤーを
  [{{攻撃|こうげき}}](term:term-attack)できない。
translation_it: >-
  Questa creatura non può attaccare il giocatore avversario.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `このクリーチャーは`: tema della frase. Tutto il divieto riguarda questa creatura, non una regola globale.
*   `{{相手|あいて}}プレイヤーを`: oggetto dell'azione vietata. `を` ti dice chi sarebbe il bersaglio dell'attacco.
*   [{{攻撃|こうげき}}](term:term-attack)できない: potenziale negativo. `攻撃できない` indica impossibilita' di attaccare quel bersaglio.

#### ⚖️ Contrasto operativo: divieto di bersaglio, non silenzio totale

{{相手|あいて}}プレイヤーを[{{攻撃|こうげき}}](term:term-attack)できない non equivale a {{攻撃|こうげき}}できない senza oggetto. La versione della carta lascia visibile il bersaglio vietato; una frase senza oggetto avrebbe un sapore molto più generale, come se la creatura non potesse attaccare affatto.

## 2. バトル中 e されない: protezione nel battle giusto

La seconda riga cambia asse: La seconda riga passa dal bersaglio d'attacco al risultato del battle. {{火|ひ}}の[クリーチャー](term:term-creature)と crea la coppia di combattimento, バトル{{中|ちゅう}} limita la protezione alla finestra in cui quel battle è in corso e [{{破壊|はかい}}](term:term-destroy)されない nega il risultato passivo "essere distrutta".

Qui `{{火|ひ}}の` funziona come filtro di civiltà. Non descrive una creatura "infuocata" in senso narrativo: dice che la protezione vale quando l'altro lato del battle è una creatura Fire. Se il battle non è contro quel tipo di creatura, questa riga non si accende.

:::example_sentence
jp: >-
  このクリーチャーは、{{火|ひ}}の[クリーチャー](term:term-creature)と
  バトル{{中|ちゅう}}、
  [{{破壊|はかい}}](term:term-destroy)されない。
translation_it: >-
  Questa creatura non viene distrutta mentre è in battle con una creatura Fire.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   {{火|ひ}}の[クリーチャー](term:term-creature)と: partner del battle. と mette Judgment Ballista in relazione con la creatura Fire che sta combattendo.
*   `バトル{{中|ちゅう}}`: finestra interna al battle. `{{中|ちゅう}}` significa "durante", quindi non copre automaticamente il resto del turno.
*   [{{破壊|はかい}}](term:term-destroy)されない: passivo negativo. La creatura può essere coinvolta nel battle, ma il risultato "essere distrutta" viene impedito in quella finestra.

#### 🧠 Gancio cognitivo

Pensa a `{{中|ちゅう}}` come a "dentro" un contenitore temporale: sei dentro il battle, non dentro tutto il turno. È un trucco di riconoscimento, non un'etimologia speciale, ma aiuta a non estendere la protezione oltre la frase.

#### ⚖️ Contrasto operativo: battle permesso, distruzione negata

[{{破壊|はかい}}](term:term-destroy)されない non cancella il battle. Cancella solo il risultato passivo di distruzione per Judgment Ballista mentre il filtro {{火|ひ}}の[クリーチャー](term:term-creature)とバトル{{中|ちゅう}} resta vero.

## 3. Provenienza del trigger: fuori dalla mano, ma da ovunque

L'ultimo effetto si apre con una catena di filtri prima di dire che cosa puoi fare. {{相手|あいて}}の[コスト](term:term-cost){{4以下|よんいか}}の[クリーチャー](term:term-creature)が identifica il soggetto: una creatura avversaria di costo 4 o meno. Poi arriva il blocco decisivo sulla provenienza: [{{手札|てふだ}}](term:term-hand){{以外|いがい}}の[どこからでも](grammar:grammar-dokokarademo).

La sequenza non dice "da una zona speciale chiamata fuori mano". Dice prima "esclusa la mano" con {{以外|いがい}}, poi "da qualunque posto" con [どこからでも](grammar:grammar-dokokarademo). In lettura pratica, la mano è l'unica origine tagliata fuori; le altre provenienze valide restano tutte nel controllo.

:::example_sentence
jp: >-
  {{相手|あいて}}の[コスト](term:term-cost){{4以下|よんいか}}の
  [クリーチャー](term:term-creature)が、
  [{{手札|てふだ}}](term:term-hand){{以外|いがい}}の
  [どこからでも](grammar:grammar-dokokarademo)
  [バトルゾーン](term:term-battle-zone)に
  [{{出|で}}た](term:term-deru)[{{時|とき}}](grammar:grammar-toki)、
  {{自分|じぶん}}の[{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から
  {{1枚目|いちまいめ}}を
  [{{裏向|うらむ}}きのまま](grammar:grammar-uramuki-no-mama)、
  {{新|あたら}}しいシールドとして
  [シールドゾーン](term:term-shield-zone)に[{{置|お}}いて](term:term-oku)もよい。
translation_it: >-
  Quando una creatura avversaria di costo 4 o meno entra nel battle zone da
  qualunque posto diverso dalla mano, puoi prendere la prima carta del tuo
  mazzo e metterla nello shield zone come nuovo scudo, lasciandola face-down.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   {{相手|あいて}}の[コスト](term:term-cost){{4以下|よんいか}}の[クリーチャー](term:term-creature)が: soggetto filtrato. が marca la creatura che entra; {{4以下|よんいか}} include costo 4 e tutti i costi inferiori.
*   [{{手札|てふだ}}](term:term-hand){{以外|いがい}}の[どこからでも](grammar:grammar-dokokarademo): origine del movimento. {{以外|いがい}} esclude la mano, どこからでも riapre tutte le altre origini valide.
*   [バトルゾーン](term:term-battle-zone)に[{{出|で}}た](term:term-deru)[{{時|とき}}](grammar:grammar-toki): finestra del trigger. に indica la zona di arrivo, {{出|で}}た descrive l'ingresso riuscito e [{{時|とき}}](grammar:grammar-toki) trasforma quell'evento nel momento di controllo.
*   [{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から{{1枚目|いちまいめ}}を: oggetto scelto dal testo, non dal giocatore. La frase prende proprio la prima carta dalla cima del mazzo.
*   [{{裏向|うらむ}}きのまま](grammar:grammar-uramuki-no-mama)、{{新|あたら}}しいシールドとして: stato e ruolo finale. La carta resta coperta e viene trattata come nuovo scudo.
*   [シールドゾーン](term:term-shield-zone)に[{{置|お}}いて](term:term-oku)もよい: destinazione più permesso. に marca lo shield zone, [{{置|お}}く](term:term-oku) è il verbo di collocazione e [～てもよい](grammar:grammar-temoyoi) rende l'azione facoltativa.

#### ⚖️ Contrasto operativo: esclusione stretta, scope largo

[{{手札|てふだ}}](term:term-hand){{以外|いがい}} e [どこからでも](grammar:grammar-dokokarademo) lavorano in due direzioni opposte ma complementari. Il primo pezzo taglia fuori una zona precisa; il secondo impedisce di restringere il trigger a una sola origine alternativa. Se leggi solo {{以外|いがい}}, rischi di cercare una zona specifica. Se leggi anche どこからでも, capisci che il testo controlla ogni altra provenienza valida.

## 4. 裏向きのまま e シールドとして: stato conservato, ruolo nuovo

Dopo il trigger, la frase non ti fa scegliere una carta qualunque. {{自分|じぶん}}の[{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から{{1枚目|いちまいめ}} identifica la prima carta del tuo mazzo. Il giapponese usa {{1枚目|いちまいめ}}, non solo {{1枚|いちまい}}: il suffisso 目 ordina la carta nella sequenza e punta alla prima posizione dall'alto.

Il blocco [{{裏向|うらむ}}きのまま](grammar:grammar-uramuki-no-mama) è quello che governa lo stato. {{裏向|うらむ}}き dice che la carta è face-down; のまま dice che resta così mentre viene spostata. Subito dopo, {{新|あたら}}しいシールドとして assegna un ruolo: `裏向きのまま` mantiene la carta coperta mentre viene collocata come nuovo scudo.

### A. 目 in `{{1枚目|いちまいめ}}`: posizione, non quantità generica

{{1枚|いちまい}} conterebbe una carta. {{1枚目|いちまいめ}} indica "la prima carta" in una sequenza. Qui la sequenza è の{{上|うえ}}から, cioè dalla cima del [{{山札|やまふだ}}](term:term-deck). La frase non ti apre una scelta tra più carte del mazzo: prende il topdeck preciso.

### B. のまま: lo stato attraversa il movimento

[{{裏向|うらむ}}きのまま](grammar:grammar-uramuki-no-mama) lega stato e trasferimento. La carta non viene prima rivelata e poi messa come scudo; il sintagma dice che il movimento verso lo [シールドゾーン](term:term-shield-zone) avviene mentre lo stato {{裏向|うらむ}}き rimane intatto.

#### 🧠 Gancio cognitivo

Immagina `のまま` come un'etichetta "così com'è" appesa alla carta durante lo spostamento. Non è un'origine etimologica: è solo un modo per ricordare che lo stato scritto prima di `のまま` non viene modificato dalla procedura.

#### ⚖️ Contrasto operativo: `として` cambia ruolo, non visibilità

{{新|あたら}}しいシールドとして dice "come nuovo scudo": assegna alla carta un ruolo nel gioco. La visibilità invece è già decisa da [{{裏向|うらむ}}きのまま](grammar:grammar-uramuki-no-mama). Tenere separati questi due pezzi evita la lettura sbagliata "diventa scudo, quindi forse viene mostrata": il ruolo cambia, lo stato coperto resta.

## Esempi guidati di riepilogo

Le tre righe della carta si leggono bene quando il primo controllo non invade il secondo e il secondo non invade il trigger finale:

:::example_sentence
jp: >-
  このクリーチャーは、{{相手|あいて}}プレイヤーを
  [{{攻撃|こうげき}}](term:term-attack)できないが、
  [ブロッカー](term:term-blocker)として{{守|まも}}れる。
translation_it: >-
  Questa creatura non può attaccare il giocatore avversario, ma può difendere
  come Blocker.
:::

:::example_sentence
jp: >-
  {{火|ひ}}の[クリーチャー](term:term-creature)とバトル{{中|ちゅう}}なら、
  [{{破壊|はかい}}](term:term-destroy)されない。
translation_it: >-
  Se è durante un battle con una creatura Fire, non viene distrutta.
:::

:::example_sentence
jp: >-
  [{{手札|てふだ}}](term:term-hand){{以外|いがい}}の
  [どこからでも](grammar:grammar-dokokarademo)
  [バトルゾーン](term:term-battle-zone)に[{{出|で}}た](term:term-deru)
  [{{時|とき}}](grammar:grammar-toki)、
  [{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から{{1枚目|いちまいめ}}を
  [{{裏向|うらむ}}きのまま](grammar:grammar-uramuki-no-mama)
  [シールドゾーン](term:term-shield-zone)に[{{置|お}}いて](term:term-oku)もよい。
translation_it: >-
  Quando entra nel battle zone da qualunque posto diverso dalla mano, puoi
  mettere la prima carta del mazzo nello shield zone lasciandola face-down.
:::

---

## Nota finale

Judgment Ballista non è difficile perché usa molte parole rare: è densa perché ogni particella restringe un asse diverso. を fissa il bersaglio che non può essere attaccato, バトル{{中|ちゅう}} limita la protezione al battle giusto, [どこからでも](grammar:grammar-dokokarademo) riapre tutte le origini diverse dalla [{{手札|てふだ}}](term:term-hand) e [{{裏向|うらむ}}きのまま](grammar:grammar-uramuki-no-mama) conserva lo stato coperto mentre la carta diventa un nuovo scudo.
