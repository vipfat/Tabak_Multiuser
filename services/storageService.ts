import { SavedMix, MixIngredient, Flavor, FlavorBrand, Venue } from '../types';
import { AVAILABLE_FLAVORS } from '../constants';
import { getDatabaseClient, isDatabaseConfigured } from './supabaseClient';

const MIXES_TABLE = 'mixes';
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
    brands: string[];
}

// Fetch flavors and PIN from Supabase
export const fetchFlavors = async (venueId?: string | null): Promise<FetchResult> => {
    if (!venueId || !isDatabaseConfigured()) {
        return { flavors: AVAILABLE_FLAVORS, brands: [] };
    }

    const client = getDatabaseClient();
    if (!client) {
        return { flavors: AVAILABLE_FLAVORS, brands: [] };
    }

    try {
        const [{ data: flavorsData, error: flavorsError }, { data: brandsData, error: brandsError }] = await Promise.all([
            client.from('flavors').select('*').eq('venue_id', venueId).order('name', { ascending: true }),
            client.from('brands').select('name').eq('venue_id', venueId).order('name', { ascending: true })
        ]);

        if (flavorsError) throw flavorsError;
        if (brandsError) throw brandsError;

        const flavors: Flavor[] = (flavorsData || []).map((row: any) => ({
            id: String(row.id || generateUuid()),
            name: String(row.name || 'Без названия').trim(),
            brand: String(row.brand || FlavorBrand.OTHER).trim(),
            description: String(row.description || '').trim(),
            color: String(row.color || '#cccccc').trim(),
            isAvailable: row.is_available !== false,
        }));

        const brands: string[] = (brandsData || []).map((b: any) => String(b.name || '').trim()).filter(Boolean);

        return { flavors, brands };
    } catch (e: any) {
        console.error('Error fetching from database:', e);
        return { flavors: [], brands: [] };
    }
};

interface SaveResult {
    success: boolean;
    message: string;
    normalizedFlavors?: Flavor[];
}

// 1. Save ONLY Flavors and Brands
export const saveFlavorsAndBrands = async (flavors: Flavor[], brands: string[], venueId?: string | null): Promise<SaveResult> => {
    if (!venueId) {
        return { success: false, message: 'Не выбрано заведение' };
    }

    const client = getDatabaseClient();
    if (!client) {
        return { success: false, message: 'База данных не настроена' };
    }

    const validBrands = brands.filter(b => b && b.trim() !== "");

    try {
        // Replace venue flavors and brands with latest snapshot
        const deleteFlavors = client.from('flavors').delete().eq('venue_id', venueId);
        const deleteBrands = client.from('brands').delete().eq('venue_id', venueId);

        await Promise.all([deleteFlavors, deleteBrands]);

        const normalizedFlavors: Flavor[] = flavors.map(f => ({
            ...f,
            id: f.id && String(f.id).trim() !== '' ? String(f.id).trim() : generateUuid(),
            name: String(f.name || '').trim(),
            brand: String(f.brand || '').trim(),
            description: String(f.description || '').trim(),
            color: String(f.color || '#cccccc').trim(),
            isAvailable: f.isAvailable !== false
        }));

        if (normalizedFlavors.length > 0) {
            const { error: flavorsError } = await client.from('flavors').upsert(
                normalizedFlavors.map(f => ({
                    id: f.id,
                    venue_id: venueId,
                    name: f.name,
                    brand: f.brand,
                    description: f.description,
                    color: f.color,
                    is_available: f.isAvailable
                }))
            );

            if (flavorsError) throw flavorsError;
        }

        if (validBrands.length > 0) {
            const { error: brandsError } = await client.from('brands').upsert(
                validBrands.map(name => ({ name, venue_id: venueId }))
            );
            if (brandsError) throw brandsError;
        }

        return { success: true, message: 'Данные сохранены в базе', normalizedFlavors };
    } catch (error: any) {
        console.error('Failed to save flavors to database', error);
        return { success: false, message: error?.message || 'Не удалось сохранить данные' };
    }
};

// 2. Save ONLY PIN
export const saveGlobalPin = async (pin: string, venueId?: string | null): Promise<SaveResult> => {
    if (!venueId) {
        return { success: false, message: 'Не выбрано заведение' };
    }

    const client = getDatabaseClient();
    if (!client) {
        return { success: false, message: 'База данных не настроена' };
    }

    const { error } = await client.from('venues').update({ admin_pin: pin }).eq('id', venueId);

    if (error) {
        console.error('Failed to save pin', error);
        return { success: false, message: error.message };
    }

    return { success: true, message: 'Пин сохранён в базе' };
};

export const verifyAdminPin = async (pin: string, venueId?: string | null): Promise<boolean> => {
    if (!venueId || !pin) return false;
    if (!isDatabaseConfigured()) return pin === '0000';

    const client = getDatabaseClient();
    if (!client) return false;

    try {
        const { data, error } = await client
            .from('venues')
            .select('id')
            .eq('id', venueId)
            .eq('admin_pin', pin)
            .maybeSingle();

        if (error) throw error;

        return Boolean(data?.id);
    } catch (e) {
        console.error('Failed to verify pin', e);
        return false;
    }
};

export const updateAdminPin = async (currentPin: string, newPin: string, venueId?: string | null): Promise<SaveResult> => {
    if (!venueId) {
        return { success: false, message: 'Не выбрано заведение' };
    }

    const client = getDatabaseClient();
    if (!client) {
        return { success: false, message: 'База данных не настроена' };
    }

    try {
        const { data, error } = await client
            .from('venues')
            .update({ admin_pin: newPin })
            .eq('id', venueId)
            .eq('admin_pin', currentPin)
            .select('id')
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            return { success: false, message: 'Текущий ПИН неверный' };
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

  if (isDatabaseConfigured()) {
    const client = getDatabaseClient();
    if (client) {
      try {
        const payload = {
          id: generateUuid(),
          user_id: userId,
          name: name || 'Мой микс',
          ingredients: sanitizedIngredients,
          is_favorite: false,
          venue_snapshot: venue ?? null,
          created_at: new Date().toISOString(),
        };

        const { data, error } = await client
          .from(MIXES_TABLE)
          .upsert(payload)
          .select()
          .maybeSingle();

        if (error) throw error;
        if (data) return mapDbMixToSavedMix(data);
      } catch (e) {
        console.error('Failed to persist mix in database', e);
      }
    }
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
  if (isDatabaseConfigured()) {
    const client = getDatabaseClient();
    if (client) {
      try {
        const { data, error } = await client
          .from(MIXES_TABLE)
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (data) return data.map(mapDbMixToSavedMix);
      } catch (e) {
        console.error('Failed to load mixes from database', e);
      }
    }
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
  if (isDatabaseConfigured()) {
    const client = getDatabaseClient();
    if (client && userId) {
      try {
        const { error } = await client
          .from(MIXES_TABLE)
          .update({ is_favorite: nextValue })
          .eq('id', mixId)
          .eq('user_id', userId);

        if (error) throw error;
      } catch (e) {
        console.error('Failed to toggle favorite in database', e);
      }
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
  if (isDatabaseConfigured()) {
    const client = getDatabaseClient();
    if (client && userId) {
      try {
        const { error } = await client
          .from(MIXES_TABLE)
          .delete()
          .eq('id', mixId)
          .eq('user_id', userId);

        if (error) throw error;
      } catch (e) {
        console.error('Failed to delete mix in database', e);
      }
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