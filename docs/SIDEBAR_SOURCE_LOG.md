# Sidebar source input

## 2026-11-20

- Added an editable sidebar source field. Typing or selecting draft text never triggers a request; submit or Ctrl/Cmd+Enter uses the sidebar's existing provider and language choices. A successful result joins existing history; failures preserve the draft, and incidental selection results cannot overwrite it.
- Full local release check passed. All 26 offline UI cases pass against both source and bundle, including the three new source-editor regression cases. No live provider calls, Vault sync, Git commit, version change or release.
- PDF annotation design: support both Vault-only annotation storage and writing standard annotations directly into the PDF. Reference: [PDF++ annotating PDFs](https://ryotaushio.github.io/obsidian-pdf-plus/annotating-pdfs.html). The current bundled PDF.js does not expose the required highlight editor. Do not write any user PDF before verifying a dedicated writer on fixtures, including reopened documents and annotations visible in an independent reader. No annotation code, writer dependency or user PDF changes in this change.

## 2026-11-20 - History source and settings shortcuts

- Created local checkpoint f4a5352 for editable sidebar source; docs/readme-preview/ was left untouched and untracked.
- Added a small settings gear and a Go to source action under expanded history details. Saving takes the exact source path and location from the original selection before translation. PDF selection links are optional with a native page fallback; Markdown records scroll to a validated offset or uniquely matching literal text. Legacy history opens only unambiguous sources.
- Full local release check passed, with navigation tests and all 28 offline UI checks against source and bundle. No live Obsidian test, new dependency, PDF annotation, Vault sync, push, or release. The new navigation code remains uncommitted.

## 2026-11-20 - Current Vault sync

- Synced the verified sidebar build to the current Vault. Updated main.js and styles.css; manifest.json already matched. All three installed asset hashes match dist; data.json is unchanged. Previous assets backed up in the system temporary directory as mini-translator-before-sidebar-nav-sync-e448467c. No reload, commit, push, or release.

## 2026-11-20 - Compact edit button

- Replaced the sidebar source edit label with a small native pencil icon; retained the localized tooltip, accessible name, and keyboard operation. Full local release check passed. No Vault sync or commit.
- Moved the copy-translation action alongside the pencil in the result header and gave both icons the same compact size. The source and bundle UI tests verify the icons' order, visibility and clipboard content. Full local release check passed again.

## 2026-11-20 - Sidebar icons Vault sync

- Installed the tested edit and copy icons in the current Vault. Updated main.js and styles.css; manifest.json already matched. Verified all asset hashes and unchanged data.json. Previous assets were backed up in the system temporary directory as mini-translator-before-sidebar-icons-sync-393f735f. No reload, commit, push or release.

## 2026-11-20 - Compact inline source editing

- Keep the current translation, attribution and tools visible while editing. Hide only the old source preview, use a two-line editor aligned to the same width as the result, and keep copy working on the last successful translation. Clicking the pencil again only focuses the editor. Full source and bundle release checks passed; no Vault sync or commit.

## 2026-11-20 - In-place sidebar editing and Vault sync

- Reused the original text rectangle for editing, preserving translation and icon positions. Full local release check and four isolated Chromium layout cases passed. Installed the verified main.js and styles.css; manifest.json and data.json were unchanged. Backed up prior assets in the system temporary directory as mini-translator-before-inline-source-sync-9aae6009. No reload, commit, push or release.

## 2026-11-20 - Live inline source sizing and keyboard submit

- Enter submits; Shift+Enter inserts a native newline; IME confirmation does not submit. The source slot retains the same width and grows or shrinks with the draft, including soft wrapping and trailing blank lines. Cancel restores the original rendered nodes. Full local release check and four isolated Chromium layout cases passed. No Vault sync or commit.

## 2026-11-20 - Live source sizing Vault sync

- Synced the verified keyboard and live-sizing build. All installed assets match dist; manifest.json and data.json were unchanged. Previous assets backed up in the system temporary directory as mini-translator-before-live-sizing-sync-9660f061. No reload, commit, push or release.

## 2026-11-20 - Keep manual line breaks in translations

- Sidebar typing and pasting preserve explicit line breaks through translation, display, clipboard and history. Use one whole-text request with verified boundary markers where possible; only fall back to line requests if the provider drops or reorders them, and skip those retries when the draft is stale. Multiline math remains intact and PDF reflow is unchanged. Full release check passed, including 29 UI cases against source and bundle. No Vault sync, commit or real provider requests.

## 2026-11-20 - Manual line breaks Vault sync

- Synced the checked build that keeps manual line breaks in translations, clipboard and history. Verified all installed asset hashes and unchanged data.json. Backed up prior assets in the system temporary directory as mini-translator-before-linebreak-sync-89e9e05c. No reload, commit, push or release.

## 2026-11-20 - Shift+Enter starts a paragraph

- Insert a double newline only for the sidebar keyboard shortcut; leave pasted line breaks intact. Route manual results back through the existing paragraph renderer so Chinese first-line indents and custom spacing work again. Verified shortcut, paragraph nodes, clipboard, history, and PDF line reflow in the full source and bundle check. No Vault sync or commit.

## 2026-11-20 - Paragraph shortcut Vault sync

- Synced the checked build with Shift+Enter starting a paragraph and existing indentation restored for manually edited translations. Verified all installed asset hashes and unchanged data.json. Backed up prior assets in the system temporary directory as mini-translator-before-paragraph-shortcut-sync-3876faef. No reload, commit, push or release.

## 2026-11-21 - 1.0.5 release preparation

- Prepared the version metadata and bilingual release notes. The old CSS warning patterns are checked in the built assets. Documented local file enumeration and write-only clipboard behavior. The preview directory and Vault data are excluded.
