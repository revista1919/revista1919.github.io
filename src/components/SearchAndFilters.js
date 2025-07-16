import React from 'react';

function SearchAndFilters({ searchTerm, setSearchTerm, selectedArea, setSelectedArea, areas, onSearch, clearFilters }) {
  return React.createElement(
    'div',
    { className: 'search-filters bg-white p-4 rounded-lg shadow-md mb-6' },
    React.createElement('input', {
      type: 'text',
      value: searchTerm,
      onChange: (e) => setSearchTerm(e.target.value),
      placeholder: 'Buscar artículos...',
      className: 'w-full p-2 mb-4 border rounded',
    }),
    React.createElement(
      'select',
      {
        value: selectedArea,
        onChange: (e) => setSelectedArea(e.target.value),
        className: 'w-full p-2 mb-4 border rounded',
      },
      React.createElement('option', { value: '' }, 'Todas las áreas'),
      ...areas.map(area =>
        React.createElement('option', { key: area, value: area }, area)
      )
    ),
    React.createElement(
      'div',
      { className: 'flex gap-2' },
      React.createElement('button', {
        onClick: () => onSearch(searchTerm, selectedArea),
        className: 'bg-blue-500 text-white p-2 rounded hover:bg-blue-600',
      }, 'Buscar'),
      React.createElement('button', {
        onClick: clearFilters,
        className: 'bg-gray-500 text-white p-2 rounded hover:bg-gray-600',
      }, 'Limpiar Filtros')
    )
  );
}

export default SearchAndFilters;