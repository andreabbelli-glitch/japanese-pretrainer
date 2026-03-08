# Schema Dati Iniziale

## 1. Obiettivo

Definire uno schema relazionale v1 abbastanza solido da supportare:

- import dei contenuti Markdown;
- textbook reader;
- glossary derivato;
- review Anki-like;
- progress tracking;
- override manuale dello stato appreso.

Lo schema e pensato per `SQLite` e single-user.

## 2. Principio chiave

Le entita canoniche di studio non devono dipendere dal rendering del textbook.
Il textbook le usa e le presenta, ma `term`, `grammar_pattern` e `card` devono
esistere come record normalizzati.

## 3. Tabelle principali

## 3.1 `media`

Un record per ogni media studiabile.

Campi:

- `id` TEXT PRIMARY KEY
- `slug` TEXT UNIQUE NOT NULL
- `title` TEXT NOT NULL
- `media_type` TEXT NOT NULL
- `segment_kind` TEXT NOT NULL
- `language` TEXT NOT NULL
- `base_explanation_language` TEXT NOT NULL
- `description` TEXT
- `status` TEXT NOT NULL DEFAULT 'active'
- `created_at` TEXT NOT NULL
- `updated_at` TEXT NOT NULL

## 3.2 `segment`

Segmenti organizzativi del media: episodio, capitolo, deck, area, ecc.

Campi:

- `id` TEXT PRIMARY KEY
- `media_id` TEXT NOT NULL
- `slug` TEXT NOT NULL
- `title` TEXT NOT NULL
- `order_index` INTEGER NOT NULL
- `segment_type` TEXT NOT NULL
- `notes` TEXT

Vincoli:

- FK `media_id -> media.id`
- UNIQUE (`media_id`, `slug`)

## 3.3 `lesson`

Lezioni del textbook.

Campi:

- `id` TEXT PRIMARY KEY
- `media_id` TEXT NOT NULL
- `segment_id` TEXT
- `slug` TEXT NOT NULL
- `title` TEXT NOT NULL
- `order_index` INTEGER NOT NULL
- `difficulty` TEXT
- `summary` TEXT
- `status` TEXT NOT NULL DEFAULT 'active'
- `source_file` TEXT NOT NULL
- `created_at` TEXT NOT NULL
- `updated_at` TEXT NOT NULL

Vincoli:

- FK `media_id -> media.id`
- FK `segment_id -> segment.id`
- UNIQUE (`media_id`, `slug`)

## 3.4 `lesson_content`

Contenuto renderizzabile della lesson importata dal Markdown.

Campi:

- `lesson_id` TEXT PRIMARY KEY
- `markdown_raw` TEXT NOT NULL
- `html_rendered` TEXT NOT NULL
- `ast_json` TEXT
- `excerpt` TEXT
- `last_import_id` TEXT NOT NULL

Vincoli:

- FK `lesson_id -> lesson.id`

Nota:

`html_rendered` serve al runtime. `markdown_raw` e `ast_json` servono per debug,
reimport e feature future.

## 3.5 `term`

Entita lessicali canoniche.

Campi:

- `id` TEXT PRIMARY KEY
- `media_id` TEXT NOT NULL
- `segment_id` TEXT
- `lemma` TEXT NOT NULL
- `reading` TEXT NOT NULL
- `romaji` TEXT NOT NULL
- `pos` TEXT
- `meaning_it` TEXT NOT NULL
- `meaning_literal_it` TEXT
- `notes_it` TEXT
- `level_hint` TEXT
- `search_lemma_norm` TEXT NOT NULL
- `search_reading_norm` TEXT NOT NULL
- `search_romaji_norm` TEXT NOT NULL
- `created_at` TEXT NOT NULL
- `updated_at` TEXT NOT NULL

Vincoli:

- FK `media_id -> media.id`
- FK `segment_id -> segment.id`

## 3.6 `term_alias`

Alias per ricerca e matching.

Campi:

