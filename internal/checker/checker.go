package checker

import (
	"context"
	"net/http"
	"sync"
	"time"

	"github.com/TinaKashwani/go-service-monitor/internal/model"
)

const defaultTimeout = 5 * time.Second

// Checker performs HTTP health checks.
type Checker struct {
	client *http.Client
}

// indexedResult associates a health-check result with its original URL position.
type indexedResult struct {
	index  int
	result model.CheckResult
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

// CheckServicesConcurrently checks multiple services at the same time
// and collects their results through a channel.
func (c *Checker) CheckServicesConcurrently(
	ctx context.Context,
	urls []string,
) []model.CheckResult {
	results := make([]model.CheckResult, len(urls))

	resultChannel := make(chan indexedResult, len(urls))

	var waitGroup sync.WaitGroup

	for index, url := range urls {
		waitGroup.Add(1)

		go func(resultIndex int, serviceURL string) {
			defer waitGroup.Done()

			resultChannel <- indexedResult{
				index:  resultIndex,
				result: c.Check(ctx, serviceURL),
			}
		}(index, url)
	}

	// Close the channel only after every health-check goroutine finishes.
	go func() {
		waitGroup.Wait()
		close(resultChannel)
	}()

	// Receive results until the channel has been closed and emptied.
	for completedResult := range resultChannel {
		results[completedResult.index] = completedResult.result
	}

	return results
}
