import type { Repo } from "@/types/repo";

export interface TagStat {
  tag: string;
  count: number;
}

export interface TagSummary {
  stats: TagStat[];
  uniqueTags: number;
  taggedRepos: number;
  references: number;
}

/** 统计仓库 topics：按引用次数降序，次数相同按名称排序 */
export function collectTagStats(repos: Repo[]): TagSummary {
  const counts = new Map<string, number>();
  let taggedRepos = 0;
  let references = 0;

  for (const repo of repos) {
    const seen = new Set<string>();
    for (const raw of repo.topics) {
      const tag = raw.trim().toLowerCase();
      if (!tag || seen.has(tag)) continue;
      seen.add(tag);
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
      references += 1;
    }
    if (seen.size > 0) taggedRepos += 1;
  }

  const stats = [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "en"));

  return {
    stats,
    uniqueTags: stats.length,
    taggedRepos,
    references,
  };
}

/** 只看包含该标签的仓库 */
export function filterByTag(repos: Repo[], tag: string | null): Repo[] {
  if (!tag) return repos;
  const wanted = tag.toLowerCase();
  return repos.filter((repo) => repo.topics.some((topic) => topic.toLowerCase() === wanted));
}
