package main

import (
	"fmt"
	"sort"
	"strings"
)

// decision-tree helper: nodes are added as the recursion explores them.
type dtree struct {
	nodes []M
	seq   int
}

func (d *dtree) add(parent, label, state string) string {
	d.seq++
	id := fmt.Sprintf("n%d", d.seq)
	n := M{"id": id, "label": label, "state": state}
	if parent != "" {
		n["parent"] = parent
	}
	d.nodes = append(d.nodes, n)
	return id
}

func (d *dtree) set(id, state string) {
	for _, n := range d.nodes {
		if n["id"] == id {
			n["state"] = state
		}
	}
}

func (d *dtree) view(label string) M {
	ns := make([]M, len(d.nodes))
	for i, n := range d.nodes {
		c := M{}
		for k, v := range n {
			c[k] = v
		}
		ns[i] = c
	}
	return M{"k": "tree", "label": label, "nodes": ns}
}

func genSubsets() {
	code := `
func subsets(nums []int) [][]int {
	var res [][]int
	var path []int
	var dfs func(start int)
	dfs = func(start int) {
		res = append(res, append([]int(nil), path...)) // record a copy
		for i := start; i < len(nums); i++ {
			path = append(path, nums[i]) // choose
			dfs(i + 1)                   // explore
			path = path[:len(path)-1]    // un-choose (backtrack)
		}
	}
	dfs(0)
	return res
}`
	t := New("subsets([1,2,3]): choose, explore, un-choose", code)
	nums := []int{1, 2, 3}
	d := &dtree{}
	var path []int
	var res [][]int
	views := func() []M {
		pi := []any{}
		for _, p := range path {
			pi = append(pi, p)
		}
		return []M{
			d.view("decision tree: each node is the `path` at one moment (yellow = current)"),
			{"k": "stack", "label": "path (the current partial answer)", "items": pi},
			textView("res so far", fmt.Sprint(res)),
		}
	}
	var dfs func(start int, parent string)
	dfs = func(start int, parent string) {
		label := fmt.Sprint(path)
		id := d.add(parent, label, "hot")
		res = append(res, append([]int(nil), path...))
		t.Step("res = append(res, append([]int(nil), path...))", fmt.Sprintf("Every path is itself a valid subset, so record a COPY of %v right away. (Without the copy, later changes to path would corrupt what we saved.)", path), "solution", M{"start": start}, views()...)
		for i := start; i < len(nums); i++ {
			path = append(path, nums[i])
			t.Step("path = append(path, nums[i])", fmt.Sprintf("Choose %d. path is now %v.", nums[i], path), "neutral", M{"start": start, "i": i}, views()...)
			dfs(i+1, id)
			path = path[:len(path)-1]
			d.set(id, "hot")
			t.Step("path = path[:len(path)-1]", fmt.Sprintf("Un-choose %d: pop it off. path back to %v, ready to try the next option.", nums[i], path), "problem", M{"start": start, "i": i}, views()...)
		}
		d.set(id, "good")
	}
	dfs(0, "")
	t.Step("return res", fmt.Sprintf("%d subsets: 2ⁿ for n=3. Every tree node is one subset; the tree has exactly 8 nodes.", len(res)), "solution", nil, views()...)
	t.Save("subsets")
}

func genPermutations() {
	code := `
func permute(nums []int) [][]int {
	var res [][]int
	var path []int
	used := make([]bool, len(nums))
	var dfs func()
	dfs = func() {
		if len(path) == len(nums) {
			res = append(res, append([]int(nil), path...))
			return
		}
		for i, x := range nums {
			if used[i] {
				continue
			}
			used[i] = true
			path = append(path, x)
			dfs()
			path = path[:len(path)-1]
			used[i] = false
		}
	}
	dfs()
	return res
}`
	t := New("permute([1,2,3]): the used[] array is the memory of choices", code)
	nums := []int{1, 2, 3}
	d := &dtree{}
	var path []int
	used := make([]bool, 3)
	var res [][]int
	views := func() []M {
		pi := []any{}
		for _, p := range path {
			pi = append(pi, p)
		}
		u := M{}
		for i, b := range used {
			if b {
				u[fmt.Sprint(i)] = "dim"
			}
		}
		return []M{
			d.view("decision tree (yellow = current)"),
			arr("nums (faded = used[i] is true)", nums, nil, u),
			{"k": "stack", "label": "path", "items": pi},
			textView("res so far", fmt.Sprint(res)),
		}
	}
	var dfs func(parent string)
	dfs = func(parent string) {
		id := d.add(parent, fmt.Sprint(path), "hot")
		if len(path) == len(nums) {
			res = append(res, append([]int(nil), path...))
			d.set(id, "good")
			t.Step("res = append(res, append([]int(nil), path...))", fmt.Sprintf("path is full length: %v is a complete permutation. Save a copy and return.", path), "solution", nil, views()...)
			return
		}
		for i, x := range nums {
			if used[i] {
				t.Step("if used[i]", fmt.Sprintf("%d is already in path. Skip it: a permutation uses each element once.", x), "problem", M{"i": i}, views()...)
				continue
			}
			used[i] = true
			path = append(path, x)
			t.Step("path = append(path, x)", fmt.Sprintf("Choose %d and mark it used. path = %v.", x, path), "neutral", M{"i": i}, views()...)
			dfs(id)
			path = path[:len(path)-1]
			used[i] = false
			d.set(id, "hot")
			t.Step("used[i] = false", fmt.Sprintf("Backtrack: un-choose %d and free it so a sibling branch can use it.", x), "problem", M{"i": i}, views()...)
		}
		d.set(id, "good")
	}
	dfs("")
	t.Step("return res", fmt.Sprintf("%d permutations = 3!. Leaves of the tree are the answers.", len(res)), "solution", nil, views()...)
	t.Save("permutations")
}

func genNQueens() {
	code := `
func solveNQueens(n int) int {
	cols := make([]bool, n)
	d1 := make([]bool, 2*n) // row+col
	d2 := make([]bool, 2*n) // row-col+n
	count := 0
	var place func(row int)
	place = func(row int) {
		if row == n {
			count++
			return
		}
		for c := 0; c < n; c++ {
			if cols[c] || d1[row+c] || d2[row-c+n] {
				continue // attacked
			}
			cols[c], d1[row+c], d2[row-c+n] = true, true, true
			place(row + 1)
			cols[c], d1[row+c], d2[row-c+n] = false, false, false
		}
	}
	place(0)
	return count
}`
	n := 4
	t := New("4-Queens: one queen per row, back up when a row has no safe square", code)
	cols := make([]bool, n)
	d1 := make([]bool, 2*n)
	d2 := make([]bool, 2*n)
	q := make([]int, n)
	for i := range q {
		q[i] = -1
	}
	count := 0
	board := func(hotR, hotC int, bad bool) M {
		cells := make([][]any, n)
		for r := 0; r < n; r++ {
			cells[r] = make([]any, n)
			for c := 0; c < n; c++ {
				cells[r][c] = ""
				if q[r] == c {
					cells[r][c] = "♛"
				}
			}
		}
		rows, cs := []any{}, []any{}
		for i := 0; i < n; i++ {
			rows = append(rows, i)
			cs = append(cs, i)
		}
		v := M{"k": "grid", "label": "board (♛ = placed; yellow = square being tried)", "rows": rows, "cols": cs, "cells": cells}
		if hotR >= 0 {
			v["hot"] = []int{hotR, hotC}
		}
		return v
	}
	t.Step("cols := make", "Place one queen per row. Three boolean arrays answer 'is this square attacked?' in O(1): a column, and two diagonals (row+col and row−col are constant along each diagonal).", "neutral", nil, board(-1, -1, false))
	var place func(row int)
	place = func(row int) {
		if row == n {
			count++
			t.Step("count++", fmt.Sprintf("All %d rows filled: solution found (queens at columns %v).", n, q), "solution", M{"count": count}, board(-1, -1, false))
			return
		}
		any := false
		for c := 0; c < n; c++ {
			if cols[c] || d1[row+c] || d2[row-c+n] {
				why := "same column"
				if !cols[c] {
					why = "on a diagonal"
				}
				t.Step("continue // attacked", fmt.Sprintf("Row %d, column %d: attacked (%s). Skip.", row, c, why), "problem", M{"row": row, "c": c}, board(row, c, true))
				continue
			}
			any = true
			cols[c], d1[row+c], d2[row-c+n] = true, true, true
			q[row] = c
			t.Step("cols[c], d1[row+c], d2[row-c+n] = true", fmt.Sprintf("Row %d, column %d is safe. Place a queen and mark its column and diagonals.", row, c), "neutral", M{"row": row, "c": c}, board(row, c, false))
			place(row + 1)
			cols[c], d1[row+c], d2[row-c+n] = false, false, false
			q[row] = -1
			t.Step("cols[c], d1[row+c], d2[row-c+n] = false", fmt.Sprintf("Backtrack: lift the queen from row %d, column %d and try the next column.", row, c), "problem", M{"row": row, "c": c}, board(row, c, false))
		}
		if !any {
			t.Step("place(row + 1)", fmt.Sprintf("Row %d has no safe square at all. Dead end: return to the previous row and move that queen.", row), "problem", M{"row": row}, board(-1, -1, false))
		}
	}
	place(0)
	t.Step("return count", fmt.Sprintf("Total solutions for 4 queens: %d. Pruning at the first attacked square avoids exploring the other 4⁴=256 raw placements.", count), "solution", M{"count": count}, board(-1, -1, false))
	t.Save("nqueens")
}

