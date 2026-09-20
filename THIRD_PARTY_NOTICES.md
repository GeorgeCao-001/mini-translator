# Third-party notices

This document identifies third-party software bundled with, adapted into, or referenced by Mini Translator. It does not replace the project license in [`LICENSE`](LICENSE). Unless stated otherwise, copyright in third-party material remains with its respective copyright holders.

Mini Translator as a whole is distributed under the GNU Affero General Public License, version 3 or (at your option) any later version (`AGPL-3.0-or-later`).

## Bundled software

### Mozilla PDF.js

- Upstream project: [mozilla/pdf.js](https://github.com/mozilla/pdf.js)
- Bundled version: 3.11.174
- Copyright notice: Copyright 2023 Mozilla Foundation
- License: Apache License 2.0
- License text: [`LICENSES/Apache-2.0.txt`](LICENSES/Apache-2.0.txt)
- Bundled build inputs: `scripts/vendor/pdfjs/pdf.min.js` and `scripts/vendor/pdfjs/pdf.worker.js`

The release build embeds both files into the distributed `main.js`; their upstream copyright and license notices remain intact. Mini Translator's release builder replaces PDF.js's browser fake-worker script-element loader with a statically bundled main-thread worker fallback, so a failed Web Worker cannot trigger dynamic script injection. It also disables the generic bundle's three Node-only filesystem branches: the plugin always supplies an in-memory `Uint8Array`, and any unexpected attempt to enter those branches fails closed. The normal Blob-backed Web Worker path and the worker implementation remain available.

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
