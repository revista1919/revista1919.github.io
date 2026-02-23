// src/components/DeskReviewPanel.js (VERSIÓN FINAL COMPLETA)
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs } from 'firebase/firestore';
import { useLanguage } from '../hooks/useLanguage';
import { useEditorialReview } from '../hooks/useEditorialReview';
import { useReviewerInvitation } from '../hooks/useReviewerInvitation';
import { useEditorialTasks, TASK_STATES } from '../hooks/useEditorialTasks';
import { DeskReviewTab } from './DeskReviewTab';
import { ReviewerManagementTab } from './ReviewerManagementTab';
import { FinalDecisionTab } from './FinalDecisionTab';

const DeskReviewPanel = ({ user }) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  
  // Estado para las TAREAS asignadas al editor actual
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [activeTaskTab, setActiveTaskTab] = useState('deskReview');
  
  // Estados para selección de revisores
  const [potentialReviewers, setPotentialReviewers] = useState([]);
  const [selectedReviewerId, setSelectedReviewerId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [invitations, setInvitations] = useState([]);
  const [reviewers, setReviewers] = useState([]);

  const { loading: reviewLoading, error: reviewError, submitDeskReviewDecision } = useEditorialReview(user);
  const { loading: inviteLoading, error: inviteError, sendInvitation } = useReviewerInvitation(user);
  const { loading: tasksLoading, getMyTasks, makeFinalDecision, startDeskReview } = useEditorialTasks(user);

  // Verificar permisos
  const userRoles = user?.roles || [];
  const hasPermission = userRoles.includes('Editor de Sección') || userRoles.includes('Director General');
  
  // Escuchar TAREAS asignadas a este editor
  useEffect(() => {
    if (!user || !hasPermission) return;

    const q = query(
      collection(db, 'editorialTasks'),
      where('assignedTo', '==', user.uid),
      where('status', 'not-in', [TASK_STATES.COMPLETED])
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || null
      }));
      
      // Para cada tarea, obtener los datos del submission asociado
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

  // Cargar potenciales revisores
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

  // Cargar invitaciones y revisiones de la tarea seleccionada
  useEffect(() => {
    if (!selectedTask) return;

    const loadInvitations = async () => {
      const q = query(
        collection(db, 'reviewerInvitations'),
        where('editorialTaskId', '==', selectedTask.id)
      );
      const snapshot = await getDocs(q);
      setInvitations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };

    const loadReviewers = async () => {
      const q = query(
        collection(db, 'reviewerAssignments'),
        where('editorialTaskId', '==', selectedTask.id)
      );
      const snapshot = await getDocs(q);
      setReviewers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };

    loadInvitations();
    loadReviewers();
  }, [selectedTask]);

  const handleStartReview = async (taskId) => {
    const result = await startDeskReview(taskId);
    if (result.success) {
      // Actualizar la lista de tareas
      const updated = await getMyTasks();
      if (updated.success) setAssignedTasks(updated.tasks);
    }
  };

  const handleCompleteDeskReview = async (taskId, decisionData) => {
    // Esto debería actualizar la editorialReview y la tarea
    // Por ahora, solo actualizamos localmente
    setSelectedTask(prev => ({
      ...prev,
      deskReviewDecision: decisionData.decision,
      deskReviewFeedback: decisionData.feedbackToAuthor,
      deskReviewComments: decisionData.commentsToEditorial,
      status: decisionData.decision === 'revision-required' 
        ? TASK_STATES.REVIEWER_SELECTION 
        : TASK_STATES.COMPLETED
    }));
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

  const handleFinalDecision = async (taskId, decisionData) => {
    const result = await makeFinalDecision(taskId, decisionData);
    if (result.success) {
      alert(isSpanish ? 'Decisión final guardada' : 'Final decision saved');
      setSelectedTask(null);
    }
  };

  // Filtrar revisores (excluir ya invitados)
  const invitedEmails = new Set(invitations.map(r => r.reviewerEmail));
  const availableReviewers = potentialReviewers.filter(r => !invitedEmails.has(r.email));
  
  const filteredReviewers = availableReviewers.filter(reviewer => {
    const searchLower = searchTerm.toLowerCase();
    return (
      reviewer.displayName?.toLowerCase().includes(searchLower) ||
      reviewer.email?.toLowerCase().includes(searchLower) ||
      reviewer.institution?.toLowerCase().includes(searchLower)
    );
  });

  // Si no tiene permisos, no renderizar nada
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
        {/* Lista de tareas asignadas */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="font-['Playfair_Display'] text-lg font-semibold text-[#0A1929] border-b-2 border-[#C0A86A] pb-2 mb-4">
            {isSpanish ? 'Mis Tareas' : 'My Tasks'}
          </h3>
          {assignedTasks.length === 0 ? (
            <div className="bg-[#F5F7FA] rounded-xl p-8 text-center border border-[#E5E9F0]">
              <p className="text-[#5A6B7A] font-['Lora'] italic">
                {isSpanish ? 'No tienes tareas pendientes' : 'No pending tasks'}
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {assignedTasks.map(task => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => setSelectedTask(task)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedTask?.id === task.id
                      ? 'border-[#C0A86A] bg-[#FBF9F3]'
                      : 'border-[#E5E9F0] hover:border-[#C0A86A] bg-white hover:shadow-md'
                  }`}
                >
                  <h4 className="font-['Playfair_Display'] font-bold text-[#0A1929] mb-2 line-clamp-2">
                    {task.submission?.title || 'Cargando...'}
                  </h4>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-[#5A6B7A]">
                      {task.submission?.submissionId?.slice(0, 8) || 'Sin ID'}
                    </span>
                    <span className="px-2 py-1 bg-[#E8F0FE] text-[#1E4A7A] rounded-full">
                      {task.submission?.area || 'Sin área'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      task.status === TASK_STATES.PENDING ? 'bg-yellow-100 text-yellow-700' :
                      task.status === TASK_STATES.DESK_REVIEW_IN_PROGRESS ? 'bg-blue-100 text-blue-700' :
                      task.status === TASK_STATES.REVIEWER_SELECTION ? 'bg-purple-100 text-purple-700' :
                      task.status === TASK_STATES.AWAITING_DECISION ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {task.status === TASK_STATES.PENDING && (isSpanish ? 'Pendiente' : 'Pending')}
                      {task.status === TASK_STATES.DESK_REVIEW_IN_PROGRESS && (isSpanish ? 'En revisión' : 'In review')}
                      {task.status === TASK_STATES.REVIEWER_SELECTION && (isSpanish ? 'Seleccionando revisores' : 'Selecting reviewers')}
                      {task.status === TASK_STATES.AWAITING_DECISION && (isSpanish ? 'Esperando decisión' : 'Awaiting decision')}
                    </span>
                    {task.status === TASK_STATES.PENDING && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleStartReview(task.id); }}
                        className="text-xs bg-[#C0A86A] text-white px-2 py-1 rounded hover:bg-[#A58D4F]"
                      >
                        {isSpanish ? 'Iniciar' : 'Start'}
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Panel de trabajo */}
        <div className="lg:col-span-2">
          {selectedTask ? (
            <div>
              {/* Tabs condicionales según el estado de la tarea */}
              <div className="flex border-b border-gray-200 mb-6">
                <button
                  onClick={() => setActiveTaskTab('deskReview')}
                  className={`px-4 py-2 font-medium text-sm transition-colors ${
                    activeTaskTab === 'deskReview' 
                      ? 'text-[#C0A86A] border-b-2 border-[#C0A86A]' 
                      : 'text-[#5A6B7A] hover:text-[#0A1929]'
                  }`}
                >
                  {isSpanish ? 'Revisión Editorial' : 'Desk Review'}
                </button>
                
                {(selectedTask.status === TASK_STATES.REVIEWER_SELECTION || 
                  selectedTask.status === TASK_STATES.AWAITING_REVIEWER_RESPONSES || 
                  selectedTask.status === TASK_STATES.REVIEWS_IN_PROGRESS) && (
                  <button
                    onClick={() => setActiveTaskTab('reviewerManagement')}
                    className={`px-4 py-2 font-medium text-sm transition-colors ${
                      activeTaskTab === 'reviewerManagement' 
                        ? 'text-[#C0A86A] border-b-2 border-[#C0A86A]' 
                        : 'text-[#5A6B7A] hover:text-[#0A1929]'
                    }`}
                  >
                    {isSpanish ? 'Gestión de Revisores' : 'Reviewer Management'}
                  </button>
                )}
                
                {selectedTask.status === TASK_STATES.AWAITING_DECISION && (
                  <button
                    onClick={() => setActiveTaskTab('finalDecision')}
                    className={`px-4 py-2 font-medium text-sm transition-colors ${
                      activeTaskTab === 'finalDecision' 
                        ? 'text-[#C0A86A] border-b-2 border-[#C0A86A]' 
                        : 'text-[#5A6B7A] hover:text-[#0A1929]'
                    }`}
                  >
                    {isSpanish ? 'Decisión Final' : 'Final Decision'}
                  </button>
                )}
              </div>

              {/* Renderizar el tab correspondiente */}
              {activeTaskTab === 'deskReview' && (
                <DeskReviewTab
                  task={selectedTask}
                  user={user}
                  onComplete={handleCompleteDeskReview}
                  loading={reviewLoading}
                />
              )}

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
                  loading={inviteLoading}
                />
              )}

              {activeTaskTab === 'finalDecision' && (
                <FinalDecisionTab
                  task={selectedTask}
                  reviewers={reviewers}
                  onSubmitDecision={handleFinalDecision}
                  loading={reviewLoading}
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
                  ? 'Selecciona una tarea para comenzar' 
                  : 'Select a task to start'}
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeskReviewPanel;