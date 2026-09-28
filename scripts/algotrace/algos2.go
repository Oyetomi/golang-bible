package main

import (
	"fmt"
	"slices"
	"strings"
)

// marksFor builds a marks map from index lists.
func mm(pairs ...any) M {
	m := M{}
	for i := 0; i+1 < len(pairs); i += 2 {
		m[fmt.Sprint(pairs[i])] = pairs[i+1]
	}
	return m
}

func genDutch() {
	code := `
func sortColors(nums []int) {
	lo, mid, hi := 0, 0, len(nums)-1
	for mid <= hi {
		switch nums[mid] {
		case 0:
			nums[lo], nums[mid] = nums[mid], nums[lo]
			lo++
			mid++
		case 1:
			mid++
		case 2:
			nums[mid], nums[hi] = nums[hi], nums[mid]
			hi--
		}
	}
}`
	t := New("sortColors([2,0,2,1,1,0]): three regions, one pass", code)
	nums := []int{2, 0, 2, 1, 1, 0}
	lo, mid, hi := 0, 0, len(nums)-1
	view := func() M {
		marks := M{}
		for i := range nums {
			switch {
			case i < lo:
				marks[fmt.Sprint(i)] = "good"
			case i < mid:
				marks[fmt.Sprint(i)] = "win"
			case i > hi:
				marks[fmt.Sprint(i)] = "dim"
			}
		}
		if mid <= hi {
			marks[fmt.Sprint(mid)] = "hot"
		}
		ptrs := M{"lo": lo, "mid": mid}
		if hi >= 0 {
			ptrs["hi"] = hi
		}
		return arr("nums   (green = 0s done · light = 1s · faded = 2s done · yellow = unknown)", cp(nums), ptrs, marks)
	}
	t.Step("lo, mid, hi :=", "Three walls split the array: everything before lo is 0, between lo and mid is 1, after hi is 2. mid scans the unknown middle.", "neutral", M{"lo": lo, "mid": mid, "hi": hi}, view())
	for mid <= hi {
		switch nums[mid] {
		case 0:
			nums[lo], nums[mid] = nums[mid], nums[lo]
			lo++
			mid++
			t.Step("case 0:", fmt.Sprintf("nums[mid] was 0: swap it to the front region, then grow both lo and mid. (What we swapped back is a 1 or the same 0, so mid can safely move on.)"), "solution", M{"lo": lo, "mid": mid, "hi": hi}, view())
		case 1:
			mid++
			t.Step("case 1:", "nums[mid] is 1: it already belongs in the middle region. Just advance mid.", "neutral", M{"lo": lo, "mid": mid, "hi": hi}, view())
		case 2:
			nums[mid], nums[hi] = nums[hi], nums[mid]
			hi--
			t.Step("case 2:", "nums[mid] is 2: swap it to the back and shrink hi. Do NOT advance mid: the value we just pulled from the back is still unknown.", "problem", M{"lo": lo, "mid": mid, "hi": hi}, view())
		}
	}
	t.Step("for mid <= hi", "mid passed hi: no unknown cells remain. Sorted in one pass, O(n) time, O(1) space.", "solution", M{"lo": lo, "mid": mid, "hi": hi}, view())
	t.Save("dutch")
}

