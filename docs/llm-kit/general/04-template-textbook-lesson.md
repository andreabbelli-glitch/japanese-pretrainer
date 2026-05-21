---
id: lesson-<media-slug>-<segment-slug>-<lesson-slug>
media_id: media-<media-slug>
slug: <lesson-slug>
title: <titolo-lesson>
order: <numero-ordine>
segment_ref: <segment-ref>
difficulty: <n5|n4|n3|custom>
status: active
tags: [<tag-1>, <tag-2>]
prerequisites: []
summary: >-
  <Una frase (max 160 caratteri) che descrive il risultato concreto di lettura.
  Viene mostrata nella card del textbook e nell'header della pagina.
  Se assente, il sistema genera automaticamente un excerpt dal corpo
  del documento (tagliato a 400 caratteri): meglio scriverla a mano. Non
  parlare del batch, della lesson come oggetto editoriale o del workflow.
  Deve restare plain text: niente semantic links, furigana markup o backtick.>
---

# <Titolo naturale centrato sulla lettura reale>

<Apri con 1-2 paragrafi in italiano che portano subito il lettore dentro la
scena, schermata, carta o dialogo. Non parlare della lesson come prodotto
editoriale ("questa lesson inaugura...", "qui faremo review..."): spiega quale
tipo di giapponese diventa leggibile nel media e perché conta mentre lo si sta
fruendo. La voce deve sembrare quella di un tutor che legge il media insieme
all'utente: naturale, concreta, densa, non da outline.

Una promessa didattica leggera come "In questa lezione..." è ammessa solo se
orienta subito l'attenzione sul testo che l'utente leggerà. Resta vietato il
metadiscorso editoriale su batch, review, fonti, workflow o scelte di curation.>

## Termini chiave

- [<termine-1>](term:<term-id-1>) — <gloss breve>
- [<termine-2>](term:<term-id-2>) — <gloss breve>

## Espressioni ricorrenti

- [<chunk-1>](term:<term-id-3>) — <funzione breve>
- [<formula-1>](term:<term-id-4>) — <funzione breve>

## Pattern grammaticali chiave

- [<pattern-1>](grammar:<grammar-id-1>) — <valore breve>
- [<pattern-2>](grammar:<grammar-id-2>) — <valore breve>

## Etichette da riconoscere

- [<label-o-nome>](term:<term-id-5>) — <ruolo breve nel media>

---

## 1. <Cluster tematico orientato alla scena>

<Organizza il corpo per cluster funzionali, non per ordine alfabetico. Ogni
cluster deve raggruppare parole e pattern che lavorano insieme nella stessa
scena, schermata, carta o porzione di dialogo. Usa riferimenti semantici quando
richiami termini o grammar gia dichiarati.

La sequenza attesa del body e: cluster tematico -> mini-spiegazioni dense in
paragrafi o bullet lunghi -> esempi -> anatomia -> contrasto/gancio quando
servono. Puoi usare sottosezioni A/B/C/D quando una parte grammaticale contiene
sfumature distinte.

Ogni blocco deve chiarire che cosa significa davvero l'elemento giapponese e
che cosa ti fa capire o fare nel media. Quando serve, usa questa sequenza:
forma giapponese -> significato letterale o tecnico -> effetto concreto nel
gioco / nell'interfaccia -> contrasto con la lettura sbagliata piu probabile.
La semplicita deve essere lineare, non vuota: ogni paragrafo deve consegnare
informazione concreta, non solo valutazione. Alterna orientamento, parsing,
conseguenza e contrasto: una buona spiegazione deve cambiare il modo in cui il
lettore riconosce quella forma durante la fruizione reale.>

### <Sottopunto grammaticale o lessicale>

<Per ogni termine o pattern importante, includi almeno tre ancore tra forma
giapponese, scomposizione, valore tecnico, collocazione naturale, funzione nel
media, contrasto, conseguenza pratica. Se usi un gancio mnemonico che non e
etimologia reale, dillo chiaramente. Evita frasi che danno solo un giudizio
("e utile", "e importante", "aiuta a orientarsi") senza mostrare il meccanismo
linguistico che le rende vere.>

:::example_sentence
jp: >-
  <frase giapponese con furigana dove serve>
translation_it: >-
  <traduzione italiana>
:::

#### 🗺️ Anatomia della frase

- `<pezzo-1>` -> <ruolo grammaticale e conseguenza di lettura>
- `<pezzo-2>` -> <valore del verbo, particella, pattern o chunk>

> [!NOTE]
> **⚖️ Contrasto operativo:** <differenza concreta che evita una lettura sbagliata>

