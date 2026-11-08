# Mini Translator v1.0.4

## English

This update improves PDF translation control, popup usability and reading typography.

### New
- Choose physical PDF page ranges for the current document or individual files in a batch. Outputs retain original page numbers.
- Select PDFs using a stable folder tree, search, folder checkboxes, Shift selection and a selected-file basket without losing scroll position on every click.
- Lock the translation popup while taking notes. New selections update the same locked popup; Escape and Close still dismiss it.
- Customize source and translation/dictionary typography independently for the popup and sidebar: local fonts, sizes, spacing, alignment, emphasis, colors and opacity.
- Use compact advanced settings with live sample preview, presets, reset and bidirectional one-shot copying. Font/paragraph and additional options can stay open together.

### Fixes
- Fixed collapsed folders and selected-only filtering remaining visibly expanded.
- Prevented stale translation responses and superseded PDF analyses from replacing newer selections.
- Preserved existing blank-line paragraphs and multiline formulas during display formatting, without extra translation requests or changes to copied text.
- Fixed literal dollar sequences being interpreted by the runtime bundle injector, keeping display-math delimiters intact.

### Compatibility
- Desktop only; minimum Obsidian version remains **1.13.7**.
- No new dependencies. Existing translation service configuration remains in use.

## 简体中文

本次更新重点改善 PDF 翻译范围控制、悬浮窗使用体验和阅读排版。

### 新增
- 当前 PDF 及批量任务中的每个文件可单独选择实际页码范围，输出保留原始页码。
- 批量文件选择器支持稳定文件树、搜索、文件夹勾选、Shift 连选和已选列表，勾选时不再反复重建列表、丢失滚动位置。
- 悬浮窗可锁定，方便做笔记；重新划词直接更新原窗口，ESC 和关闭按钮仍可关闭。
- 悬浮窗与侧边栏、原文与译文 / 词典分别设置字体、字号、间距、对齐、文字强调、颜色和透明度。
- 高级排版提供紧凑设置、实时示例预览、预设、恢复默认和双向一键同步；“字体与段落”和“更多排版选项”可同时展开。

### 修复
- 修复文件树折叠和“只看已选”显示异常。
- 防止旧翻译响应、过期的 PDF 解析覆盖新选区。
- 显示时保留已有空行自然段和多行公式，不增加额外翻译请求，不改变复制文本。
- 修复构建时误处理美元符号的问题，完整保留独立公式标记。

### 兼容性
- 仍仅支持桌面端，最低 Obsidian 版本保持 **1.13.7**。
- 没有新增依赖，继续使用现有翻译服务配置。

---

Release tag: `1.0.4` (exactly matches `manifest.json`; no `v` prefix).

Upload the three files from `dist/`: `main.js`, `manifest.json`, `styles.css`.
Do not upload the unbundled repository-root `main.js` as the installation asset.
