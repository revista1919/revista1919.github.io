// src/components/PortalSection.js (VERSIÓN ACTUALIZADA - SIN LÓGICAS ANTIGUAS)
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { ReviewerWorkspace } from './ReviewerWorkspace';
import NewsUploadSection from './NewsUploadSection';
import ArticleAssignmentPanel from './ArticleAssignmentPanel';
import TaskSection from './TaskSection';
import AssignSection from './AssignSection';
import DirectorPanel from './DirectorPanel';
import Admissions from './Admissions';
import DeskReviewPanel from './DeskReviewPanel';
import AuthorSubmissionsPanel from './AuthorSubmissionsPanel'; // <-- NUEVO
import { 
  UserIcon, 
  CameraIcon, 
  LinkIcon,
  EnvelopeIcon,
  XMarkIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { db, onSnapshot, query, collection, doc, updateDoc, uploadImageToImgBB, updateRole } from '../firebase';
import SubmissionForm from './SubmissionForm';
import { useLanguage } from '../hooks/useLanguage';
import { useReviewerAssignment } from '../hooks/useReviewerAssignment';

// <-- NUEVO: Importar funciones de reclamación
import { checkAnonymousProfile, claimAnonymousProfile } from '../firebase';

// ELIMINADO: Todas las constantes de CSV y scripts antiguos
// ASSIGNMENTS_CSV, SCRIPT_URL, RUBRIC_SCRIPT_URL, etc. fueron eliminados

const ES_TO_EN = {
  'Fundador': 'Founder',
  'Co-Fundador': 'Co-Founder',
  'Director General': 'General Director',
  'Subdirector General': 'Deputy General Director',
  'Editor en Jefe': 'Editor-in-Chief',
  'Editor de Sección': 'Section Editor',
  'Editora de Sección': 'Section Editor',
  'Revisor': 'Reviewer',
  'Revisor / Comité Editorial': 'Reviewer',
  'Responsable de Desarrollo Web': 'Web Development Manager',
  'Encargado de Soporte Técnico': 'Technical Support Manager',
  'Encargado de Redes Sociales': 'Social Media Manager',
  'Encargada de Redes Sociales': 'Social Media Manager',
  'Encargado de Asignación de Artículos': 'Article Assignment Manager',
  'Diseñador Gráfico': 'Graphic Designer',
  'Diseñadora Gráfica': 'Graphic Designer',
  'Community Manager': 'Community Manager',
  'Encargado de Nuevos Colaboradores': 'New Collaborators Manager',
  'Encargada de Nuevos Colaboradores': 'New Collaborators Manager',
  'Coordinador de Eventos o Convocatorias': 'Events or Calls Coordinator',
  'Coordinadora de Eventos o Convocatorias': 'Events or Calls Coordinator',
  'Asesor Legal': 'Legal Advisor',
  'Asesora Legal': 'Legal Advisor',
  'Asesor Editorial': 'Editorial Advisor',
  'Asesora Editorial': 'Editorial Advisor',
  'Responsable de Finanzas': 'Finance Manager',
  'Responsable de Transparencia': 'Transparency Manager',
  'Autor': 'Author',
  'Asesor Académico': 'Academic Advisor',
  'Institución Colaboradora': 'Partner Institution'
};

const EN_TO_ES = {
  'Founder': 'Fundador',
  'Co-Founder': 'Co-Fundador',
  'General Director': 'Director General',
  'Deputy General Director': 'Subdirector General',
  'Editor-in-Chief': 'Editor en Jefe',
  'Section Editor': 'Editor de Sección',
  'Reviewer': 'Revisor',
  'Web Development Manager': 'Responsable de Desarrollo Web',
  'Technical Support Manager': 'Encargado de Soporte Técnico',
  'Social Media Manager': 'Encargado de Redes Sociales',
  'Graphic Designer': 'Diseñador Gráfico',
  'New Collaborators Manager': 'Encargado de Nuevos Colaboradores',
  'Events or Calls Coordinator': 'Coordinador de Eventos o Convocatorias',
  'Legal Advisor': 'Asesor Legal',
  'Editorial Advisor': 'Asesor Editorial',
  'Finance Manager': 'Responsable de Finanzas',
  'Transparency Manager': 'Responsable de Transparencia',
  'Author': 'Autor',
  'Article Assignment Manager': 'Encargado de Asignación de Artículos',
  'Partner Institution': 'Institución Colaboradora',
  'Academic Advisor': 'Asesor Académico',
  'Community Manager': 'Community Manager'
};

const ALL_ROLES = Object.keys(ES_TO_EN);

const base64EncodeUnicode = (str) => {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
};

const base64DecodeUnicode = (str) => {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
};

const sanitizeInput = (input) => {
  if (!input) return '';
  return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
              .replace(/on\w+="[^"]*"/gi, '')
              .replace(/\s+/g, ' ')
              .trim();
};

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null, errorInfo: null };
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="text-red-600 text-center p-4">
          Ocurrió un error. Por favor recargue la página.
          <details className="mt-2 text-sm">
            <summary>Detalles del error</summary>
            <pre>{this.state.error?.message}</pre>
            <pre>{this.state.errorInfo?.componentStack}</pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

const localizer = momentLocalizer(moment);

function CalendarComponent({ events, onSelectEvent }) {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  
  return (
    <div className="bg-white border border-gray-200 p-4 md:p-8 rounded-3xl shadow-sm mb-6 overflow-hidden">
      <h3 className="font-serif text-2xl font-bold text-gray-900 mb-4">
        {isSpanish ? 'Calendario de Plazos' : 'Deadline Calendar'}
      </h3>
      <div className="h-[400px] md:h-[600px]">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          onSelectEvent={onSelectEvent}
          views={['month', 'week', 'day', 'agenda']}
          popup
          selectable
          className="rounded-2xl border border-gray-100 overflow-hidden"
          messages={{
            next: isSpanish ? "Siguiente" : "Next",
            previous: isSpanish ? "Anterior" : "Previous",
            today: isSpanish ? "Hoy" : "Today",
            month: isSpanish ? "Mes" : "Month",
            week: isSpanish ? "Semana" : "Week",
            day: isSpanish ? "Día" : "Day",
            agenda: isSpanish ? "Agenda" : "Agenda",
            date: isSpanish ? "Fecha" : "Date",
            time: isSpanish ? "Hora" : "Time",
            event: isSpanish ? "Evento" : "Event",
            noEventsInRange: isSpanish ? "No hay eventos en este rango" : "No events in this range",
            showMore: total => isSpanish ? `+ Ver más (${total})` : `+ Show more (${total})`
          }}
        />
      </div>
    </div>
  );
}

// ==================== COMPONENTE DE TAGS PARA INTERESES ====================
const InterestsTags = ({ value = [], onChange, placeholder }) => {
  const [inputValue, setInputValue] = useState('');
  const { language } = useLanguage();
  const isSpanish = language === 'es';

  const addTag = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
      setInputValue('');
    }
  };

  const removeTag = (index) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {value.map((tag, index) => (
          <motion.div
            key={index}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="group bg-emerald-100 hover:bg-emerald-200 transition-colors text-emerald-800 text-sm font-medium px-4 py-2 rounded-2xl flex items-center gap-2 shadow-sm"
          >
            {tag}
            <button
              onClick={() => removeTag(index)}
              className="text-emerald-600 hover:text-red-600 transition-colors"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 p-4 sm:p-5 bg-gray-50 border-0 rounded-2xl sm:rounded-3xl focus:ring-2 focus:ring-emerald-300 text-sm placeholder-gray-400"
        />
        <button
          onClick={addTag}
          className="px-6 sm:px-8 py-4 sm:py-5 bg-emerald-600 hover:bg-emerald-700 transition-all text-white font-semibold rounded-2xl sm:rounded-3xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 active:scale-95"
        >
          <PlusIcon className="w-5 h-5" />
          {isSpanish ? 'AÑADIR' : 'ADD'}
        </button>
      </div>
    </div>
  );
};

// ==================== PERFIL ====================
const ProfileSection = ({ user }) => {
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lang, setLang] = useState('es');
  const { language } = useLanguage();

  const [form, setForm] = useState({
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    descriptionEs: user.description?.es || '',
    descriptionEn: user.description?.en || '',
    interestsEs: Array.isArray(user.interests?.es) 
      ? user.interests.es 
      : (user.interests?.es ? user.interests.es.split(',').map(s => s.trim()).filter(Boolean) : []),
    interestsEn: Array.isArray(user.interests?.en) 
      ? user.interests.en 
      : (user.interests?.en ? user.interests.en.split(',').map(s => s.trim()).filter(Boolean) : []),
    imageUrl: user.imageUrl || '',
    publicEmail: user.publicEmail || '',
    institution: user.institution || '',
    social: user.social || { linkedin: '', twitter: '', instagram: '', website: '' },
    orcid: user.orcid || ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSocialChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      social: { ...prev.social, [name]: value }
    }));
  };

  const handleInterestsChange = (langKey, newInterests) => {
    setForm(prev => ({
      ...prev,
      [langKey === 'es' ? 'interestsEs' : 'interestsEn']: newInterests
    }));
  };
  
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert(language === 'es' ? "La imagen no puede superar 5MB" : "Image cannot exceed 5MB");
      return;
    }

    setUploading(true);

    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const result = await uploadImageToImgBB({
          base64: reader.result,
          fileName: file.name
        });

        setForm(prev => ({
          ...prev,
          imageUrl: result.url
        }));

      } catch (error) {
        console.error('Error uploading image:', error);
        alert(language === 'es' ? "Error subiendo imagen" : "Error uploading image");
      } finally {
        setUploading(false);
      }
    };

    reader.readAsDataURL(file);
  };

  const saveProfile = async () => {
    setSaving(true);

    let descEs = form.descriptionEs.trim();
    let descEn = form.descriptionEn.trim();
    if (!descEn) descEn = descEs;
    if (!descEs) descEs = descEn;

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        firstName: form.firstName,
        lastName: form.lastName,
        displayName: `${form.firstName} ${form.lastName}`.trim(),
        description: { es: descEs, en: descEn },
        interests: { 
          es: form.interestsEs, 
          en: form.interestsEn 
        },
        imageUrl: form.imageUrl,
        publicEmail: form.publicEmail,
        institution: form.institution,
        social: form.social,
        orcid: form.orcid,
        updatedAt: new Date().toISOString()
      });
      console.log('Profile saved successfully for user:', user.uid);
    } catch (error) {
      console.error('Error saving profile:', error);
      alert(language === 'es' ? 'Error al guardar perfil' : 'Error saving profile');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    console.warn('ProfileSection rendered without user data');
    return <div className="text-center p-8">{language === 'es' ? 'Cargando perfil...' : 'Loading profile...'}</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 sm:space-y-12 px-2 sm:px-4">
      {/* Encabezado Avatar */}
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-8 lg:p-12 flex flex-col lg:flex-row items-center gap-6 sm:gap-8 lg:gap-12">
        <div className="relative group flex-shrink-0">
          <div className="w-36 h-36 sm:w-44 sm:h-44 lg:w-52 lg:h-52 rounded-2xl sm:rounded-3xl overflow-hidden ring-8 ring-white shadow-2xl relative">
            {form.imageUrl ? (
              <img src={form.imageUrl} className="object-cover w-full h-full" alt={language === 'es' ? 'Perfil' : 'Profile'} />
            ) : (
              <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-gray-100 to-gray-50">
                <UserIcon className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 text-gray-300" />
              </div>
            )}

            {uploading && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center">
                <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 border-4 border-white border-t-transparent rounded-full animate-spin mb-2 sm:mb-3" />
                <span className="text-white text-xs sm:text-sm font-medium tracking-widest">
                  {language === 'es' ? 'SUBIENDO...' : 'UPLOADING...'}
                </span>
              </div>
            )}

            <label className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/50 transition-all duration-300 cursor-pointer rounded-2xl sm:rounded-3xl">
              <CameraIcon className="w-8 h-8 sm:w-10 sm:h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="hidden" />
            </label>
          </div>
        </div>

        <div className="flex-1 text-center lg:text-left">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-gray-900 mb-1 break-words">
            {form.firstName} {form.lastName}
          </h2>
          <p className="text-base sm:text-lg lg:text-xl text-gray-500 font-medium break-words">
            {form.institution || (language === 'es' ? 'Sin institución' : 'No institution')}
          </p>
          {form.orcid && (
            <a href={`https://orcid.org/${form.orcid}`} target="_blank" className="text-emerald-600 hover:underline text-xs sm:text-sm mt-2 inline-block break-words">
              ORCID • {form.orcid}
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-12">
        {/* Columna Izquierda */}
        <div className="lg:col-span-7 space-y-6 sm:space-y-8 lg:space-y-10">
          {/* Biografía */}
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-8 lg:p-12">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8 lg:mb-10">
              <h3 className="font-serif text-2xl sm:text-3xl font-bold text-gray-900">
                {language === 'es' ? 'Biografía e Intereses' : 'Biography & Interests'}
              </h3>
              <div className="flex bg-gray-100 rounded-2xl p-1.5 w-full sm:w-auto">
                <button 
                  onClick={() => setLang('es')} 
                  className={`flex-1 sm:flex-none px-4 sm:px-6 lg:px-8 py-2 sm:py-3 rounded-2xl text-xs sm:text-sm font-semibold transition-all ${lang === 'es' ? 'bg-white shadow text-emerald-700' : 'text-gray-500'}`}
                >
                  ESPAÑOL
                </button>
                <button 
                  onClick={() => setLang('en')} 
                  className={`flex-1 sm:flex-none px-4 sm:px-6 lg:px-8 py-2 sm:py-3 rounded-2xl text-xs sm:text-sm font-semibold transition-all ${lang === 'en' ? 'bg-white shadow text-emerald-700' : 'text-gray-500'}`}
                >
                  ENGLISH
                </button>
              </div>
            </div>

            <div className="space-y-6 sm:space-y-8 lg:space-y-10">
              <div>
                <label className="block uppercase text-xs tracking-[2px] font-bold text-gray-400 mb-2 sm:mb-3">
                  {language === 'es' ? 'DESCRIPCIÓN' : 'DESCRIPTION'}
                </label>
                <textarea
                  name={lang === 'es' ? 'descriptionEs' : 'descriptionEn'}
                  value={lang === 'es' ? form.descriptionEs : form.descriptionEn}
                  onChange={handleChange}
                  className="w-full h-40 sm:h-48 lg:h-56 p-4 sm:p-5 lg:p-7 bg-gray-50 border-0 rounded-2xl sm:rounded-3xl focus:ring-2 focus:ring-emerald-200 resize-y leading-relaxed text-sm sm:text-base"
                  placeholder={lang === 'es' ? 'Tu trayectoria académica y profesional...' : 'Your academic and professional journey...'}
                />
              </div>

              <div>
                <label className="block uppercase text-xs tracking-[2px] font-bold text-gray-400 mb-2 sm:mb-3">
                  {language === 'es' ? 'ÁREAS DE INTERÉS' : 'AREAS OF INTEREST'}
                </label>
                <InterestsTags
                  value={lang === 'es' ? form.interestsEs : form.interestsEn}
                  onChange={(newTags) => handleInterestsChange(lang, newTags)}
                  placeholder={lang === 'es' ? 'Economía, IA, Historia...' : 'Economics, AI, History...'}
                />
              </div>
            </div>
          </div>

          {/* Afiliación */}
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-8 lg:p-12">
            <h3 className="font-serif text-2xl sm:text-3xl font-bold text-gray-900 mb-6 sm:mb-8 lg:mb-10">
              {language === 'es' ? 'Afiliación Académica' : 'Academic Affiliation'}
            </h3>
            <div className="space-y-6 sm:space-y-8">
              <div>
                <label className="block uppercase text-xs tracking-[2px] font-bold text-gray-400 mb-2 sm:mb-3">
                  {language === 'es' ? 'INSTITUCIÓN' : 'INSTITUTION'}
                </label>
                <input 
                  name="institution" 
                  value={form.institution} 
                  onChange={handleChange} 
                  className="w-full p-4 sm:p-5 lg:p-7 bg-gray-50 border-0 rounded-2xl sm:rounded-3xl focus:ring-2 focus:ring-emerald-200 text-sm sm:text-base" 
                />
              </div>
              <div>
                <label className="block uppercase text-xs tracking-[2px] font-bold text-gray-400 mb-2 sm:mb-3">
                  {language === 'es' ? 'CORREO PÚBLICO' : 'PUBLIC EMAIL'}
                </label>
                <div className="relative">
                  <EnvelopeIcon className="absolute left-4 sm:left-5 lg:left-7 top-1/2 -translate-y-1/2 w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
                  <input 
                    name="publicEmail" 
                    value={form.publicEmail} 
                    onChange={handleChange} 
                    className="w-full pl-12 sm:pl-14 lg:pl-16 p-4 sm:p-5 lg:p-7 bg-gray-50 border-0 rounded-2xl sm:rounded-3xl focus:ring-2 focus:ring-emerald-200 text-sm sm:text-base" 
                    placeholder={language === 'es' ? 'tucorreo@ejemplo.org' : 'youremail@example.org'} 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Columna Derecha */}
        <div className="lg:col-span-5 space-y-6 sm:space-y-8 lg:space-y-10">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-8 lg:p-12">
            <h3 className="font-serif text-2xl sm:text-3xl font-bold text-gray-900 mb-6 sm:mb-8 lg:mb-10">
              {language === 'es' ? 'Presencia Digital' : 'Digital Presence'}
            </h3>
            <div className="space-y-4 sm:space-y-5 lg:space-y-6">
              {/* LinkedIn */}
              <div className="group flex items-center bg-gray-50 rounded-2xl sm:rounded-3xl border border-transparent focus-within:border-emerald-300 transition-all overflow-hidden">
                <div className="pl-4 sm:pl-5 lg:pl-6 pr-2 sm:pr-3 lg:pr-4 text-[#0A66C2] font-black text-lg sm:text-xl">in</div>
                <input
                  name="linkedin"
                  value={form.social.linkedin}
                  onChange={handleSocialChange}
                  placeholder="https://linkedin.com/in/..."
                  className="bg-transparent border-0 flex-1 py-4 sm:py-5 lg:py-6 focus:ring-0 text-xs sm:text-sm truncate"
                />
              </div>

              {/* Twitter / X */}
              <div className="group flex items-center bg-gray-50 rounded-2xl sm:rounded-3xl border border-transparent focus-within:border-emerald-300 transition-all overflow-hidden">
                <div className="pl-4 sm:pl-5 lg:pl-6 pr-2 sm:pr-3 lg:pr-4 text-black font-bold text-lg sm:text-xl">𝕏</div>
                <input
                  name="twitter"
                  value={form.social.twitter}
                  onChange={handleSocialChange}
                  placeholder="https://x.com/..."
                  className="bg-transparent border-0 flex-1 py-4 sm:py-5 lg:py-6 focus:ring-0 text-xs sm:text-sm truncate"
                />
              </div>

              {/* Instagram */}
              <div className="group flex items-center bg-gray-50 rounded-2xl sm:rounded-3xl border border-transparent focus-within:border-emerald-300 transition-all overflow-hidden">
                <div className="pl-4 sm:pl-5 lg:pl-6 pr-2 sm:pr-3 lg:pr-4 text-[#E4405F] text-lg sm:text-xl">📷</div>
                <input
                  name="instagram"
                  value={form.social.instagram}
                  onChange={handleSocialChange}
                  placeholder="https://instagram.com/..."
                  className="bg-transparent border-0 flex-1 py-4 sm:py-5 lg:py-6 focus:ring-0 text-xs sm:text-sm truncate"
                />
              </div>

              {/* Website */}
              <div className="group flex items-center bg-gray-50 rounded-2xl sm:rounded-3xl border border-transparent focus-within:border-emerald-300 transition-all overflow-hidden">
                <div className="pl-4 sm:pl-5 lg:pl-6 pr-2 sm:pr-3 lg:pr-4 text-gray-400">
                  <LinkIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <input
                  name="website"
                  value={form.social.website}
                  onChange={handleSocialChange}
                  placeholder="https://tusitio.com"
                  className="bg-transparent border-0 flex-1 py-4 sm:py-5 lg:py-6 focus:ring-0 text-xs sm:text-sm truncate"
                />
              </div>

              {/* ORCID */}
              <div className="group flex items-center bg-gray-50 rounded-2xl sm:rounded-3xl border border-transparent focus-within:border-emerald-300 transition-all overflow-hidden">
                <div className="pl-4 sm:pl-5 lg:pl-6 pr-2 sm:pr-3 lg:pr-4 text-orange-600 font-mono font-bold text-lg sm:text-xl">OR</div>
                <input
                  name="orcid"
                  value={form.orcid}
                  onChange={handleChange}
                  placeholder="0000-0000-0000-0000"
                  className="bg-transparent border-0 flex-1 py-4 sm:py-5 lg:py-6 focus:ring-0 text-xs sm:text-sm font-mono truncate"
                />
              </div>
            </div>
          </div>

          {/* Botón Guardar */}
          <button
            onClick={saveProfile}
            disabled={saving}
            className="w-full py-4 sm:py-5 lg:py-6 bg-gradient-to-r from-gray-900 to-black text-white rounded-2xl sm:rounded-3xl font-bold tracking-[0.08em] text-xs sm:text-sm uppercase hover:from-emerald-600 hover:to-emerald-700 transition-all duration-300 shadow-xl shadow-gray-200 active:scale-[0.985] flex items-center justify-center gap-2 sm:gap-3"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {language === 'es' ? 'GUARDANDO...' : 'SAVING...'}
              </>
            ) : (
              language === 'es' ? 'GUARDAR PERFIL' : 'SAVE PROFILE'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== GESTIÓN DE USUARIOS ====================
const UserManagement = ({ users: initialUsers }) => {
  const [users, setUsers] = useState(initialUsers);
  const [searchTerm, setSearchTerm] = useState('');
  const { language } = useLanguage();
  const isSpanish = language === 'es';

  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  const addRole = async (uid, role) => {
    const user = users.find(u => u.id === uid);
    if (!user || !role) return;
    
    const currentRoles = user.roles || [];
    if (currentRoles.includes(role)) return;

    const newRoles = [...currentRoles, role];
    
    try {
      await updateRole({ targetUid: uid, newRoles });
      console.log(`Role added: ${role} to user ${uid}`);
    } catch (err) {
      console.error('Error al añadir rol:', err);
    }
  };

  const removeRole = async (uid, role) => {
    const user = users.find(u => u.id === uid);
    if (!user) return;
    
    const newRoles = (user.roles || []).filter(r => r !== role);
    
    try {
      await updateRole({ targetUid: uid, newRoles });
      console.log(`Role removed: ${role} from user ${uid}`);
    } catch (err) {
      console.error('Error al eliminar rol:', err);
    }
  };

  const filteredUsers = users.filter(user => 
    (user.displayName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!users || users.length === 0) {
    return <div className="text-center py-12 sm:py-20 text-gray-400">
      {isSpanish ? 'Cargando usuarios...' : 'Loading users...'}
    </div>;
  }

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 p-4 sm:p-6 lg:p-10 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-6 sm:mb-8 lg:mb-10">
        <div>
          <h3 className="text-2xl sm:text-3xl font-serif font-bold text-gray-900">
            {isSpanish ? 'Gestión de Usuarios' : 'User Management'}
          </h3>
          <p className="text-sm sm:text-base text-gray-500 mt-1">
            {isSpanish ? 'Administra roles y accesos del equipo editorial' : 'Manage editorial team roles and access'}
          </p>
        </div>
        
        <div className="relative w-full sm:w-64 lg:w-80">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isSpanish ? "Buscar..." : "Search..."}
            className="w-full pl-10 pr-4 py-3 sm:py-4 bg-gray-50 border border-gray-200 rounded-xl sm:rounded-2xl focus:border-emerald-400 focus:ring-0 text-sm"
          />
          <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
        </div>
      </div>

      {/* Vista Móvil: Tarjetas */}
      <div className="block lg:hidden space-y-4">
        {filteredUsers.map((user) => (
          <div key={user.id} className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              {user.imageUrl ? (
                <img 
                  src={user.imageUrl} 
                  className="w-10 h-10 rounded-xl object-cover ring-1 ring-gray-200" 
                  alt={user.displayName} 
                />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-50 rounded-xl flex items-center justify-center ring-1 ring-gray-200">
                  <span className="text-lg font-serif font-bold text-gray-400">
                    {user.displayName?.charAt(0) || 'U'}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 text-base truncate">
                  {user.displayName || (isSpanish ? 'Sin nombre' : 'No name')}
                </div>
                <div className="text-xs text-gray-400 truncate">{user.email}</div>
              </div>
            </div>
            
            <div className="mb-3">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
                {isSpanish ? 'Roles' : 'Roles'}
              </div>
              <div className="flex flex-wrap gap-2">
                {(user.roles || []).map(role => {
                  const displayRole = !isSpanish ? (ES_TO_EN[role] || role) : role;
                  return (
                    <div 
                      key={role}
                      className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-xs font-medium px-3 py-1.5 rounded-xl"
                    >
                      {displayRole}
                      <button
                        onClick={() => removeRole(user.id, role)}
                        className="text-emerald-600 hover:text-red-600 transition-colors font-bold text-base leading-none ml-1"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}

                <div className="relative">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        addRole(user.id, e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="appearance-none bg-transparent border border-dashed border-gray-300 hover:border-emerald-400 text-emerald-600 text-xs font-medium rounded-xl px-3 py-1.5 cursor-pointer transition-all focus:outline-none focus:border-emerald-500"
                    value=""
                  >
                    <option value="" disabled>
                      {isSpanish ? '+ Añadir' : '+ Add'}
                    </option>
                    {ALL_ROLES.filter(r => !(user.roles || []).includes(r)).map(role => {
                      const displayRole = !isSpanish ? (ES_TO_EN[role] || role) : role;
                      return (
                        <option key={role} value={role}>{displayRole}</option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>
            
            <div className="text-xs text-gray-400 font-mono">
              ID: {user.id.slice(0, 8)}...
            </div>
          </div>
        ))}
      </div>

      {/* Vista Desktop: Tabla */}
      <div className="hidden lg:block overflow-hidden rounded-3xl border border-gray-100">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-8 py-5 text-left text-xs font-semibold text-gray-500 uppercase tracking-widest">
                {isSpanish ? 'Usuario' : 'User'}
              </th>
              <th className="px-8 py-5 text-left text-xs font-semibold text-gray-500 uppercase tracking-widest">Email</th>
              <th className="px-8 py-5 text-left text-xs font-semibold text-gray-500 uppercase tracking-widest">
                {isSpanish ? 'Roles' : 'Roles'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-emerald-50/50 transition-colors group">
                <td className="px-8 py-6 whitespace-nowrap">
                  <div className="flex items-center gap-4">
                    {user.imageUrl ? (
                      <img 
                        src={user.imageUrl} 
                        className="w-11 h-11 rounded-2xl object-cover ring-1 ring-gray-100" 
                        alt={user.displayName} 
                      />
                    ) : (
                      <div className="w-11 h-11 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl flex items-center justify-center ring-1 ring-gray-100">
                        <span className="text-xl font-serif font-bold text-gray-400">
                          {user.displayName?.charAt(0) || 'U'}
                        </span>
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-gray-900">
                        {user.displayName || (isSpanish ? 'Sin nombre' : 'No name')}
                      </div>
                      <div className="text-xs text-gray-400 font-mono">ID: {user.id.slice(0, 8)}</div>
                    </div>
                  </div>
                </td>
                
                <td className="px-8 py-6 whitespace-nowrap text-gray-600 font-medium text-sm">
                  {user.email}
                </td>

                <td className="px-8 py-6">
                  <div className="flex flex-wrap gap-2">
                    {(user.roles || []).map(role => {
                      const displayRole = !isSpanish ? (ES_TO_EN[role] || role) : role;
                      return (
                        <div 
                          key={role}
                          className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-800 text-xs font-medium px-4 py-2 rounded-2xl group-hover:bg-emerald-200 transition-colors"
                        >
                          {displayRole}
                          <button
                            onClick={() => removeRole(user.id, role)}
                            className="text-emerald-600 hover:text-red-600 transition-colors font-bold text-base leading-none"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}

                    <div className="relative">
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            addRole(user.id, e.target.value);
                            e.target.value = '';
                          }
                        }}
                        className="appearance-none bg-transparent border border-dashed border-gray-300 hover:border-emerald-400 text-emerald-600 text-xs font-medium rounded-2xl px-4 py-2 cursor-pointer transition-all focus:outline-none focus:border-emerald-500"
                        value=""
                      >
                        <option value="" disabled>
                          {isSpanish ? '+ Añadir rol' : '+ Add role'}
                        </option>
                        {ALL_ROLES.filter(r => !(user.roles || []).includes(r)).map(role => {
                          const displayRole = !isSpanish ? (ES_TO_EN[role] || role) : role;
                          return (
                            <option key={role} value={role}>{displayRole}</option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredUsers.length === 0 && (
        <div className="text-center py-12 sm:py-20 text-gray-400">
          {isSpanish 
            ? 'No se encontraron usuarios con ese criterio de búsqueda.' 
            : 'No users found matching your search criteria.'}
        </div>
      )}
    </div>
  );
};

export default function PortalSection({ user, onLogout }) {
  const { language } = useLanguage();
  const isSpanish = language === 'es';

  // ELIMINADO: Todos los estados relacionados con CSV
  // assignments, assignmentsFetched, feedback, report, vote, rubricScores, etc. eliminados

  const [activeTab, setActiveTab] = useState('profile');
  const [isDirectorPanelExpanded, setIsDirectorPanelExpanded] = useState(false);
  const [isChiefEditorPanelExpanded, setIsChiefEditorPanelExpanded] = useState(false);
  const [effectiveName, setEffectiveName] = useState(user?.displayName || '');
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  
  // Datos en tiempo real desde Firebase
  const [userData, setUserData] = useState(user);
  const [users, setUsers] = useState([]);
  const [reviewerAssignments, setReviewerAssignments] = useState([]); // <-- NUEVO para revisores

  // Estados para reclamación de perfil
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimStatus, setClaimStatus] = useState('idle');
  const [anonymousProfile, setAnonymousProfile] = useState(null);
  const [claimError, setClaimError] = useState('');

  const { getReviewerAssignmentsByEmail } = useReviewerAssignment(user);

  // Módulos de Quill (se mantienen por si acaso)
  const modules = useMemo(() => ({
    toolbar: {
      container: [
        ['bold', 'italic', 'underline', 'strike', 'blockquote'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        ['link', 'image'],
        [{ 'align': ['', 'center', 'right', 'justify'] }],
        [{ 'size': ['small', false, 'large'] }],
        ['clean']
      ]
    }
  }), []);

  const formats = useMemo(() => [
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet',
    'link', 'image',
    'align',
    'size'
  ], []);

  const userRoles = userData?.roles || [];
  const isAuthor = userRoles.includes('Autor');
  const isChief = userRoles.includes('Editor en Jefe');
  const isDirector = userRoles.includes('Director General');
  const isSectionEditor = userRoles.includes('Editor de Sección');
  const isReviewer = userRoles.includes('Revisor');
  const isRrss = userRoles.includes('Encargado de Redes Sociales');
  const isWebDev = userRoles.includes('Responsable de Desarrollo Web');
  const isAssignmentManager = userRoles.includes('Encargado de Asignación de Artículos');

  // Pestañas actualizadas para el nuevo sistema
// En PortalSection.js, dentro del array 'tabs'

const tabs = [
  { id: 'profile', label: isSpanish ? 'MI PERFIL' : 'MY PROFILE', roles: ['any'] },
  { id: 'submissions', label: isSpanish ? 'MIS ENVÍOS' : 'MY SUBMISSIONS', roles: ['Autor'] },
  { id: 'reviewer-tasks', label: isSpanish ? 'MIS REVISIONES' : 'MY REVIEWS', roles: ['Revisor'] },
  { id: 'deskreview', label: isSpanish ? 'DESK REVIEW' : 'DESK REVIEW', roles: ['Editor de Sección', 'Editor en Jefe'] },
  { id: 'assignment', label: isSpanish ? 'ASIGNAR ARTÍCULOS' : 'ASSIGN ARTICLES', roles: ['Encargado de Asignación de Artículos', 'Director General'] },
  { id: 'calendar', label: isSpanish ? 'CALENDARIO' : 'CALENDAR', roles: ['Editor en Jefe', 'Director General', 'Encargado de Asignación de Artículos'] },
  { id: 'submit', label: isSpanish ? 'ENVIAR MANUSCRITO' : 'SUBMIT MANUSCRIPT', roles: ['Autor'] },
  { id: 'director', label: isSpanish ? 'PANEL DIRECTIVO' : 'DIRECTOR PANEL', roles: ['Director General'] },
  { id: 'chief', label: isSpanish ? 'PANEL EDITOR JEFE' : 'CHIEF EDITOR PANEL', roles: ['Editor en Jefe'] },
  { id: 'tasks', label: isSpanish ? 'TAREAS' : 'TASKS', roles: ['Encargado de Redes Sociales', 'Responsable de Desarrollo Web'] },
  { id: 'news', label: isSpanish ? 'NOTICIAS' : 'NEWS', roles: ['Director General'] },
  { id: 'admissions', label: isSpanish ? 'ADMISIONES' : 'ADMISSIONS', roles: ['Director General'] },
  { id: 'usermanagement', label: isSpanish ? 'USUARIOS' : 'USERS', roles: ['Director General'] },
  // NUEVA PESTAÑA PARA ARTÍCULOS ACEPTADOS
  { id: 'accepted-articles', label: isSpanish ? 'ARTÍCULOS ACEPTADOS' : 'ACCEPTED ARTICLES', roles: ['Editor de Sección', 'Editor en Jefe', 'Director General'] }

  ].filter(tab => tab.roles.includes('any') || tab.roles.some(role => userRoles.includes(role)));

  // Snapshot de usuario
  useEffect(() => {
    if (!user?.uid) {
      console.warn('No user UID available for snapshot');
      return;
    }
    console.log('Setting up user snapshot for UID:', user.uid);
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const merged = { ...user, ...data };
        setUserData(merged);
        const name = merged.displayName || 
                     `${merged.firstName || ''} ${merged.lastName || ''}`.trim() || 
                     user.displayName || 
                     '';
        setEffectiveName(name);
        console.log('User data updated from snapshot:', name);
      } else {
        setUserData(user);
        const name = user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || '';
        setEffectiveName(name);
      }
    }, (err) => {
      console.error('Error in user snapshot:', err);
    });
    return () => {
      console.log('Unsubscribing user snapshot');
      unsub();
    };
  }, [user?.uid]);

  // Snapshot de todos los usuarios (solo para Director)
  useEffect(() => {
    if (userData?.roles?.includes('Director General')) {
      console.log('Setting up users snapshot for Director');
      const q = query(collection(db, 'users'));
      const unsub = onSnapshot(q, (snap) => {
        const userList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setUsers(userList);
        console.log('Users updated from snapshot:', userList.length);
      }, (err) => {
        console.error('Error in users snapshot:', err);
      });
      return () => {
        console.log('Unsubscribing users snapshot');
        unsub();
      };
    }
  }, [userData?.roles]);

  // Cargar asignaciones de revisor si el usuario es revisor
  useEffect(() => {
    if (isReviewer && user?.email) {
      const loadReviewerAssignments = async () => {
        const result = await getReviewerAssignmentsByEmail(user.email);
        if (result.success) {
          setReviewerAssignments(result.assignments);
        }
      };
      loadReviewerAssignments();
    }
  }, [isReviewer, user?.email, getReviewerAssignmentsByEmail]);

  // Cargar deadlines para el calendario
  useEffect(() => {
    const loadDeadlines = async () => {
      if (!user) return;
      const deadlinesQuery = query(collection(db, 'deadlines'));
      const unsubscribe = onSnapshot(deadlinesQuery, (snapshot) => {
        const events = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            title: data.type === 'reviewer-response' 
              ? (isSpanish ? `Respuesta: ${data.reviewerName}` : `Response: ${data.reviewerName}`)
              : (isSpanish ? `Revisión: ${data.reviewerName}` : `Review: ${data.reviewerName}`),
            start: data.dueDate?.toDate(),
            end: data.dueDate?.toDate(),
            allDay: true,
            resource: data
          };
        });
        setCalendarEvents(events);
      });
      return () => unsubscribe();
    };
    loadDeadlines();
  }, [user, isSpanish]);

  useEffect(() => {
    if (!userData || !effectiveName) {
      setLoadingUser(true);
      return;
    }
    setLoadingUser(false);
  }, [userData, effectiveName]);

  // Función para verificar perfil anónimo
  const checkForAnonymousProfile = useCallback(async () => {
    if (!isAuthor || userData?.claimedAnonymousUid) {
      return;
    }
    
    setClaimStatus('checking');
    setClaimError('');
    
    try {
      const result = await checkAnonymousProfile();
      
      if (result.hasProfile) {
        setAnonymousProfile(result.profile);
        setClaimStatus('available');
      } else {
        setClaimStatus('not-available');
      }
    } catch (error) {
      console.error('Error checking anonymous profile:', error);
      setClaimError(isSpanish ? 'Error al verificar perfil' : 'Error checking profile');
      setClaimStatus('error');
    }
  }, [isAuthor, userData, isSpanish]);

  // Función para reclamar perfil
  const handleClaimProfile = useCallback(async () => {
    if (!anonymousProfile) return;
    
    setClaimStatus('claiming');
    setClaimError('');
    
    try {
      const result = await claimAnonymousProfile({
        anonymousUid: anonymousProfile.anonymousUid,
        claimHash: anonymousProfile.claimHash,
        anonymousName: anonymousProfile.name
      });
      
      if (result.success) {
        setClaimStatus('success');
        
        setUserData(prev => ({
          ...prev,
          claimedAnonymousUid: anonymousProfile.anonymousUid,
          claimedAnonymousName: anonymousProfile.name,
          articlesClaimed: result.articlesClaimed
        }));
        
        setTimeout(() => {
          setShowClaimModal(false);
          setClaimStatus('idle');
          setAnonymousProfile(null);
        }, 3000);
      }
    } catch (error) {
      console.error('Error claiming profile:', error);
      setClaimError(error.message || (isSpanish ? 'Error al reclamar perfil' : 'Error claiming profile'));
      setClaimStatus('error');
    }
  }, [anonymousProfile, isSpanish]);

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
          <p className="mt-6 text-gray-500 font-medium tracking-wider">
            {isSpanish ? 'CARGANDO PORTAL EDITORIAL...' : 'LOADING EDITORIAL PORTAL...'}
          </p>
        </div>
      </div>
    );
  }

  if (!effectiveName) {
    return <div className="text-red-600 text-center p-4">
      {isSpanish ? 'Usuario no definido' : 'User not defined'}
    </div>;
  }

  if (!userData) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-[#fafafa] p-4 md:p-8 flex items-center justify-center"
      >
        <div className="text-center text-gray-600 bg-white p-6 rounded-lg shadow-md">
          <p className="text-lg font-sans mb-4">
            {isSpanish ? 'Cargando datos del usuario...' : 'Loading user data...'}
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-12 bg-[#fafafa] min-h-screen">
      {/* Header del Portal */}
      <header className="mb-8 sm:mb-10 md:mb-12 flex flex-col md:flex-row md:items-end justify-between border-b border-gray-900 pb-6 md:pb-8">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 tracking-tighter mb-2 break-words">
            {isSpanish ? 'Portal Editorial' : 'Editorial Portal'}
          </h1>
          <div className="flex items-center space-x-2 sm:space-x-3">
            <p className="text-gray-500 font-sans tracking-widest uppercase text-xs break-words">
              {isSpanish ? 'Sesión activa:' : 'Active Session:'}
            </p>
            {userData.imageUrl ? (
              <motion.img
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                src={userData.imageUrl}
                alt={`${isSpanish ? 'Perfil de' : 'Profile of'} ${effectiveName || (isSpanish ? 'Usuario' : 'User')}`}
                className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover border-2 border-gray-300"
                onError={(e) => (e.target.style.display = 'none')}
              />
            ) : (
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gray-300 flex items-center justify-center border-2 border-gray-300"
              >
                <span className="text-gray-600 text-xs font-sans">{effectiveName?.charAt(0) || 'U'}</span>
              </motion.div>
            )}
            <span className="font-bold text-gray-800 font-sans text-xs uppercase tracking-widest break-words">{effectiveName}</span>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="mt-4 md:mt-0 text-xs font-bold uppercase tracking-widest px-5 sm:px-6 py-2 border border-gray-900 hover:bg-gray-900 hover:text-white transition-all rounded-xl"
        >
          {isSpanish ? 'Cerrar Sesión' : 'Log Out'}
        </button>
      </header>

      {/* Navegación */}
      <nav className="flex overflow-x-auto pb-2 mb-6 sm:mb-8 md:mb-12 border-b border-gray-200 gap-4 md:gap-8 whitespace-nowrap">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 md:pb-4 text-xs font-bold uppercase tracking-widest transition-all relative flex-shrink-0 ${
              activeTab === tab.id ? 'text-emerald-700' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-700" />
            )}
          </button>
        ))}
      </nav>

      <main>
        <AnimatePresence mode="wait">
          {/* PERFIL */}
          {activeTab === 'profile' && (
            <motion.section
              key="profile"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            >
              <ProfileSection user={userData} />
              
              {isAuthor && !userData?.claimedAnonymousUid && (
                <div className="mt-8 max-w-6xl mx-auto">
                  {claimStatus === 'idle' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8">
                      <h3 className="font-serif text-2xl font-bold text-amber-900 mb-3">
                        {isSpanish ? '¿Has publicado antes con nosotros?' : 'Have you published with us before?'}
                      </h3>
                      <p className="text-amber-800 mb-6 leading-relaxed">
                        {isSpanish 
                          ? 'Si has sido autor o coautor en artículos publicados anteriormente, puedes reclamar tu perfil para que todas tus publicaciones aparezcan vinculadas a tu cuenta.'
                          : 'If you have been an author or co-author in previously published articles, you can claim your profile so that all your publications appear linked to your account.'}
                      </p>
                      <button
                        onClick={() => {
                          setShowClaimModal(true);
                          checkForAnonymousProfile();
                        }}
                        className="px-8 py-4 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-amber-200"
                      >
                        {isSpanish ? 'Verificar y reclamar perfil' : 'Verify and claim profile'}
                      </button>
                    </div>
                  )}
                  
                  {claimStatus === 'checking' && (
                    <div className="bg-gray-50 rounded-3xl p-8 text-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mb-4"></div>
                      <p className="text-gray-600">
                        {isSpanish ? 'Verificando publicaciones anteriores...' : 'Checking previous publications...'}
                      </p>
                    </div>
                  )}
                  
                  {claimStatus === 'not-available' && (
                    <div className="bg-gray-50 rounded-3xl p-8 text-center">
                      <p className="text-gray-600">
                        {isSpanish 
                          ? 'No encontramos publicaciones anteriores asociadas a tu email. Si crees que esto es un error, contacta al equipo editorial.'
                          : 'We did not find previous publications associated with your email. If you believe this is an error, contact the editorial team.'}
                      </p>
                    </div>
                  )}
                  
                  {claimError && (
                    <div className="bg-red-50 border border-red-200 rounded-3xl p-8 text-center">
                      <p className="text-red-600">{claimError}</p>
                    </div>
                  )}
                </div>
              )}
            </motion.section>
          )}

          {/* MIS ENVÍOS (AUTOR) - NUEVO */}
          {activeTab === 'submissions' && (
            <motion.section
              key="submissions"
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: 20 }}
            >
              <AuthorSubmissionsPanel user={userData} />
            </motion.section>
          )}

          {/* MIS REVISIONES (REVISOR) - NUEVO */}
          {activeTab === 'reviewer-tasks' && (
            <motion.section
              key="reviewer-tasks"
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: 20 }}
            >
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
                <h2 className="font-['Playfair_Display'] text-3xl font-bold text-[#0A1929] mb-6">
                  {isSpanish ? 'Mis Revisiones Asignadas' : 'My Assigned Reviews'}
                </h2>
                {reviewerAssignments.length === 0 ? (
                  <p className="text-gray-500 text-center py-12">
                    {isSpanish ? 'No tienes revisiones pendientes' : 'You have no pending reviews'}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {reviewerAssignments.map(assignment => (
                      <div
                        key={assignment.id}
                        className="p-6 border border-gray-200 rounded-xl hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => window.open(`/reviewer-workspace/${assignment.id}`, '_blank')}
                      >
                        <h3 className="font-bold text-lg text-[#0A1929] mb-2">
                          {assignment.submission?.title}
                        </h3>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">
                            {isSpanish ? 'Estado:' : 'Status:'} 
                            <span className={`ml-2 px-2 py-1 rounded-full ${
                              assignment.status === 'submitted' ? 'bg-green-100 text-green-700' :
                              assignment.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {assignment.status === 'submitted' && (isSpanish ? 'Enviada' : 'Submitted')}
                              {assignment.status === 'in-progress' && (isSpanish ? 'En progreso' : 'In progress')}
                              {assignment.status === 'pending' && (isSpanish ? 'Pendiente' : 'Pending')}
                            </span>
                          </span>
                          <span className="text-gray-600">
                            {isSpanish ? 'Ronda:' : 'Round:'} {assignment.round}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.section>
          )}
// En el main, dentro del AnimatePresence

{activeTab === 'accepted-articles' && (
  <motion.section
    key="accepted-articles"
    initial={{ opacity: 0, x: -20 }} 
    animate={{ opacity: 1, x: 0 }} 
    exit={{ opacity: 0, x: 20 }}
  >
    <AcceptedArticlesPanel user={userData} />
  </motion.section>
)}
          {/* DESK REVIEW */}
          {activeTab === 'deskreview' && (
            <motion.section
              key="deskreview"
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: 20 }}
            >
              <DeskReviewPanel user={userData} />
            </motion.section>
          )}

          {/* ASIGNAR ARTÍCULOS */}
          {activeTab === 'assignment' && (
            <motion.section
              key="assignment"
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: 20 }}
            >
              <ArticleAssignmentPanel user={userData} />
            </motion.section>
          )}

          {/* CALENDARIO */}
          {activeTab === 'calendar' && (
            <motion.section
              key="calendar"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            >
              <CalendarComponent 
                events={calendarEvents} 
                onSelectEvent={(e) => {
                  if (e.resource?.targetType === 'reviewerAssignment') {
                    window.open(`/reviewer-workspace/${e.resource.targetId}`, '_blank');
                  }
                }} 
              />
            </motion.section>
          )}

          {/* ENVIAR MANUSCRITO */}
          {activeTab === 'submit' && (
            <motion.section
              key="submit"
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: 20 }}
            >
              <SubmissionForm 
                user={userData} 
                onSuccess={(submissionId) => {
                  console.log('Submission successful:', submissionId);
                  setActiveTab('submissions');
                }}
              />
            </motion.section>
          )}

          {/* PANEL DIRECTIVO */}
          {activeTab === 'director' && (
            <motion.section
              key="director"
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: 20 }}
            >
              <DirectorPanel 
                user={userData} 
                isExpanded={isDirectorPanelExpanded} 
                onToggle={() => setIsDirectorPanelExpanded(!isDirectorPanelExpanded)} 
              />
              
              {(isAssignmentManager || isDirector) && (
                <div className="mt-8">
                  <ArticleAssignmentPanel user={userData} />
                </div>
              )}
            </motion.section>
          )}

          {/* PANEL EDITOR JEFE */}
          {activeTab === 'chief' && (
            <motion.section
              key="chief"
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: 20 }}
            >
              <AssignSection 
                user={userData} 
                isExpanded={isChiefEditorPanelExpanded} 
                onToggle={() => setIsChiefEditorPanelExpanded(!isChiefEditorPanelExpanded)} 
              />
            </motion.section>
          )}

          {/* TAREAS */}
          {activeTab === 'tasks' && (
            <motion.section
              key="tasks"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            >
              <TaskSection user={userData} />
            </motion.section>
          )}

          {/* NOTICIAS */}
          {activeTab === 'news' && (
            <motion.section
              key="news"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            >
              <NewsUploadSection />
            </motion.section>
          )}

          {/* ADMISIONES */}
          {activeTab === 'admissions' && (
            <motion.section
              key="admissions"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            >
              <Admissions />
            </motion.section>
          )}

          {/* GESTIÓN DE USUARIOS */}
          {activeTab === 'usermanagement' && (
            <motion.section
              key="usermanagement"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            >
              <UserManagement users={users} />
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* MODAL DE RECLAMACIÓN DE PERFIL */}
      <AnimatePresence>
        {showClaimModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowClaimModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {claimStatus === 'checking' && (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-amber-200 border-t-amber-600 mb-4"></div>
                  <h3 className="font-serif text-xl font-bold mb-2">
                    {isSpanish ? 'Verificando...' : 'Checking...'}
                  </h3>
                  <p className="text-gray-600">
                    {isSpanish ? 'Buscando publicaciones asociadas a tu email.' : 'Looking for publications associated with your email.'}
                  </p>
                </div>
              )}
              
              {claimStatus === 'available' && anonymousProfile && (
                <>
                  <h3 className="font-serif text-2xl font-bold mb-4">
                    {isSpanish ? '¡Perfil encontrado!' : 'Profile found!'}
                  </h3>
                  <div className="bg-amber-50 rounded-2xl p-6 mb-6">
                    <p className="text-amber-900 font-semibold mb-2">
                      {isSpanish ? 'Hemos encontrado un perfil como autor en los siguientes artículos:' : 'We found a profile as author in the following articles:'}
                    </p>
                    <ul className="list-disc list-inside text-amber-800 space-y-1">
                      {anonymousProfile.articles?.map((article, idx) => (
                        <li key={idx} className="text-sm">{article.title}</li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-gray-700 mb-6">
                    {isSpanish 
                      ? 'Al reclamar este perfil, todos estos artículos se vincularán automáticamente a tu cuenta y aparecerán en tu perfil público.'
                      : 'By claiming this profile, all these articles will be automatically linked to your account and will appear in your public profile.'}
                  </p>
                  
                  {claimError && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-2xl mb-6 text-sm">
                      {claimError}
                    </div>
                  )}
                  
                  <div className="flex gap-3">
                    <button
                      onClick={handleClaimProfile}
                      disabled={claimStatus === 'claiming'}
                      className="flex-1 py-4 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white font-bold rounded-2xl transition-all"
                    >
                      {claimStatus === 'claiming' ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          {isSpanish ? 'Reclamando...' : 'Claiming...'}
                        </span>
                      ) : (
                        isSpanish ? 'Reclamar Perfil' : 'Claim Profile'
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setShowClaimModal(false);
                        setClaimStatus('idle');
                        setAnonymousProfile(null);
                      }}
                      className="flex-1 py-4 border border-gray-300 hover:bg-gray-50 font-bold rounded-2xl transition-all"
                    >
                      {isSpanish ? 'Cancelar' : 'Cancel'}
                    </button>
                  </div>
                </>
              )}
              
              {claimStatus === 'success' && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="font-serif text-xl font-bold text-green-700 mb-2">
                    {isSpanish ? '¡Perfil reclamado con éxito!' : 'Profile claimed successfully!'}
                  </h3>
                  <p className="text-gray-600">
                    {isSpanish 
                      ? 'Tus publicaciones se han vinculado a tu cuenta. El sitio se actualizará en los próximos minutos.'
                      : 'Your publications have been linked to your account. The site will update in the next few minutes.'}
                  </p>
                </div>
              )}
              
              {claimStatus === 'error' && claimStatus !== 'claiming' && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <h3 className="font-serif text-xl font-bold text-red-700 mb-2">
                    {isSpanish ? 'Error al reclamar' : 'Error claiming profile'}
                  </h3>
                  <p className="text-gray-600 mb-4">{claimError || (isSpanish ? 'Intenta nuevamente más tarde' : 'Please try again later')}</p>
                  <button
                    onClick={() => setShowClaimModal(false)}
                    className="px-6 py-3 bg-gray-900 text-white rounded-xl font-bold"
                  >
                    {isSpanish ? 'Cerrar' : 'Close'}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}