package security

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/url"
	"strings"
)

const MaxURLLength = 2048

type Resolver interface {
	LookupIP(context.Context, string, string) ([]net.IP, error)
}
type URLValidator struct{ Resolver Resolver }

func NewURLValidator() *URLValidator { return &URLValidator{Resolver: net.DefaultResolver} }

func (v *URLValidator) Validate(ctx context.Context, raw string) error {
	if len(raw) > MaxURLLength {
		return errors.New("url must be 2048 characters or fewer")
	}
	parsed, err := url.ParseRequestURI(raw)
	if err != nil || parsed.Hostname() == "" {
		return errors.New("url must be a valid absolute HTTP or HTTPS URL")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return errors.New("url scheme must be http or https")
	}
	if parsed.User != nil {
		return errors.New("url must not contain credentials")
	}
	if parsed.Fragment != "" {
		return errors.New("url must not contain a fragment")
	}
	addresses, err := v.Resolver.LookupIP(ctx, "ip", parsed.Hostname())
	if err != nil {
		return fmt.Errorf("url hostname could not be resolved: %w", err)
	}
	if len(addresses) == 0 {
		return errors.New("url hostname did not resolve to an address")
	}
	for _, address := range addresses {
		if !publicIP(address) {
			return fmt.Errorf("url resolves to a prohibited address: %s", address)
		}
	}
	return nil
}

func publicIP(ip net.IP) bool {
	if ip == nil || ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsMulticast() || ip.IsUnspecified() {
		return false
	}
	if v4 := ip.To4(); v4 != nil {
		// Carrier-grade NAT, documentation, benchmarking, and metadata/reserved ranges.
		blocked := []string{"0.0.0.0/8", "100.64.0.0/10", "169.254.0.0/16", "192.0.0.0/24", "192.0.2.0/24", "198.18.0.0/15", "198.51.100.0/24", "203.0.113.0/24", "224.0.0.0/4", "240.0.0.0/4"}
		for _, raw := range blocked {
			_, network, _ := net.ParseCIDR(raw)
			if network.Contains(v4) {
				return false
			}
		}
	} else if strings.HasPrefix(strings.ToLower(ip.String()), "2001:db8:") {
		return false
	}
	return true
}
