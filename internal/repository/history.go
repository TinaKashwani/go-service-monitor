package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/TinaKashwani/go-service-monitor/internal/model"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresHistory struct{ pool *pgxpool.Pool }

func NewPostgresHistory(pool *pgxpool.Pool) *PostgresHistory { return &PostgresHistory{pool: pool} }
func RangeDuration(value string) (time.Duration, error) {
	switch value {
	case "", "24h":
		return 24 * time.Hour, nil
	case "7d":
		return 7 * 24 * time.Hour, nil
	case "30d":
		return 30 * 24 * time.Hour, nil
	default:
		return 0, fmt.Errorf("range must be 24h, 7d, or 30d")
	}
}
func (r *PostgresHistory) Summary(ctx context.Context, id string, since time.Time) (model.MonitorSummary, error) {
	m, err := NewPostgresMonitors(r.pool).Get(ctx, id)
	if err != nil {
		return model.MonitorSummary{}, err
	}
	s := model.MonitorSummary{Monitor: m, Points: []model.HistoryPoint{}}
	err = r.pool.QueryRow(ctx, `SELECT COALESCE(100.0*count(*) FILTER(WHERE status='up')/NULLIF(count(*),0),0),COALESCE(avg(latency_ms),0),COALESCE(percentile_cont(.95) WITHIN GROUP(ORDER BY latency_ms),0),count(*) FROM check_results WHERE monitor_id=$1 AND checked_at >= $2`, id, since.UTC()).Scan(&s.Uptime, &s.AverageLatencyMS, &s.P95LatencyMS, &s.CheckCount)
	if err != nil {
		return s, err
	}
	rows, err := r.pool.Query(ctx, `SELECT checked_at,status,status_code,latency_ms,COALESCE(error_category,'') FROM check_results WHERE monitor_id=$1 AND checked_at >= $2 ORDER BY checked_at`, id, since.UTC())
	if err != nil {
		return s, err
	}
	defer rows.Close()
	for rows.Next() {
		var p model.HistoryPoint
		if err := rows.Scan(&p.CheckedAt, &p.Status, &p.StatusCode, &p.LatencyMS, &p.ErrorCategory); err != nil {
			return s, err
		}
		p.CheckedAt = p.CheckedAt.UTC()
		s.Points = append(s.Points, p)
		s.Status = p.Status
	}
	return s, rows.Err()
}
func (r *PostgresHistory) Overview(ctx context.Context, rangeName string, since time.Time) (model.Overview, error) {
	o := model.Overview{Range: rangeName, Monitors: []model.MonitorSummary{}}
	if err := r.pool.QueryRow(ctx, `SELECT count(*),count(*) FILTER(WHERE enabled) FROM monitors`).Scan(&o.TotalMonitors, &o.EnabledMonitors); err != nil {
		return o, err
	}
	_ = r.pool.QueryRow(ctx, `SELECT count(*) FROM incidents WHERE state='active'`).Scan(&o.ActiveIncidents)
	_ = r.pool.QueryRow(ctx, `SELECT COALESCE(100.0*count(*) FILTER(WHERE status='up')/NULLIF(count(*),0),0),COALESCE(avg(latency_ms),0) FROM check_results WHERE checked_at >= $1`, since.UTC()).Scan(&o.Uptime, &o.AverageLatencyMS)
	items, err := NewPostgresMonitors(r.pool).List(ctx)
	if err != nil {
		return o, err
	}
	for _, m := range items {
		s, err := r.Summary(ctx, m.ID, since)
		if err != nil {
			return o, err
		}
		s.Points = nil
		o.Monitors = append(o.Monitors, s)
	}
	return o, nil
}
func (r *PostgresHistory) Incidents(ctx context.Context, state string, limit, offset int) ([]model.Incident, error) {
	if state == "" {
		state = "all"
	}
	if state != "all" && state != "active" && state != "resolved" {
		return nil, fmt.Errorf("state must be active, resolved, or all")
	}
	rows, err := r.pool.Query(ctx, `SELECT i.id::text,i.monitor_id::text,m.name,i.state,i.cause,i.first_failure_at,i.last_failure_at,i.opened_at,i.resolved_at,i.duration_seconds FROM incidents i JOIN monitors m ON m.id=i.monitor_id WHERE ($1='all' OR i.state=$1) ORDER BY i.opened_at DESC LIMIT $2 OFFSET $3`, state, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []model.Incident{}
	for rows.Next() {
		var i model.Incident
		if err := rows.Scan(&i.ID, &i.MonitorID, &i.MonitorName, &i.State, &i.Cause, &i.FirstFailureAt, &i.LastFailureAt, &i.OpenedAt, &i.ResolvedAt, &i.DurationSeconds); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}
