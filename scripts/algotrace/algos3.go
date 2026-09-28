package main

import (
	"fmt"
	"sort"
)

// ---- shared tree plumbing ---------------------------------------------

type tnode struct {
	id, parent string
	val        int
}

// treeView renders the fixed tree with per-node states.
func treeView(label string, nodes []tnode, states map[string]string) M {
	var ns []M
	for _, n := range nodes {
		st := states[n.id]
		if st == "" {
			st = "idle"
		}
		m := M{"id": n.id, "label": n.val, "state": st}
		if n.parent != "" {
			m["parent"] = n.parent
		}
		ns = append(ns, m)
	}
	return M{"k": "tree", "label": label, "nodes": ns}
}

func textView(label, text string) M { return M{"k": "text", "label": label, "text": text} }

func strItems(a []string) []any {
	r := []any{}
	for _, s := range a {
		r = append(r, s)
	}
	return r
}

func intItems(a []int) []any {
	r := []any{}
	for _, s := range a {
		r = append(r, s)
	}
	return r
}

func genInorder() {
	code := `
func inorder(n *TreeNode, visit func(int)) {
	if n == nil {
		return
	}
	inorder(n.Left, visit)
	visit(n.Val)
	inorder(n.Right, visit)
}`
	t := New("inorder on a BST: left subtree, me, right subtree", code)
	nodes := []tnode{{"4", "", 4}, {"2", "4", 2}, {"6", "4", 6}, {"1", "2", 1}, {"3", "2", 3}, {"5", "6", 5}, {"7", "6", 7}}
	kids := map[string][2]string{"4": {"2", "6"}, "2": {"1", "3"}, "6": {"5", "7"}}
	val := map[string]int{}
	for _, n := range nodes {
		val[n.id] = n.val
	}
	states := map[string]string{}
	var stack, out []string
	views := func() []M {
		return []M{
			treeView("BST (yellow = the call running now, green = already visited)", nodes, states),
			{"k": "stack", "label": "call stack (each pending inorder call)", "items": strItems(stack)},
			textView("visited order", fmt.Sprint(out)),
		}
	}
	var rec func(id string)
	rec = func(id string) {
		if id == "" {
			return
		}
		stack = append(stack, id)
		states[id] = "hot"
		t.Step("inorder(n.Left, visit)", fmt.Sprintf("Call inorder on %s. Before touching %s itself, go all the way left.", id, id), "neutral", nil, views()...)
		rec(kids[id][0])
		states[id] = "hot"
		out = append(out, id)
		t.Step("visit(n.Val)", fmt.Sprintf("Left side finished. Visit %s now. Output so far: %v, always ascending in a BST.", id, out), "solution", nil, views()...)
		states[id] = "good"
		rec(kids[id][1])
		stack = stack[:len(stack)-1]
		if len(stack) > 0 {
			states[stack[len(stack)-1]] = "hot"
		}
	}
	rec("4")
	t.Step("inorder(n.Right, visit)", fmt.Sprintf("The last call returns. Result %v is sorted, which is why in-order on a BST is a sorted scan.", out), "solution", nil, views()...)
	t.Save("inorder")
}

func genLevelOrder() {
	code := `
func levelOrder(root *TreeNode) [][]int {
	var res [][]int
	queue := []*TreeNode{root}
	for len(queue) > 0 {
		size := len(queue) // exactly this level
		level := []int{}
		for i := 0; i < size; i++ {
			n := queue[0]
			queue = queue[1:]
			level = append(level, n.Val)
			if n.Left != nil {
				queue = append(queue, n.Left)
			}
			if n.Right != nil {
				queue = append(queue, n.Right)
			}
		}
		res = append(res, level)
	}
	return res
}`
	t := New("levelOrder: a queue walks the tree one level at a time", code)
	nodes := []tnode{{"4", "", 4}, {"2", "4", 2}, {"6", "4", 6}, {"1", "2", 1}, {"3", "2", 3}, {"5", "6", 5}}
	kids := map[string][]string{"4": {"2", "6"}, "2": {"1", "3"}, "6": {"5"}}
	states := map[string]string{}
	queue := []string{"4"}
	states["4"] = "visit"
	var res [][]string
	views := func() []M {
		return []M{
			treeView("tree (blue = in the queue)", nodes, states),
			{"k": "queue", "label": "queue", "items": strItems(queue)},
			textView("levels so far", fmt.Sprint(res)),
		}
	}
	t.Step("queue := []*TreeNode{root}", "Start with the root in the queue. The queue always holds the next nodes to process, oldest first.", "neutral", nil, views()...)
	for len(queue) > 0 {
		size := len(queue)
		var level []string
		t.Step("size := len(queue)", fmt.Sprintf("Freeze size=%d: exactly the nodes in the queue right now are ONE level. Anything added while we process them belongs to the next level.", size), "neutral", M{"size": size}, views()...)
		for i := 0; i < size; i++ {
			n := queue[0]
			queue = queue[1:]
			level = append(level, n)
			states[n] = "good"
			for _, c := range kids[n] {
				queue = append(queue, c)
				states[c] = "visit"
			}
			t.Step("level = append(level, n.Val)", fmt.Sprintf("Dequeue %s, record it, and enqueue its children %v.", n, kids[n]), "solution", M{"size": size, "i": i}, views()...)
		}
		res = append(res, level)
		t.Step("res = append(res, level)", fmt.Sprintf("Level done: %v.", level), "neutral", nil, views()...)
	}
	t.Save("levelorder")
}

