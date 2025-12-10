import { Venue } from '../types';
import { getDatabaseClient, isDatabaseConfigured } from './supabaseClient';

const normalizeBool = (value: any, defaultValue = true) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  const str = String(value).trim().toLowerCase();
  if (['false', '0', 'нет', 'no', 'off', 'hidden', 'hide'].includes(str)) return false;
  if (['true', '1', 'yes', 'да', 'on', 'show', 'visible'].includes(str)) return true;
  return defaultValue;
};

const isSubscriptionActive = (dateString: string) => {
  if (!dateString) return true;

  const parsedDate = new Date(dateString);
  if (Number.isNaN(parsedDate.getTime())) return true;

  const endOfDay = new Date(parsedDate);
  endOfDay.setHours(23, 59, 59, 999);

  return endOfDay >= new Date();
};

export const fetchVenues = async (): Promise<Venue[]> => {
  if (!isDatabaseConfigured()) throw new Error('База данных не настроена');

  const client = getDatabaseClient();
  if (!client) throw new Error('База данных не настроена');

  const { data, error } = await client
    .from('venues')
    .select('id,title,city,logo,subscription_until,visible,flavor_schema')
    .order('title', { ascending: true });

  if (error) {
    console.error('Failed to fetch venues', error);
    throw new Error('Не удалось получить список заведений');
  }

  return (data || [])
    .map((v: any) => ({
      id: String(v.id),
      title: String(v.title || 'Без названия').trim(),
      city: String(v.city || 'Город не указан').trim(),
      logo: String(v.logo || '').trim(),
      scriptUrl: String(v.flavor_schema || '').trim(),
      subscriptionUntil: String(v.subscription_until || '').trim(),
      visible: normalizeBool(v.visible, true),
    }))
    .filter((venue: Venue) => venue.visible && isSubscriptionActive(venue.subscriptionUntil));
};

export const upsertVenue = async (venue: Venue) => {
  const client = getDatabaseClient();
  if (!client) throw new Error('База данных не настроена');

  const { error } = await client.from('venues').upsert({
    id: venue.id,
    title: venue.title,
    city: venue.city,
    logo: venue.logo,
    subscription_until: venue.subscriptionUntil,
    visible: venue.visible,
    flavor_schema: venue.scriptUrl,
  });

  if (error) throw error;
};

export const deleteVenue = async (venueId: string) => {
  const client = getDatabaseClient();
  if (!client) throw new Error('База данных не настроена');

  const { error } = await client.from('venues').delete().eq('id', venueId);
  if (error) throw error;
};
