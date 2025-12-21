import React, { useState, useMemo } from 'react';
import { Loader2, RefreshCcw, MapPin, Building2, X, ArrowUpRight, Filter } from 'lucide-react';
import { Venue } from '../types';

interface VenueSelectorProps {
  venues: Venue[];
  isOpen: boolean;
  isLoading: boolean;
  error?: string;
  selectedVenueId?: string;
  allowClose?: boolean;
  onClose: () => void;
  onSelect: (venue: Venue) => void;
  onRefresh: () => void;
}

const VenueSelector: React.FC<VenueSelectorProps> = ({
  venues,
  isOpen,
  isLoading,
  error,
  selectedVenueId,
  onClose,
  onSelect,
  allowClose = false,
  onRefresh,
}) => {
  const [selectedCity, setSelectedCity] = useState<string>('all');

  // Get unique cities
  const cities = useMemo(() => {
    const uniqueCities = Array.from(new Set(venues.map(v => v.city || 'Город не указан')));
    return uniqueCities.sort();
  }, [venues]);

  // Filter venues by city
  const filteredVenues = useMemo(() => {
    if (selectedCity === 'all') return venues;
    return venues.filter(v => (v.city || 'Город не указан') === selectedCity);
  }, [venues, selectedCity]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[95] bg-slate-950 text-white flex flex-col items-center px-4 py-4 sm:py-6 overflow-y-auto">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-xs sm:text-sm uppercase tracking-[0.2em] text-emerald-400 font-semibold">Шаг 1</p>
              <h1 className="text-xl sm:text-3xl font-extrabold mt-1">Выбрать место</h1>
            </div>
            
            {allowClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 flex-shrink-0"
                aria-label="Закрыть выбор заведения"
              >
                <X size={18} />
              </button>
            )}
          </div>

          <p className="text-slate-400 text-xs sm:text-sm mb-3">
            Выберите заведение для загрузки его вкусов и настроек
          </p>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="https://hookahmix.ru"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-emerald-800/60 bg-emerald-500/5 text-xs sm:text-sm font-semibold text-emerald-100 hover:bg-emerald-500/10 hover:border-emerald-600/80 transition-colors"
            >
              <ArrowUpRight size={14} />
              <span className="hidden sm:inline">Подключить своё заведение</span>
              <span className="sm:hidden">Подключить</span>
            </a>

            <button
              onClick={onRefresh}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs sm:text-sm font-semibold border border-slate-700 transition-colors"
            >
              <RefreshCcw size={14} />
              <span className="hidden sm:inline">Обновить</span>
            </button>
          </div>
        </div>

        {/* City Filter */}
        {cities.length > 1 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Filter size={14} className="text-emerald-400" />
              <span className="text-xs sm:text-sm font-semibold text-slate-300">Фильтр по городу</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCity('all')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                  selectedCity === 'all'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Все ({venues.length})
              </button>
              {cities.map(city => (
                <button
                  key={city}
                  onClick={() => setSelectedCity(city)}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                    selectedCity === city
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {city} ({venues.filter(v => (v.city || 'Город не указан') === city).length})
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 sm:p-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Loader2 className="animate-spin text-emerald-400 mb-3" size={32} />
              <p className="text-sm">Загружаем список заведений...</p>
            </div>
          ) : error ? (
            <div className="bg-red-900/30 border border-red-700 text-red-200 rounded-xl p-4 text-center">
              <p className="font-semibold mb-2 text-sm">Не удалось загрузить список заведений.</p>
              <p className="text-xs text-red-100/80">{error}</p>
            </div>
          ) : filteredVenues.length === 0 ? (
            <div className="text-center text-slate-400 py-10 text-sm">
              {selectedCity === 'all' ? 'Нет доступных заведений.' : `Нет заведений в городе ${selectedCity}`}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {filteredVenues.map((venue) => (
                <button
                  key={venue.id}
                  onClick={() => onSelect(venue)}
                  className={`group relative w-full text-left bg-slate-900 border rounded-xl sm:rounded-2xl p-3 sm:p-4 transition-all hover:-translate-y-1 shadow-lg hover:shadow-emerald-500/10 ${
                    selectedVenueId === venue.id
                      ? 'border-emerald-500/70 ring-2 ring-emerald-500/30'
                      : 'border-slate-800 hover:border-emerald-600/60'
                  }`}
                >
                  <div className="aspect-square rounded-lg sm:rounded-xl bg-slate-800/70 border border-slate-700 flex items-center justify-center overflow-hidden mb-2 sm:mb-4">
                    {venue.logo ? (
                      <img
                        src={venue.logo}
                        alt={venue.title}
                        className="w-full h-full object-contain p-2 sm:p-4"
                        loading="lazy"
                      />
                    ) : (
                      <Building2 className="text-slate-500" size={28} />
                    )}
                  </div>

                  <h3 className="text-sm sm:text-lg font-bold leading-tight">{venue.title}</h3>
                  <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-slate-400 mt-1 sm:mt-2">
                    <MapPin size={12} className="flex-shrink-0" />
                    <span className="truncate">{venue.city || 'Город не указан'}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VenueSelector;
