package eta

import (
	"testing"
	"time"

	"felisa-cafe/backend/internal/models"
)

var (
	now = time.Date(2026, 9, 19, 9, 0, 0, 0, time.UTC)
	cfg = Config{BasePrep: 2 * time.Minute, PerItem: 90 * time.Second, Buffer: 2 * time.Minute, Capacity: 2}
)

func drinks(n int64) []models.OrderItem {
	return []models.OrderItem{{Category: models.CategorySignature, Quantity: n}}
}

func order(items []models.OrderItem) models.Order { return models.Order{Items: items} }

func TestSchedule(t *testing.T) {
	cases := map[string]struct {
		queue []models.Order
		items []models.OrderItem
		want  time.Duration
	}{
		// 2m base + 2×1.5m + 2m buffer = 7m
		"empty queue": {nil, drinks(2), 7 * time.Minute},
		// 2m + 1.5m + 2m = 5.5m, rounded up to the minute
		"rounds up": {nil, drinks(1), 6 * time.Minute},
		// Two baristas: one order in flight leaves the other free.
		"spare capacity": {[]models.Order{order(drinks(4))}, drinks(2), 7 * time.Minute},
		// Both busy (8m and 5m of work): start when the first frees up (5m).
		"queued behind": {[]models.Order{order(drinks(4)), order(drinks(2))}, drinks(2), 12 * time.Minute},
		// Retail goods need no preparation, and don't slow the queue.
		"retail only":         {[]models.Order{order(drinks(4)), order(drinks(4))}, []models.OrderItem{{Category: models.CategoryMerch, Quantity: 3}}, 2 * time.Minute},
		"retail in the queue": {[]models.Order{order([]models.OrderItem{{Category: models.CategoryPantry, Quantity: 5}})}, drinks(1), 6 * time.Minute},
	}
	for name, tc := range cases {
		got := Schedule(cfg, now, tc.queue, tc.items)
		if want := now.Add(tc.want); !got.Equal(want) {
			t.Errorf("%s: ready at +%v, want +%v", name, got.Sub(now), tc.want)
		}
	}
}

func TestScheduleCapacityOne(t *testing.T) {
	c := cfg
	c.Capacity = 0 // treated as 1
	got := Schedule(c, now, []models.Order{order(drinks(2)), order(drinks(2))}, drinks(2))
	// Three 5m jobs back to back + 2m buffer.
	if want := now.Add(17 * time.Minute); !got.Equal(want) {
		t.Errorf("ready at +%v", got.Sub(now))
	}
}
