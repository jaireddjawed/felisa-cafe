package database

import (
	"context"

	"felisa-cafe/backend/internal/database/internal/schema"
	"felisa-cafe/backend/internal/models"
)

// WebhookEventRepo remembers which webhook event IDs have been processed,
// so redelivered events are acknowledged without being reprocessed.
type WebhookEventRepo struct {
	events table[schema.WebhookEventsRecord, *schema.WebhookEventsRecord]
}

func (r WebhookEventRepo) Seen(ctx context.Context, eventID string) (bool, error) {
	return r.events.Query().Where(schema.WebhookEvents.EventID.Eq(eventID)).Exists(ctx)
}

// MarkProcessed records eventID. Recording an already-recorded event (two
// deliveries racing) is not an error.
func (r WebhookEventRepo) MarkProcessed(ctx context.Context, eventID, eventType string) error {
	rec, err := r.events.New()
	if err != nil {
		return err
	}
	rec.SetEventID(eventID)
	rec.SetEventType(eventType)
	if err := r.events.Save(ctx, rec); err != nil {
		if seen, seenErr := r.Seen(ctx, eventID); seenErr == nil && seen {
			return nil
		}
		return err
	}
	return nil
}

// UserRepo reads customer accounts. Account creation and authentication go
// through PocketBase's built-in auth API.
type UserRepo struct {
	users table[schema.UsersRecord, *schema.UsersRecord]
}

func (r UserRepo) FindByID(ctx context.Context, id models.UserID) (models.User, error) {
	rec, err := r.users.FindByID(ctx, string(id))
	if err != nil {
		return models.User{}, err
	}
	return models.User{
		ID:    models.UserID(rec.ID()),
		Email: rec.Email(),
		Name:  rec.Name(),
		Phone: rec.Phone(),
	}, nil
}