- `id` TEXT PRIMARY KEY
- `term_id` TEXT NOT NULL
- `alias_text` TEXT NOT NULL
- `alias_norm` TEXT NOT NULL
- `alias_type` TEXT NOT NULL

Vincoli:

- FK `term_id -> term.id`

## 3.7 `grammar_pattern`

Pattern grammaticali canonici.

Campi:

- `id` TEXT PRIMARY KEY
- `media_id` TEXT NOT NULL
- `segment_id` TEXT
- `pattern` TEXT NOT NULL
- `title` TEXT NOT NULL
- `meaning_it` TEXT NOT NULL
- `notes_it` TEXT
- `level_hint` TEXT
- `search_pattern_norm` TEXT NOT NULL
- `created_at` TEXT NOT NULL
- `updated_at` TEXT NOT NULL

Vincoli:

- FK `media_id -> media.id`
- FK `segment_id -> segment.id`

## 3.8 `grammar_alias`

Alias dei pattern grammaticali.

Campi:

- `id` TEXT PRIMARY KEY
- `grammar_id` TEXT NOT NULL
- `alias_text` TEXT NOT NULL
- `alias_norm` TEXT NOT NULL

Vincoli:

- FK `grammar_id -> grammar_pattern.id`

## 3.9 `entry_link`

Tabella polimorfica per collegare entita canoniche a lesson e card.

Campi:

- `id` TEXT PRIMARY KEY
- `entry_type` TEXT NOT NULL
- `entry_id` TEXT NOT NULL
- `source_type` TEXT NOT NULL
- `source_id` TEXT NOT NULL
- `link_role` TEXT NOT NULL
- `sort_order` INTEGER

Valori consigliati:

- `entry_type`: `term`, `grammar`
- `source_type`: `lesson`, `card`
- `link_role`: `introduced`, `explained`, `mentioned`, `reviewed`

Nota:

`entry_link` serve a costruire il glossary, trovare la lesson di introduzione e
spiegare dove una entry compare.

## 3.10 `card`

Card review-centriche.

Campi:

- `id` TEXT PRIMARY KEY
- `media_id` TEXT NOT NULL
- `segment_id` TEXT
- `source_file` TEXT NOT NULL
- `card_type` TEXT NOT NULL
- `front` TEXT NOT NULL
- `back` TEXT NOT NULL
- `notes_it` TEXT
- `status` TEXT NOT NULL DEFAULT 'active'
- `order_index` INTEGER
- `created_at` TEXT NOT NULL
- `updated_at` TEXT NOT NULL

Vincoli:

- FK `media_id -> media.id`
- FK `segment_id -> segment.id`

## 3.11 `card_entry_link`

Relazione tra una card e le entita che rappresenta o testa.

Campi:

- `id` TEXT PRIMARY KEY
- `card_id` TEXT NOT NULL
- `entry_type` TEXT NOT NULL
- `entry_id` TEXT NOT NULL
- `relationship_type` TEXT NOT NULL

Valori consigliati:

- `relationship_type`: `primary`, `secondary`, `context`

Nota:

Questa tabella permette piu card per la stessa entry e una card con piu entita.

## 3.12 `entry_status`

Stato manuale o sintetico di una entry canonica.

Campi:

- `id` TEXT PRIMARY KEY
- `entry_type` TEXT NOT NULL
- `entry_id` TEXT NOT NULL
- `status` TEXT NOT NULL
- `reason` TEXT
- `set_at` TEXT NOT NULL

Valori consigliati:

- `unknown`
- `learning`
- `known_manual`
- `ignored`

Nota:

Questa tabella e fondamentale per supportare il caso "questa parola l'ho gia
imparata" senza dover toccare manualmente tutte le card collegate.

## 3.13 `review_state`

Stato SRS per card.

Campi:

