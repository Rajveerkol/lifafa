import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Youtube,
  Play,
  Pause,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Loader2,
  Volume2,
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
  const playerId = useRef(`yt_player_${videoId}_${Math.random().toString(36).substring(2, 7)}`);

  // Playback & Watch Session State
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [playerState, setPlayerState] = useState<number>(-1); // -1 = unstarted, 1 = playing, 2 = paused, 0 = ended
  const [hasStartedWatching, setHasStartedWatching] = useState(false);
  const [antiSkipWarning, setAntiSkipWarning] = useState<string | null>(null);
  const [isTabPaused, setIsTabPaused] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Anti-skip tracking refs (imperative to avoid stale closures in player callbacks)
  const maxWatchedTimeRef = useRef<number>(0);
  const lastPolledTimeRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const pollTimerRef = useRef<any>(null);
  const isCompletedRef = useRef<boolean>(isCompleted);

  useEffect(() => {
    isCompletedRef.current = isCompleted;
  }, [isCompleted]);

  // 1. Natural Completion Handler
  const handleNaturalEnd = useCallback(() => {
    if (isCompletedRef.current) return;

    const currentDuration = playerRef.current?.getDuration?.() || duration || 0;
    const maxWatched = maxWatchedTimeRef.current;

    // Strict Anti-Skip Check: Ensure user legitimately watched to the end (within 3s leeway for trailing outro)
    if (currentDuration > 0 && maxWatched >= Math.max(0, currentDuration - 3)) {
      setAntiSkipWarning(null);
      setIsTabPaused(false);
      onCompleted();
    } else {
      // Seeked to end prematurely without actually watching
      setAntiSkipWarning('Please watch the video completely without skipping.');
      if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
        playerRef.current.seekTo(maxWatchedTimeRef.current, true);
      }
    }
  }, [duration, onCompleted]);

  // 2. Continuous Anti-Skip Playback Monitor (polls every 400ms while PLAYING)
  const startProgressPolling = useCallback(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(() => {
      if (!playerRef.current || !isPlayingRef.current || isCompletedRef.current) return;

      try {
        const current = playerRef.current.getCurrentTime() || 0;
        const dur = playerRef.current.getDuration() || 0;

        setCurrentTime(current);
        if (dur > 0 && duration === 0) setDuration(dur);

        // FORWARD SEEK DETECTION:
        // If current playback time jumped ahead by > 2.5 seconds beyond the maximum legitimately watched second:
        if (current > maxWatchedTimeRef.current + 2.5) {
          // Detect seek ahead!
          playerRef.current.pauseVideo();
          playerRef.current.seekTo(maxWatchedTimeRef.current, true);
          setAntiSkipWarning('Please watch the video completely without skipping.');
          return;
        }

        // Legitimate advancement: update watermark
        if (current > maxWatchedTimeRef.current) {
          maxWatchedTimeRef.current = current;
          if (antiSkipWarning) {
            setAntiSkipWarning(null);
          }
        }

        lastPolledTimeRef.current = current;
      } catch {
        // Player might be destroying
      }
    }, 400);
  }, [antiSkipWarning, duration]);

  const stopProgressPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // 3. Initialize Official YouTube IFrame Player API
  useEffect(() => {
    let isMounted = true;

    loadYouTubeIframeApi()
      .then((YT) => {
        if (!isMounted || !containerRef.current) return;

        playerRef.current = new YT.Player(playerId.current, {
          videoId,
          playerVars: {
            autoplay: 0,
            controls: 1,
            disablekb: 0,
            enablejsapi: 1,
            fs: 1,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            origin: typeof window !== 'undefined' ? window.location.origin : 'https://createlifafa.xyz',
          },
          events: {
            onReady: (event: any) => {
              if (!isMounted) return;
              setIsPlayerReady(true);
              const dur = event.target.getDuration();
              if (dur) setDuration(dur);
            },
            onStateChange: (event: any) => {
              if (!isMounted) return;
              const state = event.data;
              setPlayerState(state);

              // YT.PlayerState:
              // -1 = UNSTARTED, 0 = ENDED, 1 = PLAYING, 2 = PAUSED, 3 = BUFFERING
              if (state === 1) {
                // PLAYING
                isPlayingRef.current = true;
                setHasStartedWatching(true);
                setIsTabPaused(false);
                startProgressPolling();
              } else {
                isPlayingRef.current = false;
                stopProgressPolling();

                if (state === 0) {
                  // ENDED
                  handleNaturalEnd();
                }
              }
            },
            onError: (errEvent: any) => {
              if (!isMounted) return;
              console.error('YouTube Player Error:', errEvent.data);
              setPlayerError('Unable to load this YouTube video. It may be restricted, private, or unavailable.');
            },
          },
        });
      })
      .catch((err) => {
        if (!isMounted) return;
        setPlayerError(err.message || 'Unable to load YouTube player API');
      });

    return () => {
      isMounted = false;
      stopProgressPolling();
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch {}
      }
    };
  }, [videoId, startProgressPolling, stopProgressPolling, handleNaturalEnd]);

  // 4. Tab Visibility Protection
  // If user switches away or tab hides, pause video and show warning
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (isPlayingRef.current && playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
          playerRef.current.pauseVideo();
          setIsTabPaused(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // 5. Refresh / Reload Protection
  // Warn user before leaving if watch progress is active and incomplete
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasStartedWatching && !isCompletedRef.current) {
        e.preventDefault();
        const msg = 'Refreshing or leaving this page will reset your video watch progress. You will need to watch the video again from the beginning.';
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
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span>Watching...</span>
                </>
              ) : (
                <span>Required</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Official YouTube IFrame Player Container (Responsive 16:9 Aspect Ratio) */}
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-slate-200 shadow-inner">
        {!isPlayerReady && !playerError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-white gap-2 z-10">
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
          <div ref={containerRef} className="w-full h-full">
            <div id={playerId.current} className="w-full h-full" />
          </div>
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
            <span className={`w-2 h-2 rounded-full ${playerState === 1 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
            <span>{playerState === 1 ? 'Watching' : playerState === 2 ? 'Paused' : 'Ready'}</span>
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
