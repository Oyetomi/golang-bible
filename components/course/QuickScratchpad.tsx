"use client";

import { useEffect, useRef, useState } from "react";
import { formatGo } from "@/lib/gofmt";

export function QuickScratchpad() {
  const [isOpen, setIsOpen] = useState(false);
  const [gofmtToast, setGofmtToast] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const clearErrors = () => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    wrap.querySelectorAll(".gb-line-error").forEach((el) => el.classList.remove("gb-line-error"));
    wrap.querySelectorAll(".gb-inline-diagnostic").forEach((el) => el.remove());
  };

  const renderErrors = (stderr: string) => {
    clearErrors();
    const wrap = wrapRef.current;
    if (!wrap) return;

    const regex = /(?:(?:\.\/)?[\w\-./\\]+\.go|main|prog):(\d+)(?::(\d+))?:\s*(.+)/g;
    let match: RegExpExecArray | null;
    const codeEl = wrap.querySelector("code");
    if (!codeEl) return;

    // For plain textarea/pre without data-line, we can show a diagnostic banner at top/bottom of code
    const diag = document.createElement("div");
    diag.className = "gb-inline-diagnostic";
    diag.style.margin = "8px 0";

    const errorList: string[] = [];
    while ((match = regex.exec(stderr)) !== null) {
      errorList.push(`L${match[1]}:${match[2] || "1"}: ${match[3]}`);
    }

    if (errorList.length > 0) {
      diag.innerHTML = `
        <span class="gb-diag-icon">✕</span>
        <span class="gb-diag-loc">Compiler Error</span>
        <span class="gb-diag-msg">${errorList.join(" | ").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</span>
      `;
      codeEl.insertAdjacentElement("beforebegin", diag);
    }
  };

  const handleGofmt = () => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const codeEl = wrap.querySelector("code");
    if (!codeEl) return;

    const currentText = codeEl.textContent ?? "";
    const { formatted, changed } = formatGo(currentText);
    if (changed) {
      codeEl.textContent = formatted;
      clearErrors();
    }
    setGofmtToast(true);
    setTimeout(() => setGofmtToast(false), 1400);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If Scratchpad is open, handle Cmd+S for gofmt
      if (isOpen && (e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        handleGofmt();
        return;
      }

      // Don't trigger open if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "s" || e.key === "S") {
        if (!e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          setIsOpen((prev) => !prev);
        }
      }

      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    const handleCustomOpen = () => setIsOpen(true);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("gb:open-scratchpad", handleCustomOpen);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("gb:open-scratchpad", handleCustomOpen);
    };
  }, [isOpen]);

  // Hook into Codapi result for compiler diagnostics
  useEffect(() => {
    if (!isOpen) return;
    const wrap = wrapRef.current;
    if (!wrap) return;

    const onResult = (e: Event) => {
      const d = (e as CustomEvent).detail as { ok?: boolean; stderr?: string } | undefined;
      if (d && d.ok === false && d.stderr) {
        renderErrors(d.stderr);
      } else {
        clearErrors();
      }
    };

    wrap.addEventListener("result", onResult as EventListener);
    wrap.addEventListener("run", clearErrors);

    return () => {
      wrap.removeEventListener("result", onResult as EventListener);
      wrap.removeEventListener("run", clearErrors);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="scratchpad-overlay" onClick={() => setIsOpen(false)}>
      <div
        className="scratchpad-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Interactive Quick Scratchpad"
      >
        <div className="scratchpad-header">
          <div className="scratchpad-title">
            <span className="scratchpad-badge">SANDBOX</span>
            <span>Quick Go Scratchpad</span>
            <span className="scratchpad-hint">Press [S] or [Esc] to dismiss</span>
          </div>
          <button
            className="scratchpad-close"
            onClick={() => setIsOpen(false)}
            aria-label="Close Scratchpad"
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="scratchpad-body">
          <p className="scratchpad-desc">
            Got an idea while reading? Test any Go code snippet right here without losing your place.
          </p>

          <div className="codapi-wrap gb-ide-window" ref={wrapRef} style={{ position: "relative" }}>
            {gofmtToast && (
              <div className="gb-gofmt-toast">
                ⚡ gofmt applied
              </div>
            )}
            <div className="gb-ide-bar">
              <div className="gb-ide-left">
                <span className="gb-ide-dots">
                  <i className="gb-dot-r"></i>
                  <i className="gb-dot-y"></i>
                  <i className="gb-dot-g"></i>
                </span>
                <div className="gb-ide-tab">
                  <span className="gb-ide-folder">📁 scratchpad / </span>
                  <span className="gb-ide-file">📄 main.go</span>
                </div>
              </div>
              <div className="gb-ide-right">
                <button
                  type="button"
                  onClick={handleGofmt}
                  className="gb-ide-copy"
                  title="Format with gofmt (⌘S / Ctrl+S)"
                  style={{ marginRight: "4px" }}
                >
                  ⚡ Format
                </button>
                <span className="ply-kbd-hint">⌘Enter to run</span>
                <span className="gb-ide-lang">GO 1.26</span>
              </div>
            </div>
            <pre className="codapi-pre">
              <code className="language-go">
{`package main

import (
	"fmt"
	"time"
)

func main() {
	fmt.Println("🚀 Testing Go at", time.Now().Format("15:04:05"))
	
	// Quick slice & goroutine experiment
	ch := make(chan string, 1)
	go func() {
		ch <- "concurrency in action"
	}()

	fmt.Println("Received:", <-ch)
}`}
              </code>
            </pre>
            {/* Codapi widget auto-hooks into pre > code */}
          </div>
        </div>
      </div>
    </div>
  );
}