- `card_id` TEXT PRIMARY KEY
- `state` TEXT NOT NULL
- `stability` REAL
- `difficulty` REAL
- `due_at` TEXT
- `last_reviewed_at` TEXT
- `lapses` INTEGER NOT NULL DEFAULT 0
- `reps` INTEGER NOT NULL DEFAULT 0
- `manual_override` INTEGER NOT NULL DEFAULT 0
- `created_at` TEXT NOT NULL
- `updated_at` TEXT NOT NULL

Vincoli:

- FK `card_id -> card.id`

Nota:

Lo schema e compatibile con un approccio tipo FSRS o con uno scheduler piu
semplice, senza vincolare ora l'algoritmo preciso.

## 3.14 `review_log`

Storico immutabile delle review.

Campi:

- `id` TEXT PRIMARY KEY
- `card_id` TEXT NOT NULL
- `answered_at` TEXT NOT NULL
- `rating` TEXT NOT NULL
- `previous_state` TEXT
- `new_state` TEXT
- `scheduled_due_at` TEXT
- `elapsed_days` REAL
- `response_ms` INTEGER

Vincoli:

- FK `card_id -> card.id`

## 3.15 `lesson_progress`

Progress dell'utente sulle lesson.

Campi:

- `lesson_id` TEXT PRIMARY KEY
- `status` TEXT NOT NULL
- `started_at` TEXT
- `completed_at` TEXT
- `last_opened_at` TEXT

Valori consigliati:

- `not_started`
- `in_progress`
- `completed`

## 3.16 `media_progress`

Aggregati per dashboard.

Campi:

- `media_id` TEXT PRIMARY KEY
- `lessons_completed` INTEGER NOT NULL DEFAULT 0
- `lessons_total` INTEGER NOT NULL DEFAULT 0
- `entries_known` INTEGER NOT NULL DEFAULT 0
- `entries_total` INTEGER NOT NULL DEFAULT 0
- `cards_due` INTEGER NOT NULL DEFAULT 0
- `updated_at` TEXT NOT NULL

Nota:

Questa tabella puo anche essere una view materializzata rigenerata.

## 3.17 `user_setting`

Preferenze applicative globali.

Campi:

- `key` TEXT PRIMARY KEY
- `value_json` TEXT NOT NULL
- `updated_at` TEXT NOT NULL

Chiavi minime:

- `furigana_mode`
- `review_daily_limit`
- `glossary_default_sort`

## 3.18 `content_import`

Log degli import.

Campi:

- `id` TEXT PRIMARY KEY
- `started_at` TEXT NOT NULL
- `finished_at` TEXT
- `status` TEXT NOT NULL
- `files_scanned` INTEGER NOT NULL DEFAULT 0
- `files_changed` INTEGER NOT NULL DEFAULT 0
- `message` TEXT

## 4. Indici minimi consigliati

- indice su `term.search_lemma_norm`
- indice su `term.search_reading_norm`
- indice su `term.search_romaji_norm`
- indice su `grammar_pattern.search_pattern_norm`
- indice su `lesson.media_id, lesson.order_index`
- indice su `card.media_id, card.order_index`
- indice su `review_state.due_at`
- indice su `entry_link.entry_type, entry_link.entry_id`

In aggiunta:

- tabella FTS per testo glossary e contenuti lesson, se necessario

## 5. Note implementative

- I riferimenti polimorfici (`entry_type` + `entry_id`) richiedono validazione
  applicativa in import, perche SQLite non puo esprimerli come FK nativa.
- `entry_status` e `review_state` hanno ruoli diversi: il primo descrive una
  scelta o sintesi a livello entita, il secondo il comportamento SRS di una
  singola card.
- `media_progress` puo essere calcolato on demand in sviluppo e materializzato
  piu avanti.

## 6. Decisioni v1 da mantenere

- Glossary derivato, non scritto a mano come sorgente separata.
- Lesson e card importate da Markdown, non create da UI.
- Stable IDs obbligatori.
- Supporto esplicito a piu card per la stessa entry.
- Supporto esplicito a override manuale dello stato appreso.
