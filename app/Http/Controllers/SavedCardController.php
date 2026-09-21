<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\SavedCard;
use App\Square\SquareException;
use App\Square\SquareGateway;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class SavedCardController extends Controller
{
    /**
     * Forgets a card on file. The lookup is scoped to the signed-in customer,
     * so one account can never reach another's card, and the card is disabled
     * at Square as well as deleted here — a row we no longer hold must not
     * remain chargeable.
     */
    public function destroy(Request $request, SavedCard $savedCard, SquareGateway $square): RedirectResponse
    {
        // 404 rather than 403: guessing IDs must not reveal which ones exist.
        abort_unless($savedCard->user_id === $request->user()?->id, 404);

        try {
            $square->disableCard($savedCard->square_card_id);
        } catch (SquareException $exception) {
            // Square may already have disabled it, or be unreachable. Either
            // way the customer asked us to forget the card, so we do.
            report($exception);
        }

        $savedCard->delete();

        return back();
    }
}
