package handler

import (
	"encoding/json"
	"net/http"

	"github.com/TinaKashwani/go-service-monitor/internal/checker"
	"github.com/TinaKashwani/go-service-monitor/internal/metrics"
	"github.com/TinaKashwani/go-service-monitor/internal/model"
)

// MonitorHandler handles requests for service monitoring results.
type MonitorHandler struct {
	checker  *checker.Checker
	services []model.Service
	metrics  *metrics.MonitorMetrics
}

// NewMonitorHandler creates a monitoring HTTP handler.
func NewMonitorHandler(
	serviceChecker *checker.Checker,
	services []model.Service,
) *MonitorHandler {
	return &MonitorHandler{
		checker:  serviceChecker,
		services: services,
	}
}

func NewMonitorHandlerWithMetrics(
	serviceChecker *checker.Checker,
	services []model.Service,
	monitorMetrics *metrics.MonitorMetrics,
) *MonitorHandler {
	return &MonitorHandler{
		checker:  serviceChecker,
		services: services,
		metrics:  monitorMetrics,
	}
}

// ServeHTTP checks the configured services and returns their results as JSON.
func (h *MonitorHandler) ServeHTTP(
	writer http.ResponseWriter,
	request *http.Request,
) {
	writer.Header().Set("Content-Type", "application/json")

	if request.Method != http.MethodGet {
		writer.Header().Set("Allow", http.MethodGet)
		writer.WriteHeader(http.StatusMethodNotAllowed)
		_ = json.NewEncoder(writer).Encode(map[string]string{
			"error": http.StatusText(http.StatusMethodNotAllowed),
		})
		return
	}

	urls := make([]string, 0, len(h.services))

	for _, service := range h.services {
		urls = append(urls, service.URL)
	}

	results := h.checker.CheckServicesConcurrently(
		request.Context(),
		urls,
	)

	for index := range results {
		results[index].Name = h.services[index].Name
	}

	if h.metrics != nil {
		for index, service := range h.services {
			h.metrics.Record(service, results[index])
		}
	}

	if err := json.NewEncoder(writer).Encode(results); err != nil {
		http.Error(
			writer,
			"failed to encode monitoring results",
			http.StatusInternalServerError,
		)
	}
}
