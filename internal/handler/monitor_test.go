package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/TinaKashwani/go-service-monitor/internal/checker"
	"github.com/TinaKashwani/go-service-monitor/internal/model"
)

func TestMonitorHandlerReturnsServiceResults(t *testing.T) {
	healthyServer := httptest.NewServer(
		http.HandlerFunc(func(
			writer http.ResponseWriter,
			request *http.Request,
		) {
			writer.WriteHeader(http.StatusOK)
		}),
	)
	defer healthyServer.Close()

	unhealthyServer := httptest.NewServer(
		http.HandlerFunc(func(
			writer http.ResponseWriter,
			request *http.Request,
		) {
			writer.WriteHeader(http.StatusServiceUnavailable)
		}),
	)
	defer unhealthyServer.Close()

	services := []model.Service{
		{
			Name: "Healthy service",
			URL:  healthyServer.URL,
		},
		{
			Name: "Unhealthy service",
			URL:  unhealthyServer.URL,
		},
	}

	serviceChecker := checker.New(time.Second)

	monitorHandler := NewMonitorHandler(
		serviceChecker,
		services,
	)

	request := httptest.NewRequest(
		http.MethodGet,
		"/api/v1/services/status",
		nil,
	)

	response := httptest.NewRecorder()

	monitorHandler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf(
			"expected status code %d, got %d",
			http.StatusOK,
			response.Code,
		)
	}

	contentType := response.Header().Get("Content-Type")

	if contentType != "application/json" {
		t.Errorf(
			"expected Content-Type application/json, got %q",
			contentType,
		)
	}

	var results []model.CheckResult

	if err := json.NewDecoder(response.Body).Decode(&results); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}

	if len(results) != 2 {
		t.Fatalf(
			"expected 2 results, got %d",
			len(results),
		)
	}

	resultsByURL := make(map[string]model.CheckResult)

	for _, result := range results {
		resultsByURL[result.URL] = result
	}

	healthyResult, exists := resultsByURL[healthyServer.URL]
	if !exists {
		t.Fatalf(
			"expected result for healthy service %q",
			healthyServer.URL,
		)
	}

	if healthyResult.Status != "up" {
		t.Errorf(
			"expected healthy service status to be up, got %q",
			healthyResult.Status,
		)
	}

	unhealthyResult, exists := resultsByURL[unhealthyServer.URL]
	if !exists {
		t.Fatalf(
			"expected result for unhealthy service %q",
			unhealthyServer.URL,
		)
	}

	if unhealthyResult.Status != "down" {
		t.Errorf(
			"expected unhealthy service status to be down, got %q",
			unhealthyResult.Status,
		)
	}
}

func TestMonitorHandlerRejectsUnsupportedMethod(t *testing.T) {
	serviceChecker := checker.New(time.Second)

	monitorHandler := NewMonitorHandler(
		serviceChecker,
		nil,
	)

	request := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/services/status",
		nil,
	)

	response := httptest.NewRecorder()

	monitorHandler.ServeHTTP(response, request)

	if response.Code != http.StatusMethodNotAllowed {
		t.Fatalf(
			"expected status code %d, got %d",
			http.StatusMethodNotAllowed,
			response.Code,
		)
	}

	if response.Header().Get("Allow") != http.MethodGet {
		t.Errorf(
			"expected Allow header %q, got %q",
			http.MethodGet,
			response.Header().Get("Allow"),
		)
	}
}
