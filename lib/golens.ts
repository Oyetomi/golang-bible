/* GoLens pattern table: how to READ Go syntax, in plain English.

   Each entry recognises one piece of syntax on a single source line (after
   string literals and comments are blanked out, so `"&x"` in a string or
   `// x := 1` never match) and explains it for someone who knows programming
   but not Go. `diagram` asks the UI for a small memory picture.

   Order matters: more specific patterns come first, and a later pattern is
   skipped when an earlier one already explained the same characters. */

export type LensDiagram = "pointer-literal" | "address-of" | "deref" | "send" | "recv";

export type LensHit = {
  id: string;
  title: string; // the syntax, as the reader sees it
  body: string; // plain-English meaning
  diagram?: LensDiagram;
  start: number;
  end: number;
  text: string; // the matched source
  name?: string; // captured type/var name used in the diagram
  basic?: boolean;
};

type Pattern = {
  id: string;
  re: RegExp; // must be global
  title: (m: RegExpExecArray) => string;
  body: (m: RegExpExecArray) => string;
  diagram?: LensDiagram;
  name?: (m: RegExpExecArray) => string;
  basic?: boolean; // everyday syntax: shown as one compact line when others are present
};

const IDENT = "[A-Za-z_][A-Za-z0-9_]*";

/* "an Account", "a Deposit": article by the name's first letter. */
const an = (name: string) => `${/^[AEIOUaeiou]/.test(name.replace(/^\*/, "")) ? "an" : "a"} ${name}`;

