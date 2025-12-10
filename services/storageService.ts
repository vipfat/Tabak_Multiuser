import { SavedMix, MixIngredient, Flavor, FlavorBrand, Venue } from '../types';
import { AVAILABLE_FLAVORS, DEFAULT_GOOGLE_SCRIPT_URL } from '../constants';

const STORAGE_KEY = 'hookah_alchemist_history_v2';
const GOOGLE_SCRIPT_URL_KEY = 'hookah_alchemist_gscript_url';
const SELECTED_VENUE_KEY = 'hookah_alchemist_selected_venue';

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
 * GOOGLE SHEETS INTEGRATION
 */

export const getGoogleScriptUrl = (): string => {
    return localStorage.getItem(GOOGLE_SCRIPT_URL_KEY) || DEFAULT_GOOGLE_SCRIPT_URL;
};

export const setGoogleScriptUrl = (url: string) => {
    if (!url || url === DEFAULT_GOOGLE_SCRIPT_URL) {
        localStorage.removeItem(GOOGLE_SCRIPT_URL_KEY);
    } else {
        localStorage.setItem(GOOGLE_SCRIPT_URL_KEY, url.trim());
    }
};

export const saveSelectedVenue = (venue: Venue) => {
    try {
        localStorage.setItem(SELECTED_VENUE_KEY, JSON.stringify(venue));
    } catch (e) {
        console.error('Failed to persist venue', e);
    }
};

export const getSavedVenue = (): Venue | null => {
    try {
        const raw = localStorage.getItem(SELECTED_VENUE_KEY);
        return raw ? (JSON.parse(raw) as Venue) : null;
    } catch (e) {
        return null;
    }
};

interface FetchResult {
    flavors: Flavor[];
    pin: string | null;
    brands: string[];
}

