"use client";

import { useState } from "react";
import { listCachedUsernames } from "@/lib/usernameCache";

interface Props {
  token: string;
  username: string;
  loading: boolean;
  hasData: boolean;
  onTokenChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
}

export default function CredentialBar({
  token,
  username,
  loading,
  hasData,
  onTokenChange,
  onUsernameChange,
  onSubmit,
  onClear,
}: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  return (
    <form
      className="credential-bar"
      onSubmit={(event) => {
        event.preventDefault();
        setShowSuggestions(false);
        onSubmit();
      }}
    >
      <div className="field">
        <label htmlFor="gh-token">Personal Access Token</label>
        <input
          id="gh-token"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="ghp_...（可选，填写后可读取私有仓库）"
          value={token}
          onChange={(event) => onTokenChange(event.target.value)}
        />
      </div>
      <div className="field field-username">
        <label htmlFor="gh-user">GitHub 用户名</label>
        <input
          id="gh-user"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="octocat"
          value={username}
          onChange={(event) => onUsernameChange(event.target.value)}
          onFocus={() => {
            setSuggestions(listCachedUsernames());
            setShowSuggestions(true);
          }}
          onBlur={() => setShowSuggestions(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setShowSuggestions(false);
          }}
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul className="username-suggestions" role="listbox" aria-label="最近使用的用户名">
            {suggestions.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  role="option"
                  aria-selected={name === username}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onUsernameChange(name);
                    setShowSuggestions(false);
                  }}
                >
                  <span>{name}</span>
                  {name === username ? <em>当前</em> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="credential-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={loading}
          onClick={() => {
            setShowSuggestions(false);
            onSubmit();
          }}
        >
          {loading ? "加载中…" : hasData ? "重新加载" : "加载数据"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onClear}>
          清除
        </button>
      </div>
      <p className="credential-hint">
        当前为纯静态站点：浏览器直接请求 GitHub，Token 仅保存在本机浏览器。
        查询对象始终是填入的用户名：带 Token 只提升配额，且仅当用户名与 Token 主人一致时才包含私有仓库。
        查询结果（含带 Token 的私有数据）会按用户名缓存 1 天，请勿在共用电脑使用；可用「删除缓存」清除。
        最近使用的用户名缓存 30 天，点击用户名输入框可快速填入；未填写 Token 时受 GitHub 每小时 60 次请求限制。
        <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer">
          生成 Token
        </a>
      </p>
    </form>
  );
}
