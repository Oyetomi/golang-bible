import { getSingletonHighlighter } from "shiki";

/* One shared highlighter for all <GoPlayground> blocks (matches the
   one-dark-pro theme rehype-pretty-code uses for fenced code, so playground
   code looks identical to the rest of the page). Singleton = no re-init cost
   per snippet at build time. */
export async function highlightGo(code: string): Promise<string> {
  const hl = await getSingletonHighlighter({
    themes: ["one-dark-pro"],
    langs: ["go"],
  });
  return hl.codeToHtml(code.replace(/^\n+|\n+$/g, ""), {
    lang: "go",
    theme: "one-dark-pro",
  });
}

export function snippetId(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return "ply-" + h.toString(36);
}