// Fetch flavors from Google Apps Script
export const fetchFlavors = async (): Promise<FetchResult> => {
    const url = getGoogleScriptUrl();
    
    if (!url) {
        return { flavors: AVAILABLE_FLAVORS, pin: null, brands: [] };
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

        // Cache Buster to prevent browser from serving stale JSON
        const fetchUrl = `${url}${url.includes('?') ? '&' : '?'}nocache=${Date.now()}`;

        const response = await fetch(fetchUrl, {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Ошибка сети: ${response.status}`);
        }

        const text = await response.text();
        
        // Google Scripts error page detection
        if (text.trim().startsWith('<') || text.includes('Google Drive')) {
            throw new Error("Ошибка доступа к скрипту. Проверьте URL.");
        }

        try {
            const data = JSON.parse(text);
            
            let flavors: Flavor[] = [];
            let pin: string | null = null;
            let brands: string[] = [];

            // Handle different potential JSON structures
            let rawFlavors: any[] = [];

            if (Array.isArray(data)) {
                // Structure: [ {name: ...}, {name: ...} ]
                rawFlavors = data;
            } else if (data && typeof data === 'object') {
                // Structure: { flavors: [...], pin: "...", brands: [...] }
                if (Array.isArray(data.flavors)) {
                    rawFlavors = data.flavors;
                }
                // Try to extract PIN and Brands if available
                if (data.pin) pin = String(data.pin).trim();
                if (Array.isArray(data.brands)) {
                    brands = data.brands.map((b: any) => String(b).trim()).filter((b: string) => b.length > 0);
                }
            }

            // Process Flavors
            flavors = rawFlavors.map((f: any) => {
                // Helper to find property regardless of case (Name vs name)
                const getProp = (obj: any, keys: string[]) => {
                    for (const k of keys) {
                        if (obj[k] !== undefined) return obj[k];
                    }
                    return undefined;
                };

                // Extract values with fallbacks for different capitalizations
                const rawName = getProp(f, ['name', 'Name', 'NAME']);
                const rawBrand = getProp(f, ['brand', 'Brand', 'BRAND']);
                const rawDesc = getProp(f, ['description', 'Description', 'desc', 'Desc']);
                const rawColor = getProp(f, ['color', 'Color', 'colour']);
                const rawAvail = getProp(f, ['isAvailable', 'available', 'IsAvailable', 'Available', 'status']);
                const rawId = getProp(f, ['id', 'Id', 'ID', 'key']);

                // Normalize availability: Default to TRUE unless explicitly False
                // This ensures that if the column is empty, we show the flavor (safer).
                let isAvailable = true;
                if (rawAvail !== undefined && rawAvail !== null && rawAvail !== '') {
                    const s = String(rawAvail).toLowerCase().trim();
                    // Check for explicit negative values
                    if (['false', '0', 'no', 'нет', '-', 'off'].includes(s)) {
                        isAvailable = false;
                    }
                    // Note: We don't check for 'true' specifically anymore, we assume true unless marked false.
                }

                return {
                    id: String(rawId || generateId()),
                    name: String(rawName || "Без названия").trim(),
                    brand: String(rawBrand || FlavorBrand.OTHER).trim(),
                    description: String(rawDesc || "").trim(),
                    color: String(rawColor || "#cccccc").trim(),
                    isAvailable: isAvailable
                };
            });

            return { flavors, pin, brands };

        } catch (parseError) {
             console.error("JSON Parse Error:", parseError);
             throw new Error("Ошибка обработки данных от Google (неверный JSON).");
        }

    } catch (e: any) {
        console.error("Error fetching from Google Sheet:", e);
        // Return empty lists so the app knows fetch failed but does not crash
        return { flavors: [], pin: null, brands: [] };
    }
};

interface SaveResult {
    success: boolean;
    message: string;
}

// Helper for sending data
const sendToGoogleScript = async (payload: any): Promise<SaveResult> => {
    const url = getGoogleScriptUrl();
    if (!url) return { success: false, message: "URL скрипта не настроен" };
    if (!navigator.onLine) return { success: false, message: "Нет интернета" };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
        await fetch(url, {
            method: 'POST',
            redirect: 'follow',
            headers: { 
                'Content-Type': 'text/plain;charset=utf-8' 
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        return { success: true, message: "Успешно отправлено" };
    } catch (e: any) {
        clearTimeout(timeoutId);
        console.error("Save error:", e);
        return { success: false, message: `Ошибка отправки: ${e.message}` };
    }
};

// 1. Save ONLY Flavors and Brands
export const saveFlavorsAndBrands = async (flavors: Flavor[], brands: string[]): Promise<SaveResult> => {
    const validBrands = brands.filter(b => b && b.trim() !== "");
    
    const payload = {
        action: 'saveFlavors',
        flavors: flavors,
        brands: validBrands
    };
    return sendToGoogleScript(payload);
};

// 2. Save ONLY PIN
export const saveGlobalPin = async (pin: string): Promise<SaveResult> => {
    const payload = {
        action: 'savePin',
        pin: pin
    };
    return sendToGoogleScript(payload);
};

/**
 * HISTORY MANAGEMENT (Local User Storage)
 */

export const saveMixToHistory = (userId: number, ingredients: MixIngredient[], name: string, venue?: Venue | null): SavedMix => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const allMixes: SavedMix[] = raw ? JSON.parse(raw) : [];

    const sanitizedIngredients: MixIngredient[] = ingredients.map(({ isMissing, ...rest }) => ({ ...rest }));

    const newMix: SavedMix = {
      id: generateId(),
      userId,
      timestamp: Date.now(),
      ingredients: sanitizedIngredients,
      name: name || "Мой микс",
      isFavorite: false,
      venue,
    };

    const updatedHistory = [newMix, ...allMixes];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
    return newMix;
  } catch (e) {
    console.error("Error saving mix:", e);
    const fallbackIngredients: MixIngredient[] = ingredients.map(({ isMissing, ...rest }) => ({ ...rest }));
    return {
        id: generateId(),
        userId,
        timestamp: Date.now(),
        ingredients: fallbackIngredients,
        name: name || "Мой микс",
        isFavorite: false,
        venue,
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