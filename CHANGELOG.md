# Changelog

All public changes to Mini Translator are recorded here. Versions follow [Semantic Versioning](https://semver.org/).

## [1.0.1] - 2026-09-20

### Fixed

- Replaced PDF.js's dynamic fake-worker script loading with a statically bundled fallback and disabled unused Node.js filesystem branches in the release build.
- Removed Community Plugin CSS compatibility warnings while preserving first-line indentation, MathJax layout, reduced-motion behavior, progress feedback, and the frost-prism skin.

### Changed

- Moved the unchanged PDF.js build inputs from `vendor/` to the scanner-excluded `scripts/vendor/` directory while retaining their upstream notices and license.
- Added release checks for dynamic script creation, Node.js filesystem imports, warned CSS patterns, and real PDF parsing.

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
- A cleaner source layout with internal UI modules under `src/` and bundled third-party runtime files under `vendor/`.

The detailed pre-release development log is archived in [`docs/PRE_RELEASE_HISTORY.md`](docs/PRE_RELEASE_HISTORY.md).
