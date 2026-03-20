---
id: cards-duel-masters-dm25-tcg-core-basics
media_id: media-duel-masters-dm25
slug: tcg-core
title: TCG Core - Termini e pattern base
order: 10
segment_ref: tcg-core
---

:::term
id: term-creature
lemma: クリーチャー
reading: くりーちゃー
romaji: kuriichaa
meaning_it: creatura
pos: noun
aliases: [クリーチャー, kuriichaa]
notes_it: >-
  È il tipo di carta base di Duel Masters. Le creature entrano nel
  バトルゾーン, possono attaccare, possono essere distrutte e spesso portano
  keyword o effetti continui. Compare sia da sola sia dentro composti come
  `{{進化|しんか}}クリーチャー`.
level_hint: custom
:::

:::term
id: term-spell
lemma: 呪文
reading: じゅもん
romaji: jumon
meaning_it: magia / spell
pos: noun
aliases: [呪文, じゅもん, jumon]
notes_it: >-
  Indica una magia. Di solito la giochi, risolvi l'effetto e poi la carta va in
  {{墓地|ぼち}}. Nel rules text {{呪文|じゅもん}} indica quindi una risoluzione
  immediata, non una presenza stabile sul campo.
level_hint: n4
:::

:::term
id: term-tamaseed
lemma: タマシード
reading: たましーど
romaji: tamashiido
meaning_it: tipo di carta Tamaseed
pos: noun
aliases: [タマシード, tamashiido]
notes_it: >-
  È un tipo di carta che resta nel バトルゾーン ma non si legge come una normale
  creatura. Conta soprattutto perché può diventare base per
  {{進化|しんか}} o per シンカライズ. Quando compare, va verificato se la carta
  è trattata come supporto o come parte di una sovrapposizione.
level_hint: custom
:::

:::term
id: term-blocker
lemma: ブロッカー
reading: ぶろっかー
romaji: burokkaa
meaning_it: bloccante
pos: keyword
aliases: [ブロッカー, burokkaa]
notes_it: >-
  È una keyword difensiva. Ti dice che quella creatura può fermare un attacco
  avversario. Segnala quindi una funzione di protezione del
  campo o degli scudi.
level_hint: custom
:::

:::term
id: term-evolution
lemma: 進化
reading: しんか
romaji: shinka
meaning_it: evoluzione
pos: verbal-noun
aliases: [進化, しんか, shinka]
notes_it: >-
  È la keyword dell'evoluzione: la carta non entra da sola nel campo, ma si
  mette sopra una base già presente. Questo cambia sia il significato pratico
  della giocata sia la lettura del testo, perché verbi come {{重|かさ}}ねる e i
  filtri sul tipo di carta smettono di essere dettagli lessicali e diventano la
  condizione reale dell'azione.
level_hint: custom
:::

:::term
id: term-invasion
lemma: 侵略
reading: しんりゃく
romaji: shinryaku
meaning_it: invasione
pos: verbal-noun
aliases: [侵略, しんりゃく, shinryaku]
notes_it: >-
  È una keyword offensiva tipica dell'area SD2. Di solito permette di mettere
  una creatura dalla {{手札|てふだ}} sopra un attaccante durante l'attacco, se la
  condizione è giusta. Quando la vedi, cerca subito chi sta attaccando e quale
  tipo di carta è richiesto.
level_hint: custom
:::

:::term
id: term-shinkarize
lemma: シンカライズ
reading: しんからいず
romaji: shinkaraizu
meaning_it: effetto che permette di evolvere sopra un Tamaseed
pos: keyword
aliases: [シンカライズ, shinkaraizu]
notes_it: >-
  È la keyword che collega i タマシード alle carte di evoluzione. In pratica ti
  sta dicendo che il Tamaseed non va letto come pezzo isolato: può funzionare
  da base su cui sovrapporre un'altra carta. Se trovi シンカライズ, la
  risoluzione include una meccanica di evoluzione appoggiata su un supporto già
  in campo.
level_hint: custom
:::

:::term
id: term-abyss
lemma: アビス
reading: あびす
romaji: abisu
meaning_it: Abyss / gruppo di carte Abyss
pos: noun
aliases: [アビス, abisu]
notes_it: >-
  È un'etichetta di gruppo che in SD1 funziona come filtro operativo. In frasi
  come `コスト{{4以下|よんいか}}のアビス` non sta aggiungendo colore narrativo: sta
  limitando quali carte possono essere cercate, recuperate o messe in campo.
  Quando la vedi, leggila come nome di una famiglia con requisiti e sinergie
  condivisi.
level_hint: custom
:::

:::term
id: term-command
lemma: コマンド
reading: こまんど
romaji: komando
meaning_it: Command / famiglia di creature
pos: noun
aliases: [コマンド, komando]
notes_it: >-
  È una famiglia di creature molto rilevante in SD2. Di solito compare dentro
  condizioni come `{{火|ひ}}のコマンド` e ti dice quale attaccante o quale base è
  valida per attivare un effetto. Quando la incontri, trattala come un filtro di
  appartenenza.
level_hint: custom
:::

:::term
id: term-civilization
lemma: 文明
reading: ぶんめい
romaji: bunmei
meaning_it: civiltà / civilization
pos: noun
aliases: [文明, ぶんめい, bunmei]
notes_it: >-
  Indica il colore della carta, per esempio
  {{火|ひ}}・{{水|みず}}・{{自然|しぜん}}・{{光|ひかり}}・{{闇|やみ}}. La
  civiltà conta sia nell'anatomia della carta sia in molte condizioni del testo
  effetto. Se leggi `{{火|ひ}}のコマンド`, la prima parte è proprio la civiltà.
level_hint: n4
:::

:::term
id: term-cost
cross_media_group: term-shared-cost-resource
lemma: コスト
reading: こすと
romaji: kosuto
meaning_it: costo
pos: noun
aliases: [コスト, kosuto]
notes_it: >-
  È il numero che ti dice quanta mana serve per giocare la carta. Nel testo
  effetto compare continuamente anche come filtro, per esempio
  `コスト{{4以下|よんいか}}`. Quando compare, va distinto il costo da pagare dal
  limite di costo della carta bersaglio.
level_hint: custom
:::

:::term
id: term-harau
lemma: 払う
reading: はらう
romaji: harau
meaning_it: pagare
pos: godan-verb
aliases: [払う, はらう, harau]
notes_it: >-
  Nei rules text di Duel Masters compare soprattutto in blocchi come
  `コストを{{払|はら}}う` o `コストを{{払|はら}}わずに`. Non parla di soldi:
  ti dice se devi spendere mana oppure se l'effetto ti permette di saltare quel
  pagamento.
level_hint: n4
:::

:::term
id: term-power
lemma: パワー
reading: ぱわー
romaji: pawaa
meaning_it: potere / power
pos: noun
aliases: [パワー, pawaa]
notes_it: >-
  È il valore di forza di una creatura. Serve sia a descrivere la carta sia a
  filtrare bersagli, per esempio in frasi come `パワー{{2000以下|にせんいか}}`. Se appare
  nel testo, quasi sempre decide cosa può essere colpito o sopravvivere.
level_hint: custom
:::

:::term
id: term-goukei
lemma: 合計
reading: ごうけい
romaji: goukei
meaning_it: totale / somma complessiva
pos: noun
aliases: [合計, ごうけい, goukei]
notes_it: >-
  Indica il conteggio totale combinato di più elementi. In Duel Masters compare
  spesso in filtri come `{{合計|ごうけい}}{{4|よっ}}つ{{以上|いじょう}}`: il
  conteggio somma tutto nello stesso controllo, non in categorie separate.
  Insieme a `または`, le due parti entrano nello stesso totale.
level_hint: n4
:::

:::term
id: term-race
lemma: 種族
reading: しゅぞく
romaji: shuzoku
meaning_it: tribù / race
pos: noun
aliases: [種族, しゅぞく, shuzoku]
notes_it: >-
  Indica la linea di appartenenza della carta, per esempio `アビスロイヤル` o
  `ソニック・コマンド`. Non è un dettaglio decorativo: molte carte controllano
  proprio la {{種族|しゅぞく}} per decidere se un effetto si applica.
level_hint: n4
:::

:::term
id: term-battle-zone
lemma: バトルゾーン
reading: ばとるぞーん
romaji: batoruzoon
meaning_it: battle zone / campo
pos: noun
aliases: [バトルゾーン, batoruzoon]
notes_it: >-
  È il campo principale del gioco. Qui entrano creature e molti Tamaseed, qui
  avvengono attacchi, distruzioni e sovrapposizioni. Se una carta `{{出|で}}る`,
  di solito sta entrando proprio nel バトルゾーン.
