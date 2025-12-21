
import React from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, ListMusic, MessageSquare } from 'lucide-react';
import { Track } from '../types';

interface MusicPlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  volume: number;
  onVolumeChange: (vol: number) => void;
  onToggleQueue: () => void;
  onToggleComments: () => void;
}

export const MusicPlayer: React.FC<MusicPlayerProps> = ({
  currentTrack, isPlaying, onPlayPause, onNext, onPrev, 
  currentTime, duration, onSeek, volume, onVolumeChange, onToggleQueue, onToggleComments
}) => {
  
  const formatTime = (ms: number) => {
    if (!ms) return "0:00";
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="w-full h-[96px] relative z-50">
        <div className="absolute inset-0 bg-neutral-900/60 backdrop-blur-2xl border-t border-white/5" />
        
        <div className="relative h-full max-w-screen-2xl mx-auto px-6 flex items-center justify-between gap-8">
            
            {/* 1. Track Info (Left) */}
            <div className="flex items-center gap-4 w-[25%] min-w-[200px]">
                {currentTrack && (
                <>
                    <div className="relative group cursor-pointer" onClick={onToggleQueue}>
                        <img 
                            src={currentTrack.al.picUrl} 
                            alt="art" 
                            className="w-12 h-12 rounded-md shadow-md object-cover border border-white/5" 
                        />
                        <div className="absolute inset-0 bg-black/20 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ListMusic className="w-5 h-5 text-white" />
                        </div>
                    </div>
                    <div className="flex flex-col min-w-0">
                        <h4 className="text-white font-medium truncate text-sm">{currentTrack.name}</h4>
                        <p className="text-white/50 text-xs truncate">
                            {currentTrack.ar.map(a => a.name).join(', ')}
                        </p>
                    </div>
                </>
                )}
            </div>

            {/* 2. Controls & Progress (Center) */}
            <div className="flex-1 flex flex-col items-center justify-center max-w-[600px]">
                {/* Buttons */}
                <div className="flex items-center gap-8 mb-2">
                    <button onClick={onPrev} className="text-white/60 hover:text-white transition-colors active:scale-95">
                        <SkipBack className="w-7 h-7 fill-current" />
                    </button>
                    <button 
                        onClick={onPlayPause}
                        className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-white/10"
                    >
                        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
                    </button>
                    <button onClick={onNext} className="text-white/60 hover:text-white transition-colors active:scale-95">
                        <SkipForward className="w-7 h-7 fill-current" />
                    </button>
                </div>
                
                {/* Scrubber */}
                <div className="w-full flex items-center gap-3 text-[10px] font-medium text-white/40 tracking-wide">
                    <span className="w-8 text-right tabular-nums">{formatTime(currentTime)}</span>
                    <div 
                        className="flex-1 h-1 bg-white/10 rounded-full relative group cursor-pointer"
                        onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const p = (e.clientX - rect.left) / rect.width;
                            onSeek(p * duration);
                        }}
                    >
                        {/* Hover Hit Area */}
                        <div className="absolute -top-2 -bottom-2 inset-x-0 bg-transparent" />
                        
                        {/* Fill */}
                        <div className="h-full bg-white/40 group-hover:bg-white rounded-full relative transition-colors" style={{ width: `${progressPercent}%` }}>
                             {/* Thumb (Only visible on group hover) */}
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-sm opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100 transition-all duration-200" />
                        </div>
                    </div>
                    <span className="w-8 tabular-nums">{formatTime(duration)}</span>
                </div>
            </div>

            {/* 3. Volume & Tools (Right) */}
            <div className="w-[25%] flex items-center justify-end gap-6">
                <button 
                    onClick={onToggleComments} 
                    className="text-white/50 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
                    title="Comments"
                >
                    <MessageSquare className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 group w-32">
                    <Volume2 className="w-5 h-5 text-white/50" />
                    <div className="flex-1 h-1 bg-white/10 rounded-full relative cursor-pointer">
                        <input 
                            type="range" min="0" max="1" step="0.01" value={volume}
                            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="h-full bg-white/50 group-hover:bg-white rounded-full transition-colors" style={{ width: `${volume * 100}%` }}></div>
                    </div>
                </div>
            </div>

        </div>
    </div>
  );
};
