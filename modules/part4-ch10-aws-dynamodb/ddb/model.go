package ddb

import (
	"fmt"
	"time"
)

// One table, two item types sharing a partition:
//
//	pk = ACCT#<id>   sk = ACCT                      the account (balance lives here)
//	pk = ACCT#<id>   sk = ENT#<RFC3339Nano>#<txid>  one ledger entry, sorted by time
//
// "All entries of one account, newest first" is then a single-partition Query.

type Account struct {
	PK      string `dynamodbav:"pk"`
	SK      string `dynamodbav:"sk"`
	Owner   string `dynamodbav:"owner"`
	Balance int64  `dynamodbav:"balance"` // minor units (kobo/cents), never float
	Version int64  `dynamodbav:"version"`
}

type Entry struct {
	PK     string    `dynamodbav:"pk"`
	SK     string    `dynamodbav:"sk"`
	Amount int64     `dynamodbav:"amount"` // signed: debit < 0
	TxID   string    `dynamodbav:"txid"`
	At     time.Time `dynamodbav:"at"`
	Memo   string    `dynamodbav:"memo,omitempty"`
}

func AcctPK(id string) string { return "ACCT#" + id }

func AccountKey(id string) map[string]any { return map[string]any{"pk": AcctPK(id), "sk": "ACCT"} }

func NewAccount(id, owner string, balance int64) Account {
	return Account{PK: AcctPK(id), SK: "ACCT", Owner: owner, Balance: balance, Version: 1}
}

func NewEntry(acct string, amount int64, txid string, at time.Time) Entry {
	return Entry{
		PK: AcctPK(acct), SK: fmt.Sprintf("ENT#%s#%s", at.UTC().Format("20060102T150405.000000000Z"), txid),
		Amount: amount, TxID: txid, At: at.UTC(),
	}
}
