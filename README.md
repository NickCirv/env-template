![Banner](banner.svg)

# env-template

Generate `.env.example` from `.env` — strip values, keep keys, validate team sync.

Zero external dependencies. Node 18+. Single file.

```bash
npx env-template generate
```

---

## Why

Every project has a `.env` with real secrets and a `.env.example` for onboarding. Keeping them in sync manually is error-prone. `env-template` automates it.

- **Never commits secrets** — only key names go in the template
- **Smart placeholders** — hints like `your_stripe_key_here`, `https://example.com`, `3000`
- **Team sync validation** — catch missing or undocumented keys before they cause incidents
- **Zero dependencies** — nothing to audit, nothing to update

---

## Install

**Use via npx (no install needed):**
```bash
npx env-template generate
```

**Install globally:**
```bash
npm install -g env-template
```

**Short alias:**
```bash
envt generate
```

---

## Commands

### `generate` — Create `.env.example` from `.env`

Strips all values. Preserves keys, comments, and blank lines.

```bash
env-template generate
env-template generate --input .env.local --output .env.example
env-template generate --no-hints
```

**Options:**
- `--input <file>` — source file (default: `.env`)
- `--output <file>` — output file (default: `.env.example`)
- `--no-hints` — output empty values instead of smart placeholders

**Smart placeholders** (pattern-matched, never real values):

| Key pattern | Placeholder |
|---|---|
| `*_KEY`, `*_SECRET`, `*_TOKEN` | `your_xxx_key_here` |
| `*_URL`, `*_HOST` | `https://example.com` |
| `*_PORT` | `3000` |
| `*_ENV`, `NODE_ENV` | `development` |
| `DATABASE_*`, `*_DB_URL` | `postgres://user:pass@localhost:5432/dbname` |
| `*_EMAIL` | `you@example.com` |

---

### `check` — Validate `.env` against `.env.example`

```bash
env-template check
env-template check --env .env.local --template .env.example
```

Reports:
- `MISSING` — keys in template but not in your `.env` (exits with code 1)
- `UNDOCUMENTED` — keys in your `.env` but not in template

Use this in CI to enforce team sync:
```yaml
- run: npx env-template check
```

---

### `diff` — Show key differences

```bash
env-template diff
```

Shows which keys are only in `.env`, only in `.env.example`, or in both. Never shows values.

---

### `sync` — Add missing keys to `.env`

```bash
env-template sync
```

Appends keys from `.env.example` that are missing from your `.env` with empty values. Safe — never overwrites existing values.

---

### `audit` — Detect sensitive undocumented keys

```bash
env-template audit
```

Scans for keys that look sensitive (`*_KEY`, `*_SECRET`, `*_TOKEN`, etc.) and flags those missing a comment above them.

---

## Example

**Input `.env`:**
```bash
# Application
APP_NAME=My App
NODE_ENV=production
PORT=4000

# Database
DATABASE_URL=postgres://admin:supersecret@db.prod.example.com:5432/myapp

# Stripe
STRIPE_SECRET_KEY=sk_live_abc123realkey
STRIPE_WEBHOOK_SECRET=whsec_realwebhooksecret

# Feature flags
ENABLE_BETA=true
```

**Output `.env.example`:**
```bash
# Application
APP_NAME=
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgres://user:pass@localhost:5432/dbname

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret_here

# Feature flags
ENABLE_BETA=
```

Real values never appear in the output.

---

## CI Integration

```yaml
# .github/workflows/env-check.yml
name: Env Check
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: npx env-template check
```

---

## Security

This tool's entire purpose is to strip secrets. It:

- Never writes actual env values to any file
- Never logs or echoes values
- Uses only built-in Node.js modules (`fs`, `path`)
- Has zero npm dependencies — nothing in your supply chain

---

## License

MIT