level_hint: custom
:::

:::term
id: term-mana-zone
lemma: マナゾーン
reading: まなぞーん
romaji: manazoon
meaning_it: mana zone
pos: noun
aliases: [マナゾーン, manazoon]
notes_it: >-
  È la zona delle risorse con cui paghi il costo delle carte. Quando una carta
  parla di コスト, questa è la zona di riferimento. Nel testo effetto
  può comparire anche come luogo da cui spostare o controllare carte.
level_hint: custom
:::

:::term
id: term-shield-zone
lemma: シールドゾーン
reading: しーるどぞーん
romaji: shiirudozoon
meaning_it: shield zone
pos: noun
aliases: [シールドゾーン, shiirudozoon]
notes_it: >-
  È la zona dei 5 scudi iniziali. Conta perché gli scudi sono il bersaglio
  principale degli attacchi e perché da qui si attivano spesso carte con
  S・トリガー. Se leggi シールド, la lettura operativa è difesa e rottura degli
  scudi.
level_hint: custom
:::

:::term
id: term-deck
lemma: 山札
reading: やまふだ
romaji: yamafuda
meaning_it: mazzo / deck
pos: noun
aliases: [山札, やまふだ, yamafuda]
notes_it: >-
  È il mazzo di gioco. In Duel Masters compare molto spesso in frasi come
  `{{山札|やまふだ}}の{{上|うえ}}からX{{枚|まい}}` perché molte carte fanno
  pescare, mandano carte al cimitero o controllano la cima del mazzo. La lettura
  chiave è {{山札|やまふだ}}.
level_hint: n4
:::

:::term
id: term-hand
lemma: 手札
reading: てふだ
romaji: tefuda
meaning_it: mano / hand
pos: noun
aliases: [手札, てふだ, tefuda]
notes_it: >-
  È la mano del giocatore. Nel testo delle carte compare spesso in azioni di
  scarto, rivelazione, scelta o ingresso in gioco dalla mano. La lettura chiave
  è {{手札|てふだ}}.
level_hint: n4
:::

:::term
id: term-graveyard
lemma: 墓地
reading: ぼち
romaji: bochi
meaning_it: cimitero / graveyard
pos: noun
aliases: [墓地, ぼち, bochi]
notes_it: >-
  È il cimitero del gioco. Qui finiscono spesso carte usate, distrutte o
  scartate, ma da qui molte carte possono anche essere recuperate o rimesse in
  campo. In SD1 è una zona centrale: quando leggi {{墓地|ぼち}}, va verificato se
  l'effetto manda carte lì oppure le recupera da lì.
level_hint: n4
:::

:::term
id: term-self
lemma: 自分
reading: じぶん
romaji: jibun
meaning_it: se stessi / tu
pos: noun
aliases: [自分, じぶん, jibun]
notes_it: >-
  Nel testo delle carte significa quasi sempre "tu" o "il giocatore che
  controlla questo effetto". Quando compare, l'azione va letta dal lato del
  controllore.
level_hint: n5
:::

:::term
id: term-opponent
lemma: 相手
reading: あいて
romaji: aite
meaning_it: avversario / opponent
pos: noun
aliases: [相手, あいて, aite]
notes_it: >-
  Significa "avversario". Ti dice che l'effetto riguarda l'altro giocatore o le
  sue carte. È una delle parole più importanti da riconoscere subito, perché
  cambia immediatamente il bersaglio dell'azione.
level_hint: n5
:::

:::term
id: term-effect
lemma: 効果
reading: こうか
romaji: kouka
meaning_it: effetto
pos: noun
aliases: [効果, こうか, kouka]
notes_it: >-
  È una delle parole più importanti del rules text. Non indica la carta in sé,
  ma ciò che il testo fa davvero: pescare, distruggere, impedire o modificare
  uno stato. In frasi come `この{{効果|こうか}}` o `{{効果|こうか}}を{{使|つか}}う`,
  la carta sta richiamando il blocco di testo che produce il risultato reale.
level_hint: n4
:::

:::term
id: term-summon
lemma: 召喚
reading: しょうかん
romaji: shoukan
meaning_it: evocazione / summon
pos: verbal-noun
aliases: [召喚, しょうかん, shoukan]
notes_it: >-
  Indica il normale atto di giocare una creatura pagando il suo costo. La
  distinzione conta perché molte carte separano l'ingresso regolare
  dall'ingresso speciale. Se leggi `{{召喚|しょうかん}}{{以外|いがい}}`, sai già che
  il testo non parla di una giocata standard ma di un modo alternativo di far
  entrare la carta.
level_hint: custom
:::

:::term
id: term-attack
lemma: 攻撃
reading: こうげき
romaji: kougeki
meaning_it: attacco / attack
pos: verbal-noun
aliases: [攻撃, こうげき, kougeki]
notes_it: >-
  Indica l'attacco. Compare spesso in trigger come
  `{{攻撃|こうげき}}する{{時|とき}}` e in condizioni che si attivano proprio mentre
  una creatura sta attaccando. Se vedi {{攻撃|こうげき}}, il riferimento è il
  timing di combattimento.
level_hint: n4
:::

:::term
id: term-destroy
lemma: 破壊
reading: はかい
romaji: hakai
meaning_it: distruzione / destroy
pos: verbal-noun
aliases: [破壊, はかい, hakai]
notes_it: >-
  Vuol dire "distruggere". Nel gioco indica un modo preciso in cui una carta
  lascia il campo, ma non coincide con tutti i casi di uscita. La distinzione
  da {{離|はな}}れる conta proprio qui: {{破壊|はかい}} parla di distruzione,
  {{離|はな}}れる parla di qualunque abbandono della zona, anche senza
  distruzione.
level_hint: custom
:::

:::term
id: term-break
lemma: ブレイク
reading: ぶれいく
romaji: bureiku
meaning_it: rompere gli scudi / break
pos: verbal-noun
aliases: [ブレイク, ぶれいく, bureiku]
notes_it: >-
  In Duel Masters si usa soprattutto per gli scudi. Se una carta "breaka", sta
  rompendo gli scudi dell'avversario, non le sue creature. È quindi un verbo da
  collegare subito alla condizione di vittoria.
level_hint: custom
:::

:::term
id: term-tap
lemma: タップ
reading: たっぷ
romaji: tappu
meaning_it: tappare / mettere tapped
pos: verbal-noun
aliases: [タップ, tappu]
notes_it: >-
  Significa mettere una carta in stato tappato. Nel linguaggio delle carte è
  una delle azioni più frequenti, perché riguarda attacco, blocco e molti
  effetti di controllo del campo.
level_hint: custom
:::

:::term
id: term-untap
lemma: アンタップ
reading: あんたっぷ
romaji: antappu
meaning_it: stappare / untap
pos: verbal-noun
aliases: [アンタップ, antappu]
notes_it: >-
  È l'azione opposta di タップ. Quando compare, di solito ti sta dicendo che una
  carta torna disponibile per attaccare, bloccare o restare attiva sul campo.
level_hint: custom
:::

:::term
id: term-kasaneru
lemma: 重ねる
reading: かさねる
romaji: kasaneru
meaning_it: sovrapporre / mettere sopra
pos: ichidan-verb
aliases: [重ねる, かさねる, kasaneru]
notes_it: >-
  Vuol dire mettere una carta sopra un'altra. È un verbo chiave per leggere
  bene {{進化|しんか}}, {{侵略|しんりゃく}} e in generale tutte le meccaniche di
  sovrapposizione. Quando lo incontri, immagina proprio una carta che si appoggia
  sopra una base.
level_hint: custom
:::

:::term
id: term-deru
lemma: 出る
reading: でる
romaji: deru
meaning_it: uscire / entrare in gioco
pos: ichidan-verb
aliases: [出る, でる, deru]
notes_it: >-
  È il verbo intransitivo di ingresso. La carta "entra" o "appare" nel campo.
  Nelle carte compare spesso in trigger come
  `このクリーチャーが{{出|で}}た{{時|とき}}`. Qui il trigger è sull'ingresso della
  carta, senza indicare chi la mette.
level_hint: n5
:::

:::term
id: term-dasu
lemma: 出す
reading: だす
romaji: dasu
meaning_it: far uscire / mettere in gioco
pos: godan-verb
aliases: [出す, だす, dasu]
notes_it: >-
  È il verbo transitivo di ingresso. Qualcuno fa entrare qualcosa in gioco.
  Compare spesso in frasi come `{{墓地|ぼち}}から{{出|だ}}す` o
  `{{手札|てふだ}}から{{出|だ}}す`. La differenza rispetto a {{出|で}}る è proprio
  questa: qui l'effetto muove attivamente una carta.
