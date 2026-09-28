// Package domain holds the rules that must hold whatever the database does.
// It imports nothing from this module.
package domain

import (
	"errors"
	"fmt"
	"math"
)

// Money is an amount in minor units (cents) with its currency. Never a float.
type Money struct {
	Minor    int64
	Currency string
}

var (
	ErrCurrency = errors.New("currency mismatch")
	ErrOverflow = errors.New("amount overflows int64")
)

func (m Money) Add(o Money) (Money, error) {
	if m.Currency != o.Currency {
		return Money{}, fmt.Errorf("%w: %s vs %s", ErrCurrency, m.Currency, o.Currency)
	}
	if (o.Minor > 0 && m.Minor > math.MaxInt64-o.Minor) || (o.Minor < 0 && m.Minor < math.MinInt64-o.Minor) {
		return Money{}, ErrOverflow
	}
	return Money{m.Minor + o.Minor, m.Currency}, nil
}

func (m Money) Neg() (Money, error) {
	if m.Minor == math.MinInt64 {
		return Money{}, ErrOverflow
	}
	return Money{-m.Minor, m.Currency}, nil
}

// Allocate splits m by weights so the parts sum to exactly m: the leftover cents go to the
// parts with the largest fractional remainders (the largest-remainder method).
func (m Money) Allocate(weights ...int64) ([]Money, error) {
	var total int64
	for _, w := range weights {
		if w <= 0 {
			return nil, errors.New("weights must be positive")
		}
		total += w
	}
	if total == 0 {
		return nil, errors.New("no weights")
	}
	parts := make([]Money, len(weights))
	rem := make([]int64, len(weights))
	var used int64
	for i, w := range weights {
		q, r := divmod(m.Minor, w, total)
		parts[i] = Money{q, m.Currency}
		rem[i] = r
		used += q
	}
	for left := m.Minor - used; left != 0; {
		best := 0
		for i := range rem {
			if rem[i] > rem[best] {
				best = i
			}
		}
		step := int64(1)
		if left < 0 {
			step = -1
		}
		parts[best].Minor += step
		rem[best] = -1
		left -= step
	}
	return parts, nil
}

// divmod returns floor(a*w/total) and the remainder a*w mod total, without overflowing for the
// amounts this service handles (a*w fits when a < 2^40 and w < 2^23).
func divmod(a, w, total int64) (q, r int64) {
	p := a * w
	q, r = p/total, p%total
	if r < 0 {
		q, r = q-1, r+total
	}
	return
}
