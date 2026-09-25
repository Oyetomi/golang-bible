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
};

type Pattern = {
  id: string;
  re: RegExp; // must be global
  title: (m: RegExpExecArray) => string;
  body: (m: RegExpExecArray) => string;
  diagram?: LensDiagram;
  name?: (m: RegExpExecArray) => string;
};

const IDENT = "[A-Za-z_][A-Za-z0-9_]*";

export const PATTERNS: Pattern[] = [
  {
    id: "ptr-receiver",
    re: new RegExp(`^\\s*func\\s*\\(\\s*(${IDENT})\\s+\\*(${IDENT})(?:\\[[^\\]]*\\])?\\s*\\)\\s*(${IDENT})`, "g"),
    title: (m) => `func (${m[1]} *${m[2]}) ${m[3]}(…)`,
    body: (m) =>
      `A method named ${m[3]} on the type ${m[2]}, with a POINTER receiver. Inside the method, ${m[1]} holds the address of the caller's ${m[2]}, not a copy, so changes made through ${m[1]} (like ${m[1]}.Field = …) change the caller's value. Use a pointer receiver when the method must modify the value, or when the value is large.`,
  },
  {
    id: "val-receiver",
    re: new RegExp(`^\\s*func\\s*\\(\\s*(${IDENT})\\s+(${IDENT})(?:\\[[^\\]]*\\])?\\s*\\)\\s*(${IDENT})`, "g"),
    title: (m) => `func (${m[1]} ${m[2]}) ${m[3]}(…)`,
    body: (m) =>
      `A method named ${m[3]} on the type ${m[2]}, with a VALUE receiver. Go copies the ${m[2]} when the method is called, so ${m[1]} is a private copy. Reading is fine, but changes to ${m[1]} vanish when the method returns.`,
  },
  {
    id: "generic-func",
    re: new RegExp(`^\\s*func\\s+(${IDENT})\\[([^\\]]+)\\]`, "g"),
    title: (m) => `func ${m[1]}[${m[2]}]`,
    body: (m) =>
      `A generic function. The part in square brackets declares TYPE parameters: placeholders for types, filled in at each call. "${m[2].trim()}" lists each placeholder and its constraint (which types are allowed). any means every type is allowed; comparable means types you can compare with ==.`,
  },
  {
    id: "ptr-literal",
    re: new RegExp(`&(${IDENT}(?:\\.${IDENT})?)\\s*\\{`, "g"),
    title: (m) => `&${m[1]}{…}`,
    body: (m) =>
      `Two things in one expression. ${m[1]}{…} builds a new ${m[1]} value, filling in the fields listed. Then & takes its ADDRESS: where that value lives in memory. So the result isn't a ${m[1]}, it's a *${m[1]}: a pointer. Whoever holds the pointer can reach and modify the one shared value. And Go keeps the value alive (on the heap) as long as any pointer to it exists, so returning &${m[1]}{…} from a function is safe.`,
    diagram: "pointer-literal",
    name: (m) => m[1],
  },
  {
    id: "comma-ok-assert",
    re: new RegExp(`(${IDENT})\\s*,\\s*ok\\s*:?=\\s*(${IDENT}(?:\\.${IDENT})*)\\.\\(([^)]+)\\)`, "g"),
    title: (m) => `${m[1]}, ok := ${m[2]}.(${m[3]})`,
    body: (m) =>
      `A safe type assertion. It asks whether the interface value ${m[2]} is really holding a ${m[3]}. If so, ${m[1]} gets that ${m[3]} and ok is true. If not, ${m[1]} is the zero value and ok is false. It never panics.`,
  },
  {
    id: "type-switch",
    re: /\.\(type\)/g,
    title: () => `switch v := x.(type)`,
    body: () =>
      `A type switch. It checks which concrete type is stored inside an interface value and runs the matching case. Inside each case, v already has that concrete type.`,
  },
  {
    id: "assert",
    re: new RegExp(`(${IDENT}(?:\\.${IDENT})*)\\.\\((\\*?${IDENT}(?:\\.${IDENT})?)\\)`, "g"),
    title: (m) => `${m[1]}.(${m[2]})`,
    body: (m) =>
      `A type assertion: "I claim the interface value ${m[1]} is holding a ${m[2]}; give it to me as one." If the claim is wrong, the program PANICS. Use the two-value form (v, ok := ${m[1]}.(${m[2]})) when you're not sure.`,
  },
  {
    id: "comma-ok-map",
    re: new RegExp(`(${IDENT})\\s*,\\s*ok\\s*:?=\\s*(${IDENT}(?:\\.${IDENT})*)\\[`, "g"),
    title: (m) => `${m[1]}, ok := ${m[2]}[key]`,
    body: (m) =>
      `The "comma ok" map lookup. ${m[1]} gets the value stored under the key, and ok says whether the key was actually present. Without ok you can't tell "missing" from "stored a zero value".`,
  },
  {
    id: "comma-ok-recv",
    re: new RegExp(`(${IDENT})\\s*,\\s*ok\\s*:?=\\s*<-\\s*(${IDENT})`, "g"),
    title: (m) => `${m[1]}, ok := <-${m[2]}`,
    body: (m) =>
      `Receive from channel ${m[2]}, and also learn whether it's closed. ok is false only when ${m[2]} is closed AND empty, in which case ${m[1]} is the zero value.`,
  },
  {
    id: "send",
    re: new RegExp(`(${IDENT}(?:\\.${IDENT})*)\\s*<-\\s*[^\\s-]`, "g"),
    title: (m) => `${m[1]} <- value`,
    body: (m) =>
      `SEND a value into the channel ${m[1]}. The arrow points INTO the channel. On an unbuffered channel this line waits (the goroutine parks) until another goroutine receives.`,
    diagram: "send",
    name: (m) => m[1],
  },
  {
    id: "recv",
    re: new RegExp(`<-\\s*(${IDENT}(?:\\.${IDENT})*(?:\\(\\))?)`, "g"),
    title: (m) => `<-${m[1]}`,
    body: (m) =>
      `RECEIVE a value from the channel ${m[1]}. The arrow points OUT of the channel. This waits (the goroutine parks) until a value is available, or returns immediately with the zero value if the channel is closed.`,
    diagram: "recv",
    name: (m) => m[1],
  },
  {
    id: "go-stmt",
    re: /(?:^|[\s;{])go\s+(?:func\b|[A-Za-z_])/g,
    title: () => `go f(…)`,
    body: () =>
      `Start f running in a NEW goroutine, alongside the current code, and continue immediately without waiting. You don't get f's return value back. Use a channel or a WaitGroup if you need its result, or need to wait for it.`,
  },
  {
    id: "defer",
    re: /(?:^|[\s;{])defer\s+/g,
    title: () => `defer f(…)`,
    body: () =>
      `Schedule f to run when the surrounding FUNCTION returns (not the block), however it returns, even on a panic. f's arguments are evaluated right now, on this line. Multiple defers run in reverse order: last in, first out.`,
  },
  {
    id: "variadic-param",
    re: new RegExp(`(${IDENT})\\s+\\.\\.\\.(\\*?[A-Za-z_][\\w.\\[\\]]*)`, "g"),
    title: (m) => `${m[1]} ...${m[2]}`,
    body: (m) =>
      `A variadic parameter: the function accepts any number of ${m[2]} arguments (including zero). Inside the function, ${m[1]} is a []${m[2]} slice.`,
  },
  {
    id: "spread",
    re: new RegExp(`(${IDENT})\\.\\.\\.\\s*\\)`, "g"),
    title: (m) => `f(${m[1]}...)`,
    body: (m) => `Spread the slice ${m[1]} into separate arguments, for a variadic function.`,
  },
  {
    id: "address-of",
    re: new RegExp(`(?:^|[\\s(,=:\\[{])&(${IDENT}(?:\\.${IDENT})*)(?![\\w{])`, "g"),
    title: (m) => `&${m[1]}`,
    body: (m) =>
      `Take the ADDRESS of ${m[1]}: a pointer that says where ${m[1]} lives in memory. Anyone holding that pointer can read and change ${m[1]} itself, not a copy. This is how functions and methods modify the caller's variables.`,
    diagram: "address-of",
    name: (m) => m[1],
  },
  {
    id: "deref",
    re: new RegExp(`(?:^\\s*|[=(,]\\s*|return\\s+)\\*(${IDENT})\\b(?!\\s*[\\[{])`, "g"),
    title: (m) => `*${m[1]}`,
    body: (m) =>
      `Follow the pointer ${m[1]} to the value it points at ("dereference"). *${m[1]} = x writes to the pointed-at value, and y := *${m[1]} reads a copy of it. If ${m[1]} is nil, this panics.`,
    diagram: "deref",
    name: (m) => m[1],
  },
  {
    id: "ptr-type",
    re: new RegExp(`(?:[\\s(,\\]]|^)\\*(${IDENT}(?:\\.${IDENT})?)(?=[\\s),{\\]]|$)`, "g"),
    title: (m) => `*${m[1]}`,
    body: (m) =>
      `In a TYPE (a parameter, field, return value or var), *${m[1]} means "pointer to a ${m[1]}". A *${m[1]} doesn't hold a ${m[1]}. It holds the ADDRESS of one. Its zero value is nil, meaning it points nowhere.`,
  },
  {
    id: "err-check",
    re: /if\s+(?:[\w]+\s*:?=\s*[^;]+;\s*)?err\s*!=\s*nil/g,
    title: () => `if err != nil`,
    body: () =>
      `Go's error check. Functions that can fail return an error as their last result. nil means "no error". Anything else means it failed, and the code handles it right here instead of throwing an exception.`,
  },
  {
    id: "make",
    re: /\bmake\(\s*(\[\]|map\[|chan\b)/g,
    title: () => `make(…)`,
    body: () =>
      `make creates and initializes a slice, map or channel: the three built-in types that need internal setup (a backing array, a hash table, a channel queue). make([]T, n) gives n zero-valued elements, make(map[K]V) gives an empty, ready-to-use map, and make(chan T, n) gives a channel with a buffer of n.`,
  },
  {
    id: "map-literal",
    re: /(?:[=(,:{]|return)\s*map\[[^\]]+\][\w.*[\]]+\s*\{/g,
    title: () => `map[K]V{…}`,
    body: () =>
      `A map literal: a hash table from keys of type K to values of type V, filled with the key: value pairs listed. Lookups by key are fast, and iteration order is deliberately random.`,
  },
  {
    id: "slice-literal",
    re: /(?:[=(,:{]|return)\s*\[\](\*?[\w.]+)\s*\{/g,
    title: (m) => `[]${m[1]}{…}`,
    body: (m) =>
      `A slice literal: a growable list of ${m[1]} values, created with the elements listed. Under the hood a slice is a small header (pointer to an array, length, capacity), so copying a slice shares the same elements.`,
  },
  {
    id: "empty-struct",
    re: /struct\{\}/g,
    title: () => `struct{}`,
    body: () =>
      `The empty struct: a type with no fields that takes ZERO bytes. It's used when only presence matters: chan struct{} is a pure signal ("done!"), and map[K]struct{} is a set.`,
  },
  {
    id: "range-int",
    re: /for\s+(?:\w+\s*:=\s*)?range\s+\d+|for\s+\w+\s*:=\s*range\s+\w+\s*\{/g,
    title: () => `for … := range …`,
    body: () =>
      `A range loop. Over a slice or array it gives index (and value). Over a map, key and value. Over a channel, each received value until it's closed. Over an integer n (Go 1.22+), 0 to n-1. Since Go 1.22, each iteration gets fresh loop variables.`,
  },
  {
    id: "short-decl",
    re: new RegExp(`(${IDENT}(?:\\s*,\\s*${IDENT})*)\\s*:=`, "g"),
    title: (m) => `${m[1]} :=`,
    body: (m) =>
      `Short variable declaration: CREATE new variable(s) ${m[1]} and assign them in one step. Go works out the type from the right-hand side. It's different from = (which only assigns to variables that already exist), and it only works inside functions.`,
  },
  {
    id: "blank",
    re: /(?:^|[\s(,])_\s*(?:,|=|:=)/g,
    title: () => `_`,
    body: () =>
      `The blank identifier: "I know this produces a value; I'm deliberately ignoring it." Go refuses to compile unused variables, so _ is how you discard one explicitly.`,
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
        start,
        end,
        text: line.slice(start, end),
      });
    }
  }
  return hits.sort((a, b) => a.start - b.start);
}
