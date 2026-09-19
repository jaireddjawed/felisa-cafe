// Square-specific code lives only in this file and square_catalog.go.
// Nothing outside this package and its construction site in main.go should
// import the Square SDK directly.
package payments

import (
	"fmt"
	"os"

	sq "github.com/square/square-go-sdk/v4"
	sqclient "github.com/square/square-go-sdk/v4/client"
	"github.com/square/square-go-sdk/v4/option"
)

// SquareProcessor implements PaymentProcessor using the Square Catalog API.
type SquareProcessor struct {
	client *sqclient.Client
}

// NewSquareProcessor builds a SquareProcessor from SQUARE_ACCESS_TOKEN and
// SQUARE_ENVIRONMENT ("sandbox" or "production"; defaults to sandbox).
func NewSquareProcessor() (PaymentProcessor, error) {
	token := os.Getenv("SQUARE_ACCESS_TOKEN")
	if token == "" {
		return nil, fmt.Errorf("SQUARE_ACCESS_TOKEN is not set")
	}

	baseURL := sq.Environments.Sandbox
	if os.Getenv("SQUARE_ENVIRONMENT") == "production" {
		baseURL = sq.Environments.Production
	}

	client := sqclient.NewClient(
		option.WithToken(token),
		option.WithBaseURL(baseURL),
	)

	return &SquareProcessor{client: client}, nil
}
