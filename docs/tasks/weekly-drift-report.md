# Weekly Documentation Drift Report Task

## Obiettivo

Confrontare i cambiamenti del codice dell'ultima settimana con la
documentazione strategica del progetto. Produrre un report in linguaggio
semplice che segnali dove la documentazione potrebbe essere diventata
obsoleta a causa di un cambio di direzione nel codice.

Non modificare nessun documento strategico. Solo segnalare.

---

## Cosa leggere

**Cambiamenti recenti nel codice:**
- `git log --oneline --since="7 days ago"` → elenco commit della settimana
- `git diff HEAD~7..HEAD -- src/ scripts/` → modifiche al codice sorgente

**Documentazione strategica da confrontare:**
- `docs/blueprint-operativo.md` → visione del prodotto e principi architetturali
- `docs/database.md` → design del database e strategia di persistenza
- `docs/content-format.md` → specifica del formato Markdown dei contenuti

**Stato attuale del codice da ispezionare:**
- `src/db/schema/` → tabelle e colonne del database
- `src/app/` → routing e struttura delle pagine
- `src/actions/` → operazioni disponibili lato server

---

## Come identificare una divergenza rilevante

Segnalare solo se si verifica almeno uno di questi casi:

- È stata aggiunta o rimossa una tabella del database non menzionata nei docs
- Il routing dell'app è cambiato in modo che contraddice la struttura descritta
  nel blueprint
- Una funzionalità descritta come "non obiettivo" o "futura" è stata
  implementata questa settimana
- Un principio architetturale dichiarato (es. "single source of truth",
  "local-first") sembra essere stato aggirato dal codice

**Non segnalare:**
- Bug fix e correzioni di errori
- Ottimizzazioni di performance
- Refactoring che non cambiano il comportamento
- Aggiunte di test
- Modifiche di stile o formato

---

## Come scrivere il report

Aggiorna il file `docs/drift-report.md` con questa struttura:

```markdown
## Report divergenze – settimana del <data>

### Nessuna divergenza trovata

Nessun cambio rilevante questa settimana.
```

oppure, per ogni divergenza trovata:

```markdown
## Report divergenze – settimana del <data>

### ⚠️ Possibile cambio di filosofia

**Cosa è cambiato nel codice:**
[Una frase semplice che descrive la modifica, senza termini tecnici complessi]

**Documento che potrebbe essere obsoleto:**
[Nome del file] – [quale sezione specifica]

**Perché potrebbe essere importante:**
[Spiegazione in linguaggio semplice: se questa modifica è una scelta
permanente, il documento non la riflette più. Se è temporanea, va bene così.]
```

Usare linguaggio semplice, comprensibile anche a chi non è sviluppatore.
Non usare gergo tecnico dove si può evitare.

---

## Procedura

1. Esegui `git log --oneline --since="7 days ago"` per vedere i commit recenti.
2. Esegui `git diff HEAD~7..HEAD -- src/ scripts/` per vedere le modifiche.
3. Leggi i documenti strategici elencati sopra.
4. Confronta: i cambiamenti nel codice contraddicono o estendono qualcosa
   che è documentato?
5. Se non ci sono divergenze rilevanti, scrivi "Nessuna divergenza trovata"
   nel report e non creare commit.
6. Se ci sono divergenze, aggiorna `docs/drift-report.md` con il report.
7. Committa solo se il report è cambiato:

```
chore(docs): drift report settimana del <data>
```

---

## Definizione di "sessione riuscita"

- `docs/drift-report.md` riflette lo stato reale della settimana.
- Nessun documento strategico è stato modificato.
- Il report usa linguaggio semplice e chiaro.
- Nessun commit creato se non c'era nulla da segnalare.
