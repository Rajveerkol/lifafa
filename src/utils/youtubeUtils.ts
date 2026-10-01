// YouTube URL extraction, validation, and official IFrame Player API utilities

/**
 * Extracts the 11-character YouTube video ID from supported URL formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://youtube.com/watch?v=VIDEO_ID
 * - https://m.youtube.com/watch?v=VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 * 
 * Rejects non-YouTube URLs, invalid URLs, and malformed IDs.
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Direct 11-char ID check (alphanumeric, underscores, hyphens)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    } catch {
      return null;
    }

    const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');

    // Strictly validate domain
    if (hostname !== 'youtube.com' && hostname !== 'youtu.be') {
      return null;
    }

    // Format: https://youtu.be/VIDEO_ID
    if (hostname === 'youtu.be') {
      const id = parsedUrl.pathname.slice(1).split('/')[0];
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    // Format: https://youtube.com/watch?v=VIDEO_ID
    if (parsedUrl.pathname === '/watch') {
      const v = parsedUrl.searchParams.get('v');
      return v && /^[a-zA-Z0-9_-]{11}$/.test(v) ? v : null;
    }

    // Formats: /embed/VIDEO_ID, /shorts/VIDEO_ID, /v/VIDEO_ID
    const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
    if (pathParts.length >= 2 && ['embed', 'shorts', 'v'].includes(pathParts[0].toLowerCase())) {
      const id = pathParts[1];
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Validates whether a given URL is a legitimate, supported YouTube video URL.
 */
export function isValidYouTubeUrl(url: string): boolean {
  return extractYouTubeVideoId(url) !== null;
}

/**
 * Returns canonical embed URL for iframe preview.
 */
export function getYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${typeof window !== 'undefined' ? window.location.origin : 'https://createlifafa.xyz'}`;
}

/**
 * Official YouTube IFrame Player API loader promise singleton.
 */
let ytApiPromise: Promise<any> | null = null;

export function loadYouTubeIframeApi(): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window object not available'));
  }

  const win = window as any;
  if (win.YT && win.YT.Player) {
    return Promise.resolve(win.YT);
  }

  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve, reject) => {
    // Check if script element already exists
    const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      tag.onerror = () => {
        ytApiPromise = null;
        reject(new Error('Unable to load YouTube IFrame API. Check network connection.'));
      };
      document.body.appendChild(tag);
    }

    const previousOnReady = win.onYouTubeIframeAPIReady;
    win.onYouTubeIframeAPIReady = () => {
      if (typeof previousOnReady === 'function') previousOnReady();
      resolve(win.YT);
    };

    // Polling fallback in case onYouTubeIframeAPIReady already fired
    let checks = 0;
    const interval = setInterval(() => {
      checks++;
      if (win.YT && win.YT.Player) {
        clearInterval(interval);
        resolve(win.YT);
      } else if (checks > 120) {
        clearInterval(interval);
        reject(new Error('YouTube API initialization timed out'));
      }
    }, 100);
  });

  return ytApiPromise;
}
