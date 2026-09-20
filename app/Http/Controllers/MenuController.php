<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\CatalogStatus;
use App\Enums\ProductCategory;
use App\Models\Product;
use Inertia\Inertia;
use Inertia\Response;

class MenuController extends Controller
{
    /**
     * The menu, read entirely from local products. Browsing never calls
     * Square, so the storefront stays up when Square is slow or down.
     */
    public function index(): Response
    {
        $products = Product::query()
            ->visible()
            ->with('variations')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return Inertia::render('menu/index', [
            'products' => $products->map->toMenuCard()->all(),
        ]);
    }

    public function show(Product $product): Response
    {
        abort_unless($product->status === CatalogStatus::Active, 404);

        $product->load(['variations', 'modifierLists.modifiers']);

        $alsoLike = Product::query()
            ->visible()
            ->whereKeyNot($product->id)
            ->where('category', ProductCategory::Signature)
            ->with('variations')
            ->orderBy('sort_order')
            ->limit(4)
            ->get();

        return Inertia::render('menu/show', [
            'product' => $product->toMenuDetail(),
            'alsoLike' => $alsoLike->map->toMenuCard()->all(),
        ]);
    }
}
