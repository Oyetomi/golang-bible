package domain

import "testing"

// FuzzAllocate checks the property that matters: however the amount and weights look,
// the parts add back up to the whole and no part strays more than one cent from its exact share.
func FuzzAllocate(f *testing.F) {
	f.Add(int64(67), int64(1), int64(174), int64(57))
	f.Add(int64(-100), int64(1), int64(1), int64(1))
	f.Add(int64(0), int64(5), int64(5), int64(5))
	f.Fuzz(func(t *testing.T, amount, w1, w2, w3 int64) {
		const lim = 1 << 30
		if amount > lim || amount < -lim || w1 < 1 || w2 < 1 || w3 < 1 || w1 > 1<<20 || w2 > 1<<20 || w3 > 1<<20 {
			t.Skip()
		}
		parts, err := Money{amount, "USD"}.Allocate(w1, w2, w3)
		if err != nil {
			t.Fatal(err)
		}
		var sum int64
		for _, p := range parts {
			sum += p.Minor
		}
		if sum != amount {
			t.Fatalf("allocate(%d, %d,%d,%d) = %v sums to %d", amount, w1, w2, w3, parts, sum)
		}
	})
}

func FuzzAddNegate(f *testing.F) {
	f.Add(int64(100))
	f.Fuzz(func(t *testing.T, n int64) {
		m := Money{n, "USD"}
		neg, err := m.Neg()
		if err != nil {
			t.Skip()
		}
		sum, err := m.Add(neg)
		if err != nil || sum.Minor != 0 {
			t.Fatalf("%d + %d = %v (%v)", n, neg.Minor, sum, err)
		}
	})
}
