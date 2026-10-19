"use strict";
// Fully offline: fake Vault, fake PDF documents and providers; no data.json or live UI.
const assert = require("assert/strict"), fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.resolve(__dirname, "..");
const ranges = require(path.join(root, "src/page-ranges.js"));
const { createPdfFilePicker } = require(path.join(root, "src/pdf-file-picker.js"));
const { createTranslationModals } = require(path.join(root, "src/pdf-translation-ui.js"));
const i18n = require(path.join(root, "src/i18n.js"));
i18n.setUiLanguage("en"); const t = i18n.t;
const tests = []; const test = (name, fn) => tests.push({ name, fn });
const plain = value => JSON.parse(JSON.stringify(value));
class Element {
  constructor(tag = "div", opts = {}) {
    this.tagName = tag.toUpperCase(); this.children = []; this.style = {}; this.dataset = {};
    this.className = opts.cls || ""; this.text = opts.text || ""; this.value = "";
    this.hidden = false; this.scrollTop = 0; this.type = opts.type || "";
    this.classList = { add: name => this.addClass(name), contains: name => this.className.split(" ").includes(name) };
    for (const [k, v] of Object.entries(opts.attr || {})) this.setAttribute(k, v);
  }
  createEl(tag, opts) { const e = new Element(tag, opts); e.parentNode = this; this.children.push(e); return e; }
  createDiv(opts) { return this.createEl("div", opts); } createSpan(opts) { return this.createEl("span", opts); }
  empty() { this.children = []; } setText(text) { this.text = text; }
  addClass(name) { this.className += " " + name; }
  toggleClass(name, on) { const set = new Set(this.className.split(" ")); on ? set.add(name) : set.delete(name); this.className = [...set].join(" "); }
  setAttribute(k, v) { this[k] = v; }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(e => e !== this); }
  click() { if (!this.disabled) this.onclick?.({ shiftKey: false, stopPropagation() {} }); }
}
class Modal {
  constructor(app) { this.app = app; this.contentEl = new Element(); this.modalEl = new Element(); }
  open() { this.onOpen(); return this; } close() { this.onClose(); }
}
const files = ["papers/a.pdf", "papers/b.pdf", "papers/sub/c.pdf", "notes/other.pdf", "root.pdf"].map(p => ({ path: p, name: p.split("/").pop(), extension: "pdf" }));
function picker(extra = {}) { return createPdfFilePicker(new Element(), { files, t, ...extra }); }
function choose(ui, p, checked = true, shiftKey = false) { const ref = ui.rows.get(p); ref.check.checked = checked; ref.check.onclick({ shiftKey, stopPropagation() {} }); }
function openDir(ui, p) { ui.dirs.get(p).toggle.click(); }
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test("ranges: all, singles, ranges, duplicates, physical order and canonical labels", () => {
  assert.deepEqual(ranges.parsePageRange("", 4), { pages: [1, 2, 3, 4], label: "1-4", all: true });
  assert.deepEqual(ranges.parsePageRange("7, 1–3，3、10-12", 12), { pages: [1, 2, 3, 7, 10, 11, 12], label: "1-3, 7, 10-12", all: false });
  assert.equal(ranges.parsePageRange("3, 1-2", 3).all, true);
});
test("ranges: invalid, reversed, zero, decimal, empty terms and out-of-bounds are rejected", () => {
  for (const input of ["0", "-1", "1.5", "1e2", "a", "1,", "1,,2", "3-", "1 2", "1-2-3"]) assert.throws(() => ranges.parsePageRange(input, 10));
  assert.throws(() => ranges.parsePageRange("4-2", 10), e => e.code === "reversed");
  assert.throws(() => ranges.parsePageRange("2-1000000000", 10), e => e.code === "bounds");
  assert.throws(() => ranges.normalizePageNumbers([], 10));
  assert.throws(() => ranges.normalizePageNumbers([1.1], 10));
  assert.throws(() => ranges.parsePageRange("", 0));
});
test("ranges: merged blocks spanning an unselected page fail closed", () => {
  assert.equal(ranges.validateBlockPages([{ page: 2, continuedThroughPage: 4 }], [2, 4]), false);
  assert.equal(ranges.validateBlockPages([{ page: 2, continuedThroughPage: 3 }], [2, 3]), true);
});
test("picker CSS: scoped hidden selectors override flex-row display rules", () => {
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  assert.match(css, /\.mini-pdf-picker \.mini-pdf-list > \[hidden\]/);
  assert.match(css, /\.mini-pdf-confirm \.mini-pdf-range-controls > \[hidden\]\s*\{\s*display:\s*none/);
});
test("picker: checking and analysis keep the same list/row/input and scroll position", () => {
  const ui = picker(); openDir(ui, "papers"); ui.list.scrollTop = 230;
  const row = ui.rows.get("papers/a.pdf").el; choose(ui, "papers/a.pdf");
  const input = ui.basketRows.get("papers/a.pdf").range; input.value = "2-3"; input.selectionStart = 2;
  ui.updateFile("papers/a.pdf", { text: "ready" }); choose(ui, "papers/b.pdf");
  assert.equal(ui.rows.get("papers/a.pdf").el, row); assert.equal(ui.list.scrollTop, 230);
  assert.equal(ui.basketRows.get("papers/a.pdf").range, input); assert.equal(input.value, "2-3"); assert.equal(input.selectionStart, 2);
});
test("picker: folders update checked/indeterminate immediately without rerender", () => {
  const ui = picker(); const folder = ui.dirs.get("papers");
  choose(ui, "papers/a.pdf"); assert.equal(folder.check.indeterminate, true);
  folder.check.checked = true; folder.check.onchange(); assert.equal(ui.selected.size, 3);
  assert.equal(folder.check.checked, true); assert.equal(folder.check.indeterminate, false);
  folder.check.checked = false; folder.check.onchange(); assert.equal(ui.selected.size, 0);
});
test("picker: Shift selects only visible files in display order", () => {
  const ui = picker(); openDir(ui, "papers"); choose(ui, "papers/a.pdf"); choose(ui, "papers/b.pdf", true, true);
  assert.deepEqual([...ui.selected], ["papers/a.pdf", "papers/b.pdf"]);
  assert.equal(ui.selected.has("papers/sub/c.pdf"), false);
});
test("picker: search finds collapsed paths, retains selections and restores tree scroll", () => {
  const state = {}; const ui = picker({ state }); openDir(ui, "papers"); ui.list.scrollTop = 180;
  choose(ui, "papers/a.pdf"); ui.search.value = "sub/c"; ui.search.oninput();
  assert.equal(ui.rows.get("papers/sub/c.pdf").el.hidden, false); choose(ui, "papers/sub/c.pdf");
  ui.search.value = ""; ui.search.oninput(); assert.equal(ui.list.scrollTop, 180);
  assert.equal(ui.rows.get("papers/sub/c.pdf").el.hidden, true); assert.equal(ui.selected.size, 2);
  ui.destroy(); const reopened = picker({ state }); assert.equal(reopened.list.scrollTop, 180);
  assert.equal(reopened.dirs.get("papers").toggle["aria-expanded"], "true");
});
test("picker: range values survive deselect/reselect; remove updates folder state", () => {
  let change; const ui = picker({ onRangeChange: (f, v) => { change = [f.path, v]; } });
  choose(ui, "papers/a.pdf"); let item = ui.basketRows.get("papers/a.pdf"); item.range.value = "1, 3"; item.range.oninput();
  assert.deepEqual(change, ["papers/a.pdf", "1, 3"]); choose(ui, "papers/a.pdf", false); choose(ui, "papers/a.pdf");
  assert.equal(ui.basketRows.get("papers/a.pdf").range.value, "1, 3");
  ui.updateFile("papers/a.pdf", { invalid: true, text: "invalid", retry: true });
  assert.equal(ui.basketRows.get("papers/a.pdf").range["aria-invalid"], "true");
});
function info(file, blocks, opts = {}) {
  const pages = opts.totalPages || 5, selectedPages = ranges.normalizePageNumbers(opts.selectedPages, pages);
  return { fileName: file.name, pdfPath: file.path, pages, selectedPages,
    transN: blocks.length, chars: blocks.reduce((n, b) => n + b.text.length, 0), tokensEst: blocks.length * 12,
    chunks: blocks.length, source: "offline", sourceLanguage: "en", targetLanguage: "zh-Hans", eta: "test" };
}
function host(extra = {}) {
  let started = 0, translated;
  const plugin = { settings: { sourceLanguage: "en", targetLanguage: "zh-Hans" }, app: { vault: { getFiles: () => files } },
    buildDocInfo: info, ensureLlmForFull: () => true, runFullTranslate: async v => { started++; translated = v; },
    runPickedTranslate: async v => { started++; translated = v; }, reportFullTranslateFailure: e => { throw e; } };
  const reads = []; const docs = new Map();
  const classes = createTranslationModals({ Modal, t, ...ranges, createPdfFilePicker, fmtTok: String, languageQualityNotice: () => "",
    getPdfDocForFile: async (_p, f) => { const doc = { numPages: 5, destroyCount: 0, destroy() { this.destroyCount++; } }; docs.set(f.path, doc); return { doc, owned: true }; },
    extractDocBlocks: async (_doc, _prog, pages, stale) => { reads.push(pages); if (stale()) throw Error("stale"); return { blocks: pages.map(page => ({ page, kind: "body", text: "text" })) }; }, ...extra });
  return { plugin, reads, docs, ...classes, get started() { return started; }, get translated() { return translated; } };
}
test("single confirm: whole default, changed range recalculates estimates, start uses selected blocks", async () => {
  const h = host(), m = new h.FullTranslateModal({}, h.plugin, { fileName: "paper.pdf", pdfPath: "paper.pdf", doc: { numPages: 5 } }).open();
  await m.chain; assert.equal(m.start.disabled, false); assert.deepEqual(m.info.selectedPages, [1, 2, 3, 4, 5]);
  m.mode.value = "custom"; m.range.value = "2,4-5"; m.mode.onchange(); await m.chain;
  assert.deepEqual(m.info.selectedPages, [2, 4, 5]); assert.equal(m.info.tokensEst, 36);
  m.start.click(); assert.equal(h.started, 1); assert.deepEqual(h.translated.blocks.map(b => b.page), [2, 4, 5]);
});
test("single confirm: invalid range disables start and never calls extraction/provider", async () => {
  const h = host(), m = new h.FullTranslateModal({}, h.plugin, { fileName: "a.pdf", pdfPath: "a.pdf", doc: { numPages: 5 } }).open();
  await m.chain; const before = h.reads.length;
  m.mode.value = "custom"; m.range.value = "6"; m.mode.onchange(); await m.chain;
  assert.equal(m.start.disabled, true); assert.equal(h.reads.length, before); m.start.click(); assert.equal(h.started, 0);
  assert.match(m.status.text, /5 pages/); m.close();
});
test("single confirm: close/stale analysis cannot re-enable start or translate", async () => {
  const wait = deferred(), h = host({ extractDocBlocks: async () => { await wait.promise; return { blocks: [{ text: "late", page: 1 }] }; } });
  const m = new h.FullTranslateModal({}, h.plugin, { fileName: "a.pdf", pdfPath: "a.pdf", doc: { numPages: 5 } }).open();
  await Promise.resolve(); m.close(); wait.resolve(); await m.chain;
  assert.equal(m.info, null); assert.equal(m.start.disabled, true); assert.equal(h.started, 0);
});
test("batch: independent page ranges update in-place and are transferred unchanged", async () => {
  const h = host(), m = new h.FilePickTranslateModal({}, h.plugin).open();
  choose(m.ui, "papers/a.pdf"); choose(m.ui, "papers/b.pdf"); await m.chain;
  const input = m.ui.basketRows.get("papers/a.pdf").range; input.value = "2,4"; input.oninput(); await m.chain;
  assert.equal(m.ui.basketRows.get("papers/a.pdf").range, input); assert.equal(m.ui.start.disabled, false);
  m.ui.start.click(); assert.equal(h.started, 1);
  assert.deepEqual(h.translated[0].pageNumbers, [2, 4]); assert.deepEqual(h.translated[1].pageNumbers, [1, 2, 3, 4, 5]);
  assert.equal(h.docs.get("papers/a.pdf").destroyCount, 0, "owned documents are transferred, not destroyed before execution");
});
test("batch: invalid range blocks the entire start and is repairable without losing selection", async () => {
  const h = host(), m = new h.FilePickTranslateModal({}, h.plugin).open(); choose(m.ui, "papers/a.pdf"); await m.chain;
  const input = m.ui.basketRows.get("papers/a.pdf").range; input.value = "4-2"; input.oninput(); await m.chain;
  assert.equal(m.ui.start.disabled, true); assert.equal(m.selected.size, 1); assert.equal(input["aria-invalid"], "true");
  input.value = "2-3"; input.oninput(); await m.chain; assert.equal(m.ui.start.disabled, false); assert.equal(input["aria-invalid"], "false"); m.close();
  assert.equal(h.docs.get("papers/a.pdf").destroyCount, 1);
});
test("batch: closing pending file parse releases only plugin-owned documents", async () => {
  for (const owned of [true, false]) {
    const wait = deferred(), entered = deferred(), doc = { numPages: 3, destroyed: 0, destroy() { this.destroyed++; } };
    const h = host({ getPdfDocForFile: async () => { entered.resolve(); await wait.promise; return { doc, owned }; } });
    const m = new h.FilePickTranslateModal({}, h.plugin).open(); choose(m.ui, "papers/a.pdf"); await entered.promise;
    m.close(); wait.resolve(); await m.chain; assert.equal(doc.destroyed, owned ? 1 : 0); assert.equal(h.started, 0);
  }
});
test("batch: a newer range supersedes pending extraction, never starts stale text", async () => {
  const wait = deferred(); let n = 0;
  const h = host({ extractDocBlocks: async (_d, _p, pages) => { if (++n === 1) await wait.promise; return { blocks: pages.map(page => ({ page, text: "text" })) }; } });
  const m = new h.FilePickTranslateModal({}, h.plugin).open(); choose(m.ui, "papers/a.pdf");
  await Promise.resolve(); await Promise.resolve();
  const input = m.ui.basketRows.get("papers/a.pdf").range; input.value = "3"; input.oninput(); wait.resolve(); await m.chain;
  assert.deepEqual(m.stats.get("papers/a.pdf").info.selectedPages, [3]); m.close();
});

// Integration against actual source or the self-contained release bundle.
const writes = new Map(), calls = [], notices = [];
const doc = { numPages: 5, getPage: async number => { calls.push(number); return {
  getViewport: () => ({ width: 600, height: 800, convertToViewportPoint: (x, y) => [x, 800 - y] }),
  getTextContent: async () => ({ items: [{ str: `Page ${number} has a sufficiently long complete sentence for extraction.`, width: 450, height: 12, transform: [12, 0, 0, 12, 50, 500] }] }),
  getOperatorList: async () => ({ fnArray: [], argsArray: [] }), render: () => ({ promise: Promise.resolve() }),
}; } };
const obsidian = { Plugin: class {}, Modal, ItemView: class {}, PluginSettingTab: class {}, Setting: class {},
  Notice: class { constructor(v) { notices.push(v); } }, requestUrl: () => { throw Error("Network must never be called"); } };
const ctx = { module: { exports: {} }, window: {}, console, Uint8Array, URL, Blob, setTimeout, clearTimeout,
  document: { createElement: () => ({ getContext: () => ({ fillRect() {} }), toDataURL: () => "data:image/jpeg;base64,AA==" }) },
  atob: s => Buffer.from(s, "base64").toString("binary"), btoa: s => Buffer.from(s, "binary").toString("base64"),
  require: name => name === "obsidian" ? obsidian : name.startsWith("./src/") ? require(path.join(root, name)) : (() => { throw Error(name); })(),
};
vm.createContext(ctx);
const sourceFile = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, "main.js");
vm.runInContext(fs.readFileSync(sourceFile, "utf8") + `
setUiLanguage('en');
globalThis.__pdfTest={extractDocBlocks,groupIntoBatches,buildReplicaHtml,detectRasterFigures,Plugin:module.exports};
loadPdfJs=()=>({OPS:{}});
globalThis.__sent=[];
translateBlocksAll=async(_p,blocks)=>{__sent.push(blocks);return {results:blocks.map(b=>({en:b.text,zh:'translated '+b.text})),batches:[]}};
`, ctx);
const X = ctx.__pdfTest;
function plugin(html = false) {
  const p = new X.Plugin();
  p.settings = { primarySource: "offline", sourceLanguage: "en", targetLanguage: "zh-Hans", fullHtml: html };
  p.app = { vault: { adapter: { exists: async () => false, write: async (name, text) => writes.set(name, text) } } };
  p.ensureProg = p.progUpdate = p.clearFullTranslateStatus = p.endProg = () => {};
  p.resetFtCancel = () => { p.ftCancel = false; };
  return p;
}
test("extraction: only selected physical pages are read and page numbering is retained", async () => {
  calls.length = 0; const result = await X.extractDocBlocks(doc, null, [2, 4]);
  assert.deepEqual(calls, [2, 4]); assert.deepEqual(plain(result.blocks.map(b => b.page)), [2, 4]);
  assert.equal(result.blocks.length, 2, "non-adjacent pages never merge");
});
test("extraction: cancellation prevents any further page read", async () => {
  calls.length = 0; await assert.rejects(X.extractDocBlocks(doc, null, [2, 3], () => true), /superseded/); assert.equal(calls.length, 0);
});
test("extraction: contiguous pages join their continuation without pulling in boundary pages", async () => {
  const read = [];
  const continuous = { numPages: 4, getPage: async p => {
    read.push(p); const original = await doc.getPage(p);
    original.getTextContent = async () => ({ items: [{
      str: p === 2 ? 'This sufficiently long body paragraph continues into the next page without ending' : 'and this sufficiently long sentence completes the continued paragraph.',
      width: 480, height: 12, transform: [12, 0, 0, 12, 50, 500],
    }] }); return original;
  } };
  const result = await X.extractDocBlocks(continuous, null, [2, 3]);
  assert.deepEqual(read, [2, 3]); assert.equal(result.blocks.length, 1);
  assert.equal(result.blocks[0].page, 2); assert.equal(result.blocks[0].continuedThroughPage, 3);
});
test("batching: disjoint ranges are not mixed in one model request", () => {
  assert.deepEqual(plain(X.groupIntoBatches([{ page: 2, text: "one" }, { page: 3, text: "two" }, { page: 5, text: "three" }])), [[0, 1], [2]]);
});
test("output: selected Markdown/HTML contain only selected pages and use original page labels", async () => {
  writes.clear(); calls.length = 0; const p = plugin(true);
  const blocks = [{ page: 2, kind: "body", text: "second" }, { page: 4, kind: "body", text: "fourth" }];
  const inf = p.buildDocInfo({ name: "paper.pdf", path: "papers/paper.pdf" }, blocks, { totalPages: 5, selectedPages: [2, 4] });
  Object.assign(inf, { doc, blocks }); await p.runFullTranslate(inf);
  assert.deepEqual([...new Set(calls)], [2, 4], "images/operators must not read outside selection");
  const md = [...writes].find(([n]) => n.endsWith(".md")); const html = [...writes].find(([n]) => n.endsWith(".html"));
  assert.match(md[0], /pages 2, 4/); assert.match(md[1], /source_pages: \[2,4\]/);
  assert.match(md[1], /## Page 2/); assert.match(md[1], /## Page 4/); assert.doesNotMatch(md[1], /## Page [135]/);
  assert.match(html[1], /data-page="2"/); assert.match(html[1], /data-page="4"/); assert.doesNotMatch(html[1], /data-page="[135]"/);
  assert.match(html[1], /id="m-p4-b1-1"/);
});
test("output: full selection retains existing filenames and full-page count", async () => {
  writes.clear(); const p = plugin(); const blocks = [{ page: 1, text: "one" }, { page: 5, text: "five" }];
  const inf = p.buildDocInfo({ name: "paper.pdf", path: "paper.pdf" }, blocks, { totalPages: 5 });
  Object.assign(inf, { doc, blocks }); await p.runFullTranslate(inf); assert.equal(writes.has("paper·翻译.md"), true);
});
test("safety: cached cross-page blocks outside the range are rejected before provider call", async () => {
  const p = plugin(); const before = ctx.__sent.length;
  await assert.rejects(p.runFullTranslate({ fileName: "paper.pdf", doc, selectedPages: [2, 4], blocks: [{ page: 2, continuedThroughPage: 3, text: "leak" }] }), /outside the selected/);
  assert.equal(ctx.__sent.length, before);
});
test("batch execution: cancelled jobs release all owned PDFs, including not-yet-started jobs", async () => {
  const p = plugin(), created = [];
  const jobs = [1, 2].map(i => {
    const pdf = { numPages: 5, destroyed: 0, destroy() { this.destroyed++; } }; created.push(pdf);
    return { file: { name: `p${i}.pdf`, path: `p${i}.pdf` }, doc: pdf, ownedDoc: true, blocks: [{ page: 2, text: "body" }], pageNumbers: [2] };
  });
  p.ensureLlmForFull = () => true;
  let ran = 0; p.runFullTranslate = async v => { ran++; assert.deepEqual(plain(v.selectedPages), [2]); return true; };
  await p.runPickedTranslate(jobs); assert.equal(ran, 1); assert.deepEqual(created.map(d => d.destroyed), [1, 1]);
});
test("batch execution: borrowed open-view PDFs are never destroyed", async () => {
  const p = plugin(), borrowed = { numPages: 5, destroy() { throw Error("Must never destroy open-view PDF"); } };
  p.ensureLlmForFull = () => true; p.runFullTranslate = async () => false;
  await p.runPickedTranslate([{ file: { name: "p.pdf", path: "p.pdf" }, doc: borrowed, ownedDoc: false, blocks: [{ page: 2, text: "body" }], pageNumbers: [2] }]);
});
test("batch execution: setup failure still releases transferred owned PDFs", async () => {
  const p = plugin(), owned = { numPages: 5, destroyed: 0, destroy() { this.destroyed++; } };
  p.ensureLlmForFull = () => true; p.ensureProg = () => { throw Error("offline setup failure"); };
  await assert.rejects(p.runPickedTranslate([{ file: { name: "p.pdf", path: "p.pdf" }, doc: owned, ownedDoc: true }]), /setup failure/);
  assert.equal(owned.destroyed, 1);
});

(async () => { for (const { name, fn } of tests) { await fn(); console.log("PASS " + name); } console.log(`ALL PASS (${tests.length} offline PDF selection tests; ${path.basename(sourceFile)})`); })().catch(e => { console.error(e); process.exitCode = 1; });
