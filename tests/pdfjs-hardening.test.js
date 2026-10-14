"use strict";

const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { hardenPdfJsForObsidian, hardenPdfWorkerForObsidian, sanitizePdfFontMatrix } =
  require("../scripts/pdfjs-hardening.js");
const root = path.resolve(__dirname, "..");
const pdfInput = fs.readFileSync(path.join(root, "scripts/vendor/pdfjs/pdf.min.js"), "utf8");
const workerInput = fs.readFileSync(path.join(root, "scripts/vendor/pdfjs/pdf.worker.js"), "utf8");
const pdfSource = hardenPdfJsForObsidian(pdfInput);
const workerSource = hardenPdfWorkerForObsidian(workerInput);
let passed = 0;
function test(label, run) {
  run();
  passed++;
  console.log(`PASS ${label}`);
}

test("sidebar spacing keeps the same Flex row/column gaps without multicolumn declarations", () => {
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  const header = /\.mini-panel-header\s*\{([^}]+)\}/.exec(css)?.[1];
  assert.match(header, /display:\s*flex;/);
  assert.match(header, /flex-wrap:\s*wrap;/);
  assert.match(header, /gap:\s*8px 12px;/);
  assert.doesNotMatch(css, /\bcolumn-gap\s*:/);
});

test("pinned upstream inputs are not rewritten; notices remain in hardened output", () => {
  assert.equal(pdfInput, fs.readFileSync(path.join(root, "scripts/vendor/pdfjs/pdf.min.js"), "utf8"));
  assert.equal(workerInput, fs.readFileSync(path.join(root, "scripts/vendor/pdfjs/pdf.worker.js"), "utf8"));
  for (const [input, output] of [[pdfInput, pdfSource], [workerInput, workerSource]]) {
    assert.ok(output.includes(input.slice(0, input.indexOf("!function webpackUniversalModuleDefinition"))));
    assert.match(output, /Copyright 2023 Mozilla Foundation/);
    assert.match(output, /Apache License/);
    assert.doesNotMatch(output, /\beval\s*\(|\bnew\s+Function\s*\(/);
    new vm.Script(output);
  }
});
test("changed/missing/duplicate upstream security sites fail the build closed", () => {
  for (const [source, harden, original] of [
    [pdfInput, hardenPdfJsForObsidian, 'static get isEvalSupported(){'],
    [pdfInput, hardenPdfJsForObsidian, 'const loader=async()=>'],
    [pdfInput, hardenPdfJsForObsidian, 'if(this.isEvalSupported&&s.FeatureTest.isEvalSupported)'],
    [pdfInput, hardenPdfJsForObsidian, 'e.loadScript=function loadScript(t,e=!1)'],
    [workerInput, hardenPdfWorkerForObsidian, 'if(t&&n.FeatureTest.isEvalSupported)'],
    [workerInput, hardenPdfWorkerForObsidian, 'fontMatrix:t.getArray("FontMatrix")'],
  ]) assert.throws(() => harden(source.replace(original, "changedUpstream")), /expected 1 match/);
  assert.throws(() => hardenPdfJsForObsidian(pdfInput + pdfInput), /got 2/);
  assert.throws(() => hardenPdfJsForObsidian(pdfInput.replace('require("fs")', "changedFs")), /expected 3 matches/);
  assert.throws(() => hardenPdfJsForObsidian(pdfInput + '\nnew Function("unexpected")'), /dynamic code execution/);
  assert.throws(() => hardenPdfWorkerForObsidian(workerInput + '\neval("unexpected")'), /dynamic code execution/);
});

// Only test copies expose upstream internal exports; production exports and
// vendor inputs are unchanged. These IDs are specific to the pinned version.
function loadInternal(source, marker) {
  const calls = [];
  function denyCode(...args) {
    calls.push(args);
    throw new Error("Dynamic code execution is forbidden in this security test");
  }
  denyCode.prototype = Function.prototype;
  const fallback = { WorkerMessageHandler() {} };
  const sandbox = {
    console, TextDecoder, TextEncoder, Uint8Array, ArrayBuffer, ReadableStream,
    structuredClone, setTimeout, clearTimeout,
    module: { exports: {} }, exports: {}, window: {},
    Function: denyCode, eval: denyCode,
    document: { createElement() { throw new Error("Unexpected dynamic DOM/script loading"); } },
    loadPdfWorkerFallback() { return fallback; },
    disabledPdfNodeFs() { throw new Error("Filesystem access is forbidden"); },
    require() { throw new Error("External module loading is forbidden"); },
  };
  vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } });
  assert.equal(source.split(marker).length, 2);
  vm.runInContext(source.replace(marker, "globalThis.__modules=__w_pdfjs_require__;" + marker), sandbox);
  return { sandbox, calls, fallback, modules: sandbox.__modules };
}
const main = loadInternal(pdfSource, "return __webpack_exports__");
const worker = loadInternal(workerSource, "return a})()));");
test("main and worker capability checks are false without trying to compile code", () => {
  assert.equal(main.modules(1).FeatureTest.isEvalSupported, false);
  assert.equal(worker.modules(2).FeatureTest.isEvalSupported, false);
  assert.equal(main.calls.length + worker.calls.length, 0);
});
test("FontMatrix backport preserves valid values and rejects executable/non-finite values", () => {
  const fallback = [0.001, 0, 0, 0.001, 0, 0];
  const valid = [0.002, 0, 0, 0.002, -1, 2];
  assert.equal(sanitizePdfFontMatrix(valid, fallback), valid);
  for (const invalid of [null, {}, [], [1, 2], [1, 0, 0, 1, 0, NaN],
    [1, 0, 0, 1, Infinity, 0], [1, 0, 0, 1, 0, "0);globalThis.__injected=1;//"]]) {
    assert.equal(sanitizePdfFontMatrix(invalid, fallback), fallback);
    assert.equal(worker.sandbox.sanitizePdfFontMatrix(invalid, fallback), fallback);
  }
});
test("glyph rendering/caching/scaling work even if callers request generated code", () => {
  const { FontFaceObject } = main.modules(9);
  const commands = [
    { cmd: "save" }, { cmd: "transform", args: [0.001, 0, 0, 0.001, 0, 0] },
    { cmd: "scale", args: ["size", "-size"] }, { cmd: "moveTo", args: [1, 2] },
    { cmd: "lineTo", args: [3, 4] }, { cmd: "quadraticCurveTo", args: [1, 2, 3, 4] },
    { cmd: "bezierCurveTo", args: [1, 2, 3, 4, 5, 6] }, { cmd: "translate", args: [2, 3] },
    { cmd: "restore" },
  ];
  const font = new FontFaceObject({ loadedName: "test" }, { isEvalSupported: true });
  const ops = [];
  const ctx = Object.fromEntries(commands.map(({ cmd }) => [cmd, (...args) => ops.push([cmd, ...args])]));
  const objects = { get(key) { assert.equal(key, "test_path_A"); return commands; } };
  const draw = font.getPathGenerator(objects, "A");
  draw(ctx, 12);
  draw(ctx, 20);
  assert.equal(font.getPathGenerator(objects, "A"), draw);
  assert.deepEqual(ops[2], ["scale", 12, -12]);
  assert.deepEqual(ops[commands.length + 2], ["scale", 20, -20]);
  assert.deepEqual(ops[4], ["lineTo", 3, 4]);
  assert.equal(ops.length, commands.length * 2);
  assert.equal(main.calls.length, 0);
});
test("CVE-style glyph arguments remain data, never executable source", () => {
  const { FontFaceObject } = main.modules(9);
  const poison = "0);globalThis.__injected=1;//";
  const font = new FontFaceObject({ loadedName: "malicious" }, { isEvalSupported: true });
  let actual;
  const draw = font.getPathGenerator({ get() {
    return [{ cmd: "transform", args: [1, 0, 0, 1, 0, poison] }];
  } }, "A");
  draw({ transform(...args) { actual = args; } }, 12);
  assert.equal(actual[5], poison);
  assert.equal(main.sandbox.__injected, undefined);
  assert.equal(main.calls.length, 0);
});
test("PostScript interpreter preserves arithmetic, branching, clipping and caching", () => {
  const { Dict } = worker.modules(4);
  const { StringStream } = worker.modules(8);
  const { PDFFunctionFactory } = worker.modules(57);
  for (const [program, input, expected] of [
    ["{ dup mul }", 0.5, 0.25],
    ["{ dup 0.5 gt { dup mul } { 2 mul } ifelse }", 0.75, 0.5625],
    ["{ 2 mul }", 0.75, 1],
  ]) {
    const dict = new Dict();
    dict.set("FunctionType", 4); dict.set("Domain", [0, 1]); dict.set("Range", [0, 1]);
    const stream = new StringStream(program); stream.dict = dict;
    const calculate = new PDFFunctionFactory({ xref: { fetchIfRef: (x) => x }, isEvalSupported: true }).create(stream);
    const output = new Float32Array(1);
    calculate(new Float32Array([input]), 0, output, 0);
    assert.equal(output[0], expected);
    output[0] = -1;
    calculate(new Float32Array([input]), 0, output, 0);
    assert.equal(output[0], expected);
  }
  assert.equal(worker.calls.length, 0);
});

(async () => {
  await main.sandbox.module.exports.loadScript("https://untrusted.invalid/worker.js");
  assert.equal(await main.sandbox.module.exports.PDFWorker._setupFakeWorkerGlobal,
    main.fallback.WorkerMessageHandler);
  assert.equal(main.calls.length, 0);
  console.log("PASS worker fallback uses bundled exports, ignoring external script URLs");
  console.log(`PASS ${passed + 1} PDF.js hardening tests; no dynamic code execution`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
