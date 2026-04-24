## Report divergenze – settimana del 24 aprile 2026

### ⚠️ Possibile cambio di filosofia

**Cosa è cambiato nel codice:**
Kanji Clash non è più solo una coda automatica separata: la Review può forzare
un contrasto, archiviarlo o ripristinarlo, e il database salva questi contrasti
con tabelle dedicate.

**Documento che potrebbe essere obsoleto:**
`docs/database.md` – sezioni "Struttura implementata" e "Schema coperto in v1".

**Perché potrebbe essere importante:**
Se questa è una direzione stabile, il documento fa sembrare che lo schema core
copra solo content, glossary, review e progress. In realtà Kanji Clash ha ormai
stato persistente proprio, incluse le tabelle storiche delle coppie e le nuove
tabelle dei contrasti manuali.

### ⚠️ Drift ancora aperto su Kanji Clash

**Cosa è cambiato nel codice:**
La route `/kanji-clash` resta una superficie principale dell'app e ora è anche
collegata dalla Review tramite il flusso `+ Contrasto`.

**Documento che potrebbe essere obsoleto:**
`docs/blueprint-operativo.md` – sezioni "Entita core" e "Routing UI consigliato".

**Perché potrebbe essere importante:**
Il blueprint continua a descrivere le superfici principali senza Kanji Clash. Se
Kanji Clash è ormai parte stabile del prodotto, il documento strategico non
aiuta più a capire dove vive questa modalità e quali stati personali aggiunge.
