---
id: lesson-duel-masters-dm25-live-duel-encounters-felix-misery
media_id: media-duel-masters-dm25
slug: live-duel-encounters-felix-misery
title: "Felix Misery: soglia Darkness e rianimazione su attacco"
order: 68
segment_ref: live-duel-encounters
difficulty: n3
status: active
tags: [live-duel, card-encounter, mafi-gang, neo-evolution, duel-masters]
prerequisites:
  [
    lesson-duel-masters-dm25-tcg-core-patterns,
    lesson-duel-masters-dm25-tcg-card-types,
    lesson-duel-masters-dm25-dm25-sd1-overview
  ]
summary: >-
  Leggere Felix Misery come sequenza di ruolo NEO, soglia Darkness, evocazione
  dal cimitero e rianimazione opzionale dopo l'attacco.
---

# フェリックス・ミザリィ: soglia Darkness e rianimazione su attacco

[フェリックス・ミザリィ](term:term-felix-misery) concentra in poche righe una
grammatica molto tipica del rules text: prima delimita il modo in cui viene
evocata, poi controlla quante creature Darkness hai già, infine trasforma
l'attacco in due movimenti ordinati tra [{{山札|やまふだ}}](term:term-deck),
[{{墓地|ぼち}}](term:term-graveyard) e
[バトルゾーン](term:term-battle-zone).

La carta non va letta come una lista piatta di abilità. Ogni frase costruisce
un cancello: `として` dice in quale ruolo avviene l'evocazione,
[{{場合|ばあい}}](term:term-baai) limita il caso dello sconto,
[あれば](grammar:grammar-areba) controlla la soglia sul tuo campo e
[{{出|だ}}してもよい](grammar:grammar-temoyoi) lascia opzionale la rianimazione
finale.

:::image
src: assets/cards/live-duel/felix-misery.webp
alt: "Felix Misery card."
caption: >-
  [フェリックス・ミザリィ](term:term-felix-misery)。 Razza:
  [マフィ・ギャング](term:term-mafi-gang). Tipo:
  [NEOクリーチャー](term:term-neo-creature). La riga centrale collega
  `NEO{{進化|しんか}}`, sconto in
  [{{召喚|しょうかん}}](term:term-summon), soglia
  `{{2体以上|にたいいじょう}}` di creature
  [{{闇|やみ}}](term:term-darkness) e attacco che manda
  `{{2枚|にまい}}` al cimitero prima di rimettere in campo una creatura
  Darkness non evolution di costo `{{6以下|ろくいか}}`.
:::

## Termini chiave

- [フェリックス・ミザリィ](term:term-felix-misery) — nome proprio della creatura e
  centro dei tre effetti
- [{{闇|やみ}}](term:term-darkness) — oscurità / civiltà Darkness
- [{{召喚|しょうかん}}](term:term-summon) — evocazione, anche da una zona non
  usuale come il cimitero
- [{{墓地|ぼち}}](term:term-graveyard) — zona di partenza per evocare e per
  scegliere il bersaglio rianimato
- [{{山札|やまふだ}}](term:term-deck) — deck come pila ordinata da cui si prende
  la cima
- [コスト](term:term-cost) — valore numerico che può essere ridotto o filtrato
- [{{少|すく}}なくする](term:term-sukunaku-suru) — ridurre / rendere minore
- [{{置|お}}く](term:term-oku) — mettere una carta in una zona
- [{{出|だ}}す](term:term-dasu) — mettere in campo tramite effetto

## Espressioni ricorrenti

- `NEO{{進化|しんか}}クリーチャーとして` — come creatura NEO evolution, cioè in quel
  ruolo preciso
- [{{召喚|しょうかん}}する{{場合|ばあい}}](term:term-baai) — nel caso in cui venga
  evocata
- `{{2体以上|にたいいじょう}}`[あれば](grammar:grammar-areba) — se ci sono
  due o più unità valide
- [その{{後|あと}}](grammar:grammar-sonoato) — dopo quel primo passaggio, si
  apre il passaggio successivo
- [{{進化|しんか}}](term:term-evolution)[でない](grammar:grammar-de-nai) — che
  non è evolution, come filtro sul bersaglio
- [{{出|だ}}してもよい](grammar:grammar-temoyoi) — puoi mettere in campo, senza
  obbligo

