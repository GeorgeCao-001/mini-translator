// Mini Translator v0.4.0 — 对标 Translate for Zotero 的零配置翻译插件
// 引擎配方移植自 windingwind/zotero-pdf-translate（AGPL-3.0）：
//   youdao.ts / huoshanweb.ts / tencenttransmart.ts / google.ts（含 tk 算法）
const {
  Plugin,
  Notice,
  requestUrl,
  MarkdownView,
  ItemView,
  PluginSettingTab,
  Setting,
  DropdownComponent,
  Modal,
} = require("obsidian");

const WORD_RE = /^[a-zA-Z][a-zA-Z']*$/;
const VIEW_TYPE = "mini-translator-view";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36";

const CACHE = new Map();
const CACHE_MAX = 200;

function cached(key, fn) {
  if (CACHE.has(key)) return CACHE.get(key);
  const p = fn().then((v) => {
    if (CACHE.size >= CACHE_MAX) CACHE.delete(CACHE.keys().next().value);
    CACHE.set(key, v);
    return v;
  });
  return p;
}

function checkStatus(res, label) {
  if (res.status !== 200) throw new Error(`HTTP ${res.status} (${label})`);
}

// ---------- 逐句切分：句末标点 + 空格 + 大写开头才算一句（避开 0.5、et al. 等） ----------
function splitSentences(text) {
  const parts = text.split(/(?<=[.!?])\s+(?=[A-Z"(])/);
  const out = parts.map((p) => p.trim()).filter(Boolean);
  return out.length > 1 ? out : [text];
}

// ---------- 不可见字符清理：零宽字符、BOM、NBSP ----------
function cleanInvisibles(s) {
  return s
    .replace(/[​-‏⁠﻿]/g, "")
    .replace(/ /g, " ");
}

// ---------- 英文排版规范化：段落重排、弯引号、连字符续接、破折号 ----------
function typofixEn(s) {
  let t = cleanInvisibles(s);
  t = t.replace(/\r\n?/g, "\n");
  t = t.replace(/[ \t]+/g, " ");
  // PDF 复制的硬换行：空行保留为段落分隔，其余换行并入段落自然折行
  t = t.replace(/\n\s*\n/g, "");
  t = t.replace(/\s*\n\s*/g, " ");
  t = t.replace(//g, "\n\n");
  t = t.replace(/ +/g, " ");
  // 断行连字符续接：optimiza- tion → optimization
  t = t.replace(/([a-z])- ([a-z])/gi, "$1$2");
  // 弯引号、双连字符转破折号
  t = t.replace(/(^|[\s(\[{])"/g, "$1“")
    .replace(/"/g, "”")
    .replace(/(^|[\s(\[{])'/g, "$1‘")
    .replace(/'/g, "’")
    .replace(/\s--\s/g, " — ");
  return t.trim();
}

// ---------- 中文译文排版规范化：折叠空白、清 \r、全角空格、压缩空行 ----------
function typofixZh(s) {
  return cleanInvisibles(s)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t　]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// 译文段落重排：单个换行并入段落自然折行，空行保留为段落分隔（词典释义不适用）
function reflowZh(s) {
  let t = typofixZh(s);
  t = t.replace(/\n\s*\n/g, "");
  t = t.replace(/\s*\n\s*/g, "");
  t = t.replace(//g, "\n\n");
  return t;
}

// ---------- 双语成对渲染：原文行弱化，译文行正常，人读的对照排版 ----------
// 无论原文还是译文、无论来自哪个源，展示前统一过一遍排版处理
function renderPairsTo(el, pairs) {
  el.empty();
  el.addClass("mini-flow");
  for (const p of pairs) {
    el.createDiv({ text: typofixEn(p.en), cls: "mini-en-line" });
    el.createDiv({
      text: typofixZh(p.zh),
      cls: p.dict ? "mini-dict-line" : "mini-zh-line",
    });
  }
}

// ---------- 单词：百度 sug（免 Key，释义简） ----------
async function baiduDictLookup(word) {
  const res = await requestUrl({
    url: `https://fanyi.baidu.com/sug?kw=${encodeURIComponent(word)}`,
    headers: { "user-agent": UA },
  });
  checkStatus(res, "百度sug");
  const data = res.json;
  if (!data || !Array.isArray(data.data) || data.data.length === 0) {
    throw new Error("未找到释义");
  }
  return data.data
    .slice(0, 4)
    .map((d) => d.v)
    .filter(Boolean)
    .join("\n");
}

// ---------- 单词：有道词典（免 Key，解析网页；含音标，词性分行） ----------
// 纯词性行判定（n. / vt.& vi. 等）
const POSISH_RE = /^(?:[a-z]{1,4}\.\s*&?\s*)+$/i;

function splitPosTokens(line) {
  const parts = line.split(
    /(?=(?:vt\.&\s*vi\.|vt\.|(?<!vt\.&\s)vi\.|n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|num\.|art\.|int\.|aux\.|abbr\.)\s)/
  );
  return parts.map((p) => p.trim()).filter(Boolean);
}

// 词形变化标注（全角/半角括号都算）：（present 的过去式和过去分词）
const ANN_RE = /[（(][^（）()]*的(过去式|过去分词|第三人称|现在分词|名词复数|复数|比较级|最高级)[^（）()]*[）)]/;

function mergeablePos(s) {
  return POSISH_RE.test(s) || /^[英美]$/.test(s);
}

async function youdaoDictLookup(word) {
  const res = await requestUrl({
    url: `https://www.youdao.com/w/${encodeURIComponent(word)}/`,
    headers: { "user-agent": UA },
  });
  checkStatus(res, "有道词典");
  let html = String(res.text || "");
  // 先剔除 script/style/注释，避免 JS、CSS 文本混进释义
  html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<style[\s\S]*?<\/style>/gi, "");
  html = html.replace(/<!--[\s\S]*?-->/g, "");
  html = html.replace(/(\r\n|\n|\r)/gm, "");
  const m = html.match(
    /<div id="phrsListTab.*webTrans" class="trans-wrapper trans-tab">/gm
  );
  if (!m || m.length === 0) throw new Error("未找到释义");
  let tgt = m[0].replace(/<[^>]*>?/gm, "\n");
  tgt = tgt.replace(/\n\s*\n/g, "\n");
  tgt = tgt.replace(/[ \t]+/g, " ");
  const out = [];
  for (const l of tgt.split("\n")) {
    let line = l.trim();
    if (!line) continue;
    // 剥离「…的过去式/复数」等词形变化标注，保留其余释义
    while (ANN_RE.test(line)) line = line.replace(ANN_RE, " ").trim();
    if (!line) continue;
    // 一行塞多个词性时拆开；纯词性行与后一行释义合并；「英/美」与音标合并
    for (const part of splitPosTokens(line)) {
      if (out.length && mergeablePos(out[out.length - 1])) {
        out[out.length - 1] += " " + part;
      } else {
        out.push(part);
      }
    }
  }
  // 「英 [..]」和「美 [..]」合并为一行
  const merged = [];
  for (let i = 0; i < out.length; i++) {
    if (
      /^英 \[/.test(out[i]) &&
      i + 1 < out.length &&
      /^美 \[/.test(out[i + 1])
    ) {
      merged.push(out[i] + " " + out[i + 1]);
      i++;
    } else {
      merged.push(out[i]);
    }
  }
  // 丢弃末尾没有释义的裸词性行
  while (merged.length && POSISH_RE.test(merged[merged.length - 1])) {
    merged.pop();
  }
  if (merged.length === 0) throw new Error("未找到释义");
  return merged.join("\n");
}

// ---------- 单词：牛津（Oxford Learner's Dictionaries，免 Key，英英释义） ----------
async function oxfordDictLookup(word) {
  const res = await requestUrl({
    url: `https://www.oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(word)}`,
    headers: { "user-agent": UA },
  });
  checkStatus(res, "牛津");
  const doc = new DOMParser().parseFromString(res.text, "text/html");
  // 结构：.top-g（词性块）与释义列表在文档序中交错，释义跟随对应的词性块。
  // 按文档序遍历：top-g 开启新词性组，随后的 .sense 释义归入该组；
  // 词性为空的 top-g（习语块如 break step）吞掉跟随的释义、不显示。
  const scope = doc.querySelector("#entryContent") || doc;
  const items = scope.querySelectorAll(".top-g, .sense");
  const groups = [];
  let current = null;
  for (const item of items) {
    if (item.classList.contains("top-g")) {
      const posEl = item.querySelector(".webtop .pos");
      const pos = posEl ? posEl.textContent.trim() : "";
      current = { pos, defs: [], hidden: !pos };
      groups.push(current);
    } else if (current) {
      // 只取直接属于该义项的释义（嵌套子义项由各自的 .sense 单独处理），并去重
      const def = item.querySelector(
        ":scope > .sensetop > .def, :scope > .def"
      );
      const t = def ? def.textContent.trim() : "";
      if (t && !current.defs.includes(t)) current.defs.push(t);
    }
  }
  const br = doc.querySelector(".phons_br .phon");
  const am = doc.querySelector(".phons_n_am .phon");
  const parts = [];
  if (br) parts.push(`英 ${br.textContent.trim()}`);
  if (am) parts.push(`美 ${am.textContent.trim()}`);
  const phoneticLine = parts.join(" ");
  const lines = [];
  for (const g of groups) {
    if (g.hidden) continue;
    if (g.defs.length > 0) lines.push(`${g.pos} ${g.defs.join("; ")}`);
    else lines.push(g.pos);
  }
  if (lines.length === 0) throw new Error("未找到释义");
  return (phoneticLine ? phoneticLine + "\n" : "") + lines.join("\n");
}

// ---------- 单词：DeepSeek（LLM 词典：音标 + 每词性一行、释义分号分隔） ----------
const DICT_PROMPT =
  "你是学术英语词典助手。对给定的英文单词，输出：\n" +
  "第一行：音标，格式「英 [..] 美 [..]」，未知则省略这一行。\n" +
  "之后每行一个词性（n. / v. / adj. / adv. / prep. 等），该词性的不同释义用中文分号「；」分隔。\n" +
  "重点覆盖该词在数学、工程、计算机等学术文献中的常用义。\n" +
  "只输出以上内容，不要任何解释。";

// ---------- 内置词典 + 大模型词典（配置即源） ----------
const BUILTIN_DICTS = [
  { name: "百度", fn: baiduDictLookup },
  { name: "有道词典", fn: youdaoDictLookup },
  { name: "牛津", fn: oxfordDictLookup, en: true },
];

// 词典源下拉选项 = 内置词典 + 每个大模型配置
function dictOptions() {
  return [
    ...BUILTIN_DICTS.map((d) => d.name),
    ...profileNames().filter(
      (n) => !BUILTIN_DICTS.some((d) => d.name === n)
    ),
  ];
}

async function dictLookup(word, primary) {
  // 选中的是大模型配置：直接用它查词（不回退，避免隐性切换）
  const prof = findProfile(primary);
  if (prof) {
    if (!prof.url) throw new Error("该配置未填接口地址");
    if (!prof.apiKey) throw new Error("该配置未填 API Key");
    return { text: await llmRequest(word, prof, DICT_PROMPT), via: prof.name };
  }
  const order = [
    primary,
    ...BUILTIN_DICTS.map((d) => d.name).filter((n) => n !== primary),
  ];
  for (const name of order) {
    const dict = BUILTIN_DICTS.find((d) => d.name === name);
    try {
      const raw = await dict.fn(word);
      // 中文词典源统一半角分号为全角（中文排版规范）；英英词典保持英文标点
      const text = dict.en ? raw : raw.replace(/;/g, "；");
      return { text, via: name };
    } catch (e) {
      console.log(`[mini-translator] 词典 ${name} 失败:`, e.message || e);
    }
  }
  throw new Error("全部词典源失败");
}

// ---------- 句子：有道网页版（免 Key，GET 零技巧） ----------
async function youdaoTranslate(text) {
  const res = await requestUrl({
    url: `http://fanyi.youdao.com/translate?&doctype=json&type=EN2ZH_CN&i=${encodeURIComponent(text)}`,
    headers: { "user-agent": UA },
  });
  checkStatus(res, "有道");
  const out = [];
  for (const seg of res.json.translateResult || []) {
    for (const p of seg) out.push(p.tgt);
  }
  if (out.length === 0) throw new Error("空结果");
  return out.join("");
}

// ---------- 句子：火山网页版（免 Key，最简 JSON POST） ----------
async function huoshanTranslate(text) {
  const res = await requestUrl({
    url: "https://translate.volcengine.com/crx/translate/v1",
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": UA },
    body: JSON.stringify({ source_language: "en", target_language: "zh", text }),
  });
  checkStatus(res, "火山");
  if (!res.json || !res.json.translation) throw new Error("空结果");
  return res.json.translation;
}

// ---------- 句子：腾讯交互翻译（免 Key，固定 client_key） ----------
async function tencentTranslate(text) {
  const res = await requestUrl({
    url: "https://transmart.qq.com/api/imt",
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": UA,
      referer: "https://transmart.qq.com/zh-CN/index",
    },
    body: JSON.stringify({
      header: {
        fn: "auto_translation",
        client_key:
          "browser-chrome-110.0.0-Mac OS-df4bd4c5-a65d-44b2-a40f-42f34f3535f2-1677486696487",
      },
      type: "plain",
      model_category: "normal",
      source: { lang: "en", text_list: [text] },
      target: { lang: "zh" },
    }),
  });
  checkStatus(res, "腾讯");
  if (!res.json || !res.json.auto_translation) throw new Error("空结果");
  return res.json.auto_translation.join("\n").trim();
}

// ---------- 句子：谷歌翻译（免 Key gtx 端点，需要 tk 签名；国内需代理） ----------
function googleTk(a) {
  // 算法照抄 Google 网页版自身（via zotero-pdf-translate google.ts）
  const b = 406644;
  const b1 = 3293161072;
  const $b = "+-a^+6";
  const Zb = "+-3^+b+-f";
  function RL(a, b) {
    const t = "a";
    const Yb = "+";
    let d;
    for (let c = 0; c < b.length - 2; c += 3) {
      d = b.charAt(c + 2);
      d = d >= t ? d.charCodeAt(0) - 87 : Number(d);
      d = b.charAt(c + 1) == Yb ? a >>> d : a << d;
      a = b.charAt(c) == Yb ? (a + d) & 4294967295 : a ^ d;
    }
    return a;
  }
  const e = [];
  let f = 0;
  for (let g = 0; g < a.length; g++) {
    let m = a.charCodeAt(g);
    if (128 > m) e[f++] = m;
    else if (2048 > m) {
      e[f++] = (m >> 6) | 192;
      e[f++] = (m & 63) | 128;
    } else {
      if (
        55296 == (m & 64512) &&
        g + 1 < a.length &&
        56320 == (a.charCodeAt(g + 1) & 64512)
      ) {
        m = 65536 + ((m & 1023) << 10) + (a.charCodeAt(++g) & 1023);
        e[f++] = (m >> 18) | 240;
        e[f++] = ((m >> 12) & 63) | 128;
      } else {
        e[f++] = (m >> 12) | 224;
      }
      e[f++] = ((m >> 6) & 63) | 128;
      e[f++] = (m & 63) | 128;
    }
  }
  a = b;
  for (f = 0; f < e.length; f++) {
    a += e[f];
    a = RL(a, $b);
  }
  a = RL(a, Zb);
  a ^= b1 || 0;
  if (0 > a) a = (a & 2147483647) + 2147483648;
  a %= 1e6;
  return a.toString() + "." + (a ^ b);
}

async function googleTranslate(text) {
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx" +
    "&sl=en&tl=zh-CN&hl=en" +
    "&dt=at&dt=bd&dt=ex&dt=ld&dt=md&dt=qca&dt=rw&dt=rm&dt=ss&dt=t" +
    `&source=bh&ssel=0&tsel=0&kc=1&tk=${googleTk(text)}&q=${encodeURIComponent(text)}`;
  const res = await requestUrl({ url, headers: { "user-agent": UA } });
  checkStatus(res, "谷歌");
  const arr = res.json;
  if (!Array.isArray(arr) || !Array.isArray(arr[0])) throw new Error("空结果");
  let out = "";
  for (const seg of arr[0]) {
    if (seg && seg[0]) out += seg[0];
  }
  if (!out) throw new Error("空结果");
  return out;
}

// ---------- 句子：大模型（OpenAI 兼容 LLM API，端点/Key/模型均可配） ----------
let PLUGIN_SETTINGS = null;


const TRANSLATE_PROMPT =
  "你是学术论文翻译助手。把用户给出的英文翻译成中文：忠实原文、术语准确、符合中文学术表达习惯。只输出译文，不要任何解释或原文。";

// ---------- 内置大模型预设（OpenAI 兼容端点；含默认模型列表，可再查询） ----------
const LLM_PRESETS = [
  {
    name: "DeepSeek",
    url: "https://api.deepseek.com/chat/completions",
    models: ["deepseek-v4-flash", "deepseek-v4-pro"],
  },
  {
    name: "OpenAI",
    url: "https://api.openai.com/v1/chat/completions",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
  },
  {
    name: "Kimi（月之暗面）",
    url: "https://api.moonshot.cn/v1/chat/completions",
    models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
  },
  {
    name: "通义千问",
    url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    models: ["qwen-plus", "qwen-max", "qwen-turbo"],
  },
  {
    name: "智谱 GLM",
    url: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    models: ["glm-4-flash", "glm-4-plus"],
  },
  {
    name: "硅基流动",
    url: "https://api.siliconflow.cn/v1/chat/completions",
    models: ["Qwen/Qwen2.5-7B-Instruct", "deepseek-ai/DeepSeek-V3"],
  },
  {
    name: "Ollama（本地）",
    url: "http://localhost:11434/v1/chat/completions",
    models: ["llama3.1", "qwen2.5", "mistral"],
  },
];

// ---------- 模型自动查询：调 OpenAI 兼容的 /models 端点 ----------
async function fetchModels(baseUrl, apiKey) {
  let b = (baseUrl || "")
    .replace(/\/chat\/completions\/?$/i, "")
    .replace(/\/+$/, "");
  if (!b) throw new Error("请先填写接口地址");
  const headers = { "user-agent": UA };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  const res = await requestUrl({ url: b + "/models", headers });
  checkStatus(res, "模型查询");
  const data = res.json;
  const list = Array.isArray(data && data.data)
    ? data.data.map((m) => m.id || m).filter(Boolean)
    : [];
  if (list.length === 0) throw new Error("接口未返回模型列表");
  return list;
}

// ---------- 大模型配置查找：每个配置就是一个独立的翻译源，按名字匹配 ----------
function findProfile(name) {
  return (PLUGIN_SETTINGS?.llmProfiles || []).find((p) => p.name === name) || null;
}

function profileNames() {
  return (PLUGIN_SETTINGS?.llmProfiles || []).map((p) => p.name);
}

// 缓存键要含模型：同一配置换模型后不能复用旧缓存
function sourceKey(name) {
  const prof = findProfile(name);
  return prof ? `${name}#${prof.activeModel || ""}` : name;
}

// ---------- 弹窗：大模型配置管理（每个配置 = 一个翻译源） ----------
class LLMConfigModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.editing = -1;
  }
  onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass("mini-llm-modal");
    this.render();
  }
  onClose() {
    // 关闭管理弹窗后，面板立即反映配置变更（新源、改名、删源等）
    this.plugin.refreshPanel();
  }
  render() {
    const c = this.contentEl;
    c.empty();
    c.createEl("h3", { text: "大模型配置管理" });
    if (this.editing >= 0) {
      this.renderEdit(this.editing);
      return;
    }
    const list = this.plugin.settings.llmProfiles || [];
    c.createEl("div", {
      text: "每个配置是一个独立翻译源，保存后出现在「翻译源」下拉里。",
      cls: "setting-item-description",
    }).style.marginBottom = "12px";
    if (list.length === 0) {
      c.createEl("div", { text: "还没有配置", cls: "setting-item-description" });
    }
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const row = c.createDiv();
      row.style.cssText =
        "display:flex;align-items:center;gap:10px;margin-bottom:6px;padding:6px 8px;border:1px solid var(--background-modifier-border);border-radius:8px;";
      row.createSpan({ text: p.name }).style.flex = "1";
      row.createSpan({
        text: `${(p.models || []).length} 个模型`,
        cls: "setting-item-description",
      });
      const editBtn = row.createEl("button", { text: "编辑" });
      editBtn.onclick = () => {
        this.editing = i;
        this.render();
      };
      const delBtn = row.createEl("button", { text: "删除" });
      delBtn.onclick = async () => {
        list.splice(i, 1);
        if (this.plugin.settings.primarySource === p.name) {
          this.plugin.settings.primarySource = "有道";
        }
        await this.plugin.saveData(this.plugin.settings);
        this.render();
      };
    }
    const addRow = c.createDiv();
    addRow.style.marginTop = "12px";
    const dd = new DropdownComponent(addRow);
    dd.addOption("", "从预设创建配置…");
    for (const pr of LLM_PRESETS) dd.addOption("p:" + pr.name, pr.name);
    dd.addOption("blank", "空白配置");
    dd.onChange(async (v) => {
      if (!v) return;
      let entry;
      if (v === "blank") {
        entry = { name: "新配置", url: "", apiKey: "", models: [], activeModel: "" };
      } else {
        const pr = LLM_PRESETS.find((x) => "p:" + x.name === v);
        entry = {
          name: pr.name,
          url: pr.url,
          apiKey: "",
          models: [...pr.models],
          activeModel: pr.models[0],
        };
      }
      list.push(entry);
      await this.plugin.saveData(this.plugin.settings);
      this.editing = list.length - 1;
      this.render();
    });
  }
  renderEdit(idx) {
    const c = this.contentEl;
    const list = this.plugin.settings.llmProfiles || [];
    const p = list[idx];
    if (!p) {
      this.editing = -1;
      this.render();
      return;
    }
    const back = c.createEl("button", { text: "← 返回" });
    back.onclick = () => {
      this.editing = -1;
      this.render();
    };
    c.createEl("h4", { text: "配置：" + p.name }).style.marginTop = "10px";

    new Setting(c)
      .setName("配置名称")
      .addText((t) =>
        t.setValue(p.name).onChange(async (v) => {
          const old = p.name;
          p.name = v.trim() || p.name;
          if (this.plugin.settings.primarySource === old) {
            this.plugin.settings.primarySource = p.name;
          }
          await this.plugin.saveData(this.plugin.settings);
        })
      );
    new Setting(c)
      .setName("接口地址")
      .setDesc("Chat Completions 完整端点")
      .addText((t) =>
        t
          .setPlaceholder("https://api.deepseek.com/chat/completions")
          .setValue(p.url || "")
          .onChange(async (v) => {
            p.url = v.trim();
            await this.plugin.saveData(this.plugin.settings);
          })
      );
    new Setting(c)
      .setName("API Key")
      .setDesc("该配置下所有模型共用这个 Key")
      .addText((t) => {
        t.inputEl.type = "password";
        t.setPlaceholder("sk-...")
          .setValue(p.apiKey || "")
          .onChange(async (v) => {
            p.apiKey = v.trim();
            await this.plugin.saveData(this.plugin.settings);
          });
      });

    new Setting(c)
      .setName("默认模型")
      .setDesc("翻译时使用该配置下的哪个模型")
      .addDropdown((dd) => {
        for (const m of p.models || []) dd.addOption(m, m);
        dd.setValue(p.activeModel || (p.models && p.models[0]) || "");
        dd.onChange(async (v) => {
          p.activeModel = v;
          await this.plugin.saveData(this.plugin.settings);
        });
      })
      .addButton((b) =>
        b.setButtonText("查询模型").setCta().onClick(async () => {
          try {
            const list2 = await fetchModels(p.url, p.apiKey);
            for (const m of list2) if (!p.models.includes(m)) p.models.push(m);
            if (!p.activeModel) p.activeModel = p.models[0];
            await this.plugin.saveData(this.plugin.settings);
            new Notice(`已获取 ${list2.length} 个模型`, 2000);
            this.renderEdit(idx);
          } catch (e) {
            new Notice(`查询失败：${e.message}`, 6000);
          }
        })
      );

    let modelInput = null;
    new Setting(c)
      .setName("添加模型")
      .addText((t) => {
        t.setPlaceholder("模型名，如 deepseek-v4-pro");
        t.inputEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            const v = t.inputEl.value.trim();
            if (v && !p.models.includes(v)) {
              p.models.push(v);
              p.activeModel = v;
              this.plugin.saveData(this.plugin.settings);
            }
            this.renderEdit(idx);
          }
        });
        modelInput = t;
      })
      .addButton((b) =>
        b.setButtonText("添加").onClick(() => {
          const v = modelInput && modelInput.inputEl.value.trim();
          if (v && !p.models.includes(v)) {
            p.models.push(v);
            p.activeModel = v;
            this.plugin.saveData(this.plugin.settings);
          }
          this.renderEdit(idx);
        })
      )
      .addButton((b) =>
        b.setButtonText("移除默认模型").onClick(async () => {
          const cur = p.activeModel || (p.models && p.models[0]);
          if (!cur) return;
          p.models = (p.models || []).filter((m) => m !== cur);
          p.activeModel = p.models[0] || "";
          await this.plugin.saveData(this.plugin.settings);
          this.renderEdit(idx);
        })
      );

    if ((p.models || []).length > 0) {
      const chips = c.createDiv();
      chips.style.cssText =
        "display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;padding:0 12px;";
      for (const m of p.models) {
        const chip = chips.createEl("span", { text: m });
        chip.style.cssText =
          "font-size:var(--font-smaller);padding:2px 8px;border-radius:12px;background:var(--background-secondary);border:1px solid var(--background-modifier-border);";
        if (m === p.activeModel) {
          chip.style.borderColor = "var(--interactive-accent)";
          chip.style.color = "var(--interactive-accent)";
        }
        chip.onclick = async () => {
          p.activeModel = m;
          await this.plugin.saveData(this.plugin.settings);
          this.renderEdit(idx);
        };
      }
    }
  }
}

// ---------- 弹窗：输入预设名称 ----------
class PromptModal extends Modal {
  constructor(app, title, placeholder, onSubmit) {
    super(app);
    this.title = title;
    this.placeholder = placeholder;
    this.onSubmit = onSubmit;
  }
  onOpen() {
    this.contentEl.createEl("h3", { text: this.title });
    const input = this.contentEl.createEl("input", {
      type: "text",
      placeholder: this.placeholder,
    });
    input.style.width = "100%";
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.close();
        this.onSubmit(input.value.trim());
      }
    });
    const btn = this.contentEl.createEl("button", { text: "确定" });
    btn.onclick = () => {
      this.close();
      this.onSubmit(input.value.trim());
    };
    input.focus();
  }
}

async function llmRequest(text, profile, systemPrompt) {
  const model = profile.activeModel || (profile.models && profile.models[0]);
  if (!model) throw new Error("未选择模型：请先在设置里查询或添加模型");
  const res = await requestUrl({
    url: profile.url,
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${profile.apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      stream: false,
      messages: [
        {
          role: "system",
          content: systemPrompt || TRANSLATE_PROMPT,
        },
        { role: "user", content: text },
      ],
    }),
  });
  checkStatus(res, "大模型");
  const data = res.json;
  let out = data?.choices?.[0]?.message?.content?.trim();
  if (!out) {
    throw new Error(
      "空结果: " + (data?.error?.message || JSON.stringify(data).slice(0, 200))
    );
  }
  // 去掉模型偶尔输出的代码围栏
  out = out.replace(/^```[a-zA-Z]*\s*/, "").replace(/```\s*$/, "").trim();
  return out;
}

// ---------- 引擎注册表：新增引擎 = 写一个 translate 函数 + 在这里加一行 ----------
// 未来加其他 LLM（OpenAI 兼容 API）：照抄 deepseekTranslate 改 URL/模型即可。
const ENGINES = [
  { name: "有道", fn: youdaoTranslate },
  { name: "火山", fn: huoshanTranslate },
  { name: "腾讯", fn: tencentTranslate },
  { name: "谷歌", fn: googleTranslate },
];

// 翻译源下拉选项 = 内置引擎 + 每个大模型配置（配置即源）
function engineOptions() {
  return [
    ...ENGINES.map((e) => e.name),
    ...profileNames().filter((n) => !ENGINES.some((e) => e.name === n)),
  ];
}

async function translateSentence(text, primary) {
  // 若选中的是某个大模型配置，直接用该配置翻译（不回退到免费源，避免隐性切换）
  const prof = findProfile(primary);
  if (prof) {
    return { text: await llmRequest(text, prof), via: prof.name };
  }
  const order = [
    primary,
    ...ENGINES.map((e) => e.name).filter((n) => n !== primary),
  ];
  for (const name of order) {
    const fn = ENGINES.find((e) => e.name === name).fn;
    try {
      return { text: await fn(text), via: name };
    } catch (e) {
      console.log(`[mini-translator] ${name} 失败:`, e.message || e);
    }
  }
  throw new Error("全部翻译源失败");
}

// ---------- 侧边栏视图（双语逐句对照 + 选翻译源 + 复制） ----------
class MiniTranslatorView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.lastResult = "";
  }
  getViewType() {
    return VIEW_TYPE;
  }
  getDisplayText() {
    return "Mini Translator";
  }
  getIcon() {
    return "languages";
  }
  async onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass("mini-translator-panel");

    const header = this.contentEl.createDiv({ cls: "mini-panel-header" });
    header.createSpan({ text: "翻译源", cls: "mini-label" });
    this.sourceDropdown = new DropdownComponent(header);
    for (const eng of ENGINES) this.sourceDropdown.addOption(eng.name, eng.name);
    this.sourceDropdown
      .setValue(this.plugin.settings.primarySource)
      .onChange(async (v) => {
        this.plugin.settings.primarySource = v;
        await this.plugin.saveData(this.plugin.settings);
        this.updateModelRow();
      });
    // 词典源下拉
    header.createSpan({ text: "词典", cls: "mini-label" });
    this.dictDropdown = new DropdownComponent(header);
    for (const d of dictOptions()) this.dictDropdown.addOption(d, d);
    this.dictDropdown
      .setValue(this.plugin.settings.dictSource)
      .onChange(async (v) => {
        this.plugin.settings.dictSource = v;
        await this.plugin.saveData(this.plugin.settings);
      });
    // 模型选择行（仅当翻译源是某个大模型配置时显示）：列出该源的模型，选中即切换
    this.modelRow = this.contentEl.createDiv();
    this.modelRow.style.display = "none";
    this.modelRow.style.marginTop = "4px";
    this.modelRow.createSpan({ text: "模型", cls: "mini-label" });
    this.modelDropdown = new DropdownComponent(this.modelRow);
    this.modelDropdown.selectEl.style.flex = "1";
    this.modelDropdown.onChange(async (v) => {
      const prof = findProfile(this.plugin.settings.primarySource);
      if (prof) {
        prof.activeModel = v;
        await this.plugin.saveData(this.plugin.settings);
      }
    });
    this.copyBtn = header.createEl("button", {
      text: "复制译文",
      cls: "mini-copy-btn",
    });
    this.copyBtn.onclick = async () => {
      if (!this.lastResult) return;
      await navigator.clipboard.writeText(this.lastResult);
      new Notice("已复制", 1500);
    };

    this.flowEl = this.contentEl.createDiv({ cls: "mini-flow" });
    this.metaEl = this.contentEl.createDiv({ cls: "mini-meta" });

    this.emptyEl = this.contentEl.createDiv({
      cls: "mini-empty",
      text: "选中文本后按快捷键\n原文与译文逐句对照显示在这里",
    });
    this.showPlaceholder();
  }
  showPlaceholder() {
    this.flowEl.hide();
    this.metaEl.hide();
    this.copyBtn.hide();
    this.emptyEl.show();
    this.lastResult = "";
  }
  show(pairs, meta) {
    this.emptyEl.hide();
    this.flowEl.show();
    this.metaEl.show();
    this.copyBtn.show();
    renderPairsTo(this.flowEl, pairs);
    this.metaEl.setText(meta || "");
    this.lastResult = pairs
      .map((p) => typofixEn(p.en) + "\n" + typofixZh(p.zh))
      .join("\n\n");
  }
  // 每次同步重建选项，确保设置页/管理弹窗里的改动立即反映到面板
  syncSource() {
    if (this.sourceDropdown) {
      this.sourceDropdown.selectEl.empty();
      for (const n of engineOptions()) this.sourceDropdown.addOption(n, n);
      this.sourceDropdown.setValue(this.plugin.settings.primarySource);
    }
    if (this.dictDropdown) {
      this.dictDropdown.selectEl.empty();
      for (const d of dictOptions()) this.dictDropdown.addOption(d, d);
      this.dictDropdown.setValue(this.plugin.settings.dictSource);
    }
    this.updateModelRow();
  }

  updateModelRow() {
    if (!this.modelRow || !this.modelDropdown) return;
    const source = this.plugin.settings.primarySource;
    const prof = findProfile(source);
    this.modelRow.style.display = prof ? "" : "none";
    if (!prof) return;
    const dd = this.modelDropdown;
    dd.selectEl.empty();
    for (const m of prof.models || []) dd.addOption(m, m);
    const cur = prof.activeModel || (prof.models && prof.models[0]) || "";
    if (cur) dd.setValue(cur);
  }
}

// ---------- 设置页 ----------
class MiniTranslatorSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl)
      .setName("主翻译源（句子）")
      .setDesc("内置免费源 + 你配置的大模型源。谷歌需代理，国内直连不通；大模型源失败不回退免费源")
      .addDropdown((dd) => {
        for (const n of engineOptions()) dd.addOption(n, n);
        dd.setValue(this.plugin.settings.primarySource).onChange(async (v) => {
          this.plugin.settings.primarySource = v;
          await this.plugin.saveData(this.plugin.settings);
          this.plugin.refreshPanel();
        });
      });

    new Setting(containerEl)
      .setName("词典源（单词）")
      .setDesc("内置词典 + 大模型配置。牛津为英英释义；有道含中文音标释义；大模型配置给出学术语境义")
      .addDropdown((dd) => {
        for (const d of dictOptions()) dd.addOption(d, d);
        dd.setValue(this.plugin.settings.dictSource).onChange(async (v) => {
          this.plugin.settings.dictSource = v;
          await this.plugin.saveData(this.plugin.settings);
          this.plugin.refreshPanel();
        });
      });

    // ---------- 大模型：配置即源，管理入口独立弹窗 ----------
    containerEl.createEl("h3", { text: "大模型翻译（OpenAI 兼容 API）" });
    const llmCount = (this.plugin.settings.llmProfiles || []).length;
    new Setting(containerEl)
      .setName("大模型配置")
      .setDesc(
        `已配置 ${llmCount} 个源：${(this.plugin.settings.llmProfiles || [])
          .map((p) => p.name)
          .join("、") || "无"}。每个配置是一个独立翻译源，保存后直接出现在「主翻译源」下拉里`
      )
      .addButton((b) =>
        b.setButtonText("管理配置").setCta().onClick(() => {
          new LLMConfigModal(this.app, this.plugin).open();
        })
      );

    new Setting(containerEl)
      .setName("导入 / 导出配置")
      .setDesc("把全部大模型配置（地址、Key、模型）导出为 JSON 文件，或从 JSON 文件导入")
      .addButton((b) =>
        b.setButtonText("导出").onClick(() => {
          const data = {
            version: 2,
            llmProfiles: this.plugin.settings.llmProfiles || [],
          };
          const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json",
          });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "mini-translator-llm-config.json";
          a.click();
          URL.revokeObjectURL(a.href);
          new Notice("已导出大模型配置", 2000);
        })
      )
      .addButton((b) =>
        b.setButtonText("导入").onClick(() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = ".json,application/json";
          input.onchange = async () => {
            const file = input.files && input.files[0];
            if (!file) return;
            try {
              const parsed = JSON.parse(await file.text());
              const s = this.plugin.settings;
              if (Array.isArray(parsed.llmProfiles) && parsed.llmProfiles.length) {
                // 按名称合并：新名字追加，同名覆盖
                const known = new Map(
                  (s.llmProfiles || []).map((p) => [p.name, p])
                );
                for (const p of parsed.llmProfiles) {
                  if (p.name) known.set(p.name, p);
                }
                s.llmProfiles = Array.from(known.values());
              } else if (parsed.url) {
                // 兼容 v1 格式（单配置）
                s.llmProfiles = [
                  {
                    name: "导入配置",
                    url: parsed.url || "",
                    apiKey: parsed.apiKey || "",
                    models: parsed.model ? [parsed.model] : [],
                    activeModel: parsed.model || "",
                  },
                ];
              }
              await this.plugin.saveData(s);
              new Notice("已导入大模型配置", 2000);
              this.plugin.refreshPanel();
              this.display();
            } catch (e) {
              new Notice(`导入失败：${e.message}`, 6000);
            }
          };
          input.click();
        })
      );

    containerEl.createEl("h3", { text: "自动翻译" });
    new Setting(containerEl)
      .setName("划线停留自动翻译")
      .setDesc("开启后，选中英文停留片刻自动翻译（整段模式），无需按快捷键")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.autoTranslate).onChange(async (v) => {
          this.plugin.settings.autoTranslate = v;
          await this.plugin.saveData(this.plugin.settings);
        })
      );
    new Setting(containerEl)
      .setName("停留时长（秒）")
      .setDesc("选中后停留多久触发自动翻译")
      .addSlider((sl) =>
        sl
          .setLimits(0.5, 5, 0.5)
          .setValue(this.plugin.settings.autoTranslateDelay)
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.autoTranslateDelay = v;
            await this.plugin.saveData(this.plugin.settings);
          })
      );
  }
}

