/*
 * Mini Translator
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 GeorgeCao
 *
 * Portions of the translation-provider request logic were adapted from
 * Translate for Zotero by windingwind and contributors
 * (AGPL-3.0-or-later), then modified for Mini Translator in 2026.
 * See THIRD_PARTY_NOTICES.md for attribution and license details.
 */

// 源状态架构：统一中枢广播——任何界面改动 源/模型/词典/选中状态，落盘即全界面实时同步
// 上述改编范围：youdao.ts / huoshanweb.ts / tencenttransmart.ts / google.ts（含 tk 算法）
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
  getLanguage,
} = require("obsidian");

// 发布构建会把 PDF.js、worker 与悬浮球模块注入这里；源码运行时仍可从仓库文件加载。
const BUNDLED_RUNTIME = null;
const I18N = BUNDLED_RUNTIME?.i18n || require("./src/i18n.js");
const {
  normalizeUiLanguage,
  setUiLanguage,
  getUiLanguage,
  t,
  languageName,
  providerName,
  phaseName,
} = I18N;

const WORD_RE = /^[a-zA-Z][a-zA-Z'’]*$/;
const VIEW_TYPE = "mini-translator-view";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36";

// ---------- 语言目录：内部统一使用 BCP-47 风格代码，各翻译源只在请求边界映射 ----------
// 这里有意只列入 Google / Microsoft / 主流大模型长期稳定覆盖、且有明确文字方向的
// 常用语言。语言“可选择”不等于译文经过母语者审校；界面会对非中英文持续给出提示。
const TRANSLATION_LANGUAGES = Object.freeze([
  { code: "zh-Hans", label: "中文（简体）", locale: "zh-CN", script: "cjk" },
  { code: "zh-Hant", label: "中文（繁体）", locale: "zh-TW", script: "cjk" },
  { code: "en", label: "英语", locale: "en", script: "latin" },
  { code: "ja", label: "日语", locale: "ja", script: "cjk" },
  { code: "ko", label: "韩语", locale: "ko", script: "hangul" },
  { code: "fr", label: "法语", locale: "fr", script: "latin" },
  { code: "de", label: "德语", locale: "de", script: "latin" },
  { code: "es", label: "西班牙语", locale: "es", script: "latin" },
  { code: "pt", label: "葡萄牙语", locale: "pt", script: "latin" },
  { code: "it", label: "意大利语", locale: "it", script: "latin" },
  { code: "ru", label: "俄语", locale: "ru", script: "cyrillic" },
  { code: "ar", label: "阿拉伯语", locale: "ar", script: "rtl", dir: "rtl" },
  { code: "hi", label: "印地语", locale: "hi", script: "indic" },
  { code: "th", label: "泰语", locale: "th", script: "seasia" },
  { code: "vi", label: "越南语", locale: "vi", script: "latin" },
  { code: "id", label: "印度尼西亚语", locale: "id", script: "latin" },
  { code: "ms", label: "马来语", locale: "ms", script: "latin" },
  { code: "tr", label: "土耳其语", locale: "tr", script: "latin" },
  { code: "nl", label: "荷兰语", locale: "nl", script: "latin" },
  { code: "pl", label: "波兰语", locale: "pl", script: "latin" },
  { code: "sv", label: "瑞典语", locale: "sv", script: "latin" },
  { code: "da", label: "丹麦语", locale: "da", script: "latin" },
  { code: "nb", label: "挪威语", locale: "nb", script: "latin" },
  { code: "fi", label: "芬兰语", locale: "fi", script: "latin" },
  { code: "cs", label: "捷克语", locale: "cs", script: "latin" },
  { code: "ro", label: "罗马尼亚语", locale: "ro", script: "latin" },
  { code: "hu", label: "匈牙利语", locale: "hu", script: "latin" },
  { code: "uk", label: "乌克兰语", locale: "uk", script: "cyrillic" },
  { code: "el", label: "希腊语", locale: "el", script: "greek" },
  { code: "he", label: "希伯来语", locale: "he", script: "rtl", dir: "rtl" },
  { code: "fa", label: "波斯语", locale: "fa", script: "rtl", dir: "rtl" },
  { code: "ur", label: "乌尔都语", locale: "ur", script: "rtl", dir: "rtl" },
  { code: "bn", label: "孟加拉语", locale: "bn", script: "indic" },
  { code: "ta", label: "泰米尔语", locale: "ta", script: "indic" },
  { code: "te", label: "泰卢固语", locale: "te", script: "indic" },
  { code: "mr", label: "马拉地语", locale: "mr", script: "indic" },
  { code: "gu", label: "古吉拉特语", locale: "gu", script: "indic" },
  { code: "pa", label: "旁遮普语", locale: "pa", script: "indic" },
  { code: "sw", label: "斯瓦希里语", locale: "sw", script: "latin" },
  { code: "fil", label: "菲律宾语", locale: "fil", script: "latin" },
  { code: "bg", label: "保加利亚语", locale: "bg", script: "cyrillic" },
  { code: "ca", label: "加泰罗尼亚语", locale: "ca", script: "latin" },
  { code: "hr", label: "克罗地亚语", locale: "hr", script: "latin" },
  { code: "sk", label: "斯洛伐克语", locale: "sk", script: "latin" },
  { code: "sl", label: "斯洛文尼亚语", locale: "sl", script: "latin" },
  { code: "et", label: "爱沙尼亚语", locale: "et", script: "latin" },
  { code: "lv", label: "拉脱维亚语", locale: "lv", script: "latin" },
  { code: "lt", label: "立陶宛语", locale: "lt", script: "latin" },
  { code: "sr-Latn", label: "塞尔维亚语（拉丁）", locale: "sr-Latn", script: "latin" },
  { code: "sr-Cyrl", label: "塞尔维亚语（西里尔）", locale: "sr-Cyrl", script: "cyrillic" },
  { code: "af", label: "南非荷兰语", locale: "af", script: "latin" },
  { code: "sq", label: "阿尔巴尼亚语", locale: "sq", script: "latin" },
  { code: "hy", label: "亚美尼亚语", locale: "hy", script: "other" },
  { code: "az", label: "阿塞拜疆语", locale: "az", script: "latin" },
  { code: "eu", label: "巴斯克语", locale: "eu", script: "latin" },
  { code: "bs", label: "波斯尼亚语", locale: "bs", script: "latin" },
  { code: "gl", label: "加利西亚语", locale: "gl", script: "latin" },
  { code: "ka", label: "格鲁吉亚语", locale: "ka", script: "other" },
  { code: "kk", label: "哈萨克语", locale: "kk", script: "cyrillic" },
  { code: "km", label: "高棉语", locale: "km", script: "seasia" },
  { code: "lo", label: "老挝语", locale: "lo", script: "seasia" },
  { code: "mk", label: "马其顿语", locale: "mk", script: "cyrillic" },
  { code: "mn", label: "蒙古语", locale: "mn", script: "cyrillic" },
  { code: "my", label: "缅甸语", locale: "my", script: "seasia" },
  { code: "ne", label: "尼泊尔语", locale: "ne", script: "indic" },
  { code: "si", label: "僧伽罗语", locale: "si", script: "indic" },
  { code: "is", label: "冰岛语", locale: "is", script: "latin" },
  { code: "ga", label: "爱尔兰语", locale: "ga", script: "latin" },
  { code: "mt", label: "马耳他语", locale: "mt", script: "latin" },
  { code: "cy", label: "威尔士语", locale: "cy", script: "latin" },
  { code: "ps", label: "普什图语", locale: "ps", script: "rtl", dir: "rtl" },
  { code: "yue", label: "粤语（繁体）", locale: "yue", script: "cjk" },
  { code: "lzh", label: "文言文", locale: "lzh", script: "cjk" },
]);

const AUTO_LANGUAGE = Object.freeze({
  code: "auto",
  label: "自动识别",
  locale: "und",
  script: "auto",
  dir: "auto",
});
const LANGUAGE_MAP = new Map(TRANSLATION_LANGUAGES.map((x) => [x.code, x]));

function languageInfo(code) {
  const base = code === "auto"
    ? AUTO_LANGUAGE
    : LANGUAGE_MAP.get(code) || LANGUAGE_MAP.get("en");
  return { ...base, label: languageName(base.code, base.label) };
}

function languageOptions(includeAuto = false) {
  const codes = includeAuto
    ? ["auto", ...TRANSLATION_LANGUAGES.map((x) => x.code)]
    : TRANSLATION_LANGUAGES.map((x) => x.code);
  return codes.map(languageInfo);
}

function languagePairLabel(from, to, compact = false) {
  const a = languageInfo(from);
  const b = languageInfo(to);
  return compact
    ? `${a.code === "auto" ? "AUTO" : a.code} → ${b.code}`
    : `${a.label} → ${b.label}`;
}

function isReviewedLanguage(code) {
  return code === "en" || code === "zh-Hans" || code === "zh-Hant";
}

function needsAiOnlyDisclaimer(from, to, detected = "") {
  const actualFrom = from === "auto" && detected ? detected : from;
  return (
    (actualFrom !== "auto" && !isReviewedLanguage(actualFrom)) ||
    !isReviewedLanguage(to)
  );
}

function translationHeaderLabel(via, from, to, detected = "") {
  const pair = languagePairLabel(from, to, true);
  const aiOnly = needsAiOnlyDisclaimer(from, to, detected)
    ? ` · ${t("language.ai_reference")}`
    : "";
  return `${t("translation.header")} · ${pair}${via ? ` · ${providerName(via)}` : ""}${aiOnly}`;
}

function languageQualityNotice(from, to, detected = "") {
  if (needsAiOnlyDisclaimer(from, to, detected)) return t("language.ai_only_notice");
  if (from === "auto" && !detected) return t("language.auto_notice");
  return "";
}

function safeLanguageCode(code, allowAuto = false) {
  if (allowAuto && code === "auto") return code;
  return LANGUAGE_MAP.has(code) ? code : allowAuto ? "auto" : "zh-Hans";
}

function inferLayoutLanguage(text) {
  const t = String(text || "");
  if (/[؀-ۿݐ-ݿࢠ-ࣿ]/u.test(t)) return "ar";
  if (/[֐-׿]/u.test(t)) return "he";
  if (/[぀-ヿ]/u.test(t)) return "ja";
  if (/[가-힯]/u.test(t)) return "ko";
  if (/[㐀-鿿豈-﫿]/u.test(t)) return "zh-Hans";
  if (/[Ѐ-ӿ]/u.test(t)) return "ru";
  if (/[Ͱ-Ͽ]/u.test(t)) return "el";
  if (/[฀-๿]/u.test(t)) return "th";
  if (/[ऀ-ॿ]/u.test(t)) return "hi";
  if (/[ঀ-৿]/u.test(t)) return "bn";
  if (/[஀-௿]/u.test(t)) return "ta";
  if (/[ఀ-౿]/u.test(t)) return "te";
  if (/[က-႟]/u.test(t)) return "my";
  if (/[ក-៿]/u.test(t)) return "km";
  return "en";
}

function resolvedLayoutLanguage(code, text = "") {
  return code === "auto" ? inferLayoutLanguage(text) : safeLanguageCode(code);
}

function applyLanguageAttrs(el, code, text = "") {
  if (!el) return;
  const resolved = resolvedLayoutLanguage(code, text);
  const info = languageInfo(resolved);
  el.setAttribute("lang", info.locale || resolved);
  el.setAttribute("dir", info.dir || "ltr");
  el.dataset.script = info.script || "other";
  el.dataset.language = resolved;
}

const CACHE = new Map();
const CACHE_MAX = 200;
const POPUP_MIN_WIDTH_PX = 200;
const POPUP_MAX_WIDTH_PX = 420;
const POPUP_BODY_MAX_HEIGHT_PX = 680;
const POPUP_CHROME_ALLOWANCE_PX = 44;
const POPUP_CUSTOM_WIDTH_MIN_PX = 320;
const POPUP_CUSTOM_WIDTH_MAX_PX = 1600;
const POPUP_REMEMBERED_WIDTH_MAX_PX = 32768;
const POPUP_CUSTOM_HEIGHT_MIN_PX = 240;
const POPUP_CUSTOM_HEIGHT_MAX_PX = 1400;
const POPUP_CUSTOM_WIDTH_DEFAULT_PX = 760;
const POPUP_CUSTOM_HEIGHT_DEFAULT_PX = 720;
const POPUP_SIZE_PRESETS = Object.freeze({
  adaptive: { labelKey: "popup_size.adaptive", responsive: true },
  compact: { labelKey: "popup_size.compact", maxWidth: 320, maxHeight: 480, scale: 1 },
  standard: { labelKey: "popup_size.standard", maxWidth: 420, maxHeight: 720, scale: 1 },
  large: { labelKey: "popup_size.large", maxWidth: 560, maxHeight: 900, scale: 1.12 },
  xlarge: { labelKey: "popup_size.xlarge", maxWidth: 760, maxHeight: 1120, scale: 1.24 },
  custom: { labelKey: "popup_size.custom", custom: true, scale: 1 },
});

function popupDimension(value, fallback, min, max) {
  const n = Number(value);
  return Math.round(
    clampToRange(Number.isFinite(n) ? n : fallback, min, max)
  );
}

function normalizeRememberedPopupSize(value) {
  const width = Number(value?.width);
  const height = Number(value?.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (width <= 0 || height <= 0) return null;
  return {
    width: popupDimension(
      width,
      POPUP_CUSTOM_WIDTH_DEFAULT_PX,
      POPUP_MIN_WIDTH_PX,
      POPUP_REMEMBERED_WIDTH_MAX_PX
    ),
    height: popupDimension(
      height,
      POPUP_CUSTOM_HEIGHT_DEFAULT_PX,
      88,
      POPUP_CUSTOM_HEIGHT_MAX_PX
    ),
  };
}

// 翻译框不再用一个固定的小上限：短标题保持紧凑，段落越长可用宽度/高度越大。
// 1600×900 以上按视口较短的一边渐进放大，最高 1.7 倍；这样 2K/4K 屏不会显得像小标签，
// 但超宽屏也不会只因横向像素很多就把弹窗拉得过大。
function popupMetricsForChars(
  charCount,
  viewportWidth,
  viewportHeight,
  sizeMode = "adaptive",
  customSize = null
) {
  const n = Math.max(0, Number(charCount) || 0);
  const vw = Math.max(1, Number(viewportWidth) || 1);
  const vh = Math.max(1, Number(viewportHeight) || 1);
  const resolvedMode = POPUP_SIZE_PRESETS[sizeMode] ? sizeMode : "adaptive";
  const preset = POPUP_SIZE_PRESETS[resolvedMode];
  const viewportRatio = Math.min(vw / 1600, vh / 900);
  const displayScale = preset.responsive
    ? clampToRange(1 + (viewportRatio - 1) * 0.5, 1, 1.7)
    : preset.scale;
  const usableWidth = Math.max(1, vw - 16);
  const usableHeight = Math.max(1, vh - 16);
  const requestedMaxWidth = preset.custom
    ? popupDimension(
        customSize?.maxWidth,
        POPUP_CUSTOM_WIDTH_DEFAULT_PX,
        POPUP_CUSTOM_WIDTH_MIN_PX,
        POPUP_CUSTOM_WIDTH_MAX_PX
      )
    : preset.responsive
      ? Math.round(POPUP_MAX_WIDTH_PX * displayScale)
      : preset.maxWidth;
  const requestedMaxHeight = preset.custom
    ? popupDimension(
        customSize?.maxHeight,
        POPUP_CUSTOM_HEIGHT_DEFAULT_PX,
        POPUP_CUSTOM_HEIGHT_MIN_PX,
        POPUP_CUSTOM_HEIGHT_MAX_PX
      )
    : preset.responsive
      ? Math.round(
          (POPUP_BODY_MAX_HEIGHT_PX + POPUP_CHROME_ALLOWANCE_PX) * displayScale
        )
      : preset.maxHeight;
  const manualMaxWidth = Math.min(requestedMaxWidth, usableWidth);
  // Presets define the automatic opening width. Once the user grabs the resize
  // corner, horizontal resizing may use the whole viewport instead.
  const resizeMaxWidth = usableWidth;
  const manualMaxHeight = Math.min(requestedMaxHeight, usableHeight);
  const manualBodyMaxHeight = Math.max(
    24,
    manualMaxHeight - POPUP_CHROME_ALLOWANCE_PX
  );
  const responsiveMinWidth = Math.round(POPUP_MIN_WIDTH_PX * displayScale);
  const minWidth = Math.min(responsiveMinWidth, manualMaxWidth, usableWidth);
  const wantedWidth = Math.round((210 + Math.sqrt(n) * 20) * displayScale);
  const maxWidth = Math.max(
    minWidth,
    Math.min(manualMaxWidth, usableWidth, wantedWidth)
  );
  const wantedBodyHeight = Math.round(
    (260 + Math.sqrt(n) * 14) * displayScale
  );
  const viewportBodyCap = Math.max(24, Math.floor(vh * 0.72));
  const bodyMaxHeight = Math.max(
    24,
    Math.min(manualBodyMaxHeight, viewportBodyCap, wantedBodyHeight)
  );
  const textBoost = Math.round((displayScale - 1) * 4 * 100) / 100;
  const smallTextBoost = Math.round((displayScale - 1) * 3 * 100) / 100;
  return {
    minWidth,
    maxWidth,
    bodyMaxHeight,
    displayScale,
    textBoost,
    smallTextBoost,
    manualMaxWidth,
    resizeMaxWidth,
    manualMaxHeight,
    manualBodyMaxHeight,
    sizeMode: resolvedMode,
  };
}

function clampToRange(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Selection APIs do occasionally report page/local coordinates (or coordinates for
// an off-screen end of a long selection). Intersect the anchor with the current
// viewport before positioning a fixed popup so a bad endpoint cannot send it away.
function normalizeViewportAnchor(x, y, anchor, viewportWidth, viewportHeight) {
  const vw = Math.max(1, Number(viewportWidth) || 1);
  const vh = Math.max(1, Number(viewportHeight) || 1);
  const insetX = Math.min(8, vw / 2);
  const insetY = Math.min(8, vh / 2);
  const minX = insetX;
  const maxX = Math.max(minX, vw - insetX);
  const minY = insetY;
  const maxY = Math.max(minY, vh - insetY);
  const finite = (value, fallback) => {
    if (value == null || value === "") return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  // x/y historically mean popup origin, with y = selection bottom + 6px.
  const fallbackLeft = finite(x, vw / 2);
  const fallbackBottom = finite(y, vh / 2) - 6;
  const rawLeft = finite(anchor?.left, fallbackLeft);
  const rawTop = finite(anchor?.top, fallbackBottom - 22);
  const rawRight = finite(anchor?.right, rawLeft);
  const rawBottom = finite(anchor?.bottom, Math.max(rawTop, fallbackBottom));
  const orderedLeft = Math.min(rawLeft, rawRight);
  const orderedRight = Math.max(rawLeft, rawRight);
  const orderedTop = Math.min(rawTop, rawBottom);
  const orderedBottom = Math.max(rawTop, rawBottom);
  return {
    left: clampToRange(orderedLeft, minX, maxX),
    top: clampToRange(orderedTop, minY, maxY),
    right: clampToRange(orderedRight, minX, maxX),
    bottom: clampToRange(orderedBottom, minY, maxY),
  };
}

function choosePopupPlacement(anchor, popupHeight, viewportHeight) {
  const margin = 8;
  const gap = 8;
  const vh = Math.max(1, Number(viewportHeight) || 1);
  const height = Math.max(0, Number(popupHeight) || 0);
  const belowRoom = Math.max(0, vh - margin - (anchor.bottom + gap));
  const aboveRoom = Math.max(0, anchor.top - gap - margin);
  if (height <= belowRoom) return "below";
  if (height <= aboveRoom) return "above";
  return aboveRoom > belowRoom ? "above" : "below";
}

// 已锁定在下方的弹窗也要在真实译文撑高后重新检查：只要完整高度能放到上方，
// 就切到上方，而不是把下方弹窗压扁后硬塞。两边都放不下时才选空间较大的一侧滚动。
function resolvePopupPlacement(anchor, popupHeight, viewportHeight, storedPlacement = null) {
  const margin = 8;
  const gap = 8;
  const vh = Math.max(1, Number(viewportHeight) || 1);
  const height = Math.max(0, Number(popupHeight) || 0);
  const belowRoom = Math.max(0, vh - margin - (anchor.bottom + gap));
  const aboveRoom = Math.max(0, anchor.top - gap - margin);
  const stored = storedPlacement === "above" || storedPlacement === "below"
    ? storedPlacement
    : null;
  if (!stored) return choosePopupPlacement(anchor, height, vh);
  const storedRoom = stored === "above" ? aboveRoom : belowRoom;
  if (height <= storedRoom) return stored;
  const other = stored === "above" ? "below" : "above";
  const otherRoom = other === "above" ? aboveRoom : belowRoom;
  if (height <= otherRoom) return other;
  return aboveRoom > belowRoom ? "above" : "below";
}

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
  if (res.status === 200) return;
  const detail = String(
    res?.json?.error?.message ||
      res?.json?.message ||
      res?.text ||
      ""
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
  throw new Error(
    `HTTP ${res.status} (${label})${
      detail ? `${getUiLanguage() === "en" ? ": " : "："}${detail}` : ""
    }`
  );
}

// LaTeX 界定符：$...$、$$...$$、\(...\)、\[...\]（大模型常输出后两种）
const MATH_RE = /(\$\$[\s\S]*?\$\$|\$[^$\n]*\$|\\\[[\s\S]*?\\\]|\\\([^$\n]*?\\\))/g;

// ---------- 数学公式占位保护：翻译前替换，翻译后还原（任何引擎都不会翻坏公式） ----------
function protectMath(text) {
  const map = [];
  const t = text.replace(MATH_RE, (m) => {
    map.push(m);
    // 免费源对 Unicode 角括号不稳定（会转成引号或直接丢掉），
    // ASCII 下划线 token 在有道/火山/腾讯/谷歌中能稳定原样回传。
    return `__MT${map.length - 1}__`;
  });
  return { text: t, map };
}

function restoreMath(text, map) {
  // 新版 ASCII token + 旧版 Unicode token/常见方括号变体均可还原。
  return text.replace(
    /(?:__\s*MT\s*(\d+)\s*__|\[\[\s*MT\s*(\d+)\s*\]\]|⟦\s*MT\s*(\d+)\s*⟧)/gi,
    (m, a, b, c) => {
      const i = Number(a ?? b ?? c);
      return map[i] || m;
    }
  );
}

// ---------- 逐句切分：优先使用 Intl.Segmenter，兼容无空格的中日韩句末标点 ----------
function splitSentences(text, language = "auto") {
  const { text: t, map } = protectMath(text);
  const resolved = resolvedLayoutLanguage(language, text);
  const locale = languageInfo(resolved).locale || resolved;
  let parts = [];
  try {
    if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
      parts = Array.from(
        new Intl.Segmenter(locale, { granularity: "sentence" }).segment(t),
        (x) => x.segment
      );
    }
  } catch (e) {}
  if (parts.length <= 1) {
    parts = t.split(
      /(?<=[。！？!?])\s*|(?<=[.])\s+(?=[\p{Lu}\p{Lt}"'(“‘])/u
    );
  }
  const out = parts.map((p) => restoreMath(p.trim(), map)).filter(Boolean);
  return out.length > 1 ? out : [text];
}

function hasTranslatableText(text) {
  return /[\p{L}\p{N}]/u.test(String(text || ""));
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

// ---------- 全文翻译：pdf.js 文本层 → 逻辑行 → 版面阅读顺序 → 段落 ----------
//
// 这里不能简单地把全页按 y 排序再从左到右拼接：双栏论文中，同一高度的左栏和
// 右栏属于完全不同的句子。pdf.js 给出的内容流通常已经是“左栏到底，再读右栏”，
// 因此先尊重 hasEOL/内容流拆行；随后显式识别中央栏沟。若检测到双栏，则按
// “跨栏标题/图注 → 左栏自上而下 → 右栏自上而下”重建每个纵向版面带。

function medianNum(values, fallback = 0) {
  const a = values.filter(Number.isFinite).sort((x, y) => x - y);
  return a.length ? a[Math.floor(a.length / 2)] : fallback;
}

function quantileNum(values, q, fallback = 0) {
  const a = values.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return fallback;
  return a[Math.max(0, Math.min(a.length - 1, Math.floor((a.length - 1) * q)))];
}

function pdfRawItem(it, sourceOrder) {
  if (!it || !it.str || !it.str.trim() || !Array.isArray(it.transform)) return null;
  const [a = 0, b = 0, c = 0, d = 0, x = 0, y = 0] = it.transform;
  const angle = Math.atan2(b, a || 1e-9);
  // 竖排 arXiv 水印、旋转页边文字不属于正文；旧实现还会把其 width 当成横向宽度，
  // 使它横跨栏沟并把整页错误切段。
  const horizontalError = Math.min(
    Math.abs(angle),
    Math.abs(Math.PI - Math.abs(angle))
  );
  if (horizontalError > 0.28) return null;
  const h = Math.hypot(c, d) || Math.hypot(a, b) || 10;
  const width = Math.abs(it.width || 0) || Math.max(1, it.str.length * h * 0.44);
  return {
    str: it.str,
    x,
    endX: x + width,
    y,
    h,
    sourceOrder,
    hasEOL: !!it.hasEOL,
  };
}

function pdfItemsBelongToSameLine(cur, next, pageWidth) {
  if (!cur || !cur.items.length) return true;
  const last = cur.items[cur.items.length - 1];
  const h = Math.max(3, medianNum(cur.items.map((x) => x.h), next.h || 10));
  const baseY = medianNum(
    cur.items.filter((x) => x.h >= h * 0.72).map((x) => x.y),
    last.y
  );
  const dy = Math.abs(next.y - baseY);
  const backtrack = next.x < cur.x0 - Math.max(3, h * 0.45);

  // 同一基线上的大片中央空白通常就是双栏栏沟；即使生产 PDF 时忘了 hasEOL，
  // 也绝不能把左右栏的两句话粘成一行。
  if (
    pageWidth > 0 &&
    cur.x1 < pageWidth * 0.497 &&
    next.x > pageWidth * 0.503 &&
    next.x - cur.x1 > Math.max(5, pageWidth * 0.008)
  )
    return false;

  if (dy <= Math.max(2.2, h * 0.48)) return !backtrack;

  // 上下标/重音符号会轻微偏离基线。只有短数学碎片且横向仍连续时才并回原行，
  // 避免把流程图中上下相邻的两个标签误当成同一行。
  const shortMathPiece =
    next.str.length <= 8 &&
    last.str.length <= 12 &&
    /^[\p{L}\p{N}\p{S}\p{P}\s]+$/u.test(next.str + last.str);
  const xContinues =
    next.x >= last.x - Math.max(2, h * 0.25) &&
    next.x <= last.endX + Math.max(8, h * 1.8);
  if (shortMathPiece && xContinues && dy <= h * 1.15) return true;
  return false;
}

function makePdfLogicalLine(items, sourceOrder) {
  const sorted = items.slice().sort((a, b) => a.x - b.x || a.sourceOrder - b.sourceOrder);
  let text = "";
  let prevEnd = null;
  for (const it of sorted) {
    if (!it.str) continue;
    const needsSpace =
      prevEnd !== null &&
      it.x - prevEnd > 1 &&
      !/\s$/.test(text) &&
      !/^\s/.test(it.str) &&
      !/^[,.;:!?%\)\]\}]/.test(it.str) &&
      !/[\(\[\{]$/.test(text);
    if (needsSpace) text += " ";
    text += it.str;
    prevEnd = Math.max(prevEnd === null ? -Infinity : prevEnd, it.endX);
  }
  const h = Math.max(...sorted.map((x) => x.h), 1);
  const main = sorted.filter((x) => x.h >= h * 0.72);
  const y = medianNum((main.length ? main : sorted).map((x) => x.y), sorted[0]?.y || 0);
  return {
    text: text.replace(/\s+/g, " ").trim(),
    y,
    x0: Math.min(...sorted.map((x) => x.x)),
    x1: Math.max(...sorted.map((x) => x.endX)),
    yMax: Math.max(...sorted.map((x) => x.y + x.h * 0.85)),
    yMin: Math.min(...sorted.map((x) => x.y - x.h * 0.25)),
    h,
    sourceOrder,
    explicitEOL: sorted.some((x) => x.hasEOL),
    // 常见脚注号会以更小字号抬高放在行首；保留这个版面信号，后续只用于
    // “脚注区域”判定，不修改原文字符。
    leadingSuperscript: !!(
      sorted[0] &&
      sorted[0].str.trim().length <= 3 &&
      sorted[0].h <= h * 0.82 &&
      sorted[0].y > y + h * 0.12
    ),
  };
}

// 按 PDF 内容流和 hasEOL 拆成逻辑行。与旧的“全页同 y 聚行”不同，相同 y 的
// 左右两栏会保留为两行，因而不会在进入翻译模型前就发生不可逆的句子交叉。
function pdfItemsToBlocks(items, pageWidth = 0) {
  const lines = [];
  let cur = null;
  const flush = () => {
    if (!cur || !cur.items.length) return;
    const line = makePdfLogicalLine(cur.items, cur.sourceOrder);
    if (line.text) lines.push(line);
    cur = null;
  };
  for (let i = 0; i < items.length; i++) {
    const m = pdfRawItem(items[i], i);
    if (!m) continue;
    if (cur && !pdfItemsBelongToSameLine(cur, m, pageWidth)) flush();
    if (!cur) cur = { items: [], sourceOrder: i, x0: m.x, x1: m.endX };
    cur.items.push(m);
    cur.x0 = Math.min(cur.x0, m.x);
    cur.x1 = Math.max(cur.x1, m.endX);
    if (m.hasEOL) flush();
  }
  flush();
  return lines;
}

function pdfItemsToLines(items) {
  return pdfItemsToBlocks(items).map((b) => ({ text: b.text, y: b.y }));
}

function pdfLineKind(text) {
  const t = String(text || "").trim();
  // 论文图注既可能写成 “Figure 1: …”，也可能省略冒号写成
  // “Figure 1 Overview …”；两种形式都要标记，后续才能把图内标签从正文流剥离。
  if (/^(?:fig(?:ure)?\.?\s*\d+\s*(?:[:.]\s*|\s+))/i.test(t)) return "figure-caption";
  if (/^(?:table\s+[ivxlcdm\d]+\s*[:.]?)/i.test(t)) return "table-caption";
  if (/^[•●▪◦‣]\s*\S/u.test(t)) return "list-item";
  if (/^Abstract\s*[—-]\s*\S/.test(t)) return "body";
  if (
    t.length <= 150 &&
    (/^(?:[IVXLCDM]+\.|[A-Z]\.)\s+\S/.test(t) ||
      /^(?:ABSTRACT|INTRODUCTION|RELATED WORKS?|METHODS?|EXPERIMENTS?|CONCLUSION|REFERENCES|APPENDIX)\b/.test(t))
  )
    return "heading";
  return "body";
}

// 用正文长行的左右边界判断是否确有两个稳定文本栏。短标题、公式、图内标签不会
// 单独触发双栏，避免把普通单栏页面误切成左右两半。
function detectPdfColumnLayout(lines, pageWidth) {
  if (!pageWidth || lines.length < 10) return null;
  const useful = lines.filter(
    (l) => l.text.length >= 12 && l.x1 > l.x0 && l.x0 >= -pageWidth * 0.05
  );
  const bodyH = medianNum(
    useful
      .filter((l) => l.text.length >= 32 && l.x1 - l.x0 >= pageWidth * 0.15)
      .map((l) => l.h),
    medianNum(useful.map((l) => l.h), 10)
  );
  const left = useful.filter(
    (l) =>
      l.h >= bodyH * 0.7 &&
      l.x0 < pageWidth * 0.29 &&
      l.x1 < pageWidth * 0.53 &&
      l.x1 - l.x0 > pageWidth * 0.18
  );
  const right = useful.filter(
    (l) =>
      l.h >= bodyH * 0.7 &&
      l.x0 > pageWidth * 0.47 &&
      l.x1 > pageWidth * 0.72 &&
      l.x1 - l.x0 > pageWidth * 0.18
  );
  const eligibleN = useful.filter((l) => l.h >= bodyH * 0.7).length;
  const minSide = Math.max(4, Math.ceil(Math.min(eligibleN, 100) * 0.07));
  if (left.length < minSide || right.length < minSide) return null;
  if (Math.min(left.length, right.length) / Math.max(left.length, right.length) < 0.16)
    return null;

  const leftEdge = quantileNum(left.map((l) => l.x1), 0.72);
  const rightEdge = quantileNum(right.map((l) => l.x0), 0.28);
  const gap = rightEdge - leftEdge;
  if (gap < Math.max(3, pageWidth * 0.005) || gap > pageWidth * 0.18) return null;
  const cut = (leftEdge + rightEdge) / 2;
  if (cut < pageWidth * 0.42 || cut > pageWidth * 0.58) return null;
  return { cut, leftEdge, rightEdge, bodyH, leftCount: left.length, rightCount: right.length };
}

function looksLikeFigureLabelBand(lines, captionGroup, bodyH) {
  if (!captionGroup?.some((l) => l.kind === "figure-caption") || lines.length < 3)
    return false;
  const shortRatio = lines.filter((l) => l.text.length <= 52).length / lines.length;
  const smallRatio = lines.filter((l) => l.h <= bodyH * 0.82).length / lines.length;
  const sentenceRatio =
    lines.filter((l) => l.text.length > 58 || /[.!?]["')\]]?$/.test(l.text)).length /
    lines.length;
  return shortRatio >= 0.68 && (smallRatio >= 0.5 || sentenceRatio <= 0.18);
}

function pdfFootnoteExplicitSignal(line) {
  const t = String(line?.text || "").trim();
  if (!t) return false;
  if (/^[*∗†‡§¶]+(?=\s|[A-Z]|$)/u.test(t)) return true;
  if (line?.leadingSuperscript && /^(?:\d{1,3}|[*∗†‡§¶])/u.test(t)) return true;
  return /(?:corresponding\s+author|correspondence\s*:|equal\s+contribution|e-?mail\s*:|\bemail\s*:|https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/i.test(
    t
  );
}

function isPdfReferenceHeadingText(text) {
  return /^(?:(?:\d+|[IVXLCDM]+)\.?\s+)?(?:references|bibliography)\s*$/i.test(
    String(text || "").trim()
  );
}

function looksLikePdfReferenceEntry(text) {
  return /^\s*(?:\[\d{1,4}\]|\d{1,4}\.\s+[A-Z])/u.test(String(text || ""));
}

function dominantPdfTextHeight(lines, fallback) {
  const buckets = new Map();
  for (const line of lines) {
    if (
      (line.kind || "body") !== "body" ||
      line.text.length < 18 ||
      line.h < 4 ||
      line.h > 28
    )
      continue;
    const key = Math.round(line.h * 2) / 2;
    if (!buckets.has(key)) buckets.set(key, { weight: 0, values: [] });
    const bucket = buckets.get(key);
    bucket.weight += Math.min(140, Math.max(18, line.text.length));
    bucket.values.push(line.h);
  }
  const ranked = [...buckets].sort(
    (a, b) =>
      b[1].weight - a[1].weight ||
      Math.abs(a[0] - fallback) - Math.abs(b[0] - fallback)
  );
  return ranked.length ? medianNum(ranked[0][1].values, fallback) : fallback;
}

// 脚注不能仅靠“它在页面底部”判断：双栏正文自己也经常写到最底端。这里按栏建立
// 独立候选区，联合使用小字号、连续行、正文到注释的字号/行距突变、注号和作者信息。
// 只有证据足够时才剥离；表格、图注附近碎片及 References 条目会被明确排除。
function detectPdfFootnoteLines(lines, layout, pageWidth, pageHeight) {
  const selected = new Set();
  const groups = [];
  if (!pageHeight || !pageWidth || lines.length < 4) return { lines: selected, groups };

  const fallbackBodyH =
    layout?.bodyH ||
    medianNum(
      lines
        .filter(
          (l) =>
            l.text.length >= 28 &&
            l.x1 - l.x0 >= pageWidth * 0.16 &&
            l.h >= 4 &&
            l.h <= 28
        )
        .map((l) => l.h),
      medianNum(lines.map((l) => l.h), 10)
    );
  if (!Number.isFinite(fallbackBodyH) || fallbackBodyH < 4) {
    return { lines: selected, groups };
  }

  const cut = layout?.cut || pageWidth / 2;
  const zoneOf = (l) => {
    if (!layout) return "single";
    const crosses =
      l.x1 - l.x0 >= pageWidth * 0.52 &&
      l.x0 < cut - pageWidth * 0.07 &&
      l.x1 > cut + pageWidth * 0.07;
    if (crosses) return "span";
    return (l.x0 + l.x1) / 2 < cut ? "left" : "right";
  };
  const zones = new Map();
  for (const line of lines) {
    const zone = zoneOf(line);
    if (!zones.has(zone)) zones.set(zone, []);
    zones.get(zone).push(line);
  }

  const contextRejects = (zoneLines, candidate, topY, lead) => {
    const bottomY = Math.min(...candidate.map((l) => l.y));
    const explicit = candidate.some(pdfFootnoteExplicitSignal);
    if (!explicit) {
      // 表题通常在表格上方；Figure 图内标签通常在下方图注之上。使用全页 caption，
      // 因为跨栏图注与单栏表格内容可能被分到不同 zone。
      if (
        lines.some(
          (l) =>
            l.kind === "table-caption" &&
            ((l.y > topY && l.y - bottomY <= pageHeight * 0.32) ||
              (l.y < bottomY && bottomY - l.y <= pageHeight * 0.075))
        )
      )
        return true;
      if (
        lines.some(
          (l) =>
            l.kind === "figure-caption" &&
            l.y < bottomY &&
            bottomY - l.y <= pageHeight * 0.18
        )
      )
        return true;
    }
    if (lines.some((l) => isPdfReferenceHeadingText(l.text) && l.y > topY)) {
      return true;
    }
    const refRatio =
      candidate.filter((l) => looksLikePdfReferenceEntry(l.text)).length /
      Math.max(1, candidate.length);
    if (refRatio >= 0.5) return true;

    // 若另一栏在同一组基线上存在同字号文本，这通常是正常双栏正文或表格行，
    // 而不是只占一栏、字号明显更小的脚注。
    if (layout) {
      const first = candidate[0];
      const spansCut =
        first.x1 - first.x0 >= pageWidth * 0.52 &&
        first.x0 < cut - pageWidth * 0.07 &&
        first.x1 > cut + pageWidth * 0.07;
      if (!spansCut) {
        const zone = (first.x0 + first.x1) / 2 < cut ? "left" : "right";
        const other = zones.get(zone === "left" ? "right" : "left") || [];
        const medH = medianNum(candidate.map((l) => l.h), fallbackBodyH);
        const parallel = candidate.filter((line) =>
          other.some(
            (o) =>
              Math.abs(o.y - line.y) <= Math.max(1.2, medH * 0.22) &&
              o.h >= medH * 0.91 &&
              o.h <= medH * 1.1
          )
        ).length;
        if (parallel / Math.max(1, candidate.length) >= 0.5) return true;
      }
    }
    return false;
  };

  const accept = (zone, zoneLines, candidate, zoneBodyH, lead, reason) => {
    const unique = [...new Set(candidate)].filter((l) => !selected.has(l));
    if (!unique.length) return;
    const topY = Math.max(...unique.map((l) => l.y));
    const bottomY = Math.min(...unique.map((l) => l.y));
    const medH = medianNum(unique.map((l) => l.h), zoneBodyH);
    const chars = unique.reduce((n, l) => n + l.text.length, 0);
    const letters = unique.reduce(
      (n, l) => n + (l.text.match(/[A-Za-z]/g) || []).length,
      0
    );
    const hasProseLine = unique.some((l) => {
      const words = l.text.match(/[A-Za-z]{2,}/g) || [];
      const alpha = (l.text.match(/[A-Za-z]/g) || []).length;
      return words.length >= 5 && alpha / Math.max(1, l.text.length) >= 0.42;
    });
    // PDF.js often exports a footnote number as its own tiny text item just above
    // the first note line. Treat that marker as additional separation evidence,
    // but never as sufficient content by itself: enoughText below still requires
    // real prose, which keeps bottom-of-page equation groups out of the note flow.
    const hasDetachedNumericMarker = unique.some(
      (l) =>
        /^\s*\d{1,3}\s*$/.test(String(l.text || "")) &&
        l.h <= zoneBodyH * 0.78 &&
        l.y >= topY - Math.max(lead * 0.9, zoneBodyH)
    );
    const explicit = unique.some(pdfFootnoteExplicitSignal);
    const nearestAbove = zoneLines
      .filter((l) => l.y > topY + Math.max(0.6, medH * 0.08))
      .sort((a, b) => a.y - b.y)[0];
    const topGap = nearestAbove ? nearestAbove.y - topY : Infinity;
    const nearBottom = bottomY <= pageHeight * 0.2 && topY <= pageHeight * 0.315;
    const compact = topY - bottomY <= pageHeight * 0.205 && unique.length <= 18;
    const enoughText =
      explicit ||
      (unique.length >= 2 && chars >= 30 && letters >= 16 && hasProseLine);
    const separated =
      explicit ||
      (hasDetachedNumericMarker &&
        !!nearestAbove &&
        topGap >= Math.max(lead * 1.05, zoneBodyH * 1.1)) ||
      (!!nearestAbove &&
        (topGap >= Math.max(lead * 1.24, zoneBodyH * 1.3) ||
          nearestAbove.h >= medH * 1.12));
    if (!nearBottom || !compact || !enoughText || !separated) return;
    if (contextRejects(zoneLines, unique, topY, lead)) return;
    for (const line of unique) selected.add(line);
    groups.push({ zone, lines: unique, reason });
  };

  for (const [zone, zoneLines] of zones) {
    const zoneBodyH = dominantPdfTextHeight(zoneLines, fallbackBodyH);
    const visual = zoneLines
      .filter((l) => (l.kind || "body") === "body")
      .slice()
      .sort((a, b) => b.y - a.y);
    const diffs = [];
    for (let i = 1; i < visual.length; i++) {
      const d = visual[i - 1].y - visual[i].y;
      if (d >= zoneBodyH * 0.62 && d <= zoneBodyH * 2.05) diffs.push(d);
    }
    const lead = medianNum(diffs, zoneBodyH * 1.2);
    const smallLimit = zoneBodyH * 0.93;
    const bottom = zoneLines
      .filter((l) => l.y >= pageHeight * 0.025 && l.y <= pageHeight * 0.36)
      .slice()
      .sort((a, b) => a.y - b.y || a.x0 - b.x0);
    const isDetachedMarker = (line) =>
      /^\s*(?:\d{1,3}|[*∗†‡§¶])\s*$/u.test(line.text) &&
      line.h <= zoneBodyH * 0.78 &&
      // Long explanatory notes can begin around the lower third of a page. The
      // surrounding prose/size/separation checks remain mandatory, so widening
      // this marker window does not make a lone equation number a footnote.
      line.y <= pageHeight * 0.315;

    // 小字号连续区：逐行识别会漏掉续行或只抽走注号，因此必须整区处理。
    const runs = [];
    let run = [];
    const flush = () => {
      if (run.length) runs.push(run);
      run = [];
    };
    for (const line of bottom) {
      const small = (line.kind || "body") === "body" && line.h <= smallLimit;
      if (!small) {
        flush();
        continue;
      }
      const prev = run[run.length - 1];
      if (
        prev &&
        (line.y - prev.y > Math.max(lead * 2.15, zoneBodyH * 2.3) ||
          Math.max(line.h, prev.h) / Math.max(1, Math.min(line.h, prev.h)) > 1.14)
      )
        flush();
      run.push(line);
    }
    flush();
    for (const rawCandidate of runs) {
      const topY = Math.max(...rawCandidate.map((l) => l.y));
      const minX = Math.min(...rawCandidate.map((l) => l.x0));
      const marker = bottom.find(
        (l) =>
          !rawCandidate.includes(l) &&
          isDetachedMarker(l) &&
          l.y >= topY &&
          l.y - topY <= Math.max(lead * 0.82, zoneBodyH) &&
          l.x0 <= minX + zoneBodyH * 2.4
      );
      const candidate = marker ? rawCandidate.concat(marker) : rawCandidate;
      const medH = medianNum(rawCandidate.map((l) => l.h), zoneBodyH);
      const strongSizeDrop = medH <= zoneBodyH * 0.84;
      const reason = strongSizeDrop ? "small-font-strong" : "small-font-region";
      accept(zone, zoneLines, candidate, zoneBodyH, lead, reason);
    }

    // 少数模板的脚注与正文同字号，只把注号做成上标。此时要求：明确注号/邮箱证据、
    // 与上方正文有分隔、并且后续文本形成页面最底部的紧凑连续区。
    for (let ai = 0; ai < bottom.length; ai++) {
      const anchor = bottom[ai];
      if (
        selected.has(anchor) ||
        (!pdfFootnoteExplicitSignal(anchor) && !isDetachedMarker(anchor))
      )
        continue;
      if ((anchor.kind || "body") !== "body") continue;
      const candidate = [anchor];
      let prev = anchor;
      for (let j = ai - 1; j >= 0; j--) {
        const line = bottom[j];
        const gap = prev.y - line.y;
        if (
          (line.kind || "body") !== "body" ||
          gap > Math.max(lead * 1.9, zoneBodyH * 2.05) ||
          line.h > zoneBodyH * 1.07
        )
          break;
        candidate.push(line);
        prev = line;
      }
      const above = zoneLines
        .filter((l) => l.y > anchor.y + Math.max(0.6, anchor.h * 0.08))
        .sort((a, b) => a.y - b.y)[0];
      if (!above || above.y - anchor.y < Math.max(lead * 1.22, zoneBodyH * 1.28)) {
        continue;
      }
      accept(zone, zoneLines, candidate, zoneBodyH, lead, "explicit-marker");
    }
  }
  return { lines: selected, groups };
}

// 第一页的论文标题/作者常横跨栏沟，但 PDF 内容流会在栏沟处把同一作者行拆成
// 多个碎片。只在第一页顶部、且字号明显大于正文时重组；正文页绝不套用该规则。
function normalizeFirstPageFrontMatterLines(lines, pageWidth, pageHeight, layout) {
  if (!layout || !pageHeight) return lines;
  const bodyH = layout.bodyH || medianNum(lines.map((l) => l.h), 10);
  const candidates = lines.filter(
    (l) =>
      l.y > pageHeight * 0.75 &&
      l.h >= bodyH * 1.08 &&
      l.text.length > 2 &&
      !/^\s*\d{1,4}\s*$/.test(l.text)
  );
  if (candidates.length < 2) return lines;
  const selected = new Set(candidates);
  const groups = [];
  for (const line of candidates.slice().sort((a, b) => b.y - a.y || a.x0 - b.x0)) {
    let group = groups.find(
      (g) => Math.abs(g.y - line.y) <= Math.max(1.4, Math.min(g.h, line.h) * 0.2)
    );
    if (!group) {
      group = { y: line.y, h: line.h, lines: [] };
      groups.push(group);
    }
    group.lines.push(line);
  }
  const rebuilt = groups.map((group) => {
    const sorted = group.lines.slice().sort((a, b) => a.x0 - b.x0);
    let text = "";
    for (const line of sorted) {
      if (!text) text = line.text;
      else if (/^[,.;:!?%\)\]\}]/.test(line.text)) text += line.text;
      else text += ` ${line.text}`;
    }
    const h = Math.max(...sorted.map((l) => l.h));
    return {
      ...sorted[0],
      text: text.replace(/\s+/g, " ").trim(),
      x0: Math.min(...sorted.map((l) => l.x0)),
      x1: Math.max(...sorted.map((l) => l.x1)),
      yMax: Math.max(...sorted.map((l) => l.yMax)),
      yMin: Math.min(...sorted.map((l) => l.yMin)),
      h,
      sourceOrder: Math.min(...sorted.map((l) => l.sourceOrder)),
      explicitEOL: true,
      frontMatter: true,
      kind: h >= bodyH * 1.55 ? "title" : "body",
    };
  });
  return lines.filter((l) => !selected.has(l)).concat(rebuilt);
}

function orderPdfPageLines(lines, pageWidth, pageHeight, pageNo = 0) {
  let layout = detectPdfColumnLayout(lines, pageWidth);
  if (pageNo === 1) {
    lines = normalizeFirstPageFrontMatterLines(
      lines,
      pageWidth,
      pageHeight,
      layout
    );
    layout = detectPdfColumnLayout(lines, pageWidth) || layout;
  }
  const base = lines.map((l) => ({
    ...l,
    kind: l.kind || pdfLineKind(l.text),
  }));
  const noteInfo = detectPdfFootnoteLines(base, layout, pageWidth, pageHeight);
  const footnotes = base.filter((l) => noteInfo.lines.has(l));
  const content = base.filter((l) => !noteInfo.lines.has(l));
  if (!layout) {
    const main = content
      .sort((a, b) => a.sourceOrder - b.sourceOrder)
      .map((l) => ({ ...l, flowId: "source", column: "single", band: 0 }));
    const notes = footnotes
      .sort((a, b) => b.y - a.y || a.x0 - b.x0)
      .map((l) => ({
        ...l,
        flowId: "footnote:single",
        column: "footnote",
        band: 1,
        kind: "footnote",
      }));
    return {
      lines: main.concat(notes),
      columns: 1,
      omittedFigureLabels: 0,
      footnoteLines: notes.length,
      footnoteGroups: noteInfo.groups.length,
    };
  }

  const isSpanning = (l) =>
    l.frontMatter ||
    (l.x1 - l.x0 >= pageWidth * 0.54 &&
      l.x0 < layout.cut - pageWidth * 0.08 &&
      l.x1 > layout.cut + pageWidth * 0.08);
  const spanning = content.filter(isSpanning).sort((a, b) => b.y - a.y);
  const ordinary = content.filter((l) => !isSpanning(l));

  // 相邻跨栏行组成同一个标题/图注组；图注的后续行继承 caption 类型。
  const spanGroups = [];
  for (const line of spanning) {
    const prev = spanGroups[spanGroups.length - 1];
    const prevLast = prev?.[prev.length - 1];
    const close =
      prevLast &&
      prevLast.y - line.y <=
        Math.max(layout.bodyH * 1.6, prevLast.h * 1.45, line.h * 1.45);
    if (close) prev.push(line);
    else spanGroups.push([line]);
  }
  for (const group of spanGroups) {
    const groupKind = group.find((l) => /-caption$/.test(l.kind))?.kind;
    if (groupKind) for (const l of group) l.kind = groupKind;
  }

  const bands = Array.from({ length: spanGroups.length + 1 }, () => []);
  for (const line of ordinary) {
    let band = 0;
    while (
      band < spanGroups.length &&
      line.y < Math.min(...spanGroups[band].map((l) => l.y)) - layout.bodyH * 0.35
    )
      band++;
    bands[band].push(line);
  }

  const ordered = [];
  let omittedFigureLabels = 0;
  const pushBand = (bandLines, bandNo, followingSpan) => {
    const isFigureLabels = looksLikeFigureLabelBand(
      bandLines,
      followingSpan,
      layout.bodyH
    );
    if (isFigureLabels) {
      // 图内标签由紧随其后的完整原页保留；不再把坐标轴、箭头与框中文字拼成
      // 一段“正文”送去翻译。图注仍会正常提取和翻译。
      omittedFigureLabels += bandLines.length;
      return;
    }
    const left = [];
    const right = [];
    for (const line of bandLines) {
      ((line.x0 + line.x1) / 2 < layout.cut ? left : right).push(line);
    }
    left.sort((a, b) => b.y - a.y || a.x0 - b.x0);
    right.sort((a, b) => b.y - a.y || a.x0 - b.x0);
    for (const [column, list] of [
      ["left", left],
      ["right", right],
    ]) {
      const flowId = `band-${bandNo}:${column}`;
      for (const line of list)
        ordered.push({
          ...line,
          flowId,
          column,
          band: bandNo,
        });
    }
  };

  for (let i = 0; i <= spanGroups.length; i++) {
    pushBand(bands[i], i, spanGroups[i] || null);
    if (i < spanGroups.length) {
      const group = spanGroups[i].slice().sort((a, b) => b.y - a.y || a.x0 - b.x0);
      const flowId = `span-${i}`;
      for (const line of group)
        ordered.push({ ...line, flowId, column: "span", band: i });
    }
  }

  // 关键保证：所有正文版面带（含完整左栏和右栏）结束后，才追加脚注流。
  // 因而脚注即使物理上位于左栏底部，也不会横插在左栏末尾与右栏开头之间。
  const noteZones = ["left", "right", "span"];
  for (const zone of noteZones) {
    const list = footnotes
      .filter((l) => {
        const crosses =
          l.x1 - l.x0 >= pageWidth * 0.52 &&
          l.x0 < layout.cut - pageWidth * 0.07 &&
          l.x1 > layout.cut + pageWidth * 0.07;
        const z = crosses
          ? "span"
          : (l.x0 + l.x1) / 2 < layout.cut
            ? "left"
            : "right";
        return z === zone;
      })
      .sort((a, b) => b.y - a.y || a.x0 - b.x0);
    for (const line of list) {
      ordered.push({
        ...line,
        flowId: `footnote:${zone}`,
        column: `footnote-${zone}`,
        band: spanGroups.length + 1,
        kind: "footnote",
      });
    }
  }
  return {
    lines: ordered,
    columns: 2,
    omittedFigureLabels,
    footnoteLines: footnotes.length,
    footnoteGroups: noteInfo.groups.length,
  };
}

function isPdfHeadingText(text) {
  return pdfLineKind(text) === "heading";
}

const PDF_COMPOUND_PREFIXES = new Set([
  "action", "actor", "batch", "behavior", "bootstrapping", "closed", "coarse",
  "contact", "cross", "data", "decision", "deep", "end", "few", "fine", "full",
  "general", "goal", "high", "human", "image", "language", "large", "learning",
  "long", "low", "many", "model", "multi", "non", "object", "off", "on", "one",
  "open", "part", "policy", "post", "pre", "proof", "real", "reset", "robot",
  "sample", "self", "semi", "short", "sim", "single", "small", "state", "task",
  "time", "two", "value", "vision", "world", "zero",
]);

function joinPdfLineText(left, right) {
  const m = String(left).match(/([A-Za-z]+)-$/);
  if (!m) return `${left} ${right}`;
  // PDF 换行既可能是断字 demonstra- tions，也可能是原本就有的复合词
  // real- world。保留常见独立前缀的连字符，其余按软断词合并。
  return PDF_COMPOUND_PREFIXES.has(m[1].toLowerCase())
    ? `${left}${right}`
    : `${left.slice(0, -1)}${right}`;
}

// 版面流内合并自然段；flowId 一变就先断开，确保左/右栏不会再次粘连。
// 首行缩进也会触发新段落，避免把一整栏压成一个超长翻译块。
function mergeLinesToParas(lines) {
  if (!lines.length) return [];
  const byFlow = new Map();
  for (const l of lines) {
    if (!byFlow.has(l.flowId || "legacy")) byFlow.set(l.flowId || "legacy", []);
    byFlow.get(l.flowId || "legacy").push(l);
  }
  const flowStats = new Map();
  for (const [id, ls] of byFlow) {
    const diffs = [];
    for (let i = 1; i < ls.length; i++) {
      const d = ls[i - 1].y - ls[i].y;
      if (d > 1) diffs.push(d);
    }
    flowStats.set(id, {
      lead: medianNum(diffs, 12),
      baseX: quantileNum(ls.map((l) => l.x0), 0.15, ls[0]?.x0 || 0),
    });
  }

  const paras = [];
  let cur = null;
  let prevLine = null;
  const start = (ln) => ({
    text: ln.text,
    x0: ln.x0,
    x1: ln.x1,
    yMax: Number.isFinite(ln.yMax) ? ln.yMax : ln.y + ln.h * 0.85,
    yMin: Number.isFinite(ln.yMin) ? ln.yMin : ln.y - ln.h * 0.25,
    h: ln.h,
    flowId: ln.flowId || "legacy",
    column: ln.column || "single",
    band: Number.isFinite(ln.band) ? ln.band : 0,
    kind: ln.kind || pdfLineKind(ln.text),
    sourceOrder: ln.sourceOrder,
    lineCount: 1,
  });
  const flush = () => {
    if (!cur) return;
    const t = cur.text.replace(/\s+/g, " ").trim();
    if (t) {
      const rect = {
        x0: cur.x0,
        x1: cur.x1,
        yMax: cur.yMax,
        yMin: cur.yMin,
        h: cur.h,
      };
      paras.push({
        ...rect,
        text: demathify(cleanInvisibles(t)),
        flowId: cur.flowId,
        column: cur.column,
        band: cur.band,
        kind: cur.kind,
        sourceOrder: cur.sourceOrder,
        rects: [rect],
      });
    }
    cur = null;
    prevLine = null;
  };

  for (const ln of lines) {
    if (!cur) {
      cur = start(ln);
      prevLine = ln;
      continue;
    }
    const stats = flowStats.get(ln.flowId || "legacy") || { lead: 12, baseX: ln.x0 };
    const gap = prevLine ? prevLine.y - ln.y : 0;
    const indent =
      ln.x0 - stats.baseX > Math.max(6, ln.h * 0.65) &&
      prevLine &&
      prevLine.x0 - stats.baseX <= Math.max(4, prevLine.h * 0.45);
    const captionContinues =
      /^(?:figure|table)-caption$/.test(cur.kind) &&
      (ln.kind || "body") === "body" &&
      !/[.!?]["')\]]?$/.test(cur.text) &&
      gap <= stats.lead * 1.45;
    const listItemContinues =
      cur.kind === "list-item" &&
      (ln.kind || "body") === "body" &&
      gap <= stats.lead * 1.45;
    const kindChanged =
      (ln.kind || "body") !== cur.kind &&
      !captionContinues &&
      !listItemContinues;
    const startsNewListItem =
      (ln.kind || "body") === "list-item" && cur.kind === "list-item";
    const proseWords = ln.text.match(/[\p{L}]{2,}/gu) || [];
    const credibleIndentedParagraph =
      indent &&
      proseWords.length >= 4 &&
      /^["'(\[]*[\p{Lu}\p{Lt}]/u.test(ln.text) &&
      /[.!?]["')\]]?$/.test(cur.text);
    const breakBefore =
      (ln.flowId || "legacy") !== cur.flowId ||
      gap > stats.lead * 1.45 ||
      kindChanged ||
      startsNewListItem ||
      isPdfHeadingText(ln.text) ||
      (credibleIndentedParagraph &&
        cur.lineCount > 0 &&
        !/[A-Za-z]-$/.test(cur.text));
    if (breakBefore) {
      flush();
      cur = start(ln);
      prevLine = ln;
      continue;
    }

    cur.text = joinPdfLineText(cur.text, ln.text);
    cur.x0 = Math.min(cur.x0, ln.x0);
    cur.x1 = Math.max(cur.x1, ln.x1);
    cur.yMax = Math.max(
      cur.yMax,
      Number.isFinite(ln.yMax) ? ln.yMax : ln.y + ln.h * 0.85
    );
    cur.yMin = Math.min(
      cur.yMin,
      Number.isFinite(ln.yMin) ? ln.yMin : ln.y - ln.h * 0.25
    );
    cur.h = Math.max(cur.h, ln.h);
    cur.lineCount++;
    prevLine = ln;
  }
  flush();
  return paras;
}

// 一段正文可能恰好跨过左栏底端。只有左栏明显未结束，且右栏以小写续写、
// 左栏以强续接标点收尾，或存在真实断词连字符时才合并，避免制造列间语义断层。
function joinColumnContinuationParas(paras) {
  const out = [];
  const isCaption = (b) => /^(?:figure|table)-caption$/.test(b?.kind || "");
  const isFloatCompanion = (index, band) => {
    const block = out[index];
    const caption = out[index - 1];
    if (
      !block ||
      block.kind !== "body" ||
      !caption ||
      !isCaption(caption) ||
      block.band !== band ||
      caption.band !== band ||
      block.column !== caption.column
    )
      return false;
    // PDF.js 偶尔把图注/表格内容按较大的行距拆成 body。只跳过紧贴 caption、
    // 且具有明确面板标记或密集表格值的块，避免越过普通右栏正文去错误拼接。
    const gap = Math.max(0, (caption.yMin || 0) - (block.yMax || 0));
    if (gap > Math.max(caption.h || 0, block.h || 0, 1) * 2.6) return false;
    const text = String(block.text || "").trim();
    if (caption.kind === "figure-caption") {
      return (text.match(/\([a-z0-9]{1,3}\)/gi) || []).length >= 1;
    }
    const values =
      text.match(/(?:\[[^\]]+\]|[-+]?\d+(?:\.\d+)?|\b(?:kg|mm|cm|ms|rad|m\/s|nm)\b)/gi) || [];
    return values.length >= 4 && !/[.!?]["')\]]?$/.test(text);
  };
  for (const p of paras) {
    // 图/表注可能物理上位于右栏顶部，恰好夹在“左栏末句 → 右栏续句”之间。
    // 它们必须保留，但不能切断正文句子；因此寻找候选时允许跨过独立 caption。
    let prevIndex = out.length - 1;
    while (prevIndex >= 0 && out[prevIndex].band === p.band) {
      // 只越过当前（右）栏自己的浮动内容。左栏正文即使紧邻左栏图注，仍是
      // 待连接候选，不能因包含 “Fig. 16(a)” 等面板引用而被当成图注续行跳过。
      if (
        out[prevIndex].column === p.column &&
        (isCaption(out[prevIndex]) || isFloatCompanion(prevIndex, p.band))
      )
        prevIndex--;
      else break;
    }
    const prev = out[prevIndex];
    const crossesColumns =
      prev &&
      prev.band === p.band &&
      prev.column === "left" &&
      p.column === "right" &&
      prev.kind === "body" &&
      p.kind === "body";
    const hyphenated = crossesColumns && /[A-Za-z]-$/.test(prev.text);
    const semanticStart = String(p.text || "")
      .replace(/^[^\p{L}\p{N}]+/u, "")
      .trimStart();
    const sentenceContinues =
      crossesColumns &&
      !/[.!?]["')\]]*$/.test(prev.text) &&
      (/^(?:[\p{Ll}]|[,;:)\]])/u.test(semanticStart || p.text) ||
        /[,;:]\s*$/.test(prev.text));
    if (!hyphenated && !sentenceContinues) {
      out.push(p);
      continue;
    }
    prev.text = hyphenated
      ? joinPdfLineText(prev.text, p.text)
      : `${prev.text} ${p.text}`;
    prev.x0 = Math.min(prev.x0, p.x0);
    prev.x1 = Math.max(prev.x1, p.x1);
    prev.yMax = Math.max(prev.yMax, p.yMax);
    prev.yMin = Math.min(prev.yMin, p.yMin);
    prev.h = Math.max(prev.h, p.h);
    prev.column = "cross-column";
    prev.rects = [...(prev.rects || [prev]), ...(p.rects || [p])].map((r) => ({
      x0: r.x0,
      x1: r.x1,
      yMax: r.yMax,
      yMin: r.yMin,
      h: r.h,
    }));
  }
  return out;
}

// PDF 分页与自然段边界无关。若上一页最后一个正文块明显未结束，而下一页第一
// 个正文块以小写续写，就在送给翻译模型前合成一个逻辑块；脚注仍保留在原页的
// 独立流中，不再把跨页一句话拆成两次、两种语义的翻译。
function joinCrossPageContinuationBlocks(blocks) {
  const removed = new Set();
  const pages = [...new Set(blocks.map((b) => b.page).filter(Number.isFinite))].sort(
    (a, b) => a - b
  );
  const eligible = (b) =>
    b && b.kind === "body" && b.column !== "footnote" && !/^footnote/.test(b.flowId || "");
  for (const nextPage of pages) {
    const prevPage = nextPage - 1;
    if (prevPage < 1) continue;
    const prev = blocks
      .filter((b, bi) =>
        !removed.has(bi) &&
        (b.continuedThroughPage ?? b.page) === prevPage &&
        eligible(b)
      )
      .at(-1);
    const nextIndex = blocks.findIndex(
      (b, bi) => !removed.has(bi) && b.page === nextPage && eligible(b)
    );
    const next = nextIndex >= 0 ? blocks[nextIndex] : null;
    if (!prev || !next || /[.!?]["')\]]*$/.test(prev.text)) continue;
    const start = String(next.text || "")
      .replace(/^[^\p{L}\p{N}]+/u, "")
      .trimStart();
    const hyphenated = /[A-Za-z]-$/.test(prev.text);
    if (!hyphenated && !/^\p{Ll}/u.test(start)) continue;
    prev.text = hyphenated
      ? joinPdfLineText(prev.text, next.text)
      : `${prev.text} ${next.text}`;
    prev.continuedThroughPage = nextPage;
    prev.crossPageContinuation = true;
    removed.add(nextIndex);
  }
  return blocks.filter((_b, i) => !removed.has(i));
}

function looksLikeGraphicLabelParagraph(p, caption) {
  if (!p || p.kind !== "body" || !p.text) return false;
  if (p.h > caption.h * 1.18) return false; // 文档标题等大字号文字不能误删
  const t = p.text.trim();
  const tiny = p.h <= caption.h * 0.8;
  // 信息图/流程图中的标签常被 PDF.js 合并成一条较长的短字号文本（例如
  // “Model … Data … Output …”），长度会超过普通标签阈值。只要字号明显小于
  // 图注且仍在合理的标签长度内就可放宽判断；正文段落字号通常接近图注，不会
  // 进入该分支，而 “Q1: …?” 这类带问号的图内标签也不会漏掉。
  if (tiny && t.length <= 360) return true;
  if (t.length > 190) return false;
  const words = t.match(/[A-Za-z]{2,}/g) || [];
  const digits = (t.match(/\d/g) || []).length;
  const sentence = /[.!?]["')\]]?$/.test(t);
  const symbolHeavy =
    digits / Math.max(1, t.length) > 0.12 ||
    /(?:%|→|←|↑|↓|±|…|⟷|↔|\b(?:Yes|No)\b)/.test(t);
  return t.length <= 4 || symbolHeavy || (!sentence && words.length <= 22);
}

// 有些 Figure 由纯矢量坐标轴/图例构成，detectRasterFigures 看不到它们。图注前
// 紧邻、位于图注上方且明显不像句子的短块，属于图内标签：原页会完整保留，
// 这些碎片不再作为正文翻译。Table 不走此规则，以免丢失表格单元格。
function pruneFigureLabelParas(paras) {
  const remove = new Set();
  for (let i = 0; i < paras.length; i++) {
    const caption = paras[i];
    if (caption.kind !== "figure-caption") continue;
    let inspected = 0;
    for (let j = i - 1; j >= 0 && inspected < 48; j--, inspected++) {
      const p = paras[j];
      // 图内标签可能恰好以 “4 Visual …” 这类编号开头，被标题规则标成
      // heading；只要字号仍明显小于图注，就继续纳入图内区域，不让它阻断回溯。
      if (
        /-caption$/.test(p.kind) ||
        (/heading|footnote/.test(p.kind) && p.h > caption.h * 0.8)
      )
        break;
      // Figure 的图内文字应在图注之上；一旦进入图注下方正文就停止回溯。
      if (p.yMin < caption.yMax - Math.max(3, caption.h * 0.35)) break;
      if (!looksLikeGraphicLabelParagraph(p, caption)) break;
      remove.add(j);
    }
  }
  return {
    paras: paras.filter((_p, i) => !remove.has(i)),
    omitted: remove.size,
  };
}

function pdfLinesToParagraphs(lines) {
  return mergeLinesToParas(lines).map((b) => b.text);
}

// ---------- 数学片段保护：LaTeX 不被排版处理破坏 ----------
function mapMath(text, fn) {
  return text
    .split(MATH_RE)
    .map((p, i) => {
      if (i % 2 === 1) return cleanInvisibles(p);
      // fn（reflow/typofix）本身会 trim；公式两侧的空格不能因此丢失，
      // 否则 "defined as $L$" 会被压成 "defined as$L$"。
      const lead = (p.match(/^\s*/) || [""])[0];
      const trail = (p.match(/\s*$/) || [""])[0];
      const end = p.length - trail.length;
      if (end < lead.length) return p;
      return lead + fn(p.slice(lead.length, end)) + trail;
    })
    .join("")
    .trim();
}

// ---------- 英文源文本重排：先合并 PDF/复制文本的硬换行与断行单词 ----------
// 翻译请求统一走 reflowEn；它只修复文本结构，不改变语义或添加排版字符。
function reflowEn(s) {
  return mapMath(s, baseReflowEn);
}

function baseReflowEn(s) {
  let t = cleanInvisibles(s);
  // PDF 文本层可能保留软连字符（U+00AD），先去除，避免它被翻译源当成真实字符。
  t = t.replace(/\u00ad/g, "");
  t = t.replace(/\r\n?/g, "\n");
  t = t.replace(/[ \t]+/g, " ");
  // PDF 复制的硬换行：空行保留为段落分隔，其余换行并入段落自然折行
  t = t.replace(/\n\s*\n/g, "\u0001");
  t = t.replace(/\s*\n\s*/g, " ");
  t = t.replace(/\u0001/g, "\n\n");
  t = t.replace(/ +/g, " ");
  // 断行连字符续接：optimiza- tion → optimization
  t = t.replace(/([a-z])- ([a-z])/gi, "$1$2");
  return t.trim();
}

function baseReflowGeneric(s, joinWithoutSpace = false) {
  let t = cleanInvisibles(String(s || ""))
    .replace(/\u00ad/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t　]+/g, " ");
  // 先保留真正的空行，再处理 PDF/复制文本的硬换行。CJK 与东南亚文字通常不在
  // 词间加空格；其余文字用一个空格衔接，避免法语、阿拉伯语等被黏成一个词。
  t = t.replace(/\n\s*\n/g, "\u0001");
  if (joinWithoutSpace) {
    // CJK/泰文段落里仍可能嵌入被硬换行切开的英文术语；两侧都是拉丁字母或
    // 数字时保留一个词间空格，其余位置才无空格拼接。
    t = t.replace(
      /(?<=\S)[ \t]*\n[ \t]*(?=\S)/g,
      (m, offset, whole) => {
        const a = whole[offset - 1] || "";
        const b = whole[offset + m.length] || "";
        return /[A-Za-zÀ-ɏ0-9]/.test(a) && /[A-Za-zÀ-ɏ0-9]/.test(b)
          ? " "
          : "";
      }
    );
    t = t.replace(/\s*\n\s*/g, "");
  } else t = t.replace(/\s*\n\s*/g, " ");
  t = t.replace(/\u0001/g, "\n\n").replace(/ +/g, " ");
  // 拉丁字母语言常见的版面断词；只处理两侧都是拉丁字母的情形。
  t = t.replace(/([A-Za-zÀ-ɏ])- ([A-Za-zÀ-ɏ])/g, "$1$2");
  return t.trim();
}

function reflowForLanguage(s, language = "auto") {
  const resolved = resolvedLayoutLanguage(language, s);
  const script = languageInfo(resolved).script;
  const noSpace = script === "cjk" || script === "seasia";
  return mapMath(s, (part) => baseReflowGeneric(part, noSpace));
}

// ---------- 英文展示规范化：源文本重排 + 弯引号、破折号 ----------
function typofixEn(s) {
  return mapMath(s, baseTypofixEn);
}

function baseTypofixEn(s) {
  let t = baseReflowEn(s);
  // 弯引号、双连字符转破折号
  t = t
    .replace(/(^|[\s(\[{])"/g, "$1\u201c")
    .replace(/"/g, "\u201d")
    .replace(/(^|[\s(\[{])'/g, "$1\u2018")
    .replace(/'/g, "\u2019")
    .replace(/\s--\s/g, " \u2014 ");
  return t.trim();
}

// 所有句子/段落/词典入口发送前的统一规范化。
// 这里刻意复用 typofixEn：弹窗中看到的原文，就是实际送进翻译源的原文；
// 只在下一步 protectMath 时临时把完整 LaTeX 替换为可还原 token。
function normalizeTranslationInput(s, sourceLanguage = "auto") {
  const raw = demathify(cleanInvisibles(String(s ?? "")));
  const resolved = resolvedLayoutLanguage(sourceLanguage, raw);
  return resolved === "en" ? typofixEn(raw) : reflowForLanguage(raw, resolved);
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

// 目标语言排版：中日文与东南亚文字不凭空插入词间空格；有显式词间空格的语言
// 用一个空格合并 PDF 硬换行。词典条目保留逐行结构，不做段落合并。
function formatTextForLanguage(s, language = "zh-Hans", options = {}) {
  if (options.dictionary) return typofixZh(s);
  const resolved = resolvedLayoutLanguage(language, s);
  const script = languageInfo(resolved).script;
  if (script === "cjk" || script === "seasia")
    return reflowForLanguage(s, resolved);
  return reflowForLanguage(s, resolved);
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
    const sourceLanguage = p.sourceLanguage || "auto";
    const targetLanguage = p.targetLanguage || "zh-Hans";
    const sourceText = formatTextForLanguage(p.en, sourceLanguage);
    const targetText = formatTextForLanguage(p.zh, targetLanguage, {
      dictionary: !!p.dict,
    });
    const sourceEl = el.createDiv({ cls: "mini-en-line mini-source-line" });
    applyLanguageAttrs(sourceEl, p.detectedLanguage || sourceLanguage, sourceText);
    renderRichText(sourceEl, sourceText);
    const targetEl = el.createDiv({
      cls: p.dict
        ? "mini-dict-line mini-target-line"
        : "mini-zh-line mini-target-line",
    });
    applyLanguageAttrs(targetEl, targetLanguage, targetText);
    renderRichText(targetEl, targetText);
  }
}

// ---------- 单词：百度 sug（免 Key，释义简） ----------
async function baiduDictLookup(word) {
  const res = await requestUrl({
    url: `https://fanyi.baidu.com/sug?kw=${encodeURIComponent(word)}`,
    headers: { "user-agent": UA },
  });
  checkStatus(res, providerName("百度sug"));
  const data = res.json;
  if (!data || !Array.isArray(data.data) || data.data.length === 0) {
    throw new Error(t("error.definition_not_found"));
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
  checkStatus(res, providerName("有道词典"));
  let html = String(res.text || "");
  // 先剔除 script/style/注释，避免 JS、CSS 文本混进释义
  html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<style[\s\S]*?<\/style>/gi, "");
  html = html.replace(/<!--[\s\S]*?-->/g, "");
  html = html.replace(/(\r\n|\n|\r)/gm, "");
  const m = html.match(
    /<div id="phrsListTab.*webTrans" class="trans-wrapper trans-tab">/gm
  );
  if (!m || m.length === 0) throw new Error(t("error.definition_not_found"));
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
  if (merged.length === 0) throw new Error(t("error.definition_not_found"));
  return merged.join("\n");
}

// ---------- 单词：牛津（Oxford Learner's Dictionaries，免 Key，英英释义） ----------
async function oxfordDictLookup(word) {
  const res = await requestUrl({
    url: `https://www.oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(word)}`,
    headers: { "user-agent": UA },
  });
  checkStatus(res, providerName("牛津"));
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
  if (lines.length === 0) throw new Error(t("error.definition_not_found"));
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
    if (!prof.url) throw new Error(t("config.url_required"));
    if (!prof.apiKey) throw new Error(t("config.api_key_required"));
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
  throw new Error(t("error.all_dictionaries_failed"));
}

// ---------- 翻译源语言代码与能力边界 ----------
const PROVIDER_LANGUAGE_OVERRIDES = Object.freeze({
  google: {
    "zh-Hans": "zh-CN",
    "zh-Hant": "zh-TW",
    nb: "no",
    fil: "tl",
    "sr-Latn": "sr",
    "sr-Cyrl": "sr",
  },
  huoshan: {
    "zh-Hans": "zh",
    "zh-Hant": "zh-Hant",
    nb: "no",
    fil: "tl",
    "sr-Latn": "sr",
    "sr-Cyrl": "sr",
  },
  tencent: {
    "zh-Hans": "zh",
    "zh-Hant": "zh-TW",
    nb: "no",
    fil: "tl",
    "sr-Latn": "sr",
    "sr-Cyrl": "sr",
  },
  bing: {},
});

function providerLanguageCode(provider, code, source = false) {
  if (code === "auto") {
    if (provider === "bing") return source ? "auto-detect" : "";
    return "auto";
  }
  return PROVIDER_LANGUAGE_OVERRIDES[provider]?.[code] || code;
}

function canonicalLanguageCode(code) {
  const c = String(code || "").toLowerCase();
  if (["zh", "zh-cn", "zh-hans", "chinese_simplified"].includes(c)) return "zh-Hans";
  if (["zh-tw", "zh-hk", "zh-hant", "chinese_traditional"].includes(c)) return "zh-Hant";
  if (c === "no") return "nb";
  if (c === "tl") return "fil";
  if (c === "sr") return "sr-Latn";
  return LANGUAGE_MAP.has(code) ? code : LANGUAGE_MAP.has(c) ? c : "";
}

const YOUDAO_CODES = Object.freeze({
  "zh-Hans": "ZH_CN",
  en: "EN",
  ja: "JA",
  ko: "KR",
  fr: "FR",
  de: "DE",
  ru: "RU",
  es: "SP",
  pt: "PT",
  vi: "VI",
  id: "ID",
  it: "IT",
  nl: "NL",
  th: "TH",
});

function youdaoPairType(from, to) {
  if (from === "auto") return to === "zh-Hans" ? "AUTO" : "";
  const a = YOUDAO_CODES[from];
  const b = YOUDAO_CODES[to];
  return a && b && a !== b ? `${a}2${b}` : "";
}

const TENCENT_LANGUAGES = new Set([
  "zh-Hans", "zh-Hant", "en", "ja", "ko", "fr", "de", "es", "ru",
  "pt", "it", "tr", "vi", "id", "th", "ar",
]);

function engineSupportsPair(name, from, to) {
  if (!LANGUAGE_MAP.has(to)) return false;
  if (from !== "auto" && !LANGUAGE_MAP.has(from)) return false;
  if (from !== "auto" && from === to) return false;
  if (name === "有道") return !!youdaoPairType(from, to);
  if (name === "腾讯")
    return TENCENT_LANGUAGES.has(to) && (from === "auto" || TENCENT_LANGUAGES.has(from));
  if (name === "CNKI") {
    if (to !== "en" && to !== "zh-Hans") return false;
    return from === "auto" || (from === "en" && to === "zh-Hans") || (from === "zh-Hans" && to === "en");
  }
  // 火山、谷歌、Bing 与可配置大模型在本插件列出的语言范围内均可尝试；
  // 服务端若缩减语种会返回明确错误并按现有机制回退下一内置源。
  return true;
}

function normalizeEngineResult(raw, fallbackDetected = "") {
  if (typeof raw === "string") return { text: raw, detectedLanguage: fallbackDetected };
  return {
    text: String(raw?.text || ""),
    detectedLanguage: canonicalLanguageCode(raw?.detectedLanguage) || fallbackDetected,
  };
}

function rejectLikelyUnsupportedEcho(input, output, from, to, label) {
  const a = String(input || "").replace(/\s+/g, " ").trim();
  const b = String(output || "").replace(/\s+/g, " ").trim();
  if (!b) throw new Error(t("error.empty_result"));
  if (
    from !== "auto" &&
    from !== to &&
    a === b &&
    a.length >= 12 &&
    (a.match(/[\p{L}\p{N}]+/gu) || []).length >= 2
  ) {
    throw new Error(t("error.provider_no_translation", {
      provider: providerName(label),
    }));
  }
  return b;
}

// ---------- 句子：有道网页版（免 Key；语言对以官网旧版代码映射） ----------
async function youdaoTranslate(text, from = "auto", to = "zh-Hans") {
  const type = youdaoPairType(from, to);
  if (!type) throw new Error(t("error.unsupported_pair", {
    provider: providerName("有道"),
    pair: languagePairLabel(from, to),
  }));
  const res = await requestUrl({
    url: `https://fanyi.youdao.com/translate?&doctype=json&type=${encodeURIComponent(type)}&i=${encodeURIComponent(text)}`,
    headers: { "user-agent": UA },
  });
  checkStatus(res, providerName("有道"));
  const out = [];
  for (const seg of res.json.translateResult || []) {
    for (const p of seg) out.push(p.tgt);
  }
  if (out.length === 0) throw new Error(t("error.empty_result"));
  return { text: out.join(""), detectedLanguage: from === "auto" ? "" : from };
}

// ---------- 句子：火山网页版（免 Key，最简 JSON POST） ----------
async function huoshanTranslate(text, from = "auto", to = "zh-Hans") {
  const res = await requestUrl({
    url: "https://translate.volcengine.com/crx/translate/v1/",
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": UA },
    body: JSON.stringify({
      source_language: providerLanguageCode("huoshan", from, true),
      target_language: providerLanguageCode("huoshan", to),
      text,
    }),
  });
  checkStatus(res, providerName("火山"));
  if (!res.json || !res.json.translation) throw new Error(t("error.empty_result"));
  return {
    text: rejectLikelyUnsupportedEcho(text, res.json.translation, from, to, "火山"),
    detectedLanguage: canonicalLanguageCode(res.json.detected_language),
  };
}

// ---------- 句子：腾讯交互翻译（免 Key，固定 client_key） ----------
async function tencentTranslate(text, from = "auto", to = "zh-Hans") {
  if (!engineSupportsPair("腾讯", from, to))
    throw new Error(t("error.unsupported_pair", {
      provider: providerName("腾讯"),
      pair: languagePairLabel(from, to),
    }));
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
      source: {
        lang: providerLanguageCode("tencent", from, true),
        text_list: [text],
      },
      target: { lang: providerLanguageCode("tencent", to) },
    }),
  });
  checkStatus(res, providerName("腾讯"));
  if (res.json?.header?.ret_code && res.json.header.ret_code !== "succ")
    throw new Error(res.json.message || res.json.header.ret_code);
  if (!res.json || !res.json.auto_translation) throw new Error(t("error.empty_result"));
  return {
    text: res.json.auto_translation.join("\n").trim(),
    detectedLanguage: canonicalLanguageCode(res.json.src_lang),
  };
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

async function googleTranslate(text, from = "auto", to = "zh-Hans") {
  const sl = providerLanguageCode("google", from, true);
  const tl = providerLanguageCode("google", to);
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx" +
    `&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&hl=${encodeURIComponent(tl)}` +
    "&dt=at&dt=bd&dt=ex&dt=ld&dt=md&dt=qca&dt=rw&dt=rm&dt=ss&dt=t" +
    `&source=bh&ssel=0&tsel=0&kc=1&tk=${googleTk(text)}&q=${encodeURIComponent(text)}`;
  const res = await requestUrl({ url, headers: { "user-agent": UA } });
  checkStatus(res, providerName("谷歌"));
  const arr = res.json;
  if (!Array.isArray(arr) || !Array.isArray(arr[0])) throw new Error(t("error.empty_result"));
  let out = "";
  for (const seg of arr[0]) {
    if (seg && seg[0]) out += seg[0];
  }
  if (!out) throw new Error(t("error.empty_result"));
  return {
    text: rejectLikelyUnsupportedEcho(text, out, from, to, "谷歌"),
    detectedLanguage: canonicalLanguageCode(arr[2]),
  };
}

// ---------- 句子：Bing / Microsoft Translator ----------
// 配置 Azure Key 时走官方 v3 API；未配置时使用 Bing Translator 网页会话，后者可能
// 被验证码或地区策略限制，因此失败后仍按内置源回退。官方模式适合长期稳定使用。
let BING_WEB_SESSION = null;

async function getBingWebSession() {
  if (BING_WEB_SESSION && BING_WEB_SESSION.expiresAt > Date.now() + 60000)
    return BING_WEB_SESSION;
  const res = await requestUrl({
    url: "https://www.bing.com/translator",
    headers: { "user-agent": UA },
  });
  checkStatus(res, providerName("Bing 会话"));
  const html = String(res.text || "");
  const ap = html.match(/params_AbusePreventionHelper\s*=\s*\[(\d+),"([^"]+)",(\d+)\]/);
  const ig = html.match(/\bIG:"([A-F0-9]+)"/i)?.[1];
  const iid = html.match(/data-iid="?([^"\s)]+)/i)?.[1] || "translator.5023";
  if (!ap || !ig) throw new Error(t("error.bing_token"));
  BING_WEB_SESSION = {
    key: ap[1],
    token: ap[2],
    ig,
    iid,
    seq: 0,
    expiresAt: Date.now() + Math.min(Number(ap[3]) || 3600000, 3500000),
  };
  return BING_WEB_SESSION;
}

function parseBingTranslation(data) {
  if (data?.ShowCaptcha || data?.showCaptcha) throw new Error(t("error.bing_captcha"));
  const first = Array.isArray(data) ? data[0] : data;
  const text = first?.translations?.[0]?.text || first?.translation || "";
  if (!text) throw new Error(first?.error?.message || data?.error?.message || t("error.empty_result"));
  return {
    text,
    detectedLanguage: canonicalLanguageCode(
      first?.detectedLanguage?.language || first?.detectedLanguage || ""
    ),
  };
}

async function bingTranslateOfficial(text, from, to) {
  const key = String(PLUGIN_SETTINGS?.bingApiKey || "").trim();
  if (!key) throw new Error(t("error.bing_key"));
  const endpoint = String(
    PLUGIN_SETTINGS?.bingEndpoint || "https://api.cognitive.microsofttranslator.com"
  ).replace(/\/+$/, "");
  let url = `${endpoint}/translate?api-version=3.0&to=${encodeURIComponent(
    providerLanguageCode("bing", to)
  )}`;
  if (from !== "auto")
    url += `&from=${encodeURIComponent(providerLanguageCode("bing", from, true))}`;
  const headers = {
    "content-type": "application/json",
    "user-agent": UA,
    "Ocp-Apim-Subscription-Key": key,
  };
  const region = String(PLUGIN_SETTINGS?.bingRegion || "").trim();
  if (region) headers["Ocp-Apim-Subscription-Region"] = region;
  const res = await requestUrl({
    url,
    method: "POST",
    headers,
    body: JSON.stringify([{ Text: text }]),
  });
  checkStatus(res, "Bing");
  return parseBingTranslation(res.json);
}

async function bingTranslateWeb(text, from, to) {
  const session = await getBingWebSession();
  const body = new URLSearchParams({
    fromLang: providerLanguageCode("bing", from, true),
    to: providerLanguageCode("bing", to),
    text,
    token: session.token,
    key: session.key,
  }).toString();
  session.seq += 1;
  const res = await requestUrl({
    url:
      `https://www.bing.com/ttranslatev3?isVertical=1&IG=${encodeURIComponent(session.ig)}` +
      `&IID=${encodeURIComponent(session.iid)}.${session.seq}`,
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      "user-agent": UA,
      referer: "https://www.bing.com/translator",
    },
    body,
  });
  checkStatus(res, providerName("Bing 网页"));
  return parseBingTranslation(res.json);
}

async function bingTranslate(text, from = "auto", to = "zh-Hans") {
  const out = PLUGIN_SETTINGS?.bingApiKey
    ? await bingTranslateOfficial(text, from, to)
    : await bingTranslateWeb(text, from, to);
  out.text = rejectLikelyUnsupportedEcho(text, out.text, from, to, "Bing");
  return out;
}

// ---------- 句子：CNKI 学术翻译（官网中英双向接口） ----------
// 官网请求采用 AES-128-ECB + URL-safe Base64。CNKI 可能按频率要求登录或验证码；
// 这种情况返回明确错误，由内置源回退，不伪造成功结果。
function cnkiEncrypt(text) {
  const crypto = require("crypto");
  const { Buffer: NodeBuffer } = require("buffer");
  const cipher = crypto.createCipheriv(
    "aes-128-ecb",
    NodeBuffer.from("4e87183cfd3a45fe", "utf8"),
    null
  );
  cipher.setAutoPadding(true);
  return NodeBuffer.concat([cipher.update(String(text), "utf8"), cipher.final()])
    .toString("base64")
    .replace(/\//g, "_")
    .replace(/\+/g, "-");
}

async function cnkiTranslate(text, from = "auto", to = "zh-Hans") {
  if (!engineSupportsPair("CNKI", from, to))
    throw new Error(t("error.cnki_only_zh_en", {
      pair: languagePairLabel(from, to),
    }));
  const translateType = to === "en" ? 0 : 1;
  const headers = {
    "content-type": "application/json;charset=UTF-8",
    "user-agent": UA,
    origin: "https://dict.cnki.net",
    referer: "https://dict.cnki.net/",
  };
  const token = String(PLUGIN_SETTINGS?.cnkiToken || "").trim();
  const authorization = String(PLUGIN_SETTINGS?.cnkiAuthorization || "").trim();
  if (token) headers.Token = token;
  if (authorization) headers.Authorization = authorization;
  const res = await requestUrl({
    url: "https://dict.cnki.net/fyzs-front-api/translate/literaltranslation",
    method: "POST",
    headers,
    body: JSON.stringify({ words: cnkiEncrypt(text), translateType }),
  });
  checkStatus(res, "CNKI");
  const data = res.json || {};
  if (data.code !== 200) {
    if (data.code === 401) throw new Error(t("error.cnki_login"));
    if (data.code === 1004) throw new Error(t("error.cnki_captcha"));
    throw new Error(data.msg || t("error.cnki_code", {
      code: data.code ?? t("common.unknown_error"),
    }));
  }
  const out = data.data?.mResult;
  if (!out) throw new Error(t("error.cnki_empty"));
  return {
    text: rejectLikelyUnsupportedEcho(text, out, from, to, "CNKI"),
    detectedLanguage: from === "auto" ? (to === "en" ? "zh-Hans" : "en") : from,
  };
}

// ---------- 句子：大模型（OpenAI 兼容 LLM API，端点/Key/模型均可配） ----------
let PLUGIN_SETTINGS = null;

function languagePromptName(code, autoText = "自动识别的原文语言") {
  return code === "auto" ? autoText : `${languageInfo(code).label}（${code}）`;
}

function languageTypographyInstruction(code) {
  const info = languageInfo(code);
  if (info.dir === "rtl")
    return "使用该语言自然的从右到左语序、标点和数字书写方式，不要套用中文或英文标点。";
  if (info.script === "cjk")
    return "使用该语言自然的全角标点、分段和术语写法，不要在字符之间人为插入空格。";
  if (info.script === "hangul")
    return "使用自然的韩文分词、标点和敬体层级；学术文本采用正式书面表达。";
  if (info.script === "indic" || info.script === "seasia")
    return "遵循该语言自身的词界、标点和换行习惯，不要照搬拉丁文字的断词方式。";
  return "使用该语言自然的词间空格、标点、大小写和学术书面表达。";
}

function buildTranslatePrompt(from = "auto", to = "zh-Hans") {
  const sourceName = languagePromptName(from);
  const targetName = languagePromptName(to);
  return (
    `你是严谨的学术翻译助手。把用户输入从${sourceName}翻译成${targetName}：忠实原文、术语准确、不得擅自补充事实。` +
    (from === "auto"
      ? "先在内部识别原文语言；不要输出识别过程或语言说明。"
      : "不得把原文误判为其他语言。") +
    `\n输入可能只是单词、标题、短语、标签、不完整片段、句子或段落。无论输入多短，都必须直接翻译输入本身；标题或短语只输出对应${targetName}，不加括号说明；不得要求用户补充正文、上下文或更多内容。\n` +
    `目标语言排版：${languageTypographyInstruction(to)}\n` +
    "数学公式规则（重要）：\n" +
    "1. 原文中以 __MT数字__ 形式出现的占位符代表数学公式（旧版可能是 ⟦MT数字⟧ 或 [[MT数字]]），必须原样保留在译文对应位置，不要翻译、修改或删除。\n" +
    "2. PDF 提取的文本中公式可能残缺。只有在上下文足够明确时才恢复为合法 LaTeX，并包裹在 $...$（行内）或 $$...$$（独立公式）中；变量名、函数名和单位不要翻译。无法可靠恢复时保留原字符，不要猜造公式。\n" +
    "3. 除以上情形外的普通文字正常翻译，不要随意添加公式定界符。\n" +
    `只输出${targetName}译文，不要解释、前缀、原文或语言标签。`
  );
}

// 保留常量名供旧测试/热重载会话兼容；实际请求会按当前语言对动态构造。
const TRANSLATE_PROMPT = buildTranslatePrompt("en", "zh-Hans");

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
  if (!b) throw new Error(t("config.url_required"));
  const headers = { "user-agent": UA };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  const res = await requestUrl({ url: b + "/models", headers });
  checkStatus(res, providerName("模型查询"));
  const data = res.json;
  const list = Array.isArray(data && data.data)
    ? data.data.map((m) => m.id || m).filter(Boolean)
    : [];
  if (list.length === 0) throw new Error(t("error.models_empty"));
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

function translationSourceKey(name, from = "auto", to = "zh-Hans") {
  return `${sourceKey(name)}:${safeLanguageCode(from, true)}>${safeLanguageCode(to)}`;
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
// 也指向它，两条路共用一个文件，不冗余。
let PDFJS_LIB = null;
let PDF_WORKER_BLOB_URL = null;
const FIGURE_REGION_CACHE = new WeakMap();
function installPdfWorkerBlob(plugin, lib, code) {
  const url = URL.createObjectURL(
    new Blob([code], { type: "application/javascript" })
  );
  lib.GlobalWorkerOptions.workerSrc = url;
  PDF_WORKER_BLOB_URL = url;
  if (typeof plugin?.register === "function") {
    plugin.register(() => {
      if (PDF_WORKER_BLOB_URL !== url) return;
      URL.revokeObjectURL(url);
      PDF_WORKER_BLOB_URL = null;
      if (lib.GlobalWorkerOptions.workerSrc === url) {
        lib.GlobalWorkerOptions.workerSrc = "";
      }
      if (PDFJS_LIB === lib) PDFJS_LIB = null;
    });
  }
}
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
  if (BUNDLED_RUNTIME?.loadPdfJs) {
    const lib = BUNDLED_RUNTIME.loadPdfJs();
    const code = BUNDLED_RUNTIME.getPdfWorkerSource();
    if (!code) throw new Error("发布构建中的 PDF worker 为空");
    if (!lib.GlobalWorkerOptions.workerSrc) {
      installPdfWorkerBlob(plugin, lib, code);
    }
    PDFJS_LIB = lib;
    return lib;
  }
  let lib = null;
  let err = null;
  for (const c of pluginFileCandidates(plugin, ["vendor", "pdfjs", "pdf.min.js"])) {
    try {
      lib = require(c);
      break;
    } catch (e) {
      err = e;
    }
  }
  if (!lib) throw new Error(`加载自带 pdf.js 失败：${err?.message || err}`);
  const fs = require("fs");
  for (const c of pluginFileCandidates(plugin, ["vendor", "pdfjs", "pdf.worker.js"])) {
    try {
      const code = fs.readFileSync(c, "utf8");
      installPdfWorkerBlob(plugin, lib, code);
      break;
    } catch (e) {
      err = e;
    }
  }
  if (!lib.GlobalWorkerOptions.workerSrc) {
    console.warn("[mini-translator] blob worker 构建失败，改用资源路径:", err);
    try {
      lib.GlobalWorkerOptions.workerSrc =
        plugin.app.vault.adapter.getResourcePath(
          plugin.manifest.dir + "/vendor/pdfjs/pdf.worker.js"
        );
    } catch (e2) {
      console.warn("[mini-translator] worker 设置全部失败:", e2);
    }
  }
  PDFJS_LIB = lib;
  return lib;
}

// ---------- 悬浮球模块加载（纯 DOM，零依赖），同样走绝对路径锚定 ----------
let ORB_MOD = null;
function loadOrbModule(plugin) {
  if (ORB_MOD) return ORB_MOD;
  if (BUNDLED_RUNTIME?.loadOrbModule) {
    ORB_MOD = BUNDLED_RUNTIME.loadOrbModule();
    return ORB_MOD;
  }
  let mod = null;
  let err = null;
  for (const c of pluginFileCandidates(plugin, ["src", "orbs", "translation-orb.js"])) {
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

// ---------- 批量协议：多块合并成一次请求，LLM 同一次产出「修复原文 + 目标译文」 ----------
function buildFullPrompt(from = "auto", to = "zh-Hans", count = 1) {
  const sourceName = languagePromptName(from);
  const targetName = languagePromptName(to);
  return (
    `你是严谨的学术论文翻译助手。用户给出同一篇 PDF 中已经按真实版面阅读顺序排列的若干文本块；原文语言为${sourceName}，目标语言为${targetName}。每块以 ⟦MT数字⟧ 开头。` +
    (from === "auto"
      ? "请在内部识别原文语言；不要输出识别过程。"
      : "不得把原文误判为其他语言。") +
    "脚注、图注、表注和正文已经分类；不得把脚注或图注接进正文，也不得把一块内容移动到另一个编号。相邻正文块可用于术语和指代消歧，但输出边界必须与输入编号一一对应。PDF 文本层仍可能损坏公式、断词和字符顺序。\n" +
    "对每块依次输出两个带编号的部分（顺序与输入一致，一块都不能漏）：\n" +
    `⟦SRC数字⟧ 该块${sourceName}的谨慎修复版：只修复明确的硬断词、局部字符错位和可可靠判断的数学结构；不增删论点，不翻译。\n` +
    `⟦TGT数字⟧ 对应的${targetName}译文：忠实准确、术语规范。${languageTypographyInstruction(to)}\n` +
    "公式规则：公式在 SRC 与 TGT 中都使用合法 LaTeX；行内用 $...$，独立公式用 $$...$$；每个定界符必须成对。矩阵和公式表格只使用 Obsidian/MathJax 兼容的 array、aligned、matrix 或 cases 环境，不使用 tabular，不让 begin/end 裸露在数学定界符之外。无法可靠恢复的符号保留原字符，不得编造。\n" +
    `排版规则：只在输入块内部确实含有多个自然段时使用一个空行分隔；不要为短公式、上下标碎片或视觉换行另起自然段。所有 ⟦MT数字⟧、⟦SRC数字⟧、⟦TGT数字⟧ 标记必须原样保留；不要添加解释或其它标记；共 ${count} 块必须全部输出。`
  );
}

const FULL_PROMPT_LLM = buildFullPrompt("en", "zh-Hans", 1);

// 免费源的批量协议已移除：全文翻译现在仅支持大模型源

// 解析批量响应：新版用 ⟦SRCn⟧/⟦TGTn⟧，并兼容旧版 ⟦ENn⟧/⟦ZHn⟧；
// 免费源历史响应可能回显 ⟦MTn⟧ 后跟译文。
// 无标记说明不能充当缺失译文；缺段交给现有错误/逐块重试路径处理。
function parseBatchResponse(out, n, wantEn) {
  const parts = out.split(/(⟦\s*(?:SRC|TGT|EN|ZH|MT)\s*\d+\s*⟧)/);
  const en = new Map();
  const zh = new Map();
  const legacyMt = new Map();
  let cur = null;
  for (const seg of parts) {
    const mm = seg.match(/^⟦\s*(SRC|TGT|EN|ZH)\s*(\d+)\s*⟧$/);
    if (mm) {
      cur = {
        map: mm[1] === "EN" || mm[1] === "SRC" ? en : zh,
        key: Number(mm[2]),
      };
      continue;
    }
    const mt = seg.trim().match(/^⟦\s*MT\s*(\d+)\s*⟧$/);
    if (mt) {
      cur = { map: legacyMt, key: Number(mt[1]) };
      continue;
    }
    if (!seg.trim()) continue;
    if (!cur) continue;
    const prev = cur.map.get(cur.key);
    cur.map.set(cur.key, (prev ? prev + " " : "") + seg.trim());
    cur = null;
  }
  const res = [];
  for (let i = 1; i <= n; i++) {
    // 新协议的显式 TGT/ZH 优先；MT 仅作为旧版直出兼容，避免模型回显
    // “⟦MTn⟧ 原文”后又输出 TGT 时把原文错误拼到译文前面。
    const z = zh.get(i) || legacyMt.get(i);
    if (!z) throw new Error(t("error.batch_missing_translation", { index: i }));
    res.push({ en: wantEn ? en.get(i) || "" : "", zh: z });
  }
  return res;
}

// 一批文本 → [{en,zh}]；LLM 一次请求双产物，失败/缺段抛错由上层兜底。
// 全文翻译仅支持大模型源：非大模型主源直接抛错（入口处已提前拦截）
async function translateBlockBatch(source, texts, from = "auto", to = "zh-Hans") {
  const prof = findProfile(source);
  if (!prof) throw new Error(t("error.full_llm_only"));
  const marked = texts.map((t, i) => `⟦MT${i + 1}⟧ ${t}`).join("\n\n");
  const out = await llmRequest(
    `共 ${texts.length} 段。\n\n${marked}`,
    prof,
    buildFullPrompt(from, to, texts.length)
  );
  try {
    return parseBatchResponse(out, texts.length, true);
  } catch (error) {
    // Only a structurally malformed model answer should fall back to one request per
    // block. Network/authentication/API errors happen before this point and must be
    // reported immediately instead of being disguised as a parse problem.
    const wrapped = new Error(t("error.batch_parse", {
      message: error?.message || error,
    }));
    wrapped.code = "MT_BATCH_PARSE";
    wrapped.cause = error;
    throw wrapped;
  }
}

function isFailedFullBlock(record) {
  return /^⚠️/.test(String(record?.zh || "").trim());
}

function fullBlockFailureReason(record) {
  return String(record?.zh || "")
    .replace(/^⚠️\s*(?:本块翻译失败|This block could not be translated)[：:]?\s*/i, "")
    .trim();
}

// 全部块连续分组：≤8 块且 ≤2600 字符一批。脚注与正文强制分批，既避免模型
// 把脚注当成前一栏的续句，也保留相邻正文块之间必要的上下文。
function groupIntoBatches(blocks) {
  const idxs = blocks.map((_, i) => i);
  const batches = [];
  let cur = [];
  let chars = 0;
  let curIsFootnote = null;
  for (const i of idxs) {
    const L = blocks[i].text.length;
    const isFootnote = blocks[i]?.kind === "footnote";
    if (
      cur.length &&
      (cur.length >= 8 || chars + L > 2600 || isFootnote !== curIsFootnote)
    ) {
      batches.push(cur);
      cur = [];
      chars = 0;
      curIsFootnote = null;
    }
    if (!cur.length) curIsFootnote = isFootnote;
    cur.push(i);
    chars += L;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

// 全部块翻译（带逐块缓存 + 取消 + 进度回调）；批解析失败自动降级为逐块单独翻。
// FULL_CONCURRENCY batches can run concurrently because LLM API requests are stateless.
const FULL_CONCURRENCY = 3;

async function translateBlocksAll(
  plugin,
  blocks,
  source,
  onProg,
  from = "auto",
  to = "zh-Hans"
) {
  // 统一在进入任何翻译源前重排硬换行/断词；保留原块的页码与坐标不变。
  const workBlocks = blocks.map((b) => ({
    ...b,
    text: normalizeTranslationInput(b.text, from),
  }));
  const batches = groupIntoBatches(workBlocks);
  const results = new Array(workBlocks.length).fill(null);
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
            ? t("full.batch_progress", {
                done: finishedBatches,
                total: batches.length,
              })
            : "",
        done,
        total: workBlocks.length,
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
      const key = `full:${translationSourceKey(source, from, to)}:${workBlocks[gi].text}`;
      const hit = CACHE.get(key);
      if (hit && !isFailedFullBlock(hit)) {
        results[gi] = hit;
        done++;
        doneChars += workBlocks[gi].text.length;
      } else {
        if (hit) CACHE.delete(key); // 旧会话留下的失败占位不得阻止重试
        need.push(workBlocks[gi].text);
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
      got = await withCancel(translateBlockBatch(source, need, from, to));
    } catch (e) {
      if (e?.code !== "MT_BATCH_PARSE") throw e;
      console.warn(
        "[mini-translator] 批量响应解析失败，降级逐块:",
        e.message || e
      );
    }
    if (got === CANCEL) return; // 已取消：在途请求作废，不再写缓存
    if (!got || got.length !== need.length) {
      got = [];
      for (const t of need) {
        if (plugin.ftCancel) break;
        try {
          const key1 = `full-single:${translationSourceKey(source, from, to)}:${t}`;
          let r = CACHE.get(key1);
          if (!r) {
            r = await withCancel(translateSentence(t, source, from, to));
            if (r === CANCEL) break;
            CACHE.set(key1, r);
          }
          got.push({ en: "", zh: r.text });
        } catch (e2) {
          got.push({ en: "", zh: t("error.block_failed", {
            message: e2.message || e2,
          }) });
        }
      }
    }
    idx.forEach((gi, k) => {
      if (!got[k]) return; // 取消时未完成的项保持 null，不伪装成已完成
      const rec = { en: got[k]?.en || "", zh: got[k]?.zh || "" };
      results[gi] = rec;
      done++;
      doneChars += workBlocks[gi].text.length;
      // 失败占位只用于本次结果汇报，绝不能缓存；否则修好 Key/网络后重跑
      // 仍会直接命中旧错误，看起来像插件没有重新请求。
      if (!isFailedFullBlock(rec)) {
        CACHE.set(
          `full:${translationSourceKey(source, from, to)}:${workBlocks[gi].text}`,
          rec
        );
      }
    });
    finishedBatches++;
    tick();
  };
  let next = 0; // 单线程事件循环里领取批次，无竞态
  let fatalError = null;
  const worker = async () => {
    while (!plugin.ftCancel && !fatalError) {
      const i = next++;
      if (i >= batches.length) break;
      try {
        await runBatch(batches[i]);
      } catch (error) {
        if (!fatalError) fatalError = error;
      }
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
  if (fatalError) throw fatalError;
  if (!plugin.ftCancel) {
    // A parse fallback may legitimately lose a few blocks, but a completely unusable
    // result is a failed task, not a successful document containing only warning text.
    for (let i = 0; i < results.length; i++) {
      if (!results[i]) {
        results[i] = { en: "", zh: t("error.block_failed", {
          message: t("error.block_no_result"),
        }) };
      }
    }
    const failed = results.filter(isFailedFullBlock);
    if (results.length > 0 && failed.length === results.length) {
      const reasons = [
        ...new Set(failed.map(fullBlockFailureReason).filter(Boolean)),
      ].slice(0, 3);
      throw new Error(t("error.all_blocks_failed", {
        count: results.length,
        detail: reasons.length
          ? `${getUiLanguage() === "en" ? ": " : "："}${reasons.join(getUiLanguage() === "en" ? "; " : "；")}`
          : "",
      }));
    }
  }
  return { results, batches };
}

// ---------- 整本提取：全页行几何 → 跨页页眉/页脚剔除 → 带 bbox 的段落块 ----------
function normChromeLine(s) {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

async function extractDocBlocks(doc, onProg) {
  const pages = [];
  const n = doc.numPages;
  for (let i = 1; i <= n; i++) {
    if (onProg) onProg(i, n);
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    pages.push({
      lines: pdfItemsToBlocks(tc.items, viewport.width),
      width: viewport.width,
      height: viewport.height,
    });
  }
  // 页眉/页脚按页面几何顶部/底部寻找，而不是按内容流首尾寻找；后者在双栏 PDF
  // 中可能分别是左栏顶端和右栏底端。
  const freq = new Map();
  for (const page of pages) {
    const visual = page.lines.slice().sort((a, b) => b.y - a.y || a.x0 - b.x0);
    const cand = [visual[0], visual[1], visual[visual.length - 1], visual[visual.length - 2]];
    const seen = new Set();
    for (const l of cand) {
      if (!l) continue;
      const k = normChromeLine(l.text);
      if (seen.has(k)) continue;
      seen.add(k);
      if (k.length > 2 && k.length < 120)
        freq.set(k, (freq.get(k) || 0) + 1);
    }
  }
  const thresh = Math.max(2, Math.ceil(pages.length * 0.6));
  const chrome = new Set(
    [...freq].filter(([, c]) => c >= thresh).map(([k]) => k)
  );
  const blocks = [];
  const parasByPage = [];
  let twoColumnPages = 0;
  let omittedFigureLabels = 0;
  let footnoteLines = 0;
  let footnoteBlocks = 0;
  pages.forEach((page, pi) => {
    const kept = chrome.size
      ? page.lines.filter((l) => !chrome.has(normChromeLine(l.text)))
      : page.lines;
    // 页边孤立页码不需要跨页重复也可安全剔除。
    const withoutPageNumbers = kept.filter(
      (l) =>
        !(/^\s*\d{1,4}\s*$/.test(l.text) &&
          (l.y < page.height * 0.08 || l.y > page.height * 0.94))
    );
    const ordered = orderPdfPageLines(
      withoutPageNumbers,
      page.width,
      page.height,
      pi + 1
    );
    if (ordered.columns === 2) twoColumnPages++;
    omittedFigureLabels += ordered.omittedFigureLabels || 0;
    footnoteLines += ordered.footnoteLines || 0;
    // 先剥离图内标签，再判断跨栏续句。若顺序相反，右栏图顶的 “a b c” 等
    // 小写标签会被误当成左栏未完句的续文，污染后续翻译且无法再安全删除。
    const pruned = pruneFigureLabelParas(mergeLinesToParas(ordered.lines));
    omittedFigureLabels += pruned.omitted;
    const pb = joinColumnContinuationParas(pruned.paras);
    footnoteBlocks += pb.filter((b) => b.kind === "footnote").length;
    parasByPage.push(pb.map((b) => b.text));
    for (const b of pb) blocks.push({ ...b, page: pi + 1 });
  });
  const logicalBlocks = joinCrossPageContinuationBlocks(blocks);
  return {
    blocks: logicalBlocks,
    parasByPage,
    chromeCount: chrome.size,
    twoColumnPages,
    omittedFigureLabels,
    footnoteLines,
    footnoteBlocks,
  };
}

// ---------- In-app progress window: draggable, minimizes on outside click or Esc ----------
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
    this.errorMessage = "";
    this.cancelBtn = null;
  }

  onOpen() {
    this.modalEl.addClass("mini-prog-modal");
    const c = this.contentEl;
    c.empty();

    const head = c.createDiv("mini-prog-head");
    head.createSpan("mini-prog-dot");
    head.createSpan({ text: t("progress.title") });
    // 不再自绘 ✕：右上角只保留 Obsidian 原生关闭按钮。它的 class/挂载点随版本
    // 变化，按 class 删除/隐藏始终有漏网之鱼（曾出现双 ✕）；而原生按钮的点击
    // 走本类 close()——未完成时自动转为最小化成悬浮球，行为与自绘 ✕ 一致，
    // 且构造上只可能有一个关闭按钮
    // （原生按钮在 head 外部，不会触发标题栏拖动，无需 stopPropagation）

    this.phaseEl = c.createDiv("mini-prog-phase");
    this.phaseEl.setText(t("progress.preparing"));
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
    this.cancelBtn = btns.createEl("button", { text: t("progress.cancel") });
    this.setRunningCancelButton();
  }

  setRunningCancelButton() {
    const cancelBtn = this.cancelBtn;
    if (!cancelBtn) return;
    cancelBtn.disabled = false;
    cancelBtn.setText(t("progress.cancel"));
    cancelBtn.onclick = () => {
      this.plugin.requestFtCancel();
      this.phaseEl.setText(t("progress.cancelling"));
      cancelBtn.disabled = true;
      cancelBtn.setText(t("progress.cancel_requested"));
      this.finished = true; // 允许直接 ESC/点外部关窗，后台自行快速收尾
    };
  }

  update(st = {}) {
    if (this.errorMessage) {
      // 用户不关闭失败窗就直接重试时，把同一窗口恢复为正常运行态。
      this.errorMessage = "";
      this.finished = false;
      this.modalEl?.classList.remove("mini-prog-error");
      this.setRunningCancelButton();
    }
    if (this.phaseEl && st.phase) this.phaseEl.setText(phaseName(st.phase));
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
    if (st.total) {
      bits.push(t("progress.blocks", { done: st.done, total: st.total }));
    }
    if (this.dispTok > 0) {
      bits.push(t("progress.tokens_used", { tokens: fmtTok(this.dispTok) }));
    }
    if (this.real && this.rate > 0 && this.disp < 0.97) {
      const remMs = (1 - this.disp) / this.rate;
      bits.push(
        remMs < 90000
          ? t("progress.seconds_left", {
              seconds: Math.max(1, Math.round(remMs / 1000)),
            })
          : t("progress.minutes_left", {
              minutes: (remMs / 60000).toFixed(1),
            })
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
      labels: {
        host: t("orb.aria_host"),
        indeterminate: t("orb.aria_indeterminate"),
        progress: (value) => t("orb.aria_progress", { progress: value }),
      },
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

  fail(message) {
    const detail = String(message || t("common.unknown_error"));
    if (this.minimized) this.restore();
    this.errorMessage = detail;
    this.finished = true;
    this.real = null;
    this._lastSt = { phase: "全文翻译失败", detail };
    this.modalEl?.classList.remove("mini-prog-indet", "mini-prog-complete");
    this.modalEl?.classList.add("mini-prog-error");
    this.phaseEl?.setText(t("progress.failed"));
    this.detailEl?.setText(detail);
    if (this.barFill) this.barFill.style.transform = "scaleX(1)";
    this.pctEl?.setText(t("progress.failed_short"));
    this.metaEl?.setText(t("progress.stopped"));
    if (this.cancelBtn) {
      this.cancelBtn.disabled = false;
      this.cancelBtn.setText(t("common.close"));
      this.cancelBtn.onclick = () => this.requestClose();
    }
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
    this.cancelBtn = null;
  }
}


// ---------- PDF 图片识别：读取绘制操作与变换矩阵，不把图片里的像素误当正文 ----------
function mulMatrix2d(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function matrixPoint(m, x, y) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function rectGap(a0, a1, b0, b1) {
  if (a1 < b0) return b0 - a1;
  if (b1 < a0) return a0 - b1;
  return 0;
}

function mergeRasterRegions(regions, pageWidth, pageHeight) {
  const pending = regions
    .filter((r) => r.width >= 18 && r.height >= 18 && r.areaRatio >= 0.002)
    .sort((a, b) => a.top - b.top || a.left - b.left)
    .map((r) => ({ ...r, count: 1 }));
  const groups = [];
  for (const r of pending) {
    let group = null;
    for (const g of groups) {
      const xGap = rectGap(g.left, g.right, r.left, r.right);
      const yGap = rectGap(g.top, g.bottom, r.top, r.bottom);
      // 论文里的复合图常由一排独立位图拼成。只要处于同一纵向带，允许跨栏合并，
      // 防止一张 Figure 被拆成十几个零碎附件。
      if (
        (yGap <= pageHeight * 0.018 && xGap <= pageWidth * 0.34) ||
        (yGap === 0 && xGap <= pageWidth * 0.38)
      ) {
        group = g;
        break;
      }
    }
    if (!group) {
      groups.push({ ...r });
      continue;
    }
    group.left = Math.min(group.left, r.left);
    group.top = Math.min(group.top, r.top);
    group.right = Math.max(group.right, r.right);
    group.bottom = Math.max(group.bottom, r.bottom);
    group.width = group.right - group.left;
    group.height = group.bottom - group.top;
    group.count += 1;
  }
  return groups
    .map((g) => {
      const areaRatio = (g.width * g.height) / (pageWidth * pageHeight || 1);
      const padX = pageWidth * 0.015;
      const padTop = pageHeight * 0.012;
      const padBottom = pageHeight * 0.04; // 尽量连同紧邻图注一起保留
      const left = Math.max(0, g.left - padX);
      const top = Math.max(0, g.top - padTop);
      const right = Math.min(pageWidth, g.right + padX);
      const bottom = Math.min(pageHeight, g.bottom + padBottom);
      return {
        left,
        top,
        right,
        bottom,
        width: right - left,
        height: bottom - top,
        pageWidth,
        pageHeight,
        imageCount: g.count,
        areaRatio,
        kind: areaRatio >= 0.72 ? "page-image" : "figure",
      };
    })
    .filter(
      (g) =>
        g.areaRatio >= 0.006 &&
        (g.width >= pageWidth * 0.12 || g.height >= pageHeight * 0.06)
    )
    .sort((a, b) => a.top - b.top || a.left - b.left)
    .slice(0, 12);
}

async function detectRasterFigures(plugin, doc, onProg) {
  const cached = FIGURE_REGION_CACHE.get(doc);
  if (cached) {
    if (onProg) onProg(doc.numPages, doc.numPages);
    return cached;
  }
  const lib = loadPdfJs(plugin);
  const OPS = lib.OPS || {};
  const out = new Map();
  for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
    if (onProg) onProg(pageNo, doc.numPages);
    const page = await doc.getPage(pageNo);
    const opList = await page.getOperatorList();
    const viewport = page.getViewport({ scale: 1 });
    let ctm = [1, 0, 0, 1, 0, 0];
    const stack = [];
    const raw = [];
    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      const args = opList.argsArray[i];
      if (fn === OPS.save) {
        stack.push(ctm.slice());
        continue;
      }
      if (fn === OPS.restore) {
        ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
        continue;
      }
      if (fn === OPS.transform && args && args.length >= 6) {
        ctm = mulMatrix2d(ctm, Array.from(args).slice(0, 6));
        continue;
      }
      const isImage =
        fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject;
      if (!isImage) continue;
      const points = [
        matrixPoint(ctm, 0, 0),
        matrixPoint(ctm, 1, 0),
        matrixPoint(ctm, 0, 1),
        matrixPoint(ctm, 1, 1),
      ].map((p) => viewport.convertToViewportPoint(p[0], p[1]));
      const xs = points.map((p) => p[0]);
      const ys = points.map((p) => p[1]);
      const left = Math.max(0, Math.min(...xs));
      const top = Math.max(0, Math.min(...ys));
      const right = Math.min(viewport.width, Math.max(...xs));
      const bottom = Math.min(viewport.height, Math.max(...ys));
      const width = right - left;
      const height = bottom - top;
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
        continue;
      raw.push({
        left,
        top,
        right,
        bottom,
        width,
        height,
        areaRatio: (width * height) / (viewport.width * viewport.height || 1),
      });
    }
    const figures = mergeRasterRegions(raw, viewport.width, viewport.height);
    if (figures.length) out.set(pageNo, figures);
  }
  FIGURE_REGION_CACHE.set(doc, out);
  return out;
}

// ---------- 页面渲染：可只渲染含图片的页；HTML 对照模式传 null 时渲染全文 ----------
async function renderPageImages(plugin, doc, scale, quality, onProg, pageNumbers = null) {
  const n = doc.numPages;
  const nums = Array.isArray(pageNumbers)
    ? [...new Set(pageNumbers)].filter((p) => p >= 1 && p <= n).sort((a, b) => a - b)
    : Array.from({ length: n }, (_, i) => i + 1);
  const out = new Array(n).fill(null);
  for (let pos = 0; pos < nums.length; pos++) {
    const pageNo = nums[pos];
    if (onProg) onProg(pos + 1, nums.length, pageNo);
    const page = await doc.getPage(pageNo);
    const vp = page.getViewport({ scale });
    const cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.floor(vp.width));
    cv.height = Math.max(1, Math.floor(vp.height));
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, cv.width, cv.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    out[pageNo - 1] = {
      page: pageNo,
      dataUrl: cv.toDataURL("image/jpeg", quality),
      w: vp.width,
      h: vp.height,
      vp,
      canvas: cv,
    };
  }
  return out;
}

function cropRenderedPage(pageImage, region, quality = 0.9) {
  const source = pageImage && pageImage.canvas;
  if (!source || !region || !region.pageWidth || !region.pageHeight) return null;
  const sx = Math.max(0, Math.floor((region.left / region.pageWidth) * source.width));
  const sy = Math.max(0, Math.floor((region.top / region.pageHeight) * source.height));
  const ex = Math.min(
    source.width,
    Math.ceil((region.right / region.pageWidth) * source.width)
  );
  const ey = Math.min(
    source.height,
    Math.ceil((region.bottom / region.pageHeight) * source.height)
  );
  const sw = ex - sx;
  const sh = ey - sy;
  if (sw < 24 || sh < 24) return null;
  const cv = document.createElement("canvas");
  cv.width = sw;
  cv.height = sh;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, sw, sh);
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  return { dataUrl: cv.toDataURL("image/jpeg", quality), width: sw, height: sh };
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

// 返回已经配对的 $/$$ 区间。只用于判断 LaTeX 环境是否已经处在数学模式中，
// 不尝试理解公式语义；损坏的孤立定界符会在后续步骤中安全转义。
function balancedDollarRanges(s) {
  const ranges = [];
  let displayOpen = null;
  let inlineOpen = null;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\n" && displayOpen === null) {
      inlineOpen = null; // inline 数学不能合法跨行，不能拿下一行的 $ 误配对
      continue;
    }
    if (s[i] !== "$" || (i > 0 && s[i - 1] === "\\")) continue;
    if (s[i + 1] === "$") {
      if (displayOpen === null) displayOpen = i;
      else {
        ranges.push({ start: displayOpen, end: i + 2, display: true });
        displayOpen = null;
      }
      i++;
      continue;
    }
    if (displayOpen !== null) continue;
    if (inlineOpen === null) inlineOpen = i;
    else {
      ranges.push({ start: inlineOpen, end: i + 1, display: false });
      inlineOpen = null;
    }
  }
  return ranges;
}

function offsetInsideRanges(offset, ranges) {
  return ranges.some((r) => offset > r.start && offset < r.end);
}

// MathJax/Obsidian 不支持论文模型偶尔输出的 tabular 裸环境。把常见环境改成
// 数学模式可接受的形式，并只给“尚未被定界符包住”的环境补上 $$。
function normalizeLatexEnvironments(s) {
  s = s
    .replace(/\\begin\{tabular\}(\{[^{}\n]*\})/g, "\\begin{array}$1")
    .replace(/\\end\{tabular\}/g, "\\end{array}");
  const envRe =
    /\\begin\{(array|aligned|alignedat|gathered|matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|cases|split|equation\*?|align\*?|gather\*?)\}([\s\S]*?)\\end\{\1\}/g;
  // 裸 tabular 常把每个单元格又写成 $...$。整个环境即将进入数学模式，
  // 这些内层定界符必须移除，否则 MathJax 会让整块公式失败。
  s = s.replace(envRe, (whole) => whole.replace(/(?<!\\)\$\$?/g, ""));
  envRe.lastIndex = 0;
  const ranges = balancedDollarRanges(s);
  const replacements = [];
  let m;
  while ((m = envRe.exec(s))) {
    if (offsetInsideRanges(m.index, ranges)) continue;
    const env = m[1];
    const body = m[2];
    let inner = m[0];
    if (/^equation/.test(env)) inner = body;
    else if (/^align/.test(env)) inner = `\\begin{aligned}${body}\\end{aligned}`;
    else if (/^gather/.test(env)) inner = `\\begin{gathered}${body}\\end{gathered}`;
    replacements.push({
      start: m.index,
      end: m.index + m[0].length,
      text: `\n\n$$${inner.trim()}$$\n\n`,
    });
  }
  for (let i = replacements.length - 1; i >= 0; i--) {
    const r = replacements[i];
    s = s.slice(0, r.start) + r.text + s.slice(r.end);
  }
  return s;
}

// 一个坏定界符不应让它后面的整页都进入数学模式。完整的 display 对保留；
// 某行 inline 定界符为奇数时整行全部转义，因为无法可靠猜出哪一个是模型漏写的。
function escapeUnbalancedMathDelimiters(s) {
  const display = [];
  const singlesByLine = new Map();
  let line = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\n") {
      line++;
      continue;
    }
    if (s[i] !== "$" || (i > 0 && s[i - 1] === "\\")) continue;
    if (s[i + 1] === "$") {
      display.push(i);
      i++;
    }
  }
  const displayRanges = [];
  for (let i = 0; i + 1 < display.length; i += 2) {
    displayRanges.push({ start: display[i], end: display[i + 1] + 2 });
  }
  const replacements = [];
  if (display.length % 2 === 1) {
    const p = display[display.length - 1];
    replacements.push({ start: p, length: 2, text: "\\$\\$" });
  }
  line = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\n") {
      line++;
      continue;
    }
    if (s[i] !== "$" || (i > 0 && s[i - 1] === "\\")) continue;
    if (s[i + 1] === "$") {
      i++;
      continue;
    }
    if (displayRanges.some((r) => i > r.start && i < r.end)) continue;
    if (!singlesByLine.has(line)) singlesByLine.set(line, []);
    singlesByLine.get(line).push(i);
  }
  for (const positions of singlesByLine.values()) {
    if (positions.length % 2 === 0) continue;
    for (const p of positions)
      replacements.push({ start: p, length: 1, text: "\\$" });
  }
  replacements.sort((a, b) => b.start - a.start);
  for (const r of replacements) {
    s = s.slice(0, r.start) + r.text + s.slice(r.start + r.length);
  }
  return s;
}

// 模型常返回 \( \) / \[ \] 定界符（Obsidian 只认 $/$$），且相邻独立公式会粘成 $$$$。
// 同时处理裸 LaTeX 环境、latex 代码围栏与孤立定界符，保证单块损坏不会污染后文。
function normalizeMathDelims(s) {
  if (!s) return s;
  s = s.replace(
    /```(?:latex|tex|math)\s*\n?([\s\S]*?)```/gi,
    (_m, t) => `\n\n$$${t.trim()}$$\n\n`
  );
  s = s.replace(/\\\[((?:.|\n)+?)\\\]/g, (_m, t) => `\n\n$$${t}$$\n\n`);
  s = s.replace(/\\\(((?:.|\n)+?)\\\)/g, (_m, t) => `$${t}$`);
  // 相邻 display 公式之间补空行，避免 $$$$ 被解析成奇数个定界符
  // （用函数形式返回：字符串替换里 "$$" 会被解释成字面量单个 $）
  s = s.replace(/\$\$\s*\$\$/g, () => "$$\n\n$$");
  s = normalizeLatexEnvironments(s);
  s = s.replace(/\$\$\s*\$\$/g, () => "$$\n\n$$");
  return escapeUnbalancedMathDelimiters(s);
}

function formatFullTranslationText(s, targetLanguage = "zh-Hans") {
  return formatTextForLanguage(
    normalizeMathDelims(String(s || "")),
    targetLanguage
  );
}

function isFullMarkdownHeading(block, pageNo) {
  if (!block) return false;
  const source = String(block.text || "").trim();
  // 常见目录项是“1 Introduction / 2.3 Method”而不是论文正文的带点罗马数字
  // 标题；只压低这种目录形态，不再把整张第 2 页的真实章节标题一刀切掉。
  if (pageNo === 2 && /^\d+(?:\.\d+)*\s+\S/.test(source)) return false;
  if (block.kind === "title") return source.length <= 220;
  if (block.kind === "heading") {
    // 旧的行分类也会把某些“INTRODUCTION …”短正文标成 heading；过长或带句末
    // 标点的内容仍应按正文渲染，避免一整段被放大成标题。
    return source.length <= 90 && !/[.!?]$/.test(source);
  }
  if (/^(?:Abstract|Introduction|Related Works?|Methods?|Experiments?|Conclusion|References|Appendix)$/i.test(source))
    return true;
  if (/^(?:Question|Takeaway|Finding)\s+\d+\s*[:.]/i.test(source) && source.length <= 100)
    return true;
  const m = source.match(/^(\d+(?:\.\d+)*)\s+(.+)/);
  if (!m || source.length > 90 || /[.!?]$/.test(source)) return false;
  const number = m[1];
  const rest = m[2];
  // 章节编号一般从 1–9 开始；过滤图表刻度、尺寸和纯数值结果。
  if (
    number.startsWith("0") ||
    /[=×<>±%]/.test(rest) ||
    /^\d+(?:[.,]\d+)*(?:\s|$)/.test(rest)
  )
    return false;
  return true;
}

// 全文 Markdown 中的章节标题不应和正文挤成同一种段落。这里把原文版式/编号
// 投影成 Obsidian 标题，目录页仍保持普通文本，避免把整页 TOC 变成一串巨大标题。
function formatFullMarkdownBlock(text, block, pageNo) {
  const t = String(text || "").trim();
  if (block?.kind === "list-item") {
    return `- ${t.replace(/^[•●▪◦‣-]\s*/u, "")}`;
  }
  if (!t || !isFullMarkdownHeading(block, pageNo) || /^#{1,6}\s/.test(t)) return t;
  const source = String(block?.text || "").trim();
  let depth = 1;
  const m = source.match(/^(\d+(?:\.\d+)*|[A-Z](?:\.\d+)*)\s+/);
  if (m) depth = m[1].split(".").length;
  else if (/^(?:Question|Takeaway|Finding)\b/i.test(source)) depth = 2;
  const level = Math.max(3, Math.min(5, 2 + depth));
  return `${"#".repeat(level)} ${t}`;
}

// data:image/jpeg;base64,... → ArrayBuffer（写页面图片附件用）
function dataUrlToBuffer(d) {
  const b64 = d.slice(d.indexOf(",") + 1);
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8.buffer;
}

// ---------- 原文对照 HTML：原页和流式译文分栏；绝不再把中文硬塞进原文 bbox ----------
function buildReplicaHtml(meta, pages) {
  const targetCode = safeLanguageCode(meta.targetLanguage || "zh-Hans");
  const targetInfo = languageInfo(targetCode);
  const sourceCode = safeLanguageCode(meta.sourceLanguage || "auto", true);
  const qualityNotice = languageQualityNotice(sourceCode, targetCode);
  const pgHtml = pages
    .map((p, pageIndex) => {
      const valid = (p.blocks || []).filter((b) => !b.skip && b.zh);
      const markers = valid
        .flatMap((b, blockIndex) => {
          const id = `p${pageIndex + 1}-b${blockIndex + 1}`;
          const rects = b.rects?.length ? b.rects : b.rect ? [b.rect] : [];
          return rects.map(
            (r, rectIndex) =>
              `<span class="source-marker" id="m-${id}-${rectIndex + 1}" data-marker="${id}" aria-hidden="true" ` +
              `style="left:${r.left.toFixed(2)}%;top:${r.top.toFixed(2)}%;` +
              `width:${Math.max(r.width, 0.8).toFixed(2)}%;height:${Math.max(r.height, 0.8).toFixed(2)}%;"></span>`
          );
        })
        .join("");
      let footnoteHeadingShown = false;
      const translated = valid
        .map((b, blockIndex) => {
          const id = `p${pageIndex + 1}-b${blockIndex + 1}`;
          const isFootnote = b.kind === "footnote";
          const footnoteHeading =
            isFootnote && !footnoteHeadingShown
              ? ((footnoteHeadingShown = true),
                `<h3 class="footnote-heading">${escapeHtml(t("html.footnotes"))}</h3>`)
              : "";
          return (
            footnoteHeading +
            `<section class="translation-block${isFootnote ? " footnote-block" : ""}" tabindex="0" data-marker="${id}">` +
            `<button class="locate-source" type="button" title="${escapeHtml(t("html.locate_source_title"))}">${escapeHtml(t("html.locate_source"))}</button>` +
            `<div class="zh">${escapeHtml(b.zh)}</div></section>`
          );
        })
        .join("");
      return (
        `<section class="page-card" data-page="${pageIndex + 1}">` +
        `<header class="page-title"><span>${escapeHtml(t("html.page", { page: pageIndex + 1 }))}</span><span>${escapeHtml(t("html.block_count", { count: valid.length }))}</span></header>` +
        `<div class="page-grid"><div class="source-pane"><div class="source-page">` +
        `<img src="${p.img}" alt="${escapeHtml(t("html.source_alt", { page: pageIndex + 1 }))}" loading="lazy"/>${markers}</div></div>` +
        `<article class="translation-pane">${translated || `<p class="empty">${escapeHtml(t("html.no_translation"))}</p>`}</article>` +
        `</div></section>`
      );
    })
    .join("\n");
  return `<!doctype html>
<html lang="${escapeHtml(targetInfo.locale || targetCode)}" dir="${targetInfo.dir || "ltr"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(meta.title)}</title>
<script>window.MathJax={tex:{inlineMath:[["$","$"],["\\\\(","\\\\)"]],displayMath:[["$$","$$"],["\\\\[","\\\\]"]],processEscapes:true},chtml:{matchFontHeight:false}};</script>
<script defer src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js" onerror="document.documentElement.classList.add('math-failed')"></script>
<style>
*{box-sizing:border-box;}
:root{color-scheme:light;--paper:#fff;--ink:#20242b;--muted:#6b7280;--line:#dfe3e8;--accent:#3976d2;--bg:#eef1f4;}
body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif;}
.toolbar{position:sticky;top:0;z-index:99;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 16px;background:rgba(31,35,41,.96);color:#f4f5f6;font-size:13px;box-shadow:0 1px 8px rgba(0,0,0,.28);backdrop-filter:blur(10px);}
.toolbar strong{font-size:14px;margin-right:8px;max-width:32vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.toolbar label{cursor:pointer;display:flex;align-items:center;gap:5px;margin-left:6px;}
.toolbar button{border:1px solid #5b626c;background:transparent;color:#f3f4f6;border-radius:7px;padding:5px 11px;cursor:pointer;font-size:13px;}
.toolbar button:hover,.toolbar button.active{background:var(--accent);border-color:var(--accent);}
.toolbar .hint{color:#b8bec7;margin-left:auto;}
.math-warning{display:none;margin:12px auto 0;width:min(1480px,calc(100% - 28px));padding:10px 14px;border:1px solid #efb34f;border-radius:8px;background:#fff7e6;color:#7a4b00;font-size:13px;}
.math-failed .math-warning{display:block;}
.document{width:min(1500px,calc(100% - 28px));margin:18px auto 44px;}
.page-card{margin:0 0 26px;background:var(--paper);border:1px solid var(--line);border-radius:12px;box-shadow:0 5px 20px rgba(37,46,58,.09);overflow:clip;}
.page-title{display:flex;justify-content:space-between;gap:12px;padding:10px 16px;border-bottom:1px solid var(--line);background:#fafbfc;color:var(--muted);font-size:12px;letter-spacing:.02em;}
.page-grid{display:grid;grid-template-columns:minmax(360px,.95fr) minmax(430px,1.05fr);align-items:start;}
.source-pane{position:sticky;top:58px;padding:16px;background:#e7eaee;border-right:1px solid var(--line);}
.source-page{position:relative;margin:auto;max-width:760px;background:#fff;box-shadow:0 2px 12px rgba(18,25,33,.16);}
.source-page>img{display:block;width:100%;height:auto;}
.source-marker{position:absolute;display:block;pointer-events:none;border:2px solid transparent;border-radius:3px;background:transparent;transition:border-color .14s,background .14s,box-shadow .14s;}
.source-marker.active{border-color:var(--accent);background:rgba(57,118,210,.12);box-shadow:0 0 0 3px rgba(57,118,210,.12);}
.translation-pane{min-width:0;padding:18px clamp(20px,3vw,42px) 34px;}
.translation-block{position:relative;padding:11px 2px 15px;border-bottom:1px solid #edf0f2;outline:none;}
.translation-block:last-child{border-bottom:0;}
.translation-block:focus,.translation-block:hover{background:linear-gradient(90deg,rgba(57,118,210,.055),transparent 72%);}
.translation-block .zh{font-family:Georgia,"Times New Roman","Noto Serif",serif;font-size:clamp(16px,1.18vw,18px);line-height:1.9;letter-spacing:.006em;text-indent:1.35em;white-space:pre-wrap;overflow-wrap:anywhere;text-align:start;}
body.script-cjk .translation-block .zh{font-family:"Noto Serif CJK SC","Source Han Serif SC","Songti SC",SimSun,serif;letter-spacing:.012em;text-indent:2em;}
body.script-hangul .translation-block .zh{font-family:"Noto Serif KR","Nanum Myeongjo",serif;text-indent:1em;}
body.script-indic .translation-block .zh,body.script-seasia .translation-block .zh{font-family:"Noto Serif","Nirmala UI","Leelawadee UI",serif;line-height:2;text-indent:1em;}
body.script-rtl .translation-block .zh{direction:rtl;text-align:right;font-family:"Noto Naskh Arabic","Noto Sans Arabic","Segoe UI",serif;line-height:2;text-indent:1.4em;}
.footnote-heading{margin:28px 0 4px;padding:15px 10px 0;border-top:1px solid var(--line);font-size:13px;font-weight:650;color:var(--muted);letter-spacing:.04em;}
.translation-block.footnote-block{margin:0 8px;padding:9px 10px 12px;border-bottom-color:#e4e8ed;background:#f8fafc;border-radius:6px;}
.translation-block.footnote-block .zh{font-size:clamp(14px,1vw,16px);line-height:1.75;color:#4f5661;}
.locate-source{float:right;margin:0 0 4px 10px;border:0;background:transparent;color:var(--muted);font-size:11px;padding:3px 5px;border-radius:4px;cursor:pointer;opacity:.42;}
.translation-block:hover .locate-source,.translation-block:focus-within .locate-source{opacity:1;color:var(--accent);background:rgba(57,118,210,.08);}
.empty{color:var(--muted);text-align:center;padding:40px 12px;}
body.editing .translation-block .zh{outline:1px dashed var(--accent);outline-offset:5px;border-radius:2px;cursor:text;}
mjx-container[display="true"]{display:block;max-width:100%!important;overflow-x:auto;overflow-y:hidden;margin:1em 0!important;padding:.7em .8em;background:#f8fafc;border-radius:7px;}
body.original-only .translation-pane{display:none;}
body.original-only .page-grid{display:block;}
body.original-only .source-pane{position:relative;top:auto;border-right:0;padding:18px;}
body.original-only .source-page{max-width:980px;}
@media(max-width:980px){
 .toolbar .hint{display:none;}
 .document{width:min(100% - 14px,820px);margin-top:8px;}
 .page-grid{display:block;}
 .source-pane{position:relative;top:auto;border-right:0;border-bottom:1px solid var(--line);padding:10px;}
 .translation-pane{padding:12px 18px 26px;}
 .translation-block .zh{font-size:16px;line-height:1.82;}
}
@media print{
 body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
 .toolbar{display:none;}
 .math-warning{display:none!important;}
 .document{width:100%;margin:0;}
 .page-card{margin:0 0 8mm;border:0;border-radius:0;box-shadow:none;break-after:page;overflow:visible;}
 .source-pane{position:relative;top:auto;}
 .locate-source{display:none;}
}
@page{size:auto;margin:8mm;}
</style>
</head>
<body class="script-${escapeHtml(targetInfo.script || "other")}">
<div class="toolbar">
 <strong>${escapeHtml(meta.title)}</strong>
 <button id="tCompare" class="active" type="button">${escapeHtml(t("html.compare"))}</button>
 <button id="tOriginal" type="button">${escapeHtml(t("html.original_only"))}</button>
 <label><input type="checkbox" id="tEdit"> ${escapeHtml(t("html.edit_translation"))}</label>
 <button id="tSave">${escapeHtml(t("html.save_changes"))}</button>
 <span class="hint">${escapeHtml(t("html.hint"))}</span>
</div>
<div class="math-warning">${escapeHtml(t("html.math_warning"))}</div>
${qualityNotice ? `<div class="math-warning" style="display:block">${escapeHtml(qualityNotice)}</div>` : ""}
<main class="document">${pgHtml}</main>
<script>
var compare=document.getElementById("tCompare"),original=document.getElementById("tOriginal");
var setMode=function(onlyOriginal){
 document.body.classList.toggle("original-only",onlyOriginal);
 compare.classList.toggle("active",!onlyOriginal);original.classList.toggle("active",onlyOriginal);
 compare.setAttribute("aria-pressed",String(!onlyOriginal));original.setAttribute("aria-pressed",String(onlyOriginal));
};
var clearMarkers=function(){document.querySelectorAll(".source-marker.active").forEach(function(m){m.classList.remove("active");});};
compare.addEventListener("click",function(){setMode(false);});
original.addEventListener("click",function(){clearMarkers();setMode(true);});
document.querySelectorAll(".translation-block").forEach(function(block){
 var getMarkers=function(){return document.querySelectorAll('.source-marker[data-marker="'+block.dataset.marker+'"]');};
 var show=function(){clearMarkers();getMarkers().forEach(function(m){m.classList.add("active");});};
 block.addEventListener("mouseenter",show);block.addEventListener("focusin",show);
 block.addEventListener("mouseleave",clearMarkers);block.addEventListener("focusout",clearMarkers);
 var locate=block.querySelector(".locate-source");
 if(locate)locate.addEventListener("click",function(e){e.preventDefault();show();var m=getMarkers()[0];if(m)m.scrollIntoView({block:"center",behavior:"smooth"});});
});
document.getElementById("tEdit").addEventListener("change",function(){
 document.body.classList.toggle("editing",this.checked);
 document.querySelectorAll(".translation-block .zh").forEach(function(z){z.contentEditable=this.checked?"true":"false";},this);
});
document.getElementById("tSave").addEventListener("click",function(){
 document.body.classList.remove("editing","original-only");clearMarkers();setMode(false);
 document.getElementById("tEdit").checked=false;
 document.querySelectorAll(".translation-block .zh").forEach(function(z){z.removeAttribute("contenteditable");});
 var html="<!doctype html>\\n"+document.documentElement.outerHTML;
 var name=document.title.replace(/[\\\\/:*?\\"<>|]/g,"_")+".html";
 if(window.showSaveFilePicker){
  window.showSaveFilePicker({suggestedName:name}).then(function(h){return h.createWritable().then(function(w){w.write(html);return w.close();});}).then(function(){alert(${JSON.stringify(t("html.saved"))});});
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
    contentEl.createEl("h3", { text: t("full.confirm_title") });
    const grid = contentEl.createDiv();
    grid.style.lineHeight = "1.9";
    grid.style.fontSize = "var(--font-ui-small)";
    for (const l of [
      t("full.document", { file: this.info.fileName, pages: this.info.pages }),
      t("full.blocks", { blocks: this.info.transN }),
      t("full.requests", {
        tokens: fmtTok(this.info.tokensEst || 0),
        requests: this.info.chunks,
      }),
      t("full.eta", { eta: this.info.eta }),
      t("full.provider", { source: this.info.source }),
      this.plugin.settings.fullHtml
        ? t("full.output_html")
        : t("full.output_markdown"),
    ]) {
      grid.createDiv({ text: l });
    }
    const qualityNotice = languageQualityNotice(
      this.info.sourceLanguage,
      this.info.targetLanguage
    );
    if (qualityNotice) {
      grid.createDiv({
        cls: "mini-language-settings-notice",
        text: qualityNotice,
      });
    }
    const btns = contentEl.createDiv();
    btns.style.display = "flex";
    btns.style.gap = "8px";
    btns.style.marginTop = "14px";
    const start = btns.createEl("button", {
      text: t("full.start"),
      cls: "mod-cta",
    });
    start.onclick = () => {
      this.close();
      void this.plugin
        .runFullTranslate(this.info)
        .catch((error) =>
          this.plugin.reportFullTranslateFailure(error, this.info)
        );
    };
    const cancel = btns.createEl("button", { text: t("common.cancel") });
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
    contentEl.createEl("h3", { text: t("full.pick_title") });
    const search = contentEl.createEl("input", { type: "text" });
    search.placeholder = t("full.search_files");
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
      text: t("full.start"),
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
      void this.plugin
        .runPickedTranslate(jobs)
        .catch((error) => this.plugin.reportFullTranslateFailure(error));
    };
    const cancelBtn = btns.createEl("button", { text: t("common.cancel") });
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
          if (!chars) throw new Error(t("full.no_text_layer"));
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
          const msg = String(e?.message || e || t("common.unknown_error")).slice(0, 60);
          this.failed.set(
            p,
            /无文本层|No text layer/i.test(e.message || "")
              ? t("full.scanned_no_text")
              : t("full.parse_failed", { message: msg })
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
      span.setText(t("full.calculating"));
      return;
    }
    const s = this.statsCache.get(path);
    if (!s) return;
    span.setText(t("full.file_stats", {
      pages: s.pages,
      blocks: s.blocksN,
      tokens: fmtTok(s.tokensEst),
    }));
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
    const parts = [t("full.selected_files", { count: n })];
    parts.push(t("full.characters", { count: fmtTok(chars) }));
    parts.push(`≈${fmtTok(tokens)} tokens`);
    parts.push(t("full.request_count", { count: reqs }));
    if (n)
      parts.push(
        prof
          ? t("full.estimate_minutes", {
              minutes: Math.max(1, Math.ceil((reqs * 3.5) / 60)),
            })
          : t("full.estimate_under_minute")
      );
    const pend = Array.from(this.pending).filter((p) => this.selected.has(p));
    if (pend.length) {
      parts.push(t("full.calculating_count", { count: pend.length }));
    }
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
    this.configType = "llm";
    this.editing = -1;
    this.draft = null;
    this._draftSaving = false;
    this._modelQuerying = false;
  }
  onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass("mini-llm-modal");
    this.render();
  }
  onClose() {
    // 关闭窗口只丢弃未确认的新建草稿；已有配置在编辑时仍按原逻辑即时保存。
    this.draft = null;
    this.editing = -1;
    // 关闭管理弹窗后，面板立即反映配置变更（新源、改名、删源等）
    this.plugin.refreshPanel();
  }
  render() {
    const c = this.contentEl;
    c.empty();
    c.createEl("h3", { text: t("config.title") });
    new Setting(c)
      .setName(t("config.type"))
      .setDesc(t("config.type_desc"))
      .addDropdown((dd) => {
        dd.addOption("llm", t("config.llm_type"));
        dd.addOption("bing", "Bing / Microsoft Translator");
        dd.addOption("cnki", t("config.cnki_type"));
        dd.setValue(this.configType).onChange((value) => {
          this.configType = value;
          this.editing = -1;
          this.draft = null; // 切换服务类型等同取消尚未确认的新建草稿
          this.render();
        });
      });
    if (this.configType !== "llm") {
      this.renderBuiltinConfig();
      return;
    }
    if (this.draft) {
      this.renderEdit(-1, this.draft);
      return;
    }
    if (this.editing >= 0) {
      this.renderEdit(this.editing);
      return;
    }
    const list = this.plugin.settings.llmProfiles || [];
    c.createEl("div", {
      text: t("config.intro"),
      cls: "setting-item-description",
    }).style.marginBottom = "12px";
    if (list.length === 0) {
      c.createEl("div", {
        text: t("config.empty"),
        cls: "setting-item-description",
      });
    }
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const row = c.createDiv();
      row.style.cssText =
        "display:flex;align-items:center;gap:10px;margin-bottom:6px;padding:6px 8px;border:1px solid var(--background-modifier-border);border-radius:8px;";
      row.createSpan({ text: p.name }).style.flex = "1";
      row.createSpan({
        text: t("config.model_count", { count: (p.models || []).length }),
        cls: "setting-item-description",
      });
      const editBtn = row.createEl("button", { text: t("common.edit") });
      editBtn.onclick = () => {
        this.editing = i;
        this.render();
      };
      const delBtn = row.createEl("button", { text: t("common.delete") });
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
    dd.addOption("", t("config.choose_preset"));
    for (const pr of LLM_PRESETS) {
      dd.addOption("p:" + pr.name, providerName(pr.name));
    }
    dd.addOption("blank", t("config.blank"));
    dd.onChange((v) => {
      if (!v) return;
      let entry;
      if (v === "blank") {
        entry = {
          name: t("config.new_name"),
          url: "",
          apiKey: "",
          models: [],
          activeModel: "",
        };
      } else {
        const pr = LLM_PRESETS.find((x) => "p:" + x.name === v);
        entry = {
          name: providerName(pr.name),
          url: pr.url,
          apiKey: "",
          models: [...pr.models],
          activeModel: pr.models[0],
        };
      }
      // 选择预设仅创建内存草稿。只有表单中的「确定创建」才会写入 data.json；
      // 取消、切换配置类型或直接关闭弹窗都不会留下半成品配置。
      this.draft = entry;
      this.editing = -1;
      this.render();
    });
  }
  renderBuiltinConfig() {
    const c = this.contentEl;
    const settings = this.plugin.settings;
    // 只移动配置表单，保留原字段与请求行为；切换类型不会清空已有凭据。
    if (this.configType === "bing") {
      new Setting(c)
        .setName("Azure Translator Key")
        .setDesc(t("config.azure_desc"))
        .addText((text) => {
          text.inputEl.type = "password";
          text
            .setPlaceholder(t("config.azure_placeholder"))
            .setValue(settings.bingApiKey || "")
            .onChange(async (value) => {
              settings.bingApiKey = value.trim();
              await this.plugin.saveData(settings);
            });
        });
      new Setting(c)
        .setName(t("config.bing_region"))
        .setDesc(t("config.bing_region_desc"))
        .addText((text) =>
          text
            .setPlaceholder(t("config.region_placeholder"))
            .setValue(settings.bingRegion || "")
            .onChange(async (value) => {
              settings.bingRegion = value.trim();
              await this.plugin.saveData(settings);
            })
        );
    } else if (this.configType === "cnki") {
      new Setting(c)
        .setName("CNKI Token")
        .setDesc(t("config.cnki_desc"))
        .addText((text) => {
          text.inputEl.type = "password";
          text
            .setPlaceholder(t("config.cnki_placeholder"))
            .setValue(settings.cnkiToken || "")
            .onChange(async (value) => {
              settings.cnkiToken = value.trim();
              await this.plugin.saveData(settings);
            });
        });
    }
  }
  renderEdit(idx, draft = null) {
    const c = this.contentEl;
    const list = this.plugin.settings.llmProfiles || [];
    const creating = !!draft;
    const p = creating ? draft : list[idx];
    if (!p) {
      this.editing = -1;
      this.draft = null;
      this.render();
      return;
    }
    if (!Array.isArray(p.models)) p.models = [];
    if (!creating) {
      const back = c.createEl("button", { text: t("common.back") });
      back.onclick = () => {
        this.editing = -1;
        this.render();
      };
    }
    c.createEl("h4", {
      text: creating
        ? t("config.create_title", {
            name: p.name || t("config.unnamed"),
          })
        : t("config.edit_title", { name: p.name }),
    }).style.marginTop = "10px";

    new Setting(c)
      .setName(t("config.name"))
      .addText((t) =>
        t.setValue(p.name).onChange(async (v) => {
          const old = p.name;
          const next = v.trim();
          p.name = creating ? next : next || p.name;
          if (creating) return;
          if (this.plugin.settings.primarySource === old) {
            this.plugin.settings.primarySource = p.name;
          }
          await this.plugin.saveData(this.plugin.settings);
        })
      );
    new Setting(c)
      .setName(t("config.endpoint"))
      .setDesc(t("config.endpoint_desc"))
      .addText((t) =>
        t
          .setPlaceholder("https://api.deepseek.com/chat/completions")
          .setValue(p.url || "")
          .onChange(async (v) => {
            p.url = v.trim();
            if (!creating) await this.plugin.saveData(this.plugin.settings);
          })
      );
    new Setting(c)
      .setName("API Key")
      .setDesc(t("config.api_key_desc"))
      .addText((t) => {
        t.inputEl.type = "password";
        t.setPlaceholder("sk-...")
          .setValue(p.apiKey || "")
          .onChange(async (v) => {
            p.apiKey = v.trim();
            if (!creating) await this.plugin.saveData(this.plugin.settings);
          });
      });

    new Setting(c)
      .setName(t("config.default_model"))
      .setDesc(t("config.default_model_desc"))
      .addDropdown((dd) => {
        for (const m of p.models || []) dd.addOption(m, m);
        dd.setValue(p.activeModel || (p.models && p.models[0]) || "");
        dd.onChange(async (v) => {
          p.activeModel = v;
          if (!creating) await this.plugin.saveData(this.plugin.settings);
        });
      })
      .addButton((b) =>
        b.setButtonText(t("config.query_models")).setCta().onClick(async () => {
          if (this._modelQuerying) return;
          this._modelQuerying = true;
          b.setButtonText(t("config.querying"));
          if (b.buttonEl) b.buttonEl.disabled = true;
          try {
            const list2 = await fetchModels(p.url, p.apiKey);
            if (!Array.isArray(p.models)) p.models = [];
            for (const m of list2) if (!p.models.includes(m)) p.models.push(m);
            if (!p.activeModel) p.activeModel = p.models[0];
            if (!creating) await this.plugin.saveData(this.plugin.settings);
            new Notice(t("config.models_received", { count: list2.length }), 2000);
          } catch (e) {
            new Notice(t("config.query_failed", { message: e.message }), 6000);
          } finally {
            this._modelQuerying = false;
            // render() 会先 empty 根容器，再重建当前编辑页。不能直接调用
            // renderEdit()，否则每查询一次都会把一整套表单追加到旧表单后面。
            this.render();
          }
        })
      );

    let modelInput = null;
    new Setting(c)
      .setName(t("config.add_model"))
      .addText((t) => {
        t.setPlaceholder(I18N.t("config.model_placeholder"));
        t.inputEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            const v = t.inputEl.value.trim();
            if (v && !p.models.includes(v)) {
              p.models.push(v);
              p.activeModel = v;
              if (!creating) void this.plugin.saveData(this.plugin.settings);
            }
            this.render();
          }
        });
        modelInput = t;
      })
      .addButton((b) =>
        b.setButtonText(t("common.add")).onClick(() => {
          const v = modelInput && modelInput.inputEl.value.trim();
          if (v && !p.models.includes(v)) {
            p.models.push(v);
            p.activeModel = v;
            if (!creating) void this.plugin.saveData(this.plugin.settings);
          }
          this.render();
        })
      )
      .addButton((b) =>
        b.setButtonText(t("config.remove_default")).onClick(async () => {
          const cur = p.activeModel || (p.models && p.models[0]);
          if (!cur) return;
          p.models = (p.models || []).filter((m) => m !== cur);
          p.activeModel = p.models[0] || "";
          if (!creating) await this.plugin.saveData(this.plugin.settings);
          this.render();
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
          if (!creating) await this.plugin.saveData(this.plugin.settings);
          this.render();
        };
      }
    }
    if (creating) {
      const actions = c.createDiv();
      actions.style.cssText =
        "display:flex;gap:8px;justify-content:flex-end;margin-top:16px;";
      const cancel = actions.createEl("button", { text: t("common.cancel") });
      cancel.onclick = () => {
        if (this._draftSaving) return;
        this.draft = null;
        this.editing = -1;
        this.render();
      };
      const confirm = actions.createEl("button", {
        text: t("config.confirm_create"),
        cls: "mod-cta",
      });
      confirm.onclick = async () => {
        if (this._draftSaving || this.draft !== p) return;
        const name = String(p.name || "").trim();
        const url = String(p.url || "").trim();
        const models = [
          ...new Set((p.models || []).map((m) => String(m).trim()).filter(Boolean)),
        ];
        if (!name) {
          new Notice(t("config.name_required"), 3000);
          return;
        }
        if (!url) {
          new Notice(t("config.url_required"), 3000);
          return;
        }
        if (!models.length) {
          new Notice(t("config.model_required"), 3500);
          return;
        }
        const nameKey = name.toLocaleLowerCase();
        if (list.some((item) => String(item.name || "").trim().toLocaleLowerCase() === nameKey)) {
          new Notice(t("config.duplicate_name"), 3500);
          return;
        }
        if (ENGINES.some((engine) => engine.name.toLocaleLowerCase() === nameKey)) {
          new Notice(t("config.reserved_name"), 3500);
          return;
        }
        const activeModel = models.includes(p.activeModel)
          ? p.activeModel
          : models[0];
        const saved = {
          name,
          url,
          apiKey: String(p.apiKey || "").trim(),
          models,
          activeModel,
        };
        this._draftSaving = true;
        confirm.disabled = true;
        cancel.disabled = true;
        const nextProfiles = [...list, saved];
        try {
          // 先把完整候选设置写盘，成功后再替换内存列表；写入失败不会留下半成品。
          await this.plugin.saveData({
            ...this.plugin.settings,
            llmProfiles: nextProfiles,
          });
        } catch (error) {
          new Notice(
            t("config.create_failed", { message: error?.message || error }),
            6000
          );
          confirm.disabled = false;
          cancel.disabled = false;
          this._draftSaving = false;
          return;
        }
        this._draftSaving = false;
        this.plugin.settings.llmProfiles = nextProfiles;
        this.draft = null;
        this.editing = -1;
        new Notice(t("config.created", { name }), 2000);
        this.plugin.refreshPanel();
        this.render();
      };
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
    const btn = this.contentEl.createEl("button", { text: t("common.confirm") });
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

async function llmRequest(
  text,
  profile,
  systemPrompt,
  from = "auto",
  to = "zh-Hans"
) {
  const model = profile.activeModel || (profile.models && profile.models[0]);
  if (!model) throw new Error(t("config.no_model"));
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
          content: systemPrompt || buildTranslatePrompt(from, to),
        },
        { role: "user", content: text },
      ],
    }),
  });
  checkStatus(res, providerName("大模型"));
  const data = res.json;
  const choice = data?.choices?.[0];
  // 只拦截服务明确报告的不完整输出，兼容不返回 finish_reason 的接口。
  if (choice?.finish_reason === "length") {
    throw new Error(t("config.model_truncated"));
  }
  if (choice?.finish_reason === "content_filter") {
    throw new Error(t("config.content_filtered"));
  }
  const out = cleanLlmOutput(
    llmContentToText(choice?.message?.content ?? choice?.text)
  );
  if (!out) {
    throw new Error(t("config.empty_result", {
      message: data?.error?.message || JSON.stringify(data).slice(0, 200),
    }));
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
  { name: "Bing", fn: bingTranslate },
  { name: "CNKI", fn: cnkiTranslate },
];

// 翻译源下拉选项 = 内置引擎 + 每个大模型配置（配置即源）
function engineOptions() {
  return [
    ...ENGINES.map((e) => e.name),
    ...profileNames().filter((n) => !ENGINES.some((e) => e.name === n)),
  ];
}

async function translateSentence(
  text,
  primary,
  from = "auto",
  to = "zh-Hans"
) {
  from = safeLanguageCode(from, true);
  to = safeLanguageCode(to);
  if (from !== "auto" && from === to) {
    throw new Error(t("translation.same_language"));
  }
  // 所有句子/段落翻译源共用同一份重排后的输入，避免 PDF 硬换行或断词被源服务误当成独立单词。
  text = normalizeTranslationInput(text, from);
  // 数学公式先替换成占位符，任何引擎都不会翻坏，返回后再还原
  const { text: safeText, map } = protectMath(text);
  // 若选中的是某个大模型配置，直接用该配置翻译（不回退到免费源，避免隐性切换）
  const prof = findProfile(primary);
  if (prof) {
    const translated = await llmRequest(
      safeText,
      prof,
      buildTranslatePrompt(from, to),
      from,
      to
    );
    return {
      text: restoreMath(translated, map),
      via: prof.name,
      detectedLanguage: from === "auto" ? inferLayoutLanguage(text) : from,
    };
  }
  const order = [
    primary,
    ...ENGINES.map((e) => e.name).filter((n) => n !== primary),
  ];
  const errors = [];
  for (const name of order) {
    const engine = ENGINES.find((e) => e.name === name);
    if (!engine || !engineSupportsPair(name, from, to)) continue;
    try {
      const raw = normalizeEngineResult(
        await engine.fn(safeText, from, to),
        from === "auto" ? "" : from
      );
      return {
        text: restoreMath(raw.text, map),
        via: name,
        detectedLanguage: raw.detectedLanguage,
      };
    } catch (e) {
      errors.push(`${providerName(name)}: ${e.message || e}`);
      console.log(`[mini-translator] ${name} 失败:`, e.message || e);
    }
  }
  const detail = errors.length
    ? getUiLanguage() === "en"
      ? ` (${errors.slice(0, 3).join("; ")})`
      : `（${errors.slice(0, 3).join("；")}）`
    : "";
  throw new Error(t("translation.no_source", {
    pair: languagePairLabel(from, to),
    detail,
  }));
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

    // 语言对独立成一行，窄侧边栏里仍能一眼看清“原文 → 译文”。
    this.languageRow = this.contentEl.createDiv({ cls: "mini-language-row" });
    this.sourceLanguageDropdown = new DropdownComponent(this.languageRow);
    for (const lang of languageOptions(true)) {
      this.sourceLanguageDropdown.addOption(lang.code, lang.label);
    }
    this.sourceLanguageDropdown
      .setValue(this.plugin.settings.sourceLanguage)
      .onChange(async (value) => {
        this.plugin.settings.sourceLanguage = safeLanguageCode(value, true);
        if (
          this.plugin.settings.sourceLanguage !== "auto" &&
          this.plugin.settings.sourceLanguage === this.plugin.settings.targetLanguage
        ) {
          this.plugin.settings.targetLanguage =
            this.plugin.settings.sourceLanguage.startsWith("zh") ? "en" : "zh-Hans";
        }
        await this.plugin.saveData(this.plugin.settings);
        this.plugin.refreshPanel();
        this.refreshLanguageNotice();
      });
    this.languageRow.createSpan({
      text: "→",
      cls: "mini-language-arrow",
      attr: { "aria-hidden": "true" },
    });
    this.targetLanguageDropdown = new DropdownComponent(this.languageRow);
    for (const lang of languageOptions(false)) {
      this.targetLanguageDropdown.addOption(lang.code, lang.label);
    }
    this.targetLanguageDropdown
      .setValue(this.plugin.settings.targetLanguage)
      .onChange(async (value) => {
        this.plugin.settings.targetLanguage = safeLanguageCode(value);
        if (this.plugin.settings.sourceLanguage === this.plugin.settings.targetLanguage) {
          this.plugin.settings.sourceLanguage = "auto";
        }
        await this.plugin.saveData(this.plugin.settings);
        this.plugin.refreshPanel();
        this.refreshLanguageNotice();
      });
    this.languageNoticeEl = this.contentEl.createDiv({
      cls: "mini-language-notice",
    });
    this.refreshLanguageNotice();

    const header = this.contentEl.createDiv({ cls: "mini-panel-header" });
    header.createSpan({ text: t("panel.provider"), cls: "mini-label" });
    this.sourceDropdown = new DropdownComponent(header);
    for (const eng of ENGINES) {
      this.sourceDropdown.addOption(eng.name, providerName(eng.name));
    }
    this.sourceDropdown
      .setValue(this.plugin.settings.primarySource)
      .onChange(async (v) => {
        this.plugin.settings.primarySource = v;
        await this.plugin.saveData(this.plugin.settings);
        this.updateModelRow();
      });
    // 词典源下拉
    header.createSpan({ text: t("panel.dictionary"), cls: "mini-label" });
    this.dictDropdown = new DropdownComponent(header);
    for (const d of dictOptions()) this.dictDropdown.addOption(d, providerName(d));
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
    this.modelRow.createSpan({ text: t("panel.model"), cls: "mini-label" });
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
      text: t("panel.copy_translation"),
      cls: "mini-copy-btn",
    });
    this.copyBtn.onclick = async () => {
      if (!this.lastResult) return;
      await navigator.clipboard.writeText(this.lastResult);
      new Notice(t("common.copied"), 1500);
    };

    // 全文翻译不再只藏在命令面板；入口收进一条轻量工具条，避免大按钮打断面板主内容。
    this.panelActions = this.contentEl.createDiv({ cls: "mini-panel-actions" });
    const fullTranslateLabel = this.panelActions.createDiv({
      cls: "mini-panel-actions-title",
    });
    const fullTranslateIcon = fullTranslateLabel.createSpan({
      cls: "mini-panel-actions-icon",
    });
    setIcon(fullTranslateIcon, "files");
    fullTranslateLabel.createSpan({ text: t("panel.full_pdf") });
    this.fullTranslateBtn = this.panelActions.createEl("button", {
      text: t("common.current"),
      cls: "mini-full-translate-btn",
      attr: { title: t("panel.current_title") },
    });
    this.fullTranslateBtn.onclick = () => this.plugin.fullTranslateFlow();
    this.fullTranslatePickBtn = this.panelActions.createEl("button", {
      text: t("common.choose"),
      cls: "mini-full-translate-btn",
      attr: { title: t("panel.pick_title") },
    });
    this.fullTranslatePickBtn.onclick = () =>
      new FilePickTranslateModal(this.app, this.plugin).open();

    this.flowEl = this.contentEl.createDiv({ cls: "mini-flow" });
    this.metaEl = this.contentEl.createDiv({ cls: "mini-meta" });

    // 翻译历史：默认收起（不常驻），点时钟小图标展开；
    // 条目显示 时间·翻译源，文件/页码藏在详情小图标里
    this.histOpen = false;
    this.histBar = this.contentEl.createDiv({ cls: "mini-hist-bar" });
    this.histToggleBtn = this.histBar.createEl("span", {
      cls: "mini-icon-btn",
      attr: {
        "aria-label": t("panel.history"),
        title: t("panel.history"),
      },
    });
    setIcon(this.histToggleBtn, "history");
    this.histToggleBtn.onclick = () => this.toggleHistory();
    this.histClearBtn = this.histBar.createEl("span", {
      cls: "mini-icon-btn",
      attr: {
        "aria-label": t("panel.clear_history"),
        title: t("panel.clear_history"),
      },
    });
    setIcon(this.histClearBtn, "trash-2");
    this.histClearBtn.onclick = async () => {
      this.plugin.settings.history = [];
      await this.plugin.saveData(this.plugin.settings);
      this.renderHistory();
      new Notice(t("panel.history_cleared"), 1500);
    };
    this.histListEl = this.contentEl.createDiv({ cls: "mini-hist-list" });
    this.refreshHistoryCount();

    this.emptyEl = this.contentEl.createDiv({
      cls: "mini-empty",
      text: t("panel.placeholder"),
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
    const from = pairs[0]?.sourceLanguage || this.plugin.settings.sourceLanguage;
    const to = pairs[0]?.targetLanguage || this.plugin.settings.targetLanguage;
    const detected = pairs.find((p) => p.detectedLanguage)?.detectedLanguage || "";
    const suffix = needsAiOnlyDisclaimer(from, to, detected)
      ? ` · ${t("panel.ai_tested")}`
      : "";
    this.metaEl.setText(
      `${languagePairLabel(from, to, true)}${meta ? ` · ${meta}` : ""}${suffix}`
    );
    this.lastResult = pairs
      .map((p) =>
        formatTextForLanguage(p.zh, p.targetLanguage || to, {
          dictionary: !!p.dict,
        })
      )
      .join("\n\n");
  }

  refreshLanguageNotice() {
    if (!this.languageNoticeEl) return;
    const from = this.plugin.settings.sourceLanguage;
    const to = this.plugin.settings.targetLanguage;
    const visible = from === "auto" || needsAiOnlyDisclaimer(from, to);
    this.languageNoticeEl.setText(
      visible
        ? from === "auto" && !needsAiOnlyDisclaimer(from, to)
          ? t("language.auto_notice")
          : t("language.ai_only_notice")
        : ""
    );
    this.languageNoticeEl.toggleClass("is-visible", visible);
  }
  // 每次同步重建选项，确保设置页/管理弹窗里的改动立即反映到面板
  syncSource() {
    if (this.sourceDropdown) {
      this.sourceDropdown.selectEl.empty();
      for (const n of engineOptions()) {
        this.sourceDropdown.addOption(n, providerName(n));
      }
      this.sourceDropdown.setValue(this.plugin.settings.primarySource);
    }
    if (this.dictDropdown) {
      this.dictDropdown.selectEl.empty();
      for (const d of dictOptions()) {
        this.dictDropdown.addOption(d, providerName(d));
      }
      this.dictDropdown.setValue(this.plugin.settings.dictSource);
    }
    if (this.sourceLanguageDropdown) {
      this.sourceLanguageDropdown.setValue(this.plugin.settings.sourceLanguage);
    }
    if (this.targetLanguageDropdown) {
      this.targetLanguageDropdown.setValue(this.plugin.settings.targetLanguage);
    }
    this.refreshLanguageNotice();
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
    this.histToggleBtn.setAttribute(
      "aria-label",
      t("panel.history_count", { count: n })
    );
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
        text: t("panel.no_history"),
      });
      return;
    }
    for (let i = 0; i < list.length; i++) {
      const h = list[i];
      const item = this.histListEl.createDiv({ cls: "mini-hist-item" });
      const head = item.createDiv({ cls: "mini-hist-head" });
      head.createSpan({
        cls: "mini-hist-src",
        text: `${fmtHistTime(h.ts)} · ${providerName(h.via)}`,
        attr: {
          title: t("panel.provider_title", { source: providerName(h.via) }),
        },
      });
      // 详情小图标：展开 文件/页码 来源信息（不常驻）
      const info = head.createEl("span", {
        cls: "mini-icon-btn",
        attr: { title: t("panel.source_details") },
      });
      setIcon(info, "file-text");
      const del = head.createEl("span", {
        cls: "mini-icon-btn",
        attr: { title: t("panel.delete_history") },
      });
      setIcon(del, "x");
      const preview = item.createDiv({ cls: "mini-hist-prev" });
      const firstZh = (h.pairs && h.pairs[0] && h.pairs[0].zh) || "";
      preview.setText(firstZh.replace(/\n/g, " ").slice(0, 60));
      const detail = item.createDiv({ cls: "mini-hist-detail" });
      detail.style.display = "none";
      const locale = getUiLanguage() === "en" ? "en" : "zh-CN";
      const lines = [
        t("panel.time", { time: new Date(h.ts).toLocaleString(locale) }),
      ];
      if (h.file) lines.push(t("panel.file", { file: h.file }));
      if (h.page) lines.push(t("panel.page", { page: h.page }));
      if (!h.file && !h.page) lines.push(t("panel.no_source_record"));
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
        this.show(
          h.pairs,
          t("panel.history_meta", { source: providerName(h.via) })
        );
        new Notice(t("panel.history_loaded"), 1200);
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
        for (const n of options) dd.addOption(n, providerName(n));
        dd.setValue(val);
      };
      resync(this.ddPrimary, s.primarySource, engineOptions());
      resync(this.ddDict, s.dictSource, dictOptions());
    });
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h3", { text: t("settings.interface_heading") });
    new Setting(containerEl)
      .setName(t("settings.interface_language"))
      .setDesc(t("settings.interface_language_desc"))
      .addDropdown((dd) => {
        dd.addOption("auto", t("settings.ui_auto"));
        dd.addOption("zh-CN", t("settings.ui_zh"));
        dd.addOption("en", t("settings.ui_en"));
        dd.setValue(normalizeUiLanguage(this.plugin.settings.uiLanguage));
        dd.onChange(async (value) => {
          this.plugin.settings.uiLanguage = normalizeUiLanguage(value);
          this.plugin.applyUiLanguage();
          await this.plugin.saveData(this.plugin.settings);
          this.plugin.refreshLocalizedUi();
          this.display();
        });
      });

    containerEl.createEl("h3", { text: t("settings.language_heading") });
    new Setting(containerEl)
      .setName(t("settings.source_language"))
      .setDesc(t("settings.source_language_desc"))
      .addDropdown((dd) => {
        for (const lang of languageOptions(true)) dd.addOption(lang.code, lang.label);
        dd.setValue(this.plugin.settings.sourceLanguage).onChange(async (value) => {
          this.plugin.settings.sourceLanguage = safeLanguageCode(value, true);
          if (
            this.plugin.settings.sourceLanguage !== "auto" &&
            this.plugin.settings.sourceLanguage === this.plugin.settings.targetLanguage
          ) {
            this.plugin.settings.targetLanguage =
              this.plugin.settings.sourceLanguage.startsWith("zh") ? "en" : "zh-Hans";
          }
          await this.plugin.saveData(this.plugin.settings);
          this.plugin.refreshPanel();
          this.display();
        });
      });

    new Setting(containerEl)
      .setName(t("settings.target_language"))
      .setDesc(t("settings.target_language_desc"))
      .addDropdown((dd) => {
        for (const lang of languageOptions(false)) dd.addOption(lang.code, lang.label);
        dd.setValue(this.plugin.settings.targetLanguage).onChange(async (value) => {
          this.plugin.settings.targetLanguage = safeLanguageCode(value);
          if (this.plugin.settings.sourceLanguage === this.plugin.settings.targetLanguage) {
            this.plugin.settings.sourceLanguage = "auto";
          }
          await this.plugin.saveData(this.plugin.settings);
          this.plugin.refreshPanel();
          this.display();
        });
      });

    if (
      this.plugin.settings.sourceLanguage === "auto" ||
      needsAiOnlyDisclaimer(
        this.plugin.settings.sourceLanguage,
        this.plugin.settings.targetLanguage
      )
    ) {
      const notice = containerEl.createDiv({ cls: "mini-language-settings-notice" });
      notice.setText(
        this.plugin.settings.sourceLanguage === "auto" &&
          !needsAiOnlyDisclaimer(
            this.plugin.settings.sourceLanguage,
            this.plugin.settings.targetLanguage
          )
          ? t("language.auto_notice")
          : t("language.ai_only_notice")
      );
    }

    containerEl.createEl("h3", { text: t("settings.providers_heading") });
    new Setting(containerEl)
      .setName(t("settings.primary_provider"))
      .setDesc(t("settings.primary_provider_desc"))
      .addDropdown((dd) => {
        this.ddPrimary = dd; // 挂到实例上，中枢同步时按最新引用重建
        for (const n of engineOptions()) dd.addOption(n, providerName(n));
        dd.setValue(this.plugin.settings.primarySource).onChange(async (v) => {
          this.plugin.settings.primarySource = v;
          await this.plugin.saveData(this.plugin.settings);
          this.plugin.refreshPanel();
        });
      });

    new Setting(containerEl)
      .setName(t("settings.dictionary_provider"))
      .setDesc(t("settings.dictionary_provider_desc"))
      .addDropdown((dd) => {
        this.ddDict = dd;
        for (const d of dictOptions()) dd.addOption(d, providerName(d));
        dd.setValue(this.plugin.settings.dictSource).onChange(async (v) => {
          this.plugin.settings.dictSource = v;
          await this.plugin.saveData(this.plugin.settings);
          this.plugin.refreshPanel();
        });
      });

    // ---------- 统一配置入口：大模型与可选内置源凭据按需展开 ----------
    containerEl.createEl("h3", { text: t("settings.service_config_heading") });
    const llmCount = (this.plugin.settings.llmProfiles || []).length;
    new Setting(containerEl)
      .setName(t("settings.llm_api_config"))
      .setDesc(
        t("settings.llm_api_config_desc", {
          count: llmCount,
          names:
            (this.plugin.settings.llmProfiles || [])
              .map((p) => p.name)
              .join(getUiLanguage() === "en" ? ", " : "、") ||
            t("common.none"),
        })
      )
      .addButton((b) =>
        b.setButtonText(t("settings.manage_config")).setCta().onClick(() => {
          new LLMConfigModal(this.app, this.plugin).open();
        })
      );

    new Setting(containerEl)
      .setName(t("settings.import_export"))
      .setDesc(t("settings.import_export_desc"))
      .addButton((b) =>
        b.setButtonText(t("settings.export")).onClick(() => {
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
          new Notice(t("settings.exported"), 2000);
        })
      )
      .addButton((b) =>
        b.setButtonText(t("settings.import")).onClick(() => {
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
                // 兼容早期的单配置格式
                s.llmProfiles = [
                  {
                    name: t("settings.imported_name"),
                    url: parsed.url || "",
                    apiKey: parsed.apiKey || "",
                    models: parsed.model ? [parsed.model] : [],
                    activeModel: parsed.model || "",
                  },
                ];
              }
              await this.plugin.saveData(s);
              new Notice(t("settings.imported"), 2000);
              this.plugin.refreshPanel();
              this.display();
            } catch (e) {
              new Notice(t("settings.import_failed", { message: e.message }), 6000);
            }
          };
          input.click();
        })
      );

    containerEl.createEl("h3", { text: t("settings.auto_heading") });
    new Setting(containerEl)
      .setName(t("settings.auto_translate"))
      .setDesc(t("settings.auto_translate_desc"))
      .addToggle((t) =>
        t.setValue(this.plugin.settings.autoTranslate).onChange(async (v) => {
          this.plugin.settings.autoTranslate = v;
          if (!v) this.plugin.cancelAutoTranslate();
          await this.plugin.saveData(this.plugin.settings);
        })
      );
    new Setting(containerEl)
      .setName(t("settings.delay"))
      .setDesc(t("settings.delay_desc"))
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

    containerEl.createEl("h3", { text: t("settings.popup_heading") });
    const refreshOpenPopupLimits = () => {
      if (!this.plugin.popupEl) return;
      this.plugin._applyPopupSize(this.plugin.popupEl);
      this.plugin._placePopup(
        this.plugin.popupEl,
        this.plugin.lastPopupAnchor,
        { lock: true }
      );
    };
    let setCustomSizeVisibility = () => {};
    new Setting(containerEl)
      .setName(t("settings.popup_limit"))
      .setDesc(t("settings.popup_limit_desc"))
      .addDropdown((dd) => {
        for (const [id, preset] of Object.entries(POPUP_SIZE_PRESETS)) {
          dd.addOption(id, t(preset.labelKey));
        }
        dd.setValue(
          POPUP_SIZE_PRESETS[this.plugin.settings.popupMaxSize]
            ? this.plugin.settings.popupMaxSize
            : "adaptive"
        ).onChange(async (v) => {
          this.plugin.settings.popupMaxSize = POPUP_SIZE_PRESETS[v]
            ? v
            : "adaptive";
          await this.plugin.saveData(this.plugin.settings);
          setCustomSizeVisibility();
          refreshOpenPopupLimits();
        });
      });

    const customWidthSetting = new Setting(containerEl)
      .setName(t("settings.custom_width"))
      .setDesc(
        t("settings.custom_width_desc", {
          min: POPUP_CUSTOM_WIDTH_MIN_PX,
          max: POPUP_CUSTOM_WIDTH_MAX_PX,
        })
      )
      .addSlider((slider) =>
        slider
          .setLimits(
            POPUP_CUSTOM_WIDTH_MIN_PX,
            POPUP_CUSTOM_WIDTH_MAX_PX,
            20
          )
          .setValue(this.plugin.settings.popupCustomMaxWidth)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.popupCustomMaxWidth = popupDimension(
              value,
              POPUP_CUSTOM_WIDTH_DEFAULT_PX,
              POPUP_CUSTOM_WIDTH_MIN_PX,
              POPUP_CUSTOM_WIDTH_MAX_PX
            );
            await this.plugin.saveData(this.plugin.settings);
            refreshOpenPopupLimits();
          })
      );
    const customHeightSetting = new Setting(containerEl)
      .setName(t("settings.custom_height"))
      .setDesc(
        t("settings.custom_height_desc", {
          min: POPUP_CUSTOM_HEIGHT_MIN_PX,
          max: POPUP_CUSTOM_HEIGHT_MAX_PX,
        })
      )
      .addSlider((slider) =>
        slider
          .setLimits(
            POPUP_CUSTOM_HEIGHT_MIN_PX,
            POPUP_CUSTOM_HEIGHT_MAX_PX,
            20
          )
          .setValue(this.plugin.settings.popupCustomMaxHeight)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.popupCustomMaxHeight = popupDimension(
              value,
              POPUP_CUSTOM_HEIGHT_DEFAULT_PX,
              POPUP_CUSTOM_HEIGHT_MIN_PX,
              POPUP_CUSTOM_HEIGHT_MAX_PX
            );
            await this.plugin.saveData(this.plugin.settings);
            refreshOpenPopupLimits();
          })
      );
    setCustomSizeVisibility = () => {
      const visible = this.plugin.settings.popupMaxSize === "custom";
      customWidthSetting.settingEl.style.display = visible ? "" : "none";
      customHeightSetting.settingEl.style.display = visible ? "" : "none";
    };
    setCustomSizeVisibility();

    const rememberedPopupSize = normalizeRememberedPopupSize(
      this.plugin.settings.popupLastSize
    );
    new Setting(containerEl)
      .setName(t("settings.remember_size"))
      .setDesc(
        rememberedPopupSize
          ? t("settings.remembered_size", rememberedPopupSize)
          : t("settings.remember_size_desc")
      )
      .addToggle((toggle) =>
        toggle
          .setValue(!!this.plugin.settings.rememberPopupSize)
          .onChange(async (value) => {
            this.plugin.settings.rememberPopupSize = value;
            await this.plugin.saveData(this.plugin.settings);
          })
      )
      .addButton((button) =>
        button
          .setButtonText(t("settings.clear_size"))
          .setDisabled(!rememberedPopupSize)
          .onClick(async () => {
            this.plugin.settings.popupLastSize = null;
            await this.plugin.saveData(this.plugin.settings);
            this.display();
          })
      );

    containerEl.createEl("h3", { text: t("settings.full_heading") });
    // 输出形式固定为纯译文（双语对照排版效果差，选项已移除）

    new Setting(containerEl)
      .setName(t("settings.comparison_html"))
      .setDesc(t("settings.comparison_html_desc"))
      .addToggle((tg) =>
        tg
          .setValue(!!this.plugin.settings.fullHtml)
          .onChange(async (v) => {
            this.plugin.settings.fullHtml = v;
            await this.plugin.saveData(this.plugin.settings);
          })
      );

    containerEl.createEl("h3", { text: t("settings.orb_heading") });
    // 实时预览：直接复用 translation-orb 的 createOrbElement + 皮肤 token，不挂控制器
    //（无固定定位、无事件监听，纯展示，随下拉切换即时重绘）
    const orbMod = loadOrbModule(this.plugin);
    const orbRegistry = orbMod.createDefaultSkinRegistry();
    const skinList = orbRegistry.list(); // [{id,label,description}]
    const previewHost = containerEl.createDiv("mini-orb-preview");
    const renderOrbPreview = (skinId) => {
      previewHost.empty();
      const orb = orbMod.createOrbElement(document);
      orb.setAttribute?.("aria-hidden", "true");
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
      .setName(t("settings.skin"))
      .setDesc(t("settings.skin_desc"))
      .addDropdown((dd) => {
        for (const s of skinList) dd.addOption(s.id, t(`skin.${s.id}`));
        dd.setValue(this.plugin.settings.orbSkin || "ink-wash").onChange(async (v) => {
          this.plugin.settings.orbSkin = v;
          await this.plugin.saveData(this.plugin.settings);
          renderOrbPreview(v);
        });
      });
    renderOrbPreview(this.plugin.settings.orbSkin || "ink-wash");

    new Setting(containerEl)
      .setName(t("settings.orb_size"))
      .setDesc(t("settings.orb_size_desc"))
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
      .setName(t("settings.reset_orb"))
      .setDesc(t("settings.reset_orb_desc"))
      .addButton((btn) =>
        btn.setButtonText(t("common.reset")).onClick(async () => {
          this.plugin.settings.orbPosition = null;
          await this.plugin.saveData(this.plugin.settings);
          new Notice(t("settings.orb_reset"), 2000);
        })
      );
  }
}

module.exports = class MiniTranslator extends Plugin {
  applyUiLanguage() {
    let detected = "";
    try {
      detected = typeof getLanguage === "function" ? getLanguage() : "";
    } catch (e) {}
    return setUiLanguage(this.settings?.uiLanguage || "auto", detected);
  }

  addLocalizedCommand(nameKey, command) {
    const definition = { ...command, name: t(nameKey) };
    const registered = this.addCommand(definition);
    if (!Array.isArray(this._localizedCommands)) this._localizedCommands = [];
    this._localizedCommands.push({ nameKey, definition, registered });
    return registered;
  }

  refreshLocalizedUi() {
    if (this.ribbonIconEl) {
      const label = t("command.open_panel_ribbon");
      this.ribbonIconEl.setAttribute?.("aria-label", label);
      this.ribbonIconEl.setAttribute?.("title", label);
    }
    for (const entry of this._localizedCommands || []) {
      const name = t(entry.nameKey);
      entry.definition.name = name;
      if (entry.registered && typeof entry.registered === "object") {
        entry.registered.name = name;
      }
      const commandId = `${this.manifest?.id || "mini-translator"}:${entry.definition.id}`;
      const command = this.app?.commands?.commands?.[commandId];
      if (command) command.name = name;
    }
    if (this.panelView?.contentEl) {
      try {
        this.panelView.onClose();
        void this.panelView.onOpen();
      } catch (error) {
        console.warn("[mini-translator] Failed to refresh localized panel", error);
      }
    }
  }

  async onload() {
    this.settings = Object.assign(
      {
        uiLanguage: "auto",
        primarySource: "有道",
        dictSource: "百度",
        sourceLanguage: "auto",
        targetLanguage: "zh-Hans",
        bingApiKey: "",
        bingRegion: "",
        bingEndpoint: "https://api.cognitive.microsofttranslator.com",
        cnkiToken: "",
        cnkiAuthorization: "",
        autoTranslate: false,
        autoTranslateDelay: 2,
        popupMaxSize: "adaptive", // 自动打开尺寸及手动高度上限；手动宽度只受视口限制
        popupCustomMaxWidth: POPUP_CUSTOM_WIDTH_DEFAULT_PX,
        popupCustomMaxHeight: POPUP_CUSTOM_HEIGHT_DEFAULT_PX,
        rememberPopupSize: false,
        popupLastSize: null,
        fullHtml: false, // 原文对照 HTML：默认关（Markdown 折叠保留含图原页）
        history: [],
        llmProfiles: [],
        activeProfile: 0,
        orbSkin: "ink-wash", // 悬浮球皮肤（translation-orb 五款内置之一）
        orbSize: 40, // 悬浮球直径（px），设置页可在 28–96 之间调整
        orbPosition: null, // 悬浮球拖动位置 {x,y}，null 用默认右下角
      },
      await this.loadData()
    );
    this.settings.uiLanguage = normalizeUiLanguage(this.settings.uiLanguage);
    this.applyUiLanguage();
    this.settings.sourceLanguage = safeLanguageCode(
      this.settings.sourceLanguage,
      true
    );
    this.settings.targetLanguage = safeLanguageCode(
      this.settings.targetLanguage
    );
    if (
      this.settings.sourceLanguage !== "auto" &&
      this.settings.sourceLanguage === this.settings.targetLanguage
    ) {
      this.settings.sourceLanguage = "auto";
    }
    if (!POPUP_SIZE_PRESETS[this.settings.popupMaxSize]) {
      this.settings.popupMaxSize = "adaptive";
    }
    this.settings.popupCustomMaxWidth = popupDimension(
      this.settings.popupCustomMaxWidth,
      POPUP_CUSTOM_WIDTH_DEFAULT_PX,
      POPUP_CUSTOM_WIDTH_MIN_PX,
      POPUP_CUSTOM_WIDTH_MAX_PX
    );
    this.settings.popupCustomMaxHeight = popupDimension(
      this.settings.popupCustomMaxHeight,
      POPUP_CUSTOM_HEIGHT_DEFAULT_PX,
      POPUP_CUSTOM_HEIGHT_MIN_PX,
      POPUP_CUSTOM_HEIGHT_MAX_PX
    );
    this.settings.rememberPopupSize = !!this.settings.rememberPopupSize;
    this.settings.popupLastSize = normalizeRememberedPopupSize(
      this.settings.popupLastSize
    );
    // Migrate legacy llmUrl/llmApiKey/llmModel/customPresets fields to profile objects.
    if (!Array.isArray(this.settings.llmProfiles) || this.settings.llmProfiles.length === 0) {
      const profiles = [];
      if (this.settings.llmUrl || this.settings.llmApiKey || this.settings.llmModel) {
        profiles.push({
          name: t("config.default_profile_name"),
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

    this.registerView(VIEW_TYPE, (leaf) => {
      // 自己持有面板实例引用；leaf.view 在新版 Obsidian 里不保证返回插件实例
      this.panelView = new MiniTranslatorView(leaf, this);
      return this.panelView;
    });
    try {
      this.ribbonIconEl = this.addRibbonIcon(
        "languages",
        t("command.open_panel_ribbon"),
        () =>
        this.activateView()
      );
    } catch (e) {
      console.log("[mini-translator] 功能区图标添加失败:", e);
    }
    this.addSettingTab(new MiniTranslatorSettingTab(this.app, this));

    // 先前生成的全文译文可能没有 cssclasses frontmatter。运行时按 type/文件名补 class，
    // 这样升级插件后旧笔记也立即得到新排版，无需批量改写用户文件（raw 目录同样只读）。
    const refreshFullTranslationStyles = () => {
      setTimeout(() => this.markFullTranslationViews(), 0);
      setTimeout(() => this.markFullTranslationViews(), 120);
    };
    this.registerEvent(
      this.app.workspace.on("file-open", refreshFullTranslationStyles)
    );
    this.registerEvent(
      this.app.workspace.on("layout-change", refreshFullTranslationStyles)
    );
    this.app.workspace.onLayoutReady(refreshFullTranslationStyles);

    // 全文翻译进度：状态栏显示，点击取消（Notice 放不了按钮）
    this.resetFtCancel();
    this.ftStatusItem = this.addStatusBarItem();
    this.ftStatusItem.style.cursor = "pointer";
    this.ftStatusItem.hide();
    this.ftStatusItem.onclick = () => {
      this.requestFtCancel();
      new Notice(t("progress.cancel_requested_notice"), 3000);
    };
    // 中枢钩子：任何界面调 saveData 落盘即广播，所有源相关 UI 实时同步（含选中状态）
    const origSaveData = this.saveData.bind(this);
    this.saveData = async (data) => {
      await origSaveData(data);
      broadcastSources("save");
    };

    this.addLocalizedCommand("command.translate_sentences", {
      id: "translate-selection",
      callback: () => this.translateSelection("sentence"),
    });

    this.addLocalizedCommand("command.translate_paragraph", {
      id: "translate-selection-paragraph",
      callback: () => this.translateSelection("paragraph"),
    });

    this.addLocalizedCommand("command.open_panel", {
      id: "open-panel",
      callback: () => this.activateView(),
    });

    this.addLocalizedCommand("command.toggle_auto", {
      id: "toggle-auto-translate",
      callback: async () => {
        this.settings.autoTranslate = !this.settings.autoTranslate;
        if (!this.settings.autoTranslate) this.cancelAutoTranslate();
        await this.saveData(this.settings);
        new Notice(
          t("command.auto_status", {
            status: t(this.settings.autoTranslate ? "common.on" : "common.off"),
          }),
          2000
        );
      },
    });

    this.addLocalizedCommand("command.cancel_selection", {
      id: "cancel-selection-translation",
      callback: () => {
        const hadPending = this.cancelAutoTranslate();
        const hadPopup = !!this.popupEl;
        if (hadPopup) this.closePopup();
        if (hadPending || hadPopup) {
          new Notice(t("translation.cancelled_selection"), 1500);
        }
      },
    });

    this.addLocalizedCommand("command.self_test", {
      id: "self-test",
      callback: async () => {
        const results = [];
        for (const name of dictOptions()) {
          const prof = findProfile(name);
          try {
            const r = prof
              ? await llmRequest("trajectory", prof, DICT_PROMPT)
              : await BUILTIN_DICTS.find((d) => d.name === name).fn("trajectory");
            results.push(t("self_test.dictionary_ok", {
              provider: providerName(name),
              result: r.split("\n").slice(0, 2).join(" | "),
            }));
          } catch (e) {
            results.push(t("self_test.dictionary_failed", {
              provider: providerName(name),
              message: e.message || e,
            }));
          }
        }
        const from = this.settings.sourceLanguage;
        const to = this.settings.targetLanguage;
        for (const name of engineOptions()) {
          const prof = findProfile(name);
          if (!prof && !engineSupportsPair(name, from, to)) {
            results.push(t("self_test.provider_unsupported", {
              provider: providerName(name),
              pair: languagePairLabel(from, to),
            }));
            continue;
          }
          try {
            const sample =
              from === "zh-Hans" || from === "zh-Hant"
                ? "这是一个翻译测试。"
                : "This is a translation test.";
            const r = prof
              ? {
                  text: await llmRequest(
                    sample,
                    prof,
                    buildTranslatePrompt(from, to),
                    from,
                    to
                  ),
                }
              : normalizeEngineResult(
                  await ENGINES.find((e) => e.name === name).fn(sample, from, to)
                );
            results.push(t("self_test.provider_ok", {
              provider: providerName(name),
              result: r.text,
            }));
          } catch (e) {
            results.push(t("self_test.provider_failed", {
              provider: providerName(name),
              message: e.message || e,
            }));
          }
        }
        new Notice(results.join("\n"), 10000);
      },
    });

    this.addLocalizedCommand("command.math_test", {
      id: "math-selftest",
      callback: () => {
        const modal = new Modal(this.app);
        modal.contentEl.createEl("h3", { text: t("math_test.title") });
        const note = modal.contentEl.createDiv();
        note.style.fontSize = "var(--font-smaller)";
        note.style.color = "var(--text-muted)";
        note.style.lineHeight = "1.6";
        note.style.marginBottom = "10px";
        note.appendText(t("math_test.note"));
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

    this.addLocalizedCommand("command.full_current", {
      id: "translate-full-pdf",
      callback: () => this.fullTranslateFlow(),
    });

    this.addLocalizedCommand("command.full_pick", {
      id: "translate-full-pick",
      callback: () => new FilePickTranslateModal(this.app, this).open(),
    });

    this.addLocalizedCommand("command.diagnose", {
      id: "diagnose",
      callback: () => this.diagnose(),
    });

    // 划线停留自动翻译（开关在设置里，默认关闭）
    this.registerDomEvent(document, "selectionchange", () =>
      this.onSelectionChanged()
    );
    // Keep the end of the user's latest drag as a last-resort text anchor. This is
    // only used when an editor/DOM selection API cannot expose a rectangle.
    this.registerDomEvent(document, "pointerup", (e) => {
      if (this.popupEl && this.popupEl.contains(e.target)) return;
      if (!Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return;
      this._lastSelectionPointer = {
        x: e.clientX,
        y: e.clientY,
        target: e.target,
        at: Date.now(),
      };
    });
    // 翻译进行中：单击不打断，只有弹窗外连续双击才取消，降低误操作概率。
    // 翻译完成后：弹窗外单击即可关闭；此时双击也只关闭，不显示取消提示。
    this.registerDomEvent(document, "dblclick", (e) => {
      if (this.popupEl && this.popupEl.contains(e.target)) return;
      const popupTranslating = !!this.popupEl && !this._popupTranslationDone;
      const hadPending = this.cancelAutoTranslate();
      const hadPopup = !!this.popupEl;
      if (hadPopup) this.closePopup();
      if (popupTranslating || (!hadPopup && hadPending)) {
        new Notice(t("translation.cancelled_selection"), 1500);
      }
    });
    // Esc 仍是明确的取消键；弹窗打开后由弹窗自己的 Esc 监听负责关闭。
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

  // 只取消“停留等待”阶段，不主动清掉用户当前选区；翻译中的弹窗由
  // Esc / 屏幕外双击 / 右上角 × 通过 closePopup 递增 _popupRunId，令在途结果失效。
  cancelAutoTranslate() {
    const hadPending = this.dwellTimer != null;
    if (hadPending) clearTimeout(this.dwellTimer);
    this.dwellTimer = null;
    this._autoTranslatePending = null;
    return hadPending;
  }

  onSelectionChanged() {
    const sel = window.getSelection();
    const t = ((sel && sel.toString()) || "").trim();
    if (!this.settings.autoTranslate) return;
    // 清空选区时不立即取消：单击只是改变了浏览器选区，真正触发取消需要屏幕外双击。
    // 定时器到期后会再次校验选区，若已为空则自然退出，不会误发起翻译。
    if (!t || !hasTranslatableText(t)) return;
    // 弹窗内部的选中不触发
    if (this.popupEl && sel.anchorNode && this.popupEl.contains(sel.anchorNode)) {
      return;
    }
    // 用户确实换了一段有效英文选区：取消旧等待并为新选区重新计时。
    this.cancelAutoTranslate();
    const delay = (this.settings.autoTranslateDelay ?? 2) * 1000;
    // 用对象 token 防止一个已经排队但未被及时清理的旧回调误触发。
    const selectionInfo = this._readDomSelectionInfo(sel);
    const pendingToken = { text: t, anchor: selectionInfo?.anchor || null };
    this._autoTranslatePending = pendingToken;
    this.dwellTimer = setTimeout(() => {
      if (this._autoTranslatePending !== pendingToken) return;
      this.dwellTimer = null;
      this._autoTranslatePending = null;
      const cur = window.getSelection();
      const curText = ((cur && cur.toString()) || "").trim();
      // 必须仍是同一段选区；误划后重新拖动/点击不会把旧选区送进翻译。
      if (!curText || curText !== pendingToken.text || !hasTranslatableText(curText)) return;
      const currentInfo = this._readDomSelectionInfo(cur);
      this.translateSelection("paragraph", {
        text: curText,
        anchor: currentInfo?.anchor || pendingToken.anchor,
      });
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
    L.push(t("diagnose.markdown", {
      status: t(mdView ? "diagnose.yes" : "diagnose.no"),
    }));
    if (mdView && mdView.editor) {
      const sel = mdView.editor.getSelection() || "";
      L.push(t("diagnose.selection_length", { count: sel.length }));
      const pos = mdView.editor.getCursor("to");
      for (const mode of ["window", "local"]) {
        try {
          const c = mdView.editor.coordsAtPos(pos, mode);
          L.push(
            `coordsAtPos(${mode}): ` +
              (c ? `${Math.round(c.left)},${Math.round(c.top)}` : "null")
          );
        } catch (e) {
          L.push(t("diagnose.coords_error", { mode, message: e.message }));
        }
      }
    }
    const pdfLeaves = this.app.workspace.getLeavesOfType("pdf");
    L.push(t("diagnose.pdf_count", { count: pdfLeaves.length }));
    const ae = document.activeElement;
    L.push(
      t("diagnose.focus", {
        element: ae
          ? ae.tagName +
            (ae.tagName === "IFRAME"
              ? ""
              : "." + (ae.className || "").toString().slice(0, 40))
          : "null",
      })
    );
    if (ae && ae.tagName === "IFRAME") {
      try {
        const sel = ae.contentWindow.getSelection();
        L.push(
          t("diagnose.iframe_selection", {
            detail: sel
              ? t("diagnose.accessible_length", { count: sel.toString().length })
              : "null",
          })
        );
      } catch (e) {
        L.push(t("diagnose.iframe_error", { message: e.message }));
      }
    }
    new Notice(L.join("\n"), 10000);
  }

  // ---------- 选区旁弹窗 ----------
  _readDomSelectionInfo(selection = window.getSelection(), root = null) {
    try {
      const text = String(selection?.toString?.() || "").trim();
      if (!text || !selection || selection.rangeCount < 1) return null;
      if (
        this.popupEl &&
        selection.anchorNode &&
        this.popupEl.contains(selection.anchorNode)
      ) {
        return null;
      }
      const range = selection.getRangeAt(0);
      if (root) {
        const common = range.commonAncestorContainer;
        const anchorInside = !selection.anchorNode || root.contains(selection.anchorNode);
        const commonInside = !common || root.contains(common);
        if (!anchorInside && !commonInside) return null;
      }

      const vw = Math.max(1, Number(window.innerWidth) || 1);
      const vh = Math.max(1, Number(window.innerHeight) || 1);
      const validRect = (r) =>
        r &&
        [r.left, r.top, r.right, r.bottom].every((v) => Number.isFinite(Number(v))) &&
        Number(r.bottom) > Number(r.top);
      const visibleRect = (r) =>
        validRect(r) && r.right >= 0 && r.left <= vw && r.bottom >= 0 && r.top <= vh;
      let rects = Array.from(range.getClientRects?.() || []).filter(visibleRect);
      if (!rects.length) {
        const bounding = range.getBoundingClientRect?.();
        if (visibleRect(bounding)) rects = [bounding];
      }
      if (!rects.length) return { text, anchor: null };

      const anchor = {
        left: Math.min(...rects.map((r) => Number(r.left))),
        top: Math.min(...rects.map((r) => Number(r.top))),
        right: Math.max(...rects.map((r) => Number(r.right))),
        bottom: Math.max(...rects.map((r) => Number(r.bottom))),
      };
      // Keep popup positioning in viewport coordinates. _normalizePopupAnchor
      // clips partially visible selections and guards against pathological values.
      return { text, anchor, x: anchor.left, y: anchor.bottom + 6 };
    } catch (e) {
      return null;
    }
  }

  _editorSelectionAnchor(editor) {
    if (!editor?.coordsAtPos) return null;
    let from;
    let to;
    try {
      from = editor.getCursor("from");
      to = editor.getCursor("to");
    } catch (e) {
      return null;
    }
    const containerRect = editor.containerEl?.getBoundingClientRect?.() || null;
    const readCoords = (pos, mode, local = false) => {
      try {
        const c = mode == null ? editor.coordsAtPos(pos) : editor.coordsAtPos(pos, mode);
        if (!c) return null;
        let left = Number(c.left);
        let right = Number(c.right);
        let top = Number(c.top);
        let bottom = Number(c.bottom);
        if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
        if (!Number.isFinite(right)) right = left;
        if (!Number.isFinite(bottom) || bottom <= top) bottom = top + 20;

        if (containerRect) {
          const pad = 96;
          const looksWindowRelative =
            left >= containerRect.left - pad &&
            left <= containerRect.right + pad &&
            top >= containerRect.top - pad &&
            top <= containerRect.bottom + pad;
          const looksContainerLocal =
            left >= -pad &&
            left <= containerRect.width + pad &&
            top >= -pad &&
            top <= containerRect.height + pad;
          // Some editor adapters ignore the requested mode and still return local
          // coordinates. Convert only when the numbers clearly fit the container but
          // not its viewport rectangle; this avoids the common double-offset jump.
          if (local || (!looksWindowRelative && looksContainerLocal)) {
            left += containerRect.left;
            right += containerRect.left;
            top += containerRect.top;
            bottom += containerRect.top;
          }
        }
        return { left, right, top, bottom };
      } catch (e) {
        return null;
      }
    };

    let points = [readCoords(from, "window"), readCoords(to, "window")].filter(Boolean);
    if (!points.length) {
      points = [readCoords(from, null), readCoords(to, null)].filter(Boolean);
    }
    if (!points.length) {
      points = [readCoords(from, "local", true), readCoords(to, "local", true)].filter(Boolean);
    }
    if (!points.length) return null;
    return {
      left: Math.min(...points.map((p) => p.left)),
      top: Math.min(...points.map((p) => p.top)),
      right: Math.max(...points.map((p) => p.right)),
      bottom: Math.max(...points.map((p) => p.bottom)),
    };
  }

  _lastPointerAnchor(root = null) {
    const point = this._lastSelectionPointer;
    if (!point || Date.now() - point.at > 30000) return null;
    if (root && point.target && !root.contains(point.target)) return null;
    const x = Number(point.x);
    const y = Number(point.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { left: x, top: y - 20, right: x, bottom: y + 2 };
  }

  _normalizePopupAnchor(x, y, anchor) {
    const vw = Math.max(1, Number(window.innerWidth) || 1);
    const vh = Math.max(1, Number(window.innerHeight) || 1);
    return normalizeViewportAnchor(x, y, anchor, vw, vh);
  }

  _placePopup(el, anchor = this.lastPopupAnchor, options = {}) {
    if (!el || !el.isConnected) return;
    const margin = 8;
    const vw = Math.max(1, Number(window.innerWidth) || document.documentElement.clientWidth || 1);
    const vh = Math.max(1, Number(window.innerHeight) || document.documentElement.clientHeight || 1);
    this._applyPopupSize(el);
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
    const a = this._normalizePopupAnchor(null, null, anchor);
    this.lastPopupAnchor = a;
    const body = this.popupBodyEl && el.contains(this.popupBodyEl) ? this.popupBodyEl : null;
    // 每次原文/译文更新都按当前字数重新计算上限；自然尺寸超过上限后才滚动。
    rect = el.getBoundingClientRect();
    const belowTop = a.bottom + gap;
    const belowRoom = Math.max(0, vh - margin - belowTop);
    const aboveRoom = Math.max(0, a.top - gap - margin);

    // 先保留当前侧，减少等待阶段的抖动；真实译文出现后若完整高度在当前侧放不下、
    // 但另一侧能放下，resolvePopupPlacement 会切换，绝不优先压缩弹窗硬塞。
    const storedPlacement =
      !options.forceRecompute &&
      (this._popupPlacement === "above" || this._popupPlacement === "below")
        ? this._popupPlacement
        : null;
    let placementHeight = rect.height;
    if (!storedPlacement && options.lock && Array.isArray(this._popupSlots)) {
      // Before the API returns, estimate each pending translation row from its source
      // row. This chooses the correct side up front instead of first showing a tiny
      // placeholder below and discovering only later that the finished text fits above.
      const pendingGrowth = this._popupSlots.reduce((sum, slot) => {
        if (slot?.translated) return sum;
        const sourceRect = slot?.enEl?.getBoundingClientRect?.();
        const pendingRect = slot?.zhEl?.getBoundingClientRect?.();
        const sourceHeight = Number(sourceRect?.height) || 0;
        const pendingHeight = Number(pendingRect?.height) || 0;
        return sum + Math.max(0, sourceHeight - pendingHeight);
      }, 0);
      const bodyHeight = body ? body.getBoundingClientRect().height : 0;
      const chrome = Math.max(0, rect.height - bodyHeight);
      const bodyCap = Number.parseFloat(body?.style?.maxHeight);
      placementHeight = Math.min(
        rect.height + pendingGrowth,
        chrome + (Number.isFinite(bodyCap) ? bodyCap : rect.height + pendingGrowth)
      );
    }
    let placement = resolvePopupPlacement(
      a,
      placementHeight,
      vh,
      storedPlacement
    );
    if (options.lock || storedPlacement) this._popupPlacement = placement;

    const room = placement === "above" ? aboveRoom : belowRoom;
    const configuredPopupMax =
      this._popupSizeMetrics?.manualMaxHeight || Math.max(1, vh - margin * 2);
    // Native manual resize is constrained to the selected side as well as the user's
    // configured maximum, so an above-popup cannot be dragged down across the source.
    el.style.maxHeight = `${Math.max(48, Math.min(configuredPopupMax, room))}px`;
    rect = el.getBoundingClientRect();
    if (body && rect.height > room) {
      // Keep the popup entirely on its locked side. Extra text becomes scrollable;
      // this is what prevents a late API result from pushing the box over the source.
      const bodyHeight = body ? body.getBoundingClientRect().height : 0;
      const chrome = Math.max(0, rect.height - bodyHeight);
      const currentCap = Number.parseFloat(body.style.maxHeight);
      const sideCap = Math.max(24, room - chrome);
      body.style.maxHeight = `${Math.min(
        Number.isFinite(currentCap) ? currentCap : sideCap,
        sideCap
      )}px`;
      rect = el.getBoundingClientRect();
    }

    const storedHorizontal =
      !options.forceRecompute &&
      (this._popupHorizontalAlignment === "left" ||
      this._popupHorizontalAlignment === "right")
        ? this._popupHorizontalAlignment
        : null;
    const horizontal =
      storedHorizontal ||
      (a.left + rect.width <= vw - margin ? "left" : "right");
    if (options.lock || storedHorizontal) {
      this._popupHorizontalAlignment = horizontal;
    }
    const maxLeft = Math.max(margin, vw - rect.width - margin);
    const desiredLeft = horizontal === "right" ? a.right - rect.width : a.left;
    const left = Math.min(maxLeft, Math.max(margin, desiredLeft));
    const desiredTop =
      placement === "above" ? a.top - rect.height - gap : belowTop;
    const maxTop = Math.max(margin, vh - rect.height - margin);
    // In the normal cases desiredTop is already in range. The final clamp only handles
    // a viewport smaller than the popup's chrome; body max-height above handles content.
    const top = Math.min(maxTop, Math.max(margin, desiredTop));
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.dataset.placement = placement;
  }

  _popupContentLength() {
    const slots = Array.isArray(this._popupSlots) ? this._popupSlots : [];
    if (slots.length) {
      return slots.reduce((sum, slot) => {
        const source = String(slot?.source || "");
        const translated = slot?.translated ? String(slot?.pair?.zh || "") : "";
        return sum + source.length + translated.length;
      }, 0);
    }
    return String(this.popupBodyEl?.textContent || "").length;
  }

  _applyPopupSize(el) {
    if (!el) return;
    const vw = Math.max(
      1,
      Number(window.innerWidth) || document.documentElement.clientWidth || 1
    );
    const vh = Math.max(
      1,
      Number(window.innerHeight) || document.documentElement.clientHeight || 1
    );
    const chars = this._popupContentLength();
    const metrics = popupMetricsForChars(
      chars,
      vw,
      vh,
      this.settings?.popupMaxSize || "adaptive",
      {
        maxWidth: this.settings?.popupCustomMaxWidth,
        maxHeight: this.settings?.popupCustomMaxHeight,
      }
    );
    this._popupSizeMetrics = metrics;
    el.style.minWidth = `${metrics.minWidth}px`;
    el.style.maxWidth = `${
      this._popupUserResized ? metrics.resizeMaxWidth : metrics.maxWidth
    }px`;
    el.style.maxHeight = `${metrics.manualMaxHeight}px`;
    el.style.setProperty?.("--mini-popup-text-boost", `${metrics.textBoost}px`);
    el.style.setProperty?.(
      "--mini-popup-small-text-boost",
      `${metrics.smallTextBoost}px`
    );
    if (this.popupBodyEl && el.contains(this.popupBodyEl)) {
      this.popupBodyEl.style.maxHeight = `${
        this._popupUserResized
          ? metrics.manualBodyMaxHeight
          : metrics.bodyMaxHeight
      }px`;
    }
    el.dataset.contentChars = String(chars);
    el.dataset.displayScale = metrics.displayScale.toFixed(3);
    el.dataset.maxSize = metrics.sizeMode;
  }

  _rememberCurrentPopupSize(el) {
    if (
      !this.settings?.rememberPopupSize ||
      !this._popupUserResized ||
      !el?.isConnected
    ) {
      return;
    }
    const rect = el.getBoundingClientRect();
    // Chromium 的原生 resize 会把用户拖出的目标值写进 inline width/height。
    // 当前选区一侧空间不足时 computed rect 可能被 max-height 暂时裁小；记忆时应保存
    // 用户真正拖出的尺寸，而不是这个临时受位置约束的显示尺寸。
    const inlineWidth = Number.parseFloat(el.style.width);
    const inlineHeight = Number.parseFloat(el.style.height);
    const next = normalizeRememberedPopupSize({
      width: Number.isFinite(inlineWidth) ? inlineWidth : rect.width,
      height: Number.isFinite(inlineHeight) ? inlineHeight : rect.height,
    });
    if (!next) return;
    this._popupResizeDirty = false;
    const previous = normalizeRememberedPopupSize(
      this.settings.popupLastSize
    );
    if (
      previous &&
      previous.width === next.width &&
      previous.height === next.height
    ) {
      return;
    }
    // Update memory synchronously so opening a new selection immediately after closing
    // this one can already reuse the size; persistence may finish a moment later.
    this.settings.popupLastSize = next;
    try {
      Promise.resolve(this.saveData?.(this.settings)).catch((error) =>
        console.warn("[mini-translator] 保存翻译框大小失败", error)
      );
    } catch (error) {
      console.warn("[mini-translator] 保存翻译框大小失败", error);
    }
  }

  _scheduleRememberCurrentPopupSize(el) {
    if (!this.settings?.rememberPopupSize || !this._popupResizeDirty) return;
    if (this._popupRememberTimer != null) {
      window.clearTimeout(this._popupRememberTimer);
    }
    // ResizeObserver 在拖动期间会高频触发；只在尺寸稳定片刻后落盘一次。
    this._popupRememberTimer = window.setTimeout(() => {
      this._popupRememberTimer = null;
      if (this._popupResizeActive) {
        // 用户仍在拖动时不能把 dirty 清掉，否则后半段拖动会永远不再保存。
        this._scheduleRememberCurrentPopupSize(el);
        return;
      }
      if (this.popupEl === el && this._popupResizeDirty) {
        this._rememberCurrentPopupSize(el);
      }
    }, 280);
  }

  showPopup(text, x, y, via, pending, anchor = null) {
    this.closePopup();
    // Every popup gets a generation id. A response from a previous selection must not
    // paint into a newly opened popup after the user starts another translation.
    this._popupRunId = (this._popupRunId || 0) + 1;
    this._popupTranslationDone = false;
    this._popupDragged = false;
    this._popupResizeDirty = false;
    this._popupResizeActive = false;
    this._popupResizeEnd = null;
    this._popupObservedInlineSize = null;
    const rememberedPopupSize = this.settings?.rememberPopupSize
      ? normalizeRememberedPopupSize(this.settings.popupLastSize)
      : null;
    this._popupUserResized = !!rememberedPopupSize;
    this._popupPlacement = null;
    this._popupHorizontalAlignment = null;
    this.lastPopupPos = { x, y };
    this.lastPopupAnchor = this._normalizePopupAnchor(x, y, anchor);
    const el = document.body.createDiv();
    el.addClass("mini-translator-popup");
    Object.assign(el.style, {
      position: "fixed",
      left: `${Math.max(8, this.lastPopupAnchor.left)}px`,
      top: `${Math.max(8, this.lastPopupAnchor.bottom + 8)}px`,
      zIndex: "1000",
      // 短文本保持 fit-content；真正的动态上限由 _applyPopupSize 按字数和视口计算。
      width: "fit-content",
      minWidth: `${POPUP_MIN_WIDTH_PX}px`,
      maxWidth: `${POPUP_MAX_WIDTH_PX}px`,
      boxSizing: "border-box",
      background: "var(--background-primary)",
      color: "var(--text-normal)",
      border: "1px solid var(--background-modifier-border)",
      borderRadius: "10px",
      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)",
      fontFamily: "var(--font-interface)",
    });
    const header = el.createDiv();
    header.addClass("mini-popup-header");
    Object.assign(header.style, {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "6px 12px",
      borderBottom: "1px solid var(--background-modifier-border)",
      fontSize:
        "calc(var(--font-smaller) + var(--mini-popup-small-text-boost, 0px))",
      color: "var(--text-muted)",
    });
    this.popupHeaderEl = header;
    header.createSpan({
      text: pending
        ? t("translation.in_progress")
        : via
          ? `${t("translation.header")} · ${providerName(via)}`
          : "Mini Translator",
    });
    const copyBtn = header.createSpan({ text: t("common.copy") });
    copyBtn.style.cursor = "pointer";
    copyBtn.style.marginLeft = "auto";
    copyBtn.setAttribute("aria-label", t("translation.copy_target"));
    copyBtn.onmousedown = (e) => e.stopPropagation();
    copyBtn.onclick = async () => {
      if (this.lastPopupText) {
        await navigator.clipboard.writeText(this.lastPopupText);
        new Notice(t("common.copied"), 1500);
      }
    };
    const closeBtn = header.createSpan({ text: "×" });
    closeBtn.className = "mini-popup-close";
    closeBtn.setAttribute("role", "button");
    closeBtn.tabIndex = 0;
    closeBtn.setAttribute("aria-label", t("translation.close_popup"));
    closeBtn.title = pending ? t("translation.cancel") : t("common.close");
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
    body.addClass("mini-popup-body");
    Object.assign(body.style, {
      padding: "10px 12px",
      maxHeight: `${POPUP_BODY_MAX_HEIGHT_PX}px`,
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
      this.pendingLabel = body.createSpan({ text: t("translation.in_progress") });
      this.pendingLabel.style.color = "var(--text-muted)";
    } else {
      body.setText(text);
    }
    document.body.appendChild(el);
    this.popupEl = el;
    if (rememberedPopupSize) {
      // Restore the user's last explicit dimensions. Horizontal size is limited only
      // by the current viewport; _placePopup separately applies the vertical side limit.
      this._applyPopupSize(el);
      el.style.width = `${Math.min(
        rememberedPopupSize.width,
        this._popupSizeMetrics.resizeMaxWidth
      )}px`;
      el.style.height = `${Math.min(
        rememberedPopupSize.height,
        this._popupSizeMetrics.manualMaxHeight
      )}px`;
      el.dataset.restoredSize = "true";
    }
    this._placePopup(el);
    // Keep a signature of the explicit CSS box. Native Chromium resizing writes
    // pixel width/height values even in the rare cases where the initial pointerdown
    // is swallowed by the embedded PDF/browser surface. ResizeObserver can then
    // still recognize and persist the user's change without mistaking content reflow
    // or a temporary side-specific max-height for a manual resize.
    this._popupObservedInlineSize = `${el.style.width || ""}|${
      el.style.height || ""
    }`;
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const rect = el.getBoundingClientRect();
      const inResizeCorner =
        e.clientX >= rect.right - 22 && e.clientY >= rect.bottom - 22;
      if (!inResizeCorner) return;
      // Freeze the current natural size, then expose the viewport width to the
      // browser's native resize handle. Later content updates preserve this manual size.
      this._popupUserResized = true;
      this._popupResizeDirty = true;
      this._popupResizeActive = true;
      el.style.width = `${rect.width}px`;
      el.style.height = `${rect.height}px`;
      this._popupObservedInlineSize = `${el.style.width}|${el.style.height}`;
      this._placePopup(el, this.lastPopupAnchor, { lock: true });
      const finishResize = () => {
        if (!this._popupResizeActive) return;
        this._popupResizeActive = false;
        this._popupResizeDirty = true;
        window.removeEventListener("pointerup", finishResize, true);
        window.removeEventListener("pointercancel", finishResize, true);
        window.removeEventListener("mouseup", finishResize, true);
        window.removeEventListener("blur", finishResize, true);
        this._popupResizeEnd = null;
        const settle = window.requestAnimationFrame?.bind(window) ||
          ((fn) => window.setTimeout(fn, 16));
        settle(() => {
          if (this.popupEl === el) {
            this._placePopup(el, this.lastPopupAnchor, { lock: true });
            this._rememberCurrentPopupSize(el);
          }
        });
      };
      this._popupResizeEnd = finishResize;
      window.addEventListener("pointerup", finishResize, true);
      window.addEventListener("pointercancel", finishResize, true);
      window.addEventListener("mouseup", finishResize, true);
      window.addEventListener("blur", finishResize, true);
      this._scheduleRememberCurrentPopupSize(el);
    });
    const ResizeObserverCtor =
      window.ResizeObserver || globalThis.ResizeObserver;
    if (typeof ResizeObserverCtor === "function") {
      this._popupResizeObserver = new ResizeObserverCtor(() => {
        if (this._popupResizeFrame != null) return;
        const schedule = window.requestAnimationFrame?.bind(window) ||
          ((fn) => window.setTimeout(fn, 16));
        this._popupResizeFrame = schedule(() => {
          this._popupResizeFrame = null;
          if (this.popupEl === el) {
            const inlineSignature = `${el.style.width || ""}|${
              el.style.height || ""
            }`;
            const inlineBox =
              /^\d+(?:\.\d+)?px$/.test(el.style.width || "") &&
              /^\d+(?:\.\d+)?px$/.test(el.style.height || "");
            const inlineChanged =
              this._popupObservedInlineSize != null &&
              inlineSignature !== this._popupObservedInlineSize;
            this._popupObservedInlineSize = inlineSignature;
            if (this._popupResizeActive || (inlineBox && inlineChanged)) {
              this._popupUserResized = true;
              this._popupResizeDirty = true;
            }
            this._placePopup(el, this.lastPopupAnchor, { lock: true });
            this._scheduleRememberCurrentPopupSize(el);
          }
        });
      });
      this._popupResizeObserver.observe(el);
    }
    this._popupResize = () => {
      // A real viewport resize is the one case where reselecting the better side is
      // preferable. Ordinary source/translation updates keep the side locked.
      this._popupPlacement = null;
      this._popupHorizontalAlignment = null;
      this._placePopup(this.popupEl, this.lastPopupAnchor, {
        forceRecompute: true,
        lock: Array.isArray(this._popupSlots) && this._popupSlots.length > 0,
      });
    };
    window.addEventListener("resize", this._popupResize);
    this._dismissMouse = (e) => {
      // 译文已经完整输出后，恢复低打扰的单击外部关闭；翻译中单击必须无动作。
      if (
        this.popupEl &&
        !this.popupEl.contains(e.target) &&
        this._popupTranslationDone
      ) {
        this.closePopup();
      }
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
      .map((slot) => slot.pair.zh)
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
      en.className = "mini-en-line mini-source-line";
      body.appendChild(en);
      const sourceLanguage = item.sourceLanguage || this.settings.sourceLanguage || "auto";
      const sourceText = formatTextForLanguage(item.en || "", sourceLanguage);
      applyLanguageAttrs(en, item.detectedLanguage || sourceLanguage, sourceText);
      renderRichText(en, sourceText);

      const zh = document.createElement("div");
      const waiting = item.waiting !== false;
      zh.className = item.dict
        ? `mini-dict-line mini-target-line${waiting ? " mini-zh-pending" : ""}`
        : `mini-zh-line mini-target-line${waiting ? " mini-zh-pending" : ""}`;
      applyLanguageAttrs(
        zh,
        item.targetLanguage || this.settings.targetLanguage || "zh-Hans"
      );
      if (waiting) {
        // 头部已经显示“翻译中…”，行内用三个动态圆点提示等待，避免重复长文字。
        const dots = document.createElement("span");
        dots.className = "mini-translator-waiting-dots";
        dots.setAttribute("aria-label", t("translation.in_progress"));
        for (let i = 0; i < 3; i++) {
          dots.appendChild(document.createElement("i"));
        }
        zh.appendChild(dots);
      }
      body.appendChild(zh);
      this._popupSlots.push({
        source: item.en || "",
        sourceLanguage,
        targetLanguage: item.targetLanguage || this.settings.targetLanguage || "zh-Hans",
        enEl: en,
        zhEl: zh,
        pair: null,
        translated: false,
        final: false,
      });
    }
    this.pendingLabel = null;
    const labelSpan = this.popupHeaderEl?.querySelector("span");
    if (labelSpan) {
      labelSpan.textContent = translationHeaderLabel(
        via,
        this.settings.sourceLanguage,
        this.settings.targetLanguage
      );
      if (needsAiOnlyDisclaimer(this.settings.sourceLanguage, this.settings.targetLanguage)) {
        labelSpan.title = t("language.ai_only_notice");
      }
    }
    this._refreshPopupText();
    this._placePopup(this.popupEl, this.lastPopupAnchor, { lock: true });
  }

  updatePopupTranslation(index, pair, via) {
    const slot = this._popupSlots?.[index];
    if (!slot || !slot.zhEl) return;
    const nextPair = {
      en: pair?.en || slot.source,
      zh: String(pair?.zh || ""),
      dict: !!pair?.dict,
      sourceLanguage: pair?.sourceLanguage || slot.sourceLanguage || "auto",
      targetLanguage: pair?.targetLanguage || slot.targetLanguage || "zh-Hans",
      detectedLanguage: pair?.detectedLanguage || "",
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
    zhEl.className = nextPair.dict
      ? "mini-dict-line mini-target-line"
      : "mini-zh-line mini-target-line";
    zhEl.replaceChildren();
    applyLanguageAttrs(zhEl, nextPair.targetLanguage, nextPair.zh);
    applyLanguageAttrs(slot.enEl, nextPair.detectedLanguage || nextPair.sourceLanguage, nextPair.en);
    renderRichText(
      zhEl,
      formatTextForLanguage(nextPair.zh, nextPair.targetLanguage, {
        dictionary: nextPair.dict,
      })
    );
    this._refreshPopupText();
    if (via) {
      const labelSpan = this.popupHeaderEl?.querySelector("span");
      if (labelSpan) {
        labelSpan.textContent = translationHeaderLabel(
          via,
          nextPair.sourceLanguage,
          nextPair.targetLanguage,
          nextPair.detectedLanguage
        );
      }
    }
    this._placePopup(this.popupEl);
    window.requestAnimationFrame?.(() => this._placePopup(this.popupEl));
  }

  updatePopupPairs(pairs, via) {
    if (!this.popupEl || !this.popupBodyEl) {
      // A result must never resurrect at an arbitrary screen corner. Reuse the last
      // verified text anchor; if none exists, keep the result in the side panel only.
      if (!this.lastPopupAnchor) return;
      const a = this._normalizePopupAnchor(null, null, this.lastPopupAnchor);
      this.showPopup("", a.left, a.bottom + 6, via, false, a);
    }
    const list = Array.isArray(pairs) ? pairs : [];
    if (
      this._popupSlotBody !== this.popupBodyEl ||
      !Array.isArray(this._popupSlots) ||
      this._popupSlots.length !== list.length
    ) {
      this.showPopupSources(
        list.map((p) => ({
          en: p.en,
          dict: p.dict,
          sourceLanguage: p.sourceLanguage,
          targetLanguage: p.targetLanguage,
          detectedLanguage: p.detectedLanguage,
        })),
        via
      );
    }
    const labelSpan = this.popupHeaderEl?.querySelector("span");
    if (labelSpan) {
      const p = list[0] || {};
      labelSpan.textContent = translationHeaderLabel(
        via,
        p.sourceLanguage || this.settings.sourceLanguage,
        p.targetLanguage || this.settings.targetLanguage,
        p.detectedLanguage || ""
      );
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
      new Notice(t("translation.failed_detail", { message: msg }), 8000);
      return;
    }
    const labelSpan = this.popupHeaderEl.querySelector("span");
    if (labelSpan) labelSpan.textContent = t("translation.failed");
    this._cancelPopupStreams();
    this._popupTranslationDone = true;
    this.pendingLabel = null;
    this.popupBodyEl.empty();
    this.popupBodyEl.setText(msg);
    this._placePopup(this.popupEl);
  }

  closePopup() {
    this._popupRunId = (this._popupRunId || 0) + 1;
    if (this._popupRememberTimer != null) {
      window.clearTimeout(this._popupRememberTimer);
      this._popupRememberTimer = null;
    }
    if (this._popupResizeDirty && this.popupEl) {
      this._rememberCurrentPopupSize(this.popupEl);
    }
    if (this._popupResizeEnd) {
      window.removeEventListener("pointerup", this._popupResizeEnd, true);
      window.removeEventListener("pointercancel", this._popupResizeEnd, true);
      window.removeEventListener("mouseup", this._popupResizeEnd, true);
      window.removeEventListener("blur", this._popupResizeEnd, true);
      this._popupResizeEnd = null;
    }
    this._popupResizeActive = false;
    this._popupTranslationDone = false;
    this._popupPlacement = null;
    this._popupHorizontalAlignment = null;
    this._popupUserResized = false;
    this._popupResizeDirty = false;
    this._popupObservedInlineSize = null;
    this._popupSizeMetrics = null;
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
    if (this._popupResizeObserver) {
      this._popupResizeObserver.disconnect();
      this._popupResizeObserver = null;
    }
    if (this._popupResizeFrame != null) {
      if (typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(this._popupResizeFrame);
      } else {
        window.clearTimeout?.(this._popupResizeFrame);
      }
      this._popupResizeFrame = null;
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

  async translateSelection(mode = "sentence", selectionSnapshot = null) {
    console.log("[mini-translator] 命令已触发");
    const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
    let text = "";
    let x = null;
    let y = null;
    let anchor = null;
    const takeSelectionInfo = (info) => {
      if (!info?.text) return false;
      text = String(info.text).trim();
      anchor = info.anchor || null;
      const hasFiniteCoord = (value) =>
        value != null && Number.isFinite(Number(value));
      x = hasFiniteCoord(info.x) ? Number(info.x) : anchor?.left ?? null;
      y = hasFiniteCoord(info.y)
        ? Number(info.y)
        : anchor
          ? anchor.bottom + 6
          : null;
      return !!text;
    };

    // Auto-translate captures the actual DOM range at selection time. Using that
    // snapshot avoids a delayed callback querying stale editor coordinates.
    if (selectionSnapshot?.text) takeSelectionInfo(selectionSnapshot);

    if (!text && mdView) {
      // Reading view and modern CodeMirror both expose a real DOM range. Prefer it
      // because getBoundingClientRect() is already in viewport coordinates.
      const domInfo = this._readDomSelectionInfo(
        window.getSelection(),
        mdView.containerEl || mdView.editor?.containerEl || null
      );
      if (domInfo) takeSelectionInfo(domInfo);
    }

    if (!text && mdView?.editor) {
      text = (mdView.editor.getSelection() || "").trim();
      anchor = this._editorSelectionAnchor(mdView.editor);
      if (anchor) {
        x = anchor.left;
        y = anchor.bottom + 6;
      }
    }
    if (text && !anchor && mdView?.editor) {
      anchor = this._editorSelectionAnchor(mdView.editor);
      if (anchor) {
        x = anchor.left;
        y = anchor.bottom + 6;
      }
    }

    // Also support native selections in non-Markdown views. PDF iframe selections
    // still use getPdfSelectionInfo below because their coordinates need an offset.
    if (!text && !mdView) {
      const domInfo = this._readDomSelectionInfo(window.getSelection());
      if (domInfo) takeSelectionInfo(domInfo);
    }

    if (!text) {
      const info = this.getPdfSelectionInfo();
      if (info) takeSelectionInfo(info);
    }
    if (!text) {
      new Notice(t("translation.no_selection"), 6000);
      return;
    }

    // Last-resort anchor for adapters that provide selection text but no geometry.
    // Never fall back to an arbitrary screen corner: that was the main source of the
    // apparent "flying" popup outside PDFs.
    if (!anchor) {
      anchor = this._lastPointerAnchor(
        mdView?.containerEl || mdView?.editor?.containerEl || null
      );
    }
    if (!anchor && Number.isFinite(x) && Number.isFinite(y)) {
      anchor = { left: x, top: y - 28, right: x, bottom: y - 6 };
    }
    if (!anchor) {
      new Notice(t("translation.no_anchor"), 4500);
      return;
    }
    anchor = this._normalizePopupAnchor(x, y, anchor);
    x = anchor.left;
    y = anchor.bottom + 6;

    const sourceLanguage = safeLanguageCode(
      this.settings.sourceLanguage,
      true
    );
    const targetLanguage = safeLanguageCode(this.settings.targetLanguage);
    // 源文本规范化：清不可见字符、还原 Unicode 数学字符，并按原文文字系统
    // 合并 PDF 硬换行/断词。弹窗展示与实际发给翻译源的内容保持一致。
    text = normalizeTranslationInput(text, sourceLanguage);
    // 立刻弹窗；译文返回后直接填充，不额外等待或播放打字机动画。
    const px = x;
    const py = y;
    const isWord =
      WORD_RE.test(text) &&
      (sourceLanguage === "auto" || sourceLanguage === "en") &&
      targetLanguage === "zh-Hans";
    const sentenceList =
      !isWord && mode !== "paragraph"
        ? splitSentences(text, sourceLanguage)
        : null;
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
        : `src:${translationSourceKey(
            this.settings.primarySource,
            sourceLanguage,
            targetLanguage
          )}:${value}`;
      return {
        en: value,
        dict: isWord,
        sourceLanguage,
        targetLanguage,
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
      const fmtDict = (t) =>
        formatTextForLanguage(t, targetLanguage, { dictionary: true });
      const fmtFlow = (t) => formatTextForLanguage(t, targetLanguage);
      const fmtSource = (t) => formatTextForLanguage(t, sourceLanguage);
      if (isWord) {
        const key = `dict:${sourceKey(this.settings.dictSource)}:${text}`;
        const r = await cached(key, () => dictLookup(text, this.settings.dictSource));
        const pair = {
          en: fmtSource(text),
          zh: fmtDict(r.text),
          dict: true,
          sourceLanguage,
          targetLanguage,
          detectedLanguage: "en",
        };
        pairs.push(pair);
        if (this._popupRunId === popupRunId) {
          this.updatePopupTranslation(0, pair, r.via);
        }
        via = r.via;
      } else if (wholeText) {
        const key = `src:${translationSourceKey(
          this.settings.primarySource,
          sourceLanguage,
          targetLanguage
        )}:${text}`;
        const r = await cached(
          key,
          () =>
            translateSentence(
              text,
              this.settings.primarySource,
              sourceLanguage,
              targetLanguage
            )
        );
        const pair = {
          en: fmtSource(text),
          zh: fmtFlow(r.text),
          sourceLanguage,
          targetLanguage,
          detectedLanguage: r.detectedLanguage,
        };
        pairs.push(pair);
        if (this._popupRunId === popupRunId) {
          this.updatePopupTranslation(0, pair, r.via);
        }
        via = r.via;
      } else if (mode === "paragraph") {
        // 整段翻译：一次请求，原文段与译文段上下对照
        const r = await cached(
          `src:${translationSourceKey(
            this.settings.primarySource,
            sourceLanguage,
            targetLanguage
          )}:${text}`,
          () =>
            translateSentence(
              text,
              this.settings.primarySource,
              sourceLanguage,
              targetLanguage
            )
        );
        const pair = {
          en: fmtSource(text),
          zh: fmtFlow(r.text),
          sourceLanguage,
          targetLanguage,
          detectedLanguage: r.detectedLanguage,
        };
        pairs.push(pair);
        if (this._popupRunId === popupRunId) {
          this.updatePopupTranslation(0, pair, r.via);
        }
        via = r.via;
      } else {
        // 非流式的内置引擎仍按句对齐；每个响应到达后立即填充，不再追加展示动画。
        const sentences = sentenceList || splitSentences(text, sourceLanguage);
        const vias = new Set();
        for (let i = 0; i < sentences.length; i++) {
          if (this._popupRunId !== popupRunId) return;
          const r = await cached(
            `src:${translationSourceKey(
              this.settings.primarySource,
              sourceLanguage,
              targetLanguage
            )}:${sentences[i]}`,
            () =>
              translateSentence(
                sentences[i],
                this.settings.primarySource,
                sourceLanguage,
                targetLanguage
              )
          );
          if (this._popupRunId !== popupRunId) return;
          const pair = {
            en: fmtSource(sentences[i]),
            zh: fmtFlow(r.text),
            sourceLanguage,
            targetLanguage,
            detectedLanguage: r.detectedLanguage,
          };
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
      // 到这里译文已经完整输出；从现在起弹窗外单击即可关闭，不再视为取消翻译。
      if (this._popupRunId === popupRunId) this._popupTranslationDone = true;
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
    const pdfLeaves = this.app.workspace.getLeavesOfType("pdf");
    // 点击侧边栏按钮后“最近叶子”可能已经变成侧边栏本身；此时优先找
    // workspace 仍记录的当前 PDF 文件，避免多开 PDF 时误翻第一份。
    if (!isPdf(leaf)) {
      const activeFile = this.app.workspace.getActiveFile?.();
      if (activeFile?.extension === "pdf") {
        leaf = pdfLeaves.find((l) => l.view?.file?.path === activeFile.path);
      }
    }
    if (!isPdf(leaf)) leaf = pdfLeaves[0];
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

  markFullTranslationViews() {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      const file = view?.file;
      if (!file || !view?.containerEl) continue;
      let frontmatter = null;
      try {
        frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter || null;
      } catch (e) {}
      const isFull =
        frontmatter?.type === "full-translation" ||
        /·翻译(?: \d+)?\.md$/i.test(file.name || "");
      view.containerEl
        .querySelectorAll(".markdown-preview-view, .markdown-source-view")
        .forEach((el) =>
          el.classList.toggle("mini-translator-full-translation", isFull)
        );
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
    new Notice(t("full.llm_required"), 8000);
    return false;
  }

  async fullTranslateFlow() {
    if (!this.ensureLlmForFull()) return;
    const loc = await this.locatePdfDoc();
    if (!loc) {
      new Notice(t("full.no_open_pdf"), 6000);
      return;
    }
    const doc = loc.doc;
    const file = loc.leaf.view.file;
    new Notice(t("full.extracting_notice"), 3000);
    let blocks = [];
    try {
      const r = await extractDocBlocks(doc, (i, n) =>
        this.setFullTranslateStatus(`MT · ${phaseName("提取文本")} ${i}/${n}`)
      );
      blocks = r.blocks;
    } catch (e) {
      this.clearFullTranslateStatus();
      new Notice(t("full.extract_failed", { message: e.message }), 8000);
      return;
    }
    this.clearFullTranslateStatus();
    if (this.ftCancel) {
      this.resetFtCancel();
      new Notice(t("full.cancelled"), 2000);
      return;
    }
    const transChars = blocks.reduce((n, b) => n + b.text.length, 0);
    if (!transChars) {
      new Notice(t("full.no_extractable_text"), 8000);
      return;
    }
    const info = this.buildDocInfo(
      file || { name: t("full.unknown_file"), path: "" },
      blocks
    );
    info.doc = doc;
    info.blocks = blocks;
    new FullTranslateModal(this.app, this, info).open();
  }

  // 从块结构构建任务信息（当前 PDF 与多选弹窗共用）：批次划分、token/耗时估算
  // （全文翻译为大模型源专用，全部块都进管线）
  buildDocInfo(file, blocks) {
    const batches = groupIntoBatches(blocks);
    let chars = 0;
    for (const b of blocks) chars += b.text.length;
    const prof = findProfile(this.settings.primarySource);
    const pages = blocks.reduce((m, b) => Math.max(m, b.page), 0);
    const sourceLanguage = safeLanguageCode(this.settings.sourceLanguage, true);
    const targetLanguage = safeLanguageCode(this.settings.targetLanguage);
    return {
      fileName: file.name,
      pdfPath: file.path,
      pages,
      chars,
      transN: blocks.length,
      chunks: batches.length,
      sourceLanguage,
      targetLanguage,
      languagePair: languagePairLabel(sourceLanguage, targetLanguage),
      source:
        providerName(this.settings.primarySource) +
        (prof && prof.activeModel
          ? getUiLanguage() === "en"
            ? ` (${prof.activeModel})`
            : `（${prof.activeModel}）`
          : "") +
        ` · ${languagePairLabel(sourceLanguage, targetLanguage, true)}`,
      eta: t("full.about_minutes", {
        minutes: Math.max(1, Math.ceil((batches.length * 3.5) / 60)),
      }),
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

  reportFullTranslateFailure(error, info = null, options = {}) {
    const message = String(error?.message || error || t("common.unknown_error"));
    const fileName = info?.fileName
      ? getUiLanguage() === "en"
        ? `“${info.fileName}”`
        : `「${info.fileName}」`
      : "";
    console.error(
      `[mini-translator] ${fileName || "全文翻译"}失败:`,
      error
    );
    this.clearFullTranslateStatus();
    this.resetFtCancel();
    // 单文件任务把错误留在进度窗里，避免短暂 Notice 被忽略；批量任务还要继续
    // 下一份文件，因此只弹 Notice，进度窗继续复用。
    if (!options.batch && this.progModal) {
      this.progModal.fail(
        `${fileName ? `${fileName}${getUiLanguage() === "en" ? ": " : "："}` : ""}${message}`
      );
    }
    new Notice(
      fileName
        ? t("full.failed_notice", { file: fileName, message })
        : t("full.failed_generic", { message }),
      12000
    );
    return message;
  }

  // 多选批量全文翻译：逐份顺序执行，中途可取消，只打开最后一份结果
  async runPickedTranslate(jobs) {
    if (!this.ensureLlmForFull()) return;
    let ok = 0;
    let failed = 0;
    let batchCancelled = false;
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
        if (!info.chars)
          throw new Error(t("full.scanned_requires_ocr"));
        info.doc = doc;
        info.blocks = blocks;
        info.openResult = i === jobs.length - 1; // 批量时只打开最后一个结果
        info.batchLabel = `${i + 1}/${jobs.length}`;
        const cancelled = await this.runFullTranslate(info);
        if (cancelled) {
          batchCancelled = true;
          new Notice(t("full.batch_cancelled"), 3000);
          break;
        }
        ok++;
      } catch (e) {
        failed++;
        this.reportFullTranslateFailure(
          e,
          { fileName: job.file.name },
          { batch: true }
        );
      }
    }
    this.endProg();
    if (jobs.length > 1)
      new Notice(
        t("full.batch_finished", {
          ok,
          failed,
          cancelled: batchCancelled ? t("full.batch_remainder_cancelled") : "",
        }),
        6000
      );
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
    const htmlName = htmlPath.split("/").pop();
    this.resetFtCancel();
    const t0 = Date.now();
    const d = new Date();
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    this.ensureProg();
    const fileTag = `${info.batchLabel ? "[" + info.batchLabel + "] " : ""}${info.fileName}`;

    // 阶段1：批量翻译（逐块缓存，批解析失败自动降级）
    const translated = await translateBlocksAll(
      this,
      info.blocks,
      this.settings.primarySource,
      (st) => this.progUpdate({ ...st, fileTag }),
      info.sourceLanguage,
      info.targetLanguage
    );
    // 同一份经过公式修复的译文同时供 Markdown 与 HTML 使用，避免两个输出表现不一致。
    const results = translated.results.map((r) =>
      !r || isFailedFullBlock(r)
        ? r
        : { ...r, zh: formatFullTranslationText(r.zh, info.targetLanguage) }
    );

    // 取消后快速收尾：跳过页面渲染与结果打开，只写部分 md（已翻部分有缓存，重跑秒回）
    const wasCancelled = !!this.ftCancel;

    // 阶段2：绘制指令只用于判断“哪些页含位图”，不再按单个位图 bbox 自动裁
    // Figure。论文复合图常混用位图、矢量、文字和蒙版，结构层 bbox 并不是语义
    // 图框；强行裁切会得到碎片、重复图或截断图注。
    let figureRegions = new Map();
    if (info.doc && !wasCancelled) {
      try {
        figureRegions = await detectRasterFigures(this, info.doc, (i, n) =>
          this.progUpdate({ fileTag, phase: "检测含图页", done: i, total: n })
        );
      } catch (e) {
        console.warn("[mini-translator] PDF 图片识别失败:", e);
        new Notice(
          t("full.figure_detect_failed", { message: e.message || e }),
          5000
        );
      }
    }

    // 图注是矢量文字时可能没有 raster operator，因此把 Figure/Table caption 所在
    // 页也纳入。即使误判，也只会多保留一张完整原页，不会再错误裁图。
    let pageImgs = [];
    const captionPages = info.blocks
      .filter((b) => /^(?:figure|table)-caption$/.test(b.kind || ""))
      .map((b) => b.page);
    const figurePages = [...new Set([...figureRegions.keys(), ...captionPages])].sort(
      (a, b) => a - b
    );
    if (
      info.doc &&
      !wasCancelled &&
      (this.settings.fullHtml || figurePages.length > 0)
    ) {
      try {
        pageImgs = await renderPageImages(
          this,
          info.doc,
          1.5,
          0.9,
          (i, n) => this.progUpdate({ fileTag, phase: "渲染页面", done: i, total: n }),
          this.settings.fullHtml ? null : figurePages
        );
      } catch (e) {
        pageImgs = [];
        new Notice(t("full.page_render_failed", { message: e.message }), 6000);
      }
    }

    // 阶段3：每个含图/表页只保存一张完整原页并折叠显示。这比“看似智能但经常
    // 截错”的自动裁图可靠；取消任务时仍只清理本次新建目录。
    const imgDir = path.replace(/\.md$/i, "") + "·图片";
    let createdImgDir = false;
    const figureAssetsByPage = new Map();
    let figureWriteFailures = 0;
    if (figurePages.length && pageImgs.some(Boolean)) {
      try {
        if (!(await this.app.vault.adapter.exists(imgDir))) {
          await this.app.vault.createFolder(imgDir);
          createdImgDir = true;
        }
        let written = 0;
        const expected = figurePages.length;
        for (const pageNo of figurePages) {
          const pageImage = pageImgs[pageNo - 1];
          if (!pageImage) continue;
          const ipath = `${imgDir}/page-${pageNo}.jpg`;
          try {
            await this.app.vault.adapter.writeBinary(
              ipath,
              dataUrlToBuffer(pageImage.dataUrl)
            );
            written++;
            figureAssetsByPage.set(pageNo, [{ path: ipath, page: pageNo }]);
            this.progUpdate({
              fileTag,
              phase: "写入含图原页",
              done: written,
              total: expected,
            });
          } catch (e) {
            figureWriteFailures++;
            console.warn("[mini-translator] 含图原页写入失败:", ipath, e);
          }
        }
      } catch (e) {
        figureWriteFailures++;
        console.warn("[mini-translator] 含图原页附件目录创建失败:", e);
      }
    }

    // 阶段4：装配宽松可读的 Markdown 笔记与原文对照 HTML。
    this.progUpdate({ fileTag, phase: "写入文件", done: 0, total: 1 });
    const blocksByPage = new Map();
    info.blocks.forEach((b, i) => {
      if (!blocksByPage.has(b.page)) blocksByPage.set(b.page, []);
      blocksByPage.get(b.page).push(i);
    });

    const totalPages = info.doc?.numPages || info.pages;
    const figureAssetCount = [...figureAssetsByPage.values()].reduce(
      (sum, assets) => sum + assets.length,
      0
    );
    const resultTitle = t("full.result_title", { name: base });
    let md =
      "---\n" +
      `title: "${resultTitle}"\n` +
      "type: full-translation\n" +
      "cssclasses:\n" +
      "  - mini-translator-full-translation\n" +
      `  - mini-translator-script-${languageInfo(info.targetLanguage).script}\n` +
      `source_file: "${info.pdfPath}"\n` +
      `source_language: "${info.sourceLanguage}"\n` +
      `target_language: "${info.targetLanguage}"\n` +
      `translated_with: "${info.source}"\n` +
      `created: ${ymd}\n` +
      "---\n\n" +
      `# ${resultTitle}\n\n` +
      `> ${t("full.generated_intro", {
        source: info.source,
        sourceLanguage: languageInfo(info.sourceLanguage).label,
        targetLanguage: languageInfo(info.targetLanguage).label,
      })}` +
      (figureAssetCount
        ? t("full.generated_figures", { count: figureAssetCount })
        : "") +
      (this.settings.fullHtml
        ? `${t("full.generated_html", { name: htmlName })}\n`
        : "\n") +
      (languageQualityNotice(info.sourceLanguage, info.targetLanguage)
        ? `\n> [!warning] ${t("full.review_heading")}\n> ${languageQualityNotice(info.sourceLanguage, info.targetLanguage)}\n`
        : "");

    let failures = [];
    let doneBlocks = 0;
    for (let p = 1; p <= totalPages; p++) {
      md += `\n## ${t("full.page_heading", { page: p })}\n\n`;
      const idxs = blocksByPage.get(p) || [];
      const figures = figureAssetsByPage.get(p) || [];
      for (const asset of figures) {
        md +=
          `> [!figure]- ${t("full.figure_page", { page: p })}\n` +
          `> ![[${asset.path}|900]]\n\n`;
      }
      const bodyIdxs = idxs.filter((gi) => info.blocks[gi]?.kind !== "footnote");
      const footnoteIdxs = idxs.filter((gi) => info.blocks[gi]?.kind === "footnote");
      for (const gi of bodyIdxs) {
        const res = results[gi];
        if (!res || !res.zh) continue; // 取消时未翻到的块跳过
        if (isFailedFullBlock(res)) failures.push(gi + 1);
        md += formatFullMarkdownBlock(res.zh, info.blocks[gi], p) + "\n\n";
        doneBlocks++;
      }
      if (footnoteIdxs.some((gi) => results[gi]?.zh)) {
        md += `> [!note] ${t("full.page_footnotes")}\n`;
        for (const gi of footnoteIdxs) {
          const res = results[gi];
          if (!res || !res.zh) continue;
          if (isFailedFullBlock(res)) failures.push(gi + 1);
          md += `> ${String(res.zh).replace(/\n/g, "\n> ")}\n>\n`;
          doneBlocks++;
        }
        md += "\n";
      }
    }

    const wasCancelledFlag = results.some((r, i) => !r);
    if (this.ftCancel || wasCancelledFlag) {
      md += `\n> [!note] ${t("full.partial_cancelled", {
        done: doneBlocks,
        total: info.transN,
      })}\n`;
    }
    if (figureWriteFailures) {
      md += `\n> [!warning] ${t(
        this.settings.fullHtml
          ? "full.figure_write_warning_html"
          : "full.figure_write_warning_pdf",
        { count: figureWriteFailures }
      )}\n`;
    }
    md += `\n---\n\n*${t("full.summary", {
      pages: totalPages,
      done: doneBlocks,
      total: info.transN,
      figures: figureAssetCount,
      seconds: Math.round((Date.now() - t0) / 1000),
      failures: failures.length
        ? t("full.summary_failures", {
            blocks: failures.join(getUiLanguage() === "en" ? ", " : "、"),
          })
        : "",
    })}*\n`;
    try {
      await this.app.vault.adapter.write(path, md);
    } catch (error) {
      throw new Error(
        t("full.markdown_write_failed", { message: error?.message || error })
      );
    }

    // 原文对照 HTML：左侧整页原文，右侧译文自然排版；定位框只在交互时高亮，
    // 不含文字、不遮住图表，也不会因“打开原文”产生双层内容。
    let htmlWritten = false;
    if (this.settings.fullHtml && pageImgs.some(Boolean)) {
      try {
        const pages = pageImgs.map((img, pi2) => {
          if (!img) throw new Error(t("full.page_render_missing", {
            page: pi2 + 1,
          }));
          const blks = [];
          for (const gi of blocksByPage.get(pi2 + 1) || []) {
            const b = info.blocks[gi];
            const res = results[gi] || { en: "", zh: "" };
            const bad = !res.zh || isFailedFullBlock(res);
            blks.push({
              skip: bad,
              orig: b.text,
              en: res.en,
              zh: bad ? "" : res.zh,
              kind: b.kind || "body",
              rect: blockRectPct(b, img.vp, img.w, img.h),
              rects: (b.rects?.length ? b.rects : [b]).map((r) =>
                blockRectPct(r, img.vp, img.w, img.h)
              ),
            });
          }
          return { img: img.dataUrl, blocks: blks };
        });
        const html = buildReplicaHtml(
          {
            title: resultTitle,
            source: info.source,
            sourceLanguage: info.sourceLanguage,
            targetLanguage: info.targetLanguage,
          },
          pages
        );
        await this.app.vault.adapter.write(htmlPath, html);
        htmlWritten = true;
      } catch (e) {
        new Notice(t("full.html_failed", { message: e.message }), 6000);
      }
    }

    // 原页附件和 HTML 序列化已经完成，尽快释放大页 canvas 的像素内存。
    for (const img of pageImgs) if (img) img.canvas = null;

    // 取消时删除本次生成的产物；图片目录只有本轮新建时才递归清理。
    const cancelled = wasCancelled || wasCancelledFlag || this.ftCancel;
    if (cancelled) {
      try { await this.app.vault.adapter.remove(path); } catch (e) {}
      try { await this.app.vault.adapter.remove(htmlPath); } catch (e) {}
      if (createdImgDir) {
        try {
          if (await this.app.vault.adapter.exists(imgDir))
            await this.app.vault.adapter.rmdir(imgDir, true);
        } catch (e) {}
      }
    }

    this.clearFullTranslateStatus();
    // 完成后不自动跳转到译文文件（不抢当前工作区焦点），产出路径在通知里给出
    this.resetFtCancel();
    this.endProg();
    // 原文对照 HTML 用系统浏览器打开；批量时只在最后一份打开。
    if (info.openResult !== false && htmlWritten && !cancelled) {
      try {
        const abs = this.app.vault.adapter.getFullPath(htmlPath);
        shell.openPath(abs);
      } catch (e) {}
    }
    new Notice(
      cancelled
        ? t("full.finished_cancelled")
        : failures.length
          ? t("full.finished_with_failures", {
              count: failures.length,
              path,
            })
          : t("full.finished", { path }),
      6000
    );
    return cancelled; // 告诉批量调用方要不要继续下一份
  }
};