## Pattern grammaticali chiave

- [～として](grammar:grammar-toshite) — come / in qualità di / nel ruolo di
- [{{場合|ばあい}}](term:term-baai) — caso o scenario in cui leggere la regola
- [あれば](grammar:grammar-areba) — se esiste / se hai quella condizione
- [{{時|とき}}](grammar:grammar-toki) — quando accade l'evento indicato
- [でない](grammar:grammar-de-nai) — non essere X / non appartenere a quella
  categoria
- [てもよい](grammar:grammar-temoyoi) — permesso opzionale, non obbligo

## Etichette da riconoscere

- [NEOクリーチャー](term:term-neo-creature) — tipo della carta
- [マフィ・ギャング](term:term-mafi-gang) — razza della creatura
- [W・ブレイカー](term:term-w-breaker) — keyword offensiva compatta
- [バトルゾーン](term:term-battle-zone) — destinazione della creatura rianimata

---

## 1. Entrare come NEO evolution: ruolo, caso e costo ridotto

Il primo effetto non dice semplicemente "quando evochi questa creatura".
Prima inserisce [フェリックス・ミザリィ](term:term-felix-misery) dentro una veste
precisa: `NEO{{進化|しんか}}クリーチャーとして`. Quel `として` è il pezzo che
impedisce di leggere lo sconto come universale. L'azione resta
[{{召喚|しょうかん}}](term:term-summon)する, ma avviene in un ruolo specifico.

:::example_sentence
jp: >-
  NEO{{進化|しんか}}クリーチャーとして
  [{{召喚|しょうかん}}](term:term-summon)する
  [{{場合|ばあい}}](term:term-baai)、[コスト](term:term-cost)を
  {{2|ふた}}つ[{{少|すく}}なくする](term:term-sukunaku-suru)。
translation_it: >-
  Nel caso in cui tu la evochi come creatura NEO evolution, riduci il costo di
  2.
reveal_mode: sentence
:::

La frase funziona in due metà. La prima metà prepara lo scenario, la seconda
mette mano al numero del costo.

*   `NEO{{進化|しんか}}クリーチャーとして`: `として` marca la qualifica. La creatura
    viene trattata "come NEO evolution creature", non come creatura giocata in
    modo qualsiasi.
*   [{{召喚|しょうかん}}](term:term-summon)する[{{場合|ばあい}}](term:term-baai):
    [{{場合|ばあい}}](term:term-baai) nominalizza lo scenario. Il testo non sta
    ancora dando il payoff; sta dicendo in quale caso la regola successiva si
    applica.
*   [コスト](term:term-cost)`を{{2|ふた}}つ`:
    `を` marca il costo come oggetto della modifica, mentre `{{2|ふた}}つ`
    quantifica di quanto cambia.
*   [{{少|すく}}なくする](term:term-sukunaku-suru): parte da `少ない`, "poco /
    scarso", e con `する` diventa "rendere minore". Nel rules text il risultato
    naturale è "ridurre il costo".

#### 🗺️ Anatomia della frase

*   `NEO{{進化|しんか}}クリーチャーとして` — **ruolo dell'evocazione**: la parola
    NEO non è un'etichetta isolata; qualifica il modo in cui la creatura viene
    evocata.
*   [{{召喚|しょうかん}}](term:term-summon)する[{{場合|ばあい}}](term:term-baai) —
    **cornice condizionale**: il caso viene definito prima dell'effetto.
*   [コスト](term:term-cost)`を` — **oggetto della riduzione**: il testo non
    riduce la creatura, ma il numero da pagare.
*   `{{2|ふた}}つ` — **misura della modifica**: la quantità è "di due", non
    "a costo due".
*   [{{少|すく}}なくする](term:term-sukunaku-suru) — **azione causativa semplice**:
    fai diventare il costo più basso.

#### ⚖️ Contrasto operativo: `{{場合|ばあい}}` non è un generico "quando"

[{{場合|ばあい}}](term:term-baai) imposta un caso regolamentare: se
l'evocazione avviene come NEO evolution, allora il costo si riduce. Un trigger
con [{{時|とき}}](grammar:grammar-toki) guarda invece un evento che accade in
un momento preciso. Qui lo sconto dipende dalla cornice dell'evocazione, non da
un evento successivo.

