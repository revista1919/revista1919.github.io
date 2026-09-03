import React, { useState, useEffect } from 'react';

function SearchAndFiltersEN({
  searchTerm,
  setSearchTerm,
  selectedArea,
  setSelectedArea,
  areas,
  onSearch,
  clearFilters,
  placeholder = "Search in the archive...",
  selectedVolume,
  setSelectedVolume,
  volumesList,
  selectedNumber,
  setSelectedNumber,
  numbersList,
  volumeLabel = "Volume",
  numberLabel = "Issue"
}) {
  // Estado para mostrar/ocultar filtros en móvil
  const [showFilters, setShowFilters] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchTerm);
  
  // Estados locales para los filtros (no se aplican inmediatamente)
  const [localArea, setLocalArea] = useState(selectedArea);
  const [localVolume, setLocalVolume] = useState(selectedVolume);
  const [localNumber, setLocalNumber] = useState(selectedNumber);

  // Sincronizar estados locales con los globales
  useEffect(() => {
    setLocalSearch(searchTerm);
    setLocalArea(selectedArea);
    setLocalVolume(selectedVolume);
    setLocalNumber(selectedNumber);
  }, [searchTerm, selectedArea, selectedVolume, selectedNumber]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setLocalSearch(value);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApplyFilters();
    }
  };

  const handleApplyFilters = () => {
    // Aplicar todos los filtros al mismo tiempo
    setSearchTerm(localSearch);
    setSelectedArea(localArea);
    setSelectedVolume(localVolume);
    setSelectedNumber(localNumber);
    onSearch(localSearch, localArea, localVolume, localNumber);
    
    if (window.innerWidth < 768) {
      setShowFilters(false);
    }
  };

  const handleClearAll = () => {
    setLocalSearch('');
    setLocalArea('');
    setLocalVolume('');
    setLocalNumber('');
    clearFilters();
    
    if (window.innerWidth < 768) {
      setShowFilters(false);
    }
  };

  const hasActiveFilters = selectedArea || selectedVolume || selectedNumber || searchTerm;

  return (
    <div className="bg-white border border-gray-200 rounded-sm shadow-sm mb-6 md:mb-8 overflow-hidden">
      {/* Compact header */}
      <div className="bg-gray-50 px-4 md:px-6 py-2 border-b border-gray-200 flex justify-between items-center">
        <span className="text-[9px] md:text-[10px] uppercase tracking-[0.2em] font-bold text-gray-500">
          Archive Search
        </span>
        {/* Quick clear button on mobile */}
        {(localSearch || localArea || localVolume || localNumber) && (
          <button 
            onClick={handleClearAll}
            className="text-[9px] font-bold text-red-500 uppercase md:hidden hover:text-red-700 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="p-3 md:p-6">
        <div className="flex flex-col gap-3">
          
          {/* Main row: Search + Filter Toggle (Mobile) */}
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
                  }}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label="Clear search"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            
            {/* Filter Toggle Button for Mobile */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`md:hidden px-4 py-2 border rounded-sm transition-colors ${
                showFilters 
                  ? 'bg-[#007398] text-white border-[#007398]' 
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
              aria-label={showFilters ? "Hide filters" : "Show filters"}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
          </div>

          {/* Filters Panel: Always visible on desktop, collapsible on mobile */}
          <div className={`${showFilters ? 'grid' : 'hidden'} md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-2 md:pt-0`}>
            
            {/* Volume Selector */}
            <div className="lg:col-span-3">
              <label className="block md:hidden text-[9px] font-bold text-gray-400 uppercase mb-1">
                {volumeLabel}
              </label>
              <select
                value={localVolume}
                onChange={(e) => setLocalVolume(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-600 outline-none focus:ring-1 focus:ring-[#007398] focus:border-[#007398]"
                aria-label={`Filter by ${volumeLabel.toLowerCase()}`}
              >
                <option value="">{volumeLabel}: All</option>
                {volumesList.map((vol) => (
                  <option key={vol} value={vol}>
                    {volumeLabel} {vol}
                  </option>
                ))}
              </select>
            </div>

            {/* Issue/Number Selector */}
            <div className="lg:col-span-3">
              <label className="block md:hidden text-[9px] font-bold text-gray-400 uppercase mb-1">
                {numberLabel}
              </label>
              <select
                value={localNumber}
                onChange={(e) => setLocalNumber(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-600 outline-none focus:ring-1 focus:ring-[#007398] focus:border-[#007398]"
                aria-label={`Filter by ${numberLabel.toLowerCase()}`}
              >
                <option value="">{numberLabel}: All</option>
                {numbersList.map((num) => (
                  <option key={num} value={num}>
                    {numberLabel} {num}
                  </option>
                ))}
              </select>
            </div>

            {/* Area/Discipline Selector */}
            <div className="lg:col-span-4">
              <label className="block md:hidden text-[9px] font-bold text-gray-400 uppercase mb-1">
                Discipline
              </label>
              <select
                value={localArea}
                onChange={(e) => setLocalArea(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-sm text-sm text-gray-600 outline-none focus:ring-1 focus:ring-[#007398] focus:border-[#007398]"
                aria-label="Filter by discipline"
              >
                <option value="">All disciplines</option>
                {areas.map((area) => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>

            {/* Action Buttons */}
            <div className="lg:col-span-2 flex gap-2">
              <button
                onClick={handleApplyFilters}
                className="flex-1 bg-[#007398] text-white py-2.5 px-4 rounded-sm text-xs font-bold uppercase tracking-wider hover:bg-[#005a77] transition-colors shadow-sm"
              >
                Apply
              </button>
              <button
                onClick={handleClearAll}
                className="hidden md:flex px-4 py-2.5 bg-gray-100 text-gray-600 rounded-sm hover:bg-gray-200 transition-colors border border-gray-200"
                aria-label="Clear all filters"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Active filters indicator (mobile) */}
          {(selectedArea || selectedVolume || selectedNumber) && (
            <div className="flex flex-wrap gap-2 mt-2 md:hidden">
              {selectedVolume && (
                <span className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-sm">
                  {volumeLabel} {selectedVolume}
                  <button
                    onClick={() => {
                      setLocalVolume('');
                      setSelectedVolume('');
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
                      setLocalNumber('');
                      setSelectedNumber('');
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
                      setLocalArea('');
                      setSelectedArea('');
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

export default SearchAndFiltersEN;