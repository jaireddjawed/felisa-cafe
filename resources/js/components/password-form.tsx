import { Form } from '@inertiajs/react';
import Field from '@/components/field';
import { update } from '@/routes/user-password';

type Props = {
    passwordRules: string;
};

export default function PasswordForm({ passwordRules }: Props) {
    return (
        <Form
            action={update()}
            errorBag="updatePassword"
            options={{ preserveScroll: true }}
            resetOnSuccess
            className="mt-4 grid gap-4"
        >
            {({ processing, errors, recentlySuccessful }) => (
                <>
                    <Field
                        label="Current password"
                        name="current_password"
                        type="password"
                        required
                        autoComplete="current-password"
                        placeholder="••••••••"
                        error={errors.current_password}
                    />

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field
                            label="New password"
                            name="password"
                            type="password"
                            required
                            autoComplete="new-password"
                            passwordrules={passwordRules}
                            placeholder="••••••••"
                            error={errors.password}
                        />
                        <Field
                            label="Confirm new password"
                            name="password_confirmation"
                            type="password"
                            required
                            autoComplete="new-password"
                            placeholder="••••••••"
                            error={errors.password_confirmation}
                        />
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            type="submit"
                            disabled={processing}
                            className="sticker bg-lav-600 font-marker hover:bg-lav-700 rounded-full px-6 py-2.5 text-base text-white transition disabled:opacity-50"
                        >
                            {processing ? 'Saving…' : 'Change password'}
                        </button>
                        {recentlySuccessful && (
                            <span
                                className="font-hand text-lav-700 text-lg"
                                role="status"
                            >
                                Password changed!
                            </span>
                        )}
                    </div>
                </>
            )}
        </Form>
    );
}
