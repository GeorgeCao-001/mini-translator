// 核心行为测试：stub 'obsidian' 后加载真实 main.js 源码，验证关键函数。
const Module = require("module");
const nodePath = require("path");
const PROJECT_ROOT = nodePath.resolve(__dirname, "..");
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "obsidian") {
    class FakeComponent {}
    return new Proxy(
      {},
      {
        get: (t, k) => {
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
            ].includes(k)
          )
            return class extends FakeComponent {};
          return () => {};
        },
      }
    );
  }
  return origLoad.call(this, request, parent, isMain);
};

const fs = require("fs");
const vm = require("vm");
const src = fs.readFileSync(nodePath.join(PROJECT_ROOT, "main.js"), "utf8");
const sourceRequire = (request) =>
  request === "./src/i18n.js"
    ? require(nodePath.join(PROJECT_ROOT, "src", "i18n.js"))
    : require(request);
const sandbox = { window: {}, document: {}, console, Notice: class {}, require: sourceRequire, module: { exports: {} }, atob: (s) => Buffer.from(s, "base64").toString("binary"), btoa: (s) => Buffer.from(s, "binary").toString("base64") };
vm.createContext(sandbox);
vm.runInContext(src + "\n;__exports = { normalizeMathDelims, groupIntoBatches, parseBatchResponse, FULL_CONCURRENCY, loadPdfJs, pdfItemsToBlocks, detectPdfColumnLayout, detectPdfFootnoteLines, pdfFootnoteExplicitSignal, orderPdfPageLines, mergeLinesToParas, joinColumnContinuationParas, joinCrossPageContinuationBlocks, choosePopupPlacement, resolvePopupPlacement, normalizeRememberedPopupSize, pdfLineKind, formatFullMarkdownBlock, TRANSLATION_LANGUAGES, languageInfo, languagePairLabel, needsAiOnlyDisclaimer, providerLanguageCode, engineSupportsPair, formatTextForLanguage, normalizeTranslationInput, buildTranslatePrompt, buildFullPrompt, cnkiEncrypt, translationSourceKey };", sandbox);
const X = sandbox.__exports;

let fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) console.log("PASS", name);
  else {
    fail++;
    console.log("FAIL", name, "\n  got:", g, "\n  want:", w);
  }
}

// --- 多语言：稳定语言目录、语言对、排版和动态提示词 ---
eq("language-catalog-broad", X.TRANSLATION_LANGUAGES.length >= 70, true);
eq("language-pair-label", X.languagePairLabel("auto", "ja"), "自动识别 → 日语");
eq("rtl-language-direction", X.languageInfo("ar").dir, "rtl");
eq("ai-only-disclaimer-for-ja", X.needsAiOnlyDisclaimer("en", "ja"), true);
eq("reviewed-en-zh-no-disclaimer", X.needsAiOnlyDisclaimer("en", "zh-Hans"), false);
eq("google-traditional-code", X.providerLanguageCode("google", "zh-Hant"), "zh-TW");
eq("cnki-rejects-japanese", X.engineSupportsPair("CNKI", "ja", "zh-Hans"), false);
eq("cnki-allows-en-zh", X.engineSupportsPair("CNKI", "en", "zh-Hans"), true);
eq("cjk-hard-wrap-joins-without-space", X.formatTextForLanguage("第一行\n第二行", "zh-Hans"), "第一行第二行");
eq("cjk-keeps-latin-word-boundary", X.formatTextForLanguage("使用 deep\nlearning 方法", "zh-Hans"), "使用 deep learning 方法");
eq("latin-hard-wrap-joins-with-space", X.formatTextForLanguage("first\nsecond", "en"), "first second");
eq("dynamic-prompt-target", X.buildTranslatePrompt("auto", "fr").includes("法语（fr）"), true);
eq("full-prompt-generic-markers", /⟦SRC数字⟧[\s\S]*⟦TGT数字⟧/.test(X.buildFullPrompt("de", "en", 3)), true);
eq("cache-key-isolates-language-pair", X.translationSourceKey("火山", "en", "ja"), "火山:en>ja");
eq("cnki-encryption-known-vector", X.cnkiEncrypt("hello"), "_A_L_j-ygxwLtAI2yfvk8w==");

