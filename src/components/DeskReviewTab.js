// src/components/DeskReviewTab.js
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import { useEditorialReview } from '../hooks/useEditorialReview';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { ReviewerManagementTab } from './ReviewerManagementTab';
import { FinalDecisionTab } from './FinalDecisionTab';
import { MetadataRefinementTab } from './MetadataRefinementTab';
import { getRecommendedReviewers } from '../hooks/reviewerRecommendationEngine';

// ============ ICONOS SVG PROFESIONALES ============
const Icons = {
  User: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Users: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  DocumentText: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Tag: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>,
  Scale: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>,
  Child: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Chip: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>,
  Database: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>,
  Cash: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  Warning: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  Heart: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>,
  Ban: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
  CheckCircle: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Message: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>,
  File: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
  Download: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  ExternalLink: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>,
  Shield: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  ArrowLeft: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
  Eye: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
  Edit: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  ClipboardCheck: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  Refresh: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
};

// Componente auxiliar para etiquetas de estado booleanas
const StatusBadge = ({ condition, trueLabel, trueColor, falseLabel, falseColor }) => {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[10px] font-sans font-bold uppercase tracking-wider border ${
      condition ? trueColor : falseColor
    }`}>
      {condition ? <Icons.CheckCircle /> : <Icons.Ban />}
      {condition ? trueLabel : falseLabel}
    </span>
  );
};

// Componente para cada bloque de información estilo panel moderno
const InfoBlock = ({ icon: Icon, title, children, className = '' }) => (
  <div className={`bg-white rounded-sm border border-gray-200 shadow-sm ${className}`}>
  <div className="bg-slate-50 px-3 sm:px-5 py-2.5 sm:py-3 border-b border-gray-200 flex items-center gap-2">
      {Icon && <span className="text-[#003b5c]"><Icon /></span>}
      <h3 className="font-sans font-bold text-slate-800 text-xs uppercase tracking-wider">
        {title}
      </h3>
    </div>
    <div className="p-3 sm:p-5">
      {children}
    </div>
  </div>
);

// Campo individual dentro de un InfoBlock
const InfoField = ({ label, value, className = '' }) => (
  <div className={`${className}`}>
    <label className="block text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400 mb-1">
      {label}
    </label>
    <div className="text-slate-800 text-sm font-serif leading-relaxed">
      {value || <span className="text-slate-400 italic">No especificado</span>}
    </div>
  </div>
);

export const DeskReviewTab = ({ 
  task, 
  user, 
  onComplete, 
  loading: externalLoading, 
  onBackToPanel,
  // Nuevas props para pestañas integradas
  invitations = [],
  potentialReviewers = [],
  selectedReviewerId = '',
  setSelectedReviewerId = () => {},
  searchTerm = '',
  setSearchTerm = () => {},
  onSendInvitation = () => {},
  onProceedToDecision = () => {},
  inviteLoading = false,
  isConsolidating = false,
  submittedReviews = [],
  reviewers = [],
  isConsolidated = false,
  onFinalDecision = () => {}
}) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  
  // Estados para el formulario
  const [decision, setDecision] = useState('');
  const [feedback, setFeedback] = useState('');
  const [internalComments, setInternalComments] = useState('');
  
  // Estados para datos adicionales
  const [editorialReview, setEditorialReview] = useState(null);
  const [loadingReview, setLoadingReview] = useState(false);
  const [latestRevisionUrl, setLatestRevisionUrl] = useState(null);
  const [latestRevisionComment, setLatestRevisionComment] = useState(null);
  const [latestRevisionNotes, setLatestRevisionNotes] = useState('');
  
  // Estado para controlar la pestaña activa
  const [activeTab, setActiveTab] = useState('review');
  
  // ===== DEBUG: Verificar props recibidas =====
  useEffect(() => {
    console.log('=== DESK REVIEW TAB - PROPS RECIBIDAS ===');
    console.log('task:', task);
    console.log('task?.submission:', task?.submission);
    console.log('task?.submission?.area:', task?.submission?.area);
    console.log('task?.area:', task?.area);
    console.log('articleArea (submission.area):', task?.submission?.area);
    console.log('potentialReviewers count:', potentialReviewers?.length);
    console.log('invitations count:', invitations?.length);
    console.log('==========================================');
  }, [task, potentialReviewers, invitations]);
  // ===== FIN DEBUG =====
  
  const { loading: hookLoading, error, submitDeskReviewDecision } = useEditorialReview(user);
  const submission = task.submission || {};
  const isLoading = externalLoading || hookLoading || loadingReview;

  // Cargar la revisión editorial
  useEffect(() => {
    const loadEditorialReview = async () => {
      if (!task.editorialReviewId) return;
      setLoadingReview(true);
      try {
        const reviewSnap = await getDoc(doc(db, 'editorialReviews', task.editorialReviewId));
        if (reviewSnap.exists()) {
          const data = reviewSnap.data();
          setEditorialReview(data);
          setDecision(data.decision || '');
          setFeedback(data.feedbackToAuthor || '');
          setInternalComments(data.commentsToEditorial || '');
        }
      } catch (error) {
        console.error('Error loading editorial review:', error);
      } finally {
        setLoadingReview(false);
      }
    };
    loadEditorialReview();
  }, [task.editorialReviewId]);

useEffect(() => {
    let cancelled = false;
    const fetchLatestRevision = async () => {
      if (!task.submissionId) return;
      try {
        const versionsRef = collection(db, 'submissions', task.submissionId, 'versions');
        const q = query(versionsRef, where('type', '==', 'revision'), orderBy('uploadedAt', 'desc'), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty && !cancelled) {
          const data = snapshot.docs[0].data();
          setLatestRevisionUrl(data.fileUrl);
          setLatestRevisionComment(data.revisionComment || null);
          setLatestRevisionNotes(data.notes || '');
        }
      } catch (error) {
        if (!cancelled) console.error('Error fetching latest revision:', error);
      }
    };
    fetchLatestRevision();
    return () => { cancelled = true; };
  }, [task.submissionId]);

  const handleSubmit = async () => {
    try {
      if (!decision) {
        alert(isSpanish ? 'Debes seleccionar una decisión' : 'You must select a decision');
        return;
      }

      if (!task.editorialReviewId) {
        alert(isSpanish ? 'Error: ID de revisión no encontrado' : 'Error: Review ID not found');
        return;
      }

      const decisionData = { decision, feedbackToAuthor: feedback, commentsToEditorial: internalComments };
      const result = await submitDeskReviewDecision(task.editorialReviewId, decisionData);
      
      if (result.success) {
        if (onComplete) onComplete({ decision, feedback, internalComments, reviewId: task.editorialReviewId });
        alert(result.message || (isSpanish ? 'Decisión guardada exitosamente' : 'Decision saved successfully'));
      } else {
        alert(result.error || (isSpanish ? 'Error al guardar la decisión' : 'Error saving decision'));
      }
    } catch (err) {
      console.error('Error in handleSubmit:', err);
      alert(isSpanish ? 'Error al procesar la solicitud' : 'Error processing request');
    }
  };

  const translateAvailability = (value) => {
    const translations = {
      public_repo: isSpanish ? 'Repositorio público' : 'Public repository',
      supplementary: isSpanish ? 'Material suplementario' : 'Supplementary material',
      upon_request: isSpanish ? 'Bajo solicitud razonable' : 'Upon reasonable request',
      not_available: isSpanish ? 'No disponible' : 'Not available',
      not_applicable: isSpanish ? 'No aplica' : 'Not applicable',
    };
    return translations[value] || value || '—';
  };

  const translateArticleType = (value) => {
    const translations = {
      research: isSpanish ? 'Investigación Original' : 'Original Research',
      review: isSpanish ? 'Revisión Sistemática' : 'Systematic Review',
      essay: isSpanish ? 'Ensayo Académico' : 'Academic Essay',
      case: isSpanish ? 'Reporte de Caso' : 'Case Report',
      book_review: isSpanish ? 'Reseña de Libros' : 'Book Review',
    };
    return translations[value] || value || '—';
  };

  const correspondingAuthor = submission.correspondingAuthor || 
    (submission.authors && submission.authors.length > 0 ? submission.authors.find(a => a.isCorresponding) || submission.authors[0] : null);
  const minorAuthorsList = submission.authors?.filter(a => a.isMinor) || [];
  const nonMinorAuthors = submission.authors?.filter(a => !a.isMinor) || [];
  const hasFunding = submission.funding?.hasFunding;
  const aiUsed = submission.aiUsed;
  const aiTools = submission.aiTools || [];
  const requiresEthics = submission.requiresEthicsApproval;

  if (loadingReview) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-t-[#003b5c] border-slate-200 rounded-full animate-spin mb-6"></div>
        <p className="font-sans text-sm tracking-widest uppercase text-slate-500">
          {isSpanish ? 'Cargando revisión...' : 'Loading review...'}
        </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col">
      {/* ==================== BARRA SUPERIOR ==================== */}
      <div className="bg-[#003b5c] text-white px-3 sm:px-6 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 shadow-lg flex-shrink-0">
  <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
    <button
      onClick={() => onBackToPanel && onBackToPanel()}
      className="flex items-center gap-1 sm:gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-sm transition-colors text-xs sm:text-sm font-sans font-bold uppercase tracking-wider flex-shrink-0"
    >
      <Icons.ArrowLeft />
      <span className="hidden sm:inline">{isSpanish ? 'Volver al Panel' : 'Back to Panel'}</span>
    </button>
    <div className="hidden sm:block h-6 w-px bg-white/20"></div>
    <div className="min-w-0 flex-1">
      <span className="text-[9px] sm:text-[10px] font-sans uppercase tracking-wider text-sky-200">Desk Review</span>
      <h2 className="font-serif text-sm sm:text-lg font-bold leading-tight truncate max-w-full sm:max-w-2xl">
        {isSpanish ? submission.title : submission.titleEn || submission.title}
      </h2>
    </div>
  </div>
  <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
    <span className="px-2 py-0.5 sm:px-3 sm:py-1 bg-white/15 text-white text-[10px] sm:text-xs font-mono rounded-sm truncate max-w-[150px] sm:max-w-none">
      ID: {submission.submissionId || 'PENDIENTE'}
    </span>
  </div>

      </div>

      {/* ==================== PESTAÑAS DE NAVEGACIÓN UNIFICADAS ==================== */}
      <div className="bg-white border-b border-gray-200 px-2 sm:px-6 flex items-center gap-0 sm:gap-1 flex-shrink-0 overflow-x-auto scrollbar-hide">
  {[
    { id: 'review', icon: Icons.Edit, label: isSpanish ? 'Revisión' : 'Review', shortLabel: isSpanish ? 'Rev.' : 'Rev.' },
    { id: 'article', icon: Icons.Eye, label: isSpanish ? 'Ver Artículo' : 'View Article', shortLabel: isSpanish ? 'Art.' : 'Art.' },
    { id: 'reviewers', icon: Icons.Users, label: isSpanish ? 'Revisores' : 'Reviewers', shortLabel: isSpanish ? 'Rev.' : 'Rev.', badge: submittedReviews.length },
    ...(isConsolidated || task.status === 'awaiting_decision' ? [{ id: 'decision', icon: Icons.ClipboardCheck, label: isSpanish ? 'Decisión Final' : 'Final Decision', shortLabel: isSpanish ? 'Dec.' : 'Dec.' }] : []),
    ...(submission.status === 'accepted' ? [{ id: 'metadata', icon: Icons.Refresh, label: isSpanish ? 'Refinar Metadatos' : 'Refine Metadata', shortLabel: isSpanish ? 'Meta.' : 'Meta.' }] : [])
  ].map(tab => (
    <button
      key={tab.id}
      onClick={() => setActiveTab(tab.id)}
      className={`px-2 sm:px-5 py-2.5 sm:py-3 font-sans text-xs sm:text-sm font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
        activeTab === tab.id
          ? 'border-[#003b5c] text-[#003b5c]'
          : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
      }`}
    >
      <span className="flex items-center gap-1 sm:gap-2">
        <span className="w-4 h-4"><tab.icon /></span>
        <span className="hidden sm:inline">{tab.label}</span>
        <span className="sm:hidden">{tab.shortLabel}</span>
        {tab.badge > 0 && (
          <span className="bg-[#003b5c] text-white text-[10px] px-1.5 py-0.5 rounded-full">
            {tab.badge}
          </span>
        )}
      </span>
    </button>
  ))}
</div>

      {/* ==================== CONTENIDO PRINCIPAL CON SCROLL ==================== */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
  <div className="max-w-7xl mx-auto p-3 sm:p-6">
          
          {/* ==================== PESTAÑA: REVISIÓN EDITORIAL ==================== */}
          {activeTab === 'review' && (
            <div className="space-y-6 pb-8 font-sans">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm font-sans text-sm font-medium">
                  <Icons.Warning className="inline mr-2" /> {error}
                </div>
              )}
              
              {/* Encabezado editorial y formulario de decisión (EXACTAMENTE IGUAL que antes) */}
              <div className="bg-[#003b5c] text-white rounded-sm p-4 sm:p-6 lg:p-8 shadow-sm">
  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 sm:gap-6">
    <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="inline-block px-2.5 py-0.5 bg-white text-[#003b5c] text-[10px] font-bold uppercase tracking-wider rounded-sm">
                        ID: {submission.submissionId || 'PENDIENTE'}
                      </span>
                      <span className="inline-block px-2.5 py-0.5 bg-sky-900 border border-sky-700 text-sky-100 text-[10px] font-bold uppercase tracking-wider rounded-sm">
                        {translateArticleType(submission.articleType)}
                      </span>
                      <span className="inline-block px-2.5 py-0.5 bg-sky-900 border border-sky-700 text-sky-100 text-[10px] font-bold uppercase tracking-wider rounded-sm">
                        {submission.paperLanguage === 'en' ? 'ENG' : 'ESP'}
                      </span>
                      <span className="inline-block px-2.5 py-0.5 bg-sky-900 border border-sky-700 text-sky-100 text-[10px] font-bold uppercase tracking-wider rounded-sm">
                        {isSpanish ? 'Ronda' : 'Round'} {submission.currentRound || 1}
                      </span>
                    </div>
                    
                    <h2 className="font-serif text-lg sm:text-2xl font-bold mb-2 leading-tight break-words">
        {isSpanish ? submission.title : submission.titleEn || submission.title}
      </h2>
                    
                    {submission.titleEn && isSpanish && (
                      <p className="text-sky-200 text-sm font-serif italic mb-4 border-l-2 border-sky-400 pl-3">
                        {submission.titleEn}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-4 text-sky-100 text-xs font-medium">
                      <span className="flex items-center gap-1.5"><Icons.Tag /> {submission.area || '—'}</span>
                      <span className="flex items-center gap-1.5"><Icons.CheckCircle /> {submission.status || '—'}</span>
                      <span className="flex items-center gap-1.5"><Icons.DocumentText /> 
                        {submission.createdAt?.toDate?.() ? submission.createdAt.toDate().toLocaleDateString() : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Botonera de Documentos Principales */}
                  <div className="grid grid-cols-2 sm:flex sm:flex-col gap-2 flex-shrink-0 w-full lg:w-auto">
                    {submission.formattedDocsFile?.url && (
                      <a href={submission.formattedDocsFile.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 bg-white text-[#003b5c] px-4 py-2.5 rounded-sm transition-colors text-xs font-bold uppercase tracking-wider shadow-sm hover:bg-slate-50">
                        <Icons.File /> {isSpanish ? 'Manuscrito PDF' : 'PDF Manuscript'}
                      </a>
                    )}
                    
                    {submission.formattedPdfFile?.url && (
                      <a href={submission.formattedPdfFile.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-sm transition-colors text-xs font-bold uppercase tracking-wider">
                        <Icons.File /> PDF
                      </a>
                    )}

                    {submission.finalReviewDocUrl && (
                      <div className="flex gap-2">
                        <a href={submission.finalReviewDocUrl} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-sm transition-colors text-xs font-bold uppercase tracking-wider">
                          <Icons.DocumentText /> {isSpanish ? 'Doc. Final' : 'Final Doc'}
                        </a>
                        <button onClick={() => {
                          try {
                            const match = submission.finalReviewDocUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
                            if (match && match[1]) {
                              const downloadUrl = `https://docs.google.com/document/d/${match[1]}/export?format=docx`;
                              const link = document.createElement('a');
                              link.href = downloadUrl;
                              link.download = `Revisiones_${submission.submissionId || 'final'}.docx`;
                              link.target = '_blank';
                              link.rel = 'noopener noreferrer';
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            } else {
                              window.open(submission.finalReviewDocUrl, '_blank', 'noopener noreferrer');
                            }
                          } catch (error) {
                            window.open(submission.finalReviewDocUrl, '_blank', 'noopener noreferrer');
                          }
                        }} className="flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-sm transition-colors" title="Descargar DOCX">
                          <Icons.Download />
                        </button>
                      </div>
                    )}

                    {!submission.formattedDocsFile?.url && submission.originalFileUrl && (
                      <a href={submission.originalFileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 bg-sky-700 hover:bg-sky-600 text-white px-4 py-2 rounded-sm transition-colors text-xs font-bold uppercase tracking-wider">
                        <Icons.File /> {isSpanish ? 'Archivo Original' : 'Original File'}
                      </a>
                    )}

                    {latestRevisionUrl && (
                      <a href={latestRevisionUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-sm transition-colors text-xs font-bold uppercase tracking-wider">
                        <Icons.DocumentText /> {isSpanish ? 'Última Revisión' : 'Latest Revision'}
                      </a>
                    )}

                    <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 mt-1">
                      {submission.driveFolderUrl && (
                        <a href={submission.driveFolderUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-2 py-2 rounded-sm transition-colors text-[10px] font-bold uppercase tracking-wider">
                          <Icons.ExternalLink /> Drive Autor
                        </a>
                      )}
                      {submission.editorialFolderUrl && (
                        <a href={submission.editorialFolderUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-2 py-2 rounded-sm transition-colors text-[10px] font-bold uppercase tracking-wider">
                          <Icons.ExternalLink /> Drive Edit.
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Columna izquierda - información del autor y resumen */}
                <div className="space-y-6">
                  <InfoBlock icon={Icons.User} title={isSpanish ? 'Autor de Correspondencia' : 'Corresponding Author'}>
                    {correspondingAuthor ? (
                      <div className="space-y-4">
                        <InfoField label={isSpanish ? 'Nombre completo' : 'Full name'} value={`${correspondingAuthor.firstName || ''} ${correspondingAuthor.lastName || ''}`.trim()} />
                        <div className="grid grid-cols-2 gap-4">
                          <InfoField label="Email" value={correspondingAuthor.email} />
                          <InfoField label="ORCID" value={correspondingAuthor.orcid} />
                        </div>
                        <InfoField label={isSpanish ? 'Institución' : 'Institution'} value={correspondingAuthor.institution} />
                        {correspondingAuthor.contribution && (
                          <InfoField label={isSpanish ? 'Contribución (CRediT)' : 'Contribution (CRediT)'} value={correspondingAuthor.contribution} className="pt-2 border-t border-gray-100" />
                        )}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-sm italic font-serif">No especificado</p>
                    )}
                  </InfoBlock>

                  {nonMinorAuthors.length > 1 && (
                    <InfoBlock icon={Icons.Users} title={`${isSpanish ? 'Coautores' : 'Co-authors'} (${nonMinorAuthors.length - 1})`}>
                      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                        {nonMinorAuthors.filter(a => !a.isCorresponding).map((author, index) => (
                          <div key={index} className="bg-slate-50 rounded-sm p-4 border border-slate-200">
                            <p className="font-bold text-slate-800 font-sans text-sm mb-2">
                              {author.firstName} {author.lastName}
                            </p>
                            <div className="grid grid-cols-2 gap-3 mb-2">
                              <InfoField label="Email" value={author.email} />
                              <InfoField label="ORCID" value={author.orcid} />
                            </div>
                            <InfoField label="Institución" value={author.institution} />
                            {author.contribution && (
                              <InfoField label={isSpanish ? 'Contribución (CRediT)' : 'Contribution (CRediT)'} value={author.contribution} className="mt-2" />
                            )}
                          </div>
                        ))}
                      </div>
                    </InfoBlock>
                  )}

                  <InfoBlock icon={Icons.DocumentText} title={isSpanish ? 'Resumen / Abstract' : 'Abstract / Resumen'}>
                    <div className="space-y-5">
                      <div>
                        <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold tracking-wider rounded-sm mb-2">ESPAÑOL</span>
                        <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-serif">
                          {submission.abstract || '—'}
                        </p>
                      </div>
                      {(submission.abstractEn || submission.abstract) && (
                        <div className="border-t border-slate-100 pt-5">
                          <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold tracking-wider rounded-sm mb-2">ENGLISH</span>
                          <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-serif">
                            {submission.abstractEn || submission.abstract || '—'}
                          </p>
                        </div>
                      )}
                    </div>
                  </InfoBlock>

                  <InfoBlock icon={Icons.Tag} title={isSpanish ? 'Palabras Clave / Keywords' : 'Keywords / Palabras Clave'}>
                    <div className="space-y-4">
                      {submission.keywordsVocabulario && (
                        <div className="mb-4">
                          <span className="inline-block px-2.5 py-1 bg-[#003b5c] text-white text-[10px] font-bold uppercase tracking-wider rounded-sm">
                            Vocabulario: {submission.keywordsVocabulario}
                          </span>
                        </div>
                      )}
                      
                      <div>
                        <p className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400 mb-2">ESPAÑOL</p>
                        <div className="flex flex-wrap gap-2">
                          {submission.keywordsRaw?.map((kw, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 text-slate-700 rounded-sm text-xs shadow-sm font-sans">
                              <code className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-sm text-slate-500 font-mono">{kw.code}</code>
                              {kw.term}
                            </span>
                          )) || <span className="text-slate-400 text-xs italic">No especificadas</span>}
                        </div>
                      </div>
                      
                      {submission.keywordsRawEn?.length > 0 && (
                        <div className="border-t border-slate-100 pt-4">
                          <p className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400 mb-2">ENGLISH</p>
                          <div className="flex flex-wrap gap-2">
                            {submission.keywordsRawEn.map((kw, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 text-slate-700 rounded-sm text-xs shadow-sm font-sans">
                                <code className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-sm text-slate-500 font-mono">{kw.code}</code>
                                {kw.term}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {(!submission.keywordsRaw || submission.keywordsRaw.length === 0) && submission.keywords && submission.keywords.length > 0 && (
                        <div>
                          <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold tracking-wider rounded-sm mb-2">ES (formato libre)</span>
                          <div className="flex flex-wrap gap-2">
                            {submission.keywords.map((keyword, index) => (
                              <span key={index} className="px-3 py-1 bg-white border border-slate-200 text-slate-700 rounded-full text-xs font-sans">
                                {keyword}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </InfoBlock>
                </div>

                {/* Columna derecha - ética, IA, financiamiento, etc. */}
                <div className="space-y-6">
                  <InfoBlock icon={Icons.Scale} title={isSpanish ? 'Ética de la Investigación' : 'Research Ethics'}>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between py-2 border-b border-slate-100">
                        <span className="text-sm font-sans font-medium text-slate-700">Aprobación ética requerida</span>
                        <StatusBadge 
                          condition={requiresEthics}
                          trueLabel="SÍ" trueColor="bg-amber-50 text-amber-700 border-amber-200"
                          falseLabel="NO / EXENTO" falseColor="bg-emerald-50 text-emerald-700 border-emerald-200"
                        />
                      </div>
                      {requiresEthics && (
                        <InfoField label="Comité y código de aprobación" value={submission.ethicsCommitteeName} className="bg-slate-50 p-3 rounded-sm border border-slate-100" />
                      )}
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm font-sans font-medium text-slate-700">Incluye autores menores</span>
                        <StatusBadge 
                          condition={submission.hasMinorAuthors}
                          trueLabel="SÍ" trueColor="bg-rose-50 text-rose-700 border-rose-200"
                          falseLabel="NO" falseColor="bg-slate-50 text-slate-600 border-slate-200"
                        />
                      </div>
                    </div>
                  </InfoBlock>

                  {minorAuthorsList.length > 0 && (
                    <InfoBlock icon={Icons.Child} title={`${isSpanish ? 'Autores Menores' : 'Minor Authors'} (${minorAuthorsList.length})`}>
                      <div className="space-y-3">
                        {minorAuthorsList.map((author, index) => (
                          <div key={index} className="bg-rose-50/50 rounded-sm p-4 border border-rose-100">
                            <p className="font-bold text-slate-800 font-sans text-sm mb-2">{author.firstName} {author.lastName}</p>
                            <InfoField label="Tutor legal" value={author.guardianName} />
                            <InfoField label="Método de consentimiento" value={
                              author.consentMethod === 'upload' ? (isSpanish ? 'Formulario subido' : 'Form uploaded') :
                              author.consentMethod === 'email' ? (isSpanish ? 'Enviado por correo' : 'Sent by email') :
                              '—'
                            } className="mt-2" />
                          </div>
                        ))}
                      </div>
                    </InfoBlock>
                  )}

                  <InfoBlock icon={Icons.Chip} title={isSpanish ? 'Uso de Inteligencia Artificial' : 'Use of AI'}>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-sans font-medium text-slate-700">¿Se utilizó IA?</span>
                        <StatusBadge 
                          condition={aiUsed}
                          trueLabel="SÍ" trueColor="bg-purple-50 text-purple-700 border-purple-200"
                          falseLabel="NO" falseColor="bg-slate-50 text-slate-600 border-slate-200"
                        />
                      </div>
                      {aiUsed && aiTools.length > 0 && (
                        <table className="w-full text-sm font-sans mt-3 border border-slate-200 rounded-sm overflow-hidden">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                              <th className="text-left p-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Herramienta</th>
                              <th className="text-left p-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Versión</th>
                              <th className="text-left p-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Propósito</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {aiTools.map((tool, idx) => (
                              <tr key={idx} className="bg-white">
                                <td className="p-2.5 font-medium text-slate-800">{tool.name}</td>
                                <td className="p-2.5 text-slate-600 text-xs">{tool.version || '—'}</td>
                                <td className="p-2.5 text-slate-600 text-xs">{tool.purpose}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </InfoBlock>

                  <InfoBlock icon={Icons.Database} title={isSpanish ? 'Datos y Código' : 'Data & Code Availability'}>
                    <div className="space-y-4">
                      <InfoField label="Datos" value={translateAvailability(submission.dataAvailability)} />
                      {submission.codeAvailability && (
                        <InfoField label="Código" value={translateAvailability(submission.codeAvailability)} className="pt-3 border-t border-slate-100" />
                      )}
                    </div>
                  </InfoBlock>

                  <InfoBlock icon={Icons.Cash} title={isSpanish ? 'Financiamiento' : 'Funding'}>
                    {hasFunding ? (
                      <div className="space-y-3">
                        <InfoField label="Entidad financiadora" value={submission.funding?.sources} />
                        <InfoField label="Códigos de subvención" value={submission.funding?.grantNumbers} />
                      </div>
                    ) : (
                      <p className="text-slate-500 text-sm italic font-serif">Sin financiamiento declarado</p>
                    )}
                  </InfoBlock>

                  <InfoBlock icon={Icons.Message} title={isSpanish ? 'Conflicto de Intereses' : 'Conflict of Interest'}>
                    <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-serif">
                      {submission.conflictOfInterest || '—'}
                    </p>
                  </InfoBlock>

                  {submission.acknowledgments && (
                    <InfoBlock icon={Icons.Heart} title={isSpanish ? 'Agradecimientos' : 'Acknowledgments'}>
                      <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-serif">
                        {submission.acknowledgments}
                      </p>
                    </InfoBlock>
                  )}

                  {submission.excludedReviewers && submission.excludedReviewers.length > 0 && (
                    <InfoBlock icon={Icons.Ban} title={isSpanish ? 'Revisores Excluidos' : 'Excluded Reviewers'}>
                      <ul className="space-y-1">
                        {submission.excludedReviewers.map((reviewer, index) => (
                          <li key={index} className="flex items-center gap-2 text-sm text-slate-800 font-serif">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                            {reviewer}
                          </li>
                        ))}
                      </ul>
                    </InfoBlock>
                  )}

                  {submission.editorComment && (
                    <InfoBlock icon={Icons.Message} title={isSpanish ? 'Mensaje al Editor' : 'Message to Editor'} className="border-l-4 border-l-[#003b5c]">
                      <div 
                         className="review-content ql-editor read-only prose prose-sm max-w-none font-serif text-slate-700 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: submission.editorComment }}
                      />
                    </InfoBlock>
                  )}

                  {latestRevisionComment && (
                    <InfoBlock icon={Icons.Message} title={isSpanish ? 'Comentario de Revisión' : 'Revision Comment'} className="border-l-4 border-l-emerald-500">
                      <div className="mb-3">
                        <span className="inline-block px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider rounded-sm border border-emerald-200">
                          Respuesta de la última ronda
                        </span>
                      </div>
                      <div 
                         className="review-content ql-editor read-only prose prose-sm max-w-none font-serif text-slate-700 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: latestRevisionComment }}
                      />
                    </InfoBlock>
                  )}

                  {!latestRevisionComment && latestRevisionNotes && (
                    <InfoBlock icon={Icons.DocumentText} title={isSpanish ? 'Notas de Revisión' : 'Revision Notes'}>
                      <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-serif">
                        {latestRevisionNotes}
                      </p>
                    </InfoBlock>
                  )}

                  <InfoBlock icon={Icons.File} title={isSpanish ? 'Información del Archivo' : 'File Information'}>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <InfoField label={isSpanish ? 'Nombre del archivo' : 'File name'} value={submission.originalFileName} />
                        <InfoField label={isSpanish ? 'Tamaño' : 'Size'} value={submission.originalFileSize ? `${(submission.originalFileSize / 1024).toFixed(2)} KB` : '—'} />
                      </div>
                      <InfoField label="SHA-256" value={submission.originalFileHash ? `${submission.originalFileHash.substring(0, 16)}...` : '—'} />
                    </div>
                  </InfoBlock>
                </div>
              </div>

              {/* Declaraciones */}
              {submission.declarations && Object.keys(submission.declarations).length > 0 && (
                <InfoBlock icon={Icons.Shield} title={isSpanish ? 'Declaraciones Aceptadas' : 'Accepted Declarations'}>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-3 gap-x-6">
                    {[
                      { key: 'originalAndSimilarity', label: 'Originalidad y <15% similitud' },
                      { key: 'exclusiveSubmission', label: 'Envío exclusivo' },
                      { key: 'authorshipCriteria', label: 'Criterios ICMJE' },
                      { key: 'dataAuthentic', label: 'Datos auténticos' },
                      { key: 'informedConsent', label: 'Consentimiento informado' },
                      { key: 'aiDisclosure', label: 'Declaración de IA' },
                      { key: 'conflicts', label: 'Conflictos declarados' },
                      { key: 'ccByLicense', label: 'Licencia CC-BY 4.0' },
                    ].map(d => (
                      <div key={d.key} className="flex items-center gap-2 text-sm font-sans">
                        {submission.declarations[d.key] ? (
                          <Icons.CheckCircle className="text-emerald-500 w-4 h-4" />
                        ) : (
                          <Icons.Ban className="text-slate-300 w-4 h-4" />
                        )}
                        <span className={submission.declarations[d.key] ? 'text-slate-800' : 'text-slate-400 line-through'}>
                          {d.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </InfoBlock>
              )}

              {/* Panel de decisión editorial */}
              <div className="bg-slate-50 border border-slate-200 rounded-sm p-6 lg:p-8 mt-12 shadow-sm">
                <h3 className="font-sans font-bold text-[#003b5c] text-lg uppercase tracking-wider mb-6 pb-4 border-b border-slate-200">
                  {isSpanish ? 'Resolución Editorial (Desk Review)' : 'Editorial Decision (Desk Review)'}
                </h3>
                
               <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-6 sm:mb-8">
                  {[
                    { value: 'reject', label: isSpanish ? 'Rechazar' : 'Reject', color: 'red' },
                    { value: 'minor-revision', label: isSpanish ? 'Revisión Menor' : 'Minor Revision', color: 'amber' },
                    { value: 'revision-required', label: isSpanish ? 'Enviar a Pares' : 'Send to Review', color: 'sky' },
                    { value: 'accept', label: isSpanish ? 'Aceptar' : 'Accept', color: 'emerald' }
                  ].map(opt => {
                    const isSelected = decision === opt.value;
                    const colorClasses = {
                      red: isSelected ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white border-slate-200 text-slate-500 hover:border-red-300',
                      amber: isSelected ? 'bg-amber-50 border-amber-500 text-amber-700' : 'bg-white border-slate-200 text-slate-500 hover:border-amber-300',
                      sky: isSelected ? 'bg-sky-50 border-sky-500 text-sky-700' : 'bg-white border-slate-200 text-slate-500 hover:border-sky-300',
                      emerald: isSelected ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-200 text-slate-500 hover:border-emerald-300'
                    };

                    return (
                      <button
                        key={opt.value}
                        onClick={() => setDecision(opt.value)}
                        className={`px-2 sm:px-4 py-3 sm:py-4 rounded-sm border-2 font-sans font-bold text-xs sm:text-sm uppercase tracking-wider transition-all duration-200 text-center ${colorClasses[opt.color]}`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-sans font-bold uppercase tracking-wider text-slate-700 mb-2">
                      {isSpanish ? 'Feedback para el Autor' : 'Feedback to Author'}
                    </label>
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      rows="4"
                      className="w-full p-3 sm:p-4 bg-white border border-slate-300 rounded-sm focus:ring-2 focus:ring-[#003b5c] focus:border-transparent font-serif text-sm sm:text-base text-slate-800 placeholder:text-slate-400"
                      placeholder={isSpanish ? 'El autor leerá este comentario...' : 'The author will read this comment...'}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-sans font-bold uppercase tracking-wider text-slate-700 mb-2">
                      {isSpanish ? 'Notas Internas (Solo Editores)' : 'Internal Notes (Editors Only)'}
                    </label>
                    <textarea
                      value={internalComments}
                      onChange={(e) => setInternalComments(e.target.value)}
                      rows="3"
                      className="w-full p-3 sm:p-4 bg-slate-100 border border-slate-300 rounded-sm focus:ring-2 focus:ring-[#003b5c] focus:border-transparent font-serif text-sm sm:text-base text-slate-800 placeholder:text-slate-400"
                      placeholder={isSpanish ? 'Notas privadas para el equipo editorial...' : 'Private notes for the editorial team...'}
                    />
                  </div>

                  <div className="pt-4 border-t border-slate-200 flex justify-end">
                    <button
                      onClick={handleSubmit}
                      disabled={isLoading || !decision}
                      className="w-full sm:w-auto px-6 sm:px-8 py-3 bg-[#003b5c] hover:bg-sky-900 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-sans font-bold text-sm uppercase tracking-wider rounded-sm shadow-sm transition-colors flex items-center justify-center sm:min-w-[200px]"
                    >
                      {isLoading ? (isSpanish ? 'GUARDANDO...' : 'SAVING...') : (isSpanish ? 'CONFIRMAR DECISIÓN' : 'CONFIRM DECISION')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

           {activeTab === 'article' && (
            <div className="space-y-6 pb-8">
              {/* Selector de documento */}
              <div className="bg-white rounded-sm border border-gray-200 shadow-sm p-6">
                <h3 className="font-sans font-bold text-[#003b5c] text-lg uppercase tracking-wider mb-6">
                  {isSpanish ? 'Documentos del Artículo' : 'Article Documents'}
                </h3>
                
                <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {/* Manuscrito PDF */}
                  {submission.formattedDocsFile?.url && (
                    <a 
                      href={submission.formattedDocsFile.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center justify-center p-4 sm:p-8 bg-slate-50 border-2 border-slate-200 hover:border-[#003b5c] rounded-sm transition-all group cursor-pointer"
                    >
                      <div className="w-16 h-16 bg-[#003b5c] rounded-sm flex items-center justify-center mb-4 group-hover:bg-sky-900 transition-colors">
                        <Icons.File />
                      </div>
                      <span className="font-sans font-bold text-slate-800 text-sm uppercase tracking-wider text-center">
                        {isSpanish ? 'Manuscrito PDF' : 'PDF Manuscript'}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-2 font-mono">
                        {isSpanish ? 'Versión formateada' : 'Formatted version'}
                      </span>
                    </a>
                  )}

                  {/* Documento Final con Revisiones */}
                  {submission.finalReviewDocUrl && (
                    <a 
                      href={submission.finalReviewDocUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center justify-center p-4 sm:p-8 bg-slate-50 border-2 border-slate-200 hover:border-emerald-500 rounded-sm transition-all group cursor-pointer"
                    >
                      <div className="w-16 h-16 bg-emerald-600 rounded-sm flex items-center justify-center mb-4 group-hover:bg-emerald-700 transition-colors">
                        <Icons.DocumentText />
                      </div>
                      <span className="font-sans font-bold text-slate-800 text-sm uppercase tracking-wider text-center">
                        {isSpanish ? 'Documento Final' : 'Final Document'}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-2 font-mono">
                        {isSpanish ? 'Con todas las revisiones' : 'With all reviews'}
                      </span>
                    </a>
                  )}

                  {/* Última Revisión */}
                  {latestRevisionUrl && (
                    <a 
                      href={latestRevisionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center justify-center p-4 sm:p-8 bg-slate-50 border-2 border-slate-200 hover:border-blue-500 rounded-sm transition-all group cursor-pointer"
                    >
                      <div className="w-16 h-16 bg-blue-600 rounded-sm flex items-center justify-center mb-4 group-hover:bg-blue-700 transition-colors">
                        <Icons.DocumentText />
                      </div>
                      <span className="font-sans font-bold text-slate-800 text-sm uppercase tracking-wider text-center">
                        {isSpanish ? 'Última Revisión' : 'Latest Revision'}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-2 font-mono">
                        {isSpanish ? 'Versión del autor' : 'Author version'}
                      </span>
                    </a>
                  )}

                  {/* Archivo Original */}
                  {!submission.formattedDocsFile?.url && submission.originalFileUrl && (
                    <a 
                      href={submission.originalFileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center justify-center p-4 sm:p-8 bg-slate-50 border-2 border-slate-200 hover:border-sky-500 rounded-sm transition-all group cursor-pointer"
                    >
                      <div className="w-16 h-16 bg-sky-600 rounded-sm flex items-center justify-center mb-4 group-hover:bg-sky-700 transition-colors">
                        <Icons.File />
                      </div>
                      <span className="font-sans font-bold text-slate-800 text-sm uppercase tracking-wider text-center">
                        {isSpanish ? 'Archivo Original' : 'Original File'}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-2 font-mono">
                        {submission.originalFileName || '—'}
                      </span>
                    </a>
                  )}

                  {/* PDF Formateado alternativo */}
                  {submission.formattedPdfFile?.url && (
                    <a 
                      href={submission.formattedPdfFile.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center justify-center p-4 sm:p-8 bg-slate-50 border-2 border-slate-200 hover:border-red-500 rounded-sm transition-all group cursor-pointer"
                    >
                      <div className="w-16 h-16 bg-red-600 rounded-sm flex items-center justify-center mb-4 group-hover:bg-red-700 transition-colors">
                        <Icons.File />
                      </div>
                      <span className="font-sans font-bold text-slate-800 text-sm uppercase tracking-wider text-center">
                        PDF
                      </span>
                      <span className="text-[10px] text-slate-400 mt-2 font-mono">
                        {isSpanish ? 'Formato alternativo' : 'Alternative format'}
                      </span>
                    </a>
                  )}
                </div>

                {/* Enlaces a carpetas */}
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <h4 className="font-sans font-bold text-slate-700 text-xs uppercase tracking-wider mb-4">
                    {isSpanish ? 'Carpetas de Trabajo' : 'Working Folders'}
                  </h4>
                  <div className="flex flex-wrap gap-3">
                    {submission.driveFolderUrl && (
                      <a 
                        href={submission.driveFolderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-sm transition-colors text-sm font-sans"
                      >
                        <Icons.ExternalLink />
                        {isSpanish ? 'Carpeta del Autor' : 'Author Folder'}
                      </a>
                    )}
                    {submission.editorialFolderUrl && (
                      <a 
                        href={submission.editorialFolderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-sm transition-colors text-sm font-sans"
                      >
                        <Icons.ExternalLink />
                        {isSpanish ? 'Carpeta Editorial' : 'Editorial Folder'}
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Vista previa del artículo */}
              <div className="bg-white rounded-sm border border-gray-200 shadow-sm p-6">
                <h3 className="font-sans font-bold text-[#003b5c] text-lg uppercase tracking-wider mb-6">
                  {isSpanish ? 'Vista Previa del Artículo' : 'Article Preview'}
                </h3>
                
                <div className="space-y-6">
                  <div>
                    <h4 className="font-sans font-bold text-slate-500 text-xs uppercase tracking-wider mb-2">
                      {isSpanish ? 'Título' : 'Title'}
                    </h4>
                    <p className="font-serif text-base sm:text-xl text-slate-800 leading-tight break-words">
                      {isSpanish ? submission.title : submission.titleEn || submission.title}
                    </p>
                    {submission.titleEn && isSpanish && (
                      <p className="font-serif text-lg text-slate-600 italic mt-2">
                        {submission.titleEn}
                      </p>
                    )}
                  </div>

                  <div>
                    <h4 className="font-sans font-bold text-slate-500 text-xs uppercase tracking-wider mb-2">
                      {isSpanish ? 'Autores' : 'Authors'}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {submission.authors?.map((author, index) => (
                        <span key={index} className="font-serif text-slate-800">
                          {author.firstName} {author.lastName}{index < (submission.authors?.length || 0) - 1 ? ',' : ''}
                        </span>
                      )) || <span className="text-slate-400 italic">—</span>}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-sans font-bold text-slate-500 text-xs uppercase tracking-wider mb-2">
                      {isSpanish ? 'Resumen' : 'Abstract'}
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold tracking-wider rounded-sm mb-2">ESPAÑOL</span>
                        <p className="font-serif text-slate-800 leading-relaxed whitespace-pre-wrap">
                          {submission.abstract || '—'}
                        </p>
                      </div>
                      {(submission.abstractEn || submission.abstract) && (
                        <div>
                          <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold tracking-wider rounded-sm mb-2">ENGLISH</span>
                          <p className="font-serif text-slate-800 leading-relaxed whitespace-pre-wrap">
                            {submission.abstractEn || submission.abstract || '—'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-sans font-bold text-slate-500 text-xs uppercase tracking-wider mb-2">
                      {isSpanish ? 'Palabras Clave' : 'Keywords'}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {submission.keywordsRaw?.map((kw, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 rounded-sm text-sm font-sans">
                          <code className="text-[10px] bg-white px-1.5 py-0.5 rounded-sm text-slate-500 font-mono">{kw.code}</code>
                          {kw.term}
                        </span>
                      )) || submission.keywords?.map((keyword, index) => (
                        <span key={index} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm font-sans">
                          {keyword}
                        </span>
                      )) || <span className="text-slate-400 italic">—</span>}
                    </div>
                  </div>

                  {submission.editorComment && (
                    <div>
                      <h4 className="font-sans font-bold text-slate-500 text-xs uppercase tracking-wider mb-2">
                        {isSpanish ? 'Mensaje al Editor' : 'Message to Editor'}
                      </h4>
                      <div 
                        className="review-content ql-editor read-only prose prose-sm max-w-none font-serif text-slate-700 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: submission.editorComment }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================== NUEVAS PESTAÑAS INTEGRADAS ==================== */}
          
          {/* PESTAÑA: GESTIÓN DE REVISORES */}
          {activeTab === 'reviewers' && (
  <ReviewerManagementTab
    task={task}
    articleArea={
  task?.submission?.area || 
  task?.area || 
  submission?.area || 
  (Array.isArray(submission?.area) ? submission.area[0] : null) ||
  ''
}
    invitations={invitations}
    potentialReviewers={potentialReviewers}
    selectedReviewerId={selectedReviewerId}
    setSelectedReviewerId={setSelectedReviewerId}
    searchTerm={searchTerm}
    setSearchTerm={setSearchTerm}
    onSendInvitation={onSendInvitation}
    onProceedToDecision={onProceedToDecision}
    loading={inviteLoading || isConsolidating}
    submittedReviews={submittedReviews}
  />
)}

          {/* PESTAÑA: DECISIÓN FINAL */}
          {activeTab === 'decision' && (
            <FinalDecisionTab
              task={task}
              reviewers={[...submittedReviews, ...reviewers.filter(r => r.status === 'submitted')]}
              onSubmitDecision={onFinalDecision}
              loading={externalLoading}
            />
          )}

          {/* PESTAÑA: REFINAR METADATOS */}
          {activeTab === 'metadata' && (
            <MetadataRefinementTab
              submission={submission}
              user={user}
              onComplete={() => {}}
            />
          )}
          
        </div>
      </div>
      <style jsx>{`
  /* Ocultar scrollbar en pestañas */
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
  
  /* Prevenir zoom en inputs en iOS */
  @media (max-width: 640px) {
    textarea, input {
      font-size: 16px !important;
    }
  }
  
  /* Breakpoint extra pequeño */
  @media (min-width: 480px) {
    .xs\:grid-cols-2 {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
`}</style>
    </div>
  );
};

export default DeskReviewTab;