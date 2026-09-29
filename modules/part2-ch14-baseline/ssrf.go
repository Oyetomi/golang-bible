package baseline

import (
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/netip"
	"syscall"
	"time"
)

var ErrBlocked = errors.New("destination not allowed")

// public reports whether an address is one this service may connect to on a caller's behalf.
func public(a netip.Addr) bool {
	a = a.Unmap() // ::ffff:127.0.0.1 is 127.0.0.1
	return !(a.IsLoopback() || a.IsPrivate() || a.IsLinkLocalUnicast() || a.IsLinkLocalMulticast() ||
		a.IsMulticast() || a.IsUnspecified() || a.IsInterfaceLocalMulticast() ||
		netip.MustParsePrefix("100.64.0.0/10").Contains(a)) // carrier-grade NAT
}

// SafeClient checks the address at connect time, after DNS has answered, so a hostname that
// resolves to an internal address (or is changed between a check and a use) is still refused.
// allow lists exact address:port pairs to permit anyway; tests use it to reach one local server.
func SafeClient(allow ...netip.AddrPort) *http.Client {
	d := &net.Dialer{
		Timeout: 3 * time.Second,
		Control: func(network, address string, c syscall.RawConn) error {
			ap, err := netip.ParseAddrPort(address)
			if err != nil {
				return err
			}
			for _, a := range allow {
				if a == ap {
					return nil
				}
			}
			if !public(ap.Addr()) {
				return fmt.Errorf("%w: %s", ErrBlocked, ap.Addr())
			}
			return nil
		},
	}
	return &http.Client{
		Timeout:   5 * time.Second,
		Transport: &http.Transport{DialContext: d.DialContext, Proxy: nil},
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 3 {
				return errors.New("too many redirects")
			}
			return nil // each redirect is dialled through the same guard
		},
	}
}
