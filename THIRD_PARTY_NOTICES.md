# Third-party notices

This document identifies third-party software bundled with, adapted into, or referenced by Mini Translator. It does not replace the project license in [`LICENSE`](LICENSE). Unless stated otherwise, copyright in third-party material remains with its respective copyright holders.

Mini Translator as a whole is distributed under the GNU Affero General Public License, version 3 or (at your option) any later version (`AGPL-3.0-or-later`).

## Bundled software

### Mozilla PDF.js

- Upstream project: [mozilla/pdf.js](https://github.com/mozilla/pdf.js)
- Bundled version: 3.11.174
- Fixed-version source: [PDF.js v3.11.174](https://github.com/mozilla/pdf.js/tree/v3.11.174)
- Copyright notice: Copyright 2023 Mozilla Foundation
- License: Apache License 2.0
- License text: [`LICENSES/Apache-2.0.txt`](LICENSES/Apache-2.0.txt)
- Bundled build inputs: `scripts/vendor/pdfjs/pdf.min.js` and `scripts/vendor/pdfjs/pdf.worker.js`

The release build embeds both files into the distributed `main.js`; their upstream copyright and license notices remain intact. `scripts/pdfjs-hardening.js` applies reviewed, exact-match transformations at build time; the vendored inputs are not edited. It:

- replaces both the script-element loader and evaluated Node worker loader with a statically bundled main-thread worker fallback;
- disables the generic main bundle's three Node-only filesystem imports, failing closed if unexpectedly reached;
- removes generated JavaScript from glyph drawing and PDF PostScript functions, retaining upstream interpreters, range clipping and caching;
- replaces generated-code capability probes with a fixed disabled capability in both main and worker;
- backports the six-number FontMatrix validation from [Mozilla PR #18015](https://github.com/mozilla/pdf.js/pull/18015), also rejecting non-finite numbers.

The glyph change follows the no-generated-code direction of that security patch while preserving 3.11.174's command representation; it is not a wholesale port of the newer rendering architecture. These changes address the generated-glyph-code mechanism behind [CVE-2024-4367](https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq), not every potential defect in this older PDF.js version. The normal Blob-backed Web Worker, static fallback, glyph rendering and PDF-function interpreter remain available. Plugin-owned parsing continues to pass `isEvalSupported: false`; existing documents obtained from Obsidian's native viewer are managed by Obsidian, not this bundled runtime.

## Adapted code

### Translate for Zotero

- Upstream project: [windingwind/zotero-pdf-translate](https://github.com/windingwind/zotero-pdf-translate)
- Copyright: windingwind and contributors
- Upstream license: GNU Affero General Public License v3.0 or later (`AGPL-3.0-or-later`)
- License text: [`LICENSE`](LICENSE)

Parts of the request logic for Youdao, Volcengine, Tencent TranSmart, Google Translate, and the Youdao dictionary were adapted from the upstream project and modified for Mini Translator in 2026. The resulting work is distributed under `AGPL-3.0-or-later`.

## Design acknowledgement

### PDF++

- Upstream project: [RyotaUshio/obsidian-pdf-plus](https://github.com/RyotaUshio/obsidian-pdf-plus)
- Copyright notice: Copyright (c) 2023 Ryota Ushio
- Upstream license: MIT License
- License text: [upstream `LICENSE`](https://github.com/RyotaUshio/obsidian-pdf-plus/blob/master/LICENSE)

Mini Translator's PDF integration design was informed by PDF++. PDF++ is acknowledged as a design reference and is not bundled as a runtime dependency.

## Externally loaded resource

### MathJax

- Upstream project: [MathJax](https://github.com/mathjax/MathJax)
- License: Apache License 2.0

MathJax is not bundled with the plugin. Obsidian renders formulas inside the plugin through its own API; only an optional standalone comparison HTML file requests MathJax 3 from `cdn.jsdelivr.net` when that HTML file is opened.