// --- normalizeMathDelims：\[ \] → $$..$$（带空行隔离） ---
eq(
  "display-delim",
  X.normalizeMathDelims("text \\[\ny = mx+b\n\\] tail"),
  "text \n\n$$\ny = mx+b\n$$\n\n tail"
);
// \( \) → $..$
eq("inline-delim", X.normalizeMathDelims("a \\(x^2\\) b"), "a $x^2$ b");
// 相邻 $$..$$$$..$$ 粘连被拆开（闭合与开定界符之间补空行）
eq("junction-split", X.normalizeMathDelims("$$a$$$$b$$"), "$$a$$\n\n$$b$$");
eq("noop-plain", X.normalizeMathDelims("no math here"), "no math here");
eq("empty-safe", X.normalizeMathDelims(""), "");

// 已是 $/$$ 的内容不被二次破坏
eq(
  "dollar-preserved",
  X.normalizeMathDelims("we use $\\ell_2$ norm"),
  "we use $\\ell_2$ norm"
);

// 图注/章节标题的识别与 Markdown 投影：冒号可省略，表格 caption 不能丢，目录页不升格。
eq("figure-caption-no-colon", X.pdfLineKind("Figure 7 Visual representation priors"), "figure-caption");
eq("table-caption-kept", X.pdfLineKind("Table 5 Evaluation Results on LIBERO-Plus"), "table-caption");
eq("bullet-line-kind", X.pdfLineKind("• A distinct contribution."), "list-item");
eq("numbered-heading", X.pdfLineKind("4.1.1 Generative World Priors"), "body");
eq(
  "markdown-heading-level",
  X.formatFullMarkdownBlock("生成式世界先验", { kind: "body", text: "4.1.1 Generative World Priors" }, 3),
  "##### 生成式世界先验"
);
eq(
  "toc-stays-paragraph",
  X.formatFullMarkdownBlock("1 引言", { kind: "heading", text: "1 Introduction" }, 2),
  "1 引言"
);
eq(
  "bullet-renders-as-markdown-list",
  X.formatFullMarkdownBlock("• 第一项贡献", { kind: "list-item", text: "• First contribution" }, 2),
  "- 第一项贡献"
);

// --- groupIntoBatches：全部块都进批次（不再按 isSkippableBlock 过滤） ---
const blocks = [
  { text: "short" },
  { text: "x".repeat(30) }, // 字母占比 <0.35 → 旧逻辑会跳过
  { text: "normal english sentence with many letters here" },
];
eq("all-blocks-batched", X.groupIntoBatches(blocks).length >= 1, true);
eq(
  "all-blocks-counted",
  X.groupIntoBatches(blocks).reduce((n, b) => n + b.length, 0),
  blocks.length
);

// 大批量切分仍受 8 块/批上限约束。
const many = Array.from({ length: 20 }, (_, i) => ({ text: `block ${i} some english words` }));
eq("cap-8-per-batch", Math.max(...X.groupIntoBatches(many).map((b) => b.length)) <= 8, true);
eq("concurrency-set", X.FULL_CONCURRENCY, 3);
const bodyAndNotes = [
  { text: "body one", kind: "body" },
  { text: "note one", kind: "footnote" },
  { text: "note two", kind: "footnote" },
  { text: "body two", kind: "body" },
];
eq(
  "footnotes-batched-away-from-body",
  X.groupIntoBatches(bodyAndNotes).map((batch) =>
    [...new Set(batch.map((i) => bodyAndNotes[i].kind))]
  ),
  [["body"], ["footnote"], ["body"]]
);

