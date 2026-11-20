# Optional credential protection

## 2026-11-18

- Plaintext remains the default for LLM, Azure/Bing and CNKI. The per-credential Secure mode reuses Obsidian Keychain. DeepL stays Keychain-only. No dependencies or automated migration.
- Validate the selected reference, then save it and clear the active plaintext together. Failed validation or save leaves existing credentials unchanged. Returning to plaintext requires explicit input; no fallback to an old key or automatic copying out of Keychain. Old backups are unaffected.
- Resolve stored references for translations, dictionary lookups and model discovery; hide raw network errors and response details for protected credentials. No endpoint or transport-policy change.
- Legacy duplicate LLM copies of the credential being moved are cleared on successful opt-in. Exports omit protected bindings and values; imports cannot claim a local binding or replace an existing protected profile with a same-named import.
- Validation PASS: full local release check, 23 offline configuration UI cases, credential request-path tests in source and bundle, DeepL regressions and deterministic rebuild. Tests used mocked Obsidian Keychain and HTTP, not real accounts or the running Vault.
- No version bump, Git commit/push, Vault sync or release during implementation.

## 2026-11-18 · Current Vault sync

- Synced the tested local build after user request. All three installed files match the validated build. Existing settings hash is unchanged; no credential migration or plugin restart was performed.
- Previous plugin files backed up outside the Vault: %TEMP%\mini-translator-before-credential-sync-373da967
