package main

import "fmt"

func genBatchShed() {
	code := `
func (b *Batcher) Add(span Span) error {
	if b.memory.Usage() > b.limit { // 82% of the heap budget
		return ErrRefused // shed load: tell the sender to back off (HTTP 429)
	}
	b.mu.Lock()
	b.buf = append(b.buf, span)
	full := len(b.buf) >= b.maxSize // trigger 1: the batch is big enough
	b.mu.Unlock()
	if full {
		b.flush()
	}
	return nil
}

func (b *Batcher) run() {
	for range time.Tick(b.every) { // trigger 2: the timer, whichever comes first
		b.flush() // send whatever has accumulated
	}
}`
	t := New("Batching with two flush triggers, and what happens when the exporter stalls (simplified model)", code)
	const (
		perTick  = 400 // spans arriving per 200 ms tick (2,000 spans/s)
		maxSize  = 8192
		base     = 40 // % heap used by the collector itself
		perBatch = 7  // % heap held by one unsent batch (model number)
		limit    = 82
	)
	buf, queued, dropped := 0, 0, 0
	stalled := false
	var levels []any
	heap := func() int { return base + queued*perBatch }
	vars := func() M { return M{"buffer": buf, "unsent batches": queued, "heap %": heap(), "refused": dropped} }
	view := func(ptr int) []M {
		cells := cp(levels)
		if len(cells) == 0 {
			cells = []any{"·"}
		}
		return []M{arr("spans in the buffer, per 200 ms tick (or 'flush' / 'queued' / '429')", cells, M{"now": len(cells) - 1}, nil)}
	}
	t.Step("func (b *Batcher) Add(", fmt.Sprintf("Spans arrive at 2,000 a second, 400 per 200 ms tick. Two things can send a batch: the buffer reaching %d spans, or the timer firing, whichever comes first. The exporter is healthy.", maxSize), "neutral", vars(), view(0)...)
	for tick := 1; tick <= 3; tick++ {
		buf += perTick
		levels = append(levels, fmt.Sprintf("%d", buf))
		t.Step("b.buf = append(b.buf, span)", fmt.Sprintf("Tick %d: 400 more spans. The buffer holds %d, far below %d, so the size trigger is nowhere near.", tick, buf, maxSize), "neutral", vars(), view(0)...)
	}
	t.Step("for range time.Tick(b.every) {", fmt.Sprintf("The 200 ms timer fires. The size limit is still a long way off, but waiting for it would hold spans for %.1f more seconds. The timer trigger flushes %d spans now, bounding how stale the data can get.", float64(maxSize-buf)/2000, buf), "solution", vars(), view(0)...)
	levels = append(levels, "flush")
	buf = 0
	t.Step("b.flush() // send whatever", "Flushed: the batch goes to the exporter in one network call instead of hundreds of tiny ones. This is what batching buys. The buffer is empty again.", "solution", vars(), view(0)...)
	stalled = true
	t.Step("b.flush() // send whatever", "Now the downstream store (ClickHouse, in the chapter's setup) slows down. The exporter's connections all block, so a flushed batch can't leave the process.", "problem", vars(), view(0)...)
	for tick := 0; heap() < limit; tick++ {
		queued++
		levels = append(levels, "queued")
		t.Step("b.flush() // send whatever", fmt.Sprintf("Batch %d can't be sent and stays in memory. The timer keeps firing and spans keep arriving, so every 200 ms another batch joins the queue. Heap is now %d%% (model: each unsent batch holds about %d%%).", queued, heap(), perBatch), "problem", vars(), view(0)...)
	}
	_ = stalled
	t.Step("if b.memory.Usage() > b.limit {", fmt.Sprintf("Heap reached %d%%, over the %d%% ceiling. The memory limiter, first in the pipeline, now refuses new spans BEFORE they are parsed, redacted or buffered.", heap(), limit), "problem", vars(), view(0)...)
	dropped += perTick
	levels = append(levels, "429")
	t.Step("return ErrRefused", "Incoming spans get 429 Too Many Requests. It hurts, and it is deliberate: senders back off and retry, while the collector stays alive. The alternative is to keep buffering until the kernel kills the process, which drops EVERYTHING in memory, not just the overflow.", "solution", vars(), view(0)...)
	t.Save("batchshed")
}
