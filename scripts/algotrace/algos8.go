package main

import (
	"fmt"
	"math/rand/v2"
	"sort"
)

type hexCell struct{ q, r int }

func hexDist(a, b hexCell) int {
	dq, dr := a.q-b.q, a.r-b.r
	return (abs(dq) + abs(dr) + abs(dq+dr)) / 2
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

func genDispatch() {
	code := `
func candidates(pickup h3.Cell, k int, online map[h3.Cell][]Driver) []Driver {
	var out []Driver
	for _, cell := range pickup.GridDisk(k) { // the cell and every cell within k steps
		out = append(out, online[cell]...)
	}
	return out
}

func dispatch(pickup h3.Cell, online map[h3.Cell][]Driver) (Driver, bool) {
	for k := 1; k <= 3; k++ { // widen the search only if the ring is empty
		c := candidates(pickup, k, online)
		if len(c) > 0 {
			return best(c, pickup), true // score by ETA, then lease atomically
		}
	}
	return Driver{}, false
}`
	t := New("Dispatch: a pickup cell, a ring of neighbours, then pick the closest driver", code)
	const R = 4
	rng := rand.New(rand.NewPCG(11, 3))
	type drv struct {
		id string
		c  hexCell
	}
	var ds []drv
	used := map[hexCell]bool{{0, 0}: true}
	for len(ds) < 16 {
		q, r := rng.IntN(2*R+1)-R, rng.IntN(2*R+1)-R
		c := hexCell{q, r}
		if hexDist(c, hexCell{}) > R || used[c] || hexDist(c, hexCell{}) < 2 {
			continue
		}
		used[c] = true
		ds = append(ds, drv{fmt.Sprintf("d%d", len(ds)+1), c})
	}
	origin := hexCell{}
	cellStates := func(k int) map[string]string {
		m := map[string]string{"0,0": "ring0"}
		for q := -R; q <= R; q++ {
			for r := -R; r <= R; r++ {
				c := hexCell{q, r}
				d := hexDist(c, origin)
				if d > R || d == 0 {
					continue
				}
				switch {
				case d <= k && d == 1:
					m[fmt.Sprintf("%d,%d", q, r)] = "ring1"
				case d <= k && d == 2:
					m[fmt.Sprintf("%d,%d", q, r)] = "ring2"
				case d <= k:
					m[fmt.Sprintf("%d,%d", q, r)] = "ring2"
				}
			}
		}
		return m
	}
	dots := func(k int, chosen string) []M {
		out := []M{{"q": 0, "r": 0, "label": "rider", "state": "rider"}}
		for _, d := range ds {
			st := "out"
			if hexDist(d.c, origin) <= k {
				st = "cand"
			}
			if d.id == chosen {
				st = "good"
			}
			out = append(out, M{"q": d.c.q, "r": d.c.r, "label": d.id, "state": st})
		}
		return out
	}
	hv := func(k int, chosen string) M {
		return M{"k": "hex", "label": fmt.Sprintf("city map (each hexagon is one cell; dark = pickup, shaded = within k=%d steps)", k), "radius": R, "cells": cellStates(k), "dots": dots(k, chosen)}
	}
	count := func(k int) []drv {
		var c []drv
		for _, d := range ds {
			if hexDist(d.c, origin) <= k {
				c = append(c, d)
			}
		}
		return c
	}
	t.Step("func dispatch(", "The rider's location has already been converted to one cell (an H3 index). Sixteen drivers are online in this part of the city, each in some cell. Only the cell matters, never raw coordinates.", "neutral", nil, hv(0, ""))
	c1 := count(1)
	t.Step("c := candidates(pickup, k, online)", fmt.Sprintf("k=1: GridDisk(1) returns the pickup cell and its 6 neighbours, 7 cells. Looking up each cell in the online map finds %d driver(s). Nothing scans the other drivers.", len(c1)), "neutral", M{"k": 1, "cells": 7, "found": len(c1)}, hv(1, ""))
	c2 := count(2)
	t.Step("for k := 1; k <= 3; k++", fmt.Sprintf("Widen only when needed. k=2 covers 19 cells (7 + a ring of 12) and finds %d candidate(s). The cost of a search grows with the cells looked up, not with the number of drivers in the city.", len(c2)), "solution", M{"k": 2, "cells": 19, "found": len(c2)}, hv(2, ""))
	sort.Slice(c2, func(i, j int) bool { return hexDist(c2[i].c, origin) < hexDist(c2[j].c, origin) })
	var cells []any
	for _, d := range c2 {
		cells = append(cells, fmt.Sprintf("%s: %d step(s)", d.id, hexDist(d.c, origin)))
	}
	if len(cells) == 0 {
		cells = []any{"none"}
	}
	best := ""
	if len(c2) > 0 {
		best = c2[0].id
	}
	t.Step("return best(c, pickup), true", fmt.Sprintf("Score the candidates. The real scorer uses road ETA, rating and heading; here the stand-in is grid distance. Nearest is %s.", best), "solution", M{"best": best}, hv(2, ""), arr("candidates, nearest first", cells, nil, mm(0, "good")))
	t.Step("return best(c, pickup), true", fmt.Sprintf("%s is offered the trip with an atomic lease, so no other rider can be matched to the same driver at the same moment. Drivers outside the ring were never even considered.", best), "solution", M{"offered": best}, hv(2, best))
	t.Save("dispatch")
}
