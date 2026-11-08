"use strict";
// Source and release run identical offline tests. No Vault/settings files or network.
const assert = require("assert/strict"), fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.resolve(__dirname, ".."), sourcePath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, "main.js");
class Element {
  constructor(tag = "div", options = {}) {
    this.tagName = tag; this.className = options.cls || ""; this.textContent = options.text || "";
    this.type = options.type || ""; this.value = ""; this.children = []; this.dataset = {}; this.attrs = {}; this.events = {};
    this.style = { setProperty(name, value) { this[name] = value; } }; this.isConnected = true;
    this.classList = { add: c => { if (!this.classList.contains(c)) this.className += " " + c; },
      remove: c => { this.className = this.className.split(/\s+/).filter(x => x !== c).join(" "); },
      contains: c => this.className.split(/\s+/).includes(c) };
    for (const [k, v] of Object.entries(options.attr || {})) this.setAttribute(k, v);
  }
  appendChild(e) { if (e.parent) e.parent.children = e.parent.children.filter(c => c !== e); e.parent = this; this.children.push(e); return e; }
  createEl(tag, options = {}) { return this.appendChild(new Element(tag, options)); }
  createDiv(options) { return this.createEl("div", options); } createSpan(options) { return this.createEl("span", options); }
  setAttribute(k, v) { this.attrs[k] = String(v); this[k] = String(v); } getAttribute(k) { return this.attrs[k]; }
  empty() { this.children = []; this.textContent = ""; } replaceChildren(...es) { this.empty(); es.forEach(e => this.appendChild(e)); }
  setText(text) { this.empty(); this.textContent = text; } appendText(text) { this.textContent += text; }
  addClass(c) { this.classList.add(c); } hide() { this.hidden = true; } show() { this.hidden = false; }
  addEventListener(k, fn) { this.events[k] = fn; } removeEventListener(k) { delete this.events[k]; }
  remove() { this.isConnected = false; if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); }
  contains(e) { return e === this || this.children.some(c => c.contains(e)); }
  querySelector(tag) { return nodes(this).slice(1).find(e => e.tagName === tag) || null; }
  getBoundingClientRect() { const left = parseFloat(this.style.left) || 0, top = parseFloat(this.style.top) || 0, width = parseFloat(this.style.width) || 400, height = parseFloat(this.style.height) || 250; return { left, top, width, height, right: left + width, bottom: top + height }; }
  setCustomValidity(message) { this.validationMessage = message; } focus() { this.focused = true; }
  click() { return this.onclick?.({ stopPropagation() {} }); } animate() { return { cancel() {} }; }
}
function nodes(el) { return [el, ...el.children.flatMap(nodes)]; }
class Modal {
  constructor(app) { this.app = app; this.modalEl = new Element(); this.contentEl = this.modalEl.createDiv(); }
  open() { this.onOpen?.(); } close() { this.onClose?.(); }
}
const document = { body: new Element(), documentElement: {}, createElement: tag => new Element(tag), addEventListener() {}, removeEventListener() {} };
const window = { innerWidth: 1500, innerHeight: 900, setTimeout, clearTimeout, addEventListener() {}, removeEventListener() {},
  requestAnimationFrame: fn => { fn(); return 1; }, cancelAnimationFrame() {} };
let mathCalls = [];
const obsidian = new Proxy({}, { get(_, key) {
  if (key === "Modal") return Modal;
  if (key === "setIcon") return () => {};
  if (key === "renderMath") return (text, display) => { mathCalls.push({ text, display }); return new Element("math", { text }); };
  if (key === "finishRenderMath") return () => {};
  if (key === "requestUrl") return () => { throw Error("No network permitted"); };
  return class {};
} });
const sandbox = { module: { exports: {} }, window, document, console, setTimeout, clearTimeout,
  require(name) { if (name === "obsidian") return obsidian; if (name.startsWith("./src/")) return require(path.join(root, name)); throw Error(name); } };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(sourcePath, "utf8") + ";globalThis.__typo={TYPOGRAPHY,TypographyModal,MiniTranslatorView,I18N,renderPairsTo,MATH_RE};", sandbox, { filename: sourcePath });
