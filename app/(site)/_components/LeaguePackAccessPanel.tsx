import { requestableLeaguePackCatalog } from '../_lib/leaguePackCatalog';
import type { LeaguePackId } from '../_lib/leaguePacks';

type LeaguePackAccessPanelProps = {
  hasSupabaseEnv: boolean;
  isLoggedIn: boolean;
  isLoadingLeaguePackAccess: boolean;
  leaguePackAccessError: string | null;
  enabledPackIds: LeaguePackId[];
  hiddenItemCount?: number;
  hiddenItemLabel?: string;
  title?: string;
};

function summarizeLabels(labels: string[], maxVisible = 4) {
  if (labels.length <= maxVisible) {
    return labels.join(', ');
  }

  const visible = labels.slice(0, maxVisible).join(', ');
  return `${visible} + ${labels.length - maxVisible} mere`;
}

function formatHiddenCount(count: number, label: string) {
  return `${count} ${label} er skjult i denne visning.`;
}

export default function LeaguePackAccessPanel({
  hasSupabaseEnv,
  isLoggedIn,
  isLoadingLeaguePackAccess,
  leaguePackAccessError,
  enabledPackIds,
  hiddenItemCount = 0,
  hiddenItemLabel = 'elementer',
  title = 'Adgang til ligaer',
}: LeaguePackAccessPanelProps) {
  const enabledPackIdSet = new Set<string>(enabledPackIds);
  const unlockedPremiumPacks = requestableLeaguePackCatalog.filter((entry) => enabledPackIdSet.has(entry.id));
  const lockedPremiumPacks = requestableLeaguePackCatalog.filter((entry) => !enabledPackIdSet.has(entry.id));
  const hiddenSummary = hiddenItemCount > 0 ? formatHiddenCount(hiddenItemCount, hiddenItemLabel) : null;

  if (!hasSupabaseEnv) {
    return (
      <div className="border-b border-white/5 p-5 md:p-6">
        <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
          <div className="text-sm font-medium text-white">{title}</div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Login er ikke slået til i denne version endnu, så du ser kun de danske rækker her.
          </p>
          {hiddenSummary && <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{hiddenSummary}</p>}
        </div>
      </div>
    );
  }

  if (isLoadingLeaguePackAccess) {
    return (
      <div className="border-b border-white/5 p-5 md:p-6">
        <div className="rounded-[24px] border border-white/8 bg-white/4 p-4 text-sm text-[var(--muted)]">
          Henter din adgang til ligaer...
        </div>
      </div>
    );
  }

  if (leaguePackAccessError) {
    return (
      <div className="border-b border-white/5 p-5 md:p-6">
        <div className="rounded-[24px] border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200">
          {leaguePackAccessError}
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-white/5 p-5 md:p-6">
      <div className="rounded-[28px] border border-[rgba(184,255,106,0.18)] bg-[rgba(184,255,106,0.08)] p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="text-sm font-medium text-white">{title}</div>
            {!isLoggedIn ? (
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Du ser kun Danmark lige nu. Ligaer i andre lande er premium og bliver først synlige,
                når du logger ind og får den relevante landepakke aktiveret på din konto.
              </p>
            ) : (
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Danmark er altid åbent. Flere lande bliver synlige, når de er åbnet på din konto.
              </p>
            )}
            {hiddenSummary && <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{hiddenSummary}</p>}
          </div>

          <div className="flex flex-wrap gap-2">
            <a href="/my" className="cta-primary">
              {!isLoggedIn ? 'Log ind og se adgang' : lockedPremiumPacks.length > 0 ? 'Anmod om flere ligaer' : 'Administrer adgang'}
            </a>
            <a href="/support" className="cta-secondary">
              Hvad betyder premium?
            </a>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Åbent nu</div>
            <div className="mt-2 text-base font-semibold text-white">
              {unlockedPremiumPacks.length > 0
                ? `Danmark + ${unlockedPremiumPacks.length} ekstra land${unlockedPremiumPacks.length === 1 ? '' : 'e'}`
                : 'Kun Danmark'}
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {unlockedPremiumPacks.length > 0
                ? summarizeLabels(unlockedPremiumPacks.map((entry) => entry.label))
                : 'De danske rækker er åbne.'}
            </p>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Låst lige nu</div>
            <div className="mt-2 text-base font-semibold text-white">
              {lockedPremiumPacks.length > 0
                ? `${lockedPremiumPacks.length} land${lockedPremiumPacks.length === 1 ? '' : 'e'} mangler`
                : 'Alt premium-indhold er åbent'}
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {lockedPremiumPacks.length > 0
                ? summarizeLabels(lockedPremiumPacks.map((entry) => entry.label))
                : 'Din konto har allerede adgang til alle nuværende lande.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
