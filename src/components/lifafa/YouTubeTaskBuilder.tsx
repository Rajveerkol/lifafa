import React, { useState } from 'react';
import { Youtube, X, CheckCircle2, AlertCircle, Play } from 'lucide-react';
import { extractYouTubeVideoId, isValidYouTubeUrl } from '../../utils/youtubeUtils';

interface YouTubeTaskBuilderProps {
  onAdd: (taskData: {
    videoUrl: string;
    videoId: string;
    title: string;
  }) => void;
  onCancel: () => void;
}

export const YouTubeTaskBuilder: React.FC<YouTubeTaskBuilderProps> = ({ onAdd, onCancel }) => {
  const [videoUrl, setVideoUrl] = useState('');
  const [title, setTitle] = useState('Watch YouTube Video');
  const [touched, setTouched] = useState(false);

  const videoId = extractYouTubeVideoId(videoUrl);
  const isValid = Boolean(videoId);
  const showError = touched && videoUrl.trim().length > 0 && !isValid;

  const handleAddRequirement = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setTouched(true);

    if (!isValid || !videoId) return;

    onAdd({
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      videoId,
      title: title.trim() || 'Watch YouTube Video',
    });
  };

  return (
    <div className="p-4 sm:p-5 bg-gradient-to-b from-red-50/70 to-slate-50 border-2 border-red-200/80 rounded-2xl shadow-xs space-y-4 animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-red-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-xs shadow-red-600/30">
            <Youtube className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
              <span>🎥 Watch YouTube Video</span>
            </h4>
            <p className="text-[11px] text-slate-500 font-medium">
              Participants must watch the full video before claiming
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }}
          className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-white/80 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3.5">
        {/* URL Input */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            YouTube Video URL <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={videoUrl}
              onChange={(e) => {
                setVideoUrl(e.target.value);
                setTouched(true);
              }}
              onBlur={() => setTouched(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isValid && videoId) {
                    handleAddRequirement(e);
                  }
                }
              }}
              placeholder="https://youtube.com/watch?v=... or https://youtu.be/..."
              className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 transition-all ${
                showError
                  ? 'border-red-400 focus:ring-red-200'
                  : isValid
                  ? 'border-emerald-300 focus:ring-emerald-100'
                  : 'border-slate-200 focus:ring-red-100 focus:border-red-400'
              }`}
            />
            {isValid && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </span>
            )}
          </div>

          {showError && (
            <p className="text-[11px] text-red-600 font-semibold mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              <span>Please enter a valid YouTube video URL (e.g. https://www.youtube.com/watch?v=...).</span>
            </p>
          )}
        </div>

        {/* Title Input */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Requirement Title <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                if (isValid && videoId) {
                  handleAddRequirement(e);
                }
              }
            }}
            placeholder="Watch YouTube Video"
            className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-200"
          />
        </div>

        {/* Video Preview */}
        {isValid && videoId && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
              <span className="flex items-center gap-1">
                <Play className="w-3 h-3 text-red-600 fill-red-600" />
                Video Preview
              </span>
              <span className="font-mono text-[10px] text-slate-400">ID: {videoId}</span>
            </div>

            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-slate-200 shadow-xs">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0`}
                title="YouTube Video Preview"
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        )}

        <div className="p-2.5 bg-red-50/50 rounded-xl border border-red-100 text-[11px] text-slate-600 font-medium flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
          <span>User must watch the complete video before claiming.</span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCancel();
            }}
            className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!isValid}
            onClick={handleAddRequirement}
            className={`px-4 py-2 text-xs font-black rounded-xl text-white shadow-xs transition-all flex items-center gap-1.5 ${
              isValid
                ? 'bg-red-600 hover:bg-red-700 cursor-pointer shadow-red-600/20 hover:shadow-red-600/30'
                : 'bg-slate-300 cursor-not-allowed opacity-70'
            }`}
          >
            <Youtube className="w-3.5 h-3.5" />
            <span>Add Requirement</span>
          </button>
        </div>
      </div>
    </div>
  );
};
