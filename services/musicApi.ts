
import { Track, LyricLine, Comment, RecommendedPlaylist, Artist } from '../types';

// 优化后的 API 列表，包含更稳定的镜像源
// 移除了部分频繁超时的节点，新增了近期活跃的节点
export const RAW_API_BASES = [
  'https://music.cyrilstudio.top', // 长期稳定
  'https://ncmapi.redd.one',       // 长期稳定
  'https://music.jw1.dev',
  'https://netease.pub',
  'https://api.music.areschang.top',
  'https://music.qier296.top',
  'https://api.wengqianshan.com',  // 新增
  'https://music-api.gdstudio.xyz', // 新增
  'https://netease-cloud-music-api-anon.vercel.app', // Vercel 节点，可能会有冷启动延迟
  'https://music-api.heheda.top',
  'https://api.paugram.com/netease'
];

// --- 缓存配置 ---
const CACHE_PREFIX = 'vinyl_cache_';
const TTL_CONFIG = {
    LYRICS: 1000 * 60 * 60 * 24 * 7, // 7天 (歌词基本不变)
    PLAYLIST: 1000 * 60 * 30,        // 30分钟
    URL: 1000 * 60 * 15,             // 15分钟 (链接会过期)
    COMMON: 1000 * 60 * 10,          // 10分钟 (推荐、搜索等)
    ARTIST: 1000 * 60 * 60 * 24      // 24小时 (歌手信息)
};

// --- 缓存工具函数 ---

// 清理过期缓存或强制清理旧缓存以释放空间
const pruneCache = () => {
    try {
        const now = Date.now();
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(CACHE_PREFIX)) {
                try {
                    const item = localStorage.getItem(key);
                    if (item) {
                        const { expiry } = JSON.parse(item);
                        if (now > expiry) {
                            localStorage.removeItem(key);
                        }
                    }
                } catch (e) {
                    // 解析失败，可能是坏数据，移除
                    localStorage.removeItem(key);
                }
            }
        }
    } catch (e) {
        console.warn('Prune cache failed', e);
    }
};

// 写入缓存
const setCache = (key: string, data: any, ttl: number) => {
    const fullKey = CACHE_PREFIX + key;
    const payload = JSON.stringify({
        data,
        expiry: Date.now() + ttl
    });
    try {
        localStorage.setItem(fullKey, payload);
    } catch (e) {
        // QuotaExceededError 通常是空间满了
        console.warn('Cache write failed, pruning...', e);
        pruneCache(); // 尝试清理
        try {
            localStorage.setItem(fullKey, payload); // 再试一次
        } catch (retryError) {
            console.warn('Cache write failed after prune', retryError);
        }
    }
};

// 读取缓存
const getCache = <T>(key: string): T | null => {
    const fullKey = CACHE_PREFIX + key;
    try {
        const item = localStorage.getItem(fullKey);
        if (!item) return null;
        
        const { data, expiry } = JSON.parse(item);
        if (Date.now() > expiry) {
            localStorage.removeItem(fullKey);
            return null;
        }
        return data as T;
    } catch (e) {
        return null;
    }
};

// 高阶函数：带缓存的请求
const withCache = async <T>(
    cacheKey: string, 
    ttl: number, 
    fetcher: () => Promise<T>
): Promise<T> => {
    // 1. 尝试读取缓存
    const cached = getCache<T>(cacheKey);
    if (cached) {
        // console.debug(`[Cache Hit] ${cacheKey}`);
        return cached;
    }

    // 2. 发起网络请求
    const data = await fetcher();

    // 3. 写入缓存 (只有非空/有效数据才缓存)
    if (data && (Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0)) {
        setCache(cacheKey, data, ttl);
    }

    return data;
};

// --- API 逻辑 ---

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
let customApiBase: string | null = null;

// 设置用户自定义的 API 源
export const setApiSource = (url: string) => {
    customApiBase = url;
    currentBestBase = url;
};

// 获取当前使用的 API 源
export const getCurrentApiSource = () => customApiBase || currentBestBase || API_BASES[0];