const { TYPOGRAPHY: T, TypographyModal, MiniTranslatorView, I18N, renderPairsTo, MATH_RE } = sandbox.__typo;
const plain = v => JSON.parse(JSON.stringify(v));
const tests = [], test = (name, fn) => tests.push([name, fn]);
function fixture(surface = "popup") {
  const plugin = { settings: { popupSourceFontSize: 14, popupTargetFontSize: 18, primarySource: "Untouched provider",
    llmProfiles: [{ name: "Offline test", apiKey: "test-only" }], fullHtml: true, popupFontFollowResize: true, popupLastFontScale: 1.5 },
    saves: [], refreshes: 0, async saveData(s) { this.saves.push(plain(s)); }, refreshTypography() { this.refreshes++; } };
  const modal = new TypographyModal({}, plugin, surface); modal.onOpen();
  return { plugin, modal };
}
function field(modal, role, key) {
  if (modal.role !== role) { modal.role = role; modal.drawEditor(); }
  const found = nodes(modal.contentEl).find(e => e.dataset.role === role && e.dataset.field === key);
  assert.ok(found, role + "/" + key); return nodes(found).filter(e => ["input", "select", "button"].includes(e.tagName));
}
async function change(el, value) { el.value = String(value); await el.onchange(); }
function button(modal, text) { const b = nodes(modal.contentEl).find(e => e.tagName === "button" && e.textContent === text); assert.ok(b, text); return b; }

