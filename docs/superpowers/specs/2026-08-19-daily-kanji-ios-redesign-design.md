# Daily Kanji iOS — Redesign architetturale

**Data:** 2026-08-19  
**Stato:** approvato per implementazione  
**Riferimento visivo:** `exec-ae463d7f-5832-4115-9cd6-ca28bd818a24.png` (direzione “Study Deck”)

## Obiettivo

Ricostruire l'app iOS come companion nativa, leggibile e coerente per tre compiti distinti:

1. vedere e governare le schede mostrate dai widget;
2. completare il ripasso FSRS live;
3. cercare termini e grammatica nel glossario.

Il redesign conserva tutte le funzionalità e i contratti dati esistenti, ma sostituisce la schermata monolitica, il selettore segmentato globale, i dettagli tecnici esposti e la gerarchia tipografica incoerente. I widget e i relativi deep link restano invariati salvo gli adattamenti necessari alla nuova navigazione dell'app.

## Principi di prodotto

- **Widget-first:** la prima area è il companion del widget, non una dashboard generica.
- **Un compito per superficie:** configurazione, ripasso e ricerca non condividono più lo stesso scroll.
- **Progressive disclosure:** la scheda principale mostra ciò che serve per imparare; segnali FSRS, provenienza e diagnostica sono disponibili su richiesta.
- **Offline-first visibile nel comportamento, non nel gergo:** cache e fallback continuano a funzionare senza riempire l'interfaccia di messaggi tecnici.
- **Italiano coerente:** la navigazione è `Widget · Ripasso · Cerca`; i rating diventano `Di nuovo · Difficile · Bene · Facile`; `Daily`, `Prestudy` e `Last 3` diventano `Giornaliero`, `Prestudio` e `Ultime 3` nelle superfici utente.
- **Native iOS:** NavigationStack, TabView, Form, searchable, toolbar e ContentUnavailableView sono preferiti a controlli custom.

## Architettura informativa

### Shell principale

La root diventa un `TabView` con tre tab, ognuna con un proprio `NavigationStack` e stato di navigazione indipendente:

- **Widget** — scheda attuale, percorso attivo e cronologia recente.
- **Ripasso** — sessione FSRS live, reveal e valutazione.
- **Cerca** — glossario globale e dettaglio di termini/grammatica.

Un pulsante impostazioni coerente nella toolbar delle root apre una singola superficie `Impostazioni`. Il vecchio picker segmentato `Daily / Review / Glossario` viene eliminato.

I deep link `dailykanji://card/...` continuano a selezionare la scheda richiesta e portano automaticamente alla tab `Widget`. Cambiare tab non ricarica le timeline WidgetKit.

### Widget

La root `Widget` segue la direzione visiva scelta, adattandola ai dati reali:

1. grande titolo `Widget` e pulsante impostazioni;
2. riga compatta `Percorso widget`, con modalità, media e conteggio reale;
3. scheda principale con fronte giapponese, lettura, significato, audio e un solo esempio;
4. disclosure `Perché questa scheda` per priorità, difficoltà, stabilità, errori, note e provenienza;
5. sezione compatta `Recenti`, limitata alle ultime esposizioni e con accesso alla cronologia completa.

Il progress bar `1 di 12` del mock non viene riprodotto: il selettore non ha una posizione lineare affidabile e mostrare un avanzamento inventato violerebbe il contratto dati. Al suo posto compare un contesto reale come `250 schede disponibili`.

`Percorso widget` apre un foglio nativo con `Form`. La modalità e il media restano in bozza; `Annulla` scarta e `Applica` salva nell'App Group e ricarica le timeline. Questo preserva l'attuale comportamento atomico senza esporre i controlli in fondo alla schermata principale.

### Ripasso

`Ripasso` conserva il flusso live esistente:

1. fronte della scheda;
2. azione primaria `Mostra risposta`;
3. lettura, significato, pitch, audio, esempio e note;
4. quattro rating FSRS con intervallo successivo.

La coda è mostrata come informazione secondaria nella testata. In assenza di configurazione la tab mostra uno stato vuoto prodotto (`Ripasso non disponibile`) con accesso a `Impostazioni`, senza endpoint, token o copy da sviluppatore. Un errore temporaneo conserva l'ultima sessione come sola lettura e offre `Riprova`.

### Cerca

`Cerca` usa `.searchable` nella navigation bar con prompt `Termine, lettura o significato`. La lista è compatta:

- termine o pattern;
- lettura;
- significato breve;
- tipo (`Termine` o `Grammatica`);
- audio, se disponibile.

Il tap apre un dettaglio nello stesso `NavigationStack`, non una sheet. Il dettaglio organizza definizione, pitch accent, esempi/nota e provenienza in sezioni leggibili. Le righe non ripetono note lunghe o nomi media completi.

### Impostazioni

Una sola `Form` raccoglie:

- **Dati:** origine dello snapshot, ultimo aggiornamento, conteggio schede/voci e azione `Aggiorna dati` quando disponibile;
- **Ripasso:** disponibilità del servizio, stato sintetico e impostazioni notifiche;
- **Widget:** percorso attivo, conteggio e accesso allo stesso editor di percorso;
- **Informazioni:** versione app e descrizione locale/offline.

Endpoint e token restano configurazione sicura di build e non diventano campi UserDefaults. L'app non mostra i valori sensibili. Se una capability non è inclusa nell'installazione, lo comunica in linguaggio utente.

## Architettura SwiftUI

### Confini dei file

`ContentView.swift` diventa una shell piccola. La UI viene divisa per feature:

