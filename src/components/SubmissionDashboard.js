// src/components/SubmissionDashboard.js
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, onSnapshot, query, collection, where, doc, deleteDoc } from '../firebase';
import { useLanguage } from '../hooks/useLanguage';
import { useNavigate } from 'react-router-dom';
import AuthorSubmissionsPanel from './AuthorSubmissionsPanel';

/* ================================
   ICONOS SVG EDITORIALES (INLINE)
================================ */
const EditorialIcons = {
  DocumentPlus: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-4.5H9m3.75 9H9m6.75-13.5H15m-3 13.5h6.75" />
    </svg>
  ),
  ArrowRight: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  ),
  Clock: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  CheckCircle: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  AlertTriangle: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  FileText: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  Trash: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  Edit: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.89 1.147l-3.148.868a.375.375 0 01-.465-.465l.868-3.148a4.5 4.5 0 011.147-1.89L16.862 4.487zM16.862 4.487L19.5 7.125" />
    </svg>
  ),
  ChevronRight: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  ),
  Inbox: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
  ),
  Send: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  ),
  FolderPlus: () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
};

/* ================================
   ESTADOS DE SUBMISSION
================================ */
const SUBMISSION_STATES = {
  'submitted': { 
    es: 'Enviado', en: 'Submitted',
    color: 'bg-slate-50 text-slate-700 border-slate-200',
    icon: <EditorialIcons.Send />
  },
  'in-editorial-review': { 
    es: 'Revisión Editorial', en: 'Desk Review',
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    icon: <EditorialIcons.FileText />
  },
  'in-peer-review': { 
    es: 'Revisión por Pares', en: 'Peer Review',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: <EditorialIcons.Edit />
  },
  'revisions-requested': { 
    es: 'Requiere Revisiones', en: 'Revisions Required',
    color: 'bg-amber-50 text-amber-700 border-amber-300',
    icon: <EditorialIcons.AlertTriangle />
  },
  'accepted': { 
    es: 'Aceptado', en: 'Accepted',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: <EditorialIcons.CheckCircle />
  },
  'rejected': { 
    es: 'Rechazado', en: 'Rejected',
    color: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: <EditorialIcons.AlertTriangle />
  },
  'awaiting-editor-decision': { 
    es: 'Decisión Pendiente', en: 'Pending Decision',
    color: 'bg-violet-50 text-violet-700 border-violet-200',
    icon: <EditorialIcons.Clock />
  },
  'minor-revision-required': { 
    es: 'Revisión Menor', en: 'Minor Revision',
    color: 'bg-amber-50 text-amber-700 border-amber-300',
    icon: <EditorialIcons.Edit />
  },
  'major-revision-required': { 
    es: 'Revisión Mayor', en: 'Major Revision',
    color: 'bg-orange-50 text-orange-700 border-orange-300',
    icon: <EditorialIcons.AlertTriangle />
  },
  'awaiting-revision': { 
    es: 'Esperando Corrección', en: 'Awaiting Correction',
    color: 'bg-amber-50 text-amber-700 border-amber-300',
    icon: <EditorialIcons.Clock />
  },
  'desk-review-rejected': { 
    es: 'Rechazo Editorial', en: 'Desk Reject',
    color: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: <EditorialIcons.AlertTriangle />
  },
  'in-reviewer-selection': { 
    es: 'Asignando Revisores', en: 'Assigning Reviewers',
    color: 'bg-sky-50 text-sky-700 border-sky-200',
    icon: <EditorialIcons.Inbox />
  },
  'awaiting-reviewer-responses': { 
    es: 'Invitaciones Enviadas', en: 'Invitations Sent',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: <EditorialIcons.Clock />
  },
  'metadata_refinement_pending': { 
    es: 'Ajuste de Metadatos', en: 'Metadata Refinement',
    color: 'bg-teal-50 text-teal-700 border-teal-200',
    icon: <EditorialIcons.Edit />
  }
};

/* ================================
   FUNCIONES AUXILIARES
================================ */
const formatRelativeTime = (timestamp, isSpanish) => {
  if (!timestamp) return '—';
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return isSpanish ? 'Hace un momento' : 'Just now';
  if (diffMins < 60) return isSpanish ? `Hace ${diffMins} min` : `${diffMins} min ago`;
  if (diffHours < 24) return isSpanish ? `Hace ${diffHours} h` : `${diffHours} h ago`;
  if (diffDays < 7) return isSpanish ? `Hace ${diffDays} días` : `${diffDays} days ago`;
  return date.toLocaleDateString(isSpanish ? 'es-ES' : 'en-US', { 
    year: 'numeric', month: 'short', day: 'numeric' 
  });
};

