import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Papa from 'papaparse';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { debounce } from 'lodash';
import { ReviewerWorkspace } from './WorkspaceEN';
import NewsUploadSectionEN from './NewsUploadSectionEN';
import TaskSectionEN from './TaskSectionEN';
import AssignSectionEN from './AssignSectionEN';
import DirectorPanelEN from './DirectorPanelEN';
import AdmissionsEN from './AdmissionsEN';
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

const ASSIGNMENTS_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS_RFrrfaVQHftZUhvJ1LVz0i_Tju-6PlYI8tAu5hLNLN21u8M7KV-eiruomZEcMuc_sxLZ1rXBhX1O/pub?output=csv';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby2B1OUt3TMqaed6Vz-iamUPn4gHhKXG2RRxiy8Nt6u69Cg-2kSze2XQ-NywX5QrNfy/exec';
const RUBRIC_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzehxU_O7GkzfiCqCsSdnFwvA_Mhtfr_vSZjqVsBo3yx8ZEpr9Qur4NHPI09tyH1AZe/exec';
const RUBRIC_CSV1 = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS1BhqyalgqRIACNtlt1C0cDSBqBXCtPABA8WnXFOnbDXkLauCpLjelu9GHv7i1XLvPY346suLE9Lag/pub?gid=0&single=true&output=csv';
const RUBRIC_CSV2 = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS1BhqyalgqRIACNtlt1C0cDSBqBXCtPABA8WnXFOnbDXkLauCpLjelu9GHv7i1XLvPY346suLE9Lag/pub?gid=1438370398&single=true&output=csv';
const RUBRIC_CSV3 = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS1BhqyalgqRIACNtlt1C0cDSBqBXCtPABA8WnXFOnbDXkLauCpLjelu9GHv7i1XLvPY346suLE9Lag/pub?gid=1972050001&single=true&output=csv';

// Role translation maps (EN <-> ES)
const EN_TO_ES = {
  'Founder': 'Fundador',
  'Co-Founder': 'Co-Fundador',
  'General Director': 'Director General',
  'Deputy General Director': 'Subdirector General',
  'Editor-in-Chief': 'Editor en Jefe',
  'Section Editor': 'Editor de Sección',
  'Reviewer': 'Revisor',
  'Reviewer / Editorial Committee': 'Revisor',
  'Web Development Manager': 'Responsable de Desarrollo Web',
  'Technical Support Manager': 'Encargado de Soporte Técnico',
  'Social Media Manager': 'Encargado de Redes Sociales',
  'Graphic Designer': 'Diseñador Gráfico',
  'Community Manager': 'Community Manager',
  'New Collaborators Manager': 'Encargado de Nuevos Colaboradores',
  'Events or Calls Coordinator': 'Coordinador de Eventos o Convocatorias',
  'Legal Advisor': 'Asesor Legal',
  'Editorial Advisor': 'Asesor Editorial',
  'Finance Manager': 'Responsable de Finanzas',
  'Transparency Manager': 'Responsable de Transparencia',
  'Author': 'Autor',
  'Academic Advisor': 'Asesor Académico',
  'Partner Institution': 'Institución Colaboradora'
};

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

const ALL_ROLES_EN = Object.keys(EN_TO_ES);
const ALL_ROLES_ES = Object.keys(ES_TO_EN);

const getDecisionText = (percent) => {
  if (percent >= 85) return 'Accept without changes.';
  if (percent >= 70) return 'Accept with minor changes.';
  if (percent >= 50) return 'Major revision required before publishing.';
  return 'Reject.';
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
          An error occurred. Please reload the page.
          <details className="mt-2 text-sm">
            <summary>Error details</summary>
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
  return (
    <div className="bg-white border border-gray-200 p-4 md:p-8 rounded-3xl shadow-sm mb-6 overflow-hidden">
      <h3 className="font-serif text-2xl font-bold text-gray-900 mb-4">Deadline Calendar</h3>
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
            next: "Next",
            previous: "Previous",
            today: "Today",
            month: "Month",
            week: "Week",
            day: "Day",
            agenda: "Agenda",
            date: "Date",
            time: "Time",
            event: "Event",
            noEventsInRange: "No events in this range",
            showMore: total => `+ Show more (${total})`
          }}
        />
      </div>
    </div>
  );
}

