import React, { useState, useEffect } from 'react';

function SearchAndFilters({
  searchTerm,
  setSearchTerm,
  selectedArea,
  setSelectedArea,
  areas,
  onSearch,
  clearFilters,
  placeholder = "Buscar título, autor o palabra clave...",
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
    <div className="bg-white border border-slate-200 shadow-sm rounded-sm mb-8">
      {/* Zona de Búsqueda Principal (ScienceDirect Style) */}
      <div className="p-6 border-b border-slate-200 bg-[#002B49] text-white">
        <h2 className="font-serif text-2xl font-semibold mb-4">Explorar Archivo Histórico</h2>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={localSearch}
              onChange={handleSearchChange}
              onKeyPress={handleKeyPress}
              placeholder={placeholder}
              className="w-full pl-11 pr-4 py-3.5 bg-white text-slate-900 font-sans text-sm outline-none rounded-sm focus:ring-2 focus:ring-[#FF7900] shadow-inner placeholder:text-slate-400"
              aria-label={placeholder}
            />
            {localSearch && (
              <button
                onClick={() => {
                  setLocalSearch('');
                  setSearchTerm('');
                  onSearch('', selectedArea, selectedVolume, selectedNumber);
                }}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="Limpiar búsqueda"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={() => onSearch(localSearch, selectedArea, selectedVolume, selectedNumber)}
            className="bg-[#FF7900] hover:bg-[#E06A00] text-white font-bold uppercase tracking-widest text-[11px] py-3.5 px-8 transition-colors rounded-sm shadow-sm md:w-auto w-full"
          >
            Buscar
          </button>
        </div>
      </div>

      {/* Filtros Secundarios (Fila inferior) */}
      <div className="bg-slate-50 px-6 py-3 flex flex-col md:flex-row flex-wrap items-center gap-4">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest md:mr-2">Refinar por:</span>
        
        <select 
          value={selectedArea} 
          onChange={(e) => {
            setSelectedArea(e.target.value);
            onSearch(localSearch, e.target.value, selectedVolume, selectedNumber);
          }}
          className="bg-transparent text-sm font-medium text-[#002B49] border-none outline-none cursor-pointer hover:bg-slate-200 py-1.5 px-2 rounded-sm transition-colors"
          aria-label="Filtrar por disciplina"
        >
          <option value="">Todas las Disciplinas</option>
          {areas.map((area) => (
            <option key={area} value={area}>{area}</option>
          ))}
        </select>

        <span className="hidden md:inline text-slate-300">|</span>

        <select 
          value={selectedVolume} 
          onChange={(e) => {
            setSelectedVolume(e.target.value);
            onSearch(localSearch, selectedArea, e.target.value, selectedNumber);
          }}
          className="bg-transparent text-sm font-medium text-[#002B49] border-none outline-none cursor-pointer hover:bg-slate-200 py-1.5 px-2 rounded-sm transition-colors"
          aria-label={`Filtrar por ${volumeLabel.toLowerCase()}`}
        >
          <option value="">Cualquier Volumen</option>
          {volumesList.map((vol) => (
            <option key={vol} value={vol}>Volumen {vol}</option>
          ))}
        </select>

        <span className="hidden md:inline text-slate-300">|</span>

        <select 
          value={selectedNumber} 
          onChange={(e) => {
            setSelectedNumber(e.target.value);
            onSearch(localSearch, selectedArea, selectedVolume, e.target.value);
          }}
          className="bg-transparent text-sm font-medium text-[#002B49] border-none outline-none cursor-pointer hover:bg-slate-200 py-1.5 px-2 rounded-sm transition-colors"
          aria-label={`Filtrar por ${numberLabel.toLowerCase()}`}
        >
          <option value="">Cualquier Número</option>
          {numbersList.map((num) => (
            <option key={num} value={num}>Número {num}</option>
          ))}
        </select>

        {/* Indicador de filtros activos (móvil) */}
        {(selectedArea || selectedVolume || selectedNumber) && (
          <div className="flex flex-wrap gap-2 md:hidden">
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

        {(localSearch || selectedArea || selectedVolume || selectedNumber) && (
          <button
            onClick={() => {
              setLocalSearch('');
              clearFilters();
            }}
            className="ml-auto text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-red-600 transition-colors flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Limpiar Filtros
          </button>
        )}
      </div>
    </div>
  );
}

export default SearchAndFilters;