"use client";

import { useEffect, useState, type ReactNode } from "react";
import TableFooter from "@/components/TableFooter";
import { formatDate, formatNumber, formatSize } from "@/lib/format";
import type { Repo, RepoSortKey, SortDirection } from "@/types/repo";

const PAGE_SIZE = 50;

interface CellContext {
  selectedTags: string[];
  onTagClick?: (tag: string) => void;
}

interface Column {
  key: RepoSortKey | null;
  label: string;
  numeric?: boolean;
  render: (repo: Repo, ctx: CellContext) => ReactNode;
}

const columns: Column[] = [
  {
    key: "name",
    label: "仓库",
    render: (repo) => (
      <div className="repo-cell">
        <a className="repo-link" href={repo.htmlUrl} target="_blank" rel="noreferrer">
          {repo.name}
        </a>
        <span className="badges">
          {repo.isArchived && <span className="badge badge-warn">已归档</span>}
          {repo.isFork && <span className="badge">Fork</span>}
          {repo.visibility === "private" && <span className="badge badge-private">私有</span>}
        </span>
        {repo.homepage && (
          <a className="homepage-link" href={repo.homepage} target="_blank" rel="noreferrer">
            {repo.homepage.replace(/^https?:\/\//, "")}
          </a>
        )}
      </div>
    ),
  },
  {
    key: null,
    label: "项目说明",
    render: (repo) =>
      repo.description ? (
        <div className="detail-desc" title={repo.description}>
          <div className="desc-text">{repo.description}</div>
        </div>
      ) : (
        <span className="muted">暂无描述</span>
      ),
  },
  {
    key: "language",
    label: "语言",
    render: (repo) => (
      <span className="language">
        <span className="lang-dot" />
        {repo.language ?? "—"}
      </span>
    ),
  },
  { key: "stars", label: "Stars", numeric: true, render: (repo) => formatNumber(repo.stars) },
  {
    key: "forks",
    label: "Forks",
    numeric: true,
    render: (repo) => formatNumber(repo.forks),
  },
  { key: "openIssues", label: "Open Issues", numeric: true, render: (repo) => formatNumber(repo.openIssues) },
  { key: "sizeKb", label: "大小", numeric: true, render: (repo) => formatSize(repo.sizeKb) },
  { key: "license", label: "许可证", render: (repo) => repo.license ?? "—" },
  { key: "visibility", label: "可见性", render: (repo) => repo.visibility },
  {
    key: null,
    label: "Topics",
    render: (repo, ctx) =>
      repo.topics.length > 0 ? (
        <span className="topics">
          {repo.topics.slice(0, 4).map((topic) => (
            <button
              type="button"
              className={`topic${ctx.selectedTags.includes(topic) ? " topic-active" : ""}`}
              key={topic}
              onClick={() => ctx.onTagClick?.(topic)}
              title={`按 #${topic} 筛选`}
            >
              {topic}
            </button>
          ))}
          {repo.topics.length > 4 && <span className="topic">+{repo.topics.length - 4}</span>}
        </span>
      ) : (
        "—"
      ),
  },
  { key: "createdAt", label: "创建时间", render: (repo) => formatDate(repo.createdAt) },
  { key: "updatedAt", label: "最近更新", render: (repo) => formatDate(repo.updatedAt) },
  { key: "pushedAt", label: "最近推送", render: (repo) => formatDate(repo.pushedAt) },
];

const NOWRAP_KEYS: RepoSortKey[] = [
  "language",
  "license",
  "visibility",
  "createdAt",
  "updatedAt",
  "pushedAt",
  "starredAt",
];

function cellClass(column: Column): string | undefined {
  const classes = [
    column.numeric ? "numeric" : "",
    column.key && NOWRAP_KEYS.includes(column.key) ? "nowrap" : "",
  ].filter(Boolean);
  return classes.length > 0 ? classes.join(" ") : undefined;
}

interface Props {
  repos: Repo[];
  starred: boolean;
  sortKey: RepoSortKey;
  sortDir: SortDirection;
  onSort: (key: RepoSortKey) => void;
  selectedTags?: string[];
  onTagClick?: (tag: string) => void;
  /** 无数据时表格内显示的提示，保持表格结构不变 */
  emptyText?: string;
  /** 嵌在面板头部与表格之间的内容（标签统计） */
  children?: ReactNode;
}

export default function DetailTable({
  repos,
  starred,
  sortKey,
  sortDir,
  onSort,
  selectedTags = [],
  onTagClick,
  emptyText,
  children,
}: Props) {
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [repos]);

  const starredColumn: Column = {
    key: "starredAt",
    label: "Star 时间",
    render: (repo) => formatDate(repo.starredAt),
  };
  const visibleColumns: Column[] = starred ? [...columns, starredColumn] : columns;

  return (
    <section className="panel" id="detail">
      <div className="panel-head">
        <div>
          <h2>详细数据</h2>
          <p>搜索与标签筛选只作用于本表；点击表头可切换排序，横向滚动查看更多指标</p>
        </div>
        <span className="panel-count">{repos.length} 条</span>
      </div>
      {children}
      <div className="table-wrap">
        <table className="data-table detail-table">
          <thead>
            <tr>
              {visibleColumns.map((column) => {
                const active = column.key !== null && column.key === sortKey;
                return (
                  <th
                    key={column.label}
                    className={cellClass(column)}
                    aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                  >
                    {column.key ? (
                      <button
                        type="button"
                        className={`sort-btn${active ? " active" : ""}`}
                        onClick={() => onSort(column.key as RepoSortKey)}
                      >
                        {column.label}
                        <span className="sort-arrow">
                          {active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {repos.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length} className="table-empty">
                  {emptyText ?? "没有匹配的仓库。"}
                </td>
              </tr>
            ) : (
              repos.slice(0, visible).map((repo) => (
                <tr key={repo.id}>
                  {visibleColumns.map((column) => (
                    <td key={column.label} className={cellClass(column)}>
                      {column.render(repo, { selectedTags, onTagClick })}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <TableFooter
        shown={Math.min(visible, repos.length)}
        total={repos.length}
        step={PAGE_SIZE}
        onMore={() => setVisible((count) => count + PAGE_SIZE)}
      />
    </section>
  );
}
