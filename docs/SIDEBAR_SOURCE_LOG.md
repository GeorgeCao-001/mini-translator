# Sidebar source input

## 2026-11-20

- Added an editable sidebar source field. Typing or selecting draft text never triggers a request; submit or Ctrl/Cmd+Enter uses the sidebar's existing provider and language choices. A successful result joins existing history; failures preserve the draft, and incidental selection results cannot overwrite it.
- Full local release check passed. All 26 offline UI cases pass against both source and bundle, including the three new source-editor regression cases. No live provider calls, Vault sync, Git commit, version change or release.
- PDF annotation design: support both Vault-only annotation storage and writing standard annotations directly into the PDF. Reference: [PDF++ annotating PDFs](https://ryotaushio.github.io/obsidian-pdf-plus/annotating-pdfs.html). The current bundled PDF.js does not expose the required highlight editor. Do not write any user PDF before verifying a dedicated writer on fixtures, including reopened documents and annotations visible in an independent reader. No annotation code, writer dependency or user PDF changes in this change.
