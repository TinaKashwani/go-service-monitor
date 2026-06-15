package checker

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
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
