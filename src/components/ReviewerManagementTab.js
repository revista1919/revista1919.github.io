// src/components/ReviewerManagementTab.js

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../hooks/useLanguage';
import { getRecommendedReviewers } from '../hooks/reviewerRecommendationEngine';

export const decodeBase64IfNeeded = (text) => {
  if (!text || typeof text !== 'string') return text;
  
  if (text.trim() === '') return text;
  
  const tryDecodeBase64 = (str) => {
    try {
      const decoded = atob(str);
      const isText = /^[\x20-\x7E\r\n\t]*$/.test(decoded) || /<[^>]*>/.test(decoded);
      if (!isText || decoded.length === 0) {
        return null;
      }
      return decoded;
    } catch (e) {
      return null;
    }
  };
  
  const cleanText = text.trim();
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (base64Regex.test(cleanText) && cleanText.length % 4 === 0) {
    const decoded = tryDecodeBase64(cleanText);
    if (decoded !== null) {
      return decoded;
    }
  }
  return text;
};

export const ReviewerManagementTab = ({
  task,
  articleArea,
  invitations,
  potentialReviewers,
  selectedReviewerId,
  setSelectedReviewerId,
  searchTerm,
  setSearchTerm,
  onSendInvitation,
  onProceedToDecision,
  loading,
  submittedReviews = []
}) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  const [expandedReview, setExpandedReview] = useState(null);
  
  
    const submittedCount = submittedReviews.length;
  const requiredReviews = task?.requiredReviews || 2;
  const canProceed = submittedCount >= requiredReviews;
  
  // 🔍 DEBUG - Agrega esto aquí
  console.log('🔍 DEBUG ReviewerManagementTab:', {
    'task?.area': task?.area,
    'potentialReviewers length': potentialReviewers?.length,
    'potentialReviewers[0]': potentialReviewers?.[0],
    'invitations length': invitations?.length,
  });
  
  // Calcular recomendaciones
   const recommendationResult = React.useMemo(() => {
    const area = articleArea || task?.area || task?.submission?.area; // ✅ Usar articleArea primero
    
    if (!area || !potentialReviewers?.length) return null;
    
    return getRecommendedReviewers({
      articleArea: area,
      potentialReviewers: potentialReviewers,
      existingInvitations: invitations || [],
      maxRecommendations: 5,
      language: language
    });
  }, [articleArea, task?.area, potentialReviewers, invitations, language]);
    

  // Extraer datos para el renderizado
  const recommendations = recommendationResult?.recommendations || [];
  const fallbackActivated = recommendationResult?.fallbackActivated || false;
  
  // 🔍 DEBUG - También agrega esto
  console.log('🔍 DEBUG renderizado:', {
    recommendationsLength: recommendations.length,
    fallbackActivated,
    mostrarSeccion: recommendations.length > 0
  });

