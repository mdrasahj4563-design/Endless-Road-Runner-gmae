import React, { useState } from 'react';
import { Check, ShieldCheck, X } from 'lucide-react';
import {
  isAdsgramSdkLoaded,
  isTelegramWebAppActive,
  PLACEMENT_METADATA,
} from '../lib/adsgram';
import type { PlayerProfile } from '../types/game';

interface ComplianceModalProps {
  profile: PlayerProfile;
  initialTab?: 'placement' | 'ledger' | 'preferences';
  onClose: () => void;
  onUpdateConsent: (enabled: boolean) => void;
  onUpdateConfig: (blockId: string, botUsername: string) => void;
}

export const ComplianceModal: React.FC<ComplianceModalProps> = ({
  profile,
  initialTab = 'placement',
  onClose,
  onUpdateConsent,
  onUpdateConfig,
}) => {
  const [tab, setTab] = useState<'placement' | 'ledger' | 'preferences'>(initialTab);
  const [blockInput, setBlockInput] = useState(profile.customBlockId);
  const [botInput, setBotInput] = useState(profile.botUsername);
  const [savedNotice, setSavedNotice] = useState(false);

  const sdkReady = isAdsgramSdkLoaded();
  const tmaActive = isTelegramWebAppActive();

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateConfig(blockInput.trim() || 'demo-crash-revive', botInput.trim());
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="compliance-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
    >
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <h2
              id="compliance-modal-title"
              className="font-display text-2xl font-bold text-white"
            >
              AdsGram Placement &amp; Reward Ledger
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-1 border-b border-slate-800 px-6 py-2.5">
          <button
            type="button"
            onClick={() => setTab('placement')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === 'placement'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Ad Placement Map
          </button>
          <button
            type="button"
            onClick={() => setTab('ledger')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === 'ledger'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Verified Reward Ledger ({profile.rewardLedger.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('preferences')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === 'preferences'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Consent &amp; TMA Config
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'placement' && (
            <div className="space-y-6">
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                <h3 className="text-sm font-semibold text-white">
                  Registered AdsGram Placement Location
                </h3>
                <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-slate-400">Placement ID</dt>
                    <dd className="mt-0.5 font-mono-tabular text-slate-100">
                      {PLACEMENT_METADATA.placementId}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Configured Block ID</dt>
                    <dd className="mt-0.5 font-mono-tabular text-amber-400">
                      {profile.customBlockId}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Exact Screen &amp; Trigger</dt>
                    <dd className="mt-0.5 text-slate-200">
                      {PLACEMENT_METADATA.screenName} · {PLACEMENT_METADATA.triggerMoment}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Reward Granted</dt>
                    <dd className="mt-0.5 text-slate-200">
                      {PLACEMENT_METADATA.rewardGranted}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white">
                  Moderation &amp; Player Protection Commitments
                </h3>
                <ul className="space-y-2.5 text-sm text-slate-300">
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span>
                      <strong className="text-white">No Click-Ads or Forced Interstitials:</strong>{' '}
                      Starting runs, switching lanes, jumping, unlocking runners, and restarting never trigger advertisements.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span>
                      <strong className="text-white">View-Only Reward Completion:</strong>{' '}
                      Continuing a crashed run only requires viewing the opt-in rewarded ad; users are never required or coerced to click an ad creative.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span>
                      <strong className="text-white">Explicit Opt-Out Respected:</strong>{' '}
                      Choosing &ldquo;No Thanks&rdquo; ends the run cleanly with zero restriction, and rewarded ads can be disabled completely in Consent &amp; TMA Config.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span>
                      <strong className="text-white">Realistic Gameplay-Only Rewards:</strong>{' '}
                      Ads grant up to 2 gameplay revives per run at the exact crash point. No unrealistic cashout claims or fabricated token payouts exist.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {tab === 'ledger' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-slate-300">
                  Publicly inspectable local ledger of every rewarded ad revive and obstacle-continue decision recorded in this app.
                </p>
                <span className="font-mono-tabular text-xs text-slate-400">
                  Total Runs: {profile.runs.length} · Total Coins: {profile.coins}
                </span>
              </div>

              {profile.rewardLedger.length === 0 ? (
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-8 text-center text-sm text-slate-400">
                  No rewarded ad events recorded yet. Hit an obstacle during a run and choose &ldquo;Watch Ad to Continue&rdquo; or &ldquo;No Thanks&rdquo; to see verified entries here.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-800 bg-slate-950 text-slate-400">
                      <tr>
                        <th className="px-3 py-2.5 font-medium">Time</th>
                        <th className="px-3 py-2.5 font-medium">Run ID</th>
                        <th className="px-3 py-2.5 font-medium">Block</th>
                        <th className="px-3 py-2.5 font-medium">Crash</th>
                        <th className="px-3 py-2.5 font-medium">Outcome</th>
                        <th className="px-3 py-2.5 font-medium">Reward</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 bg-slate-900/40 text-slate-200">
                      {profile.rewardLedger.map((entry) => (
                        <tr key={entry.id}>
                          <td className="px-3 py-2.5 font-mono-tabular text-slate-400 whitespace-nowrap">
                            {new Date(entry.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </td>
                          <td className="px-3 py-2.5 font-mono-tabular text-slate-300">
                            {entry.runId.slice(0, 8)}
                          </td>
                          <td className="px-3 py-2.5 font-mono-tabular text-slate-300">
                            {entry.blockId}
                          </td>
                          <td className="px-3 py-2.5 font-mono-tabular">
                            {entry.distanceAtCrash}m
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {entry.outcome === 'completed' ? (
                              <span className="font-medium text-emerald-400">
                                Completed ({entry.mode === 'adsgram_sdk' ? 'SDK' : 'Preview'})
                              </span>
                            ) : entry.outcome === 'declined' ? (
                              <span className="text-slate-400">Declined (No Thanks)</span>
                            ) : (
                              <span className="text-amber-400">Cancelled / Error</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-slate-200">
                            {entry.rewardGranted}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'preferences' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Allow Optional Rewarded Ads
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    When disabled, the crash popup will never display or load AdsGram ads and only offers &ldquo;No Thanks&rdquo; to finish the run.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={profile.adConsent.rewardedAdsEnabled}
                  onClick={() => onUpdateConsent(!profile.adConsent.rewardedAdsEnabled)}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                    profile.adConsent.rewardedAdsEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      profile.adConsent.rewardedAdsEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <form onSubmit={handleSaveConfig} className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white">
                    AdsGram &amp; Telegram Mini App Configuration
                  </h3>
                  <span className="text-xs text-slate-400">
                    SDK Script: {sdkReady ? 'Loaded' : 'Standalone Mode'} · TMA Context: {tmaActive ? 'Active' : 'Browser'}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block text-xs">
                    <span className="font-medium text-slate-300">AdsGram Block ID</span>
                    <input
                      type="text"
                      value={blockInput}
                      onChange={(e) => setBlockInput(e.target.value)}
                      placeholder="e.g. 1234 or demo-crash-revive"
                      className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono-tabular text-sm text-white focus:border-amber-500 focus:outline-none"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="font-medium text-slate-300">Telegram Bot Username (Optional)</span>
                    <input
                      type="text"
                      value={botInput}
                      onChange={(e) => setBotInput(e.target.value)}
                      placeholder="e.g. AsphaltDashBot"
                      className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono-tabular text-sm text-white focus:border-amber-500 focus:outline-none"
                    />
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400"
                  >
                    Save Configuration
                  </button>
                  {savedNotice && (
                    <span className="text-xs font-medium text-emerald-400">
                      Configuration saved
                    </span>
                  )}
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
