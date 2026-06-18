# Go Service Monitor — Codex Instructions

## Existing project

This repository contains a Go service-monitoring backend:

`github.com/TinaKashwani/go-service-monitor`

Completed work:

1. Go API initialization
2. HTTP service health checker
3. Concurrent checks with goroutines
4. Channel-based result collection
5. Monitoring results endpoint
6. Broader backend unit tests
7. Prometheus metrics endpoint
8. Backend Docker configuration

Existing endpoints include:

* `GET /`
* `GET /health`
* `GET /check`
* `GET /api/v1/services/status`
* `GET /metrics`

The Angular frontend should primarily consume:

`GET /api/v1/services/status`

Preserve existing backend behavior and tests. Do not redesign the backend unless a small integration change is necessary.

## Goal

Extend the repository into a full-stack service-monitoring application with:

* Angular frontend
* frontend unit tests
* frontend/backend integration
* Playwright end-to-end tests
* frontend Docker configuration
* Docker Compose
* GitHub Actions CI
* staging deployment
* production deployment

Keep the Angular project under:

`frontend/`

## Required implementation order

### Phase 1 — Inspect and plan

Before modifying files:

1. Inspect the repository structure.
2. Read the Go handlers, models, tests, Dockerfile, `go.mod`, and README.
3. Confirm the JSON structure returned by `/api/v1/services/status`.
4. Determine whether local development should use an Angular proxy or backend CORS.
5. Provide a short implementation plan and list the files expected to change.

Do not modify files during this phase.

### Phase 2 — Angular frontend

Create an Angular application under `frontend/`.

Build a responsive dashboard containing:

* service name or URL
* up/down status
* HTTP status code
* response time
* checked-at timestamp
* error message
* loading state
* empty state
* API error state
* refresh button

Use typed models matching the backend JSON.

Use the relative API path:

`/api/v1/services/status`

Do not hard-code localhost URLs throughout the application.

Use an Angular development proxy forwarding `/api` to `http://localhost:8080`.

### Phase 3 — Frontend tests

Add deterministic unit tests covering:

* API request URL
* response parsing
* healthy and unhealthy services
* loading state
* empty state
* API failure state
* refresh behavior
* displayed status code, response time, and timestamp

Use mocked HTTP responses. Do not call public services during tests.

### Phase 4 — Integration and E2E

Add Playwright tests for:

* dashboard loading
* healthy and unhealthy status rendering
* refresh behavior
* empty results
* backend failure
* desktop and mobile layouts

Use mocked or controlled data rather than Google, Example.com, DNS, or public internet availability.

### Phase 5 — Frontend containerization

Add:

`frontend/Dockerfile`

Use a multi-stage build:

1. Node/Angular build stage
2. Nginx static runtime stage

Configure SPA routing fallback and proxy `/api` requests to the backend container.

### Phase 6 — Local full-stack environment

Add:

`docker-compose.yml`

Run:

* backend container
* frontend container

The application should start with:

`docker compose up --build`

Include backend health checks and predictable local ports.

### Phase 7 — GitHub Actions CI

Add:

`.github/workflows/ci.yml`

Run CI on pull requests and pushes to `main`.

Backend checks:

* Go formatting verification
* `go vet`
* Go tests
* race detector where practical
* backend build
* backend Docker image build

Frontend checks:

* dependency installation from lockfile
* linting
* unit tests
* production build
* frontend Docker image build

Integration checks:

* start required services
* wait for health checks
* run Playwright
* collect logs on failure
* clean up afterward

### Phase 8 — Deployment

Deployment order:

1. Finish local Angular frontend.
2. Finish frontend unit tests.
3. Deploy backend to staging.
4. Connect frontend to staging backend.
5. Complete integration and Playwright tests.
6. Complete Docker Compose.
7. Complete GitHub Actions CI.
8. Deploy the complete application to staging.
9. Run staging smoke and E2E tests.
10. Deploy the complete application to production.

A staging backend may be deployed before the frontend is complete.

Do not perform final production deployment until backend, frontend, integration, E2E, Docker, and CI checks pass.

## Development rules

* Work one phase at a time.
* Explain planned changes before editing files.
* List all files to create or modify.
* Preserve existing Go tests.
* Keep code beginner-readable.
* Avoid unnecessary dependencies and overengineering.
* Do not commit secrets.
* Do not hard-code deployment URLs.
* Keep automated tests independent of public internet availability.
* Run `gofmt` on modified Go files.
* Keep Angular linting and TypeScript checks passing.
* Provide verification commands after each phase.
* Suggest a focused commit message after each phase.
* Stop after each phase and wait for confirmation.
