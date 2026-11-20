# Advanced typography UI implementation

## 2026-11-08

- Implemented the user-approved editable Figma proposal (light/dark/common/expanded) using native Obsidian controls and theme variables; no dependencies, downloaded fonts, or embedded screenshots. Lucide icons reuse Obsidian setIcon.
- Kept source/target and popup/sidebar style records, legacy font sizes, and one-shot style copying. No prompt, request, PDF, Worker, full-document output or clipboard-content changes.
- Moved live sample to a separate preview pane. Preserved input, preview and MathJax DOM during individual changes; only the editor scrolls at wide widths, and narrow windows stack vertically. Footer/save errors stay reachable.
- Added accessible role/surface tabs, collapsible sections, emphasis shortcuts with default restoration, native numeric steppers and percent opacity. Popup resize policy matches the existing compact setting and is excluded from sync/reset of base styles.
- User had existing uncommitted typography work; a temporary filesystem backup was taken before editing. No Git commit/push, version change or Release.
- Validation results will be appended after checks.

- Visual verification found the bundle injector treated embedded dollar tokens as replacement syntax (for example, a display-math $$ became $). Switched only that injector to a replacement callback; third-party inputs/patches remain untouched. Added source-and-bundle assertions for retained delimiters and display-mode MathJax calls.

## Validation and local deployment

- Complete release check PASS: source and bundle each pass 26 typography tests, all existing suites, self-contained runtime smoke tests, PDF parses, deterministic rebuild and git diff whitespace checks.
- Isolated Chromium PASS: 8 Chinese/English × light/dark × wide/narrow cases, including actual collapsed visibility, non-overlapping narrow form flow, stable input/preview identity, keyboard tabs, opacity conversion, emphasis/reset, failed-write retry and resize policy.
- Genuine Chromium PDF PASS: 4 generated render cases across Blob Worker and blocked-Worker fallback; no dynamic execution. One attempt hit a transient blocked debugging port and was rerun successfully.
- Visually inspected generated fixtures only (not Obsidian): light/common, expanded sidebar, dark and narrow states. Fixed native stepper/unit order and narrow grid row overlap. Real MathJax rendering remains owned by Obsidian; automated checks assert display-mode calls and unchanged formula delimiters.
- Copied the three verified local dist assets into the current Vault plugin folder. Existing data.json hash was unchanged; previous installed assets backed up outside the Vault. No live app control, Git commit/push, version bump or Release.


## 2026-11-08 · Independent section expansion

- Removed cross-section auto-collapse from the native details toggle handler. Each section now changes only its own open state and chevron; both can remain open, and role/surface state remains independent.
- No style values, persistence rules, CSS, preview, translation/PDF paths or version changes. Added source/bundle and real-browser regressions for both-open visibility, independent closing/reopening and per-role/per-surface restoration.
- Validation PASS: complete release check (27 typography tests each for source and bundle), deterministic build, and 8 isolated Chromium layout/interaction combinations, including both sections visible together and independent closing. Updated only the installed main.js in the current Vault; data.json unchanged. No Git commit/push or Release.

## 2026-11-08 · Pre-commit scope and risk review

- Baselines: freshly fetched origin/main f144947 (published 1.0.3), plus current local HEAD 52e4967. The earlier local PDF-range/picker and popup-lock commits were reviewed separately; their history was not rewritten.
- Scope: advanced popup/sidebar typography, source/target presentation, independent section expansion, local preview/presets/copy/reset, existing-size migration, paragraph presentation, UI localization and their tests/documentation. No material unrelated feature changes found in the reviewed diff.
- Supporting change explicitly noted: the build injector now uses a replacement callback to preserve literal dollar sequences. This is a build-layer change, not CSS-only, and is required for source/bundle fidelity. Third-party input and hardening code were not modified.
- Runtime-source comparison: direct Node filesystem/process/VM imports, eval/new Function and dynamic script creation remain absent. requestUrl call sites 13 -> 13, clipboard sites 3 -> 3, Vault read sites 1 -> 1, write sites 4 -> 4, deletion sites 3 -> 3. No added HTTP(S) URL literals. Counts are review aids, not a security proof; changed call paths were also inspected.
- Existing cancellation cleanup still removes only this run's generated output paths and a newly created image directory. It was not added by typography. PDF document destroy calls release memory/resources, not source files.
- Model configuration/source-order modules, credentials handling, manifest/version, workflows, dependencies, third-party vendor inputs and license notices are unchanged from the fetched baseline. Typography persistence preserves unrelated settings; opening or toggling sections does not save.
- Tests use Node filesystem/VM and isolated headless Chromium through the existing loopback driver, solely for repository fixtures/temp profiles. These capabilities are not included in the installed plugin. No live Obsidian capture/control or personal Vault data was used in the tests.
- Final validation PASS: full release check and deterministic build, 27 typography tests on source and bundle respectively, 8 isolated typography browser combinations, and 4 genuine PDF render cases through Blob Worker and blocked-Worker fallback. Current Vault assets match the tested dist files.
- No obvious hard-coded token/private-key patterns found in candidate files. data.json, generated dist assets, local screenshots and temp profiles are excluded from this commit. No newly introduced high-risk operation was found; this is a scoped diff review and regression validation, not a complete formal security audit.
- User requested a Git checkpoint: commit locally using the existing George_Cao identity; no co-author trailer, push, history rewrite, version bump or Release.

## 2026-11-08 · Prepare 1.0.4 and push main

- User authorized pushing the current work to the remote and preparing v1.0.4. Updated manifest/compatibility mapping, promoted the existing Unreleased changes to a dated 1.0.4 entry, and added bilingual release notes and exact-tag/asset guidance.
- Minimum Obsidian version stays 1.13.7. No runtime code, dependencies, permissions, third-party code, credentials or existing user settings changed in this preparation step.
- Push is limited to main; no tag or GitHub Release is created automatically. Existing CI only runs checks with read permissions.
- Validation PASS for 1.0.4: complete release check, all source/bundle tests, embedded PDF parse and security checks, deterministic rebuild, and diff whitespace validation. JS/CSS asset hashes match the previously audited build; only the installation manifest changes version. Prior isolated browser validations remain applicable to the identical runtime. Prepared a normal fast-forward main push without publishing a tag or Release.

## 2026-11-08 · Post-release text-decoration compatibility warning

- User reported two CSS compatibility warnings in published 1.0.4 (styles.css lines 1889 and 1903). Both map directly to the advanced source/target text-decoration-line overrides. This was missed by the local known-pattern guard; prior browser checks verified rendering in current Chromium, not parity with the community scanner. Complete local checks must not be described as proof of a warning-free community scan.
- Consulted the upstream doiuse text-decoration feature detector and MDN shorthand documentation. Replaced just the two CSS3 longhands with basic text-decoration using the same validated none/underline/line-through variable values; no selector hiding, scanner suppression, feature removal, dependency, runtime JS or third-party changes.
- Added known-pattern release guards for text-decoration longhands and extended multi-value shorthand. Confirmed the new guard rejects the existing 1.0.4 dist stylesheet before applying the fix (expected failing test).
- Extended the existing isolated Chromium fixture to cover underline, line-through, none, auto restoration and role/surface isolation for all popup/sidebar source/target combinations. The fixture does not access live Obsidian or user settings.
- Complete local release check PASS, including the new CSS guards and deterministic rebuild. Runtime JS and manifest hashes are unchanged; only the stylesheet asset hash changed. The expanded isolated-browser matrix has not been executed in this repair turn. User requested stopping here and deferring publication until the next version: no version change, Git commit/push, Vault sync or modification of published 1.0.4 assets.