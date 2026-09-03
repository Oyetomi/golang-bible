"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addXP } from "@/lib/gamification";
import { playClick, playSuccess } from "@/lib/sound";
import { Gopher } from "@/components/course/Gopher";

interface StepInsight {
  title: string;
  desc: string;
  tag: string;
}

function analyzeSnippet(code: string): StepInsight[] {
  const steps: StepInsight[] = [
    {
      title: "1. Runtime Bootstrap & main()",
      desc: "The Go runtime initializes memory allocators, starts background GC, and schedules the primary goroutine starting in func main().",
      tag: "Runtime",
    },
  ];

  if (code.includes("defer ")) {
    steps.push({
      title: "2. Deferred Call Stack",
      desc: "Go registers `defer` invocations onto a LIFO call list within the goroutine descriptor, executing them in reverse order upon function return.",
      tag: "Defer",
    });
  }

  if (code.includes("go ") || code.includes("go func")) {
    steps.push({
      title: "3. Goroutine Scheduling",
      desc: "The `go` statement allocates a ~2KB stack and pushes runnable goroutines (G) onto logical processor (P) run queues.",
      tag: "Concurrency",
    });
  }

  if (code.includes("chan ") || code.includes("make(chan") || code.includes("<-")) {
    steps.push({
      title: "4. Channel Synchronization",
      desc: "Channels coordinate data transfer with internal hchan lock & ring buffers, avoiding shared-memory race conditions.",
      tag: "Channels",
    });
  }

  if (code.includes("sync.Mutex") || code.includes("sync.RWMutex") || code.includes("sync.WaitGroup")) {
    steps.push({
      title: "5. Synchronization Primitives",
      desc: "Acquires mutex locks or tracks WaitGroup counter to guarantee mutual exclusion and thread-safe memory barriers.",
      tag: "Sync",
    });
  }

  if (code.includes("for ") || code.includes("range ")) {
    steps.push({
      title: "6. Iteration & Flow Control",
      desc: "Executes loop iterations over slices/maps/channels with branch prediction and loop-invariant optimizations.",
      tag: "Loops",
    });
  }

  if (code.includes("fmt.") || code.includes("print") || code.includes("os.Stdout")) {
    steps.push({
      title: "7. Standard I/O Buffer",
      desc: "Writes formatted byte streams to os.Stdout file descriptor, captured live by the Codapi sandbox runner.",
      tag: "Stdout",
    });
  }

  steps.push({
    title: `${steps.length + 1}. Clean Termination`,
    desc: "Main goroutine finishes, unwinds remaining defers, and exits with status 0, terminating any child goroutines.",
    tag: "Exit",
  });

  return steps;
}

/* Client island for a <GoPlayground>. The code is rendered (and highlighted) by
   the server as a fenced ```go block; this adds:
   - a real Run button + output via Codapi (<codapi-snippet> reads the code from
     the element matched by `selector` and runs it on Codapi's Go sandbox).
   - a Reset to Starter button to restore original code snippet.
   - a What Happened? / Step-by-Step explainer toggle for beginner clarity.
   - a Copy button that reads the element's text.
   - an Expand button that opens a full-screen overlay of the code, for reading.
   - Gamification & Sound integration (+10 XP on run, success chime on clean output).
   The Codapi script is loaded once in app/layout.tsx. */