// --- PDF 版面顺序：同一高度的左右栏绝不能横向粘成一句 ---
const item = (str, x, y, width, hasEOL = true, rot = false, size = 10) => ({
  str,
  width,
  hasEOL,
  transform: rot ? [0, size, -size, 0, x, y] : [size, 0, 0, size, x, y],
});
const synthetic = [item("A full width paper title", 60, 750, 480)];
// 故意把内容流做成逐行左右交替；版面恢复仍应先完整读左栏，再读右栏。
for (let i = 0; i < 6; i++) {
  synthetic.push(item(`Left column sentence number ${i}.`, 50, 700 - i * 12, 245));
  synthetic.push(item(`Right column sentence number ${i}.`, 315, 700 - i * 12, 235));
}
synthetic.unshift(item("rotated arxiv margin", 28, 300, 180, true, true));
const logical = X.pdfItemsToBlocks(synthetic, 600);
eq("rotated-margin-dropped", logical.some((l) => /arxiv/.test(l.text)), false);
const layout = X.detectPdfColumnLayout(logical, 600);
eq("two-column-detected", !!layout, true);
const ordered = X.orderPdfPageLines(logical, 600, 800).lines;
const orderText = ordered.map((l) => l.text).join("|");
eq(
  "left-column-before-right-column",
  orderText.indexOf("Left column sentence number 5") <
    orderText.indexOf("Right column sentence number 0"),
  true
);

// 第一页跨栏标题和同一基线上的作者碎片应先重组，不能掉进左右正文栏。
const frontMatterItems = [
  item("A Large Cross-Column Paper", 85, 745, 430, true, false, 24),
  item("with a Second Title Line", 150, 715, 300, true, false, 24),
  item("Author One", 160, 680, 125, true, false, 11),
  item(", Author Two", 315, 680, 125, true, false, 11),
];
for (let i = 0; i < 7; i++) {
  frontMatterItems.push(item(`Left body line ${i} contains enough prose words.`, 50, 620 - i * 14, 245));
  frontMatterItems.push(item(`Right body line ${i} contains enough prose words.`, 315, 620 - i * 14, 235));
}
const frontOrdered = X.orderPdfPageLines(
  X.pdfItemsToBlocks(frontMatterItems, 600),
  600,
  800,
  1
).lines;
const frontParas = X.mergeLinesToParas(frontOrdered);
eq(
  "first-page-title-kept-whole",
  frontParas.find((p) => p.kind === "title")?.text,
  "A Large Cross-Column Paper with a Second Title Line"
);
eq(
  "first-page-authors-rejoined",
  frontParas.some((p) => p.text === "Author One, Author Two"),
  true
);

// 即使 PDF 忘记 hasEOL，同基线跨越中央栏沟的两个文本项也必须拆开。
const sameBaseline = X.pdfItemsToBlocks(
  [
    item("Left side remains independent", 50, 500, 245, false),
    item("Right side remains independent", 315, 500, 235, false),
  ],
  600
);
eq("same-baseline-column-split", sameBaseline.map((l) => l.text), [
  "Left side remains independent",
  "Right side remains independent",
]);

const single = Array.from({ length: 10 }, (_, i) =>
  item(`Single column prose line number ${i} across the page.`, 55, 700 - i * 14, 490)
);
eq(
  "single-column-not-split",
  X.detectPdfColumnLayout(X.pdfItemsToBlocks(single, 600), 600),
  null
);

// 跨栏只在明确续句时合并，并保留两个独立定位矩形。
const joined = X.joinColumnContinuationParas([
  { text: "A sentence continues with recon-", page: 1, band: 0, column: "left", kind: "body", x0: 50, x1: 295, yMax: 80, yMin: 60, h: 10, rects: [{ x0: 50, x1: 295, yMax: 80, yMin: 60, h: 10 }] },
  { text: "struction in the other column.", page: 1, band: 0, column: "right", kind: "body", x0: 315, x1: 550, yMax: 720, yMin: 690, h: 10, rects: [{ x0: 315, x1: 550, yMax: 720, yMin: 690, h: 10 }] },
]);
eq("cross-column-word-repaired", joined[0].text, "A sentence continues with reconstruction in the other column.");
eq("cross-column-keeps-two-rects", joined[0].rects.length, 2);

// 右栏顶部的图注可以保留，但不能切断左栏末句与右栏正文续句。
const acrossCaption = X.joinColumnContinuationParas([
  { text: "The controller consists of", page: 1, band: 0, column: "left", kind: "body", x0: 50, x1: 295, yMax: 80, yMin: 60, h: 10, rects: [] },
  { text: "Fig. 1. Overview of the controller.", page: 1, band: 0, column: "right", kind: "figure-caption", x0: 315, x1: 550, yMax: 500, yMin: 470, h: 8, rects: [] },
  { text: "three jointly trained modules.", page: 1, band: 0, column: "right", kind: "body", x0: 315, x1: 550, yMax: 430, yMin: 400, h: 10, rects: [] },
]);
eq("caption-does-not-break-column-continuation", acrossCaption[0].text, "The controller consists of three jointly trained modules.");
eq("caption-remains-separate", acrossCaption.some((p) => p.kind === "figure-caption"), true);