level_hint: n5
:::

:::term
id: term-oku
lemma: 置く
reading: おく
romaji: oku
meaning_it: mettere / porre
pos: godan-verb
aliases: [置く, おく, oku]
notes_it: >-
  È un verbo molto neutro ma molto frequente. Può voler dire mettere una carta
  nel cimitero, in fondo al mazzo, sopra un'altra carta o in un'altra zona. Se
  trovi {{置|お}}く, guarda sempre bene qual è la destinazione.
level_hint: n5
:::

:::term
id: term-add
lemma: 加える
reading: くわえる
romaji: kuwaeru
meaning_it: aggiungere / mettere in mano
pos: godan-verb
aliases: [加える, くわえる, kuwaeru]
notes_it: >-
  Nel rules text è un verbo di spostamento, non un "aggiungere" generico. In
  frasi come
  `{{山札|やまふだ}}から{{手札|てふだ}}に{{加|くわ}}える` o
  `シールドゾーンから{{手札|てふだ}}に{{加|くわ}}える`, il punto pratico è che
  la carta entra davvero nella tua mano.
level_hint: n5
:::

:::term
id: term-erabu
lemma: 選ぶ
reading: えらぶ
romaji: erabu
meaning_it: scegliere
pos: godan-verb
aliases: [選ぶ, えらぶ, erabu]
notes_it: >-
  Vuol dire scegliere un bersaglio o una carta. Segnala che l'effetto non è
  casuale ma richiede una selezione precisa.
level_hint: n5
:::

:::term
id: term-hiku
lemma: 引く
reading: ひく
romaji: hiku
meaning_it: pescare / tirare
pos: godan-verb
aliases: [引く, ひく, hiku]
notes_it: >-
  Nel contesto delle carte significa soprattutto pescare dal mazzo. È uno dei
  verbi più semplici da riconoscere: se compare {{引|ひ}}く, stai quasi sempre
  aggiungendo carte alla mano.
level_hint: n5
:::

:::term
id: term-suteru
lemma: 捨てる
reading: すてる
romaji: suteru
meaning_it: scartare / buttare via
pos: ichidan-verb
aliases: [捨てる, すてる, suteru]
notes_it: >-
  Significa scartare, di solito dalla mano. Indica una perdita di risorse in
  mano o un costo da pagare per ottenere un altro effetto.
level_hint: n5
:::

:::term
id: term-modosu
lemma: 戻す
reading: もどす
romaji: modosu
meaning_it: rimandare / restituire
pos: godan-verb
aliases: [戻す, もどす, modosu]
notes_it: >-
  Vuol dire riportare una carta in una certa zona, molto spesso la mano. Quando
  trovi {{戻|もど}}す, cerca subito il punto di partenza e quello di arrivo:
  l'effetto parla quasi sempre di un ritorno.
level_hint: n4
:::

:::term
id: term-hanareru
lemma: 離れる
reading: はなれる
romaji: hanareru
meaning_it: lasciare / allontanarsi
pos: ichidan-verb
aliases: [離れる, はなれる, hanareru]
notes_it: >-
  È il verbo tecnico per "lasciare una zona", soprattutto il campo. Non vuol
  dire per forza "essere distrutto": comprende anche rimbalzi in mano, spostamenti
  in altre zone o uscite sostitutive. Per questo è più ampio di
  {{破壊|はかい}} e cambia la lettura di molti trigger difensivi.
level_hint: custom
:::

:::term
id: term-nokoru
lemma: 残る
reading: のこる
romaji: nokoru
meaning_it: restare / rimanere
pos: godan-verb
aliases: [残る, のこる, nokoru]
notes_it: >-
  Vuol dire che una carta resta sul campo invece di andarsene. In Duel Masters
  compare spesso per chiarire che una carta rimane nel バトルゾーン anche se la
  creatura collegata {{離|はな}}れる, oppure che dopo una rimozione vanno guardate
  solo le carte ancora presenti. Leggilo quindi come verbo di persistenza sul
  campo.
level_hint: n4
:::

:::term
id: term-atsukau
lemma: 扱う
reading: あつかう
romaji: atsukau
meaning_it: trattare come / considerare
pos: godan-verb
aliases: [扱う, あつかう, atsukau]
notes_it: >-
  Serve a dire come il gioco considera una carta. In frasi come
  `クリーチャーとして{{扱|あつか}}わない`, il punto non è che la carta cambia
  testo: il punto è che il gioco smette di contarla come creatura in quel
  contesto.
level_hint: custom
:::

:::term
id: term-s-trigger
lemma: S・トリガー
reading: えすとりがー
romaji: esutorigaa
meaning_it: attivazione da scudo
pos: keyword
aliases: [S・トリガー, Sトリガー, esutorigaa]
notes_it: >-
  È la keyword che ti dice che la carta può attivarsi dagli scudi quando viene
  rivelata nel momento giusto. In pratica è una forma di risposta difensiva.
  Se la vedi, collega subito la carta alla シールドゾーン.
level_hint: custom
:::

:::term
id: term-w-breaker
lemma: W・ブレイカー
reading: だぶるぶれいかー
romaji: daburubureikaa
meaning_it: rompe 2 scudi
pos: keyword
aliases: [W・ブレイカー, Wブレイカー, daburubureikaa]
notes_it: >-
  È una keyword offensiva: quella creatura rompe 2 scudi invece di 1 quando
  attacca il giocatore. Va letta come aumento immediato della pressione
  offensiva.
level_hint: custom
:::

:::term
id: term-t-breaker
lemma: T・ブレイカー
reading: とりぷるぶれいかー
romaji: toripurubureikaa
meaning_it: rompe 3 scudi
pos: keyword
aliases: [T・ブレイカー, Tブレイカー, toripurubureikaa]
notes_it: >-
  Funziona come W・ブレイカー, ma ancora più forte: quella creatura rompe 3
  scudi in un attacco. Se compare, è un segnale chiaro di forte pressione
  offensiva.
level_hint: custom
:::

:::grammar
id: grammar-toki
pattern: ～時 / ～た時
title: Trigger con 時
reading: とき / たとき
meaning_it: quando / nel momento in cui
aliases: [～する時, ～た時]
notes_it: >-
  È il pattern base dei trigger. Non ti dice ancora che cosa fa l'effetto: ti
  dice quando si attiva. In carte come `{{出|で}}た{{時|とき}}` o
  `{{攻撃|こうげき}}する{{時|とき}}`, la parte con {{時|とき}} va letta prima di
  tutto come indicazione di timing.
level_hint: n4
:::

:::grammar
id: grammar-sonoato
pattern: その後
title: Sequenza successiva
meaning_it: dopo quello / poi
aliases: [そのあと]
notes_it: >-
  Introduce il blocco successivo della risoluzione. Se leggi
  その{{後|あと}}, la frase non è finita: dopo il primo passo c'è un'altra
  azione da leggere in ordine.
level_hint: n4
:::

:::grammar
id: grammar-soushitara
pattern: そうしたら
title: Conseguenza se lo fai
meaning_it: se lo fai, allora / in quel caso
aliases: [そうしたなら]
notes_it: >-
  Introduce una conseguenza che dipende davvero dal passo precedente. In
  pratica: se il primo pezzo si realizza, allora si apre il secondo.
level_hint: n4
:::

:::grammar
id: grammar-temoyoi
pattern: ～てもよい
title: Azione opzionale
meaning_it: puoi fare / è consentito fare
aliases: [～してもよい]
notes_it: >-
  Segnala che il giocatore può scegliere. Quando lo vedi, sai subito che quella
  parte dell'effetto non è obbligatoria.
level_hint: n4
:::

:::grammar
id: grammar-zuni
pattern: ～ずに
title: Senza fare
reading: ずに
meaning_it: senza fare / senza aver fatto
aliases: [～ないで]
notes_it: >-
  Collega un verbo in forma negativa all'azione successiva. In frasi come
  `コストを{{払|はら}}わずに{{使|つか}}う`, prima ti dice quale passaggio non fai,
  poi ti dice quale azione puoi comunque compiere.
level_hint: n4
:::

:::grammar
id: grammar-kawarini
pattern: かわりに
title: Sostituzione
meaning_it: invece di / al posto di
aliases: [代わりに]
notes_it: >-
  Indica una sostituzione. Non aggiunge semplicemente un'azione: ti dice che un
  evento prende il posto di un altro.
level_hint: n4
:::

