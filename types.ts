

export enum FlavorBrand {
  MUSTHAVE = 'Musthave',
  DARKSIDE = 'Darkside',
  BLACKBURN = 'Blackburn',
  ELEMENT = 'Element',
  TANGIERS = 'Tangiers',
  AL_FAKHER = 'Al Fakher',
  DAILY_HOOKAH = 'Daily Hookah',
  OTHER = 'Другое'
}

export interface Flavor {
  id: string;
  name: string;
  brand: string; // Changed from FlavorBrand to string to allow custom brands
  description: string; // New field for flavor profile
  color: string; // Hex code for UI (still relevant for visualization)
  isAvailable: boolean; // If false, hidden from user selector (stop-list)
}

export interface MixIngredient extends Flavor {
  grams: number;
  isMissing?: boolean; // Flag for ingredients missing from current venue
}

// --- Telegram & History Types ---

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export interface SavedMix {
  id: string;
  userId: number;
  timestamp: number;
  ingredients: MixIngredient[];
  name: string; // User provided name
  isFavorite: boolean;
  venue?: Venue | null;
}

export interface Venue {
  id: string;
  title: string;
  city: string;
  address?: string;
  logo: string;
  scriptUrl: string;
  subscriptionUntil: string;
  visible: boolean;
  slug?: string;
  bowl_capacity?: number;
  allow_brand_mixing?: boolean;
}