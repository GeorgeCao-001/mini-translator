# Mini Translator

Obsidian 零配置查词 + 翻译插件。灵感来自 Translate for Zotero：选中即译、弹窗在选区旁、双语对照面板、多引擎 + 自动回退。

## 功能

- **划词翻译**：Markdown 笔记和 PDF 视图里选中英文 → 快捷键 → 选区旁弹窗（带等待动画、可拖动，Esc / 点击外部关闭）
- **两种模式**：
  - 逐句翻译：多句选区逐句独立翻译，原文译文逐句对齐，带进度显示
  - 整段翻译：整段一次请求，速度快、上下文完整（配合大模型质量最佳）
- **划线停留自动翻译**：选中英文停留片刻（可调 0.5–5 秒）自动按整段模式翻译；也可绑「切换划线自动翻译」快捷键随时开关
- **查词**：单个英文单词走词典（音标 + 每词性一行 + 释义分号分隔）
- **侧边栏面板**：翻译源下拉、词典源下拉、模型下拉、原文/译文双语对照、复制译文按钮
- **排版规范**：译文段首缩进两字符、段落自然重排、全角标点；英文衬线字体、两端对齐、弯引号、段落重排（合并硬换行、断行连字符续接）
- **缓存**：按「源 + 模型」缓存，换源换模型自动重新翻译

## 安装（任意机器）

1. 把本文件夹整体复制到目标 vault 的插件目录，形成：
   ```
   <你的 vault>/.obsidian/plugins/mini-translator/
   ├── manifest.json
   ├── main.js
   └── styles.css
   ```
   （`.obsidian` 是隐藏文件夹；没有 `plugins` 目录就新建一个）
2. 重启 Obsidian（或 Ctrl+P → Reload app）
3. 设置 → 第三方插件 → 启用 **Mini Translator**
4. 设置 → 快捷键：建议「翻译选中文本（逐句）」绑 `Ctrl+Shift+T`、「翻译选中文本（整段）」绑 `Ctrl+Shift+G`、「切换划线自动翻译」绑 `Ctrl+Shift+A`

## 翻译源（句子）

内置免费源（失败自动回退）：

| 源 | 费用 | 说明 |
|---|---|---|
| 有道 | 免 Key | 国内直连，默认主源 |
| 火山 | 免 Key | 响应快 |
| 腾讯 | 免 Key | 交互翻译网页版 |
| 谷歌 | 免 Key | 需代理，国内直连不通 |

**大模型源 = 配置即源**：每个大模型配置就是一个独立翻译源，保存后直接出现在翻译源下拉里，选中即用（失败不回退免费源）。

## 词典源（单词）

| 源 | 费用 | 说明 |
|---|---|---|
| 百度 | 免 Key | 简短中文释义，最稳 |
| 有道词典 | 免 Key | 中文释义 + 音标 |
| 牛津 | 免 Key | Oxford Learner's Dictionaries 英英释义，权威 |

大模型配置同样可作为词典源（用该配置的模型 + 学术词典提示词）。分号全角化只对中文词典源生效，牛津保持英文标点。

## 大模型配置（OpenAI 兼容 API）

设置 → Mini Translator → 「大模型配置」→「管理配置」打开独立管理窗口：

- **内置预设**：DeepSeek、OpenAI、Kimi、通义千问、智谱 GLM、硅基流动、Ollama（本地），一键创建，自带默认模型列表
- **一个配置 = 一个接口地址 + 一个 API Key + 多个模型**，模型共用 Key，可任意切换
- **查询模型**：填好地址和 Key 后点击，自动从服务商 `/models` 端点拉取全部可用模型
- **导入 / 导出**：全部配置（含 Key）可导出为 JSON，换机器一键导入

> 注意：配置和 API Key 存在 vault 本地 `.obsidian/plugins/mini-translator/data.json`，**不随本插件文件夹分发**——分享/提交本文件夹不会泄露你的 Key。

## 其他命令

- **自检全部翻译源**：一键测试所有词典源/句子源（含大模型配置）在当前网络下的可用性
- **诊断环境**：排查选区/坐标/PDF 结构问题
- **打开翻译面板**：打开侧边栏面板
- **切换划线自动翻译**：快捷键翻转自动翻译开关

## 致谢与许可

引擎请求配方移植自 [windingwind/zotero-pdf-translate](https://github.com/windingwind/zotero-pdf-translate)（AGPL-3.0）：youdao.ts / huoshanweb.ts / tencenttransmart.ts / google.ts（含 tk 算法）及 youdaodict 思路。PDF 内部结构参考 [RyotaUshio/obsidian-pdf-plus](https://github.com/RyotaUshio/obsidian-pdf-plus)。本插件同按 AGPL-3.0 分发。
