# Daily AGENTS.md Sync Task

## Obiettivo

Mantenere `AGENTS.md` allineato con la struttura reale del progetto.
Aggiornare solo le sezioni derivabili dal codice. Non toccare le sezioni
che contengono decisioni progettuali scritte dall'utente.

---

## Sezioni da aggiornare (derivabili dal codice)

### Stack
Deriva da `package.json` → campi `dependencies` e `devDependencies`.
Aggiorna versioni e tecnologie se cambiate.

### Mappa delle directory
Deriva dalla struttura reale di `src/`, `scripts/`, `tests/`, `content/`,
`drizzle/`, `docs/`. Per ogni directory:
- Aggiungi eventuali nuove sottodirectory con una descrizione breve
- Rimuovi directory che non esistono più
- Aggiorna descrizioni se il contenuto è cambiato in modo significativo

### Comandi canonici
Deriva da `package.json` → campo `scripts`.
Aggiungi nuovi script, rimuovi quelli eliminati, aggiorna nomi cambiati.

---

## Sezioni da NON toccare

- Il paragrafo iniziale di descrizione del progetto
- La sezione "Entità core del DB"
- La sezione "Invarianti da non violare mai"

Queste sezioni contengono decisioni progettuali, non fatti derivabili dal
codice. Lasciale esattamente come sono.

---

## Procedura

1. Leggi il contenuto attuale di `AGENTS.md`.
2. Leggi `package.json` per stack e script.
3. Esplora la struttura delle directory elencate sopra.
4. Confronta con le sezioni corrispondenti in `AGENTS.md`.
5. Se non c'è nessuna differenza rilevante, non fare nulla e termina.
6. Se ci sono differenze, aggiorna solo le sezioni indicate, preservando
   il formato e lo stile esistente.
7. Esegui `pnpm check` per verificare che nessuna modifica abbia rotto
   qualcosa (non dovrebbe, ma è un controllo di sicurezza).
8. Se `pnpm check` è verde e `AGENTS.md` è cambiato, committa:

```
chore(agents): sync AGENTS.md con struttura corrente
```

Se non c'è nulla da aggiornare, non creare commit vuoti.

---

## Definizione di "sessione riuscita"

- `AGENTS.md` riflette la struttura reale del progetto.
- Le sezioni decisionali sono intatte.
- Nessun commit creato se non c'era nulla da aggiornare.
- `pnpm check` verde.
