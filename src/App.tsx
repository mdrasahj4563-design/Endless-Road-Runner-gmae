import React, { useCallback, useEffect, useState } from 'react';
import {
  Pause,
  Play,
  RotateCcw,
  Shield,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AdViewerModal } from './components/AdViewerModal';
import { ComplianceModal } from './components/ComplianceModal';
import { ContinuePopup } from './components/ContinuePopup';
import { GarageModal } from './components/GarageModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { RunnerCanvas } from './components/RunnerCanvas';
import {
  canUseLiveAdsgramSdk,
  triggerLiveAdsgramAd,
} from './lib/adsgram';
import { soundEngine } from './lib/audio';
import {
  getRunnerById,
  loadProfile,
  recordRewardLedger,
  recordRun,
  RUNNERS,
  saveProfile,
} from './lib/storage';
import type {
  CrashSnapshot,
  GameState,
  PlayerProfile,
  RunnerId,
} from './types/game';

const MAX_REVIVES_PER_RUN = 2;

function createRunId(): string {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export default function App() {
  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfile());
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [runId, setRunId] = useState<string>(() => createRunId());
  const [revivesUsed, setRevivesUsed] = useState(0);
  const [reviveSignal, setReviveSignal] = useState(0);
  const [muted, setMuted] = useState(false);

  const [hud, setHud] = useState({
    distanceMeters: 0,
    score: 0,
    coinsCollected: 0,
    speedKmh: 38,
    shieldSeconds: 0,
  });

  const [crashSnapshot, setCrashSnapshot] = useState<CrashSnapshot | null>(null);
  const [adMode, setAdMode] = useState<'adsgram_sdk' | 'browser_preview'>('browser_preview');
  const [adError, setAdError] = useState<string | null>(null);

  const [activeModal, setActiveModal] = useState<
    null | 'garage' | 'leaderboard' | 'placement' | 'ledger' | 'preferences'
  >(null);

  // Initialize Telegram WebApp viewport cleanly if inside Telegram
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready?.();
      tg.expand?.();
    }
  }, []);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    soundEngine.setMuted(next);
    if (!next) soundEngine.playButton();
  };

  const startNewRun = useCallback(() => {
    soundEngine.playButton();
    setRunId(createRunId());
    setRevivesUsed(0);
    setReviveSignal(0);
    setCrashSnapshot(null);
    setAdError(null);
    setActiveModal(null);
    setGameState('PLAYING');
  }, []);

  const handleTogglePause = useCallback(() => {
    setGameState((prev) => {
      if (prev === 'PLAYING') return 'PAUSED';
      if (prev === 'PAUSED') return 'PLAYING';
      return prev;
    });
  }, []);

  const finalizeRun = useCallback(
    (snapshot: CrashSnapshot, endedBy: 'obstacle' | 'quit') => {
      const runner = getRunnerById(profile.selectedRunner);
      setProfile((prev) =>
        recordRun(prev, {
          id: runId,
          timestamp: new Date().toISOString(),
          runnerId: runner.id,
          runnerName: runner.name,
          distanceMeters: snapshot.distanceMeters,
          score: snapshot.score,
          coinsCollected: snapshot.coinsCollected,
          revivesUsed: snapshot.revivesUsed,
          endedBy,
        })
      );
      setGameState('GAME_OVER');
    },
    [profile.selectedRunner, runId]
  );

  const handleCollision = useCallback((snapshot: CrashSnapshot) => {
    setCrashSnapshot(snapshot);
    setGameState('COLLISION_CONTINUE');
  }, []);

  const completeRevive = useCallback(
    (mode: 'adsgram_sdk' | 'browser_preview') => {
      if (!crashSnapshot) return;
      setProfile((prev) =>
        recordRewardLedger(prev, {
          id: `rew_${Date.now().toString(36)}`,
          timestamp: new Date().toISOString(),
          runId,
          placement: 'crash_revive_modal',
          blockId: prev.customBlockId,
          mode,
          outcome: 'completed',
          rewardGranted: `1x Run Continue at ${crashSnapshot.distanceMeters}m`,
          distanceAtCrash: crashSnapshot.distanceMeters,
        })
      );
      setRevivesUsed((prev) => prev + 1);
      setReviveSignal((prev) => prev + 1);
      setCrashSnapshot(null);
      setAdError(null);
      setGameState('PLAYING');
    },
    [crashSnapshot, runId]
  );

  const handleWatchAdToContinue = async () => {
    if (!crashSnapshot) return;
    if (!profile.adConsent.rewardedAdsEnabled) return;
    if (revivesUsed >= MAX_REVIVES_PER_RUN) return;

    soundEngine.playButton();
    setAdError(null);

    const useLiveSdk = canUseLiveAdsgramSdk(profile.customBlockId);
    setAdMode(useLiveSdk ? 'adsgram_sdk' : 'browser_preview');
    setGameState('WATCHING_AD');

    if (useLiveSdk) {
      const result = await triggerLiveAdsgramAd(profile.customBlockId);
      if (result.completed) {
        completeRevive('adsgram_sdk');
      } else {
        setAdError(
          result.reason || 'Ad closed before completion. You can start a new run anytime.'
        );
        setProfile((prev) =>
          recordRewardLedger(prev, {
            id: `rew_${Date.now().toString(36)}`,
            timestamp: new Date().toISOString(),
            runId,
            placement: 'crash_revive_modal',
            blockId: prev.customBlockId,
            mode: 'adsgram_sdk',
            outcome: 'error',
            rewardGranted: 'None (Ad not completed)',
            distanceAtCrash: crashSnapshot.distanceMeters,
          })
        );
      }
    }
  };

  const handleDeclineContinue = () => {
    soundEngine.playButton();
    if (!crashSnapshot) {
      setGameState('GAME_OVER');
      return;
    }
    setProfile((prev) =>
      recordRewardLedger(prev, {
        id: `rew_${Date.now().toString(36)}`,
        timestamp: new Date().toISOString(),
        runId,
        placement: 'crash_revive_modal',
        blockId: prev.customBlockId,
        mode: canUseLiveAdsgramSdk(prev.customBlockId) ? 'adsgram_sdk' : 'browser_preview',
        outcome: 'declined',
        rewardGranted: 'None (No Thanks selected)',
        distanceAtCrash: crashSnapshot.distanceMeters,
      })
    );
    finalizeRun(crashSnapshot, 'obstacle');
  };

  const handleCancelWatchingAd = () => {
    soundEngine.playButton();
    if (crashSnapshot) {
      finalizeRun(crashSnapshot, 'obstacle');
    } else {
      setGameState('GAME_OVER');
    }
  };

  const handleSelectOrUnlockRunner = (runnerId: RunnerId) => {
    const def = getRunnerById(runnerId);
    setProfile((prev) => {
      if (prev.unlockedRunners.includes(runnerId)) {
        const next = { ...prev, selectedRunner: runnerId };
        saveProfile(next);
        return next;
      }
      if (prev.coins < def.unlockCost) return prev;
      const next: PlayerProfile = {
        ...prev,
        coins: prev.coins - def.unlockCost,
        unlockedRunners: [...prev.unlockedRunners, runnerId],
        selectedRunner: runnerId,
      };
      saveProfile(next);
      return next;
    });
    soundEngine.playButton();
  };

  const handleUpdateConsent = (enabled: boolean) => {
    setProfile((prev) => {
      const next: PlayerProfile = {
        ...prev,
        adConsent: {
          rewardedAdsEnabled: enabled,
          consentUpdatedAt: new Date().toISOString(),
        },
      };
      saveProfile(next);
      return next;
    });
  };

  const handleUpdateConfig = (blockId: string, botUsername: string) => {
    setProfile((prev) => {
      const next: PlayerProfile = {
        ...prev,
        customBlockId: blockId,
        botUsername,
      };
      saveProfile(next);
      return next;
    });
  };

  const activeRunner = getRunnerById(profile.selectedRunner);
  const canOpenModals = gameState === 'TITLE_MENU' || gameState === 'GAME_OVER' || gameState === 'PAUSED';

  return (
    <div className="flex h-dvh w-full flex-col bg-slate-950 text-slate-100">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-8 border-b border-slate-800/90 bg-slate-950 px-5 sm:px-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => {
            if (gameState === 'PLAYING') setGameState('PAUSED');
            setActiveModal(null);
          }}
          className="font-display text-xl font-extrabold tracking-tight text-white whitespace-nowrap shrink-0 hover:text-amber-400 transition-colors"
        >
          Asphalt Dash
        </button>

        {/* Zone 2: 4 Clean Single-Line Nav Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button
            type="button"
            onClick={() => {
              if (gameState === 'PLAYING') setGameState('PAUSED');
              setActiveModal('garage');
            }}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Garage
          </button>
          <button
            type="button"
            onClick={() => {
              if (gameState === 'PLAYING') setGameState('PAUSED');
              setActiveModal('leaderboard');
            }}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Leaderboard
          </button>
          <button
            type="button"
            onClick={() => {
              if (gameState === 'PLAYING') setGameState('PAUSED');
              setActiveModal('placement');
            }}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Ad Placement
          </button>
          <button
            type="button"
            onClick={() => {
              if (gameState === 'PLAYING') setGameState('PAUSED');
              setActiveModal('ledger');
            }}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Reward Ledger
          </button>
        </nav>

        {/* Zone 3: 1 Primary Utility Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            {muted ? <VolumeX className="h-4 w-4 text-slate-400" /> : <Volume2 className="h-4 w-4 text-amber-400" />}
            <span>{muted ? 'Muted' : 'Sound On'}</span>
          </button>
        </div>
      </header>

      {/* Main Dominant Road Game Viewport */}
      <main className="relative flex-1 overflow-hidden">
        <RunnerCanvas
          gameState={gameState}
          runnerId={profile.selectedRunner}
          runId={runId}
          reviveSignal={reviveSignal}
          revivesUsed={revivesUsed}
          maxRevivesPerRun={MAX_REVIVES_PER_RUN}
          onHudUpdate={setHud}
          onCollision={handleCollision}
          onTogglePause={handleTogglePause}
        />

        {/* Unobtrusive Top HUD Strip during active gameplay */}
        {(gameState === 'PLAYING' || gameState === 'PAUSED' || gameState === 'COLLISION_CONTINUE') && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-4 bg-gradient-to-b from-slate-950/85 via-slate-950/45 to-transparent px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm font-medium text-slate-200">
              <span className="font-mono-tabular font-bold text-white">
                {hud.distanceMeters}m
              </span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span className="font-mono-tabular text-amber-400 font-semibold">
                {hud.score.toLocaleString()} pts
              </span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span className="font-mono-tabular text-slate-200">
                {hud.coinsCollected} coins
              </span>
              <span aria-hidden="true" className="hidden sm:inline text-slate-500">·</span>
              <span className="hidden sm:inline font-mono-tabular text-slate-400">
                {hud.speedKmh} km/h
              </span>
              {hud.shieldSeconds > 0 && (
                <>
                  <span aria-hidden="true" className="text-slate-500">·</span>
                  <span className="inline-flex items-center gap-1 font-mono-tabular font-semibold text-emerald-400">
                    <Shield className="h-3.5 w-3.5" />
                    <span>Shield {hud.shieldSeconds}s</span>
                  </span>
                </>
              )}
            </div>

            {gameState === 'PLAYING' && (
              <button
                type="button"
                onClick={handleTogglePause}
                aria-label="Pause game"
                className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-slate-100 backdrop-blur-sm hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                <Pause className="h-3.5 w-3.5" />
                <span>Pause</span>
              </button>
            )}
          </div>
        )}

        {/* Title Menu Overlay */}
        {gameState === 'TITLE_MENU' && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]">
            <div className="w-full max-w-lg rounded-xl border border-slate-700/80 bg-slate-900/95 p-6 shadow-2xl sm:p-7">
              <div className="flex items-center justify-between gap-4 text-xs text-slate-400">
                <span>Active Runner: <strong className="text-slate-200">{activeRunner.name}</strong></span>
                <span className="font-mono-tabular text-amber-400">
                  Best: {profile.bestDistance}m · {profile.coins} Coins
                </span>
              </div>

              <h1
                className="mt-2 font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl"
                style={{ textWrap: 'balance' }}
              >
                Endless Road Runner
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Dodge traffic cones, construction barriers, overhead signs, and stalled delivery vans across three highway lanes.
              </p>

              <div className="mt-4 grid grid-cols-3 gap-2.5 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-300">
                <div>
                  <div className="font-semibold text-white">← / → or Swipe</div>
                  <div className="mt-0.5 text-slate-400">Switch lanes</div>
                </div>
                <div>
                  <div className="font-semibold text-white">↑ / Space</div>
                  <div className="mt-0.5 text-slate-400">Jump barriers</div>
                </div>
                <div>
                  <div className="font-semibold text-white">↓ / S</div>
                  <div className="mt-0.5 text-slate-400">Duck under signs</div>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={startNewRun}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-500 px-5 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-400 whitespace-nowrap"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>Start Run</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal('garage')}
                  className="flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-100 transition-colors hover:bg-slate-700 whitespace-nowrap"
                >
                  Choose Runner ({RUNNERS.length})
                </button>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4 text-xs text-slate-400">
                <span>
                  100% free to play · Optional AdsGram ad only on obstacle crash continue
                </span>
                <div className="flex items-center gap-4 md:hidden">
                  <button
                    type="button"
                    onClick={() => setActiveModal('leaderboard')}
                    className="font-medium text-slate-300 hover:text-white"
                  >
                    Records
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModal('placement')}
                    className="font-medium text-slate-300 hover:text-white"
                  >
                    Ad Policy
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Paused Overlay */}
        {gameState === 'PAUSED' && !activeModal && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-6 text-center shadow-2xl">
              <h2 className="font-display text-3xl font-bold text-white">
                Run Paused
              </h2>
              <p className="mt-1 font-mono-tabular text-sm text-slate-400">
                {hud.distanceMeters}m · {hud.score.toLocaleString()} pts
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => setGameState('PLAYING')}
                  className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400"
                >
                  Resume Run
                </button>
                <button
                  type="button"
                  onClick={() =>
                    finalizeRun(
                      {
                        distanceMeters: hud.distanceMeters,
                        score: hud.score,
                        coinsCollected: hud.coinsCollected,
                        revivesUsed,
                        maxRevivesPerRun: MAX_REVIVES_PER_RUN,
                        obstacleHit: 'cone',
                      },
                      'quit'
                    )
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700"
                >
                  End Run
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Game Over / Run Summary Overlay */}
        {gameState === 'GAME_OVER' && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
              <div className="text-xs font-medium text-slate-400">
                Run Summary · {activeRunner.name}
              </div>
              <h2 className="mt-1 font-display text-3xl font-bold text-white">
                Run Complete
              </h2>

              <div className="mt-5 grid grid-cols-3 gap-3 rounded-lg border border-slate-800 bg-slate-950/70 p-4 text-center">
                <div>
                  <div className="text-xs text-slate-400">Distance</div>
                  <div className="mt-0.5 font-mono-tabular text-xl font-bold text-white">
                    {hud.distanceMeters}m
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Score</div>
                  <div className="mt-0.5 font-mono-tabular text-xl font-bold text-amber-400">
                    {hud.score.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Coins</div>
                  <div className="mt-0.5 font-mono-tabular text-xl font-bold text-emerald-400">
                    +{hud.coinsCollected}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                <span>Personal Best: {profile.bestDistance}m</span>
                <span>Revives Used: {revivesUsed}/{MAX_REVIVES_PER_RUN}</span>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={startNewRun}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-amber-400 whitespace-nowrap"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Play Again</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal('garage')}
                  className="flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-700 whitespace-nowrap"
                >
                  Garage
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3 text-xs text-slate-400">
                <button
                  type="button"
                  onClick={() => setActiveModal('ledger')}
                  className="hover:text-white transition-colors"
                >
                  View Reward Ledger
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal('preferences')}
                  className="hover:text-white transition-colors"
                >
                  Ad Preferences
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Collision Continue Popup (2 buttons: Watch Ad to Continue OR No Thanks) */}
      {gameState === 'COLLISION_CONTINUE' && crashSnapshot && (
        <ContinuePopup
          snapshot={crashSnapshot}
          rewardedAdsEnabled={profile.adConsent.rewardedAdsEnabled}
          blockId={profile.customBlockId}
          onWatchAd={handleWatchAdToContinue}
          onDecline={handleDeclineContinue}
        />
      )}

      {/* Rewarded Ad Viewer */}
      {gameState === 'WATCHING_AD' && (
        <AdViewerModal
          mode={adMode}
          blockId={profile.customBlockId}
          errorMsg={adError}
          onPreviewComplete={() => completeRevive('browser_preview')}
          onCancel={handleCancelWatchingAd}
        />
      )}

      {/* Secondary Modals */}
      {activeModal === 'garage' && canOpenModals && (
        <GarageModal
          profile={profile}
          onSelectOrUnlock={handleSelectOrUnlockRunner}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'leaderboard' && canOpenModals && (
        <LeaderboardModal
          profile={profile}
          onClose={() => setActiveModal(null)}
        />
      )}

      {(activeModal === 'placement' ||
        activeModal === 'ledger' ||
        activeModal === 'preferences') &&
        canOpenModals && (
          <ComplianceModal
            profile={profile}
            initialTab={activeModal}
            onClose={() => setActiveModal(null)}
            onUpdateConsent={handleUpdateConsent}
            onUpdateConfig={handleUpdateConfig}
          />
        )}
    </div>
  );
}
