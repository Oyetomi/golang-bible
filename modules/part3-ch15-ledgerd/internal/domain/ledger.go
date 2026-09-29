package domain

import (
	"errors"
	"fmt"
)

type Posting struct {
	Account string
	Amount  int64 // credit positive, debit negative
}

type Transaction struct {
	Memo     string
	Currency string
	Postings []Posting
}

var (
	ErrUnbalanced = errors.New("postings do not sum to zero")
	ErrTooFew     = errors.New("a transaction needs at least two postings")
	ErrZero       = errors.New("a posting may not be zero")
)

// Validate is the rule in Go. The database enforces the same rule again with a trigger.
func (t Transaction) Validate() error {
	if len(t.Postings) < 2 {
		return ErrTooFew
	}
	var sum int64
	for _, p := range t.Postings {
		if p.Amount == 0 {
			return ErrZero
		}
		sum += p.Amount
	}
	if sum != 0 {
		return fmt.Errorf("%w (sum %d)", ErrUnbalanced, sum)
	}
	return nil
}

// Transfer builds the two-posting transaction that moves amount from one account to another.
func Transfer(from, to string, amount Money, memo string) (Transaction, error) {
	if amount.Minor <= 0 {
		return Transaction{}, errors.New("amount must be positive")
	}
	if from == to {
		return Transaction{}, errors.New("cannot transfer to the same account")
	}
	return Transaction{Memo: memo, Currency: amount.Currency, Postings: []Posting{
		{from, -amount.Minor}, {to, amount.Minor},
	}}, nil
}
