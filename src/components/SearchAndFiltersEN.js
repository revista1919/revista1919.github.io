import React from 'react';
import { useTranslation } from 'react-i18next';

function SearchAndFilters({ searchTerm, setSearchTerm, selectedArea, setSelectedArea, areas, onSearch, clearFilters }) {
  return React.createElement(
    'div',
    { className: 'search-filters bg-white p-4 sm:p-6 rounded-lg shadow-md mb-4 sm:mb-6' },
    React.createElement('input', {
      type: 'text',
      value: searchTerm,
      onChange: (e) => setSearchTerm(e.target.value),
      placeholder: 'Buscar artículos...',
      className: 'w-full p-2 sm:p-3 text-sm sm:text-base border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3 sm:mb-4',
    }),
    React.createElement(
      'select',
      {
        value: selectedArea,
        onChange: (e) => setSelectedArea(e.target.value),
        className: 'w-full p-2 sm:p-3 text-sm sm:text-base border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3 sm:mb-4',
      },
      React.createElement('option', { value: '' }, 'Todas las áreas'),
      ...areas.map(area =>
        React.createElement('option', { key: area, value: area }, area)
      )
    ),
    React.createElement(
      'div',
      { className: 'flex flex-col sm:flex-row gap-2 sm:gap-3' },
      React.createElement('button', {
        onClick: () => onSearch(searchTerm, selectedArea),
        className: 'bg-blue-500 text-white p-2 sm:p-3 text-sm sm:text-base rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500',
      }, 'Buscar'),
      React.createElement('button', {
        onClick: clearFilters,
        className: 'bg-gray-500 text-white p-2 sm:p-3 text-sm sm:text-base rounded hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500',
      }, 'Limpiar Filtros')
    )
  );
}

export default SearchAndFilters;