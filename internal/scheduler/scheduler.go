package scheduler

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/TinaKashwani/go-service-monitor/internal/model"
	"github.com/TinaKashwani/go-service-monitor/internal/repository"
	"github.com/TinaKashwani/go-service-monitor/internal/security"
)

type Scheduler struct {
	monitors *repository.PostgresMonitors
	checks   *repository.PostgresChecks
	checker  *security.SafeChecker
	workers  int
	poll     time.Duration
	logger   *log.Logger
}

func New(monitors *repository.PostgresMonitors, checks *repository.PostgresChecks, checker *security.SafeChecker, workers int, poll time.Duration, logger *log.Logger) *Scheduler {
	if workers < 1 {
		workers = 1
	}
	if poll <= 0 {
		poll = 5 * time.Second
	}
	return &Scheduler{monitors: monitors, checks: checks, checker: checker, workers: workers, poll: poll, logger: logger}
}
func (s *Scheduler) Run(ctx context.Context) {
	s.runDue(ctx)
	ticker := time.NewTicker(s.poll)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.runDue(ctx)
		}
	}
}
func (s *Scheduler) runDue(ctx context.Context) {
	conn, items, err := s.monitors.ClaimDue(ctx, s.workers)
	if err != nil {
		if ctx.Err() == nil {
			s.logger.Printf("scheduler: claim monitors: %v", err)
		}
		return
	}
	if len(items) == 0 {
		conn.Release()
		return
	}
	defer s.monitors.ReleaseClaims(context.Background(), conn, items)
	jobs := make(chan model.Monitor)
	var wg sync.WaitGroup
	for i := 0; i < s.workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for monitor := range jobs {
				result := s.checker.Check(ctx, monitor, "scheduled")
				if _, err := s.checks.Create(ctx, result); err != nil && ctx.Err() == nil {
					s.logger.Printf("scheduler: store result for %s: %v", monitor.ID, err)
				}
			}
		}()
	}
	for _, monitor := range items {
		select {
		case jobs <- monitor:
		case <-ctx.Done():
			close(jobs)
			wg.Wait()
			return
		}
	}
	close(jobs)
	wg.Wait()
}
