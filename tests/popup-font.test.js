"use strict";

// No vault data, real credentials or network; the same tests exercise dist/main.js.
const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.resolve(__dirname, "..");
const sourcePath = process.argv[2] || path.join(root, "main.js");

class Element {
  constructor() {
    this.style = { setProperty(name, value) { this[name] = value; } };
    this.dataset = {}; this.children = []; this.events = new Map(); this.isConnected = true;
    this.classList = { add() {}, contains: () => false };
    this.box = { width: 320, height: 200 };
  }
  appendChild(child) { child.parent?.children.splice(child.parent.children.indexOf(child), 1); child.parent = this; this.children.push(child); return child; }
  createDiv() { return this.appendChild(new Element()); }
  createSpan(options = {}) { const child = this.createDiv(); child.textContent = options.text || ""; return child; }
  addClass() {} setAttribute() {} setText(text) { this.textContent = text; }
  addEventListener(name, fn) { this.events.set(name, fn); }
  removeEventListener(name, fn) { if (this.events.get(name) === fn) this.events.delete(name); }
  contains(node) { return this === node || this.children.some((child) => child.contains(node)); }
  remove() { this.isConnected = false; }
  getBoundingClientRect() {
    const width = Number.parseFloat(this.style.width) || this.box.width;
    const requested = Number.parseFloat(this.style.height) || this.box.height;
    const height = Math.min(requested, this.renderHeightCap || Infinity);
    const left = Number.parseFloat(this.style.left) || 0;
    const top = Number.parseFloat(this.style.top) || 0;
    return { width, height, left, top, right: left + width, bottom: top + height };
  }
}
const frames = new Map();
let nextFrame = 0;
const window = {
  innerWidth: 1600, innerHeight: 900, getSelection: () => null,
  setTimeout, clearTimeout,
  addEventListener() {}, removeEventListener() {},
  requestAnimationFrame(fn) { const id = ++nextFrame; frames.set(id, fn); return id; },
  cancelAnimationFrame(id) { frames.delete(id); },
  ResizeObserver: class { constructor(fn) { this.fn = fn; } observe() {} disconnect() {} },
};
const document = { body: new Element(), documentElement: {}, addEventListener() {}, removeEventListener() {} };
const sandbox = { window, document, module: { exports: {} }, console, setTimeout, clearTimeout,
  require(name) {
    if (name === "obsidian") return new Proxy({}, { get: () => class {} });
    if (name.startsWith("./src/")) return require(path.join(root, name));
    throw new Error("Unexpected popup-font test dependency: " + name);
  },
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(sourcePath, "utf8") + "\n;globalThis.__font = POPUP_FONT;", sandbox, { filename: sourcePath });
const font = sandbox.__font;
let passed = 0;
const plain = (value) => JSON.parse(JSON.stringify(value));
function test(name, fn) { fn(); passed++; console.log("PASS", name); }
function flushFrames() {
  let loops = 0;
  while (frames.size) {
    if (++loops > 20) throw new Error("Resize frame feedback loop");
    const [id, fn] = frames.entries().next().value; frames.delete(id); fn();
  }
}
function pluginFixture(settings = {}) {
  const plugin = new sandbox.module.exports();
  plugin.settings = { popupSourceFontSize: 14, popupTargetFontSize: 20,
    popupFontFollowResize: false, popupLastFontScale: 1, popupMaxSize: "standard", ...settings };
  plugin.saves = [];
  plugin.saveData = async (value) => plugin.saves.push(plain(value));
  return plugin;
}
const anchor = { left: 100, right: 400, top: 300, bottom: 330 };
function open(plugin) { plugin.showPopup("Source text", anchor.left, anchor.bottom + 6, null, false, anchor); return plugin.popupEl; }
function beginResize(plugin) {
  const el = plugin.popupEl;
  const r = el.getBoundingClientRect();
  el.events.get("pointerdown")({ button: 0, clientX: r.right - 3, clientY: r.bottom - 3 });
}
function nativeResize(plugin, width, height) {
  plugin.popupEl.style.width = width + "px"; plugin.popupEl.style.height = height + "px";
  plugin._popupResizeObserver.fn(); flushFrames();
}

