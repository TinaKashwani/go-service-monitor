package metrics

import (
	"github.com/TinaKashwani/go-service-monitor/internal/model"
	"github.com/prometheus/client_golang/prometheus"
)

// MonitorMetrics contains Prometheus metrics for service checks.
type MonitorMetrics struct {
	ChecksTotal *prometheus.CounterVec
	ServiceUp   *prometheus.GaugeVec
}

// NewMonitorMetrics creates and registers service-monitoring metrics.
func NewMonitorMetrics(
	registerer prometheus.Registerer,
) *MonitorMetrics {
	if registerer == nil {
		registerer = prometheus.DefaultRegisterer
	}

	monitorMetrics := &MonitorMetrics{
		ChecksTotal: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "service_monitor",
				Name:      "checks_total",
				Help:      "Total number of service health checks.",
			},
			[]string{"service", "status"},
		),
		ServiceUp: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: "service_monitor",
				Name:      "service_up",
				Help:      "Whether the monitored service is currently up.",
			},
			[]string{"service"},
		),
	}

	registerer.MustRegister(
		monitorMetrics.ChecksTotal,
		monitorMetrics.ServiceUp,
	)

	return monitorMetrics
}

// Record records the result of a service health check.
func (m *MonitorMetrics) Record(
	service model.Service,
	result model.CheckResult,
) {
	m.ChecksTotal.WithLabelValues(
		service.Name,
		result.Status,
	).Inc()

	upValue := 0.0

	if result.Status == "up" {
		upValue = 1
	}

	m.ServiceUp.WithLabelValues(
		service.Name,
	).Set(upValue)
}
