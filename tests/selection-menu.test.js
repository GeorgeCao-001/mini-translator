"use strict";

// Offline tests against the real source module or the self-contained release.
// Run: node tests/selection-menu.test.js [dist/main.js]
const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.resolve(__dirname, "..");
const sourcePath = process.argv[2] || path.join(root, "main.js");
let activeSelection = null;
const copiedTexts = [];
const doc = { defaultView: {
  getSelection: () => activeSelection,
  navigator: { clipboard: { writeText: async (text) => copiedTexts.push(text) } },
} };
const window = { innerWidth: 1280, innerHeight: 900, getSelection: () => activeSelection };
class NativeMenu {
  constructor() { this.items = [{ title: "Copy" }]; }
  addItem(fn) {
    const item = { setTitle(v) { this.title = v; return this; }, setIcon() { return this; },
      setSection() { return this; }, onClick(fn) { this.click = fn; return this; } };
    fn(item); this.items.push(item); return this;
  }
  showAtMouseEvent() { return this; }
  hide() { this.hidden = true; }
}
const sandbox = {
  module: { exports: {} }, document: doc, window,
  console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout,
  require(name) {
    if (name === "obsidian") return new Proxy({}, {
      get(_target, key) {
        if (key === "getLanguage") return () => "zh";
        if (key === "Menu") return NativeMenu;
        return class {};
      },
    });
    if (name.startsWith("./src/")) return require(path.join(root, name));
    throw new Error(`Unexpected dependency in selection-menu test: ${name}`);
  },
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(sourcePath, "utf8") +
  "\n;globalThis.__menuTest = { SELECTION_MENU, I18N };", sandbox, { filename: sourcePath });
const { SELECTION_MENU, I18N } = sandbox.__menuTest;
const plain = (value) => JSON.parse(JSON.stringify(value));
const anchor = { left: 120, top: 200, right: 430, bottom: 240 };
let passed = 0;
const cases = [];
function test(name, fn) { cases.push([name, fn]); }

function fixture() {
  activeSelection = null;
  const events = new Map();
  const domEvents = [];
  const cleanups = [];
  const calls = [];
  const plugin = new sandbox.module.exports();
  let cancellations = 0;
  Object.assign(plugin, {
    app: { workspace: {
      on(name, fn) { events.set(name, fn); return { name, fn }; },
      onLayoutReady() {}, getActiveViewOfType: () => null,
    } },
    registerEvent(ref) { cleanups.push(() => events.delete(ref.name)); },
    registerDomEvent(target, name, fn, options) {
      const ref = { target, name, fn, options };
      domEvents.push(ref);
      cleanups.push(() => domEvents.splice(domEvents.indexOf(ref), 1));
    },
    register(fn) { cleanups.push(fn); },
    _readDomSelectionInfo: (selection) => selection?.info || null,
    _editorSelectionAnchor: () => anchor,
    _lastPointerAnchor: () => null,
    cancelAutoTranslate() { cancellations++; },
    translateSelection: async (mode, snapshot, options) => {
      assert.deepEqual(plain(options), { immediate: true });
      calls.push({ mode, snapshot: plain(snapshot) });
    },
  });
  class Menu {
    constructor() { this.items = [{ title: "Copy" }]; this.shown = 0; }
    addItem(fn) {
      const item = {
        setTitle(v) { this.title = v; return this; },
        setIcon(v) { this.icon = v; return this; },
        setSection(v) { this.section = v; return this; },
        onClick(fn) { this.click = fn; return this; },
      };
      fn(item); this.items.push(item); return this;
    }
    showAtMouseEvent(event) { this.event = event; this.shown++; return this; }
    hide() { this.hidden = true; }
    static forEvent(event) {
      event.defaultPrevented = true;
      this.lastMenu = new this();
      this.lastMenu.items = [];
      return this.lastMenu;
    }
  }
  const originalShow = Menu.prototype.showAtMouseEvent;
  const register = () => SELECTION_MENU.registerSelectionTranslationMenu(plugin, { Menu, document: doc, t: I18N.t });
  const editor = { getSelection: () => "Selected paragraph. Another sentence.", containerEl: {} };
  const root = {};
  const target = { closest: () => root };
  const event = { target, defaultPrevented: false };
  const capture = (evt = event) => domEvents.find((ref) => ref.name === "contextmenu" && ref.options?.capture).fn(evt);
  const bubble = (evt = event) => domEvents.find((ref) => ref.name === "contextmenu" && !ref.options?.capture).fn(evt);
  const unload = () => { for (const cleanup of cleanups.reverse()) cleanup(); };
  return { plugin, Menu, originalShow, register, editor, root, event, events, domEvents,
    calls, capture, bubble, unload, cancellations: () => cancellations };
}