const getStepLabel = (step, isSpanish) => {
  const steps = {
    1: isSpanish ? 'Manuscrito' : 'Manuscript',
    2: isSpanish ? 'Autores' : 'Authors',
    3: isSpanish ? 'Envío' : 'Submission'
  };
  return steps[step] || steps[1];
};

/* ================================
   COMPONENTE PRINCIPAL
================================ */
const SubmissionDashboard = ({ user, onNavigateToForm }) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  const navigate = useNavigate();
  
  const [drafts, setDrafts] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  /* ================================
     CARGA DE DATOS
  ================================ */
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Cargar borradores
    const draftsQuery = query(
      collection(db, 'submissionDrafts'),
      where('authorUID', '==', user.uid),
      where('status', '==', 'draft')
    );

    const unsubDrafts = onSnapshot(draftsQuery, (snapshot) => {
      const draftsData = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        updatedAt: d.data().updatedAt?.toDate?.() || new Date()
      })).sort((a, b) => b.updatedAt - a.updatedAt);
      
      setDrafts(draftsData);
    }, (error) => {
      console.error('Error loading drafts:', error);
    });

    // Cargar submissions enviados
    const submissionsQuery = query(
      collection(db, 'submissions'),
      where('authorUID', '==', user.uid)
    );

    const unsubSubmissions = onSnapshot(submissionsQuery, (snapshot) => {
      const subsData = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
        updatedAt: d.data().updatedAt?.toDate?.() || new Date()
      })).sort((a, b) => b.createdAt - a.createdAt);
      
      setSubmissions(subsData);
      setLoading(false);
    }, (error) => {
      console.error('Error loading submissions:', error);
      setLoading(false);
    });

    return () => {
      unsubDrafts();
      unsubSubmissions();
    };
  }, [user?.uid]);

  /* ================================
     FUNCIONES DE NAVEGACIÓN
  ================================ */
  const handleNewSubmission = () => {
    if (onNavigateToForm) {
      onNavigateToForm(null);
    } else {
      navigate(isSpanish ? '/login/submit' : '/en/login/submit');
    }
  };

  const handleContinueDraft = (draft) => {
    if (onNavigateToForm) {
      onNavigateToForm(draft);
    } else {
      navigate(isSpanish ? '/login/submit' : '/en/login/submit', { 
        state: { draftId: draft.id } 
      });
    }
  };

  const handleDeleteDraft = async (draftId) => {
    try {
      await deleteDoc(doc(db, 'submissionDrafts', draftId));
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting draft:', error);
      alert(isSpanish ? 'Error al eliminar borrador' : 'Error deleting draft');
    }
  };

const handleOpenSubmission = (submission) => {
  setSelectedSubmissionId(submission.id);
};
const handleBackToDashboard = () => {
  setSelectedSubmissionId(null);
};

  /* ================================
     MÉTRICAS DEL DASHBOARD
  ================================ */
  const metrics = {
    totalDrafts: drafts.length,
    totalSubmissions: submissions.length,
    inReview: submissions.filter(s => 
      ['in-editorial-review', 'in-reviewer-selection', 'awaiting-reviewer-responses', 'in-peer-review'].includes(s.status)
    ).length,
    actionRequired: submissions.filter(s => 
      ['revisions-requested', 'minor-revision-required', 'major-revision-required', 'awaiting-revision', 'metadata_refinement_pending'].includes(s.status)
    ).length,
    accepted: submissions.filter(s => s.status === 'accepted').length
  };

  /* ================================
     RENDERIZADO
  ================================ */
  
  // Si hay un submission seleccionado, mostrar el panel detallado
