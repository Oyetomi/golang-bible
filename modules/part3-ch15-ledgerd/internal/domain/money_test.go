package domain

import (
	"errors"
	"testing"
)

func TestAdd(t *testing.T) {
	cases := []struct {
		name    string
		a, b    Money
		want    int64
		wantErr error
	}{
		{"simple", Money{100, "USD"}, Money{250, "USD"}, 350, nil},
		{"negative", Money{100, "USD"}, Money{-250, "USD"}, -150, nil},
		{"currency mismatch", Money{100, "USD"}, Money{100, "EUR"}, 0, ErrCurrency},
		{"overflow", Money{1<<63 - 1, "USD"}, Money{1, "USD"}, 0, ErrOverflow},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := c.a.Add(c.b)
			if !errors.Is(err, c.wantErr) {
				t.Fatalf("err = %v, want %v", err, c.wantErr)
			}
			if err == nil && got.Minor != c.want {
				t.Fatalf("got %d, want %d", got.Minor, c.want)
			}
		})
	}
}

func TestAllocate(t *testing.T) {
	parts, err := Money{67, "USD"}.Allocate(1, 174, 57)
	if err != nil {
		t.Fatal(err)
	}
	var sum int64
	for _, p := range parts {
		sum += p.Minor
	}
	t.Logf("67 split 1:174:57 = %v (sum %d)", parts, sum)
	if sum != 67 {
		t.Fatalf("parts sum to %d, want 67", sum)
	}
}

func TestTransactionValidate(t *testing.T) {
	if err := (Transaction{Postings: []Posting{{"a", -5}, {"b", 4}}}).Validate(); !errors.Is(err, ErrUnbalanced) {
		t.Fatalf("want ErrUnbalanced, got %v", err)
	}
	if err := (Transaction{Postings: []Posting{{"a", -5}}}).Validate(); !errors.Is(err, ErrTooFew) {
		t.Fatalf("want ErrTooFew, got %v", err)
	}
}
