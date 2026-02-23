// src/components/DeskReviewTab.js
import React, { useState } from 'react';
import { useLanguage } from '../hooks/useLanguage';

export const DeskReviewTab = ({ task, user, onComplete, loading }) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  const [decision, setDecision] = useState(task.deskReviewDecision || '');
  const [feedback, setFeedback] = useState(task.deskReviewFeedback || '');
  const [internalComments, setInternalComments] = useState(task.deskReviewComments || '');

  const handleSubmit = async () => {
    if (!decision) {
      alert(isSpanish ? 'Debes seleccionar una decisión' : 'You must select a decision');
      return;
    }
    await onComplete(task.id, { decision, feedbackToAuthor: feedback, commentsToEditorial: internalComments });
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#F5F7FA] rounded-xl p-4 border border-[#E5E9F0]">
        <h4 className="font-['Playfair_Display'] font-bold text-[#0A1929] mb-3">
          {isSpanish ? 'Información del Artículo' : 'Article Information'}
        </h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-[#5A6B7A]">{isSpanish ? 'ID:' : 'ID:'}</span>
            <span className="ml-2 font-mono text-[#0A1929]">{task.submission?.submissionId}</span>
          </div>
          <div>
            <span className="text-[#5A6B7A]">{isSpanish ? 'Área:' : 'Area:'}</span>
            <span className="ml-2 text-[#0A1929]">{task.submission?.area}</span>
          </div>
        </div>
        <a 
          href={task.submission?.driveFolderUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 mt-3 text-[#C0A86A] hover:text-[#A58D4F] text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {isSpanish ? 'Ver en Drive' : 'View in Drive'}
        </a>
      </div>

      <div>
        <label className="block font-['Playfair_Display'] font-semibold text-[#0A1929] mb-3">
          {isSpanish ? 'Decisión Editorial' : 'Editorial Decision'}
        </label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'reject', label: isSpanish ? 'Rechazar' : 'Reject', bg: 'bg-red-50 hover:bg-red-100', border: 'border-red-200' },
            { value: 'minor-revision', label: isSpanish ? 'Revisión menor' : 'Minor revision', bg: 'bg-yellow-50 hover:bg-yellow-100', border: 'border-yellow-200' },
            { value: 'revision-required', label: isSpanish ? 'Enviar a revisión' : 'Send to review', bg: 'bg-blue-50 hover:bg-blue-100', border: 'border-blue-200' },
            { value: 'accept', label: isSpanish ? 'Aceptar' : 'Accept', bg: 'bg-green-50 hover:bg-green-100', border: 'border-green-200' }
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
            {isSpanish ? 'GUARDANDO...' : 'SAVING...'}
          </span>
        ) : (
          isSpanish ? 'GUARDAR DECISIÓN' : 'SAVE DECISION'
        )}
      </button>
    </div>
  );
};