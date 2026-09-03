/**
 * Pure client-side Go formatter (gofmt).
 * Formats raw Go code by enforcing canonical indentation (tabs),
 * brace positioning, blank line normalization, and whitespace cleanup.
 */

export interface FormatResult {
  formatted: string;
  changed: boolean;
}

export function formatGo(source: string): FormatResult {
  if (!source || source.trim() === "") {
    return { formatted: source, changed: false };
  }

  const rawLines = source.replace(/\r\n/g, "\n").split("\n");
  const normalizedLines: string[] = [];

  // Pass 1: Handle misplaced opening braces (e.g. `func main()\n{` -> `func main() {`)
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trimEnd();
    const trimmed = line.trim();

    if (trimmed === "{" && normalizedLines.length > 0) {
      const prev = normalizedLines[normalizedLines.length - 1].trimEnd();
      if (!prev.endsWith("{") && !prev.endsWith(";")) {
        normalizedLines[normalizedLines.length - 1] = prev + " {";
        continue;
      }
    }
    normalizedLines.push(line);
  }

  // Pass 2: Calculate indentation and clean blank lines
  const result: string[] = [];
  let indentLevel = 0;
  let prevWasBlank = false;

  for (let i = 0; i < normalizedLines.length; i++) {
    const line = normalizedLines[i];
    const trimmed = line.trim();

    // Handle blank lines
    if (trimmed === "") {
      // Collapse multiple blank lines into at most one
      if (!prevWasBlank && result.length > 0) {
        // Do not add blank line right after opening brace
        const lastAdded = result[result.length - 1].trim();
        if (!lastAdded.endsWith("{") && !lastAdded.endsWith("(")) {
          result.push("");
          prevWasBlank = true;
        }
      }
      continue;
    }
    prevWasBlank = false;

    // Check for dedenting tokens at start of line
    let currentIndent = indentLevel;

    // If line starts with closing tokens `}`, `)`, `]`
    if (/^[\}\)\]]/.test(trimmed)) {
      currentIndent = Math.max(0, indentLevel - 1);
    } else if (/^(case\s+|default:)/.test(trimmed)) {
      // case / default inside switch is indented 1 level less than case body
      currentIndent = Math.max(0, indentLevel - 1);
    }

    // Indent with canonical tabs
    const indented = "\t".repeat(currentIndent) + trimmed;
    result.push(indented);

    // Update indent level for subsequent lines
    // Count net opening vs closing braces/parens/brackets (ignoring strings/comments)
    let depthChange = 0;
    let inString = false;
    let stringChar = "";

    for (let c = 0; c < trimmed.length; c++) {
      const ch = trimmed[c];
      const next = trimmed[c + 1];

      // Handle comments
      if (!inString && ch === "/" && next === "/") {
        break; // rest of line is comment
      }

      // Handle string quotes
      if ((ch === '"' || ch === "'" || ch === "`") && (c === 0 || trimmed[c - 1] !== "\\")) {
        if (!inString) {
          inString = true;
          stringChar = ch;
        } else if (stringChar === ch) {
          inString = false;
        }
        continue;
      }

      if (!inString) {
        if (ch === "{" || ch === "(" || ch === "[") {
          depthChange++;
        } else if (ch === "}" || ch === ")" || ch === "]") {
          depthChange--;
        }
      }
    }

    indentLevel = Math.max(0, indentLevel + depthChange);

    // If this line was case/default, the body underneath will be +1 indent
    if (/^(case\s+|default:)/.test(trimmed) && !trimmed.endsWith("{")) {
      // keep indent level consistent
    }
  }

  // Ensure single trailing newline
  while (result.length > 0 && result[result.length - 1].trim() === "") {
    result.pop();
  }
  const formatted = result.join("\n") + "\n";

  return {
    formatted,
    changed: formatted !== source,
  };
}
