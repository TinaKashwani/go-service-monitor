package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/TinaKashwani/go-service-monitor/internal/checker"
	"github.com/TinaKashwani/go-service-monitor/internal/handler"
	"github.com/TinaKashwani/go-service-monitor/internal/metrics"
	"github.com/TinaKashwani/go-service-monitor/internal/model"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

type HealthResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

var serviceChecker = checker.New(5 * time.Second)

var monitoredServices = []model.Service{
	{
		Name: "Example",
		URL:  "https://example.com",
	},
	{
		Name: "Google",
		URL:  "https://www.google.com",
	},
	{
		Name: "Invalid service",
		URL:  "http://invalid-service-that-does-not-exist.test",
	},
}

func main() {
	monitorMetrics := metrics.NewMonitorMetrics(
		prometheus.DefaultRegisterer,
	)

	monitorHandler := handler.NewMonitorHandlerWithMetrics(
		serviceChecker,
		monitoredServices,
		monitorMetrics,
	)

	http.HandleFunc("/", homeHandler)
	http.HandleFunc("/health", healthHandler)
	http.HandleFunc("/check", checkHandler)
	http.Handle("/metrics", promhttp.Handler())
	http.Handle(
		"/api/v1/services/status",
		monitorHandler,
	)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)

	err := http.ListenAndServe(":"+port, nil)
	if err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

func homeHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	response := HealthResponse{
		Status:  "running",
		Message: "Go Service Monitor API",
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		http.Error(w, "Unable to encode response", http.StatusInternalServerError)
	}
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	response := HealthResponse{
		Status:  "healthy",
		Message: "Service monitor is operational",
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		http.Error(w, "Unable to encode response", http.StatusInternalServerError)
	}
}

func checkHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	url := r.URL.Query().Get("url")
	if url == "" {
		http.Error(w, "Missing required query parameter: url", http.StatusBadRequest)
		return
	}

	result := serviceChecker.Check(r.Context(), url)

	if err := json.NewEncoder(w).Encode(result); err != nil {
		http.Error(w, "Unable to encode response", http.StatusInternalServerError)
	}
}
