import { Form, Head, Link } from '@inertiajs/react';
import Field from '@/components/field';
import { login } from '@/routes';
import { store } from '@/routes/register';

type Props = {
    passwordRules: string;
};

export default function Register({ passwordRules }: Props) {
    return (
        <>
            <Head title="Create an account" />

            <h1 className="font-marker text-lav-800 text-3xl">
                Make an account
            </h1>
            <p className="font-hand text-lav-600 mt-2 text-xl">
                Optional — you can order without one. An account just keeps your
                history.
            </p>

            <Form
                action={store()}
                className="mt-6 grid gap-4"
                resetOnSuccess={['password', 'password_confirmation']}
            >
                {({ processing, errors }) => (
                    <>
                        <Field
                            label="Name"
                            name="name"
                            required
                            autoFocus
                            autoComplete="name"
                            placeholder="Your name"
                            error={errors.name}
                        />

                        <Field
                            label="Email"
                            name="email"
                            type="email"
                            required
                            autoComplete="email"
                            placeholder="name@example.com"
                            error={errors.email}
                        />

                        <Field
                            label="Password"
                            name="password"
                            type="password"
                            required
                            autoComplete="new-password"
                            passwordrules={passwordRules}
                            placeholder="••••••••"
                            error={errors.password}
                        />

                        <Field
                            label="Confirm password"
                            name="password_confirmation"
                            type="password"
                            required
                            autoComplete="new-password"
                            placeholder="••••••••"
                            error={errors.password_confirmation}
                        />

                        <button
                            type="submit"
                            disabled={processing}
                            className="sticker bg-lav-600 font-marker hover:bg-lav-700 mt-2 rounded-full py-3 text-base text-white transition disabled:opacity-50"
                        >
                            {processing ? 'Creating…' : 'Create account'}
                        </button>
                    </>
                )}
            </Form>

            <p className="font-hand text-lav-600 mt-5 text-center text-lg">
                Already have one?{' '}
                <Link
                    href={login()}
                    className="hover:text-lav-800 underline decoration-dashed"
                >
                    Log in
                </Link>
            </p>
        </>
    );
}
