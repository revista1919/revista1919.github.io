'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

export default function Tabs({ sections, activeTab, setActiveTab }) {
  const t = useTranslations('Tabs');
  return (
    <div className="tabs-container">
      <nav className="bg-[#f8f1e9] shadow-sm border-b-2 border-[#e6d9c6] py-2 sm:py-4">
        <div className="sm:hidden px-2">
          <select
            className="w-full px-2 py-1 text-xs font-medium bg-[#e6d9c6] text-[#5a3e36] rounded-md focus:outline-none focus:ring-2 focus:ring-[#8b6f47]"
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            aria-label={t('selectTab')}
          >
            {sections.map((section) => (
              <option key={section.name} value={section.name}>
                {section.label}
              </option>
            ))}
          </select>
        </div>
        <ul className="hidden sm:flex flex-wrap justify-center gap-4 px-4 max-w-4xl mx-auto">
          {sections.map((section) => (
            <li key={section.name}>
              <button
                className={`px-4 py-2 text-base font-medium rounded-md transition-all duration-300 ${
                  activeTab === section.name
                    ? 'bg-[#8b6f47] text-white shadow-md'
                    : 'bg-[#e6d9c6] text-[#5a3e36] hover:bg-[#d9c8a9] hover:text-[#5a3e36]'
                } focus:outline-none focus:ring-2 focus:ring-[#8b6f47]`}
                onClick={() => setActiveTab(section.name)}
                aria-label={t('goToTab', { label: section.label })}
              >
                {section.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <main className="flex-grow">
        {sections.find((section) => section.name === activeTab)?.component || null}
      </main>
    </div>
  );
}