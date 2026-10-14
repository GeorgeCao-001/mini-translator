"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const mainFile = path.join(root, "dist", "main.js");
if (!fs.existsSync(mainFile)) {
  throw new Error("缺少 dist/main.js；请先运行 node scripts/build-release.js");
}
const expectedAssets = ["main.js", "manifest.json", "styles.css"];
const actualAssets = fs.readdirSync(path.dirname(mainFile)).sort();
if (JSON.stringify(actualAssets) !== JSON.stringify(expectedAssets)) {
  throw new Error(`dist 必须且只能包含 ${expectedAssets.join(", ")}；当前为 ${actualAssets.join(", ")}`);
}

class FakeComponent {}
const obsidian = new Proxy(
  {},
  {
    get(_target, key) {
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
        ].includes(key)
      ) {
        return class extends FakeComponent {};
      }
      return () => {};
    },
  }
);

const unexpectedRequires = [];
const releaseRequire = (request) => {
  if (request === "obsidian") return obsidian;
  unexpectedRequires.push(request);
  throw new Error(`发布构建意外请求外部模块：${request}`);
};

class FakeURL extends URL {
  static createObjectURL() {
    return "blob:mini-translator-release-test";
  }

  static revokeObjectURL() {}
}

class FakeBlob {
  constructor(parts, options) {
    this.parts = parts;
    this.type = options?.type || "";
  }
}

const sandbox = {
  window: {},
  document: {},
  console,
  require: releaseRequire,
  module: { exports: {} },
  exports: {},
  URL: FakeURL,
  Blob: FakeBlob,
  TextDecoder,
  TextEncoder,
  Uint8Array,
  ArrayBuffer,
  atob: (value) => Buffer.from(value, "base64").toString("binary"),
  btoa: (value) => Buffer.from(value, "binary").toString("base64"),
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
};
vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } });
const source = fs.readFileSync(mainFile, "utf8");
// The release bundle must not retain the old project-owned Node filesystem
// fallback. PDF.js itself is embedded below and is audited separately as a
// third-party component; this check only guards Mini Translator's deleted path.
if (
  source.includes('const fs = require("fs");') ||
  source.includes('fs.readFileSync(c, "utf8")') ||
  source.includes("function pluginFileCandidates")
) {
  throw new Error("release bundle still contains the removed project filesystem fallback");
}
if (!source.includes("lib.getDocument({ data, isEvalSupported: false })")) {
  throw new Error("release bundle does not disable PDF.js generated-function optimizations");
}

