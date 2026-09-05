---
id: lesson-pokemon-scarlet-violet-pokemon-videogame-core-003-pokemon-videogame-core-dialogue-and-tutorial-patterns
media_id: media-pokemon-scarlet-violet
slug: 003-pokemon-videogame-core-dialogue-and-tutorial-patterns
title: "Dialoghi e tutorial: inviti, condizioni e sblocchi"
order: 30
segment_ref: pokemon-videogame-core
difficulty: custom
status: active
tags: [pokemon, core, dialogue, tutorial]
prerequisites: []
summary: >-
  Riconoscere i micro-pattern che ritornano nei tutorial e nei dialoghi guidati,
  così da capire che cosa il gioco ti sta suggerendo, chiedendo o sbloccando.
---

# Dialoghi e tutorial: inviti, condizioni e sblocchi

Nei giochi Pokémon, molte istruzioni non suonano come ordini. Nemo ti invita
a provare, un familiare ti raccomanda di riposare, un messaggio di sistema ti
dice che una funzione è ora disponibile. Il tono resta amichevole, ma la frase
sta guidando un'azione concreta: scegliere una destinazione, salvare, curare la
squadra, aprire un riepilogo o leggere uno sblocco.

Il punto da riconoscere è il rapporto tra forma e funzione. `～てみる` spinge a
fare una prova, `～たら` aggancia una procedura a una condizione, `～てくれる`
mostra che qualcuno agisce a tuo favore, mentre `～ことができる`,
`～ようになる` e `～ておく` distinguono possibilità immediata, cambiamento
stabile e preparazione.

## Termini chiave

- [{{目的|もくてき}}{{地|ち}}](term:term-mokutekichi) — destinazione / punto da raggiungere
- [{{手|て}}{{持|も}}ち](term:term-te-mochi) — squadra attiva / Pokémon con te
- [{{強|つよ}}さを{{見|み}}る](term:term-tsuyosa-o-miru) — aprire il riepilogo del Pokémon
- [レポート](term:term-report) — salvataggio / registrazione della partita
- [どうぐ](term:term-dougu) — strumento / oggetto usabile
- [{{回復|かいふく}}](term:term-kaifuku) — recupero / cura
- [{{状態|じょうたい}}{{異常|いじょう}}](term:term-joutai-ijou) — alterazione di stato
- [ポケモン{{図鑑|ずかん}}](term:term-pokemon-zukan) — Pokémon Zukan / catalogo dei Pokémon

## Espressioni ricorrenti

- `{{目的|もくてき}}{{地|ち}}を {{登録|とうろく}}する` — registrare una destinazione sulla mappa
- `レポートしてね` — salva, con tono amichevole o familiare
- `{{手|て}}{{持|も}}ちを {{回復|かいふく}}してくれる` — qualcuno cura la tua squadra per te
- `{{手|て}}に {{入|い}}れた！` — hai ottenuto qualcosa
- `バッグに しまった` — l'oggetto è stato riposto nella borsa

## Pattern grammaticali chiave

- [～てみる](grammar:grammar-te-miru) — provare a fare e vedere che succede
- [～たら](grammar:grammar-tara) — se / quando una condizione si realizza
- [～てね](grammar:grammar-te-ne) — richiesta amichevole o raccomandazione morbida
- [～てくれる](grammar:grammar-te-kureru) — qualcuno fa qualcosa a tuo favore
- [～ことができる](grammar:grammar-koto-ga-dekiru) — poter fare / funzione disponibile
- [～ようになる](grammar:grammar-you-ni-naru) — diventare possibile / sbloccarsi stabilmente
- [～ておく](grammar:grammar-teoku) — fare in anticipo e lasciare pronto

## Etichette da riconoscere

- [バッグ](term:term-bag) — borsa / inventario generale
- [もちもの](term:term-mochimono) — strumento tenuto da un Pokémon
- `マップ` — mappa, spesso il luogo dove si registra la destinazione

---

Quando compare il Pokémon Zukan, la frase richiama il registro che cataloga Pokemon incontrati o catturati.

## 1. Il tutorial parla piano, ma spinge l'azione

Il registro di base è l'invito operativo: una spinta gentile verso l'azione. Nei
dialoghi guida, un personaggio può formulare la prossima azione come
"proviamo", "che ne dici di provare" o "mi raccomando". La frase sembra
sociale, però nel flusso del gioco apre una procedura concreta.

