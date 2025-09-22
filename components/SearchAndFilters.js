'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

export default function SearchAndFilters({ searchTerm, setSearchTerm, selectedArea, setSelectedArea, areas, onSearch, clearFilters }) {
  const t = useTranslations('SearchAndFilters');
  return (
    <div className="search-filters bg-white p-4 sm:p-6 rounded-lg shadow-md mb-4 sm:mb-6">
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder={t('searchPlaceholder')}
        className="w-full p-2 sm:p-3 text-sm sm:text-base border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3 sm:mb-4"
      />
      <select
        value={selectedArea}
        onChange={(e) => setSelectedArea(e.target.value)}
        className="w-full p-2 sm:p-3 text-sm sm:text-base border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3 sm:mb-4"
      >
        <option value="">{t('allAreas')}</option>
        {areas.map(area => (
          <option key={area} value={area}>{area}</option>
        ))}
      </select>
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <button
          onClick={() => onSearch(searchTerm, selectedArea)}
          className="bg-blue-500 text-white p-2 sm:p-3 text-sm sm:text-base rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {t('searchButton')}
        </button>
        <button
          onClick={clearFilters}
          className="bg-gray-500 text-white p-2 sm:p-3 text-sm sm:text-base rounded hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          {t('clearFiltersButton')}
        </button>
      </div>
    </div>
  );
}