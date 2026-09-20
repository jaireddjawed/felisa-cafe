<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * The browser sends identifiers and a quantity. It never sends a price, a
 * name or a total; those are resolved from local products.
 */
class AddCartItemRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'variation_id' => ['required', 'string', 'max:191'],
            'modifier_ids' => ['array', 'max:20'],
            'modifier_ids.*' => ['string', 'max:191'],
            'quantity' => ['required', 'integer', 'min:1', 'max:'.config('felisa.cart.max_line_quantity', 20)],
            'note' => ['nullable', 'string', 'max:'.config('felisa.cart.max_note_length', 200)],
        ];
    }

    /**
     * @return list<string>
     */
    public function modifierIds(): array
    {
        /** @var list<string> $ids */
        $ids = array_values(array_filter($this->array('modifier_ids'), is_string(...)));

        return $ids;
    }
}
