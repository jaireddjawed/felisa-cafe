import { usePage } from '@inertiajs/react';
import { useEffect, useState, type ReactNode } from 'react';
import CartDrawer from '@/components/cart-drawer';
import SiteFooter from '@/components/site-footer';
import SiteHeader from '@/components/site-header';
import type { SharedProps } from '@/types';

/**
 * The shell every storefront page renders inside.
 *
 * The cart arrives as a shared prop, so the header badge and the drawer are
 * always showing the server's cart — there is no client-side cart store to
 * keep in step.
 */
export default function StorefrontLayout({
    children,
}: {
    children: ReactNode;
}) {
    const { auth, cart, shop, flash } = usePage<SharedProps>().props;
    const [cartOpen, setCartOpen] = useState(false);

    // Adding something opens the drawer, which is the confirmation that it
    // worked. `cart_opened` is flashed by CartController::store.
    useEffect(() => {
        if (flash.cartOpened) {
            setCartOpen(true);
        }
    }, [flash.cartOpened]);

    return (
        <>
            <SiteHeader
                user={auth.user}
                itemCount={cart.itemCount}
                onOpenCart={() => setCartOpen(true)}
            />

            <main className="flex-1">{children}</main>

            <SiteFooter shop={shop} />

            <CartDrawer
                cart={cart}
                open={cartOpen}
                onClose={() => setCartOpen(false)}
            />
        </>
    );
}
