<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\SavedCard;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    /**
     * The signed-in customer's account settings. Cards on file are the only
     * thing there is to manage so far; the page is built to grow.
     */
    public function index(Request $request): Response
    {
        return Inertia::render('settings/index', [
            'savedCards' => $request->user()->savedCards
                ->map(fn (SavedCard $card): array => $card->toPayload())
                ->all(),
        ]);
    }
}
