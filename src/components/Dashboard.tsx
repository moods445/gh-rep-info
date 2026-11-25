"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CredentialBar from "@/components/CredentialBar";
import DetailTable from "@/components/DetailTable";
import StatOverview from "@/components/StatOverview";
import SummaryTable from "@/components/SummaryTable";
import TagPanel from "@/components/TagPanel";
import ThemeToggle from "@/components/ThemeToggle";
import TocNav from "@/components/TocNav";
import { csvEscape, formatDate } from "@/lib/format";
import { fetchRepos, GithubApiError } from "@/lib/github";
import { normalizeUsername } from "@/lib/githubUsername";
import { clearRepoCache, readRepoCache, writeRepoCache } from "@/lib/repoCache";
import { searchRepos } from "@/lib/search";
import { filterByTag } from "@/lib/tags";
import {
  cacheUsername,
  clearCachedUsername,
  readCachedUsername,
} from "@/lib/usernameCache";
import type {
  Repo,
  RepoMode,
  RepoSortKey,
  ReposResponse,
  SortDirection,
} from "@/types/repo";

const TOKEN_KEY = "gh-stat:token";

function readStoredToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(TOKEN_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

/**
 * Token 永久保存在本机，只有一个键、同一时间只有一个值生效；
 * 只有手动提交新值或「清除」才会改变，不做任何时间上的过期处理。
 * localStorage 不可用（隐私模式等）时仅本次会话有效。
 */
function writeStoredToken(value: string): void {
  const next = value.trim();
  try {
    const prev = window.localStorage.getItem(TOKEN_KEY) ?? "";
    if (next === prev) return;
    if (next) {
      window.localStorage.setItem(TOKEN_KEY, next);
    } else {
      window.localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // 写入失败时保留在内存中，不影响本次会话使用
  }
}

function clearStoredToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // 忽略
  }
}

type ModeData = Partial<Record<RepoMode, ReposResponse>>;

function repoField(repo: Repo, key: RepoSortKey): string | number {
  if (key === "createdAt" || key === "updatedAt" || key === "pushedAt" || key === "starredAt") {
    const value = repo[key];
    return value ? Date.parse(value) : 0;
  }
  const value = repo[key] as string | number | null;
  return typeof value === "number" ? value : (value ?? "");
}

function sortRepos(repos: Repo[], key: RepoSortKey, dir: SortDirection): Repo[] {
  const factor = dir === "asc" ? 1 : -1;
  return [...repos].sort((a, b) => {
    const left = repoField(a, key);
    const right = repoField(b, key);
    if (typeof left === "number" && typeof right === "number") {
      return (left - right) * factor || a.name.localeCompare(b.name);
    }
    const result = String(left).localeCompare(String(right), "zh-Hans-CN", {
      sensitivity: "base",
    });
    return (result || a.name.localeCompare(b.name)) * factor;
  });
}

