
import { GameAssets } from './assetGenerator';

const DB_NAME = 'pvz_ai_db';
const STORE_NAME = 'assets';
const KEY = 'custom_assets';

const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
};

export const saveAssets = async (assets: GameAssets) => {
    try {
        const db = await initDB();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.put(assets, KEY);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.error("Failed to save assets to IndexedDB", e);
        throw e;
    }
};

export const loadAssets = async (): Promise<GameAssets | null> => {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(KEY);
            req.onsuccess = () => resolve(req.result as GameAssets);
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.error("Failed to load assets from IndexedDB", e);
        return null;
    }
};
