// src/components/ReviewerProfilePanel.js
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../hooks/useLanguage';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

// ============================================================
// ÁREAS TEMÁTICAS OFICIALES (ESPAÑOL E INGLÉS)
// ============================================================
const AREAS_TEMATICAS = {
  es: {
    "Ciencias Exactas y Naturales": [
      "Matemáticas", "Física", "Química", "Biología", "Geología",
      "Astronomía y Astrofísica", "Ciencias Ambientales y Ecología",
      "Oceanografía", "Meteorología y Ciencias Atmosféricas", "Paleontología"
    ],
    "Ciencias de la Salud": [
      "Medicina General e Interna", "Salud Pública y Epidemiología",
      "Enfermería", "Nutrición y Dietética", "Farmacología y Farmacia",
      "Odontología", "Kinesiología y Fisioterapia", "Tecnología Médica y Bioanálisis", "Veterinaria"
    ],
    "Ingeniería y Tecnología": [
      "Ingeniería Civil", "Ingeniería Industrial y de Sistemas",
      "Ingeniería Mecánica", "Ingeniería Eléctrica y Electrónica",
      "Ingeniería Química y Biotecnología", "Ingeniería en Computación e Informática",
      "Ciencia de Datos e Inteligencia Artificial", "Robótica y Automatización",
      "Ingeniería de Materiales y Nanotecnología", "Ingeniería Aeroespacial", "Energías Renovables y Sostenibilidad"
    ],
    "Ciencias Sociales": [
      "Sociología", "Antropología y Arqueología", "Psicología",
      "Economía y Negocios", "Ciencias Políticas y Relaciones Internacionales",
      "Derecho", "Geografía Humana y Ordenamiento Territorial",
      "Estudios de Género", "Comunicación Social y Periodismo",
      "Educación y Pedagogía", "Trabajo Social"
    ],
    "Humanidades": [
      "Historia", "Filosofía", "Lingüística y Filología", "Literatura",
      "Estudios Clásicos", "Teología y Ciencias de la Religión",
      "Estudios Culturales", "Arte, Música y Cine", "Arquitectura y Urbanismo"
    ],
    "Ciencias Agropecuarias": [
      "Agronomía y Producción Agrícola", "Ciencias Forestales",
      "Acuicultura y Pesca", "Zootecnia y Producción Animal", "Ingeniería de Alimentos"
    ]
  },
  en: {
    "Exact and Natural Sciences": [
      "Mathematics", "Physics", "Chemistry", "Biology", "Geology",
      "Astronomy and Astrophysics", "Environmental Sciences and Ecology",
      "Oceanography", "Meteorology and Atmospheric Sciences", "Paleontology"
    ],
    "Health Sciences": [
      "General and Internal Medicine", "Public Health and Epidemiology",
      "Nursing", "Nutrition and Dietetics", "Pharmacology and Pharmacy",
      "Dentistry", "Kinesiology and Physical Therapy",
      "Medical Technology and Bioanalysis", "Veterinary Medicine"
    ],
    "Engineering and Technology": [
      "Civil Engineering", "Industrial and Systems Engineering",
      "Mechanical Engineering", "Electrical and Electronic Engineering",
      "Chemical Engineering and Biotechnology", "Computer Science and Informatics",
      "Data Science and Artificial Intelligence", "Robotics and Automation",
      "Materials Science and Nanotechnology", "Aerospace Engineering",
      "Renewable Energies and Sustainability"
    ],
    "Social Sciences": [
      "Sociology", "Anthropology and Archaeology", "Psychology",
      "Economics and Business", "Political Science and International Relations",
      "Law", "Human Geography and Land Planning",
      "Gender Studies", "Social Communication and Journalism",
      "Education and Pedagogy", "Social Work"
    ],
    "Humanities": [
      "History", "Philosophy", "Linguistics and Philology", "Literature",
      "Classical Studies", "Theology and Religious Studies",
      "Cultural Studies", "Art, Music and Film", "Architecture and Urbanism"
    ],
    "Agricultural Sciences": [
      "Agronomy and Agricultural Production", "Forestry Sciences",
      "Aquaculture and Fisheries", "Animal Science and Production", "Food Engineering"
    ]
  }
};

const MAX_EXPERTISE_AREAS = 5;
const REVIEWER_STATUS_OPTIONS = {
  active: {
    es: { label: 'Activo', description: 'Disponible para recibir nuevas invitaciones de revision.' },
    en: { label: 'Active', description: 'Available to receive new review invitations.' }
  },
  inactive: {
    es: { label: 'Inactivo', description: 'No disponible temporalmente. No recibira nuevas invitaciones.' },
    en: { label: 'Inactive', description: 'Temporarily unavailable. Will not receive new invitations.' }
  },
  paused: {
    es: { label: 'En Pausa', description: 'Pausado por tiempo limitado. Sus revisiones activas no se veran afectadas.' },
    en: { label: 'Paused', description: 'Paused for a limited time. Active reviews will not be affected.' }
  }
};
// Aplanar todas las áreas para búsqueda rápida
const ALL_AREAS_FLAT = Object.values(AREAS_TEMATICAS.es).flat();

