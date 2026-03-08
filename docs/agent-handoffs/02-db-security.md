# 02 — Database / Auth / Security (Supabase + RLS)

## Cosa è stato implementato
- Aggiunta migration SQL completa V1 in `supabase/migrations/202603080001_v1_user_state.sql` con tabelle user-state richieste:
  - `profiles`
  - `user_settings`
  - `lesson_progress`
  - `user_item_progress`
  - `review_sessions`
  - `review_events`
  - `bookmarks`
  - `daily_stats_cache`
- Aggiunti trigger `updated_at` tramite funzione riusabile `public.set_updated_at()`.
- Aggiunto bootstrap automatico signup con trigger su `auth.users` (`public.handle_new_user`) che crea in automatico:
  - `profiles`
  - `user_settings`
- Abilitata **RLS** su tutte le tabelle user-specific.
- Create policy owner-only (select/insert/update/delete) per ogni tabella user-specific.
- Aggiunti indici principali per query frequenti:
  - `user_item_progress(user_id, due_at)`
  - `lesson_progress(user_id, lesson_id)`
  - `review_sessions(user_id, created_at)`
  - `review_events(user_id, created_at)`
  - `bookmarks(user_id, created_at)`
  - `daily_stats_cache(user_id, stat_date)`
- Aggiunti tipi DB TypeScript in `src/lib/supabase/database.types.ts` e client Supabase tipizzati (`browser`, `server`, `middleware`).
- Aggiunto repository base lato app in `src/features/user-data/repository.ts` per:
  - user settings
  - lesson progress
  - review state/session/events
  - bookmarks

## Schema finale (sintesi)
- **profiles**: profilo utente (1:1 con `auth.users`).
- **user_settings**: preferenze app (UI lingua, furigana, limiti giornalieri, timezone).
- **lesson_progress**: stato didattico per `lesson_id` (`not_started`/`in_progress`/`completed`).
- **user_item_progress**: stato memoria/review per `item_id` (due date, EF, interval, lapses, mastery, rating).
- **review_sessions**: sessioni review aggregate.
- **review_events**: eventi atomici di grading review per item.
- **bookmarks**: preferiti su `lesson_id` OR `item_id` OR `card_id` (vincolo: uno solo alla volta).
- **daily_stats_cache**: cache giornaliera KPI utente (consigliata e inclusa ora, perché utile per dashboard senza query pesanti su eventi).

## Policy create (owner-only)
Per ogni tabella user-specific (`profiles`, `user_settings`, `lesson_progress`, `user_item_progress`, `review_sessions`, `review_events`, `bookmarks`, `daily_stats_cache`):
- `select` solo righe proprie
- `insert` solo righe proprie
- `update` solo righe proprie
- `delete` solo righe proprie

Chiave controllo:
- `auth.uid() = id` per `profiles`
- `auth.uid() = user_id` per le altre

## Query previste (operativo)
- Dashboard review queue: `user_item_progress` per `user_id` + `due_at <= now()` (indice `user_item_progress_user_due_idx`).
- Progress lezione: lookup/merge per `user_id + lesson_id` (indice `lesson_progress_user_lesson_idx`).
- Storico sessioni review: `review_sessions` per `user_id` ordinato per `created_at desc`.
- Eventi review recenti: `review_events` per `user_id` ordinato per `created_at desc`.
- Bookmarks recenti: `bookmarks` per `user_id` ordinato per `created_at desc`.

## Tipi TypeScript DB
- File: `src/lib/supabase/database.types.ts`
- Script npm aggiunto:
  ```bash
  npm run db:types
  ```
- Comando usato dallo script:
  ```bash
  supabase gen types typescript --linked --schema public > src/lib/supabase/database.types.ts
  ```

## Note sicurezza
- Nessun uso di service role nel browser.
- Client Supabase browser/server/middleware usa anon key + sessione utente SSR.
- RLS è attiva su tutte le tabelle user-state.

## TODO strettamente necessari
1. Quando l'ambiente Supabase locale/linked è disponibile, eseguire:
   - `supabase db push` (o flusso migrazioni del team)
   - `npm run db:types` per rigenerare tipi dal DB reale.
2. Aggiungere test integration SQL/policy (es. suite pgTAP o test app-level con utenti multipli) per verificare isolamento RLS end-to-end.
3. Valutare viste/materializzazioni per analytics aggregate se `daily_stats_cache` non basta su dataset reali.

## File toccati
- `supabase/migrations/202603080001_v1_user_state.sql`
- `src/lib/supabase/database.types.ts`
- `src/lib/supabase/browser.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/middleware.ts`
- `src/features/user-data/repository.ts`
- `package.json`
- `docs/agent-handoffs/02-db-security.md`