[～てみる](grammar:grammar-te-miru) nasce dalla forma in -te del verbo più
`みる`, "vedere". In un tutorial non significa soltanto "fare un esperimento
astratto": vuol dire eseguire il comando e osservare subito l'effetto. Se leggi
`{{登録|とうろく}}してみたら？`, il gioco non sta divagando; sta rendendo più
morbida l'istruzione di registrare qualcosa.

:::image
src: assets/story/nemona-second-battle-growth-check.webp
alt: "Nemo parla prima di una sfida con una battuta che invita a mettere alla prova la crescita del giocatore."
caption: >-
  Nemo usa il tono della prova: con `{{試|ため}}してみよう`, la sfida diventa un
  modo pratico per vedere quanto sei cresciuto, non un ordine secco.
:::

:::example_sentence
jp: >-
  {{目的|もくてき}}{{地|ち}}に {{登録|とうろく}}してみたら？ {{次|つぎ}}に
  {{向|む}}かう {{場所|ばしょ}}が すぐ わかるよ。
translation_it: >-
  Che ne dici di provare a registrare una destinazione? Capisci subito dove
  andare dopo.
:::

#### 🗺️ Anatomia della frase

- `{{目的|もくてき}}{{地|ち}}に` ➔ destinazione marcata da `に`: è il punto verso cui orientare l'azione.
- {{登録|とうろく}}してみたら？ ➔ {{登録|とうろく}}する in forma -te + [～てみる](grammar:grammar-te-miru) + たら: "se provassi a registrarla?".
- `{{次|つぎ}}に {{向|む}}かう {{場所|ばしょ}}が` ➔ soggetto della conseguenza: il luogo verso cui dirigerti dopo.
- `すぐ わかるよ` ➔ risultato rassicurante: `よ` presenta l'informazione come qualcosa che il parlante ti consegna.

#### ⚖️ Contrasto operativo

`{{登録|とうろく}}してみたら？` non ha la rigidità di `{{登録|とうろく}}してください`,
"registra per favore". Però non è neanche una chiacchiera opzionale: in un
tutorial, il suggerimento gentile indica quasi sempre la prossima azione utile.

#### 🧠 Gancio cognitivo

Per [{{目的|もくてき}}{{地|ち}}](term:term-mokutekichi), pensa a
`{{目的|もくてき}}` come allo scopo e a `{{地|ち}}` come al punto sulla mappa. È
un trucco mnemonico, non un'analisi etimologica completa: ti aiuta a leggere il
label come "luogo con uno scopo", non come posto generico.

[～てね](grammar:grammar-te-ne) lavora sulla stessa zona morbida, ma con un
tono più vicino. La forma in `-te` chiede l'azione; `ね` cerca accordo,
complicità o attenzione. Quando una frase come `ゆっくり {{休|やす}}んでね`
arriva da un familiare o da un personaggio guida, il calore del tono non
cancella la funzione: il gioco ti sta comunque indicando una pausa utile.

:::example_sentence
jp: >-
  ベッドで ゆっくり {{休|やす}}んでね。 {{手|て}}{{持|も}}ちも
  {{回復|かいふく}}するよ。
translation_it: >-
  Riposati con calma nel letto, mi raccomando. Anche la tua squadra si
  rimetterà in sesto.
:::

#### 🗺️ Anatomia della frase

- `ベッドで` ➔ luogo o mezzo dell'azione: il letto è il punto in cui riposare.
- `ゆっくり {{休|やす}}んでね` ➔ richiesta amichevole: `{{休|やす}}む` in forma `-te` più `ね`.
- `{{手|て}}{{持|も}}ちも` ➔ anche la squadra attiva entra nell'effetto, non solo il protagonista.
- `{{回復|かいふく}}するよ` ➔ conseguenza dichiarata con `よ`: il riposo produce recupero.

#### ⚖️ Contrasto operativo

`てね` suona come richiesta morbida rivolta all'interlocutore. Se la frase contiene un'azione giocabile, leggila come
raccomandazione reale con tono gentile.

## 2. Condizione prima, procedura dopo: il ruolo di ～たら

Quando il tutorial passa dai consigli alle procedure, la frase spesso si apre
con una condizione. [～たら](grammar:grammar-tara) dice "se / quando succede
questa cosa"; la parte dopo spiega che cosa fare. Per il lettore, è una forma
preziosa perché separa subito problema e risposta.

