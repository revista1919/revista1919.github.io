// src/components/ReviewerProfilePanel.js
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../hooks/useLanguage';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

// ============================================================
// ÁREAS TEMÁTICAS OFICIALES
// ============================================================
const AREAS_TEMATICAS = {
  "Ciencias Exactas y Naturales": [
    "Matemáticas",
    "Física",
    "Química",
    "Biología",
    "Geología",
    "Astronomía y Astrofísica",
    "Ciencias Ambientales y Ecología",
    "Oceanografía",
    "Meteorología y Ciencias Atmosféricas",
    "Paleontología"
  ],
  "Ciencias de la Salud": [
    "Medicina General e Interna",
    "Salud Pública y Epidemiología",
    "Enfermería",
    "Nutrición y Dietética",
    "Farmacología y Farmacia",
    "Odontología",
    "Kinesiología y Fisioterapia",
    "Tecnología Médica y Bioanálisis",
    "Veterinaria"
  ],
  "Ingeniería y Tecnología": [
    "Ingeniería Civil",
    "Ingeniería Industrial y de Sistemas",
    "Ingeniería Mecánica",
    "Ingeniería Eléctrica y Electrónica",
    "Ingeniería Química y Biotecnología",
    "Ingeniería en Computación e Informática",
    "Ciencia de Datos e Inteligencia Artificial",
    "Robótica y Automatización",
    "Ingeniería de Materiales y Nanotecnología",
    "Ingeniería Aeroespacial",
    "Energías Renovables y Sostenibilidad"
  ],
  "Ciencias Sociales": [
    "Sociología",
    "Antropología y Arqueología",
    "Psicología",
    "Economía y Negocios",
    "Ciencias Políticas y Relaciones Internacionales",
    "Derecho",
    "Geografía Humana y Ordenamiento Territorial",
    "Estudios de Género",
    "Comunicación Social y Periodismo",
    "Educación y Pedagogía",
    "Trabajo Social"
  ],
  "Humanidades": [
    "Historia",
    "Filosofía",
    "Lingüística y Filología",
    "Literatura",
    "Estudios Clásicos",
    "Teología y Ciencias de la Religión",
    "Estudios Culturales",
    "Arte, Música y Cine",
    "Arquitectura y Urbanismo"
  ],
  "Ciencias Agropecuarias": [
    "Agronomía y Producción Agrícola",
    "Ciencias Forestales",
    "Acuicultura y Pesca",
    "Zootecnia y Producción Animal",
    "Ingeniería de Alimentos"
  ]
};

// Aplanar todas las áreas para búsqueda rápida
const ALL_AREAS_FLAT = Object.values(AREAS_TEMATICAS).flat();

// ============================================================
// ICONOS SVG
// ============================================================
const Icons = {
  User: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  Institution: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  Email: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  Check: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  Clock: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Chart: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  Star: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
  Edit: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  ),
  Save: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
    </svg>
  ),
  Spinner: () => (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  ),
  ArrowLeft: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  ),
};

// ============================================================
// COMPONENTE: BARRA DE PROGRESO CIRCULAR
// ============================================================
const CircularProgress = ({ value, max, size = 120, strokeWidth = 8, color = '#004b87', label = '' }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-2xl font-bold text-gray-800">{value}</span>
        {label && <span className="text-xs text-gray-500">{label}</span>}
      </div>
    </div>
  );
};

// ============================================================
// COMPONENTE: BARRA DE PROGRESO LINEAL
// ============================================================
const LinearProgress = ({ value, max, color = '#004b87', label = '', showPercentage = true }) => {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-600 font-medium">{label}</span>
        {showPercentage && (
          <span className="text-xs font-bold text-gray-700">{Math.round(percentage)}%</span>
        )}
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
};

