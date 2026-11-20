export type GameState =
  | 'TITLE_MENU'
  | 'PLAYING'
  | 'PAUSED'
  | 'COLLISION_CONTINUE'
  | 'WATCHING_AD'
  | 'GAME_OVER';

export type RunnerId = 'sprinter' | 'scooter' | 'courier_bot' | 'street_fox';

export interface RunnerDefinition {
  id: RunnerId;
  name: string;
  tagline: string;
  unlockCost: number; // 0 for starter; realistic in-game coins only
  accentColor: string;
  secondaryColor: string;
}

export type ObstacleKind =
  | 'cone'
  | 'barrier'
  | 'overhead_sign'
  | 'delivery_van'
  | 'barrel';

export interface RunSummary {
  id: string;
  timestamp: string;
  runnerId: RunnerId;
  runnerName: string;
  distanceMeters: number;
  score: number;
  coinsCollected: number;
  revivesUsed: number;
  endedBy: 'obstacle' | 'quit';
}

export interface RewardLedgerEntry {
  id: string;
  timestamp: string;
  runId: string;
  placement: 'crash_revive_modal';
  blockId: string;
  mode: 'adsgram_sdk' | 'browser_preview';
  outcome: 'completed' | 'declined' | 'error';
  rewardGranted: string;
  distanceAtCrash: number;
}

export interface AdConsentSettings {
  rewardedAdsEnabled: boolean;
  consentUpdatedAt: string;
}

export interface PlayerProfile {
  coins: number;
  bestDistance: number;
  bestScore: number;
  selectedRunner: RunnerId;
  unlockedRunners: RunnerId[];
  runs: RunSummary[];
  rewardLedger: RewardLedgerEntry[];
  adConsent: AdConsentSettings;
  customBlockId: string;
  botUsername: string;
}

export interface CrashSnapshot {
  distanceMeters: number;
  score: number;
  coinsCollected: number;
  revivesUsed: number;
  maxRevivesPerRun: number;
  obstacleHit: ObstacleKind;
}
