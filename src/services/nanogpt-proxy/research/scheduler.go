package research

import (
	"context"
	"log"

	"github.com/robfig/cron/v3"
)

// Scheduler manages automated research tasks
type Scheduler struct {
	cron     *cron.Cron
	research *ResearchSystem
}

// NewScheduler creates a new research scheduler
func NewScheduler(research *ResearchSystem) *Scheduler {
	return &Scheduler{
		cron:     cron.New(),
		research: research,
	}
}

// Start begins the scheduled research tasks
func (s *Scheduler) Start() error {
	// Run on the 1st of each month at 2 AM
	// Cron format: minute hour day-of-month month day-of-week
	_, err := s.cron.AddFunc("0 2 1 * *", func() {
		log.Println("[SCHEDULER] Monthly research triggered")
		ctx := context.Background()

		if err := s.research.RunMonthlyResearch(ctx); err != nil {
			log.Printf("[SCHEDULER ERROR] Monthly research failed: %v", err)
		} else {
			log.Println("[SCHEDULER] Monthly research completed successfully")
		}
	})

	if err != nil {
		return err
	}

	s.cron.Start()
	log.Println("[SCHEDULER] Research scheduler started (runs 1st of each month at 2 AM)")

	return nil
}

// Stop stops the scheduler
func (s *Scheduler) Stop() {
	if s.cron != nil {
		s.cron.Stop()
		log.Println("[SCHEDULER] Research scheduler stopped")
	}
}

// TriggerNow manually triggers research immediately
func (s *Scheduler) TriggerNow() error {
	log.Println("[SCHEDULER] Manual research trigger")
	ctx := context.Background()
	return s.research.RunMonthlyResearch(ctx)
}