// 测试 API 延迟
export const pingApiSource = async (url: string): Promise<number> => {
    const start = Date.now();
    try {
        const controller = new AbortController();
        // 缩短超时时间到 3000ms，提高测速反馈速度
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        // 请求根路径
        const res = await fetch(url, { method: 'GET', signal: controller.signal });
        clearTimeout(timeoutId);

        // 只要状态码小于 500 (包括 404 Not Found)，都说明服务器是通的，可以作为 API 源
        if (res.status < 500) {
            return Date.now() - start;
        }
        return -1;
    } catch {
        return -1;
    }
};

const fetchWithTimeout = async (url: string, timeout = 10000) => {
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
  
  // 1. 如果用户手动指定了源，强制使用
  if (customApiBase) {
      try {
          const url = `${customApiBase}${path}${separator}${timestamp}`;
          const res = await fetchWithTimeout(url, 8000);
          if (!res.ok) throw new Error(`Status ${res.status}`);
          const data = await res.json();
          return data;
      } catch (e) {
          console.warn(`Custom source ${customApiBase} failed, falling back to auto.`);
      }
  }
  
  // 2. 自动选择逻辑 - 优先使用上次成功的节点
  if (currentBestBase) {
      try {
          const url = `${currentBestBase}${path}${separator}${timestamp}`;
          const res = await fetchWithTimeout(url, 5000); 
          if (!res.ok) throw new Error(`Status ${res.status}`);
          const data = await res.json();
          if (data.code && data.code !== 200) throw new Error(`API Code ${data.code}`);
          return data;
      } catch (e) {
          if (!customApiBase) currentBestBase = null; // 重置最佳节点，触发重新竞速
      }
  }

  // 3. 竞速模式：限制并发数，避免浏览器阻塞
  const candidates = API_BASES.slice(0, 6); 
  
  try {
      const winnerResponse = await promiseAny(
          candidates.map(async (base) => {
              const url = `${base}${path}${separator}${timestamp}`;
              const res = await fetchWithTimeout(url, 10000); 
              if (!res.ok) throw new Error('Network response was not ok');
              const data = await res.json();
              if (data.code && data.code !== 200) throw new Error(`API Error: ${data.code}`);
              
              if (!currentBestBase && !customApiBase) {
                  currentBestBase = base;
              }
              return data;
          })
      );
      return winnerResponse;
  } catch (aggregateError) {
      if (API_BASES.length > 6) {
          try {
             const backupCandidates = API_BASES.slice(6);
             const backupResponse = await promiseAny(
                backupCandidates.map(async (base) => {
                    const url = `${base}${path}${separator}${timestamp}`;
                    const res = await fetchWithTimeout(url, 10000);
                    if (!res.ok) throw new Error('Network error');
                    const data = await res.json();
                    if (!currentBestBase && !customApiBase) currentBestBase = base;
                    return data;
                })
             );
             return backupResponse;
          } catch (e) {
             throw new Error("所有音乐服务器均无响应，请手动切换源或检查网络。");
          }
      }
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
  return withCache(`playlist_${id}`, TTL_CONFIG.PLAYLIST, async () => {
    try {
        const data = await fetchWithFailover(`/playlist/track/all?id=${id}&limit=200&offset=0`);
        return (data.songs || []).map(normalizeTrack);
    } catch (e) {
        throw e;
    }
  });
};

export const fetchRecommendedPlaylists = async (): Promise<RecommendedPlaylist[]> => {
  return withCache('recommend_playlists', TTL_CONFIG.COMMON, async () => {
    try {
        const data = await fetchWithFailover('/personalized?limit=30');
        return data.result || [];
    } catch (e) {
        return [];
    }
  });
};

export const searchPlaylists = async (keywords: string): Promise<RecommendedPlaylist[]> => {
  // 搜索结果缓存，key 包含关键词
  return withCache(`search_playlist_${keywords}`, TTL_CONFIG.COMMON, async () => {
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
  });
};

export const searchSongs = async (keywords: string): Promise<Track[]> => {
  return withCache(`search_song_${keywords}`, TTL_CONFIG.COMMON, async () => {
    try {
        const data = await fetchWithFailover(`/cloudsearch?keywords=${encodeURIComponent(keywords)}&type=1&limit=30`);
        const songs = data.result?.songs || [];
        return songs.map(normalizeTrack);
    } catch (e) {
        return [];
    }
  });
};

export const searchArtists = async (keywords: string): Promise<Artist[]> => {
  return withCache(`search_artist_${keywords}`, TTL_CONFIG.COMMON, async () => {
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
  });
};

export const fetchArtistTopSongs = async (artistId: number): Promise<Track[]> => {
  return withCache(`artist_top_${artistId}`, TTL_CONFIG.ARTIST, async () => {
    try {
        const data = await fetchWithFailover(`/artist/top/song?id=${artistId}`);
        return (data.songs || []).map(normalizeTrack);
    } catch (e) {
        throw e;
    }
  });
};

export const fetchArtistDetail = async (artistId: number): Promise<any> => {
    return withCache(`artist_detail_${artistId}`, TTL_CONFIG.ARTIST, async () => {
        try {
            const data = await fetchWithFailover(`/artist/detail?id=${artistId}`);
            return data.data?.artist || data.artist || {};
        } catch (e) {
            return {};
        }
    });
};

export const fetchArtistSongsList = async (artistId: number, order: 'hot' | 'time', limit = 50): Promise<Track[]> => {
    if (order === 'hot') {
        return fetchArtistTopSongs(artistId);
    }
    
    return withCache(`artist_songs_${artistId}_${order}`, TTL_CONFIG.ARTIST, async () => {
        try {
            const data = await fetchWithFailover(`/artist/songs?id=${artistId}&order=${order}&limit=${limit}`);
            const songs = data.songs || [];
            
            if (songs.length === 0) return [];

            const needsFullDetail = songs.some((s: any) => {
                const al = s.al || s.album || {};
                return !al.picUrl && (!al.pic_str || !al.pic_str.startsWith('http'));
            });

            if (needsFullDetail) {
                const ids = songs.map((s: any) => s.id).join(',');
                const detailData = await fetchWithFailover(`/song/detail?ids=${ids}`);
                return (detailData.songs || []).map(normalizeTrack);
            }

            return songs.map(normalizeTrack);
        } catch (e) {
            console.error("Failed to fetch artist songs list", e);
            return [];
        }
    });
};

export const getAudioUrl = async (id: number): Promise<string> => {
  return withCache(`audio_url_${id}`, TTL_CONFIG.URL, async () => {
      try {
        // 构造参数：标准音质 + iOS 伪装 + 国内 IP
        const params = new URLSearchParams();
        params.append('id', id.toString());
        params.append('level', 'standard'); 
        params.append('cookie', 'os=ios;appver=8.20.20;'); 
        params.append('realIP', '116.25.146.177'); 

        const data = await fetchWithFailover(`/song/url?${params.toString()}`);
        
        if (data.data && data.data[0] && data.data[0].url) {
          let url = data.data[0].url;
          if (url.startsWith('http:') && typeof window !== 'undefined' && window.location.protocol === 'https:') {
              url = url.replace('http:', 'https:');
          }
          return url;
        }
      } catch (e) {
        console.warn("API fetch failed, fallback to outer link", e);
      }
      return `https://music.163.com/song/media/outer/url?id=${id}.mp3`;
  });
};

/**
 * 从压缩包（zip/rar）中读取音频文件以供播放。
 * 注意：由于环境限制，此处提供逻辑框架，实际使用需配合 JSZip 等库实现。
 */
export const readAudioFromArchive = async (archiveData: ArrayBuffer): Promise<Blob[]> => {
  console.log("正在准备从压缩档案提取音频文件...");
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
  return withCache(`lyrics_${id}`, TTL_CONFIG.LYRICS, async () => {
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
  });
};

export const fetchComments = async (id: number): Promise<Comment[]> => {
  return withCache(`comments_${id}`, TTL_CONFIG.COMMON, async () => {
    try {
        const data = await fetchWithFailover(`/comment/music?id=${id}&limit=20`);
        return data.hotComments || data.comments || [];
    } catch (e) {
        return [];
    }
  });
};
