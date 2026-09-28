package main

import (
	"fmt"
	"sort"
)

func genLongestUnique() {
	code := `
func lengthOfLongestSubstring(s string) int {
	var count [128]int
	best, left := 0, 0
	for right, ch := range s {
		c := int(ch)
		count[c]++
		for count[c] > 1 {
			count[int(s[left])]--
			left++
		}
		if w := right - left + 1; w > best {
			best = w
		}
	}
	return best
}`
	s := "abcabcbb"
	t := New(`lengthOfLongestSubstring("abcabcbb"): a window that never holds a repeat`, code)
	var count [128]int
	best, left := 0, 0
	chars := []any{}
	for _, c := range s {
		chars = append(chars, string(c))
	}
	win := func(right int) M {
		m := M{}
		for i := 0; i < len(s); i++ {
			if i >= left && i <= right {
				m[fmt.Sprint(i)] = "win"
			}
		}
		if right >= 0 {
			m[fmt.Sprint(right)] = "hot"
		}
		return m
	}
	cm := func(hot any) M {
		var e []any
		for c := 0; c < 128; c++ {
			if count[c] > 0 {
				e = append(e, []any{string(rune(c)), count[c]})
			}
		}
		return M{"k": "map", "label": "count  (letters currently inside the window)", "entries": e, "hot": hot}
	}
	t.Step("var count [128]int", "The window s[left..right] must never contain a repeated letter. count tells us which letters are inside it right now. right only moves forward; left only moves forward too, so each letter is added and removed at most once: O(n).", "neutral", nil, arr("s", chars, nil, nil), cm(nil))
	for right, ch := range s {
		c := int(ch)
		count[c]++
		bad := count[c] > 1
		note := fmt.Sprintf("right=%d: add '%c' to the window. ", right, ch)
		beat := "neutral"
		if bad {
			note += fmt.Sprintf("Its count is now 2: a duplicate! Shrink from the left until it is 1 again.")
			beat = "problem"
		} else {
			note += "No duplicate."
		}
		t.Step("count[c]++", note, beat, M{"left": left, "right": right, "best": best}, arr("s (light = current window)", chars, M{"left": left, "right": right}, win(right)), cm(string(ch)))
		for count[c] > 1 {
			out := s[left]
			count[int(out)]--
			left++
			t.Step("count[int(s[left])]--", fmt.Sprintf("Drop '%c' from the left and move left to %d. count['%c'] is now %d.", out, left, ch, count[c]), "solution", M{"left": left, "right": right, "best": best}, arr("s", chars, M{"left": left, "right": right}, win(right)), cm(string(ch)))
		}
		if w := right - left + 1; w > best {
			best = w
			t.Step("best = w", fmt.Sprintf("Window %q has width %d, a new best.", s[left:right+1], w), "solution", M{"left": left, "right": right, "best": best}, arr("s", chars, M{"left": left, "right": right}, win(right)), cm(nil))
		}
	}
	t.Step("return best", fmt.Sprintf("best = %d (\"abc\", and later \"bca\", \"cab\" tie it). The window slid across the string once.", best), "solution", M{"best": best}, arr("s", chars, nil, nil), cm(nil))
	t.Save("longestunique")
}

func genTopKFreq() {
	code := `
func topKFrequent(nums []int, k int) []int {
	freq := map[int]int{}
	for _, x := range nums {
		freq[x]++
	}
	h := &MinHeap{} // (value, count), ordered by count
	for v, c := range freq {
		heap.Push(h, pair{v, c})
		if h.Len() > k {
			heap.Pop(h) // drop the least frequent
		}
	}
	out := make([]int, 0, k)
	for h.Len() > 0 {
		out = append(out, heap.Pop(h).(pair).val)
	}
	return out
}`
	nums := []int{1, 1, 1, 2, 2, 3, 4, 4, 4, 4}
	k := 2
	t := New("topKFrequent([1,1,1,2,2,3,4,4,4,4], k=2): count first, then a size-k heap", code)
	freq := map[int]int{}
	var order []int
	fv := func(hot any) M {
		var e []any
		for _, v := range order {
			e = append(e, []any{v, freq[v]})
		}
		return M{"k": "map", "label": "freq  (value → how often)", "entries": e, "hot": hot}
	}
	t.Step("freq := map[int]int{}", "Two phases. Phase 1: count every value in one pass. Phase 2: keep only the k most frequent, using a min-heap ordered by COUNT so the least frequent keeper sits at the root.", "neutral", M{"k": k}, arr("nums", nums, nil, nil), fv(nil))
	for i, x := range nums {
		if _, ok := freq[x]; !ok {
			order = append(order, x)
		}
		freq[x]++
		if i == 2 || i == len(nums)-1 || i == 4 || i == 5 {
			t.Step("freq[x]++", fmt.Sprintf("After reading nums[0..%d]: counts so far shown in the map.", i), "neutral", M{"i": i}, arr("nums", nums, M{"i": i}, mm(i, "hot")), fv(x))
		}
	}
	sort.Ints(order)
	type pr struct{ v, c int }
	var h []pr
	hv := func() M {
		var it []any
		sort.Slice(h, func(a, b int) bool { return h[a].c < h[b].c })
		for _, p := range h {
			it = append(it, fmt.Sprintf("%d ×%d", p.v, p.c))
		}
		return M{"k": "queue", "label": "min-heap by count (front = least frequent keeper)", "items": it}
	}
	for _, v := range order {
		h = append(h, pr{v, freq[v]})
		t.Step("heap.Push(h, pair{v, c})", fmt.Sprintf("Push value %d (count %d).", v, freq[v]), "neutral", M{"v": v}, fv(v), hv())
		if len(h) > k {
			sort.Slice(h, func(a, b int) bool { return h[a].c < h[b].c })
			gone := h[0]
			h = h[1:]
			t.Step("heap.Pop(h)", fmt.Sprintf("Heap holds more than k=%d: pop the least frequent, value %d (count %d). It cannot be in the top %d.", k, gone.v, gone.c, k), "problem", M{"v": v}, fv(gone.v), hv())
		}
	}
	var res []int
	for _, p := range h {
		res = append(res, p.v)
	}
	t.Step("return out", fmt.Sprintf("The heap now holds the %d most frequent values: %v (value 4 ×4 and value 1 ×3). O(n log k), with the heap never bigger than k+1.", k, res), "solution", nil, fv(nil), hv())
	t.Save("topkfreq")
}
