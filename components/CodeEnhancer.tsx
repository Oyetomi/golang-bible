"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/* Progressive enhancement for prose code blocks:
   1. Detects file path comments at the top (e.g. `// cmd/server/main.go`, `// types.go`, `# script.sh`).
   2. Automatically lifts them into a sleek IDE Window Header Bar with macOS dots,
      folder breadcrumbs (📁 dir/ 📄 file.go), language badge, and 1-click Copy button.
   3. Hides the redundant first comment line so code starts on line 1 cleanly.
   4. For tall snippets (>= THRESHOLD lines), adds 2-column side-by-side view toggle. */
const THRESHOLD = 30;

export function CodeEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    const pres = Array.from(
      document.querySelectorAll<HTMLElement>(".prose pre")
    );

    for (const pre of pres) {
      if (pre.dataset.enhanced) continue;

      // Skip elements that already render their own window chrome
      if (
        pre.closest(".ply") ||
        pre.closest(".cw") ||
        pre.closest(".codapi-pre") ||
        pre.closest(".pl-code") ||
        pre.closest(".proj-code") ||
        pre.closest(".lab") ||
        pre.closest(".lab-starter") ||
        pre.closest(".hacklab")
      ) {
        pre.dataset.enhanced = "1";
        continue;
      }

      // Check if figure already has a figcaption
      const figure = pre.closest("figure");
      const existingFigcaption = figure?.querySelector("figcaption");

      // Inspect line 1 for a file comment: `// path/to/file.go`, `# file.sh`, `-- file.sql`
      const firstLineSpan = pre.querySelector("code > [data-line]");
      const firstLineText = (firstLineSpan?.textContent ?? "").trim();
      const match = firstLineText.match(
        /^(?:\/\/|#|--)\s*([\w\-./\\]+\.[a-zA-Z0-9]+)\s*$/
      );

      let folderPart = "";
      let filePart = "";

      if (match) {
        const fullPath = match[1];
        if (firstLineSpan) {
          (firstLineSpan as HTMLElement).style.display = "none";
        }
        const lastSlash = fullPath.lastIndexOf("/");
        if (lastSlash !== -1) {
          folderPart = fullPath.slice(0, lastSlash + 1);
          filePart = fullPath.slice(lastSlash + 1);
        } else {
          filePart = fullPath;
        }
      } else if (existingFigcaption && existingFigcaption.textContent?.trim()) {
        const titleText = existingFigcaption.textContent.trim();
        const lastSlash = titleText.lastIndexOf("/");
        if (lastSlash !== -1) {
          folderPart = titleText.slice(0, lastSlash + 1);
          filePart = titleText.slice(lastSlash + 1);
        } else {
          filePart = titleText;
        }
        existingFigcaption.style.display = "none";
      } else {
        const lang = (pre.getAttribute("data-language") || "go").toLowerCase();
        const fallbackFiles: Record<string, string> = {
          go: "main.go",
          bash: "terminal.sh",
          sh: "terminal.sh",
          zsh: "terminal.sh",
          sql: "query.sql",
          json: "data.json",
          yaml: "config.yaml",
          yml: "config.yaml",
          docker: "Dockerfile",
          dockerfile: "Dockerfile",
          proto: "service.proto",
        };
        filePart = fallbackFiles[lang] || `snippet.${lang}`;
      }

      const langAttr = (pre.getAttribute("data-language") || "go").toUpperCase();

      // Construct IDE Window Bar
      const ideBar = document.createElement("div");
      ideBar.className = "gb-ide-bar";
      ideBar.innerHTML = `
        <div class="gb-ide-left">
          <span class="gb-ide-dots">
            <i class="gb-dot-r"></i>
            <i class="gb-dot-y"></i>
            <i class="gb-dot-g"></i>
          </span>
          <div class="gb-ide-tab">
            ${folderPart ? `<span class="gb-ide-folder">📁 ${folderPart}</span>` : ""}
            <span class="gb-ide-file">📄 ${filePart}</span>
          </div>
        </div>
        <div class="gb-ide-right">
          <span class="gb-ide-lang">${langAttr}</span>
          <button class="gb-ide-copy" type="button" aria-label="Copy code">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span class="gb-copy-label">Copy</span>
          </button>
        </div>
      `;

      // Copy logic
      const copyBtn = ideBar.querySelector(".gb-ide-copy") as HTMLButtonElement | null;
      if (copyBtn) {
        copyBtn.addEventListener("click", async () => {
          const lines = Array.from(pre.querySelectorAll("code [data-line]"))
            .filter((l) => (l as HTMLElement).style.display !== "none")
            .map((l) => l.textContent ?? "")
            .join("\n");
          const codeToCopy = lines.length > 0 ? lines : pre.textContent ?? "";
          try {
            await navigator.clipboard.writeText(codeToCopy.replace(/\n+$/, ""));
            copyBtn.classList.add("copied");
            const label = copyBtn.querySelector(".gb-copy-label");
            if (label) label.textContent = "Copied ✓";
            setTimeout(() => {
              copyBtn.classList.remove("copied");
              if (label) label.textContent = "Copy";
            }, 1600);
          } catch {
            /* clipboard blocked */
          }
        });
      }

      // Column toggle for tall snippets
      const linesCount = pre.querySelectorAll("code [data-line]").length;
      if (linesCount >= THRESHOLD) {
        pre.classList.add("gb-tall");
        if (window.innerWidth >= 1100) pre.classList.add("gb-2col");

        const colBtn = document.createElement("button");
        colBtn.type = "button";
        colBtn.className = "gb-coltoggle";
        const syncCol = () => {
          colBtn.textContent = pre.classList.contains("gb-2col") ? "1 col" : "2 col";
        };
        syncCol();
        colBtn.addEventListener("click", () => {
          pre.classList.toggle("gb-2col");
          syncCol();
        });
        ideBar.querySelector(".gb-ide-right")?.prepend(colBtn);
      }

      pre.insertAdjacentElement("beforebegin", ideBar);
      pre.dataset.enhanced = "1";
    }
  }, [pathname]);

  return null;
}