test("editor selection: one localized entry, preserved source and position", async () => {
  I18N.setUiLanguage("zh-CN");
  const f = fixture(); f.register();
  const menu = new f.Menu();
  f.events.get("editor-menu")(menu, f.editor, {});
  assert.equal(menu.items.length, 2);
  assert.equal(menu.items[1].title, "翻译选中文本");
  assert.equal(menu.items[1].icon, "languages");
  assert.equal(f.calls.length, 0, "Opening a menu must not translate");
  f.editor.getSelection = () => "";
  await menu.items[1].click();
  assert.equal(menu.hidden, true, "Close the menu before starting manual translation");
  assert.deepEqual(f.calls, [{ mode: "paragraph", snapshot: {
    text: "Selected paragraph. Another sentence.", anchor,
  } }]);
  assert.equal(f.cancellations(), 2, "Cancel automatic dwell on menu open and click");
  f.unload();
});

test("empty, whitespace and unavailable editor selections add nothing", () => {
  const f = fixture(); f.register();
  for (const getSelection of [() => "", () => " \n ", () => { throw new Error("closed editor"); }]) {
    const menu = new f.Menu();
    f.events.get("editor-menu")(menu, { getSelection }, {});
    assert.equal(menu.items.length, 1);
  }
  assert.equal(f.cancellations(), 0); f.unload();
});

test("reading/PDF: append to the original menu for the captured event only", async () => {
  I18N.setUiLanguage("en");
  for (const selector of [".markdown-preview-view", ".pdf-viewer-container"]) {
    const f = fixture(); f.register();
    f.event.target.closest = (query) => query.includes(selector) ? f.root : null;
    const info = { text: "Reading selection.", anchor: { ...anchor } };
    activeSelection = { info };
    f.capture();
    assert.equal(f.domEvents[0].options.capture, true);
    const unrelated = new f.Menu(); unrelated.showAtMouseEvent({ target: f.event.target });
    assert.equal(unrelated.items.length, 1, "A different event must not inherit a selection");
    const menu = new f.Menu();
    assert.equal(menu.showAtMouseEvent(f.event), menu);
    assert.equal(menu.items[0].title, "Copy", "Keep existing actions");
    assert.equal(menu.items[1].title, "Translate selected text");
    assert.equal(menu.shown, 1);
    info.text = "changed"; info.anchor.bottom = 999; activeSelection = null;
    await menu.items[1].click();
    assert.deepEqual(f.calls[0], { mode: "paragraph", snapshot: { text: "Reading selection.", anchor } });
    f.unload();
  }
});

test("file/tab/sidebar menus, popup text and empty selections are not changed", () => {
  for (const reason of ["unrelated", "empty", "popup", "prevented"]) {
    const f = fixture(); f.register();
    activeSelection = { info: { text: "Selected elsewhere", anchor } };
    if (reason === "unrelated") f.event.target.closest = () => null;
    if (reason === "empty") activeSelection = null;
    if (reason === "popup") f.plugin.popupEl = { contains: () => true };
    if (reason === "prevented") f.event.defaultPrevented = true;
    f.capture(); const menu = new f.Menu(); menu.showAtMouseEvent(f.event);
    assert.equal(menu.items.length, 1, reason); f.unload();
  }
});

