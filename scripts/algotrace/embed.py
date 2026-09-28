#!/usr/bin/env python3
"""Insert generated <AlgoTrace> blocks into appendix chapters. Idempotent:
blocks are fenced by {/* trace:NAME */} markers and replaced on rerun."""
import json, re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2] / "content" / "appendix"
OUT = pathlib.Path(__file__).resolve().parent / "out"

# name -> (chapter file prefix, heading, mode, intro)
# mode "before-code": before the first ```go / <GoPlayground> after the heading
# mode "after-first-timeline": after the first <ExecTimeline .../> after the heading
PLAN = [
    ("twosum", "03", "## Two-Sum Family", "before-code",
     "Watch the map fill while one pass walks the array. Every frame shows all the state the code is carrying."),
    ("nextgreater", "04", "### Classic: Next Greater Element", "before-code",
     "Watch the stack of waiting numbers. A number is popped the instant something bigger arrives."),
    ("heappush", "06", "### Step 3", "after-first-timeline",
     "The same heap drawn twice, as the tree you reason about and the array Go stores. Watch a value climb."),
    ("heappop", "06", "### Step 3", "after-first-timeline",
     "And the reverse trip: the last leaf is moved to the root and sinks past its smaller child."),
    ("bfs", "07", "### BFS", "before-code",
     "The queue is the frontier. This trace uses a string-keyed adjacency map so the node names stay readable; the idea is identical to the integer version below. Step through and watch which node leaves the queue and which neighbours join it."),
    ("editdistance", "10", "### Edit distance", "before-code",
     "Each cell reads exactly three neighbours (highlighted). Step through the table and watch it fill."),
    ("merge", "11", "### Classic: Merge Intervals", "before-code",
     "Sorted meetings on a number line, swept left to right. Green bars are the merged output."),
    ("popcount", "11", "### Count set bits", "before-code",
     "Watch `n & (n-1)` delete one 1-bit per loop."),
]

def block(name, intro):
    d = json.load(open(OUT / f"{name}.json"))
    props = [f'title={{{json.dumps(d["title"], ensure_ascii=False)}}}',
             f'code={{{json.dumps(d["code"], ensure_ascii=False)}}}']
    if d.get("nodes"):
        props.append(f'nodes={{{json.dumps(d["nodes"])}}}')
        props.append(f'edges={{{json.dumps(d["edges"])}}}')
    props.append(f'frames={{{json.dumps(d["frames"], ensure_ascii=False)}}}')
    return (f"{{/* trace:{name} */}}\n{intro}\n\n<AlgoTrace {' '.join(props)} />\n{{/* /trace:{name} */}}\n")

def strip_old(text, name):
    return re.sub(r"\{/\* trace:%s \*/\}.*?\{/\* /trace:%s \*/\}\n\n?" % (name, name), "", text, flags=re.S)

def main():
    by_file = {}
    for name, ch, heading, mode, intro in PLAN:
        if len(sys.argv) > 1 and name not in sys.argv[1:]:
            continue
        by_file.setdefault(ch, []).append((name, heading, mode, intro))
    for ch, items in by_file.items():
        f = next(ROOT.glob(f"{ch}-*.mdx"))
        text = f.read_text()
        for name, *_ in items:
            text = strip_old(text, name)
        anchor_end = {}
        for name, heading, mode, intro in items:
            lines = text.split("\n")
            h = next(i for i, l in enumerate(lines) if l.startswith(heading))
            if mode == "before-code":
                at = next(i for i in range(h + 1, len(lines)) if lines[i].startswith("```go") or lines[i].startswith("<GoPlayground"))
            else:
                t0 = next(i for i in range(h + 1, len(lines)) if lines[i].startswith("<ExecTimeline"))
                at = next(i for i in range(t0, len(lines)) if lines[i].strip() == "/>") + 1
                at += anchor_end.get(heading, 0)
                anchor_end[heading] = anchor_end.get(heading, 0)
            blk = block(name, intro).split("\n")
            lines[at:at] = blk + [""]
            if mode != "before-code":
                anchor_end[heading] += len(blk) + 1
            text = "\n".join(lines)
        f.write_text(text)
        print("wrote", f.name, [n for n, *_ in items])

main()
