## Report divergenze – settimana del 10 aprile 2026

### ⚠️ Possibile cambio di filosofia

**Cosa è cambiato nel codice:**
Questa settimana e stata aggiunta una nuova modalita di studio chiamata `Kanji
Clash`, con una pagina dedicata fuori dal percorso dei singoli media
(`/kanji-clash`) e ingressi dedicati dall'interfaccia.

**Documento che potrebbe essere obsoleto:**
`docs/blueprint-operativo.md` – sezione `7.3 Routing UI consigliato`

**Perché potrebbe essere importante:**
Se `Kanji Clash` resta una parte stabile del prodotto, il blueprint non descrive
piu tutta la navigazione reale dell'app. Oggi racconta solo glossary, review,
textbook, progress e pagine media.

### ⚠️ Possibile cambio di filosofia

**Cosa è cambiato nel codice:**
Il database ora salva anche lo stato e la cronologia di `Kanji Clash`, con
tabelle dedicate (`kanji_clash_pair_state` e `kanji_clash_pair_log`) e nuove
preferenze utente collegate a questa modalita.

**Documento che potrebbe essere obsoleto:**
`docs/database.md` – sezione `Schema coperto in v1`

**Perché potrebbe essere importante:**
Se questa modalita non e temporanea, il documento sul database non mostra piu
tutto cio che viene salvato davvero. Questo rende piu difficile capire il
perimetro reale della persistenza e delle migrazioni.
