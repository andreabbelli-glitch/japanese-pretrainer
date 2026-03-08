# Japanese Pretrainer — Duel Masters JP

Base foundation per una webapp **content-first** per studiare il giapponese delle carte Duel Masters (focus DM25-SD1 / DM25-SD2).

## Stack
- Next.js App Router + TypeScript
- Tailwind CSS
- Supabase Auth (SSR con `@supabase/ssr`)

## Route disponibili
- `/`
- `/login`
- `/dashboard` (protetta)
- `/lessons`
- `/items`
- `/cards`
- `/decks`
- `/review` (protetta)
- `/settings` (protetta)

## Setup locale
1. Installa dipendenze:
   ```bash
   npm install
   ```
2. Crea il file env:
   ```bash
   cp .env.example .env.local
   ```
3. Inserisci valori Supabase reali in `.env.local`.
4. Avvia:
   ```bash
   npm run dev
   ```
5. Apri `http://localhost:3000`.

## Auth SSR (Supabase)
- Utility browser: `src/lib/supabase/browser.ts`
- Utility server: `src/lib/supabase/server.ts`
- Guard middleware: `src/lib/supabase/middleware.ts` + `middleware.ts`

## Note
- Nessun ORM introdotto.
- Nessun CMS introdotto.
- Contenuto didattico runtime non ancora implementato (solo struttura cartelle `/content`).


## Database (Supabase)
- Migrazioni SQL in `supabase/migrations/`.
- Per rigenerare i tipi TypeScript dal DB linked:
  ```bash
  npm run db:types
  ```
