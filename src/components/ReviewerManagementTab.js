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

// ==========================================
// ICONOS SVG FINOS (ESTILO EDITORIAL)
// ==========================================
const Icons = {
  Check: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
  ChevronDown: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>,
  Search: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>,
  Lock: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
  Document: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  AI: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
  Spinner: () => (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  ),
  Alert: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
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
  
  // Calcular recomendaciones
  const recommendationResult = React.useMemo(() => {
    // Intentar obtener el area de multiples fuentes
    const area = articleArea || 
                 task?.area || 
                 task?.submission?.area || 
                 (task?.submission && typeof task.submission.area === 'string' ? task.submission.area : '') ||
                 '';
    
    // ===== DEBUG =====
    console.log('=== REVIEWER MANAGEMENT TAB - CALCULANDO RECOMENDACIONES ===');
    console.log('articleArea prop:', articleArea);
    console.log('task?.area:', task?.area);
    console.log('task?.submission?.area:', task?.submission?.area);
    console.log('area detectada:', area);
    console.log('potentialReviewers count:', potentialReviewers?.length);
    console.log('potentialReviewers[0]?.areasOfExpertise:', potentialReviewers?.[0]?.areasOfExpertise);
    console.log('invitations count:', invitations?.length);
    
    if (!area || !potentialReviewers?.length) {
      console.warn('No hay area o revisores para generar recomendaciones');
      return null;
    }
    
    const result = getRecommendedReviewers({
      articleArea: area,
      potentialReviewers: potentialReviewers,
      existingInvitations: invitations || [],
      maxRecommendations: 5,
      language: language
    });
    
    console.log('Resultado:', {
      totalEligible: result.totalEligible,
      matchDistribution: result.matchDistribution,
      recommendationsCount: result.recommendations?.length,
      firstRecommendation: result.recommendations?.[0] ? {
        name: result.recommendations[0].displayName,
        compositeScore: result.recommendations[0].compositeScore,
        scores: result.recommendations[0].scores,
        matchLevel: result.recommendations[0].matchLevel
      } : null
    });
    console.log('==============================================================');
    // ===== FIN DEBUG =====
    
    return result;
  }, [articleArea, task?.area, task?.submission?.area, potentialReviewers, invitations, language]);
    
  // Extraer datos para el renderizado
  const recommendations = recommendationResult?.recommendations || [];
  const fallbackActivated = recommendationResult?.fallbackActivated || false;


  const getStatusBadge = (status) => {
    const statusMap = {
      'pending': { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', label: isSpanish ? 'Pendiente' : 'Pending' },
      'accepted': { bg: 'bg-[#EBF4F7]', text: 'text-[#004B7F]', border: 'border-[#004B7F]/20', label: isSpanish ? 'Aceptada' : 'Accepted' },
      'declined': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: isSpanish ? 'Declinada' : 'Declined' },
      'expired': { bg: 'bg-slate-100', text: 'text-slate-500', border: 'border-slate-200', label: isSpanish ? 'Expirada' : 'Expired' },
      'submitted': { bg: 'bg-[#F2FAF5]', text: 'text-[#0D6A37]', border: 'border-[#0D6A37]/20', label: isSpanish ? 'Dictaminada' : 'Reviewed' }
    };
    const style = statusMap[status] || statusMap.pending;
    return (
      <span className={`${style.bg} ${style.text} ${style.border} border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-sm`}>
        {style.label}
      </span>
    );
  };

  const getRecommendationBadge = (recommendation) => {
    const recMap = {
      'accept': { text: 'text-[#0D6A37]', label: isSpanish ? 'Aceptar Manuscrito' : 'Accept Manuscript', icon: '✓' },
      'minor-revisions': { text: 'text-[#004B7F]', label: isSpanish ? 'Revisiones Menores' : 'Minor Revisions', icon: '±' },
      'major-revisions': { text: 'text-[#C75A00]', label: isSpanish ? 'Revisiones Mayores' : 'Major Revisions', icon: '⚠' },
      'reject': { text: 'text-red-700', label: isSpanish ? 'Rechazar Manuscrito' : 'Reject Manuscript', icon: '✕' }
    };
    const style = recMap[recommendation];
    if (!style) return null;
    return (
      <span className={`flex items-center gap-1.5 ${style.text} text-[11px] font-bold uppercase tracking-wider`}>
        <span className="font-mono text-base leading-none">{style.icon}</span> {style.label}
      </span>
    );
  };

  return (
    <div className="space-y-6 font-sans text-slate-800 selection:bg-blue-100">
      
      {/* ==================== PANEL DE ESTADO Y DECISIÓN (Elsevier Vibe) ==================== */}
      <div className="bg-[#002B49] text-white rounded-sm shadow-sm overflow-hidden flex flex-col md:flex-row">
        
        {/* Info Area */}
        <div className="p-8 md:w-2/3 flex flex-col justify-between border-b md:border-b-0 md:border-r border-white/10 relative">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A6C8E6] mb-2">
              {isSpanish ? 'Control de Evaluación' : 'Review Control'}
            </p>
            <h3 className="font-serif text-3xl font-normal leading-tight text-white mb-6">
              {isSpanish ? 'Panel de Dictámenes' : 'Review Panel'}
            </h3>
          </div>
          
          <div className="bg-[#001D33] p-4 rounded-sm border border-white/5 flex items-start gap-4">
            <div className={`mt-0.5 ${canProceed ? 'text-[#10B981]' : 'text-[#FF7900]'}`}>
              {canProceed ? <Icons.Check /> : <Icons.Alert />}
            </div>
            <p className="text-sm font-sans text-white/80 leading-relaxed">
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
        </div>

        {/* Action Area */}
        <div className="p-8 md:w-1/3 flex flex-col items-center justify-center bg-[#00223A]">
          <div className="text-center mb-6 w-full">
            <div className="flex items-baseline justify-center gap-1 mb-2 text-white">
              <span className="text-5xl font-serif">{submittedCount}</span>
              <span className="text-xl text-white/40">/ {requiredReviews}</span>
            </div>
            <p className="text-[11px] uppercase tracking-widest text-white/50 font-bold">
              {isSpanish ? 'Dictámenes Recibidos' : 'Reviews Received'}
            </p>
            
            {/* Minimalist Progress Line */}
            <div className="w-full bg-white/10 h-1 mt-4 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((submittedCount / requiredReviews) * 100, 100)}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={`h-full ${canProceed ? 'bg-[#10B981]' : 'bg-[#FF7900]'}`}
              />
            </div>
          </div>

          <button
            onClick={onProceedToDecision}
            disabled={!canProceed || loading}
            className={`w-full py-3.5 text-xs uppercase tracking-widest font-bold transition-all rounded-sm shadow-sm ${
              canProceed 
                ? 'bg-[#FF7900] text-white hover:bg-[#E06A00] shadow-[#FF7900]/20' 
                : 'bg-white/5 text-white/30 cursor-not-allowed border border-white/10'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2"><Icons.Spinner /> {isSpanish ? 'Procesando Dictámenes...' : 'Processing Reviews...'}</span>
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
      
      {/* ==================== DICTÁMENES RECIBIDOS ==================== */}
      {submittedReviews.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-sm shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 bg-[#F8FAFC] flex justify-between items-center">
            <h4 className="font-serif font-semibold text-[#002B49] text-lg">
              {isSpanish ? 'Registro de Dictámenes' : 'Review Records'}
            </h4>
            <span className="text-xs text-slate-500 font-mono">
              Total: {submittedReviews.length}
            </span>
          </div>
          
          <div className="divide-y divide-slate-100">
            {submittedReviews.map((rev) => (
              <div key={rev.id} className="bg-white hover:bg-[#F8FAFC]/50 transition-colors">
                
                {/* Cabecera del Dictamen */}
                <div 
                  onClick={() => setExpandedReview(expandedReview === rev.id ? null : rev.id)}
                  className="px-6 py-5 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-sm bg-[#F3F7F9] border border-slate-200 flex items-center justify-center text-[#002B49] font-serif text-lg">
                      {rev.reviewerName?.charAt(0) || rev.reviewerEmail?.charAt(0) || '?'}
                    </div>
                    <div>
                      <h5 className="font-serif font-semibold text-[#002B49] text-base group-hover:text-[#007398] transition-colors">
                        {rev.reviewerName || rev.reviewerEmail}
                      </h5>
                      <div className="mt-1">
                        {rev.recommendation ? getRecommendationBadge(rev.recommendation) : <span className="text-xs text-slate-400">{isSpanish ? 'Sin veredicto' : 'No verdict'}</span>}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 text-right ml-14 sm:ml-0">
                    <div className="hidden sm:block">
                      <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-0.5">
                        {isSpanish ? 'Fecha de Emisión' : 'Date of Issue'}
                      </p>
                      <span className="text-xs font-mono text-slate-600">
                        {rev.submittedAt?.toDate?.().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) || '—'}
                      </span>
                    </div>
                    {getStatusBadge('submitted')}
                    <motion.div 
                      animate={{ rotate: expandedReview === rev.id ? 180 : 0 }}
                      className="text-slate-400 group-hover:text-[#002B49]"
                    >
                      <Icons.ChevronDown />
                    </motion.div>
                  </div>
                </div>
                
                {/* Contenido Expandido */}
                <AnimatePresence>
                  {expandedReview === rev.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden border-t border-slate-100 bg-[#FCFCFD]"
                    >
                      <div className="p-6 lg:p-8">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                          
                          {/* Columna Izquierda: Comentarios Cualitativos */}
                          <div className="lg:col-span-7 space-y-6">
                            {rev.commentsToAuthor && (
                              <div className="bg-white border border-slate-200 rounded-sm overflow-hidden shadow-sm">
                                <div className="bg-[#F8FAFC] px-4 py-2.5 border-b border-slate-200">
                                  <h6 className="font-sans text-[11px] uppercase tracking-widest font-bold text-slate-600">
                                    {isSpanish ? 'Observaciones para el Autor' : 'Observations for Author'}
                                  </h6>
                                </div>
                                <div 
                                  className="p-5 prose prose-sm max-w-none font-serif text-slate-700 leading-relaxed"
                                  dangerouslySetInnerHTML={{ __html: decodeBase64IfNeeded(rev.commentsToAuthor) }}
                                />
                              </div>
                            )}

                            {rev.commentsToEditor && (
                              <div className="bg-[#FFFDF5] border border-[#E4852A]/30 rounded-sm overflow-hidden shadow-sm">
                                <div className="bg-[#FFF9E5] px-4 py-2.5 border-b border-[#E4852A]/20 flex items-center gap-2">
                                  <span className="text-[#C75A00]"><Icons.Lock /></span>
                                  <h6 className="font-sans text-[11px] uppercase tracking-widest font-bold text-[#C75A00]">
                                    {isSpanish ? 'Notas Confidenciales al Editor' : 'Confidential Editor Notes'}
                                  </h6>
                                </div>
                                <div 
                                  className="p-5 prose prose-sm max-w-none font-serif text-amber-900 leading-relaxed italic"
                                  dangerouslySetInnerHTML={{ __html: decodeBase64IfNeeded(rev.commentsToEditor) }}
                                />
                              </div>
                            )}
                          </div>
                          
                          {/* Columna Derecha: Rúbrica y Documentos */}
                          <div className="lg:col-span-5 space-y-6">
                            {rev.scores && Object.keys(rev.scores).length > 0 && (
                              <div className="bg-white border border-slate-200 rounded-sm shadow-sm p-5">
                                <h6 className="font-sans text-[11px] uppercase tracking-widest font-bold text-slate-600 mb-4 pb-2 border-b border-slate-100">
                                  {isSpanish ? 'Rúbrica Cuantitativa' : 'Quantitative Rubric'}
                                </h6>
                                <div className="space-y-3">
                                  {Object.entries(rev.scores).map(([key, value]) => (
                                    <div key={key} className="flex flex-col gap-1">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-sans font-medium text-slate-700">{key}</span>
                                        <span className="text-xs font-bold text-[#002B49]">{value}/5</span>
                                      </div>
                                      <div className="flex gap-1">
                                        {[...Array(5)].map((_, i) => (
                                          <div key={i} className={`h-1.5 flex-1 ${i < value ? 'bg-[#003B5C]' : 'bg-slate-100'}`} />
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {rev.reviewerFileId && (
                              <a
                                href={`https://docs.google.com/document/d/${rev.reviewerFileId}/edit`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-[#003B5C] text-[#003B5C] text-[11px] uppercase tracking-widest font-bold hover:bg-[#003B5C] hover:text-white transition-colors rounded-sm shadow-sm"
                              >
                                <Icons.Document />
                                {isSpanish ? 'Acceder al Documento Marcado' : 'Access Marked Document'}
                              </a>
                            )}
                          </div>

                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </section>
      )}
      
      {/* ==================== CONVOCATORIAS ACTIVAS (Pendientes) ==================== */}
      {invitations.filter(inv => inv.status !== 'submitted').length > 0 && (
        <section className="bg-white border border-slate-200 rounded-sm shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 bg-[#F8FAFC]">
            <h4 className="font-serif font-semibold text-[#002B49] text-base">
              {isSpanish ? 'Convocatorias Activas' : 'Active Invitations'}
            </h4>
          </div>
          <div className="divide-y divide-slate-100">
            {invitations.filter(inv => inv.status !== 'submitted').map(rev => (
              <div key={rev.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-serif text-sm">
                    {rev.reviewerName?.charAt(0) || rev.reviewerEmail?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="font-serif font-medium text-[#002B49] text-sm">
                      {rev.reviewerName || rev.reviewerEmail}
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono">{rev.reviewerEmail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 ml-12 sm:ml-0">
                  <div className="text-right hidden md:block">
                    {rev.invitedAt && (
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                        {isSpanish ? 'Invitado:' : 'Invited:'} <span className="font-mono text-slate-600 ml-1">{rev.invitedAt.toDate?.().toLocaleDateString()}</span>
                      </p>
                    )}
                    {rev.respondedAt && (
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">
                        {isSpanish ? 'Respuesta:' : 'Response:'} <span className="font-mono text-slate-600 ml-1">{rev.respondedAt.toDate?.().toLocaleDateString()}</span>
                      </p>
                    )}
                  </div>
                  {getStatusBadge(rev.status)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ==================== ASIGNACIÓN DE REVISORES ==================== */}
      <section className="bg-white border border-slate-200 rounded-sm shadow-sm">
        
        {/* Cabecera Sección Asignación */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-[#003B5C] to-[#00223A] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h4 className="font-serif font-semibold text-lg">
            {isSpanish ? 'Designar Par Evaluador' : 'Designate Peer Reviewer'}
          </h4>
          {recommendations.length > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] bg-white/10 px-2.5 py-1 rounded-sm border border-white/20 uppercase tracking-widest font-bold text-[#A6C8E6]">
              <Icons.AI />
              {isSpanish ? 'Sistema Inteligente' : 'Smart System'}
            </div>
          )}
        </div>
        
        <div className="p-0 sm:p-6 grid grid-cols-1 gap-6">
          
          {/* ==================== MOTOR DE RECOMENDACIÓN INTELIGENTE (AI) ==================== */}
{recommendations.length > 0 && (
  <div className="border border-slate-200 rounded-sm bg-white shadow-sm mb-8 overflow-hidden">
    
    {/* Cabecera del Motor - Contexto Claro para el Editor */}
    <div className="bg-gradient-to-r from-[#002B49] to-[#004B7F] px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <Icons.AI />
          <h4 className="font-serif font-bold text-white text-lg tracking-wide">
            {isSpanish ? 'Motor de Recomendación de Pares' : 'Peer Recommendation Engine'}
          </h4>
        </div>
        <p className="text-white/70 text-xs font-sans max-w-xl leading-relaxed">
          {isSpanish 
            ? 'Candidatos óptimos seleccionados algorítmicamente en base a afinidad temática, carga editorial actual y rendimiento histórico.'
            : 'Optimal candidates algorithmically selected based on thematic affinity, current editorial workload, and historical performance.'}
        </p>
      </div>
      
      {/* Resumen de Resultados de Búsqueda (Contexto de los datos) */}
      {recommendationResult?.matchDistribution && (
        <div className="flex gap-4 bg-[#001D33]/40 p-3 rounded-sm border border-white/10 shadow-inner">
          {recommendationResult.matchDistribution.exact > 0 && (
            <div className="text-center border-r border-white/10 pr-4 last:border-0 last:pr-0">
              <span className="block text-white font-serif font-bold text-lg leading-none">{recommendationResult.matchDistribution.exact}</span>
              <span className="block text-[9px] uppercase tracking-widest text-[#10B981] mt-1">{isSpanish ? 'Coincidencia Exacta' : 'Exact Match'}</span>
            </div>
          )}
          {recommendationResult.matchDistribution.category > 0 && (
            <div className="text-center border-r border-white/10 pr-4 last:border-0 last:pr-0">
              <span className="block text-white font-serif font-bold text-lg leading-none">{recommendationResult.matchDistribution.category}</span>
              <span className="block text-[9px] uppercase tracking-widest text-[#60A5FA] mt-1">{isSpanish ? 'Categoría Macro' : 'Macro Category'}</span>
            </div>
          )}
          {recommendationResult.matchDistribution.related > 0 && (
            <div className="text-center border-r border-white/10 pr-4 last:border-0 last:pr-0">
              <span className="block text-white font-serif font-bold text-lg leading-none">{recommendationResult.matchDistribution.related}</span>
              <span className="block text-[9px] uppercase tracking-widest text-[#FBBF24] mt-1">{isSpanish ? 'Afinidad' : 'Related'}</span>
            </div>
          )}
          {recommendationResult.matchDistribution.fallback > 0 && (
            <div className="text-center last:border-0 last:pr-0">
              <span className="block text-white font-serif font-bold text-lg leading-none">{recommendationResult.matchDistribution.fallback}</span>
              <span className="block text-[9px] uppercase tracking-widest text-slate-400 mt-1">{isSpanish ? 'General' : 'Fallback'}</span>
            </div>
          )}
        </div>
      )}
    </div>

    {/* Notificación de Fallback (Si no hubo matches exactos, el editor debe saber por qué ve a estas personas) */}
    {fallbackActivated && (
      <div className="bg-[#FFFDF5] border-b border-[#E4852A]/20 px-6 py-3 flex items-start gap-3">
        <svg className="w-4 h-4 text-[#C75A00] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-[11px] text-[#994500] font-medium leading-relaxed uppercase tracking-wider">
          {isSpanish
            ? 'No se hallaron coincidencias exactas con disponibilidad inmediata. El sistema ha expandido la búsqueda a perfiles destacados de la categoría disciplinaria superior.'
            : 'No exact matches with immediate availability found. The system has expanded the search to top profiles in the broader disciplinary category.'}
        </p>
      </div>
    )}

    {/* Lista de Recomendaciones (UI estilo Formulario de Selección) */}
    <div className="divide-y divide-slate-100">
      {recommendations.map((reviewer) => {
        const isSelected = selectedReviewerId === reviewer.id;
        const scorePercent = Math.round(reviewer.compositeScore * 100);
        // Semántica de colores para el score
        const scoreColor = scorePercent >= 80 ? 'bg-[#10B981]' : scorePercent >= 65 ? 'bg-[#007398]' : 'bg-[#FF7900]';
        const scoreText = scorePercent >= 80 ? 'text-[#10B981]' : scorePercent >= 65 ? 'text-[#007398]' : 'text-[#FF7900]';

        return (
          <div
            key={reviewer.id}
            onClick={() => setSelectedReviewerId(reviewer.id)}
            className={`px-6 py-5 cursor-pointer transition-all flex flex-col md:flex-row gap-6 relative group ${
              isSelected ? 'bg-[#F4F7F9]' : 'hover:bg-slate-50/70'
            }`}
          >
            {/* Indicador visual agresivo para la selección (Barra lateral naranja) */}
            {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#FF7900]" />}

            {/* COLUMNA 1: Identidad y Selección (Radio button estilo UX clásico) */}
            <div className="flex md:w-4/12 gap-4 items-start">
              <div className="pt-1 flex-shrink-0">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shadow-sm ${
                  isSelected ? 'border-[#FF7900] bg-[#FF7900]' : 'border-slate-300 bg-white group-hover:border-[#003B5C]/50'
                }`}>
                  {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>
              </div>
              
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${
                    reviewer.rank === 1 ? 'bg-[#FF7900] text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    #{reviewer.rank}
                  </span>
                  <h4 className={`font-serif text-base truncate transition-colors ${isSelected ? 'font-bold text-[#002B49]' : 'font-semibold text-slate-800'}`}>
                    {reviewer.displayName}
                  </h4>
                </div>
                <p className="text-xs text-slate-500 font-mono truncate mb-1">
                  {reviewer.email}
                </p>
                {reviewer.institution && (
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest truncate flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    {reviewer.institution}
                  </p>
                )}
                <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 uppercase tracking-wider rounded-sm">
                  {reviewer.tierLabel}
                </span>
              </div>
            </div>

            {/* COLUMNA 2: Afinidad y Métricas de Rendimiento */}
            <div className="md:w-3/12 flex flex-col justify-center border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6">
              <div className="mb-4">
                <div className="flex justify-between items-end mb-1">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">
                    {isSpanish ? 'Índice de Afinidad' : 'Affinity Index'}
                  </span>
                  <span className={`text-sm font-bold leading-none ${scoreText}`}>{scorePercent}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className={`h-full ${scoreColor}`} style={{ width: `${scorePercent}%` }} />
                </div>
              </div>
              
              {/* Score Breakdown */}
              {reviewer.scores && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {Object.entries(reviewer.scores).map(([key, value]) => (
                    <span key={key} className="text-[9px] bg-slate-50 px-1.5 py-0.5 text-slate-500 uppercase tracking-wider rounded-sm border border-slate-200">
                      {key}: {Math.round(value * 100)}%
                    </span>
                  ))}
                  {reviewer.isParetoOptimal && (
                    <span className="text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.5 border border-amber-200 uppercase tracking-wider rounded-sm">
                      Pareto
                    </span>
                  )}
                </div>
              )}
              
              <div className="flex items-center justify-between text-[10px]">
                <div className="bg-white border border-slate-200 px-2 py-1 rounded-sm shadow-sm flex flex-col items-center">
                  <span className="text-slate-400 uppercase tracking-wider mb-0.5">{isSpanish ? 'Carga' : 'Load'}</span>
                  <span className="font-mono font-bold text-[#002B49]">{reviewer.availability?.currentActiveReviews || 0}/{reviewer.availability?.maxActiveReviews || 3}</span>
                </div>
                <div className="bg-white border border-slate-200 px-2 py-1 rounded-sm shadow-sm flex flex-col items-center">
                  <span className="text-slate-400 uppercase tracking-wider mb-0.5">{isSpanish ? 'Puntualidad' : 'On-Time'}</span>
                  <span className="font-mono font-bold text-[#002B49]">{reviewer.stats?.onTimeRate || 100}%</span>
                </div>
                <div className="bg-white border border-slate-200 px-2 py-1 rounded-sm shadow-sm flex flex-col items-center">
                  <span className="text-slate-400 uppercase tracking-wider mb-0.5">{isSpanish ? 'Completadas' : 'Done'}</span>
                  <span className="font-mono font-bold text-[#002B49]">{reviewer.stats?.totalReviewsCompleted || 0}</span>
                </div>
              </div>
            </div>

            {/* COLUMNA 3: Justificación Cualitativa de la IA (Insights) */}
            <div className="md:w-5/12 flex flex-col justify-center border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6">
              <span className="text-[9px] uppercase tracking-widest font-bold text-[#002B49] mb-2.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-[#FF7900] rounded-full"></span>
                {isSpanish ? 'Justificación del Sistema' : 'System Rationale'}
              </span>
              
              <ul className="space-y-2">
                {reviewer.recommendationReasons.map((reason, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-slate-600 leading-tight font-serif">
                    <svg className="w-3 h-3 text-[#10B981] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                    {reason}
                  </li>
                ))}
                
                {/* Etiqueta de Exploración si el revisor es nuevo (evita quemar siempre a los mismos) */}
                {(reviewer.stats?.totalReviewsCompleted || 0) < 3 && (
                  <li className="flex items-start gap-2 text-[11px] text-[#007398] leading-tight font-sans font-medium uppercase tracking-wider mt-2">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {isSpanish ? 'Perfil en desarrollo (Aporta diversidad al panel)' : 'Developing profile (Adds diversity to panel)'}
                  </li>
                )}
              </ul>
            </div>

          </div>
        );
      })}
    </div>
  </div>
)}

          {/* Buscador Manual */}
          <div className="border border-slate-200 rounded-sm bg-white overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-[#F8FAFC]">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Icons.Search />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={isSpanish ? 'Búsqueda en padrón por nombre, correo o afiliación...' : 'Search registry by name, email or affiliation...'}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-sm focus:outline-none focus:border-[#003B5C] focus:ring-1 focus:ring-[#003B5C] transition-all font-serif text-sm placeholder-slate-400"
                />
              </div>
            </div>

            <div className="max-h-[250px] overflow-y-auto custom-scrollbar bg-white">
              {potentialReviewers.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="font-serif text-slate-500 text-lg">
                    {searchTerm
                      ? (isSpanish ? 'No existen coincidencias en el padrón.' : 'No matches found in registry.')
                      : (isSpanish ? 'El padrón de revisores se encuentra vacío.' : 'The reviewer registry is empty.')}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {potentialReviewers.map((reviewer) => {
                    const isSelected = selectedReviewerId === reviewer.id;
                    return (
                      <div
                        key={reviewer.id}
                        onClick={() => setSelectedReviewerId(reviewer.id)}
                        className={`p-3 sm:px-5 flex items-center gap-3 cursor-pointer transition-colors hover:bg-slate-50 ${
                          isSelected ? 'bg-blue-50/50 border-l-4 border-[#003b5c]' : 'bg-white border-l-4 border-transparent'
                        }`}
                      >
                        <div className={`w-4 h-4 border flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'border-[#003b5c] bg-[#003b5c]' : 'border-slate-300 bg-white'
                        }`}>
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
                          <span className={`font-serif text-sm truncate font-bold ${isSelected ? 'text-[#002B49]' : 'text-[#003b5c]'}`}>
                            {reviewer.displayName}
                          </span>
                          <div className="flex items-center gap-3 mt-1 sm:mt-0">
                            <span className="text-[11px] text-slate-500 font-mono truncate">{reviewer.email}</span>
                            {reviewer.institution && (
                              <span className="text-[10px] text-slate-400 uppercase tracking-widest truncate border-l border-slate-300 pl-3">
                                {reviewer.institution}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          
          {/* Botón Flotante / Inferior de Envío */}
          <div className="pt-2">
            <button
              onClick={onSendInvitation}
              disabled={loading || !selectedReviewerId}
              className={`w-full py-4 text-[11px] uppercase tracking-[0.2em] font-bold transition-all border ${
                !loading && selectedReviewerId 
                  ? 'bg-white border-[#003b5c] text-[#003b5c] hover:bg-[#003b5c] hover:text-white' 
                  : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-3">
                  <Icons.Spinner />
                  {isSpanish ? 'EMITIENDO CONVOCATORIA...' : 'ISSUING INVITATION...'}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-3">
                  {isSpanish ? 'EMITIR CONVOCATORIA OFICIAL' : 'ISSUE OFFICIAL INVITATION'}
                </span>
              )}
            </button>
            {!selectedReviewerId && (
              <p className="text-center text-[10px] text-slate-400 mt-2 font-sans uppercase tracking-widest">
                {isSpanish ? 'Seleccione un perfil del listado superior para habilitar el envío.' : 'Select a profile from the list above to enable sending.'}
              </p>
            )}
          </div>

        </div>
      </section>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #F8FAFC;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #CBD5E1;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94A3B8;
        }
      `}</style>
    </div>
  );
};