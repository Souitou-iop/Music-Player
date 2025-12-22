
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, Volume1, VolumeX, ListMusic, MessageSquare, Moon, Sun, Monitor, Laptop, Shuffle, ArrowRight } from 'lucide-react';
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
  isShuffle: boolean;
  onToggleShuffle: () => void;
  isReverse: boolean;
  onToggleReverse: () => void;
  onArtistClick: (artistId: number) => void;
}

export const MusicPlayer = React.memo<MusicPlayerProps>(({
  currentTrack, isPlaying, onPlayPause, onNext, onPrev, 
  currentTime, duration, onSeek, volume, onVolumeChange, onToggleQueue, onToggleComments,
  themeMode, onToggleTheme, isDarkMode,
  isShuffle, onToggleShuffle, isReverse, onToggleReverse,
  onArtistClick
}) => {
  
  const [animatingTheme, setAnimatingTheme] = useState(false);
  const [animatingReverse, setAnimatingReverse] = useState(false);
  const [animatingComments, setAnimatingComments] = useState(false);
  
  // Progress Bar Dragging State
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Volume Dragging State
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const volumeBarRef = useRef<HTMLDivElement>(null);

  // Volume Memory for Mute Toggle
  const lastVolumeRef = useRef(volume > 0 ? volume : 0.5);

  // Update last volume when user changes it (so we know what to restore to)
  useEffect(() => {
    if (volume > 0) {
      lastVolumeRef.current = volume;
    }
  }, [volume]);

  // Trigger animation state on theme change
  useEffect(() => {
    setAnimatingTheme(true);
    const timer = setTimeout(() => setAnimatingTheme(false), 500); // Sync with CSS transition
    return () => clearTimeout(timer);
  }, [themeMode]);

  // Trigger animation on reverse toggle
  useEffect(() => {
    setAnimatingReverse(true);
    const timer = setTimeout(() => setAnimatingReverse(false), 400);
    return () => clearTimeout(timer);
  }, [isReverse]);

  const handleCommentsClick = () => {
    setAnimatingComments(true);
    onToggleComments();
    const timer = setTimeout(() => setAnimatingComments(false), 300);
    return () => clearTimeout(timer);
  };

  const toggleMute = () => {
    if (volume > 0) {
      onVolumeChange(0);
    } else {
      onVolumeChange(lastVolumeRef.current);
    }
  };

  // --- Progress Bar Dragging Logic ---
  const calculateTimeFromEvent = (clientX: number) => {
    if (!progressBarRef.current || !duration) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * duration;
  };

  const handleProgressPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDraggingProgress(true);
    const newTime = calculateTimeFromEvent(e.clientX);
    setDragTime(newTime);
  };

  useEffect(() => {
    if (!isDraggingProgress) return;

    const handlePointerMove = (e: PointerEvent) => {
      const newTime = calculateTimeFromEvent(e.clientX);
      setDragTime(newTime);
    };

    const handlePointerUp = (e: PointerEvent) => {
      const newTime = calculateTimeFromEvent(e.clientX);
      onSeek(newTime);
      setIsDraggingProgress(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDraggingProgress, duration, onSeek]);

  // --- Volume Bar Dragging Logic ---
  const calculateVolumeFromEvent = (clientX: number) => {
    if (!volumeBarRef.current) return 0;
    const rect = volumeBarRef.current.getBoundingClientRect();
    // Calculate percentage (0 to 1), clamped
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio;
  };

  const handleVolumePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDraggingVolume(true);
    const newVol = calculateVolumeFromEvent(e.clientX);
    onVolumeChange(newVol);
  };

  useEffect(() => {
    if (!isDraggingVolume) return;

    const handlePointerMove = (e: PointerEvent) => {
      const newVol = calculateVolumeFromEvent(e.clientX);
      onVolumeChange(newVol);
    };

    const handlePointerUp = () => {
      setIsDraggingVolume(false);
    };

    // Attach to window to allow dragging outside the element
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDraggingVolume, onVolumeChange]);


  // Determine what to display: current playback time OR dragging time
  const effectiveTime = isDraggingProgress ? dragTime : currentTime;
  const progressPercent = duration ? (effectiveTime / duration) * 100 : 0;

  const formatTime = (ms: number) => {
    if (!ms && ms !== 0) return "0:00";
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };
  
  // Theme Colors
  const transitionClass = "transition-[color,background-color,border-color,opacity,shadow,transform,filter,height,width] duration-500 ease-[cubic-bezier(0.2,0,0,1)]";
  const textColor = isDarkMode ? 'text-white' : 'text-slate-900';
  const textDimColor = isDarkMode ? 'text-white/50' : 'text-slate-500';
  const iconHoverClass = isDarkMode ? 'hover:bg-white/10 hover:text-white' : 'hover:bg-black/5 hover:text-black';
  const glassBg = isDarkMode ? 'bg-neutral-900/60 border-white/5' : 'bg-white/70 border-black/5';

  // Control Buttons Logic
  const controlBtnClass = `p-2 rounded-lg relative ${transitionClass} ${iconHoverClass} active:scale-95`;
  const shuffleActiveClass = isShuffle 
      ? (isDarkMode ? 'bg-white/10 text-white shadow-[0_0_10px_rgba(255,255,255,0.1)]' : 'bg-black/10 text-black shadow-[0_0_10px_rgba(0,0,0,0.1)]') 
      : textDimColor;

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
                        <div className={`text-xs truncate ${transitionClass} ${textDimColor}`}>
                            {currentTrack.ar.map((a, idx) => (
                                <span key={a.id}>
                                    {idx > 0 && ", "}
                                    <span 
                                        className="cursor-pointer hover:underline hover:text-opacity-80 transition-opacity"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onArtistClick(a.id);
                                        }}
                                    >
                                        {a.name}
                                    </span>
                                </span>
                            ))}
                        </div>
                    </div>
                </>
                )}
            </div>

            {/* 2. Controls & Progress (Center) */}
            <div className="flex-1 flex flex-col items-center justify-center max-w-[600px]">
                {/* Buttons */}
                <div className="flex items-center gap-8 mb-3">
                    {/* Shuffle Button */}
                    <button 
                        onClick={onToggleShuffle} 
                        className={`${controlBtnClass} ${shuffleActiveClass}`}
                        title={isShuffle ? "关闭随机" : "开启随机"}
                    >
                        <Shuffle className="w-4 h-4" />
                        {isShuffle && <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-current opacity-60"></div>}
                    </button>

                    {/* Prev Button */}
                    <button 
                        onClick={onPrev} 
                        className={`group p-2.5 rounded-full transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-110 active:scale-90 ${isDarkMode ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-black/60 hover:text-black hover:bg-black/5'}`}
                    >
                        <SkipBack className="w-7 h-7 fill-current" />
                    </button>

                    {/* Play/Pause Button */}
                    <button 
                        onClick={onPlayPause}
                        className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-110 active:scale-90 shadow-xl hover:shadow-2xl ${
                            isDarkMode 
                                ? 'bg-white text-black shadow-white/20' 
                                : 'bg-black text-white shadow-black/30'
                        }`}
                    >
                         <div className="relative w-8 h-8 flex items-center justify-center">
                             <Pause className={`absolute w-full h-full fill-current transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isPlaying ? 'scale-100 rotate-0 opacity-100' : 'scale-50 -rotate-90 opacity-0'}`} />
                             <Play className={`absolute w-full h-full fill-current ml-1 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${!isPlaying ? 'scale-100 rotate-0 opacity-100' : 'scale-50 rotate-90 opacity-0'}`} />
                         </div>
                    </button>

                    {/* Next Button */}
                    <button 
                        onClick={onNext} 
                        className={`group p-2.5 rounded-full transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-110 active:scale-90 ${isDarkMode ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-black/60 hover:text-black hover:bg-black/5'}`}
                    >
                        <SkipForward className="w-7 h-7 fill-current" />
                    </button>

                    {/* Order/Reverse Toggle Button */}
                    <button 
                        onClick={onToggleReverse} 
                        className={`${controlBtnClass} ${textDimColor}`}
                        title={isReverse ? "倒序播放" : "顺序播放"}
                    >
                        <div className={`transition-transform duration-500 ease-spring ${isReverse ? 'rotate-180' : 'rotate-0'}`}>
                            <ArrowRight className="w-5 h-5" />
                        </div>
                    </button>
                </div>
                
                {/* Scrubber */}
                <div className={`w-full flex items-center gap-3 text-[10px] font-medium tracking-wide ${transitionClass} ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
                    <span className="w-8 text-right tabular-nums">{formatTime(effectiveTime)}</span>
                    <div 
                        ref={progressBarRef}
                        className="flex-1 h-3 flex items-center relative group cursor-pointer touch-none" // Increased hit area
                        onPointerDown={handleProgressPointerDown}
                    >
                        {/* Track Background */}
                        <div className={`absolute inset-x-0 h-1 rounded-full ${transitionClass} ${isDarkMode ? 'bg-white/20' : 'bg-black/10'} group-hover:h-1.5`} />
                        
                        {/* Filled Track */}
                        <div 
                            className={`h-1 rounded-full relative ${transitionClass} ${isDarkMode ? 'bg-white' : 'bg-black'} group-hover:h-1.5`} 
                            style={{ width: `${progressPercent}%` }}
                        >
                            {/* Knob (only shows on drag/hover) */}
                            <div 
                                className={`absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full shadow-md transition-transform duration-200 ${isDarkMode ? 'bg-white' : 'bg-black'} 
                                ${isDraggingProgress ? 'scale-100' : 'scale-0 group-hover:scale-100'}`} 
                            />
                        </div>
                    </div>
                    <span className="w-8 tabular-nums">{formatTime(duration)}</span>
                </div>
            </div>

            {/* 3. Volume & Tools (Right) */}
            <div className="w-[25%] flex items-center justify-end gap-5">
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
                    onClick={handleCommentsClick} 
                    className={`p-2 rounded-lg relative overflow-hidden ${transitionClass} ${textDimColor} ${iconHoverClass} ${animatingComments ? 'scale-90' : 'scale-100'}`}
                    title="Comments"
                >
                    <div className={`transition-transform duration-300 ease-spring ${animatingComments ? 'scale-90 rotate-6' : 'scale-100 rotate-0'}`}>
                        <MessageSquare className="w-5 h-5" />
                    </div>
                </button>

                {/* Refined Volume Control */}
                <div className="flex items-center gap-2 w-28 group/vol relative">
                    <button 
                        onClick={toggleMute}
                        className={`p-1.5 rounded-md relative flex items-center justify-center ${transitionClass} ${textDimColor} ${iconHoverClass} active:scale-90 shrink-0`}
                        title={volume === 0 ? "取消静音" : "静音"}
                    >
                        <div className="relative w-5 h-5">
                             {volume === 0 ? <VolumeX className="w-5 h-5 opacity-50" /> : (volume < 0.5 ? <Volume1 className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />)}
                        </div>
                    </button>
                    
                    {/* Custom Volume Bar */}
                    <div 
                        ref={volumeBarRef}
                        onPointerDown={handleVolumePointerDown}
                        className="flex-1 h-8 flex items-center cursor-pointer relative touch-none select-none" // Large Hit Area (h-8)
                    >
                         {/* Rail (Background) */}
                         <div className={`absolute inset-x-0 rounded-full transition-all duration-300 ease-out ${isDarkMode ? 'bg-white/20' : 'bg-black/10'} 
                             ${isDraggingVolume || 'group-hover/vol:h-1.5'} h-1`} 
                         />
                         
                         {/* Fill (Active) */}
                         <div 
                            className={`absolute left-0 rounded-full transition-all duration-300 ease-out ${isDarkMode ? 'bg-white' : 'bg-black'}
                             ${isDraggingVolume || 'group-hover/vol:h-1.5'} h-1`}
                            style={{ width: `${volume * 100}%` }}
                         />
                         
                         {/* Knob (Hidden by default, shows on hover/drag - subtle) */}
                         <div 
                             className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md pointer-events-none transition-all duration-200 
                             ${isDraggingVolume ? 'opacity-100 scale-100' : 'opacity-0 scale-50 group-hover/vol:opacity-100 group-hover/vol:scale-100'}`}
                             style={{ left: `calc(${volume * 100}% - 6px)` }}
                         />
                    </div>
                </div>
            </div>

        </div>
    </div>
  );
});
