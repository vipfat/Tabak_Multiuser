import React from 'react';
import { Loader2, RefreshCcw, MapPin, Building2, X } from 'lucide-react';
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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[95] bg-slate-950 text-white flex flex-col items-center justify-center px-4 py-6 overflow-y-auto">
      <div className="w-full max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-emerald-400 font-semibold">Шаг 1</p>
            <h1 className="text-3xl font-extrabold mt-1">Выбрать место</h1>
            <p className="text-slate-400 text-sm mt-2 max-w-xl">
              Пожалуйста, выберите заведение, чтобы загрузить его вкусы и настройки. Вы всегда можете вернуться к этому экрану в верхнем меню.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold border border-slate-700 transition-colors"
            >
              <RefreshCcw size={16} />
              Обновить
            </button>

            {allowClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400"
                aria-label="Закрыть выбор заведения"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Loader2 className="animate-spin text-emerald-400 mb-3" size={32} />
              <p>Загружаем список заведений...</p>
            </div>
          ) : error ? (
            <div className="bg-red-900/30 border border-red-700 text-red-200 rounded-xl p-4 text-center">
              <p className="font-semibold mb-2">Не удалось загрузить список заведений.</p>
              <p className="text-sm text-red-100/80">{error}</p>
            </div>
          ) : venues.length === 0 ? (
            <div className="text-center text-slate-400 py-10">Нет доступных заведений.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {venues.map((venue) => (
                <button
                  key={venue.id}
                  onClick={() => onSelect(venue)}
                  className={`group relative w-full text-left bg-slate-900 border rounded-2xl p-4 transition-all hover:-translate-y-1 shadow-lg hover:shadow-emerald-500/10 ${
                    selectedVenueId === venue.id
                      ? 'border-emerald-500/70 ring-2 ring-emerald-500/30'
                      : 'border-slate-800 hover:border-emerald-600/60'
                  }`}
                >
                  {venue.subscriptionUntil && (
                    <span className="absolute top-3 right-3 text-[10px] uppercase tracking-wide bg-emerald-500/20 text-emerald-200 px-2 py-1 rounded-full border border-emerald-500/30">
                      до {venue.subscriptionUntil}
                    </span>
                  )}

                  <div className="aspect-square rounded-xl bg-slate-800/70 border border-slate-700 flex items-center justify-center overflow-hidden mb-4">
                    {venue.logo ? (
                      <img
                        src={venue.logo}
                        alt={venue.title}
                        className="w-full h-full object-cover transition duration-200 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <Building2 className="text-slate-500" size={38} />
                    )}
                  </div>

                  <h3 className="text-lg font-bold leading-tight">{venue.title}</h3>
                  <div className="flex items-center gap-2 text-sm text-slate-400 mt-2">
                    <MapPin size={14} />
                    <span>{venue.city || 'Город не указан'}</span>
                  </div>

                  <p className="mt-3 text-xs text-slate-500">Кликните, чтобы загрузить меню и настройки этого места.</p>
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
