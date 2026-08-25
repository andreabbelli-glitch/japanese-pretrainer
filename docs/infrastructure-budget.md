# Budget infrastrutturale Turso / Vercel

Ultimo aggiornamento: 2026-08-23.

Questa applicazione e' privata e monoutente. Il budget viene quindi progettato
come un limite strutturale del traffico generato dall'app, non come una speranza
basata sul basso numero di utenti.

## Limiti di riferimento

Al momento della progettazione:

- Turso Free include 500 milioni di righe lette, 10 milioni di righe scritte e
  5 GB di storage al mese: <https://turso.tech/pricing>;
- Vercel Hobby include 1 milione di Function Invocations, 4 CPU-hours e 360
  GB-hours di memoria al mese: <https://vercel.com/docs/plans/hobby>;
- una Vercel Function non puo' restituire piu' di 4,5 MB:
  <https://vercel.com/docs/functions/limitations>;
- su Hobby i cron possono essere schedulati al massimo una volta al giorno:
  <https://vercel.com/docs/cron-jobs/usage-and-pricing>.

`vercel.json` mantiene le Function in `dub1`; il database configurato usa
`aws-eu-west-1`. Entrambi sono in Irlanda, quindi il tratto sincrono
Vercel-Turso non attraversa oceani.

## Causa dell'incidente

Il vecchio endpoint iOS costruiva il dataset completo dentro ogni GET
autenticata. Una singola build sul bundle reale richiedeva cinque gruppi di
query globali e, misurata con SQLite, circa 2.129.087 VM step. L'app poteva
sincronizzare ogni quattro ore, cioe' fino a circa 180 volte in 30 giorni:
circa 383 milioni di VM step solo per questa funzione, prima di dashboard,
review, import e altri flussi.

Lo stesso GET restituiva 3.890.395 byte non formattati:

- card dinamiche: 415.984 byte;
- glossario stabile: 3.474.306 byte;
- envelope JSON: il resto.

Il glossario rappresentava quindi circa l'89% del payload ed era riletto e
rispedito senza necessita' a ogni sync.

Inoltre, il cold start Vercel avviava una query speculativa della review globale
e ogni voto mobile ricaricava una sessione completa. Le card idratate della
review condividevano un tag globale, per cui un voto invalidava anche contenuti
stabili non modificati.

Un secondo audit sul Turso remoto ha individuato un moltiplicatore rimasto
nella costruzione delle card Daily Kanji. La CTE `subject_identity` ricostruiva
la canonical identity di tutte le card a ogni query usando `card`,
`card_entry_link`, una sottoquery correlata e aggregazioni. Turso ha osservato
31.900.000 righe lette in 6 esecuzioni della stessa query: circa 5,32 milioni di
righe per esecuzione. Gli indici attesi erano presenti; il problema era la
ricostruzione della proiezione dentro query successive con join e window
function, non un indice mancante.

## Architettura vincolata al budget

### Snapshot Daily Kanji

La tabella `runtime_snapshot` conserva due proiezioni atomiche:

| Snapshot | Contenuto | Refresh minimo | Limite payload |
| --- | --- | ---: | ---: |
| `daily-kanji:ios-dataset:v1` | sole card dinamiche | 22 ore | 1.000.000 byte |
| `daily-kanji:ios-glossary:v1` | glossario stabile | 6 giorni | 4.000.000 byte |

Il cron autenticato `/api/internal/daily-kanji/refresh` e' l'unico percorso
runtime che costruisce gli snapshot. Il limite persistente `refresh_not_before`
fa saltare le build troppo ravvicinate. In un mese di 31 giorni limita le card
a 34 build anche se il job viene invocato piu' spesso; il cron ordinario ne fa
al massimo 31. Il glossario puo' essere costruito al massimo 6 volte.
Un lease atomico in `runtime_job_lease`, con scadenza di 5 minuti, impedisce a
retry o consegne concorrenti di superare insieme il controllo e duplicare la
build. Un lease abbandonato dopo un crash scade automaticamente.

Le route pubbliche autenticate `/api/daily-kanji/ios-dataset` e
`/api/daily-kanji/ios-glossary` eseguono soltanto la lettura della rispettiva
riga. Non fanno bootstrap e non possono lanciare query editoriali globali. Se
lo snapshot manca rispondono `503`, lasciando all'app il fallback locale.

