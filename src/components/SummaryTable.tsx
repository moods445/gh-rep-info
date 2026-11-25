"use client";

import { useEffect, useState } from "react";
import TableFooter from "@/components/TableFooter";
import { shortUrl } from "@/lib/format";
import type { Repo } from "@/types/repo";

const PAGE_SIZE = 50;

interface Props {
  repos: Repo[];
  starred: boolean;
  /** 无数据时表格内显示的提示，保持表格结构不变 */
  emptyText?: string;
}

export default function SummaryTable({ repos, starred, emptyText }: Props) {
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [repos]);

  return (
    <section className="panel" id="summary">
      <div className="panel-head">
        <div>
          <h2>简要信息</h2>
          <p>
            {starred ? "已 Star 仓库" : "个人仓库"}的名称与简介，共 {repos.length} 条
          </p>
        </div>
      </div>
      <div className="table-wrap">
        <table className="data-table summary-table">
          <thead>
            <tr>
              <th className="col-index">#</th>
              <th>仓库</th>
              <th>仓库地址</th>
              <th>项目简要说明</th>
            </tr>
          </thead>
          <tbody>
            {repos.length === 0 ? (
              <tr>
                <td colSpan={4} className="table-empty">
                  {emptyText ?? "没有匹配的仓库。"}
                </td>
              </tr>
            ) : (
              repos.slice(0, visible).map((repo, index) => (
                <tr key={repo.id}>
                  <td className="col-index">{index + 1}</td>
                  <td>
                    <a className="repo-link" href={repo.htmlUrl} target="_blank" rel="noreferrer">
                      {repo.name}
                    </a>
                    <span className="repo-owner">{repo.owner}</span>
                  </td>
                  <td>
                    <a className="url-link" href={repo.htmlUrl} target="_blank" rel="noreferrer">
                      {shortUrl(repo.htmlUrl)}
                    </a>
                  </td>
                  <td className="desc-cell" title={repo.description ?? undefined}>
                    <div className="desc-text">
                      {repo.description || <span className="muted">暂无描述</span>}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <TableFooter
        shown={Math.min(visible, repos.length)}
        total={repos.length}
        step={PAGE_SIZE}
        onMore={() => setVisible((count) => count + PAGE_SIZE)}
      />
    </section>
  );
}
