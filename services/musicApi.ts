
import { Track, LyricLine, Comment } from '../types';

// Use a rotating set of public APIs to improve stability
const API_BASES = [
  'https://netease-cloud-music-api-anon.vercel.app', 
  'https://netease-cloud-music-api-psi-nine.vercel.app',
  'https://music-api.heheda.top',
  'https://netease.blobs.uk',
  'https://api.music.areschang.top'
];

// Helper to try multiple endpoints
const fetchWithFailover = async (path: string): Promise<any> => {
  const validBases = API_BASES.filter(b => !b.includes('music.163.com/api')); 

  for (const base of validBases) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); 

      const res = await fetch(`${base}${path}`, { 
        signal: controller.signal 
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`Status ${res.status}`);
      return await res.json();
    } catch (e) {
      continue;
    }
  }
  throw new Error("All API endpoints failed");
};

export const fetchPlaylist = async (id: string): Promise<Track[]> => {
  try {
    const data = await fetchWithFailover(`/playlist/track/all?id=${id}&limit=50&offset=0`);
    return data.songs || [];
  } catch (e) {
    console.error("Failed to fetch playlist", e);
    return [];
  }
};

export const getAudioUrl = async (id: number): Promise<string> => {
  // Strategy: Use the official Netease "outer" link chain.
  // This is a 302 redirect. Browsers can handle this if strict crossOrigin checks are disabled on the audio tag.
  // We append a random timestamp to prevent the browser from caching a previous 404/403 response.
  return `https://music.163.com/song/media/outer/url?id=${id}.mp3&t=${Date.now()}`;
};

// Deprecated
export const fetchSongUrl = (id: number): string => {
  return `https://music.163.com/song/media/outer/url?id=${id}.mp3`;
};

const parseLrc = (lrc: string): { time: number; text: string }[] => {
  if (!lrc) return [];
  const lines = lrc.split('\n');
  const result: { time: number; text: string }[] = [];
  const timeExp = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

  for (const line of lines) {
    const match = timeExp.exec(line);
    if (match) {
      const min = parseInt(match[1]);
      const sec = parseInt(match[2]);
      const ms = parseInt(match[3]) * (match[3].length === 2 ? 10 : 1);
      const time = min * 60 * 1000 + sec * 1000 + ms;
      const text = line.replace(timeExp, '').trim();
      if (text) {
        result.push({ time, text });
      }
    }
  }
  return result;
};

export const fetchLyrics = async (id: number): Promise<LyricLine[]> => {
  try {
    const data = await fetchWithFailover(`/lyric?id=${id}`);
    
    const original = data.lrc?.lyric ? parseLrc(data.lrc.lyric) : [];
    const translation = data.tlyric?.lyric ? parseLrc(data.tlyric.lyric) : [];

    // Map and calculate duration
    return original.map((line, index) => {
      // Calculate duration based on next line's time
      const nextLine = original[index + 1];
      const rawDuration = nextLine ? nextLine.time - line.time : 5000;
      // Min duration 400ms to prevent visual glitching
      const duration = Math.max(400, rawDuration); 

      // Find matching translation (rough match within 500ms)
      const transLine = translation.find(t => Math.abs(t.time - line.time) < 500);
      
      return {
        ...line,
        duration,
        trans: transLine?.text
      };
    });
  } catch (e) {
    console.warn("No lyrics found");
    return [];
  }
};

export const fetchComments = async (id: number): Promise<Comment[]> => {
  try {
    const data = await fetchWithFailover(`/comment/music?id=${id}&limit=20`);
    return data.hotComments || data.comments || [];
  } catch (e) {
    return [];
  }
};