// ---- DP ------------------------------------------------------------------

func genCoinChange() {
	code := `
func coinChange(coins []int, amount int) int {
	const inf = 1 << 30
	dp := make([]int, amount+1)
	for i := 1; i <= amount; i++ {
		dp[i] = inf
		for _, c := range coins {
			if c <= i && dp[i-c]+1 < dp[i] {
				dp[i] = dp[i-c] + 1
			}
		}
	}
	if dp[amount] >= inf {
		return -1
	}
	return dp[amount]
}`
	coins := []int{1, 3, 4}
	amount := 6
	t := New("coinChange([1,3,4], 6): dp[i] = fewest coins to make i", code)
	const inf = 1 << 30
	dp := make([]int, amount+1)
	shown := func() []any {
		r := []any{}
		for i, v := range dp {
			if i > 0 && v == 0 {
				r = append(r, "?")
			} else {
				r = append(r, v)
			}
		}
		return r
	}
	t.Step("dp := make", "dp[i] is the fewest coins that add up to exactly i. dp[0]=0 (no coins needed). Fill left to right, each cell built from earlier cells.", "neutral", nil, arr("dp", shown(), nil, nil))
	for i := 1; i <= amount; i++ {
		dp[i] = inf
		var from []int
		for _, c := range coins {
			if c <= i && dp[i-c]+1 < dp[i] {
				dp[i] = dp[i-c] + 1
				from = []int{i - c}
			}
		}
		var parts []string
		for _, c := range coins {
			if c <= i {
				parts = append(parts, fmt.Sprintf("coin %d → dp[%d]+1 = %d", c, i-c, dp[i-c]+1))
			}
		}
		marks := M{fmt.Sprint(i): "hot"}
		for _, f := range from {
			marks[fmt.Sprint(f)] = "good"
		}
		t.Step("dp[i] = dp[i-c] + 1", fmt.Sprintf("dp[%d]: try each coin: %s. Best is %d.", i, strings.Join(parts, "; "), dp[i]), "neutral", M{"i": i, "dp[i]": dp[i]}, arr("dp  (green = the cell the best choice came from)", shown(), M{"i": i}, marks))
	}
	t.Step("return dp[amount]", "dp[6] = 2 via 3+3. Greedy (largest coin first) would take 4+1+1 = 3 coins and be WRONG here: DP checks every option, greedy commits to one.", "solution", M{"answer": dp[amount]}, arr("dp", shown(), nil, mm(amount, "good")))
	t.Save("coinchange")
}

func genLIS() {
	code := `
func lengthOfLIS(nums []int) int {
	dp := make([]int, len(nums)) // dp[i] = LIS ending exactly at i
	best := 0
	for i := range nums {
		dp[i] = 1
		for j := 0; j < i; j++ {
			if nums[j] < nums[i] && dp[j]+1 > dp[i] {
				dp[i] = dp[j] + 1
			}
		}
		best = max(best, dp[i])
	}
	return best
}`
	nums := []int{10, 9, 2, 5, 3, 7, 101, 18}
	t := New("LIS of [10,9,2,5,3,7,101,18]: dp[i] = longest chain ending at i", code)
	dp := make([]int, len(nums))
	best := 0
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
	t.Step("dp := make", "For each position i, ask: what is the longest increasing chain that ENDS at nums[i]? Each answer extends a chain that ended at some smaller earlier value.", "neutral", nil, arr("nums", nums, nil, nil), arr("dp", sh(-1), nil, nil))
	for i := range nums {
		dp[i] = 1
		var ext []int
		for j := 0; j < i; j++ {
			if nums[j] < nums[i] && dp[j]+1 > dp[i] {
				dp[i] = dp[j] + 1
				ext = []int{j}
			}
		}
		best = max(best, dp[i])
		mk := M{fmt.Sprint(i): "hot"}
		note := fmt.Sprintf("nums[%d]=%d: no earlier value is smaller, so it starts a new chain. dp[%d]=1.", i, nums[i], i)
		if len(ext) > 0 {
			mk[fmt.Sprint(ext[0])] = "good"
			note = fmt.Sprintf("nums[%d]=%d can extend the chain ending at nums[%d]=%d (dp=%d), so dp[%d] = %d.", i, nums[i], ext[0], nums[ext[0]], dp[ext[0]], i, dp[i])
		}
		t.Step("dp[i] = dp[j] + 1", note, "neutral", M{"i": i, "best": best}, arr("nums (green = the chain we extend)", nums, M{"i": i}, mk), arr("dp", sh(i), nil, nil))
	}
	t.Step("return best", fmt.Sprintf("The answer is the MAX over all dp[i] (a chain can end anywhere): %d, e.g. 2, 3, 7, 101. O(n²).", best), "solution", M{"best": best}, arr("nums", nums, nil, nil), arr("dp", sh(len(nums)), nil, nil))
	t.Save("lis")
}

