"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

function makeMinimalPdf() {
  const content = "BT /F1 12 Tf 72 720 Td (Hello Mini Translator) Tj ET\n";
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n",
    `4 0 obj\n<< /Length ${Buffer.byteLength(content, "ascii")} >>\nstream\n${content}endstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "binary"));
    pdf += object;
  }
  const xrefOffset = Buffer.byteLength(pdf, "binary");
  pdf += "xref\n0 6\n0000000000 65535 f \n";
  for (let index = 1; index <= 5; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(pdf, "binary"));
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
const commonGlobals = {
  console,
  TextDecoder,
  TextEncoder,
  Uint8Array,
  ArrayBuffer,
  structuredClone,
  ReadableStream,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
};
const sandbox = {
  ...commonGlobals,
  window: {},
  document: {},
  // Match Obsidian's Electron renderer closely enough for PDF.js environment
  // detection without exposing Node's real process or filesystem APIs.
  process: {
    type: "renderer",
    versions: { electron: "test" },
    toString() {
      return "[object process]";
    },
  },
  require(request) {
    if (request === "obsidian") return obsidian;
    unexpectedRequires.push(request);
    throw new Error(`release PDF runtime unexpectedly required ${request}`);
  },
  module: { exports: {} },
  exports: {},
  URL: class FakeURL extends URL {
    static createObjectURL() {
      return "blob:mini-translator-pdf-integration-test";
    }

    static revokeObjectURL() {}
  },
  Blob: class FakeBlob {
    constructor(parts, options) {
      this.parts = parts;
      this.type = options?.type || "";
    }
  },
  atob: (value) => Buffer.from(value, "base64").toString("binary"),
  btoa: (value) => Buffer.from(value, "binary").toString("base64"),
};

vm.createContext(sandbox);
const source = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
vm.runInContext(
  `${source}\n;globalThis.__pdfIntegration = { loadPdfJs, BUNDLED_RUNTIME };`,
  sandbox,
  { filename: "dist/main.js" }
);

(async () => {
  const pdfjs = sandbox.__pdfIntegration.loadPdfJs({});
  const externalPdf = process.argv[2] ? path.resolve(process.argv[2]) : null;
  const task = pdfjs.getDocument({
    data: externalPdf
      ? new Uint8Array(fs.readFileSync(externalPdf))
      : makeMinimalPdf(),
    isEvalSupported: false,
  });
  const document = await task.promise;
  const page = await document.getPage(1);
  const textContent = await page.getTextContent();
  const text = textContent.items.map((item) => item.str).join(" ");
  if (typeof sandbox.window.pdfjsWorker?.WorkerMessageHandler !== "function") {
    throw new Error("safe bundled PDF worker fallback was not initialized");
  }
  if (
    externalPdf
      ? document.numPages < 1 || !text.trim()
      : document.numPages !== 1 || text !== "Hello Mini Translator"
  ) {
    throw new Error(`unexpected PDF parse result: pages=${document.numPages}, text=${text}`);
  }
  if (unexpectedRequires.length) {
    throw new Error(`unexpected release dependencies: ${unexpectedRequires.join(", ")}`);
  }
  await document.destroy();
  console.log(
    `PASS embedded PDF.js and worker parse ${externalPdf || "the generated PDF"} without dynamic scripts`
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
