
import React, { useState, useEffect, useRef } from 'react';
import { fetchPlaylist, getAudioUrl, fetchLyrics, fetchComments } from './services/musicApi';
import { Track, LyricLine, Comment } from './types';
import { MusicPlayer } from './components/MusicPlayer';
import { MessageSquare, ListMusic, Loader2, Heart, X, Search, Disc } from 'lucide-react';

const DEFAULT_PLAYLIST_ID = '833444858'; 

const App: React.FC = () => {
  // Data State
  const [playlistId, setPlaylistId] = useState(DEFAULT_PLAYLIST_ID);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); // This will now be updated smoothly via RAF
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.5);
  
  // View State
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [dominantColor, setDominantColor] = useState('20, 20, 20');
  
  // UI Toggles
  const [showQueue, setShowQueue] = useState(false);
  const [showComments, setShowComments] = useState(false);
  
  // Error handling
  const [errorCount, setErrorCount] = useState(0);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const loadingTrackRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rafRef = useRef<number | null>(null);

  // --- Load Playlist ---
  const loadPlaylistData = async (id: string) => {
    setIsLoading(true);
    try {
      const tracks = await fetchPlaylist(id);
      if (tracks.length > 0) {
        setPlaylist(tracks);
        setCurrentIndex(0);
        setIsPlaying(false);
      } else {
        alert("Could not load playlist. Check the ID.");
      }
    } catch (e) {
      console.error("Init failed", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPlaylistData(playlistId);
  }, []); // Run once on mount

  const handlePlaylistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputRef.current && inputRef.current.value) {
        const newId = inputRef.current.value.trim();
        setPlaylistId(newId);
        loadPlaylistData(newId);
        setShowQueue(false);
    }
  };

  const currentTrack = playlist[currentIndex];

  // --- Track Change Logic ---
  useEffect(() => {
    if (!currentTrack || !audioRef.current) return;

    let isMounted = true;
    loadingTrackRef.current = currentTrack.id;

    const loadTrack = async () => {
        setLyrics([]);
        setComments([]);

        // 1. Audio
        try {
            const url = await getAudioUrl(currentTrack.id);
            if (!isMounted || loadingTrackRef.current !== currentTrack.id) return;

            if (audioRef.current) {
                audioRef.current.src = url;
                audioRef.current.load();
                if (isPlaying) {
                    audioRef.current.play().catch(e => handlePlayError(e));
                }
            }
        } catch (e) {
            if (isMounted) handleAudioError(null as any);
        }

        // 2. Extras
        fetchLyrics(currentTrack.id).then(data => {
            if (isMounted && loadingTrackRef.current === currentTrack.id) setLyrics(data);
        }).catch(() => {});
        
        fetchComments(currentTrack.id).then(data => {
            if (isMounted && loadingTrackRef.current === currentTrack.id) setComments(data);
        }).catch(() => {});

        // 3. Color
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = currentTrack.al.picUrl;
        img.onload = () => {
            if (!isMounted || loadingTrackRef.current !== currentTrack.id) return;
            const canvas = document.createElement('canvas');
            canvas.width = 1; canvas.height = 1;
            const ctx = canvas.getContext('2d');
            if(ctx) {
                ctx.drawImage(img, 0, 0, 1, 1);
                const [r,g,b] = ctx.getImageData(0,0,1,1).data;
                // Darken the color slightly for better text contrast if needed, or keep vibrant
                setDominantColor(`${r},${g},${b}`);
            }
        }
    };

    loadTrack();
    return () => { isMounted = false; };
  }, [currentTrack]); 

  // --- Smooth Timer Loop (Replaces basic onTimeUpdate) ---
  useEffect(() => {
      const loop = () => {
          if (audioRef.current && !audioRef.current.paused) {
              setCurrentTime(audioRef.current.currentTime * 1000);
          }
          rafRef.current = requestAnimationFrame(loop);
      };

      if (isPlaying) {
          loop();
      } else {
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
      }

      return () => {
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
  }, [isPlaying]);

  // Handle duration updates separately to avoid re-renders
  const handleDurationChange = () => {
      if (audioRef.current) {
          setDuration(audioRef.current.duration * 1000 || 0);
      }
  };

  const handleEnded = () => {
      setErrorCount(0);
      playNext();
  };

  const handlePlayError = (error: any) => {
     const msg = error instanceof Error ? error.message : String(error);
     if (msg.includes("no supported sources") || msg.includes("format is not supported")) {
         if (playlist.length > 0 && errorCount < 3) {
             setErrorCount(prev => prev + 1);
             setTimeout(() => playNext(), 500);
         } else {
             setIsPlaying(false);
         }
     }
  };

  const handleAudioError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
      if (playlist.length > 0 && errorCount < 3) {
          setErrorCount(prev => prev + 1);
          setTimeout(() => playNext(), 500);
      } else {
          setIsPlaying(false);
      }
  };

  const playNext = () => {
      if (playlist.length === 0) return;
      setCurrentIndex((prev) => (prev + 1) % playlist.length);
  };

  const playPrev = () => {
      if (playlist.length === 0) return;
      setCurrentIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
      setErrorCount(0);
  };

  const togglePlay = async () => {
      if (!audioRef.current || !currentTrack) return;
      if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
      } else {
          try {
              await audioRef.current.play();
              setIsPlaying(true);
              setErrorCount(0);
          } catch (e) {
              handlePlayError(e);
          }
      }
  };

  const handleSeek = (ms: number) => {
      if (audioRef.current) {
          const newTime = ms / 1000;
          if (isFinite(newTime)) {
            audioRef.current.currentTime = newTime;
            setCurrentTime(ms);
          }
      }
  };

  useEffect(() => {
      if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // --- Auto-Scroll Lyrics ---
  const activeIndex = lyrics.findIndex((l, i) => l.time <= currentTime && (i === lyrics.length - 1 || lyrics[i+1].time > currentTime));

  useEffect(() => {
      if (lyricsContainerRef.current && activeIndex !== -1) {
          const el = lyricsContainerRef.current.children[activeIndex] as HTMLElement;
          if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
      }
  }, [activeIndex]);

  if (isLoading) {
      return <div className="h-screen w-screen flex items-center justify-center bg-black text-white"><Loader2 className="animate-spin w-10 h-10" /></div>;
  }

  return (
    <div className="h-screen w-screen flex flex-col relative overflow-hidden font-sans select-none bg-black">
      <audio 
        ref={audioRef}
        crossOrigin="anonymous"
        onDurationChange={handleDurationChange}
        onEnded={handleEnded}
        onError={handleAudioError}
      />

      {/* --- Dynamic Apple-Style Background --- */}
      <div 
        className="absolute inset-0 -z-10 transition-colors duration-[3000ms] ease-linear"
        style={{ 
            background: `radial-gradient(circle at 50% -20%, rgb(${dominantColor}) 0%, #000 70%)`,
            opacity: 0.7
        }}
      />
      <div className="absolute inset-0 -z-10 bg-black/40 backdrop-blur-[120px]" />
      
      {/* --- Main Content Layout --- */}
      <div className="flex-1 flex flex-col lg:flex-row relative z-10 overflow-hidden min-h-0">
        
        {/* Left Side: Album Art (Apple Music Style - Sticky Center) */}
        <div className="flex-1 flex items-center justify-center p-8 lg:p-12 transition-all duration-500 relative min-h-0 min-w-0">
            <div className={`relative aspect-square w-full max-w-[280px] lg:max-w-[550px] transition-transform duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isPlaying ? 'scale-100' : 'scale-[0.8]'}`}>
                {/* Colored Glow Behind Art */}
                <div 
                    className="absolute inset-0 rounded-xl blur-3xl opacity-60 scale-110 -z-10 transition-colors duration-[2000ms]" 
                    style={{ background: `rgb(${dominantColor})` }}
                />
                <img 
                    src={currentTrack?.al.picUrl} 
                    className="w-full h-full object-cover rounded-xl shadow-[0_20px_40px_rgba(0,0,0,0.6)] border border-white/5 relative z-20"
                />
            </div>
        </div>

        {/* Right Side: Lyrics (Apple Music Style - Blur Falloff + Karaoke Fill) */}
        <div className="flex-1 h-full relative overflow-hidden lg:mr-8 flex flex-col min-h-0">
            <div 
                ref={lyricsContainerRef}
                className="flex-1 overflow-y-auto no-scrollbar py-[50vh] px-8 lg:px-4 text-left lyric-mask space-y-6 lg:space-y-10"
            >
                {lyrics.length > 0 ? lyrics.map((line, i) => {
                    const isActive = i === activeIndex;
                    const distance = Math.abs(activeIndex - i);
                    
                    // Style calculation for Blur Falloff
                    let styleClass = "";
                    let fillStyle = {};

                    if (isActive) {
                        styleClass = "scale-100 blur-0 font-extrabold text-3xl lg:text-5xl drop-shadow-md";
                        
                        // Karaoke Gradient Calculation
                        const lineElapsed = currentTime - line.time;
                        const durationSafe = line.duration || 1000;
                        
                        // We use a "softened" linear fill to avoid the "rushed" feeling on short lines.
                        // By giving the gradient a 10% soft edge, it looks smoother.
                        const progress = Math.min(100, Math.max(0, (lineElapsed / durationSafe) * 100));
                        
                        // Apple Music Style: Filled white vs Transparent white
                        fillStyle = {
                            backgroundImage: `linear-gradient(to right, white ${Math.max(0, progress - 10)}%, rgba(255,255,255,0.3) ${Math.min(100, progress + 10)}%)`,
                            WebkitBackgroundClip: 'text',
                            backgroundClip: 'text',
                            color: 'rgba(255,255,255,0.3)', // Fallback color visible if clip fails, or initial state
                            WebkitTextFillColor: 'transparent'
                        };

                    } else if (distance === 1) {
                        styleClass = "opacity-60 scale-[0.98] blur-[1px] text-white/90 font-bold text-2xl lg:text-4xl";
                    } else if (distance === 2) {
                        styleClass = "opacity-30 scale-[0.95] blur-[2px] text-white/80 font-bold text-xl lg:text-3xl";
                    } else if (distance === 3) {
                         styleClass = "opacity-10 scale-[0.9] blur-[4px] text-white/60 font-bold text-lg lg:text-2xl";
                    } else {
                        styleClass = "opacity-5 scale-[0.85] blur-[6px] text-white/40 font-bold text-lg lg:text-xl";
                    }

                    return (
                        <div 
                            key={i} 
                            className={`transition-all duration-700 ease-out origin-left cursor-pointer hover:opacity-80 ${styleClass}`}
                            onClick={() => handleSeek(line.time)}
                        >
                            <p className="leading-tight tracking-tight" style={fillStyle}>
                                {line.text}
                            </p>
                            {line.trans && isActive && (
                                <p className="text-xl lg:text-2xl font-medium mt-2 text-white/60 blur-0">
                                    {line.trans}
                                </p>
                            )}
                        </div>
                    )
                }) : (
                    <div className="flex items-center justify-center h-full">
                        <span className="text-white/30 text-2xl font-bold flex items-center gap-3 animate-pulse">
                            <Disc className="animate-spin-slow" /> Instrumental / No Lyrics
                        </span>
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* --- Queue Sidebar (Slide Over) --- */}
      <div className={`fixed inset-y-0 left-0 w-80 bg-neutral-900/95 backdrop-blur-2xl border-r border-white/5 shadow-2xl z-40 transform transition-transform duration-300 ease-spring ${showQueue ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="p-6 pt-12 flex flex-col h-full">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2"><ListMusic /> Queue</h2>
                    <button onClick={() => setShowQueue(false)} className="p-2 hover:bg-white/10 rounded-full"><X className="w-5 h-5" /></button>
                </div>
                
                {/* Playlist ID Input */}
                <form onSubmit={handlePlaylistSubmit} className="mb-6">
                    <label className="text-xs text-white/50 mb-1 block pl-1">Load Custom Playlist ID</label>
                    <div className="relative">
                        <input 
                            ref={inputRef}
                            defaultValue={playlistId}
                            placeholder="Playlist ID..."
                            className="w-full bg-white/10 border border-white/10 rounded-lg py-2 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-white/30 focus:bg-white/20 transition-colors"
                        />
                        <Search className="w-4 h-4 text-white/40 absolute left-3 top-2.5" />
                    </div>
                    <button type="submit" className="w-full mt-2 bg-white text-black font-bold py-2 rounded-lg text-xs hover:bg-neutral-200 transition-colors">
                        Load
                    </button>
                </form>

                <div className="flex-1 overflow-y-auto no-scrollbar space-y-1">
                    {playlist.map((track, i) => (
                        <div 
                            key={track.id} 
                            onClick={() => { setCurrentIndex(i); setIsPlaying(true); }}
                            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${i === currentIndex ? 'bg-white/20' : 'hover:bg-white/5'}`}
                        >
                            <img src={track.al.picUrl} className="w-10 h-10 rounded-md object-cover" />
                            <div className="flex-1 min-w-0">
                                <div className={`text-sm font-medium truncate ${i === currentIndex ? 'text-white' : 'text-white/80'}`}>{track.name}</div>
                                <div className="text-xs text-white/40 truncate">{track.ar.map(a => a.name).join(', ')}</div>
                            </div>
                            {i === currentIndex && <div className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                        </div>
                    ))}
                </div>
            </div>
      </div>

      {/* --- Comments Drawer (Right Side) --- */}
      <div className={`fixed inset-y-0 right-0 w-full sm:w-[450px] bg-neutral-900/80 backdrop-blur-3xl border-l border-white/10 shadow-2xl z-40 transform transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${showComments ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="flex flex-col h-full">
                <div className="p-6 pt-8 border-b border-white/5 flex items-center justify-between">
                    <h2 className="text-lg font-bold flex items-center gap-2"><MessageSquare className="w-5 h-5" /> Comments</h2>
                    <button onClick={() => setShowComments(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/20 transition-colors"><X className="w-4 h-4" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {comments.length > 0 ? comments.map(c => (
                        <div key={c.commentId} className="flex gap-4 group">
                            <img src={c.user.avatarUrl} className="w-10 h-10 rounded-full border border-white/10 shadow-sm" />
                            <div className="flex-1">
                                <div className="flex justify-between items-baseline mb-1">
                                    <span className="text-sm font-semibold text-white/90">{c.user.nickname}</span>
                                    <span className="text-xs text-white/30">{new Date(c.time).toLocaleDateString()}</span>
                                </div>
                                <p className="text-sm text-white/70 leading-relaxed font-light">{c.content}</p>
                                <div className="flex items-center gap-1 mt-2 text-xs text-white/30 group-hover:text-white/50 transition-colors">
                                    <Heart className="w-3 h-3" /> {c.likedCount}
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className="text-center text-white/30 mt-20">No comments available</div>
                    )}
                </div>
            </div>
      </div>

      {/* --- Player Bar --- */}
      <MusicPlayer 
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        onPlayPause={togglePlay}
        onNext={playNext}
        onPrev={playPrev}
        currentTime={currentTime}
        duration={duration}
        onSeek={handleSeek}
        volume={volume}
        onVolumeChange={setVolume}
        onToggleQueue={() => setShowQueue(!showQueue)}
        onToggleComments={() => setShowComments(!showComments)}
      />
    </div>
  );
};

export default App;
