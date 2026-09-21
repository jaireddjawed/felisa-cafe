<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\SavedCard;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    /**
     * The signed-in customer's account settings: who they are, how they sign
     * in, and the cards they keep on file.
     */
    public function index(Request $request): Response
    {
        return Inertia::render('settings/index', [
            'emailVerified' => $request->user()->hasVerifiedEmail(),
            'receiptEmail' => $request->user()->receiptEmail(),
            'passwordRules' => Password::defaults()->toPasswordRulesString(),
            // Set to "verification-link-sent" after a resend.
            'status' => $request->session()->get('status'),
            'savedCards' => $request->user()->savedCards
                ->map(fn (SavedCard $card): array => $card->toPayload())
                ->all(),
        ]);
    }
}
