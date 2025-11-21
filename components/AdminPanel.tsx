import React, { useState, useEffect } from 'react';
import { Flavor, FlavorCategory } from '../types';
import { X, Save, Power, Eye, EyeOff, RotateCcw, Cloud, Copy, Check } from 'lucide-react';
import { getCloudId, setCloudId, createCloudStorage } from '../services/storageService';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  allFlavors: Flavor[];
  onUpdateFlavor: (flavor: Flavor) => void;
  onAddFlavor: (flavor: Flavor) => void;
  onResetFlavors: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose, allFlavors, onUpdateFlavor, onAddFlavor, onResetFlavors }) => {
  const [activeTab, setActiveTab] = useState<'stock' | 'add' | 'cloud'>('stock');
  
  // Add Flavor State
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<FlavorCategory>(FlavorCategory.FRUIT);
  const [newColor, setNewColor] = useState('#10b981');

  // Cloud State
  const [currentCloudId, setCurrentCloudId] = useState<string>('');
  const [inputCloudId, setInputCloudId] = useState('');
  const [copied, setCopied] = useState(false);
  const [isCreatingCloud, setIsCreatingCloud] = useState(false);

  useEffect(() => {
      if (isOpen) {
          const id = getCloudId();
          setCurrentCloudId(id || '');
          setInputCloudId(id || '');
      }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;

    const newFlavor: Flavor = {
      id: `custom_${Date.now()}`,
      name: newName,
      category: newCategory,
      color: newColor,
      isAvailable: true
    };

    onAddFlavor(newFlavor);
    setNewName('');
    alert('Вкус добавлен!');
  };

  const handleCreateCloud = async () => {
    setIsCreatingCloud(true);
    try {
        const newId = await createCloudStorage(allFlavors);
        setCurrentCloudId(newId);
        setInputCloudId(newId);
        // Trigger a reload/refetch in the main app effectively
        window.location.reload(); 
    } catch (e) {
        alert("Ошибка создания облака");
    } finally {
        setIsCreatingCloud(false);
    }
  };

  const handleConnectCloud = () => {
      if (inputCloudId.trim()) {
          setCloudId(inputCloudId.trim());
          setCurrentCloudId(inputCloudId.trim());
          alert("Подключено! Приложение перезагрузится для синхронизации.");
          window.location.reload();
      }
  };

  const handleCopy = () => {
      navigator.clipboard.writeText(currentCloudId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-emerald-500/30 w-full max-w-2xl h-[85vh] rounded-2xl shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="bg-red-900/30 p-2 rounded-lg border border-red-500/20">
              <Power size={20} className="text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Админ-Панель</h2>
              <p className="text-xs text-slate-400">Управление базой вкусов</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex p-2 gap-2 bg-slate-800/50 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('stock')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all px-2 ${activeTab === 'stock' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'}`}
          >
            Наличие
          </button>
          <button 
            onClick={() => setActiveTab('add')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all px-2 ${activeTab === 'add' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'}`}
          >
            Добавить
          </button>
          <button 
            onClick={() => setActiveTab('cloud')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all px-2 ${activeTab === 'cloud' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'}`}
          >
            Облако
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          
          {activeTab === 'stock' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center mb-4 px-2">
                <span className="text-xs text-slate-500 uppercase font-bold">Всего: {allFlavors.length}</span>
                <span className="text-xs text-slate-500 uppercase font-bold">Активно: {allFlavors.filter(f => f.isAvailable).length}</span>
              </div>
              
              {allFlavors.map(flavor => (
                <div key={flavor.id} className="flex items-center justify-between p-3 bg-slate-800/40 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full border border-slate-600" style={{ backgroundColor: flavor.color }}></div>
                    <div>
                      <div className="font-medium text-white">{flavor.name}</div>
                      <div className="text-xs text-slate-500">{flavor.category}</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => onUpdateFlavor({ ...flavor, isAvailable: !flavor.isAvailable })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${flavor.isAvailable ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}
                  >
                    {flavor.isAvailable ? (
                        <>
                            <Eye size={14} /> В меню
                        </>
                    ) : (
                        <>
                            <EyeOff size={14} /> Скрыт
                        </>
                    )}
                  </button>
                </div>
              ))}

              <div className="mt-8 pt-6 border-t border-slate-800">
                 <button 
                    onClick={onResetFlavors}
                    className="w-full py-3 rounded-xl border border-slate-700 text-slate-400 hover:bg-red-900/20 hover:text-red-400 hover:border-red-900/50 transition-all flex items-center justify-center gap-2 text-sm"
                 >
                    <RotateCcw size={16} />
                    Сбросить меню к заводским настройкам
                 </button>
              </div>
            </div>
          )}

          {activeTab === 'add' && (
            <form onSubmit={handleAdd} className="space-y-6 max-w-md mx-auto py-4">
               <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Название вкуса</label>
                  <input 
                    type="text" 
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-emerald-500 focus:outline-none"
                    placeholder="Например: Ледяной Кактус"
                  />
               </div>

               <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Категория</label>
                  <select 
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as FlavorCategory)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-emerald-500 focus:outline-none appearance-none"
                  >
                     {Object.values(FlavorCategory).map(c => (
                        <option key={c} value={c}>{c}</option>
                     ))}
                  </select>
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
                 className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-900/20"
               >
                 <Save size={20} />
                 Сохранить в базу
               </button>
            </form>
          )}

          {activeTab === 'cloud' && (
             <div className="space-y-6 py-4">
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                            <Cloud size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-white">Глобальная Синхронизация</h3>
                    </div>
                    <p className="text-sm text-slate-400 mb-4">
                        Позволяет синхронизировать наличие и список вкусов между всеми устройствами заведения.
                    </p>
                    
                    {currentCloudId ? (
                        <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                             <p className="text-xs text-slate-500 mb-1">Ваш ID Облака (введите на других устройствах):</p>
                             <div className="flex gap-2">
                                <code className="flex-1 bg-slate-900 p-2 rounded border border-slate-800 font-mono text-emerald-400 text-sm truncate">
                                    {currentCloudId}
                                </code>
                                <button 
                                    onClick={handleCopy}
                                    className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded transition-colors"
                                >
                                    {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                                </button>
                             </div>
                        </div>
                    ) : (
                        <button 
                            onClick={handleCreateCloud}
                            disabled={isCreatingCloud}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors"
                        >
                            {isCreatingCloud ? "Создание..." : "Создать новое хранилище"}
                        </button>
                    )}
                </div>

                <div className="border-t border-slate-800 pt-6">
                    <h4 className="font-bold text-white mb-4">Подключиться к существующему</h4>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            placeholder="Введите ID хранилища"
                            value={inputCloudId}
                            onChange={(e) => setInputCloudId(e.target.value)}
                            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-blue-500 focus:outline-none font-mono text-sm"
                        />
                        <button 
                            onClick={handleConnectCloud}
                            className="bg-slate-700 hover:bg-slate-600 text-white px-4 rounded-xl font-bold transition-colors"
                        >
                            Подключить
                        </button>
                    </div>
                </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;