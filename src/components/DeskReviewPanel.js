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

// ============ ICONOS SVG PROFESIONALES ============
const Icons = {
  FileText: () => (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  CheckCircle: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  XCircle: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  AlertCircle: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  Ban: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  ),
  Search: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  Inbox: () => (
    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Barra de navegación superior */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-900 to-blue-700 rounded-xl flex items-center justify-center">
                  <Icons.FileText />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">
                    {isSpanish ? 'Panel de Revisión' : 'Review Panel'}
                  </h1>
                  <p className="text-xs text-gray-500">
                    {isSpanish ? 'Editor de Sección' : 'Section Editor'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2">
                <Icons.Search />
                <input
                  type="text"
                  placeholder={isSpanish ? 'Buscar manuscrito...' : 'Search manuscript...'}
                  value={searchManuscript}
                  onChange={(e) => setSearchManuscript(e.target.value)}
                  className="bg-transparent border-none outline-none text-sm text-gray-700 placeholder-gray-400 w-48"
                />
              </div>
              
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl p-1">
                {[
                  { value: 'all', label: isSpanish ? 'Todos' : 'All' },
                  { value: 'pending', label: isSpanish ? 'Pendientes' : 'Pending' },
                  { value: 'completed', label: isSpanish ? 'Completados' : 'Completed' },
                  { value: 'rejected', label: isSpanish ? 'Rechazados' : 'Rejected' },
                ].map(filter => (
                  <button
                    key={filter.value}
                    onClick={() => setFilterStatus(filter.value)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                      filterStatus === filter.value
                        ? 'bg-blue-900 text-white shadow-md'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {filter.label}
                    {filter.value === 'rejected' && rejectedSubmissions.length > 0 && (
                      <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                        {rejectedSubmissions.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {(reviewError || inviteError) && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-2xl mb-6 flex items-center gap-3">
            <Icons.AlertCircle />
            <span className="font-medium">{reviewError || inviteError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Lista de manuscritos - Sidebar */}
          <div className="lg:col-span-4 xl:col-span-3">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">
                  {isSpanish ? 'Manuscritos' : 'Manuscripts'}
                </h3>
                <span className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full font-medium">
                  {filteredSubmissions.length}
                </span>
              </div>

              {filteredSubmissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <Icons.Inbox />
                  </div>
                  <p className="text-gray-500 font-medium">
                    {isSpanish ? 'No hay manuscritos' : 'No manuscripts found'}
                  </p>
                  <p className="text-gray-400 text-sm mt-1">
                    {isSpanish ? 'Cambia los filtros para ver más' : 'Change filters to see more'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-2 custom-scrollbar">
                  {/* Manuscritos pendientes */}
                  {pendingSubmissions.length > 0 && filterStatus !== 'rejected' && (
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">
                        {isSpanish ? 'En Proceso' : 'In Progress'}
                      </h4>
                      <div className="space-y-2">
                        {pendingSubmissions.map(group => {
                          const latestTask = group.latestTask;
                          const isSelected = selectedSubmissionId === group.submissionId;
                          
                          return (
                            <motion.div
                              key={group.submissionId}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              onClick={() => handleSelectManuscript(group.submissionId, group.currentRound, group)}
                              className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                                isSelected
                                  ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-100'
                                  : 'border-gray-200 hover:border-blue-300 bg-white hover:shadow-md'
                              }`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <h4 className="font-semibold text-gray-900 text-sm line-clamp-2 flex-1">
                                  {group.submission?.title || 'Cargando...'}
                                </h4>
                              </div>
                              
                              <div className="flex items-center justify-between text-xs mb-2">
                                <span className="font-mono text-gray-500">
                                  {group.submission?.submissionId?.slice(0, 8) || 'Sin ID'}
                                </span>
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                                  {group.submission?.area || 'Sin área'}
                                </span>
                              </div>

                              <div className="flex items-center gap-1 mt-2 mb-2">
                                {group.tasks.map((task, index) => (
                                  <div
                                    key={task.id}
                                    className={`flex-1 h-1.5 rounded-full ${
                                      task.status === TASK_STATES.COMPLETED
                                        ? 'bg-emerald-500'
                                        : task.id === latestTask.id
                                        ? 'bg-blue-500'
                                        : 'bg-gray-300'
                                    }`}
                                    title={`Ronda ${index + 1}: ${
                                      task.status === TASK_STATES.COMPLETED ? 'Completada' : 'En curso'
                                    }`}
                                  />
                                ))}
                              </div>

                              <div className="flex items-center justify-between mt-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500 font-medium">
                                    {isSpanish ? `Ronda ${group.currentRound}` : `Round ${group.currentRound}`}
                                  </span>
                                </div>
                                <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                                  latestTask?.status === TASK_STATES.PENDING ? 'bg-amber-100 text-amber-700' :
                                  latestTask?.status === TASK_STATES.DESK_REVIEW_IN_PROGRESS ? 'bg-blue-100 text-blue-700' :
                                  latestTask?.status === TASK_STATES.REVIEWER_SELECTION ? 'bg-purple-100 text-purple-700' :
                                  latestTask?.status === TASK_STATES.AWAITING_DECISION ? 'bg-emerald-100 text-emerald-700' :
                                  group.submission?.finalReviewDocId ? 'bg-teal-100 text-teal-700' :
                                  'bg-gray-100 text-gray-600'
                                }`}>
                                  {latestTask?.status === TASK_STATES.PENDING && (isSpanish ? 'Pendiente' : 'Pending')}
                                  {latestTask?.status === TASK_STATES.DESK_REVIEW_IN_PROGRESS && (isSpanish ? 'En revisión' : 'In review')}
                                  {latestTask?.status === TASK_STATES.REVIEWER_SELECTION && (isSpanish ? 'Revisores' : 'Reviewers')}
                                  {latestTask?.status === TASK_STATES.AWAITING_DECISION && (isSpanish ? 'Decisión' : 'Decision')}
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
                                  className="w-full mt-3 bg-blue-900 text-white text-xs px-4 py-2 rounded-xl hover:bg-blue-800 transition-colors font-medium"
                                >
                                  {isSpanish ? 'Iniciar Revisión' : 'Start Review'}
                                </button>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Manuscritos completados */}
                  {completedSubmissions.length > 0 && filterStatus !== 'rejected' && (
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 mt-6 px-1">
                        {isSpanish ? 'Completados' : 'Completed'}
                      </h4>
                      <div className="space-y-2">
                        {completedSubmissions.map(group => {
                          const isSelected = selectedSubmissionId === group.submissionId;
                          
                          return (
                            <motion.div
                              key={group.submissionId}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              onClick={() => handleSelectManuscript(group.submissionId, group.tasks.length, group)}
                              className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                                isSelected
                                  ? 'border-emerald-500 bg-emerald-50 shadow-lg shadow-emerald-100'
                                  : 'border-gray-200 hover:border-emerald-300 bg-gray-50 hover:shadow-md'
                              }`}
                            >
                              <h4 className="font-semibold text-gray-900 text-sm line-clamp-2 mb-2">
                                {group.submission?.title || 'Cargando...'}
                              </h4>
                              
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-mono text-gray-500">
                                  {group.submission?.submissionId?.slice(0, 8) || 'Sin ID'}
                                </span>
                                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full font-medium flex items-center gap-1">
                                  <Icons.CheckCircle />
                                  {isSpanish ? 'Aceptado' : 'Accepted'}
                                </span>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Manuscritos rechazados */}
                  {rejectedSubmissions.length > 0 && (filterStatus === 'rejected' || filterStatus === 'all') && (
                    <div>
                      <h4 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-3 mt-6 px-1 flex items-center gap-2">
                        <Icons.XCircle />
                        {isSpanish ? 'Rechazados' : 'Rejected'}
                      </h4>
                      <div className="space-y-2">
                        {rejectedSubmissions.map(group => {
                          const isSelected = selectedSubmissionId === group.submissionId;
                          
                          return (
                            <motion.div
                              key={group.submissionId}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              onClick={() => handleSelectManuscript(group.submissionId, group.tasks.length, group)}
                              className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                                isSelected
                                  ? 'border-red-500 bg-red-50 shadow-lg shadow-red-100'
                                  : 'border-red-200 hover:border-red-400 bg-red-50/50 hover:shadow-md'
                              }`}
                            >
                              <div className="flex items-start gap-2 mb-2">
                                <Icons.Ban className="text-red-500 w-4 h-4 flex-shrink-0 mt-0.5" />
                                <h4 className="font-semibold text-gray-800 text-sm line-clamp-2">
                                  {group.submission?.title || 'Cargando...'}
                                </h4>
                              </div>
                              
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-mono text-gray-500">
                                  {group.submission?.submissionId?.slice(0, 8) || 'Sin ID'}
                                </span>
                                <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full font-medium flex items-center gap-1">
                                  <Icons.XCircle />
                                  {isSpanish ? 'Rechazado' : 'Rejected'}
                                </span>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Panel de trabajo - Área principal */}
          <div className="lg:col-span-8 xl:col-span-9">
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
                className="bg-white rounded-2xl shadow-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center py-24"
              >
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                  <Icons.FileText />
                </div>
                <h3 className="text-xl font-bold text-gray-700 mb-2">
                  {isSpanish ? 'Selecciona un manuscrito' : 'Select a manuscript'}
                </h3>
                <p className="text-gray-500 text-center max-w-md">
                  {isSpanish 
                    ? 'Elige un manuscrito de la lista para comenzar la revisión editorial'
                    : 'Choose a manuscript from the list to start the editorial review'}
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
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
};

export default DeskReviewPanel;