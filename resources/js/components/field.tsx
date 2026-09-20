import type { InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    error?: string;
};

/** A labelled input in the storefront's handwritten style. */
export default function Field({ label, error, ...input }: Props) {
    return (
        <label className="font-hand text-lav-700 grid gap-1 text-xl">
            {label}
            <input
                {...input}
                className="border-lav-300 font-hand text-lav-800 focus:border-lav-600 rounded-full border-2 bg-white px-4 py-2 text-lg outline-none"
            />
            {error && (
                <span
                    className="font-hand text-base text-rose-700"
                    role="alert"
                >
                    {error}
                </span>
            )}
        </label>
    );
}
