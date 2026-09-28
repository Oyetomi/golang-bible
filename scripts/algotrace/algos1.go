package main

import (
	"fmt"
	"sort"
)

func arr(label string, cells any, ptrs M, marks M) M {
	v := M{"k": "array", "label": label, "cells": cells}
	if len(ptrs) > 0 {
		v["ptrs"] = ptrs
	}
	if len(marks) > 0 {
		v["marks"] = marks
	}
	return v
}

func genTwoSum() {
	code := `
func twoSum(nums []int, target int) []int {
	seen := map[int]int{} // value -> index where we saw it
	for i, x := range nums {
		need := target - x
		if j, ok := seen[need]; ok {
			return []int{j, i}
		}
		seen[x] = i
	}
	return nil
}`
	t := New("twoSum([8,3,11,5,6], target=9): one pass, one map", code)
	nums := []int{8, 3, 11, 5, 6}
	target := 9
	seen := map[int]int{}
	var order [][2]any // insertion order for display
	entries := func() []any {
		e := []any{}
		for _, kv := range order {
			e = append(e, []any{kv[0], kv[1]})
		}
		return e
	}
	mview := func(hot any) M {
		return M{"k": "map", "label": "seen  (value → index)", "entries": entries(), "hot": hot}
	}
	t.Step("seen := map", "Start with an empty map. It will remember every number we walk past and where it was.", "neutral",
		M{"target": target}, arr("nums", nums, nil, nil), mview(nil))
	for i, x := range nums {
		need := target - x
		t.Step("need := target - x", fmt.Sprintf("i=%d, x=%d. To reach %d we need a partner of %d − %d = %d.", i, x, target, target, x, need), "neutral",
			M{"i": i, "x": x, "need": need}, arr("nums", nums, M{"i": i}, M{fmt.Sprint(i): "hot"}), mview(nil))
		if j, ok := seen[need]; ok {
			t.Step("return []int{j, i}", fmt.Sprintf("%d IS in the map, stored at index %d. nums[%d] + nums[%d] = %d + %d = %d. Answer: [%d, %d]. One pass, no nested loop.", need, j, j, i, need, x, target, j, i), "solution",
				M{"i": i, "x": x, "need": need, "j": j}, arr("nums", nums, M{"j": j, "i": i}, M{fmt.Sprint(j): "good", fmt.Sprint(i): "good"}), mview(need))
			break
		}
		t.Step("if j, ok := seen[need]", fmt.Sprintf("Is %d in the map? No. Nobody earlier could pair with %d.", need, x), "problem",
			M{"i": i, "x": x, "need": need}, arr("nums", nums, M{"i": i}, M{fmt.Sprint(i): "hot"}), mview(nil))
		seen[x] = i
		order = append(order, [2]any{x, i})
		t.Step("seen[x] = i", fmt.Sprintf("Remember %d → index %d so a later number can find it.", x, i), "neutral",
			M{"i": i, "x": x}, arr("nums", nums, M{"i": i}, M{fmt.Sprint(i): "dim"}), mview(x))
	}
	t.Save("twosum")
}

