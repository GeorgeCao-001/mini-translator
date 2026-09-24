"use strict";

// Exercise the real main.js fallback loops with offline provider doubles.
const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "main.js"), "utf8");
const obsidian = new Proxy({}, {
  get(_target, key) {
    if (["Plugin", "ItemView", "Modal", "PluginSettingTab", "Setting", "DropdownComponent", "MarkdownView"].includes(key)) {
      return class {};
    }
    return () => {};
  },
});
const sandbox = {
  module: { exports: {} },
  window: {}, document: {}, console,
  require: (name) => {
    if (name === "obsidian") return obsidian;
    if (name.startsWith("./src/")) return require(path.join(root, name));
    throw new Error(`Unexpected dependency: ${name}`);
  },
};
vm.createContext(sandbox);
vm.runInContext(`${source}
PLUGIN_SETTINGS = {
  llmProfiles: [],
  translationSourceOrder: ["谷歌", "腾讯", "火山", "有道", "Bing", "CNKI"],
  translationSourceEnabled: ["谷歌"],
  dictionarySourceOrder: ["牛津", "有道词典", "百度"],
  dictionarySourceEnabled: ["牛津"]
};
globalThis.__calls = [];
for (const engine of ENGINES) {
  engine.fn = async () => {
    __calls.push(engine.name);
    if (engine.name === "有道") throw new Error("simulated primary failure");
    return engine.name + " translated";
  };
}
for (const dictionary of BUILTIN_DICTS) {
  dictionary.fn = async () => {
    __calls.push(dictionary.name);
    if (dictionary.name === "百度") throw new Error("simulated primary failure");
    return dictionary.name + " definition";
  };
}
globalThis.__translate = translateSentence;
globalThis.__lookup = dictLookup;
`, sandbox);

(async () => {
  const translated = await sandbox.__translate("A clear sentence.", "有道", "en", "zh-Hans");
  assert.equal(translated.via, "谷歌");
  assert.deepEqual(Array.from(sandbox.__calls), ["有道", "谷歌"]);
  sandbox.__calls.length = 0;
  const definition = await sandbox.__lookup("trajectory", "百度");
  assert.equal(definition.via, "牛津");
  assert.deepEqual(Array.from(sandbox.__calls), ["百度", "牛津"]);
  sandbox.__calls.length = 0;
  vm.runInContext(`
    PLUGIN_SETTINGS.llmProfiles = [{
      name: "Private LLM", url: "https://example.invalid/v1/chat/completions", apiKey: "test-only"
    }];
    llmRequest = async () => { throw new Error("simulated model failure"); };
  `, sandbox);
  await assert.rejects(
    () => sandbox.__translate("A clear sentence.", "Private LLM", "en", "zh-Hans"),
    /simulated model failure/
  );
  await assert.rejects(() => sandbox.__lookup("trajectory", "Private LLM"), /simulated model failure/);
  assert.deepEqual(Array.from(sandbox.__calls), [], "Model failures must not forward text to built-in services");
  console.log("PASS real translation and dictionary loops respect selected source and configured fallback order");
})().catch((error) => { console.error(error); process.exitCode = 1; });
