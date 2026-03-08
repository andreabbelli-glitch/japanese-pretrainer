# 01 — Foundation / Platform

## Cosa è stato implementato
- Bootstrap manuale di un progetto Next.js App Router + TypeScript + Tailwind (senza ORM/CMS).
- Routing base richiesto:
  - `/`, `/login`, `/dashboard`, `/lessons`, `/items`, `/cards`, `/decks`, `/review`, `/settings`.
- Layout globale con navigazione minimale, leggibile e mobile-first.
- Area autenticata protetta per:
  - `/dashboard`
  - `/review`
  - `/settings`
- Middleware auth guard con Supabase SSR.
- Utility Supabase create:
  - `src/lib/supabase/browser.ts`
  - `src/lib/supabase/server.ts`
  - `src/lib/supabase/middleware.ts`
- Wiring login/logout base:
  - login con magic link via server action
  - logout via server action
- Struttura repository allineata al masterplan (cartelle base create).
- README iniziale con setup locale.
- `.env.example` con variabili richieste (placeholder, nessun segreto).

## File creati/modificati
- Config/progetto: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `.eslintrc.json`, `.gitignore`, `next-env.d.ts`
- App Router: `app/layout.tsx`, `app/globals.css`, `app/page.tsx`
- Route pages: `app/login/page.tsx`, `app/dashboard/page.tsx`, `app/lessons/page.tsx`, `app/items/page.tsx`, `app/cards/page.tsx`, `app/decks/page.tsx`, `app/review/page.tsx`, `app/settings/page.tsx`
- Auth actions: `app/login/actions.ts`
- Middleware: `middleware.ts`
- Supabase utils: `src/lib/supabase/browser.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`
- Componenti base: `src/components/main-nav.tsx`, `src/components/page-shell.tsx`
- Docs/env: `README.md`, `.env.example`
- Struttura cartelle/scaffold: `content/*`, `scripts/.gitkeep`, `supabase/migrations/.gitkeep`, `tests/.gitkeep`, `src/domain/.gitkeep`

## Decisioni principali
1. **Bootstrap manuale** invece di `create-next-app` per limite ambiente (403 su registry npm).
2. **Protezione route private in middleware** come primo guardrail centrale.
3. **Wiring auth minimamente funzionante** (magic link + logout) senza introdurre logica dominio non richiesta.
4. **UI placeholder in italiano** per tutte le route skeleton.

## TODO mirati per agenti successivi
1. Completare integrazione contenuto runtime in `/content` con schema e validazione.
2. Implementare pagine dinamiche (`/lessons/[slug]`, `/items/[id]`, `/cards/[id]`, deck specifici) secondo masterplan.
3. Aggiungere schema/migrazioni SQL reali in `supabase/migrations/` (RLS owner-only).
4. Costruire dashboard/review engine vero in `src/domain/review`.
5. Aggiungere test unitari + e2e smoke su auth e route protection.

## Blocker reali
- Ambiente corrente non permette `npm install` da registry npm (errore 403), quindi non è stato possibile eseguire lint/typecheck/build localmente in questa sessione.
