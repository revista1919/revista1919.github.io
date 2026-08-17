// src/components/ReviewHistoryTab.js
import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useLanguage } from '../hooks/useLanguage';

// ============ ICONOS SVG ============
const Icons = {
  Calendar: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  CheckCircle: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Clock: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  DocumentText: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Edit: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  ClipboardCheck: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  ChevronDown: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>,
  ChevronUp: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>,
  Ban: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
  User: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Download: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  FileSpreadsheet: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  FilePdf: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
  Activity: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  Info: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
};

// ============ TRADUCCIONES DE ACCIONES ============
const translateAction = (action, isSpanish) => {
  const actionTranslations = {
    'submission_created': isSpanish ? 'Envío Creado' : 'Submission Created',
    'assigned_to_section_editor': isSpanish ? 'Asignado a Editor de Sección' : 'Assigned to Section Editor',
    'peer_review_started': isSpanish ? 'Revisión por Pares Iniciada' : 'Peer Review Started',
    'review_submitted': isSpanish ? 'Revisión Enviada' : 'Review Submitted',
    'review_added_to_submission': isSpanish ? 'Revisión Agregada al Envío' : 'Review Added to Submission',
    'editor_notified_new_round': isSpanish ? 'Editor Notificado - Nueva Ronda' : 'Editor Notified - New Round',
    'editor_notified_decision_pending': isSpanish ? 'Editor Notificado - Decisión Pendiente' : 'Editor Notified - Decision Pending',
    'new_round_created_with_new_task': isSpanish ? 'Nueva Ronda Creada' : 'New Round Created',
    'revision_submitted': isSpanish ? 'Revisión del Autor Enviada' : 'Author Revision Submitted',
    'marked_ready_for_publication': isSpanish ? 'Marcado Listo para Publicación' : 'Marked Ready for Publication',
    'director_notified_publication_ready': isSpanish ? 'Director Notificado - Listo para Publicar' : 'Director Notified - Ready to Publish',
    'metadata_changes_proposed': isSpanish ? 'Cambios de Metadatos Propuestos' : 'Metadata Changes Proposed',
    'metadata_changes_applied': isSpanish ? 'Cambios de Metadatos Aplicados' : 'Metadata Changes Applied',
    'reviewer_copy_created': isSpanish ? 'Copia para Revisor Creada' : 'Reviewer Copy Created',
    'additional_reviewer_accepted': isSpanish ? 'Revisor Adicional Aceptó' : 'Additional Reviewer Accepted',
    'document_formatted_retroactively': isSpanish ? 'Documento Formateado Retroactivamente' : 'Document Formatted Retroactively',
  };
  return actionTranslations[action] || action;
};

// ============ TRADUCCIONES DE DECISIONES ============
const translateDecision = (decision, isSpanish) => {
  const translations = {
    'accept': isSpanish ? 'Aceptar' : 'Accept',
    'reject': isSpanish ? 'Rechazar' : 'Reject',
    'minor-revision': isSpanish ? 'Revisión Menor' : 'Minor Revision',
    'major-revision': isSpanish ? 'Revisión Mayor' : 'Major Revision',
    'major-revisions': isSpanish ? 'Revisiones Mayores' : 'Major Revisions',
    'revision-required': isSpanish ? 'Enviar a Pares' : 'Send to Review',
    'awaiting-review': isSpanish ? 'En Revisión' : 'Under Review',
    'in-review': isSpanish ? 'En Revisión' : 'In Review',
  };
  return translations[decision] || decision || '—';
};

