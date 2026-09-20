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

run("Source syntax", process.execPath, ["--check", "main.js"]);
run("Localization syntax", process.execPath, ["--check", "src/i18n.js"]);
run("Build script syntax", process.execPath, ["--check", "scripts/build-release.js"]);
run("Release test syntax", process.execPath, ["--check", "scripts/test-release.js"]);
run("Core tests", process.execPath, ["tests/core.test.js"]);
run("Localization tests", process.execPath, ["tests/i18n.test.js"]);
run("Configuration UI tests", process.execPath, ["tests/config-ui.test.js"]);
run("Regression tests", process.execPath, ["tests/regressions.test.js"]);
run("Release build", process.execPath, ["scripts/build-release.js"]);
const first = hashes();
run("Deterministic rebuild", process.execPath, ["scripts/build-release.js"]);
const second = hashes();
if (JSON.stringify(first) !== JSON.stringify(second)) {
  throw new Error("连续两次发布构建的 SHA-256 不一致");
}
run("Git diff check", "git", ["diff", "--check"]);

console.log("\nPASS complete release check");
for (const [name, hash] of second) console.log(`${hash}  ${name}`);
