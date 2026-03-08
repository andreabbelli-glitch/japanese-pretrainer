# AGENTS.md

## Project mission
Build a **content-first web app** to study the Japanese used in Duel Masters cards, with an initial corpus focused on **DM25-SD1** and **DM25-SD2**.

The app has 2 core pillars:
1. **Interactive textbook**: teaches the Japanese found in the cards with an ELI5 teaching style, real examples, and strong links to real cards.
2. **Review engine**: flashcard-like review with real memory tracking, progress persistence, and deck/card coverage.

### North Star
> “I open a card from my decks, read the Japanese text, and understand the overall meaning without depending on a full translation.”

This implies 4 capabilities:
- recognize recurring kanji
- understand verbs, nouns, and card-text patterns
- read the sentence with hiragana support
- remember what was studied over time

---

## Instruction precedence
When multiple sources disagree, use this order:
1. **Current user prompt / current agent task**
2. **This `AGENTS.md`**
3. **`duel-masters-jp-webapp-masterplan.md`** for architecture, product scope, route map, DB model, review model, and delivery priorities
4. **`duel-masters-jp-study-guide-sd1-sd2-v1.md`** for domain content, teaching intent, terminology, examples, and corpus focus
5. Existing codebase conventions, unless clearly wrong or incompatible with the higher-priority sources

If you must deviate from a lower-priority source, do it deliberately and document it in the relevant handoff doc.

---

## Mandatory read before changing code
Every agent must, before touching code:
1. Search the workspace recursively for:
   - `duel-masters-jp-webapp-masterplan.md`
   - `duel-masters-jp-study-guide-sd1-sd2-v1.md`
   - `docs/agent-handoffs/`
2. Read the 2 main markdown files.
3. Read all previous handoff files if they exist.
4. Inspect the current repo structure before making changes.

Do not skip this step.

---

## Agent operating protocol
### Default behavior
- Do **best effort**.
- Do **not** ask clarifying questions if a reasonable implementation choice can be made.
- Prefer **simple, boring, maintainable** solutions over clever ones.
- Make the **smallest coherent set of changes** needed to complete the assigned task well.
- Do not leave the repo in a broken state.

### At the end of each task
Each agent must:
1. Run quality checks if available.
2. Fix obvious failures caused by its changes.
3. Update or create a handoff note in `docs/agent-handoffs/`.
4. Clearly list:
   - what was implemented
   - files changed
   - decisions made
   - TODOs that remain
   - blockers, but only if they are real blockers

### Handoff naming
Use numbered handoffs such as:
- `docs/agent-handoffs/01-foundation.md`
- `docs/agent-handoffs/02-db-security.md`
- `docs/agent-handoffs/03-content-system.md`
- `docs/agent-handoffs/04-textbook-ux.md`
- `docs/agent-handoffs/05-review-engine.md`
- `docs/agent-handoffs/06-final-integration.md`

If a new handoff is needed, keep the numbering/order coherent.

---

## V1 product scope
V1 must include:
- login/authentication
- textbook with structured lessons
- item pages with bidirectional links
- flashcard-like review sessions with scheduling and persistence
- dashboard with real progress
- card pages with text, study support, and coverage
- complete support for **DM25-SD1** and **DM25-SD2**
- content migrated from the source markdown into a structured runtime content system

### V1 must feel like
A **vertical learning product** for Duel Masters Japanese, not a generic flashcard app.

### Out of scope for V1
Do **not** implement these unless a later task explicitly asks for them:
- native mobile app
- OCR from camera/photos
- audio/TTS
- multiplayer/social
- external CMS for content authoring
- Anki import/export
- overcomplicated scheduling algorithms
- large-scale scraping
- image hosting of full card scans without rights certainty

---

## Non-negotiable product principles
1. **Content-first**: content quality and relationships are the product core.
2. **Explain-first, not flashcards-first**: the textbook teaches; review reinforces.
3. **One canonical content source in repo**: structured, versioned, reviewable.
4. **Database stores user state, not primary teaching content**.
5. **Lesson progress and memory progress are different things**.
6. **Everything must connect back to real cards**.

---

## Required stack for V1
- **Next.js App Router**
- **TypeScript**
- **Tailwind CSS**
- **MDX** for lessons
- **Supabase** for Auth + Postgres + RLS
- **@supabase/ssr** for SSR auth
- **Vitest** for unit/integration tests
- **Playwright** for smoke/E2E tests

### Architectural choices
- Use Next.js as **frontend + BFF**.
- Prefer **Server Components** where sensible.
- Use **Client Components** only for real interactivity.
- Use **Server Actions** or **Route Handlers** where appropriate.
- Use **Supabase JS + SQL migrations**.
- **Do not introduce an ORM in V1**.
- **Do not introduce a CMS in V1**.

---

## Content system rules
### Golden rule
`duel-masters-jp-study-guide-sd1-sd2-v1.md` is **source material**, not the runtime format.

Do not build the app by parsing the giant source markdown at runtime.
Migrate it into a structured content graph under `/content`.

### Expected content structure
```text
/content
  /lessons
  /items
  /examples
  /cards
  /meta
```

