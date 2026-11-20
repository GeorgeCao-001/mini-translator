"use strict";
// Offline only: fake Keychain values, mocked HTTP, source and final bundle.
const assert = require("assert/strict"), fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.resolve(__dirname, ".."), sourcePath = path.resolve(root, process.argv[2] || "main.js");
let requestHandler = async () => { throw Error("Unexpected network request"); };
const obsidian = new Proxy({}, { get(_, key) {
  if (key === "requestUrl") return request => requestHandler(request);
  return class {};
} });
const context = {
  module: { exports: {} }, window: {}, document: {}, console, TextEncoder, setTimeout, clearTimeout,
  require(name) {
    if (name === "obsidian") return obsidian;
    if (name.startsWith("./src/")) return require(path.join(root, name));
    throw Error("Unexpected dependency: " + name);
  },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(sourcePath, "utf8") +
  "\n;globalThis.__deepl={D:DEEPL,ENGINES,engineOptions,dictOptions,translateSentence,builtinTranslationFallbacks,providerName,I18N,state(settings,storage){PLUGIN_SETTINGS=settings;PLUGIN_SECRET_STORAGE=storage;}};",
  context, { filename: sourcePath });
const X = context.__deepl, D = X.D;
const t = (key, values = {}) => key + (values.status == null ? "" : ":" + values.status);
const tests = [], test = (name, fn) => tests.push([name, fn]), plain = v => JSON.parse(JSON.stringify(v));
const key = "offline-test-key:fx", id = "mini-translator-test";
function fixture(options = {}) {
  const calls = [], reads = [], settings = options.settings || { deeplSecret: id };
  const storage = options.storage === undefined ? {
    getSecret(name) { reads.push(name); return options.key === undefined ? key : options.key; },
  } : options.storage;
  return { calls, reads, settings, storage, env: { settings, secretStorage: storage, t,
    requestUrl: async request => {
      calls.push(request);
      return options.response || { status: 200, json: { translations: [{ text: "译文", detected_source_language: "EN" }] } };
    } } };
}
test("API language mappings preserve scripts and variants", () => {
  for (const [code, source, expected] of [["auto",true,""],["zh-Hans",false,"ZH-HANS"],["zh-Hant",false,"ZH-HANT"],
    ["zh-Hant",true,"ZH"],["en",false,"EN-US"],["en",true,"EN"],["pt",false,"PT-PT"],["pt",true,"PT"],
    ["nb",false,"NO"],["ja",false,"JA"],["sr-Latn",false,"SR-LATN"]]) {
    assert.equal(D.languageCode(code, source), expected);
  }
  for (const [code, expected] of [["ZH","zh-Hans"],["ZH-HANT","zh-Hant"],["NO","nb"],["PT-BR","pt"]]) {
    assert.equal(D.detectedLanguage(code), expected);
  }
});
test("Free API request uses header auth and preserves formatting", async () => {
  const f = fixture(), input = "One.\n\nTwo.";
  const result = await D.translate(input, "en", "zh-Hans", f.env), r = f.calls[0];
  assert.equal(r.url, D.ENDPOINTS.free); assert.equal(r.method, "POST"); assert.equal(r.throw, false);
  assert.equal(r.headers.Authorization, "DeepL-Auth-Key " + key);
  assert.equal(r.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(r.body), { text: [input], target_lang: "ZH-HANS", source_lang: "EN",
    preserve_formatting: true, split_sentences: "nonewlines" });
  assert.ok(!r.url.includes(key) && !r.body.includes(key)); assert.deepEqual(f.reads, [id]);
  assert.deepEqual(plain(result), { text: "译文", detectedLanguage: "en" });
});
test("Pro endpoint and auto source omit source_lang", async () => {
  const f = fixture({ key: "offline-pro-key" });
  await D.translate("Bonjour", "auto", "zh-Hant", f.env);
  assert.equal(f.calls[0].url, D.ENDPOINTS.pro);
  assert.equal(JSON.parse(f.calls[0].body).target_lang, "ZH-HANT");
  assert.ok(!Object.hasOwn(JSON.parse(f.calls[0].body), "source_lang"));
});
test("Keychain is read every time; keys never enter settings", async () => {
  const f = fixture(); let current = "first:fx";
  f.storage.getSecret = async () => current;
  await D.translate("one", "en", "ja", f.env); current = "second";
  await D.translate("two", "en", "ja", f.env);
  assert.equal(f.calls[0].url, D.ENDPOINTS.free); assert.equal(f.calls[1].url, D.ENDPOINTS.pro);
  assert.equal(f.calls[1].headers.Authorization, "DeepL-Auth-Key second");
  assert.deepEqual(f.settings, { deeplSecret: id });
});
test("Missing/unavailable secrets fail without HTTP or plaintext fallback", async () => {
  for (const options of [{ settings: {} }, { storage: null }, { storage: {} }, { key: "" },
    { storage: { getSecret() { throw Error("sensitive keychain error"); } } }]) {
    const f = fixture(options);
    await assert.rejects(() => D.translate("private", "auto", "en", f.env), /deepl\.(key_required|secret_unavailable)/);
    assert.equal(f.calls.length, 0);
  }
});
test("Header injection and UTF-8 oversized text fail before HTTP", async () => {
  const bad = fixture({ key: "bad\r\nheader" });
  await assert.rejects(() => D.translate("one", "en", "ja", bad.env), /deepl.key_invalid/);
  assert.equal(bad.calls.length, 0);
  const big = fixture();
  await assert.rejects(() => D.translate("中".repeat(45000), "auto", "en", big.env), /deepl.input_too_large/);
  assert.equal(big.calls.length, 0);
});
test("HTTP errors are actionable and hide raw response details", async () => {
  for (const [status, expected] of [[401,"key_invalid"],[403,"key_invalid"],[429,"rate_limit"],[456,"quota"],
    [413,"input_too_large"],[400,"http:400"],[503,"http:503"]]) {
    const f = fixture({ response: { status, json: { message: key + " private text" } } });
    await assert.rejects(() => D.translate("private text", "en", "ja", f.env),
      error => error.message === "deepl." + expected);
    assert.equal(f.calls.length, 1, "No automatic retry/billing amplification");
  }
});
test("Transport exceptions and malformed responses are sanitized", async () => {
  const f = fixture(); f.env.requestUrl = async () => { throw Error(key + " private text"); };
  await assert.rejects(() => D.translate("private text", "en", "ja", f.env), /^Error: deepl.network_error$/);
  for (const json of [{}, { translations: [] }, { translations: [{ text: 3 }] }, { translations: [{ text: " " }] }]) {
    const f = fixture({ response: { status: 200, json } });
    await assert.rejects(() => D.translate("one", "en", "ja", f.env), /deepl.empty_result/);
  }
  const f2 = fixture({ response: { status: 200, get json() { throw Error("invalid JSON"); } } });
  await assert.rejects(() => D.translate("one", "en", "ja", f2.env), /deepl.empty_result/);
});
test("Translation-only registration and source attribution", () => {
  assert.equal(Array.from(X.engineOptions()).filter(name => name === "DeepL").length, 1);
  assert.ok(!Array.from(X.dictOptions()).includes("DeepL"));
  for (const language of ["zh-CN", "en"]) {
    X.I18N.setUiLanguage(language); assert.equal(X.providerName("DeepL"), "DeepL (deepl.com)");
  }
  X.I18N.setUiLanguage("zh-CN");
});
test("Fallback defaults preserve old sources; paid API requires opt-in", () => {
  const old = Array.from(X.ENGINES).filter(e => e.name !== "DeepL").map(e => e.name);
  for (const settings of [{}, { translationSourceEnabled: null }, { translationSourceEnabled: "invalid" }]) {
    assert.deepEqual(Array.from(X.builtinTranslationFallbacks(settings)), old);
  }
  for (const list of [["谷歌"], ["DeepL"], []]) {
    assert.deepEqual(Array.from(X.builtinTranslationFallbacks({ translationSourceEnabled: list })), list);
  }
});
test("Real dispatch protects/restores math and detects source language", async () => {
  const f = fixture(); X.state(f.settings, f.storage);
  const requests = [];
  requestHandler = async request => {
    requests.push(request);
    return { status: 200, json: { translations: [{ text: "译文 " + JSON.parse(request.body).text[0],
      detected_source_language: "EN" }] } };
  };
  const result = await X.translateSentence("Energy $x^2$ is conserved.", "DeepL", "auto", "zh-Hans");
  assert.equal(result.via, "DeepL"); assert.equal(result.detectedLanguage, "en");
  assert.ok(result.text.includes("$x^2$")); assert.ok(!requests[0].body.includes("$x^2$"));
  assert.equal(requests.length, 1);
});
test("Selected DeepL errors never forward text to other providers", async () => {
  const f = fixture(); X.state({ ...f.settings, translationSourceEnabled: ["谷歌"] }, f.storage);
  let calls = 0;
  requestHandler = async request => {
    calls++; assert.match(request.url, /^https:\/\/api-free\.deepl\.com\//);
    return { status: 456, json: {} };
  };
  await assert.rejects(() => X.translateSentence("private", "DeepL", "en", "zh-Hans"), /额度|usage/);
  assert.equal(calls, 1);
});
test("A legacy LLM profile named DeepL cannot silently hijack the official provider", async () => {
  const f = fixture(), settings = { ...f.settings, llmProfiles: [{ name: "DeepL",
    url: "https://example.invalid/v1/chat/completions", models: ["test"], activeModel: "test" }] };
  X.state(settings, f.storage);
  requestHandler = async () => { throw Error("Conflicting provider must not send a request"); };
  await assert.rejects(() => X.translateSentence("private", "DeepL", "en", "zh-Hans"), /重命名|Rename/);
  assert.equal(settings.llmProfiles[0].name, "DeepL");
  assert.equal(f.reads.length, 0);
});
test("Default fallback skips DeepL; explicit opt-in works", async () => {
  const original = Array.from(X.ENGINES, engine => engine.fn), seen = [], f = fixture();
  try {
    for (const engine of X.ENGINES) if (engine.name !== "DeepL") {
      engine.fn = async () => { seen.push(engine.name); throw Error("offline provider unavailable"); };
    }
    X.state({ ...f.settings, translationSourceEnabled: null }, f.storage);
    requestHandler = async () => { throw Error("DeepL was not opted in"); };
    await assert.rejects(() => X.translateSentence("private", "有道", "en", "zh-Hans"));
    assert.equal(seen.length, 6); seen.length = 0;
    X.state({ ...f.settings, translationSourceEnabled: ["DeepL"] }, f.storage);
    let calls = 0;
    requestHandler = async () => { calls++; return { status: 200, json: { translations: [{ text: "允许的备用译文" }] } }; };
    const result = await X.translateSentence("private", "有道", "en", "zh-Hans");
    assert.equal(result.via, "DeepL"); assert.equal(calls, 1); assert.deepEqual(seen, ["有道"]);
  } finally { Array.from(X.ENGINES).forEach((engine, i) => { engine.fn = original[i]; }); }
});
test("Startup wires host Keychain and saves only secret reference", async () => {
  const f = fixture(), plugin = new context.module.exports();
  plugin.app = { secretStorage: f.storage };
  plugin.loadData = async () => ({ ...f.settings, llmProfiles: [], otherSetting: "keep" });
  let saved;
  plugin.saveData = async settings => { saved = plain(settings); };
  plugin.applyUiLanguage = () => {};
  const stop = new Error("stop after settings initialization");
  plugin.registerView = () => { throw stop; };
  await assert.rejects(() => plugin.onload(), error => error === stop);
  assert.equal(saved.deeplSecret, id); assert.equal(saved.otherSetting, "keep");
  assert.ok(!saved.translationSourceEnabled.includes("DeepL")); assert.ok(!JSON.stringify(saved).includes(key));
  let used = false;
  requestHandler = async request => {
    used = true; assert.equal(request.headers.Authorization, "DeepL-Auth-Key " + key);
    return { status: 200, json: { translations: [{ text: "startup wired" }] } };
  };
  await X.translateSentence("hello", "DeepL", "en", "ja"); assert.ok(used);
});
test("Native config saves secret names; failed save retains prior reference", async () => {
  const settings = { deeplSecret: "previous", cnkiToken: "preserve", llmProfiles: [] }, saved = [], notices = [];
  let control, row, fail = false;
  class Setting {
    constructor() { row = this; } setName(value) { this.name = value; return this; }
    setDesc(value) { this.desc = value; return this; }
    addComponent(fn) { this.component = fn({}); return this; }
  }
  class SecretComponent {
    constructor() { control = this; } setValue(value) { this.value = value; return this; }
    onChange(callback) { this.change = callback; return this; }
  }
  D.addSettings({ container: { createDiv() {} },
    app: { secretStorage: { getSecret() { throw Error("UI must not read secret"); } } },
    settings, save: async next => { if (fail) throw Error("disk failure"); saved.push(plain(next)); },
    Setting, SecretComponent, t, notify: message => notices.push(message) });
  assert.equal(row.name, "deepl.key_name"); assert.equal(control.value, "previous"); assert.equal(saved.length, 0);
  await control.change(" new-reference ");
  assert.equal(settings.deeplSecret, "new-reference");
  assert.deepEqual(saved[0], { deeplSecret: "new-reference", cnkiToken: "preserve", llmProfiles: [] });
  fail = true; await control.change("not-saved");
  assert.equal(settings.deeplSecret, "new-reference"); assert.equal(control.value, "new-reference");
  assert.deepEqual(notices, ["deepl.save_failed"]);
  fail = false; await control.change(""); assert.equal(settings.deeplSecret, ""); assert.equal(saved.length, 2);
});
test("Unsupported host offers no insecure raw-key input", () => {
  const messages = [];
  D.addSettings({ container: { createDiv: o => messages.push(o.text) }, app: {}, settings: {},
    save() { throw Error("No save"); }, Setting: class { constructor() { throw Error("No raw-key form"); } },
    SecretComponent: class {}, t, notify() {} });
  assert.deepEqual(messages, ["deepl.notice", "deepl.secret_unavailable"]);
});
(async () => {
  for (const [name, fn] of tests) { await fn(); console.log("PASS DeepL " + name); }
  console.log("PASS " + tests.length + " DeepL tests: " + path.relative(root, sourcePath));
})().catch(error => { console.error(error); process.exitCode = 1; });