/** * MODERNIZED DESIGN: Peer-review form style rubric */
const RubricViewer = ({ roleKey, scores, onChange, readOnly = false }) => {
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
          Evaluation Protocol: {roleKey}
        </h5>
        <div className="text-sm font-mono font-bold text-emerald-700 bg-emerald-50 px-4 py-1.5 rounded-2xl">
          SCORE: {total} / {max}
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
                    LEVEL {val}
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
 * ASSIGNMENT CARD: Editorial Style Card
 */
const AssignmentCard = ({ assignment, onClick, index }) => {
  const role = assignment.role;
  const isAuthorCard = role === 'Author';
  const isCompleted = isAuthorCard
    ? (assignment.feedbackEditor && ['Accepted', 'Rejected'].includes(assignment.Estado))
    : assignment.isCompleted;
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
          {role}
        </span>
        <div className={`w-3 h-3 rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`} />
      </div>
     
      <h4 className="font-serif text-xl font-bold text-gray-900 group-hover:text-emerald-800 transition-colors mb-6 line-clamp-2 break-words leading-tight">
        {assignment['Nombre Artículo']}
      </h4>
      <div className="mt-auto pt-6 border-t border-gray-100 space-y-3">
        <div className="flex justify-between text-xs text-gray-500 font-sans">
          <span>DEADLINE</span>
          <span className="font-bold text-gray-700 break-words">{assignment.Plazo ? new Date(assignment.Plazo).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'NO DATE'}</span>
        </div>
        <div className="flex justify-between text-xs text-gray-500 font-sans">
          <span>STATUS</span>
          <span className={`font-bold break-words ${isCompleted ? 'text-emerald-700' : 'text-amber-700'}`}>
            {isCompleted ? 'COMPLETED' : 'PENDING'}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

/* ==================== INTERESTS TAGS COMPONENT ==================== */
const InterestsTags = ({ value = [], onChange, placeholder }) => {
  const [inputValue, setInputValue] = useState('');

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
      {/* Current tags */}
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

      {/* Input + button */}
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
          ADD
        </button>
      </div>
    </div>
  );
};

// ==================== PROFILE SECTION (Fully Responsive, English) ====================
const ProfileSection = ({ user }) => {
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lang, setLang] = useState('en'); // Default to English

  const [form, setForm] = useState({
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    descriptionEn: user.description?.en || '',
    descriptionEs: user.description?.es || '',
    // Support for arrays (new) and fallback for old strings
    interestsEn: Array.isArray(user.interests?.en) 
      ? user.interests.en 
      : (user.interests?.en ? user.interests.en.split(',').map(s => s.trim()).filter(Boolean) : []),
    interestsEs: Array.isArray(user.interests?.es) 
      ? user.interests.es 
      : (user.interests?.es ? user.interests.es.split(',').map(s => s.trim()).filter(Boolean) : []),
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
      [langKey === 'en' ? 'interestsEn' : 'interestsEs']: newInterests
    }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Image cannot exceed 5MB");
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
        alert("Error uploading image");
      } finally {
        setUploading(false);
      }
    };

    reader.readAsDataURL(file);
  };

  const saveProfile = async () => {
    setSaving(true);

    let descEn = form.descriptionEn.trim();
    let descEs = form.descriptionEs.trim();
    if (!descEs) descEs = descEn;
    if (!descEn) descEn = descEs;

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        firstName: form.firstName,
        lastName: form.lastName,
        displayName: `${form.firstName} ${form.lastName}`.trim(),
        description: { en: descEn, es: descEs },
        interests: { 
          en: form.interestsEn, 
          es: form.interestsEs 
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
      alert('Error saving profile');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    console.warn('ProfileSection rendered without user data');
    return <div className="text-center p-8">Loading profile...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 sm:space-y-12 px-2 sm:px-4">
      {/* Avatar Header - Fully Responsive */}
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-8 lg:p-12 flex flex-col lg:flex-row items-center gap-6 sm:gap-8 lg:gap-12">
        <div className="relative group flex-shrink-0">
          <div className="w-36 h-36 sm:w-44 sm:h-44 lg:w-52 lg:h-52 rounded-2xl sm:rounded-3xl overflow-hidden ring-8 ring-white shadow-2xl relative">
            {form.imageUrl ? (
              <img src={form.imageUrl} className="object-cover w-full h-full" alt="Profile" />
            ) : (
              <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-gray-100 to-gray-50">
                <UserIcon className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 text-gray-300" />
              </div>
            )}

            {uploading && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center">
                <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 border-4 border-white border-t-transparent rounded-full animate-spin mb-2 sm:mb-3" />
                <span className="text-white text-xs sm:text-sm font-medium tracking-widest">UPLOADING...</span>
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
          <p className="text-base sm:text-lg lg:text-xl text-gray-500 font-medium break-words">{form.institution || 'No institution'}</p>
          {form.orcid && (
            <a href={`https://orcid.org/${form.orcid}`} target="_blank" className="text-emerald-600 hover:underline text-xs sm:text-sm mt-2 inline-block break-words">
              ORCID • {form.orcid}
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-12">
        {/* Left Column */}
        <div className="lg:col-span-7 space-y-6 sm:space-y-8 lg:space-y-10">
          {/* Biography */}
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-8 lg:p-12">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8 lg:mb-10">
              <h3 className="font-serif text-2xl sm:text-3xl font-bold text-gray-900">Biography & Interests</h3>
              <div className="flex bg-gray-100 rounded-2xl p-1.5 w-full sm:w-auto">
                <button 
                  onClick={() => setLang('en')} 
                  className={`flex-1 sm:flex-none px-4 sm:px-6 lg:px-8 py-2 sm:py-3 rounded-2xl text-xs sm:text-sm font-semibold transition-all ${lang === 'en' ? 'bg-white shadow text-emerald-700' : 'text-gray-500'}`}
                >
                  ENGLISH
                </button>
                <button 
                  onClick={() => setLang('es')} 
                  className={`flex-1 sm:flex-none px-4 sm:px-6 lg:px-8 py-2 sm:py-3 rounded-2xl text-xs sm:text-sm font-semibold transition-all ${lang === 'es' ? 'bg-white shadow text-emerald-700' : 'text-gray-500'}`}
                >
                  SPANISH
                </button>
              </div>
            </div>

            <div className="space-y-6 sm:space-y-8 lg:space-y-10">
              <div>
                <label className="block uppercase text-xs tracking-[2px] font-bold text-gray-400 mb-2 sm:mb-3">DESCRIPTION</label>
                <textarea
                  name={lang === 'en' ? 'descriptionEn' : 'descriptionEs'}
                  value={lang === 'en' ? form.descriptionEn : form.descriptionEs}
                  onChange={handleChange}
                  className="w-full h-40 sm:h-48 lg:h-56 p-4 sm:p-5 lg:p-7 bg-gray-50 border-0 rounded-2xl sm:rounded-3xl focus:ring-2 focus:ring-emerald-200 resize-y leading-relaxed text-sm sm:text-base"
                  placeholder={lang === 'en' ? 'Your academic and professional journey...' : 'Tu trayectoria académica y profesional...'}
                />
              </div>

              <div>
                <label className="block uppercase text-xs tracking-[2px] font-bold text-gray-400 mb-2 sm:mb-3">AREAS OF INTEREST</label>
                <InterestsTags
                  value={lang === 'en' ? form.interestsEn : form.interestsEs}
                  onChange={(newTags) => handleInterestsChange(lang, newTags)}
                  placeholder={lang === 'en' ? 'Economics, AI, History...' : 'Economía, IA, Historia...'}
                />
              </div>
            </div>
          </div>

          {/* Affiliation */}
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-8 lg:p-12">
            <h3 className="font-serif text-2xl sm:text-3xl font-bold text-gray-900 mb-6 sm:mb-8 lg:mb-10">Academic Affiliation</h3>
            <div className="space-y-6 sm:space-y-8">
              <div>
                <label className="block uppercase text-xs tracking-[2px] font-bold text-gray-400 mb-2 sm:mb-3">INSTITUTION</label>
                <input 
                  name="institution" 
                  value={form.institution} 
                  onChange={handleChange} 
                  className="w-full p-4 sm:p-5 lg:p-7 bg-gray-50 border-0 rounded-2xl sm:rounded-3xl focus:ring-2 focus:ring-emerald-200 text-sm sm:text-base" 
                />
              </div>
              <div>
                <label className="block uppercase text-xs tracking-[2px] font-bold text-gray-400 mb-2 sm:mb-3">PUBLIC EMAIL</label>
                <div className="relative">
                  <EnvelopeIcon className="absolute left-4 sm:left-5 lg:left-7 top-1/2 -translate-y-1/2 w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
                  <input 
                    name="publicEmail" 
                    value={form.publicEmail} 
                    onChange={handleChange} 
                    className="w-full pl-12 sm:pl-14 lg:pl-16 p-4 sm:p-5 lg:p-7 bg-gray-50 border-0 rounded-2xl sm:rounded-3xl focus:ring-2 focus:ring-emerald-200 text-sm sm:text-base" 
                    placeholder="youremail@example.org" 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-5 space-y-6 sm:space-y-8 lg:space-y-10">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-8 lg:p-12">
            <h3 className="font-serif text-2xl sm:text-3xl font-bold text-gray-900 mb-6 sm:mb-8 lg:mb-10">Digital Presence</h3>
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
                  placeholder="https://yoursite.com"
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

          {/* Save Button */}
          <button
            onClick={saveProfile}
            disabled={saving}
            className="w-full py-4 sm:py-5 lg:py-6 bg-gradient-to-r from-gray-900 to-black text-white rounded-2xl sm:rounded-3xl font-bold tracking-[0.08em] text-xs sm:text-sm uppercase hover:from-emerald-600 hover:to-emerald-700 transition-all duration-300 shadow-xl shadow-gray-200 active:scale-[0.985] flex items-center justify-center gap-2 sm:gap-3"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                SAVING...
              </>
            ) : (
              'SAVE PROFILE'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== USER MANAGEMENT (Fully Responsive, English) ====================
const UserManagement = ({ users: initialUsers }) => {
  const [users, setUsers] = useState(initialUsers);
  const [searchTerm, setSearchTerm] = useState('');

  // Sync with initial prop
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
      console.error('Error adding role:', err);
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
      console.error('Error removing role:', err);
    }
  };

  const filteredUsers = users.filter(user => 
    (user.displayName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!users || users.length === 0) {
    console.warn('UserManagement: No users data available');
    return <div className="text-center py-12 sm:py-20 text-gray-400">Loading users...</div>;
  }

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 p-4 sm:p-6 lg:p-10 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-6 sm:mb-8 lg:mb-10">
        <div>
          <h3 className="text-2xl sm:text-3xl font-serif font-bold text-gray-900">User Management</h3>
          <p className="text-sm sm:text-base text-gray-500 mt-1">Manage editorial team roles and access</p>
        </div>
        
        <div className="relative w-full sm:w-64 lg:w-80">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-10 pr-4 py-3 sm:py-4 bg-gray-50 border border-gray-200 rounded-xl sm:rounded-2xl focus:border-emerald-400 focus:ring-0 text-sm"
          />
          <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
        </div>
      </div>

      {/* Mobile View: Cards */}
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
                <div className="font-semibold text-gray-900 text-base truncate">{user.displayName || 'No name'}</div>
                <div className="text-xs text-gray-400 truncate">{user.email}</div>
              </div>
            </div>
            
            <div className="mb-3">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Roles</div>
              <div className="flex flex-wrap gap-2">
                {(user.roles || []).map(role => {
                  // Convert Spanish roles to English for display
                  const displayRole = ES_TO_EN[role] || role;
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

                {/* New role selector */}
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
                    <option value="" disabled>+ Add role</option>
                    {ALL_ROLES_ES.filter(r => !(user.roles || []).includes(r)).map(role => {
                      const displayRole = ES_TO_EN[role] || role;
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

      {/* Desktop View: Table */}
      <div className="hidden lg:block overflow-hidden rounded-3xl border border-gray-100">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-8 py-5 text-left text-xs font-semibold text-gray-500 uppercase tracking-widest">User</th>
              <th className="px-8 py-5 text-left text-xs font-semibold text-gray-500 uppercase tracking-widest">Email</th>
              <th className="px-8 py-5 text-left text-xs font-semibold text-gray-500 uppercase tracking-widest">Roles</th>
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
                      <div className="font-semibold text-gray-900">{user.displayName || 'No name'}</div>
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
                      const displayRole = ES_TO_EN[role] || role;
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

                    {/* New role selector */}
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
                        <option value="" disabled>+ Add role</option>
                        {ALL_ROLES_ES.filter(r => !(user.roles || []).includes(r)).map(role => {
                          const displayRole = ES_TO_EN[role] || role;
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
          No users found matching your search criteria.
        </div>
      )}
    </div>
  );
};

export default function PortalSection({ user, onLogout }) {
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
  
  // Real-time data from Firebase
  const [userData, setUserData] = useState(user);
  const [users, setUsers] = useState([]);

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
                console.error('Error deleting image:', err);
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
                console.error('Error inserting new line after image:', err);
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
  const isAuthor = assignments.some(a => a.role === 'Author');
  const isChief = userRoles.some(r => EN_TO_ES[r] === 'Editor en Jefe' || r === 'Editor en Jefe');
  const isDirector = userRoles.some(r => EN_TO_ES[r] === 'Director General' || r === 'Director General');
  const isRrss = userRoles.some(r => EN_TO_ES[r] === 'Encargado de Redes Sociales' || r === 'Encargado de Redes Sociales');
  const isWebDev = userRoles.some(r => EN_TO_ES[r] === 'Responsable de Desarrollo Web' || r === 'Responsable de Desarrollo Web');
  const canSeeCalendar = isChief || isDirector || isRrss || isWebDev || assignments.some(a => a.role !== 'Author');

  const pendingAssignments = useMemo(() =>
    isAuthor
      ? assignments.filter(a => !a.feedbackEditor || !['Accepted', 'Rejected'].includes(a.Estado))
      : assignments.filter(a => !a.isCompleted),
    [assignments, isAuthor]
  );

  const completedAssignments = useMemo(() =>
    isAuthor
      ? assignments.filter(a => a.feedbackEditor && ['Accepted', 'Rejected'].includes(a.Estado))
      : assignments.filter(a => a.isCompleted),
    [assignments, isAuthor]
  );

  const tabs = [
    { id: 'profile', label: 'MY PROFILE' },
    { id: 'assignments', label: 'MY ASSIGNMENTS' },
    { id: 'completed', label: 'COMPLETED' },
    { id: 'calendar', label: 'ACADEMIC CALENDAR', hidden: !canSeeCalendar },
    { id: 'director', label: 'DIRECTOR PANEL', hidden: !isDirector },
    { id: 'chief', label: 'CHIEF EDITOR PANEL', hidden: !isChief },
    { id: 'tasks', label: 'MY TASKS', hidden: !isRrss && !isWebDev },
    { id: 'news', label: 'PUBLISH NEWS', hidden: !isDirector },
    { id: 'admissions', label: 'ADMISSIONS', hidden: !isDirector },
    { id: 'usermanagement', label: 'USER MANAGEMENT', hidden: !isDirector }
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

  // User snapshot (enhanced for effectiveName)
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
        // Fallback if document doesn't exist yet (new users)
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

  
  // Snapshot of all users (Director only)
  useEffect(() => {
    if (userData?.roles?.some(r => EN_TO_ES[r] === 'Director General' || r === 'Director General')) {
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
          
          // Author assignments
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
            'Nombre Artículo': row['Nombre Artículo'] || 'No title',
            Estado: row['Estado'] === 'Aceptado' ? 'Accepted' : 
                    row['Estado'] === 'Rechazado' ? 'Rejected' : 
                    row['Estado'],
            role: 'Author',
            feedbackEditor: row['Feedback 3'] || 'No editor feedback yet.',
            isCompleted: !!row['Feedback 3'],
            Plazo: row['Plazo'] || null,
          }));
          
          // Reviewer/Editor assignments
          const reviewerRows = data
            .filter(row => {
              return row['Revisor 1']?.trim() === effectiveName ||
                     row['Revisor 2']?.trim() === effectiveName ||
                     row['Editor']?.trim() === effectiveName;
            });
          console.log('Reviewer rows found:', reviewerRows.length);
          
          const reviewerAssignments = reviewerRows.map(row => {
            const role = row['Revisor 1']?.trim() === effectiveName ? 'Reviewer 1'
                      : row['Revisor 2']?.trim() === effectiveName ? 'Reviewer 2'
                      : 'Editor';
            const num = role === 'Reviewer 1' ? 1 : role === 'Reviewer 2' ? 2 : 3;
            const assignment = {
              id: row['Nombre Artículo'],
              'Nombre Artículo': row['Nombre Artículo'] || 'No title',
              'Link Artículo': row['Link Artículo'],
              Estado: row['Estado'] === 'Aceptado' ? 'Accepted' : 
                     row['Estado'] === 'Rechazado' ? 'Rejected' : 
                     row['Estado'],
              role,
              feedback: row[`Feedback ${num}`] || '',
              report: row[`Informe ${num}`] || '',
              vote: row[`Voto ${num}`] === 'sí' ? 'yes' : 
                    row[`Voto ${num}`] === 'no' ? 'no' : 
                    row[`Voto ${num}`] || '',
              feedback1: row['Feedback 1'] || 'No feedback from Reviewer 1.',
              feedback2: row['Feedback 2'] || 'No feedback from Reviewer 2.',
              informe1: row['Informe 1'] || 'No report from Reviewer 1.',
              informe2: row['Informe 2'] || 'No report from Reviewer 2.',
              isCompleted: !!row[`Feedback ${num}`] && !!row[`Informe ${num}`] && !!row[`Voto ${num}`],
              Plazo: row['Plazo'] || null,
            };
            const name = assignment.id;
            if (role === 'Reviewer 1') {
              assignment.scores = rubrics.scoresMap1[name] || { gramatica: 0, claridad: 0, estructura: 0, citacion: 0 };
            } else if (role === 'Reviewer 2') {
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
            if (assignment.role !== 'Author') {
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
          console.error('Error parsing CSV:', err);
          setError('Error loading assignments');
          setLoading(false);
        },
      });
    } catch (err) {
      console.error('Error loading assignments:', err);
      setError('Error connecting to server');
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
      case 'Reviewer 1': return ['gramatica', 'claridad', 'estructura', 'citacion'];
      case 'Reviewer 2': return ['relevancia', 'rigor', 'originalidad', 'argumentos'];
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
      setRubricStatus((prev) => ({ ...prev, [link]: `Error: Incomplete rubric. Missing or invalid: ${missingKeys.join(', ')}` }));
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
        setRubricStatus((prev) => ({ ...prev, [link]: 'Rubric submitted successfully' }));
        await fetchAssignments();
      } else {
        setRubricStatus((prev) => ({ ...prev, [link]: 'Error submitting rubric after 3 attempts' }));
      }
    } catch (err) {
      console.error('General error submitting rubric:', err);
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
        setSubmitStatus((prev) => ({ ...prev, [link]: 'Main data submitted successfully' }));
        await fetchAssignments();
      } else {
        setSubmitStatus((prev) => ({ ...prev, [link]: 'Error submitting main data after 3 attempts' }));
      }
    } catch (err) {
      console.error('General error submitting main data:', err);
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
    if (role === "Reviewer 1") {
      return 'As Reviewer 1, your role is to review technical aspects such as grammar, spelling, source citation, AI-generated content detection, logical coherence, and overall structure. Provide detailed comments in the Google Drive document to suggest improvements. Ensure the language is clear and academic. You must provide feedback to the author in the corresponding box. Additionally, submit a summarized report explaining your observations to guide the editor. Finally, in the vote box, enter "yes" if you approve the article, and "no" if you reject it.';
    } else if (role === "Reviewer 2") {
      return 'As Reviewer 2, focus on substantive content: verify source accuracy, topic seriousness and originality, argument relevance, and contribution to the field. Evaluate if the article is innovative and well-supported. Leave comments in the Google Drive document. You must provide feedback to the author in the corresponding box. Additionally, submit a summarized report explaining your observations to guide the editor. Finally, in the vote box, enter "yes" if you approve the article, and "no" if you reject it.';
    } else if (role === "Editor") {
      return `As Editor, your responsibility is to review the reviewers' feedback and reports, integrate them with your own evaluation, and write a final sensitive and constructive feedback for the author. Edit the text directly if necessary and decide the article's final status. Use the Google Drive document for edits. You must provide feedback to the author synthesizing the reviewers' feedback. Your message must be precise and sensitive, without discouraging the author. Use the "sandwich" technique. If you don't know what it is, consult <a href="https://www.santanderopenacademy.com/en/blog/sandwich-technique.html" style="color: blue;">here</a>. Based on psychological studies indicating feedback improves performance in only 30% of cases if mishandled, ensure criticism is specific, actionable, and not diluted by positive comments to maximize effectiveness. Complement with the SBI model (Situation-Behavior-Impact) for clarity: describe the situation, observed behavior, and impact. Then, submit your report with changes made, which must be precise and academic. Finally, in the vote box, enter "yes" if you approve the article, and "no" if you reject it.`;
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
    if (!encoded) return <p className="text-gray-600 font-sans text-sm break-words">No content available.</p>;
    try {
      const html = base64DecodeUnicode(encoded);
      return <div className="ql-editor break-words leading-relaxed font-sans text-sm text-gray-800" dangerouslySetInnerHTML={{ __html: html }} />;
    } catch (err) {
      console.error('Error decoding content:', err);
      return <div className="ql-editor break-words leading-relaxed font-sans text-sm text-gray-800" dangerouslySetInnerHTML={{ __html: encoded }} />;
    }
  };

  const handleImageModalSubmit = (link) => {
    const quillRef = feedbackQuillRefs.current[link] || reportQuillRefs.current[link];
    if (!quillRef) return;
    const editor = quillRef.getEditor();
    let { url, width, height, align } = imageData[link] || {};
    if (!url) {
      setSubmitStatus((prev) => ({ ...prev, [link]: 'Image URL is required.' }));
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
          <p className="mt-6 text-gray-500 font-medium tracking-wider">LOADING EDITORIAL PORTAL...</p>
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
          <p className="mt-6 text-gray-500 font-medium tracking-wider">LOADING ASSIGNMENTS...</p>
        </div>
      </div>
    );
  }

  if (!effectiveName) {
    console.error('No effectiveName, rendering error');
    return <div className="text-red-600 text-center p-4">User not defined</div>;
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
          <p className="text-lg font-sans mb-4">Loading user data...</p>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-12 bg-[#fafafa] min-h-screen">
      {/* Portal Header */}
      <header className="mb-8 sm:mb-10 md:mb-12 flex flex-col md:flex-row md:items-end justify-between border-b border-gray-900 pb-6 md:pb-8">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 tracking-tighter mb-2 break-words">
            Editorial Portal
          </h1>
          <div className="flex items-center space-x-2 sm:space-x-3">
            <p className="text-gray-500 font-sans tracking-widest uppercase text-xs break-words">
              Active Session:
            </p>
            {userData.imageUrl ? (
              <motion.img
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                src={userData.imageUrl}
                alt={`Profile of ${effectiveName || 'User'}`}
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
          Log Out
        </button>
      </header>

      {/* Editorial Style Navigation - Horizontal scroll on mobile */}
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
                    Retry
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
                  <p className="ml-3 sm:ml-4 text-sm sm:text-base text-gray-600 font-sans break-words">Loading assignments...</p>
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
                  <h3 className="mt-3 sm:mt-4 font-serif text-lg sm:text-xl font-bold text-gray-900 break-words">No assignments {activeTab === 'assignments' ? 'pending' : 'completed'} at this time.</h3>
                  <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600 font-sans break-words">Stay tuned for new opportunities.</p>
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
              <DirectorPanelEN 
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
              <AssignSectionEN 
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
              <TaskSectionEN user={userData} />
            </motion.section>
          )}

          {activeTab === 'news' && (
            <motion.section
              key="news"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            >
              <NewsUploadSectionEN />
            </motion.section>
          )}

          {activeTab === 'admissions' && (
            <motion.section
              key="admissions"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            >
              <AdmissionsEN />
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

      {/* DETAIL MODAL */}
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
                ← Back to Portal
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
    </div>
  );
}