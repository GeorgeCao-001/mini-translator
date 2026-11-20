"use strict";

// Real popup lifecycle with offline DOM/Obsidian doubles. No live Vault/API access.
const assert = require("assert/strict"), fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.resolve(__dirname, "..");
const sourcePath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, "main.js");
class Element {
  constructor(tag = "div", opts = {}) {
    this.tagName = tag.toUpperCase(); this.className = opts.cls || ""; this.textContent = opts.text || "";
    this.children = []; this.dataset = {}; this.attributes = {}; this.events = new Map(); this.isConnected = true;
    this.style = { setProperty(name, value) { this[name] = value; } };
    const classes = new Set(); this.classList = { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) };
  }
  get childNodes() { return this.children; }
  appendChild(child) { child.parent = this; this.children.push(child); return child; }
  createEl(tag, opts = {}) { return this.appendChild(new Element(tag, opts)); }
  createDiv(opts) { return this.createEl("div", opts); } createSpan(opts) { return this.createEl("span", opts); }
  addClass(cls) { this.className += " " + cls; } setText(text) { this.replaceChildren(); this.textContent = text; }
  appendText(text) { this.textContent += text; }
  setAttribute(name, value) { this.attributes[name] = String(value); } getAttribute(name) { return this.attributes[name]; }
  addEventListener(type, fn) { this.events.set(type, fn); } removeEventListener(type) { this.events.delete(type); }
  contains(node) { return this === node || this.children.some(child => child.contains(node)); }
  replaceChildren(...children) { this.children = []; this.textContent = ""; for (const child of children) this.appendChild(child); }
  empty() { this.replaceChildren(); this.textContent = ""; }
  querySelector(tag) { for (const c of this.children) { if (c.tagName === tag.toUpperCase()) return c; const found = c.querySelector(tag); if (found) return found; } return null; }
  remove() { this.isConnected = false; if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); }
  getBoundingClientRect() { const left = parseFloat(this.style.left) || 0, top = parseFloat(this.style.top) || 0, width = parseFloat(this.style.width) || 400, height = parseFloat(this.style.height) || 220; return { left, top, width, height, right: left + width, bottom: top + height }; }
  animate() { return { cancel() {} }; }
  click() { this.onclick?.({ stopPropagation() {} }); }
}
function eventTarget() {
  const events = new Map(); return {
    addEventListener(type, fn) { if (!events.has(type)) events.set(type, new Set()); events.get(type).add(fn); },
    removeEventListener(type, fn) { events.get(type)?.delete(fn); },
    emit(type, event) { for (const fn of [...events.get(type) || []]) fn(event); },
    count(type) { return events.get(type)?.size || 0; },
  };
}
const document = Object.assign(eventTarget(), { body: new Element(), documentElement: {}, createElement: tag => new Element(tag) });
const frames = new Map(); let frameId = 0;
const window = Object.assign(eventTarget(), { innerWidth: 1500, innerHeight: 900, setTimeout, clearTimeout,
  requestAnimationFrame(fn) { const id = ++frameId; frames.set(id, fn); return id; }, cancelAnimationFrame(id) { frames.delete(id); },
  ResizeObserver: class { constructor(fn) { this.fn = fn; } observe() {} disconnect() {} },
});
let selectedText = ""; window.getSelection = () => ({ toString: () => selectedText }); document.defaultView = window;
const copied = [], notices = [];
const obsidian = new Proxy({}, { get(_target, key) {
  if (key === "setIcon") return (el, icon) => { el.icon = icon; };
  if (key === "Notice") return class { constructor(text) { notices.push(text); } };
  if (key === "requestUrl") return () => { throw Error("No network allowed"); };
  return class {};
} });
const sandbox = { module: { exports: {} }, document, window, console, setTimeout, clearTimeout,
  navigator: { clipboard: { writeText: async text => { copied.push(text); } } },
  require(name) { if (name === "obsidian") return obsidian; if (name.startsWith("./src/")) return require(path.join(root, name)); throw Error(name); },
};
vm.createContext(sandbox);
const source = fs.readFileSync(sourcePath, "utf8");
vm.runInContext(source + "\n;globalThis.__lockTest = { POPUP_LOCK, I18N };", sandbox, { filename: sourcePath });
const { POPUP_LOCK, I18N } = sandbox.__lockTest;
const marker = 'this.registerDomEvent(document, "dblclick", (e) => {';
const start = source.indexOf(marker); assert.ok(start >= 0);
const body = source.slice(start + marker.length).split("\n    });")[0];
vm.runInContext("globalThis.__outsideDoubleClick = function(e) {" + body + "\n};", sandbox);
const anchor = { left: 100, top: 260, right: 430, bottom: 290 };
const outside = () => ({ target: { ownerDocument: document } });
function fixture(pending = false) {
  const p = new sandbox.module.exports(); p.settings = { sourceLanguage: "en", targetLanguage: "zh-Hans", popupMaxSize: "standard" };
  p.saves = 0; p.saveData = async () => { p.saves++; }; p.cancellations = 0;
  p.cancelAutoTranslate = () => { p.cancellations++; return true; };
  p.showPopup("Source text", anchor.left, anchor.bottom + 6, null, pending, anchor);
  p._popupTranslationDone = !pending;
  return p;
}
const tests = []; const test = (name, fn) => tests.push([name, fn]);
test("control: native button, localized accessible state, correct lock icons", () => {
  for (const locale of ["zh-CN", "en"]) {
    I18N.setUiLanguage(locale); const p = fixture(), b = p.popupLockBtn;
    assert.equal(b.tagName, "BUTTON"); assert.equal(b.type, "button"); assert.equal(b.getAttribute("aria-pressed"), "false"); assert.equal(b.icon, "lock-open");
    const before = b.getAttribute("aria-label"); assert.equal(before, I18N.t("translation.lock_popup"));
    b.click(); assert.equal(b.getAttribute("aria-pressed"), "true"); assert.equal(b.icon, "lock");
    assert.equal(b.title, I18N.t("translation.unlock_popup")); assert.notEqual(before, b.title); p.closePopup();
  }
});
test("control: mousedown/click do not initiate header dragging", () => {
  const p = fixture(); let stops = 0;
  p.popupLockBtn.onmousedown({ stopPropagation() { stops++; } });
  p.popupLockBtn.onclick({ stopPropagation() { stops++; } });
  assert.equal(stops, 2); assert.equal(p._popupDragged, false); p.closePopup();
});
test("unlocked completed popup retains ordinary outside-click dismissal", () => {
  const p = fixture(); document.emit("mousedown", outside()); assert.equal(p.popupEl, null);
});
test("locked completed popup survives repeated outside clicks without losing result", () => {
  const p = fixture(); const popup = p.popupEl; p.lastPopupText = "translated"; p.popupLockBtn.click();
  for (let i = 0; i < 3; i++) document.emit("mousedown", outside());
  assert.equal(p.popupEl, popup); assert.equal(p.lastPopupText, "translated"); assert.equal(p.cancellations, 0); p.closePopup();
});
test("outside double-click does not cancel either pending or completed locked popup", () => {
  for (const pending of [false, true]) { const p = fixture(pending), popup = p.popupEl, n = notices.length; p.popupLockBtn.click();
    sandbox.__outsideDoubleClick.call(p, outside()); assert.equal(p.popupEl, popup); assert.equal(p.cancellations, 0); assert.equal(notices.length, n); p.closePopup(); }
});
test("unlocked in-flight behavior remains single-click safe, double-click cancellable", () => {
  const p = fixture(true), popup = p.popupEl; document.emit("mousedown", outside()); assert.equal(p.popupEl, popup);
  sandbox.__outsideDoubleClick.call(p, outside()); assert.equal(p.popupEl, null); assert.equal(p.cancellations, 1);
});
test("Escape always closes even if the lock button has focus or translation is pending", () => {
  for (const pending of [false, true]) { const p = fixture(pending); p.popupLockBtn.click(); document.emit("keydown", { key: "Escape", target: p.popupLockBtn });
    assert.equal(p.popupEl, null); assert.equal(p._popupLocked, false); }
});
test("Close button ignores the lock and clears lock references", () => {
  const p = fixture(); p.popupLockBtn.click(); p.popupCloseBtn.onclick({ stopPropagation() {} });
  assert.equal(p.popupEl, null); assert.equal(p.popupLockBtn, null); assert.equal(p.popupLockControl, null); assert.equal(p._popupLocked, false);
});
test("unlock restores outside dismissal without immediately closing the popup", () => {
  const p = fixture(), popup = p.popupEl; p.popupLockBtn.click(); p.popupLockBtn.click();
  assert.equal(p._popupLocked, false); assert.equal(p.popupEl, popup); document.emit("mousedown", outside()); assert.equal(p.popupEl, null);
});
test("copy and inside clicks remain usable while locked", async () => {
  const p = fixture(); p.popupLockBtn.click(); p.lastPopupText = "translation only";
  const copy = p.popupHeaderEl.children[1]; document.emit("mousedown", { target: copy }); await copy.onclick();
  assert.equal(copied.at(-1), "translation only"); assert.ok(p.popupEl); assert.equal(p._popupLocked, true); p.closePopup();
});
test("successful result and failure updates preserve a lock selected during translation", () => {
  const p = fixture(true); p.popupLockBtn.click(); const control = p.popupLockControl;
  p.showPopupSources([{ en: "Source", waiting: true }]);
  p.updatePopupTranslation(0, { en: "Source", zh: "译文", sourceLanguage: "en", targetLanguage: "zh-Hans" }, "offline");
  assert.equal(p._popupLocked, true); assert.equal(p.popupLockControl, control); assert.equal(p.lastPopupText, "译文");
  p.failPopup("Offline error"); assert.equal(p._popupLocked, true); document.emit("mousedown", outside()); assert.ok(p.popupEl); p.closePopup();
});
test("closing clears the lock; discarded controls cannot change a newly opened popup", () => {
  const p = fixture(); p.popupLockBtn.click(); const old = p.popupLockControl, staleClick = p.popupLockBtn.onclick;
  p.closePopup(); p.showPopup("Another source", 100, 300, null, false, anchor);
  assert.equal(p._popupLocked, false); assert.equal(p.popupLockControl.locked, false);
  staleClick({ stopPropagation() {} }); old.setLocked(true); assert.equal(p._popupLocked, false); p.closePopup();
});
test("close removes dismissal listeners; toggling does not persist settings or change geometry", () => {
  const p = fixture(), bounds = JSON.stringify(p.popupEl.getBoundingClientRect());
  p.popupLockBtn.click(); p.popupLockBtn.click(); assert.equal(p.saves, 0); assert.equal(JSON.stringify(p.popupEl.getBoundingClientRect()), bounds);
  p.closePopup(); assert.equal(document.count("mousedown"), 0); assert.equal(document.count("keydown"), 0);
});
test("module: destroyed controls are inert even when a callback is retained", () => {
  let n = 0; const control = POPUP_LOCK.createPopupLockControl(new Element(), { t: k => k, setIcon() {}, onChange() { n++; } });
  const click = control.buttonEl.onclick; control.destroy(); click({ stopPropagation() {} }); control.setLocked(true); assert.equal(n, 0);
});
const farAnchor = { left: 1100, top: 35, right: 1350, bottom: 65 };
const boxOf = p => JSON.stringify(p.popupEl.getBoundingClientRect());
function flushFrames() {
  let count = 0;
  while (frames.size) {
    if (++count > 25) throw Error("Unexpected frame loop");
    const [id, fn] = frames.entries().next().value; frames.delete(id); fn();
  }
}
function reuse(p, text = "Another source", pending = false) {
  p.showPopup(text, farAnchor.left, farAnchor.bottom + 6, null, pending, farAnchor);
}
test("locked new selection reuses shell/body/controls/listeners/observer and keeps its box", () => {
  for (const dragged of [false, true]) {
    const p = fixture(), el = p.popupEl, header = p.popupHeaderEl, body = p.popupBodyEl;
    const control = p.popupLockControl, close = p.popupCloseBtn, observer = p._popupResizeObserver;
    const mouse = p._dismissMouse, key = p._dismissKey, resize = p._popupResize;
    p._popupDragged = dragged;
    if (dragged) Object.assign(el.style, { left: "360px", top: "410px", width: "700px", height: "350px" });
    const bounds = boxOf(p), generation = p._popupRunId;
    p.popupLockBtn.click(); reuse(p);
    assert.equal(p.popupEl, el); assert.equal(p.popupHeaderEl, header); assert.equal(p.popupBodyEl, body);
    assert.equal(p.popupLockControl, control); assert.equal(p.popupCloseBtn, close); assert.equal(p._popupResizeObserver, observer);
    assert.equal(p._dismissMouse, mouse); assert.equal(p._dismissKey, key); assert.equal(p._popupResize, resize);
    assert.equal(p._popupRunId, generation + 1); assert.equal(p._popupLocked, true); assert.equal(control.locked, true);
    assert.equal(boxOf(p), bounds); assert.equal(body.textContent, "Another source");
    for (const text of ["a", "Long selection. ".repeat(200)]) {
      reuse(p, text); p.showPopupSources([{ en: text, waiting: true }]);
      p.updatePopupTranslation(0, { en: text, zh: "长译文。".repeat(250) }, "offline"); flushFrames();
      assert.equal(boxOf(p), bounds); assert.equal(p.popupEl, el); assert.equal(p._popupLocked, true);
    }
    assert.equal(document.count("mousedown"), 1); assert.equal(document.count("keydown"), 1);
    assert.equal(p.saves, 0); p.closePopup();
  }
});
test("reusing clears old result/error/slots/scroll/copy state and refreshes pending state", async () => {
  const p = fixture(); p.popupLockBtn.click(); p.showPopupSources([{ en: "Old", waiting: false }]);
  p.updatePopupTranslation(0, { en: "Old", zh: "Old translation" }, "offline"); p.failPopup("Old failure");
  const body = p.popupBodyEl; body.scrollTop = 150; body.scrollLeft = 20;
  p.popupHeaderEl.querySelector("span").title = "Stale disclaimer";
  let cancelled = 0; p._popupStreamCancel = () => { cancelled++; };
  reuse(p, "", true);
  assert.equal(cancelled, 1); assert.equal(p._popupSlots.length, 0); assert.equal(p._popupSlotBody, null);
  assert.equal(p.lastPopupText, ""); assert.equal(p._popupTranslationDone, false);
  assert.equal(body.scrollTop, 0); assert.equal(body.scrollLeft, 0); assert.equal(body.classList.contains("mini-flow"), false);
  assert.equal(body.textContent, ""); assert.equal(p.pendingLabel.textContent, I18N.t("translation.in_progress"));
  assert.equal(p.popupHeaderEl.querySelector("span").title, ""); assert.equal(p.popupCloseBtn.title, I18N.t("translation.cancel"));
  const before = copied.length; await p.popupHeaderEl.children[1].onclick(); assert.equal(copied.length, before);
  reuse(p, "Cached source", false); assert.equal(p.pendingLabel, null); assert.equal(body.children.length, 0);
  assert.equal(body.textContent, "Cached source"); assert.equal(p.popupCloseBtn.title, I18N.t("common.close")); p.closePopup();
});
test("reuse preserves manual font scale without marking a natural box as a saved resize", () => {
  const p = fixture(); p.settings.rememberPopupSize = true; p.settings.popupFontFollowResize = true;
  p._popupFontScale = 1.4; p._placePopup(p.popupEl); const font = p.popupEl.style["--mini-popup-target-font-size"];
  p.popupLockBtn.click(); reuse(p); p._popupResizeObserver.fn(); flushFrames();
  assert.equal(p._popupFontScale, 1.4); assert.equal(p.popupEl.style["--mini-popup-target-font-size"], font);
  assert.equal(p._popupUserResized, false); assert.equal(p._popupResizeDirty, false);
  assert.equal(p.settings.popupLastSize, undefined); p.closePopup(); assert.equal(p.saves, 0);
});
test("dragging and native resizing still work after locked reuse", () => {
  const p = fixture(); p.popupLockBtn.click(); reuse(p);
  p.popupHeaderEl.events.get("mousedown")({ button: 0, clientX: 150, clientY: 320, preventDefault() {} });
  document.emit("mousemove", { clientX: 190, clientY: 350 }); document.emit("mouseup", {});
  const bounds = boxOf(p); reuse(p); assert.equal(boxOf(p), bounds);
  const el = p.popupEl, r = el.getBoundingClientRect();
  el.events.get("pointerdown")({ button: 0, clientX: r.right - 2, clientY: r.bottom - 2 });
  el.style.width = "650px"; el.style.height = "340px"; p._popupResizeObserver.fn(); flushFrames();
  p._popupResizeEnd(); flushFrames(); const resized = boxOf(p); reuse(p); assert.equal(boxOf(p), resized); p.closePopup();
});
test("unlocking permits normal replacement; close and Escape still override a reused lock", () => {
  const p = fixture(); p.popupLockBtn.click(); reuse(p); const el = p.popupEl;
  p.popupLockBtn.click(); reuse(p); assert.notEqual(p.popupEl, el); assert.equal(p._popupLocked, false); assert.equal(p._popupRetained, false); p.closePopup();
  for (const how of ["close", "Escape"]) {
    const q = fixture(true); q.popupLockBtn.click(); reuse(q, "", true);
    if (how === "close") q.popupCloseBtn.onclick({ stopPropagation() {} }); else document.emit("keydown", { key: "Escape" });
    assert.equal(q.popupEl, null); assert.equal(q._popupRetained, false); assert.equal(q._popupLocked, false);
    assert.equal(document.count("mousedown"), 0); assert.equal(document.count("keydown"), 0);
  }
});
function translationFixture() {
  const p = fixture(); p.settings.primarySource = "Offline"; p.settings.dictSource = "Offline dictionary";
  p.settings.autoTranslate = true; p.settings.autoTranslateDelay = 4.25;
  p.app = { workspace: { getActiveViewOfType: () => null } };
  p.locatePdfDoc = async () => null; p.historyWrites = [];
  p.pushHistory = (...args) => p.historyWrites.push(args);
  p.popupLockBtn.click(); sandbox.__settings = p.settings;
  vm.runInContext(`PLUGIN_SETTINGS = __settings; CACHE.clear(); globalThis.__requests = [];
    translateSentence = text => new Promise((resolve, reject) => __requests.push({kind: "translation", text, resolve, reject}));
    dictLookup = text => new Promise((resolve, reject) => __requests.push({kind: "dictionary", text, resolve, reject}));`, sandbox);
  return p;
}
const flow = (p, text, options = {}, mode = "paragraph") => p.translateSelection(mode, { text, anchor: farAnchor }, options);
const response = text => ({ text, via: "offline", detectedLanguage: "en" });
test("real translation pipeline ignores stale successful responses in the same locked shell", async () => {
  const p = translationFixture(), el = p.popupEl, bounds = boxOf(p);
  const old = flow(p, "Old paragraph."); const current = flow(p, "New paragraph.");
  assert.equal(sandbox.__requests.length, 2); assert.equal(p.popupEl, el); assert.equal(p._popupSlots[0].source, "New paragraph.");
  sandbox.__requests[1].resolve(response("新译文。")); await current;
  sandbox.__requests[0].resolve(response("过期译文。")); await old; flushFrames();
  assert.equal(p.lastPopupText, "新译文。"); assert.equal(p._popupSlots[0].source, "New paragraph.");
  assert.equal(p._popupTranslationDone, true); assert.equal(p.historyWrites.length, 1); assert.equal(boxOf(p), bounds); p.closePopup();
});
test("real translation pipeline ignores stale errors and recovers from a current error in-place", async () => {
  const p = translationFixture(), el = p.popupEl;
  const old = flow(p, "Failing old paragraph."); const current = flow(p, "Current paragraph.");
  sandbox.__requests[0].reject(Error("Old failure")); await old;
  assert.equal(p._popupTranslationDone, false); assert.notEqual(p.popupBodyEl.textContent, "Old failure");
  sandbox.__requests[1].reject(Error("Current failure")); await current;
  assert.equal(p.popupBodyEl.textContent, "Current failure"); assert.equal(p._popupLocked, true);
  const recovered = flow(p, "Retry paragraph."); sandbox.__requests[2].resolve(response("恢复译文。")); await recovered;
  assert.equal(p.lastPopupText, "恢复译文。"); assert.equal(p.popupEl, el); p.closePopup();
});
test("cached translation and dictionary selection reuse the locked popup with no stale content", async () => {
  const p = translationFixture(), el = p.popupEl;
  vm.runInContext('CACHE.set("src:Offline:en>zh-Hans:Cached paragraph.", {text:"缓存译文。",via:"offline"})', sandbox);
  const cached = flow(p, "Cached paragraph."); assert.equal(p._popupSlots[0].zhEl.children.length, 0);
  await cached; assert.equal(sandbox.__requests.length, 0); assert.equal(p.lastPopupText, "缓存译文。");
  const dict = flow(p, "robot"); assert.equal(sandbox.__requests[0].kind, "dictionary");
  assert.equal(p.lastPopupText, ""); sandbox.__requests[0].resolve(response("机器人")); await dict;
  assert.equal(p.lastPopupText, "机器人"); assert.equal(p.popupEl, el); assert.equal(p._popupSlots[0].pair.dict, true); p.closePopup();
});
test("reselecting during a multi-sentence request stops stale follow-up requests", async () => {
  const p = translationFixture(); const old = flow(p, "First sentence. Second sentence.", {}, "sentence");
  assert.equal(sandbox.__requests[0].text, "First sentence.");
  const current = flow(p, "Replacement paragraph.");
  sandbox.__requests[0].resolve(response("旧的第一句。")); await old;
  assert.equal(sandbox.__requests.length, 2, "Do not send the obsolete second sentence");
  sandbox.__requests[1].resolve(response("新结果。")); await current; assert.equal(p.lastPopupText, "新结果。"); p.closePopup();
});
test("manual immediate translation updates the same shell before paint and suppresses a superseded paint", async () => {
  const p = translationFixture(), el = p.popupEl;
  const old = flow(p, "Manual first paragraph.", { immediate: true });
  assert.equal(p.popupBodyEl.textContent, "Manual first paragraph."); assert.equal(p.popupEl, el);
  const current = flow(p, "Manual replacement paragraph.", { immediate: true });
  assert.equal(p.popupBodyEl.textContent, "Manual replacement paragraph."); assert.equal(sandbox.__requests.length, 0);
  flushFrames(); await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(sandbox.__requests.length, 1); assert.equal(sandbox.__requests[0].text, "Manual replacement paragraph.");
  sandbox.__requests[0].resolve(response("手动译文。")); await Promise.all([old, current]);
  assert.equal(p.popupEl, el); assert.equal(p.lastPopupText, "手动译文。"); assert.equal(p.settings.autoTranslateDelay, 4.25); p.closePopup();
});
test("automatic dwell still waits, then routes the new selection into the same locked popup", async () => {
  const p = translationFixture(), el = p.popupEl, oldTimeout = sandbox.setTimeout;
  let callback, delay, done; const real = p.translateSelection.bind(p);
  p.translateSelection = (...args) => { done = real(...args); return done; };
  p._readDomSelectionInfo = () => ({ text: selectedText, anchor: farAnchor });
  try {
    sandbox.setTimeout = (fn, ms) => { callback = fn; delay = ms; return 123; };
    selectedText = "Automatic new paragraph."; p.onSelectionChanged();
    assert.equal(delay, 4250); assert.equal(sandbox.__requests.length, 0); assert.equal(p.popupBodyEl.textContent, "Source text");
    callback(); assert.equal(p.popupEl, el); assert.equal(p._popupSlots[0].source, selectedText);
    sandbox.__requests[0].resolve(response("自动译文。")); await done;
    assert.equal(p.lastPopupText, "自动译文。"); assert.equal(p._popupLocked, true);
  } finally { sandbox.setTimeout = oldTimeout; p.closePopup(); }
});
test("closing a reused popup prevents pending success/error from reviving or overwriting a later popup", async () => {
  for (const error of [false, true]) {
    const p = translationFixture(), pending = flow(p, "Pending old paragraph.");
    document.emit("keydown", { key: "Escape" });
    p.showPopup("Fresh unlocked popup", anchor.left, anchor.bottom, null, false, anchor); const fresh = p.popupEl;
    if (error) sandbox.__requests[0].reject(Error("Late error")); else sandbox.__requests[0].resolve(response("Late success"));
    await pending; assert.equal(p.popupEl, fresh); assert.equal(p.popupBodyEl.textContent, "Fresh unlocked popup");
    assert.equal(p._popupLocked, false); assert.equal(p.historyWrites.length, 0); p.closePopup();
  }
});

