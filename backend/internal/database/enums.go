package database

import (
	"felisa-cafe/backend/internal/database/internal/schema"
	"felisa-cafe/backend/internal/models"
)

var categories = newEnumMapping(map[models.ProductCategory]schema.ProductsCategory{
	models.CategorySignature: schema.ProductsCategorySignature,
	models.CategoryMatcha:    schema.ProductsCategoryMatcha,
	models.CategoryPantry:    schema.ProductsCategoryPantry,
	models.CategoryMerch:     schema.ProductsCategoryMerch,
})

var catalogStatuses = newEnumMapping(map[models.CatalogStatus]schema.ProductsCatalogStatus{
	models.CatalogUnlinked: schema.ProductsCatalogStatusUnlinked,
	models.CatalogActive:   schema.ProductsCatalogStatusActive,
	models.CatalogArchived: schema.ProductsCatalogStatusArchived,
	models.CatalogDeleted:  schema.ProductsCatalogStatusDeleted,
})

var orderStatuses = newEnumMapping(map[models.OrderStatus]schema.OrdersStatus{
	models.OrderPendingPayment: schema.OrdersStatusPendingPayment,
	models.OrderPaid:           schema.OrdersStatusPaid,
	models.OrderPreparing:      schema.OrdersStatusPreparing,
	models.OrderReady:          schema.OrdersStatusReady,
	models.OrderCompleted:      schema.OrdersStatusCompleted,
	models.OrderCancelled:      schema.OrdersStatusCancelled,
})

// category is optional on products (Square items may be uncategorized).
func categoryFromDB(c schema.ProductsCategory) (models.ProductCategory, error) {
	if c == "" {
		return "", nil
	}
	return categories.FromDB(c)
}

func categoryToDB(c models.ProductCategory) (schema.ProductsCategory, error) {
	if c == "" {
		return "", nil
	}
	return categories.ToDB(c)
}
