/**
 * The slice of Square's Web Payments SDK the checkout page uses.
 *
 * The SDK is loaded from Square's CDN at runtime rather than bundled, which
 * is what Square requires — the card fields run in cross-origin iframes so
 * card details never touch this application or its server.
 */

export interface SquareTokenResult {
    status: 'OK' | 'ERROR' | 'ABORT';
    token?: string;
    errors?: { message?: string }[];
}

export interface SquareCard {
    attach(selector: string): Promise<void>;
    destroy(): Promise<void>;
    tokenize(): Promise<SquareTokenResult>;
}

export interface SquarePaymentRequest {}

export interface SquarePaymentRequestOptions {
    countryCode: string;
    currencyCode: string;
    total: {
        amount: string;
        label: string;
    };
}

export interface SquareWallet {
    attach?(selector: string): Promise<void>;
    destroy?(): Promise<void>;
    tokenize(): Promise<SquareTokenResult>;
}

/**
 * Buyer verification. Square challenges the cardholder where the law asks for
 * it (3-D Secure, SCA) and returns a token proving it happened.
 */
export interface SquareVerifyBuyerDetails {
    intent: 'CHARGE' | 'STORE';
    billingContact: {
        givenName?: string;
        familyName?: string;
        email?: string;
    };
    customerInitiated: boolean;
    sellerKeyedIn: boolean;
    /** Charges are verified for an amount; storing a card is not. */
    amount?: string;
    currencyCode?: string;
}

export interface SquareVerifyBuyerResult {
    token?: string;
}

export interface SquarePayments {
    card(): Promise<SquareCard>;
    paymentRequest(options: SquarePaymentRequestOptions): SquarePaymentRequest;
    applePay(paymentRequest: SquarePaymentRequest): Promise<SquareWallet>;
    googlePay(paymentRequest: SquarePaymentRequest): Promise<SquareWallet>;
    verifyBuyer(
        source: string,
        details: SquareVerifyBuyerDetails,
    ): Promise<SquareVerifyBuyerResult | null>;
}

declare global {
    interface Window {
        Square?: {
            payments(applicationId: string, locationId: string): SquarePayments;
        };
    }
}
