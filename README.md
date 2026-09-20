# Mini Translator

**English** | [简体中文](README.zh-CN.md)

Mini Translator is a desktop-only Obsidian plugin for translating selected text, looking up English words, and translating academic PDFs. It works in Markdown editors, reading views, and PDF views, with a nearby popup and a bilingual sidebar. For full papers, an OpenAI-compatible model can generate readable Markdown and an optional source-page comparison HTML file.

> [!IMPORTANT]
> Chinese and English are the only language directions reviewed by the author. Other languages have only been exercised through AI and translation-API automation, without native-speaker review. Use those results as a reference, not as an authoritative translation.

> [!NOTE]
> The plugin interface includes English and Simplified Chinese. **Interface language** defaults to **Auto**, which follows Obsidian's language; it can also be selected explicitly in Mini Translator settings.

## Highlights

- **Selection translation** in Markdown, reading views, and PDFs. The popup stays near the real text selection, avoids covering it, and can be resized manually.
- **Sentence and paragraph modes**. Sentence mode keeps bilingual alignment; paragraph mode preserves more context.
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
3. Select text and run one of these commands:
   - `Translate selected text (sentence by sentence)`
   - `Translate selected text (paragraph)`
4. Assign your own hotkeys under **Settings → Hotkeys**, or enable delayed automatic selection translation in the plugin settings.

While a selection translation is pending, double-click outside the popup or press `Esc` to cancel. After translated text appears, a single outside click closes the popup.

## Translation and dictionary providers

### Built-in services

- Translation: Youdao, Volcengine, Tencent TranSmart, Google Translate, Bing Translator / Microsoft Translator, and CNKI Academic Translation.
- English dictionaries: Baidu Translate, Youdao Dictionary, and Oxford Learner's Dictionaries.

Some built-in providers use public web endpoints rather than guaranteed developer APIs. Availability may change because of region restrictions, rate limits, login requirements, CAPTCHA challenges, or provider-side changes. If a built-in translation provider fails, Mini Translator may try other compatible built-in providers, which means the same text can be sent to more than one service. User-configured LLM providers do not use that fallback chain.

### OpenAI-compatible models

You can configure an OpenAI-compatible Chat Completions endpoint. Templates are provided for DeepSeek, OpenAI, Kimi, Qwen, Zhipu GLM, SiliconFlow, and local Ollama. Templates only prefill endpoint and model information; they do not include accounts, credits, or API keys.

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
| Built-in translation | Selected text and language parameters are sent to Youdao, Volcengine, Tencent, Google, Bing/Microsoft, or CNKI. Automatic fallback can send the same text to several compatible built-in services. |
| Dictionary lookup | The queried word is sent to Baidu, Youdao, or Oxford. |
| LLM translation | System instructions, source text, and language parameters are sent to the configured OpenAI-compatible endpoint. Its API key is used for authentication. |
| Model discovery | A request is sent to the configured endpoint's `/models` route. |
| Full-PDF translation | Extracted PDF text blocks are sent to the selected LLM endpoint. The original PDF and page images are not uploaded as vision input. |
| Comparison HTML | The browser requests MathJax from jsDelivr when the generated HTML file is opened. |

Settings, API keys, tokens, and up to 50 recent translation-history entries are stored **unencrypted** in:

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
