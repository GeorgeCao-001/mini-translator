"use strict";

const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const i18n = require("../src/i18n.js");

assert.deepEqual(i18n.validateMessageCatalogs(), [], "locale catalogs must have identical keys and placeholders");
assert.equal(i18n.normalizeUiLanguage("invalid"), "auto");
assert.equal(i18n.resolveUiLanguage("auto", "zh-TW"), "zh-CN");
assert.equal(i18n.resolveUiLanguage("auto", "en-US"), "en");

i18n.setUiLanguage("en");
assert.equal(i18n.getUiLanguage(), "en");
assert.equal(i18n.t("common.cancel"), "Cancel");
assert.equal(
  i18n.t("full.document", { file: "paper.pdf", pages: 3 }),
  "Document: paper.pdf (3 pages)"
);
assert.equal(i18n.languageName("ja", "日语"), "Japanese");
assert.equal(i18n.providerName("有道"), "Youdao");
assert.equal(i18n.phaseName("翻译中"), "Translating");

i18n.setUiLanguage("zh-CN");
assert.equal(i18n.t("common.cancel"), "取消");
assert.equal(i18n.languageName("ja", "日语"), "日语");
assert.equal(i18n.providerName("有道"), "有道");

const main = fs.readFileSync(path.join(__dirname, "..", "main.js"), "utf8");
const usedKeys = [...main.matchAll(/\bt\(\s*["']([^"']+)["']/g)].map((match) => match[1]);
for (const key of new Set(usedKeys)) {
  assert.equal(i18n.hasMessageKey(key), true, `missing localized message used by main.js: ${key}`);
}

console.log(`PASS UI localization (${new Set(usedKeys).size} referenced message keys)`);
