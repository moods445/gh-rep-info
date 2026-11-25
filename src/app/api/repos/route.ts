import { NextResponse } from "next/server";
import { fetchRepos, GithubApiError, DEFAULT_MAX_PAGES } from "@/lib/github";
import type { RepoMode } from "@/types/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode: RepoMode = searchParams.get("mode") === "starred" ? "starred" : "owned";
  const username = searchParams.get("username")?.trim() || undefined;
  const parsedMaxPages = Number(searchParams.get("maxPages"));
  const maxPages = Number.isFinite(parsedMaxPages) && parsedMaxPages > 0
    ? parsedMaxPages
    : DEFAULT_MAX_PAGES;
  const token =
    request.headers.get("x-github-token")?.trim() ||
    process.env.GITHUB_TOKEN?.trim() ||
    undefined;

  try {
    const result = await fetchRepos({ mode, token, username, maxPages });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GithubApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof TypeError) {
      console.error("[gh-stat] 无法连接 GitHub API", error);
      return NextResponse.json(
        { error: "无法连接 GitHub API，请检查本机网络或代理设置" },
        { status: 502 },
      );
    }
    console.error("[gh-stat] 请求 GitHub 失败", error);
    return NextResponse.json({ error: "服务器请求 GitHub 失败，请稍后重试" }, { status: 500 });
  }
}
