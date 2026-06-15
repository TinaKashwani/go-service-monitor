package model

// Service represents an external service that should be monitored.
type Service struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}
