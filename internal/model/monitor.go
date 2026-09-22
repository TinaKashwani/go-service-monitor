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

type HistoryPoint struct {
	CheckedAt     time.Time `json:"checked_at"`
	Status        string    `json:"status"`
	StatusCode    int       `json:"status_code"`
	LatencyMS     int64     `json:"latency_ms"`
	ErrorCategory string    `json:"error_category,omitempty"`
}
type MonitorSummary struct {
	Monitor          Monitor        `json:"monitor"`
	Status           string         `json:"status"`
	Uptime           float64        `json:"uptime"`
	AverageLatencyMS float64        `json:"average_latency_ms"`
	P95LatencyMS     float64        `json:"p95_latency_ms"`
	CheckCount       int64          `json:"check_count"`
	Points           []HistoryPoint `json:"points"`
}
type Overview struct {
	Range            string           `json:"range"`
	TotalMonitors    int              `json:"total_monitors"`
	EnabledMonitors  int              `json:"enabled_monitors"`
	ActiveIncidents  int              `json:"active_incidents"`
	Uptime           float64          `json:"uptime"`
	AverageLatencyMS float64          `json:"average_latency_ms"`
	Monitors         []MonitorSummary `json:"monitors"`
}
type Incident struct {
	ID              string     `json:"id"`
	MonitorID       string     `json:"monitor_id"`
	MonitorName     string     `json:"monitor_name"`
	State           string     `json:"state"`
	Cause           string     `json:"cause"`
	FirstFailureAt  time.Time  `json:"first_failure_at"`
	LastFailureAt   time.Time  `json:"last_failure_at"`
	OpenedAt        time.Time  `json:"opened_at"`
	ResolvedAt      *time.Time `json:"resolved_at,omitempty"`
	DurationSeconds *int64     `json:"duration_seconds,omitempty"`
}