func genMaxDepth() {
	code := `
func maxDepth(n *TreeNode) int {
	if n == nil {
		return 0
	}
	left := maxDepth(n.Left)
	right := maxDepth(n.Right)
	return 1 + max(left, right)
}`
	t := New("maxDepth: recurse down, combine on the way back up", code)
	nodes := []tnode{{"3", "", 3}, {"9", "3", 9}, {"20", "3", 20}, {"15", "20", 15}, {"7", "20", 7}}
	kids := map[string][]string{"3": {"9", "20"}, "20": {"15", "7"}}
	states := map[string]string{}
	var stack []string
	ret := map[string]int{}
	var retOrder []string
	views := func() []M {
		var e []any
		for _, id := range retOrder {
			e = append(e, []any{"node " + id, ret[id]})
		}
		return []M{
			treeView("tree", nodes, states),
			{"k": "stack", "label": "call stack", "items": strItems(stack)},
			{"k": "map", "label": "returned values (node → depth of its subtree)", "entries": e},
		}
	}
	var rec func(id string) int
	rec = func(id string) int {
		stack = append(stack, id)
		states[id] = "hot"
		t.Step("left := maxDepth(n.Left)", fmt.Sprintf("Enter node %s. It cannot answer yet: it needs the depth of both subtrees first.", id), "neutral", nil, views()...)
		l, r := 0, 0
		ks := kids[id]
		if len(ks) > 0 {
			l = rec(ks[0])
			states[id] = "hot"
		}
		if len(ks) > 1 {
			r = rec(ks[1])
			states[id] = "hot"
		}
		d := 1 + max(l, r)
		ret[id] = d
		retOrder = append(retOrder, id)
		note := fmt.Sprintf("Node %s: left=%d, right=%d, so it returns 1 + max = %d.", id, l, r, d)
		if len(ks) == 0 {
			note = fmt.Sprintf("Node %s is a leaf: both children are nil (each returns 0), so it returns 1 + max(0,0) = 1.", id)
		}
		states[id] = "good"
		t.Step("return 1 + max(left, right)", note, "solution", M{"left": l, "right": r, "returns": d}, views()...)
		stack = stack[:len(stack)-1]
		if len(stack) > 0 {
			states[stack[len(stack)-1]] = "hot"
		}
		return d
	}
	d := rec("3")
	t.Step("return 1 + max(left, right)", fmt.Sprintf("The root's answer is %d. Every node did O(1) work, so the whole thing is O(n). Answers flow UP from the leaves.", d), "solution", nil, views()...)
	t.Save("maxdepth")
}

// ---- graphs ------------------------------------------------------------

var g6Nodes = []M{
	{"id": "A", "x": 40, "y": 85}, {"id": "B", "x": 105, "y": 40}, {"id": "C", "x": 105, "y": 130},
	{"id": "D", "x": 190, "y": 30}, {"id": "E", "x": 190, "y": 100}, {"id": "F", "x": 265, "y": 65},
}
var g6Edges = [][]any{{"A", "B"}, {"A", "C"}, {"B", "D"}, {"B", "E"}, {"C", "E"}, {"D", "F"}, {"E", "F"}}
var g6Adj = map[string][]string{"A": {"B", "C"}, "B": {"A", "D", "E"}, "C": {"A", "E"}, "D": {"B", "F"}, "E": {"B", "C", "F"}, "F": {"D", "E"}}

