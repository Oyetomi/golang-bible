"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  loadIndex,
  search,
  partLabel,
  type SearchEntry,
  type ChapterGroup,
  type Hit,
} from "@/lib/search";

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  const re = new RegExp(
    "(" + terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")",
    "ig"
  );
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        re.test(p) ? (
          <mark key={i} className="sr-mark">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

export function Search() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState<SearchEntry[] | null>(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Open via ⌘K / Ctrl+K or the custom 'gb:search' event (sidebar button).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onEvt = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("gb:search", onEvt);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("gb:search", onEvt);
    };
  }, []);

  // Lazy-load the index the first time the modal opens; focus the input.
  useEffect(() => {
    if (!open) return;
    if (!index) loadIndex().then(setIndex);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.body.style.overflow = "";
    };
  }, [open, index]);

  const groups: ChapterGroup[] = useMemo(
    () => (index ? search(index, q) : []),
    [index, q]
  );

  // Flatten to a navigable list for arrow-key selection.
  const flat: Hit[] = useMemo(() => groups.flatMap((g) => g.hits), [groups]);
  useEffect(() => setSel(0), [q]);

  const go = (h: Hit) => {
    const url = h.entry.href + (h.entry.anchor ? `#${h.entry.anchor}` : "");
    setOpen(false);
    setQ("");
    router.push(url);
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && flat[sel]) {
      e.preventDefault();
      go(flat[sel]);
    }
  };

  if (!open) return null;

  let flatIdx = -1;

  return (
    <div className="sr-overlay" onClick={() => setOpen(false)}>
      <div className="sr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sr-inputbar">
          <span className="sr-glass">⌕</span>
          <input
            ref={inputRef}
            className="sr-input"
            placeholder="Search the Go Bible — concepts, chapters, sections…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onInputKey}
          />
          <kbd className="sr-esc">esc</kbd>
        </div>

        <div className="sr-results">
          {!index && <div className="sr-hint">Loading the index…</div>}
          {index && q && flat.length === 0 && (
            <div className="sr-hint">No matches for “{q}”.</div>
          )}
          {index && !q && (
            <div className="sr-hint">
              Type to search 64 chapters. <kbd>↑</kbd>
              <kbd>↓</kbd> to navigate, <kbd>↵</kbd> to open.
            </div>
          )}
          {groups.map((g) => (
            <div className="sr-group" key={g.href}>
              <div className="sr-group-head">
                <span className="sr-chapter">{g.chTitle}</span>
                <span className={`sr-part sr-part-${g.type}`}>
                  {partLabel(g.part)}
                  {g.type === "project" ? " · Project" : ""}
                </span>
              </div>
              {g.hits.map((h) => {
                flatIdx++;
                const active = flatIdx === sel;
                return (
                  <button
                    key={h.entry.id}
                    className={`sr-hit ${active ? "active" : ""}`}
                    onMouseEnter={() => setSel(flat.indexOf(h))}
                    onClick={() => go(h)}
                  >
                    <span className="sr-hit-title">
                      {h.entry.heading ? (
                        <>
                          <span className="sr-hit-icon">#</span>
                          {h.entry.heading}
                        </>
                      ) : (
                        <span className="sr-hit-intro">Overview</span>
                      )}
                    </span>
                    {h.snippet.text && (
                      <span className="sr-hit-snip">
                        <Highlight text={h.snippet.text} terms={h.snippet.terms} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="sr-footer">
          <span>
            <kbd>↵</kbd> open
          </span>
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
