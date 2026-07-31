# Go Service Monitor

A service health and latency monitoring API built with Go.

The application will perform concurrent HTTP health checks, measure service
response times, expose monitoring results through a REST API, and provide
Prometheus-compatible metrics.

## Current features

- Go HTTP server
- JSON API responses
- Health endpoint
- Environment-based port configuration
- Cloud deployment support

## Planned features

- Concurrent service checks using goroutines
- Communication through Go channels
- Request timeouts and context cancellation
- Service availability and latency tracking
- Prometheus metrics
- Structured logging
- Unit and integration tests
- Docker support

## Run locally

```bash
go run ./cmd/server
```

The server listens on `PORT` (default `8080`). It exposes:

- `GET /` for API information
- `GET /health` for a lightweight process health check
- `GET /api/v1/services/status` for configured service checks
- `GET /metrics` for Prometheus metrics

All public endpoints reject non-`GET` methods with `405 Method Not Allowed`.
The health endpoint does not make outbound requests.

## Ad hoc checks

`GET /check` is disabled by default to prevent the public API from being used
to make arbitrary outbound requests. Disabled requests return `404`.

For trusted local environments only, enable it at startup:

```powershell
$env:ENABLE_AD_HOC_CHECKS = "true"
go run ./cmd/server
Invoke-RestMethod "http://localhost:8080/check?url=https://example.com"
```

Only absolute `http` and `https` URLs with a hostname are accepted. Restart the
server after changing the environment variable.

The server applies read-header, read, write, and idle timeouts. `SIGINT` and
`SIGTERM` trigger graceful shutdown with a bounded deadline.
