import { formatDate, formatSize } from "@/lib/format";
import type { Repo } from "@/types/repo";

/** 允许的子序列跨度余量，避免过于松散的模糊命中 */
const SPAN_SLACK = 3;
/** 短词只做子串匹配，减少误命中 */
const FUZZY_MIN_LENGTH = 3;
/** 数值/日期字段需要更长的查询词才参与匹配 */
const NUMERIC_MIN_LENGTH = 3;

function subsequenceSpan(text: string, token: string): number {
  let cursor = 0;
  let start = -1;
  let end = -1;

  for (let index = 0; index < text.length && cursor < token.length; index += 1) {
    if (text[index] !== token[cursor]) continue;
    if (start < 0) start = index;
    end = index;
    cursor += 1;
  }

  if (cursor < token.length) return -1;
  return end - start + 1;
}

/**
 * 模糊匹配：优先子串，其次按顺序出现的字符（fzf 风格），
 * 但命中片段不能过长，避免无关结果。
 */
export function fuzzyIncludes(text: string, token: string): boolean {
  if (!token) return true;
  if (text.includes(token)) return true;
  if (token.length < FUZZY_MIN_LENGTH) return false;

  const span = subsequenceSpan(text, token);
  return span >= 0 && span <= token.length + SPAN_SLACK;
}

interface SearchIndex {
  /** 名称 / 全名 / Topics / 语言 / 许可证，允许顺序模糊匹配 */
  identity: string[];
  /** 普通文本字段，只做子串匹配 */
  text: string[];
  /** 数值与日期，仅当查询词含数字且足够长时参与 */
  numeric: string[] | null;
}

function buildIndex(repo: Repo, needNumeric: boolean): SearchIndex {
  const identity = [
    repo.name,
    repo.fullName,
    repo.topics.join(" "),
    repo.language ?? "",
    repo.license ?? "",
  ].map((value) => value.toLowerCase());

  const text = [
    ...identity,
    (repo.description ?? "").toLowerCase(),
    (repo.homepage ?? "").toLowerCase(),
  ];

  const numeric = needNumeric
    ? [
        String(repo.stars),
        String(repo.forks),
        String(repo.openIssues),
        String(repo.sizeKb),
        formatSize(repo.sizeKb),
        formatDate(repo.createdAt),
        formatDate(repo.updatedAt),
        formatDate(repo.pushedAt),
        formatDate(repo.starredAt),
      ].map((value) => value.toLowerCase())
    : null;

  return { identity, text, numeric };
}

/** 常见缩写，避免「ts」「js」这类短词查不到结果 */
const TOKEN_ALIASES: Record<string, string> = {
  ts: "typescript",
  js: "javascript",
  py: "python",
  rs: "rust",
  ml: "machine-learning",
  k8s: "kubernetes",
  db: "database",
};

function tokenCandidates(token: string): string[] {
  const alias = TOKEN_ALIASES[token];
  return alias && alias !== token ? [token, alias] : [token];
}

function matchesToken(index: SearchIndex, token: string): boolean {
  if (index.text.some((field) => field.includes(token))) return true;
  if (index.identity.some((field) => fuzzyIncludes(field, token))) return true;

  if (index.numeric && token.length >= NUMERIC_MIN_LENGTH && /\d/.test(token)) {
    return index.numeric.some((field) => field.includes(token));
  }

  return false;
}

/** 全数据模糊搜索：空格分隔多个关键词时需全部命中（每个关键词可落在任意字段） */
export function searchRepos(repos: Repo[], rawQuery: string): Repo[] {
  const tokens = rawQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return repos;

  const needNumeric = tokens.some(
    (token) => token.length >= NUMERIC_MIN_LENGTH && /\d/.test(token),
  );

  return repos.filter((repo) => {
    const index = buildIndex(repo, needNumeric);
    return tokens.every((token) =>
      tokenCandidates(token).some((candidate) => matchesToken(index, candidate)),
    );
  });
}
