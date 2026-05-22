---
id: lesson-duel-masters-dm25-tcg-card-types
media_id: media-duel-masters-dm25
slug: tcg-card-types
title: Type line e tipi di carta particolari
order: 12
segment_ref: tcg-core
difficulty: n4
status: active
tags: [core, card-types, vocabulary, tcg-language]
prerequisites: [lesson-duel-masters-dm25-tcg-core-overview]
summary: >-
  Type line di Duel Masters: come separare tipo base, prefisso e forma speciale
  per prevedere zona, pila e stato della carta.
---

# Type line e tipi speciali: leggere subito zona, pila e stato

Su una carta di Duel Masters, la riga del tipo lavora prima ancora del rules
text. Ti dice se stai guardando un corpo che attacca, una magia, un oggetto
persistente, una carta che entra sopra una base o una carta con due letture
possibili. Quando quella riga contiene `{{進化|しんか}}`, `NEO`, `D2`, uno slash
o un punto mediano, il testo giapponese sta già preparando la domanda
successiva: dove vive questa carta e in quale stato va trattata adesso?

Il punto non è memorizzare nomi lunghi. È imparare a tagliare il type line in
pezzi leggibili: tipo base, prefisso speciale, zona implicata e forma attuale.
Da lì il rules text diventa meno opaco, perché parole come
`{{上|うえ}}に{{置|お}}く`, `として{{使|つか}}う` o
`{{別|べつ}}のD{{2|ツー}}フィールドが{{出|で}}た{{時|とき}}` hanno già un posto preciso
nella procedura.

## Termini chiave

- [{{進化|しんか}}クリーチャー](term:term-evolution-creature) — creatura che non
  entra da sola: il tipo contiene già l'idea di una base sotto.
- [{{進化|しんか}}](term:term-evolution) — movimento di pila: una carta entra
  sopra una base valida.
- [スター{{進化|しんか}}クリーチャー](term:term-star-evolution-creature) — variante
  di evoluzione in cui la pila va letta anche pensando a che cosa resta sotto.
- [NEOクリーチャー](term:term-neo-creature) — creatura che può essere corpo
  singolo o NEO evoluzione in base allo stato della pila.
- [G-NEOクリーチャー](term:term-g-neo-creature) — sottofamiglia NEO in cui la
  gestione delle carte sotto cambia quando lascia il campo.
- [タマシード/クリーチャー](term:term-tamaseed-creature) — carta con due nature:
  Tamaseed e creatura, da controllare nel contesto della frase.
- [タマシード](term:term-tamaseed) — tipo non-creatura che può comunque portare
  effetti persistenti.
- [ツインパクトカード](term:term-twinpact-card) — carta singola con due metà
  operative, spesso creatura e [{{呪文|じゅもん}}](term:term-spell).
- [サイキック・クリーチャー](term:term-psychic-creature) — creatura a due facce,
  legata a provenienza e trasformazioni non standard.
- [ドラグハート](term:term-dragheart) — prefisso che apre tre ruoli possibili:
  creatura, weapon o fortress.
- [クロスギア](term:term-crossgear) — oggetto persistente che si aggancia a una
  [クリーチャー](term:term-creature), non corpo autonomo.
- [{{城|しろ}}](term:term-castle) — tipo collegato alla
  [シールドゾーン](term:term-shield-zone) e alla logica di {{要塞化|ようさいか}}.
- [D{{2|ツー}}フィールド](term:term-d2-field) — field con regola di famiglia: un altro
  D2 Field può sostituire quello già presente.
- [コスト](term:term-cost), [{{手札|てふだ}}](term:term-hand) e
  [バトルゾーン](term:term-battle-zone) — numero, origine e destinazione che
  completano la lettura del type line.
- [{{時|とき}}](grammar:grammar-toki) — timing che aggancia un effetto al momento
  in cui il tipo o lo stato diventa rilevante.

## Espressioni ricorrenti

- `～の{{上|うえ}}に{{置|お}}く` — mette la carta sopra una base, quindi crea o
  modifica una pila.
- `～として{{使|つか}}う` — usa la carta come un certo lato o una certa natura,
  non come tutto il pacchetto insieme.
- `～であるかのように` — tratta un oggetto come se fosse di un altro tipo, senza
  dire che lo è in modo assoluto.
- `{{別|べつ}}の～が{{出|で}}た{{時|とき}}` — timing di sostituzione: l'arrivo
  di un altro oggetto attiva il movimento del precedente.

## Pattern grammaticali chiave

- [または](grammar:grammar-matawa) — collega alternative valide nello stesso
  requisito, come razza oppure civiltà.
