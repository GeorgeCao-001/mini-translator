# Changelog

All public changes to Mini Translator are recorded here. Versions follow [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-09-20

Initial public release.

### Added

- Selection translation in Markdown, reading views, and PDFs.
- Automatic source-language detection and configurable target languages.
- English and Simplified Chinese interfaces with automatic Obsidian-language detection.
- Built-in translation and dictionary services with fallback behavior.
- OpenAI-compatible model profiles, model discovery, and local Ollama support.
- Resizable translation popups, a bilingual sidebar, history, and cache isolation by language pair and model.
- LLM-powered PDF translation to readable Markdown with optional source-page comparison HTML.
- Single-column and two-column PDF reading-order reconstruction, footnote separation, formula protection, and figure/table page preservation.
- Cancellable full-document progress UI with configurable floating-orb skins and size.
- A cleaner source layout with internal UI modules under `src/` and bundled third-party build inputs under `scripts/vendor/`.

### Security and compatibility

- Hardened the embedded PDF.js release runtime by replacing dynamic fake-worker script loading with a bundled fallback and disabling unused Node.js filesystem branches.
- Reworked first-line indentation, MathJax targeting, reduced-motion overrides, and the frost-prism skin to avoid Community Plugin CSS compatibility warnings without changing the corresponding UI behavior.

The detailed pre-release development log is archived in [`docs/PRE_RELEASE_HISTORY.md`](docs/PRE_RELEASE_HISTORY.md).
