"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { partGroups } from "@/lib/manifest";
import { openSearch } from "@/lib/search";
import { getProfile, PlayerProfile } from "@/lib/gamification";

export function Sidebar() {
  const pathname = usePathname();
  const groups = partGroups();
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  useEffect(() => {
    const update = () => {
      const p = getProfile();
      setCompleted(new Set(p.completedChapters || []));
    };
    update();

    const handleGame = (e: CustomEvent<PlayerProfile>) => {
      if (e.detail?.completedChapters) {
        setCompleted(new Set(e.detail.completedChapters));
      }
    };
    window.addEventListener("gb:gamification", handleGame as EventListener);
    return () => window.removeEventListener("gb:gamification", handleGame as EventListener);
  }, []);

  return (
    <aside className="sidebar">
      <Link href="/" className="sidebar-brand">
        <svg className="sidebar-mark" viewBox="0 0 64 64" width="26" height="26" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="gbBrand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#29C9F2" />
              <stop offset="1" stopColor="#0090B6" />
            </linearGradient>
          </defs>
          <rect width="64" height="64" rx="15" fill="url(#gbBrand)" />
          <g fill="#0B1220">
            <circle cx="17" cy="17.5" r="7" />
            <circle cx="47" cy="17.5" r="7" />
            <path d="M10 31 C10 13.5, 54 13.5, 54 31 L54 39 C54 51.5, 10 51.5, 10 39 Z" />
          </g>
          <circle cx="23" cy="29.5" r="10.4" fill="#FFFFFF" />
          <circle cx="41" cy="29.5" r="10.4" fill="#FFFFFF" />
          <circle cx="25" cy="29.5" r="5.2" fill="#0B1220" />
          <circle cx="43" cy="29.5" r="5.2" fill="#0B1220" />
          <rect x="29.4" y="43.4" width="2.4" height="5.4" rx="1.1" fill="#FFFFFF" />
          <rect x="32.2" y="43.4" width="2.4" height="5.4" rx="1.1" fill="#FFFFFF" />
        </svg>
        The Go <span className="spark">Bible</span>
      </Link>

      <button className="sidebar-search" onClick={() => openSearch()} type="button">
        <span className="sidebar-search-glass">⌕</span>
        <span>Search</span>
        <kbd className="sidebar-search-kbd">⌘K</kbd>
      </button>

      {groups.map((g) => (
        <div className="sidebar-part" key={g.part}>
          <span className="sidebar-part-label">
            {g.label} · {g.title}
          </span>
          {g.chapters.map((c) => {
            const active = pathname === c.href;
            const isDone = completed.has(c.slug);
            return (
              <Link
                key={c.slug}
                href={c.href}
                className={`sidebar-link ${active ? "active" : ""} ${
                  c.type === "project" ? "is-project" : ""
                } ${isDone ? "is-completed" : ""}`}
              >
                <span className="sidebar-num">{isDone ? "✓" : c.order}</span>
                <span className="sidebar-text">{c.title}</span>
                {c.type === "project" && (
                  <span className="sidebar-badge">build</span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
