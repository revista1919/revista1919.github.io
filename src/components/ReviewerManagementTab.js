// src/components/ReviewerManagementTab.js

import React from 'react';
import { motion } from 'framer-motion';
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
  onProceedToDecision,  // NUEVO: callback para proceder a decisión
  loading,
  submittedReviews = []  // NUEVO: revisiones ya completadas
}) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  
  const submittedCount = submittedReviews.length;
  const requiredReviews = task?.requiredReviews || 2;
  const canProceed = submittedCount >= requiredReviews;
  
  const getStatusBadge = (status) => {
    const statusMap = {
      'pending': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: isSpanish ? 'Pendiente' : 'Pending' },
      'accepted': { bg: 'bg-green-100', text: 'text-green-800', label: isSpanish ? 'Aceptada' : 'Accepted' },
      'declined': { bg: 'bg-red-100', text: 'text-red-800', label: isSpanish ? 'Rechazada' : 'Declined' },
      'expired': { bg: 'bg-gray-100', text: 'text-gray-800', label: isSpanish ? 'Expirada' : 'Expired' },
      'submitted': { bg: 'bg-blue-100', text: 'text-blue-800', label: isSpanish ? 'Completada' : 'Completed' }
    };
    const style = statusMap[status] || statusMap.pending;
    return (
      <span className={`${style.bg} ${style.text} px-2 py-1 rounded-full text-xs font-['Lora']`}>
        {style.label}
      </span>
    );
  };
  
  return (
    <div className="space-y-6">
      {/* INDICADOR DE PROGRESO */}
      <div className="bg-gradient-to-r from-[#0A1929] to-[#1E2F40] rounded-xl p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-['Playfair_Display'] text-xl font-bold">
            {isSpanish ? 'Panel de Revisiones' : 'Review Panel'}
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold">{submittedCount}</span>
            <span className="text-white/70">/ {requiredReviews}</span>
          </div>
        </div>
        
        {/* Barra de progreso */}
        <div className="w-full bg-white/20 rounded-full h-3 mb-4">
          <div 
            className="bg-[#C0A86A] h-3 rounded-full transition-all duration-500"
            style={{ width: `${Math.min((submittedCount / requiredReviews) * 100, 100)}%` }}
          />
        </div>
        
        <p className="text-white/80 text-sm font-['Lora']">
          {submittedCount < requiredReviews
            ? (isSpanish 
                ? `Esperando ${requiredReviews - submittedCount} revisión(es) más para poder proceder` 
                : `Waiting for ${requiredReviews - submittedCount} more review(s) to proceed`)
            : (isSpanish 
                ? '¡Mínimo de revisiones alcanzado! Puedes proceder a la decisión final' 
                : 'Minimum reviews reached! You can proceed to final decision')
          }
        </p>
        
        {/* BOTÓN PARA PROCEDER A DECISIÓN */}
        <button
          onClick={onProceedToDecision}
          disabled={!canProceed || loading}
          className={`mt-4 w-full py-3 rounded-xl font-['Playfair_Display'] font-bold transition-all ${
            canProceed 
              ? 'bg-[#C0A86A] hover:bg-[#A58D4F] text-[#0A1929]' 
              : 'bg-white/20 text-white/50 cursor-not-allowed'
          } disabled:opacity-50`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {isSpanish ? 'PROCESANDO...' : 'PROCESSING...'}
            </span>
          ) : (
            isSpanish ? 'PROCEDER A DECISIÓN FINAL' : 'PROCEED TO FINAL DECISION'
          )}
        </button>
      </div>
      
      {/* REVISIONES COMPLETADAS (con links) */}
      {submittedReviews.length > 0 && (
        <div>
          <h4 className="font-['Playfair_Display'] font-semibold text-[#0A1929] mb-3">
            {isSpanish ? 'Revisiones completadas' : 'Completed reviews'}
          </h4>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {submittedReviews.map(rev => (
              <div key={rev.id} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-['Lora'] font-medium text-[#0A1929]">
                      {rev.reviewerName || rev.reviewerEmail}
                    </p>
                    <p className="text-xs text-[#5A6B7A]">{rev.reviewerEmail}</p>
                    <p className="text-xs text-[#5A6B7A] mt-1">
                      {isSpanish ? 'Completada:' : 'Completed:'} {rev.submittedAt?.toDate?.().toLocaleDateString() || '—'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {getStatusBadge('submitted')}
                    {rev.reviewerFileId && (
                      <a
                        href={`https://docs.google.com/document/d/${rev.reviewerFileId}/edit`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#C0A86A] hover:text-[#A58D4F] underline font-['Lora']"
                      >
                        {isSpanish ? 'Ver documento' : 'View document'} ↗
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* REVISORES INVITADOS PENDIENTES */}
      {invitations.filter(inv => inv.status !== 'submitted').length > 0 && (
        <div>
          <h4 className="font-['Playfair_Display'] font-semibold text-[#0A1929] mb-3">
            {isSpanish ? 'Revisores invitados' : 'Invited reviewers'}
          </h4>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {invitations.filter(inv => inv.status !== 'submitted').map(rev => (
              <div key={rev.id} className="flex items-center justify-between p-3 bg-[#F5F7FA] rounded-lg border border-[#E5E9F0]">
                <div>
                  <p className="font-['Lora'] font-medium text-[#0A1929]">
                    {rev.reviewerName || rev.reviewerEmail}
                  </p>
                  <p className="text-xs text-[#5A6B7A]">{rev.reviewerEmail}</p>
                  {rev.respondedAt && (
                    <p className="text-xs text-[#5A6B7A] mt-1">
                      {isSpanish ? 'Respondió:' : 'Responded:'} {rev.respondedAt.toDate?.().toLocaleDateString()}
                    </p>
                  )}
                </div>
                {getStatusBadge(rev.status)}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* BUSCADOR DE NUEVOS REVISORES */}
      <div>
        <h4 className="font-['Playfair_Display'] font-semibold text-[#0A1929] mb-3">
          {isSpanish ? 'Invitar nuevo revisor' : 'Invite new reviewer'}
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
        
        <div className="max-h-80 overflow-y-auto space-y-2 border border-[#E5E9F0] rounded-xl p-2 mb-4">
          {potentialReviewers.length === 0 ? (
            <p className="text-center text-[#5A6B7A] py-8 font-['Lora'] italic">
              {searchTerm
                ? (isSpanish ? 'No hay resultados' : 'No results')
                : (isSpanish ? 'No hay más revisores disponibles' : 'No more reviewers available')}
            </p>
          ) : (
            potentialReviewers.map(reviewer => (
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
                </div>
              </motion.div>
            ))
          )}
        </div>
        
        <button
          onClick={onSendInvitation}
          disabled={loading || !selectedReviewerId}
          className="w-full py-4 bg-[#C0A86A] hover:bg-[#A58D4F] text-white font-['Playfair_Display'] font-bold rounded-xl transition-all disabled:bg-[#E5E9F0] disabled:text-[#5A6B7A]"
        >
          {loading ? (
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
  );
};