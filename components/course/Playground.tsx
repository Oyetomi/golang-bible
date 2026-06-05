"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/* Client island for a <GoPlayground>. The code is rendered (and highlighted) by
   the server as a fenced ```go block; this adds:
   - a real Run button + output via Codapi (<codapi-snippet> reads the code from
     the element matched by `selector` and runs it on Codapi's Go sandbox). The
     code is READ-ONLY — no `editor` attribute, so the snippet can't be edited.
   - a Copy button that reads the same element's text, and
   - an Expand button that opens a full-screen overlay of the code, for reading.
   The Codapi script is loaded once in app/layout.tsx. */
export function PlaygroundRunner({ selector }: { selector: string }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [twoCol, setTwoCol] = useState(true);
  const [fontRem, setFontRem] = useState(1.02);
  const [codeHTML, setCodeHTML] = useState("");

  const FONT_MIN = 0.7;
  const FONT_MAX = 2.4;
  const bumpFont = (d: number) =>
    setFontRem((f) => Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round((f + d) * 100) / 100)));

  const readEl = () => document.querySelector(selector);

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

  return (
    <div className="ply-run">
      {React.createElement("codapi-snippet", {
        sandbox: "go",
        selector,
      })}
      <div className="ply-actions">
        <button
          className="ply-iconbtn"
          onClick={expand}
          type="button"
          aria-label="Expand code to full screen"
          title="Expand"
        >
          ⛶ Expand
        </button>
        <button className="ply-copy" onClick={copy} type="button">
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>

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
