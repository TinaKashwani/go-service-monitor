package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/TinaKashwani/go-service-monitor/internal/database"
	"github.com/TinaKashwani/go-service-monitor/internal/model"
)

func TestPostgresRepositoryIntegration(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is not set")
	}
	ctx := context.Background()
	pool, err := database.Open(ctx, databaseURL, 10*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	if err := database.Migrate(ctx, pool); err != nil {
		t.Fatal(err)
	}
	repo := NewPostgresMonitors(pool)
	name := fmt.Sprintf("integration-%d", time.Now().UnixNano())
	created, err := repo.Create(ctx, model.Monitor{Name: name, URL: "https://example.com/" + name, IntervalSeconds: 60, TimeoutSeconds: 5, ExpectedStatus: 200, Enabled: true})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = repo.Delete(ctx, created.ID) })
	if created.ID == "" || created.CreatedAt.Location() != time.UTC {
		t.Fatalf("expected UUID and UTC timestamp, got %#v", created)
	}
	created.Enabled = false
	updated, err := repo.Update(ctx, created)
	if err != nil || updated.Enabled {
		t.Fatalf("update failed: %#v %v", updated, err)
	}
	checks := NewPostgresChecks(pool)
	checkedAt := time.Now().Add(-31 * 24 * time.Hour).In(time.FixedZone("test", -3*60*60)).Truncate(time.Microsecond)
	stored, err := checks.Create(ctx, model.StoredCheck{MonitorID: created.ID, Status: "up", StatusCode: 200, LatencyMS: 12, Source: "manual", CheckedAt: checkedAt})
	if err != nil || stored.ID == 0 || !stored.CheckedAt.Equal(checkedAt.UTC()) {
		t.Fatalf("check persistence failed: %#v %v", stored, err)
	}
	if _, err := repo.Create(ctx, model.Monitor{Name: name, URL: "https://unique.example", IntervalSeconds: 60, TimeoutSeconds: 5, ExpectedStatus: 200, Enabled: true}); err == nil {
		t.Fatal("expected unique-name constraint")
	}

	// Migrations are repeatable and an empty range is a usable JSON array.
	if err := database.Migrate(ctx, pool); err != nil {
		t.Fatal(err)
	}
	history := NewPostgresHistory(pool)
	start := time.Now().UTC().Truncate(time.Second)
	empty, err := history.Summary(ctx, created.ID, start)
	if err != nil {
		t.Fatal(err)
	}
	payload, err := json.Marshal(empty)
	if err != nil {
		t.Fatal(err)
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(payload, &fields); err != nil || string(fields["points"]) != "[]" {
		t.Fatalf("empty history must serialize points as [], got %s: %v", payload, err)
	}

	// One failure does not open an incident; the second opens one, further
	// failures extend it, and a successful scheduled check resolves it.
	for index, status := range []string{"down", "down", "down", "up"} {
		code, category := 503, "unexpected_status"
		if status == "up" {
			code, category = 200, ""
		}
		_, err := checks.Create(ctx, model.StoredCheck{MonitorID: created.ID, Status: status, StatusCode: code, LatencyMS: 10, ErrorCategory: category, Source: "scheduled", CheckedAt: start.Add(time.Duration(index) * time.Minute)})
		if err != nil {
			t.Fatal(err)
		}
		var active int
		if err := pool.QueryRow(ctx, `SELECT count(*) FROM incidents WHERE monitor_id=$1 AND state='active'`, created.ID).Scan(&active); err != nil {
			t.Fatal(err)
		}
		want := 0
		if index == 1 || index == 2 {
			want = 1
		}
		if active != want {
			t.Fatalf("after check %d: active incidents = %d, want %d", index+1, active, want)
		}
	}
	var first, last, recovered time.Time
	var duration int64
	if err := pool.QueryRow(ctx, `SELECT first_failure_at,last_failure_at,resolved_at,duration_seconds FROM incidents WHERE monitor_id=$1 AND state='resolved'`, created.ID).Scan(&first, &last, &recovered, &duration); err != nil {
		t.Fatal(err)
	}
	if !first.Equal(start) || !last.Equal(start.Add(2*time.Minute)) || !recovered.Equal(start.Add(3*time.Minute)) || duration != 120 {
		t.Fatalf("incorrect incident timeline: first=%v last=%v recovery=%v duration=%d", first, last, recovered, duration)
	}
	// A new pool represents a backend restart: persisted data survives it.
	reopened, err := database.Open(ctx, databaseURL, 10*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(reopened.Close)
	summary, err := NewPostgresHistory(reopened).Summary(ctx, created.ID, start)
	if err != nil || summary.CheckCount != 4 || summary.Uptime != 25 || summary.Status != "up" || len(summary.Points) != 4 {
		t.Fatalf("persisted recovery summary: %#v, %v", summary, err)
	}
	// The older manual check is pruned; the recent recovery history survives.
	if _, err := checks.DeleteOlderThan(ctx, start.Add(-30*24*time.Hour)); err != nil {
		t.Fatal(err)
	}
	var remaining int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM check_results WHERE monitor_id=$1`, created.ID).Scan(&remaining); err != nil || remaining != 4 {
		t.Fatalf("retention left %d checks, want 4: %v", remaining, err)
	}
}

func TestClaimDueLocksOnlyReturnedMonitors(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is not set")
	}
	ctx := context.Background()
	pool, err := database.Open(ctx, databaseURL, 10*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	if err := database.Migrate(ctx, pool); err != nil {
		t.Fatal(err)
	}

	repo := NewPostgresMonitors(pool)
	created := make([]model.Monitor, 0, 3)
	for index := 0; index < 3; index++ {
		name := fmt.Sprintf("claim-limit-%d-%d", time.Now().UnixNano(), index)
		monitor, err := repo.Create(ctx, model.Monitor{
			Name: name, URL: "https://example.com/" + name, IntervalSeconds: 60,
			TimeoutSeconds: 5, ExpectedStatus: 200, Enabled: true,
		})
		if err != nil {
			t.Fatal(err)
		}
		created = append(created, monitor)
	}
	t.Cleanup(func() {
		for _, monitor := range created {
			_ = repo.Delete(ctx, monitor.ID)
		}
	})

	conn, claimed, err := repo.ClaimDue(ctx, 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(claimed) != 1 {
		conn.Release()
		t.Fatalf("claimed %d monitors, want 1", len(claimed))
	}
	defer repo.ReleaseClaims(context.Background(), conn, claimed)

	var held int
	if err := conn.QueryRow(ctx, `SELECT count(*) FROM pg_locks
		WHERE locktype='advisory' AND pid=pg_backend_pid() AND granted`).Scan(&held); err != nil {
		t.Fatal(err)
	}
	if held != len(claimed) {
		t.Fatalf("session holds %d advisory locks for %d claimed monitors", held, len(claimed))
	}
}
