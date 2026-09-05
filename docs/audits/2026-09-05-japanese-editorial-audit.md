# Audit del giapponese — 5 settembre 2026

> **Aggiornamento dell’implementazione:** le 131 proposte sono state applicate,
> oltre alle cinque correzioni iniziali. Sono stati disambiguati i fronti Migaku
> e adottati i nomi giapponesi in Pokémon. L’importazione integrale del corso
> Migaku resta distinta dalle correzioni del bundle locale e richiede un export
> fornito dall’utente. [Esito e verifiche](2026-09-05-japanese-editorial-implementation.md).

Il materiale contiene problemi reali di significato, grammatica e naturalezza. La priorità maggiore è Migaku: il bundle locale è una rielaborazione didattica, mentre la richiesta era importare fedelmente le lezioni e le flashcard non ancora fatte. Seguono alcune definizioni errate di Duel Masters e le trascrizioni e traduzioni di Pokémon.

Il registro contiene **136 voci operative: 5 corrette in Migaku e 131 proposte**. Sono 54 voci P1 e 82 P2; non sono 136 flashcard necessariamente distinte, perché uno stesso problema può ricomparire nel textbook o nel glossario. P1 significa che la voce può insegnare un significato o una regola sbagliati, oppure contiene testo danneggiato. P2 riguarda chiarezza, naturalezza o utilità. Nei dialoghi in cui manca la scena, la proposta è esplicitamente subordinata alla ricostruzione del contesto.

Il [registro completo](</Users/abelli/Codex/Japanese Custom Study/docs/audits/2026-09-05-japanese-editorial-findings.md>) riporta testo attuale, proposta, motivo, ID stabile e posizione nel file. L’[inventario con i risultati strutturati](</Users/abelli/Codex/Japanese Custom Study/docs/audits/2026-09-05-japanese-editorial-audit.json>) permette di riprendere il lavoro senza rifare l’audit.

## Copertura effettiva

La fonte editoriale è `content/media/**`, letta con il parser canonico e validata. Il database non è stato usato per decidere quali contenuti esistano o quale formulazione sia corretta.

| Media                    | Lezioni | Flashcard | Voci lessicali/grammaticali | Esempi nel textbook |
| ------------------------ | ------: | --------: | --------------------------: | ------------------: |
| Crystal Hunters          |      46 |       537 |                         545 |                 664 |
| Duel Masters             |      76 |       428 |                         384 |                 516 |
| Gundam Arsenal Base      |       4 |        50 |                          70 |                  33 |
| Kaishi                   |      41 |       811 |                         811 |                   0 |
| Migaku Grammar           |     386 |       304 |                         304 |                 386 |
| Pokémon Scarlet / Violet |      98 |     1.566 |                       1.651 |               1.251 |
| TCG generale             |       2 |        30 |                          35 |                  30 |
| Web giapponese           |      11 |        81 |                          83 |                  85 |
| **Totale**               | **664** | **3.807** |                   **3.883** |           **2.965** |

Sono stati letti tutti i fronti, retro, esempi giapponesi e traduzioni delle 3.807 card. Sono stati letti anche gli esempi aggiuntivi dei textbook, deduplicando quelli già presenti nelle card, tutte le 3.349 coppie distinte forma/lettura delle voci che hanno una lettura esplicita, le voci senza card e le note grammaticali. Un’ulteriore estrazione ha permesso di controllare 1.157 frammenti giapponesi nel testo corrente che non coincidevano con gli esempi e le note già esaminati.

Il controllo dei furigana ha inventariato 3.095 coppie base/lettura su 2.590 basi e verificato le 165 differenze rispetto alle letture canoniche corrispondenti. Molte sono normali letture diverse dello stesso kanji, rendaku, parti di una parola o letture speciali dei nomi TCG; non sono automaticamente errori.

