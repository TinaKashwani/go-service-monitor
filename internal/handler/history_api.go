package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/TinaKashwani/go-service-monitor/internal/repository"
)

type HistoryAPI struct{ repo *repository.PostgresHistory }

func NewHistoryAPI(repo *repository.PostgresHistory) *HistoryAPI { return &HistoryAPI{repo: repo} }
func (h *HistoryAPI) Overview(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, "GET")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	name, duration, ok := readRange(w, r)
	if !ok {
		return
	}
	value, err := h.repo.Overview(r.Context(), name, time.Now().UTC().Add(-duration))
	if err != nil {
		writeAPIError(w, 500, "database_error", err.Error(), nil)
		return
	}
	_ = json.NewEncoder(w).Encode(value)
}
func (h *HistoryAPI) History(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, "GET")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	id := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/api/v1/monitors/"), "/history")
	name, duration, ok := readRange(w, r)
	_ = name
	if !ok {
		return
	}
	value, err := h.repo.Summary(r.Context(), id, time.Now().UTC().Add(-duration))
	if err == repository.ErrNotFound {
		writeAPIError(w, 404, "not_found", "monitor not found", nil)
		return
	}
	if err != nil {
		writeAPIError(w, 500, "database_error", err.Error(), nil)
		return
	}
	_ = json.NewEncoder(w).Encode(value)
}
func (h *HistoryAPI) Incidents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, "GET")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	items, err := h.repo.Incidents(r.Context(), r.URL.Query().Get("state"), 50, (page-1)*50)
	if err != nil {
		writeAPIError(w, 400, "invalid_query", err.Error(), nil)
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"items": items, "page": page})
}
func readRange(w http.ResponseWriter, r *http.Request) (string, time.Duration, bool) {
	name := r.URL.Query().Get("range")
	if name == "" {
		name = "24h"
	}
	duration, err := repository.RangeDuration(name)
	if err != nil {
		writeAPIError(w, 400, "invalid_query", err.Error(), nil)
		return name, 0, false
	}
	return name, duration, true
}
