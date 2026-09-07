// src/components/PortalSection.js (VERSIÓN FINAL CON REDISEÑO EDITORIAL)
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
import ReviewerApplicationsPanel from './ReviewerApplicationsPanel';
import ReviewerProfilePanel from './ReviewerProfilePanel';
import DeskReviewPanel from './DeskReviewPanel';
import ScientificNewsUploadSection from './ScientificNewsUploadSection';
import ReviewerInvitationsPanel from './ReviewerInvitationsPanel';
import AuthorSubmissionsPanel from './AuthorSubmissionsPanel';
import SubmissionDashboard from './SubmissionDashboard';
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
import { db, onSnapshot, query, collection, doc, updateDoc, uploadImageToImgBB, updateRole, auth, getDocs, where } from '../firebase';
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
  'Institución Colaboradora': 'Partner Institution',
  'Equipo Editorial': 'Editorial Team',
  'Periodista': 'Journalist'
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
  'Community Manager': 'Community Manager',
  'Editorial Team': 'Equipo Editorial',
  'Journalist':'Periodista'
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
        <div className="bg-white border-l-4 border-black text-gray-900 p-6 m-4 rounded-none font-sans">
          <h3 className="font-serif font-bold text-black uppercase tracking-wide text-sm mb-2">Error Crítico</h3>
          <p className="text-sm">Ocurrió un error en el portal. Por favor recargue la página.</p>
          <details className="mt-4 text-xs text-gray-600 bg-gray-50 p-4 border border-gray-200 rounded-none">
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
    <div className="bg-white border border-gray-300 border-t-4 border-t-[#004b87] p-6 md:p-10 rounded-none mb-6 overflow-hidden">
      <h3 className="font-serif text-2xl font-bold text-black mb-6 pb-4 border-b-2 border-black">
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
          className="border border-gray-300 rounded-none overflow-hidden bg-white"
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
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {value.map((tag, index) => (
          <motion.div
            key={index}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="group bg-gray-100 border border-gray-300 hover:border-black transition-colors text-gray-800 text-xs font-medium px-3 py-1 rounded-none flex items-center gap-2"
          >
            {tag}
            <button
              onClick={() => removeTag(index)}
              className="text-gray-500 hover:text-black transition-colors"
            >
              <XMarkIcon className="w-3 h-3" />
            </button>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 p-2 bg-white border border-gray-300 rounded-none focus:ring-0 focus:border-black text-sm text-gray-800 placeholder-gray-400 font-sans transition-all"
        />
        <button
          onClick={addTag}
          className="px-4 py-2 bg-[#004b87] hover:bg-black transition-all text-white font-medium tracking-wide text-xs rounded-none flex items-center justify-center gap-2 active:scale-95"
        >
          <PlusIcon className="w-3 h-3" />
          {isSpanish ? 'Añadir' : 'Add'}
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
    return <div className="text-center p-8 font-sans text-sm tracking-wide text-gray-500">{language === 'es' ? 'Cargando perfil...' : 'Loading profile...'}</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-12 px-2 sm:px-4 font-sans text-gray-900">
      
      {/* ENCABEZADO DE PERFIL EDITORIAL */}
      <div className="bg-white border-y-2 border-black py-12 flex flex-col md:flex-row items-start gap-10">
        
        {/* Fotografía estilo retrato académico */}
        <div className="relative group flex-shrink-0">
          <div className="w-40 h-48 overflow-hidden border border-gray-300 bg-gray-50 relative">
            {form.imageUrl ? (
              <img src={form.imageUrl} className="object-cover w-full h-full grayscale-[20%] hover:grayscale-0 transition-all duration-500" alt={language === 'es' ? 'Perfil' : 'Profile'} />
            ) : (
              <div className="flex items-center justify-center w-full h-full">
                <UserIcon className="w-12 h-12 text-gray-300" />
              </div>
            )}
            
            {uploading && (
              <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center">
                <div className="w-5 h-5 border-2 border-[#004b87] border-t-transparent rounded-full animate-spin mb-2" />
              </div>
            )}
            
            <label className="absolute inset-x-0 bottom-0 py-2 bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <span className="text-[10px] text-white font-medium uppercase tracking-wide">
                {language === 'es' ? 'Actualizar Foto' : 'Update Photo'}
              </span>
              <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="hidden" />
            </label>
          </div>
        </div>

        {/* Datos Principales */}
        <div className="flex-1">
          <h2 className="text-4xl font-serif text-[#004b87] mb-3 leading-tight">
            {form.firstName} {form.lastName}
          </h2>
          <div className="text-sm font-medium text-gray-600 mb-6">
            {form.institution || (language === 'es' ? 'Afiliación no especificada' : 'Unspecified affiliation')}
          </div>
          
          <div className="flex flex-wrap gap-4 mt-6">
            {form.orcid && (
              <a href={`https://orcid.org/${form.orcid}`} target="_blank" rel="noreferrer" 
                 className="inline-flex items-center gap-2 border border-gray-300 px-3 py-1.5 text-xs hover:border-[#004b87] hover:bg-[#004b87]/5 transition-colors rounded-none">
                <span className="text-[#004b87] font-bold">iD</span>
                <span className="font-mono text-gray-600">{form.orcid}</span>
              </a>
            )}
            <div className="inline-flex items-center gap-2 border border-gray-300 px-3 py-1.5 text-xs rounded-none">
              <EnvelopeIcon className="w-4 h-4 text-gray-400" />
              <input 
                name="publicEmail" 
                value={form.publicEmail} 
                onChange={handleChange} 
                placeholder={language === 'es' ? 'Correo académico' : 'Academic email'}
                className="bg-transparent border-none p-0 focus:ring-0 text-gray-600 placeholder-gray-400 w-48"
              />
            </div>
          </div>
        </div>
        
        {/* Botón Guardar */}
        <div className="md:ml-auto">
          <button
            onClick={saveProfile}
            disabled={saving}
            className="px-8 py-3 bg-[#004b87] text-white text-[11px] font-medium uppercase tracking-wide hover:bg-black transition-colors disabled:opacity-50 rounded-none"
          >
            {saving ? (language === 'es' ? 'Guardando...' : 'Saving...') : (language === 'es' ? 'Guardar Cambios' : 'Save Changes')}
          </button>
        </div>
      </div>

      {/* ÁREA DE BIOGRAFÍA ESTILO "AUTHOR INFO" */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-8">
          <div>
            <div className="flex justify-between items-end border-b-2 border-black pb-3 mb-6">
              <h3 className="font-serif text-2xl text-black">
                {language === 'es' ? 'Biografía Académica' : 'Academic Biography'}
              </h3>
              <div className="flex gap-4 text-[11px] font-medium uppercase">
                <button onClick={() => setLang('es')} className={lang === 'es' ? 'text-[#004b87] underline underline-offset-4' : 'text-gray-400 hover:text-black'}>ES</button>
                <button onClick={() => setLang('en')} className={lang === 'en' ? 'text-[#004b87] underline underline-offset-4' : 'text-gray-400 hover:text-black'}>EN</button>
              </div>
            </div>
            
            <textarea
              name={lang === 'es' ? 'descriptionEs' : 'descriptionEn'}
              value={lang === 'es' ? form.descriptionEs : form.descriptionEn}
              onChange={handleChange}
              className="w-full h-64 p-0 bg-transparent border-none focus:ring-0 resize-y text-base leading-relaxed text-gray-700 placeholder-gray-300"
              placeholder={lang === 'es' ? 'Escriba un resumen de su trayectoria investigadora...' : 'Write a summary of your research trajectory...'}
            />
          </div>
        </div>

        {/* BARRA LATERAL */}
        <div className="space-y-10">
          <div>
            <h3 className="font-serif text-lg text-black border-b border-gray-300 pb-2 mb-4">
              {language === 'es' ? 'Palabras Clave' : 'Keywords'}
            </h3>
            <InterestsTags
              value={lang === 'es' ? form.interestsEs : form.interestsEn}
              onChange={(newTags) => handleInterestsChange(lang, newTags)}
              placeholder="+ Añadir área..."
            />
          </div>

          <div>
            <h3 className="font-serif text-lg text-black border-b border-gray-300 pb-2 mb-4">
              {language === 'es' ? 'Redes Académicas' : 'Academic Networks'}
            </h3>
            <div className="space-y-3">
              <div className="flex items-center border-b border-gray-200 py-2">
                <span className="text-[10px] font-medium text-gray-400 w-20">LINKEDIN</span>
                <input name="linkedin" value={form.social.linkedin} onChange={handleSocialChange} className="bg-transparent border-none p-0 flex-1 focus:ring-0 text-sm text-gray-700" placeholder="URL del perfil" />
              </div>
              <div className="flex items-center border-b border-gray-200 py-2">
                <span className="text-[10px] font-medium text-gray-400 w-20">TWITTER / X</span>
                <input name="twitter" value={form.social.twitter} onChange={handleSocialChange} className="bg-transparent border-none p-0 flex-1 focus:ring-0 text-sm text-gray-700" placeholder="@usuario" />
              </div>
              <div className="flex items-center border-b border-gray-200 py-2">
                <span className="text-[10px] font-medium text-gray-400 w-20">WEBSITE</span>
                <input name="website" value={form.social.website} onChange={handleSocialChange} className="bg-transparent border-none p-0 flex-1 focus:ring-0 text-sm text-gray-700" placeholder="https://" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== GESTIÓN DE USUARIOS ====================
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
      setUsers(prev => prev.map(u => 
        u.id === uid ? { ...u, roles: newRoles } : u
      ));
      
      await updateRole({ targetUid: uid, newRoles });
    } catch (err) {
      console.error('Error al añadir rol:', err);
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
      setUsers(prev => prev.map(u => 
        u.id === uid ? { ...u, roles: newRoles } : u
      ));
      
      await updateRole({ targetUid: uid, newRoles });
    } catch (err) {
      console.error('Error al eliminar rol:', err);
      setUsers(prev => prev.map(u => 
        u.id === uid ? { ...u, roles: (user.roles || []) } : u
      ));
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-300 p-12 max-w-6xl mx-auto text-center border-t-4 border-t-[#004b87] rounded-none">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-[#004b87] mb-4"></div>
        <p className="text-gray-500 font-sans tracking-wide text-xs">
          {isSpanish ? 'Cargando directorio...' : 'Loading directory...'}
        </p>
      </div>
    );
  }

  if (!users || users.length === 0) {
    return (
      <div className="bg-white border border-gray-300 p-12 max-w-6xl mx-auto text-center border-t-4 border-t-[#004b87] rounded-none">
        <UserIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 font-medium">
          {isSpanish ? 'No hay usuarios disponibles' : 'No users available'}
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="bg-white border border-gray-300 p-6 lg:p-10 max-w-7xl mx-auto border-t-4 border-t-[#004b87] rounded-none">
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6 mb-8 border-b-2 border-black pb-6">
        <div>
          <h3 className="text-3xl font-serif font-bold text-black">
            {isSpanish ? 'Directorio Editorial' : 'Editorial Directory'}
          </h3>
          <p className="text-sm font-sans text-gray-600 mt-2">
            {isSpanish ? 'Gestión de Permisos y Roles' : 'Roles and Access Management'}
          </p>
        </div>
        
        <div className="relative w-full sm:w-72 lg:w-96">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isSpanish ? "Filtrar por nombre o email..." : "Filter by name or email..."}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-none focus:border-black focus:ring-0 text-sm font-sans transition-all"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <div className="mb-4 text-xs font-medium text-gray-600">
        {isSpanish 
          ? `Mostrando ${filteredUsers.length} de ${users.length} registros`
          : `Showing ${filteredUsers.length} of ${users.length} records`
        }
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left font-sans text-sm">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="px-6 py-3 font-medium text-black text-xs">
                {isSpanish ? 'Investigador / Usuario' : 'Researcher / User'}
              </th>
              <th className="px-6 py-3 font-medium text-black text-xs">
                Contacto
              </th>
              <th className="px-6 py-3 font-medium text-black text-xs">
                {isSpanish ? 'Asignación de Roles' : 'Role Assignment'}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.slice(0, 100).map((user) => (
              <tr key={user.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 align-top">
                  <div className="flex items-center gap-4">
                    {user.imageUrl ? (
                      <img 
                        src={user.imageUrl} 
                        className="w-10 h-10 object-cover border border-gray-300" 
                        alt={user.displayName}
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gray-100 border border-gray-300 flex items-center justify-center">
                        <span className="text-lg font-serif font-bold text-[#004b87]">
                          {user.displayName?.charAt(0) || 'U'}
                        </span>
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-gray-900">
                        {user.displayName || (isSpanish ? 'Sin nombre' : 'No name')}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5">UID: {user.id?.slice(0, 8)}</div>
                    </div>
                  </div>
                </td>
                
                <td className="px-6 py-4 align-top text-gray-600">
                  {user.email}
                </td>

                <td className="px-6 py-4 align-top">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {(user.roles || []).map(role => {
                      const displayRole = !isSpanish ? (ES_TO_EN[role] || role) : role;
                      return (
                        <div 
                          key={role}
                          className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-300 text-gray-700 text-[11px] font-medium px-2.5 py-1 rounded-none"
                        >
                          {displayRole}
                          <button
                            onClick={() => removeRole(user.id, role)}
                            className="text-gray-400 hover:text-black transition-colors ml-1"
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
                    className="w-full max-w-xs appearance-none bg-white border border-dashed border-gray-300 hover:border-black text-gray-600 text-xs font-medium rounded-none px-3 py-2 cursor-pointer transition-colors focus:outline-none focus:border-black"
                    value=""
                  >
                    <option value="" disabled>
                      {isSpanish ? '+ Añadir nuevo rol' : '+ Add new role'}
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
        <div className="text-center py-16 text-gray-400 bg-gray-50 border border-gray-200 mt-4 rounded-none">
          <UserIcon className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-sans">
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

  const getActiveTabFromPath = () => {
    const path = location.pathname;
    const match = path.match(/\/(?:es\/)?login\/([^/]+)/);
    if (!match) return 'profile';
    
    const routePath = match[1];
    
    const routeToTab = {
      '': 'profile',
      'submissions': 'submissions',
      'reviewer-tasks': 'reviewer-tasks',
      'deskreview': 'deskreview',
      'reviewer-applications': 'reviewer-applications',
      'reviewer-profile': 'reviewer-profile',
      'assignment': 'assignment',
      'calendar': 'calendar',
      'submit': 'submit',
      'director': 'director',
      'chief': 'chief',
      'tasks': 'tasks',
      'news': 'news',
      'sci-news': 'SciNews',
      'admissions': 'admissions',
      'users': 'users'
    };
    
    return routeToTab[routePath] || 'profile';
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
  
  const [userData, setUserData] = useState(user);
  const [users, setUsers] = useState([]);
  const [reviewerAssignments, setReviewerAssignments] = useState([]);

  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimStatus, setClaimStatus] = useState('idle');
  const [anonymousProfile, setAnonymousProfile] = useState(null);
  const [claimError, setClaimError] = useState('');
  
  const checkForAnonymousProfileLocal = useCallback(async () => {
    if (!user?.email) {
      setClaimStatus('not-available');
      setShowClaimModal(true);
      return;
    }
    
    setClaimStatus('checking');
    setShowClaimModal(true);
    setClaimError('');
    
    try {
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
          articlesClaimed: result.articlesClaimed,
          roles: prev.roles?.includes('Autor') ? prev.roles : [...(prev.roles || []), 'Autor']
        }));
        
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
  
  const { getReviewerAssignmentsByEmail } = useReviewerAssignment(user);

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

  const isChiefEditor = userRoles.includes('Editor en Jefe'); 
  const isDirectorGeneral = userRoles.includes('Director General');
  const canManageReviewers = isSectionEditor || isChiefEditor || isDirectorGeneral;

  const tabs = [
    { id: 'profile', label: isSpanish ? 'Mi Perfil' : 'My Profile', roles: ['any'], path: '' },
    { id: 'submissions', label: isSpanish ? 'Mis Envíos' : 'My Submissions', roles: ['Autor'], path: 'submissions' },
    { id: 'reviewer-tasks', label: isSpanish ? 'Mis Revisiones' : 'My Reviews', roles: ['Revisor'], path: 'reviewer-tasks' },
    { id: 'deskreview', label: isSpanish ? 'Desk Review' : 'Desk Review', roles: ['Editor de Sección', 'Editor en Jefe'], path: 'deskreview' },
    { id: 'reviewer-applications', label: isSpanish ? 'Postulaciones Revisores' : 'Reviewer Applications', roles: ['Editor de Sección', 'Editor en Jefe', 'Director General'], path: 'reviewer-applications' },
    { id: 'assignment', label: isSpanish ? 'Asignar Artículos' : 'Assign Articles', roles: ['Encargado de Asignación de Artículos', 'Director General'], path: 'assignment' },
    { id: 'calendar', label: isSpanish ? 'Calendario' : 'Calendar', roles: ['Editor en Jefe', 'Director General', 'Encargado de Asignación de Artículos'], path: 'calendar' },
    { id: 'submit', label: isSpanish ? 'Enviar Manuscrito' : 'Submit Manuscript', roles: ['Autor'], path: 'submit' },
    { id: 'director', label: isSpanish ? 'Panel Directivo' : 'Director Panel', roles: ['Director General'], path: 'director' },
    { id: 'chief', label: isSpanish ? 'Panel Editor Jefe' : 'Chief Editor Panel', roles: ['Editor en Jefe'], path: 'chief' },
    { id: 'tasks', label: isSpanish ? 'Tareas' : 'Tasks', roles: ['Encargado de Redes Sociales', 'Responsable de Desarrollo Web'], path: 'tasks' },
    { id: 'news', label: isSpanish ? 'Noticias' : 'News', roles: ['Director General'], path: 'news' },
    { id: 'SciNews', label: isSpanish ? 'Noticias Científicas' : 'Scientific News', roles: ['Director General', 'Editor en Jefe', 'Editor de Sección', 'Periodista'], path: 'sci-news' },
    { id: 'admissions', label: isSpanish ? 'Admisiones' : 'Admissions', roles: ['Director General'], path: 'admissions' },
    { id: 'users', label: isSpanish ? 'Usuarios' : 'Users', roles: ['Director General'], path: 'users' },
    { id: 'reviewer-profile', label: isSpanish ? 'Mi Perfil Revisor' : 'My Reviewer Profile', roles: ['Revisor'], path: 'reviewer-profile' },
  ].filter(tab => tab.roles.includes('any') || tab.roles.some(role => userRoles.includes(role)));

  const tabRoutes = {
    profile: '',
    submissions: 'submissions',
    'reviewer-tasks': 'reviewer-tasks',
    deskreview: 'deskreview',
    'reviewer-applications': 'reviewer-applications',
    'reviewer-profile': 'reviewer-profile',
    assignment: 'assignment',
    calendar: 'calendar',
    submit: 'submit',
    director: 'director',
    chief: 'chief',
    tasks: 'tasks',
    news: 'news',
    'SciNews': 'sci-news',
    admissions: 'admissions',
    users: 'users'
  };

  useEffect(() => {
    const pathTab = getActiveTabFromPath();
    if (pathTab !== activeTab) {
      setActiveTab(pathTab);
    }
  }, [location.pathname]);

  const handleTabChange = (tabId, event) => {
    if (event) {
      event.preventDefault();
    }
    
    setActiveTab(tabId);
    const route = tabRoutes[tabId] || '';
    
    const currentPath = location.pathname;
    const langPrefix = currentPath.match(/^\/(es|en)\//) ? currentPath.match(/^\/(es|en)\//)[0] : '/';
    
    const newPath = route ? `${langPrefix}login/${route}` : `${langPrefix}login`;
    
    navigate(newPath, { replace: true });
  };

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
    if (!loadingUser) {
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
      return;
    }

    if (userData && effectiveName) {
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

      setLoadingUser(false);
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
      return;
    }

    if (!safetyTimeoutRef.current) {
      safetyTimeoutRef.current = setTimeout(() => {
        console.error('Timeout de carga en PortalSection - posible corrupción de datos');
        setLoadTimeout(true);
        setDataCorrupted(true);
        setLoadingUser(false);
        safetyTimeoutRef.current = null;
      }, 20000);
    }

    return () => {
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
    };
  }, [userData, effectiveName, loadingUser]);

  useEffect(() => {
    if (userData && userData.uid && userData.email) {
      setDataCorrupted(false);
      setLoadTimeout(false);
    }
  }, [userData?.uid]);

  const openReviewerWorkspace = (assignmentId) => {
    window.open(`/reviewer-workspace/${assignmentId}`, '_blank', 'noopener,noreferrer');
  };

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center font-sans">
        <div className="flex flex-col items-center bg-white p-12 border-2 border-black rounded-none">
          <div className="w-12 h-12 border-2 border-gray-200 border-t-[#004b87] rounded-full animate-spin" />
          <p className="mt-6 text-[#004b87] font-medium text-xs">
            {isSpanish ? 'Iniciando Portal Editorial...' : 'Loading Editorial Portal...'}
          </p>
          <p className="mt-2 text-xs text-gray-400">
            {isSpanish 
              ? 'Esto no debería tardar más de unos segundos' 
              : 'This should not take more than a few seconds'}
          </p>

          <div className="mt-8 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-400 mb-3">
              {isSpanish 
                ? '¿La carga está tardando demasiado?' 
                : 'Is loading taking too long?'}
            </p>
            <button
              onClick={() => {
                if (safetyTimeoutRef.current) {
                  clearTimeout(safetyTimeoutRef.current);
                  safetyTimeoutRef.current = null;
                }
                setLoadTimeout(true);
                setDataCorrupted(true);
                setLoadingUser(false);
              }}
              className="text-xs text-black hover:text-[#004b87] underline font-medium"
            >
              {isSpanish
                ? 'Forzar salida de pantalla de carga'
                : 'Force exit loading screen'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (dataCorrupted || loadTimeout) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4 font-sans">
        <div className="bg-white border-t-4 border-t-black rounded-none shadow-none p-8 md:p-12 max-w-lg w-full border border-gray-300">
          <h3 className="font-serif text-2xl font-bold text-black mb-4">
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
            className="w-full bg-black hover:bg-[#004b87] text-white py-3 text-xs font-medium tracking-wide rounded-none transition-all"
          >
            {isSpanish ? 'Destruir Sesión y Reiniciar' : 'Destroy Session & Restart'}
          </button>
        </div>
      </div>
    );
  }

  if (!effectiveName) {
    return <div className="text-black text-center p-4">
      {isSpanish ? 'Usuario no definido' : 'User not defined'}
    </div>;
  }

  if (!userData) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-white p-4 md:p-8 flex items-center justify-center"
      >
        <div className="text-center text-gray-600 bg-white p-6 border border-gray-300 rounded-none">
          <p className="text-lg font-sans mb-4">
            {isSpanish ? 'Cargando datos del usuario...' : 'Loading user data...'}
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      
      {/* HEADER EDITORIAL - ESTILO ACADÉMICO CLÁSICO */}
      <header className="mb-0">
        {/* Top utility bar */}
        <div className="flex justify-end items-center py-2 text-[11px] font-sans text-gray-500 gap-6 border-b border-gray-200 px-6 lg:px-12">
          <div className="flex items-center gap-2">
            <span>{isSpanish ? 'Investigador / Usuario:' : 'Researcher / User:'}</span>
            <span className="font-medium text-gray-800">{effectiveName}</span>
            <span className="text-gray-400 font-mono ml-2">UID:{userData?.uid?.substring(0,6)}</span>
          </div>
          <button 
            onClick={onLogout} 
            className="text-[#004b87] hover:text-black font-medium transition-colors"
          >
            {isSpanish ? 'Cerrar Sesión' : 'Log Out'}
          </button>
        </div>

        {/* Brand Area */}
        <div className="py-10 flex flex-col md:flex-row md:items-end justify-between gap-6 px-6 lg:px-12 border-b-2 border-black">
          <div>
            <div className="uppercase tracking-wide text-[10px] font-medium text-gray-500 mb-3">
              {isSpanish ? 'Sistema de Gestión Editorial' : 'Editorial Management System'}
            </div>
            <h1 className="font-serif text-4xl md:text-5xl text-black tracking-tight mb-2">
              {isSpanish ? 'Portal Editorial' : 'Editorial Portal'}
            </h1>
            <p className="font-serif text-lg text-gray-600 italic">
              Revista Nacional de las Ciencias para Estudiantes
            </p>
          </div>
          
          <div className="hidden md:flex items-center gap-4">
            {userData.imageUrl ? (
              <img src={userData.imageUrl} alt="Profile" className="w-12 h-12 object-cover border border-gray-300 rounded-none" />
            ) : (
              <div className="w-12 h-12 bg-gray-100 flex items-center justify-center border border-gray-300 rounded-none">
                <span className="text-black text-lg font-serif">{effectiveName?.charAt(0) || 'U'}</span>
              </div>
            )}
          </div>
        </div>

        {/* TABS NAVEGACIÓN - GRID ESTRICTO */}
        <div className="px-6 lg:px-12">
          <nav className="flex overflow-x-auto whitespace-nowrap scrollbar-hide gap-8 border-b-2 border-black bg-white">
            {tabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={(e) => handleTabChange(tab.id, e)}
                className={`py-4 text-[14px] font-sans transition-colors relative flex-shrink-0 group ${
                  activeTab === tab.id 
                    ? 'text-black font-medium' 
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                {tab.label}
                
                <div className={`absolute bottom-[-2px] left-0 right-0 h-[4px] transition-colors ${
                  activeTab === tab.id 
                    ? 'bg-[#004b87]' 
                    : 'bg-transparent group-hover:bg-gray-300'
                }`} />
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Panel de invitaciones para revisores */}
      {isReviewer && (
        <ReviewerInvitationsPanel 
          user={userData}
          onAccept={(invitation) => {
            const assignmentQuery = query(
              collection(db, 'reviewerAssignments'),
              where('invitationId', '==', invitation.id)
            );
            
            getDocs(assignmentQuery).then(snapshot => {
              if (!snapshot.empty) {
                const assignmentId = snapshot.docs[0].id;
                navigate(`/reviewer-workspace/${assignmentId}`);
              } else {
                setTimeout(async () => {
                  const retrySnapshot = await getDocs(assignmentQuery);
                  if (!retrySnapshot.empty) {
                    const assignmentId = retrySnapshot.docs[0].id;
                    navigate(`/reviewer-workspace/${assignmentId}`);
                  } else {
                    handleTabChange('reviewer-tasks', null);
                  }
                }, 3000);
              }
            });
          }}
        />
      )}

      {/* ÁREA DE CONTENIDO */}
      <main className="max-w-[1400px] mx-auto px-6 lg:px-12 py-12">
        <AnimatePresence mode="wait">
          {/* PERFIL */}
          {activeTab === 'profile' && (
            <motion.section
              key="profile"
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
            >
              <ProfileSection user={userData} />
              
              {isAuthor && !userData?.claimedAnonymousUid && claimStatus === 'idle' && (
                <div className="mt-8 max-w-5xl mx-auto bg-white border-l-4 border-l-[#004b87] rounded-none p-8">
                  <h3 className="font-serif text-xl font-bold text-[#004b87] mb-2">
                    {isSpanish ? 'Reclamar Publicaciones Anteriores' : 'Claim Previous Publications'}
                  </h3>
                  <p className="text-sm text-gray-600 mb-5">
                    {isSpanish 
                      ? 'Si publicaste en volúmenes pasados de la revista, puedes asociar esos metadatos a este perfil digital.'
                      : 'If you published in past volumes of the journal, you can associate those metadata to this digital profile.'}
                  </p>
                  <button
                    onClick={() => { setShowClaimModal(true); checkForAnonymousProfileLocal(); }}
                    className="px-6 py-2.5 bg-white border border-gray-300 hover:border-[#004b87] text-[#004b87] font-medium text-xs rounded-none transition-all"
                  >
                    {isSpanish ? 'Verificar Historial' : 'Verify History'}
                  </button>
                </div>
              )}
            </motion.section>
          )}

          {/* MIS ENVÍOS */}
         // En PortalSection.js, dentro de las pestañas
{activeTab === 'submissions' && (
  <motion.section key="submissions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <SubmissionDashboard 
      user={userData} 
      onNavigateToForm={(draft) => {
        // Si hay draft, abrir formulario con datos
        // Si no, abrir formulario nuevo
        setActiveTab('submit');
      }}
    />
  </motion.section>
)}

          {activeTab === 'reviewer-profile' && (
            <motion.div
              key="reviewer-profile"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-white overflow-y-auto"
            >
              <ReviewerProfilePanel 
                user={userData} 
                onBack={(e) => handleTabChange('profile', e)} 
              />
            </motion.div>
          )}

          {/* MIS REVISIONES */}
          {activeTab === 'reviewer-tasks' && (
            <motion.section
              key="reviewer-tasks"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
            >
              <div className="bg-white border border-gray-300 border-t-4 border-t-[#004b87] p-8 rounded-none">
                <h2 className="font-serif text-2xl font-bold text-black mb-6 border-b-2 border-black pb-4">
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
                        className="p-6 border border-gray-300 rounded-none bg-white hover:border-black hover:shadow-none transition-all cursor-pointer group"
                        onClick={() => navigate(`/reviewer-workspace/${assignment.id}`)}
                      >
                        <h3 className="font-serif font-bold text-lg text-[#004b87] group-hover:text-black transition-colors mb-3">
                          {assignment.submission?.title}
                        </h3>
                        <div className="flex gap-6 text-xs font-sans text-gray-600">
                          <span>
                            {isSpanish ? 'Estado: ' : 'Status: '} 
                            <span className={
                              assignment.status === 'submitted' ? 'text-green-700' :
                              assignment.status === 'in-progress' ? 'text-blue-700' : 'text-black'
                            }>
                              {assignment.status}
                            </span>
                          </span>
                          <span>{isSpanish ? 'Ronda: ' : 'Round: '} {assignment.round}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.section>
          )}

          {/* DESK REVIEW */}
          {activeTab === 'deskreview' && (
            <motion.div
              key="deskreview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-white overflow-y-auto"
            >
              <div className="sticky top-0 z-50 bg-white border-b-2 border-black">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
                  <button
                    onClick={(e) => handleTabChange('profile', e)}
                    className="flex items-center gap-2 text-xs font-medium text-[#004b87] hover:text-black transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    {isSpanish ? 'Volver al Portal' : 'Back to Portal'}
                  </button>
                  <h2 className="font-serif text-lg font-bold text-black">
                    {isSpanish ? 'Panel de Desk Review' : 'Desk Review Panel'}
                  </h2>
                  <div className="w-24"></div>
                </div>
              </div>
              
              <div className="w-full">
                <DeskReviewPanel user={userData} />
              </div>
            </motion.div>
          )}

          {/* POSTULACIONES A REVISOR */}
          {activeTab === 'reviewer-applications' && (
            <motion.div
              key="reviewer-applications"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-white overflow-y-auto"
            >
              <div className="sticky top-0 z-50 bg-white border-b-2 border-black">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
                  <button
                    onClick={(e) => handleTabChange('profile', e)}
                    className="flex items-center gap-2 text-xs font-medium text-[#004b87] hover:text-black transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    {isSpanish ? 'Volver al Portal' : 'Back to Portal'}
                  </button>
                  <h2 className="font-serif text-lg font-bold text-black">
                    {isSpanish ? 'Panel de Postulaciones a Revisor' : 'Reviewer Applications Panel'}
                  </h2>
                  <div className="w-24"></div>
                </div>
              </div>
              
              <div className="w-full h-full">
                <ReviewerApplicationsPanel />
              </div>
            </motion.div>
          )}

          {/* ASIGNAR ARTÍCULOS */}
          {activeTab === 'assignment' && (
            <motion.section key="assignment">
              <ArticleAssignmentPanel user={userData} />
            </motion.section>
          )}
          
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

          {activeTab === 'SciNews' && (
            <motion.section key="SciNews">
              <ScientificNewsUploadSection userData={userData} />
            </motion.section>
          )}

          {/* ENVIAR MANUSCRITO */}
          {activeTab === 'submit' && (
            <motion.section
              key="submit"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-white overflow-y-auto"
            >
              <div className="sticky top-0 z-50 bg-white border-b-2 border-black">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleTabChange('profile', null)}
                      className="flex items-center gap-2 text-xs font-medium text-[#004b87] hover:text-black transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      {isSpanish ? 'Volver al Portal' : 'Back to Portal'}
                    </button>
                  </div>
                  <h2 className="font-serif text-lg font-bold text-black">
                    {isSpanish ? 'Envío de Manuscrito' : 'Manuscript Submission'}
                  </h2>
                  <div className="w-24"></div>
                </div>
              </div>

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
            <motion.div
              key="director"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-white overflow-y-auto"
            >
              <div className="sticky top-0 z-50 bg-white border-b-2 border-black">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
                  <button
                    onClick={(e) => handleTabChange('profile', e)}
                    className="flex items-center gap-2 text-xs font-medium text-[#004b87] hover:text-black transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    {isSpanish ? 'Volver al Portal' : 'Back to Portal'}
                  </button>
                  <h2 className="font-serif text-lg font-bold text-black">
                    {isSpanish ? 'Panel Directivo' : 'Director Panel'}
                  </h2>
                  <div className="w-24"></div>
                </div>
              </div>
              
              <div className="w-full">
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
              </div>
            </motion.div>
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
          {activeTab === 'tasks' && (
            <motion.section key="tasks">
              <TaskSection user={userData} />
            </motion.section>
          )}
          
          {/* NOTICIAS */}
          {activeTab === 'news' && (
            <motion.section key="news">
              <NewsUploadSection />
            </motion.section>
          )}
          
          {/* ADMISIONES */}
          {activeTab === 'admissions' && (
            <motion.section key="admissions">
              <Admissions />
            </motion.section>
          )}
          
          {/* GESTIÓN DE USUARIOS */}
          {activeTab === 'users' && (
            <motion.section key="users">
              <UserManagement users={users} />
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* MODAL DE RECLAMACIÓN DE PERFIL */}
      <AnimatePresence>
        {showClaimModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }} 
              className="bg-white rounded-none shadow-2xl max-w-lg w-full p-10 font-sans border-t-4 border-t-[#004b87]"
            >
              {claimStatus === 'checking' && (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-2 border-gray-200 border-t-[#004b87] rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-xs font-medium text-gray-500">
                    {isSpanish ? 'Consultando base de datos...' : 'Querying database...'}
                  </p>
                </div>
              )}

              {claimStatus === 'available' && anonymousProfile && (
                <>
                  <h3 className="font-serif text-2xl font-bold text-[#004b87] mb-4">
                    {isSpanish ? '¡Perfil encontrado!' : 'Profile found!'}
                  </h3>
                  <div className="bg-gray-50 border border-gray-300 rounded-none p-6 mb-6">
                    <p className="text-gray-800 font-medium mb-2 text-sm">
                      {isSpanish ? 'Hemos encontrado un perfil como autor en los siguientes artículos:' : 'We found a profile as author in the following articles:'}
                    </p>
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      {anonymousProfile.articles?.map((article, idx) => (
                        <li key={idx} className="text-xs">{article.title}</li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-gray-800 mb-6 text-sm leading-relaxed">
                    {isSpanish 
                      ? 'Al reclamar este perfil, todos estos artículos se vincularán automáticamente a tu cuenta y aparecerán en tu perfil público.'
                      : 'By claiming this profile, all these articles will be automatically linked to your account and will appear in your public profile.'}
                  </p>
                  
                  {claimError && (
                    <div className="bg-white text-black p-4 rounded-none mb-6 text-xs border border-black">
                      {claimError}
                    </div>
                  )}
                  
                  <div className="flex gap-3">
                    <button
                      onClick={handleClaimProfile}
                      disabled={claimStatus === 'claiming'}
                      className="flex-1 py-3 bg-[#004b87] hover:bg-black disabled:bg-gray-300 text-white font-medium text-xs rounded-none transition-all"
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
                      className="flex-1 py-3 border border-gray-300 hover:bg-gray-50 font-medium text-xs rounded-none transition-all text-gray-800"
                    >
                      {isSpanish ? 'Cancelar' : 'Cancel'}
                    </button>
                  </div>
                </>
              )}
              
              {claimStatus === 'success' && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-300">
                    <svg className="w-6 h-6 text-[#004b87]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="font-serif text-xl font-bold text-[#004b87] mb-2">
                    {isSpanish ? '¡Perfil reclamado con éxito!' : 'Profile claimed successfully!'}
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {isSpanish 
                      ? 'Tus publicaciones se han vinculado a tu cuenta.'
                      : 'Your publications have been linked to your account.'}
                  </p>
                </div>
              )}
              
              {claimStatus === 'error' && claimStatus !== 'claiming' && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-300">
                    <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <h3 className="font-serif text-xl font-bold text-black mb-2">
                    {isSpanish ? 'Error al reclamar' : 'Error claiming profile'}
                  </h3>
                  <p className="text-gray-600 mb-4 text-sm">{claimError || (isSpanish ? 'Intenta nuevamente más tarde' : 'Please try again later')}</p>
                  <button
                    onClick={() => setShowClaimModal(false)}
                    className="px-6 py-2.5 bg-black text-white rounded-none font-medium text-xs"
                  >
                    {isSpanish ? 'Cerrar' : 'Close'}
                  </button>
                </div>
              )}

              {claimStatus === 'not-available' && (
                <div className="text-center py-8">
                  <p className="text-gray-600 text-sm">
                    {isSpanish 
                      ? 'No encontramos publicaciones anteriores asociadas a tu email.'
                      : 'We did not find previous publications associated with your email.'}
                  </p>
                  <button
                    onClick={() => setShowClaimModal(false)}
                    className="mt-6 px-6 py-2.5 bg-black text-white rounded-none font-medium text-xs"
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