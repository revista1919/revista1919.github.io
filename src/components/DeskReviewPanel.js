// src/components/DeskReviewPanel.js
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { 
  collection, query, where, onSnapshot, doc, getDoc, getDocs 
} from 'firebase/firestore';
import { useLanguage } from '../hooks/useLanguage';
import { useEditorialReview } from '../hooks/useEditorialReview';
import { useReviewerInvitation } from '../hooks/useReviewerInvitation';
import { useEditorialTasks, TASK_STATES } from '../hooks/useEditorialTasks';
import { DeskReviewTab } from './DeskReviewTab';

// ============ ICONOS SVG PROFESIONALES (Líneas finas, estilo editorial) ============
const Icons = {
  FileText: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  CheckCircle: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  XCircle: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  AlertCircle: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  Ban: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  ),
  Search: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  ),
  Inbox: () => (
    <svg className="w-12 h-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  ),
};

const DeskReviewPanel = ({ user }) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
  const [selectedRound, setSelectedRound] = useState(1);
  // ELIMINADO: viewMode y activeTaskTab ya no se necesitan aquí
  
  const [potentialReviewers, setPotentialReviewers] = useState([]);
  const [selectedReviewerId, setSelectedReviewerId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [invitations, setInvitations] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  
  const [submittedReviews, setSubmittedReviews] = useState([]);
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [isConsolidated, setIsConsolidated] = useState(false);
  
  // Filtros y búsqueda
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchManuscript, setSearchManuscript] = useState('');

  const { loading: reviewLoading, error: reviewError, submitDeskReviewDecision } = useEditorialReview(user);
  const { loading: inviteLoading, error: inviteError, sendInvitation } = useReviewerInvitation(user);
  const { loading: tasksLoading, getMyTasks, makeFinalDecision, startDeskReview } = useEditorialTasks(user);

  const userRoles = user?.roles || [];
  const hasPermission = userRoles.includes('Editor de Sección') || userRoles.includes('Director General');
  
  // Escuchar TODAS las tareas del editor
  useEffect(() => {
    if (!user || !hasPermission) return;

    const q = query(
      collection(db, 'editorialTasks'),
      where('assignedTo', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || null
      }));
      
      const tasksWithSubmissions = await Promise.all(tasks.map(async (task) => {
        const submissionDoc = await getDoc(doc(db, 'submissions', task.submissionId));
        return {
          ...task,
          submission: submissionDoc.exists() ? { id: submissionDoc.id, ...submissionDoc.data() } : null
        };
      }));
      
      setAssignedTasks(tasksWithSubmissions);
    }, (error) => {
      console.error('Error listening to editorial tasks:', error);
    });

    return () => unsubscribe();
  }, [user, hasPermission]);

  // AGRUPAR TAREAS POR SUBMISSION ID
  const groupedSubmissions = useMemo(() => {
    const grouped = {};
    
    assignedTasks.forEach(task => {
      const subId = task.submissionId;
      if (!grouped[subId]) {
        grouped[subId] = {
          submissionId: subId,
          submission: task.submission,
          tasks: [],
          latestTask: null,
          hasPendingTasks: false,
          hasCompletedTasks: false,
          currentRound: 1,
          finalDecision: null
        };
      }
      
      grouped[subId].tasks.push(task);
      grouped[subId].tasks.sort((a, b) => (a.round || 1) - (b.round || 1));
      
      const hasRejection = task.decision === 'reject' || task.submission?.status === 'rejected';
      
      if (hasRejection) {
        grouped[subId].finalDecision = 'rejected';
      } else if (task.decision === 'accept' || task.submission?.status === 'accepted') {
        grouped[subId].finalDecision = 'accepted';
      }
      
      if (task.status !== TASK_STATES.COMPLETED && !hasRejection) {
        grouped[subId].hasPendingTasks = true;
        grouped[subId].currentRound = task.round || 1;
      } else {
        grouped[subId].hasCompletedTasks = true;
      }
      
      grouped[subId].latestTask = grouped[subId].tasks[grouped[subId].tasks.length - 1];
    });
    
    return Object.values(grouped);
  }, [assignedTasks]);

  // Obtener la tarea seleccionada
  const selectedTask = useMemo(() => {
    if (!selectedSubmissionId) return null;
    
    const submission = groupedSubmissions.find(g => g.submissionId === selectedSubmissionId);
    if (!submission) return null;
    
    const task = submission.tasks.find(t => (t.round || 1) === selectedRound);
    return task || submission.latestTask;
  }, [selectedSubmissionId, selectedRound, groupedSubmissions]);

  // Cargar revisiones completadas (submitted) en tiempo real
  useEffect(() => {
    if (!selectedTask) {
      setSubmittedReviews([]);
      setIsConsolidated(false);
      return;
    }

    const checkConsolidation = async () => {
      if (selectedTask.submission?.finalReviewDocId) {
        setIsConsolidated(true);
      } else {
        setIsConsolidated(false);
      }
    };
    checkConsolidation();

    const q = query(
      collection(db, 'reviewerAssignments'),
      where('editorialTaskId', '==', selectedTask.id),
      where('status', '==', 'submitted')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reviews = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSubmittedReviews(reviews);
    }, (error) => {
      console.error('Error escuchando revisiones:', error);
    });

    return () => unsubscribe();
  }, [selectedTask]);

  // Cargar TODAS las asignaciones
  useEffect(() => {
    if (!selectedTask) {
      setInvitations([]);
      setReviewers([]);
      return;
    }

    const loadAllAssignments = async () => {
      const invQ = query(
        collection(db, 'reviewerInvitations'),
        where('editorialTaskId', '==', selectedTask.id)
      );
      const invSnapshot = await getDocs(invQ);
      setInvitations(invSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const revQ = query(
        collection(db, 'reviewerAssignments'),
        where('editorialTaskId', '==', selectedTask.id)
      );
      const revSnapshot = await getDocs(revQ);
      setReviewers(revSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };

    loadAllAssignments();
  }, [selectedTask]);

  // Cargar revisores potenciales
  useEffect(() => {
    const loadReviewers = async () => {
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('roles', 'array-contains-any', ['Revisor', 'Editor de Sección'])
      );
      
      const snapshot = await getDocs(q);
      const reviewers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        displayName: doc.data().displayName || 
          `${doc.data().firstName || ''} ${doc.data().lastName || ''}`.trim() ||
          doc.data().email
      }));
      
      setPotentialReviewers(reviewers);
    };

    loadReviewers();
  }, []);

  const handleStartReview = async (taskId) => {
    const result = await startDeskReview(taskId);
    if (result.success) {
      const updated = await getMyTasks();
      if (updated.success) setAssignedTasks(updated.tasks);
    }
  };

  const handleCompleteDeskReview = async (result) => {
    if (!selectedTask?.editorialReviewId) {
      alert(isSpanish 
        ? 'Error: No se pudo identificar la revisión editorial.' 
        : 'Error: Could not identify the editorial review.');
      return;
    }

    const mappedDecisionData = {
      decision: result.decision,
      feedbackToAuthor: result.feedback,
      commentsToEditorial: result.internalComments
    };

    const submitResult = await submitDeskReviewDecision(
      selectedTask.editorialReviewId, 
      mappedDecisionData
    );

    if (submitResult.success) {
      if (result.decision === 'reject') {
        alert(isSpanish 
          ? 'Manuscrito rechazado. El autor será notificado.' 
          : 'Manuscript rejected. The author will be notified.');
        setSelectedSubmissionId(null);
      } else {
        alert(isSpanish 
          ? 'Revisión completada. Ahora puedes gestionar revisores.' 
          : 'Review completed. You can now manage reviewers.');
      }
    } else {
      alert(isSpanish 
        ? 'Error al guardar: ' + submitResult.error 
        : 'Error saving: ' + submitResult.error);
    }
  };

  const handleSendInvitation = async () => {
    if (!selectedTask || !selectedReviewerId) {
      alert(isSpanish ? 'Selecciona un revisor' : 'Select a reviewer');
      return;
    }

    const reviewer = potentialReviewers.find(r => r.id === selectedReviewerId);
    
    const result = await sendInvitation({
      editorialTaskId: selectedTask.id,
      submissionId: selectedTask.submissionId,
      round: selectedTask.round || 1,
      reviewerEmail: reviewer.email,
      reviewerName: reviewer.displayName,
      reviewerUid: reviewer.id
    });

    if (result.success) {
      alert(isSpanish ? 'Invitación enviada' : 'Invitation sent');
      setSelectedReviewerId('');
      setSearchTerm('');
      
      const q = query(
        collection(db, 'reviewerInvitations'),
        where('editorialTaskId', '==', selectedTask.id)
      );
      const snapshot = await getDocs(q);
      setInvitations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }
  };

  const handleProceedToDecision = async () => {
    const requiredReviews = selectedTask?.requiredReviews || 2;
    
    if (submittedReviews.length < requiredReviews) {
      alert(isSpanish 
        ? `Se necesitan al menos ${requiredReviews} revisiones completadas. Actualmente hay ${submittedReviews.length}.` 
        : `At least ${requiredReviews} completed reviews are needed. Currently ${submittedReviews.length}.`);
      return;
    }

    if (!confirm(isSpanish 
      ? `¿Proceder a la decisión final con ${submittedReviews.length} revisiones?` 
      : `Proceed to final decision with ${submittedReviews.length} reviews?`
    )) {
      return;
    }

    setIsConsolidating(true);

    try {
      const proceedToFinalDecision = httpsCallable(functions, 'proceedToFinalDecision');
      const result = await proceedToFinalDecision({ taskId: selectedTask.id });
      const data = result.data;

      if (data.success) {
        setIsConsolidated(true);
        alert(isSpanish 
          ? '¡Documento consolidado creado!' 
          : 'Consolidated document created!');
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (error) {
      console.error('Error al consolidar:', error);
      alert(isSpanish 
        ? `Error: ${error.message}` 
        : `Error: ${error.message}`);
    } finally {
      setIsConsolidating(false);
    }
  };

  const handleFinalDecision = async (taskId, decisionData) => {
    const result = await makeFinalDecision(taskId, decisionData);
    if (result.success) {
      alert(isSpanish ? 'Decisión final guardada' : 'Final decision saved');
      setSelectedSubmissionId(null);
      setSelectedRound(1);
    }
  };

  const handleSelectManuscript = (submissionId, round, group) => {
    setSelectedSubmissionId(submissionId);
    setSelectedRound(round);
  };

  // Filtrar revisores disponibles
  const invitedEmails = new Set([
    ...invitations.map(r => r.reviewerEmail),
    ...submittedReviews.map(r => r.reviewerEmail),
    ...reviewers.map(r => r.reviewerEmail)
  ]);
  const availableReviewers = potentialReviewers.filter(r => !invitedEmails.has(r.email));
  
  const filteredReviewers = availableReviewers.filter(reviewer => {
    const searchLower = searchTerm.toLowerCase();
    return (
      reviewer.displayName?.toLowerCase().includes(searchLower) ||
      reviewer.email?.toLowerCase().includes(searchLower) ||
      reviewer.institution?.toLowerCase().includes(searchLower)
    );
  });

  // Filtrar manuscritos
  const filteredSubmissions = useMemo(() => {
    let filtered = [...groupedSubmissions];
    
    if (filterStatus === 'pending') {
      filtered = filtered.filter(g => g.hasPendingTasks && g.finalDecision !== 'rejected');
    } else if (filterStatus === 'completed') {
      filtered = filtered.filter(g => !g.hasPendingTasks && g.hasCompletedTasks && g.finalDecision !== 'rejected');
    } else if (filterStatus === 'rejected') {
      filtered = filtered.filter(g => g.finalDecision === 'rejected');
    }
    
    if (searchManuscript) {
      const searchLower = searchManuscript.toLowerCase();
      filtered = filtered.filter(g => 
        g.submission?.title?.toLowerCase().includes(searchLower) ||
        g.submission?.submissionId?.toLowerCase().includes(searchLower) ||
        g.submission?.area?.toLowerCase().includes(searchLower)
      );
    }
    
    return filtered;
  }, [groupedSubmissions, filterStatus, searchManuscript]);

  const pendingSubmissions = filteredSubmissions.filter(g => g.hasPendingTasks && g.finalDecision !== 'rejected');
  const completedSubmissions = filteredSubmissions.filter(g => !g.hasPendingTasks && g.hasCompletedTasks && g.finalDecision !== 'rejected');
  const rejectedSubmissions = filteredSubmissions.filter(g => g.finalDecision === 'rejected');

  if (!hasPermission) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB] font-sans text-slate-800">
      
      {/* ===================== TOP NAVIGATION (EDITORIAL RIBBON) ===================== */}
      <div className="bg-[#003b5c] text-white sticky top-0 z-40 shadow-md border-b-[3px] border-[#C0A86A]">
        {/* Branding Tier */}
        <div className="max-w-[1920px] mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex w-10 h-10 border border-[#C0A86A]/40 bg-white/5 items-center justify-center text-[#C0A86A]">
              <Icons.FileText />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C0A86A] mb-1">
                {isSpanish ? 'Sistema de Gestión Editorial' : 'Editorial Management System'}
              </p>
              <h1 className="font-serif text-xl sm:text-2xl font-bold leading-none">
                {isSpanish ? 'Panel de Revisión' : 'Review Panel'}
              </h1>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs text-sky-200 uppercase tracking-widest font-bold">
              {user?.displayName || user?.email}
            </p>
            <p className="text-[10px] text-white/60 uppercase tracking-wider mt-1">
              {isSpanish ? 'Editor de Sección' : 'Section Editor'}
            </p>
          </div>
        </div>

        {/* Filters Tier */}
        <div className="bg-white text-slate-700 border-b border-slate-200">
          <div className="max-w-[1920px] mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 py-2">
            
            {/* Search */}
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2 w-full sm:w-72 focus-within:border-[#003b5c] transition-colors">
              <span className="text-slate-400"><Icons.Search /></span>
              <input
                type="text"
                placeholder={isSpanish ? 'Buscar manuscrito por ID o Título...' : 'Search manuscript by ID or Title...'}
                value={searchManuscript}
                onChange={(e) => setSearchManuscript(e.target.value)}
                className="bg-transparent border-none outline-none text-xs w-full text-slate-700 font-medium placeholder-slate-400"
              />
            </div>
            
            {/* Folder Tabs */}
            <div className="flex items-center gap-6 overflow-x-auto custom-scrollbar">
              {[
                { value: 'all', label: isSpanish ? 'Todos los Expedientes' : 'All Records' },
                { value: 'pending', label: isSpanish ? 'En Curso' : 'In Progress' },
                { value: 'completed', label: isSpanish ? 'Completados' : 'Completed' },
                { value: 'rejected', label: isSpanish ? 'Declinados' : 'Declined' },
              ].map(filter => (
                <button
                  key={filter.value}
                  onClick={() => setFilterStatus(filter.value)}
                  className={`py-3 text-[10px] sm:text-xs font-bold uppercase tracking-widest whitespace-nowrap border-b-2 transition-all flex items-center gap-2 ${
                    filterStatus === filter.value
                      ? 'border-[#003b5c] text-[#003b5c]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {filter.label}
                  {filter.value === 'rejected' && rejectedSubmissions.length > 0 && (
                    <span className="bg-rose-100 text-rose-700 text-[9px] px-1.5 py-0.5 border border-rose-200">
                      {rejectedSubmissions.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ===================== MAIN CONTENT WORKSPACE ===================== */}
      <div className="max-w-[1920px] mx-auto px-4 sm:px-8 py-8">
        
        {(reviewError || inviteError) && (
          <div className="bg-rose-50 border-l-4 border-l-rose-700 text-rose-800 px-6 py-4 mb-8 flex items-center gap-3 shadow-sm">
            <Icons.AlertCircle />
            <span className="font-serif text-sm">{reviewError || inviteError}</span>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          
          {/* ===================== SIDEBAR: DOSSIER LIST ===================== */}
          <div className="w-full lg:w-96 xl:w-[400px] flex-shrink-0 bg-white border border-slate-200 shadow-sm flex flex-col">
            
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#003b5c] uppercase tracking-widest">
                {isSpanish ? 'Expedientes Asignados' : 'Assigned Dossiers'}
              </h3>
              <span className="bg-white border border-slate-200 text-slate-600 text-[10px] font-mono px-2 py-0.5">
                Total: {filteredSubmissions.length}
              </span>
            </div>

            <div className="flex-1 max-h-[65vh] lg:max-h-[calc(100vh-220px)] overflow-y-auto custom-scrollbar">
              {filteredSubmissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                  <Icons.Inbox />
                  <p className="font-serif text-slate-500 mt-4 text-lg">
                    {isSpanish ? 'El archivo está vacío.' : 'The archive is empty.'}
                  </p>
                  <p className="text-slate-400 text-xs mt-2 font-sans uppercase tracking-widest">
                    {isSpanish ? 'Ajuste los filtros de búsqueda' : 'Adjust search filters'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  
                  {/* PENDING SECTION */}
                  {pendingSubmissions.length > 0 && filterStatus !== 'rejected' && (
                    <div className="bg-slate-50/50">
                      <div className="px-6 py-3 bg-slate-100/50 border-b border-slate-100">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          {isSpanish ? 'En Revisión Activa' : 'Active Review'}
                        </span>
                      </div>
                      {pendingSubmissions.map(group => {
                        const latestTask = group.latestTask;
                        const isSelected = selectedSubmissionId === group.submissionId;
                        
                        return (
                          <div
                            key={group.submissionId}
                            onClick={() => handleSelectManuscript(group.submissionId, group.currentRound, group)}
                            className={`p-5 cursor-pointer transition-colors relative ${
                              isSelected
                                ? 'bg-[#FBF9F3] border-l-4 border-l-[#C0A86A]'
                                : 'bg-white border-l-4 border-l-transparent hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-mono text-[10px] text-slate-500 uppercase">
                                ID: {group.submission?.submissionId?.slice(0, 8) || 'N/A'}
                              </span>
                              <span className="text-[9px] px-2 py-0.5 border border-slate-200 text-slate-500 font-bold uppercase tracking-widest bg-white">
                                {group.submission?.area || 'General'}
                              </span>
                            </div>
                            
                            <h4 className={`font-serif text-sm leading-snug line-clamp-3 mb-3 ${isSelected ? 'text-[#003b5c] font-bold' : 'text-slate-800'}`}>
                              {group.submission?.title || 'Cargando título del manuscrito...'}
                            </h4>

                            <div className="flex items-center gap-1.5 mb-4">
                              {group.tasks.map((task, index) => (
                                <div
                                  key={task.id}
                                  className={`flex-1 h-1 ${
                                    task.status === TASK_STATES.COMPLETED ? 'bg-emerald-600' :
                                    task.id === latestTask.id ? 'bg-[#C0A86A]' : 'bg-slate-200'
                                  }`}
                                  title={`Round ${index + 1}`}
                                />
                              ))}
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                {isSpanish ? `Ronda ${group.currentRound}` : `Round ${group.currentRound}`}
                              </span>
                              
                              <span className={`text-[9px] px-2 py-1 uppercase tracking-widest font-bold border ${
                                latestTask?.status === TASK_STATES.PENDING ? 'bg-slate-100 text-slate-600 border-slate-200' :
                                latestTask?.status === TASK_STATES.DESK_REVIEW_IN_PROGRESS ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                latestTask?.status === TASK_STATES.REVIEWER_SELECTION ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                latestTask?.status === TASK_STATES.AWAITING_DECISION ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                group.submission?.finalReviewDocId ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                'bg-slate-50 text-slate-500 border-slate-200'
                              }`}>
                                {latestTask?.status === TASK_STATES.PENDING && (isSpanish ? 'Pendiente' : 'Pending')}
                                {latestTask?.status === TASK_STATES.DESK_REVIEW_IN_PROGRESS && (isSpanish ? 'Rev. Editorial' : 'Desk Review')}
                                {latestTask?.status === TASK_STATES.REVIEWER_SELECTION && (isSpanish ? 'Sel. Revisores' : 'Reviewer Sel.')}
                                {latestTask?.status === TASK_STATES.AWAITING_DECISION && (isSpanish ? 'Decisión Final' : 'Final Decision')}
                                {group.submission?.finalReviewDocId && !latestTask?.status === TASK_STATES.AWAITING_DECISION && 
                                  (isSpanish ? 'Consolidado' : 'Consolidated')}
                              </span>
                            </div>

                            {latestTask?.status === TASK_STATES.PENDING && (
                              <button
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  handleStartReview(latestTask.id); 
                                }}
                                className="w-full mt-4 bg-[#003b5c] text-white text-[10px] uppercase tracking-widest font-bold py-2.5 hover:bg-[#002840] transition-colors"
                              >
                                {isSpanish ? 'Iniciar Revisión Editorial' : 'Start Desk Review'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* COMPLETED SECTION */}
                  {completedSubmissions.length > 0 && filterStatus !== 'rejected' && (
                    <div className="bg-emerald-50/20">
                      <div className="px-6 py-3 bg-emerald-50/50 border-b border-emerald-100/50">
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">
                          {isSpanish ? 'Expedientes Aprobados' : 'Approved Records'}
                        </span>
                      </div>
                      {completedSubmissions.map(group => {
                        const isSelected = selectedSubmissionId === group.submissionId;
                        return (
                          <div
                            key={group.submissionId}
                            onClick={() => handleSelectManuscript(group.submissionId, group.tasks.length, group)}
                            className={`p-5 cursor-pointer transition-colors relative ${
                              isSelected
                                ? 'bg-[#FBF9F3] border-l-4 border-l-emerald-600'
                                : 'bg-white border-l-4 border-l-transparent hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-mono text-[10px] text-slate-500">
                                {group.submission?.submissionId?.slice(0, 8)}
                              </span>
                              <span className="text-[9px] px-2 py-0.5 text-emerald-700 bg-emerald-50 border border-emerald-200 font-bold uppercase tracking-widest flex items-center gap-1">
                                <Icons.CheckCircle /> {isSpanish ? 'Aceptado' : 'Accepted'}
                              </span>
                            </div>
                            <h4 className="font-serif text-sm leading-snug text-slate-800 line-clamp-2">
                              {group.submission?.title}
                            </h4>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* REJECTED SECTION */}
                  {rejectedSubmissions.length > 0 && (filterStatus === 'rejected' || filterStatus === 'all') && (
                    <div className="bg-rose-50/20">
                      <div className="px-6 py-3 bg-rose-50/50 border-b border-rose-100/50">
                        <span className="text-[10px] font-bold text-rose-700 uppercase tracking-widest">
                          {isSpanish ? 'Expedientes Declinados' : 'Declined Records'}
                        </span>
                      </div>
                      {rejectedSubmissions.map(group => {
                        const isSelected = selectedSubmissionId === group.submissionId;
                        return (
                          <div
                            key={group.submissionId}
                            onClick={() => handleSelectManuscript(group.submissionId, group.tasks.length, group)}
                            className={`p-5 cursor-pointer transition-colors relative ${
                              isSelected
                                ? 'bg-rose-50/30 border-l-4 border-l-rose-700'
                                : 'bg-white border-l-4 border-l-transparent hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-mono text-[10px] text-slate-500">
                                {group.submission?.submissionId?.slice(0, 8)}
                              </span>
                              <span className="text-[9px] px-2 py-0.5 text-rose-700 bg-rose-50 border border-rose-200 font-bold uppercase tracking-widest flex items-center gap-1">
                                <Icons.Ban /> {isSpanish ? 'Declinado' : 'Declined'}
                              </span>
                            </div>
                            <h4 className="font-serif text-sm leading-snug text-slate-800 line-clamp-2 line-through decoration-rose-300">
                              {group.submission?.title}
                            </h4>
                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>
              )}
            </div>
          </div>

          {/* ===================== MAIN PANEL: WORKSPACE ===================== */}
          <div className="flex-1 min-h-0 min-w-0">
            {selectedTask ? (
              <DeskReviewTab
                task={selectedTask}
                key={`${selectedTask?.id}-${selectedRound}`}
                user={user}
                onComplete={handleCompleteDeskReview}
                loading={reviewLoading}
                onBackToPanel={() => setSelectedSubmissionId(null)}
                // Props para pestañas integradas
                invitations={invitations}
                potentialReviewers={filteredReviewers}
                selectedReviewerId={selectedReviewerId}
                setSelectedReviewerId={setSelectedReviewerId}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                onSendInvitation={handleSendInvitation}
                onProceedToDecision={handleProceedToDecision}
                inviteLoading={inviteLoading}
                isConsolidating={isConsolidating}
                submittedReviews={submittedReviews}
                reviewers={reviewers}
                isConsolidated={isConsolidated}
                onFinalDecision={handleFinalDecision}
                // Selector de rondas
                allTasks={groupedSubmissions.find(g => g.submissionId === selectedSubmissionId)?.tasks || []}
                selectedRound={selectedRound}
                onRoundChange={setSelectedRound}
              />
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white border border-slate-200 shadow-sm flex flex-col items-center justify-center py-32 px-8 h-[calc(100vh-220px)]"
              >
                <div className="w-20 h-20 bg-slate-50 border border-slate-100 flex items-center justify-center mb-6 text-[#C0A86A]">
                  <Icons.FileText />
                </div>
                <h3 className="text-2xl font-serif text-[#003b5c] mb-3 text-center">
                  {isSpanish ? 'Mesa de Trabajo Editorial' : 'Editorial Workspace'}
                </h3>
                <div className="w-12 h-0.5 bg-[#C0A86A] mb-4"></div>
                <p className="text-slate-500 text-center max-w-md font-sans text-sm">
                  {isSpanish 
                    ? 'Seleccione un expediente del panel lateral para revisar el manuscrito, asignar pares evaluadores o emitir dictámenes finales.'
                    : 'Select a dossier from the side panel to review the manuscript, assign peer reviewers, or issue final decisions.'}
                </p>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Estilos personalizados */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #F8F9FB;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        
        /* Scroll horizontal suave para filtros en móvil */
        .overflow-x-auto {
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .overflow-x-auto::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default DeskReviewPanel;