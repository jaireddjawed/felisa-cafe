import { Form, Head } from '@inertiajs/react';
import Field from '@/components/field';
import { update } from '@/routes/password';

type Props = {
    email: string;
    token: string;
    passwordRules: string;
};

export default function ResetPassword({ email, token, passwordRules }: Props) {
    return (
        <>
            <Head title="Reset password" />

            <h1 className="font-marker text-lav-800 text-3xl">
                Pick a new password
            </h1>

            <Form
                action={update()}
                className="mt-6 grid gap-4"
                transform={(data) => ({ ...data, token, email })}
                resetOnSuccess={['password', 'password_confirmation']}
            >
                {({ processing, errors }) => (
                    <>
                        <Field
                            label="Email"
                            name="email"
                            type="email"
                            defaultValue={email}
                            readOnly
                            autoComplete="email"
                            error={errors.email}
                        />

                        <Field
                            label="New password"
                            name="password"
                            type="password"
                            required
                            autoFocus
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
                            {processing ? 'Saving…' : 'Reset password'}
                        </button>
                    </>
                )}
            </Form>
        </>
    );
}
