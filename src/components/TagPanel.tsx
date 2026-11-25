"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collectTagStats } from "@/lib/tags";
import type { Repo } from "@/types/repo";

const PALETTE = [
  "#6366f1",
  "#22d3ee",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#a78bfa",
  "#38bdf8",
  "#fb923c",
  "#4ade80",
  "#f472b6",
];

const PIE_LIMIT = 8;
const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface Slice {
  tag: string;
  count: number;
  color: string;
  isRest: boolean;
}

interface Props {
  repos: Repo[];
  selected: string | null;
  matchedCount: number;
  /** 全局搜索关键词（与顶部搜索框同步），已用于筛选 repos */
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (tag: string) => void;
  onClear: () => void;
  /** 嵌入「详细数据」面板时使用紧凑样式 */
  embedded?: boolean;
}

export default function TagPanel({
  repos,
  selected,
  matchedCount,
  query,
  onQueryChange,
  onSelect,
  onClear,
  embedded = false,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const { stats, taggedRepos, references } = useMemo(() => collectTagStats(repos), [repos]);

  const slices = useMemo<Slice[]>(() => {
    const head = stats.slice(0, PIE_LIMIT);
    const rest = stats.slice(PIE_LIMIT);
    const items: Slice[] = head.map((item, index) => ({
      tag: item.tag,
      count: item.count,
      color: PALETTE[index % PALETTE.length],
      isRest: false,
    }));

    // 被选中的标签始终保留在饼图里
    if (selected && !items.some((item) => item.tag === selected)) {
      const hit = stats.find((item) => item.tag === selected);
      if (hit) {
        items.push({
          tag: hit.tag,
          count: hit.count,
          color: PALETTE[items.length % PALETTE.length],
          isRest: false,
        });
      }
    }

    if (rest.length > 0) {
      items.push({
        tag: `其他 ${rest.length} 个`,
        count: rest.reduce((sum, item) => sum + item.count, 0),
        color: "var(--muted-faint)",
        isRest: true,
      });
    }

    return items;
  }, [stats, selected]);

  const total = references > 0 ? references : 1;

  const keyword = query.trim();

  // 折叠状态下检测是否超过两行；展开时不覆盖检测结果
  useEffect(() => {
    const element = listRef.current;
    if (!element || expanded) return;

    const check = () => setOverflowing(element.scrollHeight > element.clientHeight + 1);
    check();

    const observer = new ResizeObserver(check);
    observer.observe(element);
    return () => observer.disconnect();
  }, [stats, expanded]);

  const centerTag = selected && selected.length > 9 ? `${selected.slice(0, 8)}…` : selected ?? "";

  let offset = 0;
  const arcs = slices.map((slice) => {
    const length = (slice.count / total) * CIRCUMFERENCE;
    const dash = Math.max(length - 1.5, 0);
    const arc = { ...slice, dash, offset };
    offset += length;
    return arc;
  });

  // 与顶部搜索框共享同一关键词：改这里等于改全局搜索，仓库列表会实时过滤
  const searchBox = (
    <input
      type="search"
      className="search-input tag-search-input"
      placeholder="搜索详细数据：名称 / 描述 / Topics…"
      title="与顶部搜索框同步：模糊匹配全部字段，仅筛选详细数据表"
      value={query}
      onChange={(event) => onQueryChange(event.target.value)}
    />
  );

  const head = embedded ? (
    <div className="tag-section-head">
      <h3>标签统计</h3>
      <p>饼图展示标签分布，点击饼图或标签即可只看该标签下的仓库</p>
    </div>
  ) : (
    <div className="panel-head">
      <div>
        <h2>标签统计</h2>
        <p>饼图展示标签分布，点击饼图或标签即可只看该标签下的仓库</p>
      </div>
    </div>
  );

  const content = (
    <>
      <div className="tag-meta">
        <span>
          不同标签 <strong>{stats.length}</strong>
        </span>
        <span>
          已标注仓库 <strong>{taggedRepos}</strong> / {repos.length}
        </span>
        <span>
          标签引用 <strong>{references}</strong> 次
        </span>
      </div>

      {selected && (
        <div className="tag-selected">
          <button
            type="button"
            className="tag-chip active"
            onClick={() => onSelect(selected)}
            title="取消该标签筛选"
          >
            #{selected}
            <span className="tag-chip-x" aria-hidden="true">
              ×
            </span>
          </button>
          <span className="tag-selected-note">仅显示该标签下的 {matchedCount} 个仓库</span>
          <button type="button" className="link-btn" onClick={onClear}>
            清除筛选
          </button>
        </div>
      )}

      {stats.length === 0 ? (
        <div className="tag-all">
          <div className="tag-all-head">
            <h3>所有标签</h3>
            <span>0 个</span>
            {searchBox}
          </div>
          <p className="tag-empty">
            {repos.length === 0
              ? `没有匹配「${keyword}」的仓库。`
              : "这些仓库还没有设置 topics 标签。"}
          </p>
        </div>
      ) : (
        <>
          <div className="tag-chart">
            <svg
              className="tag-pie"
              viewBox="0 0 120 120"
              role="img"
              aria-label={`标签分布饼图，共 ${stats.length} 个标签`}
            >
              <circle
                cx="60"
                cy="60"
                r={RADIUS}
                fill="none"
                stroke="var(--track)"
                strokeWidth="15"
              />
              <g transform="rotate(-90 60 60)">
                {arcs.map((arc) => {
                  const active = !arc.isRest && arc.tag === selected;
                  return (
                    <circle
                      key={arc.tag}
                      cx="60"
                      cy="60"
                      r={RADIUS}
                      fill="none"
                      stroke={arc.color}
                      strokeWidth={active ? 17 : 15}
                      strokeDasharray={`${arc.dash} ${CIRCUMFERENCE - arc.dash}`}
                      strokeDashoffset={-arc.offset}
                      className={`tag-pie-slice${
                        selected && !arc.isRest && !active ? " dim" : ""
                      }`}
                      tabIndex={arc.isRest ? -1 : 0}
                      role={arc.isRest ? undefined : "button"}
                      aria-label={arc.isRest ? undefined : `按标签 ${arc.tag} 筛选`}
                      onClick={() => {
                        if (!arc.isRest) onSelect(arc.tag);
                      }}
                      onKeyDown={(event) => {
                        if (arc.isRest) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelect(arc.tag);
                        }
                      }}
                    >
                      <title>{`${arc.tag}：${arc.count} 个仓库`}</title>
                    </circle>
                  );
                })}
              </g>
              <text x="60" y="58" textAnchor="middle" className="tag-pie-value">
                {selected ? centerTag : stats.length}
              </text>
              <text x="60" y="73" textAnchor="middle" className="tag-pie-label">
                {selected ? `${matchedCount} 个仓库` : "个标签"}
              </text>
            </svg>

            <ul className="tag-legend">
              {slices.map((slice) => {
                const active = !slice.isRest && slice.tag === selected;
                return (
                  <li key={slice.tag} className={slice.isRest ? "rest" : undefined}>
                    <button
                      type="button"
                      className={active ? "active" : undefined}
                      aria-pressed={active}
                      disabled={slice.isRest}
                      onClick={() => {
                        if (!slice.isRest) onSelect(slice.tag);
                      }}
                      title={
                        slice.isRest
                          ? "其余标签的引用总和"
                          : `#${slice.tag}：${slice.count} 个仓库（${Math.round(
                              (slice.count / total) * 100,
                            )}%）`
                      }
                    >
                      <span className="tag-dot" style={{ background: slice.color }} />
                      <span className="tag-legend-name">{slice.tag}</span>
                      <span className="tag-legend-count">{slice.count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="tag-all">
            <div className="tag-all-head">
              {(overflowing || expanded) && (
                <button
                  type="button"
                  className="tag-toggle"
                  aria-expanded={expanded}
                  onClick={() => setExpanded((value) => !value)}
                  title={expanded ? "收起标签" : "展开全部标签"}
                >
                  {expanded ? "收起" : "展开"}
                  <span className="tag-toggle-arrow" aria-hidden="true">
                    {expanded ? "▲" : "▼"}
                  </span>
                </button>
              )}
              <h3>所有标签</h3>
              <span>{stats.length} 个</span>
              {searchBox}
            </div>

            {stats.length > 0 && (
              <div
                ref={listRef}
                className={`tag-list${expanded ? "" : " tag-list-collapsed"}`}
              >
                {stats.map(({ tag, count }) => (
                  <button
                    key={tag}
                    type="button"
                    className={`tag-chip${tag === selected ? " active" : ""}`}
                    aria-pressed={tag === selected}
                    onClick={() => onSelect(tag)}
                    title={`只看 #${tag} 下的 ${count} 个仓库`}
                  >
                    #{tag}
                    <span className="tag-chip-count">{count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );

  if (embedded) {
    return (
      <div className="tag-section" id="tags">
        {head}
        {content}
      </div>
    );
  }

  return (
    <section className="panel tag-panel" id="tags">
      {head}
      {content}
    </section>
  );
}
