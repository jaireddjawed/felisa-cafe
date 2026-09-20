<?php

declare(strict_types=1);

namespace App\Square;

use App\Square\Data\CatalogItem;
use App\Square\Data\CatalogModifier;
use App\Square\Data\CatalogModifierList;
use App\Square\Data\CatalogSnapshot;
use App\Square\Data\CatalogVariation;
use App\Square\Data\ItemModifierListRef;
use App\Square\Data\LivePrice;

/**
 * Turns Square's catalog JSON into typed values. Pure functions over decoded
 * arrays: no HTTP, no database, so the awkward parts of Square's model —
 * location overrides, "-1 means unset", legacy selection types — are all
 * visible and testable in one place.
 */
final readonly class CatalogMapper
{
    public function __construct(
        private string $locationId,
        private string $defaultCurrency,
    ) {}

    /**
     * @param  list<array<string, mixed>>  $objects  raw CatalogObjects
     */
    public function snapshot(array $objects): CatalogSnapshot
    {
        $categoryNames = [];
        foreach ($objects as $object) {
            if (Json::string($object, 'type') === 'CATEGORY') {
                $categoryNames[Json::string($object, 'id')] = Json::string($object, 'category_data.name');
            }
        }

        $items = [];
        $modifierLists = [];

        foreach ($objects as $object) {
            if (Json::bool($object, 'is_deleted')) {
                continue;
            }

            match (Json::string($object, 'type')) {
                'ITEM' => $items[] = $this->item($object, $categoryNames),
                'MODIFIER_LIST' => $modifierLists[] = $this->modifierList($object),
                default => null,
            };
        }

        return new CatalogSnapshot($items, $modifierLists);
    }

    /**
     * @param  array<string, mixed>  $object
     * @param  array<string, string>  $categoryNames
     */
    private function item(array $object, array $categoryNames): CatalogItem
    {
        $itemData = Json::object($object, 'item_data');

        $description = Json::string($itemData, 'description_plaintext');
        if ($description === '') {
            $description = Json::string($itemData, 'description');
        }

        return new CatalogItem(
            squareItemId: Json::string($object, 'id'),
            squareVersion: Json::int($object, 'version'),
            name: Json::string($itemData, 'name'),
            description: $description,
            categoryNames: $this->categoryNamesFor($itemData, $categoryNames),
            available: ! Json::bool($itemData, 'is_archived') && $this->presentAtOurLocation($object),
            variations: $this->variations($itemData),
            modifierListRefs: $this->modifierListRefs($itemData),
        );
    }

    /**
     * @param  array<string, mixed>  $itemData
     * @param  array<string, string>  $categoryNames
     * @return list<string>
     */
    private function categoryNamesFor(array $itemData, array $categoryNames): array
    {
        $references = Json::objects($itemData, 'categories');

        $reportingCategory = Json::object($itemData, 'reporting_category');
        if ($reportingCategory !== []) {
            $references[] = $reportingCategory;
        }

        $names = [];
        foreach ($references as $reference) {
            $name = $categoryNames[Json::string($reference, 'id')] ?? '';
            if ($name !== '' && ! in_array($name, $names, true)) {
                $names[] = $name;
            }
        }

        return $names;
    }

    /**
     * @param  array<string, mixed>  $itemData
     * @return list<CatalogVariation>
     */
    private function variations(array $itemData): array
    {
        $variations = [];

        foreach (Json::objects($itemData, 'variations') as $object) {
            if (Json::bool($object, 'is_deleted') || ! $this->presentAtOurLocation($object)) {
                continue;
            }

            $data = Json::object($object, 'item_variation_data');
            [$priceCents, $currency, $sellable] = $this->variationPrice($data);

            $variations[] = new CatalogVariation(
                squareVariationId: Json::string($object, 'id'),
                squareVersion: Json::int($object, 'version'),
                name: Json::string($data, 'name'),
                priceCents: $priceCents,
                currency: $currency,
                sellable: $sellable,
                ordinal: Json::int($data, 'ordinal'),
            );
        }

        return $variations;
    }

    /**
     * Applies our location's price override and reports whether the variation
     * can be sold online at a fixed price.
     *
     * @param  array<string, mixed>  $data  item_variation_data
     * @return array{int, string, bool}
     */
    private function variationPrice(array $data): array
    {
        $price = Json::nullableObject($data, 'price_money');
        $pricingType = Json::string($data, 'pricing_type');
        $soldOut = false;

        foreach ($this->overridesForOurLocation($data) as $override) {
            $price = Json::nullableObject($override, 'price_money') ?? $price;
            $pricingType = Json::string($override, 'pricing_type', $pricingType);
            $soldOut = Json::bool($override, 'sold_out');
        }

        $sellable = $pricingType !== 'VARIABLE_PRICING'
            && $price !== null
            && Json::nullableInt($price, 'amount') !== null
            && Json::bool($data, 'sellable', true)
            && ! $soldOut;

        return [
            $price === null ? 0 : Json::int($price, 'amount'),
            $price === null ? $this->defaultCurrency : Json::string($price, 'currency', $this->defaultCurrency),
            $sellable,
        ];
    }

    /**
     * @param  array<string, mixed>  $itemData
     * @return list<ItemModifierListRef>
     */
    private function modifierListRefs(array $itemData): array
    {
        $refs = [];

        foreach (Json::objects($itemData, 'modifier_list_info') as $info) {
            if (! Json::bool($info, 'enabled', true)) {
                continue;
            }

            $min = Json::nullableInt($info, 'min_selected_modifiers');
            $max = Json::nullableInt($info, 'max_selected_modifiers');

            // Square uses -1 on both to mean "use the list's own limits".
            $usesListLimits = $min === null || $max === null || ($min === -1 && $max === -1);

            $refs[] = new ItemModifierListRef(
                squareModifierListId: Json::string($info, 'modifier_list_id'),
                minSelected: $usesListLimits ? null : $this->normalizeLimit($min),
                maxSelected: $usesListLimits ? null : $this->normalizeLimit($max),
            );
        }

        return $refs;
    }

    /**
     * @param  array<string, mixed>  $object
     */
    private function modifierList(array $object): CatalogModifierList
    {
        $data = Json::object($object, 'modifier_list_data');

        $maxSelected = $this->normalizeLimit(Json::nullableInt($data, 'max_selected_modifiers'));

        // Legacy lists express "pick one" with selection_type instead of limits.
        if (Json::nullableInt($data, 'max_selected_modifiers') === null
            && Json::string($data, 'selection_type') === 'SINGLE') {
            $maxSelected = 1;
        }

        $modifiers = [];
        foreach (Json::objects($data, 'modifiers') as $modifier) {
            if (Json::bool($modifier, 'is_deleted') || ! $this->presentAtOurLocation($modifier)) {
                continue;
            }

            $modifierData = Json::object($modifier, 'modifier_data');
            [$priceCents, $currency, $available] = $this->modifierPrice($modifierData);

            if (! $available) {
                continue;
            }

            $modifiers[] = new CatalogModifier(
                squareModifierId: Json::string($modifier, 'id'),
                name: Json::string($modifierData, 'name'),
                priceCents: $priceCents,
                currency: $currency,
                ordinal: Json::int($modifierData, 'ordinal'),
                hiddenOnline: Json::bool($modifierData, 'hidden_online'),
            );
        }

        return new CatalogModifierList(
            squareModifierListId: Json::string($object, 'id'),
            name: Json::string($data, 'name'),
            minSelected: $this->normalizeLimit(Json::nullableInt($data, 'min_selected_modifiers')),
            maxSelected: $maxSelected,
            modifiers: $modifiers,
        );
    }

    /**
     * @param  array<string, mixed>  $data  modifier_data
     * @return array{int, string, bool}
     */
    private function modifierPrice(array $data): array
    {
        $price = Json::nullableObject($data, 'price_money');
        $soldOut = false;

        foreach ($this->overridesForOurLocation($data) as $override) {
            $price = Json::nullableObject($override, 'price_money') ?? $price;
            $soldOut = Json::bool($override, 'sold_out');
        }

        return [
            $price === null ? 0 : Json::int($price, 'amount'),
            $price === null ? $this->defaultCurrency : Json::string($price, 'currency', $this->defaultCurrency),
            ! $soldOut,
        ];
    }

    /**
     * Live prices for a batch-retrieve response, used to re-check the local
     * cache immediately before charging.
     *
     * @param  list<array<string, mixed>>  $objects
     * @param  list<array<string, mixed>>  $relatedObjects
     * @return array{array<string, LivePrice>, array<string, LivePrice>}
     */
    public function livePrices(array $objects, array $relatedObjects): array
    {
        // A variation of an archived or removed item can't be sold, however
        // sellable the variation itself looks.
        $itemAvailable = [];
        foreach ($relatedObjects as $object) {
            if (Json::string($object, 'type') !== 'ITEM') {
                continue;
            }
            $itemData = Json::object($object, 'item_data');
            $itemAvailable[Json::string($object, 'id')] = ! Json::bool($object, 'is_deleted')
                && ! Json::bool($itemData, 'is_archived')
                && $this->presentAtOurLocation($object);
        }

        $variations = [];
        $modifiers = [];

        foreach ($objects as $object) {
            if (Json::bool($object, 'is_deleted')) {
                continue;
            }

            switch (Json::string($object, 'type')) {
                case 'ITEM_VARIATION':
                    $data = Json::object($object, 'item_variation_data');
                    [$priceCents, $currency, $sellable] = $this->variationPrice($data);
                    $itemId = Json::string($data, 'item_id');

                    $variations[Json::string($object, 'id')] = new LivePrice(
                        priceCents: $priceCents,
                        currency: $currency,
                        available: $sellable
                            && ($itemAvailable[$itemId] ?? true)
                            && $this->presentAtOurLocation($object),
                    );
                    break;

                case 'MODIFIER':
                    $data = Json::object($object, 'modifier_data');
                    [$priceCents, $currency, $available] = $this->modifierPrice($data);

                    $modifiers[Json::string($object, 'id')] = new LivePrice(
                        priceCents: $priceCents,
                        currency: $currency,
                        available: $available && $this->presentAtOurLocation($object),
                    );
                    break;
            }
        }

        return [$variations, $modifiers];
    }

    /**
     * Square's location availability rules. `present_at_all_locations` is
     * omitted when it is true, which is the default.
     *
     * @param  array<string, mixed>  $object
     */
    private function presentAtOurLocation(array $object): bool
    {
        $presentAtAll = $object['present_at_all_locations'] ?? null;

        if (! is_bool($presentAtAll) || $presentAtAll) {
            return ! in_array($this->locationId, Json::strings($object, 'absent_at_location_ids'), true);
        }

        return in_array($this->locationId, Json::strings($object, 'present_at_location_ids'), true);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return list<array<string, mixed>>
     */
    private function overridesForOurLocation(array $data): array
    {
        return array_values(array_filter(
            Json::objects($data, 'location_overrides'),
            fn (array $override): bool => Json::string($override, 'location_id') === $this->locationId,
        ));
    }

    /** Square uses -1 (and other negatives) for "unset"; we use 0. */
    private function normalizeLimit(?int $value): int
    {
        return max($value ?? 0, 0);
    }
}
