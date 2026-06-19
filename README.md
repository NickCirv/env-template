<div align="center">

# env-template

**Generate `.env.example` from `.env` — strip secrets, keep keys, catch drift in CI.**

[![License: MIT](https://img.shields.io/badge/License-MIT-brightgreen?labelColor=0B0A09)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen?labelColor=0B0A09)](package.json)
[![Node: >=18](https://img.shields.io/badge/node-%3E%3D18-blue?labelColor=0B0A09)](package.json)

</div>

## Install

```bash
npx github:NickCirv/env-template generate
```

No global install needed. Runs directly from GitHub.

## Usage

```bash
# Generate .env.example from your .env (strips all values)
npx github:NickCirv/env-template generate

# Check .env is in sync with .env.example (use in CI)
npx github:NickCirv/env-template check

# Show which keys differ between .env and .env.example
npx github:NickCirv/env-template diff

# Add missing keys from .env.example into .env (with empty values)
npx github:NickCirv/env-template sync

# Flag sensitive keys that lack a documentation comment
npx github:NickCirv/env-template audit
```

| Flag | Command | Description |
|---|---|---|
| `--input <file>` | `generate` | Source env file (default: `.env`) |
| `--output <file>` | `generate` | Output file (default: `.env.example`) |
| `--no-hints` | `generate` | Output empty values instead of smart placeholders |
| `--env <file>` | `check` / `diff` / `sync` | Your env file (default: `.env`) |
| `--template <file>` | `check` / `diff` / `sync` | Template file (default: `.env.example`) |

## What it does

Reads your `.env`, strips all values, and writes a safe `.env.example` with pattern-matched placeholders (`your_stripe_secret_here`, `https://example.com`, `postgres://user:pass@...`). The `check` command compares `.env` against `.env.example` and exits non-zero on missing keys — drop it into any CI pipeline to catch new secrets that never got documented. Real values never appear in any output file.

## CI Integration

```yaml
# .github/workflows/env-check.yml
- run: npx github:NickCirv/env-template check
```

---

<sub>Zero dependencies · Node >=18 · MIT · by <a href="https://github.com/NickCirv">NickCirv</a></sub>
