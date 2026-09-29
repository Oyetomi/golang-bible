package main

import "fmt"

func genSPSC() {
	code := `
type Ring struct {
	buf        [8]int
	head, tail atomic.Uint64 // head: next slot to write. tail: next slot to read.
}

func (r *Ring) Push(v int) bool {
	h := r.head.Load()
	if h-r.tail.Load() == uint64(len(r.buf)) {
		return false // full: the producer would overwrite an unread slot
	}
	r.buf[h&7] = v      // write in place: no allocation, no lock
	r.head.Store(h + 1) // publish: the consumer may now read it
	return true
}

func (r *Ring) Pop() (int, bool) {
	t := r.tail.Load()
	if t == r.head.Load() {
		return 0, false // empty
	}
	v := r.buf[t&7]
	r.tail.Store(t + 1) // free the slot for the producer
	return v, true
}`
	t := New("SPSC ring buffer, capacity 8: counters only ever go up, the mask makes them wrap", code)
	buf := make([]any, 8)
	for i := range buf {
		buf[i] = "·"
	}
	var head, tail uint64
	view := func(hot int) M {
		marks := M{}
		for s := tail; s < head; s++ {
			marks[fmt.Sprint(s&7)] = "win"
		}
		if hot >= 0 {
			marks[fmt.Sprint(hot)] = "hot"
		}
		ptrs := M{"tail slot": int(tail & 7), "head slot": int(head & 7)}
		return arr("buf  (light = written and not yet read; · = free)", cp(buf), ptrs, marks)
	}
	vars := func() M { return M{"head": head, "tail": tail, "used": head - tail} }
	t.Step("type Ring struct", "Eight slots. Two counters, head and tail, that only ever increase: they are NOT slot numbers. The slot for a counter is counter & 7, so counter 8 lands back on slot 0.", "neutral", vars(), view(-1))
	push := func(v int) {
		h := head
		if h-tail == 8 {
			t.Step("return false // full", fmt.Sprintf("Push(%d): head−tail = %d = capacity. Writing would overwrite an unread slot, so the producer is refused and must wait. No lock, no allocation: just a comparison.", v, h-tail), "problem", vars(), view(-1))
			return
		}
		slot := int(h & 7)
		buf[slot] = v
		t.Step("r.buf[h&7] = v", fmt.Sprintf("Push(%d): slot = %d & 7 = %d. The value is written in place. The consumer can't see it yet, because head hasn't moved.", v, h, slot), "neutral", vars(), view(slot))
		head = h + 1
		t.Step("r.head.Store(h + 1)", fmt.Sprintf("Publish: head becomes %d. That single atomic store is what makes the write visible to the consumer, and it happens AFTER the write, never before.", head), "solution", vars(), view(slot))
	}
	pop := func() {
		tl := tail
		if tl == head {
			t.Step("return 0, false // empty", "Pop: tail == head. Nothing to read.", "problem", vars(), view(-1))
			return
		}
		slot := int(tl & 7)
		v := buf[slot]
		buf[slot] = "·"
		tail = tl + 1
		t.Step("r.tail.Store(t + 1)", fmt.Sprintf("Pop reads %v from slot %d (%d & 7) and advances tail to %d. The slot is free for the producer to reuse immediately.", v, slot, tl, tail), "solution", vars(), view(slot))
	}
	for v := 1; v <= 6; v++ {
		push(v)
	}
	pop()
	pop()
	pop()
	for v := 7; v <= 11; v++ {
		push(v)
	}
	push(12)
	t.Step("r.head.Store(h + 1)", fmt.Sprintf("head = %d and tail = %d: the counters passed 8 while the slots wrapped. head−tail is still exactly the number of unread items (%d), which is all the full/empty checks ever need. Producer and consumer each write only their own counter, which is why no lock is needed.", head, tail, head-tail), "solution", vars(), view(-1))
	t.Save("spsc")
}
