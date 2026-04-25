# Codex Local Sandbox

Questa cartella rende il repository pronto per agenti Codex locali che lavorano
in sandbox `workspace-write`.

## File inclusi

- `config.toml`: default di progetto per sandbox e approval policy.
- `scripts/setup-worktree.sh`: bootstrap idempotente da eseguire su ogni nuovo
  worktree Codex.
- `scripts/dev.sh`: avvio server di sviluppo.
- `scripts/check.sh`: gate minimo richiesto dal repo.
- `scripts/release-check.sh`: gate completo locale.
- `scripts/test-e2e.sh`: suite Playwright locale.
- `scripts/db-setup.sh`: migrazioni + seed locale.
- `scripts/content-import.sh`: import del workspace `content/`.

Le skill Codex specifiche del repo non stanno in questa cartella: la fonte
versionata e scansionata da Codex e `.agents/skills/`. `.codex/` resta riservata
alla configurazione locale condivisa e alle action del progetto.

## Configurazione consigliata nell'app Codex

- Setup script worktree: `.codex/scripts/setup-worktree.sh`
- Action `Dev`: `.codex/scripts/dev.sh`
- Action `Check`: `.codex/scripts/check.sh`
- Action `Release Check`: `.codex/scripts/release-check.sh`
- Action `E2E`: `.codex/scripts/test-e2e.sh`
- Action `DB Setup`: `.codex/scripts/db-setup.sh`
- Action `Content Import`: `.codex/scripts/content-import.sh`

## Note operative

- Il setup usa sempre `./scripts/with-node.sh` per agganciare Node `22.x`.
- Il sandbox deve poter scrivere nella cache Playwright locale e leggere `nvm`
  fuori dal repo; questi path sono dichiarati in `config.toml`.
- I path extra-repo sono intenzionalmente assoluti per questo setup
  single-user. Se cambi account macOS o sposti la cache Playwright, aggiorna
  `config.toml`.