// Si hay un submission seleccionado, mostrar el panel detallado
if (selectedSubmissionId) {
  return (
    <AuthorSubmissionsPanel 
      user={user} 
      submissionId={selectedSubmissionId}
      onBack={handleBackToDashboard}
    />
  );
}

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center font-sans">
        <div className="flex flex-col items-center bg-white p-12 border border-gray-200 border-t-4 border-t-[#004b87]">
          <div className="w-10 h-10 border-2 border-gray-200 border-t-[#004b87] rounded-full animate-spin" />
          <p className="mt-6 text-[#004b87] font-medium text-xs tracking-wide">
            {isSpanish ? 'Accediendo al Panel de Envíos...' : 'Accessing Submission Dashboard...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      
      {/* ================================
          HEADER EDITORIAL
      ================================ */}
      <header className="mb-0">
        {/* Top utility bar */}
        <div className="flex justify-end items-center py-2 text-[11px] font-sans text-gray-500 gap-6 border-b border-gray-200 px-6 lg:px-12">
          <div className="flex items-center gap-2">
            <span>{isSpanish ? 'Investigador / Usuario:' : 'Researcher / User:'}</span>
            <span className="font-medium text-gray-800">{user?.displayName || user?.email}</span>
          </div>
        </div>

        {/* Brand Area */}
        <div className="py-10 flex flex-col md:flex-row md:items-end justify-between gap-6 px-6 lg:px-12 border-b-2 border-black">
          <div>
            <div className="uppercase tracking-wide text-[10px] font-medium text-gray-500 mb-3">
              {isSpanish ? 'Sistema de Gestión Editorial' : 'Editorial Management System'}
            </div>
            <h1 className="font-serif text-4xl md:text-5xl text-black tracking-tight mb-2">
              {isSpanish ? 'Panel de Envíos' : 'Submission Dashboard'}
            </h1>
            <p className="font-serif text-lg text-gray-600 italic">
              {isSpanish ? 'Gestión de Manuscritos y Borradores' : 'Manuscript and Draft Management'}
            </p>
          </div>
          
          <button
            onClick={handleNewSubmission}
            className="bg-[#004b87] hover:bg-black text-white px-8 py-3.5 text-xs font-medium uppercase tracking-wide transition-colors flex items-center gap-3 rounded-none shadow-sm"
          >
            <EditorialIcons.DocumentPlus />
            {isSpanish ? 'Iniciar Nuevo Envío' : 'Start New Submission'}
          </button>
        </div>
      </header>

      {/* ================================
          MÉTRICAS RÁPIDAS
      ================================ */}
      <div className="px-6 lg:px-12 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {/* Borradores */}
          <div className="bg-white border border-gray-300 border-t-4 border-t-[#004b87] p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                {isSpanish ? 'Borradores' : 'Drafts'}
              </span>
              <span className="text-[#004b87]">
                <EditorialIcons.FileText />
              </span>
            </div>
            <p className="font-serif text-4xl text-black mb-1">{metrics.totalDrafts}</p>
            <p className="text-xs text-gray-500">
              {isSpanish ? 'En progreso' : 'In progress'}
            </p>
          </div>

          {/* Enviados */}
          <div className="bg-white border border-gray-300 border-t-4 border-t-[#004b87] p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                {isSpanish ? 'Enviados' : 'Submitted'}
              </span>
              <span className="text-[#004b87]">
                <EditorialIcons.Send />
              </span>
            </div>
            <p className="font-serif text-4xl text-black mb-1">{metrics.totalSubmissions}</p>
            <p className="text-xs text-gray-500">
              {isSpanish ? 'Manuscritos enviados' : 'Manuscripts submitted'}
            </p>
          </div>

          {/* En revisión */}
          <div className="bg-white border border-gray-300 border-t-4 border-t-[#004b87] p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                {isSpanish ? 'En Revisión' : 'In Review'}
              </span>
              <span className="text-[#004b87]">
                <EditorialIcons.Clock />
              </span>
            </div>
            <p className="font-serif text-4xl text-black mb-1">{metrics.inReview}</p>
            <p className="text-xs text-gray-500">
              {isSpanish ? 'En evaluación' : 'Under evaluation'}
            </p>
          </div>

          {/* Acción requerida */}
          <div className={`bg-white border p-6 ${
            metrics.actionRequired > 0 
              ? 'border-amber-400 border-t-4 border-t-amber-500' 
              : 'border-gray-300 border-t-4 border-t-[#004b87]'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                {isSpanish ? 'Acción Requerida' : 'Action Required'}
              </span>
              <span className={metrics.actionRequired > 0 ? 'text-amber-600' : 'text-[#004b87]'}>
                <EditorialIcons.AlertTriangle />
              </span>
            </div>
            <p className={`font-serif text-4xl mb-1 ${metrics.actionRequired > 0 ? 'text-amber-700' : 'text-black'}`}>
              {metrics.actionRequired}
            </p>
            <p className="text-xs text-gray-500">
              {isSpanish ? 'Requieren su atención' : 'Require your attention'}
            </p>
          </div>
        </div>

        {/* ================================
            SECCIÓN: BORRADORES
        ================================ */}
        <section className="mb-16">
          <div className="flex items-center justify-between mb-6 border-b border-gray-200 pb-4">
            <div>
              <h2 className="font-serif text-2xl text-black flex items-center gap-3">
                <EditorialIcons.FileText />
                {isSpanish ? 'Borradores en Progreso' : 'Drafts in Progress'}
              </h2>
              <p className="text-xs text-gray-500 mt-1 font-sans">
                {isSpanish 
                  ? 'Manuscritos no enviados. Continúe donde lo dejó.'
                  : 'Unsubmitted manuscripts. Continue where you left off.'}
              </p>
            </div>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1">
              {drafts.length} {isSpanish ? 'borradores' : 'drafts'}
            </span>
          </div>

          {drafts.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-gray-300 p-12 text-center">
              <div className="text-gray-300 mb-4">
                <EditorialIcons.FolderPlus />
              </div>
              <p className="font-serif text-lg text-gray-400 italic">
                {isSpanish ? 'No hay borradores activos.' : 'No active drafts.'}
              </p>
              <p className="text-sm text-gray-400 mt-2 font-sans">
                {isSpanish 
                  ? 'Inicie un nuevo envío y su progreso se guardará automáticamente.'
                  : 'Start a new submission and your progress will be saved automatically.'}
              </p>
              <button
                onClick={handleNewSubmission}
                className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-[#004b87] hover:bg-black text-white text-xs font-medium uppercase tracking-wide transition-colors"
              >
                <EditorialIcons.DocumentPlus />
                {isSpanish ? 'Crear Borrador' : 'Create Draft'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {drafts.map((draft) => (
                <motion.div
                  key={draft.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -2 }}
                  className="bg-white border border-gray-300 hover:border-[#004b87] transition-colors shadow-sm flex flex-col"
                >
                  <div className="p-6 flex-1 flex flex-col">
                    {/* Estado del borrador */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="px-2.5 py-1 bg-gray-50 border border-gray-200 text-[10px] font-medium uppercase tracking-wider text-gray-500">
                        {isSpanish ? 'Borrador' : 'Draft'}
                      </span>
                      <span className="text-[10px] text-gray-400 font-sans">
                        {formatRelativeTime(draft.updatedAt, isSpanish)}
                      </span>
                    </div>

                    {/* Título */}
                    <h3 className="font-serif text-lg text-black mb-2 line-clamp-2 flex-1">
                      {draft.title || (isSpanish ? 'Sin título' : 'Untitled')}
                    </h3>

                    {/* Paso actual */}
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                        {isSpanish ? 'Paso actual:' : 'Current step:'}
                      </span>
                      <span className="text-[10px] font-bold text-[#004b87] uppercase tracking-wider">
                        {getStepLabel(draft.currentStep, isSpanish)}
                      </span>
                    </div>

                    {/* Área temática */}
                    {draft.area && (
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-[10px] text-gray-500">
                          {draft.area}
                        </span>
                      </div>
                    )}

                    {/* Acciones */}
                    <div className="pt-4 border-t border-gray-100 flex items-center gap-3">
                      <button
                        onClick={() => handleContinueDraft(draft)}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#004b87] hover:bg-black text-white text-[11px] font-medium uppercase tracking-wide transition-colors"
                      >
                        {isSpanish ? 'Continuar' : 'Continue'}
                        <EditorialIcons.ArrowRight />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(draft.id)}
                        className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors border border-gray-200"
                        title={isSpanish ? 'Eliminar borrador' : 'Delete draft'}
                      >
                        <EditorialIcons.Trash />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* ================================
            SECCIÓN: SUBMISSIONS ENVIADOS
        ================================ */}
        <section>
          <div className="flex items-center justify-between mb-6 border-b border-gray-200 pb-4">
            <div>
              <h2 className="font-serif text-2xl text-black flex items-center gap-3">
                <EditorialIcons.Inbox />
                {isSpanish ? 'Manuscritos Enviados' : 'Submitted Manuscripts'}
              </h2>
              <p className="text-xs text-gray-500 mt-1 font-sans">
                {isSpanish 
                  ? 'Seguimiento del proceso editorial de sus envíos.'
                  : 'Track the editorial process of your submissions.'}
              </p>
            </div>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1">
              {submissions.length} {isSpanish ? 'envíos' : 'submissions'}
            </span>
          </div>

          {submissions.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-gray-300 p-12 text-center">
              <div className="text-gray-300 mb-4">
                <EditorialIcons.Send />
              </div>
              <p className="font-serif text-lg text-gray-400 italic">
                {isSpanish ? 'No hay manuscritos enviados.' : 'No submitted manuscripts.'}
              </p>
              <p className="text-sm text-gray-400 mt-2 font-sans">
                {isSpanish 
                  ? 'Cuando envíe su primer manuscrito, aparecerá aquí.'
                  : 'When you submit your first manuscript, it will appear here.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {submissions.map((sub) => {
                const statusInfo = SUBMISSION_STATES[sub.status] || SUBMISSION_STATES.submitted;
                const requiresAction = ['revisions-requested', 'minor-revision-required', 'major-revision-required', 'awaiting-revision', 'metadata_refinement_pending'].includes(sub.status);
                
                return (
                  <motion.div
                    key={sub.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ x: 2 }}
                    onClick={() => handleOpenSubmission(sub)}
                    className={`bg-white border cursor-pointer transition-all shadow-sm ${
                      requiresAction 
                        ? 'border-amber-400 border-l-4 border-l-amber-500' 
                        : 'border-gray-300 border-l-4 border-l-[#004b87] hover:border-[#004b87]'
                    }`}
                  >
                    <div className="p-6 flex flex-col sm:flex-row sm:items-center gap-4">
                      {/* Icono de estado */}
                      <div className={`w-12 h-12 flex items-center justify-center border flex-shrink-0 ${statusInfo.color}`}>
                        {statusInfo.icon}
                      </div>

                      {/* Información principal */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">
                            ID: {sub.submissionId || sub.id.substring(0, 8)}
                          </span>
                          {requiresAction && (
                            <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                              {isSpanish ? 'Acción Requerida' : 'Action Required'}
                            </span>
                          )}
                        </div>
                        <h3 className="font-serif text-lg text-black leading-snug line-clamp-2">
                          {sub.title}
                        </h3>
                      </div>

                      {/* Estado y fecha */}
                      <div className="flex flex-col items-start sm:items-end gap-2 flex-shrink-0">
                        <span className={`px-3 py-1 text-[10px] font-medium uppercase tracking-wider border ${statusInfo.color}`}>
                          {statusInfo[language]}
                        </span>
                        <span className="text-[10px] text-gray-400 font-sans flex items-center gap-1.5">
                          <EditorialIcons.Clock />
                          {formatRelativeTime(sub.createdAt, isSpanish)}
                        </span>
                      </div>

                      {/* Flecha */}
                      <div className="text-gray-300 flex-shrink-0">
                        <EditorialIcons.ChevronRight />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ================================
          MODAL DE CONFIRMACIÓN DE ELIMINACIÓN
      ================================ */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-none shadow-2xl max-w-md w-full p-8 font-sans border-t-4 border-t-red-600"
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 bg-red-50 border border-red-200 flex items-center justify-center text-red-600 flex-shrink-0">
                  <EditorialIcons.AlertTriangle />
                </div>
                <div>
                  <h3 className="font-serif text-xl font-bold text-black mb-2">
                    {isSpanish ? 'Eliminar Borrador' : 'Delete Draft'}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {isSpanish 
                      ? 'Esta acción no se puede deshacer. Todo el progreso no enviado se perderá permanentemente.'
                      : 'This action cannot be undone. All unsent progress will be permanently lost.'}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => handleDeleteDraft(deleteConfirm)}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-medium text-xs uppercase tracking-wide transition-colors"
                >
                  {isSpanish ? 'Eliminar Permanentemente' : 'Delete Permanently'}
                </button>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-3 border border-gray-300 hover:bg-gray-50 font-medium text-xs uppercase tracking-wide transition-colors text-gray-700"
                >
                  {isSpanish ? 'Cancelar' : 'Cancel'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SubmissionDashboard;