func genDFS() {
	code := `
func dfs(adj map[string][]string, cur string, visited map[string]bool, order *[]string) {
	visited[cur] = true
	*order = append(*order, cur)
	for _, nb := range adj[cur] {
		if !visited[nb] {
			dfs(adj, nb, visited, order)
		}
	}
}`
	t := New("dfs from A: go deep, come back only when stuck", code)
	t.Nodes, t.Edges = g6Nodes, g6Edges
	states := map[string]string{}
	var stack, order, lit []string
	visited := map[string]bool{}
	views := func(at string) []M {
		s := M{}
		for k, v := range states {
			s[k] = v
		}
		return []M{
			{"k": "graph", "label": "graph (blue = being explored, green = finished)", "states": s, "edges": cp(lit), "at": at},
			{"k": "stack", "label": "call stack (the path we took to get here)", "items": strItems(stack)},
			textView("order visited", fmt.Sprint(order)),
		}
	}
	var rec func(cur, from string)
	rec = func(cur, from string) {
		visited[cur] = true
		order = append(order, cur)
		stack = append(stack, cur)
		states[cur] = "visit"
		if from != "" {
			lit = append(lit, from+"-"+cur)
		}
		t.Step("visited[cur] = true", fmt.Sprintf("Arrive at %s and mark it. The call stack grows: it remembers the path so we can backtrack.", cur), "neutral", M{"cur": cur}, views(cur)...)
		for _, nb := range g6Adj[cur] {
			if visited[nb] {
				t.Step("if !visited[nb]", fmt.Sprintf("Neighbour %s was already visited. Skip it.", nb), "problem", M{"cur": cur, "nb": nb}, views(cur)...)
				continue
			}
			t.Step("dfs(adj, nb, visited, order)", fmt.Sprintf("%s is new: dive straight into it instead of finishing %s's other neighbours first.", nb, cur), "solution", M{"cur": cur, "nb": nb}, views(cur)...)
			rec(nb, cur)
			if len(stack) > 0 {
				states[cur] = "visit"
			}
			t.Step("for _, nb := range adj[cur]", fmt.Sprintf("Back at %s: the dive into %s is finished. Continue with %s's next neighbour.", cur, nb, cur), "neutral", M{"cur": cur}, views(cur)...)
		}
		states[cur] = "done"
		stack = stack[:len(stack)-1]
	}
	rec("A", "")
	t.Step("}", fmt.Sprintf("Everything reachable is visited, in order %v. Compare with BFS: DFS follows one path to the bottom before trying alternatives.", order), "solution", nil, views("")...)
	t.Save("dfs")
}