func genRotate() {
	code := `
func rotate(nums []int, k int) {
	k %= len(nums)
	slices.Reverse(nums)     // 1. reverse everything
	slices.Reverse(nums[:k]) // 2. reverse the first k
	slices.Reverse(nums[k:]) // 3. reverse the rest
}`
	t := New("rotate([1..7], k=3): three reversals", code)
	nums := []int{1, 2, 3, 4, 5, 6, 7}
	k := 3
	rng := func(a, b int, m string) M {
		mk := M{}
		for i := a; i < b; i++ {
			mk[fmt.Sprint(i)] = m
		}
		return mk
	}
	t.Step("k %= len(nums)", "Goal: rotate right by 3, so [1 2 3 4 5 6 7] becomes [5 6 7 1 2 3 4]. Three reversals do it with no extra array.", "neutral", M{"k": k}, arr("nums", cp(nums), nil, nil))
	slices.Reverse(nums)
	t.Step("slices.Reverse(nums)     //", "Reverse the whole array. The last 3 elements (5 6 7) are now at the front, but backwards, and the rest is backwards too.", "neutral", M{"k": k}, arr("nums", cp(nums), nil, rng(0, 7, "hot")))
	slices.Reverse(nums[:k])
	t.Step("slices.Reverse(nums[:k])", "Reverse the first k=3 cells: 7 6 5 becomes 5 6 7, the correct order.", "solution", M{"k": k}, arr("nums", cp(nums), nil, rng(0, k, "good")))
	slices.Reverse(nums[k:])
	t.Step("slices.Reverse(nums[k:])", "Reverse the remaining 4 cells: 4 3 2 1 becomes 1 2 3 4. Done: [5 6 7 1 2 3 4], O(n) time and O(1) extra space.", "solution", M{"k": k}, arr("nums", cp(nums), nil, mm(0, "good", 1, "good", 2, "good", 3, "good", 4, "good", 5, "good", 6, "good")))
	t.Save("rotate")
}

func genPrefixK() {
	code := `
func subarraySum(nums []int, k int) int {
	count := 0
	sum := 0
	seen := map[int]int{0: 1} // prefix sum -> how many times seen
	for _, x := range nums {
		sum += x
		count += seen[sum-k] // subarrays ending here that total k
		seen[sum]++
	}
	return count
}`
	t := New("subarraySum([3,4,7,2,-3,1,4,2], k=7): prefix sums in a map", code)
	nums := []int{3, 4, 7, 2, -3, 1, 4, 2}
	k := 7
	count, sum := 0, 0
	seen := map[int]int{0: 1}
	order := []int{0}
	mv := func(hot any) M {
		var e []any
		for _, p := range order {
			e = append(e, []any{p, seen[p]})
		}
		return M{"k": "map", "label": "seen  (prefix sum → times seen)", "entries": e, "hot": hot}
	}
	t.Step("seen := map", "A prefix sum is the running total. If the total now is S and an earlier total was S−7, then everything in between adds up to 7. The map remembers earlier totals. Seed it with 0 (the empty prefix).", "neutral",
		M{"k": k, "sum": 0, "count": 0}, arr("nums", nums, nil, nil), mv(0))
	for i, x := range nums {
		sum += x
		need := sum - k
		add := seen[need]
		count += add
		note := fmt.Sprintf("sum = %d. Look for an earlier prefix of %d − %d = %d. ", sum, sum, k, need)
		beat := "neutral"
		if add > 0 {
			note += fmt.Sprintf("Seen %d time(s), so %d subarray(s) ending at index %d total 7. count = %d.", add, add, i, count)
			beat = "solution"
		} else {
			note += "Never seen: no subarray ending here totals 7."
		}
		t.Step("count += seen[sum-k]", note, beat, M{"i": i, "x": x, "sum": sum, "need": need, "count": count},
			arr("nums", nums, M{"i": i}, M{fmt.Sprint(i): "hot"}), mv(need))
		if _, ok := seen[sum]; !ok {
			order = append(order, sum)
		}
		seen[sum]++
		t.Step("seen[sum]++", fmt.Sprintf("Record prefix %d for later elements to find.", sum), "neutral",
			M{"i": i, "sum": sum, "count": count}, arr("nums", nums, M{"i": i}, M{fmt.Sprint(i): "dim"}), mv(sum))
	}
	t.Step("return count", fmt.Sprintf("Answer: %d subarrays sum to 7. One pass, O(n) — no nested loop over every start/end pair.", count), "solution",
		M{"count": count}, arr("nums", nums, nil, nil), mv(nil))
	t.Save("prefixk")
}

