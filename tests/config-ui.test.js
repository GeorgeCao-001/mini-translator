// Offline API configuration UI regressions. Run: node tests/config-ui.test.js
// Loads main.js with a minimal Obsidian/DOM stub; never reads data.json or uses the network.
const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

class Element {
  constructor(tag = "div", options = {}) {
    this.tagName = tag;
    this.children = [];
    this.text = options.text || "";
    this.type = options.type || "";
    this.value = "";
    this.dataset = {};
    this.style = { setProperty(name, value) { this[name] = value; } };
    this.classList = { contains: () => false, add() {}, remove() {} };
  }
  empty() { this.children = []; this.text = ""; }
  appendChild(child) { this.children.push(child); return child; }
  createEl(tag, options) { return this.appendChild(new Element(tag, options)); }
  createDiv(options) { return this.createEl("div", options); }
  createSpan(options) { return this.createEl("span", options); }
  addClass() {}
  setText(text) { this.text = text; }
  addEventListener(name, handler) { this["on" + name] = handler; }
  focus() {}
  click() { if (this.disabled) return; return this.onclick?.(); }
}

class Control {
  constructor(parent, tag = "input") {
    this.element = parent.createEl(tag);
    this.inputEl = this.element;
    this.buttonEl = this.element;
    this.selectEl = this.element;
    this.element.control = this;
    this.options = {};
  }
  setValue(value) { this.element.value = value; return this; }
  setPlaceholder(value) { this.element.placeholder = value; return this; }
  addOption(value, label) { this.options[value] = label; return this; }
  addOptions(values) { Object.assign(this.options, values); return this; }
  onChange(callback) { this.change = callback; return this; }
  onClick(callback) { this.element.onclick = callback; return this; }
  setButtonText(text) { this.element.text = text; return this; }
  setDisabled(value) { this.element.disabled = value; return this; }
  setCta() { return this; }
  setLimits() { return this; }
  setDynamicTooltip() { return this; }
  async choose(value) { this.setValue(value); await this.change?.(value); }
}
class DropdownComponent extends Control {
  constructor(parent) { super(parent, "select"); }
}
class Setting {
  constructor(parent) {
    this.settingEl = parent.createDiv();
    this.settingEl.setting = this;
    this.controls = [];
  }
  setName(name) { this.name = name; return this; }
  setDesc(desc) { this.desc = desc; return this; }
  add(kind, callback) {
    const control = kind === "select"
      ? new DropdownComponent(this.settingEl)
      : new Control(this.settingEl, kind);
    this.controls.push(control);
    callback(control);
    return this;
  }
  addDropdown(callback) { return this.add("select", callback); }
  addText(callback) { return this.add("input", callback); }
  addButton(callback) { return this.add("button", callback); }
  addSlider(callback) { return this.add("input", callback); }
  addToggle(callback) { return this.add("input", callback); }
}
const openedModals = [];
class Modal {
  constructor(app) { this.app = app; this.contentEl = new Element(); }
  open() { openedModals.push(this); this.onOpen?.(); }
  close() { this.onClose?.(); }
}
class PluginSettingTab {
  constructor(app) { this.app = app; this.containerEl = new Element(); }
}
let requests = 0;
let failModelRequest = false;
const notices = [];
const obsidian = {
  Plugin: class {}, ItemView: class {}, MarkdownView: class {},
  Modal, PluginSettingTab, Setting, DropdownComponent,
  Notice: class { constructor(message) { notices.push(message); } },
  requestUrl: async (request) => {
    assert.match(request.url, /^https:\/\/example\.invalid\/v1\/models$/);
    requests++;
    if (failModelRequest) throw new Error("offline simulated model-list failure");
    return { status: 200, json: { data: [{ id: "model-a" }, { id: "model-b" }] } };
  },
};
const sandbox = {
  module: { exports: {} },
  require: (name) => {
    if (name === "obsidian") return obsidian;
    if (name === "./src/i18n.js") return require(path.join(__dirname, "..", "src", "i18n.js"));
    throw new Error("Unexpected dependency in offline UI test: " + name);
  },
  document: { body: new Element(), createElement: (tag) => new Element(tag) },
  window: {}, console,
};
vm.createContext(sandbox);
const source = fs.readFileSync(path.join(__dirname, "..", "main.js"), "utf8");
vm.runInContext(source + `
;__ui = { LLMConfigModal, MiniTranslatorSettingTab };
// Settings previews are unrelated to this test; do not load the orb renderer.
loadOrbModule = () => ({
  createDefaultSkinRegistry: () => ({
    list: () => [{ id: 'ink-water', label: 'ink-water' }],
    resolve: () => ({ id: 'ink-water', tokens: { light: {}, dark: {} } })
  }),
  createOrbElement: () => document.createElement('div')
});
`, sandbox, { filename: "main.js" });

