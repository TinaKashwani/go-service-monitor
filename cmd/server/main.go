package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/TinaKashwani/go-service-monitor/internal/checker"
	"github.com/TinaKashwani/go-service-monitor/internal/handler"
	"github.com/TinaKashwani/go-service-monitor/internal/metrics"
	"github.com/TinaKashwani/go-service-monitor/internal/model"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

const (
	readHeaderTimeout = 5 * time.Second
	readTimeout       = 10 * time.Second
	writeTimeout      = 15 * time.Second
	idleTimeout       = 60 * time.Second
	shutdownTimeout   = 10 * time.Second
)

type HealthResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

type errorResponse struct {
	Error string `json:"error"`
}

var serviceChecker = checker.New(5 * time.Second)

var monitoredServices = []model.Service{
	{Name: "Example", URL: "https://example.com"},
	{Name: "Google", URL: "https://www.google.com"},
	{Name: "Invalid service", URL: "http://invalid-service-that-does-not-exist.test"},
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	services, err := loadMonitoredServices()
	if err != nil {
		log.Fatalf("Invalid MONITORED_SERVICES configuration: %v", err)
	}

	server := newHTTPServer(
		":"+port,
		newHandler(envEnabled("ENABLE_AD_HOC_CHECKS"), services),
	)

	listener, err := net.Listen("tcp", server.Addr)
	if err != nil {
		log.Fatalf("Server failed to listen: %v", err)
	}

	ctx, stop := signal.NotifyContext(
		context.Background(),
		os.Interrupt,
		syscall.SIGTERM,
	)
	defer stop()

	log.Printf("Server starting on port %s", port)

	if err := serve(ctx, server, listener, shutdownTimeout); err != nil {
		log.Fatalf("Server stopped with an error: %v", err)
	}
}

func newHandler(enableAdHocChecks bool, services []model.Service) http.Handler {
	monitorMetrics := metrics.NewMonitorMetrics(prometheus.DefaultRegisterer)
	monitorHandler := handler.NewMonitorHandlerWithMetrics(
		serviceChecker,
		services,
		monitorMetrics,
	)

	mux := http.NewServeMux()
	mux.HandleFunc("/", homeHandler)
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/check", checkHandler(enableAdHocChecks))
	mux.Handle("/metrics", getOnly(promhttp.Handler()))
	mux.Handle("/api/v1/services/status", monitorHandler)

	return mux
}

func loadMonitoredServices() ([]model.Service, error) {
	raw, configured := os.LookupEnv("MONITORED_SERVICES")
	if !configured {
		return append([]model.Service(nil), monitoredServices...), nil
	}

	var services []model.Service
	if err := json.Unmarshal([]byte(raw), &services); err != nil {
		return nil, fmt.Errorf("must be a JSON array: %w", err)
	}
	if services == nil {
		return nil, errors.New("must be a JSON array, not null")
	}

	names := make(map[string]struct{}, len(services))
	urls := make(map[string]struct{}, len(services))
	for index, service := range services {
		if strings.TrimSpace(service.Name) == "" {
			return nil, fmt.Errorf("service %d must have a name", index+1)
		}
		if strings.TrimSpace(service.URL) == "" {
			return nil, fmt.Errorf("service %d must have a URL", index+1)
		}
		if err := validateTargetURL(service.URL); err != nil {
			return nil, fmt.Errorf("service %d URL: %w", index+1, err)
		}
		if _, exists := names[service.Name]; exists {
			return nil, fmt.Errorf("duplicate service name %q", service.Name)
		}
		if _, exists := urls[service.URL]; exists {
			return nil, fmt.Errorf("duplicate service URL %q", service.URL)
		}
		names[service.Name] = struct{}{}
		urls[service.URL] = struct{}{}
	}

	return services, nil
}

func newHTTPServer(address string, requestHandler http.Handler) *http.Server {
	return &http.Server{
		Addr:              address,
		Handler:           requestHandler,
		ReadHeaderTimeout: readHeaderTimeout,
		ReadTimeout:       readTimeout,
		WriteTimeout:      writeTimeout,
		IdleTimeout:       idleTimeout,
	}
}

func serve(
	ctx context.Context,
	server *http.Server,
	listener net.Listener,
	gracePeriod time.Duration,
) error {
	serverErrors := make(chan error, 1)
	go func() {
		serverErrors <- server.Serve(listener)
	}()

	select {
	case err := <-serverErrors:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-ctx.Done():
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), gracePeriod)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		_ = server.Close()
		return err
	}

	err := <-serverErrors
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}

func homeHandler(w http.ResponseWriter, r *http.Request) {
	if !requireGet(w, r) {
		return
	}

	writeJSON(w, http.StatusOK, HealthResponse{
		Status:  "running",
		Message: "Go Service Monitor API",
	})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	if !requireGet(w, r) {
		return
	}

	writeJSON(w, http.StatusOK, HealthResponse{
		Status:  "healthy",
		Message: "Service monitor is operational",
	})
}

func checkHandler(enabled bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !requireGet(w, r) {
			return
		}

		if !enabled {
			writeJSON(w, http.StatusNotFound, errorResponse{
				Error: http.StatusText(http.StatusNotFound),
			})
			return
		}

		target := r.URL.Query().Get("url")
		if err := validateTargetURL(target); err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse{Error: err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, serviceChecker.Check(r.Context(), target))
	}
}

func validateTargetURL(target string) error {
	if target == "" {
		return errors.New("missing required query parameter: url")
	}

	parsed, err := url.Parse(target)
	if err != nil {
		return errors.New("url must be a valid HTTP or HTTPS URL")
	}

	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return errors.New("url scheme must be http or https")
	}
	if parsed.Hostname() == "" {
		return errors.New("url must include a hostname")
	}

	return nil
}

func envEnabled(name string) bool {
	return strings.EqualFold(strings.TrimSpace(os.Getenv(name)), "true")
}

func getOnly(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !requireGet(w, r) {
			return
		}
		next.ServeHTTP(w, r)
	})
}

func requireGet(w http.ResponseWriter, r *http.Request) bool {
	if r.Method == http.MethodGet {
		return true
	}

	w.Header().Set("Allow", http.MethodGet)
	writeJSON(w, http.StatusMethodNotAllowed, errorResponse{
		Error: http.StatusText(http.StatusMethodNotAllowed),
	})
	return false
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		log.Printf("Unable to encode response: %v", err)
	}
}
