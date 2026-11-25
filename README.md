# gh-stat

基于 GitHub REST API 统计自己的仓库与 Star 过的仓库，并以两张表格输出：

- **简要信息**：仓库名称、仓库地址、项目简要说明
- **详细数据**：语言、Stars、Forks、Open Issues、大小、许可证、可见性、Topics、创建/更新/推送时间（Star 仓库额外显示 Star 时间）

附带统计卡片（仓库数、Star/Fork 总数、主要语言）、语言分布、关键词搜索、表头排序与 CSV 导出。

查询结果按用户名缓存 1 天（不论是否带 Token），重复打开可直接读取缓存；「删除缓存」仅清除
当前用户名下的缓存，未填写用户名时会给出错误提示。查询对象始终是填入的用户名，Token 只用于
提升配额与读取本人私有仓库。GitHub 接口偶发 5xx/超时会自动重试；用户名支持 `moods445`、
`@moods445`、完整主页链接等写法；已保存的 Token 失效时会自动回退到公开数据查询，但不会自动删除
Token，需手动替换。Token 永久保存在浏览器 `localStorage`，不设过期时间，同一时间只有一个 Token 生效。

## 技术栈

Next.js 16（App Router）+ TypeScript + React 19，源码全部位于 `src/`。

数据获取完全在浏览器中进行：直接请求 GitHub REST API，不需要后端服务。

## 快速开始

```bash
npm install
npm run dev
```

打开 <http://localhost:3000>。

## 构建与部署

```bash
# 纯静态导出：构建产物在 out/，可放到任意静态服务器 / GitHub Pages
npm run build

# 本地预览导出结果
npm run preview
```

## 使用方式

1. 在页面顶部填写 **GitHub 用户名**，点击「加载数据」即可统计公开仓库，无需 Token。
   用户名会在浏览器缓存 30 天，重复使用（刷新、切换标签页）时自动续期；过期后需重新填写。
2. **查询对象始终是输入的用户名**，与是否填写 Token 无关。Token 仅用于提升 API 额度，
   并且只有当用户名与 Token 主人一致时，才会通过 `/user` 接口读取其私有仓库。
   Token 永久保存在浏览器 `localStorage`（无过期时间，多个 Token 后写入的覆盖先前的，始终只有一个生效），
   只有手动替换或「清除」才会改变，请求时直接发给 GitHub。共用电脑请勿保存；怀疑泄露请到 GitHub 撤销。
3. 通过「我的仓库 / Star 的仓库」切换数据源，两个标签页按需加载。
4. 支持关键词过滤、点击表头排序、导出当前列表为 CSV。
5. 查询结果（不论是否带 Token）会按用户名缓存 1 天；点击「刷新 / 重新获取」强制请求 GitHub，
   点击「删除缓存」只清除当前用户名下的缓存（用户名留空时会提示错误）。
   带 Token 查询到的私有仓库信息也会写入本机缓存，请勿在共用电脑使用。

未提供 Token 时，GitHub 每小时限制 60 次请求；单次最多加载 10 页（1000 个仓库），可在
`src/lib/github.ts` 的 `DEFAULT_MAX_PAGES` 调整。

## 目录结构

```
src/
├── app/
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
│   ├── github.ts            # GitHub REST 调用、重试与数据归一化
│   ├── githubUsername.ts    # 用户名输入清洗（@、链接、斜杠）
│   ├── repoCache.ts         # 查询结果按用户名缓存 1 天（含 Token 查询）
│   ├── usernameCache.ts     # 用户名 30 天缓存（滑动过期）
│   └── format.ts            # 格式化与 CSV 转义
└── types/repo.ts            # 类型定义
```

## 部署

`npm run build` 会把整个站点导出到 `out/`，将目录内容上传到任意静态托管（Nginx、对象存储、
GitHub Pages 等）即可。仓库自带的 `.github/workflows/nextjs.yml` 会在推送到 `main` 时
构建并发布到 GitHub Pages。

所有数据请求都由浏览器直接发往 `api.github.com`，Token 只存在于本机浏览器中。