func genNextGreater() {
	code := `
func nextGreater(nums []int) []int {
	res := make([]int, len(nums))
	for i := range res {
		res[i] = -1 // -1 means "no greater element to the right"
	}
	stack := []int{} // indices; their values are decreasing
	for i, x := range nums {
		for len(stack) > 0 && nums[stack[len(stack)-1]] < x {
			top := stack[len(stack)-1]
			stack = stack[:len(stack)-1]
			res[top] = x
		}
		stack = append(stack, i)
	}
	return res
}`
	t := New("nextGreater([5,3,8,2,7]): a stack of waiting numbers", code)
	nums := []int{5, 3, 8, 2, 7}
	res := make([]int, len(nums))
	for i := range res {
		res[i] = -1
	}
	var stack []int
	sview := func(hot string) M {
		var items []any
		for _, ix := range stack {
			items = append(items, fmt.Sprintf("%d (i=%d)", nums[ix], ix))
		}
		v := M{"k": "stack", "label": "stack of numbers still waiting for a bigger one", "items": items}
		if hot != "" {
			v["hot"] = hot
		}
		return v
	}
	rview := func() M { return arr("res (answers so far)", cp(res), nil, nil) }
	marks := func(cur int) M {
		m := M{fmt.Sprint(cur): "hot"}
		for _, ix := range stack {
			m[fmt.Sprint(ix)] = "win"
		}
		return m
	}
	t.Step("stack := []int{}", "Every answer starts at −1. The stack holds numbers that are still waiting for something bigger to their right.", "neutral", nil,
		arr("nums", nums, nil, nil), sview(""), rview())
	for i, x := range nums {
		t.Step("for i, x := range nums", fmt.Sprintf("Look at x=%d (index %d). Anything waiting on the stack that is smaller than %d has just found its answer.", x, i, x), "neutral",
			M{"i": i, "x": x}, arr("nums", nums, M{"i": i}, marks(i)), sview(""), rview())
		for len(stack) > 0 && nums[stack[len(stack)-1]] < x {
			top := stack[len(stack)-1]
			stack = stack[:len(stack)-1]
			res[top] = x
			t.Step("res[top] = x", fmt.Sprintf("Pop %d (index %d): %d < %d, so %d is its next greater element. Write it into res[%d].", nums[top], top, nums[top], x, x, top), "solution",
				M{"i": i, "x": x, "top": top}, arr("nums", nums, M{"i": i, "top": top}, M{fmt.Sprint(i): "hot", fmt.Sprint(top): "good"}), sview("pop"), rview())
		}
		stack = append(stack, i)
		t.Step("stack = append(stack, i)", fmt.Sprintf("Nothing smaller left. Push %d: it now waits for its own bigger number. The stack stays decreasing from bottom to top.", x), "neutral",
			M{"i": i, "x": x}, arr("nums", nums, M{"i": i}, marks(i)), sview("push"), rview())
	}
	t.Step("return res", "Numbers still on the stack never found a bigger one, so they keep −1. Each index was pushed once and popped at most once: O(n) total, even though there is a loop inside a loop.", "solution",
		nil, arr("nums", nums, nil, nil), sview(""), arr("res (final)", cp(res), nil, nil))
	t.Save("nextgreater")
}

// ---- heap -------------------------------------------------------------

func heapView(label string, h []int, marks M) M {
	v := M{"k": "heap", "label": label, "cells": cp(h)}
	if len(marks) > 0 {
		v["marks"] = marks
	}
	return v
}

func genHeapPush(final *[]int) {
	code := `
func (h *MinHeap) Push(x int) {
	*h = append(*h, x) // 1. drop it in the next free slot
	i := len(*h) - 1
	for i > 0 { // 2. sift up
		p := (i - 1) / 2
		if (*h)[p] <= (*h)[i] {
			break // parent is smaller or equal: heap property holds
		}
		(*h)[p], (*h)[i] = (*h)[i], (*h)[p]
		i = p
	}
}`
	t := New("Push 2 into the min-heap [1, 3, 5, 7, 4]: sift up", code)
	h := []int{1, 3, 5, 7, 4}
	t.Step("func (h *MinHeap)", "A valid min-heap: every parent is ≤ its children, so the smallest value is always at index 0.", "neutral", nil, heapView("min-heap", h, nil))
	x := 2
	h = append(h, x)
	i := len(h) - 1
	t.Step("append(*h, x)", "Step 1: put 2 in the next free slot (index 5). The array stays compact. But 2 is now a child of 5, which breaks the rule.", "problem",
		M{"x": x, "i": i}, heapView("min-heap", h, M{fmt.Sprint(i): "hot"}))
	for i > 0 {
		p := (i - 1) / 2
		if h[p] <= h[i] {
			t.Step("break", fmt.Sprintf("Parent h[%d]=%d ≤ h[%d]=%d. The rule holds again. Stop.", p, h[p], i, h[i]), "solution",
				M{"i": i, "p": p}, heapView("min-heap", h, M{fmt.Sprint(p): "good", fmt.Sprint(i): "good"}))
			break
		}
		t.Step("if (*h)[p] <= (*h)[i]", fmt.Sprintf("Compare with the parent: p=(%d−1)/2=%d, h[%d]=%d > h[%d]=%d. The child is smaller, so it must move up.", i, p, p, h[p], i, h[i]), "problem",
			M{"i": i, "p": p}, heapView("min-heap", h, M{fmt.Sprint(p): "bad", fmt.Sprint(i): "hot"}))
		h[p], h[i] = h[i], h[p]
		i = p
		t.Step("(*h)[p], (*h)[i] =", fmt.Sprintf("Swap. 2 moves up to index %d. Now compare it with its new parent.", i), "neutral",
			M{"i": i}, heapView("min-heap", h, M{fmt.Sprint(i): "hot"}))
	}
	*final = cp(h)
	t.Save("heappush")
}

