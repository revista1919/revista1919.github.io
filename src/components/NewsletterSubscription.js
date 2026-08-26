// src/components/NewsletterSubscription.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  setDoc,
  serverTimestamp,
  doc
} from 'firebase/firestore';
import { useLanguage } from '../hooks/useLanguage';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyArr3LE_hQLZG0L5m9JND2OWVL8elnSyWk",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "usuarios-rnce.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "usuarios-rnce",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "usuarios-rnce.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "688242139131",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:688242139131:web:3a98663545e73110c3f55e",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-K90MKB7BDP"
};

let app;
let db;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (error) {
  console.error('Error initializing Firebase:', error);
}

const CHECK_SUBSCRIPTION_URL = 'https://us-central1-usuarios-rnce.cloudfunctions.net/checkSubscription';

const Icons = {
  email: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="M2 7l10 6 10-6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  user: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" strokeLinecap="round"/>
    </svg>
  ),
  settings: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" strokeLinecap="round"/>
    </svg>
  ),
  check: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  chevronDown: (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  biology: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" strokeLinecap="round"/>
    </svg>
  ),
  chemistry: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 3h6M10 3v5.5L4.5 18a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 8.5V3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.5 14h9" strokeLinecap="round"/>
    </svg>
  ),
  physics: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
      <ellipse cx="12" cy="12" rx="9" ry="3.5"/>
      <ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(60 12 12)"/>
      <ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(120 12 12)"/>
    </svg>
  ),
  mathematics: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 4h16v16H4z" strokeDasharray="2 2"/>
      <path d="M8 20V4M14 20V4M4 8h16M4 16h16" strokeLinecap="round"/>
    </svg>
  ),
  computer: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="4" width="18" height="12" rx="1"/>
      <path d="M8 20h8M12 16v4" strokeLinecap="round"/>
    </svg>
  ),
  astronomy: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" fill="currentColor"/>
      <circle cx="18" cy="18" r="2"/>
      <circle cx="6" cy="19" r="1"/>
      <circle cx="19" cy="5" r="1"/>
    </svg>
  ),
  geology: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 22l-8-8 8-8 8 8z" strokeLinejoin="round"/>
      <path d="M4 14l8-8 8 8" strokeLinejoin="round"/>
    </svg>
  ),
  medicine: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 3v18M3 12h18" strokeLinecap="round"/>
      <circle cx="12" cy="12" r="8"/>
    </svg>
  ),
  engineering: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round"/>
      <circle cx="12" cy="12" r="7" strokeDasharray="3 2"/>
    </svg>
  ),
  social: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="9" cy="9" r="3"/>
      <path d="M16 8a4 4 0 0 0-8 0c0 5-4 6-4 6h12s-4-1-4-6" strokeLinecap="round"/>
    </svg>
  ),
  environment: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 22c4-4 8-8 8-13a8 8 0 0 0-16 0c0 5 4 9 8 13z" strokeLinejoin="round"/>
      <path d="M12 8v4M10 10h4" strokeLinecap="round"/>
    </svg>
  ),
  neuroscience: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2a3 3 0 0 1 3 3c0 2-1 4-3 5-2-1-3-3-3-5a3 3 0 0 1 3-3z" strokeLinejoin="round"/>
      <path d="M9 12c0-2-1-4-3-5M15 12c0 2 1 4 3 5M12 10v4M9 14H6M15 14h3" strokeLinecap="round"/>
    </svg>
  )
};

const AREAS = [
  { id: 'biologia', labelEs: 'Biología', labelEn: 'Biology', icon: Icons.biology },
  { id: 'quimica', labelEs: 'Química', labelEn: 'Chemistry', icon: Icons.chemistry },
  { id: 'fisica', labelEs: 'Física', labelEn: 'Physics', icon: Icons.physics },
  { id: 'matematica', labelEs: 'Matemática', labelEn: 'Mathematics', icon: Icons.mathematics },
  { id: 'computacion', labelEs: 'Computación', labelEn: 'Computer Science', icon: Icons.computer },
  { id: 'astronomia', labelEs: 'Astronomía', labelEn: 'Astronomy', icon: Icons.astronomy },
  { id: 'geologia', labelEs: 'Geología', labelEn: 'Geology', icon: Icons.geology },
  { id: 'medicina', labelEs: 'Medicina', labelEn: 'Medicine', icon: Icons.medicine },
  { id: 'ingenieria', labelEs: 'Ingeniería', labelEn: 'Engineering', icon: Icons.engineering },
  { id: 'ciencias_sociales', labelEs: 'Ciencias Sociales', labelEn: 'Social Sciences', icon: Icons.social },
  { id: 'medio_ambiente', labelEs: 'Medio Ambiente', labelEn: 'Environment', icon: Icons.environment },
  { id: 'neurociencia', labelEs: 'Neurociencia', labelEn: 'Neuroscience', icon: Icons.neuroscience }
];