// ============================================================
// ICONOS SVG (Estilo línea fina corporativa)
// ============================================================
const Icons = {
  User: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  Institution: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
  ),
  Email: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
  ),
  Check: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
  ),
  Clock: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  ),
  Chart: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
  ),
  Edit: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
  ),
  Save: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
  ),
  Spinner: () => (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  ),
  ArrowLeft: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
  ),
  CheckCircle: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  ),
  Lock: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
  ),
  Alert: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
  ),
  ChevronDown: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
  ),
  ChevronUp: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
  ),
};

// ============================================================
// COMPONENTE: BARRA DE PROGRESO CIRCULAR
// ============================================================
const CircularProgress = ({ value, max, size = 120, strokeWidth = 8, color = '#003B5C', label = '' }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center relative">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="#e2e8f0" strokeWidth={strokeWidth} fill="none"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={color} strokeWidth={strokeWidth} fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-gray-800">{value}</span>
        {label && <span className="text-xs text-gray-500">{label}</span>}
      </div>
    </div>
  );
};

// ============================================================
// COMPONENTE: BARRA DE PROGRESO LINEAL
// ============================================================
const LinearProgress = ({ value, max, color = '#003B5C', label = '' }) => {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  return (
    <div className="w-full">
      <div className="flex justify-between items-end mb-1.5">
        <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{label}</span>
        <span className="text-xs font-bold text-[#003B5C]">{Math.round(percentage)}%</span>
      </div>
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }} animate={{ width: `${percentage}%` }} transition={{ duration: 1, ease: 'easeOut' }}
          className="h-full rounded-full" style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
};