func genTopo() {
	code := `
func topoSort(nodes []string, adj map[string][]string, indeg map[string]int) []string {
	queue := []string{}
	for _, node := range nodes {
		if indeg[node] == 0 {
			queue = append(queue, node)
		}
	}
	var order []string
	for len(queue) > 0 {
		cur := queue[0]
		queue = queue[1:]
		order = append(order, cur)
		for _, nb := range adj[cur] {
			indeg[nb]--
			if indeg[nb] == 0 {
				queue = append(queue, nb)
			}
		}
	}
	return order
}`
	t := New("topoSort (Kahn): peel off nodes with no unmet prerequisites", code)
	t.Nodes = []M{
		{"id": "A", "x": 30, "y": 45}, {"id": "B", "x": 30, "y": 125}, {"id": "C", "x": 110, "y": 85},
		{"id": "D", "x": 190, "y": 45}, {"id": "E", "x": 190, "y": 125}, {"id": "F", "x": 270, "y": 85},
	}
	t.Edges = [][]any{{"A", "C"}, {"B", "C"}, {"C", "D"}, {"B", "E"}, {"D", "F"}, {"E", "F"}}
	nodes := []string{"A", "B", "C", "D", "E", "F"}
	adj := map[string][]string{"A": {"C"}, "B": {"C", "E"}, "C": {"D"}, "D": {"F"}, "E": {"F"}}
	indeg := map[string]int{"C": 2, "D": 1, "E": 1, "F": 2, "A": 0, "B": 0}
	states := map[string]string{}
	var queue, order, lit []string
	views := func(hot string) []M {
		var e []any
		for _, n := range nodes {
			e = append(e, []any{n, indeg[n]})
		}
		s := M{}
		for k, v := range states {
			s[k] = v
		}
		return []M{
			{"k": "graph", "label": "dependencies (an edge X→Y means X must come before Y; arrows point left to right)", "states": s, "edges": cp(lit)},
			{"k": "map", "label": "in-degree (how many prerequisites are still unmet)", "entries": e, "hot": hot},
			{"k": "queue", "label": "ready queue (in-degree 0)", "items": strItems(queue)},
			textView("order so far", fmt.Sprint(order)),
		}
	}
	t.Step("queue := []string{}", "Count each node's unmet prerequisites (in-degree). A and B have none, so they can go first.", "neutral", nil, views("")...)
	for _, n := range nodes {
		if indeg[n] == 0 {
			queue = append(queue, n)
			states[n] = "frontier"
		}
	}
	t.Step("queue = append(queue, node)", "Seed the queue with every node whose in-degree is 0.", "solution", nil, views("")...)
	for len(queue) > 0 {
		cur := queue[0]
		queue = queue[1:]
		order = append(order, cur)
		states[cur] = "done"
		t.Step("order = append(order, cur)", fmt.Sprintf("Take %s. All its prerequisites are already in the order, so placing it now is safe.", cur), "neutral", M{"cur": cur}, views("")...)
		for _, nb := range adj[cur] {
			indeg[nb]--
			lit = append(lit, cur+"-"+nb)
			if indeg[nb] == 0 {
				queue = append(queue, nb)
				states[nb] = "frontier"
				t.Step("if indeg[nb] == 0", fmt.Sprintf("%s just lost a prerequisite: its in-degree fell to 0, so it is ready. Enqueue it.", nb), "solution", M{"cur": cur, "nb": nb}, views(nb)...)
			} else {
				t.Step("indeg[nb]--", fmt.Sprintf("%s lost a prerequisite but still waits on %d more.", nb, indeg[nb]), "neutral", M{"cur": cur, "nb": nb}, views(nb)...)
			}
		}
	}
	t.Step("return order", fmt.Sprintf("Order: %v. If some node were left with in-degree > 0, there would be a cycle, and len(order) < len(nodes) would reveal it.", order), "solution", nil, views("")...)
	t.Save("topo")
}

func genUnionFind() {
	code := `
func find(parent []int, x int) int {
	if parent[x] != x {
		parent[x] = find(parent, parent[x]) // path compression
	}
	return parent[x]
}

func union(parent, rank []int, a, b int) {
	ra, rb := find(parent, a), find(parent, b)
	if ra == rb {
		return
	}
	if rank[ra] < rank[rb] {
		ra, rb = rb, ra
	}
	parent[rb] = ra // attach the shorter tree under the taller
	if rank[ra] == rank[rb] {
		rank[ra]++
	}
}`
	t := New("Union-Find: sets as trees, parent pointers in an array", code)
	n := 6
	parent := make([]int, n)
	rank := make([]int, n)
	for i := range parent {
		parent[i] = i
	}
	var find func(x int) int
	find = func(x int) int {
		if parent[x] != x {
			parent[x] = find(parent[x])
		}
		return parent[x]
	}
	views := func(hot ...int) []M {
		var ns []M
		for i := 0; i < n; i++ {
			m := M{"id": fmt.Sprint(i), "label": i, "state": "idle"}
			if parent[i] != i {
				m["parent"] = fmt.Sprint(parent[i])
			}
			for _, h := range hot {
				if h == i {
					m["state"] = "hot"
				}
			}
			ns = append(ns, m)
		}
		marks := M{}
		for _, h := range hot {
			marks[fmt.Sprint(h)] = "hot"
		}
		return []M{
			{"k": "tree", "label": "the sets as trees (a root points to itself)", "nodes": ns},
			arr("parent[]", cp(parent), nil, marks),
		}
	}
	t.Step("func find", "Six elements, each alone: parent[i] = i, so every element is the root of its own one-node tree. Two elements are in the same set exactly when they share a root.", "neutral", nil, views()...)
	union := func(a, b int) {
		ra, rb := find(a), find(b)
		if ra == rb {
			t.Step("if ra == rb", fmt.Sprintf("union(%d,%d): both already share root %d. Nothing to do.", a, b, ra), "problem", nil, views(a, b)...)
			return
		}
		if rank[ra] < rank[rb] {
			ra, rb = rb, ra
		}
		parent[rb] = ra
		if rank[ra] == rank[rb] {
			rank[ra]++
		}
		t.Step("parent[rb] = ra", fmt.Sprintf("union(%d,%d): roots are %d and %d. Point %d's root at %d. Ranks stay small because the shorter tree hangs under the taller.", a, b, ra, rb, rb, ra), "solution", M{"ra": ra, "rb": rb}, views(ra, rb)...)
	}
	union(0, 1)
	union(2, 3)
	union(0, 2)
	union(4, 5)
	union(4, 3)
	before := cp(parent)
	r := find(5)
	_ = before
	t.Step("parent[x] = find(parent, parent[x])", fmt.Sprintf("find(5): walked 5 → 4 → %d and rewired parent[5] straight to the root (path compression). Next time it takes one hop.", r), "solution", M{"root": r}, views(5, r)...)
	t.Save("unionfind")
}

