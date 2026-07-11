// src/components/ReviewerManagementTab.js

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../hooks/useLanguage';

export const ReviewerManagementTab = ({
  task,
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
  
  const getStatusBadge = (status) => {
    const statusMap = {
      'pending': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: isSpanish ? 'Pendiente' : 'Pending' },
      'accepted': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: isSpanish ? 'Aceptada' : 'Accepted' },
      'declined': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', label: isSpanish ? 'Rechazada' : 'Declined' },
      'expired': { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', label: isSpanish ? 'Expirada' : 'Expired' },
      'submitted': { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', label: isSpanish ? 'Completada' : 'Completed' }
    };
    const style = statusMap[status] || statusMap.pending;
    return (
      <span className={`${style.bg} ${style.text} ${style.border} px-3 py-1 rounded-full text-xs font-medium border`}>
        {style.label}
      </span>
    );
  };

  const getRecommendationBadge = (recommendation) => {
    const recMap = {
      'accept': { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: '✓', label: isSpanish ? 'Aceptar' : 'Accept' },
      'minor-revisions': { bg: 'bg-sky-50', text: 'text-sky-700', icon: '↻', label: isSpanish ? 'Rev. Menores' : 'Minor Rev.' },
      'major-revisions': { bg: 'bg-amber-50', text: 'text-amber-700', icon: '⚠', label: isSpanish ? 'Rev. Mayores' : 'Major Rev.' },
      'reject': { bg: 'bg-rose-50', text: 'text-rose-700', icon: '✗', label: isSpanish ? 'Rechazar' : 'Reject' }
    };
    const style = recMap[recommendation];
    if (!style) return null;
    return (
      <span className={`${style.bg} ${style.text} px-2 py-0.5 rounded-md text-xs font-medium inline-flex items-center gap-1`}>
        <span>{style.icon}</span> {style.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* HEADER CARD - ESTILO ELSEVIER */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0A1929] via-[#13293D] to-[#1B3A4B] rounded-2xl p-6 text-white shadow-lg">
        {/* Patrón de fondo sutil */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#C0A86A] rounded-full transform translate-x-1/3 -translate-y-1/3" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#C0A86A] rounded-full transform -translate-x-1/4 translate-y-1/4" />
        </div>
        
        <div className="relative">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-['Playfair_Display'] text-2xl font-bold mb-1">
                {isSpanish ? 'Panel de Revisiones' : 'Review Panel'}
              </h3>
              <p className="text-white/60 text-sm font-['Lora']">
                {isSpanish ? 'Gestiona y visualiza las revisiones del manuscrito' : 'Manage and view manuscript reviews'}
              </p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold font-['Playfair_Display'] text-[#C0A86A]">
                {submittedCount}<span className="text-2xl text-white/50">/{requiredReviews}</span>
              </div>
              <p className="text-xs text-white/50 font-['Lora']">
                {isSpanish ? 'Revisiones requeridas' : 'Required reviews'}
              </p>
            </div>
          </div>
          
          {/* Barra de progreso mejorada */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-white/60 mb-2 font-['Lora']">
              <span>{isSpanish ? 'Progreso' : 'Progress'}</span>
              <span>{Math.round((submittedCount / requiredReviews) * 100)}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2.5 backdrop-blur-sm">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((submittedCount / requiredReviews) * 100, 100)}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="bg-gradient-to-r from-[#C0A86A] to-[#D4B96F] h-2.5 rounded-full shadow-lg shadow-[#C0A86A]/25"
              />
            </div>
          </div>
          
          {/* Mensaje de estado */}
          <div className={`p-4 rounded-xl ${canProceed ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-amber-500/10 border border-amber-500/30'}`}>
            <div className="flex items-start gap-3">
              {canProceed ? (
                <svg className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <p className={`text-sm font-['Lora'] ${canProceed ? 'text-emerald-300' : 'text-amber-300'}`}>
                {submittedCount < requiredReviews
                  ? (isSpanish 
                      ? `Esperando ${requiredReviews - submittedCount} revisión(es) más para proceder a la decisión final` 
                      : `Awaiting ${requiredReviews - submittedCount} more review(s) to proceed to final decision`)
                  : (isSpanish 
                      ? '¡Mínimo de revisiones alcanzado! Puedes proceder a la decisión final' 
                      : 'Minimum reviews reached! You can proceed to final decision')
                }
              </p>
            </div>
          </div>
          
          {/* Botón de proceder */}
          <motion.button
            onClick={onProceedToDecision}
            disabled={!canProceed || loading}
            whileHover={canProceed ? { scale: 1.02 } : {}}
            whileTap={canProceed ? { scale: 0.98 } : {}}
            className={`mt-4 w-full py-3.5 rounded-xl font-['Playfair_Display'] font-bold text-sm tracking-wider transition-all ${
              canProceed 
                ? 'bg-[#C0A86A] hover:bg-[#D4B96F] text-[#0A1929] shadow-lg shadow-[#C0A86A]/25' 
                : 'bg-white/10 text-white/40 cursor-not-allowed'
            } disabled:opacity-50`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {isSpanish ? 'PROCESANDO...' : 'PROCESSING...'}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                {isSpanish ? 'PROCEDER A DECISIÓN FINAL' : 'PROCEED TO FINAL DECISION'}
              </span>
            )}
          </motion.button>
        </div>
      </div>
      
      {/* REVISIONES COMPLETADAS - DISEÑO EXPANDIBLE ESTILO ELSEVIER */}
      {submittedReviews.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
        >
          <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
            <div className="flex items-center justify-between">
              <h4 className="font-['Playfair_Display'] font-semibold text-[#0A1929] text-lg">
                {isSpanish ? 'Revisiones Completadas' : 'Completed Reviews'}
              </h4>
              <span className="text-xs font-['Lora'] text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {submittedReviews.length} {isSpanish ? 'revisiones' : 'reviews'}
              </span>
            </div>
          </div>
          
          <div className="divide-y divide-slate-100">
            {submittedReviews.map((rev, index) => (
              <div key={rev.id} className="hover:bg-slate-50/50 transition-colors">
                {/* Header de la revisión - Siempre visible */}
                <div 
                  onClick={() => setExpandedReview(expandedReview === rev.id ? null : rev.id)}
                  className="px-6 py-4 cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-100 to-sky-200 flex items-center justify-center flex-shrink-0">
                      <span className="font-['Playfair_Display'] font-bold text-sky-700">
                        {rev.reviewerName?.charAt(0) || rev.reviewerEmail?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-['Lora'] font-semibold text-[#0A1929] truncate">
                        {rev.reviewerName || rev.reviewerEmail}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-slate-500 font-['Lora'] truncate">{rev.reviewerEmail}</p>
                        {rev.recommendation && (
                          <span className="hidden sm:inline-flex">
                            {getRecommendationBadge(rev.recommendation)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="hidden sm:flex flex-col items-end">
                      <span className="text-xs text-slate-400 font-['Lora']">
                        {rev.submittedAt?.toDate?.().toLocaleDateString('es-ES', { 
                          day: 'numeric', 
                          month: 'short',
                          year: 'numeric'
                        }) || '—'}
                      </span>
                    </div>
                    {getStatusBadge('submitted')}
                    <motion.svg 
                      animate={{ rotate: expandedReview === rev.id ? 180 : 0 }}
                      className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors"
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </motion.svg>
                  </div>
                </div>
                
                {/* Contenido expandible */}
                <AnimatePresence>
                  {expandedReview === rev.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-6 pt-2 bg-slate-50/30">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* Comentarios al Autor */}
                          {rev.commentsToAuthor && (
                            <motion.div
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.1 }}
                              className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm"
                            >
                              <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center">
                                  <svg className="w-4 h-4 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                </div>
                                <h5 className="font-['Playfair_Display'] font-semibold text-[#0A1929] text-sm">
                                  {isSpanish ? 'Comentarios al Autor' : 'Comments to Author'}
                                </h5>
                              </div>
                              <div 
                                className="prose prose-sm max-w-none text-slate-600 font-['Lora'] text-sm leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: rev.commentsToAuthor }}
                              />
                            </motion.div>
                          )}
                          
                          {/* Comentarios al Editor */}
                          {rev.commentsToEditor && (
                            <motion.div
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.2 }}
                              className="bg-amber-50/50 rounded-xl p-4 border border-amber-200"
                            >
                              <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                                  <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                  </svg>
                                </div>
                                <h5 className="font-['Playfair_Display'] font-semibold text-amber-800 text-sm">
                                  {isSpanish ? 'Comentarios Confidenciales al Editor' : 'Confidential Comments to Editor'}
                                </h5>
                              </div>
                              <div 
                                className="prose prose-sm max-w-none text-amber-900/80 font-['Lora'] text-sm leading-relaxed italic"
                                dangerouslySetInnerHTML={{ __html: rev.commentsToEditor }}
                              />
                            </motion.div>
                          )}
                          
                          {/* Puntuaciones si existen */}
                          {rev.scores && Object.keys(rev.scores).length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.15 }}
                              className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm"
                            >
                              <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                  </svg>
                                </div>
                                <h5 className="font-['Playfair_Display'] font-semibold text-[#0A1929] text-sm">
                                  {isSpanish ? 'Puntuaciones' : 'Scores'}
                                </h5>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {Object.entries(rev.scores).map(([key, value]) => (
                                  <div key={key} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                                    <span className="text-xs text-slate-600 font-['Lora']">{key}</span>
                                    <div className="flex items-center gap-1">
                                      {[...Array(5)].map((_, i) => (
                                        <div 
                                          key={i}
                                          className={`w-2 h-2 rounded-full ${
                                            i < value ? 'bg-[#C0A86A]' : 'bg-slate-200'
                                          }`}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </div>
                        
                        {/* Documento de revisión si existe */}
                        {rev.reviewerFileId && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="mt-4 flex items-center justify-between bg-slate-800 rounded-xl p-4"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-[#C0A86A]/20 flex items-center justify-center">
                                <svg className="w-5 h-5 text-[#C0A86A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <div>
                                <p className="text-white font-['Lora'] text-sm font-medium">
                                  {isSpanish ? 'Documento de Revisión' : 'Review Document'}
                                </p>
                                <p className="text-slate-400 text-xs font-['Lora']">
                                  {isSpanish ? 'Documento con anotaciones y comentarios del revisor' : 'Document with reviewer annotations and comments'}
                                </p>
                              </div>
                            </div>
                            <a
                              href={`https://docs.google.com/document/d/${rev.reviewerFileId}/edit`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-4 py-2 bg-[#C0A86A] hover:bg-[#D4B96F] text-[#0A1929] rounded-lg font-['Lora'] text-sm font-medium transition-all"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              {isSpanish ? 'Abrir Documento' : 'Open Document'}
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </motion.div>
      )}
      
      {/* REVISORES INVITADOS PENDIENTES */}
      {invitations.filter(inv => inv.status !== 'submitted').length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
            <h4 className="font-['Playfair_Display'] font-semibold text-[#0A1929] text-lg">
              {isSpanish ? 'Revisores Invitados' : 'Invited Reviewers'}
            </h4>
          </div>
          <div className="divide-y divide-slate-100">
            {invitations.filter(inv => inv.status !== 'submitted').map(rev => (
              <div key={rev.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0">
                    <span className="font-['Playfair_Display'] font-bold text-slate-600">
                      {rev.reviewerName?.charAt(0) || rev.reviewerEmail?.charAt(0) || '?'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-['Lora'] font-medium text-[#0A1929] truncate">
                      {rev.reviewerName || rev.reviewerEmail}
                    </p>
                    <p className="text-xs text-slate-500 font-['Lora'] truncate">{rev.reviewerEmail}</p>
                    {rev.respondedAt && (
                      <p className="text-xs text-slate-400 mt-1 font-['Lora']">
                        {isSpanish ? 'Respondió:' : 'Responded:'} {rev.respondedAt.toDate?.().toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {rev.invitedAt && (
                    <span className="text-xs text-slate-400 font-['Lora'] hidden sm:block">
                      {rev.invitedAt.toDate?.().toLocaleDateString()}
                    </span>
                  )}
                  {getStatusBadge(rev.status)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* BUSCADOR DE NUEVOS REVISORES */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
          <h4 className="font-['Playfair_Display'] font-semibold text-[#0A1929] text-lg">
            {isSpanish ? 'Invitar Nuevo Revisor' : 'Invite New Reviewer'}
          </h4>
        </div>
        
        <div className="p-6">
          <div className="relative mb-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isSpanish ? 'Buscar por nombre, email o institución...' : 'Search by name, email or institution...'}
              className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#C0A86A]/30 focus:border-[#C0A86A] focus:bg-white transition-all font-['Lora'] text-sm"
            />
            <svg className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          <div className="max-h-80 overflow-y-auto space-y-2 mb-4">
            {potentialReviewers.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-slate-500 font-['Lora'] italic">
                  {searchTerm
                    ? (isSpanish ? 'No se encontraron revisores' : 'No reviewers found')
                    : (isSpanish ? 'No hay revisores disponibles' : 'No available reviewers')}
                </p>
              </div>
            ) : (
              potentialReviewers.map((reviewer) => (
                <motion.div
                  key={reviewer.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelectedReviewerId(reviewer.id)}
                  className={`p-4 rounded-xl cursor-pointer transition-all duration-200 ${
                    selectedReviewerId === reviewer.id
                      ? 'bg-[#FBF9F3] border-2 border-[#C0A86A] shadow-md'
                      : 'bg-slate-50 hover:bg-slate-100 border-2 border-transparent hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0A1929] to-[#1E2F40] flex items-center justify-center flex-shrink-0 shadow-md">
                      <span className="text-lg font-['Playfair_Display'] font-bold text-white">
                        {reviewer.displayName?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-['Playfair_Display'] font-bold text-[#0A1929] truncate">
                        {reviewer.displayName}
                      </div>
                      <div className="text-sm text-slate-500 font-['Lora'] truncate">
                        {reviewer.email}
                      </div>
                      {reviewer.institution && (
                        <div className="text-xs text-slate-400 mt-1 font-['Lora'] truncate">
                          🏛 {reviewer.institution}
                        </div>
                      )}
                    </div>
                    {selectedReviewerId === reviewer.id && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-6 h-6 rounded-full bg-[#C0A86A] flex items-center justify-center flex-shrink-0"
                      >
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>
          
          <motion.button
            onClick={onSendInvitation}
            disabled={loading || !selectedReviewerId}
            whileHover={!loading && selectedReviewerId ? { scale: 1.02 } : {}}
            whileTap={!loading && selectedReviewerId ? { scale: 0.98 } : {}}
            className="w-full py-3.5 bg-gradient-to-r from-[#0A1929] to-[#1E2F40] hover:from-[#1E2F40] hover:to-[#0A1929] text-white font-['Playfair_Display'] font-bold rounded-xl transition-all disabled:from-slate-300 disabled:to-slate-400 disabled:text-slate-500 shadow-lg shadow-[#0A1929]/10"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {isSpanish ? 'ENVIANDO INVITACIÓN...' : 'SENDING INVITATION...'}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                {isSpanish ? 'ENVIAR INVITACIÓN' : 'SEND INVITATION'}
              </span>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
};