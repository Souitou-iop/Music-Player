
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, ListMusic, MessageSquare, Moon, Sun, Monitor, Laptop } from 'lucide-react';
import { Track } from '../types';
import { ThemeMode } from '../App';

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
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  isDarkMode: boolean;
}

export const MusicPlayer: React.FC<MusicPlayerProps> = ({
  currentTrack, isPlaying, onPlayPause, onNext, onPrev, 
  currentTime, duration, onSeek, volume, onVolumeChange, onToggleQueue, onToggleComments,
  themeMode, onToggleTheme, isDarkMode
}) => {
  
  const [animatingTheme, setAnimatingTheme] = useState(false);
  
  // Dragging State
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Trigger animation state on theme change
  useEffect(() => {
    setAnimatingTheme(true);
    const timer = setTimeout(() => setAnimatingTheme(false), 500); // Sync with CSS transition
    return () => clearTimeout(timer);
  }, [themeMode]);

  // --- Dragging Logic ---
  const calculateTimeFromEvent = (clientX: number) => {
    if (!progressBarRef.current || !duration) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    // Calculate percentage (0 to 1), clamped
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * duration;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // Prevent default browser dragging of the element
    e.preventDefault();
    setIsDragging(true);
    
    // Immediately update visual position to where user clicked
    const newTime = calculateTimeFromEvent(e.clientX);
    setDragTime(newTime);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const newTime = calculateTimeFromEvent(e.clientX);
      setDragTime(newTime);
    };

    const handlePointerUp = (e: PointerEvent) => {
      const newTime = calculateTimeFromEvent(e.clientX);
      // Commit the seek operation only when release
      onSeek(newTime);
      setIsDragging(false);
    };

    // Attach to window to handle drags that go outside the element
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, duration, onSeek]);

  // Determine what to display: current playback time OR dragging time
  const effectiveTime = isDragging ? dragTime : currentTime;
  const progressPercent = duration ? (effectiveTime / duration) * 100 : 0;

  const formatTime = (ms: number) => {
    if (!ms && ms !== 0) return "0:00";
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };
  
  // Theme Colors
  const transitionClass = "transition-[color,background-color,border-color,opacity,shadow,transform,filter] duration-500 ease-[cubic-bezier(0.2,0,0,1)]";
  const textColor = isDarkMode ? 'text-white' : 'text-slate-900';
  const textDimColor = isDarkMode ? 'text-white/50' : 'text-slate-500';
  const iconHoverClass = isDarkMode ? 'hover:bg-white/10 hover:text-white' : 'hover:bg-black/5 hover:text-black';
  const glassBg = isDarkMode ? 'bg-neutral-900/60 border-white/5' : 'bg-white/70 border-black/5';
  const playButtonClass = isDarkMode ? 'bg-white text-black shadow-white/10' : 'bg-black text-white shadow-black/20';

  return (
    <div className="w-full h-[96px] relative z-50">
        <div className={`absolute inset-0 backdrop-blur-2xl border-t ${transitionClass} ${glassBg}`} />
        
        <div className="relative h-full max-w-screen-2xl mx-auto px-6 flex items-center justify-between gap-8">
            
            {/* 1. Track Info (Left) */}
            <div className="flex items-center gap-4 w-[25%] min-w-[200px]">
                {currentTrack && (
                <>
                    <div className="relative group cursor-pointer" onClick={onToggleQueue}>
                        <img 
                            src={currentTrack.al.picUrl} 
                            alt="art" 
                            className={`w-12 h-12 rounded-md shadow-md object-cover ${transitionClass} ${isDarkMode ? 'border border-white/5' : 'border border-black/5'}`}
                        />
                        <div className="absolute inset-0 bg-black/20 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ListMusic className="w-5 h-5 text-white" />
                        </div>
                    </div>
                    <div className="flex flex-col min-w-0">
                        <h4 className={`font-medium truncate text-sm ${transitionClass} ${textColor}`}>{currentTrack.name}</h4>
                        <p className={`text-xs truncate ${transitionClass} ${textDimColor}`}>
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
                    <button onClick={onPrev} className={`${transitionClass} active:scale-95 ${textDimColor} ${isDarkMode ? 'hover:text-white' : 'hover:text-black'}`}>
                        <SkipBack className="w-7 h-7 fill-current" />
                    </button>
                    <button 
                        onClick={onPlayPause}
                        className={`w-10 h-10 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 shadow-lg ${transitionClass} ${playButtonClass}`}
                    >
                        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
                    </button>
                    <button onClick={onNext} className={`${transitionClass} active:scale-95 ${textDimColor} ${isDarkMode ? 'hover:text-white' : 'hover:text-black'}`}>
                        <SkipForward className="w-7 h-7 fill-current" />
                    </button>
                </div>
                
                {/* Scrubber */}
                <div className={`w-full flex items-center gap-3 text-[10px] font-medium tracking-wide ${transitionClass} ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
                    <span className="w-8 text-right tabular-nums">{formatTime(effectiveTime)}</span>
                    <div 
                        ref={progressBarRef}
                        className="flex-1 h-1 rounded-full relative group cursor-pointer bg-current opacity-20 touch-none" // Added touch-none for mobile scrubbing
                        onPointerDown={handlePointerDown}
                    >
                        {/* Hover Hit Area - Increased for better usability */}
                        <div className="absolute -top-3 -bottom-3 inset-x-0 bg-transparent z-10" />
                        
                        {/* Fill */}
                        <div 
                            className={`h-full rounded-full relative ${transitionClass} ${isDarkMode ? 'bg-white/40 group-hover:bg-white' : 'bg-black/40 group-hover:bg-black'} ${isDragging ? (isDarkMode ? '!bg-white' : '!bg-black') + ' !opacity-100' : ''}`} 
                            style={{ width: `${progressPercent}%` }}
                        >
                             {/* Thumb */}
                            <div 
                                className={`absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full shadow-sm transition-all duration-200 ${isDarkMode ? 'bg-white' : 'bg-black'} 
                                ${isDragging ? 'opacity-100 scale-125' : 'opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100'}`} 
                            />
                        </div>
                    </div>
                    <span className="w-8 tabular-nums">{formatTime(duration)}</span>
                </div>
            </div>

            {/* 3. Volume & Tools (Right) */}
            <div className="w-[25%] flex items-center justify-end gap-5">
                {/* Theme Toggle Button (Refined Animation) */}
                <button 
                    onClick={onToggleTheme}
                    className={`p-2 rounded-lg relative overflow-hidden group ${transitionClass} ${textDimColor} ${iconHoverClass} ${animatingTheme ? 'scale-90' : 'scale-100'}`}
                    title={`Theme: ${themeMode}`}
                >
                   <div className={`relative w-5 h-5 transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${animatingTheme ? '-rotate-90 opacity-50' : 'rotate-0 opacity-100'}`}>
                       {themeMode === 'dark' && <Moon className="w-full h-full" />}
                       {themeMode === 'light' && <Sun className="w-full h-full" />}
                       {themeMode === 'system' && <Laptop className="w-full h-full" />}
                   </div>
                </button>

                <button 
                    onClick={onToggleComments} 
                    className={`p-2 rounded-lg ${transitionClass} ${textDimColor} ${iconHoverClass}`}
                    title="Comments"
                >
                    <MessageSquare className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 group w-24">
                    <Volume2 className={`w-5 h-5 ${transitionClass} ${textDimColor}`} />
                    <div className={`flex-1 h-1 rounded-full relative cursor-pointer ${isDarkMode ? 'bg-neutral-700' : 'bg-black/10'}`}>
                        <input 
                            type="range" min="0" max="1" step="0.01" value={volume}
                            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className={`h-full rounded-full ${transitionClass} ${isDarkMode ? 'bg-white' : 'bg-black'}`} style={{ width: `${volume * 100}%` }}></div>
                    </div>
                </div>
            </div>

        </div>
    </div>
  );
};
