import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GitHub 仓库统计",
  description: "基于 GitHub REST API 统计个人仓库与 Star 仓库的简要信息与详细数据",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// 首屏前应用主题，默认深色，避免深浅切换时的白屏闪烁
const themeScript = `
(function () {
  try {
    var saved = window.localStorage.getItem("gh-stat:theme");
    document.documentElement.dataset.theme = saved === "light" ? "light" : "dark";
  } catch (error) {
    document.documentElement.dataset.theme = "dark";
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