// ============ COLORES POR ACCIÓN ============
const getActionColor = (action) => {
  const colors = {
    'submission_created': 'bg-blue-50 text-blue-700 border-blue-200',
    'assigned_to_section_editor': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    'peer_review_started': 'bg-sky-50 text-sky-700 border-sky-200',
    'review_submitted': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'review_added_to_submission': 'bg-teal-50 text-teal-700 border-teal-200',
    'editor_notified_new_round': 'bg-cyan-50 text-cyan-700 border-cyan-200',
    'editor_notified_decision_pending': 'bg-cyan-50 text-cyan-700 border-cyan-200',
    'new_round_created_with_new_task': 'bg-purple-50 text-purple-700 border-purple-200',
    'revision_submitted': 'bg-amber-50 text-amber-700 border-amber-200',
    'marked_ready_for_publication': 'bg-lime-50 text-lime-700 border-lime-200',
    'director_notified_publication_ready': 'bg-green-50 text-green-700 border-green-200',
    'metadata_changes_proposed': 'bg-orange-50 text-orange-700 border-orange-200',
    'metadata_changes_applied': 'bg-orange-50 text-orange-700 border-orange-200',
    'reviewer_copy_created': 'bg-slate-50 text-slate-600 border-slate-200',
    'additional_reviewer_accepted': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'document_formatted_retroactively': 'bg-slate-50 text-slate-600 border-slate-200',
  };
  return colors[action] || 'bg-slate-50 text-slate-600 border-slate-200';
};

