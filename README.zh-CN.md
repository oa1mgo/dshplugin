<div align="center">

# DSHPlugin

**一切皆插件。**

由社区共同建设的 DeepSeek Harness 插件发现索引。

[打开 dshplugin.org](https://dshplugin.org) · [参与共建](CONTRIBUTING.md) · [English](README.md)

</div>

> [!NOTE]
> DSHPlugin 是独立的社区项目，不是 DeepSeek 官方产品，也不代表 DeepSeek 的认可或背书。

## 为什么做 DSHPlugin？

DeepSeek Harness 的架构非常开放，但寻找好用插件不应该依赖零散搜索。DSHPlugin 把 GitHub 发现、原仓库链接、最新 Star 数和可安装组合包信息放进一个专注的目录中。

项目选择公开共建，让插件作者、DSH 用户、安全研究者和翻译贡献者都能参与改善生态。

欢迎直接访问正式站点 **[dshplugin.org](https://dshplugin.org)**。

## 已有能力

- 可搜索、可分页的插件目录，直接链接规范化后的源码仓库
- 英语、简体中文、日语、韩语和西班牙语
- 浅色、深色及跟随系统主题
- 跨平台 DSH 安装命令
- 定时扫描 GitHub 的 [`dsh-plugin` Topic](https://github.com/topics/dsh-plugin)，并同步 [`awesome-dsh-plugins`](https://github.com/AdamPlatin123/awesome-dsh-plugins)
- 每次扫描刷新 GitHub Star 数，并默认按 Star 排名
- 检查根目录 `dsh.bundle.patch` 组合包声明，通过 Git smart HTTP 拒绝失效链接和占位仓库
- 基于 Cloudflare D1 的插件提交与举报闭环
- 使用 Cloudflare Access 保护的管理后台，并在 Worker 内再次验证 JWT

## 索引规则

目录合并两条公开发现渠道：

- 带有 [`dsh-plugin` Topic](https://github.com/topics/dsh-plugin)，且根目录存在有效 `dsh.bundle.patch` 声明的仓库；
- [`awesome-dsh-plugins`](https://github.com/AdamPlatin123/awesome-dsh-plugins) 收录的规范公开仓库。

GitHub Star 只是发现与排序信号，不代表安全、质量或官方背书。DSHPlugin 始终路由到原仓库，并且只为确认存在可安装组合包结构的条目展示安装命令。

## 本地开发

需要 Node.js 20 或更高版本。

```bash
git clone https://github.com/oa1mgo/dshplugin.git
cd dshplugin
npm ci
npm run dev
```

只修改目录 UI 时，Vite 开发服务器就足够了。需要本地运行完整 Worker 与 D1 流程时：

```bash
cp wrangler.example.jsonc wrangler.jsonc
cp .dev.vars.example .dev.vars
npm run build
npx wrangler d1 migrations apply dshplugin-moderation --local
npx wrangler dev
```

常用检查：

```bash
npm test
npm run build
npm run test:sites
npm run verify
npm run check:catalog-links
```

## 隐私与自部署

仓库只包含通用部署示例。真实的 Cloudflare 账号信息、Access 参数、D1 ID、域名路由、管理员邮箱和本地密钥都被 Git 忽略。

自部署时请复制 `wrangler.example.jsonc`，创建自己的 D1 数据库与 Access 应用，并通过 `wrangler secret put` 或 Cloudflare 控制台配置 `ADMIN_EMAIL`、`CF_ACCESS_AUD` 和 `CF_ACCESS_ISSUER`。请同时保护 `/admin*` 和 `/api/admin/*`。

任何 fork 都必须使用自己的 Cloudflare 账号、数据库、Access 策略和身份服务；公开源码不会赋予任何人进入线上 DSHPlugin 后台的权限。

## 一起共建

你可以从这些方向参与：

- 提交新插件或修复错误仓库链接
- 改进 GitHub 发现、元数据新鲜度与排序
- 增加目录、API、链接与多语言测试
- 改善无障碍、响应式体验和翻译
- 研究插件健康度、仓库元数据与自动化索引

请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。中文和英文 Issue/PR 都欢迎。提交信息使用 [Conventional Commits](https://www.conventionalcommits.org/)，例如 `feat: add plugin health filters` 或 `fix: reject unreachable repository redirects`。

安全问题请不要提交公开 Issue；请按照 [SECURITY.md](SECURITY.md) 使用 GitHub 私密漏洞报告。

## 致谢与许可

感谢 [`deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness) 提供可扩展架构，以及 [`awesome-dsh-plugins`](https://github.com/AdamPlatin123/awesome-dsh-plugins) 提供社区目录来源。

项目采用 [MIT License](LICENSE)。
