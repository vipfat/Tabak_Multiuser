
import React, { useState, useEffect, useMemo } from 'react';
import { Flavor, FlavorBrand } from '../types';
import { X, Save, Power, Eye, EyeOff, RotateCcw, Cloud, UploadCloud, DownloadCloud, Settings, AlertCircle, CheckCircle2, Trash2, Filter, List, PlusCircle } from 'lucide-react';
import { saveFlavorsAndBrands, fetchFlavors } from '../services/storageService';

const generateFlavorId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch (e) {
      // Fallback
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

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
  currentPin?: string;
  activeVenueId?: string;
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
    currentPin = "0000",
    activeVenueId,
}) => {
  const [activeTab, setActiveTab] = useState<'stock' | 'add' | 'brands' | 'settings'>('stock');
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

  useEffect(() => {
    if (isOpen) {
        setSyncStatus({ type: 'idle', msg: '' });
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

  const handleAddFlavorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;

    if (!brandSelectValue || brandSelectValue === FlavorBrand.OTHER) {
        alert("Пожалуйста, выберите бренд из списка. Если бренда нет, добавьте его во вкладке 'Бренды'.");
        return;
    }

    const newFlavor: Flavor = {
      id: generateFlavorId(),
      name: newName,
      brand: brandSelectValue,
      description: newDescription,
      color: newColor,
      isAvailable: true
    };

    onAddFlavor(newFlavor);
    
    // Reset form
    setNewName('');
    setNewDescription('');
    alert('Вкус добавлен в локальный список. Не забудьте нажать "Сохранить все" во вкладке Наличие.');
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

        // Send ONLY Flavors and Brands. DO NOT SEND PIN.
        const result = await saveFlavorsAndBrands(allFlavors, customBrands, activeVenueId);
        
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

        const { flavors, pin, brands } = await fetchFlavors(activeVenueId);
        
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
            onClick={() => setActiveTab('brands')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all px-3 ${activeTab === 'brands' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'}`}
          >
            Бренды
          </button>
          <button 
            onClick={() => setActiveTab('add')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all px-3 ${activeTab === 'add' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'}`}
          >
            Добавить вкус
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
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                            onClick={() => onUpdateFlavor({ ...flavor, isAvailable: !flavor.isAvailable })}
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
                  <p className="text-[10px] text-slate-500 flex items-center gap-1">
                      <AlertCircle size={10} />
                      Если бренда нет в списке, добавьте его во вкладке <b>Бренды</b>.
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
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
