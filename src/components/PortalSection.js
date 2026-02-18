import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Papa from 'papaparse';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { debounce } from 'lodash';
import { ReviewerWorkspace } from './Workspace';
import NewsUploadSection from './NewsUploadSection';
import TaskSection from './TaskSection';
import AssignSection from './AssignSection';
import DirectorPanel from './DirectorPanel';
import Admissions from './Admissions';
import { 
  UserIcon, 
  CameraIcon, 
  LinkIcon,
  AcademicCapIcon,
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
import { useLanguage } from '../hooks/useLanguage'; // <--- IMPORTANTE: Importar el hook

// <-- NUEVO: Importar funciones de reclamación
import { checkAnonymousProfile, claimAnonymousProfile } from '../firebase';

const ASSIGNMENTS_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS_RFrrfaVQHftZUhvJ1LVz0i_Tju-6PlYI8tAu5hLNLN21u8M7KV-eiruomZEcMuc_sxLZ1rXBhX1O/pub?output=csv';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby2B1OUt3TMqaed6Vz-iamUPn4gHhKXG2RRxiy8Nt6u69Cg-2kSze2XQ-NywX5QrNfy/exec';
const RUBRIC_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzehxU_O7GkzfiCqCsSdnFwvA_Mhtfr_vSZjqVsBo3yx8ZEpr9Qur4NHPI09tyH1AZe/exec';
const RUBRIC_CSV1 = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS1BhqyalgqRIACNtlt1C0cDSBqBXCtPABA8WnXFOnbDXkLauCpLjelu9GHv7i1XLvPY346suLE9Lag/pub?gid=0&single=true&output=csv';
const RUBRIC_CSV2 = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS1BhqyalgqRIACNtlt1C0cDSBqBXCtPABA8WnXFOnbDXkLauCpLjelu9GHv7i1XLvPY346suLE9Lag/pub?gid=1438370398&single=true&output=csv';
const RUBRIC_CSV3 = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS1BhqyalgqRIACNtlt1C0cDSBqBXCtPABA8WnXFOnbDXkLauCpLjelu9GHv7i1XLvPY346suLE9Lag/pub?gid=1972050001&single=true&output=csv';

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
  'Partner Institution': 'Institución Colaboradora',
  'Academic Advisor': 'Asesor Académico',
  'Community Manager': 'Community Manager'
};

const ALL_ROLES = Object.keys(ES_TO_EN);

const getDecisionText = (percent) => {
  if (percent >= 85) return 'Aceptar sin cambios.';
  if (percent >= 70) return 'Aceptar con cambios menores.';
  if (percent >= 50) return 'Revisión mayor requerida antes de publicar.';
  return 'Rechazar.';
};

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

const safeDecodeUnicode = (str) => {
  try {
    return base64DecodeUnicode(str);
  } catch {
    return str;
  }
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

/** * DISEÑO MODERNIZADO: Rúbrica estilo formulario de revisión por pares */
const RubricViewer = ({ roleKey, scores, onChange, readOnly = false }) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  
  const crits = criteria[roleKey];
  if (!crits) return null;
  const total = getTotal(scores, crits);
  const max = crits.length * 2;
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="bg-white border border-gray-100 rounded-3xl overflow-hidden mb-8 shadow-sm"
    >
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
        <h5 className="font-serif text-lg font-bold text-gray-900 uppercase tracking-tight">
          {isSpanish ? 'Protocolo de Evaluación:' : 'Evaluation Protocol:'} {roleKey}
        </h5>
        <div className="text-sm font-mono font-bold text-emerald-700 bg-emerald-50 px-4 py-1.5 rounded-2xl">
          {isSpanish ? 'PUNTAJE:' : 'SCORE:'} {total} / {max}
        </div>
      </div>
     
      <div className="p-6 space-y-8">
        {crits.map((c) => (
          <div key={c.key} className="border-b border-gray-100 last:border-0 pb-8">
            <div className="flex justify-between items-start mb-4">
              <h6 className="font-sans font-bold text-xs uppercase tracking-widest text-gray-500 break-words">{c.name}</h6>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {Object.entries(c.levels).map(([val, info]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => !readOnly && onChange && onChange(c.key, parseInt(val))}
                  className={`relative p-5 text-left border rounded-2xl transition-all duration-200 group ${
                    scores[c.key] == val
                    ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600'
                    : 'border-gray-200 hover:border-emerald-300 bg-white'
                  } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <span className={`block text-xs font-bold mb-2 ${scores[c.key] == val ? 'text-emerald-700' : 'text-gray-400'}`}>
                    {isSpanish ? 'NIVEL' : 'LEVEL'} {val}
                  </span>
                  <p className="text-sm text-gray-800 leading-snug break-words">{info.label.split('=')[1]}</p>
                  {scores[c.key] == val && (
                    <motion.div layoutId="check" className="absolute top-4 right-4 text-emerald-600">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293l-4 4a1 1 0 01-1.414 0l-2-2a1 1 0 111.414-1.414L9 10.586l3.293-3.293a1 1 0 011.414 1.414z"/></svg>
                    </motion.div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

/**
 * TARJETA DE ASIGNACIÓN: Estilo Card Editorial
 */
const AssignmentCard = ({ assignment, onClick, index }) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  
  const role = assignment.role;
  const isAuthorCard = role === 'Autor';
  const isCompleted = isAuthorCard
    ? (assignment.feedbackEditor && ['Aceptado', 'Rechazado'].includes(assignment.Estado))
    : assignment.isCompleted;
  
  // Traducir el rol para mostrarlo
  const displayRole = (role) => {
    if (!isSpanish) {
      return ES_TO_EN[role] || role;
    }
    return role;
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -4, scale: 1.01 }}
      onClick={onClick}
      className="group bg-white border border-gray-100 p-6 flex flex-col h-full hover:border-emerald-400 transition-all cursor-pointer relative overflow-hidden rounded-3xl shadow-sm"
    >
      <div className="flex justify-between items-start mb-4">
        <span className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
          {displayRole(role)}
        </span>
        <div className={`w-3 h-3 rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`} />
      </div>
     
      <h4 className="font-serif text-xl font-bold text-gray-900 group-hover:text-emerald-800 transition-colors mb-6 line-clamp-2 break-words leading-tight">
        {assignment['Nombre Artículo']}
      </h4>
      <div className="mt-auto pt-6 border-t border-gray-100 space-y-3">
        <div className="flex justify-between text-xs text-gray-500 font-sans">
          <span>{isSpanish ? 'PLAZO' : 'DEADLINE'}</span>
          <span className="font-bold text-gray-700 break-words">
            {assignment.Plazo 
              ? new Date(assignment.Plazo).toLocaleDateString(isSpanish ? 'es-ES' : 'en-US', { 
                  day: 'numeric', 
                  month: 'short', 
                  year: 'numeric' 
                }) 
              : (isSpanish ? 'SIN FECHA' : 'NO DATE')}
          </span>
        </div>
        <div className="flex justify-between text-xs text-gray-500 font-sans">
          <span>{isSpanish ? 'ESTADO' : 'STATUS'}</span>
          <span className={`font-bold break-words ${isCompleted ? 'text-emerald-700' : 'text-amber-700'}`}>
            {isCompleted 
              ? (isSpanish ? 'FINALIZADO' : 'COMPLETED') 
              : (isSpanish ? 'PENDIENTE' : 'PENDING')}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

/* ==================== NUEVO: COMPONENTE DE TAGS PARA INTERESES ==================== */
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
      {/* Tags actuales */}
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

      {/* Input + botón */}
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

// ==================== PERFIL (Totalmente Responsive) ====================
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
    // Soporte para arrays (nuevo) y fallback para strings antiguos
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
      {/* Encabezado Avatar - Totalmente Responsive */}
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

// ==================== GESTIÓN DE USUARIOS (Totalmente Responsive) ====================
const UserManagement = ({ users: initialUsers }) => {
  const [users, setUsers] = useState(initialUsers);
  const [searchTerm, setSearchTerm] = useState('');
  const { language } = useLanguage();
  const isSpanish = language === 'es';

  // Sincronizar con prop inicial
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
    console.warn('UserManagement: No users data available');
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
                  // Mostrar rol traducido si estamos en inglés
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

                {/* Selector de nuevo rol */}
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

                    {/* Selector de nuevo rol */}
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
  const { language } = useLanguage(); // <--- Hook de idioma
  const isSpanish = language === 'es';

  const [assignments, setAssignments] = useState([]);
  const [assignmentsFetched, setAssignmentsFetched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({});
  const [report, setReport] = useState({});
  const [vote, setVote] = useState({});
  const [rubricScores, setRubricScores] = useState({});
  const [tutorialVisible, setTutorialVisible] = useState({});
  const [submitStatus, setSubmitStatus] = useState({});
  const [rubricStatus, setRubricStatus] = useState({});
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('profile');
  const [showImageModal, setShowImageModal] = useState({});
  const [isEditingImage, setIsEditingImage] = useState({});
  const [imageData, setImageData] = useState({});
  const [editingRange, setEditingRange] = useState({});
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [expandedFeedback, setExpandedFeedback] = useState({});
  const [isDirectorPanelExpanded, setIsDirectorPanelExpanded] = useState(false);
  const [isChiefEditorPanelExpanded, setIsChiefEditorPanelExpanded] = useState(false);
  const [effectiveName, setEffectiveName] = useState(user?.displayName || '');
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const feedbackQuillRefs = useRef({});
  const reportQuillRefs = useRef({});
  const [loadingUser, setLoadingUser] = useState(true);
  
  // NUEVO: Datos en tiempo real desde Firebase
  const [userData, setUserData] = useState(user);
  const [users, setUsers] = useState([]);

  // <-- NUEVO: Estados para reclamación de perfil
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimStatus, setClaimStatus] = useState('idle'); // 'idle', 'checking', 'available', 'claiming', 'success', 'error'
  const [anonymousProfile, setAnonymousProfile] = useState(null);
  const [claimError, setClaimError] = useState('');

  const debouncedSetFeedback = useCallback(
    (link) => debounce((value) => {
      setFeedback((prev) => ({ ...prev, [link]: value }));
    }, 300),
    []
  );

  const debouncedSetReport = useCallback(
    (link) => debounce((value) => {
      setReport((prev) => ({ ...prev, [link]: value }));
    }, 300),
    []
  );

  const modules = useMemo(() => ({
    toolbar: {
      container: [
        ['bold', 'italic', 'underline', 'strike', 'blockquote'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        ['link', 'image', 'custom-image'],
        [{ 'align': ['', 'center', 'right', 'justify'] }],
        [{ 'size': ['small', false, 'large'] }],
        ['clean']
      ],
      handlers: {
        'custom-image': (value, link) => {
          setIsEditingImage((prev) => ({ ...prev, [link]: false }));
          setImageData((prev) => ({ ...prev, [link]: { url: '', width: '', height: '', align: 'left' } }));
          setShowImageModal((prev) => ({ ...prev, [link]: true }));
        }
      }
    },
    imageResize: {
      parchment: ReactQuill.Quill.import('parchment'),
      modules: ['Resize', 'DisplaySize'],
      handleStyles: {
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        border: 'none',
        color: 'white',
      },
      displayStyles: {
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        border: 'none',
        color: 'white',
      },
    },
    keyboard: {
      bindings: {
        deleteImage: {
          key: ['Delete', 'Backspace'],
          handler: function(range) {
            if (!range) return true;
            const editor = this.quill;
            const imageResize = editor.getModule('imageResize');
            let isImage = false;
            let deleteIndex = range.index;
            let deleteLength = 1;
            if (range.length === 0) {
              const [leaf] = editor.getLeaf(range.index);
              if (leaf && leaf.domNode && leaf.domNode.tagName === 'IMG') {
                isImage = true;
              } else {
                if (this.key === 'Backspace') {
                  const [prevLeaf] = editor.getLeaf(range.index - 1);
                  if (prevLeaf && prevLeaf.domNode && prevLeaf.domNode.tagName === 'IMG') {
                    isImage = true;
                    deleteIndex = range.index - 1;
                  }
                } else if (this.key === 'Delete') {
                  const [nextLeaf] = editor.getLeaf(range.index);
                  if (nextLeaf && nextLeaf.domNode && nextLeaf.domNode.tagName === 'IMG') {
                    isImage = true;
                    deleteIndex = range.index;
                  }
                }
              }
            } else if (range.length === 1) {
              const [leaf] = editor.getLeaf(range.index);
              if (leaf && leaf.domNode && leaf.domNode.tagName === 'IMG') {
                isImage = true;
              }
            }
            if (isImage) {
              try {
                if (imageResize) imageResize.hide();
                editor.deleteText(deleteIndex, deleteLength, ReactQuill.Quill.sources.USER);
                return false;
              } catch (err) {
                console.error('Error al eliminar imagen:', err);
                return false;
              }
            }
            return true;
          },
        },
        enterAfterImage: {
          key: 'Enter',
          handler: function(range) {
            if (!range) return true;
            const editor = this.quill;
            const [leaf] = editor.getLeaf(range.index);
            if (leaf && leaf.domNode && leaf.domNode.tagName === 'IMG') {
              try {
                editor.insertText(range.index + 1, '\n', ReactQuill.Quill.sources.USER);
                editor.setSelection(range.index + 2, ReactQuill.Quill.sources.SILENT);
                return false;
              } catch (err) {
                console.error('Error al insertar nueva línea después de imagen:', err);
                return false;
              }
            }
            return true;
          },
        },
      },
    },
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
  const isRrss = userRoles.includes('Encargado de Redes Sociales');
  const isWebDev = userRoles.includes('Responsable de Desarrollo Web');
  const canSeeCalendar = isChief || isDirector || isRrss || isWebDev || assignments.some(a => a.role !== 'Autor');

  const pendingAssignments = useMemo(() =>
    isAuthor
      ? assignments.filter(a => !a.feedbackEditor || !['Aceptado', 'Rechazado'].includes(a.Estado))
      : assignments.filter(a => !a.isCompleted),
    [assignments, isAuthor]
  );

  const completedAssignments = useMemo(() =>
    isAuthor
      ? assignments.filter(a => a.feedbackEditor && ['Aceptado', 'Rechazado'].includes(a.Estado))
      : assignments.filter(a => a.isCompleted),
    [assignments, isAuthor]
  );

  // Pestañas con textos bilingües
  const tabs = [
    { id: 'profile', label: isSpanish ? 'MI PERFIL' : 'MY PROFILE' },
    { id: 'assignments', label: isSpanish ? 'MIS ASIGNACIONES' : 'MY ASSIGNMENTS' },
    { id: 'completed', label: isSpanish ? 'COMPLETADAS' : 'COMPLETED' },
    { id: 'calendar', label: isSpanish ? 'CALENDARIO ACADÉMICO' : 'ACADEMIC CALENDAR', hidden: !canSeeCalendar },
    { id: 'submit', label: isSpanish ? 'ENVIAR MANUSCRITO' : 'SUBMIT MANUSCRIPT', hidden: !isAuthor },
    { id: 'director', label: isSpanish ? 'PANEL DIRECTIVO' : 'DIRECTOR PANEL', hidden: !isDirector },
    { id: 'chief', label: isSpanish ? 'PANEL EDITOR JEFE' : 'CHIEF EDITOR PANEL', hidden: !isChief },
    { id: 'tasks', label: isSpanish ? 'MIS TAREAS' : 'MY TASKS', hidden: !isRrss && !isWebDev },
    { id: 'news', label: isSpanish ? 'PUBLICAR NOTICIAS' : 'PUBLISH NEWS', hidden: !isDirector },
    { id: 'admissions', label: isSpanish ? 'ADMISIONES' : 'ADMISSIONS', hidden: !isDirector },
    { id: 'usermanagement', label: isSpanish ? 'GESTIÓN DE USUARIOS' : 'USER MANAGEMENT', hidden: !isDirector }
  ];

  const currentAssignments = activeTab === 'assignments' ? pendingAssignments : completedAssignments;

  useEffect(() => {
    if (!user) {
      console.log('User logged out or undefined, resetting states');
      setAssignments([]);
      setAssignmentsFetched(false);
      setLoading(false);
      setFeedback({});
      setReport({});
      setVote({});
      setRubricScores({});
      setTutorialVisible({});
      setSubmitStatus({});
      setRubricStatus({});
      setError('');
      setActiveTab('profile');
      setShowImageModal({});
      setIsEditingImage({});
      setImageData({});
      setEditingRange({});
      setSelectedAssignment(null);
      setExpandedFeedback({});
      setIsDirectorPanelExpanded(false);
      setIsChiefEditorPanelExpanded(false);
      setEffectiveName('');
      setCalendarEvents([]);
      setSelectedEvent(null);
      setUserData(null);
      setUsers([]);
    }
  }, [user]);

  // Snapshot de usuario (mejorado para effectiveName)
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
        // Fallback si el documento aún no existe (usuarios muy nuevos)
        setUserData(user);
        const name = user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || '';
        setEffectiveName(name);
        console.log('User document not found, using fallback:', name);
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

  useEffect(() => {
    if (!userData || !effectiveName) {
      setLoadingUser(true);
      console.log('Loading user: waiting for userData or effectiveName');
      return;
    }
    setLoadingUser(false);
    console.log('User loaded, effectiveName:', effectiveName);
  }, [userData, effectiveName]);

  // <-- NUEVO: Función para verificar perfil anónimo
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

  // <-- NUEVO: Función para reclamar perfil
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
        
        // Actualizar userData localmente
        setUserData(prev => ({
          ...prev,
          claimedAnonymousUid: anonymousProfile.anonymousUid,
          claimedAnonymousName: anonymousProfile.name,
          articlesClaimed: result.articlesClaimed
        }));
        
        // Cerrar modal después de 3 segundos
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

  // Fetch assignments only when relevant tabs are active
  useEffect(() => {
    if (['assignments', 'completed', 'calendar'].includes(activeTab) && !assignmentsFetched && !loading) {
      console.log('Fetching assignments for tab:', activeTab);
      fetchAssignments();
      setAssignmentsFetched(true);
    }
  }, [activeTab, assignmentsFetched, loading]);

  const fetchRubrics = async () => {
    console.log('Fetching rubrics');
    try {
      const [csv1Text, csv2Text, csv3Text] = await Promise.all([
        fetch(RUBRIC_CSV1, { cache: 'no-store' }).then(r => r.text()),
        fetch(RUBRIC_CSV2, { cache: 'no-store' }).then(r => r.text()),
        fetch(RUBRIC_CSV3, { cache: 'no-store' }).then(r => r.text())
      ]);
      const parseData = (csvText) => Papa.parse(csvText, { header: true, skipEmptyLines: true }).data;
      const data1 = parseData(csv1Text);
      const scoresMap1 = {};
      data1.forEach(row => {
        const name = row['Nombre del Artículo']?.trim();
        if (name) {
          scoresMap1[name] = {
            gramatica: parseInt(row['Gramática y ortografía']) || 0,
            claridad: parseInt(row['Claridad y coherencia']) || 0,
            estructura: parseInt(row['Estructura y organización']) || 0,
            citacion: parseInt(row['Citación y referencias']) || 0
          };
        }
      });
      const data2 = parseData(csv2Text);
      const scoresMap2 = {};
      data2.forEach(row => {
        const name = row['Nombre del Artículo']?.trim();
        if (name) {
          scoresMap2[name] = {
            relevancia: parseInt(row['Relevancia del tema']) || 0,
            rigor: parseInt(row['Rigor en el uso de fuentes']) || 0,
            originalidad: parseInt(row['Originalidad y creatividad']) || 0,
            argumentos: parseInt(row['Calidad de los argumentos']) || 0
          };
        }
      });
      const data3 = parseData(csv3Text);
      const scoresMap3 = {};
      data3.forEach(row => {
        const name = row['Nombre del Artículo']?.trim();
        if (name) {
          scoresMap3[name] = {
            modificaciones: parseInt(row['Grado de modificaciones']) || 0,
            calidad: parseInt(row['Calidad final del texto']) || 0,
            aporte: parseInt(row['Aporte global del ensayo']) || 0,
            potencial: parseInt(row['Potencial motivador']) || 0,
            decision: parseInt(row['Decisión final']) || 0
          };
        }
      });
      console.log('Rubrics fetched successfully');
      return { scoresMap1, scoresMap2, scoresMap3 };
    } catch (err) {
      console.error('Error fetching rubrics:', err);
      throw err;
    }
  };

  const fetchWithRetry = async (url, retries = 3, timeout = 10000) => {
    for (let i = 0; i < retries; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        return response.text();
      } catch (err) {
        console.warn(`Fetch retry ${i + 1} failed for ${url}:`, err);
        if (i === retries - 1) throw err;
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  };

  const fetchAssignments = async () => {
    console.log('Starting fetchAssignments for user:', effectiveName);
    setLoading(true);
    setError('');
    try {
      const [csvText, rubrics] = await Promise.all([
        fetchWithRetry(ASSIGNMENTS_CSV),
        fetchRubrics()
      ]);
      console.log('CSV fetched, length:', csvText.length);
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        delimiter: ',',
        transform: (value) => value.trim(),
        complete: ({ data }) => {
          console.log('Papa parse complete, rows:', data.length);
          const normalizedEffectiveName = effectiveName.trim().toLowerCase();
          const authorRows = data.filter(row => {
            const autores = row['Autor'] || '';
            return autores
              .split(';')
              .map(a => a.trim().toLowerCase())
              .includes(normalizedEffectiveName);
          });
          console.log('Author rows found:', authorRows.length);
          const authorAssignments = authorRows.map(row => ({
            id: row['Nombre Artículo'],
            'Nombre Artículo': row['Nombre Artículo'] || (isSpanish ? 'Sin título' : 'No title'),
            Estado: row['Estado'],
            role: 'Autor',
            feedbackEditor: row['Feedback 3'] || (isSpanish ? 'No hay feedback del editor aún.' : 'No editor feedback yet.'),
            isCompleted: !!row['Feedback 3'],
            Plazo: row['Plazo'] || null,
          }));
          const reviewerRows = data
            .filter(row => {
              return row['Revisor 1']?.trim() === effectiveName ||
                     row['Revisor 2']?.trim() === effectiveName ||
                     row['Editor']?.trim() === effectiveName;
            });
          console.log('Reviewer rows found:', reviewerRows.length);
          const reviewerAssignments = reviewerRows.map(row => {
            const role = row['Revisor 1']?.trim() === effectiveName ? 'Revisor 1'
                      : row['Revisor 2']?.trim() === effectiveName ? 'Revisor 2'
                      : 'Editor';
            const num = role === 'Revisor 1' ? 1 : role === 'Revisor 2' ? 2 : 3;
            const assignment = {
              id: row['Nombre Artículo'],
              'Nombre Artículo': row['Nombre Artículo'] || (isSpanish ? 'Sin título' : 'No title'),
              'Link Artículo': row['Link Artículo'],
              Estado: row['Estado'],
              role,
              feedback: row[`Feedback ${num}`] || '',
              report: row[`Informe ${num}`] || '',
              vote: row[`Voto ${num}`] || '',
              feedback1: row['Feedback 1'] || (isSpanish ? 'No hay feedback del Revisor 1.' : 'No feedback from Reviewer 1.'),
              feedback2: row['Feedback 2'] || (isSpanish ? 'No hay feedback del Revisor 2.' : 'No feedback from Reviewer 2.'),
              informe1: row['Informe 1'] || (isSpanish ? 'No hay informe del Revisor 1.' : 'No report from Reviewer 1.'),
              informe2: row['Informe 2'] || (isSpanish ? 'No hay informe del Revisor 2.' : 'No report from Reviewer 2.'),
              isCompleted: !!row[`Feedback ${num}`] && !!row[`Informe ${num}`] && !!row[`Voto ${num}`],
              Plazo: row['Plazo'] || null,
            };
            const name = assignment.id;
            if (role === 'Revisor 1') {
              assignment.scores = rubrics.scoresMap1[name] || { gramatica: 0, claridad: 0, estructura: 0, citacion: 0 };
            } else if (role === 'Revisor 2') {
              assignment.scores = rubrics.scoresMap2[name] || { relevancia: 0, rigor: 0, originalidad: 0, argumentos: 0 };
            } else {
              assignment.rev1Scores = rubrics.scoresMap1[name] || { gramatica: 0, claridad: 0, estructura: 0, citacion: 0 };
              assignment.rev2Scores = rubrics.scoresMap2[name] || { relevancia: 0, rigor: 0, originalidad: 0, argumentos: 0 };
              assignment.scores = rubrics.scoresMap3[name] || { modificaciones: 0, calidad: 0, aporte: 0, potencial: 0, decision: 0 };
            }
            return assignment;
          });
          const parsedAssignments = [...reviewerAssignments, ...authorAssignments];
          console.log('Total assignments:', parsedAssignments.length);
          setAssignments(parsedAssignments);
          parsedAssignments.forEach(assignment => {
            if (assignment.role !== 'Autor') {
              const link = assignment['Link Artículo'];
              setVote(prev => ({ ...prev, [link]: assignment.vote }));
              setFeedback(prev => ({ ...prev, [link]: safeDecodeUnicode(assignment.feedback) }));
              setReport(prev => ({ ...prev, [link]: safeDecodeUnicode(assignment.report) }));
              setRubricScores(prev => ({ ...prev, [link]: assignment.scores }));
            }
          });
          const events = parsedAssignments
            .filter(ass => ass.Plazo)
            .map(ass => ({
              title: `${ass['Nombre Artículo']} - ${ass.role}`,
              start: new Date(ass.Plazo),
              end: new Date(ass.Plazo),
              allDay: true,
              resource: ass,
            }));
          setCalendarEvents(events);
          console.log('Calendar events set:', events.length);
          setLoading(false);
        },
        error: (err) => {
          console.error('Error al parsear CSV:', err);
          setError(isSpanish ? 'Error al cargar asignaciones' : 'Error loading assignments');
          setLoading(false);
        },
      });
    } catch (err) {
      console.error('Error al cargar asignaciones:', err);
      setError(isSpanish ? 'Error al conectar al servidor' : 'Error connecting to server');
      setLoading(false);
    }
  };

  const retryFetchAssignments = () => {
    console.log('Retrying fetchAssignments');
    setError('');
    setLoading(true);
    setAssignmentsFetched(false); // Allow refetch
  };

  const handleVote = (link, value) => {
    setVote((prev) => ({ ...prev, [link]: value }));
  };

  const handleRubricChange = (link, key, value) => {
    setRubricScores((prev) => ({
      ...prev,
      [link]: { ...prev[link], [key]: value }
    }));
  };

  const getRequiredKeys = (role) => {
    switch (role) {
      case 'Revisor 1': return ['gramatica', 'claridad', 'estructura', 'citacion'];
      case 'Revisor 2': return ['relevancia', 'rigor', 'originalidad', 'argumentos'];
      case 'Editor': return ['modificaciones', 'calidad', 'aporte', 'potencial', 'decision'];
      default: return [];
    }
  };

  const isRubricComplete = (link, role) => {
    const rubric = rubricScores[link] || {};
    const required = getRequiredKeys(role);
    return required.every(key => rubric[key] !== undefined && rubric[key] !== null);
  };

  const handleSubmitRubric = async (link, role) => {
    console.log('Submitting rubric for link:', link, 'role:', role);
    const articleName = assignments.find(a => a['Link Artículo'] === link)['Nombre Artículo'];
    const rubric = rubricScores[link] || {};
    const requiredKeys = getRequiredKeys(role);
    const missingKeys = requiredKeys.filter(key => rubric[key] === undefined || rubric[key] === null || isNaN(rubric[key]));
    if (missingKeys.length > 0) {
      setRubricStatus((prev) => ({ ...prev, [link]: isSpanish 
        ? `Error: Rúbrica incompleta. Faltante o inválido: ${missingKeys.join(', ')}`
        : `Error: Incomplete rubric. Missing or invalid: ${missingKeys.join(', ')}` }));
      console.warn('Rubric incomplete:', missingKeys);
      return;
    }
    const rubricData = {
      articleName: articleName.trim(),
      role,
      rubric
    };
    try {
      let success = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const response = await fetch(RUBRIC_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(rubricData),
          });
          success = true;
          console.log('Rubric submitted successfully on attempt', attempt);
          break;
        } catch (err) {
          console.warn(`Rubric submit attempt ${attempt} failed:`, err);
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }
      if (success) {
        setRubricStatus((prev) => ({ ...prev, [link]: isSpanish ? 'Rúbrica enviada con éxito' : 'Rubric submitted successfully' }));
        await fetchAssignments();
      } else {
        setRubricStatus((prev) => ({ ...prev, [link]: isSpanish 
          ? 'Error al enviar rúbrica después de 3 intentos' 
          : 'Error submitting rubric after 3 attempts' }));
      }
    } catch (err) {
      console.error('Error general al enviar rúbrica:', err);
      setRubricStatus((prev) => ({ ...prev, [link]: `Error: ${err.message}` }));
    }
  };

  const handleSubmit = async (link, role, feedbackText, reportText, voteValue) => {
    console.log('Submitting data for link:', link, 'role:', role);
    const encodedFeedback = base64EncodeUnicode(sanitizeInput(feedbackText || ''));
    const encodedReport = base64EncodeUnicode(sanitizeInput(reportText || ''));
    const mainData = {
      link,
      role,
      vote: voteValue || '',
      feedback: encodedFeedback,
      report: encodedReport,
    };
    try {
      let mainSuccess = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(mainData),
          });
          mainSuccess = true;
          console.log('Data submitted successfully on attempt', attempt);
          break;
        } catch (err) {
          console.warn(`Data submit attempt ${attempt} failed:`, err);
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }
      if (mainSuccess) {
        setSubmitStatus((prev) => ({ ...prev, [link]: isSpanish ? 'Datos principales enviados con éxito' : 'Main data submitted successfully' }));
        await fetchAssignments();
      } else {
        setSubmitStatus((prev) => ({ ...prev, [link]: isSpanish 
          ? 'Error al enviar datos principales después de 3 intentos' 
          : 'Error submitting main data after 3 attempts' }));
      }
    } catch (err) {
      console.error('Error general al enviar datos principales:', err);
      setSubmitStatus((prev) => ({ ...prev, [link]: `Error: ${err.message}` }));
    }
  };

  const toggleTutorial = (link) => {
    setTutorialVisible((prev) => ({ ...prev, [link]: !prev[link] }));
  };

  const toggleFeedback = (link, type) => {
    setExpandedFeedback((prev) => ({
      ...prev,
      [link]: { ...prev[link], [type]: !prev[link]?.[type] }
    }));
  };

  const getTutorialText = (role) => {
    if (!isSpanish) {
      // Versión en inglés
      if (role === "Revisor 1") {
        return 'As Reviewer 1, your role is to review technical aspects such as grammar, spelling, source citation, AI-generated content detection, logical coherence, and overall structure. Provide detailed comments in the Google Drive document to suggest improvements. Ensure the language is clear and academic. You must provide feedback to the author in the corresponding box. Additionally, submit a summarized report explaining your observations to guide the editor. Finally, in the vote box, enter "yes" if you approve the article, and "no" if you reject it.';
      } else if (role === "Revisor 2") {
        return 'As Reviewer 2, focus on substantive content: verify source accuracy, topic seriousness and originality, argument relevance, and contribution to the field. Evaluate if the article is innovative and well-supported. Leave comments in the Google Drive document. You must provide feedback to the author in the corresponding box. Additionally, submit a summarized report explaining your observations to guide the editor. Finally, in the vote box, enter "yes" if you approve the article, and "no" if you reject it.';
      } else if (role === "Editor") {
        return `As Editor, your responsibility is to review the reviewers' feedback and reports, integrate them with your own evaluation, and write a final sensitive and constructive feedback for the author. Edit the text directly if necessary and decide the article's final status. Use the Google Drive document for edits. You must provide feedback to the author synthesizing the reviewers' feedback. Your message must be precise and sensitive, without discouraging the author. Use the "sandwich" technique. If you don't know what it is, consult <a href="https://www.santanderopenacademy.com/en/blog/sandwich-technique.html" style="color: blue;">here</a>. Based on psychological studies indicating feedback improves performance in only 30% of cases if mishandled, ensure criticism is specific, actionable, and not diluted by positive comments to maximize effectiveness. Complement with the SBI model (Situation-Behavior-Impact) for clarity: describe the situation, observed behavior, and impact. Then, submit your report with changes made, which must be precise and academic. Finally, in the vote box, enter "yes" if you approve the article, and "no" if you reject it.`;
      }
    } else {
      // Versión en español (original)
      if (role === "Revisor 1") {
        return 'Como Revisor 1, tu rol es revisar aspectos técnicos como gramática, ortografía, citación de fuentes, detección de contenido generado por IA, coherencia lógica y estructura general del artículo. Proporciona comentarios detallados en el documento de Google Drive para sugerir mejoras. Asegúrate de que el lenguaje sea claro y académico. Debes proporcionar feedback al autor en la caja correspondiente. Además, debes enviar un informe resumido explicando tus observaciones para guiar al editor. Finalmente, en la caja de voto, ingresa "si" si apruebas el artículo, y "no" si lo rechazas.';
      } else if (role === "Revisor 2") {
        return 'Como Revisor 2, enfócate en el contenido sustantivo: verifica la precisión de las fuentes, la seriedad y originalidad del tema, la relevancia de los argumentos y la contribución al campo de estudio. Evalúa si el artículo es innovador y bien respaldado. Deja comentarios en el documento de Google Drive. Debes proporcionar feedback al autor en la caja correspondiente. Además, debes enviar un informe resumido explicando tus observaciones para guiar al editor. Finalmente, en la caja de voto, ingresa "si" si apruebas el artículo, y "no" si lo rechazas.';
      } else if (role === "Editor") {
        return `Como Editor, tu responsabilidad es revisar el feedback y los informes de los revisores, integrarlos con tu propia evaluación, y escribir un feedback final sensible y constructivo para el autor. Edita el texto directamente si es necesario y decide el estado final del artículo. Usa el documento de Google Drive para ediciones. Debes proporcionar feedback al autor sintetizando el feedback de los revisores. Tu mensaje debe ser preciso y sensible, sin desanimar al autor. Para esto, usa la técnica "sandwich". Si no sabes qué es, consulta <a href="https://www.santanderopenacademy.com/es/blog/tecnica-sandwich.html" style="color: blue;">aquí</a>. Basado en estudios psicológicos, como aquellos que indican que el feedback mejora el rendimiento solo en el 30% de los casos si no se maneja bien, asegúrate de que la crítica sea específica, accionable y no diluida por comentarios positivos para maximizar la efectividad. Puedes complementar con el modelo SBI (Situación-Comportamiento-Impacto) para mayor claridad: describe la situación, el comportamiento observado y su impacto. Luego, envía tu informe con los cambios realizados, que debe ser preciso y académico. Finalmente, en la caja de voto, ingresa "si" si apruebas el artículo, y "no" si lo rechazas.`;
      }
    }
    return "";
  };

  const Tutorial = ({ role }) => {
    const tutorialText = getTutorialText(role);
    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="text-gray-800 bg-gray-50 p-6 rounded-2xl border border-gray-100 leading-relaxed break-words overflow-hidden font-sans text-sm"
      >
        <div className="mb-4" dangerouslySetInnerHTML={{ __html: tutorialText }} />
      </motion.div>
    );
  };

  const decodeBody = (encoded) => {
    if (!encoded) return <p className="text-gray-600 font-sans text-sm break-words">
      {isSpanish ? 'No hay contenido disponible.' : 'No content available.'}
    </p>;
    try {
      const html = base64DecodeUnicode(encoded);
      return <div className="ql-editor break-words leading-relaxed font-sans text-sm text-gray-800" dangerouslySetInnerHTML={{ __html: html }} />;
    } catch (err) {
      console.error('Error al decodificar contenido:', err);
      return <div className="ql-editor break-words leading-relaxed font-sans text-sm text-gray-800" dangerouslySetInnerHTML={{ __html: encoded }} />;
    }
  };

  const handleImageModalSubmit = (link) => {
    const quillRef = feedbackQuillRefs.current[link] || reportQuillRefs.current[link];
    if (!quillRef) return;
    const editor = quillRef.getEditor();
    let { url, width, height, align } = imageData[link] || {};
    if (!url) {
      setSubmitStatus((prev) => ({ ...prev, [link]: isSpanish ? 'La URL de la imagen es requerida.' : 'Image URL is required.' }));
      return;
    }
    if (width && width !== 'auto' && !width.match(/%|px$/)) width += 'px';
    if (height && height !== 'auto' && !height.match(/%|px$/)) height += 'px';
    if (isEditingImage[link]) {
      if (editingRange[link]) {
        editor.setSelection(editingRange[link].index, 1, 'silent');
        const [leaf] = editor.getLeaf(editingRange[link].index);
        if (leaf && leaf.domNode.tagName === 'IMG') {
          if (width) leaf.domNode.style.width = width;
          if (height) leaf.domNode.style.height = height;
          editor.format('align', align, 'user');
        }
        editor.blur();
      }
    } else {
      const range = editor.getSelection() || { index: editor.getLength() };
      editor.insertText(range.index, '\n', 'user');
      editor.insertEmbed(range.index + 1, 'image', url, 'user');
      editor.setSelection(range.index + 2, 'silent');
      const [leaf] = editor.getLeaf(range.index + 1);
      if (leaf && leaf.domNode.tagName === 'IMG') {
        if (width) leaf.domNode.style.width = width;
        if (height) leaf.domNode.style.height = height;
        editor.setSelection(range.index + 1, 1, 'silent');
        editor.format('align', align, 'user');
        editor.setSelection(range.index + 2, 'silent');
      }
    }
    setShowImageModal((prev) => ({ ...prev, [link]: false }));
    setIsEditingImage((prev) => ({ ...prev, [link]: false }));
    setImageData((prev) => ({ ...prev, [link]: { url: '', width: '', height: '', align: 'left' } }));
    setEditingRange((prev) => ({ ...prev, [link]: null }));
  };

  const handleImageDataChange = (link, e) => {
    const { name, value } = e.target;
    setImageData((prev) => ({
      ...prev,
      [link]: { ...prev[link], [name]: value }
    }));
  };

  if (loadingUser) {
    console.log('Showing loading spinner: loadingUser true');
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

  if (loading && ['assignments', 'completed', 'calendar'].includes(activeTab)) {
    console.log('Showing loading spinner: loading true for assignments tab');
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
          <p className="mt-6 text-gray-500 font-medium tracking-wider">
            {isSpanish ? 'CARGANDO ASIGNACIONES...' : 'LOADING ASSIGNMENTS...'}
          </p>
        </div>
      </div>
    );
  }

  if (!effectiveName) {
    console.error('No effectiveName, rendering error');
    return <div className="text-red-600 text-center p-4">
      {isSpanish ? 'Usuario no definido' : 'User not defined'}
    </div>;
  }

  if (!userData) {
    console.warn('No userData, rendering loading');
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

      {/* Navegación Estilo Editorial - Scroll horizontal en móvil */}
      <nav className="flex overflow-x-auto pb-2 mb-6 sm:mb-8 md:mb-12 border-b border-gray-200 gap-4 md:gap-8 whitespace-nowrap">
        {tabs.filter(t => !t.hidden).map(tab => (
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
          {activeTab === 'profile' && (
            <motion.section
              key="profile"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            >
              <ProfileSection user={userData} />
              
              {/* <-- NUEVO: Botón de reclamación después del perfil */}
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

          {(activeTab === 'assignments' || activeTab === 'completed') && (
            <motion.section
              key="assignments"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            >
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-100 text-red-700 p-4 sm:p-6 rounded-xl sm:rounded-2xl mb-6 sm:mb-8 font-sans text-sm break-words"
                >
                  {error}
                  <button 
                    onClick={retryFetchAssignments}
                    className="ml-4 text-blue-600 underline"
                  >
                    {isSpanish ? 'Reintentar' : 'Retry'}
                  </button>
                </motion.div>
              )}
              {loading ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-center items-center h-32"
                >
                  <div className="animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 border-t-2 border-b-2 border-emerald-600"></div>
                  <p className="ml-3 sm:ml-4 text-sm sm:text-base text-gray-600 font-sans break-words">
                    {isSpanish ? 'Cargando asignaciones...' : 'Loading assignments...'}
                  </p>
                </motion.div>
              ) : currentAssignments.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center p-6 sm:p-8 md:p-12 bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm"
                >
                  <svg className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <h3 className="mt-3 sm:mt-4 font-serif text-lg sm:text-xl font-bold text-gray-900 break-words">
                    {isSpanish 
                      ? `No hay asignaciones ${activeTab === 'assignments' ? 'pendientes' : 'completadas'} en este momento.`
                      : `No ${activeTab === 'assignments' ? 'pending' : 'completed'} assignments at this time.`}
                  </h3>
                  <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600 font-sans break-words">
                    {isSpanish ? 'Manténgase atento para nuevas oportunidades.' : 'Stay tuned for new opportunities.'}
                  </p>
                </motion.div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                  {currentAssignments.map((ass, idx) => (
                    <AssignmentCard
                      key={ass.id}
                      assignment={ass}
                      index={idx}
                      onClick={() => setSelectedAssignment(ass)}
                    />
                  ))}
                </div>
              )}
            </motion.section>
          )}
          
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
                }}
              />
            </motion.section>
          )}
          
          {activeTab === 'calendar' && (
            <motion.section
              key="calendar"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            >
              <CalendarComponent events={calendarEvents} onSelectEvent={(e) => setSelectedAssignment(e.resource)} />
            </motion.section>
          )}

          {activeTab === 'director' && (
            <motion.section
              key="director"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            >
              <DirectorPanel 
                user={userData} 
                isExpanded={isDirectorPanelExpanded} 
                onToggle={() => setIsDirectorPanelExpanded(!isDirectorPanelExpanded)} 
              />
            </motion.section>
          )}

          {activeTab === 'chief' && (
            <motion.section
              key="chief"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            >
              <AssignSection 
                user={userData} 
                isExpanded={isChiefEditorPanelExpanded} 
                onToggle={() => setIsChiefEditorPanelExpanded(!isChiefEditorPanelExpanded)} 
              />
            </motion.section>
          )}

          {activeTab === 'tasks' && (
            <motion.section
              key="tasks"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            >
              <TaskSection user={userData} />
            </motion.section>
          )}

          {activeTab === 'news' && (
            <motion.section
              key="news"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            >
              <NewsUploadSection />
            </motion.section>
          )}

          {activeTab === 'admissions' && (
            <motion.section
              key="admissions"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            >
              <Admissions />
            </motion.section>
          )}

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

      {/* MODAL DE DETALLE */}
      <AnimatePresence>
        {selectedAssignment && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-white/95 backdrop-blur-sm overflow-y-auto px-2 py-4 sm:px-4 sm:py-8 md:py-12"
          >
            <div className="max-w-4xl mx-auto">
              <button
                onClick={() => setSelectedAssignment(null)}
                className="mb-4 sm:mb-6 md:mb-8 font-sans font-bold text-xs uppercase tracking-widest flex items-center hover:text-emerald-600 transition-colors"
              >
                ← {isSpanish ? 'Volver al Portal' : 'Back to Portal'}
              </button>
              <header className="mb-6 sm:mb-8 md:mb-12">
                <span className="text-xs font-bold text-emerald-600 tracking-[0.3em] uppercase break-words">{selectedAssignment.role}</span>
                <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mt-2 mb-3 md:mb-4 leading-tight break-words">
                  {selectedAssignment['Nombre Artículo']}
                </h2>
                <div className="h-1 w-16 sm:w-20 md:w-24 bg-gray-900" />
              </header>

              <ReviewerWorkspace 
                assignment={selectedAssignment}
                onClose={() => setSelectedAssignment(null)}
                handleSubmitRubric={handleSubmitRubric}
                handleSubmit={handleSubmit}
                handleVote={handleVote}
                rubricScores={rubricScores}
                feedback={feedback}
                report={report}
                vote={vote}
                rubricStatus={rubricStatus}
                submitStatus={submitStatus}
                isPending={activeTab === 'assignments'}
                role={selectedAssignment.role}
                link={selectedAssignment['Link Artículo']}
                toggleTutorial={toggleTutorial}
                tutorialVisible={tutorialVisible}
                debouncedSetFeedback={debouncedSetFeedback}
                debouncedSetReport={debouncedSetReport}
                modules={modules}
                formats={formats}
                decodeBody={decodeBody}
                showImageModal={showImageModal}
                imageData={imageData}
                isEditingImage={isEditingImage}
                handleImageDataChange={handleImageDataChange}
                handleImageModalSubmit={handleImageModalSubmit}
                expandedFeedback={expandedFeedback}
                toggleFeedback={toggleFeedback}
                getDecisionText={getDecisionText}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* <-- NUEVO: MODAL DE RECLAMACIÓN DE PERFIL */}
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