#### 🧠 Gancio cognitivo

Per ricordare [{{少|すく}}なくする](term:term-sukunaku-suru), trattalo come
"rendere poco". Non è un'etimologia speciale del TCG: è il normale valore
dell'aggettivo `少ない` trasformato in verbo con `する`.

## 2. La soglia Darkness: `あれば` controlla ciò che hai già

La seconda frase sposta il focus dal modo di evocare alla situazione del tuo
campo. Prima restringe il gruppo a
[{{自分|じぶん}}](term:term-self)の[{{闇|やみ}}](term:term-darkness)の
[クリーチャー](term:term-creature), poi chiede se quel gruppo arriva a
`{{2体以上|にたいいじょう}}`. Solo dopo si apre la possibilità di evocare
questa carta dal [{{墓地|ぼち}}](term:term-graveyard).

:::example_sentence
jp: >-
  [{{自分|じぶん}}](term:term-self)の[{{闇|やみ}}](term:term-darkness)の
  [クリーチャー](term:term-creature)が{{2体以上|にたいいじょう}}
  [あれば](grammar:grammar-areba)、[{{自分|じぶん}}](term:term-self)の
  [{{墓地|ぼち}}](term:term-graveyard)からこの
  [クリーチャー](term:term-creature)を
  [{{召喚|しょうかん}}](term:term-summon)してもよい。
translation_it: >-
  Se hai due o più creature Darkness, puoi evocare questa creatura dal tuo
  cimitero.
reveal_mode: sentence
:::

Questa è una struttura da leggere in blocco: gruppo filtrato, soglia minima,
origine dell'evocazione, permesso.

*   [{{自分|じぶん}}](term:term-self)の[{{闇|やみ}}](term:term-darkness)の
    [クリーチャー](term:term-creature): i due `の` impilano appartenenza e
    categoria. Non conti tutte le creature, ma le tue creature Darkness.
*   `が{{2体以上|にたいいじょう}}`:
    `が` mette quel gruppo come soggetto della condizione. `体` conta corpi /
    creature, mentre `以上` alza la soglia a "due o più".
*   [あれば](grammar:grammar-areba): forma condizionale di `ある`. Il testo non
    chiede di creare la soglia in quel momento; controlla se la soglia esiste
    già.
*   [{{墓地|ぼち}}](term:term-graveyard)`からこのクリーチャーを`:
    `から` marca la zona di partenza. La carta non viene recuperata in mano:
    viene evocata direttamente da lì.
*   [{{召喚|しょうかん}}](term:term-summon)してもよい:
    `てもよい` trasforma l'azione in permesso. Se la condizione è vera, puoi
    evocarla; non sei costretto a farlo.

#### 🗺️ Anatomia della frase

*   [{{自分|じぶん}}](term:term-self)の[{{闇|やみ}}](term:term-darkness)の
    [クリーチャー](term:term-creature)`が` — **gruppo controllato**: il soggetto
    della condizione è già filtrato per tuo lato e civiltà Darkness.
*   `{{2体以上|にたいいじょう}}` — **soglia minima**: due è il minimo valido,
    non il numero esatto obbligatorio.
*   [あれば](grammar:grammar-areba) — **condizione di esistenza**: se quel
    gruppo esiste in quantità sufficiente, la frase dopo la virgola diventa
    disponibile.
*   [{{墓地|ぼち}}](term:term-graveyard)`から` — **origine insolita
    dell'evocazione**: il punto di partenza è il cimitero.
*   `このクリーチャーを` — **oggetto evocato**: il dimostrativo `この` riporta alla
    stessa [フェリックス・ミザリィ](term:term-felix-misery).
*   [{{召喚|しょうかん}}](term:term-summon)してもよい — **permesso finale**:
    l'effetto autorizza l'evocazione, ma non la impone.

#### ⚖️ Contrasto operativo: soglia presente vs pagamento di costo

`{{2体以上|にたいいじょう}}あれば` non dice di sacrificare due creature e non
descrive un costo da pagare. Dice solo che devono esserci due o più creature
Darkness dalla tua parte. Dopo quel controllo, la carta guarda un'altra zona
con [{{墓地|ぼち}}](term:term-graveyard)`から` e permette
[{{召喚|しょうかん}}](term:term-summon)してもよい.