Nel flusso di esplorazione, `{{道|みち}}に {{迷|まよ}}ったら` crea il caso: ti
sei perso. Solo dopo arriva la soluzione, come aprire la mappa o controllare la
posizione. La particella `に` in `{{道|みち}}に {{迷|まよ}}う` non indica una
destinazione desiderata, ma il contesto in cui si resta disorientati: "perdersi
sulla strada / nel percorso".

:::example_sentence
jp: >-
  {{道|みち}}に {{迷|まよ}}ったら マップを {{開|ひら}}いて
  {{現在|げんざい}}{{地|ち}}を {{確認|かくにん}}しよう。
translation_it: >-
  Se ti perdi, apri la mappa e controlla la tua posizione attuale.
:::

#### 🗺️ Anatomia della frase

- {{道|みち}}に {{迷|まよ}}ったら ➔ condizione con [～たら](grammar:grammar-tara): quando si realizza il problema del perdersi.
- `マップを {{開|ひら}}いて` ➔ prima risposta operativa: aprire la mappa.
- `{{現在|げんざい}}{{地|ち}}を` ➔ oggetto del controllo: il punto in cui ti trovi adesso.
- `{{確認|かくにん}}しよう` ➔ volitivo pratico: "controlliamo", tipico di una guida che propone l'azione successiva.

La stessa struttura torna in battaglia e nella gestione della squadra. Se la
condizione è [{{状態|じょうたい}}{{異常|いじょう}}](term:term-joutai-ijou), il testo
ti sta dicendo che il Pokémon non è più nel suo stato normale: può perdere
turni, HP o libertà d'azione. [{{回復|かいふく}}](term:term-kaifuku) allora va
letto in modo largo, come ripristino: a volte riguarda solo HP, altre volte
rimuove anche un problema di stato.

:::example_sentence
jp: >-
  {{状態|じょうたい}}{{異常|いじょう}}に なったら {{回復|かいふく}}の どうぐを
  {{使|つか}}おう。
translation_it: >-
  Se entri in uno stato alterato, usiamo uno strumento di cura.
:::

#### 🗺️ Anatomia della frase

- `{{状態|じょうたい}}{{異常|いじょう}}に なったら` ➔ condizione di cambiamento: il Pokémon entra in uno stato non normale.
- `{{回復|かいふく}}の どうぐを` ➔ `の` collega funzione e oggetto: uno strumento di recupero.
- `{{使|つか}}おう` ➔ volitivo: proposta operativa, non semplice descrizione.

#### ⚖️ Contrasto operativo

[～たら](grammar:grammar-tara) non ti dice sempre "se, forse, un giorno". Nei
tutorial spesso vale "quando questa situazione si presenta, questa è la
procedura". Cerca quindi il confine: prima condizione, poi risposta.

## 3. Aiuti ricevuti e oggetti ottenuti

Un'altra zona tipica dei dialoghi guidati è l'aiuto. [～てくれる](grammar:grammar-te-kureru)
aggiunge al verbo l'idea che l'azione arriva verso di te o a tuo beneficio. In
Pokémon questo valore è molto concreto: un NPC cura la squadra, un servizio ti
sistema lo stato, un partner raccoglie un oggetto e il risultato entra nel tuo
flusso.

[{{手|て}}{{持|も}}ち](term:term-te-mochi) rende visibile chi riceve l'aiuto.
Contiene `{{手|て}}`, mano, e `{{持|も}}ち`, ciò che tieni: nel gioco non indica
tutti i Pokémon posseduti, ma il gruppo che hai con te adesso. Se il testo dice
che qualcuno cura la [{{手|て}}{{持|も}}ち](term:term-te-mochi), sta rimettendo in
sesto la squadra attiva, cioè quella che può entrare subito in battaglia.

:::example_sentence
jp: >-
  ポケモンセンターの {{人|ひと}}が {{手|て}}{{持|も}}ちを
  {{回復|かいふく}}してくれる。
translation_it: >-
  La persona del Pokémon Sentā ti cura la squadra.
:::

#### 🗺️ Anatomia della frase

