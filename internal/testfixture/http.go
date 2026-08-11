package testfixture

import (
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"time"
)

// HTTPServer provides deterministic healthy, failing, slow, and recovering
// endpoints for integration tests. It never uses the public network.
func HTTPServer() *httptest.Server {
	var recoveryCalls atomic.Int32
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/healthy":
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("fixture healthy"))
		case "/failing":
			http.Error(w, "fixture failure", http.StatusServiceUnavailable)
		case "/slow":
			time.Sleep(150 * time.Millisecond)
			w.WriteHeader(http.StatusOK)
		case "/recovering":
			if recoveryCalls.Add(1) <= 2 {
				http.Error(w, "recovering", http.StatusBadGateway)
				return
			}
			w.WriteHeader(http.StatusOK)
		default:
			http.NotFound(w, r)
		}
	}))
}