### Stable ID conventions
- `K-001` = kanji
- `V-001` = vocab / verb / noun / adjective
- `P-001` = pattern
- `KW-001` = keyword
- `EX-0001` = example
- `L-01` = lesson
- `CARD-SD1-001` = card
- `DECK-SD1` / `DECK-SD2` = deck

**Stable IDs must never be renamed casually.**

### Required content relationships
Where possible, keep links both ways:
- item -> examples/cards/lessons
- example -> source card
- card -> items/lessons
- lesson -> items/cards

### Validation
Content validation must fail on at least these issues:
- duplicate IDs
- broken references
- cards without linked item IDs
- lessons without minimum metadata
- orphaned content that should be connected but is not

---

## Textbook rules
The textbook is the primary learning experience.

### Tone
- UI language: **Italian**
- teaching language: **Italian**
- tone: **ELI5 but precise**
- simple, concrete, progressive, never fluffy
- always grounded in real card text

### Each lesson should contain
1. what you learn
2. ELI5 explanation
3. how to recognize it on a card
4. real examples from the game
5. common mistakes / false friends
6. micro-drill
7. linked items to review
8. linked cards where the concept appears

### Minimum lesson set for V1
- L1 — Foundations of card Japanese
- L2 — Zones and movement
- L3 — Timing and triggers
- L4 — Numbers and limits
- L5 — SD1 vocabulary
- L6 — SD2 vocabulary
- L7 — Reading a full SD1 card
- L8 — Reading a full SD2 card

### Reusable learning components
Build and reuse components like:
- `FuriganaToggle`
- `SentenceBreakdown`
- `RevealTranslation`
- `RelatedItemsList`
- `RelatedCardsList`
- `AttentionCallout`
- `QuickRecognitionBox`

---

## Review engine rules
### Goal
The review system must tell the truth about what the user has:
- never seen
- learned recently
- remembered well
- started forgetting

### States
Use these states unless a later prompt explicitly changes them:
- `new`
- `learning`
- `review`
- `relearning`
- `mature`

### Ratings
Use these ratings:
- `Again`
- `Hard`
- `Good`
- `Easy`

### Scheduling philosophy
Use a **simple SM-2-like scheduler** for V1:
- understandable
- predictable
- easy to debug
- easy to replace later

Do not hide review logic inside React components.
Keep it in a dedicated domain module, e.g.:
```text
/src/domain/review
  types.ts
  scheduler.ts
  transitions.ts
  scoring.ts
  queries.ts
  queue.ts
```

### Review persistence
Track and persist at minimum:
- user item state
- interval
- ease factor
- reps
- lapses
- due date
- last rating
- review sessions
- review events
- content version

### V1 review granularity
Work at the level of **study items**, not a separate DB model of review cards.
Different kinds of items can still use different prompt/answer templates.

---

## Mastery and coverage rules
### Why they exist
The app must show not only what the user remembers, but also how close they are to understanding real cards and full decks.

### Item mastery
- range: `0–100`
- should be derived from review state + interval + recency + lapses + streak
- do not invent fake or purely decorative values

Qualitative target bands:
- unseen: `0`
- learning: `20–40`
- early review: `50–70`
- stable mature: `80–95`
- mastered: `95–100`

### Item priority weights
For coverage calculations:
- `core = 3`
- `important = 2`
- `nice = 1`

### Card coverage
Use the masterplan formula:
```text
coverage(card) =
  sum(item_weight * item_mastery_score) / sum(item_weight * 100)
```

### Deck coverage
Use a weighted average of unique-card coverage across the deck.

### UI insight requirement
The UI should be able to explain things like:
- “You almost understand this card.”
- “Study these 4 items to unlock 2 more cards.”
- “Your bottleneck is timing patterns, not SD2 vocabulary.”

Do not show coverage percentages without a meaningful explanation of gaps.

---

## Database rules
### DB responsibility
The database stores **user state**, not the primary learning content.

### Core tables expected in V1
- `profiles`
- `user_settings`
- `lesson_progress`
- `user_item_progress`
- `review_sessions`
- `review_events`
- `bookmarks`
- optionally `daily_stats_cache`

### Canonical expectations
- `lesson_id`, `item_id`, `card_id` are stable IDs from the content system
- use **Supabase Postgres + RLS**
- use **owner-only policies** for user-specific rows
- use **SSR-safe auth**
- **never expose service role credentials to the browser**

### Important schema fields
`user_settings` should include at least:
- `ui_language`
- `furigana_default`
- `daily_new_limit`
- `daily_review_goal`
- `timezone`

`lesson_progress` should distinguish:
- `not_started`
- `in_progress`
- `completed`

`user_item_progress` should include at least:
- `state`
- `due_at`
- `last_reviewed_at`
- `interval_days`
- `ease_factor`
- `reps`
- `lapses`
- `streak`
- `mastery_score`
- `last_rating`
- `content_version`

---