test("plain reading-view text gets a shared Copy/Translate menu without losing the selection", async () => {
  const f = fixture(); f.register(); copiedTexts.length = 0;
  f.root.matches = () => true;
  activeSelection = { info: { text: "Plain reading text.", anchor } };
  f.capture(); f.bubble(); activeSelection = null;
  const menu = f.Menu.lastMenu;
  assert.equal(f.event.defaultPrevented, true);
  menu.showAtMouseEvent(f.event);
  assert.deepEqual(menu.items.map((item) => item.title), ["Copy", "Translate selected text"]);
  await menu.items[0].click(); await menu.items[1].click();
  assert.deepEqual(copiedTexts, ["Plain reading text."]);
  assert.equal(f.calls[0].snapshot.text, "Plain reading text.");
  f.unload();
});

test("reading link/other-plugin menus are not replaced if their event is already handled", () => {
  const f = fixture(); f.register(); f.root.matches = () => true;
  activeSelection = { info: { text: "Reading selection", anchor } };
  f.capture(); f.event.defaultPrevented = true; f.bubble();
  assert.equal(f.Menu.lastMenu, undefined);
  const coreMenu = new f.Menu(); coreMenu.showAtMouseEvent(f.event);
  assert.equal(coreMenu.items.length, 2); f.unload();
});

test("real DOM reader scopes reading/PDF selection to the clicked view and snapshots its geometry", async () => {
  const f = fixture(); f.register(); delete f.plugin._readDomSelectionInfo;
  const node = {};
  f.root.contains = (value) => value === node;
  const range = { commonAncestorContainer: node, getClientRects: () => [{ ...anchor }] };
  activeSelection = { anchorNode: node, rangeCount: 1, toString: () => "Scoped selection.", getRangeAt: () => range };
  f.capture(); const menu = new f.Menu(); menu.showAtMouseEvent(f.event);
  activeSelection = null; await menu.items[1].click();
  assert.deepEqual(f.calls[0].snapshot, { text: "Scoped selection.", anchor,
    x: anchor.left, y: anchor.bottom + 6 });
  f.unload();
});

test("real DOM reader rejects stale text selected in another view", () => {
  const f = fixture(); f.register(); delete f.plugin._readDomSelectionInfo;
  f.root.contains = () => false;
  activeSelection = { anchorNode: {}, rangeCount: 1, toString: () => "Other pane text.",
    getRangeAt: () => ({ commonAncestorContainer: {}, getClientRects: () => [{ ...anchor }] }) };
  f.capture(); const menu = new f.Menu(); menu.showAtMouseEvent(f.event);
  assert.equal(menu.items.length, 1); f.unload();
});

test("duplicate events and repeated native menu display still add only one entry", () => {
  const f = fixture(); f.register();
  activeSelection = { info: { text: f.editor.getSelection(), anchor } };
  f.capture(); const menu = new f.Menu();
  f.events.get("editor-menu")(menu, f.editor, {});
  f.events.get("editor-menu")(menu, f.editor, {});
  menu.showAtMouseEvent(f.event); menu.showAtMouseEvent(f.event);
  assert.equal(menu.items.length, 2); assert.equal(menu.shown, 2); f.unload();
});

test("unloading restores the native method and disables already-open menu actions", async () => {
  const f = fixture(); f.register();
  const menu = new f.Menu(); f.events.get("editor-menu")(menu, f.editor, {});
  f.unload();
  assert.equal(f.Menu.prototype.showAtMouseEvent, f.originalShow);
  assert.equal(f.events.size, 0); assert.equal(f.domEvents.length, 0);
  await menu.items[1].click(); assert.equal(f.calls.length, 0);
});