func genRemoveDup() {
	code := `
func removeDuplicates(nums []int) int {
	slow := 1
	for fast := 1; fast < len(nums); fast++ {
		if nums[fast] != nums[fast-1] {
			nums[slow] = nums[fast]
			slow++
		}
	}
	return slow
}`
	t := New("removeDuplicates([1,1,2,2,2,3,4,4]): slow writes, fast reads", code)
	nums := []int{1, 1, 2, 2, 2, 3, 4, 4}
	slow := 1
	view := func(fast int) M {
		marks := M{}
		for i := 0; i < slow; i++ {
			marks[fmt.Sprint(i)] = "good"
		}
		if fast < len(nums) {
			marks[fmt.Sprint(fast)] = "hot"
		}
		return arr("nums (green = the unique prefix built so far)", cp(nums), M{"slow": slow, "fast": fast}, marks)
	}
	t.Step("slow := 1", "The array is sorted, so duplicates sit together. slow marks where the next unique value should be written; fast scouts ahead. nums[0] is unique by definition.", "neutral", M{"slow": slow}, view(1))
	for fast := 1; fast < len(nums); fast++ {
		if nums[fast] != nums[fast-1] {
			t.Step("if nums[fast] != nums[fast-1]", fmt.Sprintf("nums[%d]=%d differs from nums[%d]=%d: a new value.", fast, nums[fast], fast-1, nums[fast-1]), "solution", M{"slow": slow, "fast": fast}, view(fast))
			nums[slow] = nums[fast]
			slow++
			t.Step("slow++", fmt.Sprintf("Copy it to position slow and move slow forward. The unique prefix is now %v.", nums[:slow]), "solution", M{"slow": slow, "fast": fast}, view(fast))
		} else {
			t.Step("if nums[fast] != nums[fast-1]", fmt.Sprintf("nums[%d]=%d equals its left neighbour: a duplicate. Skip it; slow stays put.", fast, nums[fast]), "problem", M{"slow": slow, "fast": fast}, view(fast))
		}
	}
	t.Step("return slow", fmt.Sprintf("Return slow=%d: the first %d cells hold the unique values %v, in place, with O(1) extra memory.", slow, slow, nums[:slow]), "solution", M{"slow": slow}, view(len(nums)))
	t.Save("removedup")
}

// ---- ch3 ---------------------------------------------------------------

func genAnagram() {
	code := `
func isAnagram(s, t string) bool {
	if len(s) != len(t) {
		return false
	}
	freq := map[rune]int{}
	for _, c := range s {
		freq[c]++
	}
	for _, c := range t {
		freq[c]--
		if freq[c] < 0 {
			return false // t has a letter s cannot supply
		}
	}
	return true
}`
	s, tt := "aabc", "abcc"
	t := New(fmt.Sprintf("isAnagram(%q, %q): count up with s, count down with t", s, tt), code)
	freq := map[rune]int{}
	var order []rune
	mv := func(hot any) M {
		var e []any
		for _, r := range order {
			e = append(e, []any{string(r), freq[r]})
		}
		return M{"k": "map", "label": "freq  (letter → count)", "entries": e, "hot": hot}
	}
	cells := func(str string) []any {
		var c []any
		for _, r := range str {
			c = append(c, string(r))
		}
		return c
	}
	t.Step("freq := map", "Same length, so the counts can only balance if every letter appears equally often. Count s upward, then count t downward.", "neutral", nil, arr("s", cells(s), nil, nil), arr("t", cells(tt), nil, nil), mv(nil))
	for i, c := range s {
		if _, ok := freq[c]; !ok {
			order = append(order, c)
		}
		freq[c]++
		t.Step("freq[c]++", fmt.Sprintf("s[%d]='%c': count of '%c' is now %d.", i, c, c, freq[c]), "neutral", M{"c": string(c)}, arr("s", cells(s), M{"i": i}, M{fmt.Sprint(i): "hot"}), arr("t", cells(tt), nil, nil), mv(string(c)))
	}
	for i, c := range tt {
		freq[c]--
		bad := freq[c] < 0
		beat := "neutral"
		note := fmt.Sprintf("t[%d]='%c': use up one '%c'. Count is now %d.", i, c, c, freq[c])
		mk := M{fmt.Sprint(i): "hot"}
		if bad {
			note = fmt.Sprintf("t[%d]='%c': count drops to %d, below zero. t has more '%c's than s can supply, so they are NOT anagrams. Return false early.", i, c, freq[c], c)
			beat = "problem"
			mk = M{fmt.Sprint(i): "bad"}
		}
		t.Step("freq[c]--", note, beat, M{"c": string(c)}, arr("s", cells(s), nil, nil), arr("t", cells(tt), M{"i": i}, mk), mv(string(c)))
		if bad {
			break
		}
	}
	t.Save("anagram")
}