// 右栏顶部浮动图表可能位于左栏句尾与真正续文之间。只越过明确的表格数值块
// 或带 (a)/(b) 面板标记的图注续块，普通右栏正文绝不能被跨过。
const acrossTable = X.joinColumnContinuationParas([
  { text: "The height map is sampled in a grid", page: 1, band: 0, column: "left", kind: "body", x0: 50, x1: 295, yMax: 80, yMin: 60, h: 10, rects: [] },
  { text: "TABLE II SENSOR PARAMETERS.", page: 1, band: 0, column: "right", kind: "table-caption", x0: 315, x1: 550, yMax: 735, yMin: 714, h: 10, rects: [] },
  { text: "Noise range Unit Joint [-0.01, 0.01] rad Delay [0, 15] ms", page: 1, band: 0, column: "right", kind: "body", x0: 315, x1: 550, yMax: 699, yMin: 564, h: 10, rects: [] },
  { text: "where each cell represents terrain height.", page: 1, band: 0, column: "right", kind: "body", x0: 315, x1: 550, yMax: 533, yMin: 474, h: 10, rects: [] },
]);
eq("table-float-does-not-cut-column-continuation", acrossTable[0].text, "The height map is sampled in a grid where each cell represents terrain height.");
eq("table-float-content-preserved", acrossTable.some((p) => /Noise range Unit/.test(p.text)), true);

const acrossFigurePanels = X.joinColumnContinuationParas([
  { text: "The robot in Fig. 16(a) can climb two stairs", page: 1, band: 0, column: "left", kind: "body", x0: 50, x1: 295, yMax: 80, yMin: 60, h: 10, rects: [] },
  { text: "Fig. 16. Locomotion under failures. (a) Normal operation.", page: 1, band: 0, column: "right", kind: "figure-caption", x0: 315, x1: 550, yMax: 605, yMin: 587, h: 9, rects: [] },
  { text: "Meanwhile, (b) the foot collides and (c) the camera detaches.", page: 1, band: 0, column: "right", kind: "body", x0: 315, x1: 550, yMax: 587, yMin: 551, h: 9, rects: [] },
  { text: "at once without losing balance.", page: 1, band: 0, column: "right", kind: "body", x0: 315, x1: 550, yMax: 527, yMin: 469, h: 10, rects: [] },
]);
eq("figure-float-does-not-cut-column-continuation", acrossFigurePanels[0].text, "The robot in Fig. 16(a) can climb two stairs at once without losing balance.");
eq("figure-panel-caption-content-preserved", acrossFigurePanels.some((p) => /^Meanwhile/.test(p.text)), true);

const equationAfterColon = X.joinColumnContinuationParas([
  { text: "The objective is maximized as:", page: 1, band: 0, column: "left", kind: "body", x0: 50, x1: 295, yMax: 80, yMin: 60, h: 10, rects: [] },
  { text: "J = G - λL. (14)", page: 1, band: 0, column: "right", kind: "body", x0: 315, x1: 550, yMax: 720, yMin: 690, h: 10, rects: [] },
]);
eq("colon-introduced-equation-crosses-column", equationAfterColon[0].text, "The objective is maximized as: J = G - λL. (14)");
eq("colon-introduced-equation-is-one-block", equationAfterColon.length, 1);

const ordinaryRightBlocker = X.joinColumnContinuationParas([
  { text: "An unfinished-looking left block", page: 1, band: 0, column: "left", kind: "body", x0: 50, x1: 295, yMax: 80, yMin: 60, h: 10, rects: [] },
  { text: "A separate right-column paragraph starts here.", page: 1, band: 0, column: "right", kind: "body", x0: 315, x1: 550, yMax: 720, yMin: 680, h: 10, rects: [] },
  { text: "lowercase text in its following paragraph.", page: 1, band: 0, column: "right", kind: "body", x0: 315, x1: 550, yMax: 650, yMin: 610, h: 10, rects: [] },
]);
eq("ordinary-right-body-is-never-skipped", ordinaryRightBlocker[0].text, "An unfinished-looking left block");
eq("ordinary-right-body-keeps-three-blocks", ordinaryRightBlocker.length, 3);