func genHeapPop(start []int) {
	code := `
func (h *MinHeap) Pop() int {
	old := *h
	top := old[0] // the minimum is always the root
	last := len(old) - 1
	old[0] = old[last] // 1. move the last leaf to the root
	*h = old[:last]
	i := 0
	for { // 2. sift down
		l, r, small := 2*i+1, 2*i+2, i
		if l < last && (*h)[l] < (*h)[small] {
			small = l
		}
		if r < last && (*h)[r] < (*h)[small] {
			small = r
		}
		if small == i {
			break // both children are bigger: done
		}
		(*h)[i], (*h)[small] = (*h)[small], (*h)[i]
		i = small
	}
	return top
}`
	t := New(fmt.Sprintf("Pop the minimum from %v: sift down", start), code)
	h := cp(start)
	t.Step("top := old[0]", fmt.Sprintf("The minimum is at the root: %d. Removing the root leaves a hole at the top, and we must not shift everything (that would cost O(n)).", h[0]), "neutral",
		M{"top": h[0]}, heapView("min-heap", h, M{"0": "hot"}))
	top := h[0]
	last := len(h) - 1
	h[0] = h[last]
	h = h[:last]
	t.Step("old[0] = old[last]", fmt.Sprintf("Move the LAST leaf (%d) into the root and shrink the array. The shape is fixed, but %d may be bigger than its children.", h[0], h[0]), "problem",
		M{"top": top}, heapView("min-heap", h, M{"0": "hot"}))
	i := 0
	for {
		l, r, small := 2*i+1, 2*i+2, i
		if l < last && h[l] < h[small] {
			small = l
		}
		if r < last && h[r] < h[small] {
			small = r
		}
		marks := M{fmt.Sprint(i): "hot"}
		if l < last {
			marks[fmt.Sprint(l)] = "win"
		}
		if r < last {
			marks[fmt.Sprint(r)] = "win"
		}
		if small == i {
			t.Step("if small == i", fmt.Sprintf("Children of index %d are not smaller than h[%d]=%d. It is in the right place. Done, and the popped value is %d.", i, i, h[i], top), "solution",
				M{"i": i, "top": top}, heapView("min-heap", h, M{fmt.Sprint(i): "good"}))
			break
		}
		marks[fmt.Sprint(small)] = "bad"
		t.Step("if r < last", fmt.Sprintf("Look at the children of index %d: the smaller one is h[%d]=%d, which is less than h[%d]=%d. Swap with the SMALLER child so the other child stays valid.", i, small, h[small], i, h[i]), "neutral",
			M{"i": i, "small": small}, heapView("min-heap", h, marks))
		h[i], h[small] = h[small], h[i]
		i = small
		t.Step("(*h)[i], (*h)[small] =", fmt.Sprintf("Swapped. The value sank to index %d. Repeat until it has no smaller child.", i), "neutral",
			M{"i": i}, heapView("min-heap", h, M{fmt.Sprint(i): "hot"}))
	}
	t.Save("heappop")
}

// ---- bfs --------------------------------------------------------------

