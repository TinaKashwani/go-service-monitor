CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE monitors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    url text NOT NULL,
    interval_seconds integer NOT NULL DEFAULT 60 CHECK (interval_seconds >= 30),
    timeout_seconds integer NOT NULL DEFAULT 5 CHECK (timeout_seconds BETWEEN 1 AND 30),
    expected_status integer NOT NULL DEFAULT 200 CHECK (expected_status BETWEEN 100 AND 599),
    keyword text,
    enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT monitors_name_unique UNIQUE (name),
    CONSTRAINT monitors_url_unique UNIQUE (url)
);

CREATE TABLE check_results (
    id bigserial PRIMARY KEY,
    monitor_id uuid NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    status text NOT NULL CHECK (status IN ('up', 'down')),
    status_code integer NOT NULL DEFAULT 0,
    latency_ms bigint NOT NULL DEFAULT 0 CHECK (latency_ms >= 0),
    error_category text,
    error_message text,
    source text NOT NULL DEFAULT 'scheduled' CHECK (source IN ('scheduled', 'manual')),
    checked_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX check_results_monitor_checked_idx ON check_results (monitor_id, checked_at DESC);

CREATE TABLE incidents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    monitor_id uuid NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    state text NOT NULL CHECK (state IN ('active', 'resolved')),
    cause text NOT NULL,
    first_failure_at timestamptz NOT NULL,
    last_failure_at timestamptz NOT NULL,
    opened_at timestamptz NOT NULL,
    resolved_at timestamptz,
    duration_seconds bigint,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX incidents_one_active_per_monitor ON incidents (monitor_id) WHERE state = 'active';
CREATE INDEX incidents_state_opened_idx ON incidents (state, opened_at DESC);
