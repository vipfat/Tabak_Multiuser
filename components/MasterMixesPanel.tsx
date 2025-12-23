import React, { useState, useEffect } from 'react';
import { SavedMix, Venue, MixIngredient } from '../types';
import { X, ArrowRightCircle, Loader2, Star, ChefHat, Info } from 'lucide-react';
import { apiFetch } from '../services/apiClient';

interface MasterMixesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadMix: (mix: SavedMix) => void;
  currentVenue: Venue | null;
}

const MasterMixesPanel: React.FC<MasterMixesPanelProps> = ({
  isOpen,
  onClose,
  onLoadMix,
  currentVenue,
}) => {
  const [masterMixes, setMasterMixes] = useState<SavedMix[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && currentVenue?.id) {
      loadMasterMixes();
    }
  }, [isOpen, currentVenue?.id]);

  const loadMasterMixes = async () => {
    if (!currentVenue?.id) return;

    setIsLoading(true);
    setError('');

    try {
      const data = await apiFetch<any[]>(`/venues/${currentVenue.id}/master-mixes`);
      
      // Transform to SavedMix format
      const mixes: SavedMix[] = data.map((mix) => ({
        id: mix.id,
        userId: 0, // Master mixes don't have user_id
        timestamp: Date.parse(mix.created_at),
        ingredients: mix.ingredients || [],
        name: mix.name || 'Микс от мастера',
        isFavorite: false,
        venue: mix.venue_snapshot || currentVenue,
      }));

      setMasterMixes(mixes);
    } catch (err: any) {
      console.error('Failed to load master mixes:', err);
      setError(err.message || 'Не удалось загрузить миксы от мастеров');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMix = (mix: SavedMix) => {
    onLoadMix(mix);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-slate-950 h-full shadow-2xl flex flex-col border-l border-slate-800 animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-gradient-to-r from-emerald-900/40 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center">
              <ChefHat size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Миксы от мастеров</h2>
              <p className="text-xs text-emerald-400">{currentVenue?.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Info Banner */}
        <div className="p-4 bg-emerald-900/20 border-b border-emerald-900/30">
          <div className="flex items-start gap-3">
            <Info size={18} className="text-emerald-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-emerald-300 font-semibold mb-1">Профессиональные рецепты</p>
              <p className="text-xs text-slate-400">
                Наши кальянщики создали эти миксы специально для вас. 
                Попробуйте готовые сочетания или используйте их как основу для экспериментов!
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-slate-500 gap-2">
              <Loader2 className="animate-spin" size={20} />
              <span className="text-sm">Загружаем миксы от мастеров...</span>
            </div>
          ) : error ? (
            <div className="text-center py-10">
              <div className="mb-4 text-red-400 bg-red-900/20 border border-red-800 rounded-lg p-4">
                <p className="text-sm font-semibold mb-1">Ошибка загрузки</p>
                <p className="text-xs">{error}</p>
              </div>
              <button
                onClick={loadMasterMixes}
                className="text-sm text-emerald-400 hover:text-emerald-300 underline"
              >
                Попробовать снова
              </button>
            </div>
          ) : masterMixes.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <ChefHat className="mx-auto mb-3 opacity-30" size={48} />
              <p className="text-sm font-semibold mb-1">Пока нет миксов от мастеров</p>
              <p className="text-xs">
                Наши кальянщики скоро добавят свои любимые рецепты!
              </p>
            </div>
          ) : (
            masterMixes.map((mix) => (
              <MasterMixCard
                key={mix.id}
                mix={mix}
                onLoad={() => handleLoadMix(mix)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

interface MasterMixCardProps {
  mix: SavedMix;
  onLoad: () => void;
}

const MasterMixCard: React.FC<MasterMixCardProps> = ({ mix, onLoad }) => {
  const totalGrams = mix.ingredients.reduce((sum, ing) => sum + ing.grams, 0);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 hover:border-emerald-600/50 transition-all overflow-hidden group">
      {/* Header */}
      <div className="p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Star size={14} className="text-emerald-400" fill="currentColor" />
              <h3 className="text-base font-bold text-white line-clamp-1">
                {mix.name}
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              {new Date(mix.timestamp).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-emerald-400">{totalGrams}г</div>
            <div className="text-xs text-slate-500">{mix.ingredients.length} вкусов</div>
          </div>
        </div>

        {/* Preview (first 3 ingredients) */}
        {!expanded && (
          <div className="flex flex-wrap gap-2 mb-3">
            {mix.ingredients.slice(0, 3).map((ing, idx) => (
              <div
                key={idx}
                className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-800 rounded-md text-xs"
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: ing.color }}
                />
                <span className="text-slate-300 font-medium">{ing.name}</span>
                <span className="text-slate-500">{ing.grams}г</span>
              </div>
            ))}
            {mix.ingredients.length > 3 && (
              <div className="inline-flex items-center px-2 py-1 text-xs text-slate-400">
                +{mix.ingredients.length - 3} ещё
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expanded Ingredients */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-800 pt-3 space-y-2">
          {mix.ingredients.map((ing, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 p-2 bg-slate-800/50 rounded-lg"
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: ing.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{ing.name}</p>
                <p className="text-xs text-slate-500">{ing.brand}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-emerald-400">{ing.grams}г</p>
                <p className="text-xs text-slate-500">
                  {((ing.grams / totalGrams) * 100).toFixed(0)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Button */}
      <div className="px-4 pb-4">
        <button
          onClick={onLoad}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-all group-hover:shadow-lg group-hover:shadow-emerald-900/20"
        >
          <ArrowRightCircle size={18} />
          Загрузить в чашу
        </button>
      </div>
    </div>
  );
};

export default MasterMixesPanel;