function formatCacheTime(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export default function Dashboard() {
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [mode, setMode] = useState<RepoMode>("owned");
  const [responses, setResponses] = useState<ModeData>({});
  const [loadingMode, setLoadingMode] = useState<RepoMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cacheSavedAt, setCacheSavedAt] = useState<Partial<Record<RepoMode, number>>>({});
  const [cacheMessage, setCacheMessage] = useState<{
    kind: "error" | "success" | "info";
    text: string;
  } | null>(null);
  const [query, setQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<RepoSortKey>("stars");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [toolbarStuck, setToolbarStuck] = useState(false);

  const didInit = useRef(false);
  const toolbarSentinel = useRef<HTMLDivElement>(null);

  // 仓库类型切换控件滚出视口后吸附到窗口顶部
  useEffect(() => {
    const sentinel = toolbarSentinel.current;
    if (!sentinel) return;

    let frame = 0;

    const update = () => {
      frame = 0;
      setToolbarStuck(sentinel.getBoundingClientRect().top < 0);
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const load = useCallback(
    async (
      target: RepoMode,
      overrides?: { token?: string; username?: string; force?: boolean },
    ) => {
      const activeToken = (overrides?.token ?? token).trim();
      let effectiveToken = activeToken;
      const activeUser = normalizeUsername(overrides?.username ?? username);

      if (!activeToken && !activeUser) {
        setError("请填写 GitHub Token 或用户名");
        return;
      }

      setCacheMessage(null);

      // 查询结果按用户名缓存（有效期 1 天），显式刷新时跳过
      if (activeUser && !overrides?.force) {
        const cached = readRepoCache(
          activeUser,
          target,
          activeToken ? "auth" : "anon",
        );
        if (cached) {
          setResponses((prev) => ({ ...prev, [target]: cached.data }));
          setCacheSavedAt((prev) => ({ ...prev, [target]: cached.savedAt }));
          setError(null);
          setNotice(null);
          cacheUsername(activeUser);
          return;
        }
      }

      setLoadingMode(target);
      setError(null);
      setNotice(null);
      setCacheSavedAt((prev) => {
        const next = { ...prev };
        delete next[target];
        return next;
      });

      const run = (withToken: string) =>
        fetchRepos({
          mode: target,
          username: activeUser || undefined,
          token: withToken || undefined,
        });

      try {
        let body: ReposResponse;
        try {
          body = await run(activeToken);
        } catch (firstError) {
          // Token 失效但填了用户名时，自动回退到匿名公开查询；
          // Token 本身不做自动删除，保留到用户手动替换或「清除」。
          if (
            firstError instanceof GithubApiError &&
            firstError.status === 401 &&
            activeToken &&
            activeUser
          ) {
            effectiveToken = "";
            body = await run("");
            setNotice(
              "已保存的 Token 无效或已过期，已自动改用公开数据；Token 未删除，请手动替换后再读取私有仓库。",
            );
          } else {
            throw firstError;
          }
        }

        setResponses((prev) => ({ ...prev, [target]: body }));
        // 成功使用用户名后写入缓存，重复使用会自动续期
        if (activeUser) cacheUsername(activeUser);
        // 不论是否带 Token，一律按用户名缓存查询结果
        const cacheLogin = activeUser || normalizeUsername(body.meta.login ?? "");
        if (cacheLogin) {
          writeRepoCache(
            cacheLogin,
            target,
            body,
            effectiveToken ? "auth" : "anon",
          );
        }
      } catch (err) {
        const message =
          err instanceof TypeError
            ? "无法连接 GitHub，请检查网络或代理设置后重试"
            : err instanceof Error
              ? err.message
              : "请求 GitHub 数据失败";
        setError(message);
      } finally {
        setLoadingMode(null);
      }
    },
    [token, username],
  );

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const savedToken = readStoredToken();
    const savedUser = readCachedUsername();
    setToken(savedToken);
    setUsername(savedUser);
    if (savedToken || savedUser) {
      void load("owned", { token: savedToken, username: savedUser });
    }
  }, [load]);

  const currentData = responses[mode];
  const hasData = Boolean(currentData);
  const loading = loadingMode === mode;
  const login = currentData?.meta.login ?? username.trim();
  const cachedAt = cacheSavedAt[mode];

  const baseRepos = useMemo(() => currentData?.repos ?? [], [currentData]);

  // 全数据模糊搜索，标签统计基于这一层数据
  const keywordRepos = useMemo(() => searchRepos(baseRepos, query), [baseRepos, query]);

  // 搜索只作用于「详细数据」；统计概览与简要信息都基于当前分类的全部数据
  const filteredRepos = useMemo(
    () => filterByTag(keywordRepos, selectedTag),
    [keywordRepos, selectedTag],
  );

  // 简要信息不受搜索/标签筛选影响，始终展示当前分类的全部仓库
  const summaryRepos = useMemo(
    () =>
      [...baseRepos].sort(
        (a, b) => b.stars - a.stars || a.name.localeCompare(b.name),
      ),
    [baseRepos],
  );

  const detailRepos = useMemo(
    () => sortRepos(filteredRepos, sortKey, sortDir),
    [filteredRepos, sortKey, sortDir],
  );

  const filtersActive = query.trim().length > 0 || selectedTag !== null;

  // 无结果时表格内的空态文案：保持表格本身仍在，避免整页布局跳动
  const emptyHint = useMemo(() => {
    const parts: string[] = [];
    if (query.trim()) parts.push(`关键词「${query.trim()}」`);
    if (selectedTag) parts.push(`标签 #${selectedTag}`);
    return parts.length > 0
      ? `当前筛选（${parts.join(" + ")}）下没有匹配的仓库，试试减少筛选条件。`
      : "当前分类下没有仓库，可切换上方的「我的仓库 / Star 的仓库」查看。";
  }, [query, selectedTag]);

  const tocItems = useMemo(() => {
    if (!currentData) return [];
    return [
      { id: "overview", label: "统计概览" },
      { id: "summary", label: "简要信息" },
      { id: "detail", label: "详细数据" },
    ];
  }, [currentData]);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTag((prev) => (prev === tag ? null : tag));
  }, []);

  const clearFilters = useCallback(() => {
    setQuery("");
    setSelectedTag(null);
  }, []);

  function handleSubmit() {
    const normalizedUser = normalizeUsername(username);
    if (username.trim() && !normalizedUser) {
      setError("用户名格式不正确，请填写 GitHub 用户名");
      return;
    }
    // 提交即覆盖已保存的 Token，保证始终只有一个 Token 生效
    writeStoredToken(token);
    // 提交时立即记录用户名，避免请求失败或页面重载后输入框变成空
    cacheUsername(normalizedUser);
    setUsername(normalizedUser);
    // 用户名未变化时保留已加载的数据，避免整块内容先清空再重载
    if (normalizedUser !== login) {
      setResponses({});
      setSelectedTag(null);
    }
    setError(null);
    void load(mode, { username: normalizedUser });
  }

  function handleClear() {
    clearStoredToken();
    clearCachedUsername();
    setToken("");
    setUsername("");
    setResponses({});
    setCacheSavedAt({});
    setCacheMessage(null);
    setError(null);
    setNotice(null);
    setQuery("");
    setSelectedTag(null);
  }

  function handleModeChange(next: RepoMode) {
    if (next === mode) return;
    setMode(next);
    setQuery("");
    setSelectedTag(null);
    setError(null);
    if (!responses[next] && (token.trim() || username.trim())) {
      void load(next);
    }
  }

  function handleRefresh() {
    void load(mode, { force: true });
  }

  function handleDeleteCache() {
    const name = normalizeUsername(username);
    if (!name) {
      setCacheMessage({ kind: "error", text: "请先填写要删除缓存的用户名" });
      return;
    }

    const removed = clearRepoCache(name);
    setCacheSavedAt((prev) => {
      const next = { ...prev };
      delete next.owned;
      delete next.starred;
      return next;
    });
    setCacheMessage({
      kind: removed ? "success" : "info",
      text: removed
        ? `已删除 ${name} 的本地缓存，下次加载将重新请求 GitHub。`
        : `用户名 ${name} 当前没有可删除的本地缓存。`,
    });
  }

  function handleSort(key: RepoSortKey) {
    if (key === sortKey) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(
      key === "name" || key === "language" || key === "license" || key === "visibility"
        ? "asc"
        : "desc",
    );
  }

  function handleExport() {
    const starred = mode === "starred";
    const header = [
      "仓库",
      "仓库地址",
      "项目说明",
      "语言",
      "Stars",
      "Forks",
      "Open Issues",
      "大小(KB)",
      "许可证",
      "可见性",
      "Fork",
      "已归档",
      "Topics",
      "创建时间",
      "更新时间",
      "最近推送",
      ...(starred ? ["Star 时间"] : []),
    ];
    const rows = detailRepos.map((repo) => [
      repo.fullName,
      repo.htmlUrl,
      repo.description ?? "",
      repo.language ?? "",
      repo.stars,
      repo.forks,
      repo.openIssues,
      repo.sizeKb,
      repo.license ?? "",
      repo.visibility,
      repo.isFork ? "是" : "否",
      repo.isArchived ? "是" : "否",
      repo.topics.join(" "),
      formatDate(repo.createdAt),
      formatDate(repo.updatedAt),
      formatDate(repo.pushedAt),
      ...(starred ? [formatDate(repo.starredAt)] : []),
    ]);
    const csv =
      "\uFEFF" +
      [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `github-${login || "repos"}-${mode}-${formatDate(new Date().toISOString())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const modeTabs = (
    <div className="mode-tabs" role="tablist" aria-label="仓库类型">
      <button
        type="button"
        role="tab"
        aria-selected={mode === "owned"}
        className={mode === "owned" ? "active" : ""}
        onClick={() => handleModeChange("owned")}
      >
        我的仓库
        {responses.owned ? <span className="tab-count">{responses.owned.meta.total}</span> : null}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "starred"}
        className={mode === "starred" ? "active" : ""}
        onClick={() => handleModeChange("starred")}
      >
        Star 的仓库
        {responses.starred ? (
          <span className="tab-count">{responses.starred.meta.total}</span>
        ) : null}
      </button>
    </div>
  );

  return (
    <div className="dashboard">
      <header className="hero">
        <div>
          <span className="eyebrow">GitHub REST API · 仓库分析</span>
          <h1>GitHub 仓库统计</h1>
          <p>统计个人项目与 Star 过的仓库，并输出简要信息与详细数据两张表格。</p>
        </div>
        <div className="hero-side">
          <div className="identity">
            {hasData && login ? (
              <>
                <span className="avatar-placeholder">{login.slice(0, 1).toUpperCase()}</span>
                <div>
                  <strong>@{login}</strong>
                  <span>已连接 GitHub</span>
                </div>
              </>
            ) : (
              <div>
                <strong>未加载数据</strong>
                <span>填写 Token 或用户名后开始</span>
              </div>
            )}
          </div>
          <ThemeToggle />
        </div>
      </header>

      <CredentialBar
        token={token}
        username={username}
        loading={loadingMode !== null}
        hasData={hasData}
        onTokenChange={setToken}
        onUsernameChange={setUsername}
        onSubmit={handleSubmit}
        onClear={handleClear}
      />

      <div ref={toolbarSentinel} className="toolbar-sentinel" aria-hidden="true" />

      {/* 滚动后吸附到窗口顶部的仓库类型切换栏 */}
      <div
        className={`tabs-dock${toolbarStuck ? " is-visible" : ""}`}
        inert={!toolbarStuck}
        aria-hidden={!toolbarStuck}
      >
        <div className="tabs-dock-inner">{modeTabs}</div>
      </div>

      <div className="toolbar">
        {modeTabs}
        <div className="toolbar-actions">
          <input
            type="search"
            className="search-input"
            placeholder="搜索详细数据：名称 / 描述 / Topics…"
            title="模糊匹配全部字段，支持空格分隔多个关键词；仅筛选详细数据表，简要信息不受影响"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={!hasData}
          />
          {query.trim() && (
            <span className="search-hint" aria-live="polite">
              {filteredRepos.length} 条
            </span>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleRefresh}
            disabled={loading || (!token.trim() && !username.trim())}
          >
            刷新
          </button>
          <button type="button" className="btn btn-ghost" onClick={handleDeleteCache}>
            删除缓存
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleExport}
            disabled={!hasData || filteredRepos.length === 0}
            title="导出当前筛选结果为 CSV 文件"
          >
            导出 CSV
          </button>
        </div>
      </div>

      {cacheMessage && (
        <div
          className={`alert${cacheMessage.kind === "error" ? "" : " alert-info"}`}
          role={cacheMessage.kind === "error" ? "alert" : "status"}
        >
          <span>{cacheMessage.text}</span>
          <button type="button" className="btn btn-sm" onClick={() => setCacheMessage(null)}>
            知道了
          </button>
        </div>
      )}

      {cachedAt && (
        <div className="cache-note">
          <span>
            当前 {mode === "starred" ? "Star" : "仓库"} 列表来自本地缓存（
            {formatCacheTime(cachedAt)}），有效期 1 天。
          </span>
          <button type="button" className="link-btn" onClick={handleRefresh}>
            重新获取
          </button>
        </div>
      )}

      {notice && (
        <div className="alert alert-info" role="status">
          <span>{notice}</span>
          <button type="button" className="btn btn-sm" onClick={() => setNotice(null)}>
            知道了
          </button>
        </div>
      )}

      {error && (
        <div className="alert" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              setError(null);
              void load(mode, { force: true });
            }}
          >
            重试
          </button>
        </div>
      )}

      {loading && !hasData && (
        <section className="panel skeleton-panel" aria-label="加载中">
          <div className="skeleton-line w-40" />
          <div className="skeleton-line" />
          <div className="skeleton-line" />
          <div className="skeleton-line w-70" />
        </section>
      )}

      {!loading && !hasData && !error && (
        <section className="panel empty-panel">
          <h2>还没有数据</h2>
          <p>
            在上方填写 GitHub 用户名即可统计公开仓库；填写 Personal Access Token
            可以同时统计私有仓库，并提高 API 调用额度。
          </p>
          <ol>
            <li>在 GitHub 生成 Token（勾选 <code>repo</code> 与 <code>read:user</code> 权限）。</li>
            <li>粘贴 Token 与用户名，点击「加载数据」。</li>
            <li>切换「我的仓库 / Star 的仓库」查看两组统计。</li>
          </ol>
        </section>
      )}

      {currentData && (
        <>
          <StatOverview
            repos={baseRepos}
            meta={currentData.meta}
            starred={mode === "starred"}
          />

          <SummaryTable
            repos={summaryRepos}
            starred={mode === "starred"}
            emptyText="当前分类下没有仓库，可切换上方的「我的仓库 / Star 的仓库」查看。"
          />
          <DetailTable
            repos={detailRepos}
            starred={mode === "starred"}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            selectedTags={selectedTag ? [selectedTag] : []}
            onTagClick={toggleTag}
            emptyText={emptyHint}
          >
            <TagPanel
              embedded
              repos={keywordRepos}
              selected={selectedTag}
              matchedCount={filteredRepos.length}
              query={query}
              onQueryChange={setQuery}
              onSelect={toggleTag}
              onClear={() => setSelectedTag(null)}
            />
          </DetailTable>

          {filtersActive && (
            <p className="filter-note">
              {query.trim() ? `当前关键词「${query.trim()}」` : "当前筛选"}
              {selectedTag ? ` + 标签 #${selectedTag}（仅该标签）` : ""}
              ，共 {filteredRepos.length} 条结果；
              <button type="button" className="link-btn" onClick={clearFilters}>
                清除筛选
              </button>
            </p>
          )}
        </>
      )}

      <TocNav items={tocItems} />

      <footer className="footer">
        数据来源  GitHub REST API · {login ? `@${login}` : "未连接"} ·
        <a href="https://docs.github.com/rest" target="_blank" rel="noreferrer">
          接口文档
        </a>
      </footer>
    </div>
  );
}
