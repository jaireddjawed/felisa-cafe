<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\CatalogStatus;
use App\Enums\ProductCategory;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Database\Factories\ProductFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A cached Square catalog item plus locally-owned presentation metadata.
 *
 * Square owns name, description, category, status, variations and modifier
 * lists; the catalog sync overwrites them. The app owns slug, tagline,
 * ingredients, size, pour colors, badge and sort order.
 *
 * @property string $id
 * @property string|null $square_item_id
 * @property int $square_version
 * @property CatalogStatus $status
 * @property string $name
 * @property string $description
 * @property ProductCategory|null $category
 * @property CarbonImmutable|null $synced_at
 * @property string $slug
 * @property string $tagline
 * @property list<string> $ingredients
 * @property string $size
 * @property string $pour_top
 * @property string $pour_bottom
 * @property string $badge
 * @property int $sort_order
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property-read Collection<int, ProductVariation> $variations
 * @property-read Collection<int, ModifierList> $modifierLists
 */
class Product extends Model
{
    /** @use HasFactory<ProductFactory> */
    use HasFactory, HasUuids;

    protected $guarded = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'status' => CatalogStatus::class,
            'category' => ProductCategory::class,
            'ingredients' => 'array',
            'synced_at' => 'datetime',
            'square_version' => 'integer',
            'sort_order' => 'integer',
        ];
    }

    /** @return HasMany<ProductVariation, $this> */
    public function variations(): HasMany
    {
        return $this->hasMany(ProductVariation::class)->orderBy('ordinal');
    }

    /** @return BelongsToMany<ModifierList, $this> */
    public function modifierLists(): BelongsToMany
    {
        return $this->belongsToMany(ModifierList::class)
            ->withPivot(['min_selected', 'max_selected', 'position'])
            ->orderBy('position');
    }

    /**
     * Products that customers can browse: everything Square still offers.
     *
     * @param  Builder<$this>  $query
     */
    public function scopeVisible(Builder $query): void
    {
        $query->where('status', CatalogStatus::Active);
    }

    /** Whether the product can currently be ordered. */
    public function isPurchasable(): bool
    {
        return $this->status === CatalogStatus::Active
            && $this->variations->contains(fn (ProductVariation $variation): bool => $variation->sellable);
    }

    /** The lowest sellable variation price, for "from $8.50" on menu cards. */
    public function fromPrice(): ?Money
    {
        return $this->variations
            ->filter(fn (ProductVariation $variation): bool => $variation->sellable)
            ->sortBy('price_cents')
            ->first()
            ?->price();
    }

    public function variation(string $squareVariationId): ?ProductVariation
    {
        return $this->variations
            ->firstWhere('square_variation_id', $squareVariationId);
    }

    /** Products are addressed by slug in URLs, not by ID. */
    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /**
     * What a menu card shows. Defined here rather than in each controller so
     * that the home page and the menu cannot drift apart, and so there is one
     * place to compare against the `Product` type in resources/js/types.
     *
     * @return array<string, mixed>
     */
    public function toMenuCard(): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'category' => $this->category?->value,
            'tagline' => $this->tagline,
            'badge' => $this->badge,
            'pour' => ['top' => $this->pour_top, 'bottom' => $this->pour_bottom],
            'fromPrice' => $this->fromPrice()?->toArray(),
            'available' => $this->isPurchasable(),
        ];
    }

    /**
     * Everything on a card, plus what the customer chooses from. Hidden
     * modifiers are dropped here: they exist in Square for in-store use and
     * must never be orderable online.
     *
     * @return array<string, mixed>
     */
    public function toMenuDetail(): array
    {
        return [
            ...$this->toMenuCard(),
            'description' => $this->description,
            'ingredients' => $this->ingredients ?? [],
            'size' => $this->size,
            'variations' => $this->variations
                ->map(fn (ProductVariation $variation): array => [
                    'id' => $variation->square_variation_id,
                    'name' => $variation->name,
                    'price' => $variation->price()->toArray(),
                    'available' => $variation->sellable,
                ])
                ->all(),
            'modifierLists' => $this->modifierLists
                ->map(function (ModifierList $list): array {
                    [$minSelected, $maxSelected] = $list->limitsForProduct();

                    return [
                        'id' => $list->square_modifier_list_id,
                        'name' => $list->name,
                        'minSelected' => $minSelected,
                        'maxSelected' => $maxSelected,
                        'modifiers' => $list->modifiers
                            ->reject(fn (Modifier $modifier): bool => $modifier->hidden_online)
                            ->map(fn (Modifier $modifier): array => [
                                'id' => $modifier->square_modifier_id,
                                'name' => $modifier->name,
                                'price' => $modifier->price()->toArray(),
                            ])
                            ->values()
                            ->all(),
                    ];
                })
                ->all(),
        ];
    }
}