:::grammar
id: grammar-nakereba
pattern: ～なければ ... ない
title: Condizione negativa
meaning_it: se non / a meno che non
aliases: [～なければ]
notes_it: >-
  È un pattern di condizione negativa. Ti dice che, se un requisito non è
  soddisfatto, l'effetto o lo stato finale non si applicano.
level_hint: n4
:::

:::grammar
id: grammar-teireba
pattern: ～ていれば
title: Condizione di stato già presente
meaning_it: se / quando è già in quello stato
aliases: [～でいれば, ～していれば]
notes_it: >-
  Controlla uno stato già realizzato. In pratica la carta guarda se una certa
  condizione è già vera e, solo in quel caso, concede il resto dell'effetto.
level_hint: n4
:::

:::grammar
id: grammar-tara
pattern: ～たら
title: Condizione se / quando
meaning_it: se / quando
aliases: [たら]
notes_it: >-
  Apre una condizione che decide se il blocco successivo si attiva davvero. Nel
  rules text spesso controlla uno stato o un evento appena verificato, come in
  `タップ状態でいたら`.
level_hint: n4
:::

:::grammar
id: grammar-areba
pattern: あれば / ～であれば
title: Condizione di esistenza o soglia
reading: あれば / であれば
meaning_it: se c'è / se è / se vale la condizione
aliases: [であれば]
notes_it: >-
  È il condizionale usato quando il testo controlla se esiste un numero,
  una quantità o uno stato sufficiente. In carte come
  `{{数|かず}}あれば` o `{{3以上|さんいじょう}}であれば`, prima verifichi la
  soglia e solo dopo leggi l'effetto che si accende.
level_hint: n4
:::

:::grammar
id: grammar-igai-no-houhou-de
pattern: ～以外の方法で
title: Mezzo escluso
reading: いがいのほうほうで
meaning_it: con un metodo diverso da
aliases: [以外の方法で]
notes_it: >-
  Serve a escludere un metodo preciso. Se leggi
  `{{召喚|しょうかん}}{{以外|いがい}}の{{方法|ほうほう}}で`, la carta sta dicendo
  che conta tutto tranne la normale evocazione.
level_hint: custom
:::

:::grammar
id: grammar-matawa
pattern: または
title: Alternativa nel filtro
meaning_it: oppure / o
aliases: [又は]
notes_it: >-
  È il connettore standard di alternativa nel rules text. Collega due categorie
  o due bersagli validi nello stesso blocco, per esempio
  `{{闇|やみ}}のクリーチャーまたは{{闇|やみ}}のタマシード`. Quando lo vedi,
  controlla quale numero, condizione o verbo vale per entrambe le parti.
level_hint: n4
:::

:::grammar
id: grammar-ika-ijou
pattern: ～以下 / ～以上
title: Limiti numerici
reading: いか / いじょう
meaning_it: al massimo / almeno
aliases: [以下, 以上]
notes_it: >-
  È il pattern dei filtri numerici. In frasi come `コスト{{4以下|よんいか}}` o
  `パワー{{2000以下|にせんいか}}`, decide quali carte rientrano davvero nell'effetto.
level_hint: n4
:::

:::grammar
id: grammar-turn-timing
pattern: ～のはじめに / ～の終わりに
title: Timing di inizio o fine turno
reading: のはじめに / のおわりに
meaning_it: all'inizio di / alla fine di
aliases: [ターンのはじめに, ターンの終わりに]
notes_it: >-
  Fissa un punto preciso del turno. La prima verifica è se l'effetto scatta
  all'inizio o alla fine di qualcosa.
level_hint: n4
:::

:::grammar
id: grammar-tadashi
pattern: ただし
title: Restrizione o eccezione
meaning_it: però / salvo che / con la seguente limitazione
aliases: [但し]
notes_it: >-
  Introduce una limitazione finale: l'effetto vale, ma entro un confine preciso
  che non può essere superato.
level_hint: n4
:::

:::card
id: card-creature-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-overview
entry_type: term
entry_id: term-creature
card_type: recognition
front: クリーチャー
back: creatura
example_jp: >-
  このクリーチャーは{{攻撃|こうげき}}できる。
example_it: >-
  Questa creatura può attaccare.
notes_it: >-
  È il tipo di carta base del gioco: entra nel campo, attacca, blocca o subisce
  effetti. Nel testo può comparire anche come bersaglio o come requisito.
tags: [core, type]
:::

:::card
id: card-spell-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-overview
entry_type: term
entry_id: term-spell
card_type: recognition
front: '{{呪文|じゅもん}}'
back: magia / spell
example_jp: >-
  この{{呪文|じゅもん}}を{{使|つか}}って、カードを{{1枚|いちまい}} {{引|ひ}}く。
example_it: >-
  Usa questa magia e pesca 1 carta.
notes_it: >-
  Indica una magia. In genere la giochi per il suo effetto e poi non resta sul
  campo. {{呪文|じゅもん}} segnala quindi una risoluzione immediata.
tags: [core, type]
:::

:::card
id: card-tamaseed-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-overview
entry_type: term
entry_id: term-tamaseed
card_type: recognition
front: タマシード
back: tipo di carta Tamaseed
example_jp: >-
  このタマシードの{{上|うえ}}に{{進化|しんか}}クリーチャーを{{重|かさ}}ねる。
example_it: >-
  Sovrapponi una creatura evoluzione su questo Tamaseed.
notes_it: >-
  È un tipo di carta che resta nel campo e funge soprattutto da base per
  {{進化|しんか}} o シンカライズ. Non va letta come una creatura normale.
tags: [core, type, keyword]
:::

:::card
id: card-blocker-recognition
lesson_id: lesson-duel-masters-dm25-keyword-effects-reference
entry_type: term
entry_id: term-blocker
card_type: recognition
front: ブロッカー
back: bloccante
example_jp: >-
  ブロッカーを{{持|も}}つクリーチャーを{{1体|いったい}} {{選|えら}}ぶ。
example_it: >-
  Scegli 1 creatura che ha Blocker.
notes_it: >-
  Keyword difensiva. Se la creatura ha ブロッカー, può fermare un attacco
  avversario. È un segnale chiaro di difesa.
tags: [core, keyword]
:::

:::card
id: card-blocker-operational-concept
lesson_id: lesson-duel-masters-dm25-keyword-effects-reference
entry_type: term
entry_id: term-blocker
card_type: concept
front: >-
  {{相手|あいて}}プレイヤーを{{攻撃|こうげき}}できない。{{相手|あいて}}の
  クリーチャーが{{攻撃|こうげき}}する{{時|とき}}、かわりにこの
  クリーチャーをタップしてもよい。
back: >-
  Non può attaccare il giocatore avversario; quando una creatura avversaria
  attacca, puoi tapparla al suo posto per bloccare.
example_jp: >-
  ブロッカーを{{持|も}}つクリーチャーは、
  {{相手|あいて}}プレイヤーを{{直接|ちょくせつ}}{{攻撃|こうげき}}できない。
example_it: >-
  Una creatura con Blocker non può attaccare direttamente il giocatore
  avversario.
notes_it: >-
  Questa è la lettura operativa della keyword: una restrizione permanente più
  un rimpiazzo difensivo con `かわりに ... タップしてもよい`.
tags: [core, keyword, defense]
:::

:::card
id: card-evolution-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-overview
entry_type: term
entry_id: term-evolution
card_type: recognition
front: '{{進化|しんか}}'
back: evoluzione
example_jp: >-
  {{進化|しんか}}クリーチャーを{{1体|いったい}} {{出|だ}}す。
example_it: >-
  Metti in gioco 1 creatura evoluzione.
notes_it: >-
  Ti dice che la carta va messa sopra una base valida. Se compare, controlla
  sempre quale carta deve stare sotto e quali condizioni servono.
tags: [core, keyword]
:::

:::card
id: card-invasion-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-overview
entry_type: term
entry_id: term-invasion
card_type: recognition
front: '{{侵略|しんりゃく}}'
back: invasione
example_jp: >-
  {{侵略|しんりゃく}}でこのクリーチャーの{{上|うえ}}に{{重|かさ}}ねる。
example_it: >-
  Con Invasion, sovrapponila su questa creatura.
notes_it: >-
  Keyword offensiva tipica di SD2. Di solito permette di mettere una creatura
  dalla mano sopra un attaccante durante l'attacco. Cerca sempre l'attaccante
  richiesto.
tags: [core, keyword, dm25-sd2]
:::

:::card
id: card-shinkarize-recognition
lesson_id: lesson-duel-masters-dm25-dm25-sd2-overview
entry_type: term
entry_id: term-shinkarize
card_type: recognition
front: シンカライズ
back: effetto che permette di evolvere sopra un Tamaseed
example_jp: >-
  このタマシードはシンカライズできる。
