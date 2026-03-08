# 02 — Environment / Dependency Install

## Cosa è stato implementato
- Installate le dipendenze del progetto con `npm install`.
- Generato `package-lock.json` per rendere ripetibile il setup con npm.
- Installato il browser `chromium` di Playwright per avere l'ambiente pronto a smoke/E2E locali.
- Verificata la raggiungibilità del registry npm da questo ambiente con `npm ping`.
- Eseguiti i check base post-installazione: `lint`, `typecheck`, `test`, `build`.

## File creati/modificati
- `package-lock.json`
- `docs/agent-handoffs/02-environment-install.md`

## Decisioni principali
1. Tenuto `npm` come package manager canonico del repo, coerente con l'assenza di lockfile alternativi.
2. Mantenuto `package-lock.json` nel workspace perché utile alla riproducibilità dell'ambiente.
3. Non sono stati corretti errori applicativi emersi dai check: il task richiesto era il setup dell'ambiente, non il fixing del codice.

## TODO mirati per agenti successivi
1. Correggere il type error in `app/login/page.tsx` legato alla server action usata come `form action`.
2. Tipizzare correttamente i callback cookie in `src/lib/supabase/server.ts` e `src/lib/supabase/middleware.ts`.
3. Risolvere l'errore ESLint su `options` non usato in `src/lib/supabase/middleware.ts`.
4. Aggiungere almeno un test reale oppure adeguare lo script `test` se il comportamento desiderato non è fallire quando non ci sono test.

## Blocker reali
- `npm install` ora funziona in questo ambiente, quindi il blocker di rete/registry non è più presente per il setup base.
- Il progetto non è ancora green:
  - `npm run lint` fallisce su `src/lib/supabase/middleware.ts`
  - `npm run typecheck` fallisce su `app/login/page.tsx`, `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`
  - `npm run test` esce con codice 1 perché non esistono test
  - `npm run build` fallisce a causa degli errori TypeScript già presenti
