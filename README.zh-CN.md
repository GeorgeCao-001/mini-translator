# Mini Translator

[English](README.md) | **简体中文**

Mini Translator 是一款面向 **Obsidian 桌面端**的划词、查词与学术 PDF 翻译插件。它可以在 Markdown、阅读视图和 PDF 中翻译选中文本，通过侧边栏保留原文与译文对照；需要处理整篇论文时，还可以使用大模型生成可读的 Markdown 译文和可选的原文对照 HTML。

> [!IMPORTANT]
> 中文和英文之外的语言仅经过 AI 与翻译接口自动化测试，尚未经过母语者人工审校，仅供参考。

> [!NOTE]
> 插件界面提供简体中文和 English。「界面语言」默认为「自动」，会跟随 Obsidian 界面语言，也可在 Mini Translator 设置中手动固定。

## 主要功能

- **划词翻译**：支持笔记、阅读视图和 PDF；弹窗贴近真实选区，可手动缩放，并避免遮挡原文。
- **两种翻译方式**：逐句翻译便于双语对照；整段翻译保留更多上下文。
- **多语言**：原文可自动识别，目标语言提供 70 多种选项，并适配 CJK、RTL 等不同书写方向。
- **中英界面**：设置、命令、划词弹窗、侧边栏、配置弹窗、进度界面、通知和对照 HTML 控件均已提供 English。
- **查词**：英文单词可显示音标、词性和释义。
- **侧边栏**：统一切换语言、翻译源、词典源和模型，并查看、复制译文。
- **LaTeX**：保护已有公式；使用大模型时可尝试修复 PDF 文本层中受损的公式。
- **PDF 全文翻译**：尝试恢复单双栏阅读顺序，分离正文、图注和脚注；输出可读版 Markdown，并可选生成原页—译文对照 HTML。
- **任务控制**：显示全文翻译进度，支持取消、最小化为可拖动悬浮球，以及复用当前会话中的已完成块。

## 安装

### Obsidian 插件市场（上架后）

Mini Translator 上架 Obsidian 插件市场后：

1. 打开 **设置 → 第三方插件**。
2. 选择 **浏览**。
3. 搜索 **Mini Translator**，安装并启用。

### 手动安装

从同一个 GitHub Release 下载 `manifest.json`、`main.js` 和 `styles.css`，放入：

```text
<Vault>/.obsidian/plugins/mini-translator/
```

然后重新加载 Obsidian 并启用插件。三个文件必须来自同一次 Release。

## 快速开始

1. 点击左侧功能区的语言图标，打开 Mini Translator 侧边栏。
2. 选择“原文语言 → 译文语言”和翻译源。
3. 选中文本后，从命令面板运行：
   - `翻译选中文本（逐句）`
   - `翻译选中文本（整段）`
4. 如需频繁使用，可在 **设置 → 快捷键**中自行绑定快捷键；也可以在插件设置中开启“划线停留自动翻译”。

翻译进行中，可在弹窗外连续双击或按 `Esc` 取消；得到译文后，单击弹窗外部即可关闭。

## 翻译源

### 内置服务

- 句子翻译：有道、火山翻译、腾讯交互翻译、Google Translate、Bing Translator / Microsoft Translator、CNKI 学术翻译。
- 英文查词：百度翻译、有道词典、Oxford Learner’s Dictionaries。

部分内置源使用服务商的公开网页接口，不保证长期稳定，可能受到地区、频率、登录或验证码限制。除用户明确配置的大模型源外，内置句子源失败时会依次尝试其他兼容源。

### 大模型服务

插件支持用户自行配置 OpenAI 兼容的 Chat Completions 接口，并提供 DeepSeek、OpenAI、Kimi、通义千问、智谱 GLM、硅基流动和本地 Ollama 等配置模板。模板只预填接口信息，不提供账号、额度或 API Key。

创建配置时，只有点击 **确定创建**才会保存；取消、关闭窗口或切换配置类型都会丢弃草稿。全文 PDF 翻译仅支持大模型源，可能产生服务商费用。

## PDF 全文翻译

使用以下命令之一：

- `全文翻译当前 PDF`
- `全文翻译：选择文件（可多选）`