example_it: >-
  Questo Tamaseed può usare Shinkarize.
notes_it: >-
  Collega i Tamaseed alle carte di evoluzione. La risoluzione usa una
  sovrapposizione con un Tamaseed come base.
tags: [core, keyword, dm25-sd2]
:::

:::card
id: card-shinkarize-connection-concept
lesson_id: lesson-duel-masters-dm25-dm25-sd2-overview
entry_type: term
entry_id: term-shinkarize
card_type: concept
front: >-
  {{進化元|しんかもと}}にも{{進化先|しんかさき}}にもなれるように{{扱|あつか}}って、
  {{進化|しんか}}のつながりを{{作|つく}}る。
back: >-
  La tratta in modo che possa funzionare sia come base sia come estensione di
  un'evoluzione, creando il collegamento evolutivo.
example_jp: >-
  このタマシードを{{進化元|しんかもと}}にも{{進化先|しんかさき}}にもなれるように
  {{扱|あつか}}う。
example_it: >-
  Tratta questo Tamaseed in modo che possa funzionare sia come base sia come
  estensione di un'evoluzione.
notes_it: >-
  Qui il punto non è il nome della keyword ma il verbo `{{扱|あつか}}う` con il doppio
  ruolo `進化元 / 進化先`, che spiega davvero come leggere la meccanica.
tags: [core, keyword, evolution, dm25-sd2]
:::

:::card
id: card-abyss-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-overview
entry_type: term
entry_id: term-abyss
card_type: recognition
front: アビス
back: Abyss / gruppo di carte Abyss
example_jp: >-
  コスト{{4以下|よんいか}}のアビスを{{1枚|いちまい}} {{選|えら}}ぶ。
example_it: >-
  Scegli 1 Abyss di costo 4 o inferiore.
notes_it: >-
  È un'etichetta di gruppo fondamentale in SD1. Se appare, controlla se la
  frase sta filtrando quali carte puoi scegliere, recuperare o mettere in campo.
tags: [core, group, dm25-sd1]
:::

:::card
id: card-command-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-patterns
entry_type: term
entry_id: term-command
card_type: recognition
front: コマンド
back: Command / famiglia di creature
example_jp: >-
  {{火|ひ}}のコマンドを{{1体|いったい}} {{出|だ}}す。
example_it: >-
  Metti in gioco 1 Command di fuoco.
notes_it: >-
  In SD2 questa famiglia compare soprattutto come condizione di validità
  dell'effetto. Non basta che una creatura attacchi: deve attaccare proprio un
  コマンド, o una carta che conti come tale, perché il testo si applichi.
tags: [core, group, dm25-sd2]
:::

:::card
id: card-civilization-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-overview
entry_type: term
entry_id: term-civilization
card_type: recognition
front: '{{文明|ぶんめい}}'
back: civiltà / civilization
example_jp: >-
  このカードは{{火|ひ}}の{{文明|ぶんめい}}を{{持|も}}つ。
example_it: >-
  Questa carta ha la civiltà fuoco.
notes_it: >-
  È il colore della carta. Serve sia a leggere l'anatomia della carta sia a
  capire filtri come `{{火|ひ}}のコマンド` o effetti che richiedono una civiltà
  precisa.
tags: [core, anatomy]
:::

:::card
id: card-cost-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-overview
entry_type: term
entry_id: term-cost
card_type: recognition
front: コスト
back: costo
example_jp: >-
  コスト{{5以下|ごいか}}のクリーチャーを{{1体|いったい}} {{選|えら}}ぶ。
example_it: >-
  Scegli 1 creatura di costo 5 o inferiore.
notes_it: >-
  È il numero di mana richiesto per giocare la carta. Nel testo effetto può
  anche diventare un filtro, per esempio in `コスト{{4以下|よんいか}}`.
tags: [core, anatomy, filter]
:::

:::card
id: card-harau-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-maou-de-szark
entry_type: term
entry_id: term-harau
card_type: recognition
front: '{{払|はら}}う'
back: pagare
example_jp: >-
  コストを{{払|はら}}ってこのカードを{{使|つか}}う。
example_it: >-
  Paghi il costo e usi questa carta.
notes_it: >-
  In Duel Masters compare quasi sempre legato al costo. Quando lo vedi in
  negativo, come in `{{払|はら}}わずに`, la carta ti sta dicendo che puoi saltare
  il pagamento.
tags: [core, action, kanji, cost]
:::

:::card
id: card-power-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-overview
entry_type: term
entry_id: term-power
card_type: recognition
front: パワー
back: potere / power
example_jp: >-
  パワー{{2000以下|にせんいか}}のクリーチャーを{{破壊|はかい}}する。
example_it: >-
  Distruggi 1 creatura con power 2000 o inferiore.
notes_it: >-
  È la forza della creatura. Se compare nel testo, di solito serve a limitare i
  bersagli o a definire quali creature vengono colpite.
tags: [core, anatomy, filter]
:::

:::card
id: card-goukei-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-patterns
entry_type: term
entry_id: term-goukei
card_type: recognition
front: '{{合計|ごうけい}}'
back: totale / somma complessiva
example_jp: >-
  クリーチャーまたはタマシードを{{合計|ごうけい}}{{3|みっ}}つまで{{選|えら}}ぶ。
example_it: >-
  Scegli fino a 3 creature e/o Tamaseed in totale.
notes_it: >-
  Segnala un conteggio aggregato. Se compare, il filtro somma tutti gli elementi
  validi invece di trattarli come controlli separati.
tags: [core, filter, kanji]
:::

:::card
id: card-race-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-overview
entry_type: term
entry_id: term-race
card_type: recognition
front: '{{種族|しゅぞく}}'
back: tribù / race
example_jp: >-
  {{種族|しゅぞく}}がアビスロイヤルのクリーチャーを{{1体|いったい}} {{出|だ}}す。
example_it: >-
  Metti in gioco 1 creatura la cui razza è Abyss Royal.
notes_it: >-
  È la linea di appartenenza della carta. In molte frasi non è decorativa:
  decide se una carta rientra davvero nel filtro dell'effetto.
tags: [core, anatomy]
:::

:::card
id: card-battle-zone-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-overview
entry_type: term
entry_id: term-battle-zone
card_type: recognition
front: バトルゾーン
back: battle zone / campo
example_jp: >-
  このクリーチャーをバトルゾーンに{{出|だ}}す。
example_it: >-
  Metti questa creatura nella battle zone.
notes_it: >-
  È il campo principale del gioco. Qui entrano le creature, qui si attacca, qui
  molte carte vengono distrutte o sovrapposte.
tags: [core, zone]
:::

:::card
id: card-mana-zone-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-overview
entry_type: term
entry_id: term-mana-zone
card_type: recognition
front: マナゾーン
back: mana zone
example_jp: >-
  このカードをマナゾーンに{{置|お}}く。
example_it: >-
  Metti questa carta nella mana zone.
notes_it: >-
  È la zona delle risorse. Se una carta parla di pagare il costo o di spostare
  carte nella mana, questa è la zona di riferimento.
tags: [core, zone]
:::

:::card
id: card-shield-zone-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-overview
entry_type: term
entry_id: term-shield-zone
card_type: recognition
front: シールドゾーン
back: shield zone
example_jp: >-
  シールドゾーンから{{1枚|いちまい}} {{手札|てふだ}}に{{加|くわ}}える。
example_it: >-
  Aggiungi 1 carta dalla shield zone alla tua mano.
notes_it: >-
  È la zona dei 5 scudi. Conta sia perché gli attacchi colpiscono gli scudi sia
  perché qui si attivano spesso carte con S・トリガー.
tags: [core, zone]
:::

:::card
id: card-deck-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-overview
entry_type: term
entry_id: term-deck
card_type: recognition
front: '{{山札|やまふだ}}'
back: mazzo / deck
example_jp: >-
  {{山札|やまふだ}}の{{上|うえ}}から{{1枚|いちまい}} {{引|ひ}}く。
example_it: >-
  Pesca 1 carta dalla cima del mazzo.
notes_it: >-
  Significa "mazzo". Compare spesso in frasi come
  `{{山札|やまふだ}}の{{上|うえ}}からX{{枚|まい}}`. La lettura chiave è
  {{山札|やまふだ}}.
tags: [core, zone, kanji]
:::

:::card
id: card-hand-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-overview
entry_type: term
entry_id: term-hand
card_type: recognition
front: '{{手札|てふだ}}'
back: mano / hand
example_jp: >-
  {{手札|てふだ}}からクリーチャーを{{1体|いったい}} {{出|だ}}す。
