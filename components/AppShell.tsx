"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/nav/Sidebar";
import { CodeEnhancer } from "@/components/CodeEnhancer";
import { Search } from "@/components/Search";
import { Ribbon } from "@/components/Ribbon";

/* Collapsible app shell. Collapsing the sidebar hands the whole viewport to the
   content column so code, animations, and playgrounds get maximum width.
   State persists in localStorage; ⌘\ / Ctrl+\ toggles. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("gb-sidebar") === "collapsed");
    setReady(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const toggle = () =>
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("gb-sidebar", next ? "collapsed" : "open");
      return next;
    });

  return (
    <div
      className={`layout ${collapsed ? "layout-collapsed" : ""}`}
      data-ready={ready ? "1" : "0"}
    >
      <Sidebar />
      <button
        className="rail-toggle"
        onClick={toggle}
        aria-label={collapsed ? "Open sidebar" : "Collapse sidebar"}
        title={`${collapsed ? "Open" : "Collapse"} sidebar (⌘\\)`}
      >
        {collapsed ? "»" : "«"}
      </button>
      <main className="content">
        {children}
        <footer className="site-foot">
          Gopher mascot inspired by the Go gopher, designed by{" "}
          <a href="https://reneefrench.blogspot.com/" target="_blank" rel="noreferrer">
            Renée French
          </a>{" "}
          (CC BY 4.0).
        </footer>
      </main>
      <CodeEnhancer />
      <Search />
      <Ribbon />
    </div>
  );
}
