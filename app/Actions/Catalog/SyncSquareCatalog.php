<?php

declare(strict_types=1);

namespace App\Actions\Catalog;

use App\Enums\CatalogStatus;
use App\Enums\ProductCategory;
use App\Models\ModifierList;
use App\Models\Product;
use App\Square\Data\CatalogItem;
use App\Square\Data\CatalogModifierList;
use App\Square\SquareClient;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Pulls the Square catalog into local Product records.
 *
 * Square is the source of truth for names, prices, variations, modifiers and
 * availability. The storefront then reads only local records, so browsing the
 * menu never calls Square and stays up when Square is slow.
 *
 * The sync is a full reconciliation and is idempotent:
 *
 *  - products are matched by Square item ID, so repeated runs update rather
 *    than duplicate;
 *  - on first contact a Square item adopts an unlinked local product with the
 *    same name or slug, keeping hand-written taglines and pour colors;
 *  - items archived in Square, or not sold at our location, become archived;
 *  - items Square no longer returns become deleted, not removed, so local
 *    metadata survives if the item comes back.
 */
class SyncSquareCatalog
{
    public function __construct(private readonly SquareClient $square) {}

    public function handle(): SyncResult
    {
        $snapshot = $this->square->fetchCatalog();

        return DB::transaction(function () use ($snapshot): SyncResult {
            $this->syncModifierLists($snapshot->modifierLists);

            $result = new SyncResult;
            $existing = Product::query()->with('variations')->get();
            $seenSquareItemIds = [];

            foreach ($snapshot->items as $item) {
                $product = $this->matchProduct($item, $existing, $result);

                $this->applyItem($product, $item);
                $this->syncVariations($product, $item);
                $this->syncProductModifierLists($product, $item);

                $seenSquareItemIds[] = $item->squareItemId;

                if ($product->category === null) {
                    $result->uncategorized[] = $item->name;
                }
            }

            $result->deleted = $this->markMissingAsDeleted($seenSquareItemIds);

            return $result;
        });
    }

    /**
     * Finds the local product for a Square item, adopting a hand-seeded one
     * the first time Square reports an item we already wrote copy for.
     *
     * @param  Collection<int, Product>  $existing
     */
    private function matchProduct(CatalogItem $item, $existing, SyncResult $result): Product
    {
        $linked = $existing->firstWhere('square_item_id', $item->squareItemId);

        if ($linked !== null) {
            $result->updated++;

            return $linked;
        }

        $slug = Str::slug($item->name);

        $adoptable = $existing->first(fn (Product $product): bool => $product->square_item_id === null
            && (mb_strtolower($product->name) === mb_strtolower($item->name) || $product->slug === $slug));

        if ($adoptable !== null) {
            $result->linked++;

            return $adoptable;
        }

        $result->created++;

        $product = new Product(['slug' => $this->uniqueSlug($slug)]);
        $existing->push($product);

        return $product;
    }

    /**
     * Overwrites only the Square-owned fields. Locally-owned presentation
     * metadata (tagline, ingredients, pour colors, badge) is never touched.
     */
    private function applyItem(Product $product, CatalogItem $item): void
    {
        $product->square_item_id = $item->squareItemId;
        $product->square_version = $item->squareVersion;
        $product->name = $item->name;
        $product->status = $item->available ? CatalogStatus::Active : CatalogStatus::Archived;
        $product->synced_at = now();

        // An empty Square description must not erase copy written locally.
        if ($item->description !== '') {
            $product->description = $item->description;
        }

        foreach ($item->categoryNames as $categoryName) {
            $category = ProductCategory::fromSquareCategoryName($categoryName);

            if ($category !== null) {
                $product->category = $category;
                break;
            }
        }

        $product->save();
    }

    /** Upserts variations by Square ID and removes ones Square dropped. */
    private function syncVariations(Product $product, CatalogItem $item): void
    {
        $keptIds = [];

        foreach ($item->variations as $variation) {
            $product->variations()->updateOrCreate(
                ['square_variation_id' => $variation->squareVariationId],
                [
                    'square_version' => $variation->squareVersion,
                    'name' => $variation->name,
                    'price_cents' => $variation->priceCents,
                    'currency' => $variation->currency,
                    'sellable' => $variation->sellable,
                    'ordinal' => $variation->ordinal,
                ],
            );

            $keptIds[] = $variation->squareVariationId;
        }

        $product->variations()
            ->whereNotIn('square_variation_id', $keptIds)
            ->delete();

        $product->unsetRelation('variations');
    }

    /**
     * @param  list<CatalogModifierList>  $lists
     */
    private function syncModifierLists(array $lists): void
    {
        foreach ($lists as $list) {
            $modifierList = ModifierList::query()->updateOrCreate(
                ['square_modifier_list_id' => $list->squareModifierListId],
                [
                    'name' => $list->name,
                    'min_selected' => $list->minSelected,
                    'max_selected' => $list->maxSelected,
                ],
            );

            $keptIds = [];

            foreach ($list->modifiers as $modifier) {
                $modifierList->modifiers()->updateOrCreate(
                    ['square_modifier_id' => $modifier->squareModifierId],
                    [
                        'name' => $modifier->name,
                        'price_cents' => $modifier->priceCents,
                        'currency' => $modifier->currency,
                        'ordinal' => $modifier->ordinal,
                        'hidden_online' => $modifier->hiddenOnline,
                    ],
                );

                $keptIds[] = $modifier->squareModifierId;
            }

            $modifierList->modifiers()->whereNotIn('square_modifier_id', $keptIds)->delete();
        }
    }

    /** Replaces a product's modifier lists wholesale, with its own limits. */
    private function syncProductModifierLists(Product $product, CatalogItem $item): void
    {
        $listsBySquareId = ModifierList::query()
            ->whereIn('square_modifier_list_id', array_map(
                fn ($reference): string => $reference->squareModifierListId,
                $item->modifierListRefs,
            ))
            ->get()
            ->keyBy('square_modifier_list_id');

        $attach = [];
        $position = 0;

        foreach ($item->modifierListRefs as $reference) {
            $list = $listsBySquareId->get($reference->squareModifierListId);

            if ($list === null) {
                continue;
            }

            $attach[$list->id] = [
                'min_selected' => $reference->minSelected ?? $list->min_selected,
                'max_selected' => $reference->maxSelected ?? $list->max_selected,
                'position' => $position++,
            ];
        }

        $product->modifierLists()->sync($attach);
        $product->unsetRelation('modifierLists');
    }

    /**
     * @param  list<string>  $seenSquareItemIds
     */
    private function markMissingAsDeleted(array $seenSquareItemIds): int
    {
        return Product::query()
            ->whereNotNull('square_item_id')
            ->whereNotIn('square_item_id', $seenSquareItemIds)
            ->where('status', '!=', CatalogStatus::Deleted)
            ->update([
                'status' => CatalogStatus::Deleted,
                'synced_at' => now(),
            ]);
    }

    private function uniqueSlug(string $base): string
    {
        $base = $base === '' ? 'item' : $base;
        $slug = $base;
        $suffix = 2;

        while (Product::query()->where('slug', $slug)->exists()) {
            $slug = "{$base}-{$suffix}";
            $suffix++;
        }

        return $slug;
    }
}
