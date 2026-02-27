# Development Guide

## Repo structure

```
web/      Next.js frontend (Cloudflare Pages)
worker/   Cloudflare Workers Durable Object backend
```

## Before committing web changes — always run the build

The Next.js TypeScript compiler picks up ALL `*.ts` files (including test
setup files). A passing lint + test suite does not guarantee the build
succeeds. Always verify before pushing:

```bash
cd web && npm run build
```

This catches TypeScript errors that vitest's looser environment misses
(e.g. missing imports that are only injected as vitest globals at runtime).

## Full pre-push checklist

### Web changes
```bash
cd web
npm test          # vitest — must pass
npm run lint      # eslint — must be clean
npm run build     # next build — must succeed
```

### Worker changes
```bash
cd worker
npm test          # vitest — must pass
```

## Deployment

The web frontend is deployed via **Cloudflare Pages** (`npm run build` in
`web/`). The worker backend is deployed via **Cloudflare Workers** using
`wrangler`.

### Viewing deployment logs from the CLI

```bash
# List recent Pages deployments
wrangler pages deployment list --project-name <pages-project-name>

# Tail live worker logs
wrangler tail meld-worker

# List worker deployments
wrangler deployments list
```

## CI

`.github/workflows/ci.yml` runs on every push and PR:
- **Worker tests** — `npm test` in `worker/`
- **Web tests + lint + build** — `npm test`, `npm run lint`, `npm run build` in `web/`

The build step in CI is the final gate before deployment. If CI is green,
the deployment should succeed.

## Key architecture notes

- Players are identified by server-assigned UUID (`playerId`), not by their
  display name. This prevents bugs when two players share the same name.
- On join, the server sends `{ type: "welcome", playerId }` so each client
  knows its own id.
- Round submissions include `{ id, name, word }` — always use `id` for
  lookups, `name` only for display.
- `PersistedState` fields with nested objects/arrays must be initialised as
  fresh literals (not spread from a module-level constant) to prevent
  shared-reference mutations across game rounds.
