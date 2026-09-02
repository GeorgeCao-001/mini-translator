// Mini Translator v3.0.30 — 对标 Translate for Zotero 的零配置翻译插件
// v3.0.30：自动划词翻译增加低打扰取消机制：等待期间点击任意位置或按 Esc 即可取消，
//         翻译悬浮窗增加明确的关闭/取消按钮，并校验选区在等待期间未发生变化；
// v3.0.29：翻译悬浮窗改为内容自适应宽度，短句更紧凑、长句限制在可读范围内；
// v3.0.28：悬浮窗恢复一次性高质量译文输出，等待阶段用三个动态圆点提示；
//         保留完整选区一次请求和紧凑弹窗，避免把服务端批量响应硬做成难看的流式动画。
// v3.0.26：悬浮球动效增强——新增全局旋转流光（core 内锥形楔块绕核扫过）、光晕掺金
//         呼吸、整球轻浮动、高光透明度起伏，各皮肤动画幅度与频率加大（动态感更明显）；
//         边缘加淡金描边：外圈 1px 锥形渐变金环（mask 环形镂空）+ 内缘香槟金描边 +
//         金色内辉与高光暖尾，全部亮色、无深色成分，不复现黑边问题
// v3.0.25：悬浮球去黑边（删深色 outline、压淡外阴影），皮肤名改显示英文 id
// v3.0.24：全文翻译移除「输出形式」选项——Markdown 输出固定纯中文译文
//         （双语对照排版效果差；bilingual 字段不再写入，旧设置自动失效）
// v3.0.23：设置页「悬浮球皮肤」加实时预览——复用 createOrbElement + 皮肤 token
//         纯展示渲染（不挂控制器），下拉切换即时重绘当前皮肤
// v3.0.22：悬浮球换成 translation-orb 皮肤体系——vendor 纯 DOM 模块
//         （translation-orb.js 原样引入，经绝对路径锚点加载），内置水墨/星云/
//         潮汐/琥珀/冰棱五款玻璃质感皮肤 + 深浅主题自动适配 + 方向键微调 +
//         点击(<5px)回弹进度窗；皮肤与拖动位置存 settings，设置页可选可重置
// v3.0.21：彻底修双 ✕——放弃按 class 删/隐原生关闭按钮（其挂载点与命名随版本
//         变化，两轮修复均漏网），改为删除自绘 ✕、直接复用原生按钮：点击走
//         close() 未完成转最小化，行为不变，构造上只可能有一个 ✕
// v3.0.20：悬浮球渐变对比拉满（40% 白混强调色 → 原色，90deg 纯左右），
//         波动感三重化：渐变窗口漂移 + 上下轻浮 + 呼吸缩放
// v3.0.19：全文翻译完成后不再自动跳转到译文文件（不抢当前工作区焦点），
//         产出路径改由完成通知给出
// v3.0.18：进度窗只留一个 ✕——Obsidian 原生关闭按钮新版挂在 modal 外层导致 CSS
//         隐藏失效，改为 onOpen 里从容器直接移除；悬浮球去彩改净——两色左右渐变
//         （主题强调色浅→深）+ 轻微波动动画，不再旋转/不再多彩光晕
// v3.0.17：修复最小化后悬浮球进度环冻结——翻译阶段进度全靠 120ms 动画心跳重画，
//         最小化时误把它停了；现在最小化期间心跳继续跑，球实时跟随真实进度。
//         token 计数取整显示（fmtTok <10000 时不再吐出原始浮点数）
// v3.0.16：悬浮球重做为极光渐变球——旋转锥形渐变内核 + 呼吸彩色光晕 + 3D 高光，
//         外圈渐变细环画真实进度，去掉全部文字；隐藏 Modal 自带关闭按钮修复双 ✕
// v3.0.15：修复最小化后 Obsidian 全屏点不动——根因是隐藏的弹窗遮罩层仍在拦截指针；
//         最小化改为彻底拆除 Modal DOM 与键盘 scope（引擎状态留在实例上，悬浮球照常刷），
//         点悬浮球时 open() 完整重建进度窗，状态无缝续上
// v3.0.14：悬浮球重设计——SVG 圆环进度（不显示数字）+ 呼吸光晕 + hover 百分比气泡，
//         提取阶段自动切旋转弧线；缩小体积/降 z-index，减少对 Obsidian 的遮挡
// v3.0.13：进度窗 ✕ / ESC / 点击外部 = 最小化成悬浮球（翻译继续跑），点击悬浮球弹回完整进度窗
// v3.0.12：原版式 HTML 复刻改为可选（默认关）——关闭时跳过页面渲染/每页原图/HTML，
//         只生成纯 Markdown 双语笔记，显著提速
// v3.0.11：token/ETA 流式且不虚报——撤销乐观计数，token 显示值在模态框内每 120ms
//         向真实消耗值平滑插值（落后真实）；心跳间隔 600ms→250ms
// v3.0.10：进度/token/ETA 实时更新——token 一发出即计入（含在途），加 600ms 心跳
//         在批次在途期间持续推送，不再等一批完成才刷新
// v3.0.9：合并冗余 worker 文件——只保留 pdf.worker.js 一份（blob URL 主路径与
//         pdf.js 内部 fake-worker 兜底共用），删除内容重复的 pdf.worker.min.js
// v3.0.8：取消翻译时自动删除本次生成的产物（Markdown / HTML / 页图目录），保持 vault 干净
// v3.0.7：进度条以 1% 为步长匀速推进——update() 不再直接拽显示位置，位置只由
//         tick() 每帧最多 +1% 爬向目标（目标 = 整体速率×时长，夹在真实进度与 +8% 之间）
// v3.0.6：取消按钮秒停（Promise.race 竞速失效在途请求，跳过渲染/打开快速收尾）；
//         进度条匀速爬动（EMA 速率估计 + 种子速率，不再一批一跳）；启动提速（选择器
//         已解析的 PDF 文档直接复用，开跑免二次解析；进度条开跑即动）
// v3.0.5：按用户要求彻底移除独立浏览器进度窗代码，进度窗只保留应用内可拖动弹窗
// v3.0.3：修复致命 bug——插件内 require('./相对路径') 锚在 Obsidian 应用根而非插件目录，
//         导致自带 pdf.js 加载失败、所有 PDF 无法解析。改为多锚点绝对路径加载
//         （__dirname → vault basePath + manifest.dir → 相对兜底），并加锚定模拟回归测试
// v3.0.2：进度窗改为独立浏览器窗口（本地 HTTP+SSE，不遮挡 Obsidian、任务栏可见、跨平台）；
//         进度条持续爬动不卡顿；翻译 3 路并发 + 批容量上调，整体提速约 3 倍
// v3.0.1：公式定界符归一（\( \)\[ \] → $/$$）修复渲染；全文翻译改为大模型源专用，全部文本块进管线
// 源状态架构：统一中枢广播——任何界面改动 源/模型/词典/选中状态，落盘即全界面实时同步
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
  renderMath,
  finishRenderMath,
  setIcon,
  shell,
} = require("obsidian");

