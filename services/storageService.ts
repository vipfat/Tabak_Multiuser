import { SavedMix, MixIngredient, Flavor, FlavorBrand, Venue } from '../types';
import { AVAILABLE_FLAVORS } from '../constants';
import { apiFetch } from './apiClient';

const STORAGE_KEY = 'hookah_alchemist_history_v2';
const SELECTED_VENUE_KEY = 'hookah_alchemist_selected_venue';

// Robust ID generator with fallback
export const generateUuid = (): string => {
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

export const saveSelectedVenue = (venue: Venue) => {
    try {
        localStorage.setItem(SELECTED_VENUE_KEY, venue.id);
    } catch (e) {
        console.error('Failed to persist venue ID', e);
    }
};

export const getSavedVenueId = (): string | null => {
    try {
        return localStorage.getItem(SELECTED_VENUE_KEY);
    } catch (e) {
        return null;
    }
};

interface FetchResult {
    flavors: Flavor[];
    brands: string[];
}

// Fetch merged flavors (global + custom) from new architecture
export const fetchFlavors = async (venueId?: string | null): Promise<FetchResult> => {
    if (!venueId) {
        return { flavors: AVAILABLE_FLAVORS, brands: [] };
    }

    try {
        // Use new merged endpoint that combines global + custom flavors
        const { flavors: flavorsData = [] } = await apiFetch<{ flavors: any[] }>(
            `/venues/${encodeURIComponent(venueId)}/flavors/merged`
        );

        const flavors: Flavor[] = (flavorsData || []).map((row: any) => ({
            id: String(row.id || generateUuid()),
            name: String(row.name || 'Без названия').trim(),
            brand: String(row.brand || FlavorBrand.OTHER).trim(),
            description: String(row.description || '').trim(),
            color: String(row.color || '#cccccc').trim(),
            isAvailable: row.is_available !== false,
            source: row.source || 'custom', // 'global' or 'custom'
        }));

        // Extract unique brands from flavors
        const brandSet = new Set<string>();
        flavors.forEach(f => {
            if (f.brand && f.brand !== FlavorBrand.OTHER) {
                brandSet.add(f.brand);
            }
        });
        const brands = Array.from(brandSet).sort();

        return { flavors, brands };
    } catch (e: any) {
        console.error('Error fetching flavors from database:', e);
        return { flavors: [], brands: [] };
    }
};

interface SaveResult {
    success: boolean;
    message: string;
    normalizedFlavors?: Flavor[];
}

// 1. Save ONLY Custom Flavors (не глобальные!)
export const saveFlavorsAndBrands = async (flavors: Flavor[], brands: string[], venueId?: string | null): Promise<SaveResult> => {
    if (!venueId) {
        return { success: false, message: 'Не выбрано заведение' };
    }

    // Filter ONLY custom flavors (explicit source='custom')
    // Flavors without source field are treated as global (don't save them)
    const customFlavorsOnly = flavors.filter((f: any) => f.source === 'custom');
    
    console.log('[saveFlavorsAndBrands] Total flavors:', flavors.length, 'Custom only:', customFlavorsOnly.length);

    const validBrands = brands.filter(b => b && b.trim() !== "");

    try {
        const normalizedFlavors: Flavor[] = customFlavorsOnly.map(f => ({
            ...f,
            id: f.id && String(f.id).trim() !== '' ? String(f.id).trim() : generateUuid(),
            name: String(f.name || '').trim(),
            brand: String(f.brand || '').trim(),
            description: String(f.description || '').trim(),
            color: String(f.color || '#cccccc').trim(),
            isAvailable: f.isAvailable !== false
        }));

        await apiFetch('/flavors', {
            method: 'PUT',
            body: JSON.stringify({
                venueId,
                flavors: normalizedFlavors.map(f => ({
                    id: f.id,
                    venue_id: venueId,
                    name: f.name,
                    brand: f.brand,
                    description: f.description,
                    color: f.color,
                    is_available: f.isAvailable
                })),
                brands: validBrands.map(name => ({ name, venue_id: venueId })),
            }),
        });

        return { success: true, message: 'Данные сохранены в базе', normalizedFlavors };
    } catch (error: any) {
        console.error('Failed to save flavors to database', error);
        return { success: false, message: error?.message || 'Не удалось сохранить данные' };
    }
};

// Update visibility for global flavors
export const updateFlavorVisibility = async (venueId: string, flavorId: string, isVisible: boolean, source: string): Promise<SaveResult> => {
    if (!venueId) {
        return { success: false, message: 'Не выбрано заведение' };
    }

    try {
        await apiFetch(`/venues/${encodeURIComponent(venueId)}/flavors/visibility`, {
            method: 'POST',
            body: JSON.stringify({
                updates: [{ flavorId, isVisible, source }]
            }),
        });

        return { success: true, message: 'Видимость обновлена' };
    } catch (error: any) {
        console.error('Failed to update flavor visibility', error);
        return { success: false, message: error?.message || 'Не удалось обновить видимость' };
    }
};

// 2. Save ONLY PIN
export const saveGlobalPin = async (pin: string, venueId?: string | null): Promise<SaveResult> => {
    if (!venueId) {
        return { success: false, message: 'Не выбрано заведение' };
    }

    try {
        await apiFetch('/pin', { method: 'POST', body: JSON.stringify({ venueId, pin }) });
        return { success: true, message: 'Пин сохранён в базе' };
    } catch (error: any) {
        console.error('Failed to save pin', error);
        return { success: false, message: error?.message || 'Не удалось сохранить ПИН' };
    }
};

export const verifyAdminPin = async (pin: string, venueId?: string | null): Promise<boolean> => {
    if (!venueId || !pin) return false;

    try {
        const { valid } = await apiFetch<{ valid: boolean }>(`/pin/verify`, {
            method: 'POST',
            body: JSON.stringify({ venueId, pin }),
        });

        return Boolean(valid);
    } catch (e) {
        console.error('Failed to verify pin', e);
        return false;
    }
};

export const updateAdminPin = async (currentPin: string, newPin: string, venueId?: string | null): Promise<SaveResult> => {
    if (!venueId) {
        return { success: false, message: 'Не выбрано заведение' };
    }

    try {
        const { success, message } = await apiFetch<{ success: boolean; message?: string }>('/pin/update', {
            method: 'POST',
            body: JSON.stringify({ venueId, currentPin, newPin }),
        });

        if (!success) {
            return { success: false, message: message || 'Текущий ПИН неверный' };
        }

        return { success: true, message: 'ПИН обновлен' };
    } catch (e: any) {
        console.error('Failed to update pin', e);
        return { success: false, message: e?.message || 'Не удалось обновить ПИН' };
    }
};

/**
 * HISTORY MANAGEMENT (Local User Storage)
 */

const mapDbMixToSavedMix = (row: any): SavedMix => ({
  id: String(row.id ?? generateUuid()),
  userId: Number(row.user_id ?? row.userId),
  timestamp: row.created_at ? Date.parse(row.created_at) : row.timestamp ?? Date.now(),
  ingredients: row.ingredients ?? [],
  name: row.name ?? 'Микс без названия',
  isFavorite: Boolean(row.is_favorite ?? row.isFavorite),
  venue: row.venue_snapshot ?? null,
});

export const saveMixToHistory = async (
  userId: number,
  ingredients: MixIngredient[],
  name: string,
  venue?: Venue | null,
): Promise<SavedMix> => {
  const sanitizedIngredients: MixIngredient[] = ingredients.map(({ isMissing, ...rest }) => ({ ...rest }));

  try {
    const data = await apiFetch<any>('/mixes', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        name: name || 'Мой микс',
        ingredients: sanitizedIngredients,
        venue_snapshot: venue ?? null,
      }),
    });

    if (data) return mapDbMixToSavedMix(data);
  } catch (e) {
    console.error('Failed to persist mix in database', e);
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const allMixes: SavedMix[] = raw ? JSON.parse(raw) : [];

    const newMix: SavedMix = {
      id: generateUuid(),
      userId,
      timestamp: Date.now(),
      ingredients: sanitizedIngredients,
      name: name || 'Мой микс',
      isFavorite: false,
      venue,
    };

    const updatedHistory = [newMix, ...allMixes];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
    return newMix;
  } catch (e) {
    console.error('Error saving mix locally:', e);
    return {
      id: generateUuid(),
      userId,
      timestamp: Date.now(),
      ingredients: sanitizedIngredients,
      name: name || 'Мой микс',
      isFavorite: false,
      venue,
    };
  }
};