- [～ていれば](grammar:grammar-teireba) — controlla uno stato già presente:
  se la carta si trova in quella condizione, la frase può proseguire.
- [～なければ ... ない](grammar:grammar-nakereba) — cancello negativo: senza la
  condizione richiesta, l'azione non passa.

## Etichette da riconoscere

- `{{進化|しんか}}`, `スター`, `NEO`, `G-NEO` — prefissi che cambiano il modo in
  cui una creatura entra, resta impilata o lascia il campo.
- `/` in `タマシード/クリーチャー` — due nature possibili nella stessa riga, non un
  semplice nome composto.
- `・` in `ドラグハート・クリーチャー` — divide famiglia e ruolo attuale della
  faccia.
- `D2` in `D{{2|ツー}}フィールド` — prefisso di famiglia, non decorazione grafica.

---

## 1. Il type line si legge a strati, non come un nome unico

Il primo strato è il tipo base: [クリーチャー](term:term-creature),
[{{呪文|じゅもん}}](term:term-spell), [タマシード](term:term-tamaseed),
`フィールド`, `クロスギア`. Questo pezzo dice quale grammatica di gioco aspettarti:
un corpo può attaccare e avere [コスト](term:term-cost), una spell viene usata
e risolta, un field resta a modificare il board state.

Il secondo strato è il prefisso o la forma speciale. Qui compaiono
[{{進化|しんか}}](term:term-evolution), スター, NEO, サイキック,
`ドラグハート`, `D2`. Questi pezzi non aggiungono solo colore: restringono la
lettura del rules text. In `{{進化|しんか}}クリーチャー`,
`{{進化|しんか}}` ti fa cercare subito una base sotto; in `D{{2|ツー}}フィールド`, `D2`
ti fa cercare che cosa succede quando un altro field della stessa famiglia
entra.

- [{{進化|しんか}}クリーチャー](term:term-evolution-creature) ➔
  [クリーチャー](term:term-creature) è il corpo, {{進化|しんか}} è il modo di
  ingresso. Se separi i due pezzi, capisci perché il rules text parlerà di
  mettere la carta `{{上|うえ}}に`, sopra qualcosa.
- [D{{2|ツー}}フィールド](term:term-d2-field) ➔ フィールド dice che l'oggetto resta sul
  campo, `D2` dice che non tutti i field convivono liberamente. La famiglia
  speciale prepara già il contrasto con `{{別|べつ}}のD{{2|ツー}}フィールド`.
- [サイキック・クリーチャー](term:term-psychic-creature) ➔
  [クリーチャー](term:term-creature) resta il ruolo da combattimento, ma
  `サイキック` avvisa che la carta non va letta come una creatura normale
  arrivata dalla [{{手札|てふだ}}](term:term-hand).

#### 🧠 Gancio cognitivo

Leggi il type line come un indirizzo in quattro campi: che cosa è, come
entra, dove vive, in quale stato conta. Non è etimologia: è un trucco di
lettura per non fermarti al primo nome riconoscibile.

#### ⚖️ Contrasto operativo

`クリーチャー` e `{{進化|しんか}}クリーチャー` condividono il corpo, ma non la
procedura di ingresso. Se leggi solo `クリーチャー`, ti aspetti un oggetto che
entra come corpo. Se leggi `{{進化|しんか}}クリーチャー`, devi cercare una base
valida e una frase con `{{上|うえ}}に{{置|お}}く` o un verbo simile.

## 2. Famiglia evoluzione: stesso corpo, pile diverse

La famiglia evoluzione usa quasi sempre lo stesso nucleo visivo:
{{進化|しんか}} più [クリーチャー](term:term-creature). La differenza sta nel
prefisso che precede o modifica quel nucleo. Qui il giapponese non ti chiede
solo "che tipo di carta è?"; ti chiede "quale pila sto guardando e che cosa
succede alle carte sotto?".

- [{{進化|しんか}}クリーチャー](term:term-evolution-creature) è la lettura base:
  serve una carta valida sotto. Quando vedi `{{上|うえ}}に{{置|お}}く`, la
  particella `に` marca la destinazione dell'azione e `{{上|うえ}}` specifica
  che la carta non entra accanto alla base, ma sopra.
- [スター{{進化|しんか}}クリーチャー](term:term-star-evolution-creature) aggiunge
  una gestione particolare della pila. `スター` non cambia il fatto che sia una
  creatura, ma cambia la domanda dopo una rimozione: sparisce solo la carta in
  cima o resta qualcosa sotto?
