import { createInertiaApp } from '@inertiajs/react';
import AuthLayout from '@/layouts/auth-layout';
import StorefrontLayout from '@/layouts/storefront-layout';

const appName = import.meta.env.VITE_APP_NAME || 'Felisa Cafe';

void createInertiaApp({
    title: (title) => (title ? `${title} · ${appName}` : appName),
    layout: (name) =>
        name.startsWith('auth/') ? AuthLayout : StorefrontLayout,
    strictMode: true,
    progress: {
        color: '#7c4dbe',
    },
});