export function PlaygroundRunner({ selector }: { selector: string }) {
  const [copied, setCopied] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [showExplainer, setShowExplainer] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [twoCol, setTwoCol] = useState(true);
  const [fontRem, setFontRem] = useState(1.02);
  const [codeHTML, setCodeHTML] = useState("");
  const [snippetCode, setSnippetCode] = useState("");

  const starterCodeRef = useRef<string>("");
  const starterHTMLRef = useRef<string>("");
  const snippetRef = useRef<HTMLElement | null>(null);

  const FONT_MIN = 0.7;
  const FONT_MAX = 2.4;
  const bumpFont = (d: number) =>
    setFontRem((f) => Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round((f + d) * 100) / 100)));

  const readEl = () => (typeof document !== "undefined" ? document.querySelector(selector) : null);

  // Capture original starter code & html on mount
  useEffect(() => {
    const el = readEl();
    if (el) {
      const codeText = (el.textContent ?? "").replace(/\n+$/, "");
      starterCodeRef.current = codeText;
      starterHTMLRef.current = el.innerHTML;
      setSnippetCode(codeText);
    }
  }, [selector]);

  // Hook into Codapi run and result events
  useEffect(() => {
    const host = snippetRef.current;
    if (!host) return;

    const onRun = () => {
      playClick();
      addXP(10, "Ran code snippet");
    };

    const onResult = (e: Event) => {
      const d = (e as CustomEvent).detail as
        | { ok?: boolean; stdout?: string; stderr?: string }
        | undefined;
      const stdout = (d?.stdout ?? "").toLowerCase();
      const isOk = d?.ok !== false && !d?.stderr;
      const containsSuccess =
        stdout.includes("pass") ||
        stdout.includes("success") ||
        stdout.includes("ok") ||
        stdout.includes("correct") ||
        stdout.includes("hello") ||
        stdout.includes("✓");

      if (isOk && containsSuccess) {
        playSuccess();
      }
    };

    host.addEventListener("run", onRun);
    host.addEventListener("result", onResult as EventListener);

  }, [selector]);

  // Keyboard shortcut: Cmd+Enter or Ctrl+Enter to trigger run
  useEffect(() => {
    const el = readEl();
    if (!el) return;
    const container = el.closest(".ply");
    if (!container) return;

    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (container.contains(document.activeElement) || container.matches(":hover")) {
          e.preventDefault();
          const host = snippetRef.current;
          const btn = (host?.shadowRoot?.querySelector("button") || host?.querySelector("button")) as HTMLButtonElement | null;
          if (btn) {
            btn.click();
          }
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selector]);

  const copy = async () => {
    const text = (readEl()?.textContent ?? "").replace(/\n+$/, "");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — no-op */
    }
  };

  const handleResetToStarter = () => {
    const el = readEl();
    if (el && starterHTMLRef.current) {
      el.innerHTML = starterHTMLRef.current;
      setSnippetCode(starterCodeRef.current);

      // Clean up any stale Codapi output element attached to this container
      const container = el.closest(".ply");
      const out = container?.querySelector(".codapi-output");
      if (out) out.remove();

      playClick();
      setResetDone(true);
      setTimeout(() => setResetDone(false), 1600);
    }
  };

  const expand = () => {
    // Grab the server-highlighted <pre> so the overlay keeps Shiki colors.
    setCodeHTML(readEl()?.outerHTML ?? "");
    setExpanded(true);
  };

  // Esc to close + lock body scroll while the overlay is open.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [expanded]);

  const insights = useMemo(() => analyzeSnippet(snippetCode), [snippetCode]);

  return (
    <div className="ply-run">
      {React.createElement("codapi-snippet", {
        ref: snippetRef,
        sandbox: "go",
        selector,
      })}
      <div className="ply-actions">
        <button
          className={`ply-iconbtn ply-explain-toggle ${showExplainer ? "active" : ""}`}
          onClick={() => {
            playClick();
            setShowExplainer((v) => !v);
          }}
          type="button"
          aria-expanded={showExplainer}
          title="Runtime Execution Trace Explainer"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "middle", marginRight: "5px" }}>
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          {showExplainer ? "Hide Trace" : "Execution Trace"}
        </button>

        <button
          className="ply-iconbtn ply-reset-btn"
          onClick={handleResetToStarter}
          type="button"
          title="Reset code to original starter state"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "middle", marginRight: "4px" }}>
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          {resetDone ? "Reset" : "Reset"}
        </button>

        <button
          className="ply-iconbtn"
          onClick={expand}
          type="button"
          aria-label="Expand code to full screen"
          title="Expand"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "middle", marginRight: "4px" }}>
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
          Expand
        </button>

        <button className="ply-copy" onClick={copy} type="button">
          {copied ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "middle", marginRight: "4px" }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "middle", marginRight: "4px" }}>
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      {/* What Happened? / Step-by-Step Beginner Explainer */}
      {showExplainer && (
        <div className="ply-explainer-panel" role="region" aria-label="Step-by-Step Code Execution Breakdown">
          <div className="ply-explainer-head">
            <div className="ply-explainer-title-group">
              <span className="ply-explainer-gopher">
                <Gopher pose="happy" role="scientist" size={32} title="Explainer Gopher" />
              </span>
              <div>
                <span className="ply-explainer-kicker">Under The Hood</span>
                <h4 className="ply-explainer-title">What Happens When This Runs?</h4>
              </div>
            </div>
            <button
              className="ply-explainer-close"
              onClick={() => setShowExplainer(false)}
              aria-label="Close explainer"
            >
              ✕
            </button>
          </div>

          <p className="ply-explainer-lead">
            Here is the exact step-by-step mechanical lifecycle the Go compiler, runtime, and scheduler execute for this snippet:
          </p>

          <ol className="ply-explainer-steps">
            {insights.map((step, idx) => (
              <li key={idx} className="ply-explainer-step">
                <div className="ply-step-badge">
                  <span className="ply-step-num">{idx + 1}</span>
                  <span className="ply-step-tag">{step.tag}</span>
                </div>
                <div className="ply-step-body">
                  <strong className="ply-step-heading">{step.title.replace(/^\d+\.\s*/, "")}</strong>
                  <p className="ply-step-desc">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {expanded &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="ply-modal-backdrop"
            onClick={() => setExpanded(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Go code, full screen"
          >
            <div
              className="ply-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ply-modal-bar">
                <span className="ply-go">▶ Go Playground</span>
                <button
                  className="ply-modal-toggle"
                  onClick={() => setTwoCol((v) => !v)}
                  type="button"
                  aria-pressed={twoCol}
                >
                  {twoCol ? "1 column" : "2 columns"}
                </button>
                <div className="ply-modal-font" role="group" aria-label="Font size">
                  <button
                    className="ply-modal-fontbtn"
                    onClick={() => bumpFont(-0.12)}
                    disabled={fontRem <= FONT_MIN}
                    type="button"
                    aria-label="Decrease font size"
                    title="Smaller"
                  >
                    A−
                  </button>
                  <button
                    className="ply-modal-fontbtn"
                    onClick={() => bumpFont(0.12)}
                    disabled={fontRem >= FONT_MAX}
                    type="button"
                    aria-label="Increase font size"
                    title="Larger"
                  >
                    A+
                  </button>
                </div>
                <button
                  className="ply-modal-close"
                  onClick={() => setExpanded(false)}
                  type="button"
                  aria-label="Close full screen (Esc)"
                >
                  ✕ Close
                </button>
              </div>
              <div
                className={"ply-modal-code" + (twoCol ? " twocol" : "")}
                style={{ fontSize: `${fontRem}rem` }}
                dangerouslySetInnerHTML={{ __html: codeHTML }}
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
