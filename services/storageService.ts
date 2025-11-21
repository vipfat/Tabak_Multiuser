import { SavedMix, MixIngredient, AiAnalysisResult, Flavor } from '../types';
import { AVAILABLE_FLAVORS } from '../constants';

const STORAGE_KEY = 'hookah_alchemist_history_v1';
const FLAVORS_STORAGE_KEY = 'hookah_alchemist_flavors_v1';
const CLOUD_ID_KEY = 'hookah_alchemist_cloud_id_v1';

const BLOB_API_URL = 'https://jsonblob.com/api/jsonBlob';

// Robust ID generator with fallback
const generateId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        try {
            return crypto.randomUUID();
        } catch (e) {
            // Fallback
        }
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

/**
 * CLOUD MANAGEMENT
 */

export const getCloudId = (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(CLOUD_ID_KEY);
};

export const setCloudId = (id: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CLOUD_ID_KEY, id);
};

export const createCloudStorage = async (initialData: Flavor[]): Promise<string> => {
    try {
        const response = await fetch(BLOB_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(initialData)
        });

        if (!response.ok) throw new Error('Failed to create cloud storage');
        
        const location = response.headers.get('Location');
        if (!location) throw new Error('No location header returned');
        
        // Extract ID from URL (https://jsonblob.com/api/jsonBlob/UUID)
        const parts = location.split('/');
        const id = parts[parts.length - 1];
        
        setCloudId(id);
        return id;
    } catch (e) {
        console.error("Cloud creation failed:", e);
        throw e;
    }
};

/**
 * FLAVORS MANAGEMENT
 */

// Synchronous fallback for initial state (from cache)
export const getStoredFlavorsLocal = (): Flavor[] => {
    if (typeof window === 'undefined') return AVAILABLE_FLAVORS;
    try {
        const raw = localStorage.getItem(FLAVORS_STORAGE_KEY);
        if (!raw) return AVAILABLE_FLAVORS;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : AVAILABLE_FLAVORS;
    } catch (e) {
        return AVAILABLE_FLAVORS;
    }
};

// Async fetcher (tries Cloud first, falls back to Local)
export const fetchFlavors = async (): Promise<Flavor[]> => {
    const cloudId = getCloudId();
    
    // 1. Try Cloud
    if (cloudId) {
        try {
            const response = await fetch(`${BLOB_API_URL}/${cloudId}`);
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data)) {
                    // Update local cache
                    localStorage.setItem(FLAVORS_STORAGE_KEY, JSON.stringify(data));
                    return data;
                }
            } else {
                console.warn("Cloud fetch failed, using local cache");
            }
        } catch (e) {
            console.warn("Cloud error, using local cache", e);
        }
    }

    // 2. Fallback to Local Cache
    return getStoredFlavorsLocal();
};

// Save (Updates Cloud if connected + Local Cache)
export const saveStoredFlavors = async (flavors: Flavor[]) => {
    try {
        // Always save local first for immediate UI update
        localStorage.setItem(FLAVORS_STORAGE_KEY, JSON.stringify(flavors));

        const cloudId = getCloudId();
        if (cloudId) {
            // Fire and forget cloud update (or await if critical)
            await fetch(`${BLOB_API_URL}/${cloudId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(flavors)
            });
        }
    } catch (e) {
        console.error("Error saving flavors", e);
    }
};

export const resetStoredFlavors = async (): Promise<Flavor[]> => {
    try {
        localStorage.removeItem(FLAVORS_STORAGE_KEY);
        
        const cloudId = getCloudId();
        if (cloudId) {
             await fetch(`${BLOB_API_URL}/${cloudId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(AVAILABLE_FLAVORS)
            });
        }
        return AVAILABLE_FLAVORS;
    } catch (e) {
        return AVAILABLE_FLAVORS;
    }
};

/**
 * HISTORY MANAGEMENT (Remains Local for User Privacy)
 */

export const saveMixToHistory = (userId: number, ingredients: MixIngredient[], aiAnalysis?: AiAnalysisResult): SavedMix => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const allMixes: SavedMix[] = raw ? JSON.parse(raw) : [];
    
    const newMix: SavedMix = {
      id: generateId(),
      userId,
      timestamp: Date.now(),
      ingredients,
      aiAnalysis,
      isFavorite: false
    };

    const updatedHistory = [newMix, ...allMixes];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
    return newMix;
  } catch (e) {
    console.error("Error saving mix:", e);
    return {
        id: generateId(),
        userId,
        timestamp: Date.now(),
        ingredients,
        aiAnalysis,
        isFavorite: false
    };
  }
};

export const getHistory = (userId: number): SavedMix[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const allMixes: SavedMix[] = JSON.parse(raw);
    return allMixes.filter(m => m.userId === userId);
  } catch (e) {
    return [];
  }
};

export const toggleFavoriteMix = (mixId: string): SavedMix[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        let allMixes: SavedMix[] = JSON.parse(raw);
        allMixes = allMixes.map(m => {
            if (m.id === mixId) {
                return { ...m, isFavorite: !m.isFavorite };
            }
            return m;
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allMixes));
        return allMixes;
    } catch (e) {
        return [];
    }
};

export const deleteMix = (mixId: string): SavedMix[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        let allMixes: SavedMix[] = JSON.parse(raw);
        allMixes = allMixes.filter(m => m.id !== mixId);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allMixes));
        return allMixes;
    } catch (e) {
        return [];
    }
};