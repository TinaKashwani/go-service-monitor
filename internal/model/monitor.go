package model

import "time"

type Monitor struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	URL             string    `json:"url"`
	IntervalSeconds int       `json:"interval_seconds"`
	TimeoutSeconds  int       `json:"timeout_seconds"`
	ExpectedStatus  int       `json:"expected_status"`
	Keyword         string    `json:"keyword,omitempty"`
	Enabled         bool      `json:"enabled"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type StoredCheck struct {
	ID            int64     `json:"id"`
	MonitorID     string    `json:"monitor_id"`
	Status        string    `json:"status"`
	StatusCode    int       `json:"status_code"`
	LatencyMS     int64     `json:"latency_ms"`
	ErrorCategory string    `json:"error_category,omitempty"`
	ErrorMessage  string    `json:"error_message,omitempty"`
	Source        string    `json:"source"`
	CheckedAt     time.Time `json:"checked_at"`
}
