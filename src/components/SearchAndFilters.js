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

  return (
    <div className="bg-white border border-gray-200 rounded-sm shadow-sm mb-6 md:mb-8 overflow-hidden">
      {/* Cabecera compacta */}
      <div className="bg-gray-50 px-4 md:px-6 py-2 border-b border-gray-200 flex justify-between items-center">
        <span className="text-[9px] md:text-[10px] uppercase tracking-[0.2em] font-bold text-gray-500">
          Buscador de archivo
        </span>
        {/* Botón para limpiar rápido en móvil */}
        {(localSearch || selectedArea || selectedVolume || selectedNumber) && (
          <button 
            onClick={handleClearAll}
            className="text-[9px] font-bold text-red-500 uppercase md:hidden hover:text-red-700 transition-colors"
          >
            Limpiar todo
          </button>
        )}
      </div>

      <div className="p-3 md:p-6">
        <div className="flex flex-col gap-3">
          
          {/* Fila Principal: Buscador + Botón Filtros (Móvil) */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={localSearch}
                onChange={handleSearchChange}
                onKeyPress={handleKeyPress}
                placeholder={placeholder}
                className="w-full pl-9 pr-4 py-2.5 md:py-3 bg-white border border-gray-300 rounded-sm text-sm focus:ring-1 focus:ring-[#007398] focus:border-[#007398] outline-none text-gray-700"
                aria-label={placeholder}
              />
              {localSearch && (
                <button
                  onClick={() => {
                    setLocalSearch('');
                    setSearchTerm('');
                    onSearch('', selectedArea, selectedVolume, selectedNumber);
                  }}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label="Limpiar búsqueda"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            
            {/* Botón de Toggle Filtros para Celular */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`md:hidden px-4 py-2 border rounded-sm transition-colors ${
                showFilters 
                  ? 'bg-[#007398] text-white border-[#007398]' 
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
              aria-label={showFilters ? "Ocultar filtros" : "Mostrar filtros"}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
          </div>

          {/* Panel de Filtros: Visible siempre en desktop, colapsable en móvil */}
          <div className={`${showFilters ? 'grid' : 'hidden'} md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-2 md:pt-0`}>
            
            {/* Selector de Volúmenes */}
            <div className="lg:col-span-3">
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
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-600 outline-none focus:ring-1 focus:ring-[#007398] focus:border-[#007398]"
                aria-label={`Filtrar por ${volumeLabel.toLowerCase()}`}
              >
                <option value="">{volumeLabel}: Todos</option>
                {volumesList.map((vol) => (
                  <option key={vol} value={vol}>
                    {volumeLabel} {vol}
                  </option>
                ))}
              </select>
            </div>

            {/* Selector de Números */}
            <div className="lg:col-span-3">
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
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-600 outline-none focus:ring-1 focus:ring-[#007398] focus:border-[#007398]"
                aria-label={`Filtrar por ${numberLabel.toLowerCase()}`}
              >
                <option value="">{numberLabel}: Todos</option>
                {numbersList.map((num) => (
                  <option key={num} value={num}>
                    {numberLabel} {num}
                  </option>
                ))}
              </select>
            </div>

            {/* Selector de Áreas */}
            <div className="lg:col-span-4">
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
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-600 outline-none focus:ring-1 focus:ring-[#007398] focus:border-[#007398]"
                aria-label="Filtrar por disciplina"
              >
                <option value="">Todas las disciplinas</option>
                {areas.map((area) => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>

            {/* Botones de acción */}
            <div className="lg:col-span-2 flex gap-2">
              <button
                onClick={handleApplyFilters}
                className="flex-1 bg-[#007398] text-white py-2.5 px-4 rounded-sm text-xs font-bold uppercase tracking-wider hover:bg-[#005a77] transition-colors shadow-sm"
              >
                Aplicar
              </button>
              <button
                onClick={handleClearAll}
                className="hidden md:flex px-4 py-2.5 bg-gray-100 text-gray-600 rounded-sm hover:bg-gray-200 transition-colors border border-gray-200"
                aria-label="Limpiar todos los filtros"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
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
                  {selectedArea.substring(0, 20)}...
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