// src/components/DeskReviewPanel.js (VERSIÓN FINAL CONSOLIDADA)

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
import { ReviewerManagementTab } from './ReviewerManagementTab';
import { FinalDecisionTab } from './FinalDecisionTab';
import { MetadataRefinementTab } from './MetadataRefinementTab';

const DeskReviewPanel = ({ user }) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
  const [selectedRound, setSelectedRound] = useState(1);
  const [activeTaskTab, setActiveTaskTab] = useState('deskReview');
  
  const [potentialReviewers, setPotentialReviewers] = useState([]);
  const [selectedReviewerId, setSelectedReviewerId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [invitations, setInvitations] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  
  // ✅ NUEVO: Estado para las revisiones completadas (submitted)
  const [submittedReviews, setSubmittedReviews] = useState([]);
  
  // ✅ NUEVO: Estado para controlar la consolidación
  const [isConsolidating, setIsConsolidating] = useState(false);
  
  // ✅ NUEVO: Estado para saber si ya se consolidó
  const [isConsolidated, setIsConsolidated] = useState(false);

  const { loading: reviewLoading, error: reviewError, submitDeskReviewDecision } = useEditorialReview(user);
  const { loading: inviteLoading, error: inviteError, sendInvitation } = useReviewerInvitation(user);
  const { loading: tasksLoading, getMyTasks, makeFinalDecision, startDeskReview } = useEditorialTasks(user);

  const userRoles = user?.roles || [];
  const hasPermission = userRoles.includes('Editor de Sección') || userRoles.includes('Director General');
  
  // Escuchar TODAS las tareas del editor (sin cambios)
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

  // AGRUPAR TAREAS POR SUBMISSION ID (sin cambios)
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
          currentRound: 1
        };
      }
      
      grouped[subId].tasks.push(task);
      grouped[subId].tasks.sort((a, b) => (a.round || 1) - (b.round || 1));
      
      if (task.status !== TASK_STATES.COMPLETED) {
        grouped[subId].hasPendingTasks = true;
        grouped[subId].currentRound = task.round || 1;
      } else {
        grouped[subId].hasCompletedTasks = true;
      }
      
      grouped[subId].latestTask = grouped[subId].tasks[grouped[subId].tasks.length - 1];
    });
    
    return Object.values(grouped);
  }, [assignedTasks]);

  // Obtener la tarea seleccionada (sin cambios)
  const selectedTask = useMemo(() => {
    if (!selectedSubmissionId) return null;
    
    const submission = groupedSubmissions.find(g => g.submissionId === selectedSubmissionId);
    if (!submission) return null;
    
    const task = submission.tasks.find(t => (t.round || 1) === selectedRound);
    return task || submission.latestTask;
  }, [selectedSubmissionId, selectedRound, groupedSubmissions]);

  // ✅ MODIFICADO: Cargar revisiones completadas (submitted) en tiempo real
  useEffect(() => {
    if (!selectedTask) {
      setSubmittedReviews([]);
      setIsConsolidated(false);
      return;
    }

    // Verificar si ya está consolidado (tiene finalReviewDocId)
    const checkConsolidation = async () => {
      if (selectedTask.submission?.finalReviewDocId) {
        setIsConsolidated(true);
      } else {
        setIsConsolidated(false);
      }
    };
    checkConsolidation();

    // Escuchar revisiones completadas (submitted)
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
      console.log(`📊 Revisiones completadas: ${reviews.length}`);
    }, (error) => {
      console.error('Error escuchando revisiones:', error);
    });

    return () => unsubscribe();
  }, [selectedTask]);

  // Cargar TODAS las asignaciones (invitaciones + submitted) para el tab de revisores
  useEffect(() => {
    if (!selectedTask) {
      setInvitations([]);
      setReviewers([]);
      return;
    }

    const loadAllAssignments = async () => {
      // Cargar invitaciones (todos los estados menos submitted)
      const invQ = query(
        collection(db, 'reviewerInvitations'),
        where('editorialTaskId', '==', selectedTask.id)
      );
      const invSnapshot = await getDocs(invQ);
      setInvitations(invSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Cargar todas las asignaciones (incluye submitted y otros estados)
      const revQ = query(
        collection(db, 'reviewerAssignments'),
        where('editorialTaskId', '==', selectedTask.id)
      );
      const revSnapshot = await getDocs(revQ);
      setReviewers(revSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };

    loadAllAssignments();
  }, [selectedTask]);

  // Cargar revisores potenciales (sin cambios)
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

  // ✅ MODIFICADO: handleCompleteDeskReview actualizado
  const handleCompleteDeskReview = async (result) => {
    if (!selectedTask?.editorialReviewId) {
      console.error('No se encontró editorialReviewId para esta tarea');
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
      // Después de completar desk review, redirigir a gestión de revisores
      setActiveTaskTab('reviewerManagement');
      alert(isSpanish 
        ? 'Revisión completada. Ahora puedes gestionar revisores.' 
        : 'Review completed. You can now manage reviewers.');
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
      
      // Recargar invitaciones
      const q = query(
        collection(db, 'reviewerInvitations'),
        where('editorialTaskId', '==', selectedTask.id)
      );
      const snapshot = await getDocs(q);
      setInvitations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }
  };

  // ✅ NUEVO: Manejar la consolidación de revisiones
  const handleProceedToDecision = async () => {
    const requiredReviews = selectedTask?.requiredReviews || 2;
    
    if (submittedReviews.length < requiredReviews) {
      alert(isSpanish 
        ? `Se necesitan al menos ${requiredReviews} revisiones completadas. Actualmente hay ${submittedReviews.length}.` 
        : `At least ${requiredReviews} completed reviews are needed. Currently ${submittedReviews.length}.`);
      return;
    }

    if (!confirm(isSpanish 
      ? `¿Proceder a la decisión final con ${submittedReviews.length} revisiones? Se creará un documento consolidado y ya no podrás solicitar más revisiones para esta ronda.` 
      : `Proceed to final decision with ${submittedReviews.length} reviews? A consolidated document will be created and you won't be able to request more reviews for this round.`
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
        setActiveTaskTab('finalDecision');
        alert(isSpanish 
          ? '¡Documento consolidado creado! Ahora puedes tomar la decisión final.' 
          : 'Consolidated document created! You can now make the final decision.');
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (error) {
      console.error('Error al consolidar:', error);
      alert(isSpanish 
        ? `Error al crear documento consolidado: ${error.message}` 
        : `Error creating consolidated document: ${error.message}`);
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

  // Filtrar revisores disponibles (sin cambios)
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

  const pendingSubmissions = groupedSubmissions.filter(g => g.hasPendingTasks);
  const completedSubmissions = groupedSubmissions.filter(g => !g.hasPendingTasks && g.hasCompletedTasks);

  if (!hasPermission) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 max-w-7xl mx-auto font-serif">
      <h2 className="font-['Playfair_Display'] text-4xl font-bold text-[#0A1929] mb-2 tracking-tight">
        {isSpanish ? 'Revisión Editorial' : 'Editorial Review'}
      </h2>
      <p className="text-[#5A6B7A] font-['Lora'] text-lg mb-8 border-b border-[#E5E9F0] pb-4">
        {isSpanish ? 'Evaluación de manuscritos asignados' : 'Evaluation of assigned manuscripts'}
      </p>

      {(reviewError || inviteError) && (
        <div className="bg-[#FEF2F2] border-l-4 border-[#991B1B] text-[#991B1B] p-4 rounded-lg mb-6 font-['Lora']">
          {reviewError || inviteError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Lista de manuscritos agrupados (sin cambios) */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="font-['Playfair_Display'] text-lg font-semibold text-[#0A1929] border-b-2 border-[#C0A86A] pb-2 mb-4">
            {isSpanish ? 'Mis Manuscritos' : 'My Manuscripts'}
          </h3>
          
          {groupedSubmissions.length === 0 ? (
            <div className="bg-[#F5F7FA] rounded-xl p-8 text-center border border-[#E5E9F0]">
              <p className="text-[#5A6B7A] font-['Lora'] italic">
                {isSpanish ? 'No tienes manuscritos asignados' : 'No manuscripts assigned'}
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {pendingSubmissions.length > 0 && (
                <>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-2 mb-1">
                    {isSpanish ? 'EN PROCESO' : 'IN PROGRESS'}
                  </h4>
                  {pendingSubmissions.map(group => {
                    const latestTask = group.latestTask;
                    const isSelected = selectedSubmissionId === group.submissionId;
                    
                    return (
                      <motion.div
                        key={group.submissionId}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => {
                          setSelectedSubmissionId(group.submissionId);
                          setSelectedRound(group.currentRound);
                          // ✅ Al seleccionar, ir al tab de gestión de revisores si está en ese estado
                          if (latestTask?.status === TASK_STATES.REVIEWER_SELECTION || 
                              latestTask?.status === TASK_STATES.AWAITING_REVIEWER_RESPONSES || 
                              latestTask?.status === TASK_STATES.REVIEWS_IN_PROGRESS) {
                            setActiveTaskTab('reviewerManagement');
                          } else {
                            setActiveTaskTab('deskReview');
                          }
                        }}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#C0A86A] bg-[#FBF9F3]'
                            : 'border-[#E5E9F0] hover:border-[#C0A86A] bg-white hover:shadow-md'
                        }`}
                      >
                        <h4 className="font-['Playfair_Display'] font-bold text-[#0A1929] mb-2 line-clamp-2">
                          {group.submission?.title || 'Cargando...'}
                        </h4>
                        
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="font-mono text-[#5A6B7A]">
                            {group.submission?.submissionId?.slice(0, 8) || 'Sin ID'}
                          </span>
                          <span className="px-2 py-1 bg-[#E8F0FE] text-[#1E4A7A] rounded-full">
                            {group.submission?.area || 'Sin área'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 mt-2 mb-2">
                          {group.tasks.map((task, index) => (
                            <div
                              key={task.id}
                              className={`flex-1 h-1 rounded-full ${
                                task.status === TASK_STATES.COMPLETED
                                  ? 'bg-green-500'
                                  : task.id === latestTask.id
                                  ? 'bg-[#C0A86A]'
                                  : 'bg-gray-300'
                              }`}
                              title={`Ronda ${index + 1}: ${
                                task.status === TASK_STATES.COMPLETED ? 'Completada' : 'En curso'
                              }`}
                            />
                          ))}
                        </div>

                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              {isSpanish ? `Ronda ${group.currentRound}` : `Round ${group.currentRound}`}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              latestTask?.status === TASK_STATES.PENDING ? 'bg-yellow-100 text-yellow-700' :
                              latestTask?.status === TASK_STATES.DESK_REVIEW_IN_PROGRESS ? 'bg-blue-100 text-blue-700' :
                              latestTask?.status === TASK_STATES.REVIEWER_SELECTION ? 'bg-purple-100 text-purple-700' :
                              latestTask?.status === TASK_STATES.AWAITING_DECISION ? 'bg-green-100 text-green-700' :
                              group.submission?.finalReviewDocId ? 'bg-teal-100 text-teal-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {latestTask?.status === TASK_STATES.PENDING && (isSpanish ? 'Pendiente' : 'Pending')}
                              {latestTask?.status === TASK_STATES.DESK_REVIEW_IN_PROGRESS && (isSpanish ? 'En revisión' : 'In review')}
                              {latestTask?.status === TASK_STATES.REVIEWER_SELECTION && (isSpanish ? 'Revisores' : 'Reviewers')}
                              {latestTask?.status === TASK_STATES.AWAITING_DECISION && (isSpanish ? 'Decisión pendiente' : 'Decision pending')}
                              {group.submission?.finalReviewDocId && !latestTask?.status === TASK_STATES.AWAITING_DECISION && 
                                (isSpanish ? 'Revisión consolidada' : 'Review consolidated')}
                            </span>
                          </div>
                          
                          {latestTask?.status === TASK_STATES.PENDING && (
                            <button
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                handleStartReview(latestTask.id); 
                              }}
                              className="text-xs bg-[#C0A86A] text-white px-2 py-1 rounded hover:bg-[#A58D4F]"
                            >
                              {isSpanish ? 'Iniciar' : 'Start'}
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </>
              )}

              {completedSubmissions.length > 0 && (
                <>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-4 mb-1">
                    {isSpanish ? 'COMPLETADOS' : 'COMPLETED'}
                  </h4>
                  {completedSubmissions.map(group => {
                    const isSelected = selectedSubmissionId === group.submissionId;
                    
                    return (
                      <motion.div
                        key={group.submissionId}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => {
                          setSelectedSubmissionId(group.submissionId);
                          setSelectedRound(group.tasks.length);
                          setActiveTaskTab('metadataRefinement');
                        }}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#C0A86A] bg-[#FBF9F3]'
                            : 'border-gray-200 hover:border-[#C0A86A] bg-gray-50 hover:shadow-md'
                        }`}
                      >
                        <h4 className="font-['Playfair_Display'] font-bold text-[#0A1929] mb-2 line-clamp-2">
                          {group.submission?.title || 'Cargando...'}
                        </h4>
                        
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono text-[#5A6B7A]">
                            {group.submission?.submissionId?.slice(0, 8) || 'Sin ID'}
                          </span>
                          {group.submission?.status === 'accepted' && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full">
                              {isSpanish ? 'ACEPTADO' : 'ACCEPTED'}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>

        {/* ✅ Panel de trabajo MODIFICADO */}
        <div className="lg:col-span-2">
          {selectedTask ? (
            <div>
              {/* Selector de rondas (sin cambios) */}
              {groupedSubmissions.find(g => g.submissionId === selectedSubmissionId)?.tasks.length > 1 && (
                <div className="mb-4 flex items-center gap-2 border-b border-gray-200 pb-2">
                  <span className="text-sm text-gray-600">
                    {isSpanish ? 'Ronda:' : 'Round:'}
                  </span>
                  <div className="flex gap-1">
                    {groupedSubmissions
                      .find(g => g.submissionId === selectedSubmissionId)
                      ?.tasks.map((task, index) => (
                        <button
                          key={task.id}
                          onClick={() => setSelectedRound(task.round || index + 1)}
                          className={`px-3 py-1 text-sm rounded-md transition-colors ${
                            (task.round || index + 1) === selectedRound
                              ? 'bg-[#C0A86A] text-white'
                              : task.status === TASK_STATES.COMPLETED
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          title={`Ronda ${index + 1} - ${
                            task.status === TASK_STATES.COMPLETED ? 'Completada' : 'En curso'
                          }`}
                        >
                          {index + 1}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* ✅ MODIFICADO: Tabs dinámicos */}
              <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
                {/* Tab de Revisión Editorial - siempre visible */}
                <button
                  onClick={() => setActiveTaskTab('deskReview')}
                  className={`px-4 py-2 font-medium text-sm transition-colors whitespace-nowrap ${
                    activeTaskTab === 'deskReview' 
                      ? 'text-[#C0A86A] border-b-2 border-[#C0A86A]' 
                      : 'text-[#5A6B7A] hover:text-[#0A1929]'
                  }`}
                >
                  {isSpanish ? 'Revisión Editorial' : 'Desk Review'}
                </button>
                
                {/* ✅ MODIFICADO: Tab de Gestión de Revisores - visible cuando corresponde */}
                {(selectedTask.status === TASK_STATES.REVIEWER_SELECTION || 
                  selectedTask.status === TASK_STATES.AWAITING_REVIEWER_RESPONSES || 
                  selectedTask.status === TASK_STATES.REVIEWS_IN_PROGRESS ||
                  selectedTask.status === TASK_STATES.AWAITING_DECISION) && (
                  <button
                    onClick={() => setActiveTaskTab('reviewerManagement')}
                    className={`px-4 py-2 font-medium text-sm transition-colors whitespace-nowrap ${
                      activeTaskTab === 'reviewerManagement' 
                        ? 'text-[#C0A86A] border-b-2 border-[#C0A86A]' 
                        : 'text-[#5A6B7A] hover:text-[#0A1929]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {isSpanish ? 'Gestión de Revisores' : 'Reviewer Management'}
                      {submittedReviews.length > 0 && (
                        <span className="bg-[#C0A86A] text-white text-xs px-2 py-0.5 rounded-full">
                          {submittedReviews.length}
                        </span>
                      )}
                    </span>
                  </button>
                )}
                
                {/* ✅ MODIFICADO: Tab de Decisión Final - solo si ya se consolidó */}
                {(isConsolidated || selectedTask.status === TASK_STATES.AWAITING_DECISION) && (
                  <button
                    onClick={() => setActiveTaskTab('finalDecision')}
                    className={`px-4 py-2 font-medium text-sm transition-colors whitespace-nowrap ${
                      activeTaskTab === 'finalDecision' 
                        ? 'text-[#C0A86A] border-b-2 border-[#C0A86A]' 
                        : 'text-[#5A6B7A] hover:text-[#0A1929]'
                    }`}
                  >
                    {isSpanish ? 'Decisión Final' : 'Final Decision'}
                  </button>
                )}

                {/* Tab de Metadatos - para completados */}
                {selectedTask.submission?.status === 'accepted' && (
                  <button
                    onClick={() => setActiveTaskTab('metadataRefinement')}
                    className={`px-4 py-2 font-medium text-sm transition-colors whitespace-nowrap ${
                      activeTaskTab === 'metadataRefinement' 
                        ? 'text-[#C0A86A] border-b-2 border-[#C0A86A]' 
                        : 'text-[#5A6B7A] hover:text-[#0A1929]'
                    }`}
                  >
                    {isSpanish ? 'Refinar Metadatos' : 'Refine Metadata'}
                  </button>
                )}
              </div>

              {/* Contenido de los tabs */}
              {activeTaskTab === 'deskReview' && (
                <DeskReviewTab
                  task={selectedTask}
                  user={user}
                  onComplete={handleCompleteDeskReview}
                  loading={reviewLoading}
                />
              )}

              {/* ✅ MODIFICADO: Tab de Gestión de Revisores con nuevas props */}
              {activeTaskTab === 'reviewerManagement' && (
                <ReviewerManagementTab
                  task={selectedTask}
                  invitations={invitations}
                  potentialReviewers={filteredReviewers}
                  selectedReviewerId={selectedReviewerId}
                  setSelectedReviewerId={setSelectedReviewerId}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  onSendInvitation={handleSendInvitation}
                  onProceedToDecision={handleProceedToDecision}
                  loading={inviteLoading || isConsolidating}
                  submittedReviews={submittedReviews}
                />
              )}

              {activeTaskTab === 'finalDecision' && (
                <FinalDecisionTab
                  task={selectedTask}
                  reviewers={[...submittedReviews, ...reviewers.filter(r => r.status === 'submitted')]}
                  onSubmitDecision={handleFinalDecision}
                  loading={reviewLoading}
                />
              )}

              {activeTaskTab === 'metadataRefinement' && (
                <MetadataRefinementTab
                  submission={selectedTask.submission}
                  user={user}
                  onComplete={() => {}}
                />
              )}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-96 bg-[#F5F7FA] rounded-xl border-2 border-dashed border-[#E5E9F0]"
            >
              <svg className="w-16 h-16 text-[#C0A86A] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-[#5A6B7A] text-lg font-['Lora'] italic">
                {isSpanish 
                  ? 'Selecciona un manuscrito para comenzar' 
                  : 'Select a manuscript to start'}
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeskReviewPanel;