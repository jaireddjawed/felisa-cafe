<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\ProductCategory;
use App\Models\Product;
use Inertia\Inertia;
use Inertia\Response;

class HomeController extends Controller
{
    public function __invoke(): Response
    {
        $products = Product::query()
            ->visible()
            ->with('variations')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return Inertia::render('home', [
            'signatures' => $products
                ->where('category', ProductCategory::Signature)
                ->map->toMenuCard()
                ->values()
                ->all(),
            'takeHome' => $products
                ->whereIn('category', [ProductCategory::Pantry, ProductCategory::Merch])
                ->map->toMenuCard()
                ->values()
                ->all(),
        ]);
    }
}
