// Package main generates the step-by-step frames for <AlgoTrace> by running
// the real algorithm with instrumentation. The MDX never hand-types state.
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

type M = map[string]any

// Trace collects frames for one algorithm. code is the clean listing shown to
// the reader; line() finds a marker substring in it so frames point at the
// right line even if the listing is edited.
type Trace struct {
	Title  string  `json:"title"`
	Code   string  `json:"code"`
	Frames []M     `json:"frames"`
	Nodes  []M     `json:"nodes,omitempty"`
	Edges  [][]any `json:"edges,omitempty"`
	lines  []string
}

func New(title, code string) *Trace {
	code = strings.Trim(code, "\n")
	return &Trace{Title: title, Code: code, lines: strings.Split(code, "\n")}
}

func (t *Trace) line(marker string) int {
	for i, l := range t.lines {
		if strings.Contains(l, marker) {
			return i + 1
		}
	}
	panic("marker not in listing: " + marker)
}

// Step records one frame.
func (t *Trace) Step(marker, note, beat string, vars M, views ...M) {
	fr := M{"note": note, "line": t.line(marker), "views": views}
	if beat != "" {
		fr["beat"] = beat
	}
	if len(vars) > 0 {
		fr["vars"] = vars
	}
	t.Frames = append(t.Frames, fr)
}

func (t *Trace) Save(name string) {
	b, err := json.Marshal(t)
	if err != nil {
		panic(err)
	}
	if err := os.MkdirAll("out", 0o755); err != nil {
		panic(err)
	}
	if err := os.WriteFile("out/"+name+".json", b, 0o644); err != nil {
		panic(err)
	}
	fmt.Printf("%-14s %2d frames\n", name, len(t.Frames))
}

func cp[T any](s []T) []T { return append([]T(nil), s...) }
