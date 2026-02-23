// src/components/FinalDecisionTab.js
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../hooks/useLanguage';

export const FinalDecisionTab = ({ task, reviewers, onSubmitDecision, loading }) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  const [decision, setDecision] = useState('');
  const [feedback, setFeedback] = useState('');
  const [internalComments, setInternalComments] = useState('');
  const [selectedReview, setSelectedReview] = useState(null);

  const handleSubmit = async () => {
    if (!decision) {
      alert(isSpanish ? 'Selecciona una decisión' : 'Select a decision');
      return;
    }
    await onSubmitDecision(task.id, { decision, feedbackToAuthor: feedback, commentsToEditorial: internalComments });
  };

  return (
    <div className="space-y-6">
      {/* Resumen de revisiones */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <h4 className="font-['Playfair_Display'] font-bold text-[#0A1929] mb-3">
          {isSpanish ? 'Resumen de Revisiones' : 'Review Summary'}
        </h4>
        <div className="space-y-3">
          {reviewers.filter(r => r.status === 'submitted').map(r => (
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
            ? 'Sintetiza las revisiones y comunica tu decisión final al autor...' 
            : 'Synthesize the reviews and communicate your final decision to the author...'}
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
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || !decision}
        className="w-full py-4 bg-[#0A1929] hover:bg-[#1E2F40] text-white font-['Playfair_Display'] font-bold rounded-xl transition-all disabled:bg-[#E5E9F0] disabled:text-[#5A6B7A]"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            {isSpanish ? 'GUARDANDO DECISIÓN...' : 'SAVING DECISION...'}
          </span>
        ) : (
          isSpanish ? 'GUARDAR DECISIÓN FINAL' : 'SAVE FINAL DECISION'
        )}
      </button>
    </div>
  );
};