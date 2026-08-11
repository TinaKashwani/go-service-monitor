# Pulseboard — Go Service Health Monitor

[![CI](https://github.com/TinaKashwani/go-service-monitor/actions/workflows/ci.yml/badge.svg)](https://github.com/TinaKashwani/go-service-monitor/actions/workflows/ci.yml)

Pulseboard is a single-user observability platform that schedules SSRF-safe HTTP checks, persists time-series results in PostgreSQL, opens and resolves incidents, and presents fleet health in an accessible Angular dashboard.

## Feature tour

- Persistent monitor CRUD for HTTP/HTTPS GET endpoints
- Bounded background scheduler coordinated across backend replicas
- Availability, average latency, p95 latency, and graph-ready 24h/7d/30d history
- Two-failure incident opening, one-success recovery, and 30-day raw retention
- Responsive dark overview, monitor management, detail graphs, and incident center
- Prometheus metrics, deterministic tests, Docker Compose, and GitHub Actions CI

## Architecture

```text
Browser ──same-origin /api──> Nginx/Angular ──> Go API + scheduler ──> PostgreSQL
                                                   │
                                                   └──SSRF-safe GET──> public endpoint
```

PostgreSQL is the source of truth. Timestamps are stored and returned in UTC; the browser renders them in its local timezone. Advisory locks prevent multiple backend instances from scheduling the same monitor simultaneously.

## Start locally

Requirements: Docker Desktop with Compose v2.

```powershell
docker compose up --build --wait
```

Open <http://localhost:4200>. PostgreSQL data is stored in the named `postgres_data` volume and survives container restarts. Stop without deleting data:

```powershell
docker compose down
```

Delete local data only when intentionally resetting the environment:

```powershell
docker compose down --volumes
```

### Optional public demo data

The demo profile adds Example, HTTPBin, GitHub API, and Cloudflare endpoints. These third-party services may rate-limit, change, or be unavailable and are never used by automated tests.

```powershell
docker compose --profile demo up --build --wait
```

## API

| Method | Path | Purpose |
|---|---|---|
| GET / POST | `/api/v1/monitors` | List or create monitors |
| GET / PATCH / DELETE | `/api/v1/monitors/{id}` | Read, update, or delete a monitor |
| POST | `/api/v1/monitors/{id}/check` | Run and persist an explicit manual check |
| GET | `/api/v1/monitors/{id}/history?range=24h` | Summary and ordered chart points |
| GET | `/api/v1/overview?range=24h` | Fleet summary for `24h`, `7d`, or `30d` |
| GET | `/api/v1/incidents?state=active` | Paginated active/resolved/all incidents |
| GET | `/api/v1/services/status` | Compatible legacy request-time status array |
| GET | `/health`, `/metrics` | Process health and Prometheus metrics |

A monitor contains `name`, `url`, `interval_seconds` (minimum 30), `timeout_seconds` (1–30), `expected_status`, optional `keyword`, and `enabled`. IDs are stable UUIDs.

## Security

Monitor URLs permit only absolute HTTP/HTTPS URLs without credentials or fragments. Creation and every outbound connection resolve all addresses and reject loopback, private, link-local, multicast, metadata, documentation, and reserved networks. Redirects are revalidated and capped at five. Checks cap concurrency, timeout, URL length, and response bodies (1 MiB). v1 accepts no custom headers, request bodies, or secrets.

## Development and tests

Backend:

```powershell
go vet ./...
go test ./...
go test -race ./...
go build -buildvcs=false ./cmd/server
```

Frontend and deterministic browser tests:

```powershell
cd frontend
npm.cmd ci
npm.cmd run lint
npm.cmd test -- --browsers=ChromeHeadless
npm.cmd run build
npm.cmd run test:e2e
```

Browser tests mock same-origin APIs and block reliance on public monitor availability. CI also builds images, starts Compose, waits for health checks, and smoke-tests the frontend proxy.

## Configuration

| Variable | Default / notes |
|---|---|
| `PORT` | `8080` |
| `DATABASE_URL` | Required for persistent APIs; supplied by Compose |
| `ENABLE_AD_HOC_CHECKS` | `false`; legacy `/check` remains disabled |
| `MONITORED_SERVICES` | Optional legacy status-endpoint configuration |

Development credentials in Compose are local-only defaults, not production secrets. Configure a managed PostgreSQL URL through the deployment platform in staging/production.

## Data model and operations

- `monitors`: persistent configuration and enabled state
- `check_results`: scheduled/manual source, result, code, latency, category, UTC time
- `incidents`: active/resolved lifecycle, cause, failure times, recovery, duration
- `schema_migrations`: applied migration versions

The backend refuses to start when a configured database is unavailable or migrations fail. A daily job deletes only raw checks older than 30 days. Use `docker compose logs backend database frontend` for diagnosis and `docker compose config` to validate configuration.

## v1 scope

This portfolio release is intentionally single-user, unauthenticated, and deployed from one monitoring location. It supports HTTP GET checks and in-app incident history—not external alerts, authentication, custom headers, distributed probe locations, or long-term raw retention.

## Release validation

Release candidates must pass formatting, vet, Go unit/race/build, migration/repository integration, Angular lint/unit/build, Playwright desktop/mobile and axe checks, Docker image builds, Compose health/smoke tests, and persistence across backend restart. Staging validation uses persistent PostgreSQL and the exact release commit; credentials and deployment access are supplied outside Git.
