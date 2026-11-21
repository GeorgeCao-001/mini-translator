# Mini Translator

**English** | [简体中文](README.zh-CN.md)

Mini Translator is a desktop-only Obsidian plugin for translating selected text, looking up English words, and translating academic PDFs. It works in Markdown editors, reading views, and PDF views, with a nearby popup and a bilingual sidebar. For full papers, an OpenAI-compatible model can generate readable Markdown and an optional source-page comparison HTML file.

> [!IMPORTANT]
> Chinese and English are the only language directions reviewed by the author. Other languages have only been exercised through AI and translation-API automation, without native-speaker review. Use those results as a reference, not as an authoritative translation.

> [!NOTE]
> The plugin interface includes English and Simplified Chinese. **Interface language** defaults to **Auto**, which follows Obsidian's language; it can also be selected explicitly in Mini Translator settings.

### Choose PDFs and pages

The full-document confirmation window defaults to **all pages** and also accepts physical PDF ranges such as `1-3, 7, 10-12` (not printed page labels). The batch chooser offers a Vault folder tree, name/path search, Shift multi-selection, folder selection, and a persistent selected-file basket. Set an independent range for each selected PDF; leave its field empty for all pages. Selection and analysis updates preserve list scroll and focused inputs. Folder expansion and tree scroll survive reopening while the plugin remains loaded.

Estimates are recalculated for the selected pages before Start is enabled. Only selected pages are extracted and translated; consecutive selected pages retain paragraph continuation, but separate ranges are never joined or put in the same translation batch. Source-page images and comparison HTML are limited to the selection and retain original PDF page numbers. Partial translations have separate filenames and `source_pages` metadata. Selecting all pages keeps the existing output naming. No OCR is added; empty/scanned selections show an error.

## Highlights

- **Selection translation** in Markdown, reading views, and PDFs. The popup stays near the real text selection, avoids covering it, and can be resized manually.
- **Sentence and paragraph modes**. Sentence mode keeps bilingual alignment; paragraph mode preserves more context.
- **Selection context menu**. Right-click selected text in an editor, reading view, or PDF and choose **Translate selected text**; it uses paragraph mode and preserves the existing menu actions.
- **Advanced typography**. Popup and sidebar have separate source and translation/dictionary styles: local fonts, 10–40 px sizes, line/letter/word spacing, paragraph and block spacing, first-line indent, alignment, weight, italic, decoration, text/background colors and opacity. Open the advanced panel in plugin settings: compact source/target tabs and independently collapsible controls sit beside a fixed live sample preview. Font/paragraph and additional options can stay open together. Three presets, reset, automatic saving with retry on failure, and one-click copying in either direction remain available. The native numeric fields include percentage opacity; the popup resize-scaling policy is also accessible here. Copying transfers base styles, not popup zoom or dimensions. Blank-line paragraphs display separately without splitting formulas or changing copied text. No font downloads; full-document output is unaffected.
- **Popup lock**. Toggle the lock icon at the top right to keep the current popup open while taking notes. Outside clicks and double-clicks no longer dismiss it; **Escape** and **×** still close it. Selecting new text updates the same locked popup, preserving its position and size; late responses cannot overwrite the newer selection. Closing it clears the lock; a newly opened popup starts unlocked.
- **Popup font controls**. Set source and translation/dictionary font sizes independently (10–40 px), or leave them empty to follow Obsidian. Optionally scale text when manually resizing the popup; automatic layout changes do not change the text scale.
- **Multilingual input and output**. Source language can be detected automatically, with more than 70 target-language options and layout handling for CJK and RTL scripts.
- **Bilingual interface**. Settings, commands, popups, the sidebar, configuration dialogs, progress UI, notices, and generated comparison controls are available in English and Simplified Chinese.
- **English word lookup** with pronunciation, parts of speech, and definitions.
- **Bilingual sidebar** for language pairs, translation providers, dictionaries, models, history, and copying translated text.
- **LaTeX-aware translation** that protects existing formulas. LLM providers can also attempt to reconstruct formulas damaged by a PDF text layer.
- **Full-PDF translation** with heuristic single/two-column reading order, caption and footnote separation, cross-page continuation handling, and preservation of pages containing figures or tables.
- **Controllable long-running tasks** with progress, cancellation, and a draggable floating orb when minimized.

## Installation

### Community Plugins directory

After the plugin is listed:

1. Open **Settings → Community plugins**.
2. Select **Browse**.
3. Search for **Mini Translator**, then install and enable it.

### Manual installation

Download `main.js`, `manifest.json`, and `styles.css` from the same GitHub Release and place them in:

```text
<Vault>/.obsidian/plugins/mini-translator/
```