// 分页也不是自然段边界；明确的小写续句应在翻译前合成一个逻辑块。
const crossPage = X.joinCrossPageContinuationBlocks([
  { text: "The proposed method learns a robust", page: 1, kind: "body", column: "right", flowId: "right" },
  { text: "1 author affiliation", page: 1, kind: "footnote", column: "footnote", flowId: "footnote:right" },
  { text: "locomotion policy for rough terrain.", page: 2, kind: "body", column: "left", flowId: "left" },
]);
eq("cross-page-continuation-joined", crossPage[0].text, "The proposed method learns a robust locomotion policy for rough terrain.");
eq("cross-page-footnote-preserved", crossPage.some((p) => p.kind === "footnote"), true);

// 双栏脚注必须先从正文流整体剥离；完整左、右栏都结束后才允许出现脚注。
const withFootnote = [];
for (let i = 0; i < 7; i++) {
  withFootnote.push(item(`Left body line ${i} contains enough prose for layout.`, 50, 700 - i * 12, 245));
  withFootnote.push(item(`Right body line ${i} contains enough prose for layout.`, 315, 700 - i * 12, 235));
}
withFootnote.push(item("Author affiliation and laboratory information.", 54, 118, 240, true, false, 8));
withFootnote.push(item("Corresponding author: person@example.edu", 54, 109, 210, true, false, 8));
withFootnote.push(item("Additional contribution statement.", 54, 100, 180, true, false, 8));
const footnoteLogical = X.pdfItemsToBlocks(withFootnote, 600);
const footnoteOrdered = X.orderPdfPageLines(footnoteLogical, 600, 800);
const firstFootnote = footnoteOrdered.lines.findIndex((l) => l.kind === "footnote");
eq("footnote-region-detected", footnoteOrdered.footnoteLines, 3);
eq(
  "footnote-after-both-columns",
  firstFootnote > footnoteOrdered.lines.findLastIndex((l) => l.kind !== "footnote"),
  true
);
eq(
  "footnote-kept-out-of-body-paragraphs",
  X.mergeLinesToParas(footnoteOrdered.lines)
    .filter((p) => p.kind === "body")
    .some((p) => /affiliation|Corresponding author/.test(p.text)),
  false
);

// References 即使字号较小、位于页底，也不能被脚注规则误收。
const references = [];
for (let i = 0; i < 7; i++) {
  references.push(item(`[${i + 1}] Reference entry number ${i} with publication details.`, 50, 700 - i * 12, 245, true, false, 8));
  references.push(item(`[${i + 8}] Reference entry number ${i + 8} with publication details.`, 315, 700 - i * 12, 235, true, false, 8));
}
references.push(item("[20] Final reference at the bottom of the page.", 50, 80, 235, true, false, 8));
references.push(item("[21] Another final reference at the bottom.", 315, 70, 220, true, false, 8));
const referenceOrder = X.orderPdfPageLines(X.pdfItemsToBlocks(references, 600), 600, 800);
eq("bottom-references-not-footnotes", referenceOrder.footnoteLines, 0);

// 数字注号常被 PDF 单独导出成一行；应与其下方脚注正文整体合并识别。
const detachedMarkerPage = Array.from({ length: 8 }, (_, i) =>
  item(`Single-column body prose line ${i} remains in the main flow.`, 70, 700 - i * 13, 470)
);
detachedMarkerPage.push(item("1", 72, 86, 4, true, false, 6));
detachedMarkerPage.push(item("A detached-marker footnote begins here and", 72, 82, 310, true, false, 9));
detachedMarkerPage.push(item("continues on the next small-font line.", 72, 72, 270, true, false, 9));
const detachedOrder = X.orderPdfPageLines(
  X.pdfItemsToBlocks(detachedMarkerPage, 600),
  600,
  800
);
eq("detached-footnote-marker-detected", detachedOrder.footnoteLines, 3);

