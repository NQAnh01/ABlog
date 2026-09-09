package worker

import (
	"context"
	"log"
	"sync"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"lumina/src/domain/recommendation"
)

type Runner struct {
	db              *mongo.Database
	recommendations *recommendation.Service
	wg              sync.WaitGroup
	cancel          context.CancelFunc
}

func NewRunner(db *mongo.Database, recs *recommendation.Service) *Runner {
	return &Runner{
		db:              db,
		recommendations: recs,
	}
}

func (r *Runner) Start(ctx context.Context) {
	workerCtx, cancel := context.WithCancel(ctx)
	r.cancel = cancel

	log.Printf("[worker] Background worker runner started")

	// Job 1: Recommendation precomputation (every 10 minutes)
	r.wg.Add(1)
	go func() {
		defer r.wg.Done()
		r.runRecommendations(workerCtx)
		ticker := time.NewTicker(10 * time.Minute)
		defer ticker.Stop()

		for {
			select {
			case <-workerCtx.Done():
				return
			case <-ticker.C:
				r.runRecommendations(workerCtx)
			}
		}
	}()

	// Job 2: Session & token cleanup (every 1 hour)
	r.wg.Add(1)
	go func() {
		defer r.wg.Done()
		r.runCleanup(workerCtx)
		ticker := time.NewTicker(time.Hour)
		defer ticker.Stop()

		for {
			select {
			case <-workerCtx.Done():
				return
			case <-ticker.C:
				r.runCleanup(workerCtx)
			}
		}
	}()

	// Job 3: Scheduled publish runner (every 30 seconds)
	r.wg.Add(1)
	go func() {
		defer r.wg.Done()
		r.runScheduledPublish(workerCtx)
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-workerCtx.Done():
				return
			case <-ticker.C:
				r.runScheduledPublish(workerCtx)
			}
		}
	}()
}

func (r *Runner) Stop() {
	if r.cancel != nil {
		r.cancel()
	}
	r.wg.Wait()
	log.Printf("[worker] Background worker runner stopped gracefully")
}

func (r *Runner) runRecommendations(ctx context.Context) {
	if r.recommendations == nil {
		return
	}
	jobCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	if err := r.recommendations.PrecomputeGlobalRanking(jobCtx); err != nil {
		log.Printf("[worker] Precompute recommendations warning: %v", err)
	} else {
		log.Printf("[worker] Precomputed global recommendations successfully")
	}
}

func (r *Runner) runCleanup(ctx context.Context) {
	if r.db == nil {
		return
	}
	jobCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	now := time.Now().UTC()
	if res, err := r.db.Collection("refresh_sessions").DeleteMany(jobCtx, bson.M{"expires_at": bson.M{"$lt": now}}); err == nil && res.DeletedCount > 0 {
		log.Printf("[worker] Cleaned up %d expired refresh sessions", res.DeletedCount)
	}

	if res, err := r.db.Collection("password_resets").DeleteMany(jobCtx, bson.M{"expires_at": bson.M{"$lt": now}}); err == nil && res.DeletedCount > 0 {
		log.Printf("[worker] Cleaned up %d expired password resets", res.DeletedCount)
	}
}

func (r *Runner) runScheduledPublish(ctx context.Context) {
	if r.db == nil {
		return
	}
	jobCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	now := time.Now().UTC()
	res, err := r.db.Collection("posts").UpdateMany(jobCtx,
		bson.M{
			"status":       "scheduled",
			"published_at": bson.M{"$lte": now},
		},
		bson.M{
			"$set": bson.M{
				"status":     "public",
				"updated_at": now,
			},
		},
	)
	if err == nil && res.ModifiedCount > 0 {
		log.Printf("[worker] Automatically published %d scheduled post(s)", res.ModifiedCount)
	}
}
