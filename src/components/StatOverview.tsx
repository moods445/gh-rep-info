"use client";

import { useMemo } from "react";
import { formatNumber } from "@/lib/format";
import type { Repo, ReposMeta } from "@/types/repo";

interface Props {
  repos: Repo[];
  meta: ReposMeta;
  starred: boolean;
}

export default function StatOverview({ repos, meta, starred }: Props) {
  const stats = useMemo(() => {
    const totalStars = repos.reduce((sum, repo) => sum + repo.stars, 0);
    const totalForks = repos.reduce((sum, repo) => sum + repo.forks, 0);
    const archived = repos.filter((repo) => repo.isArchived).length;
    const languageCounts = new Map<string, number>();
    for (const repo of repos) {
      if (!repo.language) continue;
      languageCounts.set(repo.language, (languageCounts.get(repo.language) ?? 0) + 1);
    }
    const languages = [...languageCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    const withLanguage = [...languageCounts.values()].reduce((sum, n) => sum + n, 0);
    return { totalStars, totalForks, archived, languages, withLanguage };
  }, [repos]);

  const cards = [
    { label: "仓库总数", value: formatNumber(repos.length), hint: starred ? "已 Star 的仓库" : "个人仓库" },
    { label: "Star 总数", value: formatNumber(stats.totalStars), hint: "所有仓库累计" },
    { label: "Fork 总数", value: formatNumber(stats.totalForks), hint: "所有仓库累计" },
    { label: "主要语言", value: stats.languages[0]?.[0] ?? "—", hint: stats.languages[0] ? `${stats.languages[0][1]} 个仓库` : "暂无数据" },
  ];

  return (
    <>
      <section className="stat-grid" id="overview">
        {cards.map((card) => (
          <div className="stat-card" key={card.label}>
            <span className="stat-label">{card.label}</span>
            <span className="stat-value">{card.value}</span>
            <span className="stat-hint">{card.hint}</span>
          </div>
        ))}
      </section>

      <div className="stat-meta">
        <span>
          本次加载 <strong>{formatNumber(meta.total)}</strong> 个仓库
          {stats.archived > 0 ? `，其中 ${stats.archived} 个已归档` : ""}
        </span>
        {meta.rateLimitRemaining !== null && (
          <span>API 剩余额度：{formatNumber(meta.rateLimitRemaining)}</span>
        )}
        {meta.truncated && <span className="warn">已达单次加载上限，数据可能不完整</span>}
      </div>

      {stats.languages.length > 0 && (
        <div className="lang-panel">
          <div className="lang-head">
            <h3>语言分布</h3>
            <span>共 {stats.languages.length} 种语言进入统计</span>
          </div>
          <ul className="lang-list">
            {stats.languages.map(([language, count]) => (
              <li key={language}>
                <span className="lang-name">{language}</span>
                <span className="lang-track">
                  <span
                    className="lang-fill"
                    style={{ width: `${Math.max((count / stats.withLanguage) * 100, 3)}%` }}
                  />
                </span>
                <span className="lang-count">
                  {count} · {Math.round((count / stats.withLanguage) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
