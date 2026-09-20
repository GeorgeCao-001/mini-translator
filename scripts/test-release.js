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
vm.createContext(sandbox);
const source = fs.readFileSync(mainFile, "utf8");
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
if (runtime.getPdfWorkerSource().length < 1_000_000) {
  throw new Error("发布构建中的 PDF worker 不完整");
}
new vm.Script(runtime.getPdfWorkerSource(), { filename: "embedded-pdf.worker.js" });

const pdf = sandbox.__releaseTest.loadPdfJs({});
if (typeof pdf?.getDocument !== "function") {
  throw new Error("内嵌 PDF.js 没有正确导出 getDocument");
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
