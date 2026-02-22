// src/components/DeskReviewPanel.js
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
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
  
  // Nuevos estados para selección de revisores
  const [potentialReviewers, setPotentialReviewers] = useState([]);
  const [selectedReviewerId, setSelectedReviewerId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const { loading: reviewLoading, error: reviewError, startDeskReview, submitDeskReviewDecision } = useEditorialReview(user);
  const { loading: inviteLoading, error: inviteError, sendInvitation } = useReviewerInvitation(user);

  // Escuchar envíos que necesitan revisión editorial
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'submissions'),
      where('status', 'in', ['submitted', 'in-editorial-review']),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const subs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSubmissions(subs);
    }, (error) => {
      console.error('Error listening to submissions:', error);
    });

    return () => unsubscribe();
  }, [user]);

  // Cargar potenciales revisores (usuarios con rol Revisor o Editor de Sección)
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

  const handleStartReview = async (submission) => {
    const result = await startDeskReview(submission.id);
    if (result.success) {
      setActiveReview({ id: result.reviewId, ...result.data });
      setSelectedSubmission(submission);
      setFeedback(result.data?.feedbackToAuthor || '');
      setInternalComments(result.data?.commentsToEditorial || '');
      setDecision(result.data?.decision || '');
    }
  };

  const handleSubmitDecision = async () => {
    if (!activeReview || !decision) {
      alert(isSpanish ? 'Debes seleccionar una decisión' : 'You must select a decision');
      return;
    }

    const result = await submitDeskReviewDecision(activeReview.id, {
      decision,
      feedbackToAuthor: feedback,
      commentsToEditorial: internalComments
    });

    if (result.success) {
      alert(isSpanish ? 'Decisión guardada correctamente' : 'Decision saved successfully');
      setSelectedSubmission(null);
      setActiveReview(null);
      setFeedback('');
      setInternalComments('');
      setDecision('');
    }
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
      reviewerName: reviewer.displayName
    });

    if (result.success) {
      alert(isSpanish ? 'Invitación enviada' : 'Invitation sent');
      setSelectedReviewerId('');
    }
  };

  // Filtrar revisores por búsqueda
  const filteredReviewers = potentialReviewers.filter(reviewer => {
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

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 max-w-6xl mx-auto">
      <h2 className="font-serif text-3xl font-bold text-gray-900 mb-6">
        {isSpanish ? 'Revisión Editorial (Desk Review)' : 'Editorial Review (Desk Review)'}
      </h2>

      {(reviewError || inviteError) && (
        <div className="bg-red-50 text-red-600 p-4 rounded-2xl mb-6">
          {reviewError || inviteError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Lista de envíos pendientes */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="font-bold text-gray-700 uppercase tracking-wider text-sm mb-4">
            {isSpanish ? 'Envíos Pendientes' : 'Pending Submissions'}
          </h3>
          {submissions.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              {isSpanish ? 'No hay envíos pendientes' : 'No pending submissions'}
            </p>
          ) : (
            submissions.map(sub => (
              <motion.div
                key={sub.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => handleStartReview(sub)}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                  selectedSubmission?.id === sub.id
                    ? 'border-emerald-600 bg-emerald-50'
                    : 'border-gray-100 hover:border-emerald-300 bg-white'
                }`}
              >
                <h4 className="font-serif font-bold text-gray-900 mb-2 line-clamp-2">
                  {sub.title}
                </h4>
                <p className="text-xs text-gray-500 mb-1">
                  {isSpanish ? 'ID:' : 'ID:'} {sub.submissionId}
                </p>
                <p className="text-xs text-gray-500">
                  {isSpanish ? 'Estado:' : 'Status:'} {sub.status === 'submitted' ? (isSpanish ? 'Recibido' : 'Submitted') : (isSpanish ? 'En revisión' : 'In review')}
                </p>
              </motion.div>
            ))
          )}
        </div>

        {/* Panel de revisión activa */}
        <div className="lg:col-span-2 space-y-6">
          {selectedSubmission && activeReview ? (
            <AnimatePresence mode="wait">
              <motion.div
                key="review-active"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                {/* Cabecera del artículo */}
                <div>
                  <h3 className="font-serif text-2xl font-bold text-gray-900 mb-2">
                    {selectedSubmission.title}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    <span className="font-mono">{selectedSubmission.submissionId}</span> • {selectedSubmission.area}
                  </p>
                  <a 
                    href={selectedSubmission.driveFolderUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    <span>📁</span> {isSpanish ? 'Ver documentos en Drive' : 'View documents in Drive'}
                  </a>
                </div>

                {/* Formulario de decisión */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">
                      {isSpanish ? 'Decisión Editorial' : 'Editorial Decision'}
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: 'reject', label: isSpanish ? 'Rechazar' : 'Reject', color: 'red' },
                        { value: 'minor-revision', label: isSpanish ? 'Revisión menor' : 'Minor revision', color: 'amber' },
                        { value: 'revision-required', label: isSpanish ? 'Enviar a revisión' : 'Send to review', color: 'blue' },
                        { value: 'accept', label: isSpanish ? 'Aceptar' : 'Accept', color: 'green' }
                      ].map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setDecision(opt.value)}
                          className={`p-4 rounded-2xl border-2 font-medium transition-all ${
                            decision === opt.value
                              ? `border-${opt.color}-600 bg-${opt.color}-50 text-${opt.color}-800`
                              : 'border-gray-200 hover:border-gray-300 text-gray-600'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">
                      {isSpanish ? 'Feedback para el Autor' : 'Feedback to Author'}
                    </label>
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      rows="6"
                      className="w-full p-5 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-emerald-300 text-sm"
                      placeholder={isSpanish ? 'Explica tu decisión al autor...' : 'Explain your decision to the author...'}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">
                      {isSpanish ? 'Comentarios Internos' : 'Internal Comments'}
                    </label>
                    <textarea
                      value={internalComments}
                      onChange={(e) => setInternalComments(e.target.value)}
                      rows="4"
                      className="w-full p-5 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-emerald-300 text-sm"
                      placeholder={isSpanish ? 'Notas para el equipo editorial...' : 'Notes for the editorial team...'}
                    />
                  </div>

                  <button
                    onClick={handleSubmitDecision}
                    disabled={reviewLoading || !decision}
                    className="w-full py-5 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-2xl transition-all disabled:bg-gray-300"
                  >
                    {reviewLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {isSpanish ? 'GUARDANDO...' : 'SAVING...'}
                      </span>
                    ) : (
                      isSpanish ? 'GUARDAR DECISIÓN' : 'SAVE DECISION'
                    )}
                  </button>
                </div>

                {/* Sección de invitación a revisores (mejorada) */}
                {decision === 'revision-required' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="pt-8 border-t border-gray-200 space-y-6"
                  >
                    <h4 className="font-serif text-xl font-bold text-gray-900">
                      {isSpanish ? 'Seleccionar Revisor' : 'Select Reviewer'}
                    </h4>

                    {/* Buscador de revisores */}
                    <div>
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={isSpanish ? 'Buscar por nombre, email o institución...' : 'Search by name, email or institution...'}
                        className="w-full p-4 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-emerald-300 text-sm"
                      />
                    </div>

                    {/* Lista de revisores */}
                    <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-100 rounded-2xl p-2">
                      {filteredReviewers.length === 0 ? (
                        <p className="text-center text-gray-400 py-4">
                          {isSpanish ? 'No hay revisores disponibles' : 'No reviewers available'}
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
                                ? 'bg-emerald-50 border-2 border-emerald-600'
                                : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {reviewer.imageUrl ? (
                                <img 
                                  src={reviewer.imageUrl} 
                                  className="w-10 h-10 rounded-full object-cover"
                                  alt={reviewer.displayName}
                                />
                              ) : (
                                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                                  <span className="text-lg font-serif font-bold text-gray-500">
                                    {reviewer.displayName?.charAt(0) || '?'}
                                  </span>
                                </div>
                              )}
                              <div className="flex-1">
                                <div className="font-semibold text-gray-900">
                                  {reviewer.displayName}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {reviewer.email}
                                </div>
                                {reviewer.institution && (
                                  <div className="text-xs text-gray-400 mt-1">
                                    {reviewer.institution}
                                  </div>
                                )}
                              </div>
                              {reviewer.roles?.includes('Editor de Sección') && (
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
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
                      className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition-all disabled:bg-emerald-300"
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
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          ) : (
            <motion.div
              key="review-placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center h-64 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200"
            >
              <p className="text-gray-400 text-lg">
                {isSpanish 
                  ? 'Selecciona un envío para comenzar la revisión editorial' 
                  : 'Select a submission to start the desk review'}
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeskReviewPanel;