
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Plus, RotateCcw, Leaf, Lock, UserCircle, Save, Eye, PenLine, RefreshCcw, Loader2, MapPin } from 'lucide-react';
import { Flavor, MixIngredient, TelegramUser, SavedMix, Venue } from './types';
import { MAX_BOWL_SIZE, AVAILABLE_FLAVORS } from './constants';
import { resolveTelegramUser, startTelegramLogin, logoutTelegramUser } from './services/telegramService';
import { syncTelegramClient } from './services/clientService';
import {
  saveMixToHistory,
  fetchFlavors,
  saveSelectedVenue,
  verifyAdminPin,
  updateAdminPin
} from './services/storageService';
import { fetchVenues } from './services/venueService';
import BowlChart from './components/BowlChart';
import FlavorSelector from './components/FlavorSelector';
import MixControls from './components/MixControls';
import AdminPanel from './components/AdminPanel';
import MasterMode from './components/MasterMode';
import HistoryPanel from './components/HistoryPanel';
import VenueSelector from './components/VenueSelector';

const App: React.FC = () => {
  // User State
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Venue State
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [isVenueSelectorOpen, setIsVenueSelectorOpen] = useState(false);
  const [isVenuesLoading, setIsVenuesLoading] = useState(false);
  const [venuesError, setVenuesError] = useState('');

  // App State
  const [allFlavors, setAllFlavors] = useState<Flavor[]>(AVAILABLE_FLAVORS);
  const [customBrands, setCustomBrands] = useState<string[]>([]);
  const [mix, setMix] = useState<MixIngredient[]>([]);
  const [mixName, setMixName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // UI State
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isMasterModeOpen, setIsMasterModeOpen] = useState(false);
  
  // Admin/Secret State
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [secretClicks, setSecretClicks] = useState(0);
  
  // PIN Pad State
  const [showPinPad, setShowPinPad] = useState(false);
  const [isFetchingPin, setIsFetchingPin] = useState(false);
  const [pinInput, setPinInput] = useState('');

  // PIN Change Logic
  const [lockClickCount, setLockClickCount] = useState(0);
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [changePinStep, setChangePinStep] = useState<'verify' | 'new'>('verify');
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPin, setNewPin] = useState('');
  const [savePinStatus, setSavePinStatus] = useState('');
  const [verifiedPin, setVerifiedPin] = useState('');

  const loadVenues = useCallback(async () => {
    setIsVenuesLoading(true);
    setVenuesError('');
    try {
      const list = await fetchVenues();
      setVenues(list);
    } catch (e: any) {
      setVenuesError(e?.message || 'Неизвестная ошибка');
    } finally {
      setIsVenuesLoading(false);
    }
  }, []);

  const loadData = useCallback(async () => {
      if (!selectedVenue) return;
      setIsLoading(true);
      try {
          const { flavors, brands } = await fetchFlavors(selectedVenue.id);
          if (flavors && flavors.length > 0) {
              setAllFlavors(flavors);
          }
          if (brands && brands.length > 0) {
              setCustomBrands(brands);
          }
      } catch (e) {
          console.error("Failed to load initial data", e);
      } finally {
          setIsLoading(false);
      }
  }, [selectedVenue]);

  // Initialization
  useEffect(() => {
    const init = async () => {
      setIsAuthLoading(true);
      const { user: resolvedUser, error } = await resolveTelegramUser();
      if (error) setAuthError(error);
      if (resolvedUser) setUser(resolvedUser);
      setIsAuthLoading(false);
    };

    init();
    loadVenues();
  }, [loadVenues]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleAuthMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;

      if (data?.source === 'telegram-auth') {
        if (data.user) {
          setUser(data.user);
          setAuthError('');
        }

        if (data.error) {
          setAuthError(data.error);
        }

        setIsAuthLoading(false);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== 'telegram_web_user') return;

      if (event.newValue) {
        try {
          setUser(JSON.parse(event.newValue) as TelegramUser);
        } catch (e) {
          // ignore parsing error
        }
      } else {
        setUser(null);
      }
    };

    window.addEventListener('message', handleAuthMessage);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('message', handleAuthMessage);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const persistClient = async () => {
      if (!user) return;
      const result = await syncTelegramClient(user);
      if (!result.success && !isCancelled) {
        setAuthError(result.error || 'Не удалось сохранить профиль');
      }
    };

    persistClient();

    return () => {
      isCancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!selectedVenue) return;
    loadData();
  }, [loadData, selectedVenue]);

  // Filtered available flavors for the selector
  const availableFlavors = useMemo(() => {
    return allFlavors.filter(f => f.isAvailable);
  }, [allFlavors]);

  // Calculate total weight
  const totalWeight = useMemo(() => {
    return mix.reduce((acc, curr) => acc + curr.grams, 0);
  }, [mix]);

  // SECRET TRIGGER (To open PIN Pad)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (secretClicks > 0) {
      timer = setTimeout(() => setSecretClicks(0), 800);
    }
    if (secretClicks >= 7) {
      handleOpenPinPad();
      setSecretClicks(0);
    }
    return () => clearTimeout(timer);
  }, [secretClicks]);

  // LOCK CLICK (To open Change PIN Mode)
  useEffect(() => {
    if (lockClickCount >= 12) {
        setIsChangingPin(true);
        setChangePinStep('verify');
        setCurrentPinInput('');
        setNewPin('');
        setSavePinStatus('');
        setPinInput('');
        setLockClickCount(0);
    }
  }, [lockClickCount]);

  const handleSecretClick = () => {
    setSecretClicks(prev => prev + 1);
  };

  // Logic: Fetch actual PIN from Cloud first, then allow input
  const handleOpenPinPad = async () => {
      setShowPinPad(true);
      setIsFetchingPin(false);
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsFetchingPin(true);

    const isValid = await verifyAdminPin(pinInput, selectedVenue?.id);

    setIsFetchingPin(false);

    if (isValid) {
      setIsAdminOpen(true);
      setShowPinPad(false);
      setPinInput('');
      setLockClickCount(0);
    } else {
      alert("Неверный код");
      setPinInput('');
    }
  };

  const handleVerifyOldPinSubmit = async (e: React.FormEvent) => {
      e.preventDefault();

      setIsFetchingPin(true);

      const isValid = await verifyAdminPin(currentPinInput, selectedVenue?.id);

      setIsFetchingPin(false);

      if (isValid) {
        setVerifiedPin(currentPinInput);
        setChangePinStep('new');
        setCurrentPinInput('');
        setSavePinStatus('');
      } else {
        alert("Текущий ПИН неверный");
        setCurrentPinInput('');
      }
  };

  const handleChangePinSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (changePinStep !== 'new') {
          return;
      }
      if (!verifiedPin) {
          alert("Сначала подтвердите текущий ПИН");
          return;
      }
      if (newPin.length !== 4) {
          alert("ПИН должен быть 4 цифры");
          return;
      }
      
      setSavePinStatus('Сохранение...');

      const result = await updateAdminPin(verifiedPin, newPin, selectedVenue?.id);

      if (result.success) {
          setSavePinStatus('Сохранено!');
          setTimeout(() => {
              setIsChangingPin(false);
              setChangePinStep('verify');
              setShowPinPad(false);
              setNewPin('');
              setCurrentPinInput('');
              setSavePinStatus('');
              setLockClickCount(0);
              setVerifiedPin('');
          }, 1000);
      } else {
          setSavePinStatus('Ошибка!');
          alert("Не удалось отправить ПИН: " + result.message);
      }
  };

  // --- Flavor Management ---

  const handleSelectVenue = (venue: Venue) => {
    setSelectedVenue(venue);
    saveSelectedVenue(venue);

    setIsVenueSelectorOpen(false);
    setMix([]);
      setMixName('');
      setCustomBrands([]);
      setAllFlavors(AVAILABLE_FLAVORS);
      setIsSelectorOpen(false);
      setIsHistoryOpen(false);
      setIsMasterModeOpen(false);
      setIsAdminOpen(false);
      setVerifiedPin('');
  };

  const toggleFlavor = (flavor: Flavor) => {
    const exists = mix.find(m => m.id === flavor.id);

    if (exists) {
      setMix(mix.filter(m => m.id !== flavor.id));
    } else {
      const currentTotal = mix.reduce((acc, m) => acc + m.grams, 0);
      const remaining = MAX_BOWL_SIZE - currentTotal;
      const initialGrams = remaining >= 1 ? 1 : 0;
      const newIngredient: MixIngredient = { ...flavor, grams: initialGrams };
      setMix([...mix, newIngredient]);
    }
  };

  const removeFlavor = (id: string) => {
    setMix(mix.filter(item => item.id !== id));
  };

  const updateGrams = (id: string, grams: number) => {
    const otherWeight = mix.filter(m => m.id !== id).reduce((acc, c) => acc + c.grams, 0);
    const maxAllowed = MAX_BOWL_SIZE - otherWeight;
    const finalGrams = Math.min(grams, maxAllowed);

    setMix(mix.map(item => 
      item.id === id ? { ...item, grams: finalGrams } : item
    ));
  };

  const clearBowl = () => {
    if(window.confirm("Очистить чашу?")) {
        setMix([]);
        setMixName('');
    }
  };

  // --- History & Actions ---

  const handleSaveMix = async () => {
    if (!user || mix.length === 0) {
        alert('Авторизуйтесь через Telegram, чтобы сохранять миксы');
        return;
    }

    let finalName = mixName.trim();
    if (!finalName) {
        finalName = prompt("Назовите ваш микс:", "Мой вкусный микс") || "Микс без названия";
        setMixName(finalName);
    }

    const sanitizedMix: MixIngredient[] = mix.map(({ isMissing, ...rest }) => ({ ...rest }));

    await saveMixToHistory(user.id, sanitizedMix, finalName, selectedVenue);
    alert("Микс сохранен в историю!");
  };

  const handleShowMaster = async () => {
    if (mix.length === 0) return;
    if (user) {
        const sanitizedMix: MixIngredient[] = mix.map(({ isMissing, ...rest }) => ({ ...rest }));
        await saveMixToHistory(user.id, sanitizedMix, mixName || "Заказ мастеру", selectedVenue);
    }
    setIsMasterModeOpen(true);
  };

  const handleLoadFromHistory = (savedMix: SavedMix) => {
    const mappedIngredients = savedMix.ingredients.map((ing) => {
        const current = allFlavors.find(f => f.id === ing.id);
        if (current) {
            return { ...current, grams: ing.grams, isMissing: !current.isAvailable } as MixIngredient;
        }
        return { ...ing, isAvailable: false, isMissing: true } as MixIngredient;
    });

    setMix(mappedIngredients);
    setMixName(savedMix.name);
    setIsHistoryOpen(false);
  };

  // --- Admin Actions ---
  const handleUpdateFlavor = (updatedFlavor: Flavor) => {
    const newList = allFlavors.map(f => f.id === updatedFlavor.id ? updatedFlavor : f);
    setAllFlavors(newList); 
  };

  const handleAddFlavor = (newFlavor: Flavor) => {
    const newList = [newFlavor, ...allFlavors];
    setAllFlavors(newList); 
  };

  const handleResetFlavors = () => {
    if (window.confirm("Сбросить локальный список?")) {
        setAllFlavors(AVAILABLE_FLAVORS);
    }
  };

  // Handle close on modal click outside
  const handleClosePinPad = () => {
      setShowPinPad(false);
      setPinInput('');
      setLockClickCount(0);
      setIsChangingPin(false);
      setChangePinStep('verify');
      setCurrentPinInput('');
      setNewPin('');
      setIsFetchingPin(false);
      setSavePinStatus('');
      setVerifiedPin('');
  }

  const handleOpenHistory = () => {
    if (!user) {
        startTelegramLogin();
        return;
    }
    setIsHistoryOpen(true);
  };

  const handleLogout = () => {
    logoutTelegramUser();
    setUser(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 pb-28 font-sans selection:bg-emerald-500 selection:text-white">

      <VenueSelector
        venues={venues}
        isOpen={!selectedVenue || isVenueSelectorOpen}
        isLoading={isVenuesLoading}
        error={venuesError}
        selectedVenueId={selectedVenue?.id}
        allowClose={!!selectedVenue}
        onClose={() => setIsVenueSelectorOpen(false)}
        onSelect={handleSelectVenue}
        onRefresh={loadVenues}
      />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-lg mx-auto px-4 h-16 flex items-center justify-between">
          <div
            className="flex items-center gap-2 cursor-pointer select-none active:scale-95 transition-transform"
            onClick={handleSecretClick}
          >
             <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-900/20 relative">
               <Leaf size={18} fill="currentColor" className="text-white/90" />
             </div>
             <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 hidden sm:block">
               Кальянный<span className="text-emerald-400">Алхимик</span>
             </h1>
          </div>
          
          <div className="flex items-center gap-2">
              <button
                onClick={() => setIsVenueSelectorOpen(true)}
                className="p-2 bg-slate-900 text-emerald-400 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2"
              >
                <MapPin size={20} />
                <span className="text-xs font-bold hidden sm:block">{selectedVenue ? selectedVenue.title : 'Выбрать место'}</span>
              </button>
              <button
                onClick={handleOpenHistory}
                className="p-2 bg-slate-900 text-emerald-400 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2"
                disabled={isAuthLoading}
              >
                <UserCircle size={20} />
                <span className="text-xs font-bold hidden sm:block">{user?.first_name || 'Войти'}</span>
              </button>

              <button 
                onClick={clearBowl} 
                disabled={mix.length === 0}
                className="p-2 text-slate-500 hover:text-white disabled:opacity-30 transition-colors"
                aria-label="Очистить чашу"
              >
                <RotateCcw size={20} />
              </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-6">

        {authError && (
          <div className="mb-4 p-3 rounded-lg border border-red-500/50 bg-red-900/10 text-red-200 text-sm">
            {authError}
          </div>
        )}

        {!user && !isAuthLoading && (
          <div className="mb-6 p-4 rounded-xl border border-slate-800 bg-slate-900/80 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-300 font-semibold">Личный кабинет</p>
              <p className="text-xs text-slate-400">Войдите через Telegram, чтобы сохранять историю и любимые миксы в облаке</p>
            </div>
            <button
              onClick={startTelegramLogin}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold transition-colors"
            >
              Войти
            </button>
          </div>
        )}

        {user && (
          <div className="mb-6 p-4 rounded-xl border border-emerald-800/50 bg-emerald-900/10 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-emerald-300 font-semibold">Привет, {user.first_name}!</p>
              <p className="text-xs text-emerald-200/80">История и избранное теперь синхронизируются с вашим аккаунтом</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-colors"
            >
              Выйти
            </button>
          </div>
        )}

        {selectedVenue && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 mb-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center">
                {selectedVenue.logo ? (
                  <img src={selectedVenue.logo} alt={selectedVenue.title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <MapPin className="text-emerald-400" size={22} />
                )}
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400 font-bold">Текущее место</p>
                <p className="text-lg font-bold text-white leading-tight">{selectedVenue.title}</p>
                <p className="text-sm text-slate-400 flex items-center gap-1"><MapPin size={14} />{selectedVenue.city}</p>
              </div>
            </div>
            <button
              onClick={() => setIsVenueSelectorOpen(true)}
              className="px-3 py-2 text-sm font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
            >
              Сменить место
            </button>
          </div>
        )}

        {/* Bowl Visualization */}
        <section className="mb-8 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none"></div>
            <BowlChart mix={mix} totalWeight={totalWeight} />
        </section>

        {/* Action Area */}
        <div className="flex justify-between items-end mb-4 px-1">
            <div>
                <h2 className="text-lg font-semibold text-white">Ингредиенты</h2>
                <p className="text-xs text-slate-400">
                {totalWeight === MAX_BOWL_SIZE ? 'Чаша полна' : `осталось ${MAX_BOWL_SIZE - totalWeight}г`}
                </p>
            </div>
            <button
                onClick={() => setIsSelectorOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-lg bg-emerald-600 hover:bg-emerald-500 text-white hover:shadow-emerald-500/20 hover:-translate-y-0.5 active:translate-y-0"
            >
                <Plus size={16} />
                Добавить
            </button>
        </div>

        {/* Loading State */}
        {isLoading && mix.length === 0 && (
            <div className="bg-slate-900/30 rounded-xl p-4 mb-6 text-center animate-pulse border border-slate-800">
                <p className="text-sm text-slate-500">Загрузка вкусов из облака...</p>
            </div>
        )}

        {/* List Controls */}
        <section className="space-y-6 mb-8">
            <MixControls 
                mix={mix}
                onUpdateGrams={updateGrams}
                onRemove={removeFlavor}
                totalWeight={totalWeight}
            />
        </section>
        
        {/* Mix Naming */}
        {mix.length > 0 && (
            <section className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 mb-6">
                <label className="block text-xs text-slate-500 mb-2 uppercase font-bold tracking-wide">Подпись микса</label>
                <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 border border-slate-700 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all">
                    <PenLine size={16} className="text-slate-400" />
                    <input 
                        type="text"
                        value={mixName}
                        onChange={(e) => setMixName(e.target.value)}
                        placeholder="Придумайте название (например: Ягодный взрыв)"
                        className="w-full bg-transparent py-3 text-white placeholder-slate-500 focus:outline-none text-sm"
                    />
                </div>
            </section>
        )}

        {/* Bottom Action Bar */}
        {mix.length > 0 && (
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-950/90 backdrop-blur-lg border-t border-slate-800 z-30">
                <div className="max-w-lg mx-auto flex gap-3">
                    <button 
                        onClick={handleSaveMix}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                    >
                        <Save size={18} />
                        Сохранить
                    </button>
                    <button 
                        onClick={handleShowMaster}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 transition-all"
                    >
                        <Eye size={18} />
                        Показать мастеру
                    </button>
                </div>
            </div>
        )}

      </main>

      {/* Modal: Flavor Selector */}
      <FlavorSelector 
        isOpen={isSelectorOpen} 
        onClose={() => setIsSelectorOpen(false)}
        onToggle={toggleFlavor}
        currentFlavorIds={mix.map(m => m.id)}
        availableFlavors={availableFlavors}
      />

      {/* History Side Panel */}
      {user && (
        <HistoryPanel 
            isOpen={isHistoryOpen}
            onClose={() => setIsHistoryOpen(false)}
            user={user}
            onLoadMix={handleLoadFromHistory}
        />
      )}

      {/* Master Mode Fullscreen */}
      {user && (
        <MasterMode
            isOpen={isMasterModeOpen}
            onClose={() => setIsMasterModeOpen(false)}
            mix={mix}
            totalWeight={totalWeight}
            user={user}
            mixName={mixName}
            venue={selectedVenue}
        />
      )}

      {/* Admin Panel */}
      <AdminPanel
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        allFlavors={allFlavors}
        onUpdateFlavor={handleUpdateFlavor}
        onAddFlavor={handleAddFlavor}
        onResetFlavors={handleResetFlavors}
        setAllFlavors={setAllFlavors}
        customBrands={customBrands}
        setCustomBrands={setCustomBrands}
        activeVenueId={selectedVenue?.id}
      />

      {/* Secret PIN Modal */}
      {showPinPad && (
        <div className="fixed inset-0 z-[90] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-700 shadow-2xl w-72 text-center relative">
                
                {isFetchingPin ? (
                    <div className="flex flex-col items-center py-6">
                        <Loader2 className="animate-spin text-emerald-500 mb-2" size={32} />
                        <p className="text-slate-400 text-sm">Проверка PIN в облаке...</p>
                    </div>
                ) : !isChangingPin ? (
                    // Standard Login Mode
                    <form onSubmit={handlePinSubmit}>
                        {/* The Secret Lock Button */}
                        <div className="mb-4 flex justify-center">
                            <button 
                                type="button" 
                                onClick={() => setLockClickCount(p => p + 1)}
                                className="active:scale-90 transition-transform p-2 rounded-full hover:bg-slate-800"
                            >
                                <Lock 
                                    className={`${lockClickCount > 0 ? 'text-emerald-400' : 'text-emerald-600'}`} 
                                    size={32} 
                                />
                            </button>
                        </div>
                        
                        <p className="text-white mb-4 font-bold">Доступ администратора</p>
                        
                        <input 
                            autoFocus
                            type="password" 
                            maxLength={4}
                            placeholder="PIN" 
                            className="w-full bg-slate-800 text-center text-2xl tracking-widest py-3 rounded-xl text-white mb-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-slate-700"
                            value={pinInput}
                            onChange={(e) => setPinInput(e.target.value)}
                        />
                        
                        <div className="flex gap-2">
                            <button 
                                type="button" 
                                onClick={handleClosePinPad} 
                                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl transition-colors"
                            >
                                Отмена
                            </button>
                            <button 
                                type="submit" 
                                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-colors"
                            >
                                Вход
                            </button>
                        </div>
                    </form>
                ) : (
                    // Change PIN Mode (Activated after 12 lock clicks)
                    changePinStep === 'verify' ? (
                        <form onSubmit={handleVerifyOldPinSubmit}>
                            <Lock className="mx-auto text-indigo-400 mb-4" size={32} />
                            <p className="text-white mb-2 font-bold">Подтверждение старого PIN</p>
                            <p className="text-xs text-slate-400 mb-4">Перед сменой нужно ввести текущий код.</p>

                            <input
                                autoFocus
                                type="password"
                                maxLength={4}
                                placeholder="Текущий PIN"
                                className="w-full bg-indigo-900/20 text-center text-2xl tracking-widest py-3 rounded-xl text-white mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-indigo-500/30"
                                value={currentPinInput}
                                onChange={(e) => setCurrentPinInput(e.target.value)}
                            />

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleClosePinPad}
                                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl transition-colors"
                                >
                                    Отмена
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-colors"
                                >
                                    Продолжить
                                </button>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={handleChangePinSubmit}>
                            <RefreshCcw className="mx-auto text-indigo-400 mb-4 animate-spin-slow" size={32} />
                            <p className="text-white mb-2 font-bold">Смена Глобального PIN</p>
                            <p className="text-xs text-slate-400 mb-4">Введите новый ПИН после проверки старого.</p>

                            <input
                                autoFocus
                                type="text"
                                pattern="\d*"
                                maxLength={4}
                                placeholder="0000"
                                className="w-full bg-indigo-900/20 text-center text-2xl tracking-widest py-3 rounded-xl text-white mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-indigo-500/30"
                                value={newPin}
                                onChange={(e) => setNewPin(e.target.value)}
                            />

                            {savePinStatus && <p className="text-xs text-indigo-300 mb-2 animate-pulse">{savePinStatus}</p>}

                            <div className="flex gap-2">
                                 <button
                                    type="button"
                                    onClick={handleClosePinPad}
                                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl transition-colors"
                                >
                                    Отмена
                                </button>
                                <button
                                    type="submit"
                                    disabled={!!savePinStatus && savePinStatus !== 'Ошибка!'}
                                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-colors"
                                >
                                    Сохранить
                                </button>
                            </div>
                        </form>
                    )
                )}
            </div>
        </div>
      )}

    </div>
  );
};

export default App;