test("missing/invalid fonts migrate to Obsidian; explicit values are bounded", () => {
  for (const value of [undefined, null, "", "x", -1, 0, Infinity]) assert.equal(font.normalizePopupFontSize(value), 0);
  assert.equal(font.normalizePopupFontSize(4), 10);
  assert.equal(font.normalizePopupFontSize(80), 40);
  assert.equal(font.normalizePopupFontSize(17.8), 18);
  assert.equal(font.normalizePopupFontScale(undefined), 1);
  assert.equal(font.normalizePopupFontScale(0), 1);
  assert.equal(font.normalizePopupFontScale(9), 2.4);
  assert.equal(font.normalizePopupFontScale(0.2), 0.6);
});
test("default typography and large-display boost are retained when not customized", () => {
  assert.deepEqual(plain(font.popupFontStyles()), { source: "var(--font-smaller)", target: "var(--font-text-size)", scale: 1 });
  assert.equal(font.popupFontStyles({}, { smallTextBoost: 1, textBoost: 2 }).target, "calc(var(--font-text-size) + 2px)");
});
test("source and translation sizes are independent; explicit sizes are exact", () => {
  const styles = font.popupFontStyles({ popupSourceFontSize: 12, popupTargetFontSize: 22 }, { textBoost: 2, smallTextBoost: 1 });
  assert.equal(styles.source, "12px"); assert.equal(styles.target, "22px");
});
test("disabled follow-resize ignores all old scales", () => {
  const styles = font.popupFontStyles({ popupSourceFontSize: 12, popupTargetFontSize: 20, popupFontFollowResize: false }, { scale: 2 });
  assert.equal(styles.source, "12px"); assert.equal(styles.target, "20px"); assert.equal(styles.scale, 1);
});
test("enabled follow-resize scales both source/target and preserves auto-font inheritance", () => {
  const styles = font.popupFontStyles({ popupSourceFontSize: 12, popupTargetFontSize: 20, popupFontFollowResize: true }, { scale: 1.5 });
  assert.equal(styles.source, "18px"); assert.equal(styles.target, "30px");
  assert.equal(font.popupFontStyles({ popupFontFollowResize: true }, { scale: 1.5 }).source,
    "clamp(8px, calc((var(--font-smaller) + 0px) * 1.5), 72px)");
});
test("manual scaling uses both dimensions, shrinks and saturates safely", () => {
  const base = { width: 300, height: 200 };
  assert.equal(font.resizePopupFontScale(base, { width: 600, height: 400 }), 2);
  assert.equal(font.resizePopupFontScale(base, { width: 600, height: 200 }), 1.414);
  assert.equal(font.resizePopupFontScale(base, { width: 300, height: 400 }), 1.414);
  assert.equal(font.resizePopupFontScale(base, { width: 150, height: 100 }), 0.6);
  assert.equal(font.resizePopupFontScale(base, { width: 9000, height: 9000 }), 2.4);
  assert.equal(font.resizePopupFontScale(null, base, 1.2), 1.2);
  assert.equal(font.resizePopupFontScale(base, { width: 0, height: 200 }, 1.2), 1.2);
  assert.equal(font.resizePopupFontScale(base, base), 1, "Reversing a gesture returns to baseline");
});
test("effective custom fonts never become unreadably small or enormous", () => {
  const styles = font.popupFontStyles({ popupSourceFontSize: 10, popupTargetFontSize: 40, popupFontFollowResize: true }, { scale: 2.4 });
  assert.equal(styles.target, "72px");
  assert.equal(font.popupFontStyles({ popupSourceFontSize: 10, popupFontFollowResize: true }, { scale: 0.6 }).source, "8px");
});
test("requested native dimensions, not a temporarily clamped rect, control scaling", () => {
  assert.deepEqual(plain(font.readPopupResizeSize({ style: { width: "640px", height: "700px" },
    getBoundingClientRect: () => ({ width: 400, height: 200 }) })), { width: 640, height: 700 });
  assert.deepEqual(plain(font.readPopupResizeSize({ style: { width: "fit-content", height: "" },
    getBoundingClientRect: () => ({ width: 320, height: 200 }) })), { width: 320, height: 200 });
});
test("actual popup applies configured CSS variables but does not resize header buttons", () => {
  const plugin = pluginFixture(); const el = open(plugin);
  assert.equal(el.style["--mini-popup-source-font-size"], "14px");
  assert.equal(el.style["--mini-popup-target-font-size"], "20px");
  assert.match(plugin.popupHeaderEl.style.fontSize, /--font-smaller/);
  plugin.closePopup();
});
test("native drag callback scales text live and stays stable on repeated observer notifications", () => {
  const plugin = pluginFixture({ popupFontFollowResize: true }); const el = open(plugin);
  const header = plugin.popupHeaderEl.style.fontSize;
  beginResize(plugin); nativeResize(plugin, 640, 400);
  assert.equal(el.style["--mini-popup-target-font-size"], "40px");
  assert.equal(el.style["--mini-popup-source-font-size"], "28px");
  plugin._popupResizeObserver.fn(); flushFrames();
  assert.equal(plugin._popupFontScale, 2);
  nativeResize(plugin, 320, 200);
  assert.equal(plugin._popupFontScale, 1);
  assert.equal(plugin.popupHeaderEl.style.fontSize, header);
  plugin._popupResizeEnd(); flushFrames(); plugin.closePopup();
});
test("native manual resizing keeps fonts fixed when the toggle is off", () => {
  const plugin = pluginFixture(); const el = open(plugin);
  beginResize(plugin); nativeResize(plugin, 640, 400);
  assert.equal(el.style["--mini-popup-target-font-size"], "20px");
  plugin._popupResizeEnd(); flushFrames(); plugin.closePopup();
});
test("observer-only native resize still scales when pointerdown is swallowed", () => {
  const plugin = pluginFixture({ popupFontFollowResize: true }); open(plugin);
  nativeResize(plugin, 640, 400);
  assert.equal(plugin._popupFontScale, 2); plugin.closePopup();
});
test("new translated content and viewport constraints never change the stored text scale", () => {
  const plugin = pluginFixture({ popupFontFollowResize: true }); const el = open(plugin);
  beginResize(plugin); nativeResize(plugin, 640, 400);
  plugin._popupResizeEnd(); flushFrames();
  el.renderHeightCap = 150;
  plugin.popupBodyEl.textContent = "long translated content ".repeat(100);
  plugin._placePopup(el, anchor, { lock: true });
  plugin._popupResizeObserver.fn(); flushFrames();
  assert.equal(plugin._popupFontScale, 2);
  assert.equal(el.style["--mini-popup-target-font-size"], "40px");
  plugin.closePopup();
});
test("remembering size persists and restores scale, including a clamped rendered height", () => {
  const plugin = pluginFixture({ popupFontFollowResize: true, rememberPopupSize: true });
  const el = open(plugin); beginResize(plugin); nativeResize(plugin, 640, 400);
  el.renderHeightCap = 150;
  plugin._popupResizeEnd(); flushFrames();
  assert.deepEqual(plain(plugin.settings.popupLastSize), { width: 640, height: 400 });
  assert.equal(plugin.settings.popupLastFontScale, 2);
  assert.equal(open(plugin).style["--mini-popup-target-font-size"], "40px");
  plugin.closePopup();
});
test("without size memory every new popup starts from the user's base font", () => {
  const plugin = pluginFixture({ popupFontFollowResize: true });
  open(plugin); beginResize(plugin); nativeResize(plugin, 640, 400);
  plugin._popupResizeEnd(); flushFrames();
  assert.equal(open(plugin).style["--mini-popup-target-font-size"], "20px"); plugin.closePopup();
});
test("old saved dimensions without a scale migrate to 1x instead of losing user's size", () => {
  const plugin = pluginFixture({ popupFontFollowResize: true, rememberPopupSize: true,
    popupLastSize: { width: 600, height: 400 }, popupLastFontScale: undefined });
  const el = open(plugin); assert.equal(el.style.width, "600px");
  assert.equal(el.style["--mini-popup-target-font-size"], "20px"); plugin.closePopup();
});
test("a saved scale is persisted even if requested dimensions did not change", () => {
  const plugin = pluginFixture({ popupFontFollowResize: true, rememberPopupSize: true,
    popupLastSize: { width: 640, height: 400 }, popupLastFontScale: 1 });
  const el = open(plugin); plugin._popupFontScale = 1.5; plugin._popupResizeDirty = true;
  plugin._rememberCurrentPopupSize(el);
  assert.equal(plugin.settings.popupLastFontScale, 1.5);
  assert.equal(plugin.saves.length, 1); plugin.closePopup();
});

assert.equal(frames.size, 0);
console.log(`PASS ${passed} popup-font tests (${path.relative(root, sourcePath)})`);