func genGroupAnagrams() {
	code := `
func groupAnagrams(words []string) [][]string {
	groups := map[string][]string{}
	for _, w := range words {
		b := []byte(w)
		slices.Sort(b)
		key := string(b) // anagrams share the same sorted letters
		groups[key] = append(groups[key], w)
	}
	out := make([][]string, 0, len(groups))
	for _, g := range groups {
		out = append(out, g)
	}
	return out
}`
	words := []string{"eat", "tea", "tan", "ate", "nat", "bat"}
	t := New("groupAnagrams: the sorted word is the map key", code)
	groups := map[string][]string{}
	var order []string
	mv := func(hot any) M {
		var e []any
		for _, k := range order {
			e = append(e, []any{k, fmt.Sprint(groups[k])})
		}
		return M{"k": "map", "label": "groups  (sorted letters → words)", "entries": e, "hot": hot}
	}
	t.Step("groups := map", "Two words are anagrams exactly when their letters sort to the same string. So use the sorted letters as a map key and collect words under it.", "neutral", nil, arr("words", words, nil, nil), mv(nil))
	for i, w := range words {
		b := []byte(w)
		slices.Sort(b)
		key := string(b)
		_, seen := groups[key]
		if !seen {
			order = append(order, key)
		}
		groups[key] = append(groups[key], w)
		note := fmt.Sprintf("%q sorts to %q. ", w, key)
		if seen {
			note += "That key already exists, so join its group."
		} else {
			note += "New key: start a new group."
		}
		t.Step("groups[key] = append", note, map[bool]string{true: "solution", false: "neutral"}[seen], M{"w": w, "key": key}, arr("words", words, M{"i": i}, M{fmt.Sprint(i): "hot"}), mv(key))
	}
	t.Step("return out", fmt.Sprintf("%d groups. One pass over the words; each costs a small sort. Total O(n · k log k) for words of length k.", len(groups)), "solution", nil, arr("words", words, nil, nil), mv(nil))
	t.Save("groupanagrams")
}

func genMajority() {
	code := `
func majorityElement(nums []int) int {
	candidate, count := 0, 0
	for _, x := range nums {
		if count == 0 {
			candidate = x
		}
		if x == candidate {
			count++
		} else {
			count--
		}
	}
	return candidate
}`
	t := New("majorityElement([2,2,1,1,1,2,2]): pairs of different values cancel", code)
	nums := []int{2, 2, 1, 1, 1, 2, 2}
	cand, count := 0, 0
	t.Step("candidate, count :=", "The majority element appears more than n/2 times. Idea: pair each element with a DIFFERENT one and cross both out. The majority outnumbers everything else, so it survives.", "neutral", M{"candidate": cand, "count": count}, arr("nums", nums, nil, nil))
	for i, x := range nums {
		note := ""
		if count == 0 {
			cand = x
			note = fmt.Sprintf("count was 0, so adopt %d as the new candidate. ", x)
		}
		if x == cand {
			count++
			note += fmt.Sprintf("%d matches the candidate: count up to %d.", x, count)
		} else {
			count--
			note += fmt.Sprintf("%d differs: it cancels one vote. count down to %d.", x, count)
		}
		t.Step("if x == candidate", note, map[bool]string{true: "solution", false: "problem"}[x == cand], M{"i": i, "x": x, "candidate": cand, "count": count},
			arr("nums", nums, M{"i": i}, M{fmt.Sprint(i): "hot"}))
	}
	t.Step("return candidate", fmt.Sprintf("Answer: %d. O(n) time, O(1) space, no map. (This only works because a majority is guaranteed to exist.)", cand), "solution", M{"candidate": cand, "count": count}, arr("nums", nums, nil, nil))
	t.Save("majority")
}

