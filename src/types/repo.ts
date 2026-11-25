export type RepoMode = "owned" | "starred";

export interface Repo {
  id: number;
  name: string;
  fullName: string;
  htmlUrl: string;
  description: string | null;
  homepage: string | null;
  language: string | null;
  topics: string[];
  stars: number;
  forks: number;
  openIssues: number;
  sizeKb: number;
  license: string | null;
  visibility: string;
  isFork: boolean;
  isArchived: boolean;
  defaultBranch: string;
  owner: string;
  ownerAvatar: string;
  createdAt: string;
  updatedAt: string;
  pushedAt: string | null;
  starredAt: string | null;
}

export interface ReposMeta {
  total: number;
  pagesFetched: number;
  truncated: boolean;
  rateLimitRemaining: number | null;
  login: string | null;
}

export interface ReposResponse {
  repos: Repo[];
  meta: ReposMeta;
}

export interface GithubErrorBody {
  error: string;
}

export type RepoSortKey =
  | "name"
  | "language"
  | "stars"
  | "forks"
  | "openIssues"
  | "sizeKb"
  | "license"
  | "visibility"
  | "createdAt"
  | "updatedAt"
  | "pushedAt"
  | "starredAt";

export type SortDirection = "asc" | "desc";

