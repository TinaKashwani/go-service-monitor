package repository

import (
	"context"
	"errors"
	"time"

	"github.com/TinaKashwani/go-service-monitor/internal/model"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("not found")

type MonitorRepository interface {
	Create(context.Context, model.Monitor) (model.Monitor, error)
	List(context.Context) ([]model.Monitor, error)
	Get(context.Context, string) (model.Monitor, error)
	Update(context.Context, model.Monitor) (model.Monitor, error)
	Delete(context.Context, string) error
}

type PostgresMonitors struct{ pool *pgxpool.Pool }

func NewPostgresMonitors(pool *pgxpool.Pool) *PostgresMonitors { return &PostgresMonitors{pool: pool} }

const monitorColumns = `id::text,name,url,interval_seconds,timeout_seconds,expected_status,COALESCE(keyword,''),enabled,created_at,updated_at`

func scanMonitor(row pgx.Row) (model.Monitor, error) {
	var m model.Monitor
	err := row.Scan(&m.ID, &m.Name, &m.URL, &m.IntervalSeconds, &m.TimeoutSeconds, &m.ExpectedStatus, &m.Keyword, &m.Enabled, &m.CreatedAt, &m.UpdatedAt)
	m.CreatedAt = m.CreatedAt.UTC()
	m.UpdatedAt = m.UpdatedAt.UTC()
	return m, err
}
func (r *PostgresMonitors) Create(ctx context.Context, m model.Monitor) (model.Monitor, error) {
	return scanMonitor(r.pool.QueryRow(ctx, `INSERT INTO monitors(name,url,interval_seconds,timeout_seconds,expected_status,keyword,enabled) VALUES($1,$2,$3,$4,$5,NULLIF($6,''),$7) RETURNING `+monitorColumns, m.Name, m.URL, m.IntervalSeconds, m.TimeoutSeconds, m.ExpectedStatus, m.Keyword, m.Enabled))
}
func (r *PostgresMonitors) List(ctx context.Context) ([]model.Monitor, error) {
	rows, err := r.pool.Query(ctx, `SELECT `+monitorColumns+` FROM monitors ORDER BY created_at,id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []model.Monitor{}
	for rows.Next() {
		m, err := scanMonitor(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, m)
	}
	return items, rows.Err()
}
func (r *PostgresMonitors) Get(ctx context.Context, id string) (model.Monitor, error) {
	m, err := scanMonitor(r.pool.QueryRow(ctx, `SELECT `+monitorColumns+` FROM monitors WHERE id=$1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		err = ErrNotFound
	}
	return m, err
}
func (r *PostgresMonitors) Update(ctx context.Context, m model.Monitor) (model.Monitor, error) {
	m, err := scanMonitor(r.pool.QueryRow(ctx, `UPDATE monitors SET name=$2,url=$3,interval_seconds=$4,timeout_seconds=$5,expected_status=$6,keyword=NULLIF($7,''),enabled=$8,updated_at=now() WHERE id=$1 RETURNING `+monitorColumns, m.ID, m.Name, m.URL, m.IntervalSeconds, m.TimeoutSeconds, m.ExpectedStatus, m.Keyword, m.Enabled))
	if errors.Is(err, pgx.ErrNoRows) {
		err = ErrNotFound
	}
	return m, err
}
func (r *PostgresMonitors) Delete(ctx context.Context, id string) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM monitors WHERE id=$1`, id)
	if err == nil && tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return err
}

type PostgresChecks struct{ pool *pgxpool.Pool }

func NewPostgresChecks(pool *pgxpool.Pool) *PostgresChecks { return &PostgresChecks{pool: pool} }
func (r *PostgresChecks) Create(ctx context.Context, c model.StoredCheck) (model.StoredCheck, error) {
	c.CheckedAt = c.CheckedAt.UTC()
	err := r.pool.QueryRow(ctx, `INSERT INTO check_results(monitor_id,status,status_code,latency_ms,error_category,error_message,source,checked_at) VALUES($1,$2,$3,$4,NULLIF($5,''),NULLIF($6,''),$7,$8) RETURNING id`, c.MonitorID, c.Status, c.StatusCode, c.LatencyMS, c.ErrorCategory, c.ErrorMessage, c.Source, c.CheckedAt).Scan(&c.ID)
	return c, err
}
func (r *PostgresChecks) DeleteOlderThan(ctx context.Context, cutoff time.Time) (int64, error) {
	tag, err := r.pool.Exec(ctx, `DELETE FROM check_results WHERE checked_at < $1`, cutoff.UTC())
	return tag.RowsAffected(), err
}
