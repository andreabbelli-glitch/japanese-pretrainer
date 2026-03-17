# Direzione UX/UI

## Scopo

Questo documento definisce la direzione UX/UI per i task frontend iniziali della
webapp di studio del giapponese. L'obiettivo non e produrre una UI finale
pixel-perfect, ma una base concreta e implementabile in Next.js che orienti
Task 06, 07, 08 e 09 senza ricadere in un layout da admin panel.

## Assunzioni operative

- App single-user, locale-first, usata soprattutto in sessioni individuali di
  studio da 15 a 60 minuti.
- Contenuto primario testuale, con lesson Markdown importate e card review.
- Nessun editing avanzato in-app nella prima fase.
- L'utente salta spesso tra lettura, lookup nel glossary e review rapida.
- I breakpoint devono introdurre pattern diversi, non solo ridurre il layout.

## North Star

La UI deve sembrare una scrivania di studio editoriale: superfici calde,
tipografia sobria, comandi discreti e contenuto sempre al centro. L'app non
deve trasmettere "dashboard", ma "ambiente di concentrazione". La gerarchia
visiva parte dal testo giapponese e dagli obiettivi di studio del momento, non
dalle metriche.

## Principi UX

### 1. Leggere prima, controllare dopo

Nel reader e nel glossary i controlli devono stare in fasce stabili o in
superfici secondarie, mai mescolati dentro il testo. La lettura resta il primo
livello visivo; toggle, filtri e azioni sono vicini ma meno rumorosi.

### 2. Una decisione primaria per schermata

- dashboard: capire da dove riprendere;
- media detail: scegliere l'area di studio;
- reader: leggere e chiarire dubbi senza perdere il punto;
- glossary: trovare una entry;
- review: dare il voto alla card nel minor attrito possibile.

### 3. Tool contestuali, non permanenti

Tooltip, sheet, drawer e pannelli contestuali compaiono solo quando servono.
Le informazioni di supporto sono ricche, ma non occupano spazio fisso se non in
schermate dove portano valore continuo, come la rail delle lesson su desktop.

### 4. Il progresso deve rassicurare, non gamificare

Progress bar sottili, metriche compatte, linguaggio calmo. Niente badge
appariscenti, streak celebrativi o numeri ridondanti. L'obiettivo e orientare,
non creare rumore motivazionale.

### 5. Mobile e desktop hanno ruoli diversi

Desktop privilegia lettura lunga, densita controllata e hover/focus.
Mobile privilegia continuita, una mano sola, bottom sheet e action dock
persistenti. Non va implementata una miniatura del desktop.

## Architettura dell'esperienza

| Schermata | Ruolo UX | Cosa deve far capire subito |
| --- | --- | --- |
| Dashboard | punto di ingresso | cosa studiare adesso |
| Media detail | home base del media | dove proseguire tra textbook, glossary, review, progress |
| Textbook reader | lettura profonda | dove sono, cosa sto leggendo, come chiarire un dubbio |
| Glossary | lookup e consolidamento | come trovare e capire una entry in pochi secondi |
| Review session | loop rapido | quanti elementi restano e quale risposta dare |

## Direzione visiva

### Mood

Caldo, editoriale, composto. Il riferimento non e un quaderno scolastico
infantile ma una scrivania ordinata con carta, note e margini puliti.

### Palette

- sfondi principali color carta, mai bianco puro;
- testo inchiostro scuro, mai nero pieno;
- accento principale verde muschio per stati positivi, filtri attivi e azioni
  di studio;
- accento secondario vermiglio spento per attenzione, "Again" e stati da
  recuperare;
- ambra tenue per stati intermedi;
- blu freddo e viola esclusi dalla palette primaria.

### Superfici

- canvas app: gradiente molto leggero carta -> lino per evitare lo schermo
  piatto;
- pannelli: blocchi pieni, chiari, con bordo sottile caldo e ombra morbida;
- card importanti: piu aria, meno cromia;
- elementi secondari: chips e pill con riempimento appena sporco, non pillole
  ipersature.

### Contrasto

Il contrasto deve favorire il testo continuo e il giapponese annotato.
Preferire rapporti di contrasto alti sui contenuti principali e medi sui
metadati. Nessun testo essenziale va affidato solo al colore.

## Tipografia

### Famiglie consigliate

- display e titoli editoriali: `Newsreader`
- body UI e controlli: `Instrument Sans`
- testo giapponese, lemma e furigana: `BIZ UDPGothic`

Questa combinazione e realistica in Next.js con `next/font/google`, evita
l'effetto template e mantiene il giapponese piu leggibile del testo italiano.

### Regole tipografiche

- I titoli di pagina usano il serif editoriale solo nei punti di struttura:
  home, media title, testate di sezione, intestazione card review.
- Tutti i controlli, label, tab e microcopy usano il sans.
- Il testo giapponese usa sempre la famiglia dedicata, anche dentro paragrafi
  misti.
- Il corpo giapponese deve risultare leggermente piu grande del corpo italiano.

### Scala consigliata