func genLCS() {
	code := `
func lcs(a, b string) int {
	dp := make([][]int, len(a)+1)
	for i := range dp {
		dp[i] = make([]int, len(b)+1)
	}
	for i := 1; i <= len(a); i++ {
		for j := 1; j <= len(b); j++ {
			if a[i-1] == b[j-1] {
				dp[i][j] = dp[i-1][j-1] + 1
			} else {
				dp[i][j] = max(dp[i-1][j], dp[i][j-1])
			}
		}
	}
	return dp[len(a)][len(b)]
}`
	a, b := "ABCB", "BDCB"
	t := New(`lcs("ABCB", "BDCB"): longest common subsequence`, code)
	dp := make([][]int, len(a)+1)
	shown := make([][]any, len(a)+1)
	for i := range dp {
		dp[i] = make([]int, len(b)+1)
		shown[i] = make([]any, len(b)+1)
		for j := range shown[i] {
			shown[i][j] = ""
		}
	}
	for i := range shown {
		shown[i][0] = 0
	}
	for j := range shown[0] {
		shown[0][j] = 0
	}
	rows, cols := []any{"·"}, []any{"·"}
	for _, c := range a {
		rows = append(rows, string(c))
	}
	for _, c := range b {
		cols = append(cols, string(c))
	}
	gv := func(hot []int, deps [][2]int) M {
		g := make([][]any, len(shown))
		for i := range shown {
			g[i] = cp(shown[i])
		}
		v := M{"k": "grid", "label": "dp[i][j] = LCS length of a[:i] and b[:j]", "rows": rows, "cols": cols, "cells": g}
		if hot != nil {
			v["hot"] = hot
		}
		if len(deps) > 0 {
			v["deps"] = deps
		}
		return v
	}
	t.Step("dp := make", "A subsequence keeps order but may skip letters. dp[i][j] is the best for the first i letters of a and first j of b. The zero row and column mean 'one string is empty'.", "neutral", nil, gv(nil, nil))
	for i := 1; i <= len(a); i++ {
		for j := 1; j <= len(b); j++ {
			if a[i-1] == b[j-1] {
				dp[i][j] = dp[i-1][j-1] + 1
				shown[i][j] = dp[i][j]
				t.Step("dp[i][j] = dp[i-1][j-1] + 1", fmt.Sprintf("'%c' = '%c': a match extends the best of both shorter prefixes (the diagonal, %d) by one → %d.", a[i-1], b[j-1], dp[i-1][j-1], dp[i][j]), "solution", M{"i": i, "j": j}, gv([]int{i, j}, [][2]int{{i - 1, j - 1}}))
			} else {
				dp[i][j] = max(dp[i-1][j], dp[i][j-1])
				shown[i][j] = dp[i][j]
				t.Step("dp[i][j] = max(dp[i-1][j], dp[i][j-1])", fmt.Sprintf("'%c' ≠ '%c': drop one letter from either string and keep the better result: max(up %d, left %d) = %d.", a[i-1], b[j-1], dp[i-1][j], dp[i][j-1], dp[i][j]), "neutral", M{"i": i, "j": j}, gv([]int{i, j}, [][2]int{{i - 1, j}, {i, j - 1}}))
			}
		}
	}
	t.Step("return dp[len(a)][len(b)]", fmt.Sprintf("Bottom-right = %d: the common subsequence is \"BCB\".", dp[len(a)][len(b)]), "solution", nil, gv([]int{len(a), len(b)}, nil))
	t.Save("lcs")
}

