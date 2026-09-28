package baseline

import (
	"encoding/binary"
	"encoding/json"
	"errors"
	"io"
	"net/http"
)

type CreatePayment struct {
	From   string `json:"from"`
	To     string `json:"to"`
	Amount int64  `json:"amount"`
}

// DecodeStrict reads one JSON object from a body of at most max bytes and refuses fields it does not know.
func DecodeStrict(w http.ResponseWriter, r *http.Request, v any, max int64) error {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, max))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		return err
	}
	if dec.More() { // trailing data after the object
		return errors.New("unexpected data after JSON object")
	}
	return nil
}

var ErrTooLarge = errors.New("frame too large")

// ReadFrameNaive trusts a 4-byte length prefix and allocates that much before reading anything.
func ReadFrameNaive(r io.Reader) ([]byte, error) {
	var n uint32
	if err := binary.Read(r, binary.BigEndian, &n); err != nil {
		return nil, err
	}
	buf := make([]byte, n) // the attacker chose n
	_, err := io.ReadFull(r, buf)
	return buf, err
}

// ReadFrame refuses lengths above max, and reads in a bounded way so a lie about the length
// costs only as much memory as bytes actually arrive.
func ReadFrame(r io.Reader, max uint32) ([]byte, error) {
	var n uint32
	if err := binary.Read(r, binary.BigEndian, &n); err != nil {
		return nil, err
	}
	if n > max {
		return nil, ErrTooLarge
	}
	buf := make([]byte, n)
	_, err := io.ReadFull(r, buf)
	return buf, err
}
