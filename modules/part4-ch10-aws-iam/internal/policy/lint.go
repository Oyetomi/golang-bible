package policy

import (
	"fmt"
	"strings"
)

type Severity string

const (
	High Severity = "HIGH"
	Warn Severity = "WARN"
)

type Finding struct {
	Severity Severity
	Stmt     string // Sid, or "#<index>" when there is none
	Rule     string
	Detail   string
}

func (f Finding) String() string {
	return fmt.Sprintf("%-4s %-24s %-18s %s", f.Severity, f.Stmt, f.Rule, f.Detail)
}

var writePrefixes = []string{"Put", "Delete", "Create", "Update", "Attach", "Detach", "Pass", "Send", "Invoke", "Write", "Set", "Start", "Terminate", "Run"}

func isWrite(action string) bool {
	_, name, ok := strings.Cut(action, ":")
	if !ok {
		return false
	}
	for _, p := range writePrefixes {
		if strings.HasPrefix(name, p) {
			return true
		}
	}
	return name == "*" || strings.Contains(name, "*")
}

// Lint inspects an identity or trust policy and returns findings. It reads
// only the Allow statements: a Deny can never grant anything.
func Lint(d Document) []Finding {
	var out []Finding
	if d.Version != Version {
		out = append(out, Finding{High, "(document)", "version", fmt.Sprintf("Version is %q, want %q", d.Version, Version)})
	}
	for i, s := range d.Statement {
		id := s.Sid
		if id == "" {
			id = fmt.Sprintf("#%d", i)
		}
		if s.Effect != "Allow" {
			continue
		}
		write := false
		for _, a := range s.Action {
			switch {
			case a == "*":
				out = append(out, Finding{High, id, "action-star", `Action "*" grants every API in every service`})
			case strings.HasSuffix(a, ":*"):
				out = append(out, Finding{Warn, id, "action-service-star", fmt.Sprintf("%q grants every %s API", a, strings.TrimSuffix(a, ":*"))})
			}
			if isWrite(a) {
				write = true
			}
		}
		for _, r := range s.Resource {
			if r == "*" {
				out = append(out, Finding{High, id, "resource-star", `Resource "*" applies to every resource in the account`})
			}
		}
		for k, v := range s.Principal {
			for _, p := range v {
				if p == "*" {
					out = append(out, Finding{High, id, "principal-star", fmt.Sprintf("Principal %s:\"*\" lets anyone assume this", k)})
				}
			}
		}
		if len(s.Condition) == 0 && write && len(s.Principal) == 0 {
			out = append(out, Finding{Warn, id, "no-condition", "write-capable Allow with no Condition"})
		}
	}
	return out
}
