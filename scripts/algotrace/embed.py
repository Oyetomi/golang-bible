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
    ("removedup", "02", "### Remove Duplicates In-Place", "before-code", "Two pointers with different jobs: fast reads, slow writes. Watch the green prefix of unique values grow."),
    ("prefixk", "02", "### Subarray Sum Equals K", "before-code", "The map holds every prefix sum seen so far. Step through and watch each new running total look backwards for a partner."),
    ("rotate", "02", "### Rotate Array", "before-code", "Three reversals, no extra array. Watch the block of 3 travel to the front."),
    ("dutch", "02", "### Dutch National Flag Partition", "before-code", "Three regions and one scanner. Colours show which cells are settled and which are still unknown."),
    ("anagram", "03", "### Classic problem: anagram check", "before-code", "Count letters up with s, then down with t. A negative count is an instant no."),
    ("majority", "03", "### Classic problem: majority element", "before-code", "Watch the candidate and its vote count: every different value cancels one vote."),
    ("groupanagrams", "03", "### Classic problem: group anagrams", "before-code", "The sorted letters are the map key. Watch groups form."),
    ("minstack", "04", "### Classic: Min-Stack", "before-code", "Two stacks side by side. The second one always knows the minimum, even after pops."),
    ("ring", "04", "### The Ring Buffer Queue", "before-code", "Watch head and tail chase each other around four slots, and see writes wrap past the end."),
    ("mergesorted", "04", "### Merge Two Sorted Lists", "before-code", "Shown on slices so the fingers i and j are easy to see; the linked-list version below does the identical comparisons."),
    ("maxdepth", "05", "### The recursive mindset", "before-code", "Watch the call stack grow on the way down and the returned values fill in on the way back up."),
    ("inorder", "05", "### Why in-order of a BST is sorted", "before-code", "Left, me, right. Watch the output list come out sorted."),
    ("levelorder", "05", "## BFS by Level", "before-code", "The queue holds one level at a time. Watch size freeze the level boundary."),
    ("dfs", "07", "### DFS — Depth-First Search", "before-code", "Same graph as the BFS trace above. DFS dives; watch the call stack hold the path back home."),
    ("topo", "07", "### Kahn's Algorithm (BFS-based, in-degree method)", "before-code", "Watch the in-degree table count down. A node joins the queue the moment it hits 0."),
    ("unionfind", "07", "### Find + Union with Path Compression + Union by Rank", "before-code", "Sets drawn as trees. Watch roots merge and the parent array change."),
    ("dijkstra", "07", "### The Algorithm", "before-code", "Edge weights are on the lines. Watch dist improve when a cheaper route (via C) appears."),
    ("lowerbound", "08", "### Lower bound: first occurrence (or insert position)", "before-code", "Duplicates make this tricky. Watch the interval shrink toward the FIRST 3."),
    ("rotatedsearch", "08", "### Search in rotated sorted array", "before-code", "At every step one half is sorted. Watch which one, and how the target decides the side."),
    ("subsets", "09", "### Generate all subsets (the power set)", "before-code", "The recursion drawn as a tree. Each node is the path at one moment; watch choose, explore, un-choose."),
    ("permutations", "09", "### All orderings of distinct elements", "before-code", "The used[] array remembers which elements are already in the path. Watch it flip on and off as we backtrack."),
    ("nqueens", "09", "### N-Queens: the classic", "before-code", "A real 4x4 board. Watch a queen get placed, get blocked, and get lifted when a row has no safe square."),
    ("coinchange", "10", "### Coin change", "before-code", "Each dp cell tries every coin and looks back at earlier cells (green). Watch why greedy would fail on this input."),
    ("lis", "10", "### Longest increasing subsequence", "before-code", "For each position, find the earlier smaller value whose chain is longest, and extend it."),
    ("lcs", "10", "### Longest common subsequence (LCS)", "before-code", "Match: look diagonally and add one. No match: take the better of up or left. Highlights show which cells were read."),
    ("knapsack", "10", "### 0/1 Knapsack", "before-code", "One row of capacities, swept from high to low. Watch why the backwards direction stops an item being used twice."),
    ("jump", "11", "### Classic: Jump Game", "before-code", "One number does all the work: the furthest index reachable so far."),
    ("jumpfail", "11", "### Classic: Jump Game", "before-code", "And an input where the zero traps us: watch reach stop growing."),
    ("meetingrooms", "11", "### Classic: Meeting Rooms II (minimum rooms)", "before-code", "Starts and ends sorted separately, then swept. Watch a room get reused or a new one opened."),
    ("singlenumber", "11", "### XOR tricks", "before-code", "Watch the bits: equal pairs cancel to 000, leaving the loner."),
    ("topk", "06", "### K-largest elements", "before-code", "A min-heap of size k. Watch weak values get ignored and the root get evicted."),
    ("mergek", "06", "### Merge-K sorted arrays", "before-code", "The heap holds exactly one front per list. Watch each pop pull the next value from the same list."),
    ("runningmedian", "06", "## Running Median", "before-code", "Two heaps facing each other. The medians are always at their roots."),
    ("koko", "08", "### Classic: Koko eating bananas (minimum eating speed)", "before-code", "The array here is the space of possible ANSWERS. Watch feasibility split it into a too-slow half and a fast-enough half."),
    ("combsum", "09", "### Combination Sum: reuse allowed", "before-code", "The search tree with pruning: red nodes are branches cut the moment they overshoot."),
    ("houserobber", "10", "### House robber", "before-code", "At every house, skip or rob. Watch the best-so-far row grow."),
    ("decodeways", "10", "### Decode ways", "before-code", "Each dp cell adds the cell one back and/or two back. Green shows which."),
    ("gasstation", "11", "### Classic: Gas Station", "before-code", "Watch the tank go negative, rule out every start before that point, and restart."),
    ("insertinterval", "11", "### Classic: Insert Interval", "before-code", "Three zones: before, overlapping, after. Watch the new interval absorb what it touches."),
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
