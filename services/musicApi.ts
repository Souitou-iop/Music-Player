
import { Track, LyricLine, Comment } from '../types';

// Use a rotating set of public APIs to improve stability
// These are public Vercel deployments of the NeteaseCloudMusicApi
const API_BASES = [
  'https://netease-cloud-music-api-anon.vercel.app', 
  'https://netease-cloud-music-api-psi-nine.vercel.app'
];

const fetchWithFailover = async (path: string): Promise<any> => {
  for (const base of API_BASES) {
    try {
      const res = await fetch(`${base}${path}`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn(`API ${base} failed for ${path}, trying next...`);
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
  try {
    // 1. Try to get the official URL from the API
    // Requesting 'standard' quality often bypasses some VIP restrictions compared to 'lossless'
    const data = await fetchWithFailover(`/song/url?id=${id}&level=standard`);
    const apiResult = data.data?.[0]?.url;
    
    if (apiResult) {
        // Ensure https to avoid mixed content errors
        return apiResult.replace('http://', 'https://');
    }
  } catch (e) {
    console.warn("API url fetch failed, using fallback", e);
  }

  // 2. Fallback to direct outer link if API fails or returns null
  // This link redirects to the actual mp3. The no-referrer meta tag in index.html is crucial here.
  return `https://music.163.com/song/media/outer/url?id=${id}.mp3`;
};

// Deprecated: kept for compatibility if needed, but getAudioUrl is preferred
export const fetchSongUrl = (id: number): string => {
  return `https://music.163.com/song/media/outer/url?id=${id}.mp3`;
};

const parseLrc = (lrc: string): { time: number; text: string }[] => {
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
      // Default 5s for last line. 
      // Ensure min duration is 400ms to avoid instant flashing on bad timestamps.
      const rawDuration = nextLine ? nextLine.time - line.time : 5000;
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