- titolo hero: `2.25rem` desktop, `1.875rem` mobile, `font-weight: 600`
- titolo sezione: `1.5rem` desktop, `1.25rem` mobile
- body UI italiano: `1rem`, `line-height: 1.6`
- testo giapponese inline: `1.0625rem` mobile, `1.125rem` desktop,
  `line-height: 1.9`
- lemma glossary / front review: `1.5rem` mobile, `1.75rem` desktop
- furigana (`rt`): circa `0.55em` del corpo giapponese

### Regole per furigana

- `ruby` sempre allineato sopra, con `rt` leggibile ma discreto.
- In modalita `on`, il layout accetta l'altezza extra del `rt`.
- In modalita `off`, il `rt` viene nascosto del tutto per privilegiare la
  scorrevolezza.
- In modalita `hover`, su desktop il `rt` appare su hover/focus; su mobile il
  contenuto di supporto mostra la lettura nella sheet.

## Layout e griglia

### Shell globale

Per Task 06 lo shell raccomandato e:

- desktop: top bar sottile e orizzontale, non sidebar fissa da applicazione
  gestionale;
- mobile: bottom navigation con 5 destinazioni primarie;
- contenuto su container centrale con grandi margini respiranti.

Motivazione: una sidebar persistente farebbe sembrare il prodotto un backoffice.
La top bar mantiene il tono editoriale e lascia il reader libero di usare una
rail propria solo dove serve.

### Larghezze massime

- dashboard e media detail: `max-width: 1180px`
- glossary desktop: `max-width: 1280px`
- reader workspace desktop: `max-width: 1360px`
- review stage: `max-width: 980px`
- colonna di lettura reader: tra `640px` e `760px`, mai piu larga

### Spaziatura

La spaziatura deve avere ritmo largo e prevedibile. Base 4px, ma i salti utili
sono 8, 12, 16, 24, 32, 40 e 56px. Nel reader la distanza verticale tra blocchi
di contenuto deve stare spesso tra 24 e 32px, non tra 12 e 16px.

### Bordi e ombre

- radius generali: 12px per controlli, 18px per pannelli, 24px per sheet
- bordi sottili caldi piu importanti delle ombre
- ombre morbide e corte, mai floating card scure da SaaS

## Schermate chiave

### Dashboard

#### Obiettivo

Far capire in 5 secondi cosa riprendere, evitando una parete di statistiche.

#### Struttura consigliata

- hero di ripresa studio con ultimo media aperto e CTA primaria;
- modulo review di oggi con numero di card dovute e tempo stimato;
- griglia leggera dei media attivi;
- piccolo riepilogo progressi, separato per textbook, glossary coverage e
  review, senza grafici complessi.

#### Scelte UX

- Una sola CTA primaria sopra la piega: `Riprendi studio`.
- Le metriche sono secondarie e sintetiche.
- Lo stato vuoto deve spiegare come iniziare un nuovo media senza sembrare una
  configurazione tecnica.

### Media Detail

#### Obiettivo

Essere la base operativa del singolo media, non una pagina vetrina.

#### Struttura consigliata

- header con titolo, tipo media, descrizione breve e stato corrente;
- quattro entry point evidenti: textbook, glossary, review, progress;
- sezione "Continua da qui" con lesson corrente o prossima review;
- snapshot dei segmenti o delle lesson recenti;
- elenco breve delle entry introdotte di recente.

#### Scelte UX

- Gli entry point sono card larghe, non tab minuscoli.
- Le metriche vengono spiegate in linguaggio naturale, per esempio
  "12 card dovute oggi", non solo "12 due".

### Textbook Reader

#### Obiettivo

Sostenere lettura lunga, chiarimento rapido dei dubbi e senso costante di
orientamento.

#### Layout base desktop

- top study header sticky;
- rail lesson sticky a sinistra;
- colonna centrale di lettura;
- nessun inspector fisso obbligatorio in v1.

#### Layout base mobile

- top bar con back e titolo lezione;
- study strip sticky subito sotto con CTA `Lezioni` e controllo furigana;
- contenuto a tutta larghezza leggibile;
- bottom sheet per approfondimenti e rail lesson.

#### Componenti chiave

- `study header`: breadcrumb leggero, titolo lezione, progresso, toggle
  furigana, azione completa/riprendi;
- `lesson rail`: elenco segmenti/lesson con stato e posizione corrente;
- `annotated token`: termine o pattern con sottolineatura morbida e stato attivo;
- `callout`: note grammaticali e blocchi esplicativi ben separati dal testo;
- `lesson footer`: prev / next / mark complete.

#### Scelte UX vincolanti

- Il reader non deve mai superare la larghezza ottimale di lettura.
- Tooltip desktop con apertura rapida ma non istantanea: circa 120ms.
- Il tooltip deve cercare una posizione che non copra la riga attiva, quando
  possibile.
- Il click su token blocca il tooltip aperto per consentire interazione.
- Su mobile il tap apre una bottom sheet alta circa il 70% viewport, non un
  tooltip flottante minuscolo.
- Il testo giapponese ha contrasto e dimensione superiori al testo di contorno.

### Glossary

#### Obiettivo

