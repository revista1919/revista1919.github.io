'use client';

import { useTranslations } from 'next-intl';

function FAQSection() {
  const t = useTranslations('FAQSection');

  return (
    <div className="faq-section bg-white p-4 sm:p-6 rounded-lg shadow-md mt-4 sm:mt-6">
      <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">{t('title')}</h2>
      <ul className="list-disc pl-4 sm:pl-5 text-sm sm:text-base">
        <li className="mb-2 sm:mb-3">
          <strong>{t('whoCanPublishQuestion')}</strong> {t('whoCanPublishAnswer')}
        </li>
        <li className="mb-2 sm:mb-3">
          <strong>{t('useAIQuestion')}</strong> {t('useAIAnswer')}
        </li>
        <li className="mb-2 sm:mb-3">
          <strong>{t('responseTimeQuestion')}</strong> {t('responseTimeAnswer')}
        </li>
        <li className="mb-2 sm:mb-3">
          <strong>{t('reviewProcessQuestion')}</strong> {t('reviewProcessAnswer')}
        </li>
        <li className="mb-2 sm:mb-3">
          <strong>{t('formatQuestion')}</strong> {t('formatAnswer')}
        </li>
        <li className="mb-2 sm:mb-3">
          <strong>{t('applyAdminQuestion')}</strong> {t('applyAdminAnswer')}
        </li>
      </ul>
    </div>
  );
}

export default FAQSection;