example_it: >-
  Metti in gioco 1 creatura dalla tua mano.
notes_it: >-
  Significa "mano". Se compare, controlla se la carta viene scartata, mostrata
  o fatta entrare in gioco dalla mano. La lettura è {{手札|てふだ}}.
tags: [core, zone, kanji]
:::

:::card
id: card-graveyard-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-overview
entry_type: term
entry_id: term-graveyard
card_type: recognition
front: '{{墓地|ぼち}}'
back: cimitero / graveyard
example_jp: >-
  {{墓地|ぼち}}からカードを{{1枚|いちまい}} {{手札|てふだ}}に{{戻|もど}}す。
example_it: >-
  Rimetti 1 carta dal cimitero nella tua mano.
notes_it: >-
  Significa "cimitero". In SD1 è una zona centrale.
  Se compare, va verificato se l'effetto manda carte nel cimitero, le riprende
  da lì o le rimette in campo. La lettura è {{墓地|ぼち}}.
tags: [core, zone, kanji, dm25-sd1]
:::

:::card
id: card-self-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-overview
entry_type: term
entry_id: term-self
card_type: recognition
front: '{{自分|じぶん}}'
back: se stessi / tu
example_jp: >-
  {{自分|じぶん}}のクリーチャーを{{1体|いったい}} {{選|えら}}ぶ。
example_it: >-
  Scegli 1 delle tue creature.
notes_it: >-
  Significa "tu" nel contesto della carta. Ti dice che l'effetto riguarda il
  giocatore che controlla la carta o l'effetto stesso.
tags: [core, actor]
:::

:::card
id: card-opponent-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-overview
entry_type: term
entry_id: term-opponent
card_type: recognition
front: '{{相手|あいて}}'
back: avversario / opponent
example_jp: >-
  {{相手|あいて}}のクリーチャーを{{1体|いったい}} {{破壊|はかい}}する。
example_it: >-
  Distruggi 1 creatura del tuo avversario.
notes_it: >-
  Significa "avversario". È una parola chiave da riconoscere subito, perché ti
  dice che il bersaglio o la zona coinvolta sono dall'altro lato del tavolo.
tags: [core, actor]
:::

:::card
id: card-effect-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-overview
entry_type: term
entry_id: term-effect
card_type: recognition
front: '{{効果|こうか}}'
back: effetto
example_jp: >-
  この{{効果|こうか}}で{{相手|あいて}}のクリーチャーを{{1体|いったい}} {{破壊|はかい}}する。
example_it: >-
  Con questo effetto distruggi 1 creatura del tuo avversario.
notes_it: >-
  Quando compare {{効果|こうか}}, la carta non sta nominando un oggetto ma il risultato
  prodotto da un'abilità o da una riga di testo.
tags: [core, rules-text]
:::

:::card
id: card-summon-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-patterns
entry_type: term
entry_id: term-summon
card_type: recognition
front: '{{召喚|しょうかん}}'
back: evocazione / summon
example_jp: >-
  このクリーチャーを{{召喚|しょうかん}}してもよい。
example_it: >-
  Puoi evocare questa creatura.
notes_it: >-
  Indica la normale evocazione di una creatura pagando il costo. Se una carta
  distingue `{{召喚|しょうかん}}` da altri modi di entrare in gioco, sta facendo un
  contrasto regolistico diretto.
tags: [core, action, kanji]
:::

:::card
id: card-attack-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-overview
entry_type: term
entry_id: term-attack
card_type: recognition
front: '{{攻撃|こうげき}}'
back: attacco / attack
example_jp: >-
  このクリーチャーが{{攻撃|こうげき}}する{{時|とき}}、カードを{{1枚|いちまい}} {{引|ひ}}く。
example_it: >-
  Quando questa creatura attacca, pesca 1 carta.
notes_it: >-
  Significa "attacco". Compare spesso in trigger e condizioni: se lo vedi,
  si attiva un effetto durante il combattimento.
tags: [core, action, kanji]
:::

:::card
id: card-destroy-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-overview
entry_type: term
entry_id: term-destroy
card_type: recognition
front: '{{破壊|はかい}}'
back: distruzione / destroy
example_jp: >-
  {{相手|あいて}}のクリーチャーを{{1体|いったい}} {{破壊|はかい}}する。
example_it: >-
  Distruggi 1 creatura del tuo avversario.
notes_it: >-
  Significa "distruggere". Non va confuso con ogni possibile uscita dal campo:
  è un caso specifico, più stretto di {{離|はな}}れる.
tags: [core, action, kanji]
:::

:::card
id: card-break-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-overview
entry_type: term
entry_id: term-break
card_type: recognition
front: ブレイク
back: rompere gli scudi / break
example_jp: >-
  このクリーチャーはシールドを{{1枚|いちまい}}ブレイクする。
example_it: >-
  Questa creatura rompe 1 scudo.
notes_it: >-
  Vuol dire rompere gli scudi dell'avversario. È un verbo da collegare subito
  alla pressione offensiva e alla vittoria.
tags: [core, action]
:::

:::card
id: card-tap-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-patterns
entry_type: term
entry_id: term-tap
card_type: recognition
front: タップ
back: tappare / mettere tapped
example_jp: >-
  {{相手|あいて}}のクリーチャーを{{1体|いったい}}タップする。
example_it: >-
  Tappa 1 creatura del tuo avversario.
notes_it: >-
  Significa mettere una carta in stato tappato. Compare spesso in attacco, nel
  blocco e negli effetti che controllano il ritmo del campo.
tags: [core, action]
:::

:::card
id: card-untap-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-patterns
entry_type: term
entry_id: term-untap
card_type: recognition
front: アンタップ
back: stappare / untap
example_jp: >-
  このクリーチャーをアンタップする。
example_it: >-
  Stappa questa creatura.
notes_it: >-
  È l'opposto di タップ. Quando lo vedi, una carta torna disponibile sul campo.
tags: [core, action]
:::

:::card
id: card-kasaneru-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-overview
entry_type: term
entry_id: term-kasaneru
card_type: recognition
front: '{{重|かさ}}ねる'
back: sovrapporre / mettere sopra
example_jp: >-
  このクリーチャーの{{上|うえ}}に{{重|かさ}}ねる。
example_it: >-
  Sovrapponila su questa creatura.
notes_it: >-
  Significa mettere una carta sopra un'altra. È uno dei verbi chiave per capire
  {{進化|しんか}}, {{侵略|しんりゃく}} e tutte le meccaniche di sovrapposizione.
tags: [core, action, kanji]
:::

:::card
id: card-deru-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-overview
entry_type: term
entry_id: term-deru
card_type: recognition
front: '{{出|で}}る'
back: uscire / entrare in gioco
example_jp: >-
  このクリーチャーが{{出|で}}た{{時|とき}}、カードを{{1枚|いちまい}} {{引|ひ}}く。
example_it: >-
  Quando questa creatura entra, pesca 1 carta.
notes_it: >-
  È il verbo intransitivo di ingresso. Se una carta `{{出|で}}た{{時|とき}}`, il
  trigger parte nel momento in cui entra in gioco.
tags: [core, action, kanji]
:::

:::card
id: card-dasu-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-overview
entry_type: term
entry_id: term-dasu
card_type: recognition
front: '{{出|だ}}す'
back: far uscire / mettere in gioco
example_jp: >-
  {{手札|てふだ}}からクリーチャーを{{1体|いったい}} {{出|だ}}す。
example_it: >-
  Metti in gioco 1 creatura dalla mano.
notes_it: >-
  È il verbo transitivo di ingresso. Qui c'è sempre un effetto che fa entrare
  una carta in gioco da una certa zona.
tags: [core, action, kanji]
:::

:::card
id: card-oku-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-overview
entry_type: term
entry_id: term-oku
card_type: recognition
front: '{{置|お}}く'
back: mettere / porre
example_jp: >-
  このカードを{{墓地|ぼち}}に{{置|お}}く。
example_it: >-
  Metti questa carta nel cimitero.
notes_it: >-
  È un verbo molto comune e neutro. Il significato operativo dipende dalla
  destinazione: nel cimitero, nel mazzo, sopra una carta o altrove.
tags: [core, action, kanji]
:::

:::card
id: card-add-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-overview
entry_type: term
entry_id: term-add
card_type: recognition
front: '{{加|くわ}}える'
back: aggiungere / mettere in mano
example_jp: >-
  シールドゾーンから{{1枚|いちまい}} {{手札|てふだ}}に{{加|くわ}}える。
example_it: >-
  Aggiungi 1 carta dalla shield zone alla tua mano.
