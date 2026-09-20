import { Form, Head } from '@inertiajs/react';

type Props = {
    status?: string;
};

export default function VerifyEmail({ status }: Props) {
    return (
        <>
            <Head title="Verify email" />

            <h1 className="font-marker text-lav-800 text-3xl">
                Check your email
            </h1>
            <p className="font-hand text-lav-600 mt-2 text-xl">
                We sent a confirmation link so your order history stays tied to
                the right inbox.
            </p>

            {status && (
                <p className="bg-lav-200 font-hand text-lav-800 mt-4 rounded-2xl px-4 py-2 text-lg">
                    A fresh link is on its way.
                </p>
            )}

            <Form
                action="/email/verification-notification"
                method="post"
                className="mt-6"
            >
                {({ processing }) => (
                    <button
                        type="submit"
                        disabled={processing}
                        className="sticker bg-lav-600 font-marker hover:bg-lav-700 w-full rounded-full py-3 text-base text-white transition disabled:opacity-50"
                    >
                        {processing ? 'Sending…' : 'Send another link'}
                    </button>
                )}
            </Form>
        </>
    );
}