## Security rules
- Use **RLS** on all user-specific tables.
- Policies should default to **owner-only** access unless there is a strong reason otherwise.
- No secrets in the repo.
- No API keys or tokens hardcoded in client code.
- No service-role access in browser code.
- Use `.env.example`, never commit real secrets.
- Avoid unsafe admin shortcuts “just for now”.

---

## Route map for V1
Expected route family:
```text
/
/login
/dashboard
/lessons
/lessons/[slug]
/items
/items/[id]
/cards
/cards/[id]
/decks
/decks/dm25-sd1
/decks/dm25-sd2
/review
/review/session
/settings
```

### Route behavior expectations
- `/dashboard`, `/review`, `/settings`, and other user-state-heavy pages should be authenticated
- lessons/items/cards can be public or semi-public if the implementation chooses so, but the personalized overlay must be user-aware
- use clean navigation and mobile-first layout

---

## Expected repo structure
Prefer something close to:
```text
app/
content/
src/
  components/
  domain/
  lib/
  features/
  styles/
scripts/
supabase/
  migrations/
tests/
docs/
  agent-handoffs/
```

Keep content, domain logic, and UI separated.
Do not bury the review algorithm inside page files.
Do not mix canonical content with user progress data.

---

## UI/UX rules
- UI must be in **Italian**.
- The product should feel **clean, readable, calm, and study-oriented**.
- **Mobile-first** matters.
- Prioritize clarity over visual flair.
- Always support:
  - loading states
  - empty states
  - error states
- Keep typography and spacing generous enough for reading Japanese comfortably.
- Furigana support should be easy to toggle.
- Card pages should help the user read, not overwhelm them.

### Accessibility baseline
- semantic HTML when possible
- keyboard reachable controls
- clear focus states
- visible labels on actions

---

## Card-page rules
Each card page should aim to show:
- card name
- deck membership
- Japanese text
- didactic segmentation/breakdown
- quick Italian paraphrase of the effect
- required items
- required patterns
- user coverage score
- what to study next

Every card page should answer:
1. What does this card roughly do?
2. Which Japanese do I need to know to understand it?
3. How close am I to being able to read it myself?

---

## Deck-page rules
Each deck page should aim to show:
- unique cards in the deck
- overall deck coverage
- cards closest to being unlocked
- top linguistic bottlenecks
- suggested next study actions

Deck coverage is a **core feature**, not a nice-to-have.

---

## Testing and quality gates
### Required checks before finishing a task
Run these when available and relevant:
- install dependencies
- lint
- typecheck
- unit tests
- build
- smoke/e2e tests for flows touched

### Default command policy
If the repo already has a lockfile or package manager choice, **respect it**.
- If `pnpm-lock.yaml` exists, use `pnpm`
- Else if `yarn.lock` exists, use `yarn`
- Else default to `npm`

### Recommended default commands
If no project-specific commands exist yet, use/create these defaults:
```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
npx playwright test
```

### Suggested script baseline
By the end of V1, the repo should ideally have scripts like:
```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint || eslint .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "content:validate": "tsx scripts/validate-content.ts",
  "content:build-index": "tsx scripts/build-content-index.ts"
}
```
Adjust to the actual repo once it exists.

---

## Supabase / migration workflow expectations
If Supabase CLI is used, keep DB changes explicit and versioned.
Typical tasks may include:
- SQL migrations under `supabase/migrations/`
- generating TS DB types
- validating schema assumptions

Prefer readable SQL migrations over magic.
Keep schema changes documented in handoff notes.

---

## Environment variable expectations
Keep an `.env.example` with placeholders only.
Typical variables may include:
```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
```
Add only what is truly needed.
Never commit real secrets.

---

## Content authenticity rules
- Use the provided study guide as the canonical domain source for V1 migration work.
- Prefer examples grounded in the real deck/card corpus.
- Avoid fake Japanese examples if a real example exists in the source material.
- Avoid lorem ipsum or placeholder teaching content in the textbook.
- If temporary filler is unavoidable, label it clearly in handoff docs and keep it minimal.

---

## Things agents must avoid
- do not over-engineer
- do not introduce an ORM in V1
- do not introduce a CMS in V1
- do not parse the giant source markdown at runtime
- do not put primary teaching content in the DB
- do not break stable IDs
- do not hardcode secrets
- do not use service-role credentials in browser code
- do not create fake progress metrics
- do not build decorative dashboards with placeholder numbers
- do not leave dead code or half-wired abstractions
- do not perform huge unrelated refactors while solving a narrow task
- do not silently change product scope

---

## Definition of done
A task is only done if:
1. the implementation works coherently for the assigned scope
2. code compiles or is clearly ready to compile after documented setup
3. lint/typecheck/test/build are run where applicable
4. obvious regressions introduced by the task are fixed
5. handoff documentation is updated
6. key decisions and tradeoffs are written down
7. the repo remains understandable for the next agent

---

## When in doubt
Default to these choices:
- choose the simpler architecture
- keep content and user-state separated
- keep UI in Italian
- optimize for readability and maintainability
- prefer truthful metrics over flashy ones
- bias toward the textbook as the primary teaching layer
- connect every concept back to real cards
- leave good handoff notes for the next agent

