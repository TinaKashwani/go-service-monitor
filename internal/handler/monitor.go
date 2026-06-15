package handler

import (
	"encoding/json"
	"net/http"

	"github.com/TinaKashwani/go-service-monitor/internal/checker"
	"github.com/TinaKashwani/go-service-monitor/internal/model"
)

// MonitorHandler handles requests for service monitoring results.
type MonitorHandler struct {
	checker  *checker.Checker
	services []model.Service
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

// ServeHTTP checks the configured services and returns their results as JSON.
func (h *MonitorHandler) ServeHTTP(
	writer http.ResponseWriter,
	request *http.Request,
) {
	if request.Method != http.MethodGet {
		writer.Header().Set("Allow", http.MethodGet)
		http.Error(
			writer,
			http.StatusText(http.StatusMethodNotAllowed),
			http.StatusMethodNotAllowed,
		)
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

	writer.Header().Set("Content-Type", "application/json")

	if err := json.NewEncoder(writer).Encode(results); err != nil {
		http.Error(
			writer,
			"failed to encode monitoring results",
			http.StatusInternalServerError,
		)
	}
}