// Extraer datos para el renderizado

  const getStatusBadge = (status) => {
    const statusMap = {
      'pending': { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', label: isSpanish ? 'Pendiente' : 'Pending' },
      'accepted': { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', label: isSpanish ? 'Aceptada' : 'Accepted' },
      'declined': { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200', label: isSpanish ? 'Declinada' : 'Declined' },
      'expired': { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300', label: isSpanish ? 'Expirada' : 'Expired' },
      'submitted': { bg: 'bg-[#FBF9F3]', text: 'text-[#003b5c]', border: 'border-[#C0A86A]', label: isSpanish ? 'Dictaminada' : 'Reviewed' }
    };
    const style = statusMap[status] || statusMap.pending;
    return (
      <span className={`${style.bg} ${style.text} ${style.border} border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest`}>
        {style.label}
      </span>
    );
  };

  const getRecommendationBadge = (recommendation) => {
    const recMap = {
      'accept': { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', label: isSpanish ? 'Aceptar Manuscrito' : 'Accept Manuscript' },
      'minor-revisions': { bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-200', label: isSpanish ? 'Revisiones Menores' : 'Minor Revisions' },
      'major-revisions': { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', label: isSpanish ? 'Revisiones Mayores' : 'Major Revisions' },
      'reject': { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200', label: isSpanish ? 'Rechazar Manuscrito' : 'Reject Manuscript' }
    };
    const style = recMap[recommendation];
    if (!style) return null;
    return (
      <span className={`${style.bg} ${style.text} ${style.border} border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest`}>
        {style.label}
      </span>
    );
  };

  return (
    <div className="space-y-8 font-sans text-slate-800">
      
      {/* ================= HEADER CARD ================= */}
      <div className="bg-[#003b5c] text-white border-t-4 border-[#C0A86A] shadow-sm relative overflow-hidden group">
        {/* Decorative Watermark */}
        <div className="absolute -right-10 -top-10 text-white/5 opacity-20 pointer-events-none transform rotate-12">
          <svg width="200" height="200" viewBox="0 0 24 24" fill="currentColor">
             <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>

        <div className="p-8 relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C0A86A] mb-2">
                {isSpanish ? 'Control de Pares Evaluadores' : 'Peer Review Control'}
              </p>
              <h3 className="font-serif text-3xl font-bold leading-tight">
                {isSpanish ? 'Panel de Dictámenes' : 'Review Panel'}
              </h3>
            </div>
            
            <div className="flex items-center gap-4 bg-white/10 border border-white/20 p-4">
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest text-[#C0A86A] font-bold mb-1">
                  {isSpanish ? 'Dictámenes' : 'Reviews'}
                </p>
                <div className="text-3xl font-serif text-white flex items-baseline gap-1">
                  <span>{submittedCount}</span>
                  <span className="text-lg text-white/50">/ {requiredReviews}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Progress Bar (Rigid/Editorial style) */}
          <div className="mb-6">
            <div className="w-full bg-[#002840] h-1.5 flex">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((submittedCount / requiredReviews) * 100, 100)}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="bg-[#C0A86A] h-full"
              />
            </div>
          </div>
          
          {/* Status Alert */}
          <div className={`p-4 border ${canProceed ? 'bg-emerald-900/40 border-emerald-500/30' : 'bg-amber-900/40 border-amber-500/30'} flex items-start gap-3`}>
            {canProceed ? (
              <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            <p className="text-sm font-serif text-white/90 leading-relaxed">
              {submittedCount < requiredReviews
                ? (isSpanish 
                    ? `Se requiere aguardar la recepción de ${requiredReviews - submittedCount} dictamen(es) adicional(es) para proceder a la resolución final.` 
                    : `Awaiting reception of ${requiredReviews - submittedCount} more review(s) to proceed to final resolution.`)
                : (isSpanish 
                    ? 'El quorum de revisión ha sido satisfecho. Puede proceder a la emisión de la resolución final.' 
                    : 'The review quorum has been met. You may proceed to issue the final resolution.')
              }
            </p>
          </div>
          
          {/* Proceed Button */}
          <button
            onClick={onProceedToDecision}
            disabled={!canProceed || loading}
            className={`mt-6 w-full py-4 text-[11px] uppercase tracking-[0.2em] font-bold transition-colors border ${
              canProceed 
                ? 'bg-white border-white text-[#003b5c] hover:bg-slate-50' 
                : 'bg-transparent border-white/20 text-white/40 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {isSpanish ? 'Procesando Dictámenes...' : 'Processing Reviews...'}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-3">
                {isSpanish ? 'Proceder a Resolución Editorial' : 'Proceed to Editorial Resolution'}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </span>
            )}
          </button>
        </div>
      </div>
      
      {/* ================= COMPLETED REVIEWS ================= */}
      {submittedReviews.length > 0 && (
        <div className="bg-white border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h4 className="font-serif font-bold text-[#003b5c] text-lg">
              {isSpanish ? 'Registro de Dictámenes' : 'Review Records'}
            </h4>
            <span className="text-[10px] font-mono bg-white border border-slate-200 px-2 py-1 text-slate-500">
              Total: {submittedReviews.length}
            </span>
          </div>
          
          <div className="divide-y divide-slate-200">
            {submittedReviews.map((rev) => (
              <div key={rev.id} className="bg-white hover:bg-slate-50/50 transition-colors">
                <div 
                  onClick={() => setExpandedReview(expandedReview === rev.id ? null : rev.id)}
                  className="px-6 py-5 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0 text-[#003b5c]">
                      <span className="font-serif text-xl">
                        {rev.reviewerName?.charAt(0) || rev.reviewerEmail?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div>
                      <p className="font-serif font-bold text-[#003b5c] text-base">
                        {rev.reviewerName || rev.reviewerEmail}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <p className="text-[11px] text-slate-500 font-mono">{rev.reviewerEmail}</p>
                        {rev.recommendation && getRecommendationBadge(rev.recommendation)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 flex-shrink-0 ml-16 sm:ml-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">
                        {isSpanish ? 'Fecha de Emisión' : 'Date of Issue'}
                      </p>
                      <span className="text-xs font-serif text-[#003b5c]">
                        {rev.submittedAt?.toDate?.().toLocaleDateString('es-ES', { 
                          day: '2-digit', month: '2-digit', year: 'numeric'
                        }) || '—'}
                      </span>
                    </div>
                    {getStatusBadge('submitted')}
                    <motion.div 
                      animate={{ rotate: expandedReview === rev.id ? 180 : 0 }}
                      className="w-8 h-8 flex items-center justify-center border border-slate-200 bg-white group-hover:border-[#C0A86A] text-slate-400 group-hover:text-[#C0A86A] transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </motion.div>
                  </div>
                </div>
                
                {/* Expanded Content */}
                <AnimatePresence>
                  {expandedReview === rev.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden border-t border-slate-100"
                    >
                      <div className="p-6 bg-[#FBF9F3] border-l-4 border-[#C0A86A]">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                          
                          {/* Comments to Author */}
                          {rev.commentsToAuthor && (
                            <div>
                              <h5 className="font-sans text-[10px] uppercase tracking-widest font-bold text-[#C0A86A] mb-3">
                                {isSpanish ? 'Observaciones para el Autor' : 'Observations for Author'}
                              </h5>
                              <div className="bg-white border border-slate-200 p-5 shadow-sm">
                                <div 
                                  className="prose prose-sm max-w-none font-serif text-slate-700 leading-relaxed"
                                  dangerouslySetInnerHTML={{ __html: decodeBase64IfNeeded(rev.commentsToAuthor) }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Confidential Comments to Editor */}
                          {rev.commentsToEditor && (
                            <div>
                              <h5 className="font-sans text-[10px] uppercase tracking-widest font-bold text-amber-700 mb-3 flex items-center gap-2">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                {isSpanish ? 'Notas Confidenciales al Editor' : 'Confidential Editor Notes'}
                              </h5>
                              <div className="bg-amber-50 border border-amber-200 p-5 shadow-sm">
                                <div 
                                  className="prose prose-sm max-w-none font-serif text-amber-900 leading-relaxed italic"
                                  dangerouslySetInnerHTML={{ __html: decodeBase64IfNeeded(rev.commentsToEditor) }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Scores Grid */}
                        {rev.scores && Object.keys(rev.scores).length > 0 && (
                          <div className="mt-8 border-t border-[#C0A86A]/20 pt-6">
                            <h5 className="font-sans text-[10px] uppercase tracking-widest font-bold text-[#003b5c] mb-4">
                              {isSpanish ? 'Rúbrica Cuantitativa' : 'Quantitative Rubric'}
                            </h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                              {Object.entries(rev.scores).map(([key, value]) => (
                                <div key={key} className="flex items-center justify-between border-b border-slate-200 pb-2">
                                  <span className="text-xs font-serif text-slate-700">{key}</span>
                                  <div className="flex items-center gap-1.5">
                                    {[...Array(5)].map((_, i) => (
                                      <div 
                                        key={i}
                                        className={`w-4 h-1 ${
                                          i < value ? 'bg-[#003b5c]' : 'bg-slate-200'
                                        }`}
                                      />
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Reviewer Document */}
                        {rev.reviewerFileId && (
                          <div className="mt-8">
                            <a
                              href={`https://docs.google.com/document/d/${rev.reviewerFileId}/edit`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-3 px-5 py-3 bg-[#003b5c] hover:bg-[#002840] text-white text-[10px] uppercase tracking-widest font-bold transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              {isSpanish ? 'Acceder al Documento Marcado' : 'Access Marked Document'}
                            </a>
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
      )}
      
      {/* ================= PENDING INVITATIONS ================= */}
      {invitations.filter(inv => inv.status !== 'submitted').length > 0 && (
        <div className="bg-white border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <h4 className="font-serif font-bold text-[#003b5c] text-lg">
              {isSpanish ? 'Convocatorias Activas' : 'Active Invitations'}
            </h4>
          </div>
          <div className="divide-y divide-slate-100">
            {invitations.filter(inv => inv.status !== 'submitted').map(rev => (
              <div key={rev.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 border border-slate-200 bg-white flex items-center justify-center flex-shrink-0 text-slate-400">
                    <span className="font-serif text-lg">
                      {rev.reviewerName?.charAt(0) || rev.reviewerEmail?.charAt(0) || '?'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-serif font-bold text-[#003b5c] truncate">
                      {rev.reviewerName || rev.reviewerEmail}
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono truncate">{rev.reviewerEmail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 flex-shrink-0">
                  <div className="text-right hidden sm:block">
                    {rev.invitedAt && (
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                        {isSpanish ? 'Invitado:' : 'Invited:'} <span className="font-serif text-slate-600 ml-1">{rev.invitedAt.toDate?.().toLocaleDateString()}</span>
                      </p>
                    )}
                    {rev.respondedAt && (
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">
                        {isSpanish ? 'Respuesta:' : 'Response:'} <span className="font-serif text-slate-600 ml-1">{rev.respondedAt.toDate?.().toLocaleDateString()}</span>
                      </p>
                    )}
                  </div>
                  {getStatusBadge(rev.status)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

{/* ================= RECOMMENDED REVIEWERS ================= */}
{recommendations.length > 0 && (
  <div className="bg-white border border-slate-200 shadow-sm">
    <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-[#003b5c] to-[#002b44] text-white">
      <div className="flex items-center justify-between">
        <h4 className="font-serif font-bold text-lg flex items-center gap-2">
          <svg className="w-5 h-5 text-[#C0A86A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          {isSpanish ? 'Revisores Recomendados' : 'Recommended Reviewers'}
        </h4>
        <span className="text-[10px] bg-[#C0A86A]/20 text-[#C0A86A] px-3 py-1 uppercase tracking-widest font-bold">
          {isSpanish ? 'Sistema Inteligente' : 'Smart System'}
        </span>
      </div>
      <p className="text-xs text-slate-300 mt-1 font-sans">
        {isSpanish 
          ? 'Basado en coincidencia temática, rendimiento histórico y disponibilidad actual'
          : 'Based on thematic matching, historical performance and current availability'}
      </p>
    </div>
    
    <div className="divide-y divide-slate-100">
      {recommendations.map((reviewer) => (
        <motion.div
          key={reviewer.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setSelectedReviewerId(reviewer.id)}
          className={`p-5 cursor-pointer transition-all ${
            selectedReviewerId === reviewer.id
              ? 'bg-blue-50/30 border-l-4 border-[#003b5c]'
              : 'border-l-4 border-transparent hover:bg-slate-50'
          }`}
        >
          <div className="flex items-start gap-4">
            {/* Rank Badge */}
            <div className="flex-shrink-0">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                reviewer.rank === 1 
                  ? 'bg-[#C0A86A] text-white' 
                  : 'bg-slate-100 text-slate-600'
              }`}>
                #{reviewer.rank}
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-serif font-bold text-[#003b5c] text-base">
                  {reviewer.displayName}
                </span>
                <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 uppercase tracking-wider">
                  {reviewer.tierLabel}
                </span>
              </div>
              
              <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
                <span className="font-mono">{reviewer.email}</span>
                {reviewer.institution && (
                  <span className="text-slate-400">| {reviewer.institution}</span>
                )}
              </div>
              
              {/* Score Bar */}
              <div className="mb-3">
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>{isSpanish ? 'Puntuación' : 'Score'}</span>
                  <span className="font-bold text-[#003b5c]">
                    {(reviewer.compositeScore * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${reviewer.compositeScore * 100}%` }}
                    className={`h-full rounded-full ${
                      reviewer.compositeScore >= 0.8 ? 'bg-emerald-500' :
                      reviewer.compositeScore >= 0.65 ? 'bg-[#003b5c]' :
                      reviewer.compositeScore >= 0.5 ? 'bg-amber-500' :
                      'bg-slate-400'
                    }`}
                  />
                </div>
              </div>
              
              {/* Score Breakdown Tooltip */}
              <div className="flex flex-wrap gap-2 mb-2">
                {Object.entries(reviewer.scoreBreakdown).map(([key, value]) => (
                  <span key={key} className="text-[9px] bg-slate-50 px-2 py-0.5 text-slate-500 uppercase tracking-wider">
                    {key}: {(value * 100).toFixed(0)}%
                  </span>
                ))}
              </div>
              
              {/* Recommendation Reasons */}
              <div className="flex flex-wrap gap-1.5">
                {reviewer.recommendationReasons.map((reason, idx) => (
                  <span key={idx} className="text-[10px] bg-[#FBF9F3] text-[#003b5c] px-2 py-0.5 border border-[#C0A86A]/20">
                    {reason}
                  </span>
                ))}
              </div>
              
              {/* Stats Mini */}
              <div className="flex gap-4 mt-3 text-[10px] text-slate-400">
                <span>
                  {isSpanish ? 'Revisiones: ' : 'Reviews: '}
                  <strong className="text-slate-600">{reviewer.stats?.totalReviewsCompleted || 0}</strong>
                </span>
                <span>
                  {isSpanish ? 'Puntualidad: ' : 'On-time: '}
                  <strong className="text-slate-600">{reviewer.stats?.onTimeRate || 100}%</strong>
                </span>
                <span>
                  {isSpanish ? 'Carga: ' : 'Load: '}
                  <strong className="text-slate-600">
                    {reviewer.availability?.currentActiveReviews || 0}/{reviewer.availability?.maxActiveReviews || 3}
                  </strong>
                </span>
              </div>
            </div>
            
            {/* Selection Indicator */}
            <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              selectedReviewerId === reviewer.id
                ? 'border-[#003b5c] bg-[#003b5c]'
                : 'border-slate-300'
            }`}>
              {selectedReviewerId === reviewer.id && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
    
    {fallbackActivated && (
      <div className="px-6 py-3 bg-amber-50 border-t border-amber-200">
        <p className="text-xs text-amber-800 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {isSpanish
            ? 'No se encontraron revisores con coincidencia exacta. Mostrando los mejores perfiles en la categoría macro.'
            : 'No reviewers with exact match found. Showing best profiles in the broader category.'}
        </p>
      </div>
    )}
  </div>
)}
      {/* ================= NEW REVIEWER SEARCH ================= */}
      <div className="bg-white border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 bg-[#003b5c] text-white">
          <h4 className="font-serif font-bold text-lg">
            {isSpanish ? 'Designar Par Evaluador' : 'Designate Peer Reviewer'}
          </h4>
        </div>
        
        <div className="p-6">
          <div className="relative mb-6">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isSpanish ? 'Búsqueda en padrón por nombre, correo o afiliación...' : 'Search registry by name, email or affiliation...'}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 focus:outline-none focus:border-[#003b5c] focus:ring-1 focus:ring-[#003b5c] transition-all font-serif text-sm placeholder-slate-400"
            />
          </div>
          
          <div className="max-h-[300px] overflow-y-auto border border-slate-200 bg-slate-50 mb-6">
            {potentialReviewers.length === 0 ? (
              <div className="text-center py-10 px-4">
                <p className="font-serif text-slate-500 text-lg">
                  {searchTerm
                    ? (isSpanish ? 'No existen coincidencias en el padrón.' : 'No matches found in registry.')
                    : (isSpanish ? 'El padrón de revisores se encuentra vacío.' : 'The reviewer registry is empty.')}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {potentialReviewers.map((reviewer) => (
                  <div
                    key={reviewer.id}
                    onClick={() => setSelectedReviewerId(reviewer.id)}
                    className={`p-4 cursor-pointer transition-colors flex items-center gap-4 ${
                      selectedReviewerId === reviewer.id
                        ? 'bg-blue-50/50 border-l-4 border-[#003b5c]'
                        : 'bg-white border-l-4 border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-4 h-4 border flex items-center justify-center flex-shrink-0 ${
                      selectedReviewerId === reviewer.id ? 'border-[#003b5c] bg-[#003b5c]' : 'border-slate-300 bg-white'
                    }`}>
                      {selectedReviewerId === reviewer.id && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-serif font-bold text-[#003b5c] truncate">
                        {reviewer.displayName}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[11px] text-slate-500 font-mono truncate">{reviewer.email}</span>
                        {reviewer.institution && (
                          <span className="text-[10px] text-slate-400 uppercase tracking-widest truncate border-l border-slate-300 pl-3">
                            {reviewer.institution}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <button
            onClick={onSendInvitation}
            disabled={loading || !selectedReviewerId}
            className={`w-full py-4 text-[11px] uppercase tracking-[0.2em] font-bold transition-colors border ${
              !loading && selectedReviewerId 
                ? 'bg-white border-[#003b5c] text-[#003b5c] hover:bg-[#003b5c] hover:text-white' 
                : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {isSpanish ? 'EMITIENDO CONVOCATORIA...' : 'ISSUING INVITATION...'}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-3">
                {isSpanish ? 'EMITIR CONVOCATORIA OFICIAL' : 'ISSUE OFFICIAL INVITATION'}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};