<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCartItemRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            // Zero removes the line, which is what the "−" button does when
            // the quantity is already one.
            'quantity' => ['required', 'integer', 'min:0', 'max:'.config('felisa.cart.max_line_quantity', 20)],
        ];
    }
}
