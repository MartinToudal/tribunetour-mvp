'use client';

type VisitedModelNoticeProps = {
    hasSupabaseEnv: boolean;
    isLoggedIn: boolean;
    userEmail?: string | null;
    compact?: boolean;
};

export default function VisitedModelNotice({
    hasSupabaseEnv,
    isLoggedIn,
    userEmail,
    compact = false,
}: VisitedModelNoticeProps) {
    if (!hasSupabaseEnv) {
        return (
            <div className="site-card-soft p-4 text-sm text-[var(--muted)]">
                Besøg og synkronisering kommer her, når web-login er koblet helt på den fælles brugerdata-model.
            </div>
        );
    }

    if (!isLoggedIn) {
        return (
            <div className={`site-card-soft text-sm text-[var(--muted)] ${compact ? 'p-4' : 'p-5 md:p-6'}`}>
                Log ind for at gemme din personlige besøgsstatus på tværs af Tribunetour. Uden login kan du stadig udforske stadions og kampe, men dine besøg bliver ikke gemt.
            </div>
        );
    }

    return (
        <div className={`site-card-soft text-sm text-[var(--muted)] ${compact ? 'p-4' : 'p-5 md:p-6'}`}>
            Din besøgsstatus er knyttet til {userEmail ?? 'din konto'} og bruges som din personlige `visited`-model på web. Det er denne model, der senere skal binde web og app tættere sammen.
        </div>
    );
}
