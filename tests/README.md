# Tests

All automated tests run with Node.js built-in modules only. They use mocked Obsidian APIs and do not read `data.json`, contact translation services, or use real credentials.

## Automated suites

Run from the repository root:

```bash
node tests/core.test.js
node tests/i18n.test.js
node tests/config-ui.test.js
node tests/regressions.test.js
```

| File | Coverage |
|---|---|
| `core.test.js` | Languages, formatting, batching, PDF layout reconstruction, popup placement, PDF.js loading, and orb loading |
| `i18n.test.js` | Chinese/English catalog parity, placeholders, locale resolution, translated names, and every message key referenced by `main.js` |
| `config-ui.test.js` | API configuration visibility, draft creation, validation, cancellation, retry, and duplicate prevention |
| `regressions.test.js` | Truncated LLM responses, batch parsing, and cross-page continuation regressions |

`regressions.test.js` optionally accepts another `main.js` snapshot:

```bash
node tests/regressions.test.js path/to/main.js
```

## Manual PDF parser diagnostic

`manual/repro-parse.js` runs the real extraction path against local PDFs without translating or making network requests:

```bash
node tests/manual/repro-parse.js path/to/file.pdf [another.pdf ...]
```

Do not add test PDFs, translated documents, Vault data, or credentials to the repository.

## Complete release check

```bash
node scripts/check-release.js
```

This runs syntax checks, all automated suites, the self-contained release build and smoke test, an end-to-end parse of an in-memory PDF through the hardened embedded PDF.js worker runtime, a deterministic-build comparison, and `git diff --check`.