Fuori dai bundle sono stati letti i 60 esempi di Katakana Speed, il catalogo statico e le 160 voci del suo word bank dei media, le coppie forma/lettura del piccolo corpus Tofugu e le stringhe giapponesi dell’interfaccia. Le pseudoparole dei drill sono intenzionali. Il grande corpus di pitch accent contiene soprattutto suoni e metadati: questo audit non comprende l’ascolto sistematico delle registrazioni né una certificazione di tutti gli accenti. Non è stato eseguito un audit grafico su tutti i dispositivi; per la chiarezza dei fronti è stato controllato anche quando l’interfaccia mostra l’esempio durante la review.

Il lint editoriale iniziale ha prodotto 998 avvisi, prevalentemente su stile e testo didattico. **Non sono 998 errori di giapponese.** La valutazione linguistica di questo rapporto è distinta dal lint. Non sono state trattate come errori le citazioni volutamente ruvide, le varianti ammesse o le frasi etichettate esplicitamente come controesempi. La lingua inglese del deck Kaishi è una scelta configurata del media, non un difetto d’importazione.

## Migaku: l’importazione fedele non è stata realizzata

Il confronto è stato fatto nella [collezione Migaku autenticata](https://study.migaku.com/collection/course/20463397959936), usando lo stato **New** visibile durante l’audit come definizione operativa di “non ancora fatto”. I numeri descrivono quella fotografia, non un collegamento permanente tra lo stato Migaku e lo stato locale.

| Elemento                     | Migaku originale                          | Bundle locale                                        |
| ---------------------------- | ----------------------------------------- | ---------------------------------------------------- |
| Intero corso                 | 399 lezioni, 1.984 card                   | 386 lezioni, 304 card                                |
| Lezioni New                  | 153                                       | 141 hanno una corrispondenza nella source map; 12 no |
| Card New                     | 746: 663 di vocabolario e 83 di frase     | 109 card concept nelle 141 lezioni corrispondenti    |
| Esempi nelle 153 lezioni New | 694 blocchi, inclusi frammenti e dialoghi | Un esempio per lezione locale                        |

Per le 141 lezioni corrispondenti, soltanto **1 esempio locale** compare anche nel testo della rispettiva lezione originale. Nessuno dei 141 esempi locali coincide con una delle 746 frasi delle card New, dopo la normalizzazione di spazi, punteggiatura e caratteri a larghezza diversa. I 109 esempi delle card locali interessate coincidono con quelli dei rispettivi textbook: anche per essi le corrispondenze con le card originali sono **zero**. Il confronto si riferisce al contenuto prima delle correzioni di questa sessione.

Questo dato, insieme al diverso tipo di card e alle spiegazioni riscritte, conferma la mancata fedeltà dell’importazione. Non significa semplicemente che manchino alcune traduzioni. Il bundle trasforma lezioni e card originali in riassunti grammaticali e nuovi esempi.

Le 12 lezioni New senza corrispondenza sono **1.1–1.5**, **3.14**, **5.11**, **5.23**, **7.22**, **8.8**, **11.2** e **11.6**. Le prime cinque sono introduttive; le altre riguardano stems, usi di で e もう, e pronomi personali. La lezione **5.25 su ウチ／ソト esiste localmente**, sebbene riscritta. La pagina 2.2 è un’ulteriore assenza nell’inventario generale, ma non risultava New.

Il confronto copre l’intero inventario New e le frasi mostrate nelle sue card; non è una revisione integrale delle traduzioni di tutte le 1.984 card originali. I dettagli completi delle card originali sono stati aperti a campione e per i punti grammaticali rilevanti. La revisione completa dei 3.807 esempi e traduzioni dichiarata sopra riguarda il sito locale.

### Le cinque correzioni applicate

| Lezione locale                  | Problema                                                                | Correzione                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 054 — より                      | Il termine di paragone diventa l’elemento “meno favorito”               | Definizione neutra del termine di paragone; distinzione tra confronto e preferenza                |
| 197 — する                      | Costo, durata e tempo necessario vengono trattati come lo stesso uso    | Card focalizzata sul prezzo; distinzione da tempo trascorso e かかる; fronte `する（prezzo）`     |
| 310 — transitivi/intransitivi   | Intransitivo definito solo come cambiamento autonomo                    | Definizione basata sulla presenza dell’oggetto diretto e sull’azione, evento o stato del soggetto |
| 375 — ようと                    | L’esempio insegnava soprattutto ようとする                              | Esempio didattico con volitivo + と + azione; costruzioni collegate distinte nelle note           |
| 381 — forma recettiva onorifica | Il fronte `受け身` chiedeva una risposta sull’onorifico senza indicarlo | Fronte `受け身（uso onorifico）`                                                                  |

Sono correzioni circoscritte alla rielaborazione esistente, non il ripristino dell’intero corso. Gli ID sono rimasti stabili. La card 375 ora usa `ケーキを取ろうと、手を出した。` con «Ho allungato la mano per prendere la torta»: il gesto esprime un obiettivo e lascia aperto il risultato.

### Cosa resta da fare per Migaku

Ripristinerei le lezioni e le card originali a partire da un’esportazione fornita dall’utente, mantenendo la distinzione tra vocabolario e frasi e verificando separatamente le associazioni allo stato di studio. Il riordino deve preservare i progressi locali e gli ID esistenti ove possibile; il nuovo inventario non va ottenuto semplicemente cambiando i testi delle vecchie card concept.

L’originale richiede comunque alcune rettifiche dichiarate: la lezione 7.2 riporta una formazione errata con `静かだものだ`, ripresa in modo contraddittorio dalle note locali. La costruzione regolare con aggettivo in な usa `静かなものだ`. Il materiale della [Japan Foundation su もの](https://www.jpf.go.jp/j/project/japanese/teach/tsushin/grammar/201206.html) chiarisce i diversi usi che vanno tenuti distinti.

Anche la restrizione di ぜひ sulle intenzioni è troppo assoluta: una risposta entusiasta come `ぜひ行きます` è naturale. Questo richiede una nota editoriale, perché la fonte stessa contiene la restrizione; il [大辞泉, voce 是非](https://kotobank.jp/word/%E6%98%AF%E9%9D%9E-548716) include il valore di forte volontà di realizzare un’azione. Nel registro compare inoltre la nota locale poco chiara su `誰もいる`.

Il ripristino integrale rimane aperto: non posso ricopiare l’intero corso protetto a partire dal sito. Un’esportazione fornita direttamente dall’utente permette di lavorare sul materiale allegato. Il rapporto non presenta le cinque correzioni come un’importazione completa riuscita.

## Correzioni più importanti negli altri media

### Duel Masters

Correggerei per prime quattro definizioni che insegnano regole diverse da quelle ufficiali:

- **ブロッカー:** il divieto di attaccare il giocatore è una restrizione separata, non una conseguenza universale di Blocker. La [carta ufficiale con il testo di Blocker](https://dm.takaratomy.co.jp/card/detail/?id=dm26sd1-m004) distingue l’abilità dalle altre righe.
- **シンカライズ:** il Tamaseed può fungere da base per un’evoluzione; la spiegazione locale lo presenta anche come destinazione evolutiva. [Q&A ufficiale](https://dm.takaratomy.co.jp/rule/qa/41075/).
- **アビスラッシュ:** una spiegazione lo confonde con lo scarto di due carte per sostituire un’uscita, un’altra con il recupero di una creatura. L’abilità effettiva riguarda evocazione dal cimitero, possibilità di attaccare il giocatore e collocazione in fondo al mazzo a fine turno. La [carta Jashin](https://dm.takaratomy.co.jp/card/detail/?id=dm25sd1-002) mostra anche perché i due effetti siano stati confusi; il [Q&A su Abyss Rush](https://dm.takaratomy.co.jp/rule/qa/42084/) ne conferma il funzionamento.
- **シビルカウント:** si contano le creature e i Tamaseed della civiltà richiesta nella zona di battaglia; non si sommano i loro costi. [Q&A ufficiale](https://dm.takaratomy.co.jp/rule/qa/41983/).

Aggiungerei la correzione del furigana **順序: しゅんじょ → じゅんじょ**, dei segnaposto rimasti negli esempi (`未～解放`, `次の～のうち`) e delle traduzioni che cambiano soggetto o quantità. Le stesse definizioni errate compaiono in più superfici: vanno corrette insieme in card, glossario e textbook.

### Pokémon Scarlet / Violet

È il media con più interventi proposti: **59 voci**. Qui emergono due famiglie di problemi diverse.

Gli esempi costruiti per il prestudio talvolta uniscono termini senza una situazione plausibile. Per esempio, la precisione bassa di una mossa viene collegata alle impostazioni, gli acquisti in blocco a una ricarica più veloce e gli ingredienti del sandwich all’app fotocamera. Riscriverei queste frasi attorno a un’azione concreta, mantenendo un solo obiettivo didattico.

Nel materiale ricavato dai dialoghi ci sono battute fuse e nomi del giocatore persi. Frammenti come `ではさんに問おう` non diventano buoni esempi togliendo soltanto gli spazi: bisogna ripristinare il nome o un segnaposto, separare i turni e poi rivedere la traduzione. Alcune traduzioni attribuiscono al giocatore un’azione del Pokémon, trasformano una voce riferita in un fatto detto direttamente o cambiano una formula d’inizio sfida in un congedo.

Correzioni concrete prioritarie:

| Attuale                                | Proposta                                              | Motivo                                                                                |
| -------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `二つ名パワー` letto につなパワー      | ふたつなパワー                                        | Lettura errata; [大辞泉](https://kotobank.jp/word/%E4%BA%8C%E3%81%A4%E5%90%8D-618789) |
| 以上 spiegato soltanto come “più di”   | “almeno / pari o superiore” quando segue una quantità | Il limite è incluso                                                                   |
| `学校で謎があります`                   | `学校には謎があります`                                | Luogo di esistenza con に                                                             |
| Classifica espressa senza 位           | `順位は3位です`                                       | Serve il contatore della posizione                                                    |
| `この先に落下があります`               | `この先は落下の危険があります`                        | Collocazione naturale per un avviso                                                   |
| 傷つく reso come “ferire i sentimenti” | “rimanere ferito / sentirsi ferito”                   | Distinguere l’intransitivo da 傷つける                                                |

La spiegazione di 小生 merita una rettifica di registro, conservando la voce di Hassaku: non è un pronome universalmente deferente per parlare con un superiore. Il [大辞泉](https://kotobank.jp/word/%E5%B0%8F%E7%94%9F-532256) ne precisa l’uso tradizionale verso pari o inferiori. La card con il retro troncato `membro del gruppo/team (es.` richiede invece una semplice riparazione del testo.

### Kaishi, Crystal Hunters e gli altri media

In **Kaishi** correggerei soprattutto l’inglese: `言い訳` non va memorizzato come “apology”; `偉い` non equivale a “famous”; `年齢は問いません` nel contesto delle candidature significa che non ci sono requisiti d’età, non che l’età non verrà chiesta. Seguono diverse traduzioni inglesi poco idiomatiche. Le normalizzazioni di grafia, come つまづく → つまずく, hanno una priorità inferiore.

In **Crystal Hunters** renderei più naturali alcuni esempi isolati e correggerei gli slittamenti di tempo e significato: `救う` non coincide con «ho salvato», mentre il significato di `ではありません` non deve includere il passato. Le battute autentiche dei personaggi vanno mantenute con il loro tono; per le frasi didattiche autonome, esempi come `この弓が気に入っている` chiariscono meglio uno stato attuale rispetto a `弓が気に入る`.

In **Web giapponese** correggerei `攻撃を耐える` in `攻撃に耐える`, la frase che “spiega l’articolo” invece del suo contenuto e varie collocazioni o traduzioni poco naturali. La [voce 耐える del 大辞泉](https://kotobank.jp/word/%E8%80%90%E3%81%88%E3%82%8B-559002) aiuta anche a distinguere questo uso da altri verbi vicini.

**Gundam** richiede interventi più circoscritti su frasi costruite intorno al rank e al costo delle unità. **TCG generale** presenta soprattutto piccoli miglioramenti dell’italiano. In **Katakana Speed** riscriverei alcuni esempi metalinguistici, tra cui `注意が上がる`, e chiarirei le glosse di ヴォーカル e ヒンドゥー. Il registro documenta tutti gli interventi proposti anche per questi media.

## Come renderei più chiare le flashcard

Il problema principale non è la lunghezza del retro: nessuno supera 160 caratteri nel testo normalizzato. È spesso l’ambiguità della domanda. In Migaku, prima dell’audit, **121 card appartenevano a 33 gruppi con lo stesso fronte e retro diversi**. Un fronte `う動詞` o `する` non dice quale uso o coniugazione ricordare.

Durante la review normale l’esempio appare dopo aver girato la carta. Non può quindi disambiguare la domanda iniziale. Modificherei i fronti per indicare precisamente il compito: per esempio «う動詞 — forma potenziale», «する — prezzo», oppure una frase con il punto grammaticale da riconoscere. La soluzione va scelta per ogni tipo di card, evitando di mostrare già la risposta.

Per gli esempi manterrei una frase breve con una scena credibile, oppure un mini dialogo con A/B quando il cambio di parlante è indispensabile. Sul retro metterei il significato richiesto; nelle note, registro, eccezioni e spiegazione del contesto. Per le citazioni autentiche conserverei il testo originale, separando chiaramente la traduzione dalla nota interpretativa.

Non proporrei una riscrittura indiscriminata di tutto il corpus: le varianti ammesse, il gergo dei giochi e le voci dei personaggi non vanno uniformati a un unico giapponese scolastico.

## Ordine di intervento proposto

1. Completare il recupero dell’inventario originale Migaku quando è disponibile un’esportazione fornita dall’utente; correggere con note esplicite gli errori già presenti nella fonte.
2. Correggere le definizioni Duel Masters, le letture sbagliate, i limiti inclusivi e le traduzioni che cambiano il significato.
3. Ricostruire i dialoghi Pokémon danneggiati e verificare le traduzioni con i parlanti visibili.
4. Riscrivere gli esempi artificiali, rendere univoci i fronti e rifinire l’italiano o l’inglese.

Alla conclusione della fase iniziale erano state applicate soltanto le cinque correzioni Migaku. La successiva implementazione autorizzata è documentata nel rapporto collegato in apertura.

## Verifica delle modifiche

La validazione iniziale dell’intero corpus è passata: **8 bundle validi, 1.244 file**. Per le modifiche Migaku sono stati usati i workflow canonici con scope minimo, limitati alle cinque lezioni interessate. Entrambi i controlli sono passati con **zero avvisi editoriali**; entrambi gli import e le invalidazioni della cache sono riusciti.

- Lezioni 310, 375 e 381: import `content_import_1d9e6dc2-4638-4159-ab20-e8fffb43a6b6`, 5 file modificati.
- Lezioni 054 e 197: import `content_import_746a0225-3273-4942-94f5-22fda1ad38b6`, 4 file modificati.

Il comando usato per ciascuno scope è `./scripts/with-node.sh pnpm content:lesson-workflow-check -- --media-slug migaku-grammar --lesson-slug … --import`, ripetendo `--lesson-slug` per le lezioni del gruppo. I risultati sono salvati anche nell’inventario JSON del rapporto.

Non sono cambiati codice applicativo, routing, schema DB o workflow. Per questo audit editoriale e documentale non sono stati eseguiti i gate applicativi completi. Non sono state modificate le aree protette `workflow/**` né gli asset di pronuncia.