// ============================================================
// COMPONENTE: SELECTOR DE ÁREAS TEMÁTICAS
// ============================================================
const AreasSelector = ({ selectedAreas, onChange, isEditing, language }) => {
  const isSpanish = language === 'es';

  const toggleArea = (area) => {
    if (!isEditing) return;
    const current = [...selectedAreas];
    const index = current.indexOf(area);
    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(area);
    }
    onChange(current);
  };

  const selectAllInCategory = (categoryAreas) => {
    if (!isEditing) return;
    const current = [...selectedAreas];
    const allSelected = categoryAreas.every(area => current.includes(area));
    
    if (allSelected) {
      // Deseleccionar todas
      const filtered = current.filter(area => !categoryAreas.includes(area));
      onChange(filtered);
    } else {
      // Seleccionar todas
      categoryAreas.forEach(area => {
        if (!current.includes(area)) {
          current.push(area);
        }
      });
      onChange(current);
    }
  };

  const totalSelected = selectedAreas.length;
  const totalAvailable = ALL_AREAS_FLAT.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-serif text-lg font-bold text-gray-800">
          {isSpanish ? 'Áreas de Especialización' : 'Areas of Expertise'}
        </h4>
        <span className="text-xs text-gray-500 font-mono">
          {totalSelected}/{totalAvailable} {isSpanish ? 'seleccionadas' : 'selected'}
        </span>
      </div>

      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
        {Object.entries(AREAS_TEMATICAS).map(([category, areas]) => {
          const selectedInCategory = areas.filter(area => selectedAreas.includes(area)).length;
          const allSelectedInCategory = areas.every(area => selectedAreas.includes(area));

          return (
            <motion.div
              key={category}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-gray-200 rounded-md overflow-hidden"
            >
              {/* Cabecera de categoría */}
              <button
                onClick={() => selectAllInCategory(areas)}
                disabled={!isEditing}
                className={`w-full px-4 py-2.5 flex items-center justify-between text-left transition-colors ${
                  isEditing ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                    allSelectedInCategory 
                      ? 'bg-[#004b87] border-[#004b87]' 
                      : selectedInCategory > 0 
                      ? 'border-[#004b87] bg-[#004b87]/20' 
                      : 'border-gray-300'
                  }`}>
                    {allSelectedInCategory && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className="font-sans font-bold text-sm text-gray-800">{category}</span>
                </div>
                <span className="text-xs text-gray-400 font-mono">
                  {selectedInCategory}/{areas.length}
                </span>
              </button>

              {/* Lista de áreas */}
              <div className="px-4 pb-3 grid grid-cols-1 md:grid-cols-2 gap-1.5">
                {areas.map(area => {
                  const isSelected = selectedAreas.includes(area);
                  return (
                    <button
                      key={area}
                      onClick={() => toggleArea(area)}
                      disabled={!isEditing}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs text-left transition-all ${
                        isEditing ? 'cursor-pointer' : 'cursor-default'
                      } ${
                        isSelected
                          ? 'bg-[#004b87]/10 text-[#004b87] font-medium border border-[#004b87]/30'
                          : 'text-gray-600 hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${
                        isSelected 
                          ? 'bg-[#004b87] border-[#004b87]' 
                          : 'border-gray-300'
                      }`}>
                        {isSelected && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      {area}
                    </button>
                  );
                })}
              </div>
            </motion.div>
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
        setReviewerData(data);
        setEditForm({
          areasOfExpertise: data.areasOfExpertise || [],
          maxActiveReviews: data.availability?.maxActiveReviews || 3,
          preferredLanguage: data.availability?.preferredLanguage || 'es',
          timeAvailablePerReview: data.availability?.timeAvailablePerReview || '2-weeks',
          publicEmail: data.publicEmail || '',
          institution: data.institution || '',
          orcid: data.orcid || '',
        });
      } else {
        // Cargar desde users como fallback
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const areas = userData.interests?.es || userData.interests?.en || [];
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
      const updateData = {
        areasOfExpertise: editForm.areasOfExpertise.filter(area => ALL_AREAS_FLAT.includes(area)),
        availability: {
          maxActiveReviews: editForm.maxActiveReviews,
          currentActiveReviews: reviewerData?.availability?.currentActiveReviews || 0,
          preferredLanguage: editForm.preferredLanguage,
          timeAvailablePerReview: editForm.timeAvailablePerReview,
        },
        publicEmail: editForm.publicEmail,
        institution: editForm.institution,
        orcid: editForm.orcid,
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
      areasOfExpertise: reviewerData?.areasOfExpertise || [],
      maxActiveReviews: reviewerData?.availability?.maxActiveReviews || 3,
      preferredLanguage: reviewerData?.availability?.preferredLanguage || 'es',
      timeAvailablePerReview: reviewerData?.availability?.timeAvailablePerReview || '2-weeks',
      publicEmail: reviewerData?.publicEmail || '',
      institution: reviewerData?.institution || '',
      orcid: reviewerData?.orcid || '',
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
      <div className="min-h-screen bg-[#f4f5f7] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-t-[#004b87] border-gray-200 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500 font-sans uppercase tracking-wider">
            {isSpanish ? 'Cargando perfil...' : 'Loading profile...'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f4f5f7] flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-md p-6 max-w-md text-center">
          <p className="text-red-600 text-sm">{error}</p>
          <button onClick={loadReviewerData} className="mt-4 px-4 py-2 bg-red-600 text-white text-xs uppercase rounded-md">
            {isSpanish ? 'Reintentar' : 'Retry'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f5f7] font-sans">
      {/* Barra superior */}
      <div className="sticky top-0 z-40 bg-white border-b-2 border-gray-300 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#004b87] hover:text-[#e86125] transition-colors"
          >
            <Icons.ArrowLeft />
            {isSpanish ? 'Volver' : 'Back'}
          </button>
          <h2 className="font-serif text-lg font-bold text-[#004b87]">
            {isSpanish ? 'Perfil de Revisor' : 'Reviewer Profile'}
          </h2>
          <div className="w-24" />
        </div>
      </div>

      {/* Feedback Toast */}
      <AnimatePresence>
        {feedbackMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-16 right-4 z-50 px-6 py-3 rounded-md shadow-lg border flex items-center gap-3 ${
              feedbackMessage.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <Icons.Check />
            <span className="text-sm">{feedbackMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* ============================================================ */}
          {/* COLUMNA IZQUIERDA: Información y estadísticas */}
          {/* ============================================================ */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Tarjeta de identidad */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-br from-[#004b87] to-[#003666] p-6 text-white text-center">
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
                  <span className="text-3xl font-serif font-bold">
                    {reviewerData?.firstName?.charAt(0) || reviewerData?.displayName?.charAt(0) || 'R'}
                  </span>
                </div>
                <h3 className="font-serif text-xl font-bold">
                  {reviewerData?.displayName || `${reviewerData?.firstName || ''} ${reviewerData?.lastName || ''}`.trim() || 'Revisor'}
                </h3>
                <p className="text-white/70 text-sm mt-1">{reviewerData?.email}</p>
                <span className={`inline-block mt-3 px-3 py-1 rounded-full text-xs font-bold uppercase ${
                  reviewerData?.status === 'active' ? 'bg-emerald-500/30 text-emerald-100' :
                  reviewerData?.status === 'inactive' ? 'bg-gray-500/30 text-gray-200' :
                  'bg-red-500/30 text-red-100'
                }`}>
                  {reviewerData?.status === 'active' ? (isSpanish ? 'Activo' : 'Active') :
                   reviewerData?.status === 'inactive' ? (isSpanish ? 'Inactivo' : 'Inactive') :
                   reviewerData?.status || 'Active'}
                </span>
              </div>
              <div className="p-4 space-y-2 text-sm">
                {reviewerData?.institution && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Icons.Institution />
                    <span>{reviewerData.institution}</span>
                  </div>
                )}
                {reviewerData?.publicEmail && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Icons.Email />
                    <span className="truncate">{reviewerData.publicEmail}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-gray-600">
                  <Icons.Clock />
                  <span>
                    {isSpanish ? 'Revisor desde: ' : 'Reviewer since: '}
                    {reviewerData?.createdAt 
                      ? new Date(reviewerData.createdAt._seconds ? reviewerData.createdAt._seconds * 1000 : reviewerData.createdAt).toLocaleDateString(isSpanish ? 'es-CL' : 'en-US')
                      : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Estadísticas rápidas */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h4 className="font-serif text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Icons.Chart />
                {isSpanish ? 'Estadísticas' : 'Statistics'}
              </h4>
              
              <div className="space-y-4">
                <LinearProgress 
                  value={onTimeRate} 
                  max={100} 
                  color="#10b981"
                  label={isSpanish ? 'Revisiones a tiempo' : 'On-time reviews'}
                />
                <LinearProgress 
                  value={acceptanceRate} 
                  max={100} 
                  color="#f59e0b"
                  label={isSpanish ? 'Tasa de aceptación' : 'Acceptance rate'}
                />
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="bg-gray-50 rounded-md p-3 text-center">
                    <div className="text-2xl font-bold text-[#004b87]">{completedReviews}</div>
                    <div className="text-xs text-gray-500">{isSpanish ? 'Completadas' : 'Completed'}</div>
                  </div>
                  <div className="bg-gray-50 rounded-md p-3 text-center">
                    <div className="text-2xl font-bold text-[#004b87]">{totalRounds}</div>
                    <div className="text-xs text-gray-500">{isSpanish ? 'Rondas' : 'Rounds'}</div>
                  </div>
                  <div className="bg-gray-50 rounded-md p-3 text-center">
                    <div className="text-2xl font-bold text-amber-600">{avgScore > 0 ? avgScore.toFixed(1) : '—'}</div>
                    <div className="text-xs text-gray-500">{isSpanish ? 'Punt. Promedio' : 'Avg. Score'}</div>
                  </div>
                  <div className="bg-gray-50 rounded-md p-3 text-center">
                    <div className="text-2xl font-bold text-emerald-600">{totalAssignments}</div>
                    <div className="text-xs text-gray-500">{isSpanish ? 'Total Asignadas' : 'Total Assigned'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* COLUMNA DERECHA: Áreas y configuración */}
          {/* ============================================================ */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Áreas de especialización */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif text-xl font-bold text-gray-800">
                  {isSpanish ? 'Áreas de Especialización' : 'Areas of Expertise'}
                </h3>
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#004b87] bg-[#004b87]/10 rounded-md hover:bg-[#004b87]/20 transition-colors"
                  >
                    <Icons.Edit />
                    {isSpanish ? 'Editar' : 'Edit'}
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleCancel}
                      className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                    >
                      {isSpanish ? 'Cancelar' : 'Cancel'}
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white bg-[#004b87] rounded-md hover:bg-[#003666] transition-colors disabled:opacity-50"
                    >
                      {saving ? <Icons.Spinner /> : <Icons.Save />}
                      {saving ? (isSpanish ? 'Guardando...' : 'Saving...') : (isSpanish ? 'Guardar' : 'Save')}
                    </button>
                  </div>
                )}
              </div>

              <AreasSelector
                selectedAreas={isEditing ? editForm.areasOfExpertise : (reviewerData?.areasOfExpertise || [])}
                onChange={(areas) => setEditForm(prev => ({ ...prev, areasOfExpertise: areas }))}
                isEditing={isEditing}
                language={language}
              />
            </div>

            {/* Configuración de disponibilidad */}
            {isEditing && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
              >
                <h3 className="font-serif text-xl font-bold text-gray-800 mb-6">
                  {isSpanish ? 'Configuración de Disponibilidad' : 'Availability Settings'}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                      {isSpanish ? 'Máximo de revisiones activas' : 'Max active reviews'}
                    </label>
                    <select
                      value={editForm.maxActiveReviews}
                      onChange={(e) => setEditForm(prev => ({ ...prev, maxActiveReviews: parseInt(e.target.value) }))}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-[#004b87] focus:border-transparent"
                    >
                      {[1, 2, 3, 4, 5].map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                      {isSpanish ? 'Idioma preferido' : 'Preferred language'}
                    </label>
                    <select
                      value={editForm.preferredLanguage}
                      onChange={(e) => setEditForm(prev => ({ ...prev, preferredLanguage: e.target.value }))}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-[#004b87] focus:border-transparent"
                    >
                      <option value="es">Español</option>
                      <option value="en">English</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                      {isSpanish ? 'Tiempo disponible por revisión' : 'Time per review'}
                    </label>
                    <select
                      value={editForm.timeAvailablePerReview}
                      onChange={(e) => setEditForm(prev => ({ ...prev, timeAvailablePerReview: e.target.value }))}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-[#004b87] focus:border-transparent"
                    >
                      <option value="1-week">{isSpanish ? '1 semana' : '1 week'}</option>
                      <option value="2-weeks">{isSpanish ? '2 semanas' : '2 weeks'}</option>
                      <option value="3-weeks">{isSpanish ? '3 semanas' : '3 weeks'}</option>
                      <option value="1-month">{isSpanish ? '1 mes' : '1 month'}</option>
                    </select>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="font-sans font-bold text-xs uppercase tracking-wider text-gray-500 mb-4">
                    {isSpanish ? 'Información de contacto' : 'Contact Information'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        {isSpanish ? 'Email público' : 'Public email'}
                      </label>
                      <input
                        type="email"
                        value={editForm.publicEmail}
                        onChange={(e) => setEditForm(prev => ({ ...prev, publicEmail: e.target.value }))}
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-[#004b87] focus:border-transparent"
                        placeholder="email@ejemplo.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        {isSpanish ? 'Institución' : 'Institution'}
                      </label>
                      <input
                        type="text"
                        value={editForm.institution}
                        onChange={(e) => setEditForm(prev => ({ ...prev, institution: e.target.value }))}
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-[#004b87] focus:border-transparent"
                        placeholder={isSpanish ? 'Universidad / Organización' : 'University / Organization'}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">ORCID</label>
                      <input
                        type="text"
                        value={editForm.orcid}
                        onChange={(e) => setEditForm(prev => ({ ...prev, orcid: e.target.value }))}
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-md text-sm font-mono focus:ring-2 focus:ring-[#004b87] focus:border-transparent"
                        placeholder="0000-0000-0000-0000"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Vista de solo lectura de configuración */}
            {!isEditing && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="font-serif text-lg font-bold text-gray-800 mb-4">
                  {isSpanish ? 'Configuración Actual' : 'Current Settings'}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-gray-400 uppercase">{isSpanish ? 'Máx. activas' : 'Max active'}</span>
                    <p className="font-bold text-gray-700">{reviewerData?.availability?.maxActiveReviews || 3}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 uppercase">{isSpanish ? 'Idioma' : 'Language'}</span>
                    <p className="font-bold text-gray-700">
                      {reviewerData?.availability?.preferredLanguage === 'en' ? 'English' : 'Español'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 uppercase">{isSpanish ? 'Tiempo/revisión' : 'Time/review'}</span>
                    <p className="font-bold text-gray-700">
                      {reviewerData?.availability?.timeAvailablePerReview === '1-week' ? (isSpanish ? '1 semana' : '1 week') :
                       reviewerData?.availability?.timeAvailablePerReview === '2-weeks' ? (isSpanish ? '2 semanas' : '2 weeks') :
                       reviewerData?.availability?.timeAvailablePerReview === '3-weeks' ? (isSpanish ? '3 semanas' : '3 weeks') :
                       reviewerData?.availability?.timeAvailablePerReview === '1-month' ? (isSpanish ? '1 mes' : '1 month') :
                       '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 uppercase">ORCID</span>
                    <p className="font-bold text-gray-700 font-mono text-xs">
                      {reviewerData?.orcid || '—'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}