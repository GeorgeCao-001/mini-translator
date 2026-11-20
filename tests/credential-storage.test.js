"use strict";

// Test the actual request paths with a fake Keychain and fake network only.
const assert = require("assert/strict"), fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.resolve(__dirname, ".."), entry = path.resolve(root, process.argv[2] || "main.js");
let handler;
const obsidian = new Proxy({}, { get(_, key) { return key === "requestUrl" ? r => handler(r) : class {}; } });
const box = { module: { exports: {} }, document: {}, window: {}, console, URL, URLSearchParams, TextEncoder,
  btoa: value => Buffer.from(value, "binary").toString("base64"),
  require(id) {
    if (id === "obsidian") return obsidian;
    if (id === "crypto" || id === "buffer") return require("node:" + id);
    if (id.startsWith("./src/")) return require(path.join(root, id));
    throw Error("Unexpected dependency: " + id);
  },
};
vm.createContext(box);
vm.runInContext(fs.readFileSync(entry, "utf8") +
  "\n;globalThis.api={CREDENTIALS,fetchModels,bingTranslate,cnkiTranslate,llmRequest,dictLookup,readCredential,I18N,state(s,k){PLUGIN_SETTINGS=s;PLUGIN_SECRET_STORAGE=k;}};",
  box, { filename: entry });
const api = box.api, requests = [];
api.I18N.setUiLanguage("en");
const fakeSecret = "keychain-value";
const store = { getSecret: id => id === "provider-ref" ? fakeSecret : null };
const profile = { name: "My Profile", apiKey: "must-not-be-used", apiKeySecret: "provider-ref",
  url: "https://example.invalid/v1/chat/completions", activeModel: "model-a" };
const json = p => JSON.parse(JSON.stringify(p));
async function run() {
  api.state({ llmProfiles: [profile] }, store);
  assert.equal(await api.readCredential({ apiKey: " plain " }, "apiKey"), "plain");
  assert.equal(await api.readCredential({}, "apiKey"), "");
  handler = async request => {
    requests.push(request);
    return { status: 200, json: request.url.endsWith("/models")
      ? { data: [{ id: "model-a" }] } : { choices: [{ message: { content: "result" } }] } };
  };
  assert.equal(await api.llmRequest("sample", profile), "result");
  assert.equal((await api.dictLookup("sample", profile.name)).text, "result");
  const credential = await api.readCredential(profile, "apiKey");
  assert.deepEqual(json(await api.fetchModels(profile.url, credential, true)), ["model-a"]);
  assert.ok(requests.every(r => r.headers.authorization === "Bearer " + fakeSecret));
  await api.llmRequest("local", { url: "http://localhost:11434/v1/chat/completions", activeModel: "local" });
  assert.equal(requests.at(-1).headers.authorization, undefined);
  api.state({ bingApiKeySecret: "provider-ref", bingApiKey: "old" }, store);
  handler = async request => {
    assert.match(request.url, /^https:\/\/api\.cognitive\.microsofttranslator\.com\//);
    assert.equal(request.headers["Ocp-Apim-Subscription-Key"], fakeSecret);
    return { status: 200, json: [{ translations: [{ text: "Azure result" }] }] };
  };
  assert.equal((await api.bingTranslate("sample", "en", "zh-Hans")).text, "Azure result");
  api.state({ cnkiTokenSecret: "provider-ref", cnkiAuthorization: "legacy" }, store);
  handler = async request => {
    assert.equal(request.headers.Token, fakeSecret);
    assert.equal(request.headers.Authorization, "legacy");
    return { status: 200, json: { code: 200, data: { mResult: "CNKI result" } } };
  };
  assert.equal((await api.cnkiTranslate("sample", "en", "zh-Hans")).text, "CNKI result");
  api.state({ bingApiKeySecret: "missing", bingApiKey: "old" }, store);
  handler = async () => { throw Error("Unexpected request using missing key"); };
  await assert.rejects(() => api.bingTranslate("sample", "en", "zh-Hans"), /Keychain secret not found/);
  await assert.rejects(() => api.llmRequest("sample", { ...profile, apiKeySecret: "missing" }), /Keychain secret not found/);
  handler = async () => { throw Error(fakeSecret); };
  await assert.rejects(() => api.llmRequest("sample", profile), /Could not reach the provider/);
  handler = async () => ({ status: 403, json: { message: fakeSecret } });
  await assert.rejects(() => api.llmRequest("sample", profile), /HTTP 403/);
  handler = async () => ({ status: 200, get json() { throw Error(fakeSecret); } });
  await assert.rejects(() => api.llmRequest("sample", profile), /unreadable response/);
  const portable = api.CREDENTIALS.portableProfile(profile);
  assert.equal(portable.apiKey, "");
  assert.ok(!Object.hasOwn(portable, "apiKeySecret"));
  assert.equal(api.CREDENTIALS.portableProfile({ apiKey: "legacy" }).apiKey, "legacy");
  const legacy = api.CREDENTIALS.clearLegacyCopies({
    llmApiKey: "old", customPresets: [{ apiKey: "old" }, { apiKey: "keep" }],
  }, "old");
  assert.ok(!Object.hasOwn(legacy, "llmApiKey"));
  assert.deepEqual(json(legacy.customPresets), [{ apiKey: "" }, { apiKey: "keep" }]);
  console.log("PASS optional credential modes (LLM, models, dictionary, Azure, CNKI, errors and portability): " + path.relative(root, entry));
}
run().catch(error => { console.error(error); process.exitCode = 1; });