test("unloading does not remove another plugin's later menu wrapper", () => {
  const f = fixture(); f.register();
  const wrapped = f.Menu.prototype.showAtMouseEvent;
  let otherCalls = 0;
  const otherWrapper = function (evt) { otherCalls++; return wrapped.call(this, evt); };
  f.Menu.prototype.showAtMouseEvent = otherWrapper;
  activeSelection = { info: { text: "Old selection", anchor } }; f.capture();
  f.unload();
  assert.equal(f.Menu.prototype.showAtMouseEvent, otherWrapper);
  const menu = new f.Menu(); menu.showAtMouseEvent(f.event);
  assert.equal(menu.items.length, 1); assert.equal(otherCalls, 1);
});

test("without the native menu adapter, editor event remains usable and unloads safely", async () => {
  const f = fixture(); delete f.Menu.prototype.showAtMouseEvent; f.register();
  const menu = new f.Menu(); f.events.get("editor-menu")(menu, f.editor, {});
  assert.equal(menu.items.length, 2); assert.equal(f.domEvents.length, 0);
  f.unload(); await menu.items[1].click(); assert.equal(f.calls.length, 0);
});

async function realTranslationFixture() {
  const f = fixture();
  const plugin = f.plugin;
  delete plugin.translateSelection; delete plugin.cancelAutoTranslate;
  const outputs = [];
  Object.assign(plugin, {
    loadData: async () => ({ llmProfiles: [], sourceLanguage: "en", targetLanguage: "zh-Hans", autoTranslateDelay: 8 }),
    saveData: async () => {}, registerView() {}, addRibbonIcon: () => ({}),
    addSettingTab() {}, addCommand: (command) => command,
    addStatusBarItem: () => ({ style: {}, hide() {} }),
    locatePdfDoc: async () => null,
    showPopup(text, x, y, _pairs, pending, selectedAnchor) {
      outputs.push({ x, y, anchor: plain(selectedAnchor), text, pending }); this._popupRunId = 1;
    },
    showPopupSources(entries) { outputs.push(plain(entries)); },
    updatePopupTranslation() {}, updatePopupPairs(pairs) { outputs.push(plain(pairs)); },
    pushHistory: async () => {},
  });
  vm.runInContext(`CACHE.clear(); globalThis.__requests = [];
    translateSentence = async (text) => {
      __requests.push(text); return { text: "完整译文。", via: "offline" };
    };`, sandbox);
  await plugin.onload();
  assert.equal(plugin.settings.popupSourceFontSize, 0);
  assert.equal(plugin.settings.popupTargetFontSize, 0);
  assert.equal(plugin.settings.popupFontFollowResize, false);
  assert.equal(plugin.settings.popupLastFontScale, 1);
  assert.equal(typeof f.events.get("editor-menu"), "function", "Plugin startup must register the action");
  const menu = new NativeMenu();
  f.events.get("editor-menu")(menu, f.editor, {});
  f.editor.getSelection = () => ""; activeSelection = null;
  return { ...f, menu, outputs };
}

function controlledScheduler() {
  const originalTimeout = sandbox.setTimeout;
  const originalClear = sandbox.clearTimeout;
  const originalFrame = window.requestAnimationFrame;
  const frames = [];
  const tasks = new Map();
  let sequence = 0;
  sandbox.setTimeout = (fn, delay) => { const id = ++sequence; tasks.set(id, { fn, delay }); return id; };
  sandbox.clearTimeout = (id) => tasks.delete(id);
  window.requestAnimationFrame = (fn) => frames.push(fn);
  return {
    frames, tasks,
    render() { frames.shift()(); },
    resume() { const [id, task] = tasks.entries().next().value; tasks.delete(id); task.fn(); },
    restore() {
      sandbox.setTimeout = originalTimeout; sandbox.clearTimeout = originalClear;
      if (originalFrame) window.requestAnimationFrame = originalFrame;
      else delete window.requestAnimationFrame;
    },
  };
}

