import React from 'react';
import { Play, ShieldAlert } from 'lucide-react';
import type { CrashSnapshot, ObstacleKind } from '../types/game';

interface ContinuePopupProps {
  snapshot: CrashSnapshot;
  rewardedAdsEnabled: boolean;
  blockId: string;
  onWatchAd: () => void;
  onDecline: () => void;
}

const OBSTACLE_NAMES: Record<ObstacleKind, string> = {
  cone: 'Traffic Cone',
  barrier: 'Road Barrier',
  barrel: 'Hazard Drum',
  overhead_sign: 'Overhead Gantry',
  delivery_van: 'Stalled Delivery Van',
};

export const ContinuePopup: React.FC<ContinuePopupProps> = ({
  snapshot,
  rewardedAdsEnabled,
  blockId,
  onWatchAd,
  onDecline,
}) => {
  const revivesLeft = Math.max(0, snapshot.maxRevivesPerRun - snapshot.revivesUsed);
  const canWatchAd = rewardedAdsEnabled && revivesLeft > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="continue-popup-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-700/80 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h2
              id="continue-popup-title"
              className="font-display text-2xl font-bold tracking-tight text-white"
            >
              Obstacle Hit — Continue Run?
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              Collided with a {OBSTACLE_NAMES[snapshot.obstacleHit]} at{' '}
              <span className="font-mono-tabular font-semibold text-white">
                {snapshot.distanceMeters}m
              </span>
              .
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3.5 text-center">
          <div>
            <div className="text-xs text-slate-400">Distance</div>
            <div className="mt-0.5 font-mono-tabular text-lg font-semibold text-white">
              {snapshot.distanceMeters}m
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Score</div>
            <div className="mt-0.5 font-mono-tabular text-lg font-semibold text-white">
              {snapshot.score.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Revives Left</div>
            <div className="mt-0.5 font-mono-tabular text-lg font-semibold text-amber-400">
              {revivesLeft}/{snapshot.maxRevivesPerRun}
            </div>
          </div>
        </div>

        <div className="mt-4 text-xs text-slate-400">
          {!rewardedAdsEnabled ? (
            <span>
              Rewarded ads are turned off in your Ad Preferences. Tap No Thanks to view your run summary.
            </span>
          ) : revivesLeft <= 0 ? (
            <span>
              Maximum revives ({snapshot.maxRevivesPerRun}) used for this run. Tap No Thanks to finish.
            </span>
          ) : (
            <span>
              Optional AdsGram placement (Block {blockId}): watch a short ad to resume at{' '}
              {snapshot.distanceMeters}m with a 2.5s safety shield. Viewing only — clicking the ad is never required.
            </span>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onWatchAd}
            disabled={!canWatchAd}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 whitespace-nowrap"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Watch Ad to Continue</span>
          </button>

          <button
            type="button"
            onClick={onDecline}
            className="flex flex-1 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-100 transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 whitespace-nowrap"
          >
            No Thanks
          </button>
        </div>
      </div>
    </div>
  );
};