export const getHistory = async (userId: number): Promise<SavedMix[]> => {
  try {
    const data = await apiFetch<any[]>(`/mixes?userId=${encodeURIComponent(userId)}`);
    if (data) return data.map(mapDbMixToSavedMix);
  } catch (e) {
    console.error('Failed to load mixes from database', e);
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const allMixes: SavedMix[] = JSON.parse(raw);
    return allMixes.filter(m => m.userId === userId);
  } catch (e) {
    return [];
  }
};

export const toggleFavoriteMix = async (
  mixId: string,
  nextValue: boolean,
  userId?: number,
): Promise<SavedMix[]> => {
  if (userId) {
    try {
      await apiFetch(`/mixes/${encodeURIComponent(mixId)}/favorite`, {
        method: 'POST',
        body: JSON.stringify({ value: nextValue, userId }),
      });
    } catch (e) {
      console.error('Failed to toggle favorite in database', e);
    }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    let allMixes: SavedMix[] = JSON.parse(raw);
    allMixes = allMixes.map(m => (m.id === mixId ? { ...m, isFavorite: nextValue } : m));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allMixes));
    return allMixes;
  } catch (e) {
    return [];
  }
};

export const deleteMix = async (mixId: string, userId?: number): Promise<SavedMix[]> => {
  if (userId) {
    try {
      await apiFetch(`/mixes/${encodeURIComponent(mixId)}`, {
        method: 'DELETE',
        body: JSON.stringify({ userId }),
      });
    } catch (e) {
      console.error('Failed to delete mix in database', e);
    }
  }

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