
import { Flavor, FlavorBrand } from './types';

export const MAX_BOWL_SIZE = 18; // Grams

export const AVAILABLE_FLAVORS: Flavor[] = [
  // Musthave
  { 
    id: 'mh1', 
    name: 'Pinkman', 
    brand: FlavorBrand.MUSTHAVE, 
    description: 'Микс розового грейпфрута, клубники и малинового сиропа.', 
    color: '#f472b6', 
    isAvailable: true 
  },
  { 
    id: 'mh2', 
    name: 'Pineapple Rings', 
    brand: FlavorBrand.MUSTHAVE, 
    description: 'Сочные консервированные ананасовые кольца.', 
    color: '#fbbf24', 
    isAvailable: true 
  },
  { 
    id: 'mh3', 
    name: 'Milky Rice', 
    brand: FlavorBrand.MUSTHAVE, 
    description: 'Сладкая рисовая каша на молоке.', 
    color: '#fef3c7', 
    isAvailable: true 
  },

  // Darkside
  { 
    id: 'ds1', 
    name: 'Supernova', 
    brand: FlavorBrand.DARKSIDE, 
    description: 'Экстремальный холод, добавлять осторожно.', 
    color: '#bae6fd', 
    isAvailable: true 
  },
  { 
    id: 'ds2', 
    name: 'Falling Star', 
    brand: FlavorBrand.DARKSIDE, 
    description: 'Манго и маракуйя, классический тропический микс.', 
    color: '#f97316', 
    isAvailable: true 
  },
  { 
    id: 'ds3', 
    name: 'Cola', 
    brand: FlavorBrand.DARKSIDE, 
    description: 'Классический вкус кока-колы с мармеладным оттенком.', 
    color: '#78350f', 
    isAvailable: true 
  },

  // Blackburn
  { 
    id: 'bb1', 
    name: 'Ice Baby', 
    brand: FlavorBrand.BLACKBURN, 
    description: 'Ягодный сорбет с грейпфрутом.', 
    color: '#db2777', 
    isAvailable: true 
  },
  { 
    id: 'bb2', 
    name: 'Lemon Sweets', 
    brand: FlavorBrand.BLACKBURN, 
    description: 'Лимонные леденцы, кисло-сладкий.', 
    color: '#facc15', 
    isAvailable: true 
  },

  // Tangiers
  { 
    id: 'tg1', 
    name: 'Cane Mint', 
    brand: FlavorBrand.TANGIERS, 
    description: 'Мощная тростниковая мята, эталон крепости.', 
    color: '#0f172a', 
    isAvailable: true 
  },
  { 
    id: 'tg2', 
    name: 'Ololiuqui', 
    brand: FlavorBrand.TANGIERS, 
    description: 'Вкус колы с лаймом и нотками мармелада.', 
    color: '#1e293b', 
    isAvailable: true 
  },

  // Daily Hookah
  { 
    id: 'dh1', 
    name: 'Свободная Куба', 
    brand: FlavorBrand.DAILY_HOOKAH, 
    description: 'Кола с лимоном, легкий табак.', 
    color: '#a16207', 
    isAvailable: true 
  },
  { 
    id: 'dh2', 
    name: 'Клубничный Мильфей', 
    brand: FlavorBrand.DAILY_HOOKAH, 
    description: 'Французское слоеное пирожное с ягодами.', 
    color: '#fecdd3', 
    isAvailable: true 
  },
  
  // Al Fakher
  {
    id: 'af1',
    name: 'Двойное Яблоко',
    brand: FlavorBrand.AL_FAKHER,
    description: 'Классический анис с яблоком.',
    color: '#ef4444',
    isAvailable: true
  }
];