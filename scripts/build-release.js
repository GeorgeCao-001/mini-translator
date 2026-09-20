"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const runtimeMarker = "const BUNDLED_RUNTIME = null;";

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8").replace(/^\uFEFF/, "");
}

function removeModuleExport(source, pattern, label) {
  const next = source.replace(pattern, "");
  if (next === source) throw new Error(`无法移除 ${label} 的 CommonJS 导出`);
  return next;
}

function buildOrbModule() {
  let ink = read("src/orbs/ink-water-orb.js")
    .replace(/^['\"]use strict['\"];\s*/, "");
  ink = removeModuleExport(
    ink,
    /\s*module\.exports\s*=\s*\{\s*createInkWaterElement,\s*destroyInkWaterElement\s*\};?\s*$/,
    "ink-water-orb.js"
  );

  let orb = read("src/orbs/translation-orb.js")
    .replace(/^['\"]use strict['\"];\s*/, "")
    .replace(
      /^const\s+\{\s*createInkWaterElement,\s*destroyInkWaterElement\s*\}\s*=\s*require\(["']\.\/ink-water-orb\.js["']\);\s*/,
      ""
    );
  if (/require\(["']\.\/ink-water-orb\.js["']\)/.test(orb)) {
    throw new Error("translation-orb.js 仍依赖外部 ink-water-orb.js");
  }
  const exported = orb.replace(/\bmodule\.exports\s*=\s*\{/, "return {");
  if (exported === orb) throw new Error("无法转换 translation-orb.js 的 CommonJS 导出");
  if (/\bmodule\.exports\b/.test(exported)) {
    throw new Error("translation-orb.js 包含未处理的 CommonJS 导出");
  }

  return `(() => {\n${ink}\n${exported}\n})()`;
}

function buildCommonJsModule(relativePath) {
  const source = read(relativePath).replace(/^[\"']use strict[\"'];\s*/, "");
  return `(() => {
    const module = { exports: {} };
    const exports = module.exports;
    ((module, exports) => {
${source}
    })(module, exports);
    return module.exports;
  })()`;
}

function hardenPdfJsForObsidian(source) {
  // PDF.js uses this helper only when its normal Web Worker cannot start and it
  // falls back to injecting workerSrc as a page script. Mini Translator embeds
  // the worker and supplies a Blob URL, so loading it through a script element
  // is unnecessary and violates the Community Plugin security policy. Use the
  // statically bundled worker module as the safe main-thread fallback instead.
  const upstreamLoader = 'e.loadScript=function loadScript(t,e=!1){return new Promise(((i,s)=>{const n=document.createElement("script");n.src=t;n.onload=function(t){e&&n.remove();i(t)};n.onerror=function(){s(new Error(`Cannot load script at: ${n.src}`))};(document.head||document.documentElement).append(n)}))};';
  const hardenedLoader = "e.loadScript=function loadScript(){loadPdfWorkerFallback();return Promise.resolve()};";
  const occurrences = source.split(upstreamLoader).length - 1;
  if (occurrences !== 1) {
    throw new Error(`PDF.js fake-worker loader changed upstream; expected 1 match, got ${occurrences}`);
  }
  let hardened = source.replace(upstreamLoader, hardenedLoader);
  if (/document\.createElement\(["']script["']\)/.test(hardened)) {
    throw new Error("PDF.js release input still creates script elements dynamically");
  }

  // The generic PDF.js browser bundle also carries three Node-only filesystem
  // branches. Mini Translator always hands PDF.js an in-memory Uint8Array and
  // runs in Obsidian's renderer, so those branches are neither needed nor
  // appropriate in a Community Plugin release. Fail closed if an unexpected
  // environment ever reaches one instead of granting arbitrary file access.
  const nodeFsPattern = /require\(["']fs["']\)/g;
  const nodeFsOccurrences = [...hardened.matchAll(nodeFsPattern)].length;
  if (nodeFsOccurrences !== 3) {
    throw new Error(
      `PDF.js Node filesystem branches changed upstream; expected 3 matches, got ${nodeFsOccurrences}`
    );
  }
  hardened = hardened.replace(nodeFsPattern, "disabledPdfNodeFs()");
  if (/require\(["']fs["']\)/.test(hardened)) {
    throw new Error("PDF.js release input still imports the Node filesystem module");
  }
  return `/* Mini Translator security changes: PDF.js script injection uses a bundled worker fallback; Node filesystem branches fail closed. */\n${hardened}`;
}

function buildRuntime() {
  const pdf = hardenPdfJsForObsidian(read("scripts/vendor/pdfjs/pdf.min.js"));
  const worker = read("scripts/vendor/pdfjs/pdf.worker.js");
  const orb = buildOrbModule();
  const i18n = buildCommonJsModule("src/i18n.js");
  return `const BUNDLED_RUNTIME = (() => {
  let pdfjsLib = null;
  let orbModule = null;
  let pdfWorkerModule = null;
  const disabledPdfNodeFs = () => {
    throw new Error("PDF.js Node filesystem access is disabled in Mini Translator");
  };
  const pdfWorkerBootstrap = (module, exports) => {
${worker}
  };
  const loadPdfWorkerFallback = () => {
    if (!pdfWorkerModule) {
      const workerModule = { exports: {} };
      pdfWorkerBootstrap(workerModule, workerModule.exports);
      pdfWorkerModule = workerModule.exports;
    }
    globalThis.pdfjsWorker = pdfWorkerModule;
    if (globalThis.window && typeof globalThis.window === "object") {
      globalThis.window.pdfjsWorker = pdfWorkerModule;
    }
    return pdfWorkerModule;
  };
  const loadPdfJs = () => {
    if (pdfjsLib) return pdfjsLib;
    const pdfModule = { exports: {} };
    ((module, exports) => {
${pdf}
    })(pdfModule, pdfModule.exports);
    pdfjsLib = pdfModule.exports;
    return pdfjsLib;
  };
  const getPdfWorkerSource = () =>
    \`(\${pdfWorkerBootstrap.toString()})(undefined, undefined);\`;
  const loadOrbModule = () => {
    if (!orbModule) orbModule = ${orb};
    return orbModule;
  };
  const i18n = ${i18n};
  return Object.freeze({ loadPdfJs, getPdfWorkerSource, loadOrbModule, i18n });
})();`;
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function main() {
  const manifest = JSON.parse(read("manifest.json"));
  const versions = JSON.parse(read("versions.json"));
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
    throw new Error("manifest.json 的 version 必须是 x.y.z 格式");
  }
  for (const key of ["id", "name", "version", "minAppVersion", "description", "author", "isDesktopOnly"]) {
    if (!(key in manifest)) throw new Error(`manifest.json 缺少 ${key}`);
  }
  if (manifest.description.length > 250 || !manifest.description.endsWith(".")) {
    throw new Error("manifest.json 的 description 必须不超过 250 字符并以句点结尾");
  }
  if (versions[manifest.version] !== manifest.minAppVersion) {
    throw new Error("versions.json 必须记录当前版本及相同的最低 Obsidian 版本");
  }
  for (const required of ["README.md", "LICENSE", "CHANGELOG.md", "THIRD_PARTY_NOTICES.md"]) {
    if (!fs.existsSync(path.join(root, required))) throw new Error(`仓库缺少 ${required}`);
  }

  const source = read("main.js");
  if (source.split(runtimeMarker).length !== 2) {
    throw new Error("main.js 必须且只能包含一个发布运行时注入标记");
  }
  const bundled = source.replace(runtimeMarker, buildRuntime());
  if (/Mini Translator v3|\[mini-translator\] v3/.test(bundled)) {
    throw new Error("发布 main.js 中仍包含旧的内部版本信息");
  }

  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });
  fs.writeFileSync(path.join(dist, "main.js"), bundled, "utf8");
  fs.copyFileSync(path.join(root, "manifest.json"), path.join(dist, "manifest.json"));
  fs.copyFileSync(path.join(root, "styles.css"), path.join(dist, "styles.css"));

  const syntax = spawnSync(process.execPath, ["--check", path.join(dist, "main.js")], {
    encoding: "utf8",
  });
  if (syntax.status !== 0) {
    process.stderr.write(syntax.stdout || "");
    process.stderr.write(syntax.stderr || "");
    throw new Error("发布 main.js 语法检查失败");
  }

  const assets = ["main.js", "manifest.json", "styles.css"];
  const checksums = assets
    .map((name) => `${sha256(path.join(dist, name))}  ${name}`)
    .join("\n");
  const smoke = spawnSync(process.execPath, [path.join(__dirname, "test-release.js")], {
    encoding: "utf8",
  });
  process.stdout.write(smoke.stdout || "");
  process.stderr.write(smoke.stderr || "");
  if (smoke.status !== 0) throw new Error("发布运行时隔离测试失败");
  const pdfIntegration = spawnSync(
    process.execPath,
    [path.join(__dirname, "test-pdf-runtime.js")],
    { encoding: "utf8" }
  );
  process.stdout.write(pdfIntegration.stdout || "");
  process.stderr.write(pdfIntegration.stderr || "");
  if (pdfIntegration.status !== 0) throw new Error("PDF 发布运行时解析测试失败");
  console.log(`Mini Translator ${manifest.version} release assets built in ${dist}`);
  console.log(checksums);
}

main();
