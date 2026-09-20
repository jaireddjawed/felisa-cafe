import { Form, Head, Link } from '@inertiajs/react';
import Field from '@/components/field';
import { register } from '@/routes';
import { store } from '@/routes/login';
import { request } from '@/routes/password';

type Props = {
    status?: string;
    canResetPassword: boolean;
};

export default function Login({ status, canResetPassword }: Props) {
    return (
        <>
            <Head title="Log in" />

            <h1 className="font-marker text-lav-800 text-3xl">Welcome back</h1>

            {status && (
                <p className="bg-lav-200 font-hand text-lav-800 mt-4 rounded-2xl px-4 py-2 text-lg">
                    {status}
                </p>
            )}

            <Form
                action={store()}
                className="mt-6 grid gap-4"
                resetOnSuccess={['password']}
            >
                {({ processing, errors }) => (
                    <>
                        <Field
                            label="Email"
                            name="email"
                            type="email"
                            required
                            autoFocus
                            autoComplete="email"
                            placeholder="name@example.com"
                            error={errors.email}
                        />

                        <Field
                            label="Password"
                            name="password"
                            type="password"
                            required
                            autoComplete="current-password"
                            placeholder="••••••••"
                            error={errors.password}
                        />

                        <label className="font-hand text-lav-700 flex items-center gap-2 text-lg">
                            <input
                                type="checkbox"
                                name="remember"
                                className="accent-lav-600 size-4"
                            />
                            Remember me
                        </label>

                        <button
                            type="submit"
                            disabled={processing}
                            className="sticker bg-lav-600 font-marker hover:bg-lav-700 mt-2 rounded-full py-3 text-base text-white transition disabled:opacity-50"
                        >
                            {processing ? 'Signing in…' : 'Log in'}
                        </button>
                    </>
                )}
            </Form>

            <div className="font-hand text-lav-600 mt-5 grid gap-1 text-center text-lg">
                {canResetPassword && (
                    <Link
                        href={request()}
                        className="hover:text-lav-800 underline decoration-dashed"
                    >
                        Forgot your password?
                    </Link>
                )}
                <p>
                    New here?{' '}
                    <Link
                        href={register()}
                        className="hover:text-lav-800 underline decoration-dashed"
                    >
                        Make an account
                    </Link>
                </p>
            </div>
        </>
    );
}