function nodes(root) { return [root, ...root.children.flatMap(nodes)]; }
function settings(root) { return nodes(root).filter((n) => n.setting).map((n) => n.setting); }
function setting(root, name) {
  const matches = settings(root).filter((s) => s.name === name);
  assert.equal(matches.length, 1, `Exactly one setting: ${name}`);
  return matches[0];
}
function button(root, text) {
  const matches = nodes(root).filter((n) => n.tagName === "button" && n.text === text);
  assert.equal(matches.length, 1, `Exactly one button: ${text}`);
  return matches[0];
}
function field(root, name) { return setting(root, name).controls[0]; }
function controlWithOption(root, option) {
  const matches = nodes(root)
    .map((node) => node.control)
    .filter((control) => control && Object.prototype.hasOwnProperty.call(control.options || {}, option));
  assert.equal(matches.length, 1, `Exactly one control with option: ${option}`);
  return matches[0];
}
function creationPicker(root) { return controlWithOption(root, "blank"); }
function expectFields(root, expected) {
  assert.deepEqual(settings(root).map((s) => s.name).sort(), expected.slice().sort());
  assert.equal(nodes(root).filter((n) => n.tagName === "h3").length, 1);
}
function pluginFixture() {
  return {
    settings: {
      sourceLanguage: "auto", targetLanguage: "zh-Hans",
      primarySource: "Existing LLM", dictSource: "有道",
      bingApiKey: "existing-bing-key", bingRegion: "eastasia", cnkiToken: "existing-cnki-token",
      llmProfiles: [{ name: "Existing LLM", url: "https://example.invalid/v1/chat/completions",
        apiKey: "existing-llm-key", models: ["model-a"], activeModel: "model-a" }],
    },
    saves: [], refreshes: 0,
    async saveData(value) { this.saves.push(JSON.parse(JSON.stringify(value))); },
    refreshPanel() { this.refreshes++; },
  };
}
function profilesSnapshot(plugin) {
  return JSON.parse(JSON.stringify(plugin.settings.llmProfiles));
}
async function enterDraft(modal, option = "blank") {
  await creationPicker(modal.contentEl).choose(option);
  assert.ok(modal.draft, "Choosing a creation option must enter draft mode");
}
async function fillDraft(modal, { name, url, apiKey } = {}) {
  if (name !== undefined) await field(modal.contentEl, "配置名称").choose(name);
  if (url !== undefined) await field(modal.contentEl, "接口地址").choose(url);
  if (apiKey !== undefined) await field(modal.contentEl, "API Key").choose(apiKey);
}
async function addDraftModel(modal, model) {
  field(modal.contentEl, "添加模型").setValue(model);
  await button(modal.contentEl, "添加").click();
}
let passed = 0;
async function test(name, callback) {
  await callback();
  passed++;
  console.log("PASS", name);
}