notes_it: >-
  Va letto insieme alle zone: indica quando una carta finisce in mano invece di
  entrare in campo o andare in un'altra zona.
tags: [core, action, kanji]
:::

:::card
id: card-erabu-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-overview
entry_type: term
entry_id: term-erabu
card_type: recognition
front: '{{選|えら}}ぶ'
back: scegliere
example_jp: >-
  クリーチャーを{{1体|いったい}} {{選|えら}}ぶ。
example_it: >-
  Scegli 1 creatura.
notes_it: >-
  Indica una scelta. Se compare, l'effetto non è casuale: qualcuno deve
  selezionare un bersaglio o una carta precisa.
tags: [core, action, kanji]
:::

:::card
id: card-hiku-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-overview
entry_type: term
entry_id: term-hiku
card_type: recognition
front: '{{引|ひ}}く'
back: pescare / tirare
example_jp: >-
  カードを{{2枚|にまい}} {{引|ひ}}く。
example_it: >-
  Pesca 2 carte.
notes_it: >-
  Nel linguaggio delle carte significa quasi sempre pescare. È uno dei verbi più
  diretti da riconoscere.
tags: [core, action, kanji]
:::

:::card
id: card-suteru-recognition
lesson_id: lesson-duel-masters-dm25-dm25-sd2-overview
entry_type: term
entry_id: term-suteru
card_type: recognition
front: '{{捨|す}}てる'
back: scartare / buttare via
example_jp: >-
  {{手札|てふだ}}を{{1枚|いちまい}} {{捨|す}}てる。
example_it: >-
  Scarta 1 carta dalla mano.
notes_it: >-
  Significa scartare, di solito dalla mano. Spesso è un costo o una perdita che
  serve ad attivare un effetto migliore.
tags: [core, action, kanji]
:::

:::card
id: card-modosu-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-patterns
entry_type: term
entry_id: term-modosu
card_type: recognition
front: '{{戻|もど}}す'
back: rimandare / restituire
example_jp: >-
  このカードを{{手札|てふだ}}に{{戻|もど}}す。
example_it: >-
  Rimetti questa carta nella tua mano.
notes_it: >-
  Significa riportare una carta in una zona, molto spesso la mano. Leggilo come
  verbo di ritorno.
tags: [core, action, kanji]
:::

:::card
id: card-hanareru-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-patterns
entry_type: term
entry_id: term-hanareru
card_type: recognition
front: '{{離|はな}}れる'
back: lasciare / allontanarsi
example_jp: >-
  このクリーチャーがバトルゾーンを{{離|はな}}れた{{時|とき}}、カードを{{1枚|いちまい}} {{引|ひ}}く。
example_it: >-
  Quando questa creatura lascia la battle zone, pesca 1 carta.
notes_it: >-
  Significa lasciare una zona, soprattutto il campo. È più ampio di
  {{破壊|はかい}}, quindi non va letto come semplice distruzione.
tags: [core, action, kanji]
:::

:::card
id: card-nokoru-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-patterns
entry_type: term
entry_id: term-nokoru
card_type: recognition
front: '{{残|のこ}}る'
back: restare / rimanere
example_jp: >-
  そのクリーチャーが{{離|はな}}れても、このカードは{{残|のこ}}る。
example_it: >-
  Anche se quella creatura lascia il campo, questa carta resta.
notes_it: >-
  Indica che la carta continua a restare sul campo o nella zona attuale. In
  Duel Masters oppone l'idea di permanenza ai verbi di uscita come
  {{離|はな}}れる.
tags: [core, action, kanji]
:::

:::card
id: card-atsukau-recognition
lesson_id: lesson-duel-masters-dm25-tcg-core-patterns
entry_type: term
entry_id: term-atsukau
card_type: recognition
front: '{{扱|あつか}}う'
back: trattare come / considerare
example_jp: >-
  このタマシードをクリーチャーとして{{扱|あつか}}わない。
example_it: >-
  Non trattare questo Tamaseed come una creatura.
notes_it: >-
  Ti dice come il gioco considera una carta. In frasi negative, come
  `クリーチャーとして{{扱|あつか}}わない`, cambia il modo in cui quella carta
  viene contata.
tags: [core, action, kanji]
:::

:::card
id: card-s-trigger-recognition
lesson_id: lesson-duel-masters-dm25-dm25-sd2-overview
entry_type: term
entry_id: term-s-trigger
card_type: recognition
front: S・トリガー
back: attivazione da scudo
example_jp: >-
  S・トリガーでこの{{呪文|じゅもん}}を{{使|つか}}ってもよい。
example_it: >-
  Puoi usare questa magia con S-Trigger.
notes_it: >-
  Keyword difensiva legata agli scudi. Se appare, la carta può attivarsi da uno
  scudo nel momento giusto invece di restare solo una carta difensiva passiva.
tags: [core, keyword]
:::

:::card
id: card-s-trigger-no-cost-usage-concept
lesson_id: lesson-duel-masters-dm25-dm25-sd2-overview
entry_type: term
entry_id: term-s-trigger
card_type: concept
front: 'コストを{{払|はら}}わずに{{使|つか}}ってもよい'
back: puoi usarla senza pagarne il costo
example_jp: >-
  シールドがブレイクされてこのカードを{{手札|てふだ}}に{{加|くわ}}えた{{時|とき}}、
  このカードをコストを{{払|はら}}わずに{{使|つか}}ってもよい。
example_it: >-
  Quando questa carta entra in mano da uno scudo rotto, puoi usarla senza
  pagarne il costo.
notes_it: >-
  È il payoff operativo tipico di S・トリガー. La lettura chiave è doppia:
  `{{払|はら}}わずに` = senza pagare, `{{使|つか}}ってもよい` = puoi scegliere di
  usarla subito.
tags: [core, keyword, cost, option]
:::

:::card
id: card-w-breaker-recognition
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-crash-hadou
entry_type: term
entry_id: term-w-breaker
card_type: recognition
front: W・ブレイカー
back: rompe 2 scudi
example_jp: >-
  このクリーチャーはW・ブレイカーを{{持|も}}つ。
example_it: >-
  Questa creatura ha W-Breaker.
notes_it: >-
  Keyword offensiva che fa rompere 2 scudi in un attacco. È un segnale chiaro
  di pressione sul giocatore avversario.
tags: [core, keyword]
:::

:::card
id: card-t-breaker-recognition
lesson_id: lesson-duel-masters-dm25-dm25-sd2-overview
entry_type: term
entry_id: term-t-breaker
card_type: recognition
front: T・ブレイカー
back: rompe 3 scudi
example_jp: >-
  このクリーチャーはT・ブレイカーを{{持|も}}つ。
example_it: >-
  Questa creatura ha T-Breaker.
notes_it: >-
  Versione ancora più forte di W・ブレイカー: la creatura rompe 3 scudi con un
  solo attacco.
tags: [core, keyword]
:::

:::card
id: card-toki-concept
lesson_id: lesson-duel-masters-dm25-tcg-core-overview
entry_type: grammar
entry_id: grammar-toki
card_type: concept
front: '～{{時|とき}} / ～た{{時|とき}}'
back: quando / nel momento in cui
example_jp: >-
  このクリーチャーが{{出|で}}た{{時|とき}}、カードを{{1枚|いちまい}} {{引|ひ}}く。
example_it: >-
  Quando questa creatura entra, pesca 1 carta.
notes_it: >-
  È il pattern base dei trigger. Prima ti dice quando succede qualcosa, poi ti
  lascia leggere l'effetto vero e proprio.
tags: [core, grammar, timing]
:::

:::card
id: card-sonoato-concept
lesson_id: lesson-duel-masters-dm25-tcg-core-patterns
entry_type: grammar
entry_id: grammar-sonoato
card_type: concept
front: 'その{{後|あと}}'
back: dopo quello / poi
example_jp: >-
  クリーチャーを{{1体|いったい}} {{出|だ}}す。その{{後|あと}}、
  カードを{{1枚|いちまい}} {{引|ひ}}く。
example_it: >-
  Metti in gioco 1 creatura. Poi pesca 1 carta.
notes_it: >-
  Ti avvisa che c'è un secondo blocco nella stessa risoluzione. La frase non si
  ferma al primo effetto.
tags: [core, grammar, sequence]
:::

:::card
id: card-soushitara-concept
lesson_id: lesson-duel-masters-dm25-tcg-core-patterns
entry_type: grammar
entry_id: grammar-soushitara
card_type: concept
front: そうしたら
back: se lo fai, allora / in quel caso
example_jp: >-
  カードを{{1枚|いちまい}} {{捨|す}}てる。そうしたら、{{1枚|いちまい}} {{引|ひ}}く。