- [NEOクリーチャー](term:term-neo-creature) sposta la lettura sullo stato
  attuale. Una carta NEO può essere creatura normale oppure `NEO{{進化|しんか}}`
  se ha carte sotto. Quindi non basta leggere il tipo stampato: devi verificare
  se la frase sta descrivendo un corpo singolo o una pila.
- [G-NEOクリーチャー](term:term-g-neo-creature) restringe ancora il caso NEO.
  Quando lascia il campo mentre è trattata come G-NEO evoluzione, anche le
  carte sotto seguono la rimozione. La `G` quindi cambia il destino della pila,
  non la pronuncia generale di `クリーチャー`.

:::example_sentence
jp: >-
  スター{{進化|しんか}}：レクスターズまたは{{火|ひ}}のクリーチャー{{1体|いったい}}の{{上|うえ}}に{{置|お}}く。
translation_it: >-
  Star Evolution: mettila sopra 1 Rexterz o 1 creatura di fuoco.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `スター{{進化|しんか}}` ➔ **Label dell'abilità**: annuncia che stai leggendo
    una forma speciale di evoluzione, non una creatura normale.
*   `レクスターズまたは{{火|ひ}}のクリーチャー{{1体|いったい}}` ➔ **Base valida**:
    [または](grammar:grammar-matawa) unisce due requisiti nello stesso slot,
    Rexterz oppure creatura di fuoco.
*   `の{{上|うえ}}に` ➔ **Destinazione impilata**: `の` lega la base a
    `{{上|うえ}}`, mentre `に` marca il punto in cui la nuova carta viene messa.
*   `{{置|お}}く` ➔ **Risultato operativo**: la carta non viene solo "giocata",
    viene posizionata sopra una carta già presente.

#### ⚖️ Contrasto operativo

[または](grammar:grammar-matawa) qui non crea due effetti separati. Crea due
modi validi per soddisfare lo stesso requisito della base: una carta Rexterz
oppure una creatura di fuoco. Se una delle due descrizioni è vera, la base
passa il controllo.

## 3. Doppia natura: slash, lato scelto e trattamento temporaneo

Quando il type line contiene uno slash o una carta divisa in due metà, la
domanda passa da "che carta è?" a "come viene trattata in questo momento?".
Questo è il punto in cui i pattern grammaticali diventano molto pratici:
`として` sceglie un ruolo, `であるかのように` crea una lettura "come se",
[～ていれば](grammar:grammar-teireba) controlla uno stato, e
[～なければ ... ない](grammar:grammar-nakereba) blocca l'azione se lo stato
manca.

[タマシード/クリーチャー](term:term-tamaseed-creature) è
[タマシード](term:term-tamaseed) e [クリーチャー](term:term-creature) nella stessa
riga, ma non sempre ogni frase usa entrambe le nature nello stesso modo. Se il
testo dice che il Tamaseed viene trattato `クリーチャーであるかのように`, il punto
non è trasformarlo definitivamente in una creatura: è permettere a una frase
precisa di usarlo come base valida.

:::example_sentence
jp: >-
  このタマシードがクリーチャーであるかのように、この{{上|うえ}}に{{進化|しんか}}クリーチャーを{{置|お}}いてもよい。
translation_it: >-
  Puoi mettere una creatura evoluzione sopra questo Tamaseed come se fosse una
  creatura.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `このタマシードが` ➔ **Tema materiale della regola**: il testo parla proprio
    di questo Tamaseed, non di una creatura qualsiasi.
*   `クリーチャーであるかのように` ➔ **Trattamento simulato**: `である` dichiara
    "essere", `かのように` lo trasforma in "come se fosse".
*   `この{{上|うえ}}に` ➔ **Punto di impilamento**: `この` riprende il Tamaseed
    e lo rende la posizione sopra cui mettere la carta evoluzione.
*   `{{進化|しんか}}クリーチャーを{{置|お}}いてもよい` ➔ **Permesso, non obbligo**:
    `てもよい` autorizza l'azione; non dice che devi sempre farla.

#### ⚖️ Contrasto operativo

`であるかのように` non è uguale a dire `クリーチャーである`. La frase non riscrive
per sempre il tipo della carta; crea una lettura funzionale per quella
procedura. Per questo il type line con slash resta importante: prepara la
possibilità che il testo scelga una natura alla volta.

[ツインパクトカード](term:term-twinpact-card) funziona in modo diverso. Non
passa da Tamaseed a creatura: offre due metà sulla stessa carta fisica. Quando
il rules text dice `{{呪文|じゅもん}}として{{使|つか}}う`, il focus è il lato
scelto. La carta resta una [ツインパクトカード](term:term-twinpact-card), ma la
risoluzione sta usando la parte spell.

