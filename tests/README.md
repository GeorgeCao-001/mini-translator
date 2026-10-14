# Tests

All automated tests run with Node.js built-in modules only. They use mocked Obsidian APIs and do not read `data.json`, contact translation services, or use real credentials.

## Automated suites

Run from the repository root:

```bash
node tests/core.test.js
node tests/i18n.test.js
node tests/model-config.test.js
node tests/source-order.test.js
node tests/source-order-integration.test.js
node tests/config-ui.test.js
node tests/selection-menu.test.js
node tests/popup-font.test.js
node tests/regressions.test.js
node tests/pdfjs-hardening.test.js
```

| File | Coverage |
|---|---|
| `core.test.js` | Languages, formatting, batching, PDF layout reconstruction, popup placement, PDF.js loading, and orb loading |
| `i18n.test.js` | Chinese/English catalog parity, placeholders, locale resolution, translated names, and every message key referenced by `main.js` |
| `model-config.test.js` | Model endpoint resolution, provider response parsing, authoritative list replacement, and one-time legacy migration |
| `source-order.test.js` | Saved source-order normalization, fallback eligibility, primary-source precedence, and reordering boundaries |
| `source-order-integration.test.js` | Offline doubles exercise the real sentence and dictionary fallback loops without provider network calls |
| `config-ui.test.js` | API configuration visibility, draft creation, validation, cancellation, retry, duplicate prevention, draggable source picker controls, and one-row sidebar selector layout |
| `selection-menu.test.js` | Editor/reading/PDF menu scope, selection snapshots, localization, duplicate prevention, unloading, immediate manual popup/paint-before-request timing, cached results, cancellation and separate automatic dwell; also runs against `dist/main.js` |
| `popup-font.test.js` | Font normalization, source/target hierarchy, fixed versus resize scaling, native-size geometry, scale persistence, content/viewport-clamp isolation and actual popup resize callbacks; also runs against `dist/main.js` |
| `regressions.test.js` | Truncated LLM responses, batch parsing, and cross-page continuation regressions |
| `pdfjs-hardening.test.js` | Exact-match/fail-closed transformations, retained license notices, no generated code even when enabled by callers, inert injection-style glyph arguments, FontMatrix validation, glyph/PostScript interpreter parity and static Worker fallback |

`regressions.test.js` optionally accepts another `main.js` snapshot:

```bash
node tests/regressions.test.js path/to/main.js
```

## Manual diagnostics

### Chromium popup typography

Optional real Chromium font-rendering check (uses an existing Chrome or Edge executable and an isolated temporary profile; no dependencies):

```bash
node tests/manual/check-popup-font-browser.js path/to/chrome-or-edge
```

This verifies popup source/translation/dictionary sizes, formula font inheritance, CSS validity, unchanged header controls, and compact native up/down inputs in Chinese/English at wide/narrow settings widths. It does not launch Obsidian or use personal browser data.

### Chromium PDF security and rendering

```bash
node tests/manual/check-pdf-security-browser.js path/to/chrome-or-edge
```

This optional test uses a loopback DevTools connection and isolated temporary browser profiles, never personal browser data. It renders generated text/vector/Type 4 PostScript PDFs with valid and malformed font matrices, both through a genuine Blob Worker and after deliberately blocking Workers. Code-generation attempts are denied and counted in the page and Worker. No translation endpoints or third-party dependencies are used.

### PDF parser

`manual/repro-parse.js` runs the real extraction path against local PDFs without translating or making network requests:

```bash
node tests/manual/repro-parse.js path/to/file.pdf [another.pdf ...]
```

Do not add test PDFs, translated documents, Vault data, or credentials to the repository.

## Complete release check

```bash
node scripts/check-release.js
```

This runs syntax checks, all automated suites, the self-contained release build and smoke test, text/vector/PostScript and malformed-font PDF parses with string code generation disabled, a deterministic-build comparison, and `git diff --check`. The optional genuine browser render check must be run separately where Chromium is available.