module.exports = class MiniTranslator extends Plugin {
  async onload() {
    this.settings = Object.assign(
      {
        primarySource: "有道",
        dictSource: "百度",
        autoTranslate: false,
        autoTranslateDelay: 2,
        llmProfiles: [],
        activeProfile: 0,
      },
      await this.loadData()
    );
    // 迁移旧版设置（v1.2 及更早的 llmUrl/llmApiKey/llmModel/customPresets）到大模型配置数组
    if (!Array.isArray(this.settings.llmProfiles) || this.settings.llmProfiles.length === 0) {
      const profiles = [];
      if (this.settings.llmUrl || this.settings.llmApiKey || this.settings.llmModel) {
        profiles.push({
          name: "默认配置",
          url: this.settings.llmUrl || "",
          apiKey: this.settings.llmApiKey || "",
          models: this.settings.llmModel ? [this.settings.llmModel] : [],
          activeModel: this.settings.llmModel || "",
        });
      }
      for (const p of this.settings.customPresets || []) {
        profiles.push({
          name: p.name,
          url: p.url || "",
          apiKey: p.apiKey || "",
          models: p.model ? [p.model] : [],
          activeModel: p.model || "",
        });
      }
      if (profiles.length === 0) {
        profiles.push({
          name: LLM_PRESETS[0].name,
          url: LLM_PRESETS[0].url,
          apiKey: "",
          models: [...LLM_PRESETS[0].models],
          activeModel: LLM_PRESETS[0].models[0],
        });
      }
      this.settings.llmProfiles = profiles;
      this.settings.activeProfile = 0;
    }
    if (
      this.settings.primarySource === "DeepSeek" ||
      this.settings.primarySource === "大模型"
    ) {
      this.settings.primarySource =
        (this.settings.llmProfiles &&
          this.settings.llmProfiles[0] &&
          this.settings.llmProfiles[0].name) ||
        "有道";
    }
    if (this.settings.dictSource === "DeepSeek") {
      this.settings.dictSource = "大模型";
    }
    await this.saveData(this.settings);
    PLUGIN_SETTINGS = this.settings;
    console.log("[mini-translator] v1.3.0 已加载");

    this.registerView(VIEW_TYPE, (leaf) => {
      // 自己持有面板实例引用；leaf.view 在新版 Obsidian 里不保证返回插件实例
      this.panelView = new MiniTranslatorView(leaf, this);
      return this.panelView;
    });
    try {
      this.addRibbonIcon("languages", "打开 Mini Translator 面板", () =>
        this.activateView()
      );
    } catch (e) {
      console.log("[mini-translator] 功能区图标添加失败:", e);
    }
    this.addSettingTab(new MiniTranslatorSettingTab(this.app, this));

    this.addCommand({
      id: "translate-selection",
      name: "翻译选中文本（逐句）",
      callback: () => this.translateSelection("sentence"),
    });

    this.addCommand({
      id: "translate-selection-paragraph",
      name: "翻译选中文本（整段）",
      callback: () => this.translateSelection("paragraph"),
    });

    this.addCommand({
      id: "open-panel",
      name: "打开翻译面板",
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: "toggle-auto-translate",
      name: "切换划线自动翻译",
      callback: async () => {
        this.settings.autoTranslate = !this.settings.autoTranslate;
        await this.saveData(this.settings);
        new Notice(
          `划线自动翻译：${this.settings.autoTranslate ? "开" : "关"}`,
          2000
        );
      },
    });

    this.addCommand({
      id: "self-test",
      name: "自检全部翻译源",
      callback: async () => {
        const results = [];
        for (const name of dictOptions()) {
          const prof = findProfile(name);
          try {
            const r = prof
              ? await llmRequest("trajectory", prof, DICT_PROMPT)
              : await BUILTIN_DICTS.find((d) => d.name === name).fn("trajectory");
            results.push(`✓ 词典源(${name}): ${r.split("\n").slice(0, 2).join(" | ")}`);
          } catch (e) {
            results.push(`✗ 词典源(${name}): ${e.message || e}`);
          }
        }
        for (const name of engineOptions()) {
          const prof = findProfile(name);
          try {
            const r = prof
              ? await llmRequest("This is a test.", prof)
              : await ENGINES.find((e) => e.name === name).fn("This is a test.");
            results.push(`✓ 句子源(${name}): ${r}`);
          } catch (e) {
            results.push(`✗ 句子源(${name}): ${e.message || e}`);
          }
        }
        new Notice(results.join("\n"), 10000);
      },
    });

    this.addCommand({
      id: "diagnose",
      name: "诊断环境",
      callback: () => this.diagnose(),
    });

    // 划线停留自动翻译（开关在设置里，默认关闭）
    this.registerDomEvent(document, "selectionchange", () =>
      this.onSelectionChanged()
    );
  }

  onunload() {
    this.closePopup();
    if (this.dwellTimer) clearTimeout(this.dwellTimer);
  }

  // 设置/配置变更后通知面板立即刷新（选项重建 + 当前值同步），并清空翻译缓存
  refreshPanel() {
    CACHE.clear();
    if (this.panelView) this.panelView.syncSource();
  }

  onSelectionChanged() {
    if (!this.settings.autoTranslate) return;
    if (this.dwellTimer) clearTimeout(this.dwellTimer);
    const sel = window.getSelection();
    const t = ((sel && sel.toString()) || "").trim();
    if (!t || !/[a-zA-Z]/.test(t)) return;
    // 弹窗内部的选中不触发
    if (this.popupEl && sel.anchorNode && this.popupEl.contains(sel.anchorNode)) {
      return;
    }
    const delay = (this.settings.autoTranslateDelay ?? 2) * 1000;
    this.dwellTimer = setTimeout(() => {
      this.dwellTimer = null;
      const cur = window.getSelection();
      const curText = ((cur && cur.toString()) || "").trim();
      if (!curText || !/[a-zA-Z]/.test(curText)) return;
      this.translateSelection("paragraph");
    }, delay);
  }

  async activateView() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false);
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
  }

  // ---------- 诊断 ----------
  diagnose() {
    const L = [];
    const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
    L.push("活动 Markdown 视图: " + (mdView ? "有" : "无"));
    if (mdView && mdView.editor) {
      const sel = mdView.editor.getSelection() || "";
      L.push("编辑器选区长度: " + sel.length);
      const pos = mdView.editor.getCursor("to");
      for (const mode of ["window", "local"]) {
        try {
          const c = mdView.editor.coordsAtPos(pos, mode);
          L.push(
            `coordsAtPos(${mode}): ` +
              (c ? `${Math.round(c.left)},${Math.round(c.top)}` : "null")
          );
        } catch (e) {
          L.push(`coordsAtPos(${mode}) 异常: ${e.message}`);
        }
      }
    }
    const pdfLeaves = this.app.workspace.getLeavesOfType("pdf");
    L.push("PDF 面板数: " + pdfLeaves.length);
    const ae = document.activeElement;
    L.push(
      "焦点元素: " +
        (ae
          ? ae.tagName +
            (ae.tagName === "IFRAME"
              ? ""
              : "." + (ae.className || "").toString().slice(0, 40))
          : "null")
    );
    if (ae && ae.tagName === "IFRAME") {
      try {
        const sel = ae.contentWindow.getSelection();
        L.push(
          "iframe 选区: " +
            (sel ? `可访问, 长度 ${sel.toString().length}` : "null")
        );
      } catch (e) {
        L.push("iframe 访问异常: " + e.message);
      }
    }
    new Notice(L.join("\n"), 10000);
  }

  // ---------- 选区旁弹窗 ----------
  showPopup(text, x, y, via, pending) {
    this.closePopup();
    this.lastPopupPos = { x, y };
    const el = document.body.createDiv();
    el.addClass("mini-translator-popup");
    Object.assign(el.style, {
      position: "fixed",
      left: Math.max(8, x) + "px",
      top: Math.max(8, y) + "px",
      zIndex: "1000",
      maxWidth: "480px",
      background: "var(--background-primary)",
      color: "var(--text-normal)",
      border: "1px solid var(--background-modifier-border)",
      borderRadius: "10px",
      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)",
      fontFamily: "var(--font-interface)",
    });
    const header = el.createDiv();
    Object.assign(header.style, {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "6px 12px",
      borderBottom: "1px solid var(--background-modifier-border)",
      fontSize: "var(--font-smaller)",
      color: "var(--text-muted)",
    });
    this.popupHeaderEl = header;
    header.createSpan({
      text: pending ? "翻译中…" : via ? `翻译 · ${via}` : "Mini Translator",
    });
    // 拖动：按住头部任意空白处移动
    header.style.cursor = "move";
    header.style.userSelect = "none";
    let sx = 0;
    let sy = 0;
    let ox = 0;
    let oy = 0;
    header.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      sx = e.clientX;
      sy = e.clientY;
      const rect = el.getBoundingClientRect();
      ox = rect.left;
      oy = rect.top;
      const onMove = (ev) => {
        el.style.left = ox + ev.clientX - sx + "px";
        el.style.top = oy + ev.clientY - sy + "px";
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      e.preventDefault();
    });
    const body = el.createDiv();
    Object.assign(body.style, {
      padding: "10px 12px",
      maxHeight: "50vh",
      overflow: "auto",
    });
    this.popupBodyEl = body;
    if (pending) {
      const spin = body.createSpan();
      spin.style.cssText =
        "display:inline-block;width:14px;height:14px;border:2px solid var(--background-modifier-border);border-top-color:var(--interactive-accent);border-radius:50%;margin-right:8px;vertical-align:-2px;";
      spin.animate(
        [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
        { duration: 700, iterations: Infinity }
      );
      this.pendingLabel = body.createSpan({ text: "翻译中…" });
      this.pendingLabel.style.color = "var(--text-muted)";
    } else {
      body.setText(text);
    }
    document.body.appendChild(el);
    const rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      el.style.left = Math.max(8, window.innerWidth - rect.width - 8) + "px";
    }
    if (rect.bottom > window.innerHeight) {
      el.style.top = Math.max(8, window.innerHeight - rect.height - 8) + "px";
    }
    this.popupEl = el;
    this._dismissMouse = (e) => {
      if (this.popupEl && !this.popupEl.contains(e.target)) this.closePopup();
    };
    document.addEventListener("mousedown", this._dismissMouse, true);
    this._dismissKey = (e) => {
      if (e.key === "Escape") this.closePopup();
    };
    document.addEventListener("keydown", this._dismissKey);
  }

  updatePending(text) {
    if (this.pendingLabel) this.pendingLabel.textContent = text;
  }

  updatePopupPairs(pairs, via) {
    if (!this.popupEl || !this.popupBodyEl) {
      const p = this.lastPopupPos || { x: window.innerWidth - 520, y: 80 };
      this.showPopup("", p.x, p.y, via);
    }
    const labelSpan = this.popupHeaderEl.querySelector("span");
    if (labelSpan) {
      labelSpan.textContent = via ? `翻译 · ${via}` : "Mini Translator";
    }
    this.pendingLabel = null;
    renderPairsTo(this.popupBodyEl, pairs);
  }

  failPopup(msg) {
    if (!this.popupEl) {
      new Notice(`翻译失败：${msg}`, 8000);
      return;
    }
    const labelSpan = this.popupHeaderEl.querySelector("span");
    if (labelSpan) labelSpan.textContent = "翻译失败";
    this.pendingLabel = null;
    this.popupBodyEl.empty();
    this.popupBodyEl.setText(msg);
  }

  closePopup() {
    if (this.popupEl) {
      this.popupEl.remove();
      this.popupEl = null;
    }
    if (this._dismissMouse) {
      document.removeEventListener("mousedown", this._dismissMouse, true);
      this._dismissMouse = null;
    }
    if (this._dismissKey) {
      document.removeEventListener("keydown", this._dismissKey);
      this._dismissKey = null;
    }
  }

  // ---------- PDF 选区：三路策略 ----------
  readIframeSelection(iframe) {
    try {
      const sel = iframe.contentWindow.getSelection();
      const text = sel.toString().trim();
      if (!text) return null;
      let x = null;
      let y = null;
      if (sel.rangeCount > 0) {
        const r = sel.getRangeAt(0).getBoundingClientRect();
        const b = iframe.getBoundingClientRect();
        x = b.left + r.left;
        y = b.top + r.bottom + 6;
      }
      return { text, x, y };
    } catch (e) {
      console.log("[mini-translator] iframe 读取失败:", e);
      return null;
    }
  }

  getPdfSelectionInfo() {
    const pdfLeaves = this.app.workspace.getLeavesOfType("pdf");
    const tried = [];
    // 策略1：主窗口选区（1.8+ 可能内联渲染 PDF）
    const mainSel = window.getSelection();
    if (mainSel && mainSel.rangeCount > 0) {
      const t = mainSel.toString().trim();
      if (t) {
        const r = mainSel.getRangeAt(0).getBoundingClientRect();
        tried.push(["主窗口选区", { text: t, x: r.left, y: r.bottom + 6 }]);
      }
    }
    // 策略2：焦点元素是 iframe
    const ae = document.activeElement;
    if (ae && ae.tagName === "IFRAME") {
      const info = this.readIframeSelection(ae);
      if (info) tried.push(["iframe(焦点)", info]);
    }
    // 策略3：唯一 PDF 面板的容器里找 iframe
    if (pdfLeaves.length === 1) {
      const iframe = pdfLeaves[0].view.containerEl.querySelector("iframe");
      if (iframe) {
        const info = this.readIframeSelection(iframe);
        if (info) tried.push(["iframe(容器)", info]);
      }
    }
    for (const [label, info] of tried) {
      console.log(
        "[mini-translator] PDF 选区来源:",
        label,
        "|",
        info.text.slice(0, 30)
      );
      return info;
    }
    console.log(
      "[mini-translator] PDF 选区：三路策略全部未取到文本 | pdf面板数:",
      pdfLeaves.length,
      "| 焦点元素:",
      ae ? ae.tagName : "null"
    );
    return null;
  }

  async translateSelection(mode = "sentence") {
    console.log("[mini-translator] 命令已触发");
    const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
    let text = "";
    let x = null;
    let y = null;
    if (mdView && mdView.editor) {
      text = (mdView.editor.getSelection() || "").trim();
      const pos = mdView.editor.getCursor("to");
      let coords = mdView.editor.coordsAtPos(pos, "window");
      let isWindow = true;
      if (!coords) {
        coords = mdView.editor.coordsAtPos(pos, "local");
        isWindow = false;
      }
      if (coords) {
        if (isWindow) {
          x = coords.left;
          y = coords.bottom + 6;
        } else {
          const base = mdView.editor.containerEl.getBoundingClientRect();
          x = base.left + coords.left;
          y = base.top + coords.bottom + 6;
        }
      }
    } else {
      const info = this.getPdfSelectionInfo();
      if (info) {
        text = info.text;
        x = info.x;
        y = info.y;
      }
    }
    if (!text) {
      new Notice("没有拿到选中的文本：请在笔记或 PDF 里先选中文本再按快捷键", 6000);
      return;
    }
    // 立刻弹窗（等待动画），结果到了原地填充
    const px = x != null ? x : window.innerWidth - 520;
    const py = y != null ? y : 80;
    this.showPopup("", px, py, null, true);
    const t0 = Date.now();
    try {
      const pairs = [];
      let via = "";
      // 数据层统一重排版：词典保留每词性一行；句子/段落译文重排为自然段落
      const fmtDict = (t) => typofixZh(t);
      const fmtFlow = (t) => reflowZh(t);
      if (WORD_RE.test(text)) {
        const r = await cached(
          `dict:${sourceKey(this.settings.dictSource)}:${text}`,
          () => dictLookup(text, this.settings.dictSource)
        );
        pairs.push({ en: typofixEn(text), zh: fmtDict(r.text), dict: true });
        via = r.via;
      } else if (mode === "paragraph") {
        // 整段翻译：一次请求，原文段与译文段上下对照
        const r = await cached(
          `src:${sourceKey(this.settings.primarySource)}:${text}`,
          () => translateSentence(text, this.settings.primarySource)
        );
        pairs.push({ en: typofixEn(text), zh: fmtFlow(r.text) });
        via = r.via;
      } else {
        // 逐句独立翻译 → 原文译文逐句天然对齐
        const sentences = splitSentences(text);
        const vias = new Set();
        for (let i = 0; i < sentences.length; i++) {
          const r = await cached(
            `src:${sourceKey(this.settings.primarySource)}:${sentences[i]}`,
            () => translateSentence(sentences[i], this.settings.primarySource)
          );
          pairs.push({ en: typofixEn(sentences[i]), zh: fmtFlow(r.text) });
          vias.add(r.via);
          if (sentences.length > 1) {
            this.updatePending(`翻译中 ${i + 1}/${sentences.length}…`);
          }
        }
        via = Array.from(vias).join("/");
      }
      const meta = `${via} · ${Date.now() - t0}ms`;
      if (this.panelView) {
        this.panelView.syncSource();
        this.panelView.show(pairs, meta);
      }
      this.updatePopupPairs(pairs, via);
      console.log("[mini-translator] 耗时", Date.now() - t0, "ms | 源:", via);
    } catch (e) {
      this.failPopup(e.message || String(e));
    }
  }
};
