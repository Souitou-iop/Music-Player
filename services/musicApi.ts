
import { Track, LyricLine, Comment, RecommendedPlaylist, Artist } from '../types';

// 优化后的 API 列表，包含更稳定的镜像源
const RAW_API_BASES = [
  'https://music.cyrilstudio.top', 
  'https://netease-cloud-music-api-anon.vercel.app', 
  'https://api.music.areschang.top', 
  'https://music-api.heheda.top',
  'https://ncmapi.redd.one',
  'https://music-api-theta-liart.vercel.app',
  'https://ncm.cloud.zlib.cn',
];

// 打乱 API 列表以避免单一节点过载
const shuffle = (arr: string[]) => {
    const array = [...arr];
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

const API_BASES = shuffle(RAW_API_BASES);

let currentBestBase: string | null = null;

const fetchWithTimeout = async (url: string, timeout = 15000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
};

const promiseAny = <T>(promises: Promise<T>[]): Promise<T> => {
    return new Promise((resolve, reject) => {
        if (promises.length === 0) {
            reject(new Error("No promises provided"));
            return;
        }
        let rejectedCount = 0;
        const errors: any[] = [];
        promises.forEach((p) => {
            Promise.resolve(p).then(resolve).catch((e) => {
                rejectedCount++;
                errors.push(e);
                if (rejectedCount === promises.length) {
                    reject(new Error("All promises rejected"));
                }
            });
        });
    });
};

const fetchWithFailover = async (path: string): Promise<any> => {
  const separator = path.includes('?') ? '&' : '?';
  const timestamp = `timestamp=${Date.now()}`;
  
  if (currentBestBase) {
      try {
          const url = `${currentBestBase}${path}${separator}${timestamp}`;
          const res = await fetchWithTimeout(url, 5000); // 快速检查当前最佳节点
          if (!res.ok) throw new Error(`Status ${res.status}`);
          const data = await res.json();
          if (data.code && data.code !== 200) throw new Error(`API Code ${data.code}`);
          return data;
      } catch (e) {
          currentBestBase = null; 
      }
  }

  // 尝试所有可用节点，增加成功的几率
  const candidates = API_BASES; 
  try {
      const winnerResponse = await promiseAny(
          candidates.map(async (base) => {
              const url = `${base}${path}${separator}${timestamp}`;
              const res = await fetchWithTimeout(url, 15000); // 给冷启动留足时间
              if (!res.ok) throw new Error('Network response was not ok');
              const data = await res.json();
              if (data.code && data.code !== 200) throw new Error(`API Error: ${data.code}`);
              if (!currentBestBase) {
                  currentBestBase = base;
              }
              return data;
          })
      );
      return winnerResponse;
  } catch (aggregateError) {
      throw new Error("无法连接到任何音乐服务器，请检查网络连接。");
  }
};

const normalizeTrack = (s: any): Track => {
  const al = s.al || s.album || {};
  return {
    id: s.id,
    name: s.name,
    ar: s.ar || s.artists || [],
    al: {
        id: al.id || 0,
        name: al.name || 'Unknown Album',
        // 修正：如果 picUrl 是有效的 URL 则使用，否则尝试从 pic_str 构建（部分 API 返回 pic_str 作为 ID）
        picUrl: al.picUrl || (typeof al.pic_str === 'string' && al.pic_str.startsWith('http') ? al.pic_str : ''),
        pic_str: al.pic_str
    },
    dt: s.dt || s.duration || 0,
    fee: s.fee
  };
};

export const fetchPlaylist = async (id: string): Promise<Track[]> => {
  try {
    const data = await fetchWithFailover(`/playlist/track/all?id=${id}&limit=200&offset=0`);
    return (data.songs || []).map(normalizeTrack);
  } catch (e) {
    throw e;
  }
};

export const fetchRecommendedPlaylists = async (): Promise<RecommendedPlaylist[]> => {
  try {
    const data = await fetchWithFailover('/personalized?limit=30');
    return data.result || [];
  } catch (e) {
    return [];
  }
};

export const searchPlaylists = async (keywords: string): Promise<RecommendedPlaylist[]> => {
  try {
    const data = await fetchWithFailover(`/cloudsearch?keywords=${encodeURIComponent(keywords)}&type=1000&limit=30`);
    const playlists = data.result?.playlists || [];
    return playlists.map((p: any) => ({
      id: p.id,
      name: p.name,
      picUrl: p.coverImgUrl, 
      playCount: p.playCount,
      copywriter: p.creator?.nickname 
    }));
  } catch (e) {
    return [];
  }
};

export const searchSongs = async (keywords: string): Promise<Track[]> => {
  try {
    const data = await fetchWithFailover(`/cloudsearch?keywords=${encodeURIComponent(keywords)}&type=1&limit=30`);
    const songs = data.result?.songs || [];
    return songs.map(normalizeTrack);
  } catch (e) {
    return [];
  }
};

export const searchArtists = async (keywords: string): Promise<Artist[]> => {
  try {
    const data = await fetchWithFailover(`/cloudsearch?keywords=${encodeURIComponent(keywords)}&type=100&limit=30`);
    const artists = data.result?.artists || [];
    return artists.map((a: any) => ({
      id: a.id,
      name: a.name,
      picUrl: a.picUrl || a.img1v1Url
    }));
  } catch (e) {
    return [];
  }
};

export const fetchArtistTopSongs = async (artistId: number): Promise<Track[]> => {
  try {
    const data = await fetchWithFailover(`/artist/top/song?id=${artistId}`);
    return (data.songs || []).map(normalizeTrack);
  } catch (e) {
    throw e;
  }
};

export const fetchArtistDetail = async (artistId: number): Promise<any> => {
    try {
        const data = await fetchWithFailover(`/artist/detail?id=${artistId}`);
        return data.data?.artist || data.artist || {};
    } catch (e) {
        return {};
    }
};

export const fetchArtistSongsList = async (artistId: number, order: 'hot' | 'time', limit = 50): Promise<Track[]> => {
    // 热门歌曲接口通常数据较全
    if (order === 'hot') {
        return fetchArtistTopSongs(artistId);
    }
    
    try {
        // 请求按时间排序的歌曲列表
        const data = await fetchWithFailover(`/artist/songs?id=${artistId}&order=${order}&limit=${limit}`);
        const songs = data.songs || [];
        
        if (songs.length === 0) return [];

        // 检查是否所有歌曲都缺少封面。/artist/songs 接口按时间排序时经常只返回专辑 ID 而非 picUrl
        const needsFullDetail = songs.some((s: any) => {
            const al = s.al || s.album || {};
            return !al.picUrl && (!al.pic_str || !al.pic_str.startsWith('http'));
        });

        if (needsFullDetail) {
            // 如果发现缺少封面，则使用歌曲 ID 批量请求歌曲详情以获取完整数据（包含 picUrl）
            const ids = songs.map((s: any) => s.id).join(',');
            const detailData = await fetchWithFailover(`/song/detail?ids=${ids}`);
            return (detailData.songs || []).map(normalizeTrack);
        }

        return songs.map(normalizeTrack);
    } catch (e) {
        console.error("Failed to fetch artist songs list", e);
        return [];
    }
};

export const getAudioUrl = async (id: number): Promise<string> => {
  return `https://music.163.com/song/media/outer/url?id=${id}.mp3`;
};

/**
 * 从压缩包（zip/rar）中读取音频文件以供播放。
 * 注意：由于环境限制，此处提供逻辑框架，实际使用需配合 JSZip 等库实现。
 * @param archiveData 压缩包的二进制数据
 * @returns 提取出的音频 Blob 数组
 */
export const readAudioFromArchive = async (archiveData: ArrayBuffer): Promise<Blob[]> => {
  console.log("正在准备从压缩档案提取音频文件...");
  // 核心逻辑应包含解压、过滤 .mp3/.wav 文件并生成 Blob
  return [];
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
    return original.map((line, index) => {
      const nextLine = original[index + 1];
      const rawDuration = nextLine ? nextLine.time - line.time : 5000;
      const duration = Math.max(400, rawDuration); 
      const transLine = translation.find(t => Math.abs(t.time - line.time) < 500);
      return {
        ...line,
        duration,
        trans: transLine?.text,
        isContinuation: false 
      };
    });
  } catch (e) {
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
