// src/components/NewsletterModal.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import NewsletterSubscription from './NewsletterSubscription';
import { useLanguage } from '../hooks/useLanguage';

const NewsletterModal = ({ 
  delay = 30000, // 30 segundos por defecto
  scrollTrigger = 0.4, // 40% del scroll
  cookieKey = 'newsletter_modal_dismissed',
  cookieExpirationDays = 7 // Reaparece después de 7 días si se cierra
}) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  const [isOpen, setIsOpen] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Textos bilingües
  const texts = {
    title: isSpanish ? 'Mantente Informado' : 'Stay Informed',
    subtitle: isSpanish 
      ? 'Recibe las últimas publicaciones científicas directamente en tu correo' 
      : 'Receive the latest scientific publications directly in your inbox',
    close: isSpanish ? 'Cerrar' : 'Close',
    noThanks: isSpanish ? 'No, gracias' : 'No, thanks'
  };

  // Verificar si el modal ya fue descartado
  const checkCookie = () => {
    const cookies = document.cookie.split(';');
    const modalCookie = cookies.find(c => c.trim().startsWith(`${cookieKey}=`));
    return modalCookie ? true : false;
  };

  // Establecer cookie para evitar mostrar el modal nuevamente
  const setCookie = () => {
    const date = new Date();
    date.setTime(date.getTime() + (cookieExpirationDays * 24 * 60 * 60 * 1000));
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${cookieKey}=true; ${expires}; path=/`;
  };

  // Función para abrir el modal
  const openModal = () => {
    if (!checkCookie() && !hasInteracted) {
      setIsOpen(true);
    }
  };

  // Efecto para abrir después del delay
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!checkCookie() && !hasInteracted) {
        setIsOpen(true);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, hasInteracted]);

  // Efecto para abrir al hacer scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercentage = (scrollPosition / totalHeight) * 100;

      if (scrollPercentage >= (scrollTrigger * 100) && !checkCookie() && !hasInteracted) {
        setIsOpen(true);
        window.removeEventListener('scroll', handleScroll);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [scrollTrigger, hasInteracted]);

  // Bloquear scroll del body cuando el modal está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Manejar cierre
  const handleClose = () => {
    setIsOpen(false);
    setHasInteracted(true);
    setCookie();
  };

  // Manejar éxito de suscripción
  const handleSuccess = () => {
    setHasInteracted(true);
    setCookie();
    // Mantener abierto por 2 segundos para mostrar el mensaje de éxito
    setTimeout(() => {
      setIsOpen(false);
    }, 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-[#1a1a1a]/80 backdrop-blur-sm"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="relative bg-white rounded-sm shadow-2xl w-full max-w-lg overflow-hidden"
          >
            {/* Barra de acento superior */}
            <div className="h-2 w-full bg-[#007398]" />

            {/* Botón de cierre */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 transition-colors bg-white/80 rounded-full p-2 backdrop-blur-sm"
              aria-label={texts.close}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Contenido */}
            <div className="p-8">
              {/* Header del modal */}
              <div className="text-center mb-8">
                <h3 className="text-3xl font-serif font-bold text-gray-900 mb-3">
                  {texts.title}
                </h3>
                <div className="w-12 h-1 bg-[#007398] mx-auto mb-4" />
                <p className="text-gray-600 font-serif italic text-sm">
                  {texts.subtitle}
                </p>
              </div>

              {/* Componente de suscripción */}
              <NewsletterSubscription 
                variant="compact" 
                showTitle={false}
                onSuccess={handleSuccess}
              />

              {/* Botón de no gracias */}
              <button
                onClick={handleClose}
                className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors mt-4"
              >
                {texts.noThanks}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NewsletterModal;