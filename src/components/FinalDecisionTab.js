// src/components/FinalDecisionTab.js (VERSIÓN MODIFICADA)
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../hooks/useLanguage';
import { useEditorialReview } from '../hooks/useEditorialReview';
import { useAuth } from '../hooks/useAuth';

export const FinalDecisionTab = ({ task, reviewers, onSubmitDecision, loading: externalLoading }) => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { submitDeskReviewDecision, loading: hookLoading } = useEditorialReview(user);
  const isSpanish = language === 'es';
  
  const [decision, setDecision] = useState('');
  const [feedback, setFeedback] = useState('');
  const [internalComments, setInternalComments] = useState('');
  const [selectedReview, setSelectedReview] = useState(null);
  const [localLoading, setLocalLoading] = useState(false);

  const loading = externalLoading || hookLoading || localLoading;

  const handleSubmit = async () => {
    if (!decision) {
      alert(isSpanish ? 'Selecciona una decisión' : 'Select a decision');
      return;
    }

    if (!task?.editorialReviewId) {
      console.error('No editorialReviewId found in task:', task);
      alert(isSpanish 
        ? 'Error: No se encontró el ID de la revisión editorial' 
        : 'Error: Editorial review ID not found');
      return;
    }

    setLocalLoading(true);
    try {
      // Usar el hook useEditorialReview para enviar la decisión
      const result = await submitDeskReviewDecision(task.editorialReviewId, {
        decision,
        feedbackToAuthor: feedback,
        commentsToEditorial: internalComments,
        submissionId: task.submissionId,
        editorialTaskId: task.id
      });

      console.log('✅ Decisión guardada:', result);
      
      // Llamar al callback original por si es necesario
      if (onSubmitDecision) {
        await onSubmitDecision(task.id, { 
          decision, 
          feedbackToAuthor: feedback, 
          commentsToEditorial: internalComments 
        });
      }

      // Limpiar formulario
      setDecision('');
      setFeedback('');
      setInternalComments('');
      
    } catch (error) {
      console.error('❌ Error al guardar decisión:', error);
      alert(isSpanish 
        ? `Error al guardar la decisión: ${error.message}` 
        : `Error saving decision: ${error.message}`);
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ✅ NUEVO: Indicador de flujo cuando se solicitan revisiones */}
      {(decision === 'major-revision' || decision === 'minor-revision') && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-blue-800 mb-1">
                {isSpanish ? 'Flujo de revisiones solicitadas' : 'Revision request flow'}
              </h4>
              <p className="text-sm text-blue-700">
                {isSpanish 
                  ? 'Al guardar esta decisión, el estado del artículo cambiará a "revisions-requested". El autor recibirá una notificación y podrá subir una versión revisada. El sistema quedará en espera de la respuesta del autor.'
                  : 'When saving this decision, the article status will change to "revisions-requested". The author will receive a notification and can upload a revised version. The system will await the author\'s response.'}
              </p>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span className="bg-blue-200 text-blue-800 px-3 py-1 rounded-full font-medium">
                  {isSpanish ? 'Estado actual:' : 'Current state:'} {task?.submission?.status || '—'}
                </span>
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                <span className="bg-yellow-200 text-yellow-800 px-3 py-1 rounded-full font-medium">
                  {isSpanish ? '→ revisions-requested' : '→ revisions-requested'}
                </span>
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                <span className="bg-purple-200 text-purple-800 px-3 py-1 rounded-full font-medium">
                  {isSpanish ? 'Esperando autor' : 'Awaiting author'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ NUEVO: Si el artículo ya está en espera de revisiones, mostrarlo */}
      {task?.submission?.status === 'revisions-requested' && (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-yellow-800 mb-1">
                {isSpanish ? '⏳ Esperando revisión del autor' : '⏳ Awaiting author revision'}
              </h4>
              <p className="text-sm text-yellow-700">
                {isSpanish 
                  ? 'Este artículo está actualmente en espera de que el autor suba una versión revisada. El sistema notificará automáticamente cuando se reciba la nueva versión.'
                  : 'This article is currently awaiting the author to upload a revised version. The system will automatically notify when the new version is received.'}
              </p>
              {task.submissionRevision?.requestedAt && (
                <p className="text-xs text-yellow-600 mt-2">
                  {isSpanish ? 'Solicitado el:' : 'Requested on:'} {new Date(task.submissionRevision.requestedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Resumen de revisiones */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <h4 className="font-['Playfair_Display'] font-bold text-[#0A1929] mb-3">
          {isSpanish ? 'Resumen de Revisiones' : 'Review Summary'}
        </h4>
        <div className="space-y-3">
          {reviewers?.filter(r => r.status === 'submitted').map(r => (
            <div key={r.id} className="p-3 bg-white rounded-lg border border-yellow-100">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-['Playfair_Display'] font-bold text-[#0A1929]">{r.reviewerName}</p>
                  <p className="text-xs text-[#5A6B7A]">{r.reviewerEmail}</p>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  r.recommendation === 'accept' ? 'bg-green-100 text-green-700' :
                  r.recommendation === 'minor-revisions' ? 'bg-blue-100 text-blue-700' :
                  r.recommendation === 'major-revisions' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {r.recommendation === 'accept' && (isSpanish ? 'Aceptar' : 'Accept')}
                  {r.recommendation === 'minor-revisions' && (isSpanish ? 'Revisiones menores' : 'Minor revisions')}
                  {r.recommendation === 'major-revisions' && (isSpanish ? 'Revisiones mayores' : 'Major revisions')}
                  {r.recommendation === 'reject' && (isSpanish ? 'Rechazar' : 'Reject')}
                </span>
              </div>
              <button
                onClick={() => setSelectedReview(selectedReview?.id === r.id ? null : r)}
                className="mt-2 text-xs text-[#C0A86A] hover:text-[#A58D4F] font-medium"
              >
                {selectedReview?.id === r.id 
                  ? (isSpanish ? 'Ocultar detalles' : 'Hide details')
                  : (isSpanish ? 'Ver detalles' : 'View details')}
              </button>
              
              <AnimatePresence>
                {selectedReview?.id === r.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 pt-3 border-t border-yellow-100"
                  >
                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="font-bold text-[#0A1929] mb-1">
                          {isSpanish ? 'Puntuaciones:' : 'Scores:'}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(r.scores || {}).map(([key, value]) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-[#5A6B7A]">{key}:</span>
                              <span className="font-bold text-[#0A1929]">{value}/2</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {r.commentsToAuthor && (
                        <div>
                          <p className="font-bold text-[#0A1929] mb-1">
                            {isSpanish ? 'Comentarios para autor:' : 'Comments for author:'}
                          </p>
                          <div className="text-[#5A6B7A]" dangerouslySetInnerHTML={{ __html: r.commentsToAuthor }} />
                        </div>
                      )}
                      {r.commentsToEditor && (
                        <div className="bg-gray-50 p-2 rounded">
                          <p className="font-bold text-[#0A1929] mb-1">
                            {isSpanish ? 'Confidencial:' : 'Confidential:'}
                          </p>
                          <div className="text-[#5A6B7A] italic" dangerouslySetInnerHTML={{ __html: r.commentsToEditor }} />
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
          {(!reviewers || reviewers.filter(r => r.status === 'submitted').length === 0) && (
            <p className="text-center text-[#5A6B7A] py-4">
              {isSpanish ? 'No hay revisiones completadas aún' : 'No completed reviews yet'}
            </p>
          )}
        </div>
      </div>

      {/* Decisión Final */}
      <div>
        <label className="block font-['Playfair_Display'] font-semibold text-[#0A1929] mb-3">
          {isSpanish ? 'Decisión Final' : 'Final Decision'}
        </label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'accept', label: isSpanish ? 'Aceptar' : 'Accept', bg: 'bg-green-50 hover:bg-green-100', border: 'border-green-200' },
            { value: 'minor-revision', label: isSpanish ? 'Revisiones menores' : 'Minor revisions', bg: 'bg-blue-50 hover:bg-blue-100', border: 'border-blue-200' },
            { value: 'major-revision', label: isSpanish ? 'Revisiones mayores' : 'Major revisions', bg: 'bg-yellow-50 hover:bg-yellow-100', border: 'border-yellow-200' },
            { value: 'reject', label: isSpanish ? 'Rechazar' : 'Reject', bg: 'bg-red-50 hover:bg-red-100', border: 'border-red-200' }
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setDecision(opt.value)}
              className={`p-4 rounded-xl border-2 font-['Lora'] transition-all ${
                decision === opt.value
                  ? 'border-[#C0A86A] bg-[#FBF9F3] text-[#0A1929]'
                  : `${opt.bg} ${opt.border} text-[#5A6B7A] hover:text-[#0A1929]`
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
          rows="5"
          className="w-full p-4 bg-[#F5F7FA] border border-[#E5E9F0] rounded-xl focus:ring-2 focus:ring-[#C0A86A] focus:border-transparent font-['Lora'] text-sm"
          placeholder={isSpanish 
            ? 'Sintetiza las revisiones y comunica tu decisión final al autor. Si solicitas revisiones, sé específico sobre los cambios requeridos...' 
            : 'Synthesize the reviews and communicate your final decision to the author. If requesting revisions, be specific about required changes...'}
          disabled={loading}
        />
      </div>

      <div>
        <label className="block font-['Playfair_Display'] font-semibold text-[#0A1929] mb-3">
          {isSpanish ? 'Comentarios Internos' : 'Internal Comments'}
        </label>
        <textarea
          value={internalComments}
          onChange={(e) => setInternalComments(e.target.value)}
          rows="3"
          className="w-full p-4 bg-[#F5F7FA] border border-[#E5E9F0] rounded-xl focus:ring-2 focus:ring-[#C0A86A] focus:border-transparent font-['Lora'] text-sm"
          placeholder={isSpanish ? 'Notas para el equipo editorial...' : 'Notes for the editorial team...'}
          disabled={loading}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || !decision}
        className={`w-full py-4 font-['Playfair_Display'] font-bold rounded-xl transition-all ${
          decision === 'major-revision' || decision === 'minor-revision'
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-[#0A1929] hover:bg-[#1E2F40] text-white'
        } disabled:bg-[#E5E9F0] disabled:text-[#5A6B7A]`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            {isSpanish ? 'GUARDANDO DECISIÓN...' : 'SAVING DECISION...'}
          </span>
        ) : (
          decision === 'major-revision' || decision === 'minor-revision'
            ? (isSpanish ? 'SOLICITAR REVISIONES AL AUTOR' : 'REQUEST AUTHOR REVISIONS')
            : (isSpanish ? 'GUARDAR DECISIÓN FINAL' : 'SAVE FINAL DECISION')
        )}
      </button>
    </div>
  );
};