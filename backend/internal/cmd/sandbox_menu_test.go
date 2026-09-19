package cmd

import "testing"

func TestSandboxItemsInCategory(t *testing.T) {
	items := sandboxItemsInCategory("Pantry")
	if len(items) != 2 {
		t.Fatalf("pantry items = %d, want 2", len(items))
	}
	for _, item := range items {
		if item.Category != "Pantry" {
			t.Errorf("item %q category = %q, want Pantry", item.Name, item.Category)
		}
	}
}
