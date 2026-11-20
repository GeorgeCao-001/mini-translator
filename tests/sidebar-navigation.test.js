"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
function load() {
  const source = process.argv[2];
  if (!source) return require("../src/sidebar-navigation");
  const file = path.resolve(root, source);
  const sandbox = { module: { exports: {} }, require: id => {
    if (id === "obsidian") return { Plugin: class {}, ItemView: class {}, Modal: class {}, PluginSettingTab: class {} };
    throw Error(id);
  }};
  vm.runInNewContext(fs.readFileSync(file, "utf8") + "\n;globalThis.nav = SIDEBAR_NAV;", sandbox);
  return sandbox.nav;
}
const nav = load();
const plain = value => JSON.parse(JSON.stringify(value));
const md = (path, basename) => ({ path, basename, name: basename + ".md", extension: "md" });
const pdf = (path, name) => ({ path, name, extension: "pdf" });
const note = md("Notes/Paper.md", "Paper");
const paper = pdf("Papers/One & Two.pdf", "One & Two.pdf");
function fixture(files = [note, paper], contents = "Intro\nTarget paragraph.\nOutro") {
  const actions = [], leaves = [];
  const ws = {
    getLeavesOfType: () => leaves,
    openLinkText: async (...args) => { actions.push(["openLinkText", ...args]); },
    getLeaf(kind) {
      actions.push(["new", kind]);
      return {
        view: {},
        async openFile(file, options) {
          actions.push(["openFile", file.path, options.active]);
          this.view = { file, editor: {
            getValue: () => contents,
            offsetToPos: offset => ({ line: 0, ch: offset }),
            scrollIntoView: (range, center) => actions.push(["scroll", range.from.ch, range.to.ch, center]),
          } };
          leaves.push(this);
        },
      };
    },
    revealLeaf: async leaf => actions.push(["reveal", leaf.view.file.path]),
  };
  const vault = { getFileByPath: path => files.find(file => file.path === path), getFiles: () => files, cachedRead: async () => contents };
  return { app: { workspace: ws, vault }, actions, leaves };
}

