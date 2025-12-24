
import React, { useState, useEffect, useMemo } from 'react';
import { Flavor, FlavorBrand } from '../types';
import { X, Save, Power, Eye, EyeOff, RotateCcw, Cloud, UploadCloud, DownloadCloud, Settings, AlertCircle, CheckCircle2, Trash2, Filter, List, PlusCircle, MapPin, BarChart3, ShoppingCart, ChefHat, Copy, Edit, Loader2 } from 'lucide-react';
import { saveFlavorsAndBrands, fetchFlavors, generateUuid, updateFlavorVisibility } from '../services/storageService';
import { apiFetch } from '../services/apiClient';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  allFlavors: Flavor[];
  onUpdateFlavor: (flavor: Flavor) => void;
  onAddFlavor: (flavor: Flavor) => void;
  onResetFlavors: () => void;
  setAllFlavors?: (f: Flavor[]) => void;
  customBrands?: string[];
  setCustomBrands?: (brands: string[]) => void;
  activeVenueId?: string;
  selectedVenue?: any;
  onUpdateVenue?: (settings: { bowl_capacity: number; allow_brand_mixing: boolean }) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({
    isOpen,
    onClose,
    allFlavors,
    onUpdateFlavor,
    onAddFlavor,
    onResetFlavors,
    setAllFlavors,
    customBrands = [],
    setCustomBrands,
    activeVenueId,
    selectedVenue,
    onUpdateVenue,
}) => {
  const [activeTab, setActiveTab] = useState<'stock' | 'add' | 'brands' | 'settings' | 'statistics' | 'master-mixes'>('stock');
  const [syncStatus, setSyncStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error', msg: string }>({ type: 'idle', msg: '' });
  
  // Stock Tab Filters
  const [filterBrand, setFilterBrand] = useState<string>('Все');

  // Add Flavor State
  const [newName, setNewName] = useState('');
  const [brandSelectValue, setBrandSelectValue] = useState<string>('');
  const [newDescription, setNewDescription] = useState('');
  const [newColor, setNewColor] = useState('#10b981');

  // Brand Management State
  const [newBrandInput, setNewBrandInput] = useState('');
  const [customBrandInput, setCustomBrandInput] = useState('');
  const [useCustomBrand, setUseCustomBrand] = useState(false);

  // Venue Settings State
  const [bowlCapacity, setBowlCapacity] = useState<number>(18);
  const [allowBrandMixing, setAllowBrandMixing] = useState<boolean>(true);
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    if (isOpen) {
        setSyncStatus({ type: 'idle', msg: '' });
        // Load venue settings ONLY when AdminPanel opens
        if (selectedVenue && !hasInitialized) {
          setBowlCapacity(selectedVenue.bowl_capacity ?? 18);
          setAllowBrandMixing(selectedVenue.allow_brand_mixing ?? true);
          setHasInitialized(true);
        }
    } else {
        // Reset when closing
        setHasInitialized(false);
    }
  }, [isOpen]);

  // 1. Brands for FILTERING (Only those that actually have flavors in the list)
  // This ensures no "empty" brands appear in the Stock filter dropdown.
  const presentBrands = useMemo(() => {
    const flavorBrands = Array.from(new Set(allFlavors.map(f => f.brand))).sort();
    return ['Все', ...flavorBrands];
  }, [allFlavors]);

  // 2. Brands for MANAGEMENT & CREATION (Includes custom brands even if empty)
  // This is used for the "Add Flavor" dropdown and "Brands" tab list.
  const uniqueBrands = useMemo(() => {
    const flavorBrands = Array.from(new Set(allFlavors.map(f => f.brand)));
    // Merge with custom brands and deduplicate
    const all = Array.from(new Set([...flavorBrands, ...customBrands])).sort();
    return ['Все', ...all];
  }, [allFlavors, customBrands]);

  // For the dropdown (exclude 'Все' and explicitly exclude 'Другое' if it somehow got in)
  const brandOptions = useMemo(() => {
      return uniqueBrands.filter(b => b !== 'Все' && b !== FlavorBrand.OTHER);
  }, [uniqueBrands]);

  const filteredFlavors = allFlavors.filter(f => filterBrand === 'Все' || f.brand === filterBrand);

  if (!isOpen) return null;

  // --- ACTIONS ---

  const handleToggleFlavorVisibility = async (flavor: Flavor) => {
    if (!activeVenueId) return;
    
    const newAvailability = !flavor.isAvailable;
    
    // Update local state immediately
    onUpdateFlavor({ ...flavor, isAvailable: newAvailability });
    
    try {
      // Use visibility endpoint for both global AND custom flavors
      await updateFlavorVisibility(
        activeVenueId, 
        flavor.id, 
        newAvailability, 
        flavor.source || 'custom'
      );
    } catch (error) {
      console.error('Failed to update flavor visibility:', error);
      // Revert local state on error
      onUpdateFlavor({ ...flavor, isAvailable: flavor.isAvailable });
      alert('Ошибка при изменении видимости: ' + (error as any)?.message);
    }
  };

  const handleAddFlavorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;

    // Use custom brand if checkbox is checked, otherwise use selected brand
    const finalBrand = useCustomBrand ? customBrandInput.trim() : brandSelectValue;

    if (!finalBrand || finalBrand === FlavorBrand.OTHER) {
        alert(useCustomBrand ? "Введите название бренда" : "Пожалуйста, выберите бренд из списка");
        return;
    }

    // If using custom brand, add it to brands list
    if (useCustomBrand && customBrandInput.trim() && !brandOptions.includes(customBrandInput.trim())) {
        if (setCustomBrands) {
            setCustomBrands([...customBrands, customBrandInput.trim()]);
        }
    }

    const newFlavor: Flavor = {
      id: generateUuid(),
      name: newName,
      brand: finalBrand,
      description: newDescription,
      color: newColor,
      isAvailable: true,
      source: 'custom'
    };

    // Add to local state first
    onAddFlavor(newFlavor);

    if (activeVenueId) {
        try {
            setSyncStatus({ type: 'loading', msg: 'Сохранение нового вкуса...' });
            
            // Get all custom flavors (filter out global and flavors without source)
            const customFlavorsOnly = allFlavors.filter((f: any) => f.source === 'custom');
            const updatedCustomFlavors = [newFlavor, ...customFlavorsOnly];
            
            const result = await saveFlavorsAndBrands(updatedCustomFlavors, customBrands, activeVenueId);

            setSyncStatus({ type: result.success ? 'success' : 'error', msg: result.message });
        } catch (error: any) {
            setSyncStatus({ type: 'error', msg: `Ошибка: ${error?.message || 'Не удалось сохранить вкус'}` });
        }
    }

    // Reset form
    setNewName('');
    setNewDescription('');
    setBrandSelectValue('');
    setCustomBrandInput('');
    setUseCustomBrand(false);

    alert('Вкус добавлен и сохранён');
  };

  const handleAddBrand = (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = newBrandInput.trim();
      if (!trimmed) return;
      
      if (brandOptions.includes(trimmed)) {
          alert("Такой бренд уже существует");
          return;
      }

      if (setCustomBrands) {
          setCustomBrands([...customBrands, trimmed]);
      }
      setNewBrandInput('');
  };

  const handleDeleteBrandFull = (brandToDelete: string) => {
      if (!brandToDelete || brandToDelete === 'Все') return;
      
      // Calculate impacts
      const flavorsWithBrand = allFlavors.filter(f => f.brand === brandToDelete);
      const count = flavorsWithBrand.length;
      
      const confirmMsg = count > 0 
          ? `Вы точно хотите удалить бренд "${brandToDelete}"? \nЭто удалит ВСЕ вкусы (${count} шт) этого бренда из базы.` 
          : `Удалить бренд "${brandToDelete}" из списка?`;

      if (!window.confirm(confirmMsg)) return;

      // 1. Remove flavors of this brand
      if (setAllFlavors && count > 0) {
          const newFlavors = allFlavors.filter(f => f.brand !== brandToDelete);
          setAllFlavors(newFlavors);
      }

      // 2. Remove from custom brands list
      if (setCustomBrands) {
          const newCustomBrands = customBrands.filter(b => b !== brandToDelete);
          setCustomBrands(newCustomBrands);
      }

      // 3. Reset filter if we just deleted the active filter
      if (filterBrand === brandToDelete) {
          setFilterBrand('Все');
      }
  };

  const handleSyncToCloud = async () => {
      if (!activeVenueId) {
          alert("Выберите заведение перед сохранением");
          setActiveTab('settings');
          return;
      }

      try {
        setSyncStatus({ type: 'loading', msg: 'Сохранение...' });

        // Filter to ONLY custom flavors (explicit source='custom')
        const customFlavorsOnly = allFlavors.filter((f: any) => f.source === 'custom');
        console.log('[handleSyncToCloud] Saving custom flavors only:', customFlavorsOnly.length, 'of', allFlavors.length);
        
        const result = await saveFlavorsAndBrands(customFlavorsOnly, customBrands, activeVenueId);
        
        if (result.success) {
            setSyncStatus({ type: 'success', msg: result.message });
        } else {
            setSyncStatus({ type: 'error', msg: result.message });
        }
      } catch (err: any) {
          setSyncStatus({ type: 'error', msg: `Ошибка: ${err.message}` });
      }
  };

  const handleLoadFromCloud = async () => {
      try {
        if (!activeVenueId) {
            alert("Выберите заведение, чтобы загрузить меню");
            return;
        }

        setSyncStatus({ type: 'loading', msg: 'Загрузка...' });

        const { flavors, brands } = await fetchFlavors(activeVenueId);
        
        if (setAllFlavors) {
            if (flavors.length > 0) {
                setAllFlavors(flavors);
            } else {
                if(window.confirm("Облако вернуло пустой список. Очистить локальные данные?")) {
                    setAllFlavors([]);
                }
            }
        }
        if (setCustomBrands && brands) setCustomBrands(brands);
        
        setSyncStatus({ type: 'success', msg: `Загружено вкусов: ${flavors.length}` });
        
      } catch (e: any) {
        setSyncStatus({ type: 'error', msg: 'Ошибка загрузки' });
      }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-emerald-500/30 w-full max-w-2xl h-[90vh] rounded-2xl shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-900/30 p-2 rounded-lg border border-emerald-500/20">
              <Power size={20} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Админ-Панель</h2>
              <p className="text-xs text-slate-400">Управление складом</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex p-2 gap-2 bg-slate-800/50 overflow-x-auto scrollbar-hide">
          <button 
            onClick={() => setActiveTab('stock')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all px-3 ${activeTab === 'stock' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'}`}
          >
            Наличие
          </button>
          <button 
            onClick={() => setActiveTab('add')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all px-3 flex items-center justify-center gap-1 ${activeTab === 'add' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'}`}
          >
            <PlusCircle size={16} />
            Добавить
          </button>
          <button 
            onClick={() => setActiveTab('master-mixes')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all px-3 flex items-center justify-center gap-1 ${activeTab === 'master-mixes' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'}`}
          >
            <ChefHat size={16} />
            Мастер-миксы
          </button>
          <button 
            onClick={() => setActiveTab('statistics')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all px-3 flex items-center justify-center gap-1 ${activeTab === 'statistics' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'}`}
          >
            <BarChart3 size={16} />
            Статистика
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`py-2 px-3 rounded-lg transition-all ${activeTab === 'settings' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'}`}
          >
            <Settings size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          
          {/* STOCK TAB */}
          {activeTab === 'stock' && (
            <div className="space-y-2">
              
              {/* Cloud Sync Widget */}
              <div className="bg-slate-950 border border-indigo-500/30 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                          <Cloud className="text-indigo-400" size={24} />
                          <div>
                              <h3 className="text-indigo-400 font-bold text-sm">Синхронизация</h3>
                              <p className="text-slate-500 text-[10px] leading-tight max-w-[200px]">
                                  Сохраняет вкусы и бренды. ПИН код <b>не отправляется</b> (остается неизменным в таблице).
                              </p>
                          </div>
                      </div>
                  </div>
                  
                  <div className="flex gap-2 mb-3">
                      <button
                        onClick={handleLoadFromCloud}
                        disabled={syncStatus.type === 'loading' || !activeVenueId}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-bold py-3 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors border border-slate-700"
                      >
                         {syncStatus.type === 'loading' && syncStatus.msg.includes('Загрузка') ? <RotateCcw className="animate-spin" size={14} /> : <DownloadCloud size={14} />}
                         Получить
                      </button>

                      <button
                        onClick={handleSyncToCloud}
                        disabled={syncStatus.type === 'loading' || !activeVenueId}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold py-3 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-900/20"
                      >
                         {syncStatus.type === 'loading' && syncStatus.msg.includes('Сохранение') ? <RotateCcw className="animate-spin" size={14} /> : <UploadCloud size={14} />}
                         Сохранить вкусы
                      </button>
                  </div>

                  {syncStatus.type !== 'idle' && (
                    <div className={`text-xs p-3 rounded-lg flex items-start gap-2 animate-in fade-in zoom-in duration-200 ${
                        syncStatus.type === 'error' ? 'bg-red-900/20 text-red-300 border border-red-900/30' : 
                        syncStatus.type === 'success' ? 'bg-emerald-900/20 text-emerald-300 border border-emerald-900/30' : 
                        'bg-slate-800 text-slate-300'
                    }`}>
                        {syncStatus.type === 'error' && <AlertCircle size={14} className="mt-0.5 shrink-0" />}
                        {syncStatus.type === 'success' && <CheckCircle2 size={14} className="mt-0.5 shrink-0" />}
                        {syncStatus.type === 'loading' && <RotateCcw size={14} className="mt-0.5 shrink-0 animate-spin" />}
                        <span className="break-words font-medium">{syncStatus.msg}</span>
                    </div>
                  )}
              </div>

              {/* Filters */}
              <div className="flex flex-col gap-3 mb-4 bg-slate-800/30 p-3 rounded-xl">
                  <div className="flex items-center gap-2">
                      <Filter size={16} className="text-slate-400" />
                      <select 
                        value={filterBrand}
                        onChange={(e) => setFilterBrand(e.target.value)}
                        className="bg-slate-800 text-white text-xs border border-slate-700 rounded-lg px-2 py-2 focus:outline-none flex-1"
                      >
                          {presentBrands.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                  </div>
                  <div className="text-xs text-slate-500 font-bold text-right">
                      {filterBrand === 'Все' ? `Всего: ${allFlavors.length}` : `Найдено: ${filteredFlavors.length}`}
                  </div>
              </div>
              
              {/* Flavor List */}
              {filteredFlavors.length === 0 ? (
                  <div className="text-center text-slate-500 py-8 text-sm">Ничего не найдено</div>
              ) : (
                  filteredFlavors.map(flavor => (
                    <div key={flavor.id} className="flex items-center justify-between p-3 bg-slate-800/40 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-colors group">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 shrink-0 rounded-full border border-slate-600" style={{ backgroundColor: flavor.color }}></div>
                        <div className="min-w-0">
                          <div className="font-medium text-white truncate">{flavor.name}</div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="text-emerald-400 bg-emerald-900/20 px-1.5 py-0.5 rounded">{flavor.brand}</span>
                            {flavor.description && <span className="truncate max-w-[100px] text-slate-600">{flavor.description}</span>}
                            {flavor.source === 'global' && <span className="text-blue-400 bg-blue-900/20 px-1.5 py-0.5 rounded">Глобальный</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                            onClick={() => handleToggleFlavorVisibility(flavor)}
                            className={`px-3 py-1.5 shrink-0 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${flavor.isAvailable ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}
                        >
                            {flavor.isAvailable ? 'Виден' : 'Скрыт'}
                            {flavor.isAvailable ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                      </div>
                    </div>
                  ))
              )}

              <div className="mt-8 pt-6 border-t border-slate-800">
                 <button 
                    onClick={onResetFlavors}
                    className="w-full py-3 rounded-xl border border-slate-700 text-slate-400 hover:bg-red-900/20 hover:text-red-400 hover:border-red-900/50 transition-all flex items-center justify-center gap-2 text-sm"
                 >
                    <RotateCcw size={16} />
                    Сбросить список (локально)
                 </button>
              </div>
            </div>
          )}

          {/* BRANDS TAB */}
          {activeTab === 'brands' && (
              <div className="space-y-4">
                  <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                      <h3 className="text-white font-bold mb-3 text-sm flex items-center gap-2">
                          <PlusCircle size={16} className="text-emerald-500" />
                          Добавить новый Бренд
                      </h3>
                      <form onSubmit={handleAddBrand} className="flex gap-2">
                          <input 
                            type="text" 
                            value={newBrandInput}
                            onChange={(e) => setNewBrandInput(e.target.value)}
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                            placeholder="Название (например: Spectrum)"
                          />
                          <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-lg">
                              Добавить
                          </button>
                      </form>
                  </div>

                  <div className="space-y-2">
                      <h3 className="text-slate-400 text-xs uppercase font-bold px-1">Управление брендами</h3>
                      {brandOptions.length === 0 && <p className="text-slate-500 text-sm px-1">Список брендов пуст.</p>}
                      {brandOptions.map(brand => (
                          <div key={brand} className="flex items-center justify-between bg-slate-800 p-3 rounded-lg border border-slate-700">
                              <span className="text-white font-medium">{brand}</span>
                              <button 
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteBrandFull(brand);
                                }}
                                className="p-2 bg-slate-700 hover:bg-red-900/30 text-slate-400 hover:text-red-400 rounded-md transition-colors flex items-center gap-2"
                                title="Удалить бренд и все его вкусы"
                              >
                                  <Trash2 size={16} />
                                  <span className="text-xs font-bold">Удалить бренд</span>
                              </button>
                          </div>
                      ))}
                  </div>
              </div>
          )}

          {/* ADD FLAVOR TAB */}
          {activeTab === 'add' && (
            <form onSubmit={handleAddFlavorSubmit} className="space-y-4 max-w-md mx-auto py-2">
               <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Производитель (Бренд)</label>
                  
                  {/* Checkbox to toggle custom brand input */}
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={useCustomBrand}
                      onChange={(e) => setUseCustomBrand(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-xs text-slate-400">Создать новый бренд</span>
                  </label>

                  {useCustomBrand ? (
                    <input
                      type="text"
                      value={customBrandInput}
                      onChange={(e) => setCustomBrandInput(e.target.value)}
                      placeholder="Введите название бренда (например: Spectrum)"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-emerald-500 focus:outline-none"
                      autoFocus
                    />
                  ) : (
                    <div className="relative">
                      <select 
                          value={brandSelectValue}
                          onChange={(e) => setBrandSelectValue(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-emerald-500 focus:outline-none appearance-none"
                      >
                          <option value="" disabled>Выберите бренд...</option>
                          {brandOptions.map(b => (
                              <option key={b} value={b}>{b}</option>
                          ))}
                      </select>
                      <List className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                    </div>
                  )}
                  
                  <p className="text-[10px] text-slate-500 flex items-center gap-1">
                      <AlertCircle size={10} />
                      {useCustomBrand ? 'Новый бренд будет автоматически добавлен в список' : 'Или включите чекбокс выше, чтобы создать новый бренд'}
                  </p>
               </div>

               <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Название вкуса</label>
                  <input 
                    type="text" 
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-emerald-500 focus:outline-none"
                    placeholder="Например: Pinkman"
                  />
               </div>

               <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Описание вкуса</label>
                  <textarea
                    rows={3}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-emerald-500 focus:outline-none text-sm"
                    placeholder="Краткое описание: Малина с грейпфрутом..."
                  />
               </div>

               <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Цвет (для диаграммы)</label>
                  <div className="flex items-center gap-4">
                      <input 
                        type="color" 
                        value={newColor}
                        onChange={(e) => setNewColor(e.target.value)}
                        className="w-12 h-12 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                      />
                      <span className="text-slate-400 font-mono">{newColor}</span>
                  </div>
               </div>

               <button 
                 type="submit"
                 className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-900/20 mt-4"
               >
                 <Save size={20} />
                 Добавить в список
               </button>
            </form>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
              <div className="space-y-4 py-2">
                  {selectedVenue && (
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <Settings size={16} className="text-emerald-400" />
                          Настройки заведения
                      </h3>
                      
                      {/* Bowl Capacity */}
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                          Максимальная вместимость чаши (грамм)
                        </label>
                        <input
                          type="number"
                          min="10"
                          max="50"
                          value={bowlCapacity}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              setBowlCapacity(18);
                            } else {
                              const num = parseInt(val);
                              if (!isNaN(num)) {
                                setBowlCapacity(num);
                              }
                            }
                          }}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                        />
                        <p className="text-xs text-slate-400">
                          Максимальное количество табака, которое может поместиться в чашу
                        </p>
                      </div>
                      {/* Direct Link Info */}
                      {selectedVenue?.slug && (
                        <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-lg p-3 space-y-1">
                          <p className="text-xs font-semibold text-emerald-400 flex items-center gap-2">
                            <MapPin size={12} />
                            Прямая ссылка на заведение
                          </p>
                          <a 
                            href={`https://hookahmix.ru/app/${selectedVenue.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-emerald-300 hover:text-emerald-200 font-mono break-all underline"
                          >
                            hookahmix.ru/app/{selectedVenue.slug}
                          </a>
                          <p className="text-xs text-slate-400 mt-1">
                            Используйте эту ссылку для QR-кодов - она сразу откроет ваше заведение
                          </p>
                        </div>
                      )}

                      {/* Allow Brand Mixing */}
                      <div className="space-y-2">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={allowBrandMixing}
                            onChange={(e) => setAllowBrandMixing(e.target.checked)}
                            className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer"
                          />
                          <span className="text-sm font-semibold text-slate-300 group-hover:text-white transition-colors">
                            Разрешить смешивание брендов
                          </span>
                        </label>
                        <p className="text-xs text-slate-400 ml-8">
                          Когда отключено, клиенты могут выбирать вкусы только одного бренда
                        </p>
                      </div>

                      {/* Save Button */}
                      <button
                        onClick={async () => {
                          if (onUpdateVenue) {
                            try {
                              setSyncStatus({ type: 'loading', msg: 'Сохранение...' });
                              await onUpdateVenue({ bowl_capacity: bowlCapacity, allow_brand_mixing: allowBrandMixing });
                              setSyncStatus({ type: 'success', msg: 'Настройки сохранены' });
                              setTimeout(() => setSyncStatus({ type: 'idle', msg: '' }), 2000);
                            } catch (error) {
                              setSyncStatus({ type: 'error', msg: 'Ошибка сохранения' });
                              setTimeout(() => setSyncStatus({ type: 'idle', msg: '' }), 3000);
                            }
                          }
                        }}
                        disabled={syncStatus.type === 'loading'}
                        className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                      >
                        <Save size={16} />
                        {syncStatus.type === 'loading' ? 'Сохранение...' : 'Сохранить настройки'}
                      </button>
                      
                      {/* Status Message */}
                      {syncStatus.type !== 'idle' && (
                        <div className={`text-xs text-center py-2 rounded-lg ${
                          syncStatus.type === 'success' ? 'text-emerald-400 bg-emerald-950/30' : 
                          syncStatus.type === 'error' ? 'text-red-400 bg-red-950/30' : 
                          'text-slate-400'
                        }`}>
                          {syncStatus.msg}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <Cloud size={16} className="text-indigo-400" />
                          Хранилище Supabase
                      </h3>
                      <p className="text-sm text-slate-400">
                          Синхронизация теперь работает через таблицы базы данных. Выберите заведение, чтобы работать со своими данными.
                      </p>
                      <div className="bg-slate-900 rounded-lg p-3 border border-slate-800 text-xs text-slate-300">
                          <p className="font-mono text-emerald-300">Активное заведение: {activeVenueId || 'не выбрано'}</p>
                          <p className="mt-1">URL и ключ Supabase задаются в переменных окружения VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.</p>
                      </div>
                  </div>
                  <div className="bg-amber-900/30 border border-amber-700/30 text-amber-100 rounded-xl p-3 text-xs">
                      ПИН коды хранятся рядом с записью заведения (поле <code>admin_pin</code>). Сохранение вкусов не меняет ПИН, чтобы заведения могли управлять доступом самостоятельно.
                  </div>
              </div>
          )}

          {/* Statistics Tab */}
          {activeTab === 'statistics' && (
              <StatisticsTab venueId={activeVenueId} />
          )}

          {/* Master Mixes Tab */}
          {activeTab === 'master-mixes' && (
              <MasterMixesTab venueId={activeVenueId} selectedVenue={selectedVenue} />
          )}
        </div>
      </div>
    </div>
  );
};

// ========================================
// STATISTICS TAB COMPONENT
// ========================================

interface StatisticsTabProps {
  venueId?: string;
}

const StatisticsTab: React.FC<StatisticsTabProps> = ({ venueId }) => {
  const [subTab, setSubTab] = useState<'popular' | 'purchase'>('popular');
  const [period, setPeriod] = useState<'30' | '90' | 'all'>('30');
  const [popularFlavors, setPopularFlavors] = useState<any[]>([]);
  const [purchaseList, setPurchaseList] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (venueId && subTab === 'popular') {
      loadPopularFlavors();
    }
  }, [venueId, subTab, period]);

  useEffect(() => {
    if (venueId && subTab === 'purchase') {
      loadPurchaseList();
    }
  }, [venueId, subTab]);

  const loadPopularFlavors = async () => {
    if (!venueId) return;
    setIsLoading(true);
    setError('');

    try {
      const data = await apiFetch<any>(`/venues/${venueId}/stats/popular-flavors?period=${period}`);
      setPopularFlavors(data.flavors || []);
    } catch (err: any) {
      setError(err.message || 'Не удалось загрузить статистику');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPurchaseList = async () => {
    if (!venueId) return;
    setIsLoading(true);
    setError('');

    try {
      const data = await apiFetch<any>(`/venues/${venueId}/stats/purchase-list`);
      setPurchaseList(data);
    } catch (err: any) {
      setError(err.message || 'Не удалось загрузить список закупки');
    } finally {
      setIsLoading(false);
    }
  };

  const copyPurchaseList = () => {
    if (!purchaseList?.formattedText) return;
    navigator.clipboard.writeText(purchaseList.formattedText);
    alert('Список скопирован в буфер обмена!');
  };

  if (!venueId) {
    return (
      <div className="p-6 text-center text-slate-400">
        <BarChart3 className="mx-auto mb-3 opacity-30" size={48} />
        <p>Выберите заведение для просмотра статистики</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Sub Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setSubTab('popular')}
          className={`flex-1 py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${
            subTab === 'popular' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          <BarChart3 size={18} />
          Популярные табаки
        </button>
        <button
          onClick={() => setSubTab('purchase')}
          className={`flex-1 py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${
            subTab === 'purchase' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          <ShoppingCart size={18} />
          Список закупки
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 text-red-400 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {/* Popular Flavors */}
      {subTab === 'popular' && (
        <div className="space-y-4">
          {/* Period Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setPeriod('30')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                period === '30' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              30 дней
            </button>
            <button
              onClick={() => setPeriod('90')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                period === '90' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              90 дней
            </button>
            <button
              onClick={() => setPeriod('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                period === 'all' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              Все время
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-10 text-slate-400">Загрузка...</div>
          ) : popularFlavors.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <BarChart3 className="mx-auto mb-3 opacity-30" size={48} />
              <p>Нет данных за выбранный период</p>
            </div>
          ) : (
            <div className="space-y-2">
              {popularFlavors.map((flavor, idx) => (
                <div
                  key={flavor.id}
                  className="bg-slate-800 rounded-lg p-3 flex items-center gap-3"
                >
                  <div className="text-lg font-bold text-emerald-400 w-8">#{idx + 1}</div>
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: flavor.color }}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">{flavor.name}</p>
                    <p className="text-xs text-slate-400">{flavor.brand}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">{flavor.usageCount} раз</p>
                    <p className="text-xs text-slate-400">~{flavor.avgGrams}г</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Purchase List */}
      {subTab === 'purchase' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-10 text-slate-400">Загрузка...</div>
          ) : !purchaseList || purchaseList.totalCount === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <ShoppingCart className="mx-auto mb-3 opacity-30" size={48} />
              <p>Все табаки видимы, нечего закупать!</p>
            </div>
          ) : (
            <>
              <div className="bg-slate-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-white">
                    Невидимые табаки ({purchaseList.totalCount})
                  </h3>
                  <button
                    onClick={copyPurchaseList}
                    className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Copy size={16} />
                    Копировать
                  </button>
                </div>

                <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-slate-300 whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {purchaseList.formattedText}
                </div>
              </div>

              <div className="bg-blue-900/20 border border-blue-800 text-blue-300 rounded-lg p-3 text-xs">
                💡 Этот список включает все табаки, которые доступны заведению, но отмечены как невидимые.
                Скопируйте и отправьте поставщику!
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ========================================
// MASTER MIXES TAB COMPONENT  
// ========================================

interface MasterMixesTabProps {
  venueId?: string;
  selectedVenue?: any;
}

interface MasterMix {
  id: string;
  name: string;
  ingredients: any[];
  display_order: number;
  is_published: boolean;
  created_at: string;
}

const MasterMixesTab: React.FC<MasterMixesTabProps> = ({ venueId, selectedVenue }) => {
  const [mixes, setMixes] = React.useState<MasterMix[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [editingMix, setEditingMix] = React.useState<MasterMix | null>(null);

  const loadMixes = async () => {
    if (!venueId) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch(`/api/venues/${venueId}/master-mixes?includeAll=true`);
      if (!response.ok) throw new Error('Failed to load master mixes');
      
      const data = await response.json();
      setMixes(data || []);
    } catch (err: any) {
      setError(err.message || 'Не удалось загрузить мастер-миксы');
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadMixes();
  }, [venueId]);

  const handleDeleteMix = async (mixId: string) => {
    if (!window.confirm('Удалить этот мастер-микс?')) return;

    try {
      const response = await fetch(`/api/master-mixes/${mixId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete mix');
      
      await loadMixes();
    } catch (err: any) {
      alert('Ошибка удаления: ' + err.message);
    }
  };

  const handleTogglePublish = async (mix: MasterMix) => {
    try {
      const response = await fetch(`/api/master-mixes/${mix.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isPublished: !mix.is_published
        })
      });

      if (!response.ok) throw new Error('Failed to update mix');
      
      await loadMixes();
    } catch (err: any) {
      alert('Ошибка обновления: ' + err.message);
    }
  };

  if (!venueId) {
    return (
      <div className="flex-1 overflow-y-auto p-6 text-center text-slate-400">
        <ChefHat className="mx-auto mb-3 opacity-30" size={48} />
        <p>Выберите заведение для управления мастер-миксами</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <ChefHat size={20} className="text-emerald-400" />
            Мастер-миксы
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Готовые рецепты от ваших кальянщиков, которые видят клиенты
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors"
        >
          <PlusCircle size={18} />
          Создать
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 text-red-300 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-10 text-slate-400">
          <Loader2 className="animate-spin mx-auto mb-2" size={32} />
          <p className="text-sm">Загрузка...</p>
        </div>
      ) : mixes.length === 0 ? (
        <div className="text-center py-10 text-slate-400">
          <ChefHat className="mx-auto mb-3 opacity-30" size={48} />
          <p className="mb-2">Пока нет мастер-миксов</p>
          <p className="text-xs mb-4">Создайте первый рецепт для ваших клиентов</p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors"
          >
            <PlusCircle size={18} />
            Создать мастер-микс
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {mixes.map((mix) => {
            const totalWeight = mix.ingredients.reduce((sum: number, ing: any) => sum + (ing.grams || 0), 0);
            
            return (
              <div
                key={mix.id}
                className="bg-slate-800 rounded-xl p-4 border border-slate-700 hover:border-slate-600 transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-base font-bold text-white">{mix.name}</h4>
                      {mix.is_published ? (
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded border border-emerald-500/30">
                          Опубликован
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-700 text-slate-400 text-xs font-medium rounded">
                          Черновик
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      {mix.ingredients.length} вкусов • {totalWeight}г
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTogglePublish(mix)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                        mix.is_published
                          ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          : 'bg-emerald-600 text-white hover:bg-emerald-500'
                      }`}
                    >
                      {mix.is_published ? 'Скрыть' : 'Опубликовать'}
                    </button>
                    <button
                      onClick={() => setEditingMix(mix)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                      title="Редактировать"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteMix(mix.id)}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Удалить"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {mix.ingredients.slice(0, 5).map((ing: any, idx: number) => (
                    <div
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-900 rounded-md text-xs"
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: ing.color || '#888' }}
                      />
                      <span className="text-slate-300 font-medium">{ing.name}</span>
                      <span className="text-slate-500">{ing.grams}г</span>
                    </div>
                  ))}
                  {mix.ingredients.length > 5 && (
                    <span className="text-xs text-slate-500 self-center">
                      +{mix.ingredients.length - 5} ещё
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateForm || editingMix) && (
        <MasterMixEditor
          venueId={venueId}
          selectedVenue={selectedVenue}
          existingMix={editingMix}
          onClose={() => {
            setShowCreateForm(false);
            setEditingMix(null);
          }}
          onSave={async () => {
            await loadMixes();
            setShowCreateForm(false);
            setEditingMix(null);
          }}
        />
      )}
    </div>
  );
};

// ========================================
// MASTER MIX EDITOR COMPONENT
// ========================================

interface MasterMixEditorProps {
  venueId: string;
  selectedVenue?: any;
  existingMix: MasterMix | null;
  onClose: () => void;
  onSave: () => void;
}

interface MixIngredient {
  id: string;
  name: string;
  brand: string;
  color: string;
  grams: number;
}

const MasterMixEditor: React.FC<MasterMixEditorProps> = ({
  venueId,
  selectedVenue,
  existingMix,
  onClose,
  onSave
}) => {
  const [mixName, setMixName] = useState(existingMix?.name || '');
  const [ingredients, setIngredients] = useState<MixIngredient[]>(existingMix?.ingredients || []);
  const [isPublished, setIsPublished] = useState(existingMix?.is_published || false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  
  // Flavor selection
  const [availableFlavors, setAvailableFlavors] = useState<Flavor[]>([]);
  const [showFlavorSelector, setShowFlavorSelector] = useState(false);
  
  const bowlCapacity = selectedVenue?.bowl_capacity || 18;
  const totalWeight = ingredients.reduce((sum, ing) => sum + ing.grams, 0);
  const remaining = bowlCapacity - totalWeight;

  useEffect(() => {
    loadAvailableFlavors();
  }, [venueId]);

  const loadAvailableFlavors = async () => {
    try {
      const { flavors } = await fetchFlavors(venueId);
      setAvailableFlavors(flavors.filter(f => f.isAvailable));
    } catch (err) {
      console.error('Failed to load flavors:', err);
    }
  };

  const handleAddFlavor = (flavor: Flavor) => {
    // Check if already added
    if (ingredients.find(i => i.id === flavor.id)) {
      alert('Этот вкус уже добавлен');
      return;
    }

    // Add with 1g by default
    const newIngredient: MixIngredient = {
      id: flavor.id,
      name: flavor.name,
      brand: flavor.brand,
      color: flavor.color,
      grams: Math.min(1, remaining)
    };

    setIngredients([...ingredients, newIngredient]);
    setShowFlavorSelector(false);
  };

  const handleUpdateGrams = (id: string, grams: number) => {
    const otherWeight = ingredients.filter(i => i.id !== id).reduce((sum, i) => sum + i.grams, 0);
    const maxAllowed = bowlCapacity - otherWeight;
    const finalGrams = Math.max(0, Math.min(grams, maxAllowed));

    setIngredients(ingredients.map(ing =>
      ing.id === id ? { ...ing, grams: finalGrams } : ing
    ));
  };

  const handleRemoveFlavor = (id: string) => {
    setIngredients(ingredients.filter(i => i.id !== id));
  };

  const handleSave = async () => {
    if (!mixName.trim()) {
      alert('Введите название микса');
      return;
    }

    if (ingredients.length === 0) {
      alert('Добавьте хотя бы один вкус');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const method = existingMix ? 'PATCH' : 'POST';
      const url = existingMix
        ? `/api/master-mixes/${existingMix.id}`
        : `/api/master-mixes`;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venueId,
          name: mixName.trim(),
          ingredients,
          isPublished
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save mix');
      }

      onSave();
    } catch (err: any) {
      setError(err.message || 'Не удалось сохранить микс');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ChefHat size={22} className="text-emerald-400" />
              {existingMix ? 'Редактировать микс' : 'Создать мастер-микс'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {totalWeight} / {bowlCapacity}г • Осталось: {remaining}г
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="bg-red-900/20 border border-red-800 text-red-300 rounded-lg p-3 text-sm">
              {error}
            </div>
          )}

          {/* Mix Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Название микса</label>
            <input
              type="text"
              value={mixName}
              onChange={(e) => setMixName(e.target.value)}
              placeholder="Например: Ягодный взрыв"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-emerald-500 focus:outline-none"
              autoFocus
            />
          </div>

          {/* Publish Toggle */}
          <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-800 rounded-xl border border-slate-700 hover:border-emerald-500 transition-colors">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-2 focus:ring-emerald-500"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-white">Опубликовать микс</p>
              <p className="text-xs text-slate-400">Клиенты смогут увидеть и выбрать этот рецепт</p>
            </div>
          </label>

          {/* Ingredients */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-300">
                Ингредиенты ({ingredients.length})
              </label>
              <button
                onClick={() => setShowFlavorSelector(true)}
                disabled={remaining <= 0}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                <PlusCircle size={16} />
                Добавить вкус
              </button>
            </div>

            {ingredients.length === 0 ? (
              <div className="text-center py-8 text-slate-400 bg-slate-800 rounded-xl border border-slate-700">
                <p className="text-sm">Добавьте вкусы в микс</p>
              </div>
            ) : (
              <div className="space-y-2">
                {ingredients.map((ing) => (
                  <div
                    key={ing.id}
                    className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl border border-slate-700"
                  >
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: ing.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{ing.name}</p>
                      <p className="text-xs text-slate-400">{ing.brand}</p>
                    </div>
                    <input
                      type="number"
                      value={ing.grams}
                      onChange={(e) => handleUpdateGrams(ing.id, parseInt(e.target.value) || 0)}
                      min="0"
                      max={bowlCapacity}
                      className="w-20 bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-center focus:border-emerald-500 focus:outline-none"
                    />
                    <span className="text-sm text-slate-400 w-6">г</span>
                    <button
                      onClick={() => handleRemoveFlavor(ing.id)}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !mixName.trim() || ingredients.length === 0}
            className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Сохранение...
              </>
            ) : (
              <>
                <Save size={18} />
                Сохранить
              </>
            )}
          </button>
        </div>
      </div>

      {/* Flavor Selector Modal */}
      {showFlavorSelector && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 z-[110]">
          <div className="bg-slate-900 rounded-xl border border-slate-700 max-w-md w-full max-h-[70vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-lg font-bold text-white">Выберите вкус</h3>
              <button
                onClick={() => setShowFlavorSelector(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {availableFlavors.map((flavor) => {
                const alreadyAdded = ingredients.find(i => i.id === flavor.id);
                return (
                  <button
                    key={flavor.id}
                    onClick={() => handleAddFlavor(flavor)}
                    disabled={!!alreadyAdded}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                      alreadyAdded
                        ? 'bg-slate-800 border-slate-700 opacity-50 cursor-not-allowed'
                        : 'bg-slate-800 border-slate-700 hover:border-emerald-500 hover:bg-slate-700'
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: flavor.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{flavor.name}</p>
                      <p className="text-xs text-slate-400">{flavor.brand}</p>
                    </div>
                    {alreadyAdded && (
                      <span className="text-xs text-emerald-400 font-medium">Добавлен</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
