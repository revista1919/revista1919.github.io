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
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-4.5H9m3.75 9H9m6.75-13.5H15m-3 13.5h6.75" />
    </svg>
  ),
  ArrowRight: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  ),
  Clock: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  CheckCircle: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  AlertTriangle: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  FileText: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  Trash: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  Edit: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.89 1.147l-3.148.868a.375.375 0 01-.465-.465l.868-3.148a4.5 4.5 0 011.147-1.89L16.862 4.487zM16.862 4.487L19.5 7.125" />
    </svg>
  ),
  ChevronRight: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  ),
  Inbox: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
  ),
  Send: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
   ESTADOS DE SUBMISSION (PALETA ACADÉMICA ESTRICTA)
================================ */
const SUBMISSION_STATES = {
  'submitted': { 
    es: 'Enviado', en: 'Submitted',
    theme: 'text-[#002147] border-[#002147] bg-white',
    icon: <EditorialIcons.Send />
  },
  'in-editorial-review': { 
    es: 'Revisión Editorial', en: 'Desk Review',
    theme: 'text-[#002147] border-[#002147] bg-white',
    icon: <EditorialIcons.FileText />
  },
  'in-peer-review': { 
    es: 'Revisión por Pares', en: 'Peer Review',
    theme: 'text-[#002147] border-[#002147] bg-white',
    icon: <EditorialIcons.Edit />
  },
  'revisions-requested': { 
    es: 'Requiere Revisiones', en: 'Revisions Required',
    theme: 'bg-[#8B0000] text-white border-[#8B0000]',
    icon: <EditorialIcons.AlertTriangle />
  },
  'accepted': { 
    es: 'Aceptado', en: 'Accepted',
    theme: 'bg-[#004d00] text-white border-[#004d00]',
    icon: <EditorialIcons.CheckCircle />
  },
  'rejected': { 
    es: 'Rechazado', en: 'Rejected',
    theme: 'text-[#8B0000] border-[#8B0000] bg-white',
    icon: <EditorialIcons.AlertTriangle />
  },
  'awaiting-editor-decision': { 
    es: 'Decisión Pendiente', en: 'Pending Decision',
    theme: 'text-[#002147] border-[#002147] bg-white',
    icon: <EditorialIcons.Clock />
  },
  'minor-revision-required': { 
    es: 'Revisión Menor', en: 'Minor Revision',
    theme: 'bg-[#8B0000] text-white border-[#8B0000]',
    icon: <EditorialIcons.Edit />
  },
  'major-revision-required': { 
    es: 'Revisión Mayor', en: 'Major Revision',
    theme: 'bg-[#8B0000] text-white border-[#8B0000]',
    icon: <EditorialIcons.AlertTriangle />
  },
  'awaiting-revision': { 
    es: 'Esperando Corrección', en: 'Awaiting Correction',
    theme: 'bg-[#8B0000] text-white border-[#8B0000]',
    icon: <EditorialIcons.Clock />
  },
  'desk-review-rejected': { 
    es: 'Rechazo Editorial', en: 'Desk Reject',
    theme: 'text-[#8B0000] border-[#8B0000] bg-white',
    icon: <EditorialIcons.AlertTriangle />
  },
  'in-reviewer-selection': { 
    es: 'Asignando Revisores', en: 'Assigning Reviewers',
    theme: 'text-[#002147] border-[#002147] bg-white',
    icon: <EditorialIcons.Inbox />
  },
  'awaiting-reviewer-responses': { 
    es: 'Invitaciones Enviadas', en: 'Invitations Sent',
    theme: 'text-[#002147] border-[#002147] bg-white',
    icon: <EditorialIcons.Clock />
  },
  'metadata_refinement_pending': { 
    es: 'Ajuste de Metadatos', en: 'Metadata Refinement',
    theme: 'bg-[#8B0000] text-white border-[#8B0000]',
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
      navigate(isSpanish ? '/login/submissions' : '/en/login/submissions');
    }
  };

  const handleContinueDraft = (draft) => {
    if (onNavigateToForm) {
      onNavigateToForm(draft);
    } else {
      navigate(isSpanish ? '/login/submissions' : '/en/login/submissions', { 
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
  
  // Si hay un submission seleccionado, mostrar el panel detallado A PANTALLA COMPLETA
  if (selectedSubmissionId) {
    return (
      <div className="fixed inset-0 z-50 bg-[#FAFAFA] overflow-y-auto">
        <AuthorSubmissionsPanel 
          user={user} 
          submissionId={selectedSubmissionId}
          onBack={handleBackToDashboard}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center font-['Inter',sans-serif]">
        <div className="flex flex-col items-center p-12">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-[#002147] rounded-full animate-spin" />
          <p className="mt-6 text-[#1a1a1a] font-bold text-[10px] tracking-[0.2em] uppercase">
            {isSpanish ? 'Sincronizando registros...' : 'Synchronizing records...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-['Inter',sans-serif] text-[#1a1a1a]">
      <div className="max-w-[1200px] mx-auto px-6 py-12">
        
        {/* ================================
            HEADER EDITORIAL "PORTADA"
        ================================ */}
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between border-b-2 border-[#1a1a1a] pb-6 gap-6">
          <div>
            <div className="uppercase tracking-[0.2em] text-[10px] font-bold text-gray-500 mb-3">
              {isSpanish ? 'Registro de Investigador' : 'Investigator Registry'} • {user?.displayName || user?.email}
            </div>
            <h1 className="font-['Lora',serif] text-4xl md:text-5xl text-[#002147] tracking-tight">
              {isSpanish ? 'Manuscritos & Envíos' : 'Manuscripts & Submissions'}
            </h1>
          </div>
          
          <button
            onClick={handleNewSubmission}
            className="bg-[#002147] hover:bg-black text-white px-8 py-3.5 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors flex items-center gap-3 shrink-0"
          >
            <EditorialIcons.DocumentPlus />
            {isSpanish ? 'Nuevo Manuscrito' : 'New Manuscript'}
          </button>
        </header>

        {/* ================================
            MÉTRICAS (FRANJA DE DATOS)
        ================================ */}
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-gray-300 border-y border-gray-300 bg-white mb-16">
          
          {/* Borradores */}
          <div className="p-6 flex flex-col justify-center">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-2">
              {isSpanish ? 'Borradores' : 'Drafts'}
            </span>
            <p className="font-['Lora',serif] text-3xl text-[#1a1a1a]">{metrics.totalDrafts}</p>
          </div>

          {/* Enviados */}
          <div className="p-6 flex flex-col justify-center">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-2">
              {isSpanish ? 'Enviados' : 'Submitted'}
            </span>
            <p className="font-['Lora',serif] text-3xl text-[#1a1a1a]">{metrics.totalSubmissions}</p>
          </div>

          {/* En Revisión */}
          <div className="p-6 flex flex-col justify-center">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#002147] mb-2">
              {isSpanish ? 'En Revisión' : 'In Review'}
            </span>
            <p className="font-['Lora',serif] text-3xl text-[#002147]">{metrics.inReview}</p>
          </div>

          {/* Acción Requerida */}
          <div className={`p-6 flex flex-col justify-center ${metrics.actionRequired > 0 ? 'bg-[#8B0000]/5' : ''}`}>
            <span className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-2 ${metrics.actionRequired > 0 ? 'text-[#8B0000]' : 'text-gray-400'}`}>
              {isSpanish ? 'Atención Requerida' : 'Action Required'}
            </span>
            <p className={`font-['Lora',serif] text-3xl ${metrics.actionRequired > 0 ? 'text-[#8B0000]' : 'text-[#1a1a1a]'}`}>
              {metrics.actionRequired}
            </p>
          </div>

        </div>

        {/* ================================
            SECCIÓN: BORRADORES (DRAFTS)
        ================================ */}
        <section className="mb-20">
          <div className="border-b border-gray-300 pb-2 mb-6">
            <h2 className="font-['Lora',serif] text-2xl text-[#1a1a1a]">
              {isSpanish ? 'Borradores Activos' : 'Active Drafts'}
            </h2>
          </div>

          {drafts.length === 0 ? (
            <div className="bg-white border border-gray-200 p-12 text-center">
              <div className="text-gray-300 mb-4 flex justify-center">
                <EditorialIcons.FolderPlus />
              </div>
              <p className="font-['Lora',serif] text-lg text-gray-400 italic">
                {isSpanish ? 'No existen borradores en progreso.' : 'No drafts in progress.'}
              </p>
              <p className="text-sm text-gray-400 mt-2">
                {isSpanish 
                  ? 'Inicie un nuevo envío y su progreso se guardará automáticamente.'
                  : 'Start a new submission and your progress will be saved automatically.'}
              </p>
              <button
                onClick={handleNewSubmission}
                className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-[#002147] hover:bg-black text-white text-[10px] font-bold uppercase tracking-[0.2em] transition-colors"
              >
                <EditorialIcons.DocumentPlus />
                {isSpanish ? 'Crear Borrador' : 'Create Draft'}
              </button>
            </div>
          ) : (
            <div className="bg-white border border-gray-300 divide-y divide-gray-200">
              {drafts.map((draft) => (
                <motion.div
                  key={draft.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 flex flex-col md:flex-row md:items-center gap-6 hover:bg-gray-50 transition-colors"
                >
                  
                  {/* Meta izquierda */}
                  <div className="md:w-1/4 flex-shrink-0 flex flex-col gap-2">
                    <span className="inline-block border border-gray-300 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-gray-500 w-fit">
                      {isSpanish ? 'Borrador' : 'Draft'}
                    </span>
                    <span className="text-xs text-gray-500 flex items-center gap-1.5">
                      <EditorialIcons.Clock />
                      {formatRelativeTime(draft.updatedAt, isSpanish)}
                    </span>
                    <span className="text-[10px] font-mono text-gray-400">
                      ID: {draft.id.substring(0, 8)}
                    </span>
                  </div>

                  {/* Título Centro */}
                  <div className="flex-1">
                    <h3 className="font-['Lora',serif] text-xl text-[#002147] mb-2 leading-tight">
                      {draft.title || (isSpanish ? '[Sin título asignado]' : '[Untitled]')}
                    </h3>
                    <div className="flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500">
                      <span>{isSpanish ? 'Paso:' : 'Step:'} {getStepLabel(draft.currentStep, isSpanish)}</span>
                      {draft.area && <span>• {draft.area}</span>}
                    </div>
                  </div>

                  {/* Acciones Derecha */}
                  <div className="md:w-auto flex-shrink-0 flex items-center gap-4 border-t md:border-t-0 pt-4 md:pt-0 border-gray-200">
                    <button
                      onClick={() => handleContinueDraft(draft)}
                      className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#002147] hover:underline underline-offset-4 flex items-center gap-2"
                    >
                      {isSpanish ? 'Continuar' : 'Continue'} <EditorialIcons.ArrowRight />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(draft.id)}
                      className="text-gray-400 hover:text-[#8B0000] transition-colors p-2"
                      title={isSpanish ? 'Descartar' : 'Discard'}
                    >
                      <EditorialIcons.Trash />
                    </button>
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
          <div className="border-b border-gray-300 pb-2 mb-6">
            <h2 className="font-['Lora',serif] text-2xl text-[#1a1a1a]">
              {isSpanish ? 'Historial de Envíos' : 'Submission History'}
            </h2>
          </div>

          {submissions.length === 0 ? (
            <div className="bg-white border border-gray-200 p-12 text-center">
              <div className="text-gray-300 mb-4 flex justify-center">
                <EditorialIcons.Send />
              </div>
              <p className="font-['Lora',serif] text-lg text-gray-400 italic">
                {isSpanish ? 'Aún no se han registrado envíos formales.' : 'No formal submissions recorded yet.'}
              </p>
              <p className="text-sm text-gray-400 mt-2">
                {isSpanish 
                  ? 'Cuando envíe su primer manuscrito, aparecerá aquí.'
                  : 'When you submit your first manuscript, it will appear here.'}
              </p>
            </div>
          ) : (
            <div className="bg-white border border-gray-300 divide-y divide-gray-200">
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
                    className="group p-6 flex flex-col md:flex-row md:items-center gap-6 hover:bg-gray-50 transition-colors cursor-pointer border-l-4 border-transparent hover:border-l-[#002147]"
                  >
                    {/* Meta izquierda */}
                    <div className="md:w-1/4 flex-shrink-0 flex flex-col gap-2">
                      <span className={`inline-flex items-center gap-2 border px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.2em] w-fit ${statusInfo.theme}`}>
                        <span className="flex-shrink-0">
                          {statusInfo.icon}
                        </span>
                        {statusInfo[language]}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center gap-1.5">
                        <EditorialIcons.Clock />
                        {formatRelativeTime(sub.createdAt, isSpanish)}
                      </span>
                      <span className="text-[10px] font-mono text-gray-400">
                        REF: {sub.submissionId || sub.id.substring(0, 8)}
                      </span>
                    </div>

                    {/* Título Centro */}
                    <div className="flex-1">
                      <h3 className="font-['Lora',serif] text-xl text-[#1a1a1a] group-hover:text-[#002147] transition-colors mb-2 leading-tight">
                        {sub.title}
                      </h3>
                      {requiresAction && (
                        <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8B0000] bg-[#8B0000]/5 px-3 py-1.5">
                          <EditorialIcons.AlertTriangle />
                          {isSpanish ? 'Requiere Atención del Autor' : 'Author Attention Required'}
                        </span>
                      )}
                    </div>

                    {/* Acciones Derecha */}
                    <div className="md:w-auto flex-shrink-0 flex items-center justify-end">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 group-hover:text-[#002147] transition-colors flex items-center gap-2">
                        {isSpanish ? 'Ver Expediente' : 'View File'} 
                        <EditorialIcons.ChevronRight />
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

      </div>

      {/* ================================
          MODAL DE CONFIRMACIÓN (Descartar)
      ================================ */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white max-w-lg w-full p-10 border-t-4 border-[#8B0000] shadow-2xl"
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 bg-[#8B0000]/10 border border-[#8B0000]/30 flex items-center justify-center text-[#8B0000] flex-shrink-0">
                  <EditorialIcons.AlertTriangle />
                </div>
                <div>
                  <h3 className="font-['Lora',serif] text-2xl text-[#1a1a1a] mb-2">
                    {isSpanish ? 'Descartar Manuscrito' : 'Discard Manuscript'}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {isSpanish 
                      ? '¿Está seguro de que desea eliminar este borrador? Esta acción destruirá permanentemente los metadatos y archivos asociados no enviados. Esta acción es irreversible.'
                      : 'Are you sure you want to delete this draft? This will permanently destroy unsent metadata and associated files. This action is irreversible.'}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-3 border border-gray-300 text-[#1a1a1a] text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-gray-50 transition-colors"
                >
                  {isSpanish ? 'Cancelar' : 'Cancel'}
                </button>
                <button
                  onClick={() => handleDeleteDraft(deleteConfirm)}
                  className="flex-1 py-3 bg-[#8B0000] text-white text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-black transition-colors"
                >
                  {isSpanish ? 'Descartar' : 'Discard'}
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