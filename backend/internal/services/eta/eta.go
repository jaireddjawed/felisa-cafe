// Package eta estimates when an order will be ready for pickup.
//
// # Algorithm (deliberately simple and explainable)
//
// Every paid order that is not yet ready is work in the queue. An order's
// work is
//
//	BasePrep + PerItem × (made-to-order items)
//
// where made-to-order items are drinks (signature and matcha categories);
// pantry goods and merch are handed over off the shelf and add no work. An
// order with no made-to-order items is ready after Buffer.
//
// The queue is worked FIFO (by payment time) by Capacity baristas in
// parallel: each order goes to whichever barista frees up first. The new
// order is scheduled the same way behind the queue, and Buffer is added on
// top for hand-off. The result is rounded up to the next minute.
//
// Limits, on purpose: orders already "preparing" are counted as a full
// unit of work (we don't know how far along they are), walk-in POS orders
// only count if they were placed through this app, and business hours are
// not modelled. It is an estimate, and presented as one.
//
// Everything is behind the Estimator interface, so a better model can
// replace QueueEstimator without touching checkout or order code.
package eta

import (
	"context"
	"slices"
	"time"

	"felisa-cafe/backend/internal/models"
)

type Estimator interface {
	Estimate(ctx context.Context, items []models.OrderItem) (time.Time, error)
}

type Config struct {
	BasePrep time.Duration // fixed work per order with drinks
	PerItem  time.Duration // work per made-to-order item
	Buffer   time.Duration // hand-off slack added to every estimate
	Capacity int           // orders prepared in parallel
}

func DefaultConfig() Config {
	return Config{BasePrep: 2 * time.Minute, PerItem: 90 * time.Second, Buffer: 2 * time.Minute, Capacity: 2}
}

// QueueSource lists paid, not-yet-ready orders in queue order.
type QueueSource interface {
	ListInQueue(ctx context.Context) ([]models.Order, error)
}

type QueueEstimator struct {
	cfg   Config
	queue QueueSource
	now   func() time.Time
}

func NewQueueEstimator(cfg Config, queue QueueSource) *QueueEstimator {
	if cfg.Capacity < 1 {
		cfg.Capacity = 1
	}
	return &QueueEstimator{cfg: cfg, queue: queue, now: time.Now}
}

func (e *QueueEstimator) Estimate(ctx context.Context, items []models.OrderItem) (time.Time, error) {
	queued, err := e.queue.ListInQueue(ctx)
	if err != nil {
		return time.Time{}, err
	}
	return Schedule(e.cfg, e.now(), queued, items), nil
}

// Schedule is the pure core of QueueEstimator.
func Schedule(cfg Config, now time.Time, queue []models.Order, items []models.OrderItem) time.Time {
	capacity := max(cfg.Capacity, 1)
	free := make([]time.Time, capacity) // when each barista is next free
	for i := range free {
		free[i] = now
	}
	assign := func(work time.Duration) time.Time {
		i := slices.IndexFunc(free, func(t time.Time) bool { return t.Equal(slices.MinFunc(free, time.Time.Compare)) })
		free[i] = free[i].Add(work)
		return free[i]
	}
	for _, o := range queue {
		if w := cfg.work(o.Items); w > 0 {
			assign(w)
		}
	}

	ready := now
	if w := cfg.work(items); w > 0 {
		ready = assign(w)
	}
	return ceilMinute(ready.Add(cfg.Buffer))
}

func (cfg Config) work(items []models.OrderItem) time.Duration {
	n := models.PrepUnits(items)
	if n == 0 {
		return 0
	}
	return cfg.BasePrep + time.Duration(n)*cfg.PerItem
}

func ceilMinute(t time.Time) time.Time {
	if r := t.Truncate(time.Minute); !r.Equal(t) {
		return r.Add(time.Minute)
	}
	return t
}
