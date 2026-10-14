"use strict";

// Optional real Chromium CSS check. Uses an existing browser, no npm packages.
// Run: node tests/manual/check-popup-font-browser.js path/to/chrome-or-edge
const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const { spawnSync } = require("child_process");
const root = path.resolve(__dirname, "../..");
const browser = process.argv[2];
if (!browser) throw new Error("Provide the path to an existing Chrome/Edge executable.");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mini-translator-popup-font-browser-"));
const page = path.join(directory, "font-test.html");
const moduleSource = fs.readFileSync(path.join(root, "src/popup-font.js"), "utf8");
const stylesheet = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const i18n = require(path.join(root, "src/i18n.js"));
const keys = ["settings.popup_fonts", "settings.popup_source_label", "settings.popup_target_label",
  "settings.popup_source_font", "settings.popup_target_font", "settings.popup_font_desc",
  "settings.popup_font_auto", "settings.popup_font_invalid", "settings.popup_font_follow",
  "settings.popup_font_follow_label", "settings.popup_font_follow_desc"];
const locales = {};
for (const locale of ["zh-CN", "en"]) {
  i18n.setUiLanguage(locale);
  locales[locale] = Object.fromEntries(keys.map((key) => [key, i18n.t(key, { min: 10, max: 40 })]));
}
fs.writeFileSync(page, `<!doctype html><meta charset="utf-8">
<style>
body { --font-ui-small: 14px; --input-height: 30px; font-family: system-ui; }
.setting-item { display:flex; align-items:center; padding:24px 0; }
.setting-item-info { flex:1; margin-right:16px; }
.setting-item-description { font-size:13px; color:#777; }
.setting-item-control { display:flex; justify-content:flex-end; }
input { box-sizing:border-box; padding:4px 8px; }
input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none; }
</style>
<style>${stylesheet}</style>
<style>body { --font-smaller: 14px; --font-text-size: 16px; }</style>
<div class="mini-translator-popup" id="popup"><div class="mini-popup-header" id="header" style="font-size:14px">Translate · Copy ×</div>
<div class="mini-popup-body mini-flow"><div class="mini-en-line" id="source">Text / 原文</div>
<div class="mini-zh-line" id="target">Translation / 译文 <span class="MathJax" id="math">x² + y²</span></div>
<div class="mini-dict-line" id="dictionary">noun / 名词</div></div></div>
<pre id="results"></pre><pre id="controls"></pre><script>
const module = { exports: {} };
${moduleSource}
const cases = [
  ["auto", {}, { scale: 1 }, [14, 16]],
  ["custom", { popupSourceFontSize: 18, popupTargetFontSize: 22 }, { scale: 1 }, [18, 22]],
  ["fixed", { popupSourceFontSize: 12, popupTargetFontSize: 20 }, { scale: 2 }, [12, 20]],
  ["scaled", { popupSourceFontSize: 12, popupTargetFontSize: 20, popupFontFollowResize: true }, { scale: 1.5 }, [18, 30]],
  ["auto-scaled", { popupFontFollowResize: true }, { scale: 1.5 }, [21, 24]],
  ["display-boost", {}, { textBoost: 2, smallTextBoost: 1 }, [15, 18]],
  ["explicit-ignores-boost", { popupSourceFontSize: 18, popupTargetFontSize: 22 }, { textBoost: 2, smallTextBoost: 1 }, [18, 22]],
  ["readable-min", { popupSourceFontSize: 10, popupTargetFontSize: 10, popupFontFollowResize: true }, { scale: 0.6 }, [8, 8]],
  ["readable-max", { popupSourceFontSize: 40, popupTargetFontSize: 40, popupFontFollowResize: true }, { scale: 2.4 }, [72, 72]]
];
const popup = document.getElementById("popup");
const measure = (id) => parseFloat(getComputedStyle(document.getElementById(id)).fontSize);
const results = cases.map(([name, settings, options, expected]) => {
  const font = module.exports.popupFontStyles(settings, options);
  popup.style.setProperty("--mini-popup-source-font-size", font.source);
  popup.style.setProperty("--mini-popup-target-font-size", font.target);
  return { name, expected, actual: [measure("source"), measure("target")],
    dictionary: measure("dictionary"), math: measure("math"), header: measure("header"),
    valid: CSS.supports("font-size", font.source) && CSS.supports("font-size", font.target) };
});
document.getElementById("results").textContent = JSON.stringify(results);
// Native HTML inputs and the real settings module, with only Obsidian's small
// DOM-building API mocked. A core-style spinner-hiding rule is included above.
HTMLElement.prototype.createEl = function(tag, opts = {}) {
  const el = document.createElement(tag); el.className = opts.cls || "";
  el.textContent = opts.text || ""; this.appendChild(el); return el;
};
HTMLElement.prototype.createDiv = function(opts) { return this.createEl("div", opts); };
HTMLElement.prototype.createSpan = function(opts) { return this.createEl("span", opts); };
HTMLElement.prototype.addClass = function(cls) { this.classList.add(cls); };
class Setting {
  constructor(parent) {
    this.settingEl = parent.createDiv({ cls:"setting-item" });
    const info = this.settingEl.createDiv({ cls:"setting-item-info" });
    this.name = info.createDiv(); this.desc = info.createDiv({ cls:"setting-item-description" });
    this.controlEl = this.settingEl.createDiv({ cls:"setting-item-control" });
  }
  setName(v) { this.name.textContent=v; return this; }
  setDesc(v) { this.desc.textContent=v; return this; }
  addText(fn) {
    const input = this.controlEl.createEl("input");
    fn({ inputEl:input, setValue(v){ input.value=v; return this; },
      setPlaceholder(v){ input.placeholder=v; return this; },
      onChange(cb){ input.addEventListener("input",()=>cb(input.value)); return this; } }); return this;
  }
  addToggle(fn) {
    const input = this.controlEl.createEl("input"); input.type="checkbox";
    fn({ toggleEl:input, setValue(v){ input.checked=v; return this; },
      onChange(cb){ input.addEventListener("change",()=>cb(input.checked)); return this; } }); return this;
  }
}
const locales = ${JSON.stringify(locales)};
const controlResults=[];
for (const locale of ["zh-CN","en"]) for (const width of [900,420]) {
  const host=document.body.createDiv(); host.style.width=width+"px";
  const plugin={settings:{popupSourceFontSize:18,popupTargetFontSize:22},saveData:async()=>{}};
  module.exports.addPopupFontSettings(host,{Setting,plugin,t:key=>locales[locale][key],refreshPopup(){}});
  const inputs=host.querySelectorAll('input[type="number"]');
  const box=inputs[0].getBoundingClientRect();
  inputs[0].stepUp(); inputs[0].dispatchEvent(new Event("input"));
  inputs[1].stepDown(); inputs[1].dispatchEvent(new Event("input"));
  controlResults.push({ locale,width,rows:host.querySelectorAll('.setting-item').length,
    inputWidth:box.width,inputHeight:box.height,overflow:host.scrollWidth>host.clientWidth,
    spinner:getComputedStyle(inputs[0],'::-webkit-inner-spin-button').webkitAppearance,
    source:plugin.settings.popupSourceFontSize,target:plugin.settings.popupTargetFontSize });
  host.remove();
}
document.getElementById("controls").textContent=JSON.stringify(controlResults);
</script>`, "utf8");
const result = spawnSync(browser, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--disable-background-networking",
  "--disable-component-update", "--dump-dom", `--user-data-dir=${path.join(directory, "profile")}`,
  "--window-size=1200,900",
  pathToFileURL(page).href,
], { encoding: "utf8", windowsHide: true, timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error("Chromium check failed: " + result.stderr);
const match = result.stdout.match(/<pre id="results">([^<]+)<\/pre>/);
if (!match) throw new Error("Chromium did not produce font measurements: " + result.stderr);
const measurements = JSON.parse(match[1]);
for (const row of measurements) {
  assert.equal(row.valid, true, "Invalid font CSS: " + row.name);
  assert.deepEqual(row.actual, row.expected, row.name);
  assert.equal(row.dictionary, row.expected[1], "dictionary: " + row.name);
  assert.equal(row.math, row.expected[1], "formula inheritance: " + row.name);
  assert.equal(row.header, 14, "header must not scale: " + row.name);
  console.log("PASS real Chromium font rendering:", row.name);
}
console.log(`PASS ${measurements.length} real-browser typography cases; temporary fixtures: ${directory}`);
const controlMatch = result.stdout.match(/<pre id="controls">([^<]+)<\/pre>/);
assert.ok(controlMatch, "Missing numeric-control measurements");
for (const row of JSON.parse(controlMatch[1])) {
  assert.equal(row.rows, 1, "Font settings must use a single row");
  assert.equal(row.overflow, false, "Control row must not overflow");
  assert.ok(row.inputWidth >= 70 && row.inputWidth <= 110, "Proportionate number field width");
  assert.ok(row.inputHeight >= 28 && row.inputHeight <= 36, "Proportionate number field height");
  assert.notEqual(row.spinner, "none", "Restore the native up/down stepper");
  assert.equal(row.source, 19); assert.equal(row.target, 21);
  console.log("PASS compact native numeric controls:", row.locale, row.width);
}
