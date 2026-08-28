// v3.0.1 行为测试：stub 'obsidian' 后加载真实 main.js 源码，验证关键函数
const Module = require("module");
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "obsidian") {
    class FakeComponent {}
    return new Proxy(
      {},
      {
        get: (t, k) => {
          if (
            [
              "Plugin",
              "Component",
              "ItemView",
              "Modal",
              "PluginSettingTab",
              "Setting",
              "DropdownComponent",
              "MarkdownView",
            ].includes(k)
          )
            return class extends FakeComponent {};
          return () => {};
        },
      }
    );
  }
  return origLoad.call(this, request, parent, isMain);
};

const fs = require("fs");
const vm = require("vm");
const src = fs.readFileSync(__dirname + "/main.js", "utf8");
const sandbox = { window: {}, document: {}, console, Notice: class {}, require, module: { exports: {} }, atob: (s) => Buffer.from(s, "base64").toString("binary"), btoa: (s) => Buffer.from(s, "binary").toString("base64") };
vm.createContext(sandbox);
vm.runInContext(src + "\n;__exports = { normalizeMathDelims, groupIntoBatches, parseBatchResponse, FULL_CONCURRENCY, loadPdfJs };", sandbox);
const X = sandbox.__exports;

let fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) console.log("PASS", name);
  else {
    fail++;
    console.log("FAIL", name, "\n  got:", g, "\n  want:", w);
  }
}

// --- normalizeMathDelims：\[ \] → $$..$$（带空行隔离） ---
eq(
  "display-delim",
  X.normalizeMathDelims("text \\[\ny = mx+b\n\\] tail"),
  "text \n\n$$\ny = mx+b\n$$\n\n tail"
);
// \( \) → $..$
eq("inline-delim", X.normalizeMathDelims("a \\(x^2\\) b"), "a $x^2$ b");
// 相邻 $$..$$$$..$$ 粘连被拆开（闭合与开定界符之间补空行）
eq("junction-split", X.normalizeMathDelims("$$a$$$$b$$"), "$$a$$\n\n$$b$$");
eq("noop-plain", X.normalizeMathDelims("no math here"), "no math here");
eq("empty-safe", X.normalizeMathDelims(""), "");

// 已是 $/$$ 的内容不被二次破坏
eq(
  "dollar-preserved",
  X.normalizeMathDelims("we use $\\ell_2$ norm"),
  "we use $\\ell_2$ norm"
);

// --- groupIntoBatches：全部块都进批次（不再按 isSkippableBlock 过滤） ---
const blocks = [
  { text: "short" },
  { text: "x".repeat(30) }, // 字母占比 <0.35 → 旧逻辑会跳过
  { text: "normal english sentence with many letters here" },
];
eq("all-blocks-batched", X.groupIntoBatches(blocks).length >= 1, true);
eq(
  "all-blocks-counted",
  X.groupIntoBatches(blocks).reduce((n, b) => n + b.length, 0),
  blocks.length
);

// 大批量切分仍受 8 块/批上限约束（v3.0.2 上调）
const many = Array.from({ length: 20 }, (_, i) => ({ text: `block ${i} some english words` }));
eq("cap-8-per-batch", Math.max(...X.groupIntoBatches(many).map((b) => b.length)) <= 8, true);
eq("concurrency-set", X.FULL_CONCURRENCY, 3);

// --- 独立浏览器进度窗已按用户要求移除（v3.0.5），相关页面构建测试一并删除 ---

// --- loadPdfJs：模拟 Obsidian 的 require 锚定（相对路径锚到不存在的应用根）也能加载成功 ---
const nodePath = require("path");
const FAKE_APP_ROOT = nodePath.join(process.cwd(), "nonexistent-app-root");
const sandbox2 = {
  window: {},
  document: {},
  console,
  module: { exports: {} },
  setInterval,
  clearInterval,
  setTimeout,
  clearTimeout,
  Blob,
  URL: { createObjectURL: () => "blob:test" },
  // 模拟 Obsidian：相对 require 解析到应用根（那里没有 lib/），裸模块正常
  require: (r) =>
    r.startsWith(".") ? require(nodePath.join(FAKE_APP_ROOT, r)) : require(r),
};
vm.createContext(sandbox2);
vm.runInContext(src + "\n;__exports = { loadPdfJs, loadOrbModule };", sandbox2);
const pluginStub = {
  manifest: { dir: nodePath.join(".obsidian", "plugins", "mini-translator") },
  app: {
    vault: {
      // 插件目录在 <vault>/.obsidian/plugins/mini-translator，往上三级才是 vault 根
      adapter: { basePath: nodePath.resolve(process.cwd(), "..", "..", "..") },
    },
  },
};
const lib = sandbox2.__exports.loadPdfJs(pluginStub);
eq("pdfjs-loads-via-anchors", !!lib && typeof lib.getDocument === "function", true);
eq("worker-src-set", !!String(lib.GlobalWorkerOptions.workerSrc || "").length, true);

// --- loadOrbModule：纯 CJS 的 translation-orb.js 经绝对路径锚点能 require 出导出 ---
const orbMod = sandbox2.__exports.loadOrbModule(pluginStub);
eq(
  "orb-module-loads",
  !!orbMod && typeof orbMod.TranslationOrbController === "function" && typeof orbMod.createDefaultSkinRegistry === "function",
  true
);

// --- parseBatchResponse：⟦MTi⟧ 后的内容不丢 ---
const out = "⟦EN1⟧ fixed one ⟦ZH1⟧ 第一段 ⟦MT2⟧ 第二段直出";
const parsed = X.parseBatchResponse(out, 2, true);
eq("mt-marker-zh", parsed[1].zh, "第二段直出");
eq("en-side-ok", parsed[0].en, "fixed one");

console.log(fail ? `\n${fail} FAILED` : "\nALL PASS");
process.exit(fail ? 1 : 0);
