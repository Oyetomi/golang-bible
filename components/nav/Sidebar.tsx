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
