# Quick popup history

## 2026-11-18

- User requested up/down navigation without a list, visible history mode, five recent results and one-click return. Reused the existing popup, translation history and bilingual renderer; no new persistent history, translation request, dependency or sidebar layout change.
- Browsing a completed popup keeps its current DOM, scroll offsets, heading and copy text for restoration. History uses the visible entry's copy text and header attribution. Switching to a new selection exits history, including for locked popups.
- Added a command to reopen recent translations after accidental dismissal. Clearing existing history exits history browsing; active translation requests are not replaced by a history view.
- Validation PASS: full local release check; 29 popup lock/history tests each against source and final bundle; four isolated Chromium language/width cases verified navigation, restore, lock and header reachability.
- No version bump, Git commit/push, Vault sync or release.

## 2026-11-18 · Current Vault sync

- Copied only installed plugin assets; all three hashes match the tested dist. Existing data.json checksum unchanged, no plugin restart, commit or release.
- Previous installed assets backed up outside the Vault: %TEMP%\mini-translator-before-popup-history-sync-c8bd7a4a

## 2026-11-18 · Return button placement

- Moved Return to the left of both arrows, with an empty reserved slot when hidden so neither arrow shifts inside the toolbar. DOM order also matches visual order. Extended isolated-browser assertions for the order and stable slots.
- Complete local release check and all four isolated Chromium layouts passed; verified the two arrows do not move within the toolbar when Return appears or disappears. Not synced to the Vault.

## 2026-11-18 · Return layout Vault sync

- Synced only verified plugin assets on request. Installed hashes match the tested build and data.json is unchanged. No restart, commit or release.
- Previous assets backed up outside the Vault: %TEMP%\mini-translator-before-return-layout-sync-6ccdbd7d

## 2026-11-20 · Local Git checkpoint

- Rebuilt and reran the complete local release check, four popup layouts and eight typography layouts. All passed. DeepL and Keychain request tests are mocked; a live API smoke test remains a release-preparation task.
- Checkpoint includes popup history, credential storage, official DeepL support and the pending CSS compatibility fix. Untracked README preview files are excluded. No version bump, push or release.
