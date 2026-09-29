package main

import "fmt"

func genWasmMem() {
	code := `
inputPtr := mem.GuestMalloc(uint32(len(payload)))         // 1. reserve room inside the guest's memory
mem.Write(inputPtr, payload)                              // 2. copy the request in
packed := guest.EvaluateRisk(inputPtr, uint32(len(payload))) // 3. call the guest with (offset, length)
resPtr, resLen := UnpackPtrLen(packed)                    // 4. split the single 64-bit return value
verdict, _ := mem.Read(resPtr, resLen)                    // 5. copy the answer out of guest memory`
	t := New(`Host ↔ guest through linear memory: pointers are just offsets into one byte array`, code)
	const base = 16
	payload := `{"amt":900}`
	mem := make([]any, 32)
	for i := range mem {
		mem[i] = "·"
	}
	next := base // the guest allocator's bump pointer
	view := func(ptrs M, marks M) M {
		return arr("guest linear memory (offsets 0 to 31; · = unused)", cp(mem), ptrs, marks)
	}
	rng := func(a, n int, m string) M {
		mk := M{}
		for i := a; i < a+n; i++ {
			mk[fmt.Sprint(i)] = m
		}
		return mk
	}
	t.Step("inputPtr := mem.GuestMalloc(", "Wasm gives the module one flat array of bytes: its linear memory. The host can't hand the guest a Go string; it can only copy bytes into that array and pass a number: an offset. The guest's allocator hands out space from offset 16.", "neutral", M{"next free": next}, view(M{"next": next}, nil))
	inputPtr := next
	next += len(payload)
	t.Step("inputPtr := mem.GuestMalloc(", fmt.Sprintf("GuestMalloc(%d) reserves %d bytes and returns the offset %d. No data is there yet: the host now owns those bytes for the length of the call.", len(payload), len(payload), inputPtr), "neutral", M{"inputPtr": inputPtr, "len": len(payload)}, view(M{"inputPtr": inputPtr, "next": next}, rng(inputPtr, len(payload), "hot")))
	for i, c := range payload {
		mem[inputPtr+i] = string(c)
	}
	t.Step("mem.Write(inputPtr, payload)", fmt.Sprintf("The host copies the JSON bytes into memory at offset %d. This is the one copy on the way in.", inputPtr), "solution", M{"inputPtr": inputPtr}, view(M{"inputPtr": inputPtr, "next": next}, rng(inputPtr, len(payload), "win")))
	t.Step("packed := guest.EvaluateRisk(", fmt.Sprintf("The host calls the guest's exported function with two plain integers: (%d, %d). A Wasm function can only take and return numbers, so a pointer and a length are all the guest receives. It reads its own memory at %d for %d bytes.", inputPtr, len(payload), inputPtr, len(payload)), "neutral", M{"arg ptr": inputPtr, "arg len": len(payload)}, view(M{"inputPtr": inputPtr}, rng(inputPtr, len(payload), "win")))
	verdict := "HOLD"
	resPtr := next
	next += len(verdict)
	for i, c := range verdict {
		mem[resPtr+i] = string(c)
	}
	t.Step("packed := guest.EvaluateRisk(", fmt.Sprintf("The guest parses the request (amount 900 is over its limit), allocates %d bytes of its own at offset %d, and writes the verdict %q there.", len(verdict), resPtr, verdict), "neutral", M{"resPtr": resPtr, "resLen": len(verdict)}, view(M{"inputPtr": inputPtr, "resPtr": resPtr}, mm(resPtr, "good", resPtr+1, "good", resPtr+2, "good", resPtr+3, "good")))
	packed := uint64(resPtr)<<32 | uint64(len(verdict))
	t.Step("packed := guest.EvaluateRisk(", fmt.Sprintf("A function can return only one number, so the guest packs both into a single 64-bit integer: (%d << 32) | %d = %d, in hex 0x%016X. High 32 bits: where. Low 32 bits: how long.", resPtr, len(verdict), packed, packed), "solution", M{"packed": fmt.Sprintf("0x%016X", packed)}, view(M{"resPtr": resPtr}, rng(resPtr, len(verdict), "good")), M{"k": "bits", "label": "the returned uint64, top 32 bits and bottom 32 bits shown as their two halves", "rows": []M{{"label": "ptr  = high", "value": resPtr, "width": 8}, {"label": "len  = low", "value": len(verdict), "width": 8}}})
	t.Step("resPtr, resLen := UnpackPtrLen(packed)", fmt.Sprintf("The host takes them apart again: packed >> 32 = %d, packed & 0xFFFFFFFF = %d.", packed>>32, packed&0xFFFFFFFF), "neutral", M{"resPtr": packed >> 32, "resLen": packed & 0xFFFFFFFF}, view(M{"resPtr": resPtr}, rng(resPtr, len(verdict), "good")))
	t.Step("verdict, _ := mem.Read(resPtr, resLen)", fmt.Sprintf("One read copies %d bytes out of guest memory: %q. Two copies in total, one in and one out, and no serialization layer between the languages. (A real module also exports a free function so the host can release both buffers.)", len(verdict), verdict), "solution", M{"verdict": verdict}, view(M{"resPtr": resPtr}, rng(resPtr, len(verdict), "good")))
	t.Save("wasmmem")
}