// The upstream PDF.js inputs are kept unmodified under scripts/vendor. The
// release hardening must remove its fake-worker script injection and disable
// its unused Node-only filesystem branches, and genuinely remove generated
// functions/evaluated loaders rather than hiding them from a scanner.
const pdfSource = fs.readFileSync(
  path.join(root, "scripts", "vendor", "pdfjs", "pdf.min.js"),
  "utf8"
);
const workerSource = fs.readFileSync(
  path.join(root, "scripts", "vendor", "pdfjs", "pdf.worker.js"),
  "utf8"
);
if (/(?:document\.)?createElement\(["']script["']\)/.test(source)) {
  throw new Error("release bundle still creates script elements dynamically");
}
if (!source.includes("PDF.js script injection uses a bundled worker fallback")) {
  throw new Error("release bundle is missing the PDF.js security modification notice");
}
if (/require\(["']fs["']\)/.test(source)) {
  throw new Error("release bundle still imports the Node filesystem module");
}
if (!source.includes("PDF.js Node filesystem access is disabled in Mini Translator")) {
  throw new Error("release bundle is missing the fail-closed PDF.js filesystem guard");
}
for (const pattern of [/\bnew\s+Function\s*\(/, /\beval\s*\(/]) {
  if (pattern.test(source)) throw new Error("release bundle still generates or evaluates JavaScript");
}
for (const input of [pdfSource, workerSource]) {
  const notice = input.slice(0, input.indexOf("!function webpackUniversalModuleDefinition"));
  if (!notice || !source.includes(notice)) throw new Error("PDF.js upstream license notice was lost");
}
const releaseCss = fs.readFileSync(path.join(root, "dist", "styles.css"), "utf8");
const cssWarningPatterns = [
  ["!important", /!important\b/],
  ["text-indent", /\btext-indent\s*:/],
  ["clip-path", /\b(?:-webkit-)?clip-path\s*:/],
  ["mjx-container type selector", /(^|[,\s>+~])mjx-container(?=[\s.#[:]|$)/m],
  ["multicolumn declarations", /(?:^|[;{\s])(?:columns|column-(?:gap|count|width|span|fill|rule(?:-color|-style|-width)?))\s*:/m],
];
for (const [label, pattern] of cssWarningPatterns) {
  if (pattern.test(releaseCss)) {
    throw new Error(`release stylesheet still contains scanner warning pattern: ${label}`);
  }
}
console.log("PASS dynamic scripts and Node filesystem access removed from the release");
console.log("PASS generated functions and evaluated loaders removed from main and worker");
console.log("PASS known Obsidian CSS warning patterns removed from the release");
vm.runInContext(
  `${source}\n;globalThis.__releaseTest = { loadPdfJs, loadOrbModule, BUNDLED_RUNTIME };`,
  sandbox,
  { filename: mainFile }
);

const runtime = sandbox.__releaseTest.BUNDLED_RUNTIME;
if (!runtime || typeof runtime.loadPdfJs !== "function") {
  throw new Error("发布构建没有注入 PDF 运行时");
}
if (
  typeof runtime.i18n?.setUiLanguage !== "function" ||
  runtime.i18n.setUiLanguage("en") !== "en" ||
  runtime.i18n.t("common.cancel") !== "Cancel"
) {
  throw new Error("发布构建没有正确注入英文界面字典");
}
if (
  runtime.modelConfig?.resolveModelsUrl(
    "https://example.invalid/v1/chat/completions"
  ) !== "https://example.invalid/v1/models" ||
  runtime.modelConfig?.profilesFromStoredSettings({ llmProfiles: [] }, "Default").length !== 0
) {
  throw new Error("发布构建没有正确注入模型配置运行时");
}
if (
  JSON.stringify(runtime.sourceOrder?.attemptOrder("B", ["C", "A", "B"], ["A", "C"], ["A", "B", "C"])) !==
  JSON.stringify(["B", "C", "A"])
) {
  throw new Error("发布构建没有正确注入翻译源顺序运行时");
}
if (typeof runtime.sourcePicker?.createSourcePicker !== "function") {
  throw new Error("发布构建没有正确注入可拖动翻译源下拉控件");
}
if (typeof runtime.selectionMenu?.registerSelectionTranslationMenu !== "function") {
  throw new Error("发布构建没有正确注入选区右键菜单模块");
}
if (runtime.popupFont?.popupFontStyles({ popupTargetFontSize: 20 }).target !== "20px") {
  throw new Error("发布构建没有正确注入悬浮窗字号模块");
}
if (runtime.getPdfWorkerSource().length < 1_000_000) {
  throw new Error("发布构建中的 PDF worker 不完整");
}
new vm.Script(runtime.getPdfWorkerSource(), { filename: "embedded-pdf.worker.js" });
const workerSandbox = {
  console,
  TextDecoder,
  TextEncoder,
  Uint8Array,
  ArrayBuffer,
  structuredClone,
  ReadableStream,
  setTimeout,
  clearTimeout,
};
vm.createContext(workerSandbox, { codeGeneration: { strings: false, wasm: false } });
vm.runInContext(runtime.getPdfWorkerSource(), workerSandbox, {
  filename: "embedded-pdf.worker.js",
});
if (typeof workerSandbox.pdfjsWorker?.WorkerMessageHandler !== "function") {
  throw new Error("Blob worker source did not export WorkerMessageHandler");
}

const pdf = sandbox.__releaseTest.loadPdfJs({});
if (typeof pdf?.getDocument !== "function") {
  throw new Error("内嵌 PDF.js 没有正确导出 getDocument");
}
const loadScriptBody = Function.prototype.toString.call(pdf.loadScript);
if (!loadScriptBody.includes("loadPdfWorkerFallback") || loadScriptBody.includes("createElement")) {
  throw new Error("PDF.js fake-worker script loader was not disabled");
}
if (pdf.GlobalWorkerOptions.workerSrc !== "blob:mini-translator-release-test") {
  throw new Error("内嵌 PDF worker 没有设置为 Blob URL");
}

const orb = sandbox.__releaseTest.loadOrbModule({});
if (
  typeof orb?.TranslationOrbController !== "function" ||
  typeof orb?.createOrbElement !== "function"
) {
  throw new Error("内嵌悬浮球模块导出不完整");
}
if (unexpectedRequires.length) {
  throw new Error(`发布构建仍依赖外部模块：${unexpectedRequires.join(", ")}`);
}

console.log("PASS self-contained release runtime (i18n, PDF.js, worker, translation orb)");