// ============ FORMATO DE FECHA ============
const formatDate = (timestamp, isSpanish) => {
  if (!timestamp) return '—';
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString(isSpanish ? 'es-ES' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

// ============ FORMATEAR DETALLES DEL LOG ============
const formatLogDetails = (log, isSpanish) => {
  const { action, details, by, byEmail, to, toEmail, timestamp, round, recommendation, notes, fileName } = log;
  
  const lines = [];
  
  // Acción principal
  lines.push({
    label: isSpanish ? 'Acción' : 'Action',
    value: translateAction(action, isSpanish),
  });
  
  // Ronda
  if (round) {
    lines.push({
      label: isSpanish ? 'Ronda' : 'Round',
      value: round,
    });
  }
  
  // Quién realizó la acción
  if (by && by !== 'system') {
    lines.push({
      label: isSpanish ? 'Realizado por' : 'Performed by',
      value: byEmail || by,
    });
  } else if (by === 'system') {
    lines.push({
      label: isSpanish ? 'Realizado por' : 'Performed by',
      value: isSpanish ? 'Sistema' : 'System',
    });
  }
  
  // A quién fue asignado
  if (to) {
    lines.push({
      label: isSpanish ? 'Asignado a' : 'Assigned to',
      value: toEmail || to,
    });
  }
  
  // Detalles
  if (details) {
    if (typeof details === 'string') {
      lines.push({
        label: isSpanish ? 'Detalles' : 'Details',
        value: details,
      });
    } else if (typeof details === 'object') {
      // Detalles como objeto
      const detailMap = details;
      const detailLines = [];
      
      if (detailMap.currentCount !== undefined && detailMap.requiredCount !== undefined) {
        detailLines.push(`${isSpanish ? 'Progreso' : 'Progress'}: ${detailMap.currentCount}/${detailMap.requiredCount}`);
      }
      
      if (detailMap.reviewerEmail) {
        detailLines.push(`${isSpanish ? 'Revisor' : 'Reviewer'}: ${detailMap.reviewerEmail}`);
      }
      
      if (detailMap.fileUrl || detailMap.reviewerFileUrl) {
        detailLines.push(`${isSpanish ? 'Archivo' : 'File'}: ${isSpanish ? 'Disponible' : 'Available'}`);
      }
      
      if (detailMap.formattedAt) {
        detailLines.push(`${isSpanish ? 'Formateado' : 'Formatted'}: ${formatDate(detailMap.formattedAt, isSpanish)}`);
      }
      
      if (detailLines.length > 0) {
        lines.push({
          label: isSpanish ? 'Detalles' : 'Details',
          value: detailLines.join(' · '),
        });
      }
    }
  }
  
  // Recomendación
  if (recommendation) {
    lines.push({
      label: isSpanish ? 'Recomendación' : 'Recommendation',
      value: translateDecision(recommendation, isSpanish),
    });
  }
  
  // Notas
  if (notes) {
    lines.push({
      label: isSpanish ? 'Notas' : 'Notes',
      value: notes,
    });
  }
  
  // Nombre del archivo
  if (fileName) {
    lines.push({
      label: isSpanish ? 'Archivo' : 'File',
      value: fileName,
    });
  }
  
  // Fecha y hora
  if (timestamp) {
    lines.push({
      label: isSpanish ? 'Fecha' : 'Date',
      value: formatDate(timestamp, isSpanish),
    });
  }
  
  return lines;
};

// ============ COMPONENTE: LOG INDIVIDUAL ============
const AuditLogItem = ({ log, isSpanish, isExpanded, onToggle }) => {
  const details = formatLogDetails(log, isSpanish);
  
  return (
    <div className="bg-white rounded-sm border border-gray-200 shadow-sm mb-2 overflow-hidden">
      {/* Encabezado del log */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getActionColor(log.action).split(' ')[0]}`}></span>
          <div className="text-left flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-sans font-bold text-slate-800 text-xs sm:text-sm">
                {translateAction(log.action, isSpanish)}
              </span>
              {log.round && (
                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-sm">
                  R{log.round}
                </span>
              )}
            </div>
            <span className="text-[10px] sm:text-xs text-slate-500 block truncate">
              {formatDate(log.timestamp, isSpanish)}
            </span>
          </div>
        </div>
        {isExpanded ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
      </button>
      
      {/* Detalles expandidos */}
      {isExpanded && (
        <div className="border-t border-gray-100 px-3 sm:px-4 py-3 bg-slate-50/50">
          <div className="space-y-2">
            {details.map((detail, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
                <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400 sm:w-32 flex-shrink-0 sm:pt-0.5">
                  {detail.label}
                </span>
                <span className="text-sm text-slate-700 font-serif leading-relaxed break-words flex-1">
                  {detail.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============ COMPONENTE: RONDA ============
const RoundCard = ({ roundNumber, roundData, isCurrentRound, isSpanish, auditLogs }) => {
  const [expanded, setExpanded] = useState(isCurrentRound);
  const [expandedLogs, setExpandedLogs] = useState({});
  
  const toggleLog = (logId) => {
    setExpandedLogs(prev => ({
      ...prev,
      [logId]: !prev[logId]
    }));
  };
  
  // Filtrar logs de esta ronda
  const roundLogs = auditLogs.filter(log => log.round === roundNumber || (log.round === undefined && roundNumber === 1));
  
  return (
    <div className={`bg-white rounded-sm border-2 shadow-sm mb-4 ${isCurrentRound ? 'border-[#003b5c]' : 'border-gray-200'}`}>
      {/* Encabezado de la ronda */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-sans font-bold text-sm ${isCurrentRound ? 'bg-[#003b5c] text-white' : 'bg-slate-100 text-slate-600'}`}>
            R{roundNumber}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-sans font-bold text-slate-800 text-sm sm:text-base">
                {isSpanish ? 'Ronda' : 'Round'} {roundNumber}
              </span>
              {isCurrentRound && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#003b5c] text-white text-[10px] font-bold uppercase tracking-wider rounded-full">
                  <Icons.Clock />
                  {isSpanish ? 'Actual' : 'Current'}
                </span>
              )}
              <span className="text-xs text-slate-400">
                {roundLogs.length} {isSpanish ? 'eventos' : 'events'}
              </span>
            </div>
            <span className="text-xs text-slate-500">
              {roundData.startedAt ? (
                <>Iniciada: {formatDate(roundData.startedAt, isSpanish)}</>
              ) : '—'}
              {roundData.completedAt && (
                <> · Completada: {formatDate(roundData.completedAt, isSpanish)}</>
              )}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {roundData.status && (
            <span className={`px-2 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider border ${getActionColor(roundData.status)}`}>
              {translateDecision(roundData.status, isSpanish)}
            </span>
          )}
          {expanded ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
        </div>
      </button>

      {/* Contenido expandido */}
      {expanded && (
        <div className="border-t border-gray-200 p-4 sm:p-6 space-y-6">
          {/* Desk Review */}
          {roundData.deskReview && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-1 h-5 bg-[#003b5c] rounded-full"></span>
                <h4 className="font-sans font-bold text-slate-800 text-sm uppercase tracking-wider">
                  {isSpanish ? 'Desk Review' : 'Desk Review'}
                </h4>
                {roundData.deskReview.decision && (
                  <span className={`px-2 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider border ${getActionColor(roundData.deskReview.decision)}`}>
                    {translateDecision(roundData.deskReview.decision, isSpanish)}
                  </span>
                )}
              </div>

              <div className="bg-slate-50 rounded-sm p-4 space-y-3">
                {roundData.deskReview.feedback && (
                  <div>
                    <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                      {isSpanish ? 'Retroalimentación al Autor' : 'Feedback to Author'}
                    </label>
                    <div className="review-content prose prose-sm max-w-none font-serif text-slate-700 leading-relaxed">
                      <div dangerouslySetInnerHTML={{ __html: roundData.deskReview.feedback }} />
                    </div>
                  </div>
                )}

                {roundData.deskReview.commentsToEditorial && (
                  <div className="border-t border-slate-200 pt-3">
                    <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-amber-600 mb-1 block">
                      {isSpanish ? 'Notas Internas (Solo Editores)' : 'Internal Notes (Editors Only)'}
                    </label>
                    <div className="review-content prose prose-sm max-w-none font-serif text-slate-600 leading-relaxed">
                      <div dangerouslySetInnerHTML={{ __html: roundData.deskReview.commentsToEditorial }} />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-200">
                  {roundData.deskReview.completedAt && (
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Icons.CheckCircle />
                      {isSpanish ? 'Completado:' : 'Completed:'} {formatDate(roundData.deskReview.completedAt, isSpanish)}
                    </span>
                  )}
                  {roundData.deskReview.editorName && (
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Icons.User />
                      {roundData.deskReview.editorName}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Retroalimentaciones de revisores */}
          {roundData.reviews && roundData.reviews.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-1 h-5 bg-sky-500 rounded-full"></span>
                <h4 className="font-sans font-bold text-slate-800 text-sm uppercase tracking-wider">
                  {isSpanish ? 'Retroalimentaciones de Revisores' : 'Reviewer Feedbacks'} ({roundData.reviews.length})
                </h4>
              </div>

              <div className="space-y-3">
                {roundData.reviews.map((review, idx) => (
                  <div key={idx} className="bg-slate-50 rounded-sm p-4 border border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 bg-sky-100 text-sky-700 rounded-sm flex items-center justify-center text-xs font-bold">
                          {idx + 1}
                        </span>
                        <span className="font-sans font-bold text-slate-700 text-sm">
                          {review.reviewerName || `${isSpanish ? 'Revisor' : 'Reviewer'} ${idx + 1}`}
                        </span>
                      </div>
                      {review.decision && (
                        <span className={`px-2 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider border ${getActionColor(review.decision)}`}>
                          {translateDecision(review.decision, isSpanish)}
                        </span>
                      )}
                    </div>

                    {review.feedbackToAuthor && (
                      <div className="mb-3">
                        <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                          {isSpanish ? 'Retroalimentación al Autor' : 'Feedback to Author'}
                        </label>
                        <div className="review-content prose prose-sm max-w-none font-serif text-slate-700 leading-relaxed max-h-40 overflow-y-auto">
                          <div dangerouslySetInnerHTML={{ __html: review.feedbackToAuthor }} />
                        </div>
                      </div>
                    )}

                    {review.commentsToEditorial && (
                      <div className="border-t border-slate-200 pt-3">
                        <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-amber-600 mb-1 block">
                          {isSpanish ? 'Comentarios al Editor' : 'Comments to Editor'}
                        </label>
                        <div className="review-content prose prose-sm max-w-none font-serif text-slate-600 leading-relaxed max-h-32 overflow-y-auto">
                          <div dangerouslySetInnerHTML={{ __html: review.commentsToEditorial }} />
                        </div>
                      </div>
                    )}

                    {review.completedAt && (
                      <div className="mt-2 pt-2 border-t border-slate-200">
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Icons.CheckCircle />
                          {isSpanish ? 'Completado:' : 'Completed:'} {formatDate(review.completedAt, isSpanish)}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Decisión Final */}
          {roundData.finalDecision && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-1 h-5 bg-emerald-600 rounded-full"></span>
                <h4 className="font-sans font-bold text-slate-800 text-sm uppercase tracking-wider">
                  {isSpanish ? 'Decisión Final' : 'Final Decision'}
                </h4>
                {roundData.finalDecision.decision && (
                  <span className={`px-2 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider border ${getActionColor(roundData.finalDecision.decision)}`}>
                    {translateDecision(roundData.finalDecision.decision, isSpanish)}
                  </span>
                )}
              </div>

              <div className="bg-emerald-50/50 rounded-sm p-4 border border-emerald-100 space-y-3">
                {roundData.finalDecision.feedback && (
                  <div>
                    <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-emerald-700 mb-1 block">
                      {isSpanish ? 'Retroalimentación Final al Autor' : 'Final Feedback to Author'}
                    </label>
                    <div className="review-content prose prose-sm max-w-none font-serif text-slate-700 leading-relaxed">
                      <div dangerouslySetInnerHTML={{ __html: roundData.finalDecision.feedback }} />
                    </div>
                  </div>
                )}

                {roundData.finalDecision.comments && (
                  <div className="border-t border-emerald-100 pt-3">
                    <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-emerald-600 mb-1 block">
                      {isSpanish ? 'Comentarios Finales' : 'Final Comments'}
                    </label>
                    <div className="review-content prose prose-sm max-w-none font-serif text-slate-600 leading-relaxed">
                      <div dangerouslySetInnerHTML={{ __html: roundData.finalDecision.comments }} />
                    </div>
                  </div>
                )}

                {roundData.finalDecision.completedAt && (
                  <div className="pt-2 border-t border-emerald-100">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Icons.CheckCircle />
                      {isSpanish ? 'Decisión tomada:' : 'Decision made:'} {formatDate(roundData.finalDecision.completedAt, isSpanish)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Audit Logs de esta ronda */}
          {roundLogs.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-1 h-5 bg-purple-500 rounded-full"></span>
                <h4 className="font-sans font-bold text-slate-800 text-sm uppercase tracking-wider">
                  <Icons.Activity className="inline w-4 h-4 mr-1" />
                  {isSpanish ? 'Registro de Actividad' : 'Activity Log'} ({roundLogs.length})
                </h4>
              </div>

              <div className="space-y-2">
                {roundLogs
                  .sort((a, b) => {
                    const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
                    const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
                    return dateB - dateA;
                  })
                  .map((log, idx) => (
                    <AuditLogItem
                      key={idx}
                      log={log}
                      isSpanish={isSpanish}
                      isExpanded={expandedLogs[`${roundNumber}-${idx}`]}
                      onToggle={() => toggleLog(`${roundNumber}-${idx}`)}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Si no hay datos */}
          {!roundData.deskReview && !roundData.reviews?.length && !roundData.finalDecision && roundLogs.length === 0 && (
            <div className="text-center py-6">
              <Icons.DocumentText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm italic">
                {isSpanish ? 'No hay retroalimentaciones registradas para esta ronda.' : 'No feedback recorded for this round.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============ FUNCIÓN PARA EXPORTAR A CSV/Excel ============
const exportToCSV = (auditLogs, rounds, submissionTitle, isSpanish) => {
  const headers = [
    isSpanish ? 'Fecha' : 'Date',
    isSpanish ? 'Acción' : 'Action',
    isSpanish ? 'Ronda' : 'Round',
    isSpanish ? 'Realizado por' : 'Performed by',
    isSpanish ? 'Email' : 'Email',
    isSpanish ? 'Detalles' : 'Details',
    isSpanish ? 'Recomendación' : 'Recommendation',
    isSpanish ? 'Notas' : 'Notes',
    isSpanish ? 'Archivo' : 'File',
  ];
  
  const rows = auditLogs
    .sort((a, b) => {
      const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
      const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
      return dateA - dateB;
    })
    .map(log => {
      const details = formatLogDetails(log, isSpanish);
      const detailMap = {};
      details.forEach(d => {
        detailMap[d.label] = d.value;
      });
      
      return [
        formatDate(log.timestamp, isSpanish),
        translateAction(log.action, isSpanish),
        log.round || '1',
        log.by === 'system' ? (isSpanish ? 'Sistema' : 'System') : (log.byEmail || log.by || ''),
        log.byEmail || log.toEmail || '',
        detailMap[isSpanish ? 'Detalles' : 'Details'] || '',
        log.recommendation ? translateDecision(log.recommendation, isSpanish) : '',
        log.notes || '',
        log.fileName || '',
      ];
    });
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `historial_${submissionTitle || 'submission'}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

// ============ FUNCIÓN PARA EXPORTAR A PDF (usando ventana de impresión) ============
const exportToPDF = (auditLogs, rounds, submissionTitle, isSpanish) => {
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  
  const sortedLogs = [...auditLogs].sort((a, b) => {
    const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
    const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
    return dateA - dateB;
  });
  
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="${isSpanish ? 'es' : 'en'}">
    <head>
      <meta charset="UTF-8">
      <title>${isSpanish ? 'Historial de Auditoría' : 'Audit History'} - ${submissionTitle || ''}</title>
      <style>
        body {
          font-family: 'Georgia', 'Times New Roman', serif;
          margin: 40px;
          color: #1a202c;
          background: #ffffff;
        }
        h1 {
          font-family: Arial, sans-serif;
          font-size: 24px;
          color: #003b5c;
          border-bottom: 3px solid #003b5c;
          padding-bottom: 10px;
          margin-bottom: 5px;
        }
        .subtitle {
          font-family: Arial, sans-serif;
          font-size: 14px;
          color: #64748b;
          margin-bottom: 30px;
        }
        .round-section {
          margin-bottom: 30px;
          page-break-inside: avoid;
        }
        .round-header {
          font-family: Arial, sans-serif;
          font-size: 18px;
          font-weight: bold;
          color: #003b5c;
          background: #f8fafc;
          padding: 10px 15px;
          border-left: 4px solid #003b5c;
          margin-bottom: 15px;
        }
        .log-item {
          margin-bottom: 12px;
          padding: 10px 15px;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          page-break-inside: avoid;
        }
        .log-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .log-action {
          font-family: Arial, sans-serif;
          font-weight: bold;
          font-size: 13px;
          color: #1e293b;
        }
        .log-date {
          font-size: 11px;
          color: #64748b;
        }
        .log-details {
          font-size: 12px;
          color: #475569;
          line-height: 1.5;
        }
        .log-detail-row {
          display: flex;
          margin-bottom: 4px;
        }
        .log-detail-label {
          font-family: Arial, sans-serif;
          font-weight: bold;
          font-size: 10px;
          text-transform: uppercase;
          color: #94a3b8;
          width: 120px;
          flex-shrink: 0;
        }
        .log-detail-value {
          font-size: 12px;
          color: #334155;
          flex: 1;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
          font-size: 10px;
          color: #94a3b8;
          text-align: center;
        }
        @media print {
          body { margin: 20px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <h1>${isSpanish ? 'Historial de Auditoría' : 'Audit History'}</h1>
      <div class="subtitle">${submissionTitle || ''}</div>
      
      <div class="no-print" style="margin-bottom: 20px; text-align: right;">
        <button onclick="window.print()" style="padding: 8px 16px; background: #003b5c; color: white; border: none; border-radius: 4px; cursor: pointer; font-family: Arial, sans-serif;">
          ${isSpanish ? 'Imprimir / Guardar como PDF' : 'Print / Save as PDF'}
        </button>
      </div>
      
      ${rounds.map(round => {
        const roundLogs = sortedLogs.filter(log => log.round === round.roundNumber || (log.round === undefined && round.roundNumber === 1));
        if (roundLogs.length === 0 && !round.deskReview && !round.finalDecision) return '';
        
        return `
          <div class="round-section">
            <div class="round-header">
              ${isSpanish ? 'Ronda' : 'Round'} ${round.roundNumber}
              ${round.roundNumber === (rounds.length > 0 ? Math.max(...rounds.map(r => r.roundNumber)) : 1) ? ` - ${isSpanish ? 'Actual' : 'Current'}` : ''}
            </div>
            
            ${round.deskReview ? `
              <div class="log-item" style="border-left-color: #003b5c; border-left-width: 3px;">
                <div class="log-header">
                  <span class="log-action">${isSpanish ? 'Desk Review' : 'Desk Review'}</span>
                  ${round.deskReview.decision ? `<span style="font-size: 11px; color: #64748b;">${translateDecision(round.deskReview.decision, isSpanish)}</span>` : ''}
                </div>
                ${round.deskReview.feedback ? `
                  <div class="log-details">
                    <div class="log-detail-row">
                      <span class="log-detail-label">${isSpanish ? 'Feedback' : 'Feedback'}</span>
                      <span class="log-detail-value">${round.deskReview.feedback.replace(/<[^>]*>/g, '')}</span>
                    </div>
                  </div>
                ` : ''}
              </div>
            ` : ''}
            
            ${round.finalDecision ? `
              <div class="log-item" style="border-left-color: #059669; border-left-width: 3px;">
                <div class="log-header">
                  <span class="log-action">${isSpanish ? 'Decisión Final' : 'Final Decision'}</span>
                  ${round.finalDecision.decision ? `<span style="font-size: 11px; color: #64748b;">${translateDecision(round.finalDecision.decision, isSpanish)}</span>` : ''}
                </div>
                ${round.finalDecision.feedback ? `
                  <div class="log-details">
                    <div class="log-detail-row">
                      <span class="log-detail-label">${isSpanish ? 'Feedback' : 'Feedback'}</span>
                      <span class="log-detail-value">${round.finalDecision.feedback.replace(/<[^>]*>/g, '')}</span>
                    </div>
                  </div>
                ` : ''}
              </div>
            ` : ''}
            
            ${roundLogs.map(log => {
              const details = formatLogDetails(log, isSpanish);
              return `
                <div class="log-item">
                  <div class="log-header">
                    <span class="log-action">${translateAction(log.action, isSpanish)}</span>
                    <span class="log-date">${formatDate(log.timestamp, isSpanish)}</span>
                  </div>
                  <div class="log-details">
                    ${details.map(d => `
                      <div class="log-detail-row">
                        <span class="log-detail-label">${d.label}</span>
                        <span class="log-detail-value">${d.value}</span>
                      </div>
                    `).join('')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }).join('')}
      
      <div class="footer">
        ${isSpanish ? 'Documento generado automáticamente por el sistema editorial' : 'Document automatically generated by the editorial system'}
      </div>
    </body>
    </html>
  `;
  
  printWindow.document.write(htmlContent);
  printWindow.document.close();
};

// ============ COMPONENTE PRINCIPAL ============
export const ReviewHistoryTab = ({ submissionId, currentRound, submissionTitle, isSpanish }) => {
  const [rounds, setRounds] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'editorial', 'audit'
  
  useEffect(() => {
    const loadHistory = async () => {
      if (!submissionId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Cargar todos los editorialTasks para esta submission
        const tasksRef = collection(db, 'editorialTasks');
        const tasksQuery = query(
          tasksRef,
          where('submissionId', '==', submissionId),
          orderBy('round', 'asc')
        );
        const tasksSnapshot = await getDocs(tasksQuery);

        // Cargar todos los editorialReviews para esta submission
        const reviewsRef = collection(db, 'editorialReviews');
        const reviewsQuery = query(
          reviewsRef,
          where('submissionId', '==', submissionId),
          orderBy('round', 'asc')
        );
        const reviewsSnapshot = await getDocs(reviewsQuery);

        // Cargar auditLogs de la subcollection
        const auditLogsRef = collection(db, 'submissions', submissionId, 'auditLogs');
        const auditLogsQuery = query(auditLogsRef, orderBy('timestamp', 'asc'));
        const auditLogsSnapshot = await getDocs(auditLogsQuery);
        
        const logs = [];
        auditLogsSnapshot.forEach((doc) => {
          logs.push({
            id: doc.id,
            ...doc.data()
          });
        });
        setAuditLogs(logs);

        // Organizar datos por ronda
        const roundsMap = new Map();

        // Procesar editorialTasks
        tasksSnapshot.forEach((doc) => {
          const data = doc.data();
          const round = data.round || 1;
          
          if (!roundsMap.has(round)) {
            roundsMap.set(round, {
              roundNumber: round,
              status: data.status || 'pending',
              startedAt: data.startedAt || data.createdAt,
              completedAt: data.completedAt || null,
              deskReview: null,
              reviews: [],
              finalDecision: null,
            });
          }

          const roundData = roundsMap.get(round);
          roundData.status = data.status || roundData.status;
          roundData.startedAt = data.startedAt || data.createdAt || roundData.startedAt;
          roundData.completedAt = data.completedAt || roundData.completedAt;

          if (data.deskReviewDecision || data.deskReviewFeedback || data.deskReviewComments) {
            roundData.deskReview = {
              decision: data.deskReviewDecision || null,
              feedback: data.deskReviewFeedback || null,
              commentsToEditorial: data.deskReviewComments || null,
              completedAt: data.deskReviewCompletedAt || null,
              editorName: data.assignedToName || null,
            };
          }

          if (data.finalDecision || data.finalFeedbackToAuthor || data.finalComments) {
            roundData.finalDecision = {
              decision: data.finalDecision || null,
              feedback: data.finalFeedbackToAuthor || null,
              comments: data.finalComments || null,
              completedAt: data.completedAt || null,
            };
          }
        });

        // Procesar editorialReviews
        reviewsSnapshot.forEach((doc) => {
          const data = doc.data();
          const round = data.round || 1;
          
          if (!roundsMap.has(round)) {
            roundsMap.set(round, {
              roundNumber: round,
              status: data.status || 'pending',
              startedAt: data.createdAt,
              completedAt: data.completedAt || null,
              deskReview: null,
              reviews: [],
              finalDecision: null,
            });
          }

          const roundData = roundsMap.get(round);
          
          roundData.reviews.push({
            reviewerName: data.editorUid || null,
            feedbackToAuthor: data.feedbackToAuthor || null,
            commentsToEditorial: data.commentsToEditorial || null,
            decision: data.decision || null,
            completedAt: data.completedAt || null,
            status: data.status || null,
          });
        });

        // Convertir Map a array ordenado
        const roundsArray = Array.from(roundsMap.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([roundNumber, data]) => ({
            roundNumber,
            ...data,
          }));

        setRounds(roundsArray);
      } catch (err) {
        console.error('Error loading review history:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [submissionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-10 h-10 border-4 border-t-[#003b5c] border-slate-200 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm font-sans text-sm font-medium">
        {isSpanish ? 'Error al cargar el historial: ' : 'Error loading history: '} {error}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Encabezado */}
      <div className="bg-[#003b5c] text-white rounded-sm p-4 sm:p-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Icons.ClipboardCheck className="w-6 h-6" />
            <div>
              <h3 className="font-sans font-bold text-lg uppercase tracking-wider">
                {isSpanish ? 'Historial de Retroalimentaciones' : 'Feedback History'}
              </h3>
              <p className="text-sky-200 text-sm mt-1">
                {submissionTitle || submissionId}
              </p>
            </div>
          </div>
          
          {/* Botones de exportación */}
          <div className="flex gap-2">
            <button
              onClick={() => exportToCSV(auditLogs, rounds, submissionTitle, isSpanish)}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-sm transition-colors text-xs font-bold uppercase tracking-wider"
            >
              <Icons.FileSpreadsheet />
              {isSpanish ? 'Excel (CSV)' : 'Excel (CSV)'}
            </button>
            <button
              onClick={() => exportToPDF(auditLogs, rounds, submissionTitle, isSpanish)}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-sm transition-colors text-xs font-bold uppercase tracking-wider"
            >
              <Icons.FilePdf />
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* Lista de rondas */}
      {rounds.length > 0 ? (
        <div>
          {rounds.map((round) => (
            <RoundCard
              key={round.roundNumber}
              roundNumber={round.roundNumber}
              roundData={round}
              isCurrentRound={round.roundNumber === currentRound}
              isSpanish={isSpanish}
              auditLogs={auditLogs}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-sm border border-gray-200">
          <Icons.DocumentText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-serif">
            {isSpanish ? 'No hay historial disponible para esta submission.' : 'No history available for this submission.'}
          </p>
        </div>
      )}

      {/* Nota de solo lectura */}
      <div className="bg-amber-50 border border-amber-200 rounded-sm p-4 flex items-start gap-3">
        <Icons.Ban className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800 font-serif leading-relaxed">
          {isSpanish 
            ? 'Este historial es de solo lectura. Para realizar modificaciones, utiliza la pestaña "Revisión" cuando la ronda actual esté en estado de desk review.'
            : 'This history is read-only. To make changes, use the "Review" tab when the current round is in desk review status.'}
        </p>
      </div>
    </div>
  );
};

export default ReviewHistoryTab;