#### 🧠 Gancio cognitivo

Come trucco visivo, leggi `{{2体以上|にたいいじょう}}` come una soglia con una
linea sotto: da due in su, la porta si apre; sotto due, resta chiusa. È un
modo pratico per ricordare il valore di `以上`, non una spiegazione etimologica
dei kanji.

## 3. L'attacco in due tempi: prima il deck scende nel cimitero

Il terzo effetto parte da [{{攻撃|こうげき}}](term:term-attack)する
[{{時|とき}}](grammar:grammar-toki). Qui siamo davvero in una finestra di evento:
quando questa creatura attacca, la carta esegue un primo movimento dalla cima
del [{{山札|やまふだ}}](term:term-deck) al
[{{墓地|ぼち}}](term:term-graveyard). Il testo non parla ancora del bersaglio da
rianimare; prima crea materiale nel cimitero.

:::example_sentence
jp: >-
  [{{攻撃|こうげき}}](term:term-attack)する
  [{{時|とき}}](grammar:grammar-toki)、[{{自分|じぶん}}](term:term-self)の
  [{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から{{2枚|にまい}}を
  [{{墓地|ぼち}}](term:term-graveyard)に[{{置|お}}く](term:term-oku)。
translation_it: >-
  Quando attacca, metti nel cimitero le prime 2 carte del tuo mazzo.
reveal_mode: sentence
:::

*   [{{攻撃|こうげき}}](term:term-attack)する
    [{{時|とき}}](grammar:grammar-toki): il timing è l'attacco, non l'entrata in
    campo e non la fine del turno.
*   [{{自分|じぶん}}](term:term-self)の
    [{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から:
    `の{{上|うえ}}から` punta alla cima di una pila ordinata. Non stai scegliendo
    carte dal deck: prendi quelle sopra.
*   `{{2枚|にまい}}を`: `枚` conta carte come oggetti piatti. La particella `を`
    fa di quelle due carte l'oggetto del movimento.
*   [{{墓地|ぼち}}](term:term-graveyard)に
    [{{置|お}}く](term:term-oku): `に` dà la destinazione, [{{置|お}}く](term:term-oku)
    chiude l'azione di collocarle lì.

#### 🗺️ Anatomia della frase

*   [{{攻撃|こうげき}}](term:term-attack)する
    [{{時|とき}}](grammar:grammar-toki) — **trigger temporale**: l'azione parte
    nel momento dell'attacco.
*   [{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から — **fonte ordinata**: il
    movimento parte dalla cima, non da una selezione libera.
*   `{{2枚|にまい}}を` — **quantità spostata**: due carte sono l'oggetto diretto
    del verbo.
*   [{{墓地|ぼち}}](term:term-graveyard)に — **destinazione**: il cimitero è il
    punto di arrivo.
*   [{{置|お}}く](term:term-oku) — **verbo di collocazione**: mette le carte in
    una zona, senza dire che siano state distrutte.

#### ⚖️ Contrasto operativo: mandare al cimitero non è scegliere dal cimitero

`{{山札|やまふだ}}の{{上|うえ}}から{{2枚|にまい}}を{{墓地|ぼち}}に{{置|お}}く`
sposta carte dal deck al cimitero. La scelta del bersaglio avviene solo dopo,
quando il testo riparte con [その{{後|あと}}](grammar:grammar-sonoato) e guarda
il [{{墓地|ぼち}}](term:term-graveyard)`から`. Se unisci i due passaggi, rischi
di leggere il self mill come parte della scelta, ma il giapponese li tiene
ordinati.

## 4. Dopo quel movimento: filtri in serie e permesso di rianimare

[その{{後|あと}}](grammar:grammar-sonoato) aggancia il secondo movimento al primo:
dopo aver messo due carte nel cimitero, il testo può cercare un bersaglio nello
stesso spazio. La parte più densa è il gruppo nominale
`コスト{{6以下|ろくいか}}の、{{進化|しんか}}でない{{闇|やみ}}のクリーチャー{{1枚|いちまい}}`.
Non è una frase nuova; è una pila di filtri sullo stesso oggetto.

:::example_sentence
jp: >-
  [その{{後|あと}}](grammar:grammar-sonoato)、[{{自分|じぶん}}](term:term-self)の
  [{{墓地|ぼち}}](term:term-graveyard)から[コスト](term:term-cost)
  {{6以下|ろくいか}}の、[{{進化|しんか}}](term:term-evolution)でない
  [{{闇|やみ}}](term:term-darkness)の[クリーチャー](term:term-creature)
  {{1枚|いちまい}}を[バトルゾーン](term:term-battle-zone)に
  [{{出|だ}}してもよい](grammar:grammar-temoyoi)。
translation_it: >-
  Poi puoi mettere nel battle zone dal tuo cimitero 1 creatura Darkness non
  evolution di costo 6 o meno.
reveal_mode: sentence
:::

*   [その{{後|あと}}](grammar:grammar-sonoato): riprende il self mill appena
    risolto e apre il passaggio successivo. Non significa "in un secondo tempo
    qualsiasi"; significa dopo quel passaggio.
*   [{{墓地|ぼち}}](term:term-graveyard)`から`: l'origine della scelta è il tuo
    cimitero. Il bersaglio può includere anche una carta appena messa lì, se
    passa i filtri.
*   [コスト](term:term-cost)`{{6以下|ろくいか}}の`:
    `以下` imposta un tetto massimo. Sei o meno è valido; sette o più esce dal
    gruppo.
*   [{{進化|しんか}}](term:term-evolution)[でない](grammar:grammar-de-nai):
    `でない` nega una categoria nominale. Non vuol dire "non si evolve adesso";
    vuol dire "non è una evolution creature".
*   [{{闇|やみ}}](term:term-darkness)の[クリーチャー](term:term-creature)
    `{{1枚|いちまい}}`: dopo costo e non-evolution arriva il filtro di civiltà,
    poi la quantità esatta da prendere.
*   [バトルゾーン](term:term-battle-zone)に
    [{{出|だ}}してもよい](grammar:grammar-temoyoi):
    `に` marca la destinazione e `てもよい` lascia la scelta al giocatore.

#### 🗺️ Anatomia della frase

*   [その{{後|あと}}](grammar:grammar-sonoato) — **ordine procedurale**: prima
    il cimitero riceve due carte, poi si apre la rianimazione.
*   [{{自分|じぶん}}](term:term-self)の
    [{{墓地|ぼち}}](term:term-graveyard)`から` — **zona di partenza**: il
    bersaglio deve trovarsi nel tuo cimitero.
*   [コスト](term:term-cost)`{{6以下|ろくいか}}の` — **filtro numerico**: il costo
    massimo ammesso è sei.
*   [{{進化|しんか}}](term:term-evolution)[でない](grammar:grammar-de-nai) —
    **filtro di categoria**: le evolution creature sono escluse.
*   [{{闇|やみ}}](term:term-darkness)の[クリーチャー](term:term-creature)
    `{{1枚|いちまい}}を` — **oggetto finale**: una sola creatura Darkness che
    supera tutti i filtri precedenti.
*   [バトルゾーン](term:term-battle-zone)に
    [{{出|だ}}してもよい](grammar:grammar-temoyoi) — **destinazione più permesso**:
    puoi metterla in campo, ma non devi farlo per forza.

#### ⚖️ Contrasto operativo: `{{進化|しんか}}でない` filtra il tipo, non l'azione

[{{進化|しんか}}](term:term-evolution)[でない](grammar:grammar-de-nai) non significa
"questa creatura non sta evolvendo in questo momento". Qui `{{進化|しんか}}` è
una categoria di carta, e `でない` la esclude. Il bersaglio deve quindi essere
una creatura Darkness di costo `{{6以下|ろくいか}}`, ma anche non evolution.

#### 🧠 Gancio cognitivo

Immagina i filtri come cancelli allineati davanti al
[バトルゾーン](term:term-battle-zone): costo `{{6以下|ろくいか}}`, poi
non-evolution, poi [{{闇|やみ}}](term:term-darkness), poi quantità
`{{1枚|いちまい}}`. È un trucco di memoria per seguire la pila nominale; la
grammatica reale è il `の` che continua a legare ogni filtro allo stesso
[クリーチャー](term:term-creature).

## 5. Keyword e nome della carta: etichette compatte prima delle frasi

Le keyword e le razze di [フェリックス・ミザリィ](term:term-felix-misery) sono
etichette, non frasi. [NEOクリーチャー](term:term-neo-creature) prepara il modo
di lettura del primo effetto, [マフィ・ギャング](term:term-mafi-gang) identifica
la razza e [W・ブレイカー](term:term-w-breaker) descrive la pressione sugli
scudi. Nessuna di queste label contiene da sola soggetto, oggetto e verbo.

Il rules text invece si riconosce dalle particelle e dai verbi: `コストを`,
`{{墓地|ぼち}}から`, `{{山札|やまふだ}}の{{上|うえ}}から`,
`バトルゾーンに`, [{{少|すく}}なくする](term:term-sukunaku-suru),
[{{置|お}}く](term:term-oku), [{{出|だ}}してもよい](grammar:grammar-temoyoi).
Quando compaiono questi segnali, non stai più leggendo un'etichetta compatta:
stai seguendo una procedura.

#### ⚖️ Contrasto operativo: label nominale vs frase di effetto

Una label come [W・ブレイカー](term:term-w-breaker) resta un nome tecnico. Una
frase come
`[{{墓地|ぼち}}](term:term-graveyard)から[クリーチャー](term:term-creature)を[バトルゾーン](term:term-battle-zone)に[{{出|だ}}す](term:term-dasu)`
ha origine, oggetto, destinazione e verbo. Se cerchi particelle come `から`,
`を` e `に`, sai subito se stai leggendo un'etichetta o una catena di azioni.

## Esempi guidati di riepilogo

Le frasi seguenti ricombinano i quattro passaggi principali: ruolo NEO, soglia
Darkness, self mill e bersaglio filtrato dal cimitero.

:::example_sentence
jp: >-
  NEO{{進化|しんか}}クリーチャーとして
  [{{召喚|しょうかん}}](term:term-summon)する
  [{{場合|ばあい}}](term:term-baai)、[コスト](term:term-cost)を
  {{2|ふた}}つ[{{少|すく}}なくする](term:term-sukunaku-suru)。
translation_it: >-
  Nel caso in cui la evochi come creatura NEO evolution, riduci il costo di 2.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [{{闇|やみ}}](term:term-darkness)の[クリーチャー](term:term-creature)が
  {{2体以上|にたいいじょう}}[あれば](grammar:grammar-areba)、
  [{{墓地|ぼち}}](term:term-graveyard)から
  [{{召喚|しょうかん}}](term:term-summon)してもよい。
translation_it: >-
  Se hai due o più creature Darkness, puoi evocarla dal cimitero.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [{{山札|やまふだ}}](term:term-deck)の{{上|うえ}}から{{2枚|にまい}}を
  [{{墓地|ぼち}}](term:term-graveyard)に[{{置|お}}く](term:term-oku)。
translation_it: >-
  Metti nel cimitero le prime 2 carte del deck.
reveal_mode: sentence
:::

:::example_sentence
jp: >-
  [{{墓地|ぼち}}](term:term-graveyard)から[コスト](term:term-cost)
  {{6以下|ろくいか}}の、[{{進化|しんか}}](term:term-evolution)でない
  [{{闇|やみ}}](term:term-darkness)の[クリーチャー](term:term-creature)
  {{1枚|いちまい}}を[バトルゾーン](term:term-battle-zone)に
  [{{出|だ}}してもよい](grammar:grammar-temoyoi)。
translation_it: >-
  Puoi mettere nel battle zone dal cimitero 1 creatura Darkness non evolution
  di costo 6 o meno.
reveal_mode: sentence
:::

---

## Nota finale

[フェリックス・ミザリィ](term:term-felix-misery) diventa leggibile quando segui
la catena dei cancelli. [～として](grammar:grammar-toshite) qualifica
l'evocazione come NEO evolution, [{{場合|ばあい}}](term:term-baai) limita lo
sconto a quel caso, [あれば](grammar:grammar-areba) controlla la soglia delle
creature [{{闇|やみ}}](term:term-darkness), [その{{後|あと}}](grammar:grammar-sonoato)
ordina i due passaggi dell'attacco e [でない](grammar:grammar-de-nai) restringe
il bersaglio finale. Il testo sembra molto carico, ma ogni pezzo risponde alla
stessa domanda: in quale ruolo, da quale zona, con quale filtro e con quanto
margine di scelta.
