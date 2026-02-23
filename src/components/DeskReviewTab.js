// src/components/DeskReviewTab.js
import React, { useState } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import { useEditorialReview } from '../hooks/useEditorialReview';

export const DeskReviewTab = ({ task, user, onComplete, loading: externalLoading }) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  const [decision, setDecision] = useState(task.deskReviewDecision || '');
  const [feedback, setFeedback] = useState(task.deskReviewFeedback || '');
  const [internalComments, setInternalComments] = useState(task.deskReviewComments || '');
  
  // Usar el hook para manejar la revisión editorial
  const { loading: hookLoading, error, submitDeskReviewDecision } = useEditorialReview(user);
  
  const submission = task.submission || {};
  
  // Combinar el loading externo con el del hook
  const isLoading = externalLoading || hookLoading;

  // Función handleSubmit corregida
  const handleSubmit = async () => {
    try {
      // Validar que hay una decisión seleccionada
      if (!decision) {
        alert(isSpanish ? 'Debes seleccionar una decisión' : 'You must select a decision');
        return;
      }

      // Validar que hay un reviewId en el task
      if (!task.reviewId) {
        console.error('No reviewId found in task');
        alert(isSpanish ? 'Error: ID de revisión no encontrado' : 'Error: Review ID not found');
        return;
      }

      // Preparar los datos de la decisión
      const decisionData = {
        decision,
        feedbackToAuthor: feedback,
        commentsToEditorial: internalComments
      };

      // Enviar la decisión usando el hook
      const result = await submitDeskReviewDecision(task.reviewId, decisionData);
      
      if (result.success) {
        // Si hay una función onComplete, llamarla
        if (onComplete) {
          onComplete({
            decision,
            feedback,
            internalComments,
            reviewId: task.reviewId
          });
        }
        
        // Mostrar mensaje de éxito
        alert(result.message || (isSpanish ? 'Decisión guardada exitosamente' : 'Decision saved successfully'));
      } else {
        // Mostrar error si algo salió mal
        alert(result.error || (isSpanish ? 'Error al guardar la decisión' : 'Error saving decision'));
      }
    } catch (err) {
      console.error('Error in handleSubmit:', err);
      alert(isSpanish ? 'Error al procesar la solicitud' : 'Error processing request');
    }
  };

  // Función para formatear autores
  const formatAuthors = (authors) => {
    if (!authors || authors.length === 0) return '—';
    return authors.map(author => {
      const name = `${author.firstName || ''} ${author.lastName || ''}`.trim();
      const affiliation = author.institution ? ` (${author.institution})` : '';
      const corresponding = author.isCorresponding ? ' ✉️' : '';
      return `${name}${affiliation}${corresponding}`;
    }).join('; ');
  };

  return (
    <div className="space-y-6">
      {/* Mostrar error si existe */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      
      {/* ENCABEZADO con título e IDs */}
      <div className="bg-gradient-to-r from-[#0A1929] to-[#1E2F40] text-white rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <span className="inline-block px-3 py-1 bg-[#C0A86A] text-[#0A1929] text-xs font-bold rounded-full mb-3">
              {submission.submissionId || 'Sin ID'}
            </span>
            <h2 className="font-['Playfair_Display'] text-2xl font-bold mb-2">
              {isSpanish ? submission.title : submission.titleEn || submission.title}
            </h2>
            <p className="text-[#E5E9F0] text-sm">
              {isSpanish ? 'Área:' : 'Area:'} {submission.area || '—'} • 
              {isSpanish ? ' Estado:' : ' Status:'} {submission.status || '—'} • 
              {isSpanish ? ' Ronda:' : ' Round:'} {submission.currentRound || 1}
            </p>
          </div>
          <a 
            href={submission.driveFolderUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors text-sm whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {isSpanish ? 'Ver archivos en Drive' : 'View files in Drive'}
          </a>
        </div>
      </div>

      {/* INFORMACIÓN DEL AUTOR PRINCIPAL */}
      <div className="bg-[#F5F7FA] rounded-xl p-6 border border-[#E5E9F0]">
        <h3 className="font-['Playfair_Display'] font-bold text-[#0A1929] text-lg mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-[#C0A86A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          {isSpanish ? 'Autor Principal' : 'Corresponding Author'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#5A6B7A] uppercase tracking-wider mb-1">
              {isSpanish ? 'Nombre' : 'Name'}
            </label>
            <p className="text-[#0A1929] font-medium">{submission.authorName || '—'}</p>
          </div>
          <div>
            <label className="block text-xs text-[#5A6B7A] uppercase tracking-wider mb-1">
              Email
            </label>
            <p className="text-[#0A1929] font-medium">{submission.authorEmail || '—'}</p>
          </div>
          <div>
            <label className="block text-xs text-[#5A6B7A] uppercase tracking-wider mb-1">
              ORCID
            </label>
            <p className="text-[#0A1929] font-medium">{submission.authors?.[0]?.orcid || '—'}</p>
          </div>
          <div>
            <label className="block text-xs text-[#5A6B7A] uppercase tracking-wider mb-1">
              {isSpanish ? 'Institución' : 'Institution'}
            </label>
            <p className="text-[#0A1929] font-medium">{submission.authors?.[0]?.institution || '—'}</p>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-[#5A6B7A] uppercase tracking-wider mb-1">
              {isSpanish ? 'Contribución' : 'Contribution'}
            </label>
            <p className="text-[#0A1929] font-medium">{submission.authors?.[0]?.contribution || '—'}</p>
          </div>
        </div>
      </div>

      {/* LISTA COMPLETA DE AUTORES (si hay más de uno) */}
      {submission.authors && submission.authors.length > 1 && (
        <div className="bg-[#F5F7FA] rounded-xl p-6 border border-[#E5E9F0]">
          <h3 className="font-['Playfair_Display'] font-bold text-[#0A1929] text-lg mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-[#C0A86A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            {isSpanish ? 'Coautores' : 'Co-authors'} ({submission.authors.length - 1})
          </h3>
          <div className="space-y-3">
            {submission.authors.slice(1).map((author, index) => (
              <div key={index} className="bg-white rounded-lg p-4 border border-[#E5E9F0]">
                <p className="font-medium text-[#0A1929]">
                  {author.firstName} {author.lastName}
                  {author.isCorresponding && <span className="ml-2 text-[#C0A86A]" title="Corresponding author">✉️</span>}
                </p>
                <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                  <p className="text-[#5A6B7A]">{author.institution || '—'}</p>
                  <p className="text-[#5A6B7A]">{author.email || '—'}</p>
                </div>
                {author.contribution && (
                  <p className="text-sm text-[#5A6B7A] mt-1">{author.contribution}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RESUMEN (Abstract) - Bilingüe */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#F5F7FA] rounded-xl p-6 border border-[#E5E9F0]">
          <h3 className="font-['Playfair_Display'] font-bold text-[#0A1929] text-lg mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-[#C0A86A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {isSpanish ? 'Resumen' : 'Abstract'} (ES)
          </h3>
          <p className="text-[#0A1929] text-sm leading-relaxed whitespace-pre-wrap">
            {submission.abstract || '—'}
          </p>
        </div>
        <div className="bg-[#F5F7FA] rounded-xl p-6 border border-[#E5E9F0]">
          <h3 className="font-['Playfair_Display'] font-bold text-[#0A1929] text-lg mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-[#C0A86A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {isSpanish ? 'Resumen' : 'Abstract'} (EN)
          </h3>
          <p className="text-[#0A1929] text-sm leading-relaxed whitespace-pre-wrap">
            {submission.abstractEn || submission.abstract || '—'}
          </p>
        </div>
      </div>

      {/* PALABRAS CLAVE Y FINANCIAMIENTO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#F5F7FA] rounded-xl p-6 border border-[#E5E9F0]">
          <h3 className="font-['Playfair_Display'] font-bold text-[#0A1929] text-lg mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-[#C0A86A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l5 5a2 2 0 01.586 1.414V19a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
            </svg>
            {isSpanish ? 'Palabras Clave' : 'Keywords'}
          </h3>
          <div className="flex flex-wrap gap-2">
            {(isSpanish ? submission.keywords : submission.keywordsEn || submission.keywords)?.map((keyword, index) => (
              <span key={index} className="px-3 py-1 bg-white border border-[#C0A86A] text-[#0A1929] rounded-full text-sm">
                {keyword}
              </span>
            )) || '—'}
          </div>
        </div>
        <div className="bg-[#F5F7FA] rounded-xl p-6 border border-[#E5E9F0]">
          <h3 className="font-['Playfair_Display'] font-bold text-[#0A1929] text-lg mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-[#C0A86A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {isSpanish ? 'Financiamiento' : 'Funding'}
          </h3>
          {submission.funding?.hasFunding ? (
            <div className="space-y-2">
              <p className="text-[#0A1929] font-medium">{submission.funding.sources || '—'}</p>
              <p className="text-sm text-[#5A6B7A]">Grant: {submission.funding.grantNumbers || '—'}</p>
            </div>
          ) : (
            <p className="text-[#5A6B7A] italic">{isSpanish ? 'Sin financiamiento' : 'No funding'}</p>
          )}
        </div>
      </div>

      {/* CONFLICTO DE INTERESES Y DISPONIBILIDAD */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#F5F7FA] rounded-xl p-6 border border-[#E5E9F0]">
          <h3 className="font-['Playfair_Display'] font-bold text-[#0A1929] text-lg mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-[#C0A86A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {isSpanish ? 'Conflicto de Intereses' : 'Conflict of Interest'}
          </h3>
          <p className="text-[#0A1929]">{submission.conflictOfInterest || '—'}</p>
        </div>
        <div className="bg-[#F5F7FA] rounded-xl p-6 border border-[#E5E9F0]">
          <h3 className="font-['Playfair_Display'] font-bold text-[#0A1929] text-lg mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-[#C0A86A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
            {isSpanish ? 'Disponibilidad de Datos' : 'Data Availability'}
          </h3>
          <p className="text-[#0A1929]">
            {isSpanish 
              ? (submission.dataAvailability === 'available' ? 'Disponible' : 
                 submission.dataAvailability === 'upon_request' ? 'Bajo solicitud' : 'No disponible')
              : (submission.dataAvailability === 'available' ? 'Available' : 
                 submission.dataAvailability === 'upon_request' ? 'Upon request' : 'Not available')
            }
          </p>
        </div>
      </div>

      {/* DECISIÓN EDITORIAL */}
      <div className="mt-8 pt-6 border-t-2 border-[#E5E9F0]">
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

      {/* Feedback y Comentarios */}
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
        disabled={isLoading || !decision}
        className="w-full py-4 bg-[#0A1929] hover:bg-[#1E2F40] text-white font-['Playfair_Display'] font-bold rounded-xl transition-all disabled:bg-[#E5E9F0] disabled:text-[#5A6B7A]"
      >
        {isLoading ? (
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