func genBFS() {
	code := `
func bfs(adj map[string][]string, start string) []string {
	visited := map[string]bool{start: true}
	queue := []string{start}
	order := []string{}
	for len(queue) > 0 {
		cur := queue[0]
		queue = queue[1:]
		order = append(order, cur)
		for _, nb := range adj[cur] {
			if !visited[nb] {
				visited[nb] = true
				queue = append(queue, nb)
			}
		}
	}
	return order
}`
	adj := map[string][]string{
		"A": {"B", "C"}, "B": {"A", "D", "E"}, "C": {"A", "E"}, "D": {"B", "F"}, "E": {"B", "C", "F"}, "F": {"D", "E"},
	}
	t := New("bfs from A: the queue is the frontier", code)
	t.Nodes = []M{
		{"id": "A", "x": 40, "y": 85}, {"id": "B", "x": 105, "y": 40}, {"id": "C", "x": 105, "y": 130},
		{"id": "D", "x": 190, "y": 30}, {"id": "E", "x": 190, "y": 100}, {"id": "F", "x": 265, "y": 65},
	}
	t.Edges = [][2]string{{"A", "B"}, {"A", "C"}, {"B", "D"}, {"B", "E"}, {"C", "E"}, {"D", "F"}, {"E", "F"}}
	states := map[string]string{}
	var queue, order []string
	var lit []string
	gv := func(at string) M {
		s := M{}
		for k, v := range states {
			s[k] = v
		}
		return M{"k": "graph", "label": "graph (blue = queued, solid = processed)", "states": s, "edges": cp(lit), "at": at}
	}
	qv := func() M {
		var it []any
		for _, q := range queue {
			it = append(it, q)
		}
		return M{"k": "queue", "label": "queue (visit order = enqueue order)", "items": it}
	}
	ov := func() M { return M{"k": "text", "label": "order visited", "text": fmt.Sprint(order)} }
	visited := map[string]bool{"A": true}
	queue = []string{"A"}
	states["A"] = "frontier"
	t.Step("visited := map", "Mark the start as visited and put it in the queue. The queue is the frontier: everything we know about but have not explored.", "neutral",
		nil, gv(""), qv(), ov())
	for len(queue) > 0 {
		cur := queue[0]
		queue = queue[1:]
		order = append(order, cur)
		states[cur] = "visit"
		t.Step("cur := queue[0]", fmt.Sprintf("Take %s from the FRONT of the queue. Oldest discovery first: that is what makes BFS explore in rings of distance.", cur), "neutral",
			M{"cur": cur}, gv(cur), qv(), ov())
		for _, nb := range adj[cur] {
			if !visited[nb] {
				visited[nb] = true
				queue = append(queue, nb)
				states[nb] = "frontier"
				lit = append(lit, cur+"-"+nb)
				t.Step("queue = append(queue, nb)", fmt.Sprintf("Neighbour %s is new: mark it visited NOW (so nobody enqueues it twice) and add it to the back.", nb), "solution",
					M{"cur": cur, "nb": nb}, gv(cur), qv(), ov())
			} else {
				t.Step("if !visited[nb]", fmt.Sprintf("Neighbour %s was already seen. Skip it, otherwise we would loop forever on cycles.", nb), "problem",
					M{"cur": cur, "nb": nb}, gv(cur), qv(), ov())
			}
		}
		states[cur] = "done"
	}
	t.Step("return order", fmt.Sprintf("Queue empty: every reachable node visited in order %v. The first time BFS reaches a node is via a shortest path (fewest edges).", order), "solution",
		nil, gv(""), qv(), ov())
	t.Save("bfs")
}

// ---- edit distance ----------------------------------------------------

