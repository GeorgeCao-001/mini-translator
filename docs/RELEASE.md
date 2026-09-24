# Mini Translator 发布指南

## 公开版本

- 首个公开版本：`1.0.0`
- 本次版本：`1.0.2`
- 首发最低 Obsidian 版本：`1.13.7`（本机实际验证版本）
- GitHub Release tag 必须与 `manifest.json` 完全一致：`1.0.2`
- 不要使用 `v1.0`、`v1.0.0` 或两段式版本号
- `versions.json` 记录插件版本与最低 Obsidian 版本的对应关系

## 构建发布文件

在仓库根目录运行：

```bash
node scripts/build-release.js
```

脚本会把中英界面字典、PDF.js、PDF worker 和悬浮球模块全部内嵌到一个独立的 `dist/main.js`，随后执行语法检查并生成 SHA-256。这样从 Community Plugins 安装时不需要额外运行时文件。

GitHub Release **只上传以下三个独立附件**：

| Release 附件 | 必需 | 说明 |
|---|---:|---|
| `dist/main.js` | 是 | 已包含 PDF.js、worker 和悬浮球模块的发布构建 |
| `dist/manifest.json` | 是 | 必须与仓库根目录版本一致 |
| `dist/styles.css` | 是 | 插件界面与全文译文样式 |

构建脚本会在终端输出三个文件的 SHA-256；`dist/` 本身严格只保留这三个可上传附件。

> Obsidian 安装器只会下载 `main.js`、`manifest.json` 和可选的 `styles.css`。直接上传仓库根目录的未打包 `main.js` 会导致市场安装后缺少 PDF 与悬浮球模块。

## 仓库中需要公开保留的文件

这些文件用于审核、构建、维护或许可证合规，应提交到 GitHub，但不作为 Release 附件上传：

| 文件 | 用途 |
|---|---|
| `README.md`、`README.zh-CN.md` | 英文市场详情页与中文版使用说明 |
| `LICENSE` | 插件的 AGPL-3.0-or-later 许可证 |
| `manifest.json` | 市场读取最新版本与元数据 |
| `versions.json` | 兼容版本映射 |
| `CHANGELOG.md` | 公开版本变更记录 |
| `THIRD_PARTY_NOTICES.md`、`LICENSES/` | 第三方代码归属与许可证 |
| `main.js`、`styles.css` | 插件源代码与样式源码 |
| `src/i18n.js` | 简体中文 / English 界面字典与语言切换逻辑 |
| `src/orbs/translation-orb.js`、`src/orbs/ink-water-orb.js` | 悬浮球模块源码 |
| `scripts/vendor/pdfjs/pdf.min.js`、`scripts/vendor/pdfjs/pdf.worker.js` | 固定版本的 PDF.js 发布构建输入 |
| `scripts/` | 发布构建、第三方构建输入、隔离烟测与完整发布检查脚本 |
| `tests/` | 自动回归测试与手动 PDF 解析诊断，不进入 Release |
| `docs/PRE_RELEASE_HISTORY.md` | 从主代码移出的发布前内部迭代记录，不进入 Release |
| `docs/RELEASE.md` | 发布构建、文件分类与上架检查说明，不进入 Release |
| `.github/workflows/ci.yml` | 每次 push 和 pull request 自动执行完整离线发布检查 |

### 目录结构原则

- 根目录有意保留 `main.js`、`styles.css`、`manifest.json` 和 `versions.json`：它们是 Obsidian 插件的标准入口与市场元数据，不应为了「根目录看起来更空」而移走。
- 自有的内部模块放在 `src/`；第三方固定构建输入放在 `scripts/vendor/`；构建脚本、测试和文档分别放在 `scripts/`、`tests/` 和 `docs/`。
- 市场发布物仍只是 `dist/` 中的三个文件；源码目录层次不会增加用户安装的文件数。

## 绝不能发布或提交的文件

| 文件 | 原因 |
|---|---|
| `data.json` | 可能含明文 API Key、Token、翻译历史与用户设置 |
| 用户导出的配置 JSON | 导出内容包含 API Key |
| Vault 内容、翻译缓存、测试论文 | 用户数据或版权材料 |
| `dist/` | 可重复生成，已由 `.gitignore` 排除；只把其中三个文件上传为 Release 附件 |
| `dist.zip` | Obsidian 要求三个独立附件，压缩包不能替代它们，已由 `.gitignore` 排除 |
| `REVIEW-*.md` | 本地审查快照可能包含机器路径或测试文档信息，已由 `.gitignore` 排除 |

## 发布前检查

```bash
node scripts/check-release.js
```

完整检查会依次运行源码语法检查、`tests/` 下四组自动化测试（包含中英字典键与占位符一致性）、自包含发布构建及隔离烟测、PDF 实际解析测试、社区扫描高风险模式检查、连续构建 SHA-256 一致性检查和 `git diff --check`。发布构建会移除 PDF.js 不需要的动态脚本加载与 Node 文件系统入口，并检查已知 CSS 兼容性警告不会重新进入附件。所有测试均为离线测试，不读取 `data.json`，也不会调用真实翻译服务。

然后确认：

1. `manifest.json` 与 `versions.json` 都是有效 JSON。
2. 根目录 `manifest.json` 和 Release 附件的版本均为 `1.0.2`。
3. Release tag 精确为 `1.0.2`。
4. Release 页面包含三个独立附件，而不只是 GitHub 自动生成的源码压缩包。
5. README 已披露联网服务、明文凭据存储、自动回退和 HTML MathJax CDN。
6. 从一个空白测试 Vault 仅用三个 Release 附件安装并验证划词、侧边栏、悬浮球与 PDF 全文翻译。

## 提交到 Obsidian Community Plugins

当前官方流程是在 [community.obsidian.md](https://community.obsidian.md) 登录，绑定 GitHub 后选择 **Plugins → New plugin** 并提交仓库地址；不再手动修改 `community-plugins.json`。

提交前请阅读：

- [Submit your plugin](https://docs.obsidian.md/plugins/releasing/submit-plugin)
- [Submission requirements for plugins](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins)
- [Developer policies](https://docs.obsidian.md/community-directory/developer-policies)
