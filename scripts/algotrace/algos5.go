package main

import (
	"fmt"
	"sort"
)

func heapPush(h []int, x int) []int { // min-heap
	h = append(h, x)
	i := len(h) - 1
	for i > 0 {
		p := (i - 1) / 2
		if h[p] <= h[i] {
			break
		}
		h[p], h[i] = h[i], h[p]
		i = p
	}
	return h
}

func heapPop(h []int) (int, []int) {
	top := h[0]
	last := len(h) - 1
	h[0] = h[last]
	h = h[:last]
	i := 0
	for {
		l, r, s := 2*i+1, 2*i+2, i
		if l < len(h) && h[l] < h[s] {
			s = l
		}
		if r < len(h) && h[r] < h[s] {
			s = r
		}
		if s == i {
			break
		}
		h[i], h[s] = h[s], h[i]
		i = s
	}
	return top, h
}

func genTopK() {
	code := `
func topKLargest(nums []int, k int) []int {
	h := &MinHeap{} // holds the k largest seen so far
	for _, x := range nums {
		if h.Len() < k {
			h.Push(x)
		} else if x > h.Peek() {
			h.Pop() // evict the smallest of the k
			h.Push(x)
		}
	}
	return h.Items()
}`
	nums := []int{4, 9, 1, 7, 3, 8, 2}
	k := 3
	t := New("top 3 largest of [4,9,1,7,3,8,2]: a min-heap of size k", code)
	var h []int
	view := func(hot M) []M {
		return []M{arr("stream", nums, nil, hot), heapView("min-heap of the k largest so far (root = the weakest of them)", h, nil)}
	}
	t.Step("h := &MinHeap{}", "Keep only the k=3 biggest values. Use a MIN-heap: its root is the smallest of the three, i.e. the first one to be kicked out.", "neutral", M{"k": k}, view(nil)...)
	for i, x := range nums {
		hot := mm(i, "hot")
		switch {
		case len(h) < k:
			h = heapPush(h, x)
			t.Step("h.Push(x)", fmt.Sprintf("Heap not full yet (%d < %d): add %d.", len(h)-1, k, x), "neutral", M{"x": x}, view(hot)...)
		case x > h[0]:
			old, nh := heapPop(h)
			h = heapPush(nh, x)
			t.Step("h.Pop()", fmt.Sprintf("%d beats the weakest keeper %d: evict %d, insert %d. O(log k).", x, old, old, x), "solution", M{"x": x}, view(hot)...)
		default:
			t.Step("else if x > h.Peek()", fmt.Sprintf("%d is not bigger than the root %d, so it cannot be in the top %d. Ignore it: O(1).", x, h[0], k), "problem", M{"x": x}, view(hot)...)
		}
	}
	sorted := cp(h)
	sort.Ints(sorted)
	t.Step("return h.Items()", fmt.Sprintf("Top %d = %v. O(n log k) time and only O(k) memory, so it works on a stream too big to sort.", k, sorted), "solution", nil, view(nil)...)
	t.Save("topk")
}

