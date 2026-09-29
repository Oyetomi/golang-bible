package baseline

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestStrictDecode(t *testing.T) {
	cases := []struct{ name, body string }{
		{"valid", `{"from":"a","to":"b","amount":100}`},
		{"unknown field (mass assignment)", `{"from":"a","to":"b","amount":100,"is_admin":true}`},
		{"wrong type", `{"from":"a","to":"b","amount":"lots"}`},
		{"trailing data", `{"from":"a","to":"b","amount":1}{"x":1}`},
		{"too big", `{"from":"` + strings.Repeat("a", 5000) + `","to":"b","amount":1}`},
	}
	for _, c := range cases {
		w := httptest.NewRecorder()
		r := httptest.NewRequest("POST", "/", strings.NewReader(c.body))
		var v CreatePayment
		err := DecodeStrict(w, r, &v, 1024)
		t.Logf("%-32s -> %v", c.name, err)
	}
}

func TestAllocationBomb(t *testing.T) {
	frame := make([]byte, 4) // a length prefix claiming 256 MB, followed by nothing
	binary.BigEndian.PutUint32(frame, 256<<20)
	measure := func(f func()) uint64 {
		var a, b runtime.MemStats
		runtime.GC()
		runtime.ReadMemStats(&a)
		f()
		runtime.ReadMemStats(&b)
		return b.TotalAlloc - a.TotalAlloc
	}
	naive := measure(func() { ReadFrameNaive(bytes.NewReader(frame)) })
	var err error
	safe := measure(func() { _, err = ReadFrame(bytes.NewReader(frame), 1<<20) })
	t.Logf("a 4-byte frame claiming 256 MB: naive reader allocated %d MB; bounded reader allocated %d bytes and returned %v", naive>>20, safe, err)
}

func db(t *testing.T) *DB {
	t.Helper()
	pool, err := pgxpool.New(context.Background(), "postgres://abbey@127.0.0.1:55432/baseline")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	return &DB{Pool: pool}
}

func TestSQL(t *testing.T) {
	d := db(t)
	ctx := context.Background()
	for _, in := range []string{"user7", "' OR '1'='1"} {
		n, err := d.FindNaive(ctx, in)
		m, err2 := d.Find(ctx, in)
		t.Logf("name=%-16q concatenated: %4d rows (%v)   parameterized: %d rows (%v)", in, n, err, m, err2)
	}
	for _, col := range []string{"email", "name; DROP TABLE users"} {
		v, err := d.FirstSorted(ctx, col)
		t.Logf("ORDER BY %-24q -> %q, %v", col, v, err)
	}
}

func TestCommand(t *testing.T) {
	for _, in := range []string{"example.com", "example.com; echo INJECTED"} {
		a, _ := EchoNaive(in)
		b, err := Echo(in)
		t.Logf("host=%-30q shell: %q   argv: %q %v", in, a, b, err)
	}
}

func TestTraversal(t *testing.T) {
	dir := t.TempDir()
	os.MkdirAll(filepath.Join(dir, "public"), 0o755)
	os.WriteFile(filepath.Join(dir, "secret.txt"), []byte("outside the base"), 0o600)
	os.WriteFile(filepath.Join(dir, "public", "ok.txt"), []byte("hello"), 0o644)
	os.Symlink(filepath.Join(dir, "secret.txt"), filepath.Join(dir, "public", "link.txt"))
	base := filepath.Join(dir, "public")
	for _, name := range []string{"ok.txt", "../secret.txt", "link.txt"} {
		u, uerr := ReadUnsafe(base, name)
		s, serr := ReadSafe(base, name)
		t.Logf("%-16q filepath.Join: %-20q %v | os.Root: %q %v", name, u, uerr, s, serr)
	}
}

func TestSSRF(t *testing.T) {
	inner := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("internal secret")) }))
	defer inner.Close()
	redir := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { http.Redirect(w, r, inner.URL, 302) }))
	defer redir.Close()
	innerAP := netip.MustParseAddrPort(strings.TrimPrefix(inner.URL, "http://"))
	redirAP := netip.MustParseAddrPort(strings.TrimPrefix(redir.URL, "http://"))

	guard := SafeClient()
	for _, u := range []string{inner.URL, "http://localhost:" + fmt.Sprint(innerAP.Port()), "http://169.254.169.254/latest/meta-data/", "http://10.0.0.5/", "http://[::ffff:127.0.0.1]:" + fmt.Sprint(innerAP.Port()), "http://0.0.0.0:80/", "http://100.64.0.1/"} {
		_, err := guard.Get(u)
		var ue interface{ Unwrap() error }
		_ = ue
		t.Logf("guarded GET %-52s -> blocked=%v", u, errors.Is(err, ErrBlocked))
	}
	naive, err := http.Get(inner.URL)
	if err == nil {
		naive.Body.Close()
	}
	t.Logf("default client GET %s -> connected (err=%v)", inner.URL, err)

	// a permitted first hop that redirects to an internal server
	c := SafeClient(redirAP)
	_, err = c.Get(redir.URL)
	t.Logf("allowed host redirects to an internal one: blocked=%v (%v)", errors.Is(err, ErrBlocked), err != nil)
	nc := &http.Client{}
	resp, err := nc.Get(redir.URL)
	if err == nil {
		resp.Body.Close()
	}
	t.Logf("default client follows the same redirect: status %d, err=%v", resp.StatusCode, err)
}

func TestXSS(t *testing.T) {
	in := `<script>alert(1)</script>"`
	t.Logf("input: %s", in)
	t.Logf("html/template: %s", RenderHTML(in))
	t.Logf("text/template: %s", RenderText(in))
	t.Logf("template.HTML: %s", RenderTrusted(in))
}

func TestHeadersAndTLS(t *testing.T) {
	srv := httptest.NewUnstartedServer(Secure(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })))
	srv.TLS = TLSConfig()
	srv.StartTLS()
	defer srv.Close()
	resp, err := srv.Client().Get(srv.URL)
	if err != nil {
		t.Fatal(err)
	}
	for _, h := range []string{"Strict-Transport-Security", "X-Content-Type-Options", "Content-Security-Policy", "Referrer-Policy", "Cache-Control"} {
		t.Logf("%s: %s", h, resp.Header.Get(h))
	}
	old := &http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true, MaxVersion: tls.VersionTLS11}}}
	_, err = old.Get(srv.URL)
	t.Logf("a TLS 1.1 client: %v", err != nil)
	t.Logf("negotiated with a normal client: TLS version 0x%04x", resp.TLS.Version)
}

func TestRedaction(t *testing.T) {
	c := Config{Host: "db.internal", Password: "s3cr3t-pw"}
	var buf bytes.Buffer
	slog.New(slog.NewJSONHandler(&buf, &slog.HandlerOptions{ReplaceAttr: func(g []string, a slog.Attr) slog.Attr {
		if a.Key == "time" {
			return slog.Attr{}
		}
		return a
	}})).Info("starting", "config", c, "password", c.Password)
	j, _ := json.Marshal(c)
	t.Logf("slog JSON: %s", strings.TrimSpace(buf.String()))
	t.Logf("fmt %%v:    %v", c)
	t.Logf("fmt %%+v:   %+v", c)
	t.Logf("json.Marshal: %s", j)
	t.Logf("the real value is still there for the code that needs it: %q", string(c.Password))
}