func genDijkstra() {
	code := `
func dijkstra(adj map[string][]Edge, src string) map[string]int {
	dist := map[string]int{src: 0}
	pq := &PQ{{src, 0}}
	for pq.Len() > 0 {
		cur := heap.Pop(pq).(Item) // closest unsettled node
		if cur.d > dist[cur.node] {
			continue // stale entry
		}
		for _, e := range adj[cur.node] {
			nd := cur.d + e.w
			if d, ok := dist[e.to]; !ok || nd < d {
				dist[e.to] = nd
				heap.Push(pq, Item{e.to, nd})
			}
		}
	}
	return dist
}`
	t := New("Dijkstra from A: always settle the closest unsettled node", code)
	t.Nodes = []M{
		{"id": "A", "x": 30, "y": 85}, {"id": "B", "x": 110, "y": 35}, {"id": "C", "x": 110, "y": 135},
		{"id": "D", "x": 195, "y": 85}, {"id": "E", "x": 270, "y": 85},
	}
	type E struct {
		to string
		w  int
	}
	adj := map[string][]E{
		"A": {{"B", 4}, {"C", 2}}, "B": {{"A", 4}, {"C", 1}, {"D", 5}}, "C": {{"A", 2}, {"B", 1}, {"D", 8}},
		"D": {{"B", 5}, {"C", 8}, {"E", 3}}, "E": {{"D", 3}},
	}
	t.Edges = [][]any{{"A", "B", 4}, {"A", "C", 2}, {"C", "B", 1}, {"B", "D", 5}, {"C", "D", 8}, {"D", "E", 3}}
	type item struct {
		node string
		d    int
	}
	dist := map[string]int{"A": 0}
	distOrder := []string{"A"}
	pq := []item{{"A", 0}}
	states := map[string]string{"A": "frontier"}
	var lit []string
	settled := map[string]bool{}
	views := func(at string, hot string) []M {
		var e []any
		for _, k := range distOrder {
			e = append(e, []any{k, dist[k]})
		}
		var pi []any
		for _, it := range pq {
			pi = append(pi, fmt.Sprintf("%s (%d)", it.node, it.d))
		}
		s := M{}
		for k, v := range states {
			s[k] = v
		}
		return []M{
			{"k": "graph", "label": "graph with edge weights (green = settled, blue = in the queue)", "states": s, "edges": cp(lit), "at": at},
			{"k": "map", "label": "dist  (best known cost from A)", "entries": e, "hot": hot},
			{"k": "queue", "label": "priority queue (closest first)", "items": pi},
		}
	}
	t.Step("dist := map", "Cost to A is 0; everything else is unknown (infinite). The priority queue always hands back the closest unsettled node.", "neutral", nil, views("", "A")...)
	for len(pq) > 0 {
		sort.SliceStable(pq, func(i, j int) bool { return pq[i].d < pq[j].d })
		cur := pq[0]
		pq = pq[1:]
		if cur.d > dist[cur.node] {
			t.Step("if cur.d > dist[cur.node]", fmt.Sprintf("Popped a stale entry for %s (%d, but %d is already known). Skip.", cur.node, cur.d, dist[cur.node]), "problem", nil, views("", "")...)
			continue
		}
		settled[cur.node] = true
		states[cur.node] = "done"
		t.Step("cur := heap.Pop(pq)", fmt.Sprintf("Pop %s with cost %d. Nothing cheaper can reach it, because every remaining route starts at least this far away. It is settled.", cur.node, cur.d), "solution", M{"cur": cur.node, "d": cur.d}, views(cur.node, cur.node)...)
		for _, e := range adj[cur.node] {
			nd := cur.d + e.w
			old, ok := dist[e.to]
			if !ok || nd < old {
				if !ok {
					distOrder = append(distOrder, e.to)
				}
				dist[e.to] = nd
				pq = append(pq, item{e.to, nd})
				if !settled[e.to] {
					states[e.to] = "frontier"
				}
				lit = append(lit, cur.node+"-"+e.to)
				msg := fmt.Sprintf("Relax %s→%s (weight %d): %d + %d = %d", cur.node, e.to, e.w, cur.d, e.w, nd)
				if ok {
					msg += fmt.Sprintf(", better than the old %d. Update.", old)
				} else {
					msg += ", the first route found. Record it."
				}
				t.Step("dist[e.to] = nd", msg, "solution", M{"cur": cur.node, "to": e.to, "nd": nd}, views(cur.node, e.to)...)
			} else {
				t.Step("if d, ok := dist[e.to]", fmt.Sprintf("%s→%s would cost %d, but %d is already known. No improvement.", cur.node, e.to, nd, old), "problem", M{"cur": cur.node, "to": e.to, "nd": nd}, views(cur.node, e.to)...)
			}
		}
	}
	t.Step("return dist", fmt.Sprintf("Queue empty. Shortest costs from A: A=0, C=%d, B=%d, D=%d, E=%d. Note B is reached via C (2+1=3), not the direct edge (4).", dist["C"], dist["B"], dist["D"], dist["E"]), "solution", nil, views("", "")...)
	t.Save("dijkstra")
}

