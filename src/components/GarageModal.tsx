import React from 'react';
import { Check, Coins, Lock, X } from 'lucide-react';
import { RUNNERS } from '../lib/storage';
import type { PlayerProfile, RunnerId } from '../types/game';

interface GarageModalProps {
  profile: PlayerProfile;
  onSelectOrUnlock: (runnerId: RunnerId) => void;
  onClose: () => void;
}

export const GarageModal: React.FC<GarageModalProps> = ({
  profile,
  onSelectOrUnlock,
  onClose,
}) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="garage-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h2
              id="garage-modal-title"
              className="font-display text-2xl font-bold text-white"
            >
              Runner Garage
            </h2>
            <p className="text-xs text-slate-400">
              Unlock any runner using coins collected on the road. Zero ads required.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 font-mono-tabular text-sm font-semibold text-amber-400">
              <Coins className="h-4 w-4" />
              <span>{profile.coins} Coins</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close garage"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
          {RUNNERS.map((runner) => {
            const isUnlocked = profile.unlockedRunners.includes(runner.id);
            const isSelected = profile.selectedRunner === runner.id;
            const canAfford = profile.coins >= runner.unlockCost;

            return (
              <div
                key={runner.id}
                className={`flex flex-col justify-between rounded-lg border p-4 transition-colors ${
                  isSelected
                    ? 'border-amber-500/80 bg-slate-800/70'
                    : 'border-slate-800 bg-slate-950/60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-4 w-4 rounded-sm"
                        style={{ backgroundColor: runner.accentColor }}
                      />
                      <h3 className="font-display text-xl font-bold text-white">
                        {runner.name}
                      </h3>
                    </div>
                    {isSelected && (
                      <span className="text-xs font-semibold text-amber-400">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400">{runner.tagline}</p>
                </div>

                <div className="mt-4">
                  {isUnlocked ? (
                    <button
                      type="button"
                      onClick={() => onSelectOrUnlock(runner.id)}
                      disabled={isSelected}
                      className={`flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                        isSelected
                          ? 'bg-slate-800 text-slate-400 cursor-default'
                          : 'bg-slate-800 text-white hover:bg-slate-700'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-amber-400" />
                          <span>Equipped</span>
                        </>
                      ) : (
                        <span>Equip Runner</span>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelectOrUnlock(runner.id)}
                      disabled={!canAfford}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      <span>Unlock · {runner.unlockCost} Coins</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
