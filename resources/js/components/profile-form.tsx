import { Form } from '@inertiajs/react';
import Field from '@/components/field';
import { send } from '@/routes/verification';
import { update } from '@/routes/user-profile-information';
import type { AuthUser } from '@/types';

type Props = {
    user: AuthUser;
    emailVerified: boolean;
    /** "verification-link-sent" straight after a resend. */
    status: string | null;
};

const submitClasses =
    'sticker bg-lav-600 font-marker hover:bg-lav-700 rounded-full px-6 py-2.5 text-base text-white transition disabled:opacity-50';

export default function ProfileForm({ user, emailVerified, status }: Props) {
    return (
        <>
            <Form
                action={update()}
                errorBag="updateProfileInformation"
                options={{ preserveScroll: true }}
                className="mt-4 grid gap-4"
            >
                {({ processing, errors, recentlySuccessful }) => (
                    <>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field
                                label="Name"
                                name="name"
                                required
                                autoComplete="name"
                                defaultValue={user.name}
                                error={errors.name}
                            />
                            <Field
                                label="Email"
                                name="email"
                                type="email"
                                required
                                autoComplete="email"
                                defaultValue={user.email}
                                error={errors.email}
                            />
                        </div>

                        <div className="flex items-center gap-4">
                            <button
                                type="submit"
                                disabled={processing}
                                className={submitClasses}
                            >
                                {processing ? 'Saving…' : 'Save profile'}
                            </button>
                            {recentlySuccessful && (
                                <span
                                    className="font-hand text-lav-700 text-lg"
                                    role="status"
                                >
                                    Saved!
                                </span>
                            )}
                        </div>
                    </>
                )}
            </Form>

            {!emailVerified && (
                <div className="mt-5 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
                    <p className="font-hand text-lg text-amber-900">
                        {status === 'verification-link-sent'
                            ? `We sent a fresh link to ${user.email}. It can take a minute to arrive.`
                            : `${user.email} has not been confirmed yet. Follow the link we emailed you, or ask for a new one.`}
                    </p>
                    <Form action={send()} options={{ preserveScroll: true }}>
                        {({ processing }) => (
                            <button
                                type="submit"
                                disabled={processing}
                                className="font-hand mt-2 text-lg text-amber-900 underline decoration-dashed disabled:opacity-50"
                            >
                                {processing ? 'Sending…' : 'Send me a new link'}
                            </button>
                        )}
                    </Form>
                </div>
            )}
        </>
    );
}
