"use strict";

// Audited build-time changes for the pinned PDF.js 3.11.174 inputs. The vendor
// files stay untouched. Exact matches deliberately fail when upstream changes:
// security transformations must be reviewed rather than silently skipped.
function replaceOnce(source, original, replacement, label) {
  const count = source.split(original).length - 1;
  if (count !== 1) {
    throw new Error(`PDF.js ${label} changed upstream; expected 1 match, got ${count}`);
  }
  return source.replace(original, replacement);
}

function disableCapabilityProbe(source) {
  return replaceOnce(
    source,
    'static get isEvalSupported(){return shadow(this,"isEvalSupported",function isEvalSupported(){try{new Function("");return!0}catch{return!1}}())}',
    'static get isEvalSupported(){return shadow(this,"isEvalSupported",!1)}',
    "generated-code capability probe"
  );
}

function assertNoDynamicCode(source) {
  if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(source)) {
    throw new Error("PDF.js hardened output still contains dynamic code execution");
  }
}

function sanitizePdfFontMatrix(matrix, fallback) {
  return Array.isArray(matrix) && matrix.length === 6 &&
    matrix.every((value) => typeof value === "number" && Number.isFinite(value))
    ? matrix : fallback;
}

function hardenPdfJsForObsidian(source) {
  let hardened = disableCapabilityProbe(source);
  hardened = replaceOnce(
    hardened,
    'e.loadScript=function loadScript(t,e=!1){return new Promise(((i,s)=>{const n=document.createElement("script");n.src=t;n.onload=function(t){e&&n.remove();i(t)};n.onerror=function(){s(new Error(`Cannot load script at: ${n.src}`))};(document.head||document.documentElement).append(n)}))};',
    "e.loadScript=function loadScript(){loadPdfWorkerFallback();return Promise.resolve()};",
    "fake-worker script loader"
  );
  // No evaluated require or caller-provided worker path: both browser and
  // unexpected Node fallback environments receive our statically bundled module.
  hardened = replaceOnce(
    hardened,
    'const loader=async()=>{const mainWorkerMessageHandler=this._mainThreadWorkerMessageHandler;if(mainWorkerMessageHandler)return mainWorkerMessageHandler;if(_util.isNodeJS&&"function"==typeof require){const worker=eval("require")(this.workerSrc);return worker.WorkerMessageHandler}await(0,_display_utils.loadScript)(this.workerSrc);return window.pdfjsWorker.WorkerMessageHandler};',
    'const loader=async()=>{const mainWorkerMessageHandler=this._mainThreadWorkerMessageHandler;if(mainWorkerMessageHandler)return mainWorkerMessageHandler;return loadPdfWorkerFallback().WorkerMessageHandler};',
    "evaluated Node worker loader"
  );
  // CVE-2024-4367 exploited string compilation of glyph commands. Remove that
  // optimization entirely, retaining the upstream non-code-generating drawer.
  // This follows the no-generated-glyph-code direction of Mozilla PR #18015,
  // while preserving the older command format used by our pinned worker.
  hardened = replaceOnce(
    hardened,
    'if(this.isEvalSupported&&s.FeatureTest.isEvalSupported){const t=[];for(const e of i){const i=void 0!==e.args?e.args.join(","):"";t.push("c.",e.cmd,"(",i,");\\n")}return this.compiledGlyphs[e]=new Function("c","size",t.join(""))}',
    "",
    "generated glyph drawer"
  );
  const fsPattern = /require\(["']fs["']\)/g;
  const fsCount = [...hardened.matchAll(fsPattern)].length;
  if (fsCount !== 3) {
    throw new Error(`PDF.js Node filesystem branches changed upstream; expected 3 matches, got ${fsCount}`);
  }
  hardened = hardened.replace(fsPattern, "disabledPdfNodeFs()");
  if (/createElement\(["']script["']\)|require\(["']fs["']\)/.test(hardened)) {
    throw new Error("PDF.js hardened output still injects scripts or imports the filesystem");
  }
  assertNoDynamicCode(hardened);
  return "/* Mini Translator security changes: PDF.js script injection uses a bundled worker fallback; Node filesystem branches fail closed; glyph drawing never compiles JavaScript. */\n" + hardened;
}

function hardenPdfWorkerForObsidian(source) {
  let hardened = disableCapabilityProbe(source);
  // PDF.js already supplies a PostScript interpreter. Keep its parsing,
  // execution, range clipping and caching rather than compiling JavaScript.
  hardened = replaceOnce(
    hardened,
    'if(t&&n.FeatureTest.isEvalSupported){const e=(new PostScriptCompiler).compile(l,s,o);if(e)return new Function("src","srcOffset","dest","destOffset",e)}',
    "",
    "generated PostScript evaluator"
  );
  // Backport the FontMatrix validation from Mozilla PR #18015 (also reject
  // non-finite values). Valid numeric six-element matrices remain unchanged.
  hardened = replaceOnce(
    hardened,
    'fontMatrix:t.getArray("FontMatrix")||r.FONT_IDENTITY_MATRIX',
    'fontMatrix:sanitizePdfFontMatrix(t.getArray("FontMatrix"),r.FONT_IDENTITY_MATRIX)',
    "font-matrix validation"
  );
  assertNoDynamicCode(hardened);
  return "/* Mini Translator security changes: PDF.js PDF functions use the interpreter; font matrices are validated; dynamic code generation is unavailable. */\n" +
    sanitizePdfFontMatrix.toString() + "\n" + hardened;
}

module.exports = { hardenPdfJsForObsidian, hardenPdfWorkerForObsidian, sanitizePdfFontMatrix };
