import { fetchRepos, GithubApiError } from "@/lib/github";
import type { RepoMode, ReposResponse } from "@/types/repo";

/**
 * 默认 `direct`：浏览器直接请求 GitHub，可部署为纯静态站点。
 * 设置 `NEXT_PUBLIC_API_MODE=proxy` 则改为请求本项目的 `/api/repos` 服务端代理。
 */
const DATA_SOURCE: "direct" | "proxy" =
  process.env.NEXT_PUBLIC_API_MODE === "proxy" ? "proxy" : "direct";

export function getDataSource(): "direct" | "proxy" {
  return DATA_SOURCE;
}

interface LoadReposOptions {
  mode: RepoMode;
  username?: string;
  token?: string;
}

export async function loadRepos({
  mode,
  username,
  token,
}: LoadReposOptions): Promise<ReposResponse> {
  if (DATA_SOURCE === "direct") {
    return fetchRepos({ mode, username, token });
  }

  const params = new URLSearchParams({ mode });
  if (username) params.set("username", username);

  const res = await fetch(`/api/repos?${params.toString()}`, {
    cache: "no-store",
    headers: token ? { "x-github-token": token } : undefined,
  });
  const body = (await res.json().catch(() => null)) as
    | (ReposResponse & { error?: string })
    | null;

  if (!res.ok) {
    throw new GithubApiError(res.status, body?.error ?? `请求失败（HTTP ${res.status}）`);
  }
  return body as ReposResponse;
}