const WORD_RE = /^[a-zA-Z][a-zA-Z']*$/;
const VIEW_TYPE = "mini-translator-view";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36";

const CACHE = new Map();
const CACHE_MAX = 200;
const POPUP_BODY_MAX_HEIGHT = "min(280px, 42vh)";
const POPUP_MIN_WIDTH = "min(180px, calc(100vw - 16px))";
const POPUP_MAX_WIDTH = "min(420px, calc(100vw - 16px))";
const POPUP_MAX_WIDTH_PX = 420;

// ---------- 源状态中枢（统一广播）：任何界面对 翻译源/词典/模型/选中状态 的改动，
// 落盘后自动通知所有注册的界面立即重建。界面自己不关心别人，只管订阅。 ----------
const SOURCE_SYNC_LISTENERS = new Set();

// 注册同步器，返回取消订阅函数；listener 收到广播时按当前 settings 重建自己的 UI
function onSourcesSync(listener) {
  SOURCE_SYNC_LISTENERS.add(listener);
  return () => SOURCE_SYNC_LISTENERS.delete(listener);
}

function broadcastSources(origin) {
  for (const fn of Array.from(SOURCE_SYNC_LISTENERS)) {
    try {
      fn(origin);
    } catch (e) {
      console.warn("[mini-translator] 源同步失败:", e);
    }
  }
}

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

// LaTeX 界定符：$...$、$$...$$、\(...\)、\[...\]（大模型常输出后两种）
const MATH_RE = /(\$\$[\s\S]*?\$\$|\$[^$\n]*\$|\\\[[\s\S]*?\\\]|\\\([^$\n]*?\\\))/g;

// ---------- 数学公式占位保护：翻译前替换，翻译后还原（任何引擎都不会翻坏公式） ----------
function protectMath(text) {
  const map = [];
  const t = text.replace(MATH_RE, (m) => {
    map.push(m);
    return `⟦MT${map.length - 1}⟧`;
  });
  return { text: t, map };
}

function restoreMath(text, map) {
  return text.replace(/⟦MT(\d+)⟧/g, (m, i) => map[Number(i)] || m);
}

// ---------- 逐句切分：句末标点 + 空格 + 大写开头才算一句（避开 0.5、et al. 等），且不切断公式 ----------
function splitSentences(text) {
  const { text: t, map } = protectMath(text);
  const parts = t.split(/(?<=[.!?])\s+(?=[A-Z"(])/);
  const out = parts.map((p) => restoreMath(p.trim(), map)).filter(Boolean);
  return out.length > 1 ? out : [text];
}

// ---------- 不可见字符清理：零宽字符、BOM、NBSP ----------
function cleanInvisibles(s) {
  return s
    .replace(/[​-‏⁠﻿]/g, "")
    .replace(/ /g, " ");
}

// ---------- 数学字符规范化：PDF 文本层常把数学字母导出为 Unicode 专用数学区字符 ----------
const SUPER_MAP = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3",
  "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
  "⁺": "+", "⁻": "-", "⁼": "=", "⁽": "(", "⁾": ")", "ⁿ": "n",
};
const SUB_MAP = {
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4",
  "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
  "₊": "+", "₋": "-", "₌": "=", "₍": "(", "₎": ")",
};

// 粗体/斜体拉丁字母块（U+1D400–U+1D467）转回 ASCII；其余花体/哥特/双线块不确定，不动
function plane1Letter(ch) {
  const c = ch.codePointAt(0);
  if (c >= 0x1d400 && c <= 0x1d419) return String.fromCharCode(c - 0x1d400 + 65); // 𝐀-𝐙
  if (c >= 0x1d41a && c <= 0x1d433) return String.fromCharCode(c - 0x1d41a + 97); // 𝐚-𝐳
  if (c >= 0x1d434 && c <= 0x1d44d) return String.fromCharCode(c - 0x1d434 + 65); // 𝐴-𝑍
  if (c === 0x1d455) return "h"; // ℎ Planck 常量，占用了斜体 h 的码位
  if (c >= 0x1d44e && c <= 0x1d467) return String.fromCharCode(c - 0x1d44e + 97); // 𝑎-𝑧
  return ch;
}

// 无损还原：连续上标串 → ^xxx，连续下标串 → _xxx；数学减号 − → -
function demathify(s) {
  s = s.replace(/[\u{1d400}-\u{1d467}]/gu, plane1Letter);
  s = s.replace(
    /[⁰-⁹⁺-⁾ⁿ¹²³]+/g,
    (run) => "^" + Array.from(run).map((ch) => SUPER_MAP[ch]).join("")
  );
  s = s.replace(
    /[₀-₉₊-₎]+/g,
    (run) => "_" + Array.from(run).map((ch) => SUB_MAP[ch]).join("")
  );
  return s.replace(/−/g, "-");
}

// ---------- 全文翻译：pdf.js 文本层 → 行（带几何） → 段落（带 bbox） → 翻译块 ----------
// 把 textContent.items 按基线 y 聚成行（保留每行的横向范围），行内按 x 排序拼接。
// v3 起返回带几何的块（x0/x1/yMax/yMin/h，PDF 坐标系，y 向上），
// 老接口 pdfItemsToLines / pdfLinesToParagraphs 是它的投影，行为与旧版完全一致。
function pdfItemsToBlocks(items) {
  const rows = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const x = it.transform[4];
    const y = it.transform[5];
    const h = Math.abs(it.transform[3]) || 10;
    let row = null;
    for (const r of rows) {
      if (Math.abs(r.y - y) <= Math.max(2, h * 0.4)) {
        row = r;
        break;
      }
    }
    const endX = x + (it.width || it.str.length * 4);
    if (!row) {
      row = { y, h, x0: x, x1: endX, items: [] };
      rows.push(row);
    }
    row.items.push({ x, endX, str: it.str });
    if (x < row.x0) row.x0 = x;
    if (endX > row.x1) row.x1 = endX;
    if (h > row.h) row.h = h;
  }
  rows.sort((a, b) => b.y - a.y); // 页面自上而下
  return rows
    .map((r) => {
      r.items.sort((a, b) => a.x - b.x);
      let s = "";
      let prevEnd = null;
      for (const it of r.items) {
        if (!it.str) continue;
        // 片段间有明显横向间隙且两侧无空格时补空格，避免单词粘连
        if (
          prevEnd !== null &&
          it.x - prevEnd > 1 &&
          !/\s$/.test(s) &&
          !/^\s/.test(it.str)
        )
          s += " ";
        s += it.str;
        prevEnd = it.endX;
      }
      return {
        text: s.replace(/\s+/g, " ").trim(),
        y: r.y,
        x0: r.x0,
        x1: r.x1,
        h: r.h,
      };
    })
    .filter((l) => l.text);
}

function pdfItemsToLines(items) {
  return pdfItemsToBlocks(items).map((b) => ({ text: b.text, y: b.y }));
}

// 行合并成段落：行距显著大于本页典型行距 → 新段落；行尾连字符 → 去连字符拼接。
// 每个段落同时给出联合 bbox（PDF 坐标）：yMax=顶线基线上方、yMin=底线基线下方
function mergeLinesToParas(lines) {
  if (!lines.length) return [];
  const diffs = [];
  for (let i = 1; i < lines.length; i++) {
    const d = lines[i - 1].y - lines[i].y;
    if (d > 0) diffs.push(d);
  }
  diffs.sort((a, b) => a - b);
  const lead = diffs.length ? diffs[Math.floor(diffs.length / 2)] : 12;
  const paras = [];
  let cur = null;
  let prevY = null;
  const flush = () => {
    if (!cur) return;
    const t = cur.text.replace(/\s+/g, " ").trim();
    if (t)
      paras.push({
        text: demathify(cleanInvisibles(t)),
        x0: cur.x0,
        x1: cur.x1,
        yMax: cur.yMax,
        yMin: cur.yMin,
        h: cur.h,
      });
    cur = null;
  };
  for (const ln of lines) {
    const topEdge = ln.y + ln.h * 0.85;
    const botEdge = ln.y - ln.h * 0.25;
    if (!cur) {
      cur = { text: ln.text, x0: ln.x0, x1: ln.x1, yMax: topEdge, yMin: botEdge, h: ln.h };
      prevY = ln.y;
      continue;
    }
    const gap = prevY - ln.y;
    if (gap > lead * 1.45) {
      flush();
      cur = { text: ln.text, x0: ln.x0, x1: ln.x1, yMax: topEdge, yMin: botEdge, h: ln.h };
    } else if (/[A-Za-z]-$/.test(cur.text)) {
      cur.text = cur.text.slice(0, -1) + ln.text; // 断行连字符续接：optimiza- tion → optimization
      if (ln.x0 < cur.x0) cur.x0 = ln.x0;
      if (ln.x1 > cur.x1) cur.x1 = ln.x1;
      if (botEdge < cur.yMin) cur.yMin = botEdge;
    } else {
      cur.text += " " + ln.text;
      if (ln.x0 < cur.x0) cur.x0 = ln.x0;
      if (ln.x1 > cur.x1) cur.x1 = ln.x1;
      if (botEdge < cur.yMin) cur.yMin = botEdge;
    }
    prevY = ln.y;
  }
  flush();
  return paras;
}

function pdfLinesToParagraphs(lines) {
  return mergeLinesToParas(lines).map((b) => b.text);
}

// ---------- 数学片段保护：LaTeX 不被排版处理破坏 ----------
function mapMath(text, fn) {
  return text
    .split(MATH_RE)
    .map((p, i) => (i % 2 === 1 ? cleanInvisibles(p) : fn(p)))
    .join("");
}

// ---------- 英文排版规范化：段落重排、弯引号、连字符续接、破折号 ----------
function typofixEn(s) {
  return mapMath(s, baseTypofixEn);
}

function baseTypofixEn(s) {
  let t = cleanInvisibles(s);
  t = t.replace(/\r\n?/g, "\n");
  t = t.replace(/[ \t]+/g, " ");
  // PDF 复制的硬换行：空行保留为段落分隔，其余换行并入段落自然折行
  t = t.replace(/\n\s*\n/g, "\u0001");
  t = t.replace(/\s*\n\s*/g, " ");
  t = t.replace(/\u0001/g, "\n\n");
  t = t.replace(/ +/g, " ");
  // 断行连字符续接：optimiza- tion → optimization
  t = t.replace(/([a-z])- ([a-z])/gi, "$1$2");
  // 弯引号、双连字符转破折号
  t = t
    .replace(/(^|[\s(\[{])"/g, "$1\u201c")
    .replace(/"/g, "\u201d")
    .replace(/(^|[\s(\[{])'/g, "$1\u2018")
    .replace(/'/g, "\u2019")
    .replace(/\s--\s/g, " \u2014 ");
  return t.trim();
}

// ---------- 中文译文排版规范化：折叠空白、清 \r、全角空格、压缩空行 ----------
function typofixZh(s) {
  return mapMath(s, baseTypofixZh);
}

function baseTypofixZh(s) {
  return cleanInvisibles(s)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t　]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// 译文段落重排：单个换行并入段落自然折行，空行保留为段落分隔（词典释义不适用）
function reflowZh(s) {
  return mapMath(s, baseReflowZh);
}

function baseReflowZh(s) {
  let t = baseTypofixZh(s);
  t = t.replace(/\n\s*\n/g, "\u0001");
  t = t.replace(/\s*\n\s*/g, "");
  t = t.replace(/\u0001/g, "\n\n");
  return t;
}

// ---------- 富文本行渲染：文本 + LaTeX 公式（$..$/$$..$$/\(..\)/\[..\]）用 MathJax 渲染 ----------
// renderMath(source, display) 返回 HTMLElement，需在全部渲染后调用 finishRenderMath()
function renderRichText(container, text) {
  const parts = text.split(MATH_RE);
  let hasMath = false;
  for (const part of parts) {
    if (!part) continue;
    let src = null;
    let display = false;
    if (part.startsWith("$$")) {
      src = part.slice(2, -2);
      display = true;
    } else if (part.startsWith("\\[")) {
      src = part.slice(2, -2);
      display = true;
    } else if (part.startsWith("$")) {
      src = part.slice(1, -1);
    } else if (part.startsWith("\\(")) {
      src = part.slice(2, -2);
    }
    if (src !== null && typeof renderMath === "function") {
      try {
        container.appendChild(renderMath(src, display));
        hasMath = true;
      } catch (e) {
        console.warn("[mini-translator] 公式渲染失败，退回文本:", part, e);
        container.appendText(part); // 渲染失败退回原文（可选中复制）
      }
    } else {
      container.appendText(part);
    }
  }
  if (hasMath && typeof finishRenderMath === "function") {
    finishRenderMath();
  }
}

// ---------- 双语成对渲染：原文行弱化，译文行正常，人读的对照排版 ----------
// 无论原文还是译文、无论来自哪个源，展示前统一过一遍排版处理
function renderPairsTo(el, pairs) {
  el.empty();
  el.addClass("mini-flow");
  for (const p of pairs) {
    const en = el.createDiv({ cls: "mini-en-line" });
    renderRichText(en, typofixEn(p.en));
    const zh = el.createDiv({ cls: p.dict ? "mini-dict-line" : "mini-zh-line" });
    renderRichText(zh, typofixZh(p.zh));
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
  "你是学术论文翻译助手。把用户给出的英文翻译成中文：忠实原文、术语准确、符合中文学术表达习惯。\n" +
  "数学公式规则（重要）：\n" +
  "1. 原文中以 ⟦MT数字⟧ 形式出现的占位符代表数学公式，必须原样保留在译文对应位置，不要翻译、修改或删除。\n" +
  "2. PDF 提取的文本中公式经常残缺（如 x2 实为 x^2、上下标丢失、希腊字母乱码）。遇到明显是数学内容的片段，先根据上下文恢复成正确的 LaTeX，再包裹在 $...$（行内）或 $$...$$（独立公式）中放入译文；变量名和函数名不要翻译。\n" +
  "3. 除以上情形外的普通文字正常翻译，不要随意添加公式界定符。\n" +
  "只输出译文，不要任何解释或原文。";

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
// ---------- 翻译历史时间戳：M/D HH:MM ----------
function fmtHistTime(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---------- pdf.js 库加载：始终用插件自带的构建，绝对路径加载，worker 用 blob URL ----------
// 关键坑：Obsidian 插件里 require('./相对路径') 锚在应用根而非插件目录，必须显式构造绝对路径。
// 依次尝试 __dirname（若环境提供且指向插件目录）→ vault basePath + manifest.dir → 相对路径（Node 测试）。
// worker 读本地文件建 blob URL，绕开 app:// 协议下 new Worker 被拒/CSP 拦截；
// worker 只保留 pdf.worker.js 一份：blob URL 主路径读它，pdf.js 内部 fake-worker 兜底
//（源码 fallbackWorkerSrc="./pdf.worker.js"）也指向它，两条路共用一个文件，不冗余。
let PDFJS_LIB = null;
function pluginFileCandidates(plugin, relParts) {
  const path = require("path");
  const rel = path.join(...relParts);
  const cands = [];
  try {
    if (typeof __dirname !== "undefined" && __dirname)
      cands.push(path.join(__dirname, rel));
  } catch (e) {}
  try {
    const base = plugin.app.vault.adapter.basePath;
    if (base) cands.push(path.join(base, plugin.manifest.dir, rel));
  } catch (e) {}
  cands.push("./" + rel.split(path.sep).join("/")); // 相对 require 兜底（Node 测试环境）
  return cands;
}
function loadPdfJs(plugin) {
  if (PDFJS_LIB) return PDFJS_LIB;
  let lib = null;
  let err = null;
  for (const c of pluginFileCandidates(plugin, ["lib", "pdf.min.js"])) {
    try {
      lib = require(c);
      break;
    } catch (e) {
      err = e;
    }
  }
  if (!lib) throw new Error(`加载自带 pdf.js 失败：${err?.message || err}`);
  PDFJS_LIB = lib;
  const fs = require("fs");
  for (const c of pluginFileCandidates(plugin, ["lib", "pdf.worker.js"])) {
    try {
      const code = fs.readFileSync(c, "utf8");
      PDFJS_LIB.GlobalWorkerOptions.workerSrc = URL.createObjectURL(
        new Blob([code], { type: "application/javascript" })
      );
      break;
    } catch (e) {
      err = e;
    }
  }
  if (!PDFJS_LIB.GlobalWorkerOptions.workerSrc) {
    console.warn("[mini-translator] blob worker 构建失败，改用资源路径:", err);
    try {
      PDFJS_LIB.GlobalWorkerOptions.workerSrc =
        plugin.app.vault.adapter.getResourcePath(
          plugin.manifest.dir + "/lib/pdf.worker.js"
        );
    } catch (e2) {
      console.warn("[mini-translator] worker 设置全部失败:", e2);
    }
  }
  return PDFJS_LIB;
}

// ---------- 悬浮球模块加载：translation-orb.js（纯 DOM，零依赖），同样走绝对路径锚定 ----------
let ORB_MOD = null;
function loadOrbModule(plugin) {
  if (ORB_MOD) return ORB_MOD;
  let mod = null;
  let err = null;
  for (const c of pluginFileCandidates(plugin, ["translation-orb.js"])) {
    try {
      mod = require(c);
      break;
    } catch (e) {
      err = e;
    }
  }
  if (!mod || typeof mod.TranslationOrbController !== "function") {
    throw new Error(`加载 translation-orb.js 失败：${err?.message || err}`);
  }
  ORB_MOD = mod;
  return mod;
}

// 取任意 vault PDF 文件的文档对象：已在某视图中打开则直接复用其文档，否则独立解析二进制
async function getPdfDocForFile(plugin, file) {
  for (const leaf of plugin.app.workspace.getLeavesOfType("pdf")) {
    try {
      if (leaf.view.file && leaf.view.file.path === file.path) {
        const child = leaf.view.viewer && leaf.view.viewer.child;
        const pv = child && (child.pdfViewer || child);
        if (pv && pv.pdfDocument) return { doc: pv.pdfDocument };
        if (pv && pv.pdfLoadingTask && pv.pdfLoadingTask.promise) {
          const doc = await pv.pdfLoadingTask.promise;
          return { doc };
        }
      }
    } catch (e) {}
  }
  const lib = loadPdfJs(plugin);
  const data = new Uint8Array(await plugin.app.vault.readBinary(file));
  const doc = await lib.getDocument({ data }).promise;
  return { doc };
}

// token 估算（输入+输出粗估）：英文约 3.5 字符 ≈ 1 token
function estTokens(chars) {
  return Math.ceil(chars / 3.5);
}
function fmtTok(n) {
  const v = Math.round(n); // token 只取整数，不显示小数尾巴
  return v >= 10000
    ? (v / 1000).toFixed(1).replace(/\.0$/, "") + "k"
    : String(v);
}

// ---------- v3 批量协议：多块合并成一次请求，LLM 同一次产出「修复英文 + 中文」 ----------
const FULL_PROMPT_LLM =
  "你是学术论文翻译助手。用户给出同一篇 PDF 的若干文本段，每段以 ⟦MT数字⟧ 开头。PDF 文本层经常损坏数学与断词。\n" +
  "对每段依次输出两行（顺序与输入一致，一段都不能漏）：\n" +
  "⟦EN数字⟧ 该段英文原文的修复版：把残缺的数学重建为合法 LaTeX（行内 $...$、独立公式 $$...$$），修复断词与乱序，不增删内容、不要翻译；\n" +
  "⟦ZH数字⟧ 对应的简体中文译文：忠实准确、术语规范，数学同样用 LaTeX 包裹在 $...$ 或 $$...$$ 中，变量名函数名不译；\n" +
  "规则：所有 ⟦MT⟧⟦EN⟧⟦ZH⟧ 标记原样保留；除 LaTeX 定界符外不要添加任何新标记或解释；共 {N} 段必须全部输出。";

// 免费源的批量协议已移除：全文翻译现在仅支持大模型源

// 解析批量响应：LLM 用 ⟦ENn⟧/⟦ZHn⟧ 双产物；免费源回显 ⟦MTn⟧ 后跟译文。
// 标记丢失/错号时，孤儿文本按出现顺序填进空槽，尽量不整批作废
function parseBatchResponse(out, n, wantEn) {
  const parts = out.split(/(⟦\s*(?:EN|ZH|MT)\s*\d+\s*⟧)/);
  const en = new Map();
  const zh = new Map();
  const orphans = [];
  let cur = null;
  for (const seg of parts) {
    const mm = seg.match(/^⟦\s*(EN|ZH)\s*(\d+)\s*⟧$/);
    if (mm) {
      cur = { map: mm[1] === "EN" ? en : zh, key: Number(mm[2]) };
      continue;
    }
    const mt = seg.trim().match(/^⟦\s*MT\s*(\d+)\s*⟧$/);
    if (mt) {
      cur = { map: zh, key: Number(mt[1]) };
      continue;
    }
    if (!seg.trim()) continue;
    if (!cur) {
      orphans.push(seg.trim());
      continue;
    }
    const prev = cur.map.get(cur.key);
    cur.map.set(cur.key, (prev ? prev + " " : "") + seg.trim());
    cur = null;
  }
  const res = [];
  let oi = 0;
  for (let i = 1; i <= n; i++) {
    let z = zh.get(i);
    if (!z && oi < orphans.length) z = orphans[oi++];
    if (!z) throw new Error(`第 ${i} 段缺失译文`);
    res.push({ en: wantEn ? en.get(i) || "" : "", zh: z });
  }
  return res;
}

// 一批文本 → [{en,zh}]；LLM 一次请求双产物，失败/缺段抛错由上层兜底。
// 全文翻译仅支持大模型源：非大模型主源直接抛错（入口处已提前拦截）
async function translateBlockBatch(source, texts) {
  const prof = findProfile(source);
  if (!prof) throw new Error("全文翻译仅支持大模型源");
  const marked = texts.map((t, i) => `⟦MT${i + 1}⟧ ${t}`).join("\n\n");
  const out = await llmRequest(
    `共 ${texts.length} 段。\n\n${marked}`,
    prof,
    FULL_PROMPT_LLM.replace("{N}", String(texts.length))
  );
  return parseBatchResponse(out, texts.length, true);
}

// ---------- 跳过判定：公式/表格碎片/超短行不做白块覆盖，原样保留像素 ----------
function isSkippableBlock(b) {
  const t = b.text || "";
  if (t.length < 12) return true;
  const letters = (t.match(/[A-Za-z]/g) || []).length;
  return letters / t.length < 0.35;
}

// 全部块连续分组：≤8 块且 ≤2600 字符一批（v3.0.2 上调，减少请求数）
// （全文翻译为大模型源专用：公式/碎片块也交给模型重建，跳过判定只用于 HTML 白块覆盖决策）
function groupIntoBatches(blocks) {
  const idxs = blocks.map((_, i) => i);
  const batches = [];
  let cur = [];
  let chars = 0;
  for (const i of idxs) {
    const L = blocks[i].text.length;
    if (cur.length && (cur.length >= 8 || chars + L > 2600)) {
      batches.push(cur);
      cur = [];
      chars = 0;
    }
    cur.push(i);
    chars += L;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

// 全部块翻译（带逐块缓存 + 取消 + 进度回调）；批解析失败自动降级为逐块单独翻。
// v3.0.2：FULL_CONCURRENCY 路批次并发在途（LLM API 无状态可安全并行），吞吐约 ×3
const FULL_CONCURRENCY = 3;

async function translateBlocksAll(plugin, blocks, source, onProg) {
  const batches = groupIntoBatches(blocks);
  const results = new Array(blocks.length).fill(null);
  // 取消竞速：requestFtCancel 后 cancelP 立即 resolve，在途请求的 await 马上返回
  const cancelP = plugin.ftCancelPromise || new Promise(() => {});
  const CANCEL = "__FT_CANCELLED__";
  const withCancel = (p) => Promise.race([p, cancelP.then(() => CANCEL)]);
  const t0 = Date.now();
  let done = 0;
  let doneChars = 0;
  let finishedBatches = 0;
  const tick = () => {
    onProg &&
      onProg({
        phase: "翻译中",
        detail:
          finishedBatches < batches.length
            ? `已完成批次 ${finishedBatches}/${batches.length}`
            : "",
        done,
        total: blocks.length,
        batches: batches.length,
        tokDone: estTokens(doneChars), // 真实值；模态框内平滑插值成流式
      });
  };
  // 实时心跳：批次在途期间持续推送真实进度；纯本地刷新，不发网络请求，不影响速度
  const heart = setInterval(tick, 250);
  const runBatch = async (bat) => {
    const need = [];
    const idx = [];
    for (const gi of bat) {
      const key = `full:${sourceKey(source)}:${blocks[gi].text}`;
      const hit = CACHE.get(key);
      if (hit) {
        results[gi] = hit;
        done++;
        doneChars += blocks[gi].text.length;
      } else {
        need.push(blocks[gi].text);
        idx.push(gi);
      }
    }
    if (!need.length) {
      finishedBatches++;
      tick();
      return;
    }
    tick();
    let got = null;
    try {
      got = await withCancel(translateBlockBatch(source, need));
    } catch (e) {
      console.warn("[mini-translator] 批次解析失败，降级逐块:", e.message || e);
    }
    if (got === CANCEL) return; // 已取消：在途请求作废，不再写缓存
    if (!got || got.length !== need.length) {
      got = [];
      for (const t of need) {
        if (plugin.ftCancel) break;
        try {
          const key1 = `full-single:${sourceKey(source)}:${t}`;
          let r = CACHE.get(key1);
          if (!r) {
            r = await withCancel(translateSentence(t, source));
            if (r === CANCEL) break;
            CACHE.set(key1, r);
          }
          got.push({ en: "", zh: r.text });
        } catch (e2) {
          got.push({ en: "", zh: `⚠️ 本块翻译失败：${e2.message || e2}` });
        }
      }
    }
    idx.forEach((gi, k) => {
      const rec = { en: got[k]?.en || "", zh: got[k]?.zh || "" };
      results[gi] = rec;
      done++;
      doneChars += blocks[gi].text.length;
      CACHE.set(`full:${sourceKey(source)}:${blocks[gi].text}`, rec);
    });
    finishedBatches++;
    tick();
  };
  let next = 0; // 单线程事件循环里领取批次，无竞态
  const worker = async () => {
    while (!plugin.ftCancel) {
      const i = next++;
      if (i >= batches.length) break;
      await runBatch(batches[i]);
    }
  };
  try {
    await Promise.all(
      Array.from(
        { length: Math.min(FULL_CONCURRENCY, batches.length) },
        () => worker()
      )
    );
  } finally {
    clearInterval(heart);
  }
  return { results, batches };
}

// ---------- 整本提取：全页行几何 → 跨页页眉/页脚剔除 → 带 bbox 的段落块 ----------
function normChromeLine(s) {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

async function extractDocBlocks(doc, onProg) {
  const pagesLines = [];
  const n = doc.numPages;
  for (let i = 1; i <= n; i++) {
    if (onProg) onProg(i, n);
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    pagesLines.push(pdfItemsToBlocks(tc.items));
  }
  // 页眉/页脚：出现在某页首末两行、且在 ≥60% 页重复的短文本 → 判定为装饰性重复
  const freq = new Map();
  for (const lines of pagesLines) {
    const cand = [lines[0], lines[1], lines[lines.length - 1], lines[lines.length - 2]];
    for (const l of cand) {
      if (!l) continue;
      const k = normChromeLine(l.text);
      if (k.length > 2 && k.length < 120)
        freq.set(k, (freq.get(k) || 0) + 1);
    }
  }
  const thresh = Math.max(2, Math.ceil(pagesLines.length * 0.6));
  const chrome = new Set(
    [...freq].filter(([, c]) => c >= thresh).map(([k]) => k)
  );
  const blocks = [];
  const parasByPage = [];
  pagesLines.forEach((lines, pi) => {
    const kept = chrome.size
      ? lines.filter((l) => !chrome.has(normChromeLine(l.text)))
      : lines;
    const pb = mergeLinesToParas(kept);
    parasByPage.push(pb.map((b) => b.text));
    for (const b of pb) blocks.push({ ...b, page: pi + 1 });
  });
  return { blocks, parasByPage, chromeCount: chrome.size };
}

// ---------- 进度窗（应用内弹窗版，v3.0.4 起为默认）：可拖动 + 点击外部/ESC 不误关 + 动态进度条 ----------
class TranslateProgressModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.plugin.progModal = this;
    this.finished = false; // 完成前屏蔽 ESC / 点击外部的关闭请求
    this.minimized = false; // 最小化成悬浮球中（弹窗隐藏但翻译继续）
    this.orbCtrl = null; // 悬浮球控制器（translation-orb），最小化期间存活
    this._cleanup = [];
    // 匀速爬动进度引擎状态
    this.disp = 0; // 当前显示进度 0..1（单调不减，每次最多 +1%）
    this.basePct = 0; // 最近一次真实进度
    this.real = null; // { done, total, t } 最近真实值
    this.rate = 0; // 整体进度速率（fraction/ms，EMA，随时间修正）
    this.t0 = 0; // 当前阶段起点
    this.animKey = ""; // 阶段标识：变化时重置显示进度
    this.dispTok = 0; // token 消耗的平滑显示值（向真实值爬，不虚报）
    this._lastSt = null;
  }

  onOpen() {
    this.modalEl.addClass("mini-prog-modal");
    const c = this.contentEl;
    c.empty();

    const head = c.createDiv("mini-prog-head");
    head.createSpan("mini-prog-dot");
    head.createSpan({ text: "全文翻译进度" });
    // 不再自绘 ✕：右上角只保留 Obsidian 原生关闭按钮。它的 class/挂载点随版本
    // 变化，按 class 删除/隐藏始终有漏网之鱼（曾出现双 ✕）；而原生按钮的点击
    // 走本类 close()——未完成时自动转为最小化成悬浮球，行为与自绘 ✕ 一致，
    // 且构造上只可能有一个关闭按钮
    // （原生按钮在 head 外部，不会触发标题栏拖动，无需 stopPropagation）

    this.phaseEl = c.createDiv("mini-prog-phase");
    this.phaseEl.setText("准备中…");
    this.detailEl = c.createDiv("mini-prog-detail");

    const barWrap = c.createDiv("mini-prog-bar");
    this.barFill = barWrap.createDiv("mini-prog-fill");
    this.pctEl = c.createDiv("mini-prog-pct");
    this.pctEl.setText("0%");
    this.metaEl = c.createDiv("mini-prog-meta");

    // 匀速爬动引擎：120ms 一跳，按估算速率推进（领先真实值 ≤5%、封顶 97%）
    this.animTimer = setInterval(() => this.tick(), 120);
    this._cleanup.push(() => clearInterval(this.animTimer));

    // 标题栏拖动（fixed 定位，拖到任意位置）
    let sx = 0,
      sy = 0,
      ox = 0,
      oy = 0,
      dragging = false;
    const mv = (e) => {
      if (!dragging) return;
      this.modalEl.style.left = `${ox + e.clientX - sx}px`;
      this.modalEl.style.top = `${oy + e.clientY - sy}px`;
    };
    const up = () => {
      dragging = false;
    };
    head.addEventListener("mousedown", (e) => {
      const r = this.modalEl.getBoundingClientRect();
      this.modalEl.style.position = "fixed";
      this.modalEl.style.margin = "0";
      ox = r.left;
      oy = r.top;
      sx = e.clientX;
      sy = e.clientY;
      dragging = true;
      e.preventDefault();
    });
    window.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", up);
    this._cleanup.push(() => {
      window.removeEventListener("mousemove", mv);
      window.removeEventListener("mouseup", up);
    });

    const btns = c.createDiv("mini-prog-foot");
    const cancelBtn = btns.createEl("button", { text: "取消翻译" });
    cancelBtn.onclick = () => {
      this.plugin.requestFtCancel();
      this.phaseEl.setText("正在取消…在途请求已失效");
      cancelBtn.disabled = true;
      cancelBtn.setText("已请求取消");
      this.finished = true; // 允许直接 ESC/点外部关窗，后台自行快速收尾
    };
  }

  update(st = {}) {
    if (this.phaseEl && st.phase) this.phaseEl.setText(st.phase);
    if (this.detailEl)
      this.detailEl.setText([st.detail, st.file].filter(Boolean).join(" · "));
    this._lastSt = st;
    if (!st.total) {
      this.modalEl.addClass("mini-prog-indet"); // 无总量时脉动动画
      if (this.metaEl) this.metaEl.setText("");
      return;
    }
    this.modalEl.removeClass("mini-prog-indet");
    const key = `${st.phase || ""}:${st.total}`;
    if (key !== this.animKey) {
      this.animKey = key; // 换阶段（提取→翻译→渲染）重置显示进度
      this.modalEl.removeClass("mini-prog-complete");
      this.disp = 0;
      this.rate = 0;
      this.real = null;
      this.t0 = 0;
      this.dispTok = 0;
    }
    const now = Date.now();
    if (st.phase === "翻译中") {
      if (!this.t0) this.t0 = now;
      if (!this.rate) {
        // 种子速率：估计总耗时 = 批数 × 每批 ~10s ÷ 3 路并发 → 1/估算总时长
        this.rate = 1 / Math.max(1, (st.batches || 1) * (10000 / 3));
      }
      if (this.real && st.done > this.real.done) {
        // 真实批次落地：用实际平均速度修正整体速率（EMA）
        const inst = st.done / st.total / Math.max(1, now - this.t0);
        this.rate = this.rate * 0.6 + inst * 0.4;
      }
      this.real = { done: st.done, total: st.total, t: now };
      this.basePct = st.done / st.total;
      // 不再直接改 disp —— 位置一律由 tick() 按 1% 步长推进，避免一批落地跳一大截
    } else {
      // 提取/渲染/写入：页级线性进度，直接跟真实值（短时相，无跳变问题）
      this.disp = st.done / st.total;
      this.basePct = this.disp;
    }
    this.paint();
  }

  // 动画帧：按整体速率匀速爬行，每次最多 +1%
  tick() {
    if (!this.real) return;
    // 调度目标 = 整体速率 × 已用时长（随真实进度修正的匀速爬行）
    const target = this.rate * Math.max(0, Date.now() - this.t0);
    // 下限：真实进度（不显示少于真实）；上限：真实 +8%、封顶 97%（不撒谎、也不冻结）
    const ceil = Math.min(0.97, this.basePct + 0.08);
    const goal = Math.max(this.basePct, Math.min(target, ceil));
    if (goal > this.disp) {
      this.disp = Math.min(goal, this.disp + 0.01); // 1% 步长
    }
    // token 平滑：向真实消耗值爬（落后真实、不虚报），每帧走 20% 差距
    const rt = this._lastSt && this._lastSt.tokDone;
    if (rt != null && rt > this.dispTok) {
      this.dispTok += (rt - this.dispTok) * 0.2;
    }
    this.paint();
  }

  paint() {
    const st = this._lastSt || {};
    const pct = Math.min(100, Math.round(this.disp * 100));
    if (this.barFill) {
      // 进度条保持 100% 宽度，仅用合成器 transform 推进，避免每 120ms 重排布局。
      this.barFill.style.width = "100%";
      this.barFill.style.transform = `scaleX(${pct / 100})`;
    }
    if (this.pctEl) this.pctEl.setText(`${pct}%`);
    if (pct >= 100) this.modalEl.addClass("mini-prog-complete");
    else this.modalEl.removeClass("mini-prog-complete");
    const bits = [];
    if (st.total) bits.push(`${st.done}/${st.total} 块`);
    if (this.dispTok > 0) bits.push(`≈${fmtTok(this.dispTok)} tokens 已用`);
    if (this.real && this.rate > 0 && this.disp < 0.97) {
      const remMs = (1 - this.disp) / this.rate;
      bits.push(
        remMs < 90000
          ? `剩余 ~${Math.max(1, Math.round(remMs / 1000))} 秒`
          : `剩余 ~${(remMs / 60000).toFixed(1)} 分钟`
      );
    }
    if (this.metaEl) this.metaEl.setText(bits.join(" · "));
    // 悬浮球：真实进度画环；无总量（提取阶段）传 null 转旋转弧线。
    // notify=false：paint 每 120ms 一次，不应触发持久化广播
    if (this.orbCtrl) this.orbCtrl.setProgress(st.total ? pct : null, false);
  }

  // ---------- 最小化成悬浮球 ----------
  // 关键：不是把弹窗藏起来（display:none 的遮罩层仍可能拦截全屏点击），
  // 而是彻底关闭 Modal、拆干净所有 DOM 与键盘 scope —— 引擎状态留在实例上，
  // 恢复时 open() 完整重建。这样最小化期间 Obsidian 的任何位置都可正常点击。
  minimize() {
    if (this.minimized) return;
    this.minimized = true;
    this.finished = true; // 放行 super.close()
    super.close(); // 拆除弹窗 DOM；onClose 会停掉弹窗心跳与拖动监听、保留实例引用
    this.finished = false; // 恢复未完成标记：restore 后继续屏蔽 ESC/点外部误关
    this.showOrb();
    // 悬浮球的进度环要持续重画：重启动画心跳（弹窗那份已被 onClose 停掉）。
    // 翻译阶段的进度全靠 tick() 每帧 paint，没有心跳球就会冻结
    this.animTimer = setInterval(() => this.tick(), 120);
    this._cleanup.push(() => clearInterval(this.animTimer));
  }

  // 点击悬浮球 → 弹回完整进度窗（重新构建，进度状态无缝续上）
  restore() {
    if (!this.minimized) return;
    this.minimized = false;
    // 停掉最小化期间的心跳、销毁悬浮球（onOpen 会重建弹窗自己的心跳）
    for (const f of this._cleanup) f();
    this._cleanup = [];
    this.hideOrb();
    this.open(); // 重挂载 DOM 并重跑 onOpen（重建内容、定时器、拖动）
    this.paint();
  }

  // 显示悬浮球：懒创建控制器（translation-orb 模块），mount 到 body，套用皮肤/位置/当前进度
  showOrb() {
    if (this.orbCtrl) return;
    const { TranslationOrbController, createDefaultSkinRegistry } = loadOrbModule(this.plugin);
    const s = this.plugin.settings;
    const st = this._lastSt || {};
    const pct = Math.min(100, Math.round(this.disp * 100));
    const ctrl = new TranslationOrbController({
      document,
      window,
      registry: createDefaultSkinRegistry(),
      surface: "auto",
      skin: s.orbSkin || "ink-wash",
      size: s.orbSize || 40,
      position: s.orbPosition || null,
      progress: st.total ? pct : null,
      onStateChange: (state, reason) => {
        // 只持久化低频的用户态变化；progress 每 120ms 一次，绝不落盘
        if (reason !== "position" && reason !== "skin" && reason !== "size") return;
        s.orbSkin = state.skin;
        s.orbSize = state.size;
        s.orbPosition = state.position ? { ...state.position } : null;
        void this.plugin.saveData(s);
      },
    });
    ctrl.mount(document.body);
    this.orbCtrl = ctrl;
    // 拖动与点击并存：demo 控制器只管拖动；这里补「位移 <5px = 点击弹回」，
    // 不修改 vendored 文件。pointer 事件经 setPointerCapture 后仍会派发到 host
    const host = ctrl.host;
    let sx = 0, sy = 0;
    host.addEventListener("pointerdown", (e) => {
      sx = e.clientX;
      sy = e.clientY;
    });
    host.addEventListener("pointerup", (e) => {
      if (
        Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) < 5 &&
        this.minimized
      ) {
        this.restore();
      }
    });
  }

  // 销毁悬浮球，只在 minimize/restore/requestClose 三个点显式调用
  hideOrb() {
    if (this.orbCtrl) {
      this.orbCtrl.destroy();
      this.orbCtrl = null;
    }
  }

  // 完成或取消后真正关闭；其余 close 请求（ESC/点外部）转为最小化成悬浮球
  requestClose() {
    this.finished = true;
    if (this.minimized) {
      // 弹窗已随最小化被彻底拆除（无 DOM 可关）：销毁悬浮球、清引用即可
      this.minimized = false;
      this.hideOrb();
      for (const f of this._cleanup) f();
      this._cleanup = [];
      if (this.plugin.progModal === this) this.plugin.progModal = null;
      return;
    }
    this.close();
  }

  // 收尾：把进度顶到 100% 再关，避免停在中间就消失
  finish() {
    this.disp = 1;
    this.paint(); // 最小化时也会同步刷悬浮球圆环到 100%
    this.requestClose();
  }

  close() {
    if (!this.finished) {
      // ESC / 点击外部：不关闭（翻译还在跑），缩成悬浮球
      this.minimize();
      return;
    }
    super.close();
  }

  onClose() {
    for (const f of this._cleanup) f();
    this._cleanup = [];
    // 悬浮球由 minimize/restore/requestClose 显式管理，onClose 不碰它。
    // 枚举路径确认二者不共存：minimize 的 super.close() 早于 showOrb()；finish/ESC
    // 的关闭路径中 orb 已先被 hideOrb() 销毁
    // 最小化触发的拆除只是暂时性的：保留 progModal 引用，恢复时继续复用本实例
    if (!this.minimized && this.plugin.progModal === this) {
      this.plugin.progModal = null;
    }
  }
}


// ---------- 页面渲染：pdf.js 把整页画成 JPEG（图表/公式像素原样保留） ----------
async function renderPageImages(plugin, doc, scale, quality, onProg) {
  const n = doc.numPages;
  const out = [];
  for (let i = 1; i <= n; i++) {
    if (onProg) onProg(i, n);
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale });
    const cv = document.createElement("canvas");
    cv.width = Math.floor(vp.width);
    cv.height = Math.floor(vp.height);
    await page.render({
      canvasContext: cv.getContext("2d"),
      viewport: vp,
    }).promise;
    out.push({
      dataUrl: cv.toDataURL("image/jpeg", quality),
      w: vp.width,
      h: vp.height,
      vp,
    });
  }
  return out;
}

// 块的 PDF 坐标 bbox → 相对页面尺寸的百分比定位
function blockRectPct(block, viewport, pw, ph) {
  const p1 = viewport.convertToViewportPoint(block.x0, block.yMax);
  const p2 = viewport.convertToViewportPoint(block.x1, block.yMin);
  const left = (Math.min(p1[0], p2[0]) / pw) * 100;
  const top = (Math.min(p1[1], p2[1]) / ph) * 100;
  const w = (Math.abs(p2[0] - p1[0]) / pw) * 100;
  const h = (Math.abs(p2[1] - p1[1]) / ph) * 100;
  return { left, top, width: w, height: h };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// 模型常返回 \( \) / \[ \] 定界符（Obsidian 只认 $/$$），且相邻独立公式会粘成 $$$$。
// 统一归一到 Obsidian 可渲染的形态
function normalizeMathDelims(s) {
  if (!s) return s;
  s = s.replace(/\\\[((?:.|\n)+?)\\\]/g, (_m, t) => `\n\n$$${t}$$\n\n`);
  s = s.replace(/\\\(((?:.|\n)+?)\\\)/g, (_m, t) => `$${t}$`);
  // 相邻 display 公式之间补空行，避免 $$$$ 被解析成奇数个定界符
  // （用函数形式返回：字符串替换里 "$$" 会被解释成字面量单个 $）
  s = s.replace(/\$\$\s*\$\$/g, () => "$$\n\n$$");
  return s;
}

// data:image/jpeg;base64,... → ArrayBuffer（写页面图片附件用）
function dataUrlToBuffer(d) {
  const b64 = d.slice(d.indexOf(",") + 1);
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8.buffer;
}

// ---------- 原版式复刻 HTML：页面图打底 + 白块覆盖写中文 + 打印即 PDF + 可编辑纠错 ----------
function buildReplicaHtml(meta, pages) {
  const pgHtml = pages
    .map((p) => {
      const blks = p.blocks
        .map((b) => {
          if (b.skip) return "";
          const r = b.rect;
          return (
            `<div class="blk" style="left:${r.left.toFixed(2)}%;top:${r.top.toFixed(2)}%;` +
            `width:${r.width.toFixed(2)}%;min-height:${Math.max(r.height, 1.2).toFixed(2)}%;">` +
            `<div class="en">${escapeHtml(b.en || b.orig)}</div>` +
            `<div class="zh">${escapeHtml(b.zh)}</div></div>`
          );
        })
        .join("");
      return `<div class="pg"><img src="${p.img}" alt="page"/><div class="blks">${blks}</div></div>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${escapeHtml(meta.title)}</title>
<script>window.MathJax={tex:{inlineMath:[["$","$"],["\\\\(","\\\\)"]],displayMath:[["$$","$$"],["\\\\[","\\\\]"]],processEscapes:true},chtml:{matchFontHeight:false},startup:{pageReady:function(){return MathJax.startup.defaultPageReady().then(function(){if(window.__mtFit)window.__mtFit();});}}};</script>
<script defer src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js"></script>
<style>
body{margin:0;background:#404040;font-family:-apple-system,"Segoe UI","Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif;}
.toolbar{position:sticky;top:0;z-index:99;display:flex;flex-wrap:wrap;gap:16px;align-items:center;padding:8px 14px;background:#262626;color:#e8e8e8;font-size:13px;box-shadow:0 1px 4px rgba(0,0,0,.4);}
.toolbar label{cursor:pointer;display:flex;align-items:center;gap:4px;}
.toolbar button{background:#3d7edb;border:0;color:#fff;border-radius:5px;padding:4px 12px;cursor:pointer;font-size:13px;}
.toolbar .hint{color:#999;margin-left:auto;}
.pg{position:relative;width:min(920px,100%);margin:16px auto;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.4);}
.pg>img{display:block;width:100%;}
.blks{position:absolute;inset:0;}
.blk{position:absolute;background:#fff;color:#111;line-height:1.55;padding:0 3px;box-sizing:border-box;overflow:hidden;border-radius:1px;}
.blk .en{display:none;color:#777;font-size:.82em;line-height:1.35;border-bottom:1px dashed #c9c9c9;padding-bottom:2px;margin-bottom:3px;}
body.show-en .blk .en{display:block;}
body.editing .blk .zh{outline:1px dashed #4a90d9;cursor:text;}
mjx-container{max-width:none!important;}
@media print{
 body{background:#fff;}
 .toolbar{display:none;}
 .pg{width:100%;margin:0;box-shadow:none;break-after:page;}
 .blk{overflow:visible;}
}
@page{size:auto;margin:0;}
</style>
</head>
<body>
<div class="toolbar">
 <label><input type="checkbox" id="tEn"> 显示原文</label>
 <label><input type="checkbox" id="tEdit"> 编辑译文</label>
 <button id="tSave">保存修改</button>
 <span class="hint">导出 PDF：Ctrl+P → 目标选「另存为 PDF」→ 边距设「无」</span>
</div>
${pgHtml}
<script>
var fit=function(){
 document.querySelectorAll(".blk").forEach(function(el){
  var zh=el.querySelector(".zh"); if(!zh) return;
  var box=el.getBoundingClientRect();
  var fs=Math.max(8.5,Math.min(box.height*0.62,15));
  el.style.fontSize=fs+"px";
  var guard=80;
  while(el.scrollHeight>el.clientHeight+1&&fs>7&&guard-->0){fs-=0.5;el.style.fontSize=fs+"px";}
 });
};
window.__mtFit=fit;
window.addEventListener("load",function(){fit();setTimeout(fit,600);});
document.getElementById("tEn").addEventListener("change",function(){document.body.classList.toggle("show-en",this.checked);fit();});
document.getElementById("tEdit").addEventListener("change",function(){
 document.body.classList.toggle("editing",this.checked);
 document.querySelectorAll(".blk .zh").forEach(function(z){z.contentEditable=this.checked?"true":"false";},this);
});
document.getElementById("tSave").addEventListener("click",function(){
 document.body.classList.remove("editing","show-en");
 document.querySelectorAll(".blk .zh").forEach(function(z){z.removeAttribute("contenteditable");});
 var html="<!doctype html>\\n"+document.documentElement.outerHTML;
 var name=document.title.replace(/[\\\\/:*?\\"<>|]/g,"_")+".html";
 if(window.showSaveFilePicker){
  window.showSaveFilePicker({suggestedName:name}).then(function(h){return h.createWritable().then(function(w){w.write(html);return w.close();});}).then(function(){alert("已保存修改。");});
 }else{
  var a=document.createElement("a");a.href=URL.createObjectURL(new Blob([html],{type:"text/html"}));a.download=name;a.click();
 }
});
</script>
</body>
</html>`;
}

// ---------- 全文翻译：开始前确认弹窗（页数/请求数/预计耗时，点头才开跑） ----------
class FullTranslateModal extends Modal {
  constructor(app, plugin, info) {
    super(app);
    this.plugin = plugin;
    this.info = info;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: "全文翻译确认" });
    const grid = contentEl.createDiv();
    grid.style.lineHeight = "1.9";
    grid.style.fontSize = "var(--font-ui-small)";
    for (const l of [
      `文档：${this.info.fileName}（${this.info.pages} 页）`,
      `文本块：${this.info.transN} 块（含公式块，由大模型重建为 LaTeX）`,
      `≈${fmtTok(this.info.tokensEst || 0)} tokens · 约 ${this.info.chunks} 次批量请求`,
      `预计耗时：${this.info.eta}`,
      `翻译源：${this.info.source}`,
      this.plugin.settings.fullHtml
        ? `输出：Markdown 笔记 + 原版式 HTML（浏览器 Ctrl+P 即同版式 PDF）`
        : `输出：Markdown 双语笔记`,
    ]) {
      grid.createDiv({ text: l });
    }
    const btns = contentEl.createDiv();
    btns.style.display = "flex";
    btns.style.gap = "8px";
    btns.style.marginTop = "14px";
    const start = btns.createEl("button", { text: "开始翻译", cls: "mod-cta" });
    start.onclick = () => {
      this.close();
      this.plugin.runFullTranslate(this.info);
    };
    const cancel = btns.createEl("button", { text: "取消" });
    cancel.onclick = () => this.close();
  }
  onClose() {
    this.contentEl.empty();
  }
}

// ---------- 弹窗：勾选 vault 里的一个/多个 PDF 全文翻译，底部实时汇总 token 估算 ----------
class FilePickTranslateModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.selected = new Set(); // path
    this.statsCache = new Map(); // path -> {pages, blocksN, batchesN, chars, tokensEst}
    this.blocksCache = new Map(); // path -> blocks（开跑时直接复用，免二次解析）
    this.docsCache = new Map(); // path -> pdf.js document（同上：开跑复用，启动提速）
    this.pending = new Set(); // 正在统计的 path
    this.failed = new Map(); // path -> 失败原因
    this.chain = Promise.resolve(); // 解析任务串行化，避免同时啃多个大文件
    this.openDirs = new Set(); // 目录树上展开的文件夹 path
  }

  // vault PDF 列表 → 文件系统目录树（只含含 PDF 的分支）
  buildTree(files) {
    const root = { name: "", path: "", dirs: new Map(), pdfs: [] };
    for (const f of files) {
      const parts = f.path.split("/");
      let node = root;
      for (let i = 0; i < parts.length - 1; i++) {
        const seg = parts[i];
        if (!node.dirs.has(seg))
          node.dirs.set(seg, {
            name: seg,
            path: parts.slice(0, i + 1).join("/"),
            dirs: new Map(),
            pdfs: [],
          });
        node = node.dirs.get(seg);
      }
      node.pdfs.push(f);
    }
    return root;
  }

  // 节点下全部 PDF（递归），供文件夹全选/计数
  collectPdfs(node, out) {
    for (const f of node.pdfs) out.push(f);
    for (const d of node.dirs.values()) this.collectPdfs(d, out);
    return out;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: "全文翻译：选择文件" });
    const search = contentEl.createEl("input", { type: "text" });
    search.placeholder = "搜索文件名…";
    search.style.cssText =
      "width:100%;margin-bottom:10px;padding:6px 10px;border-radius:8px;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal)";
    const listEl = contentEl.createDiv();
    listEl.style.cssText =
      "max-height:300px;overflow-y:auto;border:1px solid var(--background-modifier-border);border-radius:8px;padding:4px;";
    this.listElRef = listEl;
    this.summaryEl = contentEl.createDiv({ cls: "mini-pick-summary" });

    const files = this.plugin.app.vault
      .getFiles()
      .filter((f) => f.extension === "pdf")
      .sort((a, b) => b.stat.mtime - a.stat.mtime);
    const byPath = new Map(files.map((f) => [f.path, f]));
    const tree = this.buildTree(files);

    // 一行 PDF：复选框 + 文件名 + 实时统计
    const makeRow = (f, depth) => {
      const row = listEl.createDiv({ cls: "mini-pick-row" });
      row.setAttribute("data-path", f.path);
      row.style.paddingLeft = `${6 + depth * 16}px`;
      row.onclick = (ev) => {
        if (ev.target.tagName === "INPUT") return;
        cb.checked = !cb.checked;
        cb.onchange();
      };
      const cb = row.createEl("input", { type: "checkbox" });
      cb.checked = this.selected.has(f.path);
      cb.style.cursor = "pointer";
      cb.onchange = () =>
        this.toggleFile(byPath.get(f.path), cb.checked, rerender);
      row.createSpan({
        cls: "mini-pick-name",
        text: f.name,
        attr: { title: f.path },
      });
      const statSpan = row.createSpan({ cls: "mini-pick-stat" });
      this.updateRowStat(f.path, statSpan);
    };

    // 一行文件夹：▸/▾ 折叠 + 名称 + 全选复选框（n/m 已选）
    const makeDirRow = (node, depth) => {
      const all = this.collectPdfs(node, []);
      const selN = all.filter((f) => this.selected.has(f.path)).length;
      const row = listEl.createDiv({ cls: "mini-pick-row" });
      row.style.paddingLeft = `${6 + depth * 16}px`;
      const open = this.openDirs.has(node.path);
      const arrow = row.createSpan({ cls: "mini-pick-name" });
      arrow.style.flex = "1";
      arrow.setText(`${open ? "▾" : "▸"} ${node.name} (${selN}/${all.length})`);
      arrow.style.cursor = "pointer";
      arrow.onclick = () => {
        if (open) this.openDirs.delete(node.path);
        else this.openDirs.add(node.path);
        rerender();
      };
      const cb = row.createEl("input", { type: "checkbox" });
      cb.style.cursor = "pointer";
      cb.checked = selN > 0 && selN === all.length;
      cb.indeterminate = selN > 0 && selN < all.length;
      cb.onchange = () => {
        for (const f of all) {
          if (cb.checked) {
            if (!this.selected.has(f.path)) this.toggleFile(f, true, null);
          } else this.toggleFile(f, false, null);
        }
        setTimeout(rerender, 50);
      };
    };

    const renderTree = () => {
      listEl.empty();
      const walk = (node, depth) => {
        for (const d of [...node.dirs.values()].sort((a, b) =>
          a.name.localeCompare(b.name)
        )) {
          makeDirRow(d, depth);
          if (this.openDirs.has(d.path)) walk(d, depth + 1);
        }
        for (const f of node.pdfs) makeRow(f, depth);
      };
      walk(tree, 0);
    };

    // 搜索时退平铺（带完整路径），空关键字回到目录树
    const renderFlat = (kwRaw) => {
      listEl.empty();
      const kw = (kwRaw || "").toLowerCase();
      for (const f of files) {
        if (kw && !f.path.toLowerCase().includes(kw)) continue;
        makeRow(f, 0);
        const lastRow = listEl.lastElementChild;
        lastRow.querySelector(".mini-pick-name").setText(f.path);
      }
    };

    const rerender = () => {
      const kw = search.value.trim();
      if (kw) renderFlat(kw);
      else renderTree();
      this.refreshAll();
    };
    rerender();
    search.oninput = () => rerender();

    this.updateSummary(null);
    const btns = contentEl.createDiv();
    btns.style.cssText =
      "display:flex;gap:8px;margin-top:12px;justify-content:flex-end;";
    this.startBtn = btns.createEl("button", {
      text: "开始翻译",
      cls: "mod-cta",
    });
    this.startBtn.disabled = true;
    this.startBtn.onclick = () => {
      if (!this.plugin.ensureLlmForFull()) return;
      const jobs = Array.from(this.selected)
        .map((p) => ({
          file: byPath.get(p),
          blocks: this.blocksCache.get(p) || null,
          doc: this.docsCache.get(p) || null, // 已解析的文档直接带走，开跑免二次解析
        }))
        .filter((j) => j.file);
      if (!jobs.length) return;
      this.close();
      this.plugin.runPickedTranslate(jobs);
    };
    const cancelBtn = btns.createEl("button", { text: "取消" });
    cancelBtn.onclick = () => this.close();
  }

  toggleFile(file, checked, rerenderRow) {
    const p = file.path;
    if (!checked) {
      this.selected.delete(p);
      this.refreshAll();
      return;
    }
    this.selected.add(p);
    if (
      !this.statsCache.has(p) &&
      !this.pending.has(p) &&
      !this.failed.has(p)
    ) {
      // 第一次勾选：懒解析统计（串行队列），完成后行内与底部汇总实时更新
      this.pending.add(p);
      this.refreshAll();
      this.chain = this.chain.then(async () => {
        try {
          const { doc } = await getPdfDocForFile(this.plugin, file);
          this.docsCache.set(p, doc); // 开跑时直接复用，省一次解析（启动提速）
          const r = await extractDocBlocks(doc);
          let chars = 0;
          for (const b of r.blocks) chars += b.text.length;
          if (!chars) throw new Error("无文本层");
          this.blocksCache.set(p, r.blocks);
          this.statsCache.set(p, {
            pages: doc.numPages,
            chars,
            blocksN: r.blocks.length,
            batchesN: groupIntoBatches(r.blocks).length,
            tokensEst: estTokens(chars),
          });
        } catch (e) {
          console.warn("[mini-translator] 解析失败:", file.path, e);
          const msg = String(e?.message || e || "未知错误").slice(0, 60);
          this.failed.set(
            p,
            /无文本层/.test(e.message || "")
              ? "✗ 扫描件无文本层"
              : `✗ 无法解析：${msg}`
          );
          this.selected.delete(p); // 解析失败的文件不允许参与翻译
          if (rerenderRow) rerenderRow();
        } finally {
          this.pending.delete(p);
          this.refreshAll();
        }
      });
      return;
    }
    this.refreshAll();
  }

  updateRowStat(path, span) {
    if (!span) return;
    if (this.failed.has(path)) {
      span.setText(this.failed.get(path));
      return;
    }
    if (this.pending.has(path)) {
      span.setText("统计中…");
      return;
    }
    const s = this.statsCache.get(path);
    if (!s) return;
    span.setText(
      `${s.pages}页 · ${s.blocksN}块 · ≈${fmtTok(s.tokensEst)} tok`
    );
  }

  refreshAll() {
    if (this.listElRef) {
      for (const row of this.listElRef.querySelectorAll(".mini-pick-row")) {
        this.updateRowStat(
          row.getAttribute("data-path"),
          row.querySelector(".mini-pick-stat")
        );
      }
    }
    this.updateSummary();
  }

  updateSummary() {
    if (!this.summaryEl) return;
    let n = 0;
    let tokens = 0;
    let reqs = 0;
    let chars = 0;
    for (const p of this.selected) {
      const s = this.statsCache.get(p);
      if (s) {
        n++;
        tokens += s.tokensEst;
        reqs += s.batchesN;
        chars += s.chars;
      }
    }
    const prof = findProfile(this.plugin.settings.primarySource);
    const parts = [`已选 ${n} 个文件`];
    parts.push(`≈${fmtTok(chars)} 字符`);
    parts.push(`≈${fmtTok(tokens)} tokens`);
    parts.push(`${reqs} 次请求`);
    if (n)
      parts.push(
        prof ? `预计 ~${Math.max(1, Math.ceil((reqs * 3.5) / 60))} 分钟` : "预计 <1 分钟"
      );
    const pend = Array.from(this.pending).filter((p) => this.selected.has(p));
    if (pend.length) parts.push(`${pend.length} 个统计中…`);
    this.summaryEl.setText(parts.join("　·　"));
    if (this.startBtn) this.startBtn.disabled = n === 0 || pend.length > 0;
  }

  onClose() {
    this.contentEl.empty();
  }
}

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

function llmContentToText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (!part || typeof part !== "object") return "";
        return typeof part.text === "string"
          ? part.text
          : typeof part.content === "string"
            ? part.content
            : "";
      })
      .join("");
  }
  if (content && typeof content === "object") {
    return typeof content.text === "string"
      ? content.text
      : typeof content.content === "string"
        ? content.content
        : "";
  }
  return "";
}

function cleanLlmOutput(value) {
  return String(value || "")
    .replace(/^```[a-zA-Z]*\s*/, "")
    .replace(/```\s*$/, "")
    .trim();
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
  const choice = data?.choices?.[0];
  const out = cleanLlmOutput(
    llmContentToText(choice?.message?.content ?? choice?.text)
  );
  if (!out) {
    throw new Error(
      "空结果: " + (data?.error?.message || JSON.stringify(data).slice(0, 200))
    );
  }
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
  // 数学公式先替换成占位符，任何引擎都不会翻坏，返回后再还原
  const { text: safeText, map } = protectMath(text);
  // 若选中的是某个大模型配置，直接用该配置翻译（不回退到免费源，避免隐性切换）
  const prof = findProfile(primary);
  if (prof) {
    return {
      text: restoreMath(await llmRequest(safeText, prof), map),
      via: prof.name,
    };
  }
  const order = [
    primary,
    ...ENGINES.map((e) => e.name).filter((n) => n !== primary),
  ];
  for (const name of order) {
    const fn = ENGINES.find((e) => e.name === name).fn;
    try {
      return { text: restoreMath(await fn(safeText), map), via: name };
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

    // 翻译历史：默认收起（不常驻），点时钟小图标展开；
    // 条目显示 时间·翻译源，文件/页码藏在详情小图标里
    this.histOpen = false;
    this.histBar = this.contentEl.createDiv({ cls: "mini-hist-bar" });
    this.histToggleBtn = this.histBar.createEl("span", {
      cls: "mini-icon-btn",
      attr: { "aria-label": "翻译历史", title: "翻译历史" },
    });
    setIcon(this.histToggleBtn, "history");
    this.histToggleBtn.onclick = () => this.toggleHistory();
    this.histClearBtn = this.histBar.createEl("span", {
      cls: "mini-icon-btn",
      attr: { "aria-label": "清空全部历史", title: "清空全部历史" },
    });
    setIcon(this.histClearBtn, "trash-2");
    this.histClearBtn.onclick = async () => {
      this.plugin.settings.history = [];
      await this.plugin.saveData(this.plugin.settings);
      this.renderHistory();
      new Notice("已清空翻译历史", 1500);
    };
    this.histListEl = this.contentEl.createDiv({ cls: "mini-hist-list" });
    this.refreshHistoryCount();

    this.emptyEl = this.contentEl.createDiv({
      cls: "mini-empty",
      text: "选中文本后按快捷键\n原文与译文逐句对照显示在这里",
    });
    this.showPlaceholder();
    // 面板刚打开也走一次全量重建：否则下拉里只有内置引擎，大模型源要等下一次同步才出现
    this.syncSource();
    // 订阅中枢：设置页/管理弹窗改了任何源、模型或选中状态，这里立即实时重建
    this.unsubSources = onSourcesSync(() => this.syncSource());
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
  // ---------- 翻译历史 ----------
  refreshHistoryCount() {
    if (!this.histToggleBtn) return;
    const n = (this.plugin.settings.history || []).length;
    this.histToggleBtn.setAttribute("aria-label", `翻译历史（${n} 条）`);
    this.histToggleBtn.style.opacity = n ? "1" : "0.45";
  }
  toggleHistory() {
    this.histOpen = !this.histOpen;
    if (this.histOpen) this.renderHistory();
    else this.histListEl.hide();
  }
  renderHistory() {
    const list = this.plugin.settings.history || [];
    this.histListEl.empty();
    this.histListEl.show();
    this.refreshHistoryCount();
    if (!list.length) {
      this.histListEl.createDiv({
        cls: "mini-empty",
        text: "还没有翻译记录",
      });
      return;
    }
    for (let i = 0; i < list.length; i++) {
      const h = list[i];
      const item = this.histListEl.createDiv({ cls: "mini-hist-item" });
      const head = item.createDiv({ cls: "mini-hist-head" });
      head.createSpan({
        cls: "mini-hist-src",
        text: `${fmtHistTime(h.ts)} · ${h.via}`,
        attr: { title: `翻译源：${h.via}` },
      });
      // 详情小图标：展开 文件/页码 来源信息（不常驻）
      const info = head.createEl("span", {
        cls: "mini-icon-btn",
        attr: { title: "来源详情" },
      });
      setIcon(info, "file-text");
      const del = head.createEl("span", {
        cls: "mini-icon-btn",
        attr: { title: "删除这条记录" },
      });
      setIcon(del, "x");
      const preview = item.createDiv({ cls: "mini-hist-prev" });
      const firstZh = (h.pairs && h.pairs[0] && h.pairs[0].zh) || "";
      preview.setText(firstZh.replace(/\n/g, " ").slice(0, 60));
      const detail = item.createDiv({ cls: "mini-hist-detail" });
      detail.style.display = "none";
      const lines = [`时间：${new Date(h.ts).toLocaleString()}`];
      if (h.file) lines.push(`文件：${h.file}`);
      if (h.page) lines.push(`页码：第 ${h.page} 页`);
      if (!h.file && !h.page) lines.push("（无文件来源记录）");
      detail.setText(lines.join("\n"));
      info.onclick = (ev) => {
        ev.stopPropagation();
        detail.style.display =
          detail.style.display === "none" ? "" : "none";
      };
      del.onclick = async (ev) => {
        ev.stopPropagation();
        const arr = this.plugin.settings.history || [];
        arr.splice(i, 1);
        await this.plugin.saveData(this.plugin.settings);
        this.renderHistory();
      };
      item.onclick = () => {
        this.show(h.pairs, `${h.via} · 历史`);
        new Notice("已载入该条记录", 1200);
      };
    }
  }
  onClose() {
    // 面板关闭即退订，避免监听器堆积指向已销毁的 DOM
    if (this.unsubSources) this.unsubSources();
    this.unsubSources = null;
  }
}

// ---------- 设置页 ----------
class MiniTranslatorSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    // 订阅中枢：面板/管理弹窗里改了源或选中状态，设置页的下拉立即跟随（实时）
    this.unsubSources = onSourcesSync(() => {
      const s = plugin.settings;
      const resync = (dd, val, options) => {
        if (!dd) return;
        dd.selectEl.empty();
        for (const n of options) dd.addOption(n, n);
        dd.setValue(val);
      };
      resync(this.ddPrimary, s.primarySource, engineOptions());
      resync(this.ddDict, s.dictSource, dictOptions());
    });
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl)
      .setName("主翻译源（句子）")
      .setDesc("内置免费源 + 你配置的大模型源。谷歌需代理，国内直连不通；大模型源失败不回退免费源")
      .addDropdown((dd) => {
        this.ddPrimary = dd; // 挂到实例上，中枢同步时按最新引用重建
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
        this.ddDict = dd;
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
          if (!v) this.plugin.cancelAutoTranslate();
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

    containerEl.createEl("h3", { text: "全文翻译" });
    // 输出形式固定为纯译文（双语对照排版效果差，选项已移除）

    new Setting(containerEl)
      .setName("原版式 HTML 复刻")
      .setDesc("额外生成《文件名·翻译.html》（每页原图打底、中文按坐标覆盖，浏览器 Ctrl+P 打印成同版式 PDF），并在 Markdown 里嵌入每页原图。默认关闭，纯 Markdown 更快更稳")
      .addToggle((tg) =>
        tg
          .setValue(!!this.plugin.settings.fullHtml)
          .onChange(async (v) => {
            this.plugin.settings.fullHtml = v;
            await this.plugin.saveData(this.plugin.settings);
          })
      );

    containerEl.createEl("h3", { text: "悬浮球" });
    // 实时预览：直接复用 translation-orb 的 createOrbElement + 皮肤 token，不挂控制器
    //（无固定定位、无事件监听，纯展示，随下拉切换即时重绘）
    const orbMod = loadOrbModule(this.plugin);
    const orbRegistry = orbMod.createDefaultSkinRegistry();
    const skinList = orbRegistry.list(); // [{id,label,description}]
    const previewHost = containerEl.createDiv("mini-orb-preview");
    const renderOrbPreview = (skinId) => {
      previewHost.empty();
      const orb = orbMod.createOrbElement(document);
      const skin = orbRegistry.resolve(skinId);
      const surface = document.body.classList.contains("theme-dark") ? "dark" : "light";
      const size = Math.min(96, Math.max(28, Number(this.plugin.settings.orbSize) || 40));
      orb.dataset.skin = skin.id;
      orb.dataset.translationOrbSkin = skin.id;
      orb.dataset.translationOrbSurface = surface;
      orb.dataset.translationOrbState = "determinate";
      orb.style.setProperty("--orb-size", `${size}px`);
      orb.style.setProperty("--orb-scale", String(size / 40));
      orb.style.setProperty("--orb-offset", `${(size - 40) / 2}px`);
      orb.style.setProperty("--progress-offset", "38"); // 预览固定画 62%
      for (const [name, value] of Object.entries(skin.tokens[surface])) {
        orb.style.setProperty(name, value);
      }
      previewHost.style.height = `${Math.max(64, size + 24)}px`;
      previewHost.appendChild(orb);
    };
    new Setting(containerEl)
      .setName("皮肤")
      .setDesc("全文翻译最小化后的进度悬浮球外观；切换时上方实时预览")
      .addDropdown((dd) => {
        for (const s of skinList) dd.addOption(s.id, s.id); // 皮肤名直接显示英文 id
        dd.setValue(this.plugin.settings.orbSkin || "ink-wash").onChange(async (v) => {
          this.plugin.settings.orbSkin = v;
          await this.plugin.saveData(this.plugin.settings);
          renderOrbPreview(v);
        });
      });
    renderOrbPreview(this.plugin.settings.orbSkin || "ink-wash");

    new Setting(containerEl)
      .setName("悬浮球大小")
      .setDesc("拖动滑块调整悬浮球直径（28–96 px），上方会实时预览")
      .addSlider((slider) =>
        slider
          .setLimits(28, 96, 2)
          .setValue(Math.min(96, Math.max(28, Number(this.plugin.settings.orbSize) || 40)))
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.orbSize = value;
            await this.plugin.saveData(this.plugin.settings);
            renderOrbPreview(this.plugin.settings.orbSkin || "ink-wash");
          })
      );

    new Setting(containerEl)
      .setName("重置悬浮球位置")
      .setDesc("清除记录的拖动位置，下次最小化时回到默认右下角")
      .addButton((btn) =>
        btn.setButtonText("重置").onClick(async () => {
          this.plugin.settings.orbPosition = null;
          await this.plugin.saveData(this.plugin.settings);
          new Notice("悬浮球位置已重置", 2000);
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
        fullHtml: false, // 原版式 HTML 复刻：默认关（纯 Markdown 更快）
        history: [],
        llmProfiles: [],
        activeProfile: 0,
        orbSkin: "ink-wash", // 悬浮球皮肤（translation-orb 五款内置之一）
        orbSize: 40, // 悬浮球直径（px），设置页可在 28–96 之间调整
        orbPosition: null, // 悬浮球拖动位置 {x,y}，null 用默认右下角
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

    // 全文翻译进度：状态栏显示，点击取消（Notice 放不了按钮）
    this.resetFtCancel();
    this.ftStatusItem = this.addStatusBarItem();
    this.ftStatusItem.style.cursor = "pointer";
    this.ftStatusItem.hide();
    this.ftStatusItem.onclick = () => {
      this.requestFtCancel();
      new Notice("已请求取消：在途请求立即失效，正在停止", 3000);
    };
    // 中枢钩子：任何界面调 saveData 落盘即广播，所有源相关 UI 实时同步（含选中状态）
    const origSaveData = this.saveData.bind(this);
    this.saveData = async (data) => {
      await origSaveData(data);
      broadcastSources("save");
    };

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
        if (!this.settings.autoTranslate) this.cancelAutoTranslate();
        await this.saveData(this.settings);
        new Notice(
          `划线自动翻译：${this.settings.autoTranslate ? "开" : "关"}`,
          2000
        );
      },
    });

    this.addCommand({
      id: "cancel-selection-translation",
      name: "取消当前划词翻译",
      callback: () => {
        const hadPending = this.cancelAutoTranslate();
        const hadPopup = !!this.popupEl;
        if (hadPopup) this.closePopup();
        if (hadPending || hadPopup) new Notice("已取消当前划词翻译", 1500);
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
      id: "math-selftest",
      name: "测试公式渲染",
      callback: () => {
        const modal = new Modal(this.app);
        modal.contentEl.createEl("h3", { text: "LaTeX 渲染自检" });
        const note = modal.contentEl.createDiv();
        note.style.fontSize = "var(--font-smaller)";
        note.style.color = "var(--text-muted)";
        note.style.lineHeight = "1.6";
        note.style.marginBottom = "10px";
        note.appendText(
          "若下面四条公式显示为数学符号而不是 $..$ 源码，说明渲染管线正常；此时划论文仍不渲染，是因为 PDF 选中的文本本身不含完整 LaTeX（免费源无法恢复）——请换用大模型翻译源。"
        );
        const flow = modal.contentEl.createDiv();
        renderPairsTo(flow, [
          {
            en: "Bayes' rule gives $p(\\theta \\mid x) \\propto p(x \\mid \\theta)p(\\theta)$ and \\(E = mc^2\\) holds.",
            zh: "由贝叶斯公式可得 $p(\\theta \\mid x) \\propto p(x \\mid \\theta)p(\\theta)$；能量满足 $$E = mc^2$$；并有 \\[\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}\\] 成立。",
          },
        ]);
        modal.open();
      },
    });

    this.addCommand({
      id: "translate-full-pdf",
      name: "全文翻译当前 PDF",
      callback: () => this.fullTranslateFlow(),
    });

    this.addCommand({
      id: "translate-full-pick",
      name: "全文翻译：选择文件（可多选）",
      callback: () => new FilePickTranslateModal(this.app, this).open(),
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
    // 选择尚未触发翻译时，任何新的指针操作都视为用户改变了意图：静默取消等待。
    // 这样误划后点回正文/工具栏即可撤销，不需要等计时器跑完，也不会弹出多余提示。
    this.registerDomEvent(document, "pointerdown", () =>
      this.cancelAutoTranslate()
    );
    // Esc 是等待阶段最明确的取消键；弹窗打开后仍由弹窗自己的 Esc 监听负责关闭。
    this.registerDomEvent(document, "keydown", (e) => {
      if (e.key === "Escape") this.cancelAutoTranslate();
    });
  }

  // ---------- 全文翻译取消中枢：requestFtCancel 通过 Promise.race 立即失效在途请求 ----------
  // （requestUrl 不支持 AbortController，用竞速让 await 处马上返回，底层请求自然被丢弃）
  requestFtCancel() {
    this.ftCancel = true;
    if (this._ftCancelResolve) this._ftCancelResolve();
  }

  resetFtCancel() {
    this.ftCancel = false;
    this.ftCancelPromise = new Promise((res) => {
      this._ftCancelResolve = res;
    });
  }

  onunload() {
    this.closePopup();
    this.cancelAutoTranslate();
    SOURCE_SYNC_LISTENERS.clear(); // 禁用插件时清空中枢订阅
  }

  // 设置/配置变更后通知面板立即刷新（选项重建 + 当前值同步），并清空翻译缓存
  refreshPanel() {
    CACHE.clear(); // 换源/改配置后不喂旧缓存
    broadcastSources("refresh");
  }

  // 只取消“停留等待”阶段，不主动清掉用户当前选区；若弹窗已经出现，
  // Esc / 点击外部 / 右上角 × 会通过 closePopup 递增 _popupRunId，令在途结果失效。
  cancelAutoTranslate() {
    const hadPending = this.dwellTimer != null;
    if (hadPending) clearTimeout(this.dwellTimer);
    this.dwellTimer = null;
    this._autoTranslatePending = null;
    return hadPending;
  }

  onSelectionChanged() {
    this.cancelAutoTranslate();
    if (!this.settings.autoTranslate) return;
    const sel = window.getSelection();
    const t = ((sel && sel.toString()) || "").trim();
    if (!t || !/[a-zA-Z]/.test(t)) return;
    // 弹窗内部的选中不触发
    if (this.popupEl && sel.anchorNode && this.popupEl.contains(sel.anchorNode)) {
      return;
    }
    const delay = (this.settings.autoTranslateDelay ?? 2) * 1000;
    // 用对象 token 防止一个已经排队但未被及时清理的旧回调误触发。
    const pendingToken = { text: t };
    this._autoTranslatePending = pendingToken;
    this.dwellTimer = setTimeout(() => {
      if (this._autoTranslatePending !== pendingToken) return;
      this.dwellTimer = null;
      this._autoTranslatePending = null;
      const cur = window.getSelection();
      const curText = ((cur && cur.toString()) || "").trim();
      // 必须仍是同一段选区；误划后重新拖动/点击不会把旧选区送进翻译。
      if (!curText || curText !== pendingToken.text || !/[a-zA-Z]/.test(curText)) return;
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
  _normalizePopupAnchor(x, y, anchor) {
    const vw = Math.max(1, Number(window.innerWidth) || 1);
    const vh = Math.max(1, Number(window.innerHeight) || 1);
    const finite = (value, fallback) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    };
    // x/y historically meant the requested popup origin (y is selection bottom + 6px).
    // Keep that fallback for callers that cannot expose a real selection rectangle.
    const fallbackLeft = finite(x, Math.max(8, (vw - POPUP_MAX_WIDTH_PX) / 2));
    const fallbackBottom = finite(y, vh / 2) - 6;
    const left = finite(anchor?.left, fallbackLeft);
    const top = finite(anchor?.top, Math.max(0, fallbackBottom - 22));
    const right = finite(anchor?.right, left);
    const bottom = finite(anchor?.bottom, Math.max(top, fallbackBottom));
    return {
      left: Math.min(left, right),
      top: Math.min(top, bottom),
      right: Math.max(left, right),
      bottom: Math.max(top, bottom),
    };
  }

  _placePopup(el, anchor = this.lastPopupAnchor) {
    if (!el || !el.isConnected) return;
    const margin = 8;
    const vw = Math.max(1, Number(window.innerWidth) || document.documentElement.clientWidth || 1);
    const vh = Math.max(1, Number(window.innerHeight) || document.documentElement.clientHeight || 1);
    let rect = el.getBoundingClientRect();
    if (this._popupDragged) {
      // Preserve the existing drag affordance. A manually moved popup is only kept
      // inside the viewport; automatic above/below placement resumes on next popup.
      const currentLeft = Number.parseFloat(el.style.left);
      const currentTop = Number.parseFloat(el.style.top);
      const maxLeft = Math.max(margin, vw - rect.width - margin);
      const maxTop = Math.max(margin, vh - rect.height - margin);
      el.style.left = `${Math.min(maxLeft, Math.max(margin, Number.isFinite(currentLeft) ? currentLeft : rect.left))}px`;
      el.style.top = `${Math.min(maxTop, Math.max(margin, Number.isFinite(currentTop) ? currentTop : rect.top))}px`;
      return;
    }
    const gap = 8;
    const a = anchor || this._normalizePopupAnchor(null, null, null);
    const body = this.popupBodyEl && el.contains(this.popupBodyEl) ? this.popupBodyEl : null;
    // Re-measure against the compact cap on every update. The popup can grow while a
    // real network stream arrives, but it should remain a small, scrollable overlay.
    if (body) body.style.maxHeight = POPUP_BODY_MAX_HEIGHT;
    rect = el.getBoundingClientRect();
    const belowTop = a.bottom + gap;
    const aboveTop = a.top - rect.height - gap;
    const belowRoom = vh - margin - belowTop;
    const aboveRoom = a.top - gap - margin;
    const belowFits = belowTop + rect.height <= vh - margin;
    const aboveFits = aboveTop >= margin;

    // Below is the default. Only flip above when below would leave any part outside
    // the viewport and the complete popup fits above the selected text.
    let placement = "below";
    if (!belowFits && aboveFits) placement = "above";
    else if (!belowFits && !aboveFits) {
      // Extremely tight viewports: use the side with more room and cap the body so
      // the popup itself stays visible without crossing the selection.
      placement = aboveRoom > belowRoom ? "above" : "below";
      const room = Math.max(24, placement === "above" ? aboveRoom : belowRoom);
      const bodyHeight = body ? body.getBoundingClientRect().height : 0;
      const chrome = Math.max(0, rect.height - bodyHeight);
      if (body) body.style.maxHeight = `${Math.max(24, room - chrome)}px`;
      rect = el.getBoundingClientRect();
    }

    const maxLeft = Math.max(margin, vw - rect.width - margin);
    const left = Math.min(maxLeft, Math.max(margin, a.left));
    const desiredTop = placement === "above" ? a.top - rect.height - gap : belowTop;
    const maxTop = Math.max(margin, vh - rect.height - margin);
    // In the normal cases desiredTop is already in range. The final clamp only handles
    // a viewport smaller than the popup's chrome; body max-height above handles content.
    const top = Math.min(maxTop, Math.max(margin, desiredTop));
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.dataset.placement = placement;
  }

  showPopup(text, x, y, via, pending, anchor = null) {
    this.closePopup();
    // Every popup gets a generation id. A response from a previous selection must not
    // paint into a newly opened popup after the user starts another translation.
    this._popupRunId = (this._popupRunId || 0) + 1;
    this._popupDragged = false;
    this.lastPopupPos = { x, y };
    this.lastPopupAnchor = this._normalizePopupAnchor(x, y, anchor);
    const el = document.body.createDiv();
    el.addClass("mini-translator-popup");
    Object.assign(el.style, {
      position: "fixed",
      left: `${Math.max(8, this.lastPopupAnchor.left)}px`,
      top: `${Math.max(8, this.lastPopupAnchor.bottom + 8)}px`,
      zIndex: "1000",
      // Keep short translations compact while capping long ones at a readable width.
      // The intrinsic width grows with the rendered content and the max-width makes
      // longer source/translation pairs wrap instead of stretching across the screen.
      width: "fit-content",
      minWidth: POPUP_MIN_WIDTH,
      maxWidth: POPUP_MAX_WIDTH,
      boxSizing: "border-box",
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
    const copyBtn = header.createSpan({ text: "复制" });
    copyBtn.style.cursor = "pointer";
    copyBtn.style.marginLeft = "auto";
    copyBtn.setAttribute("aria-label", "复制译文");
    copyBtn.onmousedown = (e) => e.stopPropagation();
    copyBtn.onclick = async () => {
      if (this.lastPopupText) {
        await navigator.clipboard.writeText(this.lastPopupText);
        new Notice("已复制", 1500);
      }
    };
    const closeBtn = header.createSpan({ text: "×" });
    closeBtn.className = "mini-popup-close";
    closeBtn.setAttribute("role", "button");
    closeBtn.tabIndex = 0;
    closeBtn.setAttribute("aria-label", "关闭翻译弹窗");
    closeBtn.title = pending ? "取消翻译" : "关闭";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.marginLeft = "10px";
    closeBtn.style.fontSize = "18px";
    closeBtn.style.lineHeight = "1";
    closeBtn.onmousedown = (e) => e.stopPropagation();
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      this.closePopup();
    };
    closeBtn.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.closePopup();
      }
    };
    this.popupCloseBtn = closeBtn;
    // 拖动：按住头部任意空白处移动
    header.style.cursor = "move";
    header.style.userSelect = "none";
    let sx = 0;
    let sy = 0;
    let ox = 0;
    let oy = 0;
    header.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      this._popupDragged = true;
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
      maxHeight: POPUP_BODY_MAX_HEIGHT,
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
    this.popupEl = el;
    this._placePopup(el);
    this._popupResize = () => this._placePopup(this.popupEl);
    window.addEventListener("resize", this._popupResize);
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

  _cancelPopupStreams() {
    this._popupStreamCancel?.(); // compatibility with a popup created before reload
    this._popupStreamCancel = null;
  }

  _refreshPopupText() {
    const slots = Array.isArray(this._popupSlots) ? this._popupSlots : [];
    this.lastPopupText = slots
      .filter((slot) => slot.translated && slot.pair)
      .map((slot) => `${slot.pair.en}\n${slot.pair.zh}`)
      .join("\n\n");
  }

  // Put every source line in the popup immediately. Translation rows start as a
  // lightweight placeholder and are replaced as each API response arrives.
  showPopupSources(sources, via = null) {
    if (!this.popupEl || !this.popupBodyEl) return;
    this._cancelPopupStreams();
    const body = this.popupBodyEl;
    body.replaceChildren();
    body.classList.add("mini-flow");
    this._popupSlots = [];
    this._popupSlotBody = body;
    for (const source of Array.isArray(sources) ? sources : []) {
      const item = typeof source === "string" ? { en: source } : source || { en: "" };
      const en = document.createElement("div");
      en.className = "mini-en-line";
      body.appendChild(en);
      renderRichText(en, typofixEn(item.en || ""));

      const zh = document.createElement("div");
      const waiting = item.waiting !== false;
      zh.className = item.dict
        ? `mini-dict-line${waiting ? " mini-zh-pending" : ""}`
        : `mini-zh-line${waiting ? " mini-zh-pending" : ""}`;
      if (waiting) {
        // 头部已经显示“翻译中…”，行内用三个动态圆点提示等待，避免重复长文字。
        const dots = document.createElement("span");
        dots.className = "mini-translator-waiting-dots";
        dots.setAttribute("aria-label", "翻译中");
        for (let i = 0; i < 3; i++) {
          dots.appendChild(document.createElement("i"));
        }
        zh.appendChild(dots);
      }
      body.appendChild(zh);
      this._popupSlots.push({
        source: item.en || "",
        enEl: en,
        zhEl: zh,
        pair: null,
        translated: false,
        final: false,
      });
    }
    this.pendingLabel = null;
    if (via) {
      const labelSpan = this.popupHeaderEl?.querySelector("span");
      if (labelSpan) labelSpan.textContent = `翻译 · ${via}`;
    }
    this._refreshPopupText();
    this._placePopup(this.popupEl);
  }

  updatePopupTranslation(index, pair, via) {
    const slot = this._popupSlots?.[index];
    if (!slot || !slot.zhEl) return;
    const nextPair = {
      en: pair?.en || slot.source,
      zh: String(pair?.zh || ""),
      dict: !!pair?.dict,
    };
    if (
      slot.translated &&
      slot.final &&
      slot.pair &&
      slot.pair.en === nextPair.en &&
      slot.pair.zh === nextPair.zh &&
      slot.pair.dict === nextPair.dict
    ) {
      return;
    }

    slot.pair = nextPair;
    slot.translated = true;
    slot.final = true;
    const zhEl = slot.zhEl;
    zhEl.className = nextPair.dict ? "mini-dict-line" : "mini-zh-line";
    zhEl.replaceChildren();
    renderRichText(zhEl, typofixZh(nextPair.zh));
    this._refreshPopupText();
    if (via) {
      const labelSpan = this.popupHeaderEl?.querySelector("span");
      if (labelSpan) labelSpan.textContent = `翻译 · ${via}`;
    }
    this._placePopup(this.popupEl);
    window.requestAnimationFrame?.(() => this._placePopup(this.popupEl));
  }

  updatePopupPairs(pairs, via) {
    if (!this.popupEl || !this.popupBodyEl) {
      const p = this.lastPopupPos || { x: window.innerWidth - 520, y: 80 };
      this.showPopup("", p.x, p.y, via, false, this.lastPopupAnchor);
    }
    const list = Array.isArray(pairs) ? pairs : [];
    if (
      this._popupSlotBody !== this.popupBodyEl ||
      !Array.isArray(this._popupSlots) ||
      this._popupSlots.length !== list.length
    ) {
      this.showPopupSources(list.map((p) => ({ en: p.en, dict: p.dict })), via);
    }
    const labelSpan = this.popupHeaderEl?.querySelector("span");
    if (labelSpan) {
      labelSpan.textContent = via ? `翻译 · ${via}` : "Mini Translator";
    }
    this.pendingLabel = null;
    list.forEach((pair, index) => {
      const slot = this._popupSlots?.[index];
      const same =
        slot?.translated &&
        slot?.final &&
        slot.pair &&
        slot.pair.en === (pair?.en || slot.source) &&
        slot.pair.zh === String(pair?.zh || "") &&
        slot.pair.dict === !!pair?.dict;
      if (!same) this.updatePopupTranslation(index, pair, via);
    });
    this._refreshPopupText();
  }

  failPopup(msg) {
    if (!this.popupEl) {
      new Notice(`翻译失败：${msg}`, 8000);
      return;
    }
    const labelSpan = this.popupHeaderEl.querySelector("span");
    if (labelSpan) labelSpan.textContent = "翻译失败";
    this._cancelPopupStreams();
    this.pendingLabel = null;
    this.popupBodyEl.empty();
    this.popupBodyEl.setText(msg);
    this._placePopup(this.popupEl);
  }

  closePopup() {
    this._popupRunId = (this._popupRunId || 0) + 1;
    this._cancelPopupStreams();
    this._popupSlots = [];
    this._popupSlotBody = null;
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
    if (this._popupResize) {
      window.removeEventListener("resize", this._popupResize);
      this._popupResize = null;
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
      let anchor = null;
      if (sel.rangeCount > 0) {
        const r = sel.getRangeAt(0).getBoundingClientRect();
        const b = iframe.getBoundingClientRect();
        anchor = {
          left: b.left + r.left,
          top: b.top + r.top,
          right: b.left + r.right,
          bottom: b.top + r.bottom,
        };
        x = anchor.left;
        y = anchor.bottom + 6;
      }
      return { text, x, y, anchor };
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
        tried.push([
          "主窗口选区",
          {
            text: t,
            x: r.left,
            y: r.bottom + 6,
            anchor: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
          },
        ]);
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
    let anchor = null;
    if (mdView && mdView.editor) {
      text = (mdView.editor.getSelection() || "").trim();
      const editor = mdView.editor;
      const from = editor.getCursor("from");
      const to = editor.getCursor("to");
      const readCoords = (pos, mode) => {
        try {
          const c = editor.coordsAtPos(pos, mode);
          if (!c) return null;
          const base = mode === "window" ? null : editor.containerEl.getBoundingClientRect();
          const left = Number(c.left);
          const right = Number(c.right);
          const top = Number(c.top);
          const bottom = Number(c.bottom);
          return {
            left: (Number.isFinite(left) ? left : 0) + (base ? base.left : 0),
            right: (Number.isFinite(right) ? right : left) + (base ? base.left : 0),
            top: (Number.isFinite(top) ? top : 0) + (base ? base.top : 0),
            bottom: (Number.isFinite(bottom) ? bottom : top) + (base ? base.top : 0),
          };
        } catch (e) {
          return null;
        }
      };
      let points = [readCoords(from, "window"), readCoords(to, "window")].filter(Boolean);
      if (!points.length) {
        points = [readCoords(from, "local"), readCoords(to, "local")].filter(Boolean);
      }
      if (points.length) {
        anchor = {
          left: Math.min(...points.map((p) => p.left)),
          top: Math.min(...points.map((p) => p.top)),
          right: Math.max(...points.map((p) => Number.isFinite(p.right) ? p.right : p.left)),
          bottom: Math.max(...points.map((p) => p.bottom)),
        };
        x = anchor.left;
        y = anchor.bottom + 6;
      }
    } else {
      const info = this.getPdfSelectionInfo();
      if (info) {
        text = info.text;
        x = info.x;
        y = info.y;
        anchor = info.anchor || null;
      }
    }
    if (!text) {
      new Notice("没有拿到选中的文本：请在笔记或 PDF 里先选中文本再按快捷键", 6000);
      return;
    }
    // 源文本规范化：清不可见字符 + 把 Unicode 数学子/上标字母还原为 ASCII
    text = demathify(cleanInvisibles(text));
    // 立刻弹窗；译文返回后直接填充，不额外等待或播放打字机动画。
    const px = x != null ? x : window.innerWidth - 520;
    const py = y != null ? y : 80;
    const isWord = WORD_RE.test(text);
    const sentenceList = !isWord && mode !== "paragraph" ? splitSentences(text) : null;
    const translateProfile = findProfile(this.settings.primarySource);
    // 大模型（无论“逐句”还是“整段”命令）一次收到完整选区，保证上下文质量；
    // 只有内置非流式引擎才保留逐句对齐。
    const wholeText = !isWord && (!!translateProfile || mode === "paragraph");
    const sourceLines =
      isWord || wholeText ? [text] : sentenceList;
    const sourceEntries = sourceLines.map((source) => {
      const value = typeof source === "string" ? source : source?.en || "";
      const key = isWord
        ? `dict:${sourceKey(this.settings.dictSource)}:${value}`
        : `src:${sourceKey(this.settings.primarySource)}:${value}`;
      return {
        en: value,
        dict: isWord,
        waiting: !CACHE.has(key),
      };
    });
    const pending = sourceEntries.some((entry) => entry.waiting);
    this.showPopup("", px, py, null, pending, anchor);
    // 原文不再等待翻译结果：先把所有可确定的原文行放进去，后续只替换译文行。
    this.showPopupSources(sourceEntries, null);
    const popupRunId = this._popupRunId;
    const t0 = Date.now();
    try {
      const pairs = [];
      let via = "";
      // 数据层统一重排版：词典保留每词性一行；句子/段落译文重排为自然段落
      const fmtDict = (t) => typofixZh(t);
      const fmtFlow = (t) => reflowZh(t);
      if (isWord) {
        const key = `dict:${sourceKey(this.settings.dictSource)}:${text}`;
        const r = await cached(key, () => dictLookup(text, this.settings.dictSource));
        const pair = { en: typofixEn(text), zh: fmtDict(r.text), dict: true };
        pairs.push(pair);
        if (this._popupRunId === popupRunId) {
          this.updatePopupTranslation(0, pair, r.via);
        }
        via = r.via;
      } else if (wholeText) {
        const key = `src:${sourceKey(this.settings.primarySource)}:${text}`;
        const r = await cached(
          key,
          () => translateSentence(text, this.settings.primarySource)
        );
        const pair = { en: typofixEn(text), zh: fmtFlow(r.text) };
        pairs.push(pair);
        if (this._popupRunId === popupRunId) {
          this.updatePopupTranslation(0, pair, r.via);
        }
        via = r.via;
      } else if (mode === "paragraph") {
        // 整段翻译：一次请求，原文段与译文段上下对照
        const r = await cached(
          `src:${sourceKey(this.settings.primarySource)}:${text}`,
          () => translateSentence(text, this.settings.primarySource)
        );
        const pair = { en: typofixEn(text), zh: fmtFlow(r.text) };
        pairs.push(pair);
        if (this._popupRunId === popupRunId) {
          this.updatePopupTranslation(0, pair, r.via);
        }
        via = r.via;
      } else {
        // 非流式的内置引擎仍按句对齐；每个响应到达后立即填充，不再追加展示动画。
        const sentences = sentenceList || splitSentences(text);
        const vias = new Set();
        for (let i = 0; i < sentences.length; i++) {
          if (this._popupRunId !== popupRunId) return;
          const r = await cached(
            `src:${sourceKey(this.settings.primarySource)}:${sentences[i]}`,
            () => translateSentence(sentences[i], this.settings.primarySource)
          );
          if (this._popupRunId !== popupRunId) return;
          const pair = { en: typofixEn(sentences[i]), zh: fmtFlow(r.text) };
          pairs.push(pair);
          this.updatePopupTranslation(i, pair, r.via);
          vias.add(r.via);
        }
        via = Array.from(vias).join("/");
      }
      if (this._popupRunId !== popupRunId) return;
      const meta = `${via} · ${Date.now() - t0}ms`;
      if (this.panelView) {
        this.panelView.syncSource();
        this.panelView.show(pairs, meta);
      }
      this.updatePopupPairs(pairs, via);
      // 历史记录：附上来源（哪个文件、PDF 第几页 / 笔记名）
      let hFile = "";
      let hPage = null;
      if (mdView && mdView.file) {
        hFile = mdView.file.basename;
      } else {
        try {
          const loc = await this.locatePdfDoc();
          if (loc) {
            hFile = loc.leaf.view.file ? loc.leaf.view.file.name : "";
            hPage = loc.page || null;
          }
        } catch (e) {}
      }
      this.pushHistory(pairs, via, hFile, hPage);
      console.log("[mini-translator] 耗时", Date.now() - t0, "ms | 源:", via);
    } catch (e) {
      if (this._popupRunId === popupRunId) {
        this.failPopup(e.message || String(e));
      }
    }
  }

  // ---------- 全文翻译当前 PDF ----------
  // 定位已打开 PDF 的 pdf.js 文档对象。
  // Obsidian 1.8+ 官方内部链：view.viewer.child.pdfViewer（原型为 window.pdfjsViewer.PDFViewerApplication，
  // 参考 RyotaUshio/obsidian-pdf-plus 的 typings 与 patchers）；文档未加载完时等待其 pdfLoadingTask
  async locatePdfDoc() {
    const isPdf = (l) =>
      l && l.view && l.view.getViewType && l.view.getViewType() === "pdf";
    let leaf = this.app.workspace.getMostRecentLeaf();
    if (!isPdf(leaf)) leaf = this.app.workspace.getLeavesOfType("pdf")[0];
    if (!isPdf(leaf)) return null;
    // 策略1：官方内部链（1.8+；旧版本里 child 本身就是 viewer 实例）
    try {
      const child = leaf.view.viewer && leaf.view.viewer.child;
      const pv = child && (child.pdfViewer || child);
      if (pv) {
        if (pv.pdfDocument) {
          return { doc: pv.pdfDocument, page: pv.currentPageNumber || null, leaf };
        }
        if (pv.pdfLoadingTask && pv.pdfLoadingTask.promise) {
          const doc = await pv.pdfLoadingTask.promise;
          return { doc, page: pv.currentPageNumber || null, leaf };
        }
      }
    } catch (e) {}
    // 策略2：旧全局名兜底（历史结构）
    const tryApp = (win) => {
      try {
        const app = win && win.PDFViewerApplication;
        if (!app) return null;
        const doc =
          app.pdfDocument || (app.pdfViewer && app.pdfViewer.pdfDocument);
        return doc ? { doc, page: app.page || null } : null;
      } catch (e) {
        return null;
      }
    };
    for (const fr of Array.from(leaf.view.containerEl.querySelectorAll("iframe"))) {
      const hit = tryApp(fr.contentWindow);
      if (hit) return { doc: hit.doc, page: hit.page, leaf };
    }
    for (let i = 0; i < window.frames.length; i++) {
      const hit = tryApp(window.frames[i]);
      if (hit) return { doc: hit.doc, page: hit.page, leaf };
    }
    const hit3 = tryApp(window);
    if (hit3) return { doc: hit3.doc, page: hit3.page, leaf };
    return null;
  }

  // ---------- 翻译历史：带来源（源名 + 文件 + 页码），持久化到 data.json，上限 50 条 ----------
  async pushHistory(pairs, via, file, page) {
    try {
      if (!Array.isArray(this.settings.history)) this.settings.history = [];
      const h = this.settings.history;
      const sig = pairs.map((p) => p.en + "|" + p.zh).join("|");
      if (h.length && h[0].sig === sig) return; // 连续重复不记
      h.unshift({
        ts: Date.now(),
        via,
        pairs,
        sig,
        file: file || "",
        page: page || null,
      });
      if (h.length > 50) h.length = 50;
      await this.saveData(this.settings);
      if (this.panelView) this.panelView.refreshHistoryCount();
    } catch (e) {
      console.warn("[mini-translator] 历史保存失败:", e);
    }
  }

  setFullTranslateStatus(text) {
    if (!this.ftStatusItem) return;
    this.ftStatusItem.setText(text);
    this.ftStatusItem.show();
  }

  clearFullTranslateStatus() {
    if (this.ftStatusItem) this.ftStatusItem.hide();
  }

  // 全文翻译仅支持大模型源：分批协议 + LaTeX 重建都依赖大模型能力，免费源无法胜任
  ensureLlmForFull() {
    if (findProfile(this.settings.primarySource)) return true;
    new Notice(
      "全文翻译只支持大模型源：请先在设置里添加并选中一个大模型配置",
      8000
    );
    return false;
  }

  async fullTranslateFlow() {
    if (!this.ensureLlmForFull()) return;
    const loc = await this.locatePdfDoc();
    if (!loc) {
      new Notice(
        "没有找到已打开的 PDF：请先在 Obsidian 里打开要翻译的 PDF（或用「全文翻译：选择文件」直接选文件）",
        6000
      );
      return;
    }
    const doc = loc.doc;
    const file = loc.leaf.view.file;
    new Notice("正在提取 PDF 文本…", 3000);
    let blocks = [];
    try {
      const r = await extractDocBlocks(doc, (i, n) =>
        this.setFullTranslateStatus(`MT 提取 ${i}/${n}`)
      );
      blocks = r.blocks;
    } catch (e) {
      this.clearFullTranslateStatus();
      new Notice(`提取 PDF 文本失败：${e.message}`, 8000);
      return;
    }
    this.clearFullTranslateStatus();
    if (this.ftCancel) {
      this.resetFtCancel();
      new Notice("已取消", 2000);
      return;
    }
    const transChars = blocks.reduce((n, b) => n + b.text.length, 0);
    if (!transChars) {
      new Notice(
        "这份 PDF 没有可提取的文本层（可能是扫描件）。扫描件需要 OCR，暂不支持",
        8000
      );
      return;
    }
    const info = this.buildDocInfo(file || { name: "未知文件", path: "" }, blocks);
    info.doc = doc;
    info.blocks = blocks;
    new FullTranslateModal(this.app, this, info).open();
  }

  // 从块结构构建任务信息（当前 PDF 与多选弹窗共用）：批次划分、token/耗时估算
  // （全文翻译为大模型源专用，全部块都进管线；isSkippableBlock 只影响 HTML 白块覆盖决策）
  buildDocInfo(file, blocks) {
    const batches = groupIntoBatches(blocks);
    let chars = 0;
    for (const b of blocks) chars += b.text.length;
    const prof = findProfile(this.settings.primarySource);
    const pages = blocks.reduce((m, b) => Math.max(m, b.page), 0);
    return {
      fileName: file.name,
      pdfPath: file.path,
      pages,
      chars,
      transN: blocks.length,
      chunks: batches.length,
      source:
        this.settings.primarySource +
        (prof && prof.activeModel ? `（${prof.activeModel}）` : ""),
      eta: `约 ${Math.max(1, Math.ceil((batches.length * 3.5) / 60))} 分钟`,
      tokensEst: estTokens(chars),
      // 输出形式固定为纯译文（双语对照选项已移除）；bilingual 字段不再写入
    };
  }

  // ---------- 进度窗控制（应用内弹窗版） ----------
  ensureProg() {
    if (!this.progModal) new TranslateProgressModal(this.app, this).open();
    return this.progModal;
  }

  progUpdate(st) {
    if (this.progModal) this.progModal.update(st);
  }

  endProg() {
    if (this.progModal) this.progModal.finish();
  }

  // 多选批量全文翻译：逐份顺序执行，中途可取消，只打开最后一份结果
  async runPickedTranslate(jobs) {
    if (!this.ensureLlmForFull()) return;
    let ok = 0;
    this.ensureProg();
    for (let i = 0; i < jobs.length; i++) {
      if (this.ftCancel) break;
      const job = jobs[i];
      const tag = `[${i + 1}/${jobs.length}] ${job.file.name}`;
      try {
        let doc = job.doc || null;
        let blocks = job.blocks || null;
        if (!doc) doc = (await getPdfDocForFile(this, job.file)).doc;
        if (!blocks) {
          const r = await extractDocBlocks(doc, (p, n) =>
            this.progUpdate({ fileTag: tag, phase: "提取文本", done: p, total: n })
          );
          blocks = r.blocks;
        }
        const info = this.buildDocInfo(job.file, blocks);
        if (!info.chars) throw new Error("扫描件无文本层");
        info.doc = doc;
        info.blocks = blocks;
        info.openResult = i === jobs.length - 1; // 批量时只打开最后一个结果
        info.batchLabel = `${i + 1}/${jobs.length}`;
        const cancelled = await this.runFullTranslate(info);
        ok++;
        if (cancelled) {
          new Notice("批量全文翻译已取消", 3000);
          break;
        }
      } catch (e) {
        new Notice(`「${job.file.name}」失败：${e.message || e}`, 6000);
      }
    }
    this.endProg();
    if (jobs.length > 1)
      new Notice(`批量全文翻译完成：成功 ${ok}/${jobs.length} 份`, 5000);
    this.resetFtCancel();
  }

  async runFullTranslate(info) {
    const base = info.fileName.replace(/\.pdf$/i, "");
    const dir = info.pdfPath.includes("/")
      ? info.pdfPath.slice(0, info.pdfPath.lastIndexOf("/"))
      : "";
    const join = (name) => `${dir ? dir + "/" : ""}${name}`;
    let path = join(`${base}·翻译.md`);
    for (let n = 2; await this.app.vault.adapter.exists(path); n++) {
      path = join(`${base}·翻译 ${n}.md`);
    }
    let htmlPath = join(`${base}·翻译.html`);
    for (let n = 2; await this.app.vault.adapter.exists(htmlPath); n++) {
      htmlPath = join(`${base}·翻译 ${n}.html`);
    }
    this.resetFtCancel();
    const t0 = Date.now();
    const d = new Date();
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    this.ensureProg();
    const fileTag = `${info.batchLabel ? "[" + info.batchLabel + "] " : ""}${info.fileName}`;

    // 阶段1：批量翻译（逐块缓存，批解析失败自动降级）
    let results = null;
    try {
      const r = await translateBlocksAll(this, info.blocks, this.settings.primarySource, (st) =>
        this.progUpdate({ ...st, fileTag })
      );
      results = r.results;
    } catch (e) {
      this.endProg();
      new Notice(`全文翻译失败：${e.message || e}`, 8000);
      this.resetFtCancel();
      return false;
    }

    // 取消后快速收尾：跳过页面渲染与结果打开，只写部分 md（已翻部分有缓存，重跑秒回）
    const wasCancelled = !!this.ftCancel;

    // 阶段2：整页渲染成 JPEG（图表/公式像素原样保留）
    let pageImgs = [];
    if (info.doc && !wasCancelled && this.settings.fullHtml) {
      try {
        pageImgs = await renderPageImages(
          this,
          info.doc,
          1.5,
          0.9,
          (i, n) => this.progUpdate({ fileTag, phase: "渲染页面", done: i, total: n })
        );
      } catch (e) {
        new Notice(`页面渲染失败（跳过原版式 HTML）：${e.message}`, 5000);
      }
    }

    // 阶段3：装配 Markdown 笔记 + 原版式复刻 HTML
    this.progUpdate({ fileTag, phase: "写入文件", done: 0, total: 1 });
    let md =
      "---\n" +
      `title: "${base} 全文翻译"\n` +
      "type: full-translation\n" +
      `source_file: "${info.pdfPath}"\n` +
      `translated_with: "${info.source}"\n` +
      `created: ${ymd}\n` +
      "---\n\n" +
      `# ${base} 全文翻译\n\n` +
      (this.settings.fullHtml
        ? `> 由 Mini Translator 生成（${info.source}）。全部文本块（含公式密集块）经大模型重建：英文为修复重建版（公式 → LaTeX），公式统一转为 Obsidian 可渲染的 $/$$ 定界符，可能有误，请对照原版式 HTML 或下方页图核对。同目录还有「${base}·翻译.html」原版式对照版。\n`
        : `> 由 Mini Translator 生成（${info.source}）。全部文本块经大模型重建：英文为修复重建版（公式 → LaTeX），公式统一转为 Obsidian 可渲染的 $/$$ 定界符，可能有误。\n`);

    // 页面图片附件（≤30 页才写盘嵌入，避免超长文献撑爆库）
    const imgDir = join(`${base}·翻译页`);
    const embedPages = pageImgs.length > 0 && info.pages <= 30;
    if (embedPages) {
      try {
        if (!this.app.vault.getAbstractFileByPath(imgDir))
          await this.app.vault.createFolder(imgDir);
      } catch (e) {}
    }

    const blocksByPage = new Map();
    info.blocks.forEach((b, i) => {
      if (!blocksByPage.has(b.page)) blocksByPage.set(b.page, []);
      blocksByPage.get(b.page).push(i);
    });

    let failures = [];
    let doneBlocks = 0;
    for (let p = 1; p <= info.pages; p++) {
      md += `\n## 第 ${p} 页\n\n`;
      if (embedPages && pageImgs[p - 1]) {
        const ipath = `${imgDir}/page-${p}.jpg`;
        try {
          await this.app.vault.adapter.writeBinary(
            ipath,
            dataUrlToBuffer(pageImgs[p - 1].dataUrl)
          );
          md += `> [!info]- 第 ${p} 页原图\n> ![[${ipath}]]\n\n`;
        } catch (e) {}
      }
      const idxs = blocksByPage.get(p) || [];
      for (const gi of idxs) {
        const res = results[gi];
        if (!res || !res.zh) continue; // 取消时未翻到的块跳过
        if (res.zh.startsWith("⚠️")) failures.push(gi + 1);
        // 输出形式固定纯译文：不再写英文原文引用块
        // 先归一定界符再重排：转换出的 $$…$$ 会被 mapMath 保护，内部换行不被折叠
        md += reflowZh(normalizeMathDelims(res.zh)) + "\n\n";
        doneBlocks++;
      }
    }

    const wasCancelledFlag = results.some((r, i) => !r);
    if (this.ftCancel || wasCancelledFlag) {
      md += `\n> [!note] 已取消（完成 ${doneBlocks}/${info.transN} 块；重新运行会复用缓存，已翻过的部分秒回）\n`;
    }
    md += `\n---\n\n*共 ${info.pages} 页 · ${doneBlocks}/${info.transN} 块 · 耗时 ${Math.round((Date.now() - t0) / 1000)} 秒${failures.length ? ` · 失败块：第 ${failures.join("、")} 块` : ""}*\n`;
    await this.app.vault.adapter.write(path, md);

    // 原版式复刻 HTML：页面图打底 + 白块覆盖中文译文
    if (pageImgs.length) {
      try {
        const pages = pageImgs.map((img, pi2) => {
          const blks = [];
          for (const gi of blocksByPage.get(pi2 + 1) || []) {
            const b = info.blocks[gi];
            const res = results[gi] || { en: "", zh: "" };
            const bad = isSkippableBlock(b) || !res.zh || res.zh.startsWith("⚠️");
            blks.push({
              skip: bad,
              orig: b.text,
              en: res.en,
              zh: bad ? "" : res.zh,
              rect: blockRectPct(b, img.vp, img.w, img.h),
            });
          }
          return { img: img.dataUrl, blocks: blks };
        });
        const html = buildReplicaHtml(
          { title: `${base} 全文翻译`, source: info.source },
          pages
        );
        await this.app.vault.adapter.write(htmlPath, html);
      } catch (e) {
        new Notice(`原版式 HTML 生成失败：${e.message}`, 6000);
      }
    }

    // 取消时删除本次生成的产物（Markdown / HTML / 页图目录），保持 vault 干净
    const cancelled = wasCancelled || wasCancelledFlag || this.ftCancel;
    if (cancelled) {
      try { await this.app.vault.adapter.remove(path); } catch (e) {}
      try { await this.app.vault.adapter.remove(htmlPath); } catch (e) {}
      try {
        if (await this.app.vault.adapter.exists(imgDir))
          await this.app.vault.adapter.rmdir(imgDir, true);
      } catch (e) {}
    }

    this.clearFullTranslateStatus();
    // 完成后不自动跳转到译文文件（不抢当前工作区焦点），产出路径在通知里给出
    this.resetFtCancel();
    this.endProg();
    // 原版式 HTML 用系统浏览器打开（打印即得同版式 PDF）；批量时只在最后一份打开
    if (info.openResult !== false && pageImgs.length && !cancelled) {
      try {
        const abs = this.app.vault.adapter.getFullPath(htmlPath);
        shell.openPath(abs);
      } catch (e) {}
    }
    new Notice(
      cancelled
        ? "全文翻译已取消（产物已清理）"
        : failures.length
          ? `全文翻译完成，但有 ${failures.length} 块失败（见笔记末尾）：${path}`
          : `全文翻译完成：${path}`,
      6000
    );
    return cancelled; // 告诉批量调用方要不要继续下一份
  }
};
