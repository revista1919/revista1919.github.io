// src/components/DeskReviewPanel.js (ACTUALIZADO PARA EDITORES DE SECCIÓN)
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { useLanguage } from '../hooks/useLanguage';
import { useEditorialReview } from '../hooks/useEditorialReview';
import { useReviewerInvitation } from '../hooks/useReviewerInvitation';

const DeskReviewPanel = ({ user }) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  
  // Estado para las TAREAS asignadas al editor actual
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  
  const [feedback, setFeedback] = useState('');
  const [internalComments, setInternalComments] = useState('');
  const [decision, setDecision] = useState('');
  const [isSavingDecision, setIsSavingDecision] = useState(false);
  const [currentStep, setCurrentStep] = useState('decision'); // 'decision' o 'reviewers'
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  
  // Estados para selección de revisores (se mantienen)
  const [potentialReviewers, setPotentialReviewers] = useState([]);
  const [selectedReviewerId, setSelectedReviewerId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [assignedReviewers, setAssignedReviewers] = useState([]);

  const { loading: reviewLoading, error: reviewError, submitDeskReviewDecision } = useEditorialReview(user);
  const { loading: inviteLoading, error: inviteError, sendInvitation } = useReviewerInvitation(user);

  // Verificar permisos
  const userRoles = user?.roles || [];
  const hasPermission = userRoles.includes('Editor de Sección') || userRoles.includes('Director General');
  
  // Escuchar TAREAS asignadas a este editor
  useEffect(() => {
    if (!user || !hasPermission) return;

    const q = query(
      collection(db, 'editorialTasks'),
      where('assignedTo', '==', user.uid),
      where('status', 'in', ['pending', 'in-progress']) // Tareas activas
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

  // Función para seleccionar una tarea y cargar su submission
  const handleSelectTask = async (task) => {
    setSelectedTask(task);
    setSelectedSubmission(task.submission);
    
    // Si la tarea ya tiene una decisión guardada
    if (task.decision) {
      setDecision(task.decision);
      setFeedback(task.feedbackToAuthor || '');
      setInternalComments(task.commentsToEditorial || '');
      
      if (task.decision === 'revision-required') {
        setCurrentStep('reviewers');
      } else {
        setCurrentStep('decision');
      }
    } else {
      // Reiniciar los campos si es una tarea nueva
      setDecision('');
      setFeedback('');
      setInternalComments('');
      setCurrentStep('decision');
    }

    // Cargar revisores ya asignados para esta tarea
    if (task.id) {
      const q = query(
        collection(db, 'reviewerInvitations'),
        where('editorialTaskId', '==', task.id)
      );
      const snapshot = await getDocs(q);
      const reviewers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAssignedReviewers(reviewers);
    }
  };

  const handleSubmitDecision = async () => {
    if (!selectedTask || !decision) {
      alert(isSpanish ? 'Debes seleccionar una decisión' : 'You must select a decision');
      return;
    }

    setIsSavingDecision(true);

    try {
      // 1. Actualizar la TAREA (editorialTask) con la decisión
      const taskRef = doc(db, 'editorialTasks', selectedTask.id);
      await updateDoc(taskRef, {
        decision,
        feedbackToAuthor: feedback,
        commentsToEditorial: internalComments,
        status: 'completed', // La tarea se completa
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 2. Actualizar el SUBMISSION con el nuevo estado
      const submissionRef = doc(db, 'submissions', selectedSubmission.id);
      let newSubmissionStatus = '';
      switch (decision) {
        case 'reject': 
          newSubmissionStatus = 'rejected'; 
          break;
        case 'minor-revision': 
          newSubmissionStatus = 'minor-revision-required'; 
          break;
        case 'revision-required': 
          newSubmissionStatus = 'in-reviewer-selection'; 
          break;
        case 'accept': 
          newSubmissionStatus = 'accepted'; 
          break;
        default: 
          newSubmissionStatus = 'desk-review';
      }
      
      await updateDoc(submissionRef, {
        status: newSubmissionStatus,
        updatedAt: serverTimestamp()
      });

      // 3. Si la decisión fue 'revision-required', pasamos al paso de revisores
      if (decision === 'revision-required') {
        setCurrentStep('reviewers');
      } else {
        // Si no es revisión, limpiamos la selección después de un momento
        setTimeout(() => {
          setSelectedTask(null);
          setSelectedSubmission(null);
        }, 2000);
      }

      alert(isSpanish ? 'Decisión guardada exitosamente' : 'Decision saved successfully');
    } catch (error) {
      console.error('Error saving decision:', error);
      alert(isSpanish ? 'Error al guardar la decisión' : 'Error saving decision');
    } finally {
      setIsSavingDecision(false);
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
      submissionId: selectedSubmission.id,
      round: selectedTask.round || 1,
      reviewerEmail: reviewer.email,
      reviewerName: reviewer.displayName,
      reviewerUid: reviewer.id
    });

    if (result.success) {
      alert(isSpanish ? 'Invitación enviada' : 'Invitation sent');
      setSelectedReviewerId('');
      setSearchTerm('');
      
      // Recargar la lista de asignados
      const q = query(
        collection(db, 'reviewerInvitations'),
        where('editorialTaskId', '==', selectedTask.id)
      );
      const snapshot = await getDocs(q);
      const reviewers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAssignedReviewers(reviewers);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'pending': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: isSpanish ? 'Pendiente' : 'Pending' },
      'accepted': { bg: 'bg-green-100', text: 'text-green-800', label: isSpanish ? 'Aceptada' : 'Accepted' },
      'declined': { bg: 'bg-red-100', text: 'text-red-800', label: isSpanish ? 'Rechazada' : 'Declined' }
    };
    const style = statusMap[status] || statusMap.pending;
    return (
      <span className={`${style.bg} ${style.text} px-2 py-1 rounded-full text-xs font-['Lora']`}>
        {style.label}
      </span>
    );
  };

  // Filtrar revisores (excluir ya invitados)
  const invitedEmails = new Set(assignedReviewers.map(r => r.reviewerEmail));
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
            <div className="space-y-3">
              {assignedTasks.map(task => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => handleSelectTask(task)}
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
                  {task.assignmentNotes && (
                    <p className="text-xs text-[#C0A86A] mt-2 italic line-clamp-1">
                      📝 {task.assignmentNotes}
                    </p>
                  )}
                  {task.decision && (
                    <div className="mt-2 text-xs">
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full">
                        {isSpanish ? 'Decisión tomada' : 'Decision made'}
                      </span>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Panel de trabajo */}
        <div className="lg:col-span-2">
          {selectedTask && selectedSubmission ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* Cabecera común */}
                <div className="bg-[#F5F7FA] rounded-xl p-6 border border-[#E5E9F0]">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-['Playfair_Display'] text-2xl font-bold text-[#0A1929]">
                      {selectedSubmission.title}
                    </h3>
                    <div className="flex gap-2">
                      <span className="px-3 py-1 bg-[#0A1929] text-white text-xs rounded-full font-['Lora']">
                        {isSpanish ? 'Ronda' : 'Round'} {selectedTask.round || 1}
                      </span>
                      {selectedTask.decision === 'revision-required' && (
                        <span className="px-3 py-1 bg-[#C0A86A] text-white text-xs rounded-full font-['Lora']">
                          {isSpanish ? 'En revisión por pares' : 'In peer review'}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-4 text-sm text-[#5A6B7A] font-['Lora'] mb-4">
                    <span className="font-mono bg-white px-3 py-1 rounded-full border border-[#E5E9F0]">
                      {selectedSubmission.submissionId}
                    </span>
                    <span className="px-3 py-1 bg-[#E8F0FE] text-[#1E4A7A] rounded-full">
                      {selectedSubmission.area}
                    </span>
                  </div>
                  
                  <a 
                    href={selectedSubmission.driveFolderUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-[#C0A86A] hover:text-[#A58D4F] font-medium transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {isSpanish ? 'Ver documentos en Drive' : 'View documents in Drive'}
                  </a>
                </div>

                {/* Si ya hay una decisión tomada, mostramos el resumen */}
                {selectedTask.decision && selectedTask.decision !== 'revision-required' && (
                  <div className="bg-[#FBF9F3] border border-[#C0A86A] rounded-xl p-4">
                    <p className="text-sm text-[#0A1929] font-['Lora']">
                      <span className="font-bold">{isSpanish ? 'Decisión:' : 'Decision:'}</span>{' '}
                      {selectedTask.decision === 'reject' && (isSpanish ? 'Rechazado' : 'Rejected')}
                      {selectedTask.decision === 'accept' && (isSpanish ? 'Aceptado' : 'Accepted')}
                      {selectedTask.decision === 'minor-revision' && (isSpanish ? 'Revisión menor' : 'Minor revision')}
                    </p>
                    {selectedTask.feedbackToAuthor && (
                      <p className="text-sm text-[#5A6B7A] mt-2 italic">
                        "{selectedTask.feedbackToAuthor}"
                      </p>
                    )}
                  </div>
                )}

                {/* PASO 1: TOMA DE DECISIÓN (solo si no hay decisión) */}
                {!selectedTask.decision && currentStep === 'decision' && (
                  <div className="space-y-6">
                    <div>
                      <label className="block font-['Playfair_Display'] font-semibold text-[#0A1929] mb-3">
                        {isSpanish ? 'Decisión Editorial' : 'Editorial Decision'}
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { value: 'reject', label: isSpanish ? 'Rechazar' : 'Reject', bg: 'bg-red-50 hover:bg-red-100' },
                          { value: 'minor-revision', label: isSpanish ? 'Revisión menor' : 'Minor revision', bg: 'bg-yellow-50 hover:bg-yellow-100' },
                          { value: 'revision-required', label: isSpanish ? 'Enviar a revisión' : 'Send to review', bg: 'bg-blue-50 hover:bg-blue-100' },
                          { value: 'accept', label: isSpanish ? 'Aceptar' : 'Accept', bg: 'bg-green-50 hover:bg-green-100' }
                        ].map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setDecision(opt.value)}
                            className={`p-4 rounded-xl border-2 font-['Lora'] transition-all ${
                              decision === opt.value
                                ? 'border-[#C0A86A] bg-[#FBF9F3] text-[#0A1929]'
                                : `border-[#E5E9F0] ${opt.bg} text-[#5A6B7A] hover:text-[#0A1929]`
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block font-['Playfair_Display'] font-semibold text-[#0A1929] mb-3">
                        {isSpanish ? 'Feedback para el Autor' : 'Feedback to Author'}
                      </label>
                      <textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        rows="6"
                        className="w-full p-4 bg-[#F5F7FA] border border-[#E5E9F0] rounded-xl focus:ring-2 focus:ring-[#C0A86A] focus:border-transparent font-['Lora'] text-sm"
                        placeholder={isSpanish ? 'Explica tu decisión al autor...' : 'Explain your decision to the author...'}
                      />
                    </div>

                    <div>
                      <label className="block font-['Playfair_Display'] font-semibold text-[#0A1929] mb-3">
                        {isSpanish ? 'Comentarios Internos' : 'Internal Comments'}
                      </label>
                      <textarea
                        value={internalComments}
                        onChange={(e) => setInternalComments(e.target.value)}
                        rows="4"
                        className="w-full p-4 bg-[#F5F7FA] border border-[#E5E9F0] rounded-xl focus:ring-2 focus:ring-[#C0A86A] focus:border-transparent font-['Lora'] text-sm"
                        placeholder={isSpanish ? 'Notas para el equipo editorial...' : 'Notes for the editorial team...'}
                      />
                    </div>

                    <button
                      onClick={handleSubmitDecision}
                      disabled={reviewLoading || isSavingDecision || !decision}
                      className="w-full py-4 bg-[#0A1929] hover:bg-[#1E2F40] text-white font-['Playfair_Display'] font-bold rounded-xl transition-all disabled:bg-[#E5E9F0] disabled:text-[#5A6B7A]"
                    >
                      {reviewLoading || isSavingDecision ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          {isSpanish ? 'GUARDANDO...' : 'SAVING...'}
                        </span>
                      ) : (
                        isSpanish ? 'GUARDAR DECISIÓN' : 'SAVE DECISION'
                      )}
                    </button>
                  </div>
                )}

                {/* PASO 2: ASIGNACIÓN DE REVISORES (cuando la decisión es 'revision-required') */}
                {(selectedTask.decision === 'revision-required' || currentStep === 'reviewers') && (
                  <div className="space-y-6">
                    {/* Revisores ya asignados */}
                    {assignedReviewers.length > 0 && (
                      <div>
                        <h4 className="font-['Playfair_Display'] font-semibold text-[#0A1929] mb-3">
                          {isSpanish ? 'Revisores invitados' : 'Invited reviewers'}
                        </h4>
                        <div className="space-y-2">
                          {assignedReviewers.map(rev => (
                            <div key={rev.id} className="flex items-center justify-between p-3 bg-[#F5F7FA] rounded-lg border border-[#E5E9F0]">
                              <div>
                                <p className="font-['Lora'] font-medium text-[#0A1929]">{rev.reviewerName || rev.reviewerEmail}</p>
                                <p className="text-xs text-[#5A6B7A]">{rev.reviewerEmail}</p>
                              </div>
                              {getStatusBadge(rev.status)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Buscador de nuevos revisores */}
                    <div>
                      <h4 className="font-['Playfair_Display'] font-semibold text-[#0A1929] mb-3">
                        {isSpanish ? 'Agregar nuevo revisor' : 'Add new reviewer'}
                      </h4>
                      
                      <div className="relative mb-4">
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder={isSpanish ? 'Buscar por nombre, email o institución...' : 'Search by name, email or institution...'}
                          className="w-full p-4 pl-12 bg-[#F5F7FA] border border-[#E5E9F0] rounded-xl focus:ring-2 focus:ring-[#C0A86A] focus:border-transparent font-['Lora']"
                        />
                        <svg className="w-5 h-5 text-[#5A6B7A] absolute left-4 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>

                      {/* Lista de revisores disponibles */}
                      <div className="max-h-80 overflow-y-auto space-y-2 border border-[#E5E9F0] rounded-xl p-2 mb-4">
                        {filteredReviewers.length === 0 ? (
                          <p className="text-center text-[#5A6B7A] py-8 font-['Lora'] italic">
                            {searchTerm 
                              ? (isSpanish ? 'No hay resultados' : 'No results')
                              : (isSpanish ? 'No hay más revisores disponibles' : 'No more reviewers available')}
                          </p>
                        ) : (
                          filteredReviewers.map(reviewer => (
                            <motion.div
                              key={reviewer.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              onClick={() => setSelectedReviewerId(reviewer.id)}
                              className={`p-4 rounded-xl cursor-pointer transition-all ${
                                selectedReviewerId === reviewer.id
                                  ? 'bg-[#FBF9F3] border-2 border-[#C0A86A]'
                                  : 'bg-[#F5F7FA] hover:bg-[#E8F0FE] border-2 border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-[#0A1929] rounded-full flex items-center justify-center flex-shrink-0">
                                  <span className="text-xl font-['Playfair_Display'] font-bold text-white">
                                    {reviewer.displayName?.charAt(0) || '?'}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-['Playfair_Display'] font-bold text-[#0A1929] truncate">
                                    {reviewer.displayName}
                                  </div>
                                  <div className="text-sm text-[#5A6B7A] font-['Lora'] truncate">
                                    {reviewer.email}
                                  </div>
                                  {reviewer.institution && (
                                    <div className="text-xs text-[#5A6B7A] mt-1 font-['Lora']">
                                      {reviewer.institution}
                                    </div>
                                  )}
                                </div>
                                {reviewer.roles?.includes('Editor de Sección') && (
                                  <span className="px-2 py-1 bg-[#C0A86A] text-white text-xs rounded-full font-['Lora']">
                                    {isSpanish ? 'Editor' : 'Editor'}
                                  </span>
                                )}
                              </div>
                            </motion.div>
                          ))
                        )}
                      </div>

                      <button
                        onClick={handleSendInvitation}
                        disabled={inviteLoading || !selectedReviewerId}
                        className="w-full py-4 bg-[#C0A86A] hover:bg-[#A58D4F] text-white font-['Playfair_Display'] font-bold rounded-xl transition-all disabled:bg-[#E5E9F0] disabled:text-[#5A6B7A]"
                      >
                        {inviteLoading ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            {isSpanish ? 'ENVIANDO...' : 'SENDING...'}
                          </span>
                        ) : (
                          isSpanish ? 'ENVIAR INVITACIÓN' : 'SEND INVITATION'
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
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