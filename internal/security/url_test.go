package security

import (
	"context"
	"net"
	"testing"
)

type resolverStub struct {
	addresses []net.IP
	err       error
}

func (s resolverStub) LookupIP(context.Context, string, string) ([]net.IP, error) {
	return s.addresses, s.err
}

func TestURLValidatorRejectsUnsafeDestinations(t *testing.T) {
	tests := []struct {
		name, url string
		ips       []net.IP
	}{{"loopback", "http://127.0.0.1", []net.IP{net.ParseIP("127.0.0.1")}}, {"private", "https://internal.test", []net.IP{net.ParseIP("10.1.2.3")}}, {"metadata", "http://metadata.test", []net.IP{net.ParseIP("169.254.169.254")}}, {"ipv6 loopback", "http://[::1]", []net.IP{net.ParseIP("::1")}}, {"mixed dns", "https://mixed.test", []net.IP{net.ParseIP("93.184.216.34"), net.ParseIP("192.168.1.1")}}}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			v := &URLValidator{Resolver: resolverStub{addresses: tt.ips}}
			if err := v.Validate(context.Background(), tt.url); err == nil {
				t.Fatal("expected unsafe URL to be rejected")
			}
		})
	}
}
func TestURLValidatorAcceptsResolvedPublicHTTPURL(t *testing.T) {
	v := &URLValidator{Resolver: resolverStub{addresses: []net.IP{net.ParseIP("93.184.216.34")}}}
	if err := v.Validate(context.Background(), "https://example.com/health"); err != nil {
		t.Fatal(err)
	}
}
func TestURLValidatorRejectsCredentialsAndSchemes(t *testing.T) {
	v := &URLValidator{Resolver: resolverStub{addresses: []net.IP{net.ParseIP("93.184.216.34")}}}
	for _, raw := range []string{"https://user:pass@example.com", "file:///etc/passwd", "//example.com"} {
		if err := v.Validate(context.Background(), raw); err == nil {
			t.Fatalf("expected %q rejected", raw)
		}
	}
}
