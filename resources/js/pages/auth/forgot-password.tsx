import { Form, Head, Link } from '@inertiajs/react';
import Field from '@/components/field';
import { login } from '@/routes';
import { email } from '@/routes/password';

type Props = {
    status?: string;
};

export default function ForgotPassword({ status }: Props) {
    return (
        <>
            <Head title="Forgot password" />

            <h1 className="font-marker text-lav-800 text-3xl">
                Forgot your password?
            </h1>
            <p className="font-hand text-lav-600 mt-2 text-xl">
                Tell us your email and we will send a reset link.
            </p>

            {status && (
                <p className="bg-lav-200 font-hand text-lav-800 mt-4 rounded-2xl px-4 py-2 text-lg">
                    {status}
                </p>
            )}

            <Form action={email()} className="mt-6 grid gap-4">
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

                        <button
                            type="submit"
                            disabled={processing}
                            className="sticker bg-lav-600 font-marker hover:bg-lav-700 mt-2 rounded-full py-3 text-base text-white transition disabled:opacity-50"
                        >
                            {processing ? 'Sending…' : 'Email reset link'}
                        </button>
                    </>
                )}
            </Form>

            <p className="font-hand text-lav-600 mt-5 text-center text-lg">
                <Link
                    href={login()}
                    className="hover:text-lav-800 underline decoration-dashed"
                >
                    Back to log in
                </Link>
            </p>
        </>
    );
}
