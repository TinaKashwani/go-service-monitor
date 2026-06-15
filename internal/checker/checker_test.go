package checker

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestCheckReturnsUpForSuccessfulService(t *testing.T) {
	// Create a temporary local server that returns HTTP 200.
	server := httptest.NewServer(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		},
	))
	defer server.Close()

	serviceChecker := New(2 * time.Second)

	result := serviceChecker.Check(context.Background(), server.URL)

	if result.URL != server.URL {
		t.Errorf("expected URL %q, got %q", server.URL, result.URL)
	}

	if result.Status != "up" {
		t.Errorf("expected status %q, got %q", "up", result.Status)
	}

	if result.StatusCode != http.StatusOK {
		t.Errorf(
			"expected status code %d, got %d",
			http.StatusOK,
			result.StatusCode,
		)
	}

	if result.Error != "" {
		t.Errorf("expected no error, got %q", result.Error)
	}

	if result.CheckedAt.IsZero() {
		t.Error("expected CheckedAt to contain a timestamp")
	}

	if result.ResponseTime < 0 {
		t.Errorf(
			"expected a non-negative response time, got %v",
			result.ResponseTime,
		)
	}
}

func TestCheckReturnsDownForServerError(t *testing.T) {
	// Create a temporary local server that returns HTTP 503.
	server := httptest.NewServer(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusServiceUnavailable)
		},
	))
	defer server.Close()

	serviceChecker := New(2 * time.Second)

	result := serviceChecker.Check(context.Background(), server.URL)

	if result.Status != "down" {
		t.Errorf("expected status %q, got %q", "down", result.Status)
	}

	if result.StatusCode != http.StatusServiceUnavailable {
		t.Errorf(
			"expected status code %d, got %d",
			http.StatusServiceUnavailable,
			result.StatusCode,
		)
	}

	if result.Error != "" {
		t.Errorf("expected no request error, got %q", result.Error)
	}
}

func TestCheckReturnsErrorForInvalidURL(t *testing.T) {
	serviceChecker := New(2 * time.Second)

	result := serviceChecker.Check(
		context.Background(),
		"://invalid-url",
	)

	if result.Status != "down" {
		t.Errorf("expected status %q, got %q", "down", result.Status)
	}

	if result.StatusCode != 0 {
		t.Errorf("expected status code 0, got %d", result.StatusCode)
	}

	if result.Error == "" {
		t.Error("expected an error for an invalid URL")
	}
}

func TestCheckReturnsDownWhenRequestTimesOut(t *testing.T) {
	// This server intentionally responds more slowly than the checker timeout.
	server := httptest.NewServer(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			time.Sleep(200 * time.Millisecond)
			w.WriteHeader(http.StatusOK)
		},
	))
	defer server.Close()

	serviceChecker := New(50 * time.Millisecond)

	result := serviceChecker.Check(context.Background(), server.URL)

	if result.Status != "down" {
		t.Errorf("expected status %q, got %q", "down", result.Status)
	}

	if result.StatusCode != 0 {
		t.Errorf("expected status code 0, got %d", result.StatusCode)
	}

	if result.Error == "" {
		t.Fatal("expected a timeout error")
	}

	if !strings.Contains(strings.ToLower(result.Error), "timeout") &&
		!strings.Contains(strings.ToLower(result.Error), "deadline exceeded") {
		t.Errorf("expected timeout-related error, got %q", result.Error)
	}
}

func TestCheckServicesConcurrentlyReturnsAllResults(t *testing.T) {
	server := httptest.NewServer(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}),
	)
	defer server.Close()

	healthChecker := New(2 * time.Second)

	urls := []string{
		server.URL + "/service-one",
		server.URL + "/service-two",
		server.URL + "/service-three",
	}

	results := healthChecker.CheckServicesConcurrently(
		context.Background(),
		urls,
	)

	if len(results) != len(urls) {
		t.Fatalf(
			"expected %d results, got %d",
			len(urls),
			len(results),
		)
	}

	for index, result := range results {
		if result.URL != urls[index] {
			t.Errorf(
				"expected URL %q at index %d, got %q",
				urls[index],
				index,
				result.URL,
			)
		}

		if result.Status != "up" {
			t.Errorf(
				"expected %q to be up, got %q",
				result.URL,
				result.Status,
			)
		}

		if result.StatusCode != http.StatusOK {
			t.Errorf(
				"expected status code %d, got %d",
				http.StatusOK,
				result.StatusCode,
			)
		}
	}
}

