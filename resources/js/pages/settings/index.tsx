import { Head, Link, router, usePage } from '@inertiajs/react';
import { CatFace, Sparkle, SquiggleRule } from '@/components/doodles';
import PasswordForm from '@/components/password-form';
import ProfileForm from '@/components/profile-form';
import SettingsSection from '@/components/settings-section';
import { menu } from '@/routes';
import { destroy as forgetCard } from '@/routes/saved-cards';
import type { SavedCard, SharedProps } from '@/types';

type Props = {
    savedCards: SavedCard[];
    emailVerified: boolean;
    passwordRules: string;
    status: string | null;
};

function formatDate(iso: string | null): string {
    if (!iso) {
        return '';
    }

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(new Date(iso));
}

function expiry(card: SavedCard): string {
    return `${String(card.expMonth).padStart(2, '0')}/${String(card.expYear).slice(-2)}`;
}

export default function SettingsIndex({
    savedCards,
    emailVerified,
    passwordRules,
    status,
}: Props) {
    const { auth } = usePage<SharedProps>().props;

    const remove = (card: SavedCard) => {
        router.delete(forgetCard(card.id).url, {
            preserveScroll: true,
            preserveState: true,
        });
    };

    return (
        <div className="mx-auto max-w-4xl px-5 py-12">
            <Head title="Settings" />

            <div className="flex items-center gap-3">
                <CatFace size={40} className="text-lav-600" />
                <h1 className="font-marker text-lav-800 text-4xl sm:text-5xl">
                    Settings
                </h1>
            </div>
            <p className="font-hand text-lav-600 mt-2 text-2xl">
                Your account, your cards, your way.
            </p>

            <SquiggleRule className="text-lav-400 my-6 h-5 w-full" />

            <div className="grid gap-6">
                <SettingsSection
                    title="Profile"
                    description="The name on your orders and the address your receipts go to."
                >
                    {auth.user && (
                        <ProfileForm
                            user={auth.user}
                            emailVerified={emailVerified}
                            status={status}
                        />
                    )}
                </SettingsSection>

                <SettingsSection
                    title="Password"
                    description="Choose something you don't use anywhere else."
                >
                    <PasswordForm passwordRules={passwordRules} />
                </SettingsSection>

                <section className="sticker rounded-3xl bg-white/90 p-6">
                    <div className="border-lav-200 border-b-2 border-dashed pb-4">
                        <h2 className="font-marker text-lav-800 text-2xl">
                            Saved cards
                        </h2>
                    </div>

                    {savedCards.length === 0 ? (
                        <div className="grid place-items-center gap-3 py-10 text-center">
                            <Sparkle
                                size={30}
                                className="twinkle text-lav-400"
                            />
                            <p className="font-hand text-lav-800 text-2xl">
                                No cards saved yet.
                            </p>
                            <p className="font-hand text-lav-600 max-w-md text-lg">
                                Tick “Save this card for next time” while you
                                check out and it will show up here.
                            </p>
                            <Link
                                href={menu()}
                                className="sticker bg-lav-600 font-marker hover:bg-lav-700 mt-2 rounded-full px-6 py-3 text-lg text-white transition"
                            >
                                Explore the menu
                            </Link>
                        </div>
                    ) : (
                        <ul className="divide-lav-200 mt-2 flex flex-col divide-y-2 divide-dashed">
                            {savedCards.map((card) => (
                                <li
                                    key={card.id}
                                    className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="font-marker text-lav-800 text-xl">
                                            {card.brand} •••• {card.last4}
                                        </p>
                                        <p className="font-hand text-lav-600 text-lg">
                                            {card.expired
                                                ? `Expired ${expiry(card)}`
                                                : `Expires ${expiry(card)}`}
                                            {card.lastUsedAt
                                                ? ` · last used ${formatDate(card.lastUsedAt)}`
                                                : card.addedAt
                                                  ? ` · added ${formatDate(card.addedAt)}`
                                                  : ''}
                                        </p>
                                    </div>

                                    {card.expired && (
                                        <span className="font-hand rounded-full border-2 border-amber-300 bg-amber-50 px-3 py-1 text-base text-amber-900">
                                            Cannot be used
                                        </span>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => remove(card)}
                                        aria-label={`Remove the ${card.brand} ending ${card.last4}`}
                                        className="font-hand text-lav-700 hover:bg-lav-200 border-lav-300 rounded-full border-2 border-dashed px-4 py-1.5 text-lg transition"
                                    >
                                        Remove
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    );
}