// ---- ch4 ---------------------------------------------------------------

func genMinStack() {
	code := `
type MinStack struct{ data, mins []int }

func (s *MinStack) Push(x int) {
	s.data = append(s.data, x)
	if len(s.mins) == 0 || x <= s.mins[len(s.mins)-1] {
		s.mins = append(s.mins, x)
	}
}

func (s *MinStack) Pop() {
	top := s.data[len(s.data)-1]
	s.data = s.data[:len(s.data)-1]
	if top == s.mins[len(s.mins)-1] {
		s.mins = s.mins[:len(s.mins)-1]
	}
}

func (s *MinStack) Min() int { return s.mins[len(s.mins)-1] }`
	t := New("MinStack: a second stack that always knows the minimum", code)
	var data, mins []int
	views := func(hot string) []M {
		ints := func(a []int) []any {
			r := []any{}
			for _, v := range a {
				r = append(r, v)
			}
			return r
		}
		return []M{
			{"k": "stack", "label": "data", "items": ints(data), "hot": hot},
			{"k": "stack", "label": "mins (top = current minimum)", "items": ints(mins)},
		}
	}
	step := func(marker, note, beat string, hot string) {
		vars := M{}
		if len(mins) > 0 {
			vars["Min()"] = mins[len(mins)-1]
		}
		t.Step(marker, note, beat, vars, views(hot)...)
	}
	step("type MinStack", "Two stacks. data holds every value. mins holds only values that were a new minimum (or tied), so its top is always the smallest value currently in data.", "neutral", "")
	push := func(x int) {
		data = append(data, x)
		if len(mins) == 0 || x <= mins[len(mins)-1] {
			mins = append(mins, x)
			step("s.mins = append(s.mins, x)", fmt.Sprintf("Push %d. It is ≤ the current minimum, so it also goes onto mins. Min() is now %d.", x, x), "solution", "push")
		} else {
			step("s.data = append(s.data, x)", fmt.Sprintf("Push %d. It is larger than the minimum %d, so mins is unchanged.", x, mins[len(mins)-1]), "neutral", "push")
		}
	}
	pop := func() {
		top := data[len(data)-1]
		data = data[:len(data)-1]
		if top == mins[len(mins)-1] {
			mins = mins[:len(mins)-1]
			step("s.mins = s.mins[:len(s.mins)-1]", fmt.Sprintf("Pop %d. It was the minimum, so pop it from mins too. The previous minimum is restored instantly.", top), "solution", "pop")
		} else {
			step("top := s.data", fmt.Sprintf("Pop %d. It was not the minimum, so mins is untouched.", top), "neutral", "pop")
		}
	}
	push(5)
	push(3)
	push(7)
	push(3)
	pop()
	pop()
	pop()
	t.Save("minstack")
}

