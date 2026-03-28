# Weekly Refactoring Task

## Obiettivo

Ridurre la superficie di contesto necessaria per future sessioni AI. Lo scopo è
rendere il codice più modulare così che ogni sessione possa caricare solo i
file rilevanti, consumando meno token.

**Regola assoluta**: non aggiungere nessuna nuova funzionalità. Solo
riorganizzazione strutturale.

---

## Procedura

### 1. Analisi

Esplora la struttura del progetto e identifica le opportunità di refactoring
seguendo questa priorità:

1. **File sorgente > 300 righe** in `src/` → candidati da splittare per
   responsabilità singola
2. **Logica duplicata** tra moduli diversi → candidata a essere estratta in
   una utility condivisa in `src/lib/`
3. **Boundary poco chiare** tra moduli → candidata a riorganizzazione
   degli import
4. **Dead code accertato** (funzioni/variabili mai usate) → da rimuovere
5. **Nomi poco descrittivi** → da rinominare per self-documentation

### 2. Scelta

Scegli **una sola area** da trattare in questa sessione. Privilegia il
rapporto impatto/rischio: aree con molti file piccoli che importano uno stesso
file grande hanno impatto alto; aree con logica complessa e test scarsi hanno
rischio alto.

Documenta brevemente nel commit message perché hai scelto quella area.

### 3. Implementazione

Procedi in modo incrementale:

- Fai una modifica alla volta.
- Dopo ogni modifica esegui `pnpm check` (lint + typecheck + test).
- Se `pnpm check` fallisce, correggi **prima** di procedere con la modifica
  successiva.
- Non aprire PR: committa direttamente su `main`.

### 4. Commit

Quando `pnpm check` è verde, committa con questo formato:

```
refactor(<area>): <descrizione breve in italiano>

<facoltativo: 1-2 righe che spiegano perché questa struttura riduce il
contesto necessario per sessioni AI future>
```

Esempi:
- `refactor(review): estrai logica coda in src/lib/review-queue.ts`
- `refactor(db): separa query glossary in file dedicato`
- `refactor(components/ui): rimuovi dead code in Tooltip`

---

## Vincoli non negoziabili

- **Non modificare** i file in `content/` (bundle media Markdown).
- **Non modificare** i file in `drizzle/` (migration SQL).
- **Non modificare** lo schema in `src/db/schema/` a meno che non si stia
  solo spostando codice già esistente senza cambiare la struttura del DB.
- **Non toccare** `tests/` a meno che il file che si sta splittando contenga
  test inline che devono seguire il codice spostato.
- **Non aggiungere** dipendenze npm.
- **Non cambiare** il comportamento osservabile dell'app.
- **Non aprire** Pull Request: commit diretto su `main`.

---

## Definizione di "sessione riuscita"

- `pnpm check` verde al termine.
- Almeno un commit su `main` con messaggio in formato `refactor(...)`.
- Nessun file in `content/`, `drizzle/`, o `tests/` modificato senza
  ragione esplicita.
- La logica riorganizzata è più facile da localizzare per un agente AI che
  parte da zero senza contesto.