const FREQUENCIES = [
  { id: 'inmediato', labelEs: 'Inmediato', labelEn: 'Immediate', descEs: 'Noticias al instante', descEn: 'Instant news' },
  { id: 'diario', labelEs: 'Diario', labelEn: 'Daily', descEs: 'Resumen diario', descEn: 'Daily digest' },
  { id: 'semanal', labelEs: 'Semanal', labelEn: 'Weekly', descEs: 'Cada lunes', descEn: 'Every Monday' },
  { id: 'mensual', labelEs: 'Mensual', labelEn: 'Monthly', descEs: 'Boletín mensual', descEn: 'Monthly bulletin' }
];

const DEFAULT_PREFERENCES = {
  areas: AREAS.map(area => area.id),
  frecuencia: 'inmediato',
  idioma: 'es',
  notificaciones: {
    nuevas_publicaciones: true,
    convocatorias: true,
    eventos: true,
    oportunidades: false
  }
};

export default function NewsletterSubscription({ 
  variant = 'default',
  className = '',
  showTitle = true,
  onSuccess = null,
  onError = null
}) {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [successMessage, setSuccessMessage] = useState('');

  const texts = {
    title: isSpanish ? 'Boletín Informativo' : 'Newsletter',
    subtitle: isSpanish ? 'Reciba las últimas noticias científicas' : 'Receive the latest scientific news',
    namePlaceholder: isSpanish ? 'Tu nombre completo' : 'Your full name',
    emailPlaceholder: isSpanish ? 'correo@ejemplo.edu' : 'email@example.edu',
    subscribe: isSpanish ? 'Suscribirse' : 'Subscribe',
    subscribing: isSpanish ? 'Procesando...' : 'Processing...',
    advanced: isSpanish ? 'Preferencias avanzadas' : 'Advanced preferences',
    hideAdvanced: isSpanish ? 'Ocultar preferencias' : 'Hide preferences',
    frequency: isSpanish ? 'Frecuencia de envío' : 'Sending frequency',
    areas: isSpanish ? 'Áreas de interés' : 'Areas of interest',
    confirm: isSpanish ? 'Confirmar Suscripción' : 'Confirm Subscription',
    cancel: isSpanish ? 'Cancelar' : 'Cancel',
    successTitle: isSpanish ? '¡Gracias por suscribirte!' : 'Thank you for subscribing!',
    successMessage: isSpanish ? 'Recibirás noticias según tus preferencias' : 'You will receive news according to your preferences',
    alreadySubscribed: isSpanish ? 'Este correo ya está suscrito a nuestro boletín' : 'This email is already subscribed to our newsletter',
    invalidName: isSpanish ? 'Por favor ingresa tu nombre' : 'Please enter your name',
    invalidEmail: isSpanish ? 'Por favor ingresa un correo válido' : 'Please enter a valid email',
    generalError: isSpanish ? 'Error al procesar la suscripción. Posiblemente usted ya está suscrito con este correo' : 'Error processing subscription. You are likely already subscribed with this email'
  };

  const checkExistingSubscription = async (email) => {
    try {
      const response = await fetch(`${CHECK_SUBSCRIPTION_URL}?email=${encodeURIComponent(email.toLowerCase())}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      return data.subscription || null;
      
    } catch (error) {
      console.error('Error checking subscription:', error);
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (subscribing) return;

    if (!nombre.trim()) {
      setError(texts.invalidName);
      return;
    }
    if (!correo.trim() || !correo.includes('@')) {
      setError(texts.invalidEmail);
      return;
    }

    setSubscribing(true);
    setError('');

    try {
      const existing = await checkExistingSubscription(correo);
      
      if (existing && existing.active) {
        setError(texts.alreadySubscribed);
        setSubscribing(false);
        return;
      }

      const emailNormalizado = correo.toLowerCase().trim();
      const emailId = emailNormalizado.replace(/[^a-z0-9]/g, '_');
      const docRef = doc(db, 'newsletter', emailId);
      
      const subscriptionData = {
        email: emailNormalizado,
        nombre: nombre.trim(),
        idioma: isSpanish ? 'es' : 'en',
        active: true,
        preferences: {
          ...preferences,
          idioma: isSpanish ? 'es' : 'en'
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastSentAt: null,
        lastSentNews: [],
        welcomeEmailSentAt: null,
        welcomeEmailStatus: 'pending'
      };

      await setDoc(docRef, subscriptionData);

      setEnviado(true);
      setNombre('');
      setCorreo('');
      setShowAdvanced(false);
      setPreferences(DEFAULT_PREFERENCES);
      setSuccessMessage(texts.successMessage);

      if (onSuccess) onSuccess(subscriptionData);

      setTimeout(() => {
        setEnviado(false);
        setSuccessMessage('');
      }, 5000);

    } catch (error) {
      console.error('Error subscribing:', error);
      
      if (error.code === 'permission-denied') {
        setError(texts.alreadySubscribed);
      } else {
        setError(texts.generalError);
      }
      
      if (onError) onError(error);
    } finally {
      setSubscribing(false);
    }
  };

  const toggleArea = (areaId) => {
    setPreferences(prev => ({
      ...prev,
      areas: prev.areas.includes(areaId)
        ? prev.areas.filter(a => a !== areaId)
        : [...prev.areas, areaId]
    }));
  };

  const variants = {
    default: {
      container: 'bg-white text-gray-900',
      box: 'bg-gray-50 p-6 border border-gray-200',
      input: 'bg-white border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:border-[#004b87] focus:ring-1 focus:ring-[#004b87] transition-all',
      button: 'bg-black text-white px-6 py-3 text-xs uppercase font-bold tracking-wider hover:bg-[#004b87] transition-all',
      title: 'text-[10px] uppercase tracking-widest font-bold text-gray-500'
    },
    footer: {
      container: 'text-white',
      box: 'bg-transparent',
      input: 'bg-transparent border-b border-gray-700 py-2 px-1 text-sm focus:border-[#004b87] outline-none transition-colors text-white placeholder-gray-500',
      button: 'text-[10px] uppercase tracking-[0.2em] font-bold border border-gray-600 px-6 py-3 hover:bg-white hover:text-black transition-all',
      title: 'text-[10px] uppercase tracking-[0.3em] text-gray-500'
    },
    compact: {
      container: 'bg-white text-gray-900',
      box: 'bg-gray-50 p-4 border border-gray-200',
      input: 'bg-white border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:border-black transition-colors',
      button: 'bg-black text-white px-4 py-1.5 text-[10px] uppercase font-bold hover:bg-[#004b87] transition-colors',
      title: 'text-[10px] uppercase tracking-widest font-bold text-gray-400'
    },
    minimal: {
      container: 'bg-transparent',
      box: 'bg-transparent',
      input: 'bg-transparent border-b border-gray-300 py-2 px-1 text-sm focus:border-[#004b87] outline-none transition-colors',
      button: 'text-xs uppercase tracking-wider font-bold text-[#004b87] hover:text-[#e86125] transition-colors',
      title: 'text-[10px] uppercase tracking-widest font-bold text-gray-500'
    }
  };

  const style = variants[variant] || variants.default;

  return (
    <motion.div
      className={`${style.container} ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className={style.box}>
        {showTitle && (
          <div className="flex items-center gap-2 mb-4">
            {Icons.email}
            <p className={style.title}>
              {texts.title}
            </p>
          </div>
        )}

        {!enviado ? (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              placeholder={texts.namePlaceholder}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={`w-full ${style.input}`}
              required
            />
            <input
              type="email"
              placeholder={texts.emailPlaceholder}
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              className={`w-full ${style.input}`}
              required
            />

            <button
              type="submit"
              disabled={subscribing}
              className={`w-full ${style.button} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {subscribing ? texts.subscribing : texts.subscribe}
            </button>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-red-600 text-xs text-center"
              >
                {error}
              </motion.p>
            )}

            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-[#004b87] transition-colors py-1"
            >
              {Icons.settings}
              <span>{showAdvanced ? texts.hideAdvanced : texts.advanced}</span>
              {Icons.chevronDown}
            </button>
          </form>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-6"
          >
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-3">
              {Icons.check}
            </div>
            <p className="font-semibold text-sm text-green-600">
              {texts.successTitle}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {successMessage}
            </p>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className={`${style.box} border-t-0 mt-0`}>
              <h3 className="font-serif text-lg font-bold mb-4">
                {texts.advanced}
              </h3>

              <div className="mb-6">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block mb-3">
                  {texts.frequency}
                </label>
                <select
                  value={preferences.frecuencia}
                  onChange={(e) => setPreferences(prev => ({ ...prev, frecuencia: e.target.value }))}
                  className={`w-full ${style.input}`}
                >
                  {FREQUENCIES.map(freq => (
                    <option key={freq.id} value={freq.id}>
                      {isSpanish ? freq.labelEs : freq.labelEn} - {isSpanish ? freq.descEs : freq.descEn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-6">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block mb-3">
                  {texts.areas}
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {AREAS.map(area => (
                    <label
                      key={area.id}
                      className={`flex items-center gap-2 p-2.5 border rounded cursor-pointer transition-all ${
                        preferences.areas.includes(area.id)
                          ? 'border-[#004b87] bg-[#004b87]/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={preferences.areas.includes(area.id)}
                        onChange={() => toggleArea(area.id)}
                        className="hidden"
                      />
                      {area.icon}
                      <span className="text-xs font-medium">
                        {isSpanish ? area.labelEs : area.labelEn}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSubmit}
                  className="flex-1 bg-[#004b87] text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-[#003666] transition-colors"
                >
                  {texts.confirm}
                </button>
                <button
                  onClick={() => setShowAdvanced(false)}
                  className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  {texts.cancel}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}