// ---- binary search -----------------------------------------------------

func bsMarks(n, lo, hi, mid int, half string) M {
	m := M{}
	for i := 0; i < n; i++ {
		if i < lo || i > hi {
			m[fmt.Sprint(i)] = "dim"
		}
	}
	if mid >= 0 && mid < n {
		m[fmt.Sprint(mid)] = "hot"
	}
	return m
}

func genLowerBound() {
	code := `
func lowerBound(nums []int, target int) int {
	lo, hi := 0, len(nums) // answer is in [lo, hi]
	for lo < hi {
		mid := lo + (hi-lo)/2
		if nums[mid] < target {
			lo = mid + 1 // everything up to mid is too small
		} else {
			hi = mid // mid could be the answer: keep it
		}
	}
	return lo
}`
	t := New("lowerBound([1,3,3,3,5,8,9], 3): first index with value ≥ 3", code)
	nums := []int{1, 3, 3, 3, 5, 8, 9}
	target := 3
	lo, hi := 0, len(nums)
	v := func(mid int) M {
		m := M{}
		for i := range nums {
			if i < lo || i >= hi {
				m[fmt.Sprint(i)] = "dim"
			}
		}
		if mid >= 0 {
			m[fmt.Sprint(mid)] = "hot"
		}
		p := M{"lo": lo}
		if hi < len(nums) {
			p["hi"] = hi
		} else {
			p["hi"] = len(nums) - 1
		}
		return arr("nums (faded = ruled out)", nums, p, m)
	}
	t.Step("lo, hi := 0, len(nums)", "Find the FIRST 3, even though there are three of them. hi starts one past the end because the answer can be 'after everything'. Invariant: the answer is always inside [lo, hi].", "neutral", M{"lo": lo, "hi": hi, "target": target}, v(-1))
	for lo < hi {
		mid := lo + (hi-lo)/2
		if nums[mid] < target {
			t.Step("if nums[mid] < target", fmt.Sprintf("mid=%d, nums[mid]=%d < %d: mid and everything left of it is too small. lo = mid+1 = %d.", mid, nums[mid], target, mid+1), "problem", M{"lo": lo, "hi": hi, "mid": mid}, v(mid))
			lo = mid + 1
		} else {
			t.Step("hi = mid", fmt.Sprintf("mid=%d, nums[mid]=%d ≥ %d: mid could be the FIRST one, so keep it. hi = mid (not mid−1).", mid, nums[mid], target), "solution", M{"lo": lo, "hi": hi, "mid": mid}, v(mid))
			hi = mid
		}
	}
	t.Step("return lo", fmt.Sprintf("lo == hi == %d. That is the first index with value ≥ %d. If the value were missing it would be the insert position.", lo, target), "solution", M{"lo": lo, "hi": hi}, v(lo))
	t.Save("lowerbound")
}

