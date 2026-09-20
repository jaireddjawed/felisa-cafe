<?php

declare(strict_types=1);

namespace App\Actions\Catalog;

use App\Enums\ProductCategory;
use App\Models\Modifier;
use App\Models\ModifierList;
use App\Models\Product;
use App\Models\ProductVariation;
use App\Square\SquareGateway;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Str;

/**
 * Creates the first Square catalog from locally seeded products.
 *
 * This is intentionally a bootstrap path. After Square has real IDs, the
 * normal square:sync-catalog command pulls those IDs back down and Square
 * resumes being the source of truth for catalog data.
 */
class PushSquareCatalog
{
    public function __construct(private readonly SquareGateway $square) {}

    public function handle(): PushResult
    {
        $products = Product::query()
            ->whereNull('square_item_id')
            ->with(['variations', 'modifierLists.modifiers'])
            ->orderBy('sort_order')
            ->get();

        if ($products->isEmpty()) {
            return new PushResult(products: 0, objects: 0);
        }

        $objects = [
            ...$this->categories($products),
            ...$this->modifierLists($products),
            ...$this->items($products),
        ];

        $this->square->batchUpsertCatalogObjects(
            idempotencyKey: 'catalog-push-'.hash('sha256', json_encode($objects, JSON_THROW_ON_ERROR)),
            objects: $objects,
        );

        return new PushResult(products: $products->count(), objects: count($objects));
    }

    /**
     * @param  Collection<int, Product>  $products
     * @return list<array<string, mixed>>
     */
    private function categories(Collection $products): array
    {
        return array_values($products
            ->pluck('category')
            ->filter()
            ->unique(fn (ProductCategory $category): string => $category->value)
            ->values()
            ->map(fn (ProductCategory $category): array => [
                'type' => 'CATEGORY',
                'id' => $this->categoryId($category),
                'present_at_all_locations' => true,
                'category_data' => [
                    'name' => Str::headline($category->value),
                ],
            ])
            ->all());
    }

    /**
     * @param  Collection<int, Product>  $products
     * @return list<array<string, mixed>>
     */
    private function modifierLists(Collection $products): array
    {
        return array_values($products
            ->flatMap(fn (Product $product) => $product->modifierLists)
            ->filter(fn (ModifierList $list): bool => $this->isLocalSquareId($list->square_modifier_list_id))
            ->unique('id')
            ->values()
            ->map(fn (ModifierList $list): array => [
                'type' => 'MODIFIER_LIST',
                'id' => $this->modifierListId($list),
                'present_at_all_locations' => false,
                'present_at_location_ids' => [$this->square->locationId()],
                'modifier_list_data' => [
                    'name' => $list->name,
                    'selection_type' => $list->max_selected === 1 ? 'SINGLE' : 'MULTIPLE',
                    'min_selected_modifiers' => $list->min_selected,
                    'max_selected_modifiers' => $this->squareLimit($list->max_selected),
                    'modifiers' => $list->modifiers
                        ->map(fn (Modifier $modifier): array => $this->modifier($modifier))
                        ->values()
                        ->all(),
                ],
            ])
            ->all());
    }

    /**
     * @param  Collection<int, Product>  $products
     * @return list<array<string, mixed>>
     */
    private function items(Collection $products): array
    {
        return array_values($products
            ->map(fn (Product $product): array => [
                'type' => 'ITEM',
                'id' => $this->itemId($product),
                'present_at_all_locations' => false,
                'present_at_location_ids' => [$this->square->locationId()],
                'item_data' => array_filter([
                    'name' => $product->name,
                    'description' => $product->description,
                    'categories' => $product->category === null ? [] : [
                        ['id' => $this->categoryId($product->category)],
                    ],
                    'reporting_category' => $product->category === null ? null : [
                        'id' => $this->categoryId($product->category)],
                    'variations' => $product->variations
                        ->map(fn (ProductVariation $variation): array => $this->variation($product, $variation))
                        ->values()
                        ->all(),
                    'modifier_list_info' => $product->modifierLists
                        ->map(fn (ModifierList $list): array => $this->modifierListReference($list))
                        ->values()
                        ->all(),
                ], fn (mixed $value): bool => $value !== null && $value !== [] && $value !== ''),
            ])
            ->all());
    }

    /**
     * @return array<string, mixed>
     */
    private function variation(Product $product, ProductVariation $variation): array
    {
        return [
            'type' => 'ITEM_VARIATION',
            'id' => $this->variationId($variation),
            'present_at_all_locations' => false,
            'present_at_location_ids' => [$this->square->locationId()],
            'item_variation_data' => [
                'item_id' => $this->itemId($product),
                'name' => $variation->name,
                'ordinal' => $variation->ordinal,
                'pricing_type' => 'FIXED_PRICING',
                'price_money' => [
                    'amount' => $variation->price_cents,
                    'currency' => $variation->currency,
                ],
                'sellable' => $variation->sellable,
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function modifier(Modifier $modifier): array
    {
        return [
            'type' => 'MODIFIER',
            'id' => $this->modifierId($modifier),
            'present_at_all_locations' => false,
            'present_at_location_ids' => [$this->square->locationId()],
            'modifier_data' => [
                'name' => $modifier->name,
                'ordinal' => $modifier->ordinal,
                'price_money' => [
                    'amount' => $modifier->price_cents,
                    'currency' => $modifier->currency,
                ],
                'hidden_online' => $modifier->hidden_online,
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function modifierListReference(ModifierList $list): array
    {
        [$minSelected, $maxSelected] = $list->limitsForProduct();

        return [
            'modifier_list_id' => $this->modifierListId($list),
            'enabled' => true,
            'min_selected_modifiers' => $minSelected,
            'max_selected_modifiers' => $this->squareLimit($maxSelected),
        ];
    }

    private function categoryId(ProductCategory $category): string
    {
        return $this->temporaryId('category', $category->value);
    }

    private function itemId(Product $product): string
    {
        return $product->square_item_id ?? $this->temporaryId('item', $product->slug);
    }

    private function variationId(ProductVariation $variation): string
    {
        return $this->isLocalSquareId($variation->square_variation_id)
            ? $this->temporaryId('variation', $variation->square_variation_id)
            : $variation->square_variation_id;
    }

    private function modifierListId(ModifierList $list): string
    {
        return $this->isLocalSquareId($list->square_modifier_list_id)
            ? $this->temporaryId('modifier-list', $list->square_modifier_list_id)
            : $list->square_modifier_list_id;
    }

    private function modifierId(Modifier $modifier): string
    {
        return $this->isLocalSquareId($modifier->square_modifier_id)
            ? $this->temporaryId('modifier', $modifier->square_modifier_id)
            : $modifier->square_modifier_id;
    }

    private function temporaryId(string $prefix, string $value): string
    {
        return '#'.$prefix.'-'.Str::slug($value);
    }

    private function isLocalSquareId(string $id): bool
    {
        return str_starts_with($id, 'seed-') || str_starts_with($id, '#');
    }

    private function squareLimit(int $value): int
    {
        return $value === 0 ? -1 : $value;
    }
}