func genRing() {
	code := `
type Ring struct {
	buf        []int
	head, size int
}

func (r *Ring) Push(x int) bool {
	if r.size == len(r.buf) {
		return false // full
	}
	r.buf[(r.head+r.size)%len(r.buf)] = x
	r.size++
	return true
}

func (r *Ring) Pop() (int, bool) {
	if r.size == 0 {
		return 0, false
	}
	x := r.buf[r.head]
	r.head = (r.head + 1) % len(r.buf)
	r.size--
	return x, true
}`
	t := New("Ring buffer of capacity 4: head chases tail around a circle", code)
	buf := []any{"·", "·", "·", "·"}
	head, size := 0, 0
	view := func(hot int) M {
		marks := M{}
		for i := 0; i < size; i++ {
			marks[fmt.Sprint((head+i)%4)] = "win"
		}
		if hot >= 0 {
			marks[fmt.Sprint(hot)] = "hot"
		}
		ptrs := M{"head": head}
		if size < 4 {
			ptrs["tail"] = (head + size) % 4
		}
		return arr("buf  (· = empty; tail is where the NEXT push lands)", cp(buf), ptrs, marks)
	}
	t.Step("type Ring", "Four fixed slots. head is the oldest item; the next write goes at (head+size) mod 4. No shifting, ever: that is why it beats slice-based queues.", "neutral", M{"head": head, "size": size}, view(-1))
	push := func(x int) {
		if size == 4 {
			t.Step("return false // full", fmt.Sprintf("Push %d: size == capacity, so the buffer refuses. (A slice queue would silently grow.)", x), "problem", M{"head": head, "size": size}, view(-1))
			return
		}
		at := (head + size) % 4
		buf[at] = x
		size++
		t.Step("r.buf[(r.head+r.size)%len(r.buf)] = x", fmt.Sprintf("Push %d at (head %d + size %d) mod 4 = slot %d.", x, head, size-1, at), "neutral", M{"head": head, "size": size}, view(at))
	}
	pop := func() {
		x := buf[head]
		buf[head] = "·"
		at := head
		head = (head + 1) % 4
		size--
		t.Step("r.head = (r.head + 1) % len(r.buf)", fmt.Sprintf("Pop %v from slot %d; head advances to %d. The slot is free for reuse.", x, at, head), "solution", M{"head": head, "size": size}, view(at))
	}
	push(1)
	push(2)
	push(3)
	push(4)
	push(5)
	pop()
	pop()
	push(6)
	push(7)
	t.Step("(r.head+r.size)%len", "Push 6 and 7 WRAPPED around to slots 0 and 1. The buffer is a circle: the modulo turns 4 back into 0.", "solution", M{"head": head, "size": size}, view(-1))
	t.Save("ring")
}

func genMergeSorted() {
	code := `
func mergeSorted(a, b []int) []int {
	out := make([]int, 0, len(a)+len(b))
	i, j := 0, 0
	for i < len(a) && j < len(b) {
		if a[i] <= b[j] {
			out = append(out, a[i])
			i++
		} else {
			out = append(out, b[j])
			j++
		}
	}
	out = append(out, a[i:]...)
	out = append(out, b[j:]...)
	return out
}`
	t := New("Merge two sorted lists: always take the smaller front", code)
	a, b := []int{1, 4, 6}, []int{2, 3, 7, 9}
	var out []int
	i, j := 0, 0
	views := func() []M {
		ma, mb := M{}, M{}
		for x := 0; x < i; x++ {
			ma[fmt.Sprint(x)] = "dim"
		}
		for x := 0; x < j; x++ {
			mb[fmt.Sprint(x)] = "dim"
		}
		if i < len(a) {
			ma[fmt.Sprint(i)] = "hot"
		}
		if j < len(b) {
			mb[fmt.Sprint(j)] = "hot"
		}
		o := []any{}
		for _, v := range out {
			o = append(o, v)
		}
		if len(o) == 0 {
			o = []any{"·"}
		}
		return []M{arr("a", a, M{"i": i}, ma), arr("b", b, M{"j": j}, mb), arr("out", o, nil, nil)}
	}
	t.Step("i, j := 0, 0", "Two sorted lists, one finger in each. The smaller of the two front values must be next in the merged output.", "neutral", M{"i": i, "j": j}, views()...)
	for i < len(a) && j < len(b) {
		if a[i] <= b[j] {
			out = append(out, a[i])
			t.Step("if a[i] <= b[j]", fmt.Sprintf("a[%d]=%d ≤ b[%d]=%d: take %d from a.", i, a[i], j, b[j], a[i]), "neutral", M{"i": i, "j": j}, views()...)
			i++
		} else {
			out = append(out, b[j])
			t.Step("out = append(out, b[j])", fmt.Sprintf("a[%d]=%d > b[%d]=%d: take %d from b.", i, a[i], j, b[j], b[j]), "neutral", M{"i": i, "j": j}, views()...)
			j++
		}
	}
	out = append(out, a[i:]...)
	out = append(out, b[j:]...)
	i, j = len(a), len(b)
	t.Step("out = append(out, a[i:]...)", "One list ran out. The other is already sorted, so append its remainder unchanged. Total O(len(a)+len(b)).", "solution", M{"i": i, "j": j}, views()...)
	t.Save("mergesorted")
}

var _ = strings.Join