(async () => {
  const settingCalls = [];
  assert.equal(nav.openPluginSettings({ setting: { open: () => settingCalls.push("open"),
    openTabById: id => settingCalls.push(id) } }, "mini-translator"), true);
  assert.deepEqual(settingCalls, ["open", "mini-translator"]);
  assert.equal(nav.openPluginSettings({ setting: {} }, "mini-translator"), false);

  const editor = { getCursor: () => ({}), getRange: () => "  Target paragraph.  ", posToOffset: () => 4 };
  assert.deepEqual(plain(nav.captureMarkdownSource(note, editor, "Target paragraph.")), {
    path: note.path, offset: 6, quote: "Target paragraph.",
  });
  assert.deepEqual(plain(nav.captureMarkdownSource(note, editor, "Different selection")), {
    path: note.path, quote: "Different selection",
  });
  assert.equal(nav.captureMarkdownSource(paper, editor, "text"), null);
  assert.equal(nav.captureMarkdownSource(note, null, "a".repeat(900)).quote.length, 512);

  const dom = {};
  const page = { ownerDocument: dom, getAttribute: () => "7" };
  const node = { nodeType: 3, parentElement: { closest: () => page } };
  const frame = { contentDocument: dom };
  const other = pdf("Archive/Other.pdf", "Other.pdf");
  paper.stat = { mtime: 123, size: 2000 };
  const native = { child: { getTextSelectionRangeStr: element => {
    assert.equal(element, page);
    return "3,0,7,9";
  } } };
  const ws = { getLeavesOfType(type) {
    assert.equal(type, "pdf");
    return [
      { view: { file: other, containerEl: { contains: () => false } } },
      { view: { file: paper, viewer: native, containerEl: { contains: node => [page, frame].includes(node) || node.parentElement?.closest() === page } } },
    ];
  } };
  assert.deepEqual(plain(nav.captureDomSource(ws, node, "PDF quote")), { path: paper.path, page: 7 });
  assert.deepEqual(plain(nav.captureDomSource(ws, node, "PDF quote", frame)), { path: paper.path, page: 7 });
  const exact = nav.captureDomSource(ws, node, "PDF quote", undefined, node);
  assert.deepEqual(plain(exact), { path: paper.path, page: 7, selection: "3,0,7,9", mtime: 123, size: 2000 });
  const otherPage = { nodeType: 1, closest: () => ({}) };
  assert.deepEqual(plain(nav.captureDomSource(ws, node, "Cross-page", undefined, otherPage)), { path: paper.path, page: 7 });
  native.child.getTextSelectionRangeStr = () => "0,0,0,0&invalid";
  assert.deepEqual(plain(nav.captureDomSource(ws, node, "Unavailable exact PDF selection", undefined, node)), { path: paper.path, page: 7 });
  const reading = { nodeType: 1 };
  assert.deepEqual(plain(nav.captureDomSource({ getLeavesOfType: type =>
    type === "pdf" ? [] : [{ view: { file: note, containerEl: { contains: n => n === reading }, getMode: () => "preview", editor } }]
  }, reading, "Target paragraph.")), { path: note.path, quote: "Target paragraph." });

  const f = fixture([note, paper, pdf("Archive/One & Two.pdf", paper.name)]);
  assert.equal(await nav.openHistorySource(f.app, { file: paper.name, page: 3, locator: { path: paper.path, page: 7 } }), "located");
  assert.deepEqual(f.actions, [["openLinkText", paper.path + "#page=7", "", false]]);
  const exactPdf = fixture();
  assert.equal(await nav.openHistorySource(exactPdf.app, { locator: exact }), "located");
  assert.deepEqual(exactPdf.actions, [["openLinkText", paper.path + "#page=7&selection=3,0,7,9", "", false]]);
  assert.equal(await nav.openHistorySource(exactPdf.app, { locator: { ...exact, mtime: 100 } }), "located");
  assert.deepEqual(exactPdf.actions.at(-1), ["openLinkText", paper.path + "#page=7", "", false]);
  const rejectedSelection = fixture();
  rejectedSelection.app.workspace.openLinkText = async path => {
    if (path.includes("&selection=")) throw Error("unsupported selection");
    rejectedSelection.actions.push(path);
  };
  assert.equal(await nav.openHistorySource(rejectedSelection.app, { locator: exact }), "located");
  assert.deepEqual(rejectedSelection.actions, [paper.path + "#page=7"]);
  const legacy = fixture();
  assert.equal(await nav.openHistorySource(legacy.app, { file: paper.name, page: "2" }), "located");
  assert.deepEqual(legacy.actions, [["openLinkText", paper.path + "#page=2", "", false]]);
  assert.equal(await nav.openHistorySource(f.app, { file: paper.name, page: 3 }), "ambiguous");
  assert.equal(await nav.openHistorySource(f.app, { file: paper.name, locator: { path: "Deleted/Paper.pdf" } }), "missing");
  assert.equal(await nav.openHistorySource(f.app, { file: "" }), "no_source");
  assert.equal(f.actions.length, 1, "Ambiguous and missing entries must not open any file");
  const noPage = fixture();
  assert.equal(await nav.openHistorySource(noPage.app, { file: paper.name, page: "2&bad" }), "file_only");
  assert.deepEqual(noPage.actions, [["new", "tab"], ["openFile", paper.path, true], ["reveal", paper.path]]);

  const mdJump = fixture();
  // Text moved past the recorded position; unique literal text still works.
  assert.equal(await nav.openHistorySource(mdJump.app, { locator: { path: note.path, quote: "Target paragraph.", offset: 12 } }), "located");
  assert.deepEqual(mdJump.actions, [["new", "tab"], ["openFile", note.path, true], ["reveal", note.path], ["scroll", 6, 23, true]]);
  assert.equal(await nav.openHistorySource(mdJump.app, { file: note.basename, pairs: [{ en: "Target paragraph." }] }), "located");
  assert.equal(mdJump.actions.filter(([type]) => type === "new").length, 1, "An already open note reuses its tab");
  const preview = mdJump.leaves[0];
  preview.view.getMode = () => "preview";
  preview.getViewState = () => ({ type: "markdown", state: { file: note.path, mode: "preview", pinned: true } });
  const viewStates = [];
  preview.setViewState = state => { viewStates.push(state); };
  assert.equal(await nav.openHistorySource(mdJump.app, { locator: { path: note.path, quote: "No text" } }), "file_only");
  assert.equal(viewStates.length, 0, "Never switch reading mode for a failed match");
  assert.equal(await nav.openHistorySource(mdJump.app, { locator: { path: note.path, quote: "Target paragraph." } }), "located");
  assert.deepEqual(plain(viewStates), [{ type: "markdown", state: { file: note.path, mode: "source", pinned: true } }]);
  const duplicate = fixture([note], "Repeated Repeated");
  assert.equal(await nav.openHistorySource(duplicate.app, { locator: { path: note.path, quote: "Repeated", offset: 4 } }), "file_only");
  assert.equal(await nav.openHistorySource(duplicate.app, { locator: { path: note.path, quote: "Repeated", offset: 9 } }), "located");
  assert.deepEqual(duplicate.actions.at(-1), ["scroll", 9, 17, true]);

  console.log("PASS sidebar navigation: settings, source capture, exact paths, PDF pages, legacy history, Markdown find/reveal, safe fallbacks");
})().catch(error => { console.error(error); process.exitCode = 1; });
