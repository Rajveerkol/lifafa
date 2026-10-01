import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Youtube,
  Pause,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { loadYouTubeIframeApi } from '../../utils/youtubeUtils';

interface YouTubeWatchPlayerProps {
  videoId: string;
  taskTitle?: string;
  isCompleted: boolean;
  onCompleted: () => void;
  taskNumber?: number;
}

export const YouTubeWatchPlayer: React.FC<YouTubeWatchPlayerProps> = ({
  videoId,
  taskTitle = 'Watch YouTube Video',
  isCompleted,
  onCompleted,
  taskNumber,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const playerIdRef = useRef(`yt_player_${videoId}_${Math.random().toString(36).substring(2, 8)}`);

  // Playback & Watch Session State
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [playerState, setPlayerState] = useState<number>(-1); // -1 = unstarted, 1 = playing, 2 = paused, 3 = buffering, 0 = ended
  const [hasStartedWatching, setHasStartedWatching] = useState(false);
  const [antiSkipWarning, setAntiSkipWarning] = useState<string | null>(null);
  const [isTabPaused, setIsTabPaused] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Anti-skip strict watermark and elapsed real-time tracking refs
  const maxWatchedTimeRef = useRef<number>(0);
  const lastObservedTimeRef = useRef<number>(0);
  const lastObservedRealTimeRef = useRef<number>(Date.now());
  const isSeekingRef = useRef<boolean>(false);
  const totalWatchedSecondsRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const playerStateRef = useRef<number>(-1);
  const durationRef = useRef<number>(0);
  const isCompletedRef = useRef<boolean>(isCompleted);
  const onCompletedRef = useRef<() => void>(onCompleted);
  const lastRenderedSecRef = useRef<number>(-1);

  useEffect(() => {
    isCompletedRef.current = isCompleted;
  }, [isCompleted]);

  useEffect(() => {
    onCompletedRef.current = onCompleted;
  }, [onCompleted]);

  // 1. Natural Completion Handler (stable ref-based callback)
  const handleNaturalEnd = useCallback(() => {
    if (isCompletedRef.current) return;

    let currentDuration = durationRef.current;
    try {
      const dur = playerRef.current?.getDuration?.();
      if (typeof dur === 'number' && dur > 0) {
        currentDuration = dur;
      }
    } catch {}

    const maxWatched = maxWatchedTimeRef.current;
    const totalWatched = totalWatchedSecondsRef.current;

    // Strict Anti-Skip Check:
    // 1. Video duration must be positive
    // 2. Continuous playback watermark must reach within 1.5s of total video duration
    // 3. User must have legitimately spent at least (duration - 2.5s) playing the video
    const hasReachedEndWatermark = currentDuration > 0 && maxWatched >= Math.max(0, currentDuration - 1.5);
    const hasWatchedSufficientTime = currentDuration > 0 && totalWatched >= Math.max(0, currentDuration - 2.5);

    if (hasReachedEndWatermark && hasWatchedSufficientTime) {
      setAntiSkipWarning(null);
      setIsTabPaused(false);
      isCompletedRef.current = true;
      onCompletedRef.current();
    } else {
      // Premature end attempt / jumped to end without watching
      setAntiSkipWarning('Please watch the video completely without skipping.');
      try {
        if (typeof playerRef.current?.pauseVideo === 'function') {
          playerRef.current.pauseVideo();
        }
        if (typeof playerRef.current?.seekTo === 'function') {
          playerRef.current.seekTo(maxWatchedTimeRef.current, true);
        }
      } catch {}

      const intMax = Math.floor(maxWatchedTimeRef.current);
      setCurrentTime(intMax);
      lastRenderedSecRef.current = intMax;
    }
  }, []);

  // 2. Strict Anti-Skip Engine: Verifies playback time against legitimate watermark
  const checkAndEnforceAntiSkip = useCallback((current: number, state?: number) => {
    if (isCompletedRef.current || !playerRef.current) return;

    // Auto-capture duration if not yet populated
    try {
      const dur = playerRef.current?.getDuration?.();
      if (typeof dur === 'number' && dur > 0 && durationRef.current !== dur) {
        durationRef.current = dur;
        setDuration(dur);
      }
    } catch {}

    // If snap-back seek is in progress, wait until the player lands near maxWatchedTime
    if (isSeekingRef.current) {
      if (Math.abs(current - maxWatchedTimeRef.current) <= 0.6) {
        isSeekingRef.current = false;
        lastObservedTimeRef.current = current;
        lastObservedRealTimeRef.current = Date.now();
      }
      return;
    }

    const maxWatched = maxWatchedTimeRef.current;
    const TOLERANCE = 0.8; // Strict threshold for forward seek detection

    // A. FORWARD SEEK ATTEMPT:
    // If currentTime jumped forward beyond the maximum legitimately watched point plus tolerance
    if (current > maxWatched + TOLERANCE) {
      isSeekingRef.current = true;
      try {
        if (typeof playerRef.current.pauseVideo === 'function') {
          playerRef.current.pauseVideo();
        }
        if (typeof playerRef.current.seekTo === 'function') {
          playerRef.current.seekTo(maxWatched, true);
        }
      } catch {}

      const intMax = Math.floor(maxWatched);
      setCurrentTime(intMax);
      lastRenderedSecRef.current = intMax;
      setAntiSkipWarning('Please watch the video completely without skipping.');
      lastObservedTimeRef.current = maxWatched;
      lastObservedRealTimeRef.current = Date.now();
      // CRITICAL: Stop immediately and NEVER advance maxWatchedTime on a seek!
      return;
    }

    // B. BACKWARD POSITION:
    // User rewound or is replaying an earlier segment. Permitted, but never increases maxWatchedTime.
    if (current <= maxWatched) {
      const intCur = Math.floor(current);
      if (intCur !== lastRenderedSecRef.current) {
        lastRenderedSecRef.current = intCur;
        setCurrentTime(intCur);
      }
      lastObservedTimeRef.current = current;
      lastObservedRealTimeRef.current = Date.now();
      return;
    }

    // C. LEGITIMATE CONTINUOUS FORWARD PLAYBACK:
    // Current is slightly ahead of maxWatched (within 0.8s tolerance).
    // Advance maxWatched strictly proportional to elapsed real wall-clock time!
    const activeState = state !== undefined ? state : playerStateRef.current;
    if (activeState === 1) {
      const now = Date.now();
      const elapsedRealSec = (now - lastObservedRealTimeRef.current) / 1000;
      let rate = 1;
      try {
        rate = playerRef.current?.getPlaybackRate?.() || 1;
      } catch {}
      const maxLegitimateAdvance = elapsedRealSec * rate + 0.15;
      const requestedAdvance = current - maxWatched;

      const advance = Math.min(requestedAdvance, maxLegitimateAdvance);
      if (advance > 0) {
        maxWatchedTimeRef.current = maxWatched + advance;
        totalWatchedSecondsRef.current += advance;
        setAntiSkipWarning((prev) => (prev ? null : prev));
      }

      lastObservedRealTimeRef.current = now;
      lastObservedTimeRef.current = current;

      const intWatched = Math.floor(maxWatchedTimeRef.current);
      if (intWatched !== lastRenderedSecRef.current) {
        lastRenderedSecRef.current = intWatched;
        setCurrentTime(intWatched);
      }
    }
  }, []);

  // 3. Initialize Official YouTube IFrame Player API (RUNS ONCE PER VIDEO ID)
  useEffect(() => {
    let isCancelled = false;

    loadYouTubeIframeApi()
      .then((YT) => {
        if (isCancelled || !containerRef.current) return;

        // Ensure clean mount element inside containerRef
        containerRef.current.innerHTML = '';
        const mountDiv = document.createElement('div');
        mountDiv.id = playerIdRef.current;
        mountDiv.className = 'w-full h-full';
        containerRef.current.appendChild(mountDiv);

        playerRef.current = new YT.Player(playerIdRef.current, {
          videoId,
          host: 'https://www.youtube.com',
          playerVars: {
            autoplay: 0,
            controls: 1,
            disablekb: 1, // Disable keyboard shortcuts to prevent bypass
            enablejsapi: 1,
            fs: 1,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            origin: typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'https://createlifafa.xyz',
            widget_referrer: typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'https://createlifafa.xyz',
          },
          events: {
            onReady: (event: any) => {
              if (isCancelled) return;
              setIsPlayerReady(true);
              setPlayerError(null);
              try {
                const dur = event.target?.getDuration?.() || 0;
                if (dur > 0) {
                  durationRef.current = dur;
                  setDuration(dur);
                }
              } catch {}
            },
            onStateChange: (event: any) => {
              if (isCancelled) return;
              const state = event.data;
              playerStateRef.current = state;
              setPlayerState(state);

              // Capture duration if not yet populated
              try {
                const dur = playerRef.current?.getDuration?.() || 0;
                if (dur > 0 && durationRef.current !== dur) {
                  durationRef.current = dur;
                  setDuration(dur);
                }
              } catch {}

              // YT.PlayerState:
              // -1 = UNSTARTED, 0 = ENDED, 1 = PLAYING, 2 = PAUSED, 3 = BUFFERING
              if (state === 1) {
                // PLAYING
                isPlayingRef.current = true;
                setHasStartedWatching(true);
                setIsTabPaused(false);
                lastObservedRealTimeRef.current = Date.now();
                const cur = playerRef.current?.getCurrentTime?.() || 0;
                lastObservedTimeRef.current = cur;
                checkAndEnforceAntiSkip(cur, 1);
              } else if (state === 2 || state === 3) {
                // PAUSED or BUFFERING
                isPlayingRef.current = false;
                const cur = playerRef.current?.getCurrentTime?.() || 0;
                checkAndEnforceAntiSkip(cur, state);
              } else if (state === 0) {
                // ENDED
                isPlayingRef.current = false;
                handleNaturalEnd();
              }
            },
            onError: (errEvent: any) => {
              if (isCancelled) return;
              const code = errEvent.data;
              console.error('YouTube Player Error:', code);
              let msg = "Video couldn't be loaded. Please refresh and try again.";
              if (code === 101 || code === 150) {
                msg = 'This video cannot be played in embedded mode by request of its owner.';
              } else if (code === 100) {
                msg = 'This video is private, deleted, or unavailable.';
              } else if (code === 2) {
                msg = 'Invalid YouTube video ID.';
              }
              setPlayerError(msg);
            },
          },
        });
      })
      .catch((err) => {
        if (isCancelled) return;
        console.error('Failed to initialize YouTube IFrame Player:', err);
        setPlayerError("Video couldn't be loaded. Please refresh and try again.");
      });

    return () => {
      isCancelled = true;
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch {}
        playerRef.current = null;
      }
    };
  }, [videoId, checkAndEnforceAntiSkip, handleNaturalEnd]);

  // 4. High-Resolution Playback Polling (polls every 100ms continuously on mount)
  useEffect(() => {
    const timer = setInterval(() => {
      if (!playerRef.current || isCompletedRef.current) return;

      try {
        const cur = playerRef.current.getCurrentTime?.() || 0;
        const state = playerRef.current.getPlayerState?.();

        // Also capture duration if not yet populated
        if (durationRef.current === 0) {
          const dur = playerRef.current.getDuration?.() || 0;
          if (dur > 0) {
            durationRef.current = dur;
            setDuration(dur);
          }
        }

        checkAndEnforceAntiSkip(cur, state);
      } catch {
        // Player may be unmounting or in transition
      }
    }, 100);

    return () => {
      clearInterval(timer);
    };
  }, [checkAndEnforceAntiSkip]);

  // 5. Tab Visibility Protection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (isPlayingRef.current && playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
          try {
            playerRef.current.pauseVideo();
          } catch {}
          setIsTabPaused(true);
        }
      } else {
        if (playerStateRef.current === 1) {
          setIsTabPaused(false);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // 6. Refresh / Reload Protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasStartedWatching && !isCompletedRef.current) {
        e.preventDefault();
        const msg =
          'Refreshing or leaving this page will reset your video watch progress. You will need to watch the video again from the beginning.';
        e.returnValue = msg;
        return msg;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasStartedWatching]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      className={`rounded-2xl border transition-all ${
        isCompleted
          ? 'bg-white border-emerald-200 shadow-xs'
          : 'bg-white border-slate-200/90 shadow-xs'
      } p-3.5 sm:p-4 space-y-3`}
    >
      {/* Task Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {taskNumber !== undefined && (
            <div className="w-7 h-7 rounded-full bg-red-100 text-red-700 font-extrabold text-xs flex items-center justify-center shrink-0">
              {taskNumber}
            </div>
          )}

          <div className="w-9 h-9 rounded-full bg-red-600 text-white flex items-center justify-center shrink-0 shadow-xs shadow-red-600/30">
            <Youtube className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <h4 className="text-sm font-bold text-slate-900 truncate tracking-tight">
              {taskTitle}
            </h4>
            <p className="text-[11px] sm:text-xs text-slate-500 truncate mt-0.5">
              {isCompleted
                ? 'Video watched completely'
                : 'Watch the complete video to unlock your claim.'}
            </p>
          </div>
        </div>

        {/* Completion Pill */}
        <div className="shrink-0">
          {isCompleted ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Completed</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold">
              {playerState === 1 ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Watching...</span>
                </>
              ) : playerState === 2 ? (
                <span>Paused</span>
              ) : (
                <span>Tap Play to Start</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Official YouTube IFrame Player Container (Responsive 16:9 Aspect Ratio) */}
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-slate-200 shadow-inner">
        {!isPlayerReady && !playerError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-white gap-2 z-10 pointer-events-none">
            <Loader2 className="w-6 h-6 animate-spin text-red-500" />
            <span className="text-xs font-medium text-slate-300">Loading YouTube Player...</span>
          </div>
        )}

        {playerError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-white p-4 text-center gap-2 z-10">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
            <span className="text-xs font-medium text-slate-200">{playerError}</span>
          </div>
        ) : (
          <div ref={containerRef} className="w-full h-full" />
        )}
      </div>

      {/* Anti-Skip Warning Banner */}
      {antiSkipWarning && (
        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-medium flex items-center gap-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="flex-1">{antiSkipWarning}</span>
        </div>
      )}

      {/* Tab Switch Paused Notice */}
      {isTabPaused && !isCompleted && (
        <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-xs font-medium flex items-center gap-2 animate-in fade-in">
          <Pause className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="flex-1">Video paused — return to this page to continue watching.</span>
        </div>
      )}

      {/* Playback Progress Indicator */}
      {isPlayerReady && !isCompleted && duration > 0 && (
        <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium px-1">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                playerState === 1
                  ? 'bg-emerald-500 animate-pulse'
                  : playerState === 2
                  ? 'bg-amber-400'
                  : 'bg-slate-300'
              }`}
            />
            <span>
              {playerState === 1
                ? 'Watching'
                : playerState === 2
                ? 'Paused — Tap Play to Resume'
                : playerState === 3
                ? 'Buffering...'
                : 'Ready — Tap Play to Start'}
            </span>
          </span>
          <span className="font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      )}

      {/* Completed State Banner */}
      {isCompleted && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>✅ Video Completed! Requirement fulfilled.</span>
        </div>
      )}
    </div>
  );
};