> [!NOTE]
> **🧠 Gancio cognitivo:** <trucco di memoria o immagine mentale utile. Se non
> e etimologia reale, dichiaralo come trucco mnemonico, non come origine della
> parola.>

## 2. <Secondo cluster tematico>

<Continua per gruppi funzionali. Per rules text, prompt e keyword esplicita
almeno chi agisce, su che cosa, in quale timing e con quale effetto. Anche qui
il focus primario resta il giapponese: il gioco o il media vanno spiegati come
contesto che ti aiuta a capire meglio la frase, non come fine principale della
spiegazione. Evita formule meta come "qui il punto", "conviene fissare", "cosa
mandare in review", "per questa pagina" o "per questo batch".>

<!--
Vincoli tecnici di authoring. Queste regole NON sono una sezione da copiare nel
corpo della lesson: servono al producer per mantenere output importabile,
reader-friendly e allineato a glossary/review.

Scrivi sempre in italiano naturale e corretto: usa gli accenti giusti (`è`,
`può`, `più`, `già`, `cioè`, `così`, `perché`), non sostituirli con apostrofi o
forme ASCII degradate.

Quando da una lesson emergono candidati a flashcard, ricordati che devono
servire prima di tutto a imparare il giapponese. La priorita e fissare parole
giapponesi importanti e pattern grammaticali importanti: kanji, lessico
riusabile e grammatica. Non proporre card che riassumono soltanto la meccanica
del gioco senza un vero target linguistico. Non promuovere a flashcard il nome
proprio completo di una cosa o entita singola: se serve al contesto, spiegalo
nel textbook e semmai isola i componenti giapponesi riusabili del nome.
Tra piu candidati, privilegia il giapponese piu spendibile possibile anche
fuori dal singolo media: parole come `わざ` hanno piu valore di sigle, acronimi
o keyword troppo verticali da memorizzare solo per quella carta o schermata.
Evita anche card di puro katakana se non c'e un motivo forte di lettura:
vanno bene solo quando il termine e davvero ricorrente, opaco o rilevante nel
corpus, non quando e soltanto facilmente traslitterabile.

Anti-esempi da non usare mai:

- `Tre schermate reali mostrano in modo operativo il flusso di reclamo reward.`
- `In DM25-SD1 il testo Abyss mostra bene una sequenza tipica...`
- `Lo starter deck e una buona base di lettura operativa...`
- `Questo modulo usa tre schermate reali...`
- `Da qui in poi questa pagina non e piu una monografia su una sola carta: diventa l'archivio progressivo delle carte che incontro davvero durante il gioco.`
- `Il punto piu importante non e la keyword offensiva in se, ma il blocco タップ状態でいたら: qui non basta sapere cos'e タップ, bisogna riconoscere lo stato gia presente nel momento del controllo.`

Perche sono sbagliati se restano cosi:

- spiegano la lesson o il materiale scelto invece del giapponese;
- spiegano la pagina invece del giapponese;
- dicono che qualcosa e importante senza aprire la grammatica;
- non mostrano come si legge davvero la frase.

Coppia di revisione:

- Debole: `Il punto piu importante non e la keyword offensiva in se, ma il
  blocco タップ状態でいたら.`
- Corretta: `タップ状態` forma un sintagma nominale, `でいる` dice che la
  creatura resta in quello stato e `〜たら` trasforma quello stato nella
  condizione che fa partire l'effetto.

Forma corretta attesa quando il testo parla di quello stesso chunk:

