# Changelog

All public changes to Mini Translator are recorded here. Versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.3] - 2026-10-14

### Added

- Added a single **Translate selected text** context-menu action for editor, reading-view, and PDF selections. It preserves the selected text and popup anchor before menu focus changes, reuses paragraph translation, and leaves existing menu actions intact.
- Added independent source and translation/dictionary popup font sizes, an optional manual-resize text-scaling toggle, and saved text scale when popup-size memory is enabled. Defaults retain Obsidian typography and fixed text size.

### Fixed

- Removed all evaluated loaders and generated-function paths from the release's embedded PDF.js main/worker builds, retaining native glyph/PostScript interpreters and backporting numeric FontMatrix validation. Upstream inputs and license notices are unchanged.
- Replaced sidebar `column-gap`/`row-gap` with equivalent `gap` spacing to resolve the remaining multicolumn compatibility warning; added CSS and PDF security regression checks, including real Chromium Worker/fallback rendering.
- Fixed double-click word selection cancelling pending or in-flight translation, preserving the community contribution in [PR #1](https://github.com/GeorgeCao-001/mini-translator/pull/1).
- Compacted popup font controls into one settings row with source/translation labels, native numeric steppers, and the resize toggle; restored the stepper arrows hidden by Obsidian's default styles.
- Manual context-menu translation now closes the menu and shows the source popup immediately, before text processing and provider startup. It no longer holds up the first paint; automatic selection dwell retains its separate configured delay.
- Normalized release-build text inputs to LF so Windows working copies and clean checkouts of the tagged source produce identical assets.

## [1.0.2] - 2026-09-24

### Added

- Added compact draggable translation/dictionary source pickers in the sidebar and settings. Dragging the first item changes the primary source; built-in fallback eligibility is controlled in the same picker. Model profiles remain primary-only.
- Added endpoint-only templates for Google Gemini, xAI, Mistral AI, Groq, OpenRouter, LM Studio, and vLLM.
- Added tested model-catalog parsing for OpenAI-compatible and common local-gateway response shapes.

### Fixed

- Stopped recreating an empty DeepSeek configuration after the user deletes every language-model profile.
- Model discovery now replaces stale preset entries with the IDs actually returned by the configured `/models` endpoint and keeps the selected model only when it is still available.
- Requests to keyless local endpoints no longer include an empty Bearer authorization header.

### Changed

- Made the draggable source pickers content-sized and left-aligned instead of stretching or opening a fixed-width menu; kept the original selector-button frame while removing extra option-list borders.
- Kept sidebar labels beside their selectors, with translation and dictionary on the first row and the active model neatly aligned on a second row; retained the copy action.
- Provider templates no longer embed model names that can become outdated; users fetch the current list from their provider or add a documented ID manually.
- Clarified model selection in the configuration interface and expanded endpoint resolution to support base, Chat Completions, Responses, and explicit Models URLs.

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