func genEditDistance() {
	code := `
func editDistance(a, b string) int {
	dp := make([][]int, len(a)+1)
	for i := range dp {
		dp[i] = make([]int, len(b)+1)
		dp[i][0] = i // turn a[:i] into "" = i deletions
	}
	for j := 0; j <= len(b); j++ {
		dp[0][j] = j // turn "" into b[:j] = j insertions
	}
	for i := 1; i <= len(a); i++ {
		for j := 1; j <= len(b); j++ {
			if a[i-1] == b[j-1] {
				dp[i][j] = dp[i-1][j-1] // same letter: free
			} else {
				dp[i][j] = 1 + min(dp[i-1][j-1], dp[i-1][j], dp[i][j-1])
			}
		}
	}
	return dp[len(a)][len(b)]
}`
	a, b := "flaw", "lawn"
	t := New(`editDistance("flaw", "lawn"): fill the table one cell at a time`, code)
	dp := make([][]int, len(a)+1)
	shown := make([][]any, len(a)+1)
	for i := range dp {
		dp[i] = make([]int, len(b)+1)
		shown[i] = make([]any, len(b)+1)
		for j := range shown[i] {
			shown[i][j] = ""
		}
	}
	rows := []any{"·"}
	for _, c := range a {
		rows = append(rows, string(c))
	}
	cols := []any{"·"}
	for _, c := range b {
		cols = append(cols, string(c))
	}
	gv := func(hot []int, deps [][2]int) M {
		g := make([][]any, len(shown))
		for i := range shown {
			g[i] = cp(shown[i])
		}
		v := M{"k": "grid", "label": "dp[i][j] = fewest edits to turn a[:i] into b[:j]", "rows": rows, "cols": cols, "cells": g}
		if hot != nil {
			v["hot"] = hot
		}
		if len(deps) > 0 {
			v["deps"] = deps
		}
		return v
	}
	t.Step("dp := make", "Rows are prefixes of \"flaw\", columns are prefixes of \"lawn\". Each cell will hold the fewest edits (insert, delete, replace) to turn one prefix into the other.", "neutral", nil, gv(nil, nil))
	for i := range dp {
		dp[i][0] = i
		shown[i][0] = i
	}
	t.Step("dp[i][0] = i", "First column: turning a prefix of \"flaw\" into the empty string costs one deletion per letter: 0, 1, 2, 3, 4.", "neutral", nil, gv(nil, nil))
	for j := 0; j <= len(b); j++ {
		dp[0][j] = j
		shown[0][j] = j
	}
	t.Step("dp[0][j] = j", "First row: turning the empty string into a prefix of \"lawn\" costs one insertion per letter. The borders are the base cases.", "neutral", nil, gv(nil, nil))
	for i := 1; i <= len(a); i++ {
		for j := 1; j <= len(b); j++ {
			deps := [][2]int{{i - 1, j - 1}, {i - 1, j}, {i, j - 1}}
			vars := M{"i": i, "j": j, "a[i-1]": string(a[i-1]), "b[j-1]": string(b[j-1])}
			if a[i-1] == b[j-1] {
				dp[i][j] = dp[i-1][j-1]
				shown[i][j] = dp[i][j]
				t.Step("dp[i][j] = dp[i-1][j-1]", fmt.Sprintf("'%c' = '%c': the letters match, so no new edit. Copy the diagonal (%d).", a[i-1], b[j-1], dp[i-1][j-1]), "solution",
					vars, gv([]int{i, j}, [][2]int{{i - 1, j - 1}}))
			} else {
				d, u, l := dp[i-1][j-1], dp[i-1][j], dp[i][j-1]
				dp[i][j] = 1 + min(d, u, l)
				shown[i][j] = dp[i][j]
				t.Step("dp[i][j] = 1 + min", fmt.Sprintf("'%c' ≠ '%c'. Best of replace (diag %d), delete (up %d), insert (left %d) is %d, plus one edit = %d.", a[i-1], b[j-1], d, u, l, min(d, u, l), dp[i][j]), "neutral",
					vars, gv([]int{i, j}, deps))
			}
		}
	}
	t.Step("return dp[len(a)][len(b)]", fmt.Sprintf("The bottom-right cell is the answer: %d edits. (Delete 'f', then add 'n': flaw → law → lawn.)", dp[len(a)][len(b)]), "solution",
		nil, gv([]int{len(a), len(b)}, nil))
	t.Save("editdistance")
}

// ---- merge intervals --------------------------------------------------

