'use client';

import { useTranslations } from 'next-intl';

export default function AboutSection() {
  const t = useTranslations();

  return (
    <div className="about-section bg-white p-4 sm:p-6 rounded-lg shadow-md mt-4 sm:mt-6">
      <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">{t('whoWeAre')}</h2>
      <p className="text-sm sm:text-base mb-2 sm:mb-3">{t('aboutDesc1')}</p>
      <p className="text-sm sm:text-base">
        <em>{t('aboutDesc2')}</em>
      </p>
    </div>
  );
}