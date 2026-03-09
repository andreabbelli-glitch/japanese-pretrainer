# Importer Sync Strategy

## Obiettivo

L'importer collega davvero:

- file Markdown sotto `content/media/*`;
- parser + validator di `src/lib/content`;
- schema SQLite/Drizzle del runtime.

Il runtime dell'app continua quindi a lavorare sui dati normalizzati nel DB, non
sui file grezzi.

## Flusso operativo

1. Il comando CLI esegue `parseContentRoot(contentRoot)`.
2. Se esistono issue di parser o validazione, l'import si ferma prima di
   toccare le tabelle contenuto.
3. L'import attempt viene comunque registrato in `content_import`.
4. Se il parse e valido, una transazione applica il sync su tutte le entita
   import-owned nel perimetro richiesto.
5. Alla fine `content_import` viene marcato `completed` o `failed`.

## Confine tra parser e persistence

- Il parser resta il produttore unico del payload normalizzato.
- L'importer non riparsa il Markdown raw per estrarre entita o riferimenti.
- `lesson_content` viene generato dal body gia normalizzato del parser:
  `markdown_raw`, `html_rendered`, `ast_json` ed `excerpt`.

## Entita importate

L'importer popola o sincronizza:

- `media`
- `segment` derivato da `segment_ref`
- `lesson`
- `lesson_content`
- `term`
- `term_alias`
- `grammar_pattern`
- `grammar_alias`
- `entry_link`
- `card`
- `card_entry_link`
- `content_import`

## Strategia di sync

### Upsert deterministico

- Tutte le entita canoniche usano gli stable ID editoriali gia presenti nei
  file.
- Gli ID derivati (`segment`, alias, link tables) sono deterministici e
  dipendono solo dai campi stabili rilevanti.
- Il reimport dello stesso contenuto non crea duplicati.

### Timestamps

- `created_at` viene preservato sui record gia esistenti.
- `updated_at` cambia solo quando il payload persistito cambia davvero.
- `lesson_content.last_import_id` punta sempre all'ultimo import riuscito.

### Rimozioni dai file

La policy e volutamente diversa per record content-owned e user-owned.

- `media`, `lesson`, `card`: soft archive.
  Motivazione: hanno tabelle utente collegate tramite FK (`lesson_progress`,
  `review_state`, `review_log`), quindi un delete sarebbe distruttivo.
- `segment`: prune hard per media sincronizzato.
  Motivazione: e content-owned, deriva solo dai `segment_ref` correnti e tutte
  le FK verso `segment` sono `ON DELETE SET NULL`; quindi un reimport deve
  rimuovere i segment non piu derivabili senza lasciare record fantasma.
- `term`, `grammar_pattern`: prune controllato.
  Motivazione: lo stato utente vive in `entry_status` senza FK hard verso le
  entita canoniche, quindi i record possono essere rimossi dal glossary attivo
  senza perdere l'override manuale.
- `term_alias`, `grammar_alias`, `entry_link`, `card_entry_link`: rigenerate per
  le sorgenti correnti; i link di card archiviate restano per non perdere
  contesto storico.

## Preservazione dello user state

### Tabelle protette

- `review_state`
- `review_log`
- `entry_status`
- `lesson_progress`
- `media_progress`
- `user_setting`

### Garanzie

- Nessuna di queste tabelle viene svuotata o ricalcolata dall'importer.
- Le card rimosse vengono archiviate, non cancellate, quindi `review_state` e
  `review_log` restano intatti.
- Le lesson rimosse vengono archiviate, non cancellate, quindi
  `lesson_progress` resta intatto.
- Le entry rimosse (`term`, `grammar_pattern`) vengono prunate dal contenuto
  attivo ma `entry_status` resta nel DB, pronto a riagganciarsi se lo stesso
  stable ID torna in un import futuro.

## Segmenti

In v1 non esiste ancora un file sorgente dedicato ai segmenti. L'importer li
deriva dai `segment_ref` presenti in lesson, term, grammar e cards:

- `slug`: il valore di `segment_ref`
- `segment_type`: `media.segment_kind`
- `title`: derivato dal slug con humanization minima
- `id`: deterministico da `media_id + segment_ref`

Policy esplicita:

- durante il sync di un media l'importer rigenera il set atteso dei `segment`
  dal payload validato;
- i `segment` presenti nel DB ma assenti dal payload corrente vengono cancellati
  nella stessa transazione;
- se un media viene rimosso in un full import, i suoi `segment` derivati vengono
  cancellati mentre `media`, `lesson` e `card` restano archiviati;
- le FK di `lesson`, `card`, `term` e `grammar_pattern` vengono quindi portate a
  `NULL` automaticamente solo per i record che non referenziano piu alcun
  `segment_ref` valido.

## Comando CLI

Prima dell'import conviene validare il bundle o il content root:

```sh
./scripts/with-node.sh pnpm content:validate -- --media-slug duel-masters-dm25
```

Import completo dalla content root di default:

```sh
./scripts/with-node.sh pnpm content:import
```

Content root esplicita:

```sh
./scripts/with-node.sh pnpm content:import -- --content-root /percorso/content
```

Import incrementale scoped a uno o piu media slug:

```sh
./scripts/with-node.sh pnpm content:import -- --media-slug frieren
```

```sh
./scripts/with-node.sh pnpm content:import -- --media-slug frieren --media-slug dungeon-meshi
```

Comportamento della modalita incrementale:

- il parser/validator continua a produrre il payload normalizzato standard;
- il sync DB applica archive/prune solo ai media inclusi nello scope richiesto;
- i media fuori scope non vengono trattati come rimossi, anche se assenti dal
  contenuto fornito per quell'import;
- dentro ogni media in scope continuano invece a valere le normali policy di
  sync: archive di lesson/card rimosse, prune di term/grammar rimosse e prune
  dei segment derivati non piu referenziati.

## Failure mode

- parse/validation invalidi: nessuna mutazione delle tabelle contenuto, import
  loggato come `failed`
- errore SQL inatteso: transazione rollback, import loggato come `failed`
- success: `content_import` registra conteggi e summary del sync
