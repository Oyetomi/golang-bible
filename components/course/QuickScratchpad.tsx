"use client";

import { useEffect, useState } from "react";

export function QuickScratchpad() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea/editor
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

          <div className="codapi-wrap">
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