- `ポケモンセンターの {{人|ひと}}が` ➔ soggetto che agisce: la persona del Pokémon Sentā.
- `{{手|て}}{{持|も}}ちを` ➔ oggetto curato: la squadra attiva.
- {{回復|かいふく}}してくれる ➔ verbo + [～てくれる](grammar:grammar-te-kureru): la cura avviene a tuo favore.

#### ⚖️ Contrasto operativo

`{{回復|かいふく}}する` descrive l'azione di curare. `{{回復|かいふく}}してくれる`
aggiunge l'angolo del beneficio: qualcuno o qualcosa lo fa per te. Nei dialoghi
questo cambia il tono, perché il personaggio non presenta solo un effetto, ma
un supporto.

I messaggi di ottenimento usano un altro tipo di stabilità. {{手|て}}に
{{入|い}}れた！` dice che qualcosa è entrato nelle tue mani; `バッグに
しまった dice che il gioco lo ha riposto nell'inventario. Non sono frasi da
saltare: ti dicono se hai ricevuto un [どうぐ](term:term-dougu), dove è finito e
se puoi recuperarlo dalla [バッグ](term:term-bag).

:::image
src: assets/story/lets-go-auto-battle-field.webp
alt: "Pokémon partner sul campo con notifica laterale di vittoria automatica e oggetto ottenuto."
caption: >-
  Anche una piccola notifica sul campo può contenere il nucleo operativo:
  qualcuno ha agito, un [どうぐ](term:term-dougu) è stato ottenuto e il risultato
  viene archiviato nel tuo flusso di esplorazione.
:::

:::example_sentence
jp: >-
  どうぐを {{手|て}}に {{入|い}}れた！ バッグに しまった。
translation_it: >-
  Hai ottenuto uno strumento! È stato riposto nella borsa.
:::

#### 🗺️ Anatomia della frase

- `どうぐを` ➔ oggetto ottenuto: uno strumento usabile.
- `{{手|て}}に {{入|い}}れた` ➔ formula di acquisizione: letteralmente "messo in mano".
- `バッグに` ➔ destinazione dell'archiviazione: la borsa / inventario.
- `しまった` ➔ azione conclusa di riporre; qui non ha valore di "errore", ma di sistemazione completata.

#### 🧠 Gancio cognitivo

Per `{{手|て}}に {{入|い}}れた`, immagina l'oggetto che passa dal mondo di gioco
alla tua mano. Subito dopo, `バッグに しまった` lo sposta dalla mano al posto
giusto nell'inventario.

## 4. Possibilità, sblocchi e preparazione

Quando il testo diventa più da sistema, il tono si fa meno emotivo e più
strutturale. Qui tre pattern separano cose che in italiano rischiano di
diventare tutte "puoi": [～ことができる](grammar:grammar-koto-ga-dekiru),
[～ようになる](grammar:grammar-you-ni-naru) e [～ておく](grammar:grammar-teoku).

### A. ～ことができる: la funzione è disponibile adesso

[～ことができる](grammar:grammar-koto-ga-dekiru) prende un verbo, lo trasforma in
"cosa / azione" con `こと` e aggiunge `ができる`, "è possibile". In una UI vale
"da qui puoi fare questa azione". Se la frase parla di
[{{強|つよ}}さを{{見|み}}る](term:term-tsuyosa-o-miru), non sta commentando la
forza in astratto: quel label apre il riepilogo del Pokémon, dove controlli
mosse, abilità, tipo e [もちもの](term:term-mochimono).

:::example_sentence
jp: >-
  この {{画面|がめん}}では ポケモンの もちものを {{変更|へんこう}}する
  ことができる。
translation_it: >-
  In questa schermata puoi cambiare l'oggetto tenuto da un Pokémon.
:::

#### 🗺️ Anatomia della frase

- `この {{画面|がめん}}では` ➔ contesto limitato: proprio in questa schermata.
- `ポケモンの もちものを {{変更|へんこう}}する` ➔ azione intera nominalizzata: cambiare l'oggetto tenuto.
- `ことができる` ➔ possibilità concreta: la funzione è disponibile ora.

### B. ～ようになる: da ora in poi cambia una regola

[～ようになる](grammar:grammar-you-ni-naru) segnala un cambiamento stabile. Non
è solo "posso farlo una volta": da un certo evento in poi, una funzione si apre
o una regola del mondo di gioco inizia a valere. Per questo il pattern è
naturale negli sblocchi, nella progressione e nelle spiegazioni legate a
medaglie, livelli e sistemi.

