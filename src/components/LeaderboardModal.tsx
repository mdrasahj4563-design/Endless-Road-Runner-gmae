import React from 'react';
import { Trophy, X } from 'lucide-react';
import type { PlayerProfile } from '../types/game';

interface LeaderboardModalProps {
  profile: PlayerProfile;
  onClose: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  profile,
  onClose,
}) => {
  const sortedRuns = [...profile.runs]
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="leaderboard-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Trophy className="h-5 w-5 text-amber-400" />
            <h2
              id="leaderboard-modal-title"
              className="font-display text-2xl font-bold text-white"
            >
              Run Records &amp; Best Scores
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close leaderboard"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 border-b border-slate-800 bg-slate-950/50 px-6 py-4 text-center">
          <div>
            <div className="text-xs text-slate-400">Best Distance</div>
            <div className="mt-0.5 font-mono-tabular text-xl font-bold text-white">
              {profile.bestDistance}m
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">High Score</div>
            <div className="mt-0.5 font-mono-tabular text-xl font-bold text-amber-400">
              {profile.bestScore.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Coin Balance</div>
            <div className="mt-0.5 font-mono-tabular text-xl font-bold text-emerald-400">
              {profile.coins}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {sortedRuns.length === 0 ? (
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-8 text-center text-sm text-slate-400">
              Complete your first road run to record your score and distance here.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950 text-slate-400">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">#</th>
                    <th className="px-3 py-2.5 font-medium">Runner</th>
                    <th className="px-3 py-2.5 font-medium">Distance</th>
                    <th className="px-3 py-2.5 font-medium">Score</th>
                    <th className="px-3 py-2.5 font-medium">Coins</th>
                    <th className="px-3 py-2.5 font-medium">Revives</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-200">
                  {sortedRuns.map((run, index) => (
                    <tr key={run.id}>
                      <td className="px-3 py-2.5 font-mono-tabular text-slate-400">
                        {index + 1}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-white">
                        {run.runnerName}
                      </td>
                      <td className="px-3 py-2.5 font-mono-tabular">
                        {run.distanceMeters}m
                      </td>
                      <td className="px-3 py-2.5 font-mono-tabular font-semibold text-amber-400">
                        {run.score.toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 font-mono-tabular">
                        +{run.coinsCollected}
                      </td>
                      <td className="px-3 py-2.5 font-mono-tabular text-slate-400">
                        {run.revivesUsed}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