(async () => {
  const plugin = pluginFixture();
  const initialProfiles = JSON.stringify(plugin.settings.llmProfiles);
  const modal = new sandbox.__ui.LLMConfigModal({}, plugin);
  modal.onOpen();
  await test("default manager shows only LLM profiles and a type selector", () => {
    assert.equal(modal.configType, "llm");
    expectFields(modal.contentEl, ["配置类型"]);
    assert.equal(nodes(modal.contentEl).find((n) => n.tagName === "h3").text, "翻译服务配置管理");
    assert.deepEqual(Object.keys(field(modal.contentEl, "配置类型").options), ["llm", "bing", "cnki"]);
    assert.equal(field(modal.contentEl, "配置类型").element.value, "llm");
    assert.equal(nodes(modal.contentEl).filter((n) => n.type === "password").length, 0);
    assert.equal(plugin.saves.length, 0);
  });
  await test("Bing selection shows only Bing fields and keeps stored values", async () => {
    await field(modal.contentEl, "配置类型").choose("bing");
    expectFields(modal.contentEl, ["配置类型", "Azure Translator Key", "Bing 区域"]);
    assert.equal(field(modal.contentEl, "Azure Translator Key").element.value, "existing-bing-key");
    assert.equal(field(modal.contentEl, "Azure Translator Key").element.type, "password");
    assert.equal(field(modal.contentEl, "Bing 区域").element.value, "eastasia");
    assert.equal(plugin.saves.length, 0);
  });
  await test("Bing edits trim and save only the corresponding stored fields", async () => {
    await field(modal.contentEl, "Azure Translator Key").choose("  updated-bing-key  ");
    await field(modal.contentEl, "Bing 区域").choose("  westus  ");
    assert.equal(plugin.settings.bingApiKey, "updated-bing-key");
    assert.equal(plugin.settings.bingRegion, "westus");
    assert.equal(plugin.settings.cnkiToken, "existing-cnki-token");
    assert.equal(plugin.saves.length, 2);
    assert.equal(plugin.saves[1].bingRegion, "westus");
  });
  await test("CNKI selection masks and preserves its token without showing Bing", async () => {
    await field(modal.contentEl, "配置类型").choose("cnki");
    expectFields(modal.contentEl, ["配置类型", "CNKI Token"]);
    assert.equal(field(modal.contentEl, "CNKI Token").element.value, "existing-cnki-token");
    assert.equal(field(modal.contentEl, "CNKI Token").element.type, "password");
    await field(modal.contentEl, "CNKI Token").choose("  updated-cnki-token  ");
    assert.equal(plugin.settings.cnkiToken, "updated-cnki-token");
    assert.equal(plugin.saves.length, 3);
    assert.equal(plugin.settings.bingApiKey, "updated-bing-key");
  });
  await test("repeated type switching never accumulates forms or changes active source/profiles", async () => {
    for (let i = 0; i < 5; i++) {
      await field(modal.contentEl, "配置类型").choose("bing");
      expectFields(modal.contentEl, ["配置类型", "Azure Translator Key", "Bing 区域"]);
      assert.equal(field(modal.contentEl, "Azure Translator Key").element.value, "updated-bing-key");
      await field(modal.contentEl, "配置类型").choose("cnki");
      expectFields(modal.contentEl, ["配置类型", "CNKI Token"]);
      await field(modal.contentEl, "配置类型").choose("llm");
      expectFields(modal.contentEl, ["配置类型"]);
    }
    assert.equal(plugin.settings.primarySource, "Existing LLM");
    assert.equal(JSON.stringify(plugin.settings.llmProfiles), initialProfiles);
    assert.equal(plugin.saves.length, 3);
  });
  await test("LLM editor retains its API key and repeated successful queries replace the form", async () => {
    await button(modal.contentEl, "编辑").click();
    const names = ["配置类型", "配置名称", "接口地址", "API Key", "默认模型", "添加模型"];
    expectFields(modal.contentEl, names);
    assert.equal(field(modal.contentEl, "API Key").element.value, "existing-llm-key");
    assert.equal(field(modal.contentEl, "API Key").element.type, "password");
    for (let i = 0; i < 3; i++) {
      await button(modal.contentEl, "查询模型").click();
      expectFields(modal.contentEl, names);
    }
    assert.equal(requests, 3);
    assert.equal(JSON.stringify(plugin.settings.llmProfiles[0].models), '["model-a","model-b"]');
    assert.equal(plugin.settings.primarySource, "Existing LLM");
  });
  await test("failed model query restores one form and can return to list", async () => {
    failModelRequest = true;
    await button(modal.contentEl, "查询模型").click();
    assert.equal(modal._modelQuerying, false);
    assert.equal(settings(modal.contentEl).length, 6);
    assert.ok(notices.some((notice) => notice.includes("查询失败")));
    await button(modal.contentEl, "← 返回").click();
    expectFields(modal.contentEl, ["配置类型"]);
    await button(modal.contentEl, "编辑").click();
    await field(modal.contentEl, "配置类型").choose("cnki");
    expectFields(modal.contentEl, ["配置类型", "CNKI Token"]);
    await field(modal.contentEl, "配置类型").choose("llm");
    expectFields(modal.contentEl, ["配置类型"]);
  });
  await test("main settings shows only the shared management entry, never provider credentials", () => {
    const tab = new sandbox.__ui.MiniTranslatorSettingTab({}, plugin);
    tab.display();
    const names = settings(tab.containerEl).map((s) => s.name);
    assert.equal(names.filter((name) => name === "大模型与 API 配置").length, 1);
    for (const name of ["Bing / Microsoft Translator", "Bing 区域", "CNKI 学术翻译", "Azure Translator Key", "CNKI Token"]) {
      assert.ok(!names.includes(name), `Main settings must not show ${name}`);
    }
    assert.equal(nodes(tab.containerEl).filter((n) => n.type === "password").length, 0);
    button(tab.containerEl, "管理配置").click();
    const opened = openedModals[openedModals.length - 1];
    assert.ok(opened instanceof sandbox.__ui.LLMConfigModal);
    expectFields(opened.contentEl, ["配置类型"]);
    tab.display();
    assert.equal(settings(tab.containerEl).length, names.length);
    tab.unsubSources?.();
  });
  await test("choosing either a preset or blank configuration opens an unsaved draft", async () => {
    for (const choosePreset of [true, false]) {
      const draftPlugin = pluginFixture();
      const before = profilesSnapshot(draftPlugin);
      const draftModal = new sandbox.__ui.LLMConfigModal({}, draftPlugin);
      draftModal.onOpen();
      const picker = creationPicker(draftModal.contentEl);
      const preset = Object.keys(picker.options).find((value) => value.startsWith("p:"));
      assert.ok(preset, "At least one built-in LLM preset is available");
      await enterDraft(draftModal, choosePreset ? preset : "blank");

      expectFields(draftModal.contentEl, [
        "配置类型", "配置名称", "接口地址", "API Key", "默认模型", "添加模型",
      ]);
      button(draftModal.contentEl, "取消");
      button(draftModal.contentEl, "确定创建");
      assert.equal(draftModal.editing, -1);
      assert.deepEqual(profilesSnapshot(draftPlugin), before);
      assert.equal(draftPlugin.saves.length, 0);
      assert.notStrictEqual(draftModal.draft, draftPlugin.settings.llmProfiles[0]);
    }
  });
  await test("draft edits, local model addition and model query never save before confirmation", async () => {
    failModelRequest = false;
    const draftPlugin = pluginFixture();
    const before = profilesSnapshot(draftPlugin);
    const draftModal = new sandbox.__ui.LLMConfigModal({}, draftPlugin);
    draftModal.onOpen();
    await enterDraft(draftModal);
    await fillDraft(draftModal, {
      name: "  Draft Provider  ",
      url: "  https://example.invalid/v1/chat/completions  ",
      apiKey: "  draft-secret  ",
    });
    await addDraftModel(draftModal, "local-model");
    assert.ok(draftModal.draft.models.includes("local-model"));
    assert.deepEqual(profilesSnapshot(draftPlugin), before);
    assert.equal(draftPlugin.saves.length, 0);

    const beforeRequests = requests;
    await button(draftModal.contentEl, "查询模型").click();
    assert.equal(requests, beforeRequests + 1);
    assert.ok(draftModal.draft.models.includes("model-a"));
    assert.ok(draftModal.draft.models.includes("model-b"));
    assert.deepEqual(profilesSnapshot(draftPlugin), before);
    assert.equal(draftPlugin.saves.length, 0);

    await button(draftModal.contentEl, "取消").click();
    assert.equal(draftModal.draft, null);
    expectFields(draftModal.contentEl, ["配置类型"]);
    assert.deepEqual(profilesSnapshot(draftPlugin), before);
    assert.equal(draftPlugin.saves.length, 0);
  });
  await test("switching configuration type or closing the modal discards a pending draft", async () => {
    const switchPlugin = pluginFixture();
    const switchBefore = profilesSnapshot(switchPlugin);
    const switchModal = new sandbox.__ui.LLMConfigModal({}, switchPlugin);
    switchModal.onOpen();
    const preset = Object.keys(creationPicker(switchModal.contentEl).options)
      .find((value) => value.startsWith("p:"));
    await enterDraft(switchModal, preset);
    await field(switchModal.contentEl, "配置类型").choose("bing");
    assert.equal(switchModal.draft, null);
    assert.deepEqual(profilesSnapshot(switchPlugin), switchBefore);
    assert.equal(switchPlugin.saves.length, 0);

    const closePlugin = pluginFixture();
    const closeBefore = profilesSnapshot(closePlugin);
    const closeModal = new sandbox.__ui.LLMConfigModal({}, closePlugin);
    closeModal.onOpen();
    await enterDraft(closeModal);
    await fillDraft(closeModal, { name: "Abandoned", url: "https://example.invalid/v1/chat/completions" });
    closeModal.close();
    assert.equal(closeModal.draft, null);
    assert.deepEqual(profilesSnapshot(closePlugin), closeBefore);
    assert.equal(closePlugin.saves.length, 0);
    assert.equal(closePlugin.refreshes, 1);
  });
  await test("blank draft validates name, URL and model while allowing an empty API key", async () => {
    const draftPlugin = pluginFixture();
    const before = profilesSnapshot(draftPlugin);
    const draftModal = new sandbox.__ui.LLMConfigModal({}, draftPlugin);
    draftModal.onOpen();
    await enterDraft(draftModal);

    await fillDraft(draftModal, { name: "   " });
    await button(draftModal.contentEl, "确定创建").click();
    assert.equal(draftPlugin.saves.length, 0, "A blank name must not be saved");
    assert.deepEqual(profilesSnapshot(draftPlugin), before);

    await fillDraft(draftModal, { name: "Unique Blank" });
    await button(draftModal.contentEl, "确定创建").click();
    assert.equal(draftPlugin.saves.length, 0, "A blank URL must not be saved");

    await fillDraft(draftModal, { url: "  https://example.invalid/v1/chat/completions  " });
    await button(draftModal.contentEl, "确定创建").click();
    assert.equal(draftPlugin.saves.length, 0, "A configuration without models must not be saved");

    await addDraftModel(draftModal, "draft-model");
    const confirm = button(draftModal.contentEl, "确定创建");
    await Promise.all([confirm.click(), confirm.click()]);
    assert.equal(draftPlugin.saves.length, 1);
    assert.equal(draftPlugin.settings.llmProfiles.length, 2);
    assert.deepEqual(draftPlugin.settings.llmProfiles[0], before[0], "Existing profiles remain unchanged");
    assert.deepEqual(profilesSnapshot(draftPlugin)[1], {
      name: "Unique Blank",
      url: "https://example.invalid/v1/chat/completions",
      apiKey: "",
      models: ["draft-model"],
      activeModel: "draft-model",
    });
    assert.equal(draftModal.draft, null);
    await confirm.click();
    assert.equal(draftPlugin.saves.length, 1, "A stale or repeated click must not create twice");
    assert.equal(draftPlugin.settings.llmProfiles.length, 2);
  });
  await test("a duplicate configuration name is rejected without changing stored profiles", async () => {
    const draftPlugin = pluginFixture();
    const before = profilesSnapshot(draftPlugin);
    const draftModal = new sandbox.__ui.LLMConfigModal({}, draftPlugin);
    draftModal.onOpen();
    await enterDraft(draftModal);
    await fillDraft(draftModal, {
      name: "  Existing LLM  ",
      url: "https://example.invalid/v1/chat/completions",
    });
    await addDraftModel(draftModal, "duplicate-model");
    const noticeCount = notices.length;
    await button(draftModal.contentEl, "确定创建").click();
    assert.deepEqual(profilesSnapshot(draftPlugin), before);
    assert.equal(draftPlugin.saves.length, 0);
    assert.ok(draftModal.draft, "An invalid draft remains editable");
    assert.ok(
      notices.slice(noticeCount).some((message) => /同名|已存在|重复/.test(message)),
      "Duplicate-name validation should explain why creation was rejected"
    );
  });
  await test("failed draft persistence is retryable and never exposes a half-created profile", async () => {
    const draftPlugin = pluginFixture();
    const before = profilesSnapshot(draftPlugin);
    let saveCalls = 0;
    let failSave = true;
    draftPlugin.saveData = async function (value) {
      saveCalls++;
      if (failSave) throw new Error("simulated persistence failure");
      this.saves.push(JSON.parse(JSON.stringify(value)));
    };
    const draftModal = new sandbox.__ui.LLMConfigModal({}, draftPlugin);
    draftModal.onOpen();
    await enterDraft(draftModal);
    await fillDraft(draftModal, {
      name: "Retryable Provider",
      url: "https://example.invalid/v1/chat/completions",
    });
    await addDraftModel(draftModal, "retry-model");
    const confirm = button(draftModal.contentEl, "确定创建");
    const cancel = button(draftModal.contentEl, "取消");
    const noticeCount = notices.length;

    await confirm.click();
    assert.equal(saveCalls, 1);
    assert.equal(draftPlugin.saves.length, 0);
    assert.deepEqual(profilesSnapshot(draftPlugin), before);
    assert.ok(draftModal.draft, "The failed draft remains available for correction or retry");
    assert.equal(confirm.disabled, false, "Confirm is re-enabled after a persistence failure");
    assert.equal(cancel.disabled, false, "Cancel is re-enabled after a persistence failure");
    assert.ok(
      notices.slice(noticeCount).some((message) => message.includes("创建失败")),
      "The user is told that creation failed"
    );

    failSave = false;
    await confirm.click();
    assert.equal(saveCalls, 2);
    assert.equal(draftPlugin.saves.length, 1, "Only the successful retry is persisted");
    assert.equal(draftPlugin.settings.llmProfiles.length, 2);
    assert.deepEqual(draftPlugin.settings.llmProfiles[0], before[0]);
    assert.equal(draftPlugin.settings.llmProfiles[1].name, "Retryable Provider");
    assert.equal(draftModal.draft, null);
  });
  await test("configuration manager renders in English when the UI locale changes", async () => {
    const i18n = require(path.join(__dirname, "..", "src", "i18n.js"));
    i18n.setUiLanguage("en");
    try {
      const englishModal = new sandbox.__ui.LLMConfigModal({}, pluginFixture());
      englishModal.onOpen();
      expectFields(englishModal.contentEl, ["Configuration type"]);
      assert.equal(
        nodes(englishModal.contentEl).find((node) => node.tagName === "h3").text,
        "Translation service configurations"
      );
      await field(englishModal.contentEl, "Configuration type").choose("bing");
      expectFields(englishModal.contentEl, [
        "Configuration type",
        "Azure Translator Key",
        "Bing region",
      ]);
    } finally {
      i18n.setUiLanguage("zh-CN");
    }
  });
  console.log(`ALL PASS (${passed} offline configuration UI tests)`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
