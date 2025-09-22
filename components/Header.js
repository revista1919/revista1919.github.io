'use client';

import { useTranslations } from 'next-intl';

function Header() {
  const t = useTranslations('Header');

  return (
    <header className="text-white p-3 sm:p-6 mb-4 sm:mb-6 relative" style={{ backgroundColor: '#52262dff' }}>
      <div className="container flex flex-col items-center justify-between">
        <div className="flex flex-col items-center mb-3 sm:mb-0 sm:flex-row sm:items-center">
          <img
            src="/logo.png"
            alt={t('logoAlt')}
            className="h-20 sm:h-24 lg:h-32 mb-2 sm:mb-0 sm:mr-5"
            aria-label={t('logoAria')}
          />
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold italic font-serif text-center">
            {t('title')}
          </h1>
        </div>
        <p className="text-cream-100 text-xs sm:text-sm italic font-serif text-center sm:absolute sm:bottom-2 sm:right-4 sm:text-right">
          {t('subtitle')}
        </p>
      </div>
    </header>
  );
}

export default Header;
