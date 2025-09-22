'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';

export default function NewsletterSection() {
  const t = useTranslations('NewsletterSection');
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [enviado, setEnviado] = useState(false);

  const scriptURL = process.env.NEXT_PUBLIC_NEWSLETTER_GAS_URL || 'https://script.google.com/macros/s/AKfycbzyyR93tD85nPprIKAR_IDoWYBSAnlFwVes09rJgOM3KQsByg_MgzafWDK1BcFhfVJHew/exec';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new URLSearchParams();
    formData.append('nombre', nombre);
    formData.append('correo', correo);

    try {
      const response = await fetch(scriptURL, { method: 'POST', body: formData });
      if (!response.ok) throw new Error(t('errors.submitError', { status: response.status }));
      await response.text();
      setEnviado(true);
      setNombre('');
      setCorreo('');
    } catch (err) {
      alert(t('errors.submitError', { message: err.message }));
    }
  };

  return (
    <section className="newsletter-section bg-[#f5f0e6] text-[#4b3b2a] p-6 sm:p-12 rounded-lg shadow-lg max-w-2xl mx-auto my-8 text-center">
      <h2 className="text-2xl sm:text-3xl font-serif mb-4">{t('title')}</h2>
      <p className="mb-6 text-sm sm:text-base">{t('description')}</p>

      {!enviado ? (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row justify-center items-center gap-4">
          <input
            type="text"
            placeholder={t('namePlaceholder')}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            className="p-2 rounded border border-gray-400 w-full sm:w-auto flex-1 text-gray-800"
          />
          <input
            type="email"
            placeholder={t('emailPlaceholder')}
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            required
            className="p-2 rounded border border-gray-400 w-full sm:w-auto flex-1 text-gray-800"
          />
          <button
            type="submit"
            className="bg-[#800020] text-white px-4 py-2 rounded hover:bg-[#5a0015] transition-colors"
          >
            {t('subscribeButton')}
          </button>
        </form>
      ) : (
        <p className="text-green-700 font-semibold mt-4">{t('successMessage')}</p>
      )}
    </section>
  );
}