func genRotatedSearch() {
	code := `
func searchRotated(nums []int, target int) int {
	lo, hi := 0, len(nums)-1
	for lo <= hi {
		mid := lo + (hi-lo)/2
		if nums[mid] == target {
			return mid
		}
		if nums[lo] <= nums[mid] { // left half is sorted
			if nums[lo] <= target && target < nums[mid] {
				hi = mid - 1
			} else {
				lo = mid + 1
			}
		} else { // right half is sorted
			if nums[mid] < target && target <= nums[hi] {
				lo = mid + 1
			} else {
				hi = mid - 1
			}
		}
	}
	return -1
}`
	t := New("searchRotated([4,5,6,7,0,1,2], 0): one half is always sorted", code)
	nums := []int{4, 5, 6, 7, 0, 1, 2}
	target := 0
	lo, hi := 0, len(nums)-1
	v := func(mid int, sortedL, sortedR int) M {
		m := M{}
		for i := range nums {
			if i < lo || i > hi {
				m[fmt.Sprint(i)] = "dim"
			}
		}
		for i := sortedL; i <= sortedR && sortedL >= 0; i++ {
			m[fmt.Sprint(i)] = "win"
		}
		if mid >= 0 {
			m[fmt.Sprint(mid)] = "hot"
		}
		return arr("nums (light = the half we know is sorted)", nums, M{"lo": lo, "mid": mid, "hi": hi}, m)
	}
	t.Step("lo, hi :=", "A sorted array was rotated, so it is two sorted runs glued together. Plain binary search breaks, but at any mid at least ONE side is a clean sorted run.", "neutral", M{"lo": lo, "hi": hi, "target": target}, v(-1, -1, -1))
	for lo <= hi {
		mid := lo + (hi-lo)/2
		if nums[mid] == target {
			t.Step("return mid", fmt.Sprintf("nums[%d] = %d is the target. Found.", mid, target), "solution", M{"lo": lo, "mid": mid, "hi": hi}, v(mid, -1, -1))
			t.Save("rotatedsearch")
			return
		}
		if nums[lo] <= nums[mid] {
			t.Step("if nums[lo] <= nums[mid]", fmt.Sprintf("nums[%d]=%d ≤ nums[%d]=%d: the LEFT half [%d..%d] is sorted.", lo, nums[lo], mid, nums[mid], lo, mid), "neutral", M{"lo": lo, "mid": mid, "hi": hi}, v(mid, lo, mid))
			if nums[lo] <= target && target < nums[mid] {
				t.Step("hi = mid - 1", fmt.Sprintf("%d fits inside the sorted left run [%d, %d), so it can only be there. Discard the right side.", target, nums[lo], nums[mid]), "solution", M{"lo": lo, "mid": mid, "hi": hi}, v(mid, lo, mid))
				hi = mid - 1
			} else {
				t.Step("lo = mid + 1", fmt.Sprintf("%d is outside the sorted left run, so it must be on the right. Discard the left side.", target), "solution", M{"lo": lo, "mid": mid, "hi": hi}, v(mid, lo, mid))
				lo = mid + 1
			}
		} else {
			t.Step("} else { // right half", fmt.Sprintf("nums[%d]=%d > nums[%d]=%d: the rotation point is on the left, so the RIGHT half [%d..%d] is sorted.", lo, nums[lo], mid, nums[mid], mid, hi), "neutral", M{"lo": lo, "mid": mid, "hi": hi}, v(mid, mid, hi))
			if nums[mid] < target && target <= nums[hi] {
				t.Step("lo = mid + 1", fmt.Sprintf("%d fits inside the sorted right run (%d, %d], so search there.", target, nums[mid], nums[hi]), "solution", M{"lo": lo, "mid": mid, "hi": hi}, v(mid, mid, hi))
				lo = mid + 1
			} else {
				t.Step("hi = mid - 1", fmt.Sprintf("%d is outside the sorted right run, so it must be on the left.", target), "solution", M{"lo": lo, "mid": mid, "hi": hi}, v(mid, mid, hi))
				hi = mid - 1
			}
		}
	}
	t.Save("rotatedsearch")
}