const shelfPairs = n => [{ en: "Source " + n + ".", zh: "译文 " + n + "。", sourceLanguage: "en", targetLanguage: "zh-Hans" }];
const shelfHistory = () => Array.from({ length: 9 }, (_, i) => ({ pairs: shelfPairs(i + 1), via: "Offline", file: "Fixture.pdf", page: i + 1, ts: 1 }));
const tHistory = (i, n) => I18N.t("popup_history.position", { index: i, count: n });
const getControl = (p, cls) => p.popupHeaderEl.children.find(child => child.className === "mini-popup-history-controls")
  .children.find(child => child.className === "mini-popup-history-" + cls);
test("history browses five prior completed results and restores current DOM, scroll and copy text", async () => {
  const p = fixture();
  p.settings.history = shelfHistory();
  p.updatePopupPairs(shelfPairs(1), "Offline");
  p._popupCurrentPairs = shelfPairs(1);
  p.refreshPopupHistoryControls();
  const body = p.popupBodyEl, header = p.popupHeaderEl.querySelector("span"), title = header.textContent;
  const original = body.children[1];
  body.scrollTop = 51;
  getControl(p, "older").click();
  assert.equal(p._popupHistoryView.entries.length, 5);
  assert.ok(header.textContent.startsWith(tHistory(1, 5)));
  assert.match(header.title, /Fixture\.pdf/);
  assert.equal(p.lastPopupText, shelfPairs(2)[0].zh);
  await p.popupHeaderEl.children[1].onclick();
  assert.equal(copied.at(-1), shelfPairs(2)[0].zh);
  for (let i = 0; i < 7; i++) getControl(p, "older").click();
  assert.ok(header.textContent.startsWith(tHistory(5, 5)));
  assert.equal(p.lastPopupText, shelfPairs(6)[0].zh);
  assert.ok(getControl(p, "older").disabled);
  getControl(p, "newer").click();
  assert.equal(p.lastPopupText, shelfPairs(5)[0].zh);
  getControl(p, "current").click();
  assert.equal(header.textContent, title);
  assert.equal(p.lastPopupText, shelfPairs(1)[0].zh);
  assert.equal(body.children[1], original);
  assert.equal(body.scrollTop, 51);
  assert.equal(p.saves, 0);
  p.closePopup();
});
test("history can be reopened after dismissal and returns to newest with no duplicate entry", () => {
  const p = fixture();
  p.settings.history = [{ pairs: [] }, ...shelfHistory()];
  p.closePopup();
  p.openPopupHistory();
  assert.equal(p.lastPopupText, shelfPairs(1)[0].zh);
  assert.ok(p.popupHeaderEl.querySelector("span").textContent.startsWith(tHistory(1, 5)));
  assert.ok(getControl(p, "newer").disabled);
  getControl(p, "older").click();
  getControl(p, "older").click();
  getControl(p, "current").click();
  assert.equal(p.lastPopupText, shelfPairs(1)[0].zh);
  assert.equal(p.settings.history.length, 10);
  p.settings.history = [];
  p.resetPopupHistory();
  assert.equal(p.popupEl, null);
  const noticesBefore = notices.length;
  p.openPopupHistory();
  assert.equal(p.popupEl, null);
  assert.equal(notices.length, noticesBefore + 1);
});
test("pending translations keep the current popup; a new locked selection leaves history mode", async () => {
  const p = translationFixture(), shell = p.popupEl;
  p.settings.history = shelfHistory();
  p._popupTranslationDone = true;
  p.openPopupHistory();
  assert.equal(p.lastPopupText, shelfPairs(1)[0].zh);
  const next = flow(p, "New provisional paragraph.");
  assert.equal(p.popupEl, shell);
  assert.equal(p._popupHistoryView, null);
  p.openPopupHistory();
  assert.equal(p._popupHistoryView, null);
  assert.equal(p._popupTranslationDone, false);
  sandbox.__requests[0].resolve(response("新译文。"));
  await next;
  assert.equal(p.lastPopupText, "新译文。");
  assert.equal(p.historyWrites.length, 1);
  getControl(p, "older").click();
  p.settings.history = [];
  p.resetPopupHistory();
  assert.equal(p.lastPopupText, "新译文。");
  assert.equal(p._popupHistoryView, null);
  assert.equal(p.popupEl, shell);
  p.closePopup();
});

(async () => { for (const [name, fn] of tests) { selectedText = ""; await fn(); frames.clear(); console.log("PASS " + name); }
  console.log(`ALL PASS (${tests.length} popup lock/history tests; ${path.basename(path.dirname(sourcePath))}/${path.basename(sourcePath)})`);
})().catch(e => { console.error(e); process.exitCode = 1; });
