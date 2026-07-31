package main

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"reflect"
	"testing"
	"time"
)

func TestHomeAndHealthHandlers(t *testing.T) {
	tests := []struct {
		name       string
		path       string
		handler    http.HandlerFunc
		wantStatus string
	}{
		{name: "home", path: "/", handler: homeHandler, wantStatus: "running"},
		{name: "health", path: "/health", handler: healthHandler, wantStatus: "healthy"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			response := httptest.NewRecorder()
			test.handler(response, httptest.NewRequest(http.MethodGet, test.path, nil))

			if response.Code != http.StatusOK {
				t.Fatalf("expected status %d, got %d", http.StatusOK, response.Code)
			}
			if response.Header().Get("Content-Type") != "application/json" {
				t.Fatalf("expected JSON content type, got %q", response.Header().Get("Content-Type"))
			}

			var body HealthResponse
			if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
				t.Fatalf("failed to decode response: %v", err)
			}
			if body.Status != test.wantStatus {
				t.Errorf("expected status %q, got %q", test.wantStatus, body.Status)
			}
		})
	}
}

func TestPublicEndpointsRejectUnsupportedMethods(t *testing.T) {
	tests := []struct {
		path    string
		handler http.Handler
	}{
		{path: "/", handler: http.HandlerFunc(homeHandler)},
		{path: "/health", handler: http.HandlerFunc(healthHandler)},
		{path: "/metrics", handler: getOnly(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))},
	}

	for _, test := range tests {
		response := httptest.NewRecorder()
		test.handler.ServeHTTP(response, httptest.NewRequest(http.MethodPost, test.path, nil))

		if response.Code != http.StatusMethodNotAllowed {
			t.Errorf("%s: expected 405, got %d", test.path, response.Code)
		}
		if response.Header().Get("Allow") != http.MethodGet {
			t.Errorf("%s: expected Allow GET, got %q", test.path, response.Header().Get("Allow"))
		}
	}
}

func TestCheckHandlerIsDisabledByDefault(t *testing.T) {
	response := httptest.NewRecorder()
	checkHandler(false).ServeHTTP(
		response,
		httptest.NewRequest(http.MethodGet, "/check?url=https://example.com", nil),
	)

	if response.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", response.Code)
	}
}

func TestCheckHandlerValidatesEnabledTargets(t *testing.T) {
	tests := []string{
		"/check",
		"/check?url=ftp://example.com",
		"/check?url=http:///missing-host",
		"/check?url=not-a-url",
	}

	for _, target := range tests {
		response := httptest.NewRecorder()
		checkHandler(true).ServeHTTP(
			response,
			httptest.NewRequest(http.MethodGet, target, nil),
		)
		if response.Code != http.StatusBadRequest {
			t.Errorf("%s: expected 400, got %d", target, response.Code)
		}
	}
}

func TestCheckHandlerChecksValidURLWhenEnabled(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	defer target.Close()

	response := httptest.NewRecorder()
	checkHandler(true).ServeHTTP(
		response,
		httptest.NewRequest(http.MethodGet, "/check?url="+target.URL, nil),
	)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", response.Code)
	}
}

func TestNewHTTPServerSetsProductionTimeouts(t *testing.T) {
	server := newHTTPServer(":0", http.NewServeMux())

	if server.ReadHeaderTimeout != readHeaderTimeout ||
		server.ReadTimeout != readTimeout ||
		server.WriteTimeout != writeTimeout ||
		server.IdleTimeout != idleTimeout {
		t.Fatalf("server timeouts were not configured: %+v", server)
	}
}

func TestServeShutsDownGracefully(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	server := newHTTPServer(listener.Addr().String(), http.NewServeMux())
	if err := serve(ctx, server, listener, time.Second); err != nil {
		t.Fatalf("expected clean shutdown, got %v", err)
	}
}

func TestServeEnforcesShutdownDeadline(t *testing.T) {
	started := make(chan struct{})
	release := make(chan struct{})
	handler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		close(started)
		<-release
		w.WriteHeader(http.StatusOK)
	})

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}

	server := newHTTPServer(listener.Addr().String(), handler)
	ctx, cancel := context.WithCancel(context.Background())
	result := make(chan error, 1)
	go func() {
		result <- serve(ctx, server, listener, 20*time.Millisecond)
	}()

	go func() {
		_, _ = http.Get("http://" + listener.Addr().String())
	}()
	<-started
	cancel()

	err = <-result
	close(release)
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("expected shutdown deadline error, got %v", err)
	}
}

func TestLoadMonitoredServices(t *testing.T) {
	t.Run("uses defaults when unset", func(t *testing.T) {
		t.Setenv("MONITORED_SERVICES", "temporary")
		if err := os.Unsetenv("MONITORED_SERVICES"); err != nil {
			t.Fatal(err)
		}

		services, err := loadMonitoredServices()
		if err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(services, monitoredServices) {
			t.Fatalf("expected defaults, got %#v", services)
		}
	})

	t.Run("preserves valid configured services and order", func(t *testing.T) {
		t.Setenv("MONITORED_SERVICES", `[{"name":"Second","url":"https://second.example.com"},{"name":"First","url":"http://first.example.com/health"}]`)

		services, err := loadMonitoredServices()
		if err != nil {
			t.Fatal(err)
		}
		if len(services) != 2 || services[0].Name != "Second" || services[1].Name != "First" {
			t.Fatalf("configuration order was not preserved: %#v", services)
		}
	})

	t.Run("accepts an empty array", func(t *testing.T) {
		t.Setenv("MONITORED_SERVICES", `[]`)
		services, err := loadMonitoredServices()
		if err != nil || len(services) != 0 {
			t.Fatalf("expected empty services, got %#v, %v", services, err)
		}
	})

	invalid := map[string]string{
		"invalid JSON":       `{`,
		"null":               `null`,
		"missing name":       `[{"url":"https://example.com"}]`,
		"empty URL":          `[{"name":"Example","url":""}]`,
		"duplicate name":     `[{"name":"Same","url":"https://one.example.com"},{"name":"Same","url":"https://two.example.com"}]`,
		"duplicate URL":      `[{"name":"One","url":"https://same.example.com"},{"name":"Two","url":"https://same.example.com"}]`,
		"unsupported scheme": `[{"name":"FTP","url":"ftp://example.com"}]`,
		"missing hostname":   `[{"name":"Broken","url":"http:///health"}]`,
	}
	for name, value := range invalid {
		t.Run("rejects "+name, func(t *testing.T) {
			t.Setenv("MONITORED_SERVICES", value)
			if _, err := loadMonitoredServices(); err == nil {
				t.Fatalf("expected %s to be rejected", name)
			}
		})
	}
}