export const PATTERNS: Pattern[] = [
  {
    id: "ptr-receiver",
    re: new RegExp(`^\\s*func\\s*\\(\\s*(${IDENT})\\s+\\*(${IDENT})(?:\\[[^\\]]*\\])?\\s*\\)\\s*(${IDENT})`, "g"),
    title: (m) => `func (${m[1]} *${m[2]}) ${m[3]}(…)`,
    body: (m) =>
      `A method on ${an(m[2])}, with a pointer receiver: ${m[1]} is the caller's own ${m[2]}, not a copy. Changes made through ${m[1]} stick.`,
  },
  {
    id: "val-receiver",
    re: new RegExp(`^\\s*func\\s*\\(\\s*(${IDENT})\\s+(${IDENT})(?:\\[[^\\]]*\\])?\\s*\\)\\s*(${IDENT})`, "g"),
    title: (m) => `func (${m[1]} ${m[2]}) ${m[3]}(…)`,
    body: (m) =>
      `A method on ${an(m[2])}, with a value receiver: ${m[1]} is a copy of the caller's ${m[2]}. Changes to ${m[1]} vanish when the method returns.`,
  },
  {
    id: "generic-func",
    re: new RegExp(`^\\s*func\\s+(${IDENT})\\[([^\\]]+)\\]`, "g"),
    title: (m) => `func ${m[1]}[${m[2]}]`,
    body: (m) =>
      `A generic function. [${m[2].trim()}] declares type placeholders, filled in at each call. any allows every type; comparable allows types you can == .`,
  },
  {
    id: "ptr-literal",
    re: new RegExp(`&(${IDENT}(?:\\.${IDENT})?)\\s*\\{`, "g"),
    title: (m) => `&${m[1]}{…}`,
    body: (m) =>
      `Builds ${an(m[1])}, then & hands back its address. The result is a *${m[1]}: a pointer to one shared ${m[1]}, not a copy. Returning it from a function is safe.`,
    diagram: "pointer-literal",
    name: (m) => m[1],
  },
  {
    id: "comma-ok-assert",
    re: new RegExp(`(${IDENT})\\s*,\\s*ok\\s*:?=\\s*(${IDENT}(?:\\.${IDENT})*)\\.\\(([^)]+)\\)`, "g"),
    title: (m) => `${m[1]}, ok := ${m[2]}.(${m[3]})`,
    body: (m) =>
      `Asks: is ${m[2]} holding ${an(m[3])}? If yes, ${m[1]} gets it and ok is true. If not, ok is false. It never panics.`,
  },
  {
    id: "type-switch",
    re: /\.\(type\)/g,
    title: () => `switch v := x.(type)`,
    body: (_m) =>
      `A type switch: runs the case matching the concrete type stored in the interface. Inside each case, v has that type.`,
  },
  {
    id: "assert",
    re: new RegExp(`(${IDENT}(?:\\.${IDENT})*)\\.\\((\\*?${IDENT}(?:\\.${IDENT})?)\\)`, "g"),
    title: (m) => `${m[1]}.(${m[2]})`,
    body: (m) =>
      `Claims ${m[1]} holds ${an(m[2])} and gives it to you as one. If the claim is wrong, the program panics. Use the v, ok := form when unsure.`,
  },
  {
    id: "comma-ok-map",
    re: new RegExp(`(${IDENT})\\s*,\\s*ok\\s*:?=\\s*(${IDENT}(?:\\.${IDENT})*)\\[`, "g"),
    title: (m) => `${m[1]}, ok := ${m[2]}[key]`,
    body: (m) =>
      `Map lookup. ${m[1]} gets the stored value; ok says whether the key existed, so you can tell a missing key from a stored zero.`,
  },
  {
    id: "comma-ok-recv",
    re: new RegExp(`(${IDENT})\\s*,\\s*ok\\s*:?=\\s*<-\\s*(${IDENT})`, "g"),
    title: (m) => `${m[1]}, ok := <-${m[2]}`,
    body: (m) =>
      `Receive from ${m[2]}. ok is false only when the channel is closed and empty.`,
  },
  {
    id: "send",
    re: new RegExp(`(${IDENT}(?:\\.${IDENT})*)\\s*<-\\s*[^\\s-]`, "g"),
    title: (m) => `${m[1]} <- value`,
    body: (m) =>
      `Send into the channel ${m[1]}: the arrow points into it. On an unbuffered channel this line waits until someone receives.`,
    diagram: "send",
    name: (m) => m[1],
  },
  {
    id: "recv",
    re: new RegExp(`<-\\s*(${IDENT}(?:\\.${IDENT})*(?:\\(\\))?)`, "g"),
    title: (m) => `<-${m[1]}`,
    body: (m) =>
      `Receive from the channel ${m[1]}: the arrow points out of it. This waits until a value arrives, or returns the zero value if the channel is closed.`,
    diagram: "recv",
    name: (m) => m[1],
  },
  {
    id: "go-stmt",
    re: /(?:^|[\s;{])go\s+(?:func\b|[A-Za-z_])/g,
    title: () => `go f(…)`,
    body: (_m) =>
      `Starts the call in a new goroutine and moves on immediately, without waiting and without a return value.`,
  },
  {
    id: "defer",
    re: /(?:^|[\s;{])defer\s+/g,
    title: () => `defer f(…)`,
    body: (_m) =>
      `Runs the call when this function returns (even on panic). Its arguments are evaluated now. Several defers run last-in, first-out.`,
  },
  {
    id: "variadic-param",
    re: new RegExp(`(${IDENT})\\s+\\.\\.\\.(\\*?[A-Za-z_][\\w.\\[\\]]*)`, "g"),
    title: (m) => `${m[1]} ...${m[2]}`,
    body: (m) =>
      `Accepts any number of ${m[2]} arguments. Inside the function, ${m[1]} is a []${m[2]}.`,
  },
  {
    id: "spread",
    re: new RegExp(`(${IDENT})\\.\\.\\.\\s*\\)`, "g"),
    title: (m) => `f(${m[1]}...)`,
    body: (m) =>
      `Passes each element of the slice ${m[1]} as a separate argument.`,
  },
  {
    id: "address-of",
    re: new RegExp(`(?:^|[\\s(,=:\\[{])&(${IDENT}(?:\\.${IDENT})*)(?![\\w{])`, "g"),
    title: (m) => `&${m[1]}`,
    body: (m) =>
      `Takes the address of ${m[1]}: a pointer to it. Whoever holds the pointer can change ${m[1]} itself, not a copy.`,
    diagram: "address-of",
    name: (m) => m[1],
  },
  {
    id: "deref",
    re: new RegExp(`(?:^\\s*|[=(,]\\s*|return\\s+)\\*(${IDENT})\\b(?!\\s*[\\[{])`, "g"),
    title: (m) => `*${m[1]}`,
    body: (m) =>
      `Follows the pointer ${m[1]} to the value it points at. *${m[1]} = x writes there; reading gives a copy. Panics if ${m[1]} is nil.`,
    diagram: "deref",
    name: (m) => m[1],
  },
  {
    id: "ptr-type",
    re: new RegExp(`(?:[\\s(,\\]]|^)\\*(${IDENT}(?:\\.${IDENT})?)(?=[\\s),{\\]]|$)`, "g"),
    title: (m) => `*${m[1]}`,
    body: (m) =>
      `A type: pointer to ${an(m[1])}. It holds an address, not ${an(m[1])}. Zero value: nil.`,
  },
  {
    id: "err-check",
    basic: true,
    re: /if\s+(?:[\w]+\s*:?=\s*[^;]+;\s*)?err\s*!=\s*nil/g,
    title: () => `if err != nil`,
    body: (_m) =>
      `Error check: nil means success; anything else is the failure, handled right here.`,
  },
  {
    id: "make",
    basic: true,
    re: /\bmake\(\s*(\[\]|map\[|chan\b)/g,
    title: () => `make(…)`,
    body: (_m) =>
      `Creates a ready-to-use slice, map or channel (the types that need internal setup).`,
  },
  {
    id: "map-literal",
    re: /(?:[=(,:{]|return)\s*map\[[^\]]+\][\w.*[\]]+\s*\{/g,
    title: () => `map[K]V{…}`,
    body: (_m) =>
      `A map (hash table) with the listed key: value pairs. Iteration order is random.`,
  },
  {
    id: "slice-literal",
    re: /(?:[=(,:{]|return)\s*\[\](\*?[\w.]+)\s*\{/g,
    title: (m) => `[]${m[1]}{…}`,
    body: (m) =>
      `A slice of ${m[1]} with the listed elements. Copying a slice shares the elements.`,
  },
  {
    id: "empty-struct",
    re: /struct\{\}/g,
    title: () => `struct{}`,
    body: (_m) =>
      `A type with no fields and zero size: used as a pure signal (chan struct{}) or a set (map[K]struct{}).`,
  },
  {
    id: "range-int",
    re: /for\s+(?:\w+\s*:=\s*)?range\s+\d+|for\s+\w+\s*:=\s*range\s+\w+\s*\{/g,
    title: () => `for … := range …`,
    body: (_m) =>
      `A range loop: over a slice (index, value), a map (key, value), a channel (until closed), or an int n (0..n-1, Go 1.22+).`,
  },
  {
    id: "short-decl",
    basic: true,
    re: new RegExp(`(${IDENT}(?:\\s*,\\s*${IDENT})*)\\s*:=`, "g"),
    title: (m) => `${m[1]} :=`,
    body: (m) =>
      `Creates ${m[1]} and assigns it; the type comes from the right-hand side.`,
  },
  {
    id: "blank",
    basic: true,
    re: /(?:^|[\s(,])_\s*(?:,|=|:=)/g,
    title: () => `_`,
    body: (_m) =>
      `_ discards a value you don't need (Go rejects unused variables).`,
  },
];

/* Blank out string/rune literals and comments, keeping character positions. */
export function mask(line: string): string {
  let out = "";
  let i = 0;
  while (i < line.length) {
    const c = line[i];
    if (c === "/" && line[i + 1] === "/") {
      out += " ".repeat(line.length - i);
      break;
    }
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < line.length && line[j] !== c) {
        if (line[j] === "\\" && c !== "`") j++;
        j++;
      }
      out += c + " ".repeat(Math.max(0, Math.min(j, line.length - 1) - i - 1)) + (j < line.length ? c : "");
      i = j + 1;
      continue;
    }
    out += c;
    i++;
  }
  return out.padEnd(line.length, " ");
}

export function scanLine(line: string): LensHit[] {
  const src = mask(line);
  const hits: LensHit[] = [];
  const taken: [number, number][] = [];
  const overlaps = (s: number, e: number) => taken.some(([a, b]) => s < b && e > a);
  for (const p of PATTERNS) {
    p.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.re.exec(src))) {
      const start = m.index;
      const end = m.index + m[0].length;
      if (m[0].length === 0) {
        p.re.lastIndex++;
        continue;
      }
      if (overlaps(start, end)) continue;
      // Receivers/methods explain the whole signature: skip other hits inside it.
      taken.push([start, end]);
      // Re-read captures from the ORIGINAL line so names keep their case/text.
      const orig = { ...m } as RegExpExecArray;
      hits.push({
        id: p.id,
        title: p.title(orig),
        body: p.body(orig),
        diagram: p.diagram,
        name: p.name?.(orig),
        basic: p.basic,
        start,
        end,
        text: line.slice(start, end),
      });
    }
  }
  return hits.sort((a, b) => a.start - b.start);
}