func genMergeK() {
	code := `
func mergeK(lists [][]int) []int {
	pq := &MinPQ{}
	for i, l := range lists {
		if len(l) > 0 {
			heap.Push(pq, Item{val: l[0], list: i, idx: 0})
		}
	}
	var out []int
	for pq.Len() > 0 {
		it := heap.Pop(pq).(Item) // smallest front of any list
		out = append(out, it.val)
		if next := it.idx + 1; next < len(lists[it.list]) {
			heap.Push(pq, Item{lists[it.list][next], it.list, next})
		}
	}
	return out
}`
	lists := [][]int{{1, 4, 7}, {2, 5, 8}, {3, 6, 9}}
	t := New("merge 3 sorted lists: the heap holds one front per list", code)
	pos := []int{0, 0, 0}
	type it struct{ v, l int }
	var pq []it
	var out []int
	views := func() []M {
		var vs []M
		for li, l := range lists {
			mk := M{}
			for x := 0; x < pos[li]; x++ {
				mk[fmt.Sprint(x)] = "dim"
			}
			vs = append(vs, arr(fmt.Sprintf("list %d", li), l, nil, mk))
		}
		var pi []any
		sort.Slice(pq, func(a, b int) bool { return pq[a].v < pq[b].v })
		for _, p := range pq {
			pi = append(pi, fmt.Sprintf("%d (list %d)", p.v, p.l))
		}
		vs = append(vs, M{"k": "queue", "label": "priority queue: smallest first (only ONE front per list is ever inside)", "items": pi})
		vs = append(vs, arr("out", func() []any {
			if len(out) == 0 {
				return []any{"·"}
			}
			return intItems(out)
		}(), nil, nil))
		return vs
	}
	t.Step("pq := &MinPQ{}", "Three sorted lists. The next output is always the smallest of the three current fronts, so a heap of those fronts finds it in O(log k) instead of scanning all k lists.", "neutral", nil, views()...)
	for li, l := range lists {
		pq = append(pq, it{l[0], li})
		pos[li] = 0
	}
	t.Step("heap.Push(pq, Item{val: l[0]", "Seed the heap with the first element of every list.", "neutral", nil, views()...)
	for len(pq) > 0 {
		sort.Slice(pq, func(a, b int) bool { return pq[a].v < pq[b].v })
		cur := pq[0]
		pq = pq[1:]
		out = append(out, cur.v)
		pos[cur.l]++
		msg := fmt.Sprintf("Pop %d (from list %d) and append it to out.", cur.v, cur.l)
		if pos[cur.l] < len(lists[cur.l]) {
			pq = append(pq, it{lists[cur.l][pos[cur.l]], cur.l})
			msg += fmt.Sprintf(" Push that list's next value, %d, so the heap again holds one front per list.", lists[cur.l][pos[cur.l]])
		} else {
			msg += " That list is exhausted, so nothing replaces it."
		}
		t.Step("out = append(out, it.val)", msg, "solution", M{"popped": cur.v}, views()...)
	}
	t.Step("return out", fmt.Sprintf("%v: fully sorted. N total items, heap of size k: O(N log k).", out), "solution", nil, views()...)
	t.Save("mergek")
}

func genRunningMedian() {
	code := `
type MedianFinder struct {
	lo *MaxHeap // smaller half
	hi *MinHeap // larger half
}

func (m *MedianFinder) Add(x int) {
	m.lo.Push(x)          // 1. always via the lower half
	m.hi.Push(m.lo.Pop()) // 2. its biggest moves up
	if m.hi.Len() > m.lo.Len() {
		m.lo.Push(m.hi.Pop()) // 3. rebalance: lo keeps the extra
	}
}

func (m *MedianFinder) Median() float64 {
	if m.lo.Len() > m.hi.Len() {
		return float64(m.lo.Top())
	}
	return float64(m.lo.Top()+m.hi.Top()) / 2
}`
	t := New("running median of 5, 15, 1, 3: two heaps meeting in the middle", code)
	var lo, hi []int // lo stored negated -> max-heap via min-heap
	loVals := func() []int {
		r := []int{}
		for _, v := range lo {
			r = append(r, -v)
		}
		return r
	}
	views := func() []M {
		return []M{
			heapView("lo: MAX-heap of the smaller half (root = its largest)", loVals(), nil),
			heapView("hi: MIN-heap of the larger half (root = its smallest)", cp(hi), nil),
		}
	}
	median := func() float64 {
		if len(lo) > len(hi) {
			return float64(-lo[0])
		}
		return float64(-lo[0]+hi[0]) / 2
	}
	t.Step("type MedianFinder", "The median sits between two halves. Keep the smaller half in a max-heap and the larger half in a min-heap; then both roots are the middle values, readable in O(1).", "neutral", nil, views()...)
	for _, x := range []int{5, 15, 1, 3} {
		lo = heapPush(lo, -x)
		t.Step("m.lo.Push(x)", fmt.Sprintf("Add %d: push into the lower half first.", x), "neutral", M{"x": x}, views()...)
		var top int
		top, lo = heapPop(lo)
		hi = heapPush(hi, -top)
		t.Step("m.hi.Push(m.lo.Pop())", fmt.Sprintf("Move lo's largest (%d) up to hi. This guarantees every value in lo ≤ every value in hi.", -top), "neutral", M{"x": x}, views()...)
		if len(hi) > len(lo) {
			top, hi = heapPop(hi)
			lo = heapPush(lo, -top)
			t.Step("m.lo.Push(m.hi.Pop())", fmt.Sprintf("hi got bigger than lo, so move hi's smallest (%d) back down. Sizes now differ by at most one.", top), "problem", M{"x": x}, views()...)
		}
		t.Step("func (m *MedianFinder) Median()", fmt.Sprintf("After adding %d: sizes lo=%d, hi=%d. Median = %v.", x, len(lo), len(hi), median()), "solution", M{"median": median()}, views()...)
	}
	t.Save("runningmedian")
}

func genKoko() {
	code := `
func minEatingSpeed(piles []int, h int) int {
	lo, hi := 1, slices.Max(piles)
	for lo < hi {
		mid := lo + (hi-lo)/2
		hours := 0
		for _, p := range piles {
			hours += (p + mid - 1) / mid // ceil(p/mid)
		}
		if hours <= h {
			hi = mid // fast enough: try slower
		} else {
			lo = mid + 1 // too slow: must go faster
		}
	}
	return lo
}`
	piles := []int{3, 6, 7, 11}
	h := 8
	t := New("minEatingSpeed([3,6,7,11], h=8): binary search over the ANSWER", code)
	lo, hi := 1, 11
	speeds := []any{}
	for s := 1; s <= 11; s++ {
		speeds = append(speeds, s)
	}
	v := func(mid int, feasible int) []M {
		mk := M{}
		for i := 0; i < 11; i++ {
			if i+1 < lo || i+1 > hi {
				mk[fmt.Sprint(i)] = "dim"
			}
		}
		if mid > 0 {
			switch feasible {
			case 1:
				mk[fmt.Sprint(mid-1)] = "good"
			case 0:
				mk[fmt.Sprint(mid-1)] = "bad"
			default:
				mk[fmt.Sprint(mid-1)] = "hot"
			}
		}
		return []M{arr("candidate speeds (bananas per hour); the array is the answer space, not the input", speeds, M{"lo": lo - 1, "hi": hi - 1}, mk), arr("piles", piles, nil, nil)}
	}
	t.Step("lo, hi := 1, slices.Max(piles)", fmt.Sprintf("Koko must finish in h=%d hours. The answer is a SPEED between 1 and the biggest pile. Speeds are ordered and feasibility is monotone: if speed s works, every faster speed works too. That is what makes binary search valid.", h), "neutral", M{"h": h}, v(0, -1)...)
	for lo < hi {
		mid := lo + (hi-lo)/2
		hours := 0
		var parts []string
		for _, p := range piles {
			c := (p + mid - 1) / mid
			hours += c
			parts = append(parts, fmt.Sprint(c))
		}
		t.Step("hours += (p + mid - 1) / mid", fmt.Sprintf("Try speed %d: hours per pile = %v, total %d.", mid, parts, hours), "neutral", M{"lo": lo, "hi": hi, "mid": mid, "hours": hours}, v(mid, -1)...)
		if hours <= h {
			t.Step("hi = mid", fmt.Sprintf("%d ≤ %d hours: speed %d is fast enough, and maybe a slower one is too. Keep it: hi = %d.", hours, h, mid, mid), "solution", M{"lo": lo, "hi": hi, "mid": mid}, v(mid, 1)...)
			hi = mid
		} else {
			t.Step("lo = mid + 1", fmt.Sprintf("%d > %d hours: too slow. Every speed ≤ %d fails as well, so lo = %d.", hours, h, mid, mid+1), "problem", M{"lo": lo, "hi": hi, "mid": mid}, v(mid, 0)...)
			lo = mid + 1
		}
	}
	t.Step("return lo", fmt.Sprintf("lo == hi == %d: the slowest speed that still finishes in time. Only ~log₂(11) feasibility checks instead of trying all 11 speeds.", lo), "solution", M{"answer": lo}, v(lo, 1)...)
	t.Save("koko")
}

func genCombinationSum() {
	code := `
func combinationSum(cands []int, target int) [][]int {
	var res [][]int
	var path []int
	var dfs func(start, remain int)
	dfs = func(start, remain int) {
		if remain == 0 {
			res = append(res, append([]int(nil), path...))
			return
		}
		for i := start; i < len(cands); i++ {
			if cands[i] > remain {
				break // sorted: everything after is too big too
			}
			path = append(path, cands[i])
			dfs(i, remain-cands[i]) // i, not i+1: reuse allowed
			path = path[:len(path)-1]
		}
	}
	dfs(0, target)
	return res
}`
	cands := []int{2, 3, 6, 7}
	target := 7
	t := New("combinationSum([2,3,6,7], 7): try, recurse, prune when over budget", code)
	d := &dtree{}
	var path []int
	var res [][]int
	views := func() []M {
		return []M{d.view("search tree (label = path; yellow = current, green = solution, red = pruned)"), textView("res so far", fmt.Sprint(res))}
	}
	var dfs func(start, remain int, parent string)
	dfs = func(start, remain int, parent string) {
		id := d.add(parent, fmt.Sprint(path), "hot")
		if remain == 0 {
			res = append(res, append([]int(nil), path...))
			d.set(id, "good")
			t.Step("res = append(res, append([]int(nil), path...))", fmt.Sprintf("remain is 0: %v adds up to %d exactly. Save it.", path, target), "solution", M{"remain": remain}, views()...)
			return
		}
		for i := start; i < len(cands); i++ {
			if cands[i] > remain {
				pid := d.add(id, fmt.Sprintf("+%d ✗", cands[i]), "bad")
				t.Step("if cands[i] > remain", fmt.Sprintf("%d > remain %d: overshoots. The list is sorted, so 3, 6, 7 that follow would overshoot too: break and skip them all (pruning).", cands[i], remain), "problem", M{"remain": remain}, views()...)
				_ = pid
				break
			}
			path = append(path, cands[i])
			t.Step("path = append(path, cands[i])", fmt.Sprintf("Choose %d. remain = %d − %d = %d.", cands[i], remain, cands[i], remain-cands[i]), "neutral", M{"remain": remain - cands[i]}, views()...)
			dfs(i, remain-cands[i], id)
			path = path[:len(path)-1]
			d.set(id, "hot")
		}
		if d.nodes[len(d.nodes)-1]["id"] != id {
			d.set(id, "idle")
		} else {
			d.set(id, "idle")
		}
	}
	dfs(0, target, "")
	t.Step("return res", fmt.Sprintf("%v. Passing i (not i+1) lets the same number repeat; the sort plus break stops each branch the moment it overshoots.", res), "solution", nil, views()...)
	t.Save("combsum")
}

func genHouseRobber() {
	code := `
func rob(nums []int) int {
	prev2, prev1 := 0, 0 // best up to i-2, best up to i-1
	for _, x := range nums {
		cur := max(prev1, prev2+x) // skip this house, or rob it
		prev2, prev1 = prev1, cur
	}
	return prev1
}`
	nums := []int{2, 7, 9, 3, 1}
	t := New("rob([2,7,9,3,1]): rob this house, or skip it", code)
	prev2, prev1 := 0, 0
	dp := []any{}
	t.Step("prev2, prev1 := 0, 0", "Two adjacent houses trip the alarm. At each house the best total is either: skip it (keep the best so far) or rob it (its cash + the best from two houses back).", "neutral", nil, arr("houses", nums, nil, nil), arr("best so far", []any{"·"}, nil, nil))
	for i, x := range nums {
		robIt := prev2 + x
		cur := max(prev1, robIt)
		dp = append(dp, cur)
		note := fmt.Sprintf("House %d (cash %d): skip = %d, rob = %d + %d = %d. ", i, x, prev1, prev2, x, robIt)
		beat := "neutral"
		if robIt > prev1 {
			note += "Robbing wins."
			beat = "solution"
		} else {
			note += "Skipping is at least as good."
		}
		t.Step("cur := max(prev1, prev2+x)", note, beat, M{"i": i, "prev2": prev2, "prev1": prev1, "cur": cur}, arr("houses", nums, M{"i": i}, mm(i, "hot")), arr("best up to each house", cp(dp), nil, mm(len(dp)-1, "good")))
		prev2, prev1 = prev1, cur
	}
	t.Step("return prev1", fmt.Sprintf("Answer %d (rob houses 0, 2, 4 = 2+9+1 = 12). Only two variables are kept, not a whole table: O(1) space.", prev1), "solution", M{"answer": prev1}, arr("houses", nums, nil, nil), arr("best up to each house", cp(dp), nil, nil))
	t.Save("houserobber")
}

func genDecodeWays() {
	code := `
func numDecodings(s string) int {
	n := len(s)
	dp := make([]int, n+1)
	dp[0] = 1 // the empty prefix decodes one way
	for i := 1; i <= n; i++ {
		if s[i-1] != '0' {
			dp[i] += dp[i-1] // last digit alone: 1..9
		}
		if i >= 2 {
			two := int(s[i-2]-'0')*10 + int(s[i-1]-'0')
			if two >= 10 && two <= 26 {
				dp[i] += dp[i-2] // last two digits: 10..26
			}
		}
	}
	return dp[n]
}`
	s := "2261"
	t := New(`numDecodings("2261"): 1→A … 26→Z`, code)
	dp := make([]int, len(s)+1)
	dp[0] = 1
	sh := func(upto int) []any {
		r := []any{}
		for i := range dp {
			if i <= upto {
				r = append(r, dp[i])
			} else {
				r = append(r, "?")
			}
		}
		return r
	}
	ch := []any{}
	for _, c := range s {
		ch = append(ch, string(c))
	}
	t.Step("dp[0] = 1", "dp[i] counts the ways to decode the first i digits. The empty prefix has exactly 1 way (do nothing), which seeds everything.", "neutral", nil, arr("digits", ch, nil, nil), arr("dp (index = how many digits used)", sh(0), nil, nil))
	for i := 1; i <= len(s); i++ {
		note := fmt.Sprintf("dp[%d] (first %d digits, ending in '%c'): ", i, i, s[i-1])
		mk := M{fmt.Sprint(i): "hot"}
		if s[i-1] != '0' {
			dp[i] += dp[i-1]
			note += fmt.Sprintf("'%c' alone is a letter: + dp[%d]=%d. ", s[i-1], i-1, dp[i-1])
			mk[fmt.Sprint(i-1)] = "good"
		} else {
			note += "'0' alone is invalid: no single-digit option. "
		}
		if i >= 2 {
			two := int(s[i-2]-'0')*10 + int(s[i-1]-'0')
			if two >= 10 && two <= 26 {
				dp[i] += dp[i-2]
				note += fmt.Sprintf("Pair %d is a valid letter: + dp[%d]=%d.", two, i-2, dp[i-2])
				mk[fmt.Sprint(i-2)] = "good"
			} else {
				note += fmt.Sprintf("Pair %d is not 10..26: no two-digit option.", two)
			}
		}
		t.Step("dp[i] += dp[i-1]", note, "neutral", M{"i": i}, arr("digits", ch, M{"i": i - 1}, mm(i-1, "hot")), arr("dp", sh(i), nil, mk))
	}
	t.Step("return dp[n]", fmt.Sprintf("%d ways: 2·2·6·1 (BBFA), 22·6·1 (VFA) and 2·26·1 (BZA), exactly these three. Same shape as climbing stairs: each cell adds the previous one or two.", dp[len(s)]), "solution", M{"answer": dp[len(s)]}, arr("digits", ch, nil, nil), arr("dp", sh(len(s)), nil, mm(len(s), "good")))
	t.Save("decodeways")
}

func genGasStation() {
	code := `
func canCompleteCircuit(gas, cost []int) int {
	total, tank, start := 0, 0, 0
	for i := range gas {
		diff := gas[i] - cost[i]
		total += diff
		tank += diff
		if tank < 0 { // can't get past i from start
			start = i + 1
			tank = 0
		}
	}
	if total < 0 {
		return -1
	}
	return start
}`
	gas := []int{1, 2, 3, 4, 5}
	cost := []int{3, 4, 5, 1, 2}
	t := New("gas station: gas [1,2,3,4,5], cost [3,4,5,1,2]", code)
	total, tank, start := 0, 0, 0
	v := func(i int) []M {
		d := []any{}
		for k := range gas {
			d = append(d, gas[k]-cost[k])
		}
		mk := M{}
		if i >= 0 {
			mk[fmt.Sprint(i)] = "hot"
		}
		for k := 0; k < start && k < len(gas); k++ {
			mk[fmt.Sprint(k)] = "bad"
		}
		return []M{arr("gain at each station: gas − cost (red = ruled out as a start)", d, M{"start": min(start, len(gas)-1)}, mk)}
	}
	t.Step("total, tank, start := 0, 0, 0", "You need a start station so a full loop never runs the tank below zero. Two facts: if total gas ≥ total cost a solution exists, and if the tank goes negative at i, no start between the old start and i can work.", "neutral", M{"total": 0, "tank": 0, "start": 0}, v(-1)...)
	for i := range gas {
		diff := gas[i] - cost[i]
		total += diff
		tank += diff
		if tank < 0 {
			t.Step("if tank < 0", fmt.Sprintf("Station %d: gain %d, tank falls to %d. We cannot reach station %d from start %d, and neither from any station in between (they'd arrive with even less). Restart at %d with an empty tank.", i, diff, tank, i+1, start, i+1), "problem", M{"i": i, "tank": tank, "total": total, "start": start}, v(i)...)
			start = i + 1
			tank = 0
		} else {
			t.Step("tank += diff", fmt.Sprintf("Station %d: gain %d, tank = %d. Still non-negative.", i, diff, tank), "neutral", M{"i": i, "tank": tank, "total": total, "start": start}, v(i)...)
		}
	}
	t.Step("return start", fmt.Sprintf("total = %d ≥ 0, so a valid circuit exists, and the last restart, station %d, is the answer. One pass, O(n).", total, start), "solution", M{"total": total, "start": start}, v(-1)...)
	t.Save("gasstation")
}

func genInsertInterval() {
	code := `
func insert(iv [][]int, nw []int) [][]int {
	var out [][]int
	i := 0
	for i < len(iv) && iv[i][1] < nw[0] { // 1. entirely before
		out = append(out, iv[i])
		i++
	}
	for i < len(iv) && iv[i][0] <= nw[1] { // 2. overlapping: absorb
		nw[0] = min(nw[0], iv[i][0])
		nw[1] = max(nw[1], iv[i][1])
		i++
	}
	out = append(out, nw)
	return append(out, iv[i:]...) // 3. entirely after
}`
	iv := [][]int{{1, 2}, {3, 5}, {6, 7}, {8, 10}, {12, 16}}
	nw := []int{4, 8}
	t := New("insert [4,8] into [[1,2],[3,5],[6,7],[8,10],[12,16]]", code)
	var out [][]int
	view := func(cur int, newState string) M {
		var rows []M
		for i, r := range iv {
			st := ""
			if i == cur {
				st = "hot"
			}
			rows = append(rows, M{"a": r[0], "b": r[1], "state": st, "label": fmt.Sprintf("in [%d,%d]", r[0], r[1])})
		}
		rows = append(rows, M{"a": nw[0], "b": nw[1], "state": newState, "label": fmt.Sprintf("new [%d,%d]", nw[0], nw[1])})
		for _, r := range out {
			rows = append(rows, M{"a": r[0], "b": r[1], "state": "good", "label": fmt.Sprintf("out [%d,%d]", r[0], r[1])})
		}
		return M{"k": "intervals", "lo": 0, "hi": 17, "rows": rows}
	}
	t.Step("var out [][]int", "The list is already sorted and disjoint, so the new interval splits it into three zones: intervals wholly before it, intervals that overlap it, and intervals wholly after. No sort needed.", "neutral", nil, view(-1, "hot"))
	i := 0
	for i < len(iv) && iv[i][1] < nw[0] {
		out = append(out, iv[i])
		t.Step("out = append(out, iv[i])", fmt.Sprintf("[%d,%d] ends at %d, before the new one starts at %d. Copy it unchanged.", iv[i][0], iv[i][1], iv[i][1], nw[0]), "neutral", M{"i": i}, view(i, "hot"))
		i++
	}
	for i < len(iv) && iv[i][0] <= nw[1] {
		oa, ob := nw[0], nw[1]
		nw[0] = min(nw[0], iv[i][0])
		nw[1] = max(nw[1], iv[i][1])
		t.Step("nw[1] = max(nw[1], iv[i][1])", fmt.Sprintf("[%d,%d] starts at %d ≤ %d: it overlaps. Absorb it: new becomes [min(%d,%d), max(%d,%d)] = [%d,%d].", iv[i][0], iv[i][1], iv[i][0], ob, oa, iv[i][0], ob, iv[i][1], nw[0], nw[1]), "solution", M{"i": i}, view(i, "hot"))
		i++
	}
	out = append(out, cp(nw))
	t.Step("out = append(out, nw)", fmt.Sprintf("No more overlaps. Emit the grown interval [%d,%d].", nw[0], nw[1]), "solution", nil, view(-1, "good"))
	out = append(out, iv[i:]...)
	t.Step("return append(out, iv[i:]...)", fmt.Sprintf("Everything left starts after it: copy the rest. Result %v. One pass, O(n).", out), "solution", nil, view(-1, "good"))
	t.Save("insertinterval")
}
