import React, { useState, useMemo, useEffect } from 'react';
import { Plus, RotateCcw, Leaf, Lock, UserCircle, Save, Eye, Cloud, Wifi } from 'lucide-react';
import { Flavor, MixIngredient, TelegramUser, SavedMix, AiAnalysisResult } from './types';
import { MAX_BOWL_SIZE } from './constants';
import { getTelegramUser } from './services/telegramService';
import { 
  saveMixToHistory, 
  getStoredFlavorsLocal, 
  fetchFlavors,
  saveStoredFlavors, 
  resetStoredFlavors,
  getCloudId 
} from './services/storageService';
import BowlChart from './components/BowlChart';
import FlavorSelector from './components/FlavorSelector';
import MixControls from './components/MixControls';
import AiAssistant from './components/AiAssistant';
import AdminPanel from './components/AdminPanel';
import MasterMode from './components/MasterMode';
import HistoryPanel from './components/HistoryPanel';

const App: React.FC = () => {
  // User State
  const [user, setUser] = useState<TelegramUser | null>(null);
  
  // App State
  // Initialize from local cache for instant render
  const [allFlavors, setAllFlavors] = useState<Flavor[]>(() => getStoredFlavorsLocal());
  const [mix, setMix] = useState<MixIngredient[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysisResult | null>(null);
  const [isCloudConnected, setIsCloudConnected] = useState(false);

  // UI State
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isMasterModeOpen, setIsMasterModeOpen] = useState(false);
  
  // Admin/Secret State
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [secretClicks, setSecretClicks] = useState(0);
  const [showPinPad, setShowPinPad] = useState(false);
  const [pinInput, setPinInput] = useState('');

  // Initialization
  useEffect(() => {
    const tgUser = getTelegramUser();
    setUser(tgUser);
    setIsCloudConnected(!!getCloudId());

    // Initial Fetch (Refresh from cloud if available)
    const loadData = async () => {
        const flavors = await fetchFlavors();
        setAllFlavors(flavors);
    };
    loadData();

    // POLLING: Check for global updates every 10 seconds if cloud is active
    const intervalId = setInterval(async () => {
        if (getCloudId()) {
            const flavors = await fetchFlavors();
            // Only update if deep comparison needed? React state setter handles ref equality usually,
            // but here we just set it. Optimally check if changed, but for this size it's fine.
            setAllFlavors(flavors);
            setIsCloudConnected(true);
        }
    }, 10000);

    return () => clearInterval(intervalId);
  }, []);

  // Filtered available flavors for the selector
  const availableFlavors = useMemo(() => {
    return allFlavors.filter(f => f.isAvailable);
  }, [allFlavors]);

  // Calculate total weight
  const totalWeight = useMemo(() => {
    return mix.reduce((acc, curr) => acc + curr.grams, 0);
  }, [mix]);

  // SECRET TRIGGER LOGIC
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (secretClicks > 0) {
      // Reset clicks if user stops clicking for 1 second
      timer = setTimeout(() => setSecretClicks(0), 800);
    }
    if (secretClicks >= 7) {
      setShowPinPad(true);
      setSecretClicks(0);
    }
    return () => clearTimeout(timer);
  }, [secretClicks]);

  const handleSecretClick = () => {
    setSecretClicks(prev => prev + 1);
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === '0000') {
        setIsAdminOpen(true);
        setShowPinPad(false);
        setPinInput('');
    } else {
        alert("Неверный код");
        setPinInput('');
        setShowPinPad(false);
    }
  };

  // --- Flavor Management ---

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
        setAiAnalysis(null);
    }
  };

  // --- History & Actions ---

  const handleSaveMix = () => {
    if (!user || mix.length === 0) return;
    saveMixToHistory(user.id, mix, aiAnalysis || undefined);
    alert("Микс сохранен в историю!");
  };

  const handleShowMaster = () => {
    if (mix.length === 0) return;
    // Auto-save when showing to master if not empty
    if (user) {
        saveMixToHistory(user.id, mix, aiAnalysis || undefined);
    }
    setIsMasterModeOpen(true);
  };

  const handleLoadFromHistory = (savedMix: SavedMix) => {
    setMix(savedMix.ingredients);
    if (savedMix.aiAnalysis) {
        setAiAnalysis(savedMix.aiAnalysis);
    } else {
        setAiAnalysis(null);
    }
    setIsHistoryOpen(false);
  };

  // --- Admin Actions ---
  const handleUpdateFlavor = async (updatedFlavor: Flavor) => {
    const newList = allFlavors.map(f => f.id === updatedFlavor.id ? updatedFlavor : f);
    setAllFlavors(newList); // Optimistic UI
    await saveStoredFlavors(newList);
  };

  const handleAddFlavor = async (newFlavor: Flavor) => {
    const newList = [newFlavor, ...allFlavors];
    setAllFlavors(newList); // Optimistic UI
    await saveStoredFlavors(newList);
  };

  const handleResetFlavors = async () => {
    if (window.confirm("Сбросить меню вкусов к стандартному набору? Это удалит созданные вкусы глобально.")) {
        const defaults = await resetStoredFlavors();
        setAllFlavors(defaults);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 pb-24 font-sans selection:bg-emerald-500 selection:text-white">
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-lg mx-auto px-4 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer select-none active:scale-95 transition-transform"
            onClick={handleSecretClick}
          >
             <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-900/20 relative">
               <Leaf size={18} fill="currentColor" className="text-white/90" />
               {isCloudConnected && (
                 <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-slate-950" title="Облако подключено"></span>
               )}
             </div>
             <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 hidden sm:block">
               Кальянный<span className="text-emerald-400">Алхимик</span>
             </h1>
          </div>
          
          <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsHistoryOpen(true)}
                className="p-2 bg-slate-900 text-emerald-400 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2"
              >
                <UserCircle size={20} />
                <span className="text-xs font-bold hidden sm:block">{user?.first_name}</span>
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
        
        {/* Bowl Visualization */}
        <section className="mb-8 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none"></div>
            <BowlChart mix={mix} totalWeight={totalWeight} />
        </section>

        {/* Action Area */}
        <div className="flex justify-between items-end mb-4 px-1">
            <div>
                <h2 className="text-lg font-semibold text-white">Ингредиенты</h2>
                <div className="flex items-center gap-2">
                    <p className="text-xs text-slate-400">
                    {totalWeight === MAX_BOWL_SIZE ? 'Чаша полна' : `осталось ${MAX_BOWL_SIZE - totalWeight}г`}
                    </p>
                    {isCloudConnected && (
                        <span className="flex items-center gap-1 text-[10px] text-blue-400 bg-blue-900/20 px-1.5 py-0.5 rounded border border-blue-500/20">
                            <Wifi size={10} />
                            ONLINE
                        </span>
                    )}
                </div>
            </div>
            <button
                onClick={() => setIsSelectorOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-lg bg-emerald-600 hover:bg-emerald-500 text-white hover:shadow-emerald-500/20 hover:-translate-y-0.5 active:translate-y-0"
            >
                <Plus size={16} />
                Добавить
            </button>
        </div>

        {/* List Controls */}
        <section className="space-y-6">
            <MixControls 
                mix={mix}
                onUpdateGrams={updateGrams}
                onRemove={removeFlavor}
                totalWeight={totalWeight}
            />
        </section>

        {/* AI Section */}
        <AiAssistant mix={mix} onAnalysisComplete={setAiAnalysis} />

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
            aiAnalysis={aiAnalysis}
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
      />

      {/* Secret PIN Modal */}
      {showPinPad && (
        <div className="fixed inset-0 z-[90] bg-black/90 flex items-center justify-center p-4">
            <form onSubmit={handlePinSubmit} className="bg-slate-900 p-6 rounded-2xl border border-slate-700 shadow-2xl w-64 text-center">
                <Lock className="mx-auto text-emerald-500 mb-4" size={32} />
                <p className="text-white mb-4 font-bold">Доступ администратора</p>
                <input 
                    autoFocus
                    type="password" 
                    maxLength={4}
                    placeholder="PIN" 
                    className="w-full bg-slate-800 text-center text-2xl tracking-widest py-2 rounded-lg text-white mb-4 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                />
                <div className="flex gap-2">
                    <button type="button" onClick={() => setShowPinPad(false)} className="flex-1 py-2 bg-slate-800 text-slate-400 rounded-lg">Отмена</button>
                    <button type="submit" className="flex-1 py-2 bg-emerald-600 text-white rounded-lg font-bold">Вход</button>
                </div>
            </form>
        </div>
      )}

    </div>
  );
};

export default App;