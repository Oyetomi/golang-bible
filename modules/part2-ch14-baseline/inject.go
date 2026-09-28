package baseline

import (
	"context"
	"fmt"
	"os/exec"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DB struct{ Pool *pgxpool.Pool }

// FindNaive builds SQL by concatenation: the caller writes part of the query.
func (d *DB) FindNaive(ctx context.Context, name string) (int, error) {
	rows, err := d.Pool.Query(ctx, "SELECT id FROM users WHERE name = '"+name+"'")
	if err != nil {
		return 0, err
	}
	defer rows.Close()
	n := 0
	for rows.Next() {
		n++
	}
	return n, rows.Err()
}

// Find binds the value as a parameter: it is data, never SQL.
func (d *DB) Find(ctx context.Context, name string) (int, error) {
	rows, err := d.Pool.Query(ctx, "SELECT id FROM users WHERE name = $1", name)
	if err != nil {
		return 0, err
	}
	defer rows.Close()
	n := 0
	for rows.Next() {
		n++
	}
	return n, rows.Err()
}

// A parameter can be a value but not a column name, so identifiers come from an allow-list.
var sortable = map[string]string{"name": "name", "email": "email", "created": "id"}

func (d *DB) FirstSorted(ctx context.Context, col string) (string, error) {
	c, ok := sortable[col]
	if !ok {
		return "", fmt.Errorf("cannot sort by %q", col)
	}
	var name string
	err := d.Pool.QueryRow(ctx, "SELECT name FROM users ORDER BY "+c+" LIMIT 1").Scan(&name)
	return name, err
}

// EchoNaive runs a shell with the host spliced into the command line.
func EchoNaive(host string) (string, error) {
	out, err := exec.Command("sh", "-c", "echo checking "+host).CombinedOutput()
	return strings.TrimSpace(string(out)), err
}

var hostRe = regexp.MustCompile(`^[A-Za-z0-9]([A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$`)

// Echo passes the host as one argument: no shell parses it. It also validates the shape.
func Echo(host string) (string, error) {
	if !hostRe.MatchString(host) {
		return "", fmt.Errorf("invalid host %q", host)
	}
	out, err := exec.Command("echo", "checking", host).CombinedOutput()
	return strings.TrimSpace(string(out)), err
}