Reload Obsidian and enable the plugin. Do not mix files from different releases.

## Quick start

1. Select the language icon in the left ribbon to open the Mini Translator sidebar.
2. Choose a source-to-target language pair and a translation provider.
3. Select text, right-click, and choose **Translate selected text** for paragraph translation. The popup opens immediately; the automatic-selection dwell delay does not apply to this manual action. Alternatively, run one of these commands:
   - `Translate selected text (sentence by sentence)`
   - `Translate selected text (paragraph)`
4. Assign your own hotkeys under **Settings → Hotkeys**, or enable delayed automatic selection translation in the plugin settings.

While a selection translation is pending, double-click outside the popup or press `Esc` to cancel. After translated text appears, a single outside click closes the popup.

Under **Mini Translator settings → Selection popup**, the compact **Font size (px)** row contains source and translation numeric inputs with up/down steppers, plus **Resize text** (off by default). Dragging the bottom-right corner with this option enabled scales body text based on both window dimensions; header buttons stay unchanged. **Remember the last popup size** also remembers the text scale. These settings do not change sidebar text or full-PDF output.

**Type or edit in the sidebar:** paste your own source text, then select **Translate** or press Enter. Use Shift+Enter to start a new paragraph that is also kept in the translation. **Edit source** opens the text of the current result for another translation. Drafts are not sent while typing.

Use the sidebar gear to open Mini Translator settings. In a history item's **Source details**, **Go to source** opens the recorded PDF selection or page, or returns to the matching Markdown text when available.

**Popup history:** use the title-bar ↑ / ↓ buttons to browse up to five earlier completed translations. The header marks history items, and the return button restores your current translation. If you closed the popup, run **Open recent popup history** from the command palette (or assign a hotkey).

## Translation and dictionary providers

### Built-in services

- Translation: Youdao, Volcengine, Tencent TranSmart, Google Translate, Bing Translator / Microsoft Translator, CNKI Academic Translation, and DeepL (official API).
- English dictionaries: Baidu Translate, Youdao Dictionary, and Oxford Learner's Dictionaries.

