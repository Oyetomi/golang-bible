/**
 * Fast, pure TypeScript client-side Go syntax highlighter.
 * Tokenizes raw Go code into colored spans matching One Dark Pro.
 */

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const KEYWORDS = new Set([
  "break", "case", "chan", "const", "continue", "default", "defer", "else",
  "fallthrough", "for", "func", "go", "goto", "if", "import", "interface",
  "map", "package", "range", "return", "select", "struct", "switch", "type", "var"
]);

const CONSTANTS = new Set(["true", "false", "nil", "iota"]);

const TYPES = new Set([
  "any", "bool", "byte", "comparable", "complex64", "complex128", "error",
  "float32", "float64", "int", "int8", "int16", "int32", "int64", "rune",
  "string", "uint", "uint8", "uint16", "uint32", "uint64", "uintptr"
]);

const BUILTINS = new Set([
  "append", "cap", "clear", "close", "complex", "copy", "delete", "imag",
  "len", "make", "max", "min", "new", "panic", "print", "println", "real", "recover"
]);

export function highlightGo(code: string): string {
  if (!code) return "";

  const tokenRegex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(`[\s\S]*?`|"(?:\\.|[^"\\])*"|\x27(?:\\.|[^\x27\\])*\x27)|(\b0x[0-9a-fA-F_]+\b|\b\d[\d_]*(?:\.[\d_]+)?(?:[eE][+-]?\d+)?\b)|(\b[a-zA-Z_]\w*\b)|(:=|<--?|\+\+|--|&&|\|\||==|!=|<=|>=|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|<<=|>>=|[+\-*\/%&|^<>=!])/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let out = "";

  while ((match = tokenRegex.exec(code)) !== null) {
    const textBefore = code.slice(lastIndex, match.index);
    if (textBefore) out += escapeHtml(textBefore);
    lastIndex = tokenRegex.lastIndex;

    const [, comment, str, num, ident, op] = match;

    if (comment) {
      out += `<span class="tok-com">${escapeHtml(comment)}</span>`;
    } else if (str) {
      out += `<span class="tok-str">${escapeHtml(str)}</span>`;
    } else if (num) {
      out += `<span class="tok-num">${escapeHtml(num)}</span>`;
    } else if (ident) {
      if (KEYWORDS.has(ident)) {
        out += `<span class="tok-kw">${ident}</span>`;
      } else if (CONSTANTS.has(ident)) {
        out += `<span class="tok-const">${ident}</span>`;
      } else if (TYPES.has(ident)) {
        out += `<span class="tok-type">${ident}</span>`;
      } else if (BUILTINS.has(ident)) {
        out += `<span class="tok-builtin">${ident}</span>`;
      } else if (/^\s*\(/.test(code.slice(tokenRegex.lastIndex, tokenRegex.lastIndex + 5))) {
        out += `<span class="tok-fn">${escapeHtml(ident)}</span>`;
      } else {
        out += escapeHtml(ident);
      }
    } else if (op) {
      out += `<span class="tok-op">${escapeHtml(op)}</span>`;
    }
  }

  const remaining = code.slice(lastIndex);
  if (remaining) out += escapeHtml(remaining);
  return out;
}
