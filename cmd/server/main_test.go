package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHomeHandler(t *testing.T) {
	request := httptest.NewRequest(
		http.MethodGet,
		"/",
		nil,
	)

	response := httptest.NewRecorder()

	homeHandler(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf(
			"expected status code %d, got %d",
			http.StatusOK,
			response.Code,
		)
	}

	if response.Header().Get("Content-Type") != "application/json" {
		t.Errorf(
			"expected Content-Type application/json, got %q",
			response.Header().Get("Content-Type"),
		)
	}

	var body HealthResponse

	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if body.Status != "running" {
		t.Errorf(
			"expected status %q, got %q",
			"running",
			body.Status,
		)
	}

	if body.Message != "Go Service Monitor API" {
		t.Errorf(
			"expected message %q, got %q",
			"Go Service Monitor API",
			body.Message,
		)
	}
}

func TestHealthHandler(t *testing.T) {
	request := httptest.NewRequest(
		http.MethodGet,
		"/health",
		nil,
	)

	response := httptest.NewRecorder()

	healthHandler(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf(
			"expected status code %d, got %d",
			http.StatusOK,
			response.Code,
		)
	}

	var body HealthResponse

	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if body.Status != "healthy" {
		t.Errorf(
			"expected status %q, got %q",
			"healthy",
			body.Status,
		)
	}

	if body.Message != "Service monitor is operational" {
		t.Errorf(
			"expected message %q, got %q",
			"Service monitor is operational",
			body.Message,
		)
	}
}

func TestCheckHandlerRejectsUnsupportedMethod(t *testing.T) {
	request := httptest.NewRequest(
		http.MethodPost,
		"/check?url=https://example.com",
		nil,
	)

	response := httptest.NewRecorder()

	checkHandler(response, request)

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

func TestCheckHandlerRequiresURL(t *testing.T) {
	request := httptest.NewRequest(
		http.MethodGet,
		"/check",
		nil,
	)

	response := httptest.NewRecorder()

	checkHandler(response, request)

	if response.Code != http.StatusBadRequest {
		t.Fatalf(
			"expected status code %d, got %d",
			http.StatusBadRequest,
			response.Code,
		)
	}
}