Entrambe restituiscono il JSON gia' serializzato, ETag e cache privata. Le card
hanno una cache di 6 ore, il glossario di 7 giorni. Un payload oltre il limite
fallisce prima dell'upsert: lo snapshot precedente resta servibile e nessuna
Function puo' avvicinarsi accidentalmente al limite Vercel di 4,5 MB.

L'app iOS:

- prova il refresh automatico delle card al massimo una volta al giorno;
- usa la cache HTTP/ETag per il glossario settimanale;
- conserva l'ultimo glossario valido se il relativo endpoint non e'
  disponibile;
- continua a usare cache condivisa o bundle senza bloccare l'interfaccia;
- non consente al widget di fare rete.

### Review

La review globale resta la source of truth e continua a deduplicare cross-media.
Le ottimizzazioni non rilassano la correttezza delle mutazioni:

- la finestra pronta lato server passa da 3 a 8 card;
- su iOS, dopo `good` o `easy`, una card gia' presente nel buffer viene mostrata
  subito e il server restituisce un ack compatto senza ricostruire la sessione;
- `again`, `hard`, conflitti di freshness e buffer esaurito ricaricano sempre lo
  stato live, per preservare requeue e learning step;
- la cache delle card dinamiche usa tag per card/soggetto. Un voto invalida solo
  i membri dello stesso soggetto, mentre la coda e i contatori globali vengono
  comunque aggiornati;
- le modifiche manuali rare (known/learning/reset/suspend) invalidano il
  contenuto card globale per evitare dati editoriali obsoleti.

L'identita canonica delle card non viene piu ricalcolata nelle query runtime.
La tabella `review_card_identity` materializza la parte stabile della
proiezione (`canonical_subject_key`, recall task, memory key, link guida e
numero di link guida):

- la prima migrazione (o un cambio di versione della proiezione) esegue un
  backfill di tutte le card, incluse quelle archiviate che potrebbero essere
  riattivate; i deploy successivi fanno soltanto il controllo di copertura e
  non rilanciano il rebuild se la cache e completa;
- ogni import contenuti aggiorna nello stesso transaction scope soltanto i
  media toccati e l'upsert scrive solo le identita effettivamente cambiate;
- dopo ogni refresh un controllo di copertura confronta card e identita e fa
  fallire migrazione/import se anche una sola card resta scoperta;
- le query runtime fanno un join primary-key tra `card` e
  `review_card_identity`; stato, media, lesson e ordinamento restano letti dalla
  card live, quindi suspend/reset non rendono stale la proiezione;
- anche il lookup delle card eseguito durante un voto review e la selezione
  Kanji Clash usano l'indice `(entry_type, entry_id)`, senza scansioni di tutte
  le card o sottoquery correlate su `card_entry_link`.

Il caricamento web di `/review` e del filtro review per media e' ora diviso in
tre livelli, cosi il costo stabile non viene ripagato a ogni voto:

- uno skeleton indicizzato legge per tutte le card eleggibili soltanto identita
  materializzata, ordinamento, stato editoriale e completamento lesson; non
  carica `front`, `back`, link o righe glossary;
- lo stato FSRS e di consolidamento resta live, ma un voto invalida soltanto il
  dominio dinamico. Lo skeleton usa un tag contenuti separato e viene riletto
  solo dopo import, modifiche card o cambi di completamento lesson;
- dopo aver deduplicato e ordinato i subject, una singola query batch idrata la
  carta selezionata e le 8 successive. Anche term e grammar vengono richiesti
  solo per questa finestra, non per l'intera collezione;
- il client conserva buffer, prefetch e avanzamento ottimistico. Un test E2E
  trattiene apposta la risposta del grading e verifica che la carta visibile
  avanzi prima dell'ack, evitando di scambiare meno query con uno stutter UI.

Sul DB locale migrato usato per il confronto, il piano dello skeleton usa
`card_media_order_idx` e lookup primary-key su lesson, progress e
`review_card_identity`, con zero full scan e zero sort temporanei osservati.
Il benchmark di parita ha prodotto la stessa carta selezionata, 76 subject nello
stesso ordine e lo stesso buffer; la pagina completa ha serializzato 23.719 byte.
Sono misure di regressione locali: il risultato fatturato in rows read va
confermato nel dashboard Turso dopo il deploy, senza convertire artificialmente
i VM step in righe.

