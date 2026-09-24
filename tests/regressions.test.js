// Offline regressions for narrowly scoped translation safety fixes.
// Run: node tests/regressions.test.js [optional-main.js-snapshot]
// Only main.js is read. No plugin settings, real credentials, or network access.
const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let responseChoice;
let requestCount = 0;
let expectedAuthorization = "Bearer offline-test-only";
const obsidian = {
  Plugin: class {}, ItemView: class {}, MarkdownView: class {},
  Modal: class {}, PluginSettingTab: class {}, Setting: class {},
  DropdownComponent: class {}, Notice: class {},
  requestUrl: async (request) => {
    // Assert the mock is the only transport and all credentials are test-only.
    assert.equal(request.url, "https://example.invalid/v1/chat/completions");
    if (expectedAuthorization) {
      assert.equal(request.headers.authorization, expectedAuthorization);
    } else {
      assert.ok(!Object.prototype.hasOwnProperty.call(request.headers, "authorization"));
    }
    assert.equal(JSON.parse(request.body).stream, false);
    requestCount++;
    return { status: 200, json: { choices: [responseChoice] } };
  },
};
const sandbox = {
  module: { exports: {} }, window: {}, document: {}, console,
  require: (name) => {
    if (name === "obsidian") return obsidian;
    if (name === "./src/i18n.js") return require(path.join(__dirname, "..", "src", "i18n.js"));
    if (name === "./src/model-config.js") return require(path.join(__dirname, "..", "src", "model-config.js"));
    if (name === "./src/source-order.js") return require(path.join(__dirname, "..", "src", "source-order.js"));
    if (name === "./src/source-picker.js") return require(path.join(__dirname, "..", "src", "source-picker.js"));
    throw new Error("Unexpected dependency in offline regression: " + name);
  },
};
vm.createContext(sandbox);
const sourcePath = process.argv[2] || path.join(__dirname, "..", "main.js");
const source = fs.readFileSync(sourcePath, "utf8");
vm.runInContext(source + "\n;__test = { parseBatchResponse, llmRequest, joinCrossPageContinuationBlocks };", sandbox, { filename: "main.js" });
const X = sandbox.__test;
const plain = (value) => JSON.parse(JSON.stringify(value));
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// Batch protocol: unmarked commentary is never a replacement for a missing block.
test("batch: preamble cannot fill a missing TGT", () => {
  assert.throws(
    () => X.parseBatchResponse("Here is the translation:\n⟦SRC1⟧ one\n⟦TGT1⟧ 第一段\n⟦SRC2⟧ two", 2, true),
    /第\s*2\s*段缺失译文/
  );
});
test("batch: all-unmarked explanation is not a translation", () => {
  assert.throws(() => X.parseBatchResponse("Here is the requested translation.", 1, true), /缺失译文/);
});
test("batch: generic SRC/TGT markers retain both blocks", () => {
  assert.deepEqual(plain(X.parseBatchResponse("⟦SRC1⟧ one ⟦TGT1⟧ 第一段 ⟦SRC2⟧ two ⟦TGT2⟧ 第二段", 2, true)), [
    { en: "one", zh: "第一段" }, { en: "two", zh: "第二段" },
  ]);
});
test("batch: legacy EN/ZH markers remain supported", () => {
  assert.deepEqual(plain(X.parseBatchResponse("⟦EN1⟧ one ⟦ZH1⟧ 第一段", 1, true)), [{ en: "one", zh: "第一段" }]);
});
test("batch: legacy MT markers remain supported", () => {
  assert.deepEqual(plain(X.parseBatchResponse("⟦MT1⟧ 第一段 ⟦MT2⟧ 第二段", 2, false)), [
    { en: "", zh: "第一段" }, { en: "", zh: "第二段" },
  ]);
});
test("batch: preamble does not damage a complete marked response", () => {
  assert.deepEqual(plain(X.parseBatchResponse("Here is the translation:\n⟦SRC1⟧ one\n⟦TGT1⟧ 第一段", 1, true)), [{ en: "one", zh: "第一段" }]);
});
test("batch: an empty marked target still fails", () => {
  assert.throws(() => X.parseBatchResponse("⟦SRC1⟧ one ⟦TGT1⟧  ", 1, true), /缺失译文/);
});

