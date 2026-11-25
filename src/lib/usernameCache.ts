const USER_KEY = "gh-stat:username";
export const USERNAME_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_USERNAMES = 5;

interface CachedUsername {
  value: string;
  expiresAt: number;
}

function isCachedUsername(value: unknown): value is CachedUsername {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as CachedUsername).value === "string" &&
    typeof (value as CachedUsername).expiresAt === "number"
  );
}

function parseItems(raw: string): CachedUsername[] {
  if (!raw) return [];
  const fresh: CachedUsername = { value: "", expiresAt: Date.now() + USERNAME_TTL_MS };
  try {
    const parsed: unknown = JSON.parse(raw);
    // 兼容旧版本：JSON 字符串
    if (typeof parsed === "string") {
      return parsed.trim() ? [{ ...fresh, value: parsed.trim() }] : [];
    }
    // 兼容旧版本：单条 { value, expiresAt }
    if (isCachedUsername(parsed)) return [parsed];
    // 当前格式：{ items: [...] }
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { items?: unknown }).items)) {
      return (parsed as { items: unknown[] }).items.filter(isCachedUsername);
    }
  } catch {
    // 兼容更旧版本：直接保存的纯字符串
    const legacy = raw.trim();
    if (legacy) return [{ ...fresh, value: legacy }];
  }
  return [];
}

function writeItems(items: CachedUsername[]): void {
  try {
    if (items.length === 0) {
      window.localStorage.removeItem(USER_KEY);
    } else {
      window.localStorage.setItem(USER_KEY, JSON.stringify({ items }));
    }
  } catch {
    // localStorage 不可用（隐私模式等）时忽略
  }
}

function readItems(): CachedUsername[] {
  if (typeof window === "undefined") return [];
  try {
    const items = parseItems(window.localStorage.getItem(USER_KEY) ?? "");
    const now = Date.now();
    const seen = new Set<string>();
    const valid = items
      .filter((item) => item.expiresAt > now && item.value.trim())
      .sort((a, b) => b.expiresAt - a.expiresAt)
      .filter((item) => {
        const key = item.value.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    if (valid.length !== items.length) writeItems(valid);
    return valid;
  } catch {
    return [];
  }
}

/** 最近使用的用户名（用于自动填充） */
export function readCachedUsername(): string {
  return readItems()[0]?.value ?? "";
}

/** 全部未过期的用户名，最近使用在前 */
export function listCachedUsernames(): string[] {
  return readItems().map((item) => item.value);
}

/** 记录一次使用：去重后置顶，并刷新 30 天有效期 */
export function cacheUsername(value: string): void {
  if (typeof window === "undefined") return;
  const name = value.trim();
  if (!name) return;
  try {
    const rest = readItems().filter((item) => item.value.toLowerCase() !== name.toLowerCase());
    writeItems([{ value: name, expiresAt: Date.now() + USERNAME_TTL_MS }, ...rest].slice(0, MAX_USERNAMES));
  } catch {
    // 忽略
  }
}

export function clearCachedUsername(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(USER_KEY);
  } catch {
    // 忽略
  }
}
