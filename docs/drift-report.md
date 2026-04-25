## Report divergenze - settimana del 24 aprile 2026

### Risolto il 25 aprile 2026 - Kanji Clash stabile

**Cosa era cambiato nel codice:**
Kanji Clash non era piu solo una coda automatica separata: la Review poteva
forzare un contrasto, archiviarlo o ripristinarlo, e il database salvava questi
contrasti con tabelle dedicate.

**Documenti riallineati:**

- `docs/database.md`: ora include Kanji Clash nella struttura implementata, nello
  schema v1 e nelle decisioni implementative sulle tabelle `kanji_clash_*`.
- `docs/blueprint-operativo.md`: ora include Kanji Clash tra gli obiettivi
  funzionali, le entita core, il routing principale e la roadmap.
- `README.md` e `AGENTS.md`: ora riflettono la struttura `src/features/*` e la
  separazione tra feature canoniche e shim legacy.

**Stato:**
Nessun drift aperto registrato in questo report dopo il riallineamento del 25
aprile 2026.
