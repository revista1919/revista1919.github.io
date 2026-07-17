// src/components/ReviewerApplicationsPanel.js
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../hooks/useLanguage';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase';

// ============ ICONOS SVG EDITORIALES ============
const Icons = {
  User: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  Institution: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  ORCID: () => (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zM7.369 4.378c.525 0 .947.431.947.947s-.422.947-.947.947a.95.95 0 01-.947-.947c0-.525.422-.947.947-.947zm-.722 3.038h1.444v10.041H6.647V7.416zm3.562 0h3.9c3.712 0 5.344 2.653 5.344 5.025 0 2.578-2.016 5.025-5.325 5.025h-3.919V7.416zm1.444 1.303v7.444h2.297c3.272 0 4.022-2.484 4.022-3.722 0-2.016-1.284-3.722-3.994-3.722h-2.325z"/>
    </svg>
  ),
  Book: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  Tag: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  ),
  Calendar: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  Email: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  Shield: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  Check: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  Search: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  ChevronDown: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
  Filter: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  ),
  CheckCircle: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  XCircle: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Spinner: () => (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  ),
};

// ============ COMPONENTE PRINCIPAL ============
export default function ReviewerApplicationsPanel() {
  const { language } = useLanguage();
  const isSpanish = language === 'es';

  // Estados
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [filterArea, setFilterArea] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  
  // Estados para acciones de aprobar/rechazar
  const [actionLoading, setActionLoading] = useState(null); // null | { id: string, action: 'approve' | 'reject' }
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionModal, setShowRejectionModal] = useState(null); // id de la aplicación a rechazar
  const [feedbackMessage, setFeedbackMessage] = useState(null); // { type: 'success' | 'error', text: string }

  // Inicializar Cloud Functions
  const functions = getFunctions();
  const approveReviewerApplication = httpsCallable(functions, 'approveReviewerApplication');
  const rejectReviewerApplication = httpsCallable(functions, 'rejectReviewerApplication');

  // Cargar solicitudes
  useEffect(() => {
    loadApplications();
  }, []);

  // Auto-ocultar mensaje de feedback
  useEffect(() => {
    if (feedbackMessage) {
      const timer = setTimeout(() => setFeedbackMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedbackMessage]);

  const loadApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      const submissionsRef = collection(db, 'submissions');
      const q = query(
        submissionsRef,
        where('wantsToBeReviewer', '==', true),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      
      const snapshot = await getDocs(q);
      const apps = [];
      
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        
        let userProfile = null;
        if (data.authorUID) {
          try {
            const userDoc = await getDocs(
              query(collection(db, 'users'), where('uid', '==', data.authorUID), limit(1))
            );
            if (!userDoc.empty) {
              userProfile = userDoc.docs[0].data();
            }
          } catch (err) {
            console.warn('Error fetching user profile:', err);
          }
        }

        apps.push({
          id: docSnap.id,
          submissionId: data.submissionId || docSnap.id,
          authorName: data.authorName || (data.authors && data.authors[0] 
            ? `${data.authors[0].firstName} ${data.authors[0].lastName}` 
            : 'Desconocido'),
          authorEmail: data.authorEmail || (data.authors && data.authors[0]?.email) || '',
          authorUID: data.authorUID,
          reviewerAreas: data.reviewerAreas || [],
          appliedAt: data.createdAt?.toDate?.() || new Date(),
          title: data.title || '',
          area: data.area || '',
          institution: userProfile?.institution || (data.authors && data.authors[0]?.institution) || '',
          orcid: userProfile?.orcid || (data.authors && data.authors[0]?.orcid) || '',
          firstName: userProfile?.firstName || (data.authors && data.authors[0]?.firstName) || '',
          lastName: userProfile?.lastName || (data.authors && data.authors[0]?.lastName) || '',
          displayName: userProfile?.displayName || '',
          publicEmail: userProfile?.publicEmail || '',
          interests: userProfile?.interests || { es: [], en: [] },
          totalSubmissions: userProfile?.totalSubmissions || 0,
          reviewerStatus: data.reviewerStatus || 'pending',
        });
      }

      setApplications(apps);
    } catch (err) {
      console.error('Error loading reviewer applications:', err);
      setError(isSpanish 
        ? 'Error al cargar las solicitudes de revisores' 
        : 'Error loading reviewer applications');
    } finally {
      setLoading(false);
    }
  };

  // ============ ACCIONES DE APROBACIÓN Y RECHAZO ============

  const handleApprove = async (application) => {
    if (actionLoading) return;
    
    setActionLoading({ id: application.id, action: 'approve' });
    
    try {
      const result = await approveReviewerApplication({
        submissionId: application.id,
        reviewerUid: application.authorUID,
      });
      
      console.log('✅ Revisor aprobado:', result.data);
      
      // Actualizar estado local
      setApplications(prev => prev.map(app => 
        app.id === application.id 
          ? { ...app, reviewerStatus: 'approved' }
          : app
      ));
      
      setFeedbackMessage({
        type: 'success',
        text: isSpanish 
          ? `Revisor aprobado exitosamente: ${application.displayName || application.authorName}`
          : `Reviewer approved successfully: ${application.displayName || application.authorName}`
      });
      
      // Cerrar detalle si está abierto
      if (selectedApplication?.id === application.id) {
        setSelectedApplication(null);
      }
    } catch (err) {
      console.error('❌ Error aprobando revisor:', err);
      
      let errorText = isSpanish 
        ? 'Error al aprobar la solicitud'
        : 'Error approving application';
      
      if (err.code === 'functions/already-exists') {
        errorText = isSpanish 
          ? 'Esta solicitud ya fue aprobada anteriormente'
          : 'This application has already been approved';
      } else if (err.code === 'functions/permission-denied') {
        errorText = isSpanish 
          ? 'No tienes permisos para aprobar revisores'
          : 'You do not have permission to approve reviewers';
      } else if (err.details?.originalError) {
        errorText = err.details.originalError;
      }
      
      setFeedbackMessage({ type: 'error', text: errorText });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectClick = (application) => {
    setShowRejectionModal(application);
    setRejectionReason('');
  };

  const handleRejectConfirm = async () => {
    if (!showRejectionModal) return;
    
    setActionLoading({ id: showRejectionModal.id, action: 'reject' });
    
    try {
      const result = await rejectReviewerApplication({
        submissionId: showRejectionModal.id,
        reason: rejectionReason || undefined,
      });
      
      console.log('✅ Solicitud rechazada:', result.data);
      
      // Actualizar estado local
      setApplications(prev => prev.map(app => 
        app.id === showRejectionModal.id 
          ? { ...app, reviewerStatus: 'rejected' }
          : app
      ));
      
      setFeedbackMessage({
        type: 'success',
        text: isSpanish 
          ? `Solicitud de revisor rechazada: ${showRejectionModal.displayName || showRejectionModal.authorName}`
          : `Reviewer application rejected: ${showRejectionModal.displayName || showRejectionModal.authorName}`
      });
      
      // Cerrar detalle si está abierto
      if (selectedApplication?.id === showRejectionModal.id) {
        setSelectedApplication(null);
      }
      
      setShowRejectionModal(null);
    } catch (err) {
      console.error('❌ Error rechazando solicitud:', err);
      
      let errorText = isSpanish 
        ? 'Error al rechazar la solicitud'
        : 'Error rejecting application';
      
      if (err.code === 'functions/permission-denied') {
        errorText = isSpanish 
          ? 'No tienes permisos para rechazar solicitudes'
          : 'You do not have permission to reject applications';
      } else if (err.details?.originalError) {
        errorText = err.details.originalError;
      }
      
      setFeedbackMessage({ type: 'error', text: errorText });
    } finally {
      setActionLoading(null);
    }
  };

  // Filtrar y ordenar aplicaciones
  const filteredApplications = applications
    .filter(app => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesName = (app.displayName || app.authorName).toLowerCase().includes(term);
        const matchesEmail = (app.authorEmail || app.publicEmail).toLowerCase().includes(term);
        const matchesInstitution = app.institution.toLowerCase().includes(term);
        const matchesArea = app.reviewerAreas.some(area => area.toLowerCase().includes(term));
        
        if (!matchesName && !matchesEmail && !matchesInstitution && !matchesArea) {
          return false;
        }
      }
      
      if (filterArea !== 'all') {
        if (!app.reviewerAreas.some(area => area.includes(filterArea))) {
          return false;
        }
      }
      
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.displayName || a.authorName).localeCompare(b.displayName || b.authorName);
        case 'areas':
          return b.reviewerAreas.length - a.reviewerAreas.length;
        case 'date':
        default:
          return b.appliedAt - a.appliedAt;
      }
    });

  const allAreas = [...new Set(applications.flatMap(app => app.reviewerAreas))].sort();

  const formatDate = (date) => {
    if (!date) return '—';
    return new Intl.DateTimeFormat(isSpanish ? 'es-CL' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  // ============ RENDERIZADO ============
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full min-h-screen bg-[#f3f4f6] font-sans"
    >
      {/* Feedback Toast */}
      <AnimatePresence>
        {feedbackMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-sm shadow-lg border flex items-center gap-3 max-w-md ${
              feedbackMessage.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {feedbackMessage.type === 'success' ? <Icons.CheckCircle /> : <Icons.XCircle />}
            <p className="text-sm font-sans flex-1">{feedbackMessage.text}</p>
            <button 
              onClick={() => setFeedbackMessage(null)}
              className="text-current opacity-50 hover:opacity-100 transition-opacity"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de rechazo */}
      <AnimatePresence>
        {showRejectionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowRejectionModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-sm shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-serif text-lg font-bold text-gray-800 mb-2">
                {isSpanish ? 'Rechazar solicitud de revisor' : 'Reject reviewer application'}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {isSpanish 
                  ? `Estás por rechazar la solicitud de ${showRejectionModal.displayName || showRejectionModal.authorName}.`
                  : `You are about to reject the application from ${showRejectionModal.displayName || showRejectionModal.authorName}.`
                }
              </p>
              <div className="mb-4">
                <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">
                  {isSpanish ? 'Motivo del rechazo (opcional)' : 'Rejection reason (optional)'}
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-sm text-sm font-sans focus:ring-2 focus:ring-red-300 focus:border-transparent outline-none transition-all resize-none"
                  placeholder={isSpanish 
                    ? 'Ej: No cumple con los requisitos de experiencia...' 
                    : 'Ex: Does not meet experience requirements...'
                  }
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowRejectionModal(null)}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-600 bg-white border border-gray-200 rounded-sm hover:bg-gray-50 transition-colors"
                  disabled={!!actionLoading}
                >
                  {isSpanish ? 'Cancelar' : 'Cancel'}
                </button>
                <button
                  onClick={handleRejectConfirm}
                  disabled={!!actionLoading}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-white bg-red-600 rounded-sm hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {actionLoading?.action === 'reject' ? (
                    <>
                      <Icons.Spinner />
                      {isSpanish ? 'Rechazando...' : 'Rejecting...'}
                    </>
                  ) : (
                    isSpanish ? 'Confirmar rechazo' : 'Confirm rejection'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barra superior editorial */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-[#003b5c]">
              <Icons.Shield />
            </span>
            <span className="text-[#003b5c] text-sm font-bold uppercase tracking-widest hidden sm:inline">
              {isSpanish ? 'Editorial · Postulaciones a Revisor' : 'Editorial · Reviewer Applications'}
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-xs text-gray-500 font-mono">
              {applications.length} {isSpanish ? 'postulaciones' : 'applications'}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Panel de búsqueda y filtros */}
        <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Búsqueda */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Icons.Search />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={isSpanish ? 'Buscar por nombre, email, área...' : 'Search by name, email, area...'}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-sm text-sm font-sans focus:ring-2 focus:ring-[#003b5c] focus:border-transparent outline-none transition-all"
              />
            </div>

            {/* Filtro por área */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Icons.Filter />
              </span>
              <select
                value={filterArea}
                onChange={(e) => setFilterArea(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-sm text-sm font-sans text-gray-600 focus:ring-2 focus:ring-[#003b5c] focus:border-transparent outline-none transition-all appearance-none bg-white"
              >
                <option value="all">
                  {isSpanish ? 'Todas las áreas' : 'All areas'}
                </option>
                {allAreas.map(area => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>

            {/* Ordenamiento */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Icons.Calendar />
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-sm text-sm font-sans text-gray-600 focus:ring-2 focus:ring-[#003b5c] focus:border-transparent outline-none transition-all appearance-none bg-white"
              >
                <option value="date">{isSpanish ? 'Más recientes' : 'Most recent'}</option>
                <option value="name">{isSpanish ? 'Nombre' : 'Name'}</option>
                <option value="areas">{isSpanish ? 'Más áreas' : 'Most areas'}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Estado de carga */}
        {loading && (
          <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-12 text-center">
            <div className="w-12 h-12 border-4 border-t-[#003b5c] border-slate-200 rounded-full animate-spin mx-auto mb-6"></div>
            <p className="font-sans text-sm tracking-widest uppercase text-slate-500">
              {isSpanish ? 'Cargando postulaciones...' : 'Loading applications...'}
            </p>
          </div>
        )}

        {/* Mensaje de error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-sm p-6 text-center">
            <p className="text-red-600 text-sm font-sans">{error}</p>
            <button
              onClick={loadApplications}
              className="mt-4 px-6 py-2 bg-red-600 text-white text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-red-700 transition-colors"
            >
              {isSpanish ? 'Reintentar' : 'Retry'}
            </button>
          </div>
        )}

        {/* Lista de postulaciones */}
        {!loading && !error && (
          <>
            {filteredApplications.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-sm flex items-center justify-center mx-auto mb-4">
                  <span className="text-gray-400">
                    <Icons.Search />
                  </span>
                </div>
                <h3 className="font-serif text-lg text-gray-600 mb-2">
                  {isSpanish ? 'Sin resultados' : 'No results'}
                </h3>
                <p className="text-sm text-gray-500 font-sans">
                  {searchTerm || filterArea !== 'all'
                    ? (isSpanish ? 'Ajusta los filtros de búsqueda' : 'Adjust your search filters')
                    : (isSpanish ? 'No hay postulaciones de revisores aún' : 'No reviewer applications yet')}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredApplications.map((app) => (
                  <motion.div
                    key={app.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`bg-white border rounded-sm shadow-sm overflow-hidden transition-colors ${
                      app.reviewerStatus === 'approved' 
                        ? 'border-emerald-300 bg-emerald-50/30' 
                        : app.reviewerStatus === 'rejected'
                        ? 'border-red-300 bg-red-50/30'
                        : 'border-gray-200 hover:border-[#003b5c]/30'
                    }`}
                  >
                    {/* Cabecera de la tarjeta */}
                    <div 
                      className="p-6 cursor-pointer"
                      onClick={() => setSelectedApplication(selectedApplication?.id === app.id ? null : app)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 min-w-0 flex-1">
                          {/* Avatar con iniciales */}
                          <div className={`w-12 h-12 rounded-sm flex items-center justify-center flex-shrink-0 ${
                            app.reviewerStatus === 'approved' ? 'bg-emerald-600' :
                            app.reviewerStatus === 'rejected' ? 'bg-red-600' :
                            'bg-[#003b5c]'
                          }`}>
                            <span className="text-white text-lg font-serif font-bold">
                              {(app.firstName || app.authorName?.split(' ')[0] || '?')[0]?.toUpperCase()}
                            </span>
                          </div>
                          
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-serif text-lg font-bold text-[#003b5c] truncate">
                                {app.displayName || app.authorName}
                              </h3>
                              {app.reviewerStatus === 'approved' && (
                                <span className="flex-shrink-0 text-emerald-600">
                                  <Icons.CheckCircle />
                                </span>
                              )}
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 font-sans">
                              {app.institution && (
                                <span className="flex items-center gap-1">
                                  <span className="text-[#003b5c]"><Icons.Institution /></span>
                                  {app.institution}
                                </span>
                              )}
                              {app.orcid && (
                                <span className="flex items-center gap-1">
                                  <span className="text-[#a6ce39]"><Icons.ORCID /></span>
                                  <a 
                                    href={`https://orcid.org/${app.orcid}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[#003b5c] hover:text-[#e86125] font-mono"
                                  >
                                    {app.orcid}
                                  </a>
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <span className="text-[#003b5c]"><Icons.Calendar /></span>
                                {formatDate(app.appliedAt)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Badges y controles */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="px-3 py-1 bg-[#003b5c]/10 text-[#003b5c] text-[10px] font-bold uppercase tracking-wider rounded-sm font-sans">
                            {app.reviewerAreas.length} {isSpanish ? 'áreas' : 'areas'}
                          </span>
                          <span className={`px-3 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider font-sans ${
                            app.reviewerStatus === 'approved' 
                              ? 'bg-emerald-100 text-emerald-700'
                              : app.reviewerStatus === 'rejected' 
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}>
                            {app.reviewerStatus === 'approved' 
                              ? (isSpanish ? 'Aprobado' : 'Approved')
                              : app.reviewerStatus === 'rejected' 
                              ? (isSpanish ? 'Rechazado' : 'Rejected')
                              : (isSpanish ? 'Pendiente' : 'Pending')
                            }
                          </span>
                          <span className="text-gray-400 transition-transform duration-200"
                            style={{ transform: selectedApplication?.id === app.id ? 'rotate(180deg)' : 'rotate(0deg)' }}
                          >
                            <Icons.ChevronDown />
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Detalle expandido */}
                    <AnimatePresence>
                      {selectedApplication?.id === app.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="border-t border-gray-200 overflow-hidden"
                        >
                          <div className="p-6 bg-gray-50">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Columna izquierda: Datos de contacto */}
                              <div className="space-y-4">
                                <h4 className="font-sans font-bold text-xs uppercase tracking-wider text-gray-500 border-b border-gray-200 pb-2">
                                  {isSpanish ? 'Información de contacto' : 'Contact Information'}
                                </h4>
                                
                                <div className="space-y-3">
                                  <div>
                                    <label className="block text-[10px] font-medium uppercase tracking-wider text-gray-400 mb-1">
                                      {isSpanish ? 'Email principal' : 'Primary email'}
                                    </label>
                                    <a 
                                      href={`mailto:${app.authorEmail || app.publicEmail}`}
                                      className="text-sm text-[#003b5c] hover:text-[#e86125] font-sans flex items-center gap-2"
                                    >
                                      <Icons.Email />
                                      {app.authorEmail || app.publicEmail || '—'}
                                    </a>
                                  </div>
                                  
                                  {app.publicEmail && app.publicEmail !== app.authorEmail && (
                                    <div>
                                      <label className="block text-[10px] font-medium uppercase tracking-wider text-gray-400 mb-1">
                                        {isSpanish ? 'Email público' : 'Public email'}
                                      </label>
                                      <a 
                                        href={`mailto:${app.publicEmail}`}
                                        className="text-sm text-[#003b5c] hover:text-[#e86125] font-sans flex items-center gap-2"
                                      >
                                        <Icons.Email />
                                        {app.publicEmail}
                                      </a>
                                    </div>
                                  )}

                                  <div>
                                    <label className="block text-[10px] font-medium uppercase tracking-wider text-gray-400 mb-1">
                                      {isSpanish ? 'Institución' : 'Institution'}
                                    </label>
                                    <p className="text-sm text-gray-700 font-serif">
                                      {app.institution || '—'}
                                    </p>
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-medium uppercase tracking-wider text-gray-400 mb-1">
                                      {isSpanish ? 'Envíos realizados' : 'Total submissions'}
                                    </label>
                                    <p className="text-sm text-gray-700 font-mono">
                                      {app.totalSubmissions}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Columna derecha: Áreas e intereses */}
                              <div className="space-y-4">
                                <h4 className="font-sans font-bold text-xs uppercase tracking-wider text-gray-500 border-b border-gray-200 pb-2">
                                  {isSpanish ? 'Áreas de especialización' : 'Areas of Expertise'}
                                </h4>
                                
                                {app.reviewerAreas.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {app.reviewerAreas.map((area, idx) => (
                                      <span
                                        key={idx}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#003b5c]/20 text-[#003b5c] rounded-sm text-xs font-medium font-sans"
                                      >
                                        <Icons.Tag />
                                        {area}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-400 italic font-serif">
                                    {isSpanish ? 'No especificadas' : 'Not specified'}
                                  </p>
                                )}

                                {app.interests && (app.interests.es?.length > 0 || app.interests.en?.length > 0) && (
                                  <div className="mt-4">
                                    <h5 className="font-sans font-bold text-[10px] uppercase tracking-wider text-gray-400 mb-2">
                                      {isSpanish ? 'Intereses declarados' : 'Declared interests'}
                                    </h5>
                                    <div className="flex flex-wrap gap-2">
                                      {(app.interests.es || app.interests.en || []).map((interest, idx) => (
                                        <span
                                          key={idx}
                                          className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-sm text-xs font-sans"
                                        >
                                          {interest}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Artículo asociado */}
                            <div className="mt-6 pt-4 border-t border-gray-200">
                              <h4 className="font-sans font-bold text-xs uppercase tracking-wider text-gray-500 mb-2">
                                {isSpanish ? 'Artículo asociado a esta postulación' : 'Article associated with this application'}
                              </h4>
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-[#003b5c]"><Icons.Book /></span>
                                <span className="font-serif text-gray-700 truncate">{app.title || '—'}</span>
                                {app.submissionId && (
                                  <span className="text-[10px] text-gray-400 font-mono ml-auto flex-shrink-0">
                                    ID: {app.submissionId}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Acciones - Solo mostrar si está pendiente */}
                            {app.reviewerStatus === 'pending' && (
                              <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end gap-3">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRejectClick(app);
                                  }}
                                  disabled={!!actionLoading}
                                  className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-red-600 bg-white border border-red-200 rounded-sm hover:bg-red-50 transition-colors disabled:opacity-50"
                                >
                                  {isSpanish ? 'Rechazar' : 'Reject'}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleApprove(app);
                                  }}
                                  disabled={!!actionLoading}
                                  className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-white bg-[#003b5c] rounded-sm hover:bg-[#002b44] transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                                >
                                  {actionLoading?.id === app.id && actionLoading?.action === 'approve' ? (
                                    <>
                                      <Icons.Spinner />
                                      {isSpanish ? 'Aprobando...' : 'Approving...'}
                                    </>
                                  ) : (
                                    isSpanish ? 'Aprobar como revisor' : 'Approve as reviewer'
                                  )}
                                </button>
                              </div>
                            )}

                            {/* Mensaje si ya fue procesado */}
                            {app.reviewerStatus !== 'pending' && (
                              <div className="mt-6 pt-4 border-t border-gray-200">
                                <p className={`text-sm font-sans italic ${
                                  app.reviewerStatus === 'approved' ? 'text-emerald-600' : 'text-red-600'
                                }`}>
                                  {app.reviewerStatus === 'approved'
                                    ? (isSpanish ? '✅ Esta solicitud ya fue aprobada.' : '✅ This application has been approved.')
                                    : (isSpanish ? '❌ Esta solicitud fue rechazada.' : '❌ This application has been rejected.')
                                  }
                                </p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}