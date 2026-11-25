import type { RepoMode, ReposResponse } from "@/types/repo";

const PREFIX = "gh-stat:repos:";
export const REPO_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type CacheScope = "auth" | "anon";

interface ModeCache {
  savedAt: number;
  data: ReposResponse;
}

type CacheEntry = Partial<Record<RepoMode, ModeCache>>;

function keyFor(login: string, scope: CacheScope): string {
  return `${PREFIX}${login.trim().toLowerCase()}:${scope}`;
}

function readEntry(login: string, scope: CacheScope): CacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(keyFor(login, scope));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as CacheEntry;
  } catch {
    return null;
  }
}

function writeEntry(login: string, scope: CacheScope, entry: CacheEntry): void {
  try {
    const key = keyFor(login, scope);
    if (!entry.owned && !entry.starred) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // 超出配额或存储不可用时放弃缓存
    try {
      window.localStorage.removeItem(keyFor(login, scope));
    } catch {
      // 忽略
    }
  }
}

export function readRepoCache(
  login: string,
  mode: RepoMode,
  scope: CacheScope,
): { data: ReposResponse; savedAt: number } | null {
  const entry = readEntry(login, scope);
  const item = entry?.[mode];
  if (!entry || !item || typeof item.savedAt !== "number" || !item.data) return null;

  if (Date.now() - item.savedAt > REPO_CACHE_TTL_MS) {
    delete entry[mode];
    writeEntry(login, scope, entry);
    return null;
  }
  return item;
}

export function writeRepoCache(
  login: string,
  mode: RepoMode,
  data: ReposResponse,
  scope: CacheScope,
): void {
  const entry = readEntry(login, scope) ?? {};
  entry[mode] = { savedAt: Date.now(), data };
  writeEntry(login, scope, entry);
}

/** 只清除该用户名下的查询缓存（含带/不带 Token 两种），不影响其他用户名与登录凭据。 */
export function clearRepoCache(login: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    let existed = false;
    for (const scope of ["auth", "anon"] as CacheScope[]) {
      const key = keyFor(login, scope);
      if (window.localStorage.getItem(key) !== null) existed = true;
      window.localStorage.removeItem(key);
    }
    return existed;
  } catch {
    return false;
  }
}
