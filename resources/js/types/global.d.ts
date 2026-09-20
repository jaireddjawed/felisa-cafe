import type { SharedProps } from '@/types';

declare module 'react' {
    interface InputHTMLAttributes<T> {
        /** Safari's password rules hint, used on the registration form. */
        passwordrules?: string;
    }
}

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: SharedProps;
    }
}