:::example_sentence
jp: >-
  このツインパクトカードを{{呪文|じゅもん}}として{{使|つか}}う。
translation_it: >-
  Usa questa carta TwinPact come magia.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `このツインパクトカードを` ➔ **Oggetto diretto**: `を` marca la carta che stai
    usando.
*   `{{呪文|じゅもん}}として` ➔ **Ruolo scelto**: `として` significa "come / in
    qualità di" e restringe la lettura al lato spell.
*   `{{使|つか}}う` ➔ **Azione sul lato selezionato**: non attiva entrambe le
    metà insieme; usa la carta nel ruolo appena dichiarato.

#### 🧠 Gancio cognitivo

Lo slash `/` ti fa chiedere "quale natura conta adesso?". `として` ti fa chiedere
"in quale ruolo la sto usando?". Sono domande simili, ma non identiche: la
prima riguarda lo stato della carta, la seconda il modo in cui la frase la sta
impiegando.

## 4. Facce, zone e oggetti persistenti: leggere dove vive la carta

Alcuni type line ti spostano subito fuori dalla sequenza più semplice
"dalla mano al campo". [サイキック・クリーチャー](term:term-psychic-creature) e
[ドラグハート](term:term-dragheart) chiamano in causa facce e trasformazioni;
[クロスギア](term:term-crossgear), [{{城|しろ}}](term:term-castle) e
[D{{2|ツー}}フィールド](term:term-d2-field) chiamano in causa oggetti che persistono o
modificano una zona.

- [サイキック・クリーチャー](term:term-psychic-creature) conserva
  [クリーチャー](term:term-creature) come ruolo leggibile, ma il prefisso
  `サイキック` avvisa che la carta può avere una faccia alternativa e non va
  interpretata come una creatura standard pescata dalla
  [{{手札|てふだ}}](term:term-hand).
- [ドラグハート](term:term-dragheart) è il prefisso; la parola dopo ・ decide
  il ruolo effettivo. `ドラグハート・クリーチャー`, `ドラグハート・ウエポン` e
  `ドラグハート・フォートレス` condividono famiglia, ma non funzione.
- [クロスギア](term:term-crossgear) entra come oggetto e poi si aggancia a una
  creatura. Quando il rules text usa `クロスする`, aspettati lessico di
  equipaggiamento e bersaglio, non una creatura che attacca da sola.
- [{{城|しろ}}](term:term-castle) sembra un nome comune trasparente, ma nel
  type line indica una carta collegata agli scudi. `{{要塞化|ようさいか}}` va
  letto come collocazione e protezione della [シールドゾーン](term:term-shield-zone),
  non come semplice immagine di un castello.
- [D{{2|ツー}}フィールド](term:term-d2-field) è un pezzo di board state con una regola di
  sostituzione. Quando un altro D2 Field entra, la frase può ordinare di
  spostare quello precedente nel cimitero.

:::example_sentence
jp: >-
  {{別|べつ}}のD{{2|ツー}}フィールドが{{出|で}}た{{時|とき}}、このD{{2|ツー}}フィールドを{{墓地|ぼち}}に{{置|お}}く。
translation_it: >-
  Quando entra un altro D2 Field, metti questo D2 Field nel cimitero.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `{{別|べつ}}のD{{2|ツー}}フィールドが` ➔ **Nuovo oggetto rilevante**: `{{別|べつ}}の`
    significa "un altro", quindi non sta parlando del field già presente.
*   `{{出|で}}た{{時|とき}}` ➔ **Timing del trigger**:
    [{{時|とき}}](grammar:grammar-toki) aggancia l'effetto al momento in cui il
    nuovo field entra.
*   `このD{{2|ツー}}フィールドを` ➔ **Oggetto da spostare**: `この` punta al D2 Field
    precedente, quello che viene sostituito.
*   `{{墓地|ぼち}}に{{置|お}}く` ➔ **Destinazione finale**: `に` marca il
    cimitero come zona di arrivo.

#### ⚖️ Contrasto operativo

`{{別|べつ}}のD{{2|ツー}}フィールド` non vuol dire "un altro effetto del field". Vuol dire
un altro oggetto dello stesso tipo. Il trigger nasce dall'ingresso di quel
nuovo oggetto, e il risultato riguarda `このD{{2|ツー}}フィールド`, cioè quello già in
campo.

Il caso [ドラグハート](term:term-dragheart) è diverso: non lavora per
sostituzione di field, ma per faccia e ruolo. Qui il punto mediano `・` è
decisivo per non fermarsi al prefisso.

