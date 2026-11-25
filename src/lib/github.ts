import type { Repo, RepoMode, ReposResponse } from "@/types/repo";
import { normalizeUsername } from "@/lib/githubUsername";

const API_BASE = "https://api.github.com";
const PER_PAGE = 100;
export const DEFAULT_MAX_PAGES = 10;

interface RawRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  homepage: string | null;
  language: string | null;
  topics?: string[];
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  size: number;
  license: { spdx_id: string | null; name: string } | null;
  visibility?: string;
  fork: boolean;
  archived: boolean;
  default_branch: string;
  owner: { login: string; avatar_url: string };
  created_at: string;
  updated_at: string;
  pushed_at: string | null;
}

interface RawStarredItem {
  starred_at: string;
  repo: RawRepo;
}

export class GithubApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GithubApiError";
    this.status = status;
  }
}

function buildHeaders(token?: string, starred = false): HeadersInit {
  return {
    Accept: starred
      ? "application/vnd.github.star+json"
      : "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "gh-stat",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const GITHUB_TIMEOUT_MS = 9000;
const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUS = new Set([500, 502, 503, 504]);

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ghFetch<T>(
  path: string,
  token: string | undefined,
  starred = false,
): Promise<{ data: T; rateLimitRemaining: number | null }> {
  let lastNetworkError: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        headers: buildHeaders(token, starred),
        cache: "no-store",
        signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
      });
    } catch (err) {
      // 超时或网络错误，重试
      lastNetworkError = err;
      if (attempt < MAX_ATTEMPTS) {
        await delay(attempt * 600);
        continue;
      }
      throw new GithubApiError(
        504,
        "GitHub API 响应超时或网络不稳定，请稍后重试",
      );
    }

    if (!res.ok) {
      let message = `GitHub API 请求失败（HTTP ${res.status}）`;
      try {
        const body = (await res.json()) as { message?: string };
        if (body.message) message = body.message;
      } catch {
        // 忽略响应体解析失败
      }

      // GitHub 偶发 5xx（如 504）时自动重试
      if (RETRYABLE_STATUS.has(res.status)) {
        if (attempt < MAX_ATTEMPTS) {
          await delay(attempt * 600);
          continue;
        }
        throw new GithubApiError(
          res.status,
          "GitHub 服务暂时不可用，请稍后重试（已自动重试多次）",
        );
      }

      if (res.status === 401) message = "Token 无效或已过期，请重新填写";
      if (res.status === 403 && message.toLowerCase().includes("rate limit")) {
        message = "GitHub API 速率限制已用尽，请稍后再试或填写 Token";
      }
      if (res.status === 404) message = "用户或资源不存在";
      throw new GithubApiError(res.status, message);
    }

    const remaining = res.headers.get("x-ratelimit-remaining");
    return {
      data: (await res.json()) as T,
      rateLimitRemaining: remaining === null ? null : Number(remaining),
    };
  }

  // 理论上不会到达，兜底
  throw new GithubApiError(
    504,
    lastNetworkError ? "GitHub API 网络请求失败，请稍后重试" : "GitHub API 请求失败",
  );
}

function normalizeRepo(raw: RawRepo, starredAt: string | null): Repo {
  const license = raw.license
    ? raw.license.spdx_id && raw.license.spdx_id !== "NOASSERTION"
      ? raw.license.spdx_id
      : raw.license.name
    : null;

  return {
    id: raw.id,
    name: raw.name,
    fullName: raw.full_name,
    htmlUrl: raw.html_url,
    description: raw.description,
    homepage: raw.homepage,
    language: raw.language,
    topics: raw.topics ?? [],
    stars: raw.stargazers_count,
    forks: raw.forks_count,
    openIssues: raw.open_issues_count,
    sizeKb: raw.size,
    license,
    visibility: raw.visibility ?? (raw.fork ? "fork" : "public"),
    isFork: raw.fork,
    isArchived: raw.archived,
    defaultBranch: raw.default_branch,
    owner: raw.owner.login,
    ownerAvatar: raw.owner.avatar_url,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    pushedAt: raw.pushed_at,
    starredAt,
  };
}

export interface FetchReposOptions {
  mode: RepoMode;
  token?: string;
  username?: string;
  maxPages?: number;
}

export async function fetchRepos({
  mode,
  token,
  username,
  maxPages = DEFAULT_MAX_PAGES,
}: FetchReposOptions): Promise<ReposResponse> {
  const pageLimit = Math.min(Math.max(maxPages, 1), 30);
  const requested = username ? normalizeUsername(username) : "";
  let login = requested || null;
  let tokenLogin: string | null = null;

  if (token) {
    const { data } = await ghFetch<{ login: string }>("/user", token);
    tokenLogin = data.login;
    login = login || data.login;
  }

  if (!login) {
    throw new GithubApiError(400, "未提供 Token 时需要填写 GitHub 用户名");
  }
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/.test(login)) {
    throw new GithubApiError(400, "GitHub 用户名格式不正确");
  }

  // Token 仅用于鉴权与配额；查询对象始终由用户名决定。
  // 仅当用户名就是 Token 主人时，才使用 /user 接口读取私有仓库。
  const isSelf =
    tokenLogin !== null && tokenLogin.toLowerCase() === login.toLowerCase();

  const repos: Repo[] = [];
  let rateLimitRemaining: number | null = null;
  let page = 1;
  let truncated = false;

  for (; page <= pageLimit; page += 1) {
    const query = new URLSearchParams({
      per_page: String(PER_PAGE),
      page: String(page),
    });

    let path: string;
    if (mode === "owned") {
      query.set("sort", "updated");
      path = isSelf
        ? `/user/repos?${query.toString()}&affiliation=owner`
        : `/users/${login}/repos?${query.toString()}&type=owner`;
    } else {
      query.set("sort", "created");
      query.set("direction", "desc");
      path = isSelf
        ? `/user/starred?${query.toString()}`
        : `/users/${login}/starred?${query.toString()}`;
    }

    const { data, rateLimitRemaining: remaining } = await ghFetch<
      RawRepo[] | RawStarredItem[]
    >(path, token, mode === "starred");

    rateLimitRemaining =
      remaining === null
        ? rateLimitRemaining
        : rateLimitRemaining === null
          ? remaining
          : Math.min(rateLimitRemaining, remaining);

    const items = data as (RawRepo | RawStarredItem)[];
    for (const item of items) {
      if ("repo" in item) {
        repos.push(normalizeRepo(item.repo, item.starred_at));
      } else {
        repos.push(normalizeRepo(item, null));
      }
    }

    if (items.length < PER_PAGE) break;
    if (page === pageLimit) truncated = true;
  }

  return {
    repos,
    meta: {
      total: repos.length,
      pagesFetched: Math.min(page, pageLimit),
      truncated,
      rateLimitRemaining,
      login,
    },
  };
}
