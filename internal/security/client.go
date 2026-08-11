package security

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"time"

	"github.com/TinaKashwani/go-service-monitor/internal/model"
)

const MaxResponseBody = 1 << 20

type SafeChecker struct {
	validator *URLValidator
	semaphore chan struct{}
}

func NewSafeChecker(validator *URLValidator, concurrency int) *SafeChecker {
	if concurrency < 1 {
		concurrency = 1
	}
	return &SafeChecker{validator: validator, semaphore: make(chan struct{}, concurrency)}
}

func (c *SafeChecker) Check(ctx context.Context, monitor model.Monitor, source string) model.StoredCheck {
	result := model.StoredCheck{MonitorID: monitor.ID, Status: "down", Source: source, CheckedAt: time.Now().UTC()}
	if err := c.validator.Validate(ctx, monitor.URL); err != nil {
		result.ErrorCategory = "validation"
		result.ErrorMessage = err.Error()
		return result
	}
	select {
	case c.semaphore <- struct{}{}:
		defer func() { <-c.semaphore }()
	case <-ctx.Done():
		result.ErrorCategory = "timeout"
		result.ErrorMessage = ctx.Err().Error()
		return result
	}
	timeout := time.Duration(monitor.TimeoutSeconds) * time.Second
	if timeout <= 0 || timeout > 30*time.Second {
		timeout = 5 * time.Second
	}
	requestCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	transport := &http.Transport{Proxy: nil, DialContext: func(dctx context.Context, network, address string) (net.Conn, error) {
		host, port, err := net.SplitHostPort(address)
		if err != nil {
			return nil, err
		}
		ips, err := c.validator.Resolver.LookupIP(dctx, "ip", host)
		if err != nil {
			return nil, err
		}
		for _, ip := range ips {
			if !publicIP(ip) {
				return nil, errors.New("destination address became unsafe")
			}
		}
		return (&net.Dialer{Timeout: timeout}).DialContext(dctx, network, net.JoinHostPort(ips[0].String(), port))
	}, TLSHandshakeTimeout: timeout, ResponseHeaderTimeout: timeout, DisableKeepAlives: true}
	client := &http.Client{Transport: transport, Timeout: timeout, CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if len(via) >= 5 {
			return errors.New("too many redirects")
		}
		return c.validator.Validate(req.Context(), req.URL.String())
	}}
	req, err := http.NewRequestWithContext(requestCtx, http.MethodGet, monitor.URL, nil)
	if err != nil {
		result.ErrorCategory = "validation"
		result.ErrorMessage = err.Error()
		return result
	}
	start := time.Now()
	response, err := client.Do(req)
	result.LatencyMS = time.Since(start).Milliseconds()
	if err != nil {
		result.ErrorCategory = categorize(err)
		result.ErrorMessage = err.Error()
		return result
	}
	defer response.Body.Close()
	result.StatusCode = response.StatusCode
	body, err := io.ReadAll(io.LimitReader(response.Body, MaxResponseBody+1))
	if err != nil {
		result.ErrorCategory = "unknown"
		result.ErrorMessage = err.Error()
		return result
	}
	if len(body) > MaxResponseBody {
		result.ErrorCategory = "body_too_large"
		result.ErrorMessage = "response body exceeds 1 MiB"
		return result
	}
	if response.StatusCode != monitor.ExpectedStatus {
		result.ErrorCategory = "unexpected_status"
		result.ErrorMessage = "response status did not match expected status"
		return result
	}
	if monitor.Keyword != "" && !contains(body, monitor.Keyword) {
		result.ErrorCategory = "keyword_mismatch"
		result.ErrorMessage = "response did not contain expected keyword"
		return result
	}
	result.Status = "up"
	return result
}
func contains(body []byte, keyword string) bool {
	return string(body) != "" && len(keyword) > 0 && stringContains(string(body), keyword)
}
func stringContains(value, part string) bool {
	for i := 0; i+len(part) <= len(value); i++ {
		if value[i:i+len(part)] == part {
			return true
		}
	}
	return false
}
func categorize(err error) string {
	if errors.Is(err, context.DeadlineExceeded) {
		return "timeout"
	}
	var dns *net.DNSError
	if errors.As(err, &dns) {
		return "dns"
	}
	var op *net.OpError
	if errors.As(err, &op) {
		return "connection"
	}
	return "unknown"
}
