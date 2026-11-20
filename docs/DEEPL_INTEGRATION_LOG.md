# DeepL official API integration

## 2026-11-17

- User authorized a small, standards-based integration following the existing CNKI provider/configuration flow. Existing uncommitted text-decoration compatibility fixes are preserved. Pre-edit copies are outside the repository in a temporary backup.
- Consulted DeepL's official authentication, text-translation, limits and license documentation, Obsidian's SecretStorage guide and 1.11.5 encrypted-storage release notes, and the existing CNKI/Bing implementations before editing. No SDK, dependency installation, author proxy or private web endpoint.
- Added a standalone provider module and one entry in the current service manager. DeepL is translation-only; it does not act as a dictionary/LLM and does not change PDF extraction, formula reconstruction, Worker, typography or full-document translation.
- Actual API keys are read from host SecretStorage for each request. Plugin settings save only the selected secret name; no plaintext fallback, automatic migration of other credentials, or secret storage bypass. Host Keychain encryption depends on OS support. No real credential was read during implementation/tests.
- Text goes only to api-free.deepl.com or api.deepl.com over HTTPS with header authentication. Added UTF-8 body-size checks and sanitized errors for invalid credentials, quota, throttling and unavailable service. Existing math placeholders and restoration remain on the shared selection path.
- Default fallback choices exclude DeepL to avoid unintended billing. Users can explicitly enable it as a fallback. Direct selection never silently forwards failures to other providers; attribution includes DeepL's domain.
- Added source/bundle provider, configuration UI and localization tests using fake Keychain/HTTP doubles. README changes only document this integration and privacy distinction; no README redesign.
- Added a fail-closed name-collision guard: an existing LLM profile named DeepL must be renamed by the user before selecting the new official provider. No profile is changed/deleted, and text is not sent to an unintended LLM endpoint.
- Validation PASS: 17 offline DeepL tests on source and bundle respectively; 21 configuration UI tests; complete release/security/CSS checks and deterministic rebuild; 8 isolated Chromium typography combinations including the previously pending decoration regressions; 4 genuine Chromium PDF render cases (Blob Worker and blocked-Worker fallback).
- Scope review: only DeepL provider/configuration/request routing, opt-in fallback defaults, localization, bundle inclusion and related tests/docs were added. No PDF/Worker/vendor/model-prompt or filesystem/dynamic-execution capability change. The existing uncommitted CSS fix remains intact. Manifest and compatibility mapping are unchanged.
- Limits: no real API account/key was supplied or read. Live endpoint authentication, actual translation quality/quota, real Obsidian native Keychain UI and third-party community rescanning remain unverified; mock/browser checks are not proof of those outcomes.
- Final local dist SHA-256: main.js 17a9e86daad99574e2de550538a0d94cf09cf33d3c2991aa041ddb331fb62cd0; manifest.json 0eb6378f2cd924d942e25d158c389b878cd1918417ad0ca59bc5dd88303925c0; styles.css 439969dbb7160dac7fe3f0153573fc1dad25fac3943792b1009e1d51679e1262.
- No version bump, Git commit/push, Vault deployment or GitHub Release.
- References: https://developers.deepl.com/docs/getting-started/auth ; https://developers.deepl.com/api-reference/translate ; https://developers.deepl.com/docs/resources/usage-limits ; https://www.deepl.com/en/pro-license ; https://docs.obsidian.md/plugins/guides/secret-storage ; https://obsidian.md/changelog/2026-01-20-desktop-v1.11.5/

## 2026-11-17 · Current Vault deployment

- User authorized syncing the tested local build into the current Vault. Copied only main.js, manifest.json and styles.css; installed SHA-256 values match the validated dist assets.
- Existing data.json existence/hash was verified unchanged. No real API secret was read, no settings were modified, and no live Obsidian control or recording was performed.
- Previous installed executable/style/manifest files backed up outside the Vault: %TEMP%\mini-translator-vault-before-deepl-e55473d2
- Version remains 1.0.4. No Git commit/push or GitHub Release. Re-enable the plugin or reload Obsidian to load the updated files.
