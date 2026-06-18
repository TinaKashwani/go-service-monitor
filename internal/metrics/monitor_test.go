package metrics

import (
	"testing"

	"github.com/TinaKashwani/go-service-monitor/internal/model"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
)

func TestMonitorMetricsRecordsHealthyService(t *testing.T) {
	registry := prometheus.NewRegistry()
	monitorMetrics := NewMonitorMetrics(registry)

	service := model.Service{
		Name: "Healthy service",
		URL:  "https://healthy.example.com",
	}

	result := model.CheckResult{
		URL:    service.URL,
		Status: "up",
	}

	monitorMetrics.Record(service, result)

	checkCount := testutil.ToFloat64(
		monitorMetrics.ChecksTotal.WithLabelValues(
			service.Name,
			"up",
		),
	)

	if checkCount != 1 {
		t.Errorf(
			"expected check count 1, got %f",
			checkCount,
		)
	}

	upValue := testutil.ToFloat64(
		monitorMetrics.ServiceUp.WithLabelValues(
			service.Name,
		),
	)

	if upValue != 1 {
		t.Errorf(
			"expected service_up value 1, got %f",
			upValue,
		)
	}
}

func TestMonitorMetricsRecordsUnhealthyService(t *testing.T) {
	registry := prometheus.NewRegistry()
	monitorMetrics := NewMonitorMetrics(registry)

	service := model.Service{
		Name: "Unhealthy service",
		URL:  "https://unhealthy.example.com",
	}

	result := model.CheckResult{
		URL:    service.URL,
		Status: "down",
	}

	monitorMetrics.Record(service, result)

	checkCount := testutil.ToFloat64(
		monitorMetrics.ChecksTotal.WithLabelValues(
			service.Name,
			"down",
		),
	)

	if checkCount != 1 {
		t.Errorf(
			"expected check count 1, got %f",
			checkCount,
		)
	}

	upValue := testutil.ToFloat64(
		monitorMetrics.ServiceUp.WithLabelValues(
			service.Name,
		),
	)

	if upValue != 0 {
		t.Errorf(
			"expected service_up value 0, got %f",
			upValue,
		)
	}
}

func TestMonitorMetricsIncrementsCheckCounter(t *testing.T) {
	registry := prometheus.NewRegistry()
	monitorMetrics := NewMonitorMetrics(registry)

	service := model.Service{
		Name: "Example",
		URL:  "https://example.com",
	}

	result := model.CheckResult{
		URL:    service.URL,
		Status: "up",
	}

	monitorMetrics.Record(service, result)
	monitorMetrics.Record(service, result)

	checkCount := testutil.ToFloat64(
		monitorMetrics.ChecksTotal.WithLabelValues(
			service.Name,
			"up",
		),
	)

	if checkCount != 2 {
		t.Errorf(
			"expected check count 2, got %f",
			checkCount,
		)
	}
}
