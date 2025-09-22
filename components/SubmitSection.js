'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

export default function SubmitSection() {
  const t = useTranslations('SubmitSection');
  return (
    <div className="submit-section bg-white p-4 sm:p-6 rounded-lg shadow-md mt-4 sm:mt-6">
      <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">{t('title')}</h2>
      <p className="text-sm sm:text-base mb-3 sm:mb-4">
        <strong>{t('importantNote')}</strong> {t('formInstruction')}
      </p>
      <div className="relative w-full h-96 sm:h-[600px]">
        <iframe
          src="https://docs.google.com/forms/d/e/1FAIpQLSf3oTgTOurPOKTmUeBMYxq1XtVLHkI6R0l9CoqFmMyLOlEefg/viewform?embedded=true"
          className="w-full h-full"
          frameBorder="0"
          marginHeight="0"
          marginWidth="0"
        >
          {t('loading')}
        </iframe>
      </div>
    </div>
  );
}