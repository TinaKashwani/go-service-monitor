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

## Production frontend container

The Angular frontend is built from `frontend/package-lock.json` in a pinned
Node image, then served by unprivileged Nginx. Nginx serves the single-page
application on port 8080 and forwards same-origin `/api/` requests to the
backend selected with `BACKEND_URL`.

Build and run the frontend:

```bash
docker build -t go-service-monitor-frontend ./frontend
docker run --rm -p 8081:8080 \
  -e BACKEND_URL=http://host.docker.internal:8080 \
  go-service-monitor-frontend
```

On Windows PowerShell, use a backtick instead of `\` for line continuation.
Then open `http://localhost:8081`.

Verify the container:

```bash
curl http://localhost:8081/frontend-health
curl http://localhost:8081/
curl http://localhost:8081/a/nested/frontend/route
curl http://localhost:8081/api/v1/services/status
```

The health endpoint returns `ok`, both frontend routes return the Angular
application, and the API request is handled by the backend configured through
`BACKEND_URL`.
