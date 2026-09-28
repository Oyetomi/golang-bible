package baseline

import "log/slog"

// Secret never prints its value: not with %v, not through slog, not as JSON.
type Secret string

func (Secret) String() string               { return "[REDACTED]" }
func (Secret) GoString() string             { return "[REDACTED]" }
func (Secret) LogValue() slog.Value         { return slog.StringValue("[REDACTED]") }
func (Secret) MarshalText() ([]byte, error) { return []byte("[REDACTED]"), nil }

type Config struct {
	Host     string `json:"host"`
	Password Secret `json:"password"`
}