test("defaults inherit; role and surface records are independent", () => {
  const c = T.readTypography(); assert.equal(c.popup.source.fontSize, 0); assert.equal(c.sidebar.target.lineHeight, null);
  c.popup.source.color = "#f00"; assert.equal(c.popup.target.color, ""); assert.equal(c.sidebar.source.color, "");
});
test("legacy popup sizes migrate; explicit zero wins over stale advanced data", () => {
  const c = T.readTypography({ typography: { popup: { source: { fontSize: 30 }, target: { fontSize: 22 } } }, popupSourceFontSize: 0 });
  assert.equal(c.popup.source.fontSize, 0); assert.equal(c.popup.target.fontSize, 22);
  const s = { popupSourceFontSize: 16 }; T.updateTypography(s, "popup", "source", { lineHeight: 1.8 });
  assert.equal(s.popupSourceFontSize, 16); assert.equal(s.typography.popup.source.fontSize, 16);
});
test("saved malformed numbers, styles and colors are normalized without NaN or CSS injection", () => {
  const c = T.normalizeRole({ fontSize: 900, lineHeight: -4, letterSpacing: Infinity, opacity: false, fontFamily: 'Arial; color:red',
    color: "url(https://example.invalid)", background: "#AbC", alignment: "expression(alert(1))", weight: "999" });
  assert.equal(c.fontSize, 40); assert.equal(c.lineHeight, 0.8); assert.equal(c.letterSpacing, null);
  assert.equal(c.opacity, null); assert.equal(c.fontFamily, ""); assert.equal(c.color, ""); assert.equal(c.background, "#abc");
  assert.equal(c.alignment, "auto"); assert.equal(c.weight, "auto");
});
test("font families accept local Unicode names/fallbacks only; never URLs or code", () => {
  assert.equal(T.fontFamily('"Times New Roman", 微软雅黑, serif'), "Times New Roman, 微软雅黑, serif");
  for (const value of ["url(x)", "Arial; font-size:99px", "a\\b", "a{b}", "a\nb", "a,,b", "@import", "x".repeat(241)]) assert.equal(T.fontFamily(value), "");
});
test("all numeric bounds normalize safely, while explicit zero spacing remains meaningful", () => {
  for (const [key, [min, max]] of Object.entries(T.NUMBER_FIELDS)) {
    assert.equal(T.normalizeRole({ [key]: 99999 })[key], max);
    assert.equal(T.normalizeRole({ [key]: -99999 })[key], key === "fontSize" ? 0 : min);
    assert.equal(T.normalizeRole({ [key]: null })[key], key === "fontSize" ? 0 : null);
  }
  assert.equal(T.normalizeRole({ letterSpacing: 0 }).letterSpacing, 0);
});
test("stored decimals normalize to valid native step values", () => {
  assert.equal(T.normalizeRole({ lineHeight: 1.93 }).lineHeight, 1.95);
  assert.equal(T.normalizeRole({ letterSpacing: 0.14 }).letterSpacing, 0.1);
});
test("copy is bidirectional, deep and limited to base typography", () => {
  const { plugin: p } = fixture(); const s = p.settings, unaffected = JSON.stringify({ primary: s.primarySource, llm: s.llmProfiles, full: s.fullHtml, zoom: s.popupLastFontScale });
  T.updateTypography(s, "popup", "target", { color: "#123456", lineHeight: 1.9 }); T.copyTypography(s, "popup", "sidebar");
  assert.deepEqual(plain(T.readTypography(s).popup), plain(T.readTypography(s).sidebar));
  T.updateTypography(s, "sidebar", "target", { fontSize: 25 }); assert.equal(s.popupTargetFontSize, 18);
  T.copyTypography(s, "sidebar", "popup"); assert.equal(s.popupTargetFontSize, 25);
  assert.equal(JSON.stringify({ primary: s.primarySource, llm: s.llmProfiles, full: s.fullHtml, zoom: s.popupLastFontScale }), unaffected);
});
test("reset/presets affect only the requested surface, with no shared references", () => {
  const s = {}; T.presetTypography(s, "popup", "paper"); T.copyTypography(s, "popup", "sidebar");
  T.resetTypography(s, "popup"); assert.equal(s.popupTargetFontSize, 0); assert.equal(s.typography.sidebar.target.fontSize, 18);
  assert.throws(() => T.copyTypography(s, "all", "popup")); assert.throws(() => T.presetTypography(s, "sidebar", "unknown"));
});
test("override data/CSS variables are scoped, reversible, and popup resize scale is not doubled", () => {
  const s = {}; T.updateTypography(s, "popup", "target", { fontSize: 22, lineHeight: 2, fontFamily: "Arial, serif" });
  const el = new Element(); T.applyTypography(el, s, "popup");
  assert.equal(el.dataset.miniTypeTargetFontSize, "default"); assert.equal(el.dataset.miniTypeTargetLineHeight, "custom");
  assert.equal(el.style["--mini-type-target-font-family"], '"Arial", serif');
  T.applyTypography(el, s, "popup", { preview: true }); assert.equal(el.style["--mini-type-target-font-size"], "22px");
  T.resetTypography(s, "popup"); T.applyTypography(el, s, "popup");
  assert.equal(el.dataset.miniTypeTargetLineHeight, "default"); assert.equal(el.style["--mini-type-target-line-height"], "");
});
test("paragraph splitting preserves multiline display/aligned formulas, and does not invent boundaries", () => {
  const math = "$$\\begin{aligned}a&=b\\\\\n\nc&=d\\end{aligned}$$";
  const parts = T.splitParagraphs("First paragraph.\n\n" + math + "\n\nLast paragraph.", MATH_RE);
  assert.equal(parts.length, 3); assert.equal(parts[1], math);
  assert.equal(T.splitParagraphs("One line\nanother hard-wrapped line.", MATH_RE).length, 1);
  assert.equal(T.splitParagraphs("A $x$ B\n\nC \\(y\\).", MATH_RE).length, 2);
});
test("rendered paragraphs keep text literal and MathJax calls intact; dictionary lines stay unsplit", () => {
  const el = new Element(); mathCalls = [];
  renderPairsTo(el, [{ en: "First $x$.\n\nSecond.", zh: "<img src=x onerror=bad()> $y$。\n\n第二段。", sourceLanguage: "en", targetLanguage: "zh-Hans" }]);
  assert.equal(el.children[0].children.length, 2); assert.equal(el.children[1].children.length, 2);
  assert.equal(mathCalls.length, 2); assert.ok(el.children[1].children[0].textContent.includes("<img"));
  const dict = new Element(); renderPairsTo(dict, [{ en: "robot", zh: "n. 第一行\n\nv. 第二行", dict: true }]);
  assert.equal(dict.children[1].classList.contains("mini-text-multipara"), false);
});
test("compact settings open without saving; all 15 fields remain available on each role", () => {
  for (const locale of ["zh-CN", "en"]) {
    I18N.setUiLanguage(locale); const { plugin, modal } = fixture();
    assert.equal(plugin.saves.length, 0);
    assert.equal(nodes(modal.contentEl).filter(e => e.dataset.field).length, 15);
    for (const key of [...Object.keys(T.NUMBER_FIELDS), ...Object.keys(T.ENUM_FIELDS), "fontFamily", "color", "background"]) {
      assert.ok(I18N.hasMessageKey("typography." + key)); assert.ok(field(modal, "source", key)[0].id);
    }
    for (const choices of Object.values(T.ENUM_FIELDS)) for (const option of choices) assert.ok(I18N.hasMessageKey("typography.option_" + option));
    modal.close();
  }
  I18N.setUiLanguage("zh-CN");
});
test("native numeric steppers persist valid values only; clearing restores inheritance", async () => {
  const { plugin, modal } = fixture(); const input = field(modal, "target", "lineHeight")[0];
  assert.equal(input.type, "number"); assert.equal(input.min, "0.8"); assert.equal(input.step, "0.05");
  await change(input, 1.9); assert.equal(plugin.settings.typography.popup.target.lineHeight, 1.9);
  const count = plugin.saves.length;
  for (const v of ["x", "9", "-1", "1.91"]) await change(input, v);
  assert.equal(plugin.saves.length, count); assert.ok(input.validationMessage);
  await change(input, ""); assert.equal(plugin.settings.typography.popup.target.lineHeight, null); assert.equal(input.validationMessage, "");
});
test("advanced popup font changes also update the compact controls' legacy fields", async () => {
  const { plugin, modal } = fixture(); await change(field(modal, "source", "fontSize")[0], 20);
  assert.equal(plugin.settings.popupSourceFontSize, 20); assert.equal(plugin.settings.popupTargetFontSize, 18);
  assert.equal(plugin.settings.popupLastFontScale, 1.5); assert.equal(plugin.settings.popupFontFollowResize, true);
  plugin.settings.popupSourceFontSize = 12; modal.draw(); assert.equal(field(modal, "source", "fontSize")[0].value, "12");
});
test("custom fonts and colors reject injection; native color picker and blank reset work", async () => {
  const { plugin, modal } = fixture(), family = field(modal, "target", "fontFamily"), colors = field(modal, "target", "color");
  await change(family[0], "@custom"); assert.equal(family[1].hidden, false); assert.equal(plugin.saves.length, 0);
  await change(family[1], "Arial; color:red"); assert.equal(plugin.saves.length, 0);
  await change(family[1], "Arial, serif"); assert.equal(plugin.settings.typography.popup.target.fontFamily, "Arial, serif");
  await change(colors[0], "red;position:fixed"); assert.equal(plugin.settings.typography.popup.target.color, "");
  await change(colors[1], "#123456"); assert.equal(plugin.settings.typography.popup.target.color, "#123456");
  await change(colors[0], "#abc"); assert.equal(colors[1].value, "#aabbcc");
  await change(colors[0], ""); assert.equal(plugin.settings.typography.popup.target.color, "");
});
test("tab switching and copy buttons preserve current values and independent surface edits", async () => {
  const { plugin, modal } = fixture(); await change(field(modal, "target", "lineHeight")[0], 1.9);
  await button(modal, I18N.t("typography.sync_to", { target: I18N.t("typography.sidebar") })).click();
  assert.equal(plugin.settings.typography.sidebar.target.lineHeight, 1.9);
  await button(modal, I18N.t("typography.sidebar")).click();
  assert.equal(modal.surface, "sidebar"); await change(field(modal, "target", "lineHeight")[0], 2.1);
  assert.equal(plugin.settings.typography.popup.target.lineHeight, 1.9);
  await button(modal, I18N.t("typography.sync_to", { target: I18N.t("typography.popup") })).click();
  assert.equal(plugin.settings.typography.popup.target.lineHeight, 2.1);
  const reloaded = T.readTypography(plain(plugin.saves.at(-1))); assert.equal(reloaded.popup.target.lineHeight, 2.1);
});
test("presets/reset redraw current controls only; tab keyboard navigation works", async () => {
  const { plugin, modal } = fixture(); const preset = nodes(modal.contentEl).find(e => e.tagName === "select" && e.attrs["aria-label"] === I18N.t("typography.preset"));
  await change(preset, "paper"); assert.equal(field(modal, "target", "fontSize")[0].value, "18");
  modal.tabs[0].onkeydown({ key: "ArrowRight", preventDefault() {} }); assert.equal(modal.surface, "sidebar");
  await change(field(modal, "target", "fontSize")[0], 22); await button(modal, I18N.t("typography.reset")).click();
  assert.equal(plugin.settings.typography.sidebar.target.fontSize, 0); assert.equal(plugin.settings.popupTargetFontSize, 18);
});
test("failed saves are visible/retryable and queued writes cannot race", async () => {
  const { plugin, modal } = fixture(); plugin.saveData = async () => { throw Error("simulated disk failure"); };
  await change(field(modal, "target", "lineHeight")[0], 2);
  assert.ok(modal.status.textContent.includes("simulated disk failure"));
  let active = 0, max = 0; plugin.saveData = async s => { active++; max = Math.max(max, active); await new Promise(r => setTimeout(r, 1)); plugin.saves.push(plain(s)); active--; };
  const a = modal.change("target", "letterSpacing", 1), b = modal.change("source", "opacity", 0.8);
  await Promise.all([a, b]); assert.equal(max, 1); assert.equal(plugin.saves.at(-1).typography.popup.source.opacity, 0.8);
  assert.equal(modal.status.textContent, I18N.t("typography.saved"));
});
test("real popup and sidebar apply separate styles live without replacing results or resetting lock/scale", () => {
  const p = new sandbox.module.exports(); p.settings = { popupFontFollowResize: true, popupSourceFontSize: 14, popupTargetFontSize: 18 };
  const anchor = { left: 100, top: 200, right: 400, bottom: 230 };
  p.showPopup("", 100, 236, null, false, anchor); p.popupLockBtn.click(); p._popupFontScale = 1.5;
  p.showPopupSources([{ en: "First.\n\nSecond.", waiting: false }]);
  p.updatePopupTranslation(0, { en: "First.\n\nSecond.", zh: "第一段。\n\n第二段。" }, "offline");
  const shell = p.popupEl, body = p.popupBodyEl, target = p._popupSlots[0].zhEl, run = p._popupRunId, text = p.lastPopupText;
  p.panelView = { flowEl: new Element() }; const secondView = { flowEl: new Element() };
  p.app = { workspace: { getLeavesOfType: () => [{ view: secondView }] } };
  T.updateTypography(p.settings, "popup", "target", { lineHeight: 2 });
  T.updateTypography(p.settings, "sidebar", "target", { fontSize: 24, color: "#234567" }); p.refreshTypography();
  assert.equal(body.style["--mini-type-target-line-height"], "2"); assert.equal(p.popupEl.style["--mini-popup-target-font-size"], "27px");
  for (const view of [p.panelView, secondView]) assert.equal(view.flowEl.style["--mini-type-target-font-size"], "24px");
  assert.equal(p.popupEl, shell); assert.equal(p.popupBodyEl, body); assert.equal(p._popupSlots[0].zhEl, target);
  assert.equal(p._popupRunId, run); assert.equal(p._popupLocked, true); assert.equal(p._popupFontScale, 1.5); assert.equal(p.lastPopupText, text);
  p.closePopup();
});
test("sidebar result rendering includes paragraph wrappers and leaves copied content unchanged", () => {
  const v = new MiniTranslatorView({}, { settings: { sourceLanguage: "en", targetLanguage: "zh-Hans" } });
  for (const key of ["emptyEl", "flowEl", "metaEl", "copyBtn"]) v[key] = new Element();
  const pairs = [{ en: "One.\n\nTwo.", zh: "一。\n\n二。", sourceLanguage: "en", targetLanguage: "zh-Hans" }];
  v.show(pairs, "offline");
  assert.equal(v.flowEl.children[1].children.length, 2); assert.equal(v.lastResult, pairs[0].zh);
});

