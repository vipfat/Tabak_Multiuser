

import React, { useState, useMemo } from 'react';
import { Flavor } from '../types';
import { Search, Check, X, Filter } from 'lucide-react';

interface FlavorSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onToggle: (flavor: Flavor) => void;
  currentFlavorIds: string[];
  availableFlavors: Flavor[];
  allowBrandMixing?: boolean;
  currentMix?: Flavor[];
}

const FlavorSelector: React.FC<FlavorSelectorProps> = ({ isOpen, onClose, onToggle, currentFlavorIds, availableFlavors, allowBrandMixing = true, currentMix = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string>('Все');

  // Determine allowed brand if brand mixing is disabled
  const allowedBrand = useMemo(() => {
    if (allowBrandMixing || currentMix.length === 0) return null;
    // Get the brand of the first ingredient
    return currentMix[0]?.brand || null;
  }, [allowBrandMixing, currentMix]);

  // Dynamically extract unique brands from the available flavors list
  // This ensures custom brands added via "Other" appear in the filter tabs automatically.
  // Filter brands if brand mixing is disabled
  const brands = useMemo(() => {
    let uniqueBrands = Array.from(new Set(availableFlavors.map(f => f.brand))).sort();
    
    // If brand mixing disabled and there's an allowed brand, only show that brand
    if (allowedBrand) {
      uniqueBrands = uniqueBrands.filter(b => b === allowedBrand);
    }
    
    return ['Все', ...uniqueBrands];
  }, [availableFlavors, allowedBrand]);

  if (!isOpen) return null;

  const filteredFlavors = availableFlavors.filter(flavor => {
    // Safely cast to string to handle potential data issues (e.g. numbers in name field)
    const name = String(flavor.name || "");
    const desc = String(flavor.description || "");
    const search = searchTerm.toLowerCase();

    const matchesSearch = 
        name.toLowerCase().includes(search) || 
        desc.toLowerCase().includes(search);
    
    const matchesBrand = selectedBrand === 'Все' || flavor.brand === selectedBrand;
    
    // If brand mixing is disabled, only show flavors of the allowed brand
    const matchesAllowedBrand = !allowedBrand || flavor.brand === allowedBrand;
    
    return matchesSearch && matchesBrand && matchesAllowedBrand;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md h-[90vh] rounded-2xl shadow-2xl flex flex-col animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-white">Выбор табака</h2>
            <p className="text-xs text-slate-400">Выберите несколько для микса</p>
          </div>
          <button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 p-2 rounded-full text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Search & Filter */}
        <div className="p-4 space-y-3 bg-slate-900/50 border-b border-slate-800/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Поиск вкуса или описание..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-hide">
            {brands.map(brand => (
              <button
                key={brand}
                onClick={() => setSelectedBrand(brand)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedBrand === brand 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {brand}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredFlavors.length === 0 ? (
            <div className="text-center py-10 text-slate-500 flex flex-col items-center gap-2">
              <Filter size={24} />
              <p>Вкусы не найдены.</p>
            </div>
          ) : (
            filteredFlavors.map(flavor => {
              const isSelected = currentFlavorIds.includes(flavor.id);
              return (
                <button
                  key={flavor.id}
                  onClick={() => onToggle(flavor)}
                  className={`w-full flex items-start p-3 rounded-xl transition-all group text-left border ${
                    isSelected 
                        ? 'bg-emerald-900/20 border-emerald-500/50' 
                        : 'hover:bg-slate-800 border-transparent'
                  }`}
                >
                  <div 
                    className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center mr-4 shadow-sm relative mt-1"
                    style={{ backgroundColor: flavor.color }}
                  >
                      {isSelected && (
                        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center animate-in fade-in duration-200">
                            <Check size={20} className="text-white" />
                        </div>
                      )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                        <h3 className={`text-sm font-bold truncate pr-2 ${isSelected ? 'text-emerald-300' : 'text-white group-hover:text-emerald-200'}`}>
                        {flavor.name}
                        </h3>
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700 whitespace-nowrap">
                            {flavor.brand}
                        </span>
                    </div>
                    {flavor.description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-tight">
                            {flavor.description}
                        </p>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 rounded-b-2xl">
            <button 
                onClick={onClose}
                className="w-full bg-white text-slate-900 font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors"
            >
                Готово (выбрано: {currentFlavorIds.length})
            </button>
        </div>

      </div>
    </div>
  );
};

export default FlavorSelector;