Essere uno strumento di lookup e consolidamento, non un semplice indice.

#### Layout base desktop

- barra ricerca sticky in alto;
- pannello risultati a sinistra;
- preview detail a destra;
- filtri come chips compatte, non sidebar filtri da e-commerce.

#### Layout base mobile

- input ricerca in evidenza sopra la piega;
- chips filtri in scorrimento orizzontale;
- lista risultati in card compatte;
- tap su risultato apre detail page o full-screen sheet.

#### Scelte UX

- Ogni risultato mostra lemma/pattern, lettura, significato, lesson di
  introduzione e stato personale.
- L'highlight della query deve essere preciso e sobrio.
- I filtri attivi devono essere visibili con un solo colpo d'occhio.

### Review Session

#### Obiettivo

Ridurre l'attrito decisionale e mantenere un ritmo calmo ma veloce.

#### Layout base desktop

- header di sessione minimale con avanzamento;
- card stage centrale;
- area azioni fissa in basso o subito sotto la card;
- secondarie in menu contestuale, non accanto ai voti.

#### Layout base mobile

- header sottile con progresso;
- card stage a piena attenzione;
- action dock bottom sticky;
- grading in griglia 2x2 dopo il reveal.

#### Scelte UX vincolanti

- Prima del reveal esiste una sola CTA primaria: `Mostra risposta`.
- Dopo il reveal i quattro voti appaiono insieme con etichette e intervallo
  previsto.
- `Segna come gia noto`, `Reset` e `Sospendi` stanno in menu secondario.
- Il cambio card usa transizione breve di dissolvenza/slittamento, non flip 3D.
- Il focus resta sulla card; il resto dell'app si ritira visivamente.

## Pattern responsive

### Breakpoint di lavoro

- `0-639px`: mobile
- `640-1023px`: mobile largo / tablet verticale
- `1024-1439px`: desktop standard
- `1440px+`: desktop ampio

### Navigazione

- desktop: top bar con navigazione principale sempre visibile
- mobile: bottom nav persistente per home, media, glossary, review, settings
- nelle pagine interne del media la navigazione secondaria resta contestuale al
  media, non nella nav globale

### Tooltip e sheet

- desktop: hover card o popover ancorato
- mobile: bottom sheet con swipe down per chiusura
- tablet: stesso pattern mobile se l'input prevalente e touch

### Drawer e rail

- lesson rail fissa solo da `1024px` in su
- sotto `1024px` la rail diventa drawer o sheet richiamata da bottone
- glossary preview split-pane solo da `1024px` in su

### Azioni primarie

- desktop: inline nelle header band o dock sotto contenuto
- mobile: sticky bottom bar per review e azioni contestuali del reader
- evitare CTA flottanti circolari: non coerenti con il tono editoriale

## Componenti chiave

### Header band

Fascia sticky sottile con sfondo leggermente piu opaco del canvas. Serve per
ancorare titolo, stato e due o tre controlli importanti. Non deve trasformarsi
in toolbar densa.

### Study card

Card principale per dashboard, media entry point e review stage. Superficie
chiara, bordo caldo, titolo serif o lemma giapponese ben dimensionato, metadati
leggeri.

### Segmented control

Usare per furigana `Off / Hover / On` e per viste compatte, con pill ampia e
stati ben leggibili. Su mobile deve restare abbastanza alto per il tocco, anche
se il testo viene abbreviato.

### Chips

Usare per filtri, stato review e tag segmento. Bassa saturazione, molto padding
orizzontale, nessun effetto pill glossy.

### Bottom sheet

Elemento fondamentale su mobile per tooltip ricchi, rail lesson e secondarie di
review. Deve avere handle visibile, title row chiara e altezza massima intorno
al 70-80% viewport.

## Motion

### Principi

- breve, leggibile, intenzionale;
- usata per orientare, non decorare;
- sempre compatibile con `prefers-reduced-motion`.

### Motion consigliata

- page enter: fade + rise 12px, `180-220ms`
- tooltip/popover: fade + scale leggera, `120-160ms`
- bottom sheet: slide up + fade backdrop, `220-260ms`
- review next card: fade cross + lateral shift 16px, `160-200ms`
- hover micro-feedback: solo colore e ombra molto lieve

## Raccomandazioni implementative per Next.js

- Caricare i font con `next/font/google` e mapparli a custom properties globali.
- Usare CSS custom properties come fonte unica per colori, spaziature e testo.
- Rendere il testo lesson dentro `article` semantico; i token annotati devono
  essere elementi focusable.
- Usare React solo per interazioni locali di tooltip, drawer e review dock; la
  struttura delle pagine puo restare server-rendered.
- Evitare componenti generici da libreria con look SaaS predefinito se non
  vengono rispogliati visivamente.

## Decisioni da mantenere stabili nei task successivi

- top navigation desktop invece di sidebar globale;
- bottom sheet come risposta mobile principale a tooltip e pannelli contestuali;
- reader con rail lesson desktop e colonna di lettura stretta;
- review session come modalita focalizzata, separata dal resto della UI;
- progress silenzioso e diviso in textbook, glossary coverage e review.
