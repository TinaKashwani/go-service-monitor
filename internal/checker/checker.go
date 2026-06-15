package checker

import (
	"context"
	"net/http"
	"time"

	"github.com/TinaKashwani/go-service-monitor/internal/model"
)

const defaultTimeout = 5 * time.Second

// Checker performs HTTP health checks.
type Checker struct {
	client *http.Client
}

// New creates a Checker with a configured HTTP timeout.
func New(timeout time.Duration) *Checker {
	if timeout <= 0 {
		timeout = defaultTimeout
	}

	return &Checker{
		client: &http.Client{
			Timeout: timeout,
		},
	}
}

// Check sends an HTTP GET request to a service and returns its health result.
func (c *Checker) Check(ctx context.Context, url string) model.CheckResult {
	startTime := time.Now()

	result := model.CheckResult{
		URL:       url,
		Status:    "down",
		CheckedAt: startTime.UTC(),
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		result.Error = err.Error()
		return result
	}

	response, err := c.client.Do(request)
	result.ResponseTime = time.Since(startTime)
	result.ResponseTimeMS = result.ResponseTime.Milliseconds()

	if err != nil {
		result.Error = err.Error()
		return result
	}
	defer response.Body.Close()

	result.StatusCode = response.StatusCode

	if response.StatusCode >= http.StatusOK &&
		response.StatusCode < http.StatusBadRequest {
		result.Status = "up"
	}

	return result
}
