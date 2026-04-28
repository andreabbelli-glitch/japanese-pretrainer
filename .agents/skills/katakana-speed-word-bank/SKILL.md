---
name: katakana-speed-word-bank
description: Use when adding user-provided katakana words, names, media terms, or ad hoc practice terms to the Katakana Speed training word bank in the Japanese Custom Study repo.
---

# Katakana Speed Word Bank

Use this repo-specific skill inside `/Users/abelli/Codex/Japanese Custom Study`
when the user gives katakana terms to practice in Katakana Speed.

## Workflow

1. Work from the repo root.
2. Add terms with the bundled script. Use a media slug for media-derived words;
   use `custom` for ad hoc user lists.

```bash
.agents/skills/katakana-speed-word-bank/scripts/add-katakana-words.mjs --source custom --word カタカナ
.agents/skills/katakana-speed-word-bank/scripts/add-katakana-words.mjs --source duel-masters-dm25 --words-file /absolute/path/words.txt
```

3. The script updates only
   `src/features/katakana-speed/model/media-word-bank.json`. It normalizes
   Unicode with NFKC, appends new unique entries, and skips duplicates.
4. Do not modify `content/` for this workflow.
5. Do not change scheduler priority just because terms were added. The terms
   become normal `word` catalog candidates; they are not preferred over the
   existing word bank.

## Input

Supported forms:

- `--word <surface>` repeated one or more times;
- `--words-file <path>` with one surface per line;
- extra positional words after options.

Use `--dry-run` to preview additions without editing.

## Verification

For word-bank-only updates, run:

```bash
./scripts/with-node.sh pnpm exec vitest run tests/katakana-speed-operational-catalog.test.ts tests/katakana-speed-catalog-tokenizer.test.ts
./scripts/with-node.sh pnpm check
```

If implementation code, UI, routing, DB, or session planning changes too, also
run `./scripts/with-node.sh pnpm release:check`.
