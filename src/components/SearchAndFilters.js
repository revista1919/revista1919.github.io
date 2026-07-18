import React, { useState, useEffect } from 'react';

function SearchAndFilters({
  searchTerm,
  setSearchTerm,
  selectedArea,
  setSelectedArea,
  areas,
  onSearch,
  clearFilters,
  placeholder = "Buscar en el archivo...",
  selectedVolume,
  setSelectedVolume,
  volumesList,
  selectedNumber,
  setSelectedNumber,
  numbersList,
  volumeLabel = "Volumen",
  numberLabel = "Número"
}) {
  // Estado para mostrar/ocultar filtros en móvil
  const [showFilters, setShowFilters] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchTerm);

  // Sincronizar el término de búsqueda local con el global
  useEffect(() => {
    setLocalSearch(searchTerm);
  }, [searchTerm]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setLocalSearch(value);
    // Actualizar el término de búsqueda en tiempo real
    setSearchTerm(value);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSearch(localSearch, selectedArea, selectedVolume, selectedNumber);
      if (window.innerWidth < 768) {
        setShowFilters(false);
      }
    }
  };

  const handleApplyFilters = () => {
    onSearch(localSearch, selectedArea, selectedVolume, selectedNumber);
    if (window.innerWidth < 768) {
      setShowFilters(false);
    }
  };

  const handleClearAll = () => {
    setLocalSearch('');
    clearFilters();
    if (window.innerWidth < 768) {
      setShowFilters(false);
    }
  };

  const hasActiveFilters = selectedArea || selectedVolume || selectedNumber || localSearch;

  return (
    <div className="bg-white border border-gray-300 rounded-sm shadow-sm overflow-hidden mb-8">
      <div className="p-4 md:p-6">
        <div className="flex flex-col gap-4">
          
          {/* Barra de Búsqueda Principal */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={localSearch}
                onChange={handleSearchChange}
                onKeyPress={handleKeyPress}
                placeholder={placeholder}
                className="w-full pl-11 pr-10 py-3 bg-white border border-gray-300 text-base focus:ring-2 focus:ring-[#007398]/20 focus:border-[#007398] outline-none text-gray-800 placeholder-gray-400 transition-shadow rounded-sm"
                aria-label={placeholder}
              />
              {localSearch && (
                <button
                  onClick={() => {
                    setLocalSearch('');
                    setSearchTerm('');
                    onSearch('', selectedArea, selectedVolume, selectedNumber);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  aria-label="Limpiar búsqueda"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleApplyFilters}
                className="flex-1 md:flex-none bg-[#007398] text-white py-3 px-8 text-sm font-semibold hover:bg-[#005a77] transition-colors rounded-sm"
              >
                Buscar
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`md:hidden px-4 py-3 border rounded-sm transition-colors ${
                  showFilters 
                    ? 'bg-gray-100 border-gray-300' 
                    : 'bg-white border-gray-300 text-gray-600'
                }`}
                aria-label={showFilters ? "Ocultar filtros" : "Mostrar filtros"}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Filtros Académicos (Selects) */}
          <div className={`${showFilters ? 'grid' : 'hidden'} md:grid grid-cols-1 md:grid-cols-3 gap-4 pt-2`}>
            <div>
              <label className="block md:hidden text-[9px] font-bold text-gray-400 uppercase mb-1">
                Disciplina
              </label>
              <select
                value={selectedArea}
                onChange={(e) => {
                  setSelectedArea(e.target.value);
                  // Aplicar filtros automáticamente en desktop
                  if (window.innerWidth >= 768) {
                    onSearch(localSearch, e.target.value, selectedVolume, selectedNumber);
                  }
                }}
                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-sm text-sm text-gray-700 outline-none focus:border-[#007398] hover:border-gray-400 cursor-pointer appearance-none"
                style={{ 
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, 
                  backgroundPosition: 'right 0.75rem center', 
                  backgroundRepeat: 'no-repeat', 
                  backgroundSize: '1.2em 1.2em' 
                }}
                aria-label="Filtrar por disciplina"
              >
                <option value="">Todas las disciplinas</option>
                {areas.map((area) => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block md:hidden text-[9px] font-bold text-gray-400 uppercase mb-1">
                {volumeLabel}
              </label>
              <select
                value={selectedVolume}
                onChange={(e) => {
                  setSelectedVolume(e.target.value);
                  // Aplicar filtros automáticamente en desktop
                  if (window.innerWidth >= 768) {
                    onSearch(localSearch, selectedArea, e.target.value, selectedNumber);
                  }
                }}
                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-sm text-sm text-gray-700 outline-none focus:border-[#007398] hover:border-gray-400 cursor-pointer appearance-none"
                style={{ 
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, 
                  backgroundPosition: 'right 0.75rem center', 
                  backgroundRepeat: 'no-repeat', 
                  backgroundSize: '1.2em 1.2em' 
                }}
                aria-label={`Filtrar por ${volumeLabel.toLowerCase()}`}
              >
                <option value="">Filtrar por {volumeLabel} (Todos)</option>
                {volumesList.map((vol) => (
                  <option key={vol} value={vol}>
                    {volumeLabel} {vol}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <label className="block md:hidden text-[9px] font-bold text-gray-400 uppercase mb-1">
                  {numberLabel}
                </label>
                <select
                  value={selectedNumber}
                  onChange={(e) => {
                    setSelectedNumber(e.target.value);
                    // Aplicar filtros automáticamente en desktop
                    if (window.innerWidth >= 768) {
                      onSearch(localSearch, selectedArea, selectedVolume, e.target.value);
                    }
                  }}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-sm text-sm text-gray-700 outline-none focus:border-[#007398] hover:border-gray-400 cursor-pointer appearance-none"
                  style={{ 
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, 
                    backgroundPosition: 'right 0.75rem center', 
                    backgroundRepeat: 'no-repeat', 
                    backgroundSize: '1.2em 1.2em' 
                  }}
                  aria-label={`Filtrar por ${numberLabel.toLowerCase()}`}
                >
                  <option value="">Filtrar por {numberLabel} (Todos)</option>
                  {numbersList.map((num) => (
                    <option key={num} value={num}>
                      {numberLabel} {num}
                    </option>
                  ))}
                </select>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={handleClearAll}
                  className="hidden md:flex px-3 py-2.5 text-gray-500 hover:text-red-600 transition-colors border border-gray-200 rounded-sm hover:border-red-300"
                  title="Limpiar filtros"
                  aria-label="Limpiar todos los filtros"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Indicador de filtros activos (móvil) */}
          {(selectedArea || selectedVolume || selectedNumber) && (
            <div className="flex flex-wrap gap-2 mt-2 md:hidden">
              {selectedVolume && (
                <span className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-sm">
                  {volumeLabel} {selectedVolume}
                  <button
                    onClick={() => {
                      setSelectedVolume('');
                      onSearch(localSearch, selectedArea, '', selectedNumber);
                    }}
                    className="ml-1 hover:text-blue-900"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {selectedNumber && (
                <span className="inline-flex items-center px-2 py-1 bg-green-50 text-green-700 text-xs rounded-sm">
                  {numberLabel} {selectedNumber}
                  <button
                    onClick={() => {
                      setSelectedNumber('');
                      onSearch(localSearch, selectedArea, selectedVolume, '');
                    }}
                    className="ml-1 hover:text-green-900"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {selectedArea && (
                <span className="inline-flex items-center px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-sm">
                  {selectedArea.length > 20 ? selectedArea.substring(0, 20) + '...' : selectedArea}
                  <button
                    onClick={() => {
                      setSelectedArea('');
                      onSearch(localSearch, '', selectedVolume, selectedNumber);
                    }}
                    className="ml-1 hover:text-purple-900"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SearchAndFilters;