// Mock model replies: reject only the explicitly unsafe completion states.
const profile = {
  activeModel: "offline-model", url: "https://example.invalid/v1/chat/completions",
  apiKey: "offline-test-only",
};
const callLlm = () => X.llmRequest("The source text.", profile, "Translate faithfully.");
test("LLM: length finish reason rejects nonempty partial output", async () => {
  responseChoice = { message: { content: "A partially translated" }, finish_reason: "length" };
  await assert.rejects(callLlm, /length|截断|长度|token/i);
});
test("LLM: content_filter finish reason rejects nonempty output", async () => {
  responseChoice = { message: { content: "Partial response" }, finish_reason: "content_filter" };
  await assert.rejects(callLlm, /content_filter|过滤|审核|安全|拒绝/i);
});
test("LLM: stop finish reason returns normal output", async () => {
  responseChoice = { message: { content: "  完整译文。  " }, finish_reason: "stop" };
  assert.equal(await callLlm(), "完整译文。");
});
test("LLM: compatible API may omit finish_reason", async () => {
  responseChoice = { message: { content: "完整译文。" } };
  assert.equal(await callLlm(), "完整译文。");
});
test("LLM: keyless local endpoints do not receive an empty Bearer header", async () => {
  responseChoice = { message: { content: "本地译文。" }, finish_reason: "stop" };
  expectedAuthorization = "";
  try {
    assert.equal(
      await X.llmRequest(
        "The source text.",
        { ...profile, apiKey: "" },
        "Translate faithfully."
      ),
      "本地译文。"
    );
  } finally {
    expectedAuthorization = "Bearer offline-test-only";
  }
});
test("LLM: empty output remains an error", async () => {
  responseChoice = { message: { content: "   " }, finish_reason: "stop" };
  await assert.rejects(callLlm, /空结果/);
});

// Natural paragraphs may span multiple adjacent physical pages, but never gaps.
function body(page, text, extras = {}) {
  return { page, text, kind: "body", column: "left", flowId: "left", ...extras };
}
function note(page, text = "1 Author affiliation.") {
  return { page, text, kind: "footnote", column: "footnote", flowId: "footnote:left" };
}
test("pages: three-page continuation chains into one block", () => {
  const joined = X.joinCrossPageContinuationBlocks([
    body(1, "The model learns"), body(2, "a robust policy for"), body(3, "rough terrain."),
  ]);
  assert.equal(joined.length, 1);
  assert.equal(joined[0].text, "The model learns a robust policy for rough terrain.");
  assert.equal(joined[0].page, 1);
  assert.equal(joined[0].continuedThroughPage, 3);
  assert.equal(joined[0].crossPageContinuation, true);
});
test("pages: four-page continuation chains into one block", () => {
  const joined = X.joinCrossPageContinuationBlocks([
    body(1, "The model learns"), body(2, "a robust policy"), body(3, "for rough"), body(4, "terrain."),
  ]);
  assert.equal(joined.length, 1);
  assert.equal(joined[0].text, "The model learns a robust policy for rough terrain.");
  assert.equal(joined[0].continuedThroughPage, 4);
});
test("pages: existing continuedThroughPage is the physical tail page", () => {
  const joined = X.joinCrossPageContinuationBlocks([
    body(1, "The model learns a robust", { continuedThroughPage: 2, crossPageContinuation: true }),
    body(3, "policy for rough terrain."),
  ]);
  assert.equal(joined.length, 1);
  assert.equal(joined[0].continuedThroughPage, 3);
  assert.equal(joined[0].text, "The model learns a robust policy for rough terrain.");
});
test("pages: missing physical page is not crossed", () => {
  const input = [body(1, "The model learns"), body(3, "a policy on another page.")];
  const joined = X.joinCrossPageContinuationBlocks(input);
  assert.equal(joined.length, 2);
  assert.equal(joined[0].text, "The model learns");
  assert.equal(joined[1].text, "a policy on another page.");
});
test("pages: continuation cannot bridge a missing page after its tail", () => {
  const joined = X.joinCrossPageContinuationBlocks([
    body(1, "The model learns", { continuedThroughPage: 2, crossPageContinuation: true }),
    body(4, "a policy on another page."),
  ]);
  assert.equal(joined.length, 2);
});
test("pages: complete sentence is not joined to next page", () => {
  const joined = X.joinCrossPageContinuationBlocks([
    body(1, "The model learns a policy."), body(2, "another experiment follows."),
  ]);
  assert.equal(joined.length, 2);
});
test("pages: footnotes survive a chained body continuation", () => {
  const notes = [note(1), note(2, "2 Dataset license.")];
  const joined = X.joinCrossPageContinuationBlocks([
    body(1, "The model learns"), notes[0], body(2, "a robust policy for"), notes[1], body(3, "rough terrain."),
  ]);
  const prose = joined.filter((b) => b.kind === "body");
  assert.equal(prose.length, 1);
  assert.equal(prose[0].text, "The model learns a robust policy for rough terrain.");
  assert.deepEqual(plain(joined.filter((b) => b.kind === "footnote")), notes);
});
test("pages: footnote-only page does not bridge disjoint body text", () => {
  const joined = X.joinCrossPageContinuationBlocks([
    body(1, "The model learns"), note(2), body(3, "a policy on another page."),
  ]);
  assert.equal(joined.length, 3);
});

(async () => {
  let failed = 0;
  for (const { name, fn } of tests) {
    try { await fn(); console.log("PASS", name); }
    catch (error) { failed++; console.error("FAIL", name, "\n ", error.message); }
  }
  console.log(`\n${tests.length - failed}/${tests.length} passed; ${failed} failed; ${requestCount} mocked LLM requests; no network.`);
  process.exitCode = failed ? 1 : 0;
})().catch((error) => { console.error(error); process.exitCode = 1; });
