package square

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	sq "github.com/square/square-go-sdk/v4"

	"felisa-cafe/backend/internal/models"
	"felisa-cafe/backend/internal/providers/payments"
)

// SignatureHeader carries the HMAC-SHA256 signature of a Square webhook.
const SignatureHeader = "X-Square-Hmacsha256-Signature"

// ParseWebhook verifies a delivery's signature and decodes it. Signature
// verification uses the SDK's implementation of Square's documented scheme:
// base64(HMAC-SHA256(signature key, notification URL + raw body)).
func (c *Client) ParseWebhook(ctx context.Context, body []byte, signature string) (*payments.WebhookEvent, error) {
	if c.cfg.WebhookSignatureKey == "" || c.cfg.WebhookURL == "" {
		return nil, fmt.Errorf("%w: SQUARE_WEBHOOK_SIGNATURE_KEY and SQUARE_WEBHOOK_URL are required for webhooks", payments.ErrNotConfigured)
	}
	// The SDK treats an empty body as trivially valid; we never do.
	if len(body) == 0 || signature == "" {
		return nil, payments.ErrInvalidSignature
	}
	err := c.sq.Webhooks.VerifySignature(ctx, &sq.VerifySignatureRequest{
		RequestBody:     string(body),
		SignatureHeader: signature,
		SignatureKey:    c.cfg.WebhookSignatureKey,
		NotificationURL: c.cfg.WebhookURL,
	})
	if err != nil {
		return nil, payments.ErrInvalidSignature
	}
	return decodeEvent(body)
}

type webhookEnvelope struct {
	EventID string `json:"event_id"`
	Type    string `json:"type"`
	Data    struct {
		Type   string                     `json:"type"`
		ID     string                     `json:"id"`
		Object map[string]json.RawMessage `json:"object"`
	} `json:"data"`
}

// decodeEvent extracts what the app acts on. Order-related events carry the
// order ID in different places (data.object.payment.order_id for payments,
// data.object.order_updated.order_id for orders, ...); we never trust the
// payload's state fields, only the order ID, and re-read the order from
// Square. That makes processing immune to out-of-order delivery.
func decodeEvent(body []byte) (*payments.WebhookEvent, error) {
	var env webhookEnvelope
	if err := json.Unmarshal(body, &env); err != nil {
		return nil, fmt.Errorf("decode square webhook: %w", err)
	}
	if env.EventID == "" || env.Type == "" {
		return nil, fmt.Errorf("decode square webhook: missing event_id or type")
	}
	ev := &payments.WebhookEvent{ID: env.EventID, Type: env.Type}

	switch {
	case env.Type == "catalog.version.updated":
		ev.Kind = payments.WebhookCatalogChanged
	case strings.HasPrefix(env.Type, "order.") || strings.HasPrefix(env.Type, "payment.") || strings.HasPrefix(env.Type, "refund."):
		for _, raw := range env.Data.Object {
			var obj struct {
				OrderID string `json:"order_id"`
			}
			if json.Unmarshal(raw, &obj) == nil && obj.OrderID != "" {
				ev.OrderID = models.SquareOrderID(obj.OrderID)
				break
			}
		}
		if ev.OrderID == "" && env.Data.Type == "order" {
			ev.OrderID = models.SquareOrderID(env.Data.ID)
		}
		if ev.OrderID != "" {
			ev.Kind = payments.WebhookOrderChanged
		}
	}
	return ev, nil
}
