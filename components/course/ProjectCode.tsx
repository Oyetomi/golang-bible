"use client";

import React, { useState } from "react";

export interface ProjectFile {
  name: string;
  code: string;
  lang?: string;
}

export function ProjectCode({
  title,
  files,
}: {
  title?: string;
  files: ProjectFile[];
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [copied, setCopied] = useState(false);

  if (!files || files.length === 0) return null;

  const current = files[activeIdx] || files[0];
  const lastSlash = current.name.lastIndexOf("/");
  const folderPart = lastSlash !== -1 ? current.name.slice(0, lastSlash + 1) : "";
  const filePart = lastSlash !== -1 ? current.name.slice(lastSlash + 1) : current.name;
  const lang = (current.lang || "go").toUpperCase();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(current.code.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked
    }
  };

  return (
    <div className="proj-code gb-ide-window">
      <div className="proj-code-bar">
        <div className="gb-ide-left">
          <span className="gb-ide-dots">
            <i className="gb-dot-r" />
            <i className="gb-dot-y" />
            <i className="gb-dot-g" />
          </span>
          <div className="proj-code-tabs" role="tablist">
            {files.map((f, idx) => {
              const slash = f.name.lastIndexOf("/");
              const shortName = slash !== -1 ? f.name.slice(slash + 1) : f.name;
              const isActive = idx === activeIdx;
              return (
                <button
                  key={f.name}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`proj-code-tab ${isActive ? "active" : ""}`}
                  onClick={() => setActiveIdx(idx)}
                >
                  <span style={{ opacity: 0.6 }}>{slash !== -1 ? "📁 " : "📄 "}</span>
                  <span>{shortName}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="gb-ide-right" style={{ paddingBottom: "6px" }}>
          {title && <span className="gb-ide-folder" style={{ marginRight: "6px" }}>{title}</span>}
          <span className="gb-ide-lang">{lang}</span>
          <button
            className={`gb-ide-copy ${copied ? "copied" : ""}`}
            onClick={handleCopy}
            type="button"
            aria-label="Copy active file code"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <span>{copied ? "Copied ✓" : "Copy"}</span>
          </button>
        </div>
      </div>

      <div className="proj-code-body">
        <pre
          className="prose-pre-raw"
          style={{
            margin: 0,
            padding: "16px 20px",
            fontFamily: "var(--font-mono)",
            fontSize: "0.84rem",
            lineHeight: 1.62,
            overflowX: "auto",
            background: "var(--bg-card, #090a0f)",
          }}
        >
          <code>{current.code.trim()}</code>
        </pre>
      </div>
    </div>
  );
}
