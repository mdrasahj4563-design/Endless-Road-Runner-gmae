export interface AdsgramShowResult {
  done: boolean;
  description?: string;
  state?: string;
  error?: boolean;
}

export interface AdsgramController {
  show: () => Promise<AdsgramShowResult>;
}

declare global {
  interface Window {
    Adsgram?: {
      init: (config: { blockId: string; debug?: boolean }) => AdsgramController;
    };
    Telegram?: {
      WebApp?: {
        ready?: () => void;
        expand?: () => void;
        initDataUnsafe?: {
          user?: {
            id?: number;
            username?: string;
            first_name?: string;
          };
        };
        platform?: string;
        version?: string;
      };
    };
  }
}

export const PLACEMENT_METADATA = {
  placementId: 'crash_revive_modal',
  screenName: 'Collision Continue Popup',
  triggerMoment: 'Immediately when runner collides with a road obstacle',
  userActionRequired: 'Optional tap on "Watch Ad to Continue" (no click on ad creative required)',
  rewardGranted: 'Resume current run at crash distance with 2.5s safety shield (max 2 revives per run)',
  adFormat: 'Rewarded Video / Interstitial Opt-In',
} as const;

export function getDefaultBlockId(): string {
  return import.meta.env.VITE_ADSGRAM_BLOCK_ID || 'demo-crash-revive';
}

export function getDefaultBotUsername(): string {
  return import.meta.env.VITE_TELEGRAM_BOT_USERNAME || '';
}

export function isTelegramWebAppActive(): boolean {
  if (typeof window === 'undefined') return false;
  const tg = window.Telegram?.WebApp;
  return Boolean(tg && tg.platform && tg.platform !== 'unknown');
}

export function isAdsgramSdkLoaded(): boolean {
  return typeof window !== 'undefined' && typeof window.Adsgram?.init === 'function';
}

export function canUseLiveAdsgramSdk(blockId: string): boolean {
  const trimmed = blockId.trim();
  const isNumericOrLiveBlock = trimmed.length > 0 && !trimmed.startsWith('demo-');
  return isAdsgramSdkLoaded() && isNumericOrLiveBlock;
}

export async function triggerLiveAdsgramAd(blockId: string): Promise<{
  completed: boolean;
  mode: 'adsgram_sdk' | 'browser_preview';
  reason?: string;
}> {
  if (!canUseLiveAdsgramSdk(blockId) || !window.Adsgram) {
    return {
      completed: false,
      mode: 'browser_preview',
      reason: 'Live AdsGram SDK unavailable or demo block ID configured.',
    };
  }

  try {
    const controller = window.Adsgram.init({ blockId: blockId.trim() });
    const result = await controller.show();
    if (result && result.done) {
      return { completed: true, mode: 'adsgram_sdk' };
    }
    return {
      completed: false,
      mode: 'adsgram_sdk',
      reason: result?.description || 'Ad closed before completion.',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ad failed to load or was skipped.';
    return {
      completed: false,
      mode: 'adsgram_sdk',
      reason: message,
    };
  }
}