:::example_sentence
jp: >-
  ドラグハート・フォートレスが{{龍解|りゅうかい}}して、ドラグハート・クリーチャーになる。
translation_it: >-
  Un Dragheart Fortress si libera e diventa un Dragheart Creature.
reveal_mode: sentence
:::

#### 🗺️ Anatomia della frase

*   `ドラグハート・フォートレスが` ➔ **Stato di partenza**: la famiglia è
    `ドラグハート`, ma il ruolo attuale è `フォートレス`.
*   `{{龍解|りゅうかい}}して` ➔ **Passaggio di trasformazione**: la forma in
    `して` collega la trasformazione al risultato successivo.
*   `ドラグハート・クリーチャーになる` ➔ **Stato di arrivo**: `になる` marca il
    diventare creatura; non è solo una descrizione, è il nuovo ruolo della
    faccia.

#### 🧠 Gancio cognitivo

Con [ドラグハート](term:term-dragheart), guarda sempre la parola dopo ・ come
se fosse il "verbo muto" della carta: `クリーチャー` combatte, `ウエポン` si
equipaggia, `フォートレス` resta come struttura. Il prefisso dice famiglia; il
pezzo finale dice che cosa fa adesso.

## 5. Metodo rapido davanti a un type line strano

Quando incontri una riga di tipo lunga, resisti alla tentazione di tradurla
tutta in blocco. La lettura più solida procede per domande brevi, nello stesso
ordine in cui il rules text di solito risponde.

1. Trova il tipo base: [クリーチャー](term:term-creature),
   [{{呪文|じゅもん}}](term:term-spell), [タマシード](term:term-tamaseed),
   フィールド, [クロスギア](term:term-crossgear) o [{{城|しろ}}](term:term-castle).
   Questo decide se aspettarti attacco, risoluzione, permanenza o zona speciale.
2. Isola il prefisso: [{{進化|しんか}}](term:term-evolution), スター, NEO,
   G-NEO, サイキック, [ドラグハート](term:term-dragheart), D2. Il prefisso
   ti dice quale regola extra portare nella frase successiva.
3. Controlla la zona: [バトルゾーン](term:term-battle-zone),
   [シールドゾーン](term:term-shield-zone), [{{手札|てふだ}}](term:term-hand),
   cimitero, cima o fondo del mazzo. Le particelle `に`, `から` e `の{{上|うえ}}`
   ti dicono partenza, arrivo e posizione.
4. Verifica lo stato: una carta con slash, una carta NEO o una TwinPact può
   contare in modo diverso a seconda della frase. Cerca `として`,
   であるかのように, [～ていれば](grammar:grammar-teireba) o
   [～なければ ... ない](grammar:grammar-nakereba).
5. Solo dopo leggi il payoff: mettere sopra, usare come spell, trasformare,
   equipaggiare, mandare nel cimitero o sostituire un field. A quel punto il
   verbo finale non arriva più isolato: ha già tipo, zona e stato.

## Esempi guidati di riepilogo

`スター{{進化|しんか}}：レクスターズまたは{{火|ひ}}のクリーチャー{{1体|いったい}}の{{上|うえ}}に{{置|お}}く`
si legge partendo dalla pila: `スター{{進化|しんか}}` annuncia una forma speciale,
[または](grammar:grammar-matawa) apre due basi valide, e
`{{上|うえ}}に{{置|お}}く` chiude l'azione sopra una carta già presente.

`このタマシードがクリーチャーであるかのように` si legge partendo dal trattamento:
il Tamaseed non diventa genericamente una creatura per sempre, ma viene letto
come creatura quanto basta per permettere la frase successiva.

`このツインパクトカードを{{呪文|じゅもん}}として{{使|つか}}う` si legge partendo dal
ruolo scelto: `として` seleziona il lato spell della carta, mentre `を` marca la
carta intera come oggetto dell'azione.

`{{別|べつ}}のD{{2|ツー}}フィールドが{{出|で}}た{{時|とき}}` si legge partendo dal timing:
l'arrivo di un altro D2 Field attiva lo spostamento di `このD{{2|ツー}}フィールド`, quello
che era già sul campo.

## Nota finale

Il type line di Duel Masters non è un'etichetta ornamentale. Prima separa il
tipo base, poi il prefisso speciale, poi zona e stato: così `{{進化|しんか}}`,
`NEO`, slash, `ドラグハート` e `D2` smettono di sembrare nomi lunghi e diventano
istruzioni preliminari per leggere il rules text.