// Ordinary prose can contain "corresponding to"; that phrase must not turn the
// preceding body sentence into a footnote. A nearby detached number plus small
// prose lines should still identify the actual note below it.
eq(
  "corresponding-to-is-not-explicit-footnote",
  X.pdfFootnoteExplicitSignal({
    text: "The vector corresponding to the largest eigenvalue is retained.",
  }),
  false
);
eq(
  "star-without-space-is-explicit-footnote",
  X.pdfFootnoteExplicitSignal({ text: "*Equal co-advising." }),
  true
);
const closeDetachedMarkerPage = Array.from({ length: 12 }, (_, i) =>
  item(`Earlier single-column body prose line ${i} remains in reading order.`, 90, 700 - i * 15, 468, true, false, 12)
);
closeDetachedMarkerPage.push(
  item(
    "We claim that the vector corresponding to the largest eigenvalue is retained.",
    90,
    226,
    420,
    true,
    false,
    12
  )
);
closeDetachedMarkerPage.push(item("1", 103, 209, 4, true, false, 6));
closeDetachedMarkerPage.push(
  item(
    "To make sense of the sample variance, recall the following useful fact.",
    108,
    205,
    390,
    true,
    false,
    9
  )
);
closeDetachedMarkerPage.push(
  item(
    "In practice the expected value is approximated by a sample average.",
    90,
    188,
    430,
    true,
    false,
    9
  )
);
closeDetachedMarkerPage.push(
  item(
    "The law of large numbers justifies this approximation under mild conditions.",
    90,
    160,
    440,
    true,
    false,
    9
  )
);
closeDetachedMarkerPage.push(
  item(
    "These observations are independent samples of the same random variable.",
    90,
    142,
    425,
    true,
    false,
    9
  )
);
const closeDetachedOrder = X.orderPdfPageLines(
  X.pdfItemsToBlocks(closeDetachedMarkerPage, 612),
  612,
  792
);
eq(
  "nearby-body-corresponding-to-stays-body",
  closeDetachedOrder.lines.some(
    (l) => l.kind !== "footnote" && /We claim/.test(l.text)
  ),
  true
);
eq(
  "close-detached-marker-note-still-detected",
  closeDetachedOrder.lines.some(
    (l) => l.kind === "footnote" && /sample variance/.test(l.text)
  ),
  true
);

// 页底小字号表格不是脚注，即使表格覆盖了脚注常见的页面高度范围。
const bottomTable = Array.from({ length: 8 }, (_, i) =>
  item(`Single-column body prose line ${i} above a table.`, 70, 700 - i * 13, 470)
);
bottomTable.push(item("Table 2: Quantitative evaluation results.", 100, 205, 400));
for (let i = 0; i < 6; i++) {
  bottomTable.push(item(`Method ${i} 0.${i}1 0.${i}2 0.${i}3`, 110, 185 - i * 15, 380, true, false, 8));
}
const bottomTableOrder = X.orderPdfPageLines(X.pdfItemsToBlocks(bottomTable, 600), 600, 800);
eq("bottom-table-not-footnote", bottomTableOrder.footnoteLines, 0);

// Small formula-only regions at the bottom are often continuation equations, not
// footnotes. Even a detached equation number must not be enough without note prose.
const bottomEquations = Array.from({ length: 9 }, (_, i) =>
  item(`Main derivation prose line ${i} remains part of the body text.`, 70, 700 - i * 14, 470, true, false, 12)
);
bottomEquations.push(item("27", 74, 207, 8, true, false, 6));
bottomEquations.push(item("M(q) zeta = -C(q, qdot) - G(q)", 94, 202, 330, true, false, 9));
bottomEquations.push(item("S transpose tau - J transpose lambda = 0", 94, 184, 320, true, false, 9));
const bottomEquationOrder = X.orderPdfPageLines(
  X.pdfItemsToBlocks(bottomEquations, 600),
  600,
  800
);
eq("bottom-formula-region-not-footnote", bottomEquationOrder.footnoteLines, 0);