test("real onload and paragraph flow use the captured text after selection is cleared", async () => {
  const f = await realTranslationFixture();
  const { menu, outputs, plugin } = f;
  await menu.items[1].click();
  assert.deepEqual(Array.from(sandbox.__requests), ["Selected paragraph. Another sentence."]);
  assert.deepEqual(outputs[0], { x: anchor.left, y: anchor.bottom + 6, anchor,
    text: "Selected paragraph. Another sentence.", pending: false });
  assert.equal(outputs[1][0].en, "Selected paragraph. Another sentence.");
  assert.equal(outputs[2][0].zh, "完整译文。");
  assert.equal(plugin._popupTranslationDone, true);
  f.unload();
});

test("manual click opens the popup synchronously, cancels dwell, and paints before provider startup", async () => {
  const scheduler = controlledScheduler();
  let f;
  try {
    f = await realTranslationFixture();
    f.plugin.dwellTimer = sandbox.setTimeout(() => { throw new Error("stale automatic translation"); }, 8000);
    const done = f.menu.items[1].click();
    assert.equal(f.menu.hidden, true);
    assert.equal(f.outputs.length, 1, "Source popup must already exist before any await");
    assert.equal(f.outputs[0].text, "Selected paragraph. Another sentence.");
    assert.equal(f.plugin.dwellTimer, null);
    assert.equal(f.plugin.settings.autoTranslateDelay, 8, "Do not change automatic dwell settings");
    assert.equal(scheduler.tasks.size, 0, "No automatic delay is queued for manual translation");
    assert.equal(scheduler.frames.length, 1);
    assert.equal(sandbox.__requests.length, 0);
    scheduler.render();
    assert.equal([...scheduler.tasks.values()][0].delay, 0, "Only a paint task, not an artificial wait");
    assert.equal(sandbox.__requests.length, 0);
    scheduler.resume(); await done;
    assert.equal(f.outputs.length, 3);
    assert.equal(sandbox.__requests.length, 1);
  } finally { f?.unload(); scheduler.restore(); }
});

test("closing an immediate popup before its first paint sends no request and does not reopen it", async () => {
  const scheduler = controlledScheduler();
  let f;
  try {
    f = await realTranslationFixture();
    const done = f.menu.items[1].click();
    f.plugin.closePopup();
    scheduler.render(); scheduler.resume(); await done;
    assert.equal(f.outputs.length, 1);
    assert.equal(sandbox.__requests.length, 0);
  } finally { f?.unload(); scheduler.restore(); }
});

test("cached manual translation neither flashes waiting animation nor calls a provider", async () => {
  const f = await realTranslationFixture();
  vm.runInContext(`CACHE.set("src:有道:en>zh-Hans:Selected paragraph. Another sentence.",
    { text: "缓存译文。", via: "offline" });`, sandbox);
  await f.menu.items[1].click();
  assert.equal(f.outputs[0].pending, false);
  assert.equal(f.outputs[1][0].waiting, false);
  assert.equal(f.outputs[2][0].zh, "缓存译文。");
  assert.equal(sandbox.__requests.length, 0); f.unload();
});

test("automatic selection still waits for exactly its configured dwell time", () => {
  const scheduler = controlledScheduler();
  const f = fixture();
  try {
    delete f.plugin.cancelAutoTranslate;
    f.plugin.settings = { autoTranslate: true, autoTranslateDelay: 4.25 };
    f.plugin.translateSelection = (mode, selection, options) => f.calls.push({ mode, selection, options });
    activeSelection = { toString: () => "Automatic selection.", info: { text: "Automatic selection.", anchor } };
    f.plugin.onSelectionChanged();
    assert.equal(f.calls.length, 0);
    assert.equal(scheduler.frames.length, 0);
    assert.equal([...scheduler.tasks.values()][0].delay, 4250);
    scheduler.resume();
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].options, undefined, "Automatic selection does not use the manual popup path");
  } finally { f.unload(); scheduler.restore(); }
});

(async () => {
  for (const [name, fn] of cases) { await fn(); passed++; console.log("PASS", name); }
  console.log(`PASS ${passed} selection-menu tests (${path.relative(root, sourcePath)})`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