test("editor and math preview retain identity when controls change; sections and role are independent", async () => {
  const { plugin, modal } = fixture();
  const input = field(modal, "target", "fontSize")[0], preview = modal.previewEl, first = preview.children[0], mathCount = mathCalls.length;
  await change(input, 23);
  assert.equal(field(modal, "target", "fontSize")[0], input);
  assert.equal(modal.previewEl, preview); assert.equal(preview.children[0], first); assert.equal(mathCalls.length, mathCount);
  const common = nodes(modal.editor).find(e => e.classList.contains("mini-typography-section-common"));
  const more = nodes(modal.editor).find(e => e.classList.contains("mini-typography-section-more"));
  assert.equal(common.open, true); assert.equal(more.open, false);
  more.open = true; more.ontoggle();
  assert.equal(common.open, true);
  modal.roleTabs[0].click(); assert.equal(modal.role, "source");
  modal.roleTabs[1].click();
  const restored = nodes(modal.editor).find(e => e.classList.contains("mini-typography-section-more"));
  assert.equal(restored.open, true); assert.equal(plugin.saves.length, 1);
  assert.equal(nodes(modal.editor).find(e => e.classList.contains("mini-typography-section-common")).open, true);
  assert.equal(modal.previewEl, preview);
});

test("opacity percentages and emphasis buttons preserve the canonical storage and default restoration", async () => {
  const { plugin, modal } = fixture(), opacity = field(modal, "target", "opacity")[0];
  assert.equal(opacity.min, "20"); assert.equal(opacity.max, "100"); assert.equal(opacity.step, "5");
  await change(opacity, 85); assert.equal(plugin.settings.typography.popup.target.opacity, 0.85);
  const count = plugin.saves.length;
  for (const value of [0, 101, 83]) await change(opacity, value);
  assert.equal(plugin.saves.length, count);
  await change(opacity, ""); assert.equal(plugin.settings.typography.popup.target.opacity, null);
  const italic = field(modal, "target", "fontStyle")[0], under = field(modal, "target", "decoration")[0];
  await italic.click(); assert.equal(plugin.settings.typography.popup.target.fontStyle, "italic"); assert.equal(italic.attrs["aria-pressed"], "true");
  await under.click(); assert.equal(plugin.settings.typography.popup.target.decoration, "underline");
  await button(modal, "S").click(); assert.equal(plugin.settings.typography.popup.target.decoration, "line-through");
  const restore = nodes(modal.editor).find(e => e.attrs["aria-label"] === I18N.t("typography.inherit_emphasis"));
  assert.equal(restore.hidden, false); await restore.click();
  assert.equal(plugin.settings.typography.popup.target.fontStyle, "auto");
  assert.equal(plugin.settings.typography.popup.target.decoration, "auto"); assert.equal(restore.hidden, true);
});

