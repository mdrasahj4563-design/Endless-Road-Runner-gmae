import {
  getDefaultBlockId,
  getDefaultBotUsername,
} from './adsgram';
import type {
  PlayerProfile,
  RewardLedgerEntry,
  RunSummary,
  RunnerDefinition,
  RunnerId,
} from '../types/game';

const STORAGE_KEY = 'asphalt_dash_profile_v1';

export const RUNNERS: RunnerDefinition[] = [
  {
    id: 'sprinter',
    name: 'Street Sprinter',
    tagline: 'Balanced agility on busy highway lanes',
    unlockCost: 0,
    accentColor: '#F59E0B',
    secondaryColor: '#1E293B',
  },
  {
    id: 'scooter',
    name: 'Turbo Scooter',
    tagline: 'Zippy urban commuter with tight cornering',
    unlockCost: 40,
    accentColor: '#38BDF8',
    secondaryColor: '#0F172A',
  },
  {
    id: 'courier_bot',
    name: 'Delivery Bot',
    tagline: 'Autonomous cargo rover built for heavy traffic',
    unlockCost: 90,
    accentColor: '#10B981',
    secondaryColor: '#334155',
  },
  {
    id: 'street_fox',
    name: 'Red Fox',
    tagline: 'Nimble nocturnal sprinter with quick reflexes',
    unlockCost: 150,
    accentColor: '#EA580C',
    secondaryColor: '#FEF3C7',
  },
];

export function getRunnerById(id: RunnerId): RunnerDefinition {
  return RUNNERS.find((r) => r.id === id) ?? RUNNERS[0];
}

export function createDefaultProfile(): PlayerProfile {
  return {
    coins: 0,
    bestDistance: 0,
    bestScore: 0,
    selectedRunner: 'sprinter',
    unlockedRunners: ['sprinter'],
    runs: [],
    rewardLedger: [],
    adConsent: {
      rewardedAdsEnabled: true,
      consentUpdatedAt: new Date().toISOString(),
    },
    customBlockId: getDefaultBlockId(),
    botUsername: getDefaultBotUsername(),
  };
}

export function loadProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultProfile();
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    const base = createDefaultProfile();
    return {
      ...base,
      ...parsed,
      unlockedRunners:
        Array.isArray(parsed.unlockedRunners) && parsed.unlockedRunners.length > 0
          ? parsed.unlockedRunners
          : base.unlockedRunners,
      runs: Array.isArray(parsed.runs) ? parsed.runs : [],
      rewardLedger: Array.isArray(parsed.rewardLedger) ? parsed.rewardLedger : [],
      adConsent: parsed.adConsent ?? base.adConsent,
      customBlockId:
        typeof parsed.customBlockId === 'string' && parsed.customBlockId.trim().length > 0
          ? parsed.customBlockId
          : base.customBlockId,
      botUsername:
        typeof parsed.botUsername === 'string' ? parsed.botUsername : base.botUsername,
    };
  } catch {
    return createDefaultProfile();
  }
}

export function saveProfile(profile: PlayerProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function recordRun(profile: PlayerProfile, run: RunSummary): PlayerProfile {
  const next: PlayerProfile = {
    ...profile,
    coins: profile.coins + run.coinsCollected,
    bestDistance: Math.max(profile.bestDistance, run.distanceMeters),
    bestScore: Math.max(profile.bestScore, run.score),
    runs: [run, ...profile.runs].slice(0, 30),
  };
  saveProfile(next);
  return next;
}

export function recordRewardLedger(
  profile: PlayerProfile,
  entry: RewardLedgerEntry
): PlayerProfile {
  const next: PlayerProfile = {
    ...profile,
    rewardLedger: [entry, ...profile.rewardLedger].slice(0, 50),
  };
  saveProfile(next);
  return next;
}
