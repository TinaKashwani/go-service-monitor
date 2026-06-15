package model

import "time"

// CheckResult represents the result of checking one external service.
type CheckResult struct {
	URL            string        `json:"url"`
	Status         string        `json:"status"`
	StatusCode     int           `json:"status_code"`
	ResponseTime   time.Duration `json:"response_time"`
	ResponseTimeMS int64         `json:"response_time_ms"`
	CheckedAt      time.Time     `json:"checked_at"`
	Error          string        `json:"error,omitempty"`
}
