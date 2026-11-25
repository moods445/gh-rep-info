"use client";

import { useEffect, useState } from "react";

const THEME_KEY = "gh-stat:theme";

type Theme = "dark" | "light";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  // 内联脚本已在首屏前写入 data-theme，这里只同步按钮状态
  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // 隐私模式下 localStorage 不可用，忽略即可
    }
  }

  const isDark = theme === "dark";
  const label = isDark ? "切换到浅色模式" : "切换到深色模式";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      {isDark ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path
            d="M20.2 14.6A8.4 8.4 0 0 1 9.4 3.8 8.5 8.5 0 1 0 20.2 14.6Z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" />
          <path
            d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4 17 7M7 17l-1.6 1.6"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