example_it: >-
  Scarta 1 carta. Fatto questo, pescane 1.
notes_it: >-
  Indica che il secondo pezzo dipende dal fatto che il primo si sia davvero
  realizzato.
tags: [core, grammar, sequence]
:::

:::card
id: card-temoyoi-concept
lesson_id: lesson-duel-masters-dm25-tcg-core-patterns
entry_type: grammar
entry_id: grammar-temoyoi
card_type: concept
front: ～てもよい
back: puoi fare / è consentito fare
example_jp: >-
  {{山札|やまふだ}}の{{上|うえ}}から{{1枚|いちまい}}を{{見|み}}てもよい。
example_it: >-
  Puoi guardare la prima carta del tuo mazzo.
notes_it: >-
  Segnala una scelta opzionale. Quando lo vedi, sai che il giocatore può
  decidere se compiere quell'azione o no.
tags: [core, grammar, option]
:::

:::card
id: card-zuni-concept
lesson_id: lesson-duel-masters-dm25-keyword-effects-reference
entry_type: grammar
entry_id: grammar-zuni
card_type: concept
front: ～ずに
back: senza fare / senza
example_jp: >-
  コストを{{払|はら}}わずにこの{{呪文|じゅもん}}を{{使|つか}}う。
example_it: >-
  Usi questa magia senza pagarne il costo.
notes_it: >-
  Prima ti dice quale azione non fai, poi collega subito il verbo successivo.
  In rules text è un pattern molto utile per leggere costi saltati o passaggi
  evitati.
tags: [core, grammar, negation]
:::

:::card
id: card-kawarini-concept
lesson_id: lesson-duel-masters-dm25-tcg-core-patterns
entry_type: grammar
entry_id: grammar-kawarini
card_type: concept
front: かわりに
back: invece di / al posto di
example_jp: >-
  カードを{{1枚|いちまい}} {{引|ひ}}く。かわりに、{{手札|てふだ}}を{{1枚|いちまい}} {{捨|す}}てる。
example_it: >-
  Pesca 1 carta. Invece, scarta 1 carta dalla mano.
notes_it: >-
  Va letto come sostituzione, non come aggiunta. Un evento prende il posto di un
  altro.
tags: [core, grammar, replacement]
:::

:::card
id: card-nakereba-concept
lesson_id: lesson-duel-masters-dm25-tcg-core-patterns
entry_type: grammar
entry_id: grammar-nakereba
card_type: concept
front: ～なければ ... ない
back: se non / a meno che non
example_jp: >-
  アビスが{{1体|いったい}}もなければ、この{{効果|こうか}}は{{使|つか}}えない。
example_it: >-
  Se non hai nemmeno 1 Abyss, non puoi usare questo effetto.
notes_it: >-
  Indica una condizione negativa. Se il requisito non è soddisfatto, l'effetto
  o lo stato descritto non valgono.
tags: [core, grammar, condition]
:::

:::card
id: card-teireba-concept
lesson_id: lesson-duel-masters-dm25-tcg-core-patterns
entry_type: grammar
entry_id: grammar-teireba
card_type: concept
front: ～ていれば
back: se / quando è già in quello stato
example_jp: >-
  {{手札|てふだ}}が{{3枚|さんまい}} {{残|のこ}}っていれば、この{{効果|こうか}}を{{使|つか}}える。
example_it: >-
  Se hai già tre carte in mano, puoi usare questo effetto.
notes_it: >-
  Controlla uno stato già soddisfatto. La carta verifica una situazione già
  vera prima di concedere il resto dell'effetto.
tags: [core, grammar, condition]
:::

:::card
id: card-tara-condition-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-crash-hadou
entry_type: grammar
entry_id: grammar-tara
card_type: concept
front: ～たら
back: se / quando
example_jp: >-
  タップ{{状態|じょうたい}}でいたら、その{{条件|じょうけん}}を{{満|み}}たす。
example_it: >-
  Se era in stato tapped, soddisfa quella condizione.
notes_it: >-
  Apre una condizione reale nel rules text. Dopo `～たら` va controllato se lo
  stato o l'evento nominato si è davvero verificato.
tags: [core, grammar, condition]
:::

:::card
id: card-areba-concept
lesson_id: lesson-duel-masters-dm25-live-duel-encounters-tamatango-panzer
entry_type: grammar
entry_id: grammar-areba
card_type: concept
front: あれば / ～であれば
back: se c'è / se è / se vale la soglia
example_jp: >-
  コストの{{合計|ごうけい}}が{{3以上|さんいじょう}}であれば、この
  クリーチャーの「S・トリガー」を{{使|つか}}ってもよい。
example_it: >-
  Se la somma dei costi è 3 o più, puoi usare l'S-Trigger di questa creatura.
notes_it: >-
  È il condizionale tipico di soglie e quantità. Prima controlli numero o
  stato, poi leggi il blocco che diventa valido.
tags: [core, grammar, condition]
:::

:::card
id: card-igai-no-houhou-de-concept
lesson_id: lesson-duel-masters-dm25-tcg-core-patterns
entry_type: grammar
entry_id: grammar-igai-no-houhou-de
card_type: concept
front: '～{{以外|いがい}}の{{方法|ほうほう}}で'
back: con un metodo diverso da
example_jp: >-
  このクリーチャーが{{召喚|しょうかん}}{{以外|いがい}}の{{方法|ほうほう}}で{{出|で}}た{{時|とき}}、カードを{{1枚|いちまい}} {{引|ひ}}く。
example_it: >-
  Quando questa creatura entra con un metodo diverso dall'evocazione, pesca 1 carta.
notes_it: >-
  Esclude un mezzo preciso. Se compare, va identificato quale metodo viene
  escluso dal testo.
tags: [core, grammar, restriction]
:::

:::card
id: card-matawa-concept
lesson_id: lesson-duel-masters-dm25-tcg-core-patterns
entry_type: grammar
entry_id: grammar-matawa
card_type: concept
front: または
back: oppure / o
example_jp: >-
  クリーチャーまたはタマシードを{{1|ひと}}つ {{選|えら}}ぶ。
example_it: >-
  Scegli 1 creatura oppure 1 Tamaseed.
notes_it: >-
  Collega due alternative valide nello stesso filtro. Quando compare, leggi i
  due lati come parte dello stesso conteggio o della stessa selezione.
tags: [core, grammar, filter]
:::

:::card
id: card-ika-ijou-concept
lesson_id: lesson-duel-masters-dm25-tcg-core-overview
entry_type: grammar
entry_id: grammar-ika-ijou
card_type: concept
front: '～{{以下|いか}} / ～{{以上|いじょう}}'
back: al massimo / almeno
example_jp: >-
  コスト{{4以下|よんいか}}またはコスト{{6以上|ろくいじょう}}のクリーチャーを{{1体|いったい}} {{選|えら}}ぶ。
example_it: >-
  Scegli 1 creatura di costo 4 o inferiore, oppure di costo 6 o superiore.
notes_it: >-
  È il pattern dei limiti numerici. Serve a capire quali carte rientrano nel
  filtro dell'effetto e quali no.
tags: [core, grammar, filter]
:::

:::card
id: card-turn-timing-concept
lesson_id: lesson-duel-masters-dm25-tcg-core-overview
entry_type: grammar
entry_id: grammar-turn-timing
card_type: concept
front: '～の{{始|はじ}}めに / ～の{{終|お}}わりに'
back: all'inizio di / alla fine di
example_jp: >-
  {{自分|じぶん}}のターンのはじめに、カードを{{1枚|いちまい}} {{引|ひ}}く。
example_it: >-
  All'inizio del tuo turno, pesca 1 carta.
notes_it: >-
  Fissa il momento preciso del turno in cui un effetto si attiva. Va letto
  prima del resto della frase.
tags: [core, grammar, timing]
:::

:::card
id: card-tadashi-concept
lesson_id: lesson-duel-masters-dm25-tcg-core-patterns
entry_type: grammar
entry_id: grammar-tadashi
card_type: concept
front: ただし
back: però / salvo che / con la seguente limitazione
example_jp: >-
  カードを{{2枚|にまい}} {{引|ひ}}く。ただし、{{手札|てふだ}}を{{1枚|いちまい}} {{捨|す}}てる。
example_it: >-
  Pesca 2 carte. Tuttavia, scarta 1 carta dalla mano.
notes_it: >-
  Introduce la limitazione finale dell'effetto. Dopo ただし va individuato il
  confine che restringe quello che hai appena letto.
tags: [core, grammar, restriction]
:::
