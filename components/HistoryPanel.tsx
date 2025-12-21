import React, { useState, useEffect } from 'react';
import { TelegramUser, SavedMix, Venue } from '../types';
import { X, Heart, Clock, Trash2, ArrowRightCircle, Search, MapPin, LogOut, Loader2 } from 'lucide-react';
import { getHistory, toggleFavoriteMix, deleteMix } from '../services/storageService';
import TelegramAuthCard from './TelegramAuthCard';

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  user: TelegramUser | null;
  onLoadMix: (mix: SavedMix) => void;
  onAuthSuccess: (user: TelegramUser) => void;
  onAuthError: (error: string) => void;
  authError: string;
  onLogout: () => void;
  currentVenue: Venue | null;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({
  isOpen,
  onClose,
  user,
  onLoadMix,
  onAuthSuccess,
  onAuthError,
  authError,
  onLogout,
  currentVenue,
}) => {
  const [activeTab, setActiveTab] = useState<'history' | 'favorites'>('history');
  const [mixes, setMixes] = useState<SavedMix[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && user?.id) {
      refreshData();
    }
  }, [isOpen, user?.id]);

  useEffect(() => {
    if (!user) {
      setMixes([]);
    }
  }, [user]);

  const refreshData = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    const data = await getHistory(user.id);
    data.sort((a, b) => b.timestamp - a.timestamp);
    setMixes(data);
    setIsLoading(false);
  };

  const handleToggleFavorite = async (mixId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const targetMix = mixes.find(m => m.id === mixId);
    if (!targetMix) return;
    const nextValue = !targetMix.isFavorite;

    setMixes(prev => prev.map(m => (m.id === mixId ? { ...m, isFavorite: nextValue } : m)));

    await toggleFavoriteMix(mixId, nextValue, user?.id);
  };

  const handleDelete = async (mixId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // Optimistic update
    setMixes(prev => prev.filter(m => m.id !== mixId));

    await deleteMix(mixId, user?.id);
  };

  if (!isOpen) return null;

  // Filter mixes by current venue if venue is selected
  const venueFilteredMixes = currentVenue
    ? mixes.filter(m => m.venue?.id === currentVenue.id)
    : mixes;

  const displayedMixes = activeTab === 'history'
    ? venueFilteredMixes
    : venueFilteredMixes.filter(m => m.isFavorite);

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-slate-950 h-full shadow-2xl flex flex-col border-l border-slate-800 animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900">
          <h2 className="text-xl font-bold text-white">Мои миксы</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {!user ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            <p className="text-sm font-semibold text-white">Войдите через Telegram</p>
            <p className="text-xs text-slate-400">История и любимые миксы сохраняются в вашем аккаунте и синхронизируются между устройствами.</p>
            <TelegramAuthCard onSuccess={onAuthSuccess} onError={onAuthError} />
            {authError && (
              <div className="text-xs text-red-400 bg-red-900/30 border border-red-800 rounded-lg p-3">{authError}</div>
            )}
          </div>
        ) : (
          <>
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Вы вошли как</p>
                <p className="text-sm font-semibold text-white">{user.first_name} {user.last_name}</p>
                {user.username && <p className="text-xs text-slate-500">@{user.username}</p>}
              </div>
              <button
                onClick={onLogout}
                className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-red-300 bg-slate-800 px-3 py-2 rounded-lg"
              >
                <LogOut size={16} /> Выйти
              </button>
            </div>

            {/* Tabs */}
            <div className="flex p-2 gap-2 bg-slate-900 border-b border-slate-800">
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${activeTab === 'history' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-800/50'}`}
              >
                <Clock size={16} /> История
              </button>
              <button
                onClick={() => setActiveTab('favorites')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${activeTab === 'favorites' ? 'bg-red-900/20 text-red-400' : 'text-slate-500 hover:bg-slate-800/50'}`}
              >
                <Heart size={16} fill={activeTab === 'favorites' ? "currentColor" : "none"} /> Любимые
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-10 text-slate-500 gap-2">
                  <Loader2 className="animate-spin" size={20} />
                  <span className="text-sm">Загружаем ваши миксы...</span>
                </div>
              ) : displayedMixes.length === 0 ? (
                <div className="text-center py-10 text-slate-500">
                  <Search className="mx-auto mb-2 opacity-50" size={32} />
                  <p>{activeTab === 'history' ? 'История пуста' : 'Нет любимых миксов'}</p>
                </div>
              ) : (
                displayedMixes.map(mix => (
                  <div
                    key={mix.id}
                    onClick={() => onLoadMix(mix)}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-emerald-500/50 transition-all cursor-pointer group relative"
                  >
                     <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 pr-4">
                            <h3 className="font-bold text-white text-lg line-clamp-1">
                                {mix.name || 'Микс без названия'}
                            </h3>
                            <span className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                                {new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(mix.timestamp)}
                                {mix.venue ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-800 px-2 py-1 rounded-lg flex-wrap">
                                    <MapPin size={12} className="text-emerald-400" />
                                    <span className="font-semibold text-slate-200">{mix.venue.title}</span>
                                    <span className="text-slate-500">
                                      {mix.venue.city}{mix.venue.address && `, ${mix.venue.address}`}
                                    </span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-900 px-2 py-1 rounded-lg">
                                    <MapPin size={12} className="text-slate-600" />
                                    <span>Заведение не указано</span>
                                  </span>
                                )}
                            </span>
                        </div>
                        <button
                            onClick={(e) => handleToggleFavorite(mix.id, e)}
                            className={`p-2 rounded-full transition-colors relative z-10 ${mix.isFavorite ? 'bg-red-900/20' : 'hover:bg-slate-800'}`}
                        >
                            <Heart size={20} className={mix.isFavorite ? "text-red-500 fill-red-500" : "text-slate-600"} />
                        </button>
                     </div>

                     <div className="flex flex-wrap gap-1 mb-3">
                        {mix.ingredients.map((ing, idx) => (
                            <span key={idx} className="text-xs bg-slate-800 px-2 py-1 rounded-md text-slate-300 border border-slate-700">
                                {ing.name} <span className="text-emerald-500">{ing.grams}г</span>
                            </span>
                        ))}
                     </div>

                     <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-800/50">
                        <button
                            onClick={(e) => handleDelete(mix.id, e)}
                            className="flex items-center gap-1 text-slate-500 hover:text-red-400 p-2 px-3 -ml-2 rounded-lg hover:bg-red-900/10 transition-colors relative z-10 group/delete"
                            title="Удалить"
                        >
                            <Trash2 size={18} className="group-hover/delete:scale-110 transition-transform" />
                            <span className="text-xs">Удалить</span>
                        </button>

                        <span className="text-emerald-500 text-xs font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                            Загрузить в чашу <ArrowRightCircle size={14} />
                        </span>
                     </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default HistoryPanel;