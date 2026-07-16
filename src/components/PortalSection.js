// src/components/PortalSection.js (VERSIÓN CORREGIDA - SIN ERROR 404)
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
import ReviewerInvitationsPanel from './ReviewerInvitationsPanel';
import AuthorSubmissionsPanel from './AuthorSubmissionsPanel';
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
import { db, onSnapshot, query, collection, doc, updateDoc, uploadImageToImgBB, updateRole, auth } from '../firebase';
import { signOut } from 'firebase/auth'; 
import SubmissionForm from './SubmissionForm';
import { useLanguage } from '../hooks/useLanguage';
import { useReviewerAssignment } from '../hooks/useReviewerAssignment';
import { useNavigate, useLocation } from 'react-router-dom';
import { checkAnonymousProfile, claimAnonymousProfile } from '../firebase';

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
// En el componente PortalSection, agrega esta función
const checkForAnonymousProfile = useCallback(async () => {
  if (!user?.email) {
    setClaimStatus('not-available');
    setShowClaimModal(true);
    return;
  }
  
  setClaimStatus('checking');
  setShowClaimModal(true);
  setClaimError('');
  
  try {
    // Llamada a la Cloud Function
    const result = await checkAnonymousProfile({
      email: user.email
    });
    
    if (result.hasProfile && result.profile) {
      setAnonymousProfile(result.profile);
      setClaimStatus('available');
    } else {
      setClaimStatus('not-available');
    }
  } catch (error) {
    console.error('Error al verificar perfil anónimo:', error);
    setClaimStatus('error');
    setClaimError(
      error.details?.message || 
      error.message || 
      (isSpanish ? 'Error al verificar el perfil' : 'Error verifying profile')
    );
  }
}, [user, isSpanish]);

// También actualiza la función handleClaimProfile para usar la Cloud Function correctamente
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
      
      // Actualizar datos locales del usuario
      setUserData(prev => ({
        ...prev,
        claimedAnonymousUid: anonymousProfile.anonymousUid,
        claimedAnonymousName: anonymousProfile.name,
        articlesClaimed: result.articlesClaimed,
        roles: prev.roles?.includes('Autor') ? prev.roles : [...(prev.roles || []), 'Autor']
      }));
      
      // Cerrar el modal después de 3 segundos
      setTimeout(() => {
        setShowClaimModal(false);
        setClaimStatus('idle');
        setAnonymousProfile(null);
      }, 3000);
    }
  } catch (error) {
    console.error('Error al reclamar perfil:', error);
    setClaimStatus('error');
    setClaimError(
      error.details?.message || 
      error.message || 
      (isSpanish ? 'Error al reclamar perfil' : 'Error claiming profile')
    );
  }
}, [anonymousProfile, isSpanish]);
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
        <div className="bg-[#fdf6f3] border-l-4 border-[#e86125] text-gray-800 p-6 m-4 shadow-sm rounded-r-md font-sans">
          <h3 className="font-bold text-[#e86125] uppercase tracking-wider text-sm mb-2">Error Crítico</h3>
          <p className="text-sm">Ocurrió un error en el portal. Por favor recargue la página.</p>
          <details className="mt-4 text-xs text-gray-500 bg-white p-4 border border-gray-200 rounded">
            <summary className="cursor-pointer font-bold text-[#004b87]">Detalles técnicos</summary>
            <pre className="mt-2 overflow-x-auto">{this.state.error?.message}</pre>
            <pre className="mt-2 overflow-x-auto">{this.state.errorInfo?.componentStack}</pre>
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
    <div className="bg-white border border-gray-200 border-t-4 border-t-[#004b87] p-6 md:p-10 rounded-lg shadow-sm mb-6 overflow-hidden">
      <h3 className="font-serif text-2xl font-bold text-gray-900 mb-6 pb-4 border-b border-gray-100">
        {isSpanish ? 'Calendario de Plazos' : 'Deadline Calendar'}
      </h3>
      <div className="h-[500px] md:h-[700px] font-sans">
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
          className="border border-gray-200 rounded-md overflow-hidden bg-white"
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
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="group bg-[#f4f5f7] border border-gray-200 hover:border-[#004b87] transition-colors text-[#2b2b2b] text-xs font-medium px-3 py-1.5 rounded-md flex items-center gap-2"
          >
            {tag}
            <button
              onClick={() => removeTag(index)}
              className="text-gray-400 hover:text-[#e86125] transition-colors"
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
          className="flex-1 p-3 bg-[#f8f9fa] border border-gray-200 rounded-md focus:ring-1 focus:ring-[#004b87] focus:border-[#004b87] text-sm text-gray-800 placeholder-gray-400 font-sans transition-all"
        />
        <button
          onClick={addTag}
          className="px-6 py-3 bg-[#004b87] hover:bg-[#003666] transition-all text-white font-bold tracking-wider text-xs uppercase rounded-md flex items-center justify-center gap-2 shadow-sm active:scale-95"
        >
          <PlusIcon className="w-4 h-4" />
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
    return <div className="text-center p-8 font-sans text-sm tracking-widest uppercase text-gray-500">{language === 'es' ? 'Cargando perfil...' : 'Loading profile...'}</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 px-2 sm:px-4 font-sans text-[#2b2b2b]">
      
      {/* Encabezado Avatar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 border-t-4 border-t-[#004b87] p-8 lg:p-10 flex flex-col lg:flex-row items-center gap-8 lg:gap-12 relative overflow-hidden">
        <div className="relative group flex-shrink-0">
          <div className="w-36 h-36 lg:w-44 lg:h-44 rounded-lg overflow-hidden ring-1 ring-gray-200 shadow-sm relative bg-[#f4f5f7]">
            {form.imageUrl ? (
              <img src={form.imageUrl} className="object-cover w-full h-full" alt={language === 'es' ? 'Perfil' : 'Profile'} />
            ) : (
              <div className="flex items-center justify-center w-full h-full">
                <UserIcon className="w-16 h-16 text-gray-300" />
              </div>
            )}

            {uploading && (
              <div className="absolute inset-0 bg-[#004b87]/80 backdrop-blur-sm flex flex-col items-center justify-center">
                <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mb-2" />
                <span className="text-white text-xs font-bold tracking-widest">
                  {language === 'es' ? 'SUBIENDO...' : 'UPLOADING...'}
                </span>
              </div>
            )}

            <label className="absolute inset-0 flex items-center justify-center bg-[#004b87]/0 group-hover:bg-[#004b87]/60 transition-all duration-300 cursor-pointer">
              <CameraIcon className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="hidden" />
            </label>
          </div>
        </div>

        <div className="flex-1 text-center lg:text-left">
          <h2 className="text-3xl lg:text-4xl font-serif font-bold text-gray-900 mb-2 border-b border-gray-100 pb-4 inline-block lg:block">
            {form.firstName} {form.lastName}
          </h2>
          <p className="text-base font-sans text-[#666] tracking-wide uppercase text-sm mt-4">
            {form.institution || (language === 'es' ? 'Sin institución afiliada' : 'No affiliated institution')}
          </p>
          {form.orcid && (
            <a href={`https://orcid.org/${form.orcid}`} target="_blank" rel="noreferrer" className="text-[#004b87] hover:text-[#e86125] transition-colors text-sm font-mono mt-3 inline-flex items-center gap-2 font-medium">
              <span className="bg-[#e86125] text-white text-[10px] px-2 py-0.5 rounded-sm font-bold tracking-wider">ORCID</span>
              {form.orcid}
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Columna Izquierda */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* Biografía */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 lg:p-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-4 border-b border-gray-100">
              <h3 className="font-serif text-2xl font-bold text-gray-900">
                {language === 'es' ? 'Biografía e Intereses' : 'Biography & Interests'}
              </h3>
              
              <div className="flex bg-[#f4f5f7] rounded-md p-1 border border-gray-200">
                <button 
                  onClick={() => setLang('es')} 
                  className={`px-4 py-1.5 rounded text-xs font-bold tracking-wider transition-all ${lang === 'es' ? 'bg-white shadow-sm text-[#004b87] border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  ESPAÑOL
                </button>
                <button 
                  onClick={() => setLang('en')} 
                  className={`px-4 py-1.5 rounded text-xs font-bold tracking-wider transition-all ${lang === 'en' ? 'bg-white shadow-sm text-[#004b87] border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  ENGLISH
                </button>
              </div>
            </div>

            <div className="space-y-8">
              <div>
                <label className="block text-xs tracking-[0.15em] font-bold text-[#666] uppercase mb-3">
                  {language === 'es' ? 'Descripción Académica' : 'Academic Description'}
                </label>
                <textarea
                  name={lang === 'es' ? 'descriptionEs' : 'descriptionEn'}
                  value={lang === 'es' ? form.descriptionEs : form.descriptionEn}
                  onChange={handleChange}
                  className="w-full h-48 p-4 bg-[#f9fafb] border border-gray-200 rounded-md focus:ring-1 focus:ring-[#004b87] focus:border-[#004b87] resize-y text-sm leading-relaxed text-[#2b2b2b] transition-all"
                  placeholder={lang === 'es' ? 'Resumen de trayectoria académica, publicaciones y enfoque de investigación...' : 'Summary of academic trajectory, publications, and research focus...'}
                />
              </div>

              <div>
                <label className="block text-xs tracking-[0.15em] font-bold text-[#666] uppercase mb-3">
                  {language === 'es' ? 'Áreas de Especialidad' : 'Areas of Expertise'}
                </label>
                <InterestsTags
                  value={lang === 'es' ? form.interestsEs : form.interestsEn}
                  onChange={(newTags) => handleInterestsChange(lang, newTags)}
                  placeholder={lang === 'es' ? 'Economía Política, IA, Historia...' : 'Political Economy, AI, History...'}
                />
              </div>
            </div>
          </div>

          {/* Afiliación */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 lg:p-10">
            <h3 className="font-serif text-2xl font-bold text-gray-900 mb-8 pb-4 border-b border-gray-100">
              {language === 'es' ? 'Datos de Afiliación' : 'Affiliation Data'}
            </h3>
            <div className="space-y-6">
              <div>
                <label className="block text-xs tracking-[0.15em] font-bold text-[#666] uppercase mb-3">
                  {language === 'es' ? 'Institución u Organización' : 'Institution or Organization'}
                </label>
                <input 
                  name="institution" 
                  value={form.institution} 
                  onChange={handleChange} 
                  className="w-full p-4 bg-[#f9fafb] border border-gray-200 rounded-md focus:ring-1 focus:ring-[#004b87] focus:border-[#004b87] text-sm text-[#2b2b2b]" 
                />
              </div>
              <div>
                <label className="block text-xs tracking-[0.15em] font-bold text-[#666] uppercase mb-3">
                  {language === 'es' ? 'Correo de Contacto Público' : 'Public Contact Email'}
                </label>
                <div className="relative">
                  <EnvelopeIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input 
                    name="publicEmail" 
                    value={form.publicEmail} 
                    onChange={handleChange} 
                    className="w-full pl-12 p-4 bg-[#f9fafb] border border-gray-200 rounded-md focus:ring-1 focus:ring-[#004b87] focus:border-[#004b87] text-sm text-[#2b2b2b]" 
                    placeholder={language === 'es' ? 'academico@universidad.edu' : 'academic@university.edu'} 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Columna Derecha */}
        <div className="lg:col-span-5 space-y-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 lg:p-10">
            <h3 className="font-serif text-2xl font-bold text-gray-900 mb-8 pb-4 border-b border-gray-100">
              {language === 'es' ? 'Identificadores & Redes' : 'Identifiers & Networks'}
            </h3>
            <div className="space-y-5">
              
              <div className="group flex items-center bg-[#f9fafb] border border-gray-200 rounded-md focus-within:border-[#004b87] focus-within:ring-1 focus-within:ring-[#004b87] transition-all overflow-hidden">
                <div className="pl-4 pr-3 text-[#004b87] font-serif font-black text-lg border-r border-gray-200 bg-gray-50 h-full py-3">in</div>
                <input
                  name="linkedin"
                  value={form.social.linkedin}
                  onChange={handleSocialChange}
                  placeholder="https://linkedin.com/in/..."
                  className="bg-transparent border-0 flex-1 py-3 px-4 focus:ring-0 text-sm text-[#2b2b2b] truncate"
                />
              </div>

              <div className="group flex items-center bg-[#f9fafb] border border-gray-200 rounded-md focus-within:border-[#004b87] focus-within:ring-1 focus-within:ring-[#004b87] transition-all overflow-hidden">
                <div className="pl-4 pr-3 text-[#2b2b2b] font-bold text-lg border-r border-gray-200 bg-gray-50 h-full py-3">𝕏</div>
                <input
                  name="twitter"
                  value={form.social.twitter}
                  onChange={handleSocialChange}
                  placeholder="https://x.com/..."
                  className="bg-transparent border-0 flex-1 py-3 px-4 focus:ring-0 text-sm text-[#2b2b2b] truncate"
                />
              </div>

              <div className="group flex items-center bg-[#f9fafb] border border-gray-200 rounded-md focus-within:border-[#004b87] focus-within:ring-1 focus-within:ring-[#004b87] transition-all overflow-hidden">
                <div className="pl-4 pr-3 text-gray-400 border-r border-gray-200 bg-gray-50 h-full py-3 flex items-center justify-center">
                  <LinkIcon className="w-5 h-5 text-gray-500" />
                </div>
                <input
                  name="website"
                  value={form.social.website}
                  onChange={handleSocialChange}
                  placeholder="https://academicwebsite.com"
                  className="bg-transparent border-0 flex-1 py-3 px-4 focus:ring-0 text-sm text-[#2b2b2b] truncate"
                />
              </div>

              <div className="group flex items-center bg-[#fdf6f3] border border-[#e86125]/30 rounded-md focus-within:border-[#e86125] focus-within:ring-1 focus-within:ring-[#e86125] transition-all overflow-hidden">
                <div className="pl-4 pr-3 text-[#e86125] font-mono font-bold text-sm border-r border-[#e86125]/30 bg-white h-full py-3">ORCID</div>
                <input
                  name="orcid"
                  value={form.orcid}
                  onChange={handleChange}
                  placeholder="0000-0000-0000-0000"
                  className="bg-transparent border-0 flex-1 py-3 px-4 focus:ring-0 text-sm font-mono text-[#2b2b2b] truncate"
                />
              </div>
            </div>
          </div>

          {/* Botón Guardar */}
          <button
            onClick={saveProfile}
            disabled={saving}
            className="w-full py-5 bg-[#004b87] text-white rounded-md font-bold tracking-[0.15em] text-xs uppercase hover:bg-[#003666] transition-colors border border-transparent shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {language === 'es' ? 'GUARDANDO...' : 'SAVING...'}
              </>
            ) : (
              language === 'es' ? 'ACTUALIZAR REGISTRO' : 'UPDATE RECORD'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== GESTIÓN DE USUARIOS ====================
// Componente UserManagement optimizado
const UserManagement = ({ users: initialUsers }) => {
  const [users, setUsers] = useState(initialUsers || []);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  const containerRef = useRef(null);

  useEffect(() => {
    if (initialUsers && initialUsers.length > 0) {
      setUsers(initialUsers);
      setIsLoading(false);
    }
  }, [initialUsers]);

  // Virtualización simple para mejorar rendimiento
  const filteredUsers = useMemo(() => {
    if (!users || users.length === 0) return [];
    return users.filter(user => 
      (user.displayName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  const addRole = async (uid, role) => {
    const user = users.find(u => u.id === uid);
    if (!user || !role) return;
    
    const currentRoles = user.roles || [];
    if (currentRoles.includes(role)) return;

    const newRoles = [...currentRoles, role];
    
    try {
      // Actualización optimista
      setUsers(prev => prev.map(u => 
        u.id === uid ? { ...u, roles: newRoles } : u
      ));
      
      await updateRole({ targetUid: uid, newRoles });
    } catch (err) {
      console.error('Error al añadir rol:', err);
      // Revertir cambio en caso de error
      setUsers(prev => prev.map(u => 
        u.id === uid ? { ...u, roles: currentRoles } : u
      ));
    }
  };

  const removeRole = async (uid, role) => {
    const user = users.find(u => u.id === uid);
    if (!user) return;
    
    const newRoles = (user.roles || []).filter(r => r !== role);
    
    try {
      // Actualización optimista
      setUsers(prev => prev.map(u => 
        u.id === uid ? { ...u, roles: newRoles } : u
      ));
      
      await updateRole({ targetUid: uid, newRoles });
    } catch (err) {
      console.error('Error al eliminar rol:', err);
      // Revertir cambio
      setUsers(prev => prev.map(u => 
        u.id === uid ? { ...u, roles: (user.roles || []) } : u
      ));
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 max-w-6xl mx-auto text-center border-t-4 border-t-[#004b87]">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[#f4f5f7] border-t-[#004b87] mb-4"></div>
        <p className="text-gray-500 font-sans tracking-widest text-xs uppercase">
          {isSpanish ? 'Cargando directorio...' : 'Loading directory...'}
        </p>
      </div>
    );
  }

  if (!users || users.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 max-w-6xl mx-auto text-center border-t-4 border-t-[#004b87]">
        <UserIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 font-medium">
          {isSpanish ? 'No hay usuarios disponibles' : 'No users available'}
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 lg:p-10 max-w-7xl mx-auto border-t-4 border-t-[#004b87]">
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6 mb-8 border-b border-gray-100 pb-6">
        <div>
          <h3 className="text-3xl font-serif font-bold text-gray-900">
            {isSpanish ? 'Directorio Editorial' : 'Editorial Directory'}
          </h3>
          <p className="text-sm font-sans tracking-wide text-[#666] mt-2 uppercase">
            {isSpanish ? 'Gestión de Permisos y Roles' : 'Roles and Access Management'}
          </p>
        </div>
        
        <div className="relative w-full sm:w-72 lg:w-96">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isSpanish ? "Filtrar por nombre o email..." : "Filter by name or email..."}
            className="w-full pl-10 pr-4 py-3 bg-[#f9fafb] border border-gray-200 rounded-md focus:border-[#004b87] focus:ring-1 focus:ring-[#004b87] text-sm font-sans transition-all"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <div className="mb-4 text-xs font-bold tracking-widest text-[#666] uppercase">
        {isSpanish 
          ? `Mostrando ${filteredUsers.length} de ${users.length} registros`
          : `Showing ${filteredUsers.length} of ${users.length} records`
        }
      </div>

      {/* Tabla Desktop (Forzada estilo APA/Elsevier) */}
      <div className="overflow-x-auto rounded-md border border-gray-200">
        <table className="min-w-full border-collapse text-left font-sans text-sm">
          <thead className="bg-[#f8f9fa] border-b-2 border-gray-300">
            <tr>
              <th className="px-6 py-4 font-bold text-[#004b87] uppercase tracking-widest text-[10px]">
                {isSpanish ? 'Investigador / Usuario' : 'Researcher / User'}
              </th>
              <th className="px-6 py-4 font-bold text-[#004b87] uppercase tracking-widest text-[10px]">
                Contacto
              </th>
              <th className="px-6 py-4 font-bold text-[#004b87] uppercase tracking-widest text-[10px]">
                {isSpanish ? 'Asignación de Roles' : 'Role Assignment'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {filteredUsers.slice(0, 100).map((user) => (
              <tr key={user.id} className="hover:bg-[#f4f5f7] transition-colors">
                <td className="px-6 py-4 align-top">
                  <div className="flex items-center gap-4">
                    {user.imageUrl ? (
                      <img 
                        src={user.imageUrl} 
                        className="w-10 h-10 rounded object-cover border border-gray-200" 
                        alt={user.displayName}
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-[#f4f5f7] border border-gray-200 rounded flex items-center justify-center">
                        <span className="text-lg font-serif font-bold text-[#004b87]">
                          {user.displayName?.charAt(0) || 'U'}
                        </span>
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-[#2b2b2b]">
                        {user.displayName || (isSpanish ? 'Sin nombre' : 'No name')}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono tracking-wider mt-0.5">UID: {user.id?.slice(0, 8)}</div>
                    </div>
                  </div>
                </td>
                
                <td className="px-6 py-4 align-top text-[#666] font-medium">
                  {user.email}
                </td>

                <td className="px-6 py-4 align-top">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {(user.roles || []).map(role => {
                      const displayRole = !isSpanish ? (ES_TO_EN[role] || role) : role;
                      return (
                        <div 
                          key={role}
                          className="inline-flex items-center gap-1.5 bg-[#eef3f7] border border-[#004b87]/20 text-[#004b87] text-[11px] font-bold tracking-wide px-2.5 py-1 rounded"
                        >
                          {displayRole}
                          <button
                            onClick={() => removeRole(user.id, role)}
                            className="text-[#004b87] hover:text-[#e86125] transition-colors font-black ml-1"
                            title={isSpanish ? 'Revocar' : 'Revoke'}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        addRole(user.id, e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="w-full max-w-xs appearance-none bg-[#f9fafb] border border-dashed border-gray-300 hover:border-[#004b87] text-[#666] text-xs font-bold tracking-wider uppercase rounded px-3 py-2 cursor-pointer transition-colors focus:outline-none focus:border-[#004b87]"
                    value=""
                  >
                    <option value="" disabled>
                      {isSpanish ? '+ AÑADIR NUEVO ROL' : '+ ADD NEW ROLE'}
                    </option>
                    {ALL_ROLES.filter(r => !(user.roles || []).includes(r)).map(role => {
                      const displayRole = !isSpanish ? (ES_TO_EN[role] || role) : role;
                      return (
                        <option key={role} value={role}>{displayRole}</option>
                      );
                    })}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredUsers.length === 0 && (
        <div className="text-center py-16 text-gray-400 bg-[#f9fafb] border border-gray-200 mt-4 rounded-md">
          <UserIcon className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm tracking-wide font-sans">
            {isSpanish 
              ? 'No se encontraron coincidencias en el directorio.' 
              : 'No matches found in the directory.'
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default function PortalSection({ user, onLogout }) {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  const navigate = useNavigate();
  const location = useLocation();

  // Obtener la pestaña activa desde la ruta
  const getActiveTabFromPath = () => {
    const path = location.pathname;
    // Extraer el segmento después de /login/ o /es/login/
    const match = path.match(/\/(?:es\/)?login\/([^/]+)/);
    return match ? match[1] : 'profile';
  };

  const [activeTab, setActiveTab] = useState(getActiveTabFromPath());
  const [isDirectorPanelExpanded, setIsDirectorPanelExpanded] = useState(false);
  const [isChiefEditorPanelExpanded, setIsChiefEditorPanelExpanded] = useState(false);
  const [effectiveName, setEffectiveName] = useState(user?.displayName || '');
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
 const [loadingUser, setLoadingUser] = useState(true);
const [loadTimeout, setLoadTimeout] = useState(false);
const [dataCorrupted, setDataCorrupted] = useState(false);
const safetyTimeoutRef = useRef(null);
// ===============================================
  
  // Datos en tiempo real desde Firebase
  const [userData, setUserData] = useState(user);
  const [users, setUsers] = useState([]);
  const [reviewerAssignments, setReviewerAssignments] = useState([]);

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

  // Mapeo de IDs de pestañas a rutas
  const tabRoutes = {
    profile: '',
    submissions: 'submissions',
    'reviewer-tasks': 'reviewer-tasks',
    deskreview: 'deskreview',
    assignment: 'assignment',
    calendar: 'calendar',
    submit: 'submit',
    director: 'director',
    chief: 'chief',
    tasks: 'tasks',
    news: 'news',
    admissions: 'admissions',
    usermanagement: 'users'
  };

  // Pestañas actualizadas para el nuevo sistema
  const tabs = [
    { id: 'profile', label: isSpanish ? 'MI PERFIL' : 'MY PROFILE', roles: ['any'], path: '' },
    { id: 'submissions', label: isSpanish ? 'MIS ENVÍOS' : 'MY SUBMISSIONS', roles: ['Autor'], path: 'submissions' },
    { id: 'reviewer-tasks', label: isSpanish ? 'MIS REVISIONES' : 'MY REVIEWS', roles: ['Revisor'], path: 'reviewer-tasks' },
    { id: 'deskreview', label: isSpanish ? 'DESK REVIEW' : 'DESK REVIEW', roles: ['Editor de Sección', 'Editor en Jefe'], path: 'deskreview' },
    { id: 'assignment', label: isSpanish ? 'ASIGNAR ARTÍCULOS' : 'ASSIGN ARTICLES', roles: ['Encargado de Asignación de Artículos', 'Director General'], path: 'assignment' },
    { id: 'calendar', label: isSpanish ? 'CALENDARIO' : 'CALENDAR', roles: ['Editor en Jefe', 'Director General', 'Encargado de Asignación de Artículos'], path: 'calendar' },
    { id: 'submit', label: isSpanish ? 'ENVIAR MANUSCRITO' : 'SUBMIT MANUSCRIPT', roles: ['Autor'], path: 'submit' },
    { id: 'director', label: isSpanish ? 'PANEL DIRECTIVO' : 'DIRECTOR PANEL', roles: ['Director General'], path: 'director' },
    { id: 'chief', label: isSpanish ? 'PANEL EDITOR JEFE' : 'CHIEF EDITOR PANEL', roles: ['Editor en Jefe'], path: 'chief' },
    { id: 'tasks', label: isSpanish ? 'TAREAS' : 'TASKS', roles: ['Encargado de Redes Sociales', 'Responsable de Desarrollo Web'], path: 'tasks' },
    { id: 'news', label: isSpanish ? 'NOTICIAS' : 'NEWS', roles: ['Director General'], path: 'news' },
    { id: 'admissions', label: isSpanish ? 'ADMISIONES' : 'ADMISSIONS', roles: ['Director General'], path: 'admissions' },
    { id: 'usermanagement', label: isSpanish ? 'USUARIOS' : 'USERS', roles: ['Director General'], path: 'users' },
  ].filter(tab => tab.roles.includes('any') || tab.roles.some(role => userRoles.includes(role)));

  // Sincronizar la ruta con la pestaña activa
  useEffect(() => {
    const pathTab = getActiveTabFromPath();
    if (pathTab !== activeTab) {
      setActiveTab(pathTab);
    }
  }, [location.pathname]);

  // Función para cambiar de pestaña y navegar (CORREGIDA)
// Función para cambiar de pestaña y navegar (CORREGIDA)
const handleTabChange = (tabId, event) => {
  // Prevenir cualquier comportamiento por defecto del navegador
  if (event) {
    event.preventDefault();
  }
  
  setActiveTab(tabId);
  const route = tabRoutes[tabId] || '';
  
  // IMPORTANTE: Preservar el prefijo de idioma actual
  const currentPath = location.pathname;
  const langPrefix = currentPath.match(/^\/(es|en)\//) ? currentPath.match(/^\/(es|en)\//)[0] : '/';
  
  // Construir la nueva ruta con el prefijo de idioma correcto
  const newPath = route ? `${langPrefix}login/${route}` : `${langPrefix}login`;
  
  // Usar navigate de React Router para navegación del lado del cliente
  navigate(newPath, { replace: true });
};
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

  // ========== EFECTO 1: CONTROL DE CARGA Y TIMEOUT ==========
  useEffect(() => {
    // Solo ejecutar la lógica si aún estamos en estado de carga
    if (!loadingUser) {
      // Si ya no estamos cargando, limpiar cualquier timeout pendiente
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
      return;
    }

    // Verificar si tenemos datos válidos para dejar de cargar
    if (userData && effectiveName) {
      // Verificar integridad mínima de datos
      if (!userData.uid || !userData.email) {
        console.error('Datos de usuario corruptos en PortalSection');
        setDataCorrupted(true);
        setLoadingUser(false);
        if (safetyTimeoutRef.current) {
          clearTimeout(safetyTimeoutRef.current);
          safetyTimeoutRef.current = null;
        }
        return;
      }

      // Datos válidos, salir de carga
      setLoadingUser(false);
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
      return;
    }

    // Si llegamos aquí, estamos en carga y no tenemos datos todavía
    // Iniciar timeout de seguridad SOLO si no hay uno activo
    if (!safetyTimeoutRef.current) {
      safetyTimeoutRef.current = setTimeout(() => {
        console.error('Timeout de carga en PortalSection - posible corrupción de datos');
        setLoadTimeout(true);
        setDataCorrupted(true);
        setLoadingUser(false);
        safetyTimeoutRef.current = null;
      }, 20000); // 20 segundos máximo
    }

    // Cleanup function
    return () => {
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
    };
  }, [userData, effectiveName, loadingUser]);

  // ========== EFECTO 2: RESETEAR ESTADO DE CORRUPCIÓN CUANDO CAMBIA EL USUARIO ==========
  useEffect(() => {
    // Si los datos del usuario cambian, resetear los estados de error
    if (userData && userData.uid && userData.email) {
      setDataCorrupted(false);
      setLoadTimeout(false);
    }
  }, [userData?.uid]);
  // ====================================================================================
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

  // Función segura para abrir en nueva pestaña (CORREGIDA)
  const openReviewerWorkspace = (assignmentId) => {
    // Usar window.open de manera segura, pero solo cuando sea necesario
    // Idealmente, deberías usar navigate de React Router
    window.open(`/reviewer-workspace/${assignmentId}`, '_blank', 'noopener,noreferrer');
  };
  // ========== PANTALLA DE CARGA CON BOTÓN DE ESCAPE ==========
    // ========== PANTALLA DE CARGA CON BOTÓN DE ESCAPE ==========
  if (loadingUser) {
    return (
      <div className="min-h-screen bg-[#f4f5f7] flex items-center justify-center font-sans">
        <div className="flex flex-col items-center bg-white p-12 rounded-lg shadow-sm border border-gray-200">
          <div className="w-12 h-12 border-2 border-[#f4f5f7] border-t-[#004b87] rounded-full animate-spin" />
          <p className="mt-6 text-[#004b87] font-bold tracking-widest text-xs uppercase">
            {isSpanish ? 'Iniciando Portal Editorial...' : 'Loading Editorial Portal...'}
          </p>
          <p className="mt-2 text-xs text-gray-400">
            {isSpanish 
              ? 'Esto no debería tardar más de unos segundos' 
              : 'This should not take more than a few seconds'}
          </p>

          {/* ========== BOTÓN DE ESCAPE (aparece después de 8 segundos) ========== */}
          <div className="mt-8 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-400 mb-3">
              {isSpanish 
                ? '¿La carga está tardando demasiado?' 
                : 'Is loading taking too long?'}
            </p>
            <button
              onClick={() => {
                // Limpiar timeout si existe
                if (safetyTimeoutRef.current) {
                  clearTimeout(safetyTimeoutRef.current);
                  safetyTimeoutRef.current = null;
                }
                setLoadTimeout(true);
                setDataCorrupted(true);
                setLoadingUser(false);
              }}
              className="text-xs text-[#e86125] hover:text-red-800 underline font-bold"
            >
              {isSpanish
                ? 'Forzar salida de pantalla de carga'
                : 'Force exit loading screen'}
            </button>
          </div>
          {/* ==================================================================== */}
        </div>
      </div>
    );
  }
  // =========================================================
  // =========================================================
   // ========== PANTALLA DE DATOS CORRUPTOS O TIMEOUT ==========
 
  if (dataCorrupted || loadTimeout) {
    return (
      <div className="min-h-screen bg-[#f4f5f7] flex items-center justify-center p-4 font-sans">
        <div className="bg-[#fdf6f3] border-t-4 border-t-[#e86125] rounded-md shadow-md p-8 md:p-12 max-w-lg w-full">
          <h3 className="font-serif text-2xl font-bold text-[#e86125] mb-4">
            {loadTimeout ? 'Timeout del Servidor' : 'Excepción de Sesión'}
          </h3>
          <p className="text-sm text-gray-700 leading-relaxed mb-6">
            {loadTimeout
              ? 'La conexión con los repositorios editoriales ha superado el tiempo de espera.'
              : 'Se detectó una discrepancia en los metadatos de su perfil que impide inicializar el entorno.'}
          </p>
          <button
            onClick={() => {
              if (auth) signOut(auth).catch(console.error);
              if (onLogout) onLogout();
              window.location.reload();
            }}
            className="w-full bg-[#2b2b2b] hover:bg-black text-white py-3 text-xs uppercase font-bold tracking-widest rounded transition-all"
          >
            {isSpanish ? 'Destruir Sesión y Reiniciar' : 'Destroy Session & Restart'}
          </button>
        </div>
      </div>
    );
  }
  // ==============================================================

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
        className="min-h-screen bg-[#f4f5f7] p-4 md:p-8 flex items-center justify-center"
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 bg-[#f4f5f7] min-h-screen font-sans">
      
      {/* HEADER EDITORIAL */}
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between border-b-2 border-gray-300 pb-8">
        <div>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-[#051d31] mb-3">
            {isSpanish ? 'Portal Editorial' : 'Editorial Portal'}
          </h1>
          <div className="flex items-center space-x-3 bg-white border border-gray-200 px-4 py-2 rounded-md shadow-sm w-fit">
            <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">
              {isSpanish ? 'ID SESIÓN:' : 'SESSION ID:'}
            </p>
            {userData.imageUrl ? (
              <img src={userData.imageUrl} alt="Profile" className="w-6 h-6 rounded-sm object-cover border border-gray-200" />
            ) : (
              <div className="w-6 h-6 rounded-sm bg-[#f4f5f7] flex items-center justify-center border border-gray-200">
                <span className="text-[#004b87] text-xs font-serif font-bold">{effectiveName?.charAt(0) || 'U'}</span>
              </div>
            )}
            <span className="font-bold text-[#2b2b2b] text-xs uppercase tracking-wider">{effectiveName}</span>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="mt-6 md:mt-0 text-[10px] font-bold uppercase tracking-widest px-6 py-2.5 border border-gray-300 bg-white text-[#2b2b2b] hover:bg-gray-50 hover:border-gray-400 transition-all rounded"
        >
          {isSpanish ? 'Cerrar Sesión' : 'Log Out'}
        </button>
      </header>

      {/* Panel de invitaciones para revisores - AHORA USANDO NAVIGATE EN LUGAR DE WINDOW.OPEN */}
      {isReviewer && (
        <ReviewerInvitationsPanel 
          user={userData}
          onAccept={(invitation) => {
            // Usar setTimeout pero con navigate en lugar de window.open
            setTimeout(() => {
              navigate(`/reviewer-workspace/${invitation.submissionId}`);
            }, 3000);
          }}
        />
      )}

      {/* TABS NAVEGACIÓN */}
      <nav className="flex overflow-x-auto mb-10 border-b border-gray-200 gap-8 whitespace-nowrap">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button" // <- IMPORTANTE: Especificar type="button"
            onClick={(e) => handleTabChange(tab.id, e)} // <- Pasamos el evento
            className={`pb-4 text-[11px] font-bold uppercase tracking-widest transition-colors relative flex-shrink-0 ${
              activeTab === tab.id ? 'text-[#004b87]' : 'text-gray-500 hover:text-[#2b2b2b]'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.div layoutId="activeTab" className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-[#e86125]" />
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
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            >
              <ProfileSection user={userData} />
              
              {/* Box de Claim Profile */}
              {isAuthor && !userData?.claimedAnonymousUid && claimStatus === 'idle' && (
                <div className="mt-8 max-w-6xl mx-auto bg-white border border-gray-200 border-l-4 border-l-[#004b87] rounded-r-md p-8 shadow-sm">
                  <h3 className="font-serif text-xl font-bold text-[#004b87] mb-2">
                    {isSpanish ? 'Reclamar Publicaciones Anteriores' : 'Claim Previous Publications'}
                  </h3>
                  <p className="text-sm text-[#666] mb-5">
                    {isSpanish 
                      ? 'Si publicaste en volúmenes pasados de la revista, puedes asociar esos metadatos a este perfil digital.'
                      : 'If you published in past volumes of the journal, you can associate those metadata to this digital profile.'}
                  </p>
                  <button
                    onClick={() => { setShowClaimModal(true); checkForAnonymousProfile(); }}
                    className="px-6 py-2.5 bg-[#f4f5f7] border border-gray-200 hover:border-[#004b87] text-[#004b87] font-bold text-xs uppercase tracking-widest rounded transition-all"
                  >
                    {isSpanish ? 'Verificar Historial' : 'Verify History'}
                  </button>
                </div>
              )}
            </motion.section>
          )}

          {/* MIS ENVÍOS (AUTOR) */}
          {activeTab === 'submissions' && (
            <motion.section
              key="submissions"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
            >
              <AuthorSubmissionsPanel user={userData} />
            </motion.section>
          )}

          {/* MIS REVISIONES (REVISOR) */}
          {activeTab === 'reviewer-tasks' && (
            <motion.section
              key="reviewer-tasks"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
            >
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 border-t-4 border-t-[#004b87] p-8">
                <h2 className="font-serif text-2xl font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">
                  {isSpanish ? 'Expedientes Asignados para Revisión' : 'Assigned Files for Review'}
                </h2>
                {reviewerAssignments.length === 0 ? (
                  <p className="text-gray-500 text-sm italic font-serif">
                    {isSpanish ? 'No existen manuscritos en cola de revisión para su perfil en este momento.' : 'There are no manuscripts in the review queue for your profile at this time.'}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {reviewerAssignments.map(assignment => (
                      <div
                        key={assignment.id}
                        className="p-6 border border-gray-200 rounded-md bg-[#f9fafb] hover:border-[#004b87] hover:shadow-sm transition-all cursor-pointer group"
                        onClick={() => navigate(`/reviewer-workspace/${assignment.id}`)}
                      >
                        <h3 className="font-serif font-bold text-lg text-[#004b87] group-hover:text-[#e86125] transition-colors mb-3">
                          {assignment.submission?.title}
                        </h3>
                        <div className="flex gap-6 text-xs font-sans text-gray-600 uppercase tracking-widest font-bold">
                          <span>
                            {isSpanish ? 'ESTADO: ' : 'STATUS: '} 
                            <span className={
                              assignment.status === 'submitted' ? 'text-green-700' :
                              assignment.status === 'in-progress' ? 'text-blue-700' : 'text-[#e86125]'
                            }>
                              {assignment.status}
                            </span>
                          </span>
                          <span>{isSpanish ? 'RONDA: ' : 'ROUND: '} {assignment.round}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.section>
          )}

          {/* DESK REVIEW */}
          {activeTab === 'deskreview' && <motion.section key="deskreview"><DeskReviewPanel user={userData} /></motion.section>}
          
          {/* ASIGNAR ARTÍCULOS */}
          {activeTab === 'assignment' && <motion.section key="assignment"><ArticleAssignmentPanel user={userData} /></motion.section>}
          
          {/* CALENDARIO */}
          {activeTab === 'calendar' && (
            <motion.section key="calendar">
              <CalendarComponent 
                events={calendarEvents} 
                onSelectEvent={(e) => {
                  if (e.resource?.targetType === 'reviewerAssignment') {
                    navigate(`/reviewer-workspace/${e.resource.targetId}`);
                  }
                }} 
              />
            </motion.section>
          )}

          {/* ENVIAR MANUSCRITO */}
          {/* ENVIAR MANUSCRITO - OCUPA TODA LA PANTALLA */}
{activeTab === 'submit' && (
  <motion.section
    key="submit"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-40 bg-[#f4f5f7] overflow-y-auto"
  >
    {/* Barra superior para volver al portal */}
    <div className="sticky top-0 z-50 bg-white border-b-2 border-gray-300 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => handleTabChange('profile', null)}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#004b87] hover:text-[#e86125] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {isSpanish ? 'Volver al Portal' : 'Back to Portal'}
          </button>
        </div>
        <h2 className="font-serif text-lg font-bold text-[#004b87]">
          {isSpanish ? 'Envío de Manuscrito' : 'Manuscript Submission'}
        </h2>
        <div className="w-24"></div> {/* Espaciador para centrar el título */}
      </div>
    </div>

    {/* Contenido del formulario a pantalla completa */}
    <div className="w-full">
      <SubmissionForm 
        user={userData} 
        onSuccess={(submissionId) => {
          console.log('Submission successful:', submissionId);
          handleTabChange('submissions', null);
        }}
      />
    </div>
  </motion.section>
)}

          {/* PANEL DIRECTIVO */}
          {activeTab === 'director' && (
            <motion.section key="director">
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
            <motion.section key="chief">
              <AssignSection 
                user={userData} 
                isExpanded={isChiefEditorPanelExpanded} 
                onToggle={() => setIsChiefEditorPanelExpanded(!isChiefEditorPanelExpanded)} 
              />
            </motion.section>
          )}

          {/* TAREAS */}
          {activeTab === 'tasks' && <motion.section key="tasks"><TaskSection user={userData} /></motion.section>}
          
          {/* NOTICIAS */}
          {activeTab === 'news' && <motion.section key="news"><NewsUploadSection /></motion.section>}
          
          {/* ADMISIONES */}
          {activeTab === 'admissions' && <motion.section key="admissions"><Admissions /></motion.section>}
          
          {/* GESTIÓN DE USUARIOS */}
          {activeTab === 'usermanagement' && <motion.section key="users"><UserManagement users={users} /></motion.section>}
        </AnimatePresence>
      </main>

      {/* MODAL DE RECLAMACIÓN DE PERFIL (Re-estilizado) */}
      <AnimatePresence>
        {showClaimModal && (
          <div className="fixed inset-0 z-50 bg-[#004b87]/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }} 
              className="bg-white rounded-md shadow-2xl max-w-lg w-full p-10 font-sans border-t-8 border-t-[#e86125]"
            >
              {claimStatus === 'checking' && (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-2 border-gray-200 border-t-[#004b87] rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-xs tracking-widest font-bold text-gray-500 uppercase">
                    {isSpanish ? 'Consultando base de datos...' : 'Querying database...'}
                  </p>
                </div>
              )}

              {claimStatus === 'available' && anonymousProfile && (
                <>
                  <h3 className="font-serif text-2xl font-bold text-[#004b87] mb-4">
                    {isSpanish ? '¡Perfil encontrado!' : 'Profile found!'}
                  </h3>
                  <div className="bg-[#f9fafb] border border-gray-200 rounded-md p-6 mb-6">
                    <p className="text-[#2b2b2b] font-semibold mb-2 text-sm">
                      {isSpanish ? 'Hemos encontrado un perfil como autor en los siguientes artículos:' : 'We found a profile as author in the following articles:'}
                    </p>
                    <ul className="list-disc list-inside text-[#666] space-y-1">
                      {anonymousProfile.articles?.map((article, idx) => (
                        <li key={idx} className="text-xs">{article.title}</li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-[#2b2b2b] mb-6 text-sm leading-relaxed">
                    {isSpanish 
                      ? 'Al reclamar este perfil, todos estos artículos se vincularán automáticamente a tu cuenta y aparecerán en tu perfil público.'
                      : 'By claiming this profile, all these articles will be automatically linked to your account and will appear in your public profile.'}
                  </p>
                  
                  {claimError && (
                    <div className="bg-[#fdf6f3] text-[#e86125] p-4 rounded-md mb-6 text-xs border border-[#e86125]/30">
                      {claimError}
                    </div>
                  )}
                  
                  <div className="flex gap-3">
                    <button
                      onClick={handleClaimProfile}
                      disabled={claimStatus === 'claiming'}
                      className="flex-1 py-3 bg-[#004b87] hover:bg-[#003666] disabled:bg-gray-300 text-white font-bold text-xs uppercase tracking-widest rounded-md transition-all"
                    >
                      {claimStatus === 'claiming' ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
                      className="flex-1 py-3 border border-gray-300 hover:bg-gray-50 font-bold text-xs uppercase tracking-widest rounded-md transition-all text-[#2b2b2b]"
                    >
                      {isSpanish ? 'Cancelar' : 'Cancel'}
                    </button>
                  </div>
                </>
              )}
              
              {claimStatus === 'success' && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-[#eef3f7] rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-[#004b87]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="font-serif text-xl font-bold text-[#004b87] mb-2">
                    {isSpanish ? '¡Perfil reclamado con éxito!' : 'Profile claimed successfully!'}
                  </h3>
                  <p className="text-[#666] text-sm">
                    {isSpanish 
                      ? 'Tus publicaciones se han vinculado a tu cuenta.'
                      : 'Your publications have been linked to your account.'}
                  </p>
                </div>
              )}
              
              {claimStatus === 'error' && claimStatus !== 'claiming' && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-[#fdf6f3] rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-[#e86125]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <h3 className="font-serif text-xl font-bold text-[#e86125] mb-2">
                    {isSpanish ? 'Error al reclamar' : 'Error claiming profile'}
                  </h3>
                  <p className="text-[#666] mb-4 text-sm">{claimError || (isSpanish ? 'Intenta nuevamente más tarde' : 'Please try again later')}</p>
                  <button
                    onClick={() => setShowClaimModal(false)}
                    className="px-6 py-2.5 bg-[#2b2b2b] text-white rounded-md font-bold text-xs uppercase tracking-widest"
                  >
                    {isSpanish ? 'Cerrar' : 'Close'}
                  </button>
                </div>
              )}

              {claimStatus === 'not-available' && (
                <div className="text-center py-8">
                  <p className="text-[#666] text-sm">
                    {isSpanish 
                      ? 'No encontramos publicaciones anteriores asociadas a tu email.'
                      : 'We did not find previous publications associated with your email.'}
                  </p>
                  <button
                    onClick={() => setShowClaimModal(false)}
                    className="mt-6 px-6 py-2.5 bg-[#2b2b2b] text-white rounded-md font-bold text-xs uppercase tracking-widest"
                  >
                    {isSpanish ? 'Cerrar' : 'Close'}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}