```text
App/
  ContentView.swift
  DesignSystem/
    DailyKanjiDesign.swift
    DailyKanjiSharedViews.swift
  Features/
    Widget/
      WidgetHomeView.swift
      WidgetCardView.swift
      WidgetScopeSheet.swift
      WidgetHistoryView.swift
    Review/
      ReviewHomeView.swift
      ReviewCardView.swift
    Search/
      GlossaryHomeView.swift
      GlossaryRowView.swift
      GlossaryDetailView.swift
    Settings/
      DailyKanjiSettingsView.swift
  Presentation/
    DailyKanjiPresentations.swift
```

I nomi finali possono essere accorpati quando due file produrrebbero componenti artificialmente piccoli, ma nessuna view root deve tornare a possedere tutte le feature.

### Stato e dipendenze

`DailyKanjiAppModel` resta la source of truth per selezione, scope, cache, sync, deep link e sessione live: sono contratti già coperti da un'estesa suite di test e condivisi con il widget. Il redesign non riscrive ranking, cache o timeline per il solo gusto di farlo.

Le view ricevono il model e closure di navigazione; trattengono solo stato UI effimero (sheet aperte, risposta rivelata, disclosure). `DailyKanjiGlossarySearchModel` continua a isolare indicizzazione e debounce. Le presentazioni testabili e il copy vengono spostati fuori dalle view monolitiche.

La selezione della tab viene rinominata da `DailyKanjiAppSection` a `DailyKanjiAppTab` con casi `.widget`, `.review`, `.search`. La semantica dei deep link resta identica.

## Sistema visivo

- SF Pro e font di sistema giapponese; nessun font custom.
- Accent color coral-orange esistente, usato solo per selezione, audio e piccoli segnali.
- Sfondo `systemGroupedBackground`, superfici `secondarySystemGroupedBackground`, separatori di sistema.
- Raggio base 18–20 pt, bordo hairline; niente ombre pesanti, gradienti o card annidate.
- Margine orizzontale 20 pt; scala spaziature 4/8/12/16/20/24/32.
- Tipografia semantica (`largeTitle`, `title`, `title3`, `body`, `callout`, `caption`) con `@ScaledMetric` solo per il fronte giapponese.
- Target interattivi minimi 44×44 pt.

Il fronte giapponese può occupare due righe e usa una scala dinamica controllata; non viene forzato in una riga con riduzione estrema. A dimensioni Accessibility, le righe lettura/audio e i rating passano a layout verticali tramite `ViewThatFits` o controllo della Dynamic Type size.

## Accessibilità e comportamento

- Dynamic Type verificato fino ad Accessibility XXL su tutte le root e i dettagli.
- VoiceOver legge fronte, lettura e significato come un gruppo logico; i pulsanti audio hanno label contestuali.
- Il colore non è l'unico indicatore di selezione o stato.
- Le animazioni rispettano Reduce Motion; il cambio scheda usa una transizione breve e non indispensabile.
- Il focus di ricerca e la navigazione seguono i componenti di sistema.
- Light e Dark Mode usano solo colori semantici, salvo l'accent color verificato per contrasto.

## Stati ed errori

- **Dati locali disponibili, sync assente:** contenuto normale; dettagli in Impostazioni.
- **Sync in corso:** progress solo nell'azione di aggiornamento, senza bloccare la lettura.
- **Sync fallito:** cache ancora utilizzabile; messaggio sintetico in Impostazioni e possibilità di riprovare.
- **Scope vuoto:** `ContentUnavailableView` con azione `Cambia percorso`.
- **Ripasso non configurato:** stato vuoto e link a Impostazioni.
- **Ripasso offline con sessione stale:** lettura consentita, grading disabilitato, `Riprova` disponibile.
- **Ricerca senza risultati:** query mantenuta e stato vuoto chiaro.
- **Audio assente:** controllo disabilitato ma non sostituito da testo diagnostico.

## Contratti protetti

- Nessuna modifica visiva al target WidgetKit salvo necessità documentata.
- Nessuna rete dal widget.
- Scope confermato condiviso tramite App Group.
- Cambio scope ricarica le timeline una sola volta; navigazione e deep link no.
- Deep link esistenti restano compatibili.
- Dataset locale e cache rimangono utilizzabili senza configurazione remota.
- Nessun segreto viene persistito o mostrato nella UI.

## Verifica

### Automatica

- aggiornare/aggiungere test per tab, deep link, copy/presentation, scope draft/apply, stati sync e ripasso;
- mantenere verdi tutti i test core, inclusi selettore, cache, timeline e widget source contracts;
- eseguire `./scripts/with-node.sh pnpm test:ios-ops`;
- eseguire `./scripts/with-node.sh pnpm daily-kanji:test`;
- build Debug per simulatore con Xcode.

### Visuale su simulatore

Acquisire e controllare almeno:

- Widget: scheda, disclosure, scope sheet, cronologia;
- Ripasso: non configurato, fronte, risposta e rating;
- Cerca: lista, risultati, nessun risultato e dettaglio;
- Impostazioni;
- deep link da widget;
- Light/Dark Mode;
- Dynamic Type Large e Accessibility XXL;
- almeno un viewport compatto e uno standard.

Il confronto finale usa il mock scelto come direzione di gerarchia e densità, senza copiare dati fittizi come il progress lineare.

## Review indipendente e criterio di completamento

Dopo l'implementazione, un reviewer indipendente deve ispezionare diff, architettura, copy, layout, accessibilità, screenshot e verifiche. Ogni osservazione azionabile viene corretta e sottoposta nuovamente allo stesso reviewer finché non dichiara esplicitamente green.

Il task è completo solo quando:

1. tutti i gate richiesti passano;
2. il reviewer è green;
3. il target WidgetKit non presenta regressioni;
4. le modifiche iOS e la documentazione sono committate e pushate senza includere cambi estranei.
