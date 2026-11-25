const GITHUB_URL_PREFIX = /^(?:https?:\/\/)?(?:www\.)?github\.com\//i;

/**
 * 兼容 `@name`、`github.com/name`、完整主页链接等常见输入形式。
 */
export function normalizeUsername(input: string): string {
  return input
    .trim()
    .replace(GITHUB_URL_PREFIX, "")
    .replace(/^@+/, "")
    .split(/[?#]/)[0]
    .replace(/\/+$/, "")
    .trim();
}