:::example_sentence
jp: >-
  ジムバッジが {{増|ふ}}えると {{高|たか}}い レベルの ポケモンも
  {{言|い}}うことを {{聞|き}}くようになる。
translation_it: >-
  Quando aumentano le Medaglie Palestra, anche i Pokémon di livello più alto
  iniziano a obbedirti.
:::

#### 🗺️ Anatomia della frase

- `ジムバッジが {{増|ふ}}えると` ➔ condizione automatica: quando aumentano le medaglie.
- `{{高|たか}}い レベルの ポケモンも` ➔ anche i Pokémon di livello alto entrano nella nuova regola.
- `{{言|い}}うことを {{聞|き}}く` ➔ espressione per "obbedire": ascoltare ciò che viene detto.
- `ようになる` ➔ cambiamento stabile: da quel punto iniziano a obbedire.

### C. ～ておく: lasciare pronta la prossima scelta

[～ておく](grammar:grammar-teoku) è la grammatica della preparazione. Il verbo
accade adesso, ma il valore guarda al dopo: salvi prima della lotta, curi la
squadra prima di entrare in una zona rischiosa, registri una
[{{目的|もくてき}}{{地|ち}}](term:term-mokutekichi) prima di perderti. Con
[レポート](term:term-report), questa forma è molto trasparente: non stai solo
salvando, stai lasciando registrato lo stato dell'avventura.

:::example_sentence
jp: >-
  {{次|つぎ}}の バトルの {{前|まえ}}に レポートしておこう。
translation_it: >-
  Prima della prossima lotta, salviamo in anticipo.
:::

#### 🗺️ Anatomia della frase

- `{{次|つぎ}}の バトルの {{前|まえ}}に` ➔ momento della preparazione: prima della prossima lotta.
- `レポートして` ➔ fare il salvataggio.
- `おこう` ➔ volitivo di `おく`: lasciamolo fatto, così resta pronto.

#### ⚖️ Contrasto operativo

[～ことができる](grammar:grammar-koto-ga-dekiru) parla di una funzione aperta
adesso. [～ようになる](grammar:grammar-you-ni-naru) parla di uno sblocco che
cambia il dopo. [～ておく](grammar:grammar-teoku) parla di un'azione che fai
prima, così il dopo è già preparato.

## Esempi guidati di riepilogo

:::example_sentence
jp: >-
  マップで {{目的|もくてき}}{{地|ち}}を {{登録|とうろく}}しておくと
  {{次|つぎ}}に {{向|む}}かう {{場所|ばしょ}}が わかりやすい。
translation_it: >-
  Se registri in anticipo una destinazione sulla mappa, diventa più chiaro dove
  andare dopo.
:::

:::example_sentence
jp: >-
  {{状態|じょうたい}}{{異常|いじょう}}に なったら、まず {{回復|かいふく}}の
  どうぐを {{使|つか}}ってね。
translation_it: >-
  Se entri in uno stato alterato, per prima cosa usa uno strumento di cura, mi
  raccomando.
:::

:::example_sentence
jp: >-
  ポケモンを {{選|えら}}んで 「{{強|つよ}}さを{{見|み}}る」を {{開|ひら}}くと、
  わざや もちものを {{確認|かくにん}}する ことができる。
translation_it: >-
  Se selezioni un Pokémon e apri "Controlla dati", puoi verificare mosse e
  oggetto tenuto.
:::

:::example_sentence
jp: >-
  {{新|あたら}}しい ポケモンを {{捕|つか}}まえると
  ポケモン{{図鑑|ずかん}}で {{見|み}}られるようになる。
translation_it: >-
  Quando catturi un nuovo Pokémon, diventa consultabile nel Pokémon Zukan.
:::

## Nota finale

I tutorial Pokémon sono gentili nella voce, ma regolari nella struttura. Quando
vedi [～てみる](grammar:grammar-te-miru), cerca l'azione da provare; quando
vedi [～たら](grammar:grammar-tara), separa condizione e risposta; quando vedi
[～てくれる](grammar:grammar-te-kureru), chiediti chi sta facendo qualcosa a tuo
favore. Nei messaggi più sistemici, `できる`, `ようになる` e `ておく` ti dicono
se una funzione è disponibile ora, se una regola è cambiata da questo momento o
se conviene lasciare pronta la prossima scelta.
