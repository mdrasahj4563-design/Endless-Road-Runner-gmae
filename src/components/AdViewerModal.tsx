import React, { useEffect, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { PLACEMENT_METADATA } from '../lib/adsgram';

interface AdViewerModalProps {
  mode: 'adsgram_sdk' | 'browser_preview';
  blockId: string;
  errorMsg: string | null;
  onPreviewComplete: () => void;
  onCancel: () => void;
}

const PREVIEW_DURATION_SEC = 5;

export const AdViewerModal: React.FC<AdViewerModalProps> = ({
  mode,
  blockId,
  errorMsg,
  onPreviewComplete,
  onCancel,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(PREVIEW_DURATION_SEC);

  useEffect(() => {
    if (mode !== 'browser_preview' || errorMsg) return;
    setSecondsLeft(PREVIEW_DURATION_SEC);
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [mode, errorMsg]);

  const progress =
    mode === 'browser_preview'
      ? Math.min(100, ((PREVIEW_DURATION_SEC - secondsLeft) / PREVIEW_DURATION_SEC) * 100)
      : 45;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ad-viewer-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs font-medium text-slate-400">
            AdsGram Rewarded Placement · Block {blockId}
          </span>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close ad"
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h3
          id="ad-viewer-title"
          className="mt-3 font-display text-2xl font-bold text-white"
        >
          {errorMsg
            ? 'Ad Unavailable'
            : mode === 'adsgram_sdk'
            ? 'Loading AdsGram Rewarded Ad'
            : 'Opt-In Rewarded Ad Preview'}
        </h3>

        {errorMsg ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-slate-300">{errorMsg}</p>
            <button
              type="button"
              onClick={onCancel}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Return to Run Menu
            </button>
          </div>
        ) : mode === 'adsgram_sdk' ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-slate-300">
              Waiting for AdsGram SDK view completion. Clicking the advertisement is never required.
            </p>
            <div className="h-2 w-full overflow-hidden rounded bg-slate-800">
              <div className="h-full w-1/2 animate-pulse bg-amber-500" />
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700"
            >
              Cancel &amp; End Run
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Placement: {PLACEMENT_METADATA.placementId}</span>
                <span className="font-mono-tabular text-amber-400">
                  {secondsLeft > 0 ? `${secondsLeft}s remaining` : 'View Complete'}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-200">
                Browser preview mode: in Telegram Mini App with a live numeric Block ID, the native AdsGram player runs here. Watching completes automatically with zero ad-click requirement.
              </p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded bg-slate-800">
                <div
                  className="h-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {secondsLeft === 0 ? (
              <button
                type="button"
                onClick={onPreviewComplete}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-400"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Resume Run Now</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onCancel}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700"
              >
                Skip &amp; End Run
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
