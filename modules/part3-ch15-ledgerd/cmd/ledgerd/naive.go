package main

import "encoding/json"

// bodyToEvent turns the transfer request into the event the outbox would have carried.
func bodyToEvent(b []byte) []byte {
	var r struct {
		From   string `json:"from"`
		To     string `json:"to"`
		Amount int64  `json:"amount"`
	}
	json.Unmarshal(b, &r)
	out, _ := json.Marshal(r)
	return out
}