func TestCheckServicesConcurrentlyRunsChecksInParallel(t *testing.T) {
	var activeRequests int32
	var maximumActiveRequests int32

	server := httptest.NewServer(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			active := atomic.AddInt32(&activeRequests, 1)

			for {
				currentMaximum := atomic.LoadInt32(
					&maximumActiveRequests,
				)

				if active <= currentMaximum {
					break
				}

				if atomic.CompareAndSwapInt32(
					&maximumActiveRequests,
					currentMaximum,
					active,
				) {
					break
				}
			}

			time.Sleep(100 * time.Millisecond)

			atomic.AddInt32(&activeRequests, -1)
			w.WriteHeader(http.StatusOK)
		}),
	)
	defer server.Close()

	healthChecker := New(2 * time.Second)

	urls := []string{
		server.URL + "/service-one",
		server.URL + "/service-two",
		server.URL + "/service-three",
	}

	results := healthChecker.CheckServicesConcurrently(
		context.Background(),
		urls,
	)

	if len(results) != len(urls) {
		t.Fatalf(
			"expected %d results, got %d",
			len(urls),
			len(results),
		)
	}

	if atomic.LoadInt32(&maximumActiveRequests) < 2 {
		t.Errorf(
			"expected requests to overlap, but maximum active requests was %d",
			maximumActiveRequests,
		)
	}
}

func TestCheckServicesConcurrentlyHandlesEmptyURLList(t *testing.T) {
	healthChecker := New(2 * time.Second)

	results := healthChecker.CheckServicesConcurrently(
		context.Background(),
		nil,
	)

	if len(results) != 0 {
		t.Errorf(
			"expected 0 results, got %d",
			len(results),
		)
	}
}

func TestCheckServicesConcurrentlyCollectsMixedResults(t *testing.T) {
	server := httptest.NewServer(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.URL.Path {
			case "/healthy":
				w.WriteHeader(http.StatusOK)
			case "/unhealthy":
				w.WriteHeader(http.StatusServiceUnavailable)
			default:
				w.WriteHeader(http.StatusNotFound)
			}
		}),
	)
	defer server.Close()

	healthChecker := New(2 * time.Second)

	urls := []string{
		server.URL + "/healthy",
		server.URL + "/unhealthy",
	}

	results := healthChecker.CheckServicesConcurrently(
		context.Background(),
		urls,
	)

	if len(results) != len(urls) {
		t.Fatalf(
			"expected %d results, got %d",
			len(urls),
			len(results),
		)
	}

	healthyResult := results[0]

	if healthyResult.URL != urls[0] {
		t.Errorf(
			"expected URL %q, got %q",
			urls[0],
			healthyResult.URL,
		)
	}

	if healthyResult.Status != "up" {
		t.Errorf(
			"expected healthy service to be up, got %q",
			healthyResult.Status,
		)
	}

	if healthyResult.StatusCode != http.StatusOK {
		t.Errorf(
			"expected status code %d, got %d",
			http.StatusOK,
			healthyResult.StatusCode,
		)
	}

	unhealthyResult := results[1]

	if unhealthyResult.URL != urls[1] {
		t.Errorf(
			"expected URL %q, got %q",
			urls[1],
			unhealthyResult.URL,
		)
	}

	if unhealthyResult.Status != "down" {
		t.Errorf(
			"expected unhealthy service to be down, got %q",
			unhealthyResult.Status,
		)
	}

	if unhealthyResult.StatusCode != http.StatusServiceUnavailable {
		t.Errorf(
			"expected status code %d, got %d",
			http.StatusServiceUnavailable,
			unhealthyResult.StatusCode,
		)
	}
}

func TestCheckServicesConcurrentlyCollectsRequestErrors(t *testing.T) {
	server := httptest.NewServer(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}),
	)

	workingURL := server.URL
	server.Close()

	healthChecker := New(500 * time.Millisecond)

	urls := []string{
		workingURL,
	}

	results := healthChecker.CheckServicesConcurrently(
		context.Background(),
		urls,
	)

	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}

	result := results[0]

	if result.Status != "down" {
		t.Errorf(
			"expected closed server to be down, got %q",
			result.Status,
		)
	}

	if result.Error == "" {
		t.Error("expected a request error")
	}
}
