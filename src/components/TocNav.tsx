"use client";

import { useCallback, useEffect, useState, type MouseEvent } from "react";

export interface TocItem {
  id: string;
  label: string;
}

export default function TocNav({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string>("");
  const [open, setOpen] = useState(false);
  const key = items.map((item) => item.id).join(",");

  useEffect(() => {
    const ids = key ? key.split(",") : [];
    if (ids.length === 0) return;

    let frame = 0;

    const update = () => {
      frame = 0;
      const offset = window.innerHeight * 0.32;
      let current = ids[0];
      for (const id of ids) {
        const element = document.getElementById(id);
        if (!element) continue;
        if (element.getBoundingClientRect().top - offset <= 0) {
          current = id;
        }
      }
      // 页面滚到底部时强制高亮最后一项
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) {
        current = ids[ids.length - 1];
      }
      setActive(current);
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [key]);

  const handleClick = useCallback((event: MouseEvent<HTMLAnchorElement>, id: string) => {
    const element = document.getElementById(id);
    if (!element) return;
    event.preventDefault();
    element.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
    setOpen(false);
  }, []);

  if (items.length === 0) return null;

  return (
    <>
      <button
        type="button"
        className="toc-fab"
        aria-expanded={open}
        aria-controls="page-toc"
        onClick={() => setOpen((value) => !value)}
      >
        目录
      </button>
      <nav id="page-toc" className={`toc${open ? " toc-open" : ""}`} aria-label="页面目录">
        <span className="toc-title">目录</span>
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={active === item.id ? "active" : undefined}
                onClick={(event) => handleClick(event, item.id)}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="toc-top"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
            setOpen(false);
          }}
        >
          回到顶部
        </button>
      </nav>
    </>
  );
}