func genKnapsack() {
	code := `
func knapsack(w, v []int, capacity int) int {
	dp := make([]int, capacity+1) // dp[c] = best value with capacity c
	for i := range w {
		for c := capacity; c >= w[i]; c-- { // backwards: each item once
			dp[c] = max(dp[c], dp[c-w[i]]+v[i])
		}
	}
	return dp[capacity]
}`
	w, v := []int{1, 3, 4}, []int{15, 20, 30}
	capc := 4
	t := New("0/1 knapsack: items (w=1,v=15) (w=3,v=20) (w=4,v=30), capacity 4", code)
	dp := make([]int, capc+1)
	t.Step("dp := make", "dp[c] is the best total value that fits in capacity c. We consider items one at a time; each may be taken at most once (0/1).", "neutral", nil, arr("dp (index = capacity)", cp(dp), nil, nil))
	for i := range w {
		t.Step("for i := range w", fmt.Sprintf("Consider item %d (weight %d, value %d).", i, w[i], v[i]), "neutral", M{"i": i}, arr("dp", cp(dp), nil, nil))
		for c := capc; c >= w[i]; c-- {
			take := dp[c-w[i]] + v[i]
			old := dp[c]
			note := fmt.Sprintf("Capacity %d: skip = %d, take = dp[%d]+%d = %d. ", c, old, c-w[i], v[i], take)
			if take > old {
				dp[c] = take
				note += "Taking is better. Update."
			} else {
				note += "Skipping is at least as good."
			}
			t.Step("dp[c] = max(dp[c], dp[c-w[i]]+v[i])", note, map[bool]string{true: "solution", false: "neutral"}[take > old], M{"i": i, "c": c}, arr("dp  (we sweep capacity from high to low)", cp(dp), M{"c": c}, mm(c, "hot", c-w[i], "good")))
		}
	}
	t.Step("return dp[capacity]", fmt.Sprintf("Best value at capacity 4 is %d (items 0 and 1 give 35; item 2 alone gives 30). The backwards sweep is the trick: going forwards would let one item be used twice, because dp[c-w] would already include it.", dp[capc]), "solution", M{"answer": dp[capc]}, arr("dp", cp(dp), nil, mm(capc, "good")))
	t.Save("knapsack")
}

// ---- greedy / intervals / bits ------------------------------------------

func genJump() {
	code := `
func canJump(nums []int) bool {
	reach := 0 // furthest index we can get to
	for i, x := range nums {
		if i > reach {
			return false // gap we can't cross
		}
		reach = max(reach, i+x)
	}
	return true
}`
	for _, tc := range []struct {
		name string
		nums []int
	}{{"jump", []int{2, 3, 1, 1, 4}}, {"jumpfail", []int{3, 2, 1, 0, 4}}} {
		t := New(fmt.Sprintf("canJump(%v): track the furthest reachable index", tc.nums), code)
		nums := tc.nums
		reach := 0
		view := func(i int) M {
			m := M{}
			for k := 0; k <= reach && k < len(nums); k++ {
				m[fmt.Sprint(k)] = "win"
			}
			if i >= 0 {
				m[fmt.Sprint(i)] = "hot"
			}
			return arr("nums (light = reachable so far)", nums, M{"reach": min(reach, len(nums)-1)}, m)
		}
		t.Step("reach := 0", "Each value is the MAX jump from that cell. Instead of trying every path, keep one number: the furthest index reachable so far.", "neutral", M{"reach": reach}, view(-1))
		ok := true
		for i, x := range nums {
			if i > reach {
				t.Step("return false", fmt.Sprintf("At index %d but reach is only %d: index %d is unreachable, so nothing beyond it is either. Answer: false.", i, reach, i), "problem", M{"i": i, "reach": reach}, view(i))
				ok = false
				break
			}
			old := reach
			reach = max(reach, i+x)
			note := fmt.Sprintf("index %d is reachable, and from it we can jump up to %d. reach = max(%d, %d+%d) = %d.", i, x, old, i, x, reach)
			t.Step("reach = max(reach, i+x)", note, "neutral", M{"i": i, "reach": reach}, view(i))
		}
		if ok {
			t.Step("return true", "The loop finished without hitting a gap, so the last index is reachable. One pass, O(n).", "solution", M{"reach": reach}, view(-1))
		}
		t.Save(tc.name)
	}
}