test("resize policy is a real switch and never copied or reset with base styles", async () => {
  const { plugin, modal } = fixture();
  plugin._popupFontScale = 1.5; plugin._popupFontResizeBase = { width: 400 }; plugin._popupFontLastSize = { width: 600 };
  const toggle = nodes(modal.editor).find(e => e.type === "checkbox");
  assert.equal(toggle.checked, true); toggle.checked = false; await toggle.onchange();
  assert.equal(plugin.settings.popupFontFollowResize, false); assert.equal(plugin._popupFontScale, 1);
  assert.equal(plugin.settings.popupLastFontScale, 1); assert.equal(plugin._popupFontResizeBase, null); assert.equal(plugin._popupFontLastSize, null);
  await button(modal, I18N.t("typography.sync_to", { target: I18N.t("typography.sidebar") })).click();
  await button(modal, I18N.t("typography.reset")).click();
  assert.equal(plugin.settings.popupFontFollowResize, false);
  modal.tabs[1].click(); assert.ok(!nodes(modal.editor).some(e => e.type === "checkbox"));
});

test("role tabs have keyboard navigation, unique IDs, accurate ARIA panels, and no saves", () => {
  const { plugin, modal } = fixture();
  const other = new TypographyModal({}, plugin); other.onOpen();
  assert.notEqual(modal.uid, other.uid);
  modal.roleTabs[1].onkeydown({ key: "Home", preventDefault() {} }); assert.equal(modal.role, "source"); assert.equal(modal.roleTabs[0].focused, true);
  modal.roleTabs[0].onkeydown({ key: "End", preventDefault() {} }); assert.equal(modal.role, "target");
  assert.equal(plugin.saves.length, 0);
  const ids = nodes(modal.contentEl).filter(e => e.id).map(e => e.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const tab of [...modal.tabs, ...modal.roleTabs]) assert.ok(ids.includes(tab.attrs["aria-controls"]));
  const panel = nodes(modal.editor).find(e => e.attrs.role === "tabpanel");
  assert.equal(panel.attrs["aria-labelledby"], modal.roleTabs[1].id);
});

