// src/components/NewsletterModal.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import NewsletterSubscription from './NewsletterSubscription';
import { useLanguage } from '../hooks/useLanguage';

const NewsletterModal = ({ 
  delay = 45000, // 45 segundos
  scrollTrigger = 0.5, // 50% del scroll
  cookieKey = 'newsletter_modal_dismissed',
  cookieExpirationDays = 90 // 3 meses (90 días)
}) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  const [isOpen, setIsOpen] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Textos bilingües con tono editorial
  const texts = {
    eyebrow: isSpanish ? 'Boletín Científico' : 'Scientific Newsletter',
    title: isSpanish ? 'Únase a Nuestra Comunidad Académica' : 'Join Our Academic Community',
    subtitle: isSpanish 
      ? 'Reciba las últimas investigaciones revisadas por pares directamente en su correo electrónico' 
      : 'Receive the latest peer-reviewed research directly in your inbox',
    placeholder: isSpanish ? 'Su correo institucional' : 'Your institutional email',
    subscribe: isSpanish ? 'Suscribirse' : 'Subscribe',
    close: isSpanish ? 'Cerrar' : 'Close',
    noThanks: isSpanish ? 'No, gracias' : 'No, thanks',
    success: isSpanish 
      ? 'Suscripción exitosa. Bienvenido a nuestra comunidad.' 
      : 'Subscription successful. Welcome to our community.'
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
    // Mantener abierto por 2.5 segundos para mostrar el mensaje de éxito
    setTimeout(() => {
      setIsOpen(false);
    }, 2500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="fixed bottom-6 right-6 z-[90] max-w-md w-[calc(100%-3rem)]"
        >
          {/* Tarjeta flotante estilo editorial */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative bg-white shadow-xl overflow-hidden"
            style={{
              borderTop: '3px solid #007398',
              borderBottom: '1px solid #e5e5e5',
              borderLeft: '1px solid #e5e5e5',
              borderRight: '1px solid #e5e5e5'
            }}
          >
            {/* Botón de cierre minimalista */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 transition-colors p-1"
              aria-label={texts.close}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Contenido con padding editorial */}
            <div className="p-8">
              {/* Eyebrow text */}
              <p className="text-xs font-semibold uppercase tracking-widest text-[#007398] mb-3">
                {texts.eyebrow}
              </p>

              {/* Título serif */}
              <h3 className="text-2xl font-serif font-bold text-gray-900 mb-4 leading-tight">
                {texts.title}
              </h3>

              {/* Línea divisoria */}
              <div className="w-12 h-px bg-gray-300 mb-4"></div>

              {/* Subtítulo */}
              <p className="text-gray-600 font-serif italic text-sm leading-relaxed mb-6">
                {texts.subtitle}
              </p>

              {/* Componente de suscripción */}
              <NewsletterSubscription 
                variant="compact" 
                showTitle={false}
                onSuccess={handleSuccess}
              />

              {/* Separador sutil */}
              <div className="mt-4 pt-3 border-t border-gray-100">
                <button
                  onClick={handleClose}
                  className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors font-serif italic"
                >
                  {texts.noThanks}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NewsletterModal;