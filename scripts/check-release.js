"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");

function run(label, command, args) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

function hashes() {
  return ["main.js", "manifest.json", "styles.css"].map((name) => {
    const file = path.join(root, "dist", name);
    return [name, crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")];
  });
}

run("Credential storage tests", process.execPath, ["tests/credential-storage.test.js"]);
run("DeepL module syntax", process.execPath, ["--check", "src/deepl.js"]);
run("DeepL provider tests", process.execPath, ["tests/deepl.test.js"]);
run("Source syntax", process.execPath, ["--check", "main.js"]);
run("Localization syntax", process.execPath, ["--check", "src/i18n.js"]);
run("Model configuration syntax", process.execPath, ["--check", "src/model-config.js"]);
run("Source ordering syntax", process.execPath, ["--check", "src/source-order.js"]);
run("Draggable source picker syntax", process.execPath, ["--check", "src/source-picker.js"]);
run("Selection context menu syntax", process.execPath, ["--check", "src/selection-menu.js"]);
run("Popup lock syntax", process.execPath, ["--check", "src/popup-lock.js"]);
run("Sidebar source editor syntax", process.execPath, ["--check", "src/sidebar-source-editor.js"]);
run("Popup lock test syntax", process.execPath, ["--check", "tests/popup-lock.test.js"]);
for (const name of ["typography", "typography-settings"]) run("Advanced typography syntax", process.execPath, ["--check", "src/" + name + ".js"]);
run("Advanced typography tests", process.execPath, ["tests/typography.test.js"]);
run("Popup font syntax", process.execPath, ["--check", "src/popup-font.js"]);
for (const name of ["page-ranges", "pdf-file-picker", "pdf-translation-ui"]) {
  run("PDF selection module syntax: " + name, process.execPath, ["--check", "src/" + name + ".js"]);
}
run("PDF range and picker tests", process.execPath, ["tests/pdf-selection.test.js"]);
run("Build script syntax", process.execPath, ["--check", "scripts/build-release.js"]);
run("PDF hardening syntax", process.execPath, ["--check", "scripts/pdfjs-hardening.js"]);
run("Release test syntax", process.execPath, ["--check", "scripts/test-release.js"]);
run("PDF runtime test syntax", process.execPath, ["--check", "scripts/test-pdf-runtime.js"]);
run("Browser PDF security test syntax", process.execPath, ["--check", "tests/manual/check-pdf-security-browser.js"]);
run("PDF picker layout test syntax", process.execPath, ["--check", "tests/manual/check-pdf-picker-browser.js"]);
run("Advanced typography layout test syntax", process.execPath, ["--check", "tests/manual/check-typography-browser.js"]);
run("Popup lock layout test syntax", process.execPath, ["--check", "tests/manual/check-popup-lock-browser.js"]);
run("Browser driver syntax", process.execPath, ["--check", "tests/helpers/chromium-page.js"]);
run("Core tests", process.execPath, ["tests/core.test.js"]);
run("Localization tests", process.execPath, ["tests/i18n.test.js"]);
run("Model configuration tests", process.execPath, ["tests/model-config.test.js"]);
run("Source ordering tests", process.execPath, ["tests/source-order.test.js"]);
run("Source ordering integration tests", process.execPath, ["tests/source-order-integration.test.js"]);
run("Configuration UI tests", process.execPath, ["tests/config-ui.test.js"]);
run("Selection context menu tests", process.execPath, ["tests/selection-menu.test.js"]);
run("Popup font tests", process.execPath, ["tests/popup-font.test.js"]);
run("Popup lock tests", process.execPath, ["tests/popup-lock.test.js"]);
run("Regression tests", process.execPath, ["tests/regressions.test.js"]);
run("PDF hardening security tests", process.execPath, ["tests/pdfjs-hardening.test.js"]);
run("Release build", process.execPath, ["scripts/build-release.js"]);
run("Bundled selection context menu tests", process.execPath, ["tests/selection-menu.test.js", "dist/main.js"]);
run("Bundled popup font tests", process.execPath, ["tests/popup-font.test.js", "dist/main.js"]);
run("Bundled PDF range and picker tests", process.execPath, ["tests/pdf-selection.test.js", "dist/main.js"]);
run("Bundled popup lock tests", process.execPath, ["tests/popup-lock.test.js", "dist/main.js"]);
run("Bundled advanced typography tests", process.execPath, ["tests/typography.test.js", "dist/main.js"]);
run("Bundled credential storage tests", process.execPath, ["tests/credential-storage.test.js", "dist/main.js"]);
run("Bundled DeepL integration tests", process.execPath, ["tests/deepl.test.js", "dist/main.js"]);
run("Bundled configuration UI tests", process.execPath, ["tests/config-ui.test.js", "dist/main.js"]);
const first = hashes();
run("Deterministic rebuild", process.execPath, ["scripts/build-release.js"]);
const second = hashes();
if (JSON.stringify(first) !== JSON.stringify(second)) {
  throw new Error("连续两次发布构建的 SHA-256 不一致");
}
run("Git diff check", "git", ["diff", "--check"]);

console.log("\nPASS complete release check");
for (const [name, hash] of second) console.log(`${hash}  ${name}`);