test("retry appears only after a failed write, survives role/surface changes, and disappears after retry", async () => {
  const { plugin, modal } = fixture();
  assert.equal(modal.retry.hidden, true);
  plugin.saveData = async () => { throw Error("offline fixture failure"); };
  await modal.change("target", "fontSize", 20); assert.equal(modal.retry.hidden, false);
  modal.tabs[1].click(); assert.equal(modal.retry.hidden, false); assert.ok(modal.status.textContent.includes("offline fixture failure"));
  plugin.saveData = async s => { plugin.saves.push(plain(s)); };
  await modal.retry.click(); assert.equal(modal.retry.hidden, true); assert.equal(modal.status.textContent, I18N.t("typography.saved"));
});

test("source and bundled sample retain display-math delimiters and use the real rich-text path", () => {
  for (const locale of ["zh-CN", "en"]) {
    I18N.setUiLanguage(locale); assert.ok(I18N.t("typography.preview_target").includes("$$E = mc^2$$"));
    mathCalls = []; const { modal } = fixture();
    assert.ok(mathCalls.some(call => call.text.trim() === "E = mc^2" && call.display));
    modal.close();
  }
  I18N.setUiLanguage("zh-CN");
});


test("both sections toggle independently and retain per-surface/per-role state without saving", () => {
  for (const surface of T.SURFACES) for (const role of T.ROLES) {
    const { plugin, modal } = fixture(surface);
    modal.role = role; modal.drawEditor();
    const sections = () => Object.fromEntries(["common", "more"].map(name =>
      [name, nodes(modal.editor).find(e => e.classList.contains("mini-typography-section-" + name))]));
    const toggle = (name, open) => { const details = sections()[name]; details.open = open; details.ontoggle(); };
    toggle("more", true); assert.equal(sections().common.open, true);
    toggle("common", false); assert.equal(sections().more.open, true);
    toggle("common", true); assert.equal(sections().more.open, true);
    toggle("more", false); assert.equal(sections().common.open, true);
    toggle("more", true);
    const preview = modal.previewEl, otherRole = role === "target" ? "source" : "target";
    modal.roleTabs[T.ROLES.indexOf(otherRole)].click(); assert.equal(sections().more.open, false);
    modal.roleTabs[T.ROLES.indexOf(role)].click();
    assert.equal(sections().common.open, true); assert.equal(sections().more.open, true);
    assert.equal(modal.previewEl, preview);
    const otherSurface = surface === "popup" ? "sidebar" : "popup";
    modal.tabs[T.SURFACES.indexOf(otherSurface)].click(); assert.equal(sections().more.open, false);
    modal.tabs[T.SURFACES.indexOf(surface)].click();
    assert.equal(sections().common.open, true); assert.equal(sections().more.open, true);
    assert.equal(plugin.saves.length, 0); modal.close();
  }
});

(async () => { for (const [name, fn] of tests) { await fn(); console.log("PASS " + name); }
  console.log("ALL PASS (" + tests.length + " advanced typography tests; " + sourcePath + ")"); })().catch(error => { console.error(error); process.exitCode = 1; });
