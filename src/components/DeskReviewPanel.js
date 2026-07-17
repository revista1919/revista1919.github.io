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
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  CheckCircle: () => (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  XCircle: () => (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  AlertCircle: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  Ban: () => (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  ),
  Search: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  ),
  Inbox: () => (
    <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
  
  const [potentialReviewers, setPotentialReviewers] = useState([]);
  const [selectedReviewerId, setSelectedReviewerId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [invitations, setInvitations] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  
  const [submittedReviews, setSubmittedReviews] = useState([]);
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [isConsolidated, setIsConsolidated] = useState(false);
  
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchManuscript, setSearchManuscript] = useState('');

  const { loading: reviewLoading, error: reviewError, submitDeskReviewDecision } = useEditorialReview(user);
  const { loading: inviteLoading, error: inviteError, sendInvitation } = useReviewerInvitation(user);
  const { loading: tasksLoading, getMyTasks, makeFinalDecision, startDeskReview } = useEditorialTasks(user);

  const userRoles = user?.roles || [];
  const hasPermission = userRoles.includes('Editor de Sección') || userRoles.includes('Director General');
  
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
      if (hasRejection) grouped[subId].finalDecision = 'rejected';
      else if (task.decision === 'accept' || task.submission?.status === 'accepted') grouped[subId].finalDecision = 'accepted';
      
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

  const selectedTask = useMemo(() => {
    if (!selectedSubmissionId) return null;
    const submission = groupedSubmissions.find(g => g.submissionId === selectedSubmissionId);
    if (!submission) return null;
    const task = submission.tasks.find(t => (t.round || 1) === selectedRound);
    return task || submission.latestTask;
  }, [selectedSubmissionId, selectedRound, groupedSubmissions]);

  useEffect(() => {
    if (!selectedTask) {
      setSubmittedReviews([]);
      setIsConsolidated(false);
      return;
    }
    const checkConsolidation = async () => setIsConsolidated(!!selectedTask.submission?.finalReviewDocId);
    checkConsolidation();

    const q = query(
      collection(db, 'reviewerAssignments'),
      where('editorialTaskId', '==', selectedTask.id),
      where('status', '==', 'submitted')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSubmittedReviews(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, [selectedTask]);

  useEffect(() => {
    if (!selectedTask) {
      setInvitations([]);
      setReviewers([]);
      return;
    }

    const loadAllAssignments = async () => {
      const invQ = query(collection(db, 'reviewerInvitations'), where('editorialTaskId', '==', selectedTask.id));
      const invSnapshot = await getDocs(invQ);
      setInvitations(invSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const revQ = query(collection(db, 'reviewerAssignments'), where('editorialTaskId', '==', selectedTask.id));
      const revSnapshot = await getDocs(revQ);
      setReviewers(revSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    loadAllAssignments();
  }, [selectedTask]);

useEffect(() => {
    const loadReviewers = async () => {
      // Cargar de la coleccion 'reviewers' que tiene areasOfExpertise y stats
      const reviewersSnapshot = await getDocs(collection(db, 'reviewers'));
      const reviewersData = {};
      
      reviewersSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.uid) {
          reviewersData[data.uid] = {
            id: data.uid,
            ...data,
            displayName: data.displayName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.email || ''
          };
        }
      });
      
      // Cargar de 'users' como fallback para los que no estan en 'reviewers'
      const usersSnapshot = await getDocs(
        query(collection(db, 'users'), where('roles', 'array-contains-any', ['Revisor', 'Editor de Sección']))
      );
      
      const allReviewers = [];
      
      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        const uid = doc.id;
        
        if (reviewersData[uid]) {
          // Ya existe en reviewers, usar esos datos (mas completos)
          allReviewers.push(reviewersData[uid]);
        } else {
          // No tiene perfil en reviewers, usar datos de users
          allReviewers.push({
            id: uid,
            ...userData,
            displayName: userData.displayName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.email,
            areasOfExpertise: userData.areasOfExpertise || [],
            stats: userData.stats || {}
          });
        }
      });
      
      console.log('Reviewers cargados:', allReviewers.length);
      console.log('Con areasOfExpertise:', allReviewers.filter(r => r.areasOfExpertise?.length > 0).length);
      console.log('Con stats:', allReviewers.filter(r => r.stats?.totalReviewsCompleted > 0).length);
      
      setPotentialReviewers(allReviewers);
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
    <div className="min-h-screen bg-[#FDFDFD] font-sans text-slate-800 selection:bg-blue-100">
      
      {/* ===================== TOP NAVIGATION (EDITORIAL RIBBON) ===================== */}
      <header className="bg-[#002B49] text-white sticky top-0 z-40 border-b border-slate-200 shadow-sm">
        <div className="max-w-[1920px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="hidden sm:flex w-9 h-9 items-center justify-center text-white border border-white/20 rounded-sm">
              <Icons.FileText />
            </div>
            <div>
              <p className="text-[10px] font-medium text-white/70 uppercase tracking-[0.15em] mb-0.5">
                {isSpanish ? 'Gestión Editorial' : 'Editorial Management'}
              </p>
              <h1 className="font-serif text-lg sm:text-xl text-white font-normal tracking-wide">
                {isSpanish ? 'Panel de Revisión' : 'Review Workspace'}
              </h1>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-sm text-white font-medium">
              {user?.displayName || user?.email}
            </p>
            <p className="text-[11px] text-white/60 font-mono mt-0.5">
              {isSpanish ? 'EDITOR DE SECCIÓN' : 'SECTION EDITOR'}
            </p>
          </div>
        </div>

        {/* Filters Tier */}
        <div className="bg-white border-t border-slate-200">
          <div className="max-w-[1920px] mx-auto px-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            
            <div className="flex items-center gap-8 overflow-x-auto custom-scrollbar">
              {[
                { value: 'all', label: isSpanish ? 'Todos los Expedientes' : 'All Dossiers' },
                { value: 'pending', label: isSpanish ? 'En Curso' : 'In Progress' },
                { value: 'completed', label: isSpanish ? 'Completados' : 'Completed' },
                { value: 'rejected', label: isSpanish ? 'Declinados' : 'Declined' },
              ].map(filter => (
                <button
                  key={filter.value}
                  onClick={() => setFilterStatus(filter.value)}
                  className={`py-4 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap border-b-2 transition-all flex items-center gap-2 ${
                    filterStatus === filter.value
                      ? 'border-[#007398] text-[#002B49]'
                      : 'border-transparent text-slate-500 hover:text-[#002B49]'
                  }`}
                >
                  {filter.label}
                  {filter.value === 'rejected' && rejectedSubmissions.length > 0 && (
                    <span className="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded-sm">
                      {rejectedSubmissions.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 py-2">
              <div className="flex items-center gap-2 bg-[#F5F7F9] border border-slate-200 px-3 py-1.5 w-full sm:w-64 focus-within:border-[#007398] focus-within:bg-white transition-colors rounded-sm">
                <span className="text-slate-400"><Icons.Search /></span>
                <input
                  type="text"
                  placeholder={isSpanish ? 'ID del Manuscrito...' : 'Manuscript ID...'}
                  value={searchManuscript}
                  onChange={(e) => setSearchManuscript(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs w-full text-slate-700 font-medium placeholder-slate-400"
                />
              </div>
            </div>

          </div>
        </div>
      </header>

      {/* ===================== MAIN CONTENT WORKSPACE ===================== */}
      <main className="max-w-[1920px] mx-auto px-6 py-6">
        
        {(reviewError || inviteError) && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 mb-6 flex items-center gap-3 rounded-sm text-sm">
            <Icons.AlertCircle />
            <span>{reviewError || inviteError}</span>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          
          {/* ===================== SIDEBAR: DOSSIER LIST ===================== */}
          <aside className="w-full lg:w-96 flex-shrink-0 bg-white border border-slate-200 flex flex-col rounded-sm shadow-sm">
            
            <div className="bg-[#F8FAFC] border-b border-slate-200 px-5 py-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                {isSpanish ? 'Bandeja Editorial' : 'Editorial Inbox'}
              </h3>
              <span className="text-slate-500 text-[11px] font-mono">
                {filteredSubmissions.length} {isSpanish ? 'archivos' : 'files'}
              </span>
            </div>

            <div className="flex-1 max-h-[65vh] lg:max-h-[calc(100vh-210px)] overflow-y-auto custom-scrollbar">
              {filteredSubmissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                  <Icons.Inbox />
                  <p className="font-serif text-slate-500 mt-4 text-base">
                    {isSpanish ? 'Bandeja vacía.' : 'Inbox is empty.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  
                  {/* PENDING SECTION */}
                  {pendingSubmissions.length > 0 && filterStatus !== 'rejected' && (
                    <div className="bg-white">
                      <div className="px-5 py-2 bg-[#F8FAFC] border-b border-slate-100">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          {isSpanish ? 'Revisión Activa' : 'Active Review'}
                        </span>
                      </div>
                      
                      {pendingSubmissions.map(group => {
                        const latestTask = group.latestTask;
                        const isSelected = selectedSubmissionId === group.submissionId;
                        const accentColor = group.finalDecision === 'rejected' ? 'border-l-slate-400' 
                                          : group.finalDecision === 'accepted' ? 'border-l-[#007398]' 
                                          : 'border-l-[#E4852A]';

                        return (
                          <div
                            key={group.submissionId}
                            onClick={() => handleSelectManuscript(group.submissionId, group.currentRound, group)}
                            className={`p-5 cursor-pointer transition-colors relative border-b border-slate-50 ${
                              isSelected
                                ? `bg-[#F4F7F9] border-l-4 ${accentColor}`
                                : 'bg-white border-l-4 border-l-transparent hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-2 gap-2">
                              <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-sm">
                                {group.submission?.submissionId?.slice(0, 8)}
                              </span>
                              
                              <span className={`text-[9px] px-1.5 py-0.5 font-bold uppercase tracking-wider rounded-sm flex items-center gap-1 ${
                                group.finalDecision === 'rejected' ? 'bg-slate-100 text-slate-600' :
                                group.finalDecision === 'accepted' ? 'bg-[#EBF4F7] text-[#004B7F]' :
                                'bg-slate-50 text-slate-600 border border-slate-200'
                              }`}>
                                {group.finalDecision === 'rejected' && <><Icons.Ban /> {isSpanish ? 'Declinado' : 'Declined'}</>}
                                {group.finalDecision === 'accepted' && <><Icons.CheckCircle /> {isSpanish ? 'Aceptado' : 'Accepted'}</>}
                                {!group.finalDecision && latestTask?.status.replace(/_/g, ' ')}
                              </span>
                            </div>
                            
                            <h4 className={`font-serif text-[13px] leading-relaxed mb-3 ${group.finalDecision === 'rejected' ? 'text-slate-400 line-through' : 'text-[#002B49]'}`}>
                              {group.submission?.title || 'Untitled Manuscript'}
                            </h4>

                            {!group.finalDecision && (
                              <>
                                <div className="flex items-center gap-1 mb-3">
                                  {group.tasks.map((task, index) => (
                                    <div
                                      key={task.id}
                                      className={`flex-1 h-0.5 rounded-full ${
                                        task.status === TASK_STATES.COMPLETED ? 'bg-[#007398]' :
                                        task.id === latestTask.id ? 'bg-[#E4852A]' : 'bg-slate-200'
                                      }`}
                                      title={`Round ${index + 1}`}
                                    />
                                  ))}
                                </div>

                                {latestTask?.status === TASK_STATES.PENDING && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleStartReview(latestTask.id); }}
                                    className="w-full bg-white border border-[#002B49] text-[#002B49] hover:bg-[#002B49] hover:text-white transition-colors text-[10px] uppercase tracking-widest font-bold py-2 rounded-sm"
                                  >
                                    {isSpanish ? 'Iniciar Revisión' : 'Start Review'}
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* COMPLETED SECTION */}
                  {completedSubmissions.length > 0 && filterStatus !== 'rejected' && (
                    <div className="bg-white">
                      <div className="px-5 py-2 bg-[#F8FAFC] border-b border-slate-100">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          {isSpanish ? 'Aprobados' : 'Approved'}
                        </span>
                      </div>
                      
                      {completedSubmissions.map(group => {
                        const isSelected = selectedSubmissionId === group.submissionId;
                        return (
                          <div
                            key={group.submissionId}
                            onClick={() => handleSelectManuscript(group.submissionId, group.tasks.length, group)}
                            className={`p-5 cursor-pointer transition-colors relative border-b border-slate-50 ${
                              isSelected
                                ? 'bg-[#F4F7F9] border-l-4 border-l-[#007398]'
                                : 'bg-white border-l-4 border-l-transparent hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-sm">
                                {group.submission?.submissionId?.slice(0, 8)}
                              </span>
                              <span className="text-[9px] px-1.5 py-0.5 text-[#004B7F] bg-[#EBF4F7] font-bold uppercase tracking-wider rounded-sm flex items-center gap-1">
                                <Icons.CheckCircle /> {isSpanish ? 'Aceptado' : 'Accepted'}
                              </span>
                            </div>
                            <h4 className="font-serif text-[13px] leading-relaxed text-[#002B49] line-clamp-2">
                              {group.submission?.title}
                            </h4>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* REJECTED SECTION */}
                  {rejectedSubmissions.length > 0 && (filterStatus === 'rejected' || filterStatus === 'all') && (
                    <div className="bg-white">
                      <div className="px-5 py-2 bg-[#F8FAFC] border-b border-slate-100">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          {isSpanish ? 'Declinados' : 'Declined'}
                        </span>
                      </div>
                      
                      {rejectedSubmissions.map(group => {
                        const isSelected = selectedSubmissionId === group.submissionId;
                        return (
                          <div
                            key={group.submissionId}
                            onClick={() => handleSelectManuscript(group.submissionId, group.tasks.length, group)}
                            className={`p-5 cursor-pointer transition-colors relative border-b border-slate-50 ${
                              isSelected
                                ? 'bg-[#F4F7F9] border-l-4 border-l-slate-400'
                                : 'bg-white border-l-4 border-l-transparent hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-sm">
                                {group.submission?.submissionId?.slice(0, 8)}
                              </span>
                              <span className="text-[9px] px-1.5 py-0.5 text-slate-600 bg-slate-100 font-bold uppercase tracking-wider rounded-sm flex items-center gap-1">
                                <Icons.Ban /> {isSpanish ? 'Declinado' : 'Declined'}
                              </span>
                            </div>
                            <h4 className="font-serif text-[13px] leading-relaxed text-slate-400 line-through line-clamp-2">
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
          </aside>

          {/* ===================== MAIN PANEL: WORKSPACE ===================== */}
          <section className="flex-1 min-h-0 min-w-0 bg-white border border-slate-200 rounded-sm shadow-sm">
            {selectedTask ? (
              <DeskReviewTab
                task={selectedTask}
                key={`${selectedTask?.id}-${selectedRound}`}
                user={user}
                onComplete={handleCompleteDeskReview}
                loading={reviewLoading}
                onBackToPanel={() => setSelectedSubmissionId(null)}
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
                allTasks={groupedSubmissions.find(g => g.submissionId === selectedSubmissionId)?.tasks || []}
                selectedRound={selectedRound}
                onRoundChange={setSelectedRound}
              />
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-32 px-8 h-[calc(100vh-210px)]"
              >
                <div className="w-16 h-16 bg-[#F8FAFC] border border-slate-200 rounded-full flex items-center justify-center mb-6 text-slate-400">
                  <Icons.FileText />
                </div>
                <h3 className="text-xl font-serif text-[#002B49] mb-3 text-center tracking-wide">
                  {isSpanish ? 'Área de Trabajo Editorial' : 'Editorial Workspace'}
                </h3>
                <div className="w-8 h-[1px] bg-[#007398] mb-4"></div>
                <p className="text-slate-500 text-center max-w-sm font-sans text-sm leading-relaxed">
                  {isSpanish 
                    ? 'Seleccione un expediente del panel izquierdo para visualizar el manuscrito, coordinar la revisión por pares o emitir un dictamen final.'
                    : 'Select a dossier from the left panel to view the manuscript, coordinate peer review, or issue a final decision.'}
                </p>
              </motion.div>
            )}
          </section>
        </div>
      </main>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        
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