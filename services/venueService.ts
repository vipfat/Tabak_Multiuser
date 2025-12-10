import { Venue } from '../types';

const VENUES_FEED_URL =
  'https://script.google.com/macros/s/AKfycbzMObvuHIcjXVQRIZmsXG4h4aHBFqk0_qdBVdt2RRCQEToe90-GxxkhTF9avHkgC3U/exec';

const normalizeBool = (value: any, defaultValue = true) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  const str = String(value).trim().toLowerCase();
  if (['false', '0', 'нет', 'no', 'off', 'hidden', 'hide'].includes(str)) return false;
  if (['true', '1', 'yes', 'да', 'on', 'show', 'visible'].includes(str)) return true;
  return defaultValue;
};

const getProp = (obj: any, keys: string[]) => {
  for (const k of keys) {
    if (obj[k] !== undefined) return obj[k];
  }
  return undefined;
};

export const fetchVenues = async (): Promise<Venue[]> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(VENUES_FEED_URL, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error('Не удалось получить список заведений');
    }

    const text = await response.text();

    // Google script sometimes returns HTML error page
    if (text.trim().startsWith('<')) {
      throw new Error('Получен неверный ответ от скрипта заведений');
    }

    const data = JSON.parse(text);
    const rawVenues = Array.isArray(data) ? data : Array.isArray(data?.venues) ? data.venues : [];

    return rawVenues
      .map((v: any, index: number): Venue => {
        const title = getProp(v, ['title', 'name', 'Заведение', 'place', 'Place']) || `Заведение ${index + 1}`;
        const city = getProp(v, ['city', 'City', 'Город']) || 'Город не указан';
        const logo = getProp(v, ['logo', 'Logo', 'Лого', 'image', 'Image']) || '';
        const scriptUrl =
          getProp(v, ['script', 'Script', 'scriptUrl', 'Скрипт', 'Скрипт Таблица', 'table']) || '';
        const visible = normalizeBool(getProp(v, ['visible', 'Visible', 'Виден', 'show']));
        const subscriptionUntil = getProp(v, ['subscription', 'Subscription', 'Подписка До', 'validUntil']) || '';

        return {
          id: String(index + 1),
          title: String(title).trim(),
          city: String(city).trim(),
          logo: String(logo).trim(),
          scriptUrl: String(scriptUrl).trim(),
          subscriptionUntil: String(subscriptionUntil).trim(),
          visible,
        };
      })
      .filter((venue: Venue) => venue.visible && venue.scriptUrl);
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('Failed to fetch venues', error);
    throw error;
  }
};