func genMerge() {
	code := `
func merge(intervals [][]int) [][]int {
	sort.Slice(intervals, func(i, j int) bool {
		return intervals[i][0] < intervals[j][0] // sort by start
	})
	out := [][]int{intervals[0]}
	for _, cur := range intervals[1:] {
		last := out[len(out)-1]
		if cur[0] <= last[1] { // overlaps the last merged interval
			last[1] = max(last[1], cur[1]) // extend it
		} else {
			out = append(out, cur) // gap: start a new one
		}
	}
	return out
}`
	t := New("merge([[8,10],[1,4],[7,9],[2,5]]): sort, then sweep", code)
	in := [][]int{{8, 10}, {1, 4}, {7, 9}, {2, 5}}
	iv := func(in [][]int, out [][]int, cur int, state string) M {
		var rows []M
		for i, r := range in {
			s := ""
			if i == cur {
				s = state
			} else if cur >= 0 && i < cur {
				s = "dim"
			}
			rows = append(rows, M{"a": r[0], "b": r[1], "state": s, "label": fmt.Sprintf("in [%d,%d]", r[0], r[1])})
		}
		for _, r := range out {
			rows = append(rows, M{"a": r[0], "b": r[1], "state": "good", "label": fmt.Sprintf("merged [%d,%d]", r[0], r[1])})
		}
		return M{"k": "intervals", "lo": 0, "hi": 11, "rows": rows}
	}
	t.Step("func merge", "Four meetings on a number line, in the order they arrived. Overlapping ones must become one.", "neutral", nil, iv(in, nil, -1, ""))
	sort.Slice(in, func(i, j int) bool { return in[i][0] < in[j][0] })
	t.Step("sort.Slice", "Sort by start time. Now any interval that overlaps the previous merged block must start inside it, so one left-to-right sweep is enough.", "solution", nil, iv(in, nil, -1, ""))
	out := [][]int{{in[0][0], in[0][1]}}
	t.Step("out := [][]int", "Seed the output with the first interval.", "neutral", nil, iv(in, out, 0, "hot"))
	for i := 1; i < len(in); i++ {
		cur := in[i]
		last := out[len(out)-1]
		if cur[0] <= last[1] {
			t.Step("if cur[0] <= last[1]", fmt.Sprintf("cur=[%d,%d] starts at %d ≤ last end %d: they overlap.", cur[0], cur[1], cur[0], last[1]), "problem",
				M{"cur": fmt.Sprint(cur), "last": fmt.Sprint(last)}, iv(in, out, i, "bad"))
			oldEnd := last[1]
			last[1] = max(last[1], cur[1])
			t.Step("last[1] = max", fmt.Sprintf("Extend the merged block to end at max(%d, %d) = %d.", oldEnd, cur[1], last[1]), "solution",
				M{"merged": fmt.Sprint(last)}, iv(in, out, i, "good"))
		} else {
			out = append(out, []int{cur[0], cur[1]})
			t.Step("out = append(out, cur)", fmt.Sprintf("cur=[%d,%d] starts at %d > last end %d: a gap, so it begins a new block.", cur[0], cur[1], cur[0], last[1]), "neutral",
				M{"cur": fmt.Sprint(cur)}, iv(in, out, i, "hot"))
		}
	}
	t.Step("return out", fmt.Sprintf("Result: %v. Sorting is O(n log n); the sweep is O(n).", out), "solution", nil, iv(in, out, len(in), ""))
	t.Save("merge")
}

// ---- popcount ---------------------------------------------------------

func genPopcount() {
	code := `
func countBits(n uint) int {
	count := 0
	for n != 0 {
		n &= n - 1 // clears the lowest set bit
		count++
	}
	return count
}`
	t := New("countBits(44): n &= n-1 deletes the lowest 1 each time", code)
	n := uint(44)
	bv := func(rows ...M) M { return M{"k": "bits", "rows": rows} }
	row := func(label string, v uint, marks M) M {
		r := M{"label": label, "value": v, "width": 6}
		if len(marks) > 0 {
			r["marks"] = marks
		}
		return r
	}
	count := 0
	t.Step("count := 0", "44 in binary is 101100: three 1-bits. Instead of testing all bits, we will delete one 1-bit per loop.", "neutral",
		M{"count": 0}, bv(row("n", n, nil)))
	for n != 0 {
		low := 0
		for (n>>low)&1 == 0 {
			low++
		}
		m := n - 1
		t.Step("n &= n - 1", fmt.Sprintf("n−1 flips the lowest 1 (bit %d) to 0 and turns every 0 below it into 1. ANDing with n keeps only the bits both share, so that lowest 1 disappears.", low), "neutral",
			M{"count": count}, bv(row("n", n, M{fmt.Sprint(low): "hot"}), row("n − 1", m, M{fmt.Sprint(low): "bad"}), row("n & (n−1)", n&m, M{fmt.Sprint(low): "good"})))
		n &= m
		count++
		t.Step("count++", fmt.Sprintf("One 1-bit removed. count=%d, n=%d.", count, n), "neutral",
			M{"count": count}, bv(row("n", n, nil)))
	}
	t.Step("return count", fmt.Sprintf("n is 0: the loop ran exactly once per set bit, %d times. O(number of 1-bits), not O(bit width).", count), "solution",
		M{"count": count}, bv(row("n", 0, nil)))
	t.Save("popcount")
}