**DeepL:** In translation service configuration, select **DeepL (official API)** and select/create your own API key in **Obsidian Keychain**, then choose DeepL as the translation source. Only the secret name is saved in plugin settings; secrets are managed per device by Obsidian. The `:fx` suffix selects the official Free endpoint; other keys use the Pro endpoint. DeepL is excluded from fallback by default; enabling its fallback checkbox is an explicit opt-in to API usage. When selected directly, DeepL errors are shown without sending text to another provider. Your API plan controls charges and data handling (free plans may restrict personal/confidential content); [DeepL terms](https://www.deepl.com/en/pro-license) apply. Full-PDF translation still requires an LLM provider.

Some built-in providers use public web endpoints rather than guaranteed developer APIs. Availability may change because of region restrictions, rate limits, login requirements, CAPTCHA challenges, or provider-side changes. If a built-in translation provider fails, Mini Translator may try other compatible built-in providers, which means the same text can be sent to more than one service. User-configured LLM providers and directly selected DeepL do not use that fallback chain.

Open the translation-source or dictionary-source picker in the sidebar or plugin settings, then **drag rows to reorder them**. The first row is the primary source; clicking a row also makes it primary. Built-in rows have a checkbox controlling whether they can be used as a fallback (the selected source is always tried). LLM profiles are primary-only and never silently fall back to another service. Unsupported built-in translation language pairs are skipped.

### OpenAI-compatible models

You can configure an OpenAI-compatible Chat Completions endpoint. Templates are provided for DeepSeek, OpenAI, Google Gemini, xAI, Mistral AI, Groq, OpenRouter, Kimi, Qwen, Zhipu GLM, SiliconFlow, Ollama, LM Studio, and vLLM. Templates prefill only the endpoint; they intentionally do not freeze model names that can become obsolete.

After entering the required API key, select **Fetch models from API** and choose one of the model IDs returned by that endpoint. A successful fetch replaces the profile's previous discovered list, so removed or stale preset names are not retained. If a compatible gateway does not expose `/models`, you can still add its documented model ID manually.

New profiles are transactional: nothing is saved until you select **Create**. Selecting **Cancel**, closing the dialog, or switching configuration type discards the draft. Full-PDF translation requires an LLM profile and may incur provider charges.

## Full-PDF translation

Run either command:

- `Translate the current PDF` — translate the active PDF
- `Full-document translation: choose files` — select one or more PDFs

Output is written next to the source PDF:

- `<filename>·翻译.md`: a continuous reading version for Obsidian;
- `<filename>·翻译.html`: an optional source-page/translation comparison view;
- local page images for pages detected as containing figures or tables.

### Limitations

- Full translation requires an extractable PDF text layer. Scanned documents need OCR first.
- The plugin does not recognize or translate text inside images, and it does not upload PDF page images to a vision model.
- Reading order, footnotes, captions, line-break repair, and formula reconstruction are heuristic. Always verify complex layouts against the original PDF.
- Full translation sends extracted text blocks to the selected LLM endpoint and may use many requests and tokens.
- The optional comparison HTML loads MathJax from `cdn.jsdelivr.net` when opened. Disable HTML output if you do not want that extra formula-rendering request.
- Translation is only offline when the selected endpoint is local, such as a local Ollama server.

## Network, privacy, and local data

Mini Translator has no author-operated proxy, analytics, or client-side telemetry. Obsidian sends requests directly to the selected service.

| Operation | Data and possible destination |
|---|---|
| Built-in translation | Selected text and language parameters are sent to Youdao, Volcengine, Tencent, Google, Bing/Microsoft, CNKI, or DeepL (official API, user Keychain secret; fallback opt-in only). Automatic fallback can send the same text to several compatible built-in services. |
| Dictionary lookup | The queried word is sent to Baidu, Youdao, or Oxford. |
| LLM translation | System instructions, source text, and language parameters are sent to the configured OpenAI-compatible endpoint. Its API key is used for authentication. |
| Model discovery | A request is sent to the `/models` route derived from the configured endpoint; the returned IDs replace the profile's discovered model list. |
| Full-PDF translation | Extracted PDF text blocks are sent to the selected LLM endpoint. The original PDF and page images are not uploaded as vision input. |
| Comparison HTML | The browser requests MathJax from jsDelivr when the generated HTML file is opened. |

The PDF picker and older history entries without a saved path use Obsidian’s local file index to find candidates. Enumeration does not send file names or paths to a translation service. Copy actions write the selected text or translation to the clipboard and do not read it.

Plugin settings, plaintext credentials and up to 50 translation-history entries are stored **unencrypted** below. LLM, Azure/Bing and CNKI default to plaintext; use **Secure mode** in their credential settings to select a Keychain secret. After saving, only the secret name remains in that configuration. DeepL always uses Keychain. Switching back requires re-entering the key. Old backups can still contain plaintext, and model exports still include keys for plaintext profiles (but not protected keys or their references):

```text
<Vault>/.obsidian/plugins/mini-translator/data.json
```

Vault sync or backup tools may copy this file. Never commit, publish, or share `data.json`. Exported configuration JSON also contains API keys and must be treated as sensitive. Credentials are not sent to the plugin author; they are used only when contacting the associated service endpoint.

Before using any remote translation or model provider, review its privacy policy, terms, regional availability, and pricing. Do not send sensitive or restricted documents to a service you do not trust.

## Compatibility

- Obsidian desktop only.
- Minimum Obsidian version: see `manifest.json`.
- Built-in web endpoints depend on the provider and the user's network environment.

## Development and release

The release builder hardens the pinned PDF.js 3.11.174 inputs: it removes generated JavaScript and evaluated worker loading, keeps the native glyph/PDF-function interpreters, and validates font matrices. Original third-party files and license notices are preserved. This is targeted hardening, not a full PDF.js upgrade or a guarantee of general PDF safety; Obsidian's own PDF viewer remains managed by Obsidian. See [third-party modification details](THIRD_PARTY_NOTICES.md).

Run the complete offline release check:

```bash
node scripts/check-release.js
```

Build only the three Community Plugins release assets:

```bash
node scripts/build-release.js
```

See [tests/README.md](tests/README.md) for individual test suites and [docs/RELEASE.md](docs/RELEASE.md) for the release checklist and file classification. Public changes are recorded in [CHANGELOG.md](CHANGELOG.md); pre-release internal history is archived in [docs/PRE_RELEASE_HISTORY.md](docs/PRE_RELEASE_HISTORY.md).

## Acknowledgements

Parts of the translation-provider request logic were adapted from [Translate for Zotero](https://github.com/windingwind/zotero-pdf-translate), licensed under `AGPL-3.0-or-later`, and modified for Mini Translator in 2026. The PDF integration design was informed by [PDF++](https://github.com/RyotaUshio/obsidian-pdf-plus), licensed under the MIT License.

Copyright in third-party code remains with its respective copyright holders. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for attribution, modification notices, and license details.

## License

Copyright (C) 2026 GeorgeCao.

Mini Translator is free software: you may redistribute it and/or modify it under the terms of the [GNU Affero General Public License, version 3 or (at your option) any later version](LICENSE) (`AGPL-3.0-or-later`). This program is distributed without any warranty; see the license for details.
