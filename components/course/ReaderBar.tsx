"use client";

import { useEffect, useState } from "react";

export function ReaderBar({
  wordCount = 1800,
  animCount = 2,
}: {
  wordCount?: number;
  animCount?: number;
}) {
  const [mode, setMode] = useState<"deep" | "speed">("deep");
  const [fontSize, setFontSize] = useState<number>(15);
  const [isZen, setIsZen] = useState(false);

  // Speed mode estimate: ~3 min per visual + code. Deep dive: ~200 wpm
  const deepMinutes = Math.max(3, Math.round(wordCount / 180));
  const speedMinutes = Math.max(2, animCount * 1.5);

  useEffect(() => {
    // Load saved preferences
    const savedMode = localStorage.getItem("gb-mode") as "deep" | "speed" | null;
    if (savedMode) {
      setMode(savedMode);
      document.documentElement.setAttribute("data-reading-mode", savedMode);
    }

    const savedFont = localStorage.getItem("gb-font-size");
    if (savedFont) {
      const sz = Number(savedFont);
      setFontSize(sz);
      document.documentElement.style.setProperty("--reader-font-size", `${sz}px`);
    }

    // Keyboard shortcuts: Z for Zen, S for Scratchpad
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "z" || e.key === "Z") {
        if (!e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          toggleZen();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const setReadingMode = (next: "deep" | "speed") => {
    setMode(next);
    localStorage.setItem("gb-mode", next);
    document.documentElement.setAttribute("data-reading-mode", next);
  };

  const toggleZen = () => {
    setIsZen((prev) => {
      const next = !prev;
      document.documentElement.setAttribute("data-zen", next ? "true" : "false");
      return next;
    });
  };

  const changeFontSize = (delta: number) => {
    setFontSize((prev) => {
      const next = Math.min(20, Math.max(13.5, prev + delta));
      localStorage.setItem("gb-font-size", String(next));
      document.documentElement.style.setProperty("--reader-font-size", `${next}px`);
      return next;
    });
  };

  const openScratchpad = () => {
    window.dispatchEvent(new CustomEvent("gb:open-scratchpad"));
  };

  return (
    <div className="reader-toolbar">
      <div className="reader-toolbar-left">
        {/* Estimated Reading Times */}
        <div className="reader-time-pill" title="Estimated reading time">
          <span className="reader-time-icon">⚡</span>
          <span className="reader-time-speed">{Math.round(speedMinutes)}m speed</span>
          <span className="reader-time-divider">·</span>
          <span className="reader-time-deep">{deepMinutes}m deep dive</span>
        </div>

        {/* Mode Selector */}
        <div className="reader-mode-switch" role="radiogroup" aria-label="Reading mode">
          <button
            type="button"
            className={`reader-mode-btn ${mode === "deep" ? "active" : ""}`}
            onClick={() => setReadingMode("deep")}
            title="Read full in-depth chapter prose"
          >
            Deep Dive
          </button>
          <button
            type="button"
            className={`reader-mode-btn ${mode === "speed" ? "active" : ""}`}
            onClick={() => setReadingMode("speed")}
            title="Focus on visuals, code execution, and key checks (quickest path)"
          >
            ⚡ Speed Mode
          </button>
        </div>
      </div>

      <div className="reader-toolbar-right">
        {/* Font Size Adjusters */}
        <div className="reader-font-controls">
          <button
            type="button"
            className="reader-btn"
            onClick={() => changeFontSize(-1)}
            title="Decrease font size"
            aria-label="Decrease font size"
          >
            A-
          </button>
          <span className="reader-font-indicator">{fontSize}px</span>
          <button
            type="button"
            className="reader-btn"
            onClick={() => changeFontSize(1)}
            title="Increase font size"
            aria-label="Increase font size"
          >
            A+
          </button>
        </div>

        {/* Zen Focus Mode Button */}
        <button
          type="button"
          className={`reader-btn reader-zen-btn ${isZen ? "active" : ""}`}
          onClick={toggleZen}
          title="Toggle Zen Focus Mode [Z] (Distraction-free reading)"
        >
          <span>{isZen ? "Exit Zen" : "Zen [Z]"}</span>
        </button>

        {/* Quick Scratchpad Button */}
        <button
          type="button"
          className="reader-btn reader-scratch-btn"
          onClick={openScratchpad}
          title="Open interactive Go scratchpad [S]"
        >
          <span>Sandbox [S]</span>
        </button>
      </div>
    </div>
  );
}