// ============================================================
// COMPONENTE: SELECTOR DE ÁREAS TEMÁTICAS (MÁXIMO 5)
// ============================================================
const AreasSelector = ({ selectedAreas, onChange, isEditing, language }) => {
  const isSpanish = language === 'es';
  const areasData = AREAS_TEMATICAS[language] || AREAS_TEMATICAS.es;
  const [privacyOpen, setPrivacyOpen] = useState(false);

  const toggleArea = (area) => {
    if (!isEditing) return;
    const current = [...selectedAreas];
    const index = current.indexOf(area);
    if (index > -1) {
      current.splice(index, 1);
    } else {
      if (current.length >= MAX_EXPERTISE_AREAS) return; // Límite de 5
      current.push(area);
    }
    onChange(current);
  };

  const selectAllInCategory = (categoryAreas) => {
    if (!isEditing) return;
    const current = [...selectedAreas];
    const allSelected = categoryAreas.every(area => current.includes(area));
    
    if (allSelected) {
      onChange(current.filter(area => !categoryAreas.includes(area)));
    } else {
      categoryAreas.forEach(area => {
        if (!current.includes(area) && current.length < MAX_EXPERTISE_AREAS) {
          current.push(area);
        }
      });
      onChange(current);
    }
  };

  const remaining = MAX_EXPERTISE_AREAS - selectedAreas.length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <h4 className="font-serif text-lg font-bold text-[#003B5C]">
            {isSpanish ? 'Dominios de Especialización' : 'Domains of Expertise'}
          </h4>
          <p className="text-[11px] text-slate-500 uppercase tracking-widest mt-1">
            {selectedAreas.length} / {MAX_EXPERTISE_AREAS} {isSpanish ? 'áreas seleccionadas' : 'areas selected'}
          </p>
        </div>
        {isEditing && remaining === 0 && (
          <span className="text-[10px] font-bold text-[#FF7900] uppercase tracking-wider bg-[#FFF5EB] px-3 py-1 rounded-full">
            {isSpanish ? 'Límite alcanzado' : 'Limit reached'}
          </span>
        )}
      </div>

      {/* Mensaje de privacidad desplegable */}
      <div className="bg-[#EBF4F7] border border-[#003B5C]/10 rounded-sm overflow-hidden">
        <button
          onClick={() => setPrivacyOpen(!privacyOpen)}
          className="w-full flex items-center justify-between p-3 text-left hover:bg-[#D6EAF0] transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-[#003B5C]"><Icons.Lock /></span>
            <span className="text-xs font-semibold text-[#003B5C] uppercase tracking-wider">
              {isSpanish ? 'Privacidad de Datos' : 'Data Privacy'}
            </span>
          </div>
          {privacyOpen ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
        </button>
        <AnimatePresence>
          {privacyOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 text-xs text-slate-600 leading-relaxed">
                <p className="flex items-start gap-2">
                  <span className="text-[#FF7900] mt-0.5"><Icons.Alert /></span>
                  <span>
                    {isSpanish
                      ? 'Los datos que inserte aquí no serán visibles al público general. Esta información se utiliza exclusivamente para el proceso de asignación de revisiones y es tratada con estricta confidencialidad.'
                      : 'The data you enter here will not be visible to the general public. This information is used exclusively for the review assignment process and is treated with strict confidentiality.'}
                  </span>
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-3 custom-scrollbar">
        {Object.entries(areasData).map(([category, areas]) => {
          const selectedInCategory = areas.filter(area => selectedAreas.includes(area)).length;
          const allSelectedInCategory = areas.every(area => selectedAreas.includes(area));

          return (
            <div key={category} className="bg-white border border-slate-200 rounded-sm">
              <button
                onClick={() => selectAllInCategory(areas)}
                disabled={!isEditing}
                className={`w-full px-4 py-3 flex items-center justify-between text-left transition-colors border-b border-slate-100 ${
                  isEditing ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default bg-slate-50/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  {isEditing && (
                    <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-all ${
                      allSelectedInCategory ? 'bg-[#FF7900] border-[#FF7900]' : selectedInCategory > 0 ? 'border-[#FF7900] bg-[#FF7900]/10' : 'border-slate-300 bg-white'
                    }`}>
                      {allSelectedInCategory && <Icons.Check />}
                    </div>
                  )}
                  <span className="font-serif font-semibold text-sm text-[#003B5C]">{category}</span>
                </div>
                {selectedInCategory > 0 && (
                  <span className="text-[10px] bg-[#EBF4F7] text-[#003B5C] font-bold px-2 py-0.5 rounded-sm">
                    {selectedInCategory} / {areas.length}
                  </span>
                )}
              </button>

              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50/30">
                {areas.map(area => {
                  const isSelected = selectedAreas.includes(area);
                  const isDisabled = !isSelected && selectedAreas.length >= MAX_EXPERTISE_AREAS;
                  
                  return (
                    <button
                      key={area}
                      onClick={() => toggleArea(area)}
                      disabled={!isEditing || isDisabled}
                      className={`flex items-start gap-2.5 p-2 rounded-sm text-xs text-left transition-all border ${
                        !isEditing && !isSelected ? 'hidden' : ''
                      } ${
                        isEditing ? 'cursor-pointer' : 'cursor-default'
                      } ${
                        isSelected
                          ? 'bg-white border-[#003B5C]/20 shadow-sm'
                          : isDisabled
                          ? 'bg-slate-100 border-transparent text-slate-400 cursor-not-allowed'
                          : 'bg-transparent border-transparent hover:bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isEditing && (
                        <div className={`mt-0.5 w-3 h-3 rounded-sm border flex-shrink-0 flex items-center justify-center ${
                          isSelected ? 'bg-[#003B5C] border-[#003B5C]' : isDisabled ? 'border-slate-300 bg-slate-200' : 'border-slate-300'
                        }`}>
                          {isSelected && <Icons.Check />}
                        </div>
                      )}
                      {!isEditing && isSelected && <span className="text-[#003B5C] mt-0.5"><Icons.CheckCircle /></span>}
                      <span className={isSelected ? 'text-[#003B5C] font-medium' : ''}>{area}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function ReviewerProfilePanel({ user, onBack }) {
  const { language } = useLanguage();
  const isSpanish = language === 'es';

  // Estados
  const [reviewerData, setReviewerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  // Formulario editable
  const [editForm, setEditForm] = useState({
    areasOfExpertise: [],
    maxActiveReviews: 3,
    preferredLanguage: 'es',
    timeAvailablePerReview: '2-weeks',
    publicEmail: '',
    institution: '',
    orcid: '',
    status: 'active', 
    statusReason: '', 
  });

  // Cargar datos del revisor
  useEffect(() => {
    if (!user?.uid) return;
    loadReviewerData();
  }, [user?.uid]);

  // Auto-ocultar mensaje de feedback
  useEffect(() => {
    if (feedbackMessage) {
      const timer = setTimeout(() => setFeedbackMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedbackMessage]);

  const loadReviewerData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Intentar cargar desde colección 'reviewers'
      const reviewerRef = doc(db, 'reviewers', user.uid);
      const reviewerSnap = await getDoc(reviewerRef);

      if (reviewerSnap.exists()) {
        const data = reviewerSnap.data();
        // Asegurar máximo 5 áreas al cargar
        const areas = (data.areasOfExpertise || []).slice(0, MAX_EXPERTISE_AREAS);
        setReviewerData({ ...data, areasOfExpertise: areas });
        setEditForm({
          areasOfExpertise: areas,
          maxActiveReviews: data.availability?.maxActiveReviews || 3,
          preferredLanguage: data.availability?.preferredLanguage || 'es',
          timeAvailablePerReview: data.availability?.timeAvailablePerReview || '2-weeks',
          publicEmail: data.publicEmail || '',
          institution: data.institution || '',
          orcid: data.orcid || '',
          status: 'active',      
          statusReason: '',          
        });
      } else {
        // Cargar desde users como fallback
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const areas = (userData.interests?.es || userData.interests?.en || []).slice(0, MAX_EXPERTISE_AREAS);
          setReviewerData({
            ...userData,
            areasOfExpertise: areas,
            stats: {},
            availability: { maxActiveReviews: 3, preferredLanguage: 'es', timeAvailablePerReview: '2-weeks' },
          });
          setEditForm({
            areasOfExpertise: areas,
            maxActiveReviews: 3,
            preferredLanguage: 'es',
            timeAvailablePerReview: '2-weeks',
            publicEmail: userData.publicEmail || userData.email || '',
            institution: userData.institution || '',
            orcid: userData.orcid || '',
            status: data.status || 'active',           
            statusReason: data.statusReason || '',     
          });
        }
      }
    } catch (err) {
      console.error('Error loading reviewer data:', err);
      setError(isSpanish ? 'Error al cargar datos del revisor' : 'Error loading reviewer data');
    } finally {
      setLoading(false);
    }
  };

  // Guardar cambios
  const handleSave = async () => {
    setSaving(true);
    try {
      // Asegurar máximo 5 áreas y filtrar solo las válidas
      const validAreas = editForm.areasOfExpertise
        .filter(area => ALL_AREAS_FLAT.includes(area))
        .slice(0, MAX_EXPERTISE_AREAS);

      const updateData = {
  areasOfExpertise: validAreas,
  availability: {
    maxActiveReviews: editForm.maxActiveReviews,
    currentActiveReviews: reviewerData?.availability?.currentActiveReviews || 0,
    preferredLanguage: editForm.preferredLanguage,
    timeAvailablePerReview: editForm.timeAvailablePerReview,
  },
  publicEmail: editForm.publicEmail,
  institution: editForm.institution,
  orcid: editForm.orcid,
  status: editForm.status,                    // NUEVO
  statusReason: editForm.statusReason || '',  // NUEVO
  statusChangedAt: editForm.status !== (reviewerData?.status || 'active') 
    ? new Date().toISOString() 
    : reviewerData?.statusChangedAt || null,  // NUEVO
  updatedAt: new Date().toISOString(),
};

      // Guardar en colección reviewers
      const reviewerRef = doc(db, 'reviewers', user.uid);
      await updateDoc(reviewerRef, updateData);

      // También actualizar en users
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        institution: editForm.institution,
        publicEmail: editForm.publicEmail,
        orcid: editForm.orcid,
        updatedAt: new Date().toISOString(),
      });

      setReviewerData(prev => ({ ...prev, ...updateData }));
      setIsEditing(false);
      setFeedbackMessage({
        type: 'success',
        text: isSpanish ? 'Perfil actualizado correctamente' : 'Profile updated successfully',
      });
    } catch (err) {
      console.error('Error saving reviewer profile:', err);
      setFeedbackMessage({
        type: 'error',
        text: isSpanish ? 'Error al guardar cambios' : 'Error saving changes',
      });
    } finally {
      setSaving(false);
    }
  };

  // Cancelar edición
  const handleCancel = () => {
    setEditForm({
  areasOfExpertise: (reviewerData?.areasOfExpertise || []).slice(0, MAX_EXPERTISE_AREAS),
  maxActiveReviews: reviewerData?.availability?.maxActiveReviews || 3,
  preferredLanguage: reviewerData?.availability?.preferredLanguage || 'es',
  timeAvailablePerReview: reviewerData?.availability?.timeAvailablePerReview || '2-weeks',
  publicEmail: reviewerData?.publicEmail || '',
  institution: reviewerData?.institution || '',
  orcid: reviewerData?.orcid || '',
  status: reviewerData?.status || 'active',           // NUEVO
  statusReason: reviewerData?.statusReason || '',      // NUEVO
});
    setIsEditing(false);
  };

  // Estadísticas para mostrar
  const stats = reviewerData?.stats || {};
  const completedReviews = stats.completedAssignments || stats.totalReviewsSubmitted || 0;
  const totalAssignments = stats.totalAssignments || 0;
  const onTimeRate = stats.onTimeRate || 100;
  const acceptanceRate = stats.acceptanceRate || 0;
  const avgScore = stats.averageReviewScore || 0;
  const totalRounds = stats.totalRoundsParticipated || 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFDFD] flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-2 border-slate-200 border-t-[#003B5C] rounded-full animate-spin mb-4" />
        <p className="text-[11px] text-slate-500 font-sans uppercase tracking-[0.2em]">
          {isSpanish ? 'Cargando Espacio de Trabajo' : 'Loading Workspace'}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#FDFDFD] flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-sm p-6 max-w-md text-center shadow-sm">
          <p className="text-red-700 text-sm font-medium">{error}</p>
          <button onClick={loadReviewerData} className="mt-4 px-6 py-2 bg-red-700 text-white text-[11px] uppercase tracking-wider font-bold rounded-sm hover:bg-red-800 transition-colors">
            {isSpanish ? 'Reintentar' : 'Retry'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 selection:bg-[#EBF4F7]">
      
      {/* ================= HEADER EDITORIAL ================= */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="w-full h-1 bg-[#FF7900]"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-500 hover:text-[#003B5C] transition-colors"
          >
            <Icons.ArrowLeft /> {isSpanish ? 'Volver al Panel' : 'Back to Panel'}
          </button>
          <div className="text-right">
            <h2 className="font-serif text-lg text-[#003B5C] leading-none">
              {isSpanish ? 'Perfil de Par Evaluador' : 'Peer Reviewer Profile'}
            </h2>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 mt-1">Configuración y Métricas</p>
          </div>
          <div className="w-24" />
        </div>
      </header>

      {/* ================= TOAST NOTIFICATION ================= */}
      <AnimatePresence>
        {feedbackMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className={`fixed top-20 right-6 z-50 px-5 py-3 rounded-sm shadow-lg border flex items-center gap-3 ${
              feedbackMessage.type === 'success' ? 'bg-[#EBF4F7] border-[#003B5C]/20 text-[#003B5C]' : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {feedbackMessage.type === 'success' ? <Icons.CheckCircle /> : <Icons.Alert />}
            <span className="text-sm font-medium">{feedbackMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* ================= COLUMNA IZQUIERDA (Perfil y Métricas) ================= */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Tarjeta de Identidad */}
            <div className="bg-white rounded-sm shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-[#002B49] p-8 text-center relative">
                {/* Patrón sutil de fondo */}
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
                
                <div className="relative z-10 w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/20">
                  <span className="text-3xl font-serif text-white">
                    {reviewerData?.firstName?.charAt(0) || reviewerData?.displayName?.charAt(0) || 'R'}
                  </span>
                </div>
                <h3 className="relative z-10 font-serif text-xl text-white mb-1">
                  {reviewerData?.displayName || `${reviewerData?.firstName || ''} ${reviewerData?.lastName || ''}`.trim() || 'Reviewer'}
                </h3>
                <p className="relative z-10 text-white/60 text-xs font-mono">{reviewerData?.email}</p>
                
                <div className="relative z-10 mt-4 inline-flex items-center px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-sm border border-white/20 text-white bg-white/5">
  <span className={`w-1.5 h-1.5 rounded-full mr-2 ${
    reviewerData?.status === 'active' ? 'bg-[#10B981]' : 
    reviewerData?.status === 'paused' ? 'bg-[#F59E0B]' : 
    'bg-slate-400'
  }`}></span>
  {reviewerData?.status === 'active' 
    ? (isSpanish ? 'Cuenta Activa' : 'Active Account') 
    : reviewerData?.status === 'paused'
    ? (isSpanish ? 'En Pausa' : 'Paused')
    : (isSpanish ? 'Inactivo' : 'Inactive')
  }
</div>
              </div>
              
              <div className="p-6 space-y-4 text-sm bg-white">
                {reviewerData?.institution && (
                  <div className="flex items-start gap-3 text-slate-600">
                    <span className="text-slate-400 mt-0.5"><Icons.Institution /></span>
                    <span className="leading-snug">{reviewerData.institution}</span>
                  </div>
                )}
                {reviewerData?.publicEmail && (
                  <div className="flex items-center gap-3 text-slate-600">
                    <span className="text-slate-400"><Icons.Email /></span>
                    <span className="truncate">{reviewerData.publicEmail}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-slate-600">
  <span className="text-slate-400"><Icons.Clock /></span>
  <span className="text-xs">
    {isSpanish ? 'Registro: ' : 'Joined: '}
    <strong className="text-slate-800">
      {reviewerData?.createdAt 
        ? (reviewerData.createdAt.toDate ? reviewerData.createdAt.toDate() : new Date(reviewerData.createdAt)).toLocaleDateString(isSpanish ? 'es-CL' : 'en-US', { month: 'short', year: 'numeric' })
        : '—'}
    </strong>
  </span>
</div>
              </div>
            </div>

            {/* Tarjeta de Estadísticas */}
            <div className="bg-white rounded-sm shadow-sm border border-slate-200 p-6">
              <h4 className="font-serif text-base text-[#003B5C] mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Icons.Chart />
                {isSpanish ? 'Métricas de Desempeño' : 'Performance Metrics'}
              </h4>
              
              <div className="space-y-5">
                <LinearProgress value={onTimeRate} max={100} color="#FF7900" label={isSpanish ? 'Puntualidad en entregas' : 'On-time delivery'} />
                <LinearProgress value={acceptanceRate} max={100} color="#003B5C" label={isSpanish ? 'Tasa de aceptación de invitaciones' : 'Invitation acceptance rate'} />
                
                <div className="grid grid-cols-2 gap-px bg-slate-200 border border-slate-200 rounded-sm overflow-hidden mt-6">
                  <div className="bg-white p-4 text-center hover:bg-slate-50 transition-colors">
                    <div className="text-2xl font-serif text-[#003B5C]">{completedReviews}</div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-1">{isSpanish ? 'Completadas' : 'Completed'}</div>
                  </div>
                  <div className="bg-white p-4 text-center hover:bg-slate-50 transition-colors">
                    <div className="text-2xl font-serif text-[#003B5C]">{totalAssignments}</div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-1">{isSpanish ? 'Asignadas' : 'Assigned'}</div>
                  </div>
                  <div className="bg-white p-4 text-center hover:bg-slate-50 transition-colors">
                    <div className="text-2xl font-serif text-[#003B5C]">{avgScore > 0 ? avgScore.toFixed(1) : '—'}</div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-1">{isSpanish ? 'Puntuación Prom.' : 'Avg Score'}</div>
                  </div>
                  <div className="bg-white p-4 text-center hover:bg-slate-50 transition-colors">
                    <div className="text-2xl font-serif text-[#003B5C]">{totalRounds}</div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-1">{isSpanish ? 'Rondas' : 'Rounds'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ================= COLUMNA DERECHA (Configuración y Áreas) ================= */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Controles Principales */}
            <div className="bg-white rounded-sm shadow-sm border border-slate-200 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-serif text-xl text-[#003B5C]">
                  {isSpanish ? 'Gestión de Perfil' : 'Profile Management'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {isSpanish ? 'Actualice sus áreas de experticia y disponibilidad para recibir invitaciones relevantes.' : 'Update your expertise and availability to receive relevant invitations.'}
                </p>
              </div>
              
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest text-[#003B5C] border border-[#003B5C] rounded-sm hover:bg-[#003B5C] hover:text-white transition-colors"
                >
                  <Icons.Edit /> {isSpanish ? 'Editar Perfil' : 'Edit Profile'}
                </button>
              ) : (
                <div className="flex gap-3 w-full sm:w-auto">
                  <button
                    onClick={handleCancel}
                    className="flex-1 sm:flex-none px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-sm transition-colors"
                  >
                    {isSpanish ? 'Cancelar' : 'Cancel'}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white bg-[#FF7900] hover:bg-[#E06A00] rounded-sm transition-colors disabled:opacity-50"
                  >
                    {saving ? <Icons.Spinner /> : <Icons.Save />}
                    {saving ? (isSpanish ? 'Guardando' : 'Saving') : (isSpanish ? 'Guardar Cambios' : 'Save Changes')}
                  </button>
                </div>
              )}
            </div>

            {/* Vista de Edición: Datos de Contacto y Disponibilidad */}
            {isEditing ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-sm shadow-sm border border-slate-200 p-6 space-y-8">
                
                {/* Datos de Contacto */}
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2 mb-4">
                    {isSpanish ? 'Información Académica y Contacto' : 'Academic & Contact Info'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-slate-600 font-semibold mb-1.5">{isSpanish ? 'Institución' : 'Institution'}</label>
                      <input
                        type="text" value={editForm.institution} onChange={(e) => setEditForm(prev => ({ ...prev, institution: e.target.value }))}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-sm text-sm focus:border-[#003B5C] focus:ring-1 focus:ring-[#003B5C] outline-none transition-all placeholder:text-slate-300"
                        placeholder={isSpanish ? 'Universidad / Organización' : 'University / Organization'}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-slate-600 font-semibold mb-1.5">{isSpanish ? 'Email Público (Para Autores)' : 'Public Email'}</label>
                      <input
                        type="email" value={editForm.publicEmail} onChange={(e) => setEditForm(prev => ({ ...prev, publicEmail: e.target.value }))}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-sm text-sm focus:border-[#003B5C] focus:ring-1 focus:ring-[#003B5C] outline-none transition-all placeholder:text-slate-300"
                        placeholder="email@institucion.edu"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[11px] uppercase tracking-wider text-slate-600 font-semibold mb-1.5">ORCID iD</label>
                      <input
                        type="text" value={editForm.orcid} onChange={(e) => setEditForm(prev => ({ ...prev, orcid: e.target.value }))}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-sm text-sm font-mono focus:border-[#003B5C] focus:ring-1 focus:ring-[#003B5C] outline-none transition-all placeholder:text-slate-300"
                        placeholder="0000-0000-0000-0000"
                      />
                    </div>
                  </div>
                </div>
{/* Estado de Disponibilidad */}
<div>
  <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2 mb-4">
    {isSpanish ? 'Estado de Disponibilidad' : 'Availability Status'}
  </h4>
  
  <div className="space-y-4">
    {/* Selector de estado */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {Object.entries(REVIEWER_STATUS_OPTIONS).map(([value, labels]) => {
        const isSelected = editForm.status === value;
        const statusColors = {
          active: 'border-[#10B981] bg-[#ECFDF5]',
          inactive: 'border-slate-300 bg-slate-50',
          paused: 'border-[#F59E0B] bg-[#FFFBEB]'
        };
        const dotColors = {
          active: 'bg-[#10B981]',
          inactive: 'bg-slate-400',
          paused: 'bg-[#F59E0B]'
        };
        
        return (
          <button
            key={value}
            type="button"
            onClick={() => setEditForm(prev => ({ ...prev, status: value }))}
            className={`flex items-start gap-3 p-3 rounded-sm border text-left transition-all ${
              isSelected 
                ? `${statusColors[value]} border-2 shadow-sm` 
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${dotColors[value]} ${isSelected ? 'ring-2 ring-offset-1 ' + (value === 'active' ? 'ring-[#10B981]/30' : value === 'paused' ? 'ring-[#F59E0B]/30' : 'ring-slate-300') : ''}`}></span>
            <div>
              <span className={`text-xs font-bold uppercase tracking-wider ${
                isSelected ? 'text-slate-900' : 'text-slate-600'
              }`}>
                {labels[language]?.label || labels.es.label}
              </span>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                {labels[language]?.description || labels.es.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
    
    {/* Razon del cambio (solo si no esta activo) */}
    {editForm.status !== 'active' && (
      <div>
        <label className="block text-[11px] uppercase tracking-wider text-slate-600 font-semibold mb-1.5">
          {isSpanish ? 'Motivo (opcional)' : 'Reason (optional)'}
        </label>
        <textarea
          value={editForm.statusReason}
          onChange={(e) => setEditForm(prev => ({ ...prev, statusReason: e.target.value }))}
          rows={2}
          className="w-full p-2.5 bg-white border border-slate-300 rounded-sm text-sm focus:border-[#003B5C] focus:ring-1 focus:ring-[#003B5C] outline-none transition-all placeholder:text-slate-300 resize-none"
          placeholder={isSpanish 
            ? 'Ej: Carga academica alta este semestre...' 
            : 'E.g.: High academic load this semester...'}
        />
        <p className="text-[10px] text-slate-400 mt-1">
          {isSpanish 
            ? 'Esta informacion solo es visible para el equipo editorial.' 
            : 'This information is only visible to the editorial team.'}
        </p>
      </div>
    )}
    
    {/* Advertencia si cambia de estado */}
    {editForm.status !== (reviewerData?.status || 'active') && (
      <div className="flex items-start gap-2 p-3 bg-[#FFF5EB] border border-[#FF7900]/20 rounded-sm">
        <span className="text-[#FF7900] mt-0.5"><Icons.Alert /></span>
        <div className="text-xs text-slate-700">
          <p className="font-semibold mb-1">
            {isSpanish ? 'Esta seguro de cambiar su estado?' : 'Are you sure you want to change your status?'}
          </p>
          <p>
            {editForm.status === 'inactive' 
              ? (isSpanish 
                  ? 'Al desactivar su cuenta de revisor, no recibira nuevas invitaciones. Sus revisiones pendientes no se veran afectadas.' 
                  : 'By deactivating your reviewer account, you will not receive new invitations. Your pending reviews will not be affected.')
              : editForm.status === 'paused'
              ? (isSpanish 
                  ? 'Al pausar su cuenta, no recibira nuevas invitaciones temporalmente. Podra reactivarla cuando lo desee.' 
                  : 'By pausing your account, you will temporarily not receive new invitations. You can reactivate it whenever you want.')
              : (isSpanish 
                  ? 'Al reactivar su cuenta, volvera a ser considerado para nuevas invitaciones de revision.' 
                  : 'By reactivating your account, you will be considered for new review invitations again.')
            }
          </p>
        </div>
      </div>
    )}
  </div>
</div>
                {/* Disponibilidad */}
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2 mb-4">
                    {isSpanish ? 'Preferencias de Revisión' : 'Review Preferences'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-slate-600 font-semibold mb-1.5">{isSpanish ? 'Máx. Asignaciones Activas' : 'Max Active Reviews'}</label>
                      <select
                        value={editForm.maxActiveReviews} onChange={(e) => setEditForm(prev => ({ ...prev, maxActiveReviews: parseInt(e.target.value) }))}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-sm text-sm focus:border-[#003B5C] focus:ring-1 focus:ring-[#003B5C] outline-none transition-all"
                      >
                        {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} {isSpanish ? 'simultánea(s)' : 'concurrent'}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-slate-600 font-semibold mb-1.5">{isSpanish ? 'Idioma de Preferencia' : 'Preferred Language'}</label>
                      <select
                        value={editForm.preferredLanguage} onChange={(e) => setEditForm(prev => ({ ...prev, preferredLanguage: e.target.value }))}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-sm text-sm focus:border-[#003B5C] focus:ring-1 focus:ring-[#003B5C] outline-none transition-all"
                      >
                        <option value="es">Español</option>
                        <option value="en">English</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-slate-600 font-semibold mb-1.5">{isSpanish ? 'Tiempo Solicitado' : 'Time Requested'}</label>
                      <select
                        value={editForm.timeAvailablePerReview} onChange={(e) => setEditForm(prev => ({ ...prev, timeAvailablePerReview: e.target.value }))}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-sm text-sm focus:border-[#003B5C] focus:ring-1 focus:ring-[#003B5C] outline-none transition-all"
                      >
                        <option value="1-week">{isSpanish ? '1 Semana' : '1 Week'}</option>
                        <option value="2-weeks">{isSpanish ? '2 Semanas' : '2 Weeks'}</option>
                        <option value="3-weeks">{isSpanish ? '3 Semanas' : '3 Weeks'}</option>
                        <option value="1-month">{isSpanish ? '1 Mes' : '1 Month'}</option>
                      </select>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* Vista de Solo Lectura: Configuraciones Rápidas */
              <div className="bg-white rounded-sm shadow-sm border border-slate-200 p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{isSpanish ? 'Capacidad' : 'Capacity'}</span>
                    <p className="text-sm font-medium text-[#003B5C]">{reviewerData?.availability?.maxActiveReviews || 3} {isSpanish ? 'activas máx.' : 'max active'}</p>
                  </div>
                  <div>
  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{isSpanish ? 'Estado' : 'Status'}</span>
  <p className="text-sm font-medium flex items-center gap-1.5">
    <span className={`w-1.5 h-1.5 rounded-full ${
      reviewerData?.status === 'active' ? 'bg-[#10B981]' : 
      reviewerData?.status === 'paused' ? 'bg-[#F59E0B]' : 
      'bg-slate-400'
    }`}></span>
    <span className={
      reviewerData?.status === 'active' ? 'text-[#10B981]' : 
      reviewerData?.status === 'paused' ? 'text-[#F59E0B]' : 
      'text-slate-500'
    }>
      {reviewerData?.status === 'active' 
        ? (isSpanish ? 'Activo' : 'Active')
        : reviewerData?.status === 'paused'
        ? (isSpanish ? 'En Pausa' : 'Paused')
        : (isSpanish ? 'Inactivo' : 'Inactive')
      }
    </span>
  </p>
</div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{isSpanish ? 'Idioma' : 'Language'}</span>
                    <p className="text-sm font-medium text-[#003B5C]">{reviewerData?.availability?.preferredLanguage === 'en' ? 'English' : 'Español'}</p>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{isSpanish ? 'Tiempo Asignado' : 'Time Allotted'}</span>
                    <p className="text-sm font-medium text-[#003B5C]">
                      {reviewerData?.availability?.timeAvailablePerReview === '1-week' ? (isSpanish ? '1 semana' : '1 week') :
                       reviewerData?.availability?.timeAvailablePerReview === '2-weeks' ? (isSpanish ? '2 semanas' : '2 weeks') :
                       reviewerData?.availability?.timeAvailablePerReview === '3-weeks' ? (isSpanish ? '3 semanas' : '3 weeks') :
                       reviewerData?.availability?.timeAvailablePerReview === '1-month' ? (isSpanish ? '1 mes' : '1 month') : '2 semanas'}
                    </p>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">ORCID iD</span>
                    <p className="text-xs font-mono font-medium text-[#003B5C] mt-1.5">{reviewerData?.orcid || 'No registrado'}</p>
                  </div>
                  {/* Estado actual con razon si existe */}
{reviewerData?.status && reviewerData.status !== 'active' && (
  <div className="mt-4 pt-4 border-t border-slate-100">
    <div className="flex items-start gap-3">
      <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
        reviewerData.status === 'paused' ? 'bg-[#F59E0B]' : 'bg-slate-400'
      }`}></span>
      <div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          {isSpanish ? 'Estado Actual' : 'Current Status'}
        </span>
        <p className="text-sm font-medium text-slate-700 mt-0.5">
          {reviewerData.status === 'paused' 
            ? (isSpanish ? 'Cuenta en pausa' : 'Account paused')
            : (isSpanish ? 'Cuenta inactiva' : 'Inactive account')
          }
        </p>
        {reviewerData.statusReason && (
          <p className="text-xs text-slate-500 mt-1 italic">
            "{reviewerData.statusReason}"
          </p>
        )}
        {reviewerData.statusChangedAt && (
          <p className="text-[10px] text-slate-400 mt-1">
            {isSpanish ? 'Desde: ' : 'Since: '}
            {new Date(reviewerData.statusChangedAt).toLocaleDateString(
              isSpanish ? 'es-CL' : 'en-US', 
              { month: 'short', day: 'numeric', year: 'numeric' }
            )}
          </p>
        )}
      </div>
    </div>
  </div>
)}
                </div>
              </div>
            )}

            {/* Áreas de Especialización */}
            <div className="bg-white rounded-sm shadow-sm border border-slate-200 p-6">
              <AreasSelector
                selectedAreas={isEditing ? editForm.areasOfExpertise : (reviewerData?.areasOfExpertise || [])}
                onChange={(areas) => setEditForm(prev => ({ ...prev, areasOfExpertise: areas }))}
                isEditing={isEditing}
                language={language}
              />
            </div>

          </div>
        </div>
      </main>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #F8FAFC;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #CBD5E1;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94A3B8;
        }
      `}</style>
    </div>
  );
}