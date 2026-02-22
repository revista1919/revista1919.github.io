// src/components/DeskReviewPanel.js
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore';
import { useLanguage } from '../hooks/useLanguage';
import { useEditorialReview } from '../hooks/useEditorialReview';
import { useReviewerInvitation } from '../hooks/useReviewerInvitation';

const DeskReviewPanel = ({ user }) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [activeReview, setActiveReview] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [internalComments, setInternalComments] = useState('');
  const [decision, setDecision] = useState('');
  const [isSavingDecision, setIsSavingDecision] = useState(false);
  const [currentStep, setCurrentStep] = useState('decision'); // 'decision' o 'reviewers'
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  
  // Estados para selección de revisores
  const [potentialReviewers, setPotentialReviewers] = useState([]);
  const [selectedReviewerId, setSelectedReviewerId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [assignedReviewers, setAssignedReviewers] = useState([]);

  const { loading: reviewLoading, error: reviewError, startDeskReview, submitDeskReviewDecision } = useEditorialReview(user);
  const { loading: inviteLoading, error: inviteError, sendInvitation } = useReviewerInvitation(user);

  // Escuchar envíos que necesitan revisión editorial
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'submissions'),
      where('status', 'in', ['submitted', 'in-editorial-review', 'in-reviewer-selection']),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const subs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || null
      }));
      setSubmissions(subs);
    }, (error) => {
      console.error('Error listening to submissions:', error);
    });

    return () => unsubscribe();
  }, [user]);

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

  // Función para cargar una revisión completa por ID
  const loadReviewById = async (submissionId, reviewId) => {
    setIsLoadingReview(true);
    try {
      // Cargar el submission
      const submissionDoc = await getDoc(doc(db, 'submissions', submissionId));
      if (!submissionDoc.exists()) {
        throw new Error('Submission not found');
      }
      const submissionData = { id: submissionDoc.id, ...submissionDoc.data() };
      
      // Cargar la revisión editorial
      const reviewDoc = await getDoc(doc(db, 'editorialReviews', reviewId));
      if (!reviewDoc.exists()) {
        throw new Error('Review not found');
      }
      const reviewData = { id: reviewDoc.id, ...reviewDoc.data() };
      
      // Cargar revisores asignados
      const reviewersQuery = query(
        collection(db, 'reviewerInvitations'),
        where('editorialReviewId', '==', reviewId)
      );
      const reviewersSnapshot = await getDocs(reviewersQuery);
      const reviewers = reviewersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Actualizar todos los estados
      setSelectedSubmission(submissionData);
      setActiveReview(reviewData);
      setAssignedReviewers(reviewers);
      
      // Si la revisión ya tiene una decisión
      if (reviewData.decision) {
        setDecision(reviewData.decision);
        setFeedback(reviewData.feedbackToAuthor || '');
        setInternalComments(reviewData.commentsToEditorial || '');
        
        // Si la decisión fue 'revision-required', mostrar paso de revisores
        if (reviewData.decision === 'revision-required') {
          setCurrentStep('reviewers');
        } else {
          setCurrentStep('decision');
        }
      }
      
    } catch (error) {
      console.error('Error loading review:', error);
    } finally {
      setIsLoadingReview(false);
    }
  };

  // Manejar selección de envío
  const handleStartReview = async (submission) => {
    // Verificar si ya existe una revisión editorial para este envío
    const reviewsQuery = query(
      collection(db, 'editorialReviews'),
      where('submissionId', '==', submission.id),
      where('round', '==', 1)
    );
    const reviewsSnapshot = await getDocs(reviewsQuery);
    
    if (!reviewsSnapshot.empty) {
      // Ya existe una revisión, cargarla
      const existingReview = reviewsSnapshot.docs[0];
      await loadReviewById(submission.id, existingReview.id);
    } else {
      // No existe, crear una nueva
      const result = await startDeskReview(submission.id);
      if (result.success) {
        await loadReviewById(submission.id, result.reviewId);
      }
    }
  };

  // Cargar revisores asignados cuando cambia activeReview
  useEffect(() => {
    const loadAssignedReviewers = async () => {
      if (!activeReview?.id) return;
      
      const q = query(
        collection(db, 'reviewerInvitations'),
        where('editorialReviewId', '==', activeReview.id),
        where('round', '==', activeReview.round || 1)
      );
      
      const snapshot = await getDocs(q);
      const assignments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAssignedReviewers(assignments);
    };

    loadAssignedReviewers();
  }, [activeReview]);

  const handleSubmitDecision = async () => {
    if (!activeReview || !decision) {
      alert(isSpanish ? 'Debes seleccionar una decisión' : 'You must select a decision');
      return;
    }

    setIsSavingDecision(true);
    const result = await submitDeskReviewDecision(activeReview.id, {
      decision,
      feedbackToAuthor: feedback,
      commentsToEditorial: internalComments
    });

    if (result.success) {
      // Recargar la revisión para obtener los datos actualizados
      await loadReviewById(selectedSubmission.id, activeReview.id);
    }
    setIsSavingDecision(false);
  };

  const handleSendInvitation = async () => {
    if (!activeReview || !selectedReviewerId) {
      alert(isSpanish ? 'Selecciona un revisor' : 'Select a reviewer');
      return;
    }

    const reviewer = potentialReviewers.find(r => r.id === selectedReviewerId);
    
    const result = await sendInvitation({
      editorialReviewId: activeReview.id,
      submissionId: selectedSubmission.id,
      round: activeReview.round || 1,
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
        where('editorialReviewId', '==', activeReview.id)
      );
      const snapshot = await getDocs(q);
      const assignments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAssignedReviewers(assignments);
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

  if (!user || (!user.roles?.includes('Director General') && !user.roles?.includes('Editor en Jefe'))) {
    return null;
  }

  if (isLoadingReview) {
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-[#C0A86A] border-t-[#0A1929] rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-[#5A6B7A] font-['Lora']">
              {isSpanish ? 'Cargando revisión...' : 'Loading review...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 max-w-7xl mx-auto font-serif">
      <h2 className="font-['Playfair_Display'] text-4xl font-bold text-[#0A1929] mb-2 tracking-tight">
        {isSpanish ? 'Revisión Editorial' : 'Editorial Review'}
      </h2>
      <p className="text-[#5A6B7A] font-['Lora'] text-lg mb-8 border-b border-[#E5E9F0] pb-4">
        {isSpanish ? 'Evaluación inicial de manuscritos' : 'Initial manuscript evaluation'}
      </p>

      {(reviewError || inviteError) && (
        <div className="bg-[#FEF2F2] border-l-4 border-[#991B1B] text-[#991B1B] p-4 rounded-lg mb-6 font-['Lora']">
          {reviewError || inviteError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Lista de envíos */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="font-['Playfair_Display'] text-lg font-semibold text-[#0A1929] border-b-2 border-[#C0A86A] pb-2 mb-4">
            {isSpanish ? 'Envíos' : 'Submissions'}
          </h3>
          {submissions.length === 0 ? (
            <div className="bg-[#F5F7FA] rounded-xl p-8 text-center border border-[#E5E9F0]">
              <p className="text-[#5A6B7A] font-['Lora'] italic">
                {isSpanish ? 'No hay envíos' : 'No submissions'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {submissions.map(sub => (
                <motion.div
                  key={sub.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => handleStartReview(sub)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedSubmission?.id === sub.id
                      ? 'border-[#C0A86A] bg-[#FBF9F3]'
                      : 'border-[#E5E9F0] hover:border-[#C0A86A] bg-white hover:shadow-md'
                  }`}
                >
                  <h4 className="font-['Playfair_Display'] font-bold text-[#0A1929] mb-2 line-clamp-2">
                    {sub.title}
                  </h4>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-[#5A6B7A]">{sub.submissionId?.slice(0, 8)}</span>
                    <span className={`px-2 py-1 rounded-full ${
                      sub.status === 'submitted' 
                        ? 'bg-[#E8F0FE] text-[#1E4A7A]' 
                        : sub.status === 'in-reviewer-selection'
                        ? 'bg-[#FEF3C7] text-[#92400E]'
                        : sub.status === 'in-editorial-review'
                        ? 'bg-[#E8F0FE] text-[#1E4A7A]'
                        : 'bg-[#E8F0FE] text-[#1E4A7A]'
                    }`}>
                      {sub.status === 'submitted' ? (isSpanish ? 'Recibido' : 'Submitted')
                        : sub.status === 'in-reviewer-selection' ? (isSpanish ? 'Buscando revisores' : 'Finding reviewers')
                        : sub.status === 'in-editorial-review' ? (isSpanish ? 'En revisión editorial' : 'In editorial review')
                        : (isSpanish ? 'En revisión' : 'In review')}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Panel de trabajo */}
        <div className="lg:col-span-2">
          {selectedSubmission && activeReview ? (
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
                        {isSpanish ? 'Ronda' : 'Round'} {activeReview.round || 1}
                      </span>
                      {activeReview.decision === 'revision-required' && (
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
                {activeReview.decision && activeReview.decision !== 'revision-required' && (
                  <div className="bg-[#FBF9F3] border border-[#C0A86A] rounded-xl p-4">
                    <p className="text-sm text-[#0A1929] font-['Lora']">
                      <span className="font-bold">{isSpanish ? 'Decisión:' : 'Decision:'}</span>{' '}
                      {activeReview.decision === 'reject' && (isSpanish ? 'Rechazado' : 'Rejected')}
                      {activeReview.decision === 'accept' && (isSpanish ? 'Aceptado' : 'Accepted')}
                      {activeReview.decision === 'minor-revision' && (isSpanish ? 'Revisión menor' : 'Minor revision')}
                    </p>
                    {activeReview.feedbackToAuthor && (
                      <p className="text-sm text-[#5A6B7A] mt-2 italic">
                        "{activeReview.feedbackToAuthor}"
                      </p>
                    )}
                    <button
                      onClick={() => {
                        setSelectedSubmission(null);
                        setActiveReview(null);
                      }}
                      className="mt-4 text-sm text-[#C0A86A] hover:text-[#A58D4F]"
                    >
                      ← {isSpanish ? 'Volver a la lista' : 'Back to list'}
                    </button>
                  </div>
                )}

                {/* PASO 1: TOMA DE DECISIÓN (solo si no hay decisión) */}
                {!activeReview.decision && currentStep === 'decision' && (
                  <div className="space-y-6">
                    <div>
                      <label className="block font-['Playfair_Display'] font-semibold text-[#0A1929] mb-3">
                        {isSpanish ? 'Decisión Editorial' : 'Editorial Decision'}
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { value: 'reject', label: isSpanish ? 'Rechazar' : 'Reject' },
                          { value: 'minor-revision', label: isSpanish ? 'Revisión menor' : 'Minor revision' },
                          { value: 'revision-required', label: isSpanish ? 'Enviar a revisión' : 'Send to review' },
                          { value: 'accept', label: isSpanish ? 'Aceptar' : 'Accept' }
                        ].map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setDecision(opt.value)}
                            className={`p-4 rounded-xl border-2 font-['Lora'] transition-all ${
                              decision === opt.value
                                ? 'border-[#C0A86A] bg-[#FBF9F3] text-[#0A1929]'
                                : 'border-[#E5E9F0] hover:border-[#C0A86A] text-[#5A6B7A] hover:text-[#0A1929]'
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
                {(activeReview.decision === 'revision-required' || currentStep === 'reviewers') && (
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
                  ? 'Selecciona un envío para comenzar' 
                  : 'Select a submission to start'}
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeskReviewPanel;