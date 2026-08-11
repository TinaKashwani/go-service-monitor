package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/TinaKashwani/go-service-monitor/internal/model"
	"github.com/TinaKashwani/go-service-monitor/internal/repository"
	"github.com/TinaKashwani/go-service-monitor/internal/security"
)

type MonitorAPI struct {
	monitors  repository.MonitorRepository
	checks    *repository.PostgresChecks
	validator *security.URLValidator
	checker   *security.SafeChecker
	history   *HistoryAPI
}

func (h *MonitorAPI) SetHistory(history *HistoryAPI) { h.history = history }

func NewMonitorAPI(monitors repository.MonitorRepository, checks *repository.PostgresChecks, validator *security.URLValidator) *MonitorAPI {
	return &MonitorAPI{monitors: monitors, checks: checks, validator: validator, checker: security.NewSafeChecker(validator, 10)}
}

func (h *MonitorAPI) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	path := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/v1/monitors"), "/")
	if path == "" {
		h.collection(w, r)
		return
	}
	parts := strings.Split(path, "/")
	if len(parts) == 2 && parts[1] == "check" {
		h.check(w, r, parts[0])
		return
	}
	if len(parts) == 2 && parts[1] == "history" && h.history != nil {
		h.history.History(w, r)
		return
	}
	if len(parts) == 1 {
		h.item(w, r, parts[0])
		return
	}
	writeAPIError(w, http.StatusNotFound, "not_found", "resource not found", nil)
}
func (h *MonitorAPI) collection(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		items, err := h.monitors.List(r.Context())
		if err != nil {
			writeAPIError(w, 500, "database_error", err.Error(), nil)
			return
		}
		_ = json.NewEncoder(w).Encode(items)
	case http.MethodPost:
		var m model.Monitor
		if !decodeJSON(w, r, &m) {
			return
		}
		normalizeMonitor(&m)
		if fields := h.validate(r.Context(), m); len(fields) > 0 {
			writeAPIError(w, 422, "validation_error", "monitor validation failed", fields)
			return
		}
		created, err := h.monitors.Create(r.Context(), m)
		if err != nil {
			writeAPIError(w, 409, "conflict", "monitor name and URL must be unique", nil)
			return
		}
		w.WriteHeader(201)
		_ = json.NewEncoder(w).Encode(created)
	default:
		methodNotAllowed(w, "GET, POST")
	}
}
func (h *MonitorAPI) item(w http.ResponseWriter, r *http.Request, id string) {
	switch r.Method {
	case http.MethodGet:
		m, err := h.monitors.Get(r.Context(), id)
		h.writeMonitor(w, m, err)
	case http.MethodPatch:
		current, err := h.monitors.Get(r.Context(), id)
		if err != nil {
			h.writeMonitor(w, current, err)
			return
		}
		if !decodeJSON(w, r, &current) {
			return
		}
		current.ID = id
		normalizeMonitor(&current)
		if fields := h.validate(r.Context(), current); len(fields) > 0 {
			writeAPIError(w, 422, "validation_error", "monitor validation failed", fields)
			return
		}
		m, err := h.monitors.Update(r.Context(), current)
		h.writeMonitor(w, m, err)
	case http.MethodDelete:
		err := h.monitors.Delete(r.Context(), id)
		if errors.Is(err, repository.ErrNotFound) {
			writeAPIError(w, 404, "not_found", "monitor not found", nil)
			return
		}
		if err != nil {
			writeAPIError(w, 500, "database_error", err.Error(), nil)
			return
		}
		w.WriteHeader(204)
	default:
		methodNotAllowed(w, "GET, PATCH, DELETE")
	}
}
func (h *MonitorAPI) check(w http.ResponseWriter, r *http.Request, id string) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w, "POST")
		return
	}
	m, err := h.monitors.Get(r.Context(), id)
	if err != nil {
		h.writeMonitor(w, m, err)
		return
	}
	result := h.checker.Check(r.Context(), m, "manual")
	if h.checks != nil {
		result, err = h.checks.Create(r.Context(), result)
		if err != nil {
			writeAPIError(w, 500, "database_error", err.Error(), nil)
			return
		}
	}
	_ = json.NewEncoder(w).Encode(result)
}
func (h *MonitorAPI) writeMonitor(w http.ResponseWriter, m model.Monitor, err error) {
	if errors.Is(err, repository.ErrNotFound) {
		writeAPIError(w, 404, "not_found", "monitor not found", nil)
		return
	}
	if err != nil {
		writeAPIError(w, 500, "database_error", err.Error(), nil)
		return
	}
	_ = json.NewEncoder(w).Encode(m)
}
func (h *MonitorAPI) validate(ctx context.Context, m model.Monitor) map[string]string {
	f := map[string]string{}
	if strings.TrimSpace(m.Name) == "" {
		f["name"] = "name is required"
	}
	if len(m.Name) > 120 {
		f["name"] = "name must be 120 characters or fewer"
	}
	if err := h.validator.Validate(ctx, m.URL); err != nil {
		f["url"] = err.Error()
	}
	if m.IntervalSeconds < 30 || m.IntervalSeconds > 86400 {
		f["interval_seconds"] = "interval must be between 30 and 86400 seconds"
	}
	if m.TimeoutSeconds < 1 || m.TimeoutSeconds > 30 {
		f["timeout_seconds"] = "timeout must be between 1 and 30 seconds"
	}
	if m.ExpectedStatus < 100 || m.ExpectedStatus > 599 {
		f["expected_status"] = "expected status must be between 100 and 599"
	}
	if len(m.Keyword) > 256 {
		f["keyword"] = "keyword must be 256 characters or fewer"
	}
	return f
}
func normalizeMonitor(m *model.Monitor) {
	m.Name = strings.TrimSpace(m.Name)
	m.URL = strings.TrimSpace(m.URL)
	m.Keyword = strings.TrimSpace(m.Keyword)
	if m.IntervalSeconds == 0 {
		m.IntervalSeconds = 60
	}
	if m.TimeoutSeconds == 0 {
		m.TimeoutSeconds = 5
	}
	if m.ExpectedStatus == 0 {
		m.ExpectedStatus = 200
	}
}
func decodeJSON(w http.ResponseWriter, r *http.Request, target any) bool {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		writeAPIError(w, 400, "invalid_json", err.Error(), nil)
		return false
	}
	return true
}
func writeAPIError(w http.ResponseWriter, status int, code, message string, fields map[string]string) {
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{"error": map[string]any{"code": code, "message": message, "fields": fields}})
}
func methodNotAllowed(w http.ResponseWriter, allow string) {
	w.Header().Set("Allow", allow)
	writeAPIError(w, 405, "method_not_allowed", "method not allowed", nil)
}