// 等待阶段可能先锁在下方；真实高度出来后，只要上方放得下就必须改到上方。
const popupAnchor = { left: 100, right: 180, top: 500, bottom: 520 };
eq("popup-defaults-below-when-it-fits", X.resolvePopupPlacement(popupAnchor, 180, 800), "below");
eq("popup-flips-above-instead-of-compressing", X.resolvePopupPlacement(popupAnchor, 320, 800, "below"), "above");

// 记忆尺寸读取用户拖拽写入的 inline 值，而不是被当前位置 max-height 压小的 rect。
const PopupPlugin = sandbox.module.exports;
const popupPlugin = new PopupPlugin();
popupPlugin.settings = { rememberPopupSize: true, popupLastSize: null };
popupPlugin._popupUserResized = true;
popupPlugin._popupResizeDirty = true;
popupPlugin.saveData = async () => {};
popupPlugin._rememberCurrentPopupSize({
  isConnected: true,
  style: { width: "640px", height: "700px" },
  getBoundingClientRect: () => ({ width: 410, height: 260 }),
});
eq("remember-user-size-not-temporary-clamped-rect", popupPlugin.settings.popupLastSize, {
  width: 640,
  height: 700,
});

// --- loadPdfJs：模拟 Obsidian 的 require 锚定（相对路径锚到不存在的应用根）也能加载成功 ---
const FAKE_APP_ROOT = nodePath.join(process.cwd(), "nonexistent-app-root");
const sandbox2 = {
  window: {},
  document: {},
  console,
  module: { exports: {} },
  setInterval,
  clearInterval,
  setTimeout,
  clearTimeout,
  Blob,
  URL: { createObjectURL: () => "blob:test" },
  // 模拟 Obsidian：除本地化模块外，相对 require 解析到应用根；裸模块正常。
  require: (r) =>
    r === "./src/i18n.js"
      ? require(nodePath.join(PROJECT_ROOT, "src", "i18n.js"))
      : r.startsWith(".")
        ? require(nodePath.join(FAKE_APP_ROOT, r))
        : require(r),
};
vm.createContext(sandbox2);
vm.runInContext(src + "\n;__exports = { loadPdfJs, loadOrbModule };", sandbox2);
const pluginStub = {
  manifest: { dir: "." },
  app: {
    vault: {
      // 测试既可从源码仓库运行，也可从安装后的插件目录运行。
      adapter: { basePath: PROJECT_ROOT },
    },
  },
};
const lib = sandbox2.__exports.loadPdfJs(pluginStub);
eq("pdfjs-loads-via-anchors", !!lib && typeof lib.getDocument === "function", true);
eq("worker-src-set", !!String(lib.GlobalWorkerOptions.workerSrc || "").length, true);

// --- loadOrbModule：纯 CJS 的 translation-orb.js 经绝对路径锚点能 require 出导出 ---
const orbMod = sandbox2.__exports.loadOrbModule(pluginStub);
eq(
  "orb-module-loads",
  !!orbMod && typeof orbMod.TranslationOrbController === "function" && typeof orbMod.createDefaultSkinRegistry === "function",
  true
);

// --- parseBatchResponse：⟦MTi⟧ 后的内容不丢 ---
const out = "⟦EN1⟧ fixed one ⟦ZH1⟧ 第一段 ⟦MT2⟧ 第二段直出";
const parsed = X.parseBatchResponse(out, 2, true);
eq("mt-marker-zh", parsed[1].zh, "第二段直出");
eq("en-side-ok", parsed[0].en, "fixed one");
const genericParsed = X.parseBatchResponse(
  "⟦SRC1⟧ repaired source ⟦TGT1⟧ translated target",
  1,
  true
);
eq("generic-source-marker", genericParsed[0].en, "repaired source");
eq("generic-target-marker", genericParsed[0].zh, "translated target");
const echoedMt = X.parseBatchResponse(
  "⟦MT1⟧ echoed source ⟦SRC1⟧ repaired source ⟦TGT1⟧ translated target",
  1,
  true
);
eq("explicit-target-wins-over-mt-echo", echoedMt[0].zh, "translated target");

console.log(fail ? `\n${fail} FAILED` : "\nALL PASS");
process.exit(fail ? 1 : 0);