Sul DB SQLite release da 3.811 card, a parita di dati, le tre query card dello
snapshot sono passate complessivamente da 1.419.050 a 378.882 VM step (-73%).
Le singole riduzioni sono state 278.636 -> 72.440, 532.772 -> 195.850 e 607.642
-> 110.592; le full scan osservate sono passate da 3.810/4.474/3.810 a
0/664/0. Il rebuild piu complesso resta confinato a migrazioni e import, non al
cron quotidiano ne alle route iOS.

Il runtime non esegue piu' warmup speculativi al cold start: una Function che
parte ma non serve `/review` produce zero query di review.

## Budget conservativo

I VM step SQLite non sono la metrica fatturata da Turso e non equivalgono alle
righe lette. Sono usati qui come proxy conservativo e riproducibile per
confrontare le due architetture.

| Voce | Prima | Dopo |
| --- | ---: | ---: |
| Build card dinamiche | incluse in ogni GET | ~378.882 VM step, max 34/mese |
| Build glossario | incluse in ogni GET | ~710.294 VM step, max 6/mese |
| Proxy mensile snapshot | ~383,2 M VM step | ~17,1 M VM step |
| Payload sync ordinario | 3.890.395 byte | 415.098 byte osservati sul DB remoto |
| Query editoriali su GET iOS | 5 gruppi | 0 |
| Letture snapshot su GET iOS | 0 | 1 riga per endpoint |
| Warmup review per cold start | 1 sequenza globale | 0 |
| Reload sessione dopo `good/easy` mobile | ogni voto | ogni 9 voti al massimo con buffer pieno |

La riduzione modellata e' circa 96% sul lavoro mensile degli snapshot e 89% sul
payload ordinario. Anche ipotizzando una doppia esecuzione accidentale di ogni
build, il proxy snapshot resta circa 34,2 milioni, meno del 7% del limite Turso
Free di 500 milioni di righe lette. Il confronto resta un proxy: VM step e righe
lette fatturate non sono la stessa unita, e il dato Turso va verificato dopo il
deploy sulla query materializzata.

Il contratto iOS modella inoltre 15.000 voti review al mese (500 al giorno),
1.875 reload di sessione grazie al buffer, 70 tentativi automatici di sync card
inclusi i retry e 6 trasferimenti glossario. Sono circa 17.000 invocazioni
Vercel, meno del 2% del milione disponibile su Hobby. Un token compromesso o un
operatore che usa ripetutamente `--force` resta fuori dal contratto monoutente e
va trattato come incidente di sicurezza, non come traffico applicativo.

Il bootstrap remoto del 2026-08-23 ha confermato i margini reali: snapshot
card da 415.098 byte costruito in 4,16 secondi e snapshot glossario da 3.474.306
byte costruito in 1,71 secondi.

## Runbook

Prima di distribuire una versione che introduce o cambia gli snapshot:

```sh
./scripts/with-node.sh pnpm db:migrate
./scripts/with-node.sh pnpm daily-kanji:snapshot:refresh -- --force
./scripts/with-node.sh pnpm daily-kanji:snapshot:status
```

Il comando `status` non stampa payload o segreti; mostra solo timestamp,
dimensioni e durata dell'ultima build. Dopo il deploy verificare:

- `cards.payloadBytes <= 1.000.000`;
- `glossary.payloadBytes <= 4.000.000`;
- `refreshNotBefore` coerente con 22 ore / 6 giorni;
- risposta `200` o `304` dai due endpoint autenticati;
- nessun aumento anomalo di rows read nel dashboard Turso;
- `review_card_identity` con lo stesso numero di righe di `card` e zero card
  scoperte;
- invocazioni, CPU e origin transfer nel dashboard Vercel molto sotto il 50%
  del piano.

Se una build fallisce, non cancellare `runtime_snapshot`: correggere la causa e
rilanciare il refresh. La riga precedente e il fallback locale iOS sono il
meccanismo di continuita' previsto.
