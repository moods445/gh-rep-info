# gh-stat

基于 GitHub REST API 统计自己的仓库与 Star 过的仓库，并以两张表格输出：

- **简要信息**：仓库名称、仓库地址、项目简要说明
- **详细数据**：语言、Stars、Forks、Open Issues、大小、许可证、可见性、Topics、创建/更新/推送时间（Star 仓库额外显示 Star 时间）

附带统计卡片（仓库数、Star/Fork 总数、主要语言）、语言分布、关键词搜索、表头排序与 CSV 导出。

查询结果按用户名缓存 1 天（不论是否带 Token），重复打开可直接读取缓存；「删除缓存」仅清除
当前用户名下的缓存，未填写用户名时会给出错误提示。查询对象始终是填入的用户名，Token 只用于
提升配额与读取本人私有仓库。GitHub 接口偶发 5xx/超时会自动重试；用户名支持 `moods445`、
`@moods445`、完整主页链接等写法；已保存的 Token 失效时会自动回退到公开数据查询并清除坏 Token。

## 技术栈

Next.js 16（App Router）+ TypeScript + React 19，源码全部位于 `src/`。

数据获取支持两种模式：

- **静态模式（默认）**：浏览器直接请求 GitHub REST API，可导出纯静态站点，无需后端
- **代理模式**：浏览器请求本项目的 `/api/repos`，由服务端转发 GitHub，可使用服务端统一 Token

## 快速开始

```bash
npm install
npm run dev          # 默认静态模式，浏览器直连 GitHub
```

打开 <http://localhost:3000>。

代理模式开发：

```bash
npm run dev:proxy
```

## 构建与部署

```bash
# 纯静态站点：产物在 out/，可放到任意静态服务器 / GitHub Pages
npm run build:static

# 代理模式：构建并启动 Node 服务
npm run build:proxy && npm run start

# 普通构建（客户端仍是静态直连，仅用于需要 Next 服务端能力的场景）
npm run build && npm run start
```

## 使用方式

1. 在页面顶部填写 **GitHub 用户名**，点击「加载数据」即可统计公开仓库，无需 Token。
   用户名会在浏览器缓存 30 天，重复使用（刷新、切换标签页）时自动续期；过期后需重新填写。
2. **查询对象始终是输入的用户名**，与是否填写 Token 无关。Token 仅用于提升 API 额度，
   并且只有当用户名与 Token 主人一致时，才会通过 `/user` 接口读取其私有仓库。
   静态模式下 Token 保存在浏览器 `localStorage` 并直接发给 GitHub；代理模式下由服务端转发。
3. 通过「我的仓库 / Star 的仓库」切换数据源，两个标签页按需加载。
4. 支持关键词过滤、点击表头排序、导出当前列表为 CSV。
5. 查询结果（不论是否带 Token）会按用户名缓存 1 天；点击「刷新 / 重新获取」强制请求 GitHub，
   点击「删除缓存」只清除当前用户名下的缓存（用户名留空时会提示错误）。
   带 Token 查询到的私有仓库信息也会写入本机缓存，请勿在共用电脑使用。

代理模式下还可以在服务端配置默认 Token（无需在页面填写），新建 `.env.local`：

```bash
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxx
```

该变量只在代理模式使用，不会下发到前端；静态模式下不可用（浏览器拿不到服务端环境变量）。

未提供 Token 时，GitHub 每小时限制 60 次请求；单次最多加载 10 页（1000 个仓库），可在
`src/lib/github.ts` 的 `DEFAULT_MAX_PAGES` 调整。

## 目录结构

```
src/
├── app/
│   ├── api/repos/route.ts   # 可选代理（分页、鉴权、错误映射）
│   ├── globals.css          # 全局样式
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── Dashboard.tsx        # 状态管理、加载、筛选、排序、导出
│   ├── CredentialBar.tsx    # Token / 用户名输入
│   ├── StatOverview.tsx     # 统计卡片与语言分布
│   ├── SummaryTable.tsx     # 简要信息表
│   ├── DetailTable.tsx      # 详细数据表
│   └── TableFooter.tsx      # 分页加载
├── lib/
│   ├── reposClient.ts       # 数据源选择：直连 GitHub / 请求代理
│   ├── github.ts            # GitHub REST 调用、重试与数据归一化
│   ├── githubUsername.ts    # 用户名输入清洗（@、链接、斜杠）
│   ├── repoCache.ts         # 查询结果按用户名缓存 1 天（含 Token 查询）
│   ├── usernameCache.ts     # 用户名 30 天缓存（滑动过期）
│   └── format.ts            # 格式化与 CSV 转义
└── types/repo.ts            # 类型定义
scripts/
└── build-static.mjs         # 纯静态导出脚本
```

## 内部接口

```
GET /api/repos?mode=owned|starred&username=<login>
Header: x-github-token: <token>   # 可选
```

返回 `{ repos: Repo[], meta: { total, pagesFetched, truncated, rateLimitRemaining, login } }`。

## 部署形态

- **默认静态**：`npm run build:static` 导出 `out/`，任意静态服务器即可托管，浏览器直连 GitHub。
  代价是页面上的 Token 会被浏览器直接发往 `api.github.com`（仅本机可见），且无法使用服务端统一 Token。
- **代理模式**：`npm run build:proxy && npm run start`，由 `/api/repos` 转发请求，可使用
  `.env.local` 中的 `GITHUB_TOKEN`（不下发前端），并统一处理分页、重试与错误映射。
