// SearchAndFilters.js
import React from 'react';
function SearchAndFilters({
  searchTerm,
  setSearchTerm,
  selectedArea,
  setSelectedArea,
  areas,
  onSearch,
  clearFilters,
  placeholder = "Buscar en el archivo...",
  quickTags = [],
  selectedVolume,
  setSelectedVolume,
  volumesList,
  selectedNumber,
  setSelectedNumber,
  numbersList
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-sm shadow-sm mb-8 overflow-hidden">
      {/* Cabecera sutil del buscador */}
      <div className="bg-gray-50 px-6 py-2 border-b border-gray-200">
        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-500">
          Herramientas de búsqueda y filtrado
        </span>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
          {/* Campo de búsqueda principal */}
          <div className="lg:col-span-5 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={placeholder}
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-sm text-sm focus:ring-1 focus:ring-[#007398] focus:border-[#007398] transition-all outline-none text-gray-700"
            />
          </div>
          {/* Selector de Volúmenes */}
          <div className="lg:col-span-2">
            <select
              value={selectedVolume}
              onChange={(e) => setSelectedVolume(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-sm text-sm focus:ring-1 focus:ring-[#007398] focus:border-[#007398] appearance-none cursor-pointer text-gray-600"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.75rem center',
                backgroundSize: '1rem'
              }}
            >
              <option value="">Todos los volúmenes</option>
              {volumesList.map((vol) => (
                <option key={vol} value={vol}>{vol}</option>
              ))}
            </select>
          </div>
          {/* Selector de Números */}
          <div className="lg:col-span-2">
            <select
              value={selectedNumber}
              onChange={(e) => setSelectedNumber(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-sm text-sm focus:ring-1 focus:ring-[#007398] focus:border-[#007398] appearance-none cursor-pointer text-gray-600"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.75rem center',
                backgroundSize: '1rem'
              }}
            >
              <option value="">Todos los números</option>
              {numbersList.map((num) => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
          </div>
          {/* Selector de Áreas */}
          <div className="lg:col-span-2">
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-sm text-sm focus:ring-1 focus:ring-[#007398] focus:border-[#007398] appearance-none cursor-pointer text-gray-600"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.75rem center',
                backgroundSize: '1rem'
              }}
            >
              <option value="">Todas las disciplinas</option>
              {areas.map((area) => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </div>
          {/* Botones de acción */}
          <div className="lg:col-span-1 flex gap-2">
            <button
              onClick={() => onSearch(searchTerm, selectedArea, selectedVolume, selectedNumber)}
              className="flex-1 bg-[#007398] text-white py-3 px-4 rounded-sm text-xs font-bold uppercase tracking-wider hover:bg-[#005a77] transition-colors shadow-sm"
            >
              Filtrar
            </button>
            <button
              onClick={clearFilters}
              title="Limpiar filtros"
              className="px-4 py-3 bg-gray-100 text-gray-500 rounded-sm hover:bg-gray-200 transition-colors border border-gray-200"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        {/* Sugerencias de búsqueda rápida (Tags) */}
        {quickTags.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-[11px] text-gray-400 font-medium">Búsqueda rápida:</span>
            {quickTags.map((tag) => (
              <button
                key={tag}
                onClick={() => {
                  setSearchTerm(tag);
                  onSearch(tag, selectedArea, selectedVolume, selectedNumber);
                }}
                className="text-[10px] px-2 py-1 bg-gray-50 text-gray-500 border border-gray-200 rounded-full hover:border-[#007398] hover:text-[#007398] transition-all"
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
export default SearchAndFilters;