func genMeetingRooms() {
	code := `
func minMeetingRooms(iv [][]int) int {
	starts, ends := []int{}, []int{}
	for _, m := range iv {
		starts = append(starts, m[0])
		ends = append(ends, m[1])
	}
	sort.Ints(starts)
	sort.Ints(ends)
	rooms, e := 0, 0
	for _, s := range starts {
		if s >= ends[e] {
			e++ // a room freed up: reuse it
		} else {
			rooms++ // everyone is busy: open a new room
		}
	}
	return rooms
}`
	iv := [][]int{{0, 30}, {5, 10}, {15, 20}, {10, 25}}
	t := New("minMeetingRooms([[0,30],[5,10],[15,20],[10,25]])", code)
	var starts, ends []int
	for _, m := range iv {
		starts = append(starts, m[0])
		ends = append(ends, m[1])
	}
	sort.Ints(starts)
	sort.Ints(ends)
	bars := func(cur int) M {
		var rows []M
		for _, m := range iv {
			rows = append(rows, M{"a": m[0], "b": m[1], "label": fmt.Sprintf("[%d,%d]", m[0], m[1])})
		}
		if cur >= 0 {
			for i := range rows {
				if rows[i]["a"] == starts[cur] {
					rows[i]["state"] = "hot"
				}
			}
		}
		return M{"k": "intervals", "lo": 0, "hi": 30, "rows": rows}
	}
	rooms, e := 0, 0
	t.Step("sort.Ints(starts)", "Trick: forget which end belongs to which meeting. Sort starts and ends separately, then sweep: at each start ask 'has ANY meeting ended yet?'.", "neutral", nil, bars(-1), arr("starts (sorted)", starts, nil, nil), arr("ends (sorted)", ends, M{"e": 0}, mm(0, "hot")))
	for k, s := range starts {
		em := M{fmt.Sprint(e): "hot"}
		if s >= ends[e] {
			t.Step("if s >= ends[e]", fmt.Sprintf("Meeting starting at %d ≥ earliest end %d: that room is free. Reuse it, and move e forward.", s, ends[e]), "solution", M{"s": s, "rooms": rooms}, bars(k), arr("starts", starts, M{"s": k}, mm(k, "hot")), arr("ends", ends, M{"e": e}, em))
			e++
		} else {
			rooms++
			t.Step("rooms++", fmt.Sprintf("Meeting starting at %d < earliest end %d: every room is still busy. Open a new one. rooms = %d.", s, ends[e], rooms), "problem", M{"s": s, "rooms": rooms}, bars(k), arr("starts", starts, M{"s": k}, mm(k, "hot")), arr("ends", ends, M{"e": e}, em))
		}
	}
	t.Step("return rooms", fmt.Sprintf("Answer: %d rooms at the busiest moment. O(n log n) for the sorts.", rooms), "solution", M{"rooms": rooms}, bars(-1))
	t.Save("meetingrooms")
}

func genSingleNumber() {
	code := `
func singleNumber(nums []int) int {
	x := 0
	for _, n := range nums {
		x ^= n // pairs cancel: a ^ a == 0
	}
	return x
}`
	t := New("singleNumber([4,1,2,1,2]): XOR cancels the pairs", code)
	nums := []int{4, 1, 2, 1, 2}
	x := 0
	bv := func(n int, marks M) M {
		return M{"k": "bits", "rows": []M{{"label": "x", "value": x, "width": 3}, {"label": fmt.Sprintf("n = %d", n), "value": n, "width": 3}}}
	}
	t.Step("x := 0", "XOR rules: a ^ a = 0 and a ^ 0 = a, and order does not matter. So XOR-ing the whole array cancels every pair and leaves the loner.", "neutral", M{"x": x}, arr("nums", nums, nil, nil), bv(0, nil))
	for i, n := range nums {
		prev := x
		x ^= n
		t.Step("x ^= n", fmt.Sprintf("%d ^ %d = %d.", prev, n, x), "neutral", M{"i": i, "x": x}, arr("nums", nums, M{"i": i}, mm(i, "hot")), M{"k": "bits", "rows": []M{{"label": "before", "value": prev, "width": 3}, {"label": fmt.Sprintf("n = %d", n), "value": n, "width": 3}, {"label": "x ^ n", "value": x, "width": 3}}})
	}
	t.Step("return x", fmt.Sprintf("The 1s and 2s each appeared twice and vanished. Answer: %d. O(n) time, O(1) space.", x), "solution", M{"x": x}, arr("nums", nums, nil, nil), bv(0, nil))
	t.Save("singlenumber")
}