- `タップ状態` = sintagma nominale, "stato tapped"`
- `でいる` = essere in quello stato
- `〜たら` = se / quando
- `このターンの後に` = dopo questo turno

Puoi usare furigana inline con la sintassi `{{base|reading}}`, per esempio
`{{<kanji>|<reading>}}`. Da ora anche i numeri vanno annotati sempre quando
sono visibili nel reader: `{{4|よん}}`, `{{5000|ごせん}}`,
`{{-3000|マイナスさんぜん}}`. Nei composti misti non includere nel ruby i kana
gia visibili: scrivi `{{受|う}}け{{取|と}}る`, `{{手|て}}{{持|も}}ち`,
`メイン{{枠|わく}}`, non `{{受け取る|うけとる}}`, `{{手持ち|てもち}}`,
`{{メイン枠|めいんわく}}`. Se c'e un composto numerico con soli kanji dopo il
numero, puoi annotare il blocco intero: `{{1枚|いちまい}}`,
`{{4以下|よんいか}}`. Se invece dopo il numero compaiono kana visibili,
annota solo il segmento necessario: `{{2|ふた}}つ`,
`{{4|よっ}}つ{{以上|いじょう}}`. Non scrivere `1{{枚|まい}}`,
`4{{以下|いか}}` o `{{4つ|よっつ}}{{以上|いじょう}}`. Se il numero ha segni,
unita o filtri, annota il chunk non trasparente: `{{-3000|マイナスさんぜん}}`,
`{{2000以下|にせんいか}}`, `{{300|さんびゃく}}ポイント`.

Quando il numero e legato a un contatore, la lettura va verificata e scritta
in forma corretta sul chunk davvero annotato, non ricostruita a intuito: per
esempio `{{1体|いったい}}`, `{{2|ふた}}つ`, `{{2回|にかい}}`,
`{{4枚|よんまい}}`.

Se un riferimento semantico ha un label con kanji, annota anche il label:
`[{{報酬|ほうしゅう}}](term:term-reward)`, non `[報酬](term:term-reward)`.
Vale anche per inline code: `` `{{未解放|みかいほう}}` `` e non `` `未解放` ``.
-->

## Esempi guidati di riepilogo

<Inserisci 2-4 esempi che ricombinano gli elementi principali. Non devono
essere definizioni isolate: devono mostrare come lessico, grammatica e funzione
nel media lavorano insieme.>

Per una frase giapponese con traduzione italiana apribile a toggle, usa:

```md
:::example_sentence
jp: >-
  {{自分|じぶん}}の{{墓地|ぼち}}からクリーチャーを{{1体|いったい}}{{出|だ}}す。
translation_it: >-
  Metti in gioco 1 creatura dal tuo cimitero.
:::
```

Per inserire una schermata o una carta di supporto visivo gia presente nel
bundle, usa:

```md
:::image
src: assets/ui/deck-edit.webp
alt: Schermata di deckbuilding nell'app.
caption: >-
  Qui il label [{{編成|へんせい}}](term:term-formation) indica la schermata di
  deckbuilding.
:::
```

`alt` resta testo semplice: niente furigana, niente link e niente kanji nudi.
`caption` invece e testo visibile nel reader: se citi un termine con kanji,
annotalo con furigana e, se esiste gia una entry glossary / flashcard,
collegalo con il relativo link semantico.

## Nota finale

<Nota didattica breve che collega i cluster e dice come riconoscere quel sistema
nel contesto reale. Niente meta-commenti sul workflow di studio, sulla review o
sulla produzione del contenuto.>

<!--
Il riferimento completo per lo stile delle lesson e:
`docs/llm-kit/general/10-textbook-lesson-style-standard.md`.
Usa la lezione modello
`content/media/pokemon-scarlet-violet/textbook/029-sv-prestudy-l19b-reazioni-e-parlato-scarlet-violet.md`
come esempio di densita, cluster tematici, anatomia della frase e contrasti
operativi.

Usa blocchi :::term o :::grammar solo se devi introdurre una entry nuova non
ancora dichiarata altrove. Se una entry esiste gia, referenzia il suo ID.
Se dichiari una entry nuova che ha gia una sorella editoriale in un altro media,
puoi aggiungere `cross_media_group` come metadata documentativo, ma non serve
per creare la voce globale: l'importer raggruppa gia per superficie
normalizzata. Se lo usi, preferisci uno slug stabile con prefisso del tipo, per
esempio `term-shared-ranked-match`.
Usa :::example_sentence quando vuoi una frase con traduzione italiana
collassabile nel reader.
Se l'asset non esiste ancora, non usare subito :::image: crea prima una voce in
`workflow/image-requests.yaml`.
Quella voce non deve essere una nota vaga: deve fissare posizione nel flow,
immagine scelta, obiettivo visivo e criteri di recupero.
Usa :::image solo se esiste gia un asset reale sotto `assets/`; non inventare
path immagine.
Non inventare campi audio nel testo editoriale: l'audio, se serve, viene
arricchito in seguito dalla pipeline locale con asset e provenance reali.
Se aggiungi campi descrittivi YAML nel frontmatter, come `summary`, usa `>-`.
Una spiegazione debole del tipo "X e utile da fissare" non basta: scrivi
"X vuol dire Y; qui ti segnala Z".
- Evita nel testo finale frasi sul processo editoriale o di studio come
  "questa lesson", "qui facciamo review", "per questo test", "conviene mettere
  in review" o "verifichiamo la fonte": se una fonte serve, usala solo per
  sostenere una spiegazione sul testo o sulla regola.
- Anti-esempi aggiuntivi da evitare sempre:
  `Da qui in poi questa pagina non e piu una monografia...`
  `Il punto piu importante non e la keyword offensiva in se...`
  Se un testo somiglia a questi esempi, riscrivilo come analisi di grammatica,
  timing, condizione, target o funzione nel rules text.
-->
