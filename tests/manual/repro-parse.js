// 复现脚本：在 Node 里用与插件完全相同的代码路径（main.js 的 extractDocBlocks
// + 插件发布构建使用的 scripts/vendor/pdfjs/pdf.min.js）解析 vault 里的真实 PDF。
// 用法：node tests/manual/repro-parse.js <pdf1> [pdf2 ...]
const Module = require("module");
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "obsidian") return new Proxy({}, { get: () => class {} });
  return origLoad.call(this, request, parent, isMain);
};
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const projectRoot = path.resolve(__dirname, "..", "..");
const src = fs.readFileSync(path.join(projectRoot, "main.js"), "utf8");
const sandbox = {
  window: {},
  document: {},
  console,
  require,
  module: { exports: {} },
  setInterval,
  clearInterval,
  setTimeout,
  clearTimeout,
};
vm.createContext(sandbox);
vm.runInContext(src + "\n;__exports = { extractDocBlocks };", sandbox);
const { extractDocBlocks } = sandbox.__exports;
Module._load = origLoad;

let pdfjs;
try {
  pdfjs = require(path.join(projectRoot, "scripts", "vendor", "pdfjs", "pdf.min.js"));
} catch (e) {
  console.log("REQUIRE pdf.min.js FAILED:", e.message);
  global.DOMMatrix ||= class {};
  global.Path2D ||= class {};
  pdfjs = require(path.join(projectRoot, "scripts", "vendor", "pdfjs", "pdf.min.js"));
}

(async () => {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("用法：node tests/manual/repro-parse.js <pdf1> [pdf2 ...]");
    process.exitCode = 1;
    return;
  }
  let failures = 0;
  for (const f of files) {
    const t0 = Date.now();
    try {
      const data = new Uint8Array(fs.readFileSync(f));
      const doc = await pdfjs.getDocument({ data }).promise;
      const r = await extractDocBlocks(doc);
      let chars = 0;
      for (const b of r.blocks) chars += b.text.length;
      console.log(
        `OK   ${path.basename(f)} pages=${doc.numPages} blocks=${r.blocks.length} chars=${chars} (${Date.now() - t0}ms)`
      );
      if (r.blocks[0])
        console.log(
          "     first:",
          JSON.stringify(r.blocks[0].text.slice(0, 70))
        );
    } catch (e) {
      failures++;
      console.log(`FAIL ${path.basename(f)}: ${e.message}`);
      console.log(
        "     " + e.stack.split("\n").slice(1, 4).join("\n     ")
      );
    }
  }
  process.exitCode = failures ? 1 : 0;
})();
