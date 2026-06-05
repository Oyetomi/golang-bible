"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { partGroups } from "@/lib/manifest";
import { openSearch } from "@/lib/search";

export function Sidebar() {
  const pathname = usePathname();
  const groups = partGroups();

  return (
    <aside className="sidebar">
      <Link href="/" className="sidebar-brand">
        The Go <span className="spark">Bible</span>
      </Link>

      <button className="sidebar-search" onClick={() => openSearch()}>
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
            return (
              <Link
                key={c.slug}
                href={c.href}
                className={`sidebar-link ${active ? "active" : ""} ${
                  c.type === "project" ? "is-project" : ""
                }`}
              >
                <span className="sidebar-num">{c.order}</span>
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