插件会在源 PDF 同目录生成：

- `<文件名>·翻译.md`：适合在 Obsidian 中连续阅读；
- `<文件名>·翻译.html`：可选的原页—译文对照页面；
- 含图或表页面的本地原页图片附件。

### 已知限制

- 全文翻译要求 PDF 具有可提取的文本层；扫描件需要另行 OCR。
- 插件不会识别或翻译图片内部的文字，也不会把 PDF 页面图像发送给视觉模型。
- 单双栏顺序、脚注、图注、断词和公式修复均为启发式处理；复杂版式可能识别错误，请始终对照原 PDF 核验。
- 全文翻译只会把提取出的文本块发送给所选大模型接口，但可能产生较多请求、token 消耗和费用。
- 可选 HTML 在打开时会从 `cdn.jsdelivr.net` 加载 MathJax；若不希望对照 HTML 额外联网加载公式，请关闭 HTML 输出。翻译本身是否能离线取决于所选服务，只有本地模型等本地端点可以离线工作。

## 网络、隐私与本地数据

Mini Translator 不提供代理服务器，也不包含遥测或分析代码。网络请求由 Obsidian 直接发往所选服务：

| 操作 | 可能发送的数据与目标 |
|---|---|
| 内置翻译 | 选中的原文、语言参数发送至有道、火山、腾讯、Google、Bing/Microsoft 或 CNKI；发生自动回退时，同一段文本可能依次发送给多个内置服务 |
| 查词 | 查询单词发送至百度、有道或 Oxford |
| 大模型翻译 | 系统提示词、原文及语言参数发送至用户配置的 OpenAI 兼容接口；API Key 用于该接口鉴权 |
| 查询模型 | 请求用户配置接口的 `/models` 端点 |
| PDF 全文翻译 | 提取出的 PDF 文本块发送至用户选择的大模型接口；原始 PDF 文件和页面图像不作为视觉输入上传 |
| 对照 HTML | 打开 HTML 时浏览器会向 jsDelivr 请求 MathJax 脚本 |

插件设置、API Key、Token 和最近 50 条翻译历史以**未加密文本**保存在：

```text
<Vault>/.obsidian/plugins/mini-translator/data.json
```

该文件可能被 Vault 同步或备份工具一并同步。请勿提交、公开或分享 `data.json`。插件导出的配置 JSON 也包含 API Key，请按敏感凭据保管。凭据不会发送给插件作者，只会在使用对应服务时发送到该服务端点。

使用任何第三方翻译或大模型服务前，请确认其隐私政策、服务条款、地区可用性和计费方式符合你的要求。不要把敏感或受限制的文档发送给你不信任的服务。

## 兼容性

- 仅支持 Obsidian 桌面端。
- 最低 Obsidian 版本以 `manifest.json` 为准。
- 内置网页接口的可用性取决于网络环境和服务商策略。

## 开发与发布

- 公共版本变化见 [CHANGELOG.md](CHANGELOG.md)。
- 发布文件、开发文件和上架步骤见 [docs/RELEASE.md](docs/RELEASE.md)。
- 第三方代码与许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

完整发布前检查：

```bash
node scripts/check-release.js
```

仅生成市场发布文件：

```bash
node scripts/build-release.js
```

测试结构与单独运行方法见 [tests/README.md](tests/README.md)。

## 致谢

本项目的部分翻译服务请求逻辑基于采用 `AGPL-3.0-or-later` 许可的 [Translate for Zotero](https://github.com/windingwind/zotero-pdf-translate) 改编，并于 2026 年为 Mini Translator 作出修改。PDF 集成方案的设计参考了采用 MIT 许可的 [PDF++](https://github.com/RyotaUshio/obsidian-pdf-plus)。

第三方代码的著作权仍归各自权利人所有。完整的来源归属、修改说明与许可信息见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 开源许可

Copyright (C) 2026 George.

Mini Translator 是自由软件：你可以依据 [GNU Affero 通用公共许可证第 3 版或任何后续版本](LICENSE)（`AGPL-3.0-or-later`）重新发布和/或修改本项目。本项目不提供任何担保；完整条款以 `LICENSE` 为准。
