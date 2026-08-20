// src/components/ReviewHistoryTab.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useLanguage } from '../hooks/useLanguage';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// ============ ICONOS SVG (Premium Editorial) ============
const Icons = {
  Calendar: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  CheckCircle: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Clock: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  DocumentText: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  ClipboardCheck: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  ChevronDown: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>,
  ChevronUp: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>,
  Ban: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
  User: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Download: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  FileSpreadsheet: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  FilePdf: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
  Activity: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  ExternalLink: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>,
  Message: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>,
  File: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
  Lock: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
  Gavel: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>,
  Database: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>,
  Tag: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>,
  Code: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
  Json: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l-3 3 3 3m8-6l3 3-3 3M13 5l-2 14" /></svg>,
};

// ============ TRADUCCIONES ============
const translateAction = (action, isSpanish) => {
  const translations = {
    'submission_created': isSpanish ? 'Envío Creado' : 'Submission Created',
    'assigned_to_section_editor': isSpanish ? 'Asignado a Editor' : 'Assigned to Editor',
    'peer_review_started': isSpanish ? 'Revisión por Pares Iniciada' : 'Peer Review Started',
    'review_submitted': isSpanish ? 'Revisión Enviada' : 'Review Submitted',
    'review_added_to_submission': isSpanish ? 'Revisión Agregada' : 'Review Added',
    'editor_notified_new_round': isSpanish ? 'Editor Notificado' : 'Editor Notified',
    'new_round_created_with_new_task': isSpanish ? 'Nueva Ronda Creada' : 'New Round Created',
    'revision_submitted': isSpanish ? 'Revisión del Autor' : 'Author Revision',
    'marked_ready_for_publication': isSpanish ? 'Listo para Publicar' : 'Ready to Publish',
    'metadata_changes_applied': isSpanish ? 'Metadatos Actualizados' : 'Metadata Updated',
    'metadata_changes_proposed': isSpanish ? 'Propuesta de Metadatos' : 'Metadata Proposal',
    'metadata_proposal_email_sent': isSpanish ? 'Email de Propuesta Enviado' : 'Proposal Email Sent',
    'metadata_proposal_response_notified': isSpanish ? 'Respuesta de Propuesta Notificada' : 'Proposal Response Notified',
    'external_reviewer_invited': isSpanish ? 'Revisor Externo Invitado' : 'External Reviewer Invited',
    'external_reviewer_onboarded': isSpanish ? 'Revisor Externo Registrado' : 'External Reviewer Onboarded',
    'additional_reviewer_accepted': isSpanish ? 'Revisor Adicional Aceptado' : 'Additional Reviewer Accepted',
    'reviewer_copy_created': isSpanish ? 'Copia para Revisor Creada' : 'Reviewer Copy Created',
    'proceeded_to_decision': isSpanish ? 'Proceder a Decisión' : 'Proceeded to Decision',
    'publication_ready_complete': isSpanish ? 'Publicación Completada' : 'Publication Ready Complete',
    'certificate_generated': isSpanish ? 'Certificado Generado' : 'Certificate Generated',
  };
  return translations[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const translateDecision = (decision, isSpanish) => {
  const translations = {
    'accept': isSpanish ? 'Aceptar' : 'Accept',
    'reject': isSpanish ? 'Rechazar' : 'Reject',
    'minor-revision': isSpanish ? 'Revisión Menor' : 'Minor Revision',
    'minor-revisions': isSpanish ? 'Revisiones Menores' : 'Minor Revisions',
    'major-revision': isSpanish ? 'Revisión Mayor' : 'Major Revision',
    'major-revisions': isSpanish ? 'Revisiones Mayores' : 'Major Revisions',
    'revision-required': isSpanish ? 'Enviar a Pares' : 'Send to Review',
  };
  return translations[decision] || decision || '—';
};

const formatDate = (timestamp, isSpanish) => {
  if (!timestamp) return '—';
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString(isSpanish ? 'es-ES' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// ============ FORMATEAR VALORES DINÁMICOS ============
const formatValue = (value, isSpanish) => {
  if (value === null || value === undefined || value === '') {
    return <span className="text-slate-400 italic font-sans text-xs">—</span>;
  }
  
  if (typeof value === 'object' && value !== null) {
    if (value.seconds !== undefined) {
      return <span className="font-mono text-xs text-slate-600">{formatDate(value, isSpanish)}</span>;
    }
    
    if (Array.isArray(value)) {
      return (
        <div className="flex flex-wrap gap-1.5">
          {value.map((item, idx) => (
            <span key={idx} className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded text-xs font-sans border border-slate-200">
              {typeof item === 'object' ? JSON.stringify(item) : String(item)}
            </span>
          ))}
        </div>
      );
    }
    
    return (
      <pre className="text-xs font-mono text-slate-600 bg-slate-50 p-3 rounded border border-slate-200 overflow-x-auto">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  
  return <span className="font-sans text-sm text-slate-700">{String(value)}</span>;
};

// ============ COMPONENTE: VISUALIZADOR DE ESTRUCTURA DE LOG ============
const LogStructureViewer = ({ log, isSpanish }) => {
  const [expanded, setExpanded] = useState(false);
  
  const excludeFields = ['id', 'timestamp', 'action', 'round'];
  const dynamicFields = Object.entries(log).filter(([key]) => !excludeFields.includes(key));
  
  return (
    <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icons.Database className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-sans font-bold text-slate-600 uppercase tracking-wider">
            {isSpanish ? 'Datos del Evento' : 'Event Data'}
          </span>
        </div>
        <div className="text-slate-400">
          {expanded ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
        </div>
      </button>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-100 p-4 space-y-2 bg-slate-50/50">
              {dynamicFields.map(([key, value]) => (
                <div key={key} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider sm:w-32 flex-shrink-0 pt-1">
                    {key}
                  </span>
                  <div className="flex-1">
                    {formatValue(value, isSpanish)}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============ EXPORTACIONES ============
const cleanHtml = (html) => {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
};

// ============ FUNCIONES DE EXPORTACIÓN PREMIUM ============

// Función auxiliar para obtener color según decisión
const getDecisionColor = (decision) => {
  const colors = {
    'accept': { bg: [236, 253, 245], border: [5, 150, 105], text: [6, 95, 70] },
    'reject': { bg: [254, 242, 242], border: [220, 38, 38], text: [153, 27, 27] },
    'minor-revision': { bg: [240, 249, 255], border: [14, 165, 233], text: [12, 74, 110] },
    'minor-revisions': { bg: [240, 249, 255], border: [14, 165, 233], text: [12, 74, 110] },
    'major-revision': { bg: [255, 251, 235], border: [245, 158, 11], text: [146, 64, 14] },
    'major-revisions': { bg: [255, 251, 235], border: [245, 158, 11], text: [146, 64, 14] },
    'revision-required': { bg: [238, 242, 255], border: [99, 102, 241], text: [55, 48, 163] },
  };
  return colors[decision] || { bg: [248, 250, 252], border: [100, 116, 139], text: [51, 65, 85] };
};

// ============ EXPORTAR A EXCEL ============
const exportToExcel = (auditLogs, rounds, peerReviews, metadataProposals, submissionTitle, isSpanish) => {
  const wb = XLSX.utils.book_new();
  
  // Sheet 1: Resumen General
  const summaryData = [];
  rounds.forEach(round => {
    const roundLogs = auditLogs.filter(log => 
      log.round === round.roundNumber || (log.round === undefined && round.roundNumber === 1)
    );
    const roundPeerReviews = peerReviews.filter(r => r.round === round.roundNumber);
    
    summaryData.push({
      [isSpanish ? 'Ronda' : 'Round']: round.roundNumber,
      [isSpanish ? 'Estado' : 'Status']: round.status || '—',
      [isSpanish ? 'Desk Review' : 'Desk Review']: round.deskReview ? translateDecision(round.deskReview.decision, isSpanish) : '—',
      [isSpanish ? 'Decisión Final' : 'Final Decision']: round.finalDecision ? translateDecision(round.finalDecision.decision, isSpanish) : '—',
      [isSpanish ? 'Revisiones de Pares' : 'Peer Reviews']: roundPeerReviews.length,
      [isSpanish ? 'Eventos Registrados' : 'Logged Events']: roundLogs.length,
    });
  });
  
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 8 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, isSpanish ? 'Resumen' : 'Summary');
  
  // Sheet 2: Historial Detallado
  const detailData = [];
  auditLogs
    .sort((a, b) => {
      const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
      const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
      return dateA - dateB;
    })
    .forEach(log => {
      detailData.push({
        [isSpanish ? 'Fecha' : 'Date']: formatDate(log.timestamp, isSpanish),
        [isSpanish ? 'Acción' : 'Action']: translateAction(log.action, isSpanish),
        [isSpanish ? 'Ronda' : 'Round']: log.round || '1',
        [isSpanish ? 'Realizado por' : 'Performed by']: log.byEmail || log.by || (isSpanish ? 'Sistema' : 'System'),
        [isSpanish ? 'Datos Completos' : 'Complete Data']: JSON.stringify(log, null, 2),
      });
    });
  
  const wsDetail = XLSX.utils.json_to_sheet(detailData);
  wsDetail['!cols'] = [{ wch: 25 }, { wch: 35 }, { wch: 8 }, { wch: 35 }, { wch: 100 }];
  XLSX.utils.book_append_sheet(wb, wsDetail, isSpanish ? 'Historial' : 'History');
  
  // Sheet 3: Revisiones de Pares
  if (peerReviews.length > 0) {
    const reviewsData = peerReviews.map(review => ({
      [isSpanish ? 'Ronda' : 'Round']: review.round || 1,
      [isSpanish ? 'Revisor' : 'Reviewer']: review.reviewerName || '—',
      [isSpanish ? 'Email' : 'Email']: review.reviewerEmail || '—',
      [isSpanish ? 'Recomendación' : 'Recommendation']: translateDecision(review.recommendation, isSpanish),
      [isSpanish ? 'Comentarios al Autor' : 'Comments to Author']: cleanHtml(review.commentsToAuthor),
      [isSpanish ? 'Comentarios al Editor' : 'Comments to Editor']: cleanHtml(review.commentsToEditor),
      [isSpanish ? 'Puntajes' : 'Scores']: JSON.stringify(review.scores || {}),
    }));
    
    const wsReviews = XLSX.utils.json_to_sheet(reviewsData);
    wsReviews['!cols'] = [{ wch: 8 }, { wch: 25 }, { wch: 30 }, { wch: 20 }, { wch: 50 }, { wch: 50 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsReviews, isSpanish ? 'Revisiones' : 'Reviews');
  }
  
  // Sheet 4: Propuestas de Metadatos
  if (metadataProposals.length > 0) {
    const proposalsData = metadataProposals.map(proposal => ({
      [isSpanish ? 'Ronda' : 'Round']: proposal.round || 1,
      [isSpanish ? 'Propuesto por' : 'Proposed by']: proposal.proposedByEmail || '—',
      [isSpanish ? 'Estado' : 'Status']: proposal.status || '—',
      [isSpanish ? 'Campos Modificados' : 'Modified Fields']: (proposal.changes || []).map(c => c.field).join(', '),
      [isSpanish ? 'Respuesta del Autor' : 'Author Response']: proposal.authorResponse 
        ? (proposal.authorResponse.accepted ? (isSpanish ? 'Aceptada' : 'Accepted') : (isSpanish ? 'Rechazada' : 'Rejected')) 
        : '—',
      [isSpanish ? 'Fecha' : 'Date']: formatDate(proposal.proposedAt, isSpanish),
    }));
    
    const wsProposals = XLSX.utils.json_to_sheet(proposalsData);
    wsProposals['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, wsProposals, isSpanish ? 'Propuestas' : 'Proposals');
  }
  
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `historial_${submissionTitle || 'submission'}.xlsx`);
};

// ============ EXPORTAR A PDF ============
const exportToPDF = (auditLogs, rounds, peerReviews, metadataProposals, submissionTitle, isSpanish) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - 2 * margin;
  let yPosition = margin;

  const checkPageBreak = (neededSpace) => {
    if (yPosition + neededSpace > pageHeight - margin - 15) {
      doc.addPage();
      yPosition = margin;
    }
  };

  // Función para dibujar encabezado de página
  const drawPageHeader = () => {
    // Fondo del header
    doc.setFillColor(0, 33, 71);
    doc.rect(0, 0, pageWidth, 28, 'F');
    
    // Línea acento
    doc.setFillColor(255, 108, 12);
    doc.rect(0, 28, pageWidth, 2, 'F');
    
    // Texto del header
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(isSpanish ? 'REVISTA NACIONAL DE LAS CIENCIAS PARA ESTUDIANTES' : 'NATIONAL JOURNAL OF SCIENCES FOR STUDENTS', margin, 12);
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(isSpanish ? 'Sistema Editorial · Historial de Auditoría' : 'Editorial System · Audit History', margin, 18);
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text(new Date().toLocaleDateString(isSpanish ? 'es-ES' : 'en-US'), pageWidth - margin, 12, { align: 'right' });
    doc.text(`ID: ${submissionTitle || 'N/A'}`, pageWidth - margin, 18, { align: 'right' });
    
    yPosition = 40;
  };

  // Función para dibujar pie de página
  const drawPageFooter = (pageNumber, totalPages) => {
    doc.setFillColor(248, 250, 252);
    doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
    
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text(
      isSpanish ? 'Documento generado automáticamente por el sistema editorial' : 'Document automatically generated by the editorial system',
      margin,
      pageHeight - 6
    );
    doc.text(`${pageNumber} / ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
  };

  // Función para dibujar sección de decisión
  const drawDecisionBox = (title, decision, feedback, colorScheme, icon) => {
    const boxHeight = Math.max(35, (feedback ? doc.splitTextToSize(cleanHtml(feedback), contentWidth - 40).length * 4 : 0) + 30);
    checkPageBreak(boxHeight);
    
    // Fondo del box
    doc.setFillColor(...colorScheme.bg);
    doc.roundedRect(margin, yPosition, contentWidth, boxHeight, 3, 3, 'F');
    
    // Borde izquierdo
    doc.setFillColor(...colorScheme.border);
    doc.rect(margin, yPosition, 3, boxHeight, 'F');
    
    // Título
    doc.setFontSize(10);
    doc.setTextColor(...colorScheme.text);
    doc.setFont('helvetica', 'bold');
    doc.text(title.toUpperCase(), margin + 10, yPosition + 8);
    
    yPosition += 14;
    
    // Decisión
    if (decision) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`${isSpanish ? 'Decisión:' : 'Decision:'} ${translateDecision(decision, isSpanish)}`, margin + 15, yPosition + 4);
      yPosition += 10;
    }
    
    // Feedback
    if (feedback) {
      const cleanFeedback = cleanHtml(feedback);
      const feedbackLines = doc.splitTextToSize(cleanFeedback, contentWidth - 40);
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'normal');
      doc.text(feedbackLines, margin + 15, yPosition);
      yPosition += feedbackLines.length * 4;
    }
    
    yPosition += 10;
  };

  // Dibujar portada
  drawPageHeader();
  
  // Título principal
  checkPageBreak(60);
  doc.setFontSize(22);
  doc.setTextColor(0, 33, 71);
  doc.setFont('helvetica', 'bold');
  doc.text(isSpanish ? 'Historial de Auditoría' : 'Audit History', margin, yPosition);
  
  yPosition += 10;
  
  doc.setDrawColor(0, 33, 71);
  doc.setLineWidth(0.8);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  
  yPosition += 12;
  
  if (submissionTitle) {
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text(submissionTitle, margin, yPosition);
    yPosition += 20;
  }
  
  // Resumen estadístico
  const totalEvents = auditLogs.length;
  const totalPeerReviews = peerReviews.length;
  const totalProposals = metadataProposals.length;
  
  const statsY = yPosition;
  const statsHeight = 30;
  
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, statsY, contentWidth, statsHeight, 3, 3, 'F');
  
  const statWidth = contentWidth / 3;
  const stats = [
    { label: isSpanish ? 'Rondas' : 'Rounds', value: rounds.length },
    { label: isSpanish ? 'Eventos' : 'Events', value: totalEvents },
    { label: isSpanish ? 'Revisiones' : 'Reviews', value: totalPeerReviews },
  ];
  
  stats.forEach((stat, idx) => {
    const xPos = margin + (idx * statWidth) + (statWidth / 2);
    
    doc.setFontSize(18);
    doc.setTextColor(0, 33, 71);
    doc.setFont('helvetica', 'bold');
    doc.text(String(stat.value), xPos, statsY + 14, { align: 'center' });
    
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text(stat.label.toUpperCase(), xPos, statsY + 22, { align: 'center' });
  });
  
  yPosition += statsHeight + 15;

  // ============ SECCIÓN DE RONDAS ============
  const sortedLogs = [...auditLogs].sort((a, b) => {
    const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
    const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
    return dateA - dateB;
  });

  rounds.forEach((round, roundIndex) => {
    const roundLogs = sortedLogs.filter(log => 
      log.round === round.roundNumber || (log.round === undefined && round.roundNumber === 1)
    );
    const roundPeerReviews = peerReviews.filter(r => r.round === round.roundNumber);
    const roundProposals = metadataProposals.filter(p => p.round === round.roundNumber);
    
    // Header de ronda
    checkPageBreak(45);
    yPosition += 10;
    
    // Fondo del header de ronda
    doc.setFillColor(0, 33, 71);
    doc.roundedRect(margin, yPosition, contentWidth, 18, 2, 2, 'F');
    
    // Número de ronda
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(`${isSpanish ? 'RONDA' : 'ROUND'} ${round.roundNumber}`, margin + 10, yPosition + 12);
    
    // Indicadores
    const indicators = [];
    if (round.deskReview) indicators.push('DR');
    if (roundPeerReviews.length > 0) indicators.push(`${roundPeerReviews.length} PR`);
    if (round.finalDecision) indicators.push('FD');
    if (roundProposals.length > 0) indicators.push(`${roundProposals.length} MP`);
    
    if (indicators.length > 0) {
      doc.setFontSize(7);
      doc.setTextColor(200, 210, 220);
      doc.setFont('helvetica', 'normal');
      doc.text(indicators.join(' · '), pageWidth - margin - 10, yPosition + 12, { align: 'right' });
    }
    
    yPosition += 25;

    // Desk Review
    if (round.deskReview) {
      drawDecisionBox(
        isSpanish ? 'Desk Review' : 'Desk Review',
        round.deskReview.decision,
        round.deskReview.feedback,
        getDecisionColor(round.deskReview.decision),
        'clipboard'
      );
    }

    // Decisiones finales
    if (round.finalDecision) {
      drawDecisionBox(
        isSpanish ? 'Decisión Final' : 'Final Decision',
        round.finalDecision.decision,
        round.finalDecision.feedback,
        getDecisionColor(round.finalDecision.decision),
        'gavel'
      );
    }

    // Revisiones de pares
    roundPeerReviews.forEach((review, reviewIdx) => {
      const reviewLines = [];
      reviewLines.push(`${isSpanish ? 'Revisor' : 'Reviewer'}: ${review.reviewerName || `R${reviewIdx + 1}`}`);
      if (review.reviewerEmail) reviewLines.push(`Email: ${review.reviewerEmail}`);
      if (review.recommendation) reviewLines.push(`${isSpanish ? 'Recomendación' : 'Recommendation'}: ${translateDecision(review.recommendation, isSpanish)}`);
      if (review.commentsToAuthor) {
        reviewLines.push('');
        reviewLines.push(`${isSpanish ? 'Comentarios al Autor' : 'Comments to Author'}:`);
        reviewLines.push(cleanHtml(review.commentsToAuthor).substring(0, 200));
      }
      
      const boxHeight = Math.max(30, reviewLines.length * 4 + 25);
      checkPageBreak(boxHeight);
      
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, yPosition, contentWidth, boxHeight, 3, 3, 'F');
      
      doc.setFillColor(14, 165, 233);
      doc.rect(margin, yPosition, 3, boxHeight, 'F');
      
      doc.setFontSize(9);
      doc.setTextColor(0, 33, 71);
      doc.setFont('helvetica', 'bold');
      doc.text(`${isSpanish ? 'REVISIÓN DE PARES' : 'PEER REVIEW'} ${reviewIdx + 1}`, margin + 10, yPosition + 8);
      
      yPosition += 14;
      
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'normal');
      
      reviewLines.forEach(line => {
        if (yPosition > pageHeight - margin - 20) {
          checkPageBreak(20);
        }
        if (line) {
          const wrappedLines = doc.splitTextToSize(line, contentWidth - 30);
          doc.text(wrappedLines, margin + 12, yPosition);
          yPosition += wrappedLines.length * 3.5;
        } else {
          yPosition += 3;
        }
      });
      
      yPosition += 10;
    });

    // Propuestas de metadatos
    roundProposals.forEach((proposal, propIdx) => {
      const propLines = [];
      propLines.push(`${isSpanish ? 'Propuesto por' : 'Proposed by'}: ${proposal.proposedByEmail || '—'}`);
      propLines.push(`${isSpanish ? 'Estado' : 'Status'}: ${proposal.status || '—'}`);
      
      if (proposal.changes && proposal.changes.length > 0) {
        propLines.push(`${isSpanish ? 'Campos modificados' : 'Modified fields'}: ${proposal.changes.map(c => c.field).join(', ')}`);
      }
      
      const boxHeight = Math.max(30, propLines.length * 4 + 25);
      checkPageBreak(boxHeight);
      
      doc.setFillColor(238, 242, 255);
      doc.roundedRect(margin, yPosition, contentWidth, boxHeight, 3, 3, 'F');
      
      doc.setFillColor(99, 102, 241);
      doc.rect(margin, yPosition, 3, boxHeight, 'F');
      
      doc.setFontSize(9);
      doc.setTextColor(55, 48, 163);
      doc.setFont('helvetica', 'bold');
      doc.text(`${isSpanish ? 'PROPUESTA DE METADATOS' : 'METADATA PROPOSAL'} ${propIdx + 1}`, margin + 10, yPosition + 8);
      
      yPosition += 14;
      
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'normal');
      
      propLines.forEach(line => {
        const wrappedLines = doc.splitTextToSize(line, contentWidth - 30);
        doc.text(wrappedLines, margin + 12, yPosition);
        yPosition += wrappedLines.length * 3.5;
      });
      
      yPosition += 10;
    });

    // Registro de actividad
    if (roundLogs.length > 0) {
      checkPageBreak(35);
      
      doc.setFontSize(10);
      doc.setTextColor(0, 33, 71);
      doc.setFont('helvetica', 'bold');
      doc.text(isSpanish ? 'REGISTRO DE ACTIVIDAD' : 'ACTIVITY LOG', margin, yPosition);
      
      yPosition += 6;
      
      doc.setDrawColor(200, 210, 220);
      doc.setLineWidth(0.3);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      
      yPosition += 8;

      roundLogs
        .sort((a, b) => {
          const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
          const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
          return dateB - dateA;
        })
        .forEach((log, logIdx) => {
          const logLines = [
            `${translateAction(log.action, isSpanish)}`,
            `${formatDate(log.timestamp, isSpanish)} · ${log.byEmail || log.by || (isSpanish ? 'Sistema' : 'System')}`,
          ];
          
          // Datos adicionales del log
          const logData = JSON.stringify(log, null, 2);
          const dataLines = doc.splitTextToSize(logData.substring(0, 300), contentWidth - 30);
          
          const totalLines = logLines.length + dataLines.length;
          const boxHeight = Math.max(25, totalLines * 4 + 15);
          
          checkPageBreak(boxHeight + 5);
          
          // Fondo alternado
          if (logIdx % 2 === 0) {
            doc.setFillColor(250, 251, 252);
          } else {
            doc.setFillColor(255, 255, 255);
          }
          doc.roundedRect(margin, yPosition, contentWidth, boxHeight, 2, 2, 'F');
          
          // Borde sutil
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.2);
          doc.roundedRect(margin, yPosition, contentWidth, boxHeight, 2, 2, 'S');
          
          // Punto indicador
          const dotColor = {
            'review': [14, 165, 233],
            'metadata': [99, 102, 241],
            'desk': [0, 33, 71],
            'decision': [5, 150, 105],
            'submission': [255, 108, 12],
          };
          
          let dotColorValue = [100, 116, 139];
          Object.entries(dotColor).forEach(([key, color]) => {
            if (log.action?.includes(key)) {
              dotColorValue = color;
            }
          });
          
          doc.setFillColor(...dotColorValue);
          doc.circle(margin + 5, yPosition + 5, 2, 'F');
          
          // Texto del log
          doc.setFontSize(8);
          doc.setTextColor(0, 33, 71);
          doc.setFont('helvetica', 'bold');
          doc.text(logLines[0], margin + 12, yPosition + 6);
          
          doc.setFontSize(7);
          doc.setTextColor(100, 116, 139);
          doc.setFont('helvetica', 'normal');
          doc.text(logLines[1], margin + 12, yPosition + 11);
          
          yPosition += 16;
          
          // Datos JSON
          if (dataLines.length > 0) {
            doc.setFontSize(6);
            doc.setTextColor(148, 163, 184);
            doc.text(dataLines.slice(0, 5), margin + 12, yPosition);
            yPosition += dataLines.slice(0, 5).length * 3.5 + 3;
          }
          
          yPosition += 5;
        });
    }
    
    yPosition += 15;
  });

  // ============ PIE DE PÁGINA ============
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawPageFooter(i, totalPages);
  }

  doc.save(`historial_${submissionTitle || 'submission'}.pdf`);
};

// ============ EXPORTAR A CSV ============
const exportToCSV = (auditLogs, rounds, peerReviews, metadataProposals, submissionTitle, isSpanish) => {
  const headers = [
    isSpanish ? 'Fecha' : 'Date',
    isSpanish ? 'Acción' : 'Action',
    isSpanish ? 'Ronda' : 'Round',
    isSpanish ? 'Realizado por' : 'Performed by',
    isSpanish ? 'Datos Completos (JSON)' : 'Complete Data (JSON)',
  ];
  
  const rows = auditLogs
    .sort((a, b) => {
      const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
      const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
      return dateA - dateB;
    })
    .map(log => [
      formatDate(log.timestamp, isSpanish),
      translateAction(log.action, isSpanish),
      log.round || '1',
      log.byEmail || log.by || (isSpanish ? 'Sistema' : 'System'),
      JSON.stringify(log),
    ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `historial_${submissionTitle || 'submission'}.csv`);
};

// ============ EXPORTAR A WORD ============
const exportToWord = (auditLogs, rounds, peerReviews, metadataProposals, submissionTitle, isSpanish) => {
  const sortedLogs = [...auditLogs].sort((a, b) => {
    const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
    const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
    return dateA - dateB;
  });

  // Función para obtener color según decisión
  const getDecisionStyles = (decision) => {
    const styles = {
      'accept': { bg: '#ecfdf5', border: '#059669', text: '#065f46' },
      'reject': { bg: '#fef2f2', border: '#dc2626', text: '#991b1b' },
      'minor-revision': { bg: '#f0f9ff', border: '#0ea5e9', text: '#0c4a6e' },
      'minor-revisions': { bg: '#f0f9ff', border: '#0ea5e9', text: '#0c4a6e' },
      'major-revision': { bg: '#fffbeb', border: '#f59e0b', text: '#92400e' },
      'major-revisions': { bg: '#fffbeb', border: '#f59e0b', text: '#92400e' },
      'revision-required': { bg: '#eef2ff', border: '#6366f1', text: '#3730a3' },
    };
    return styles[decision] || { bg: '#f8fafc', border: '#64748b', text: '#334155' };
  };

  let htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" 
          xmlns:w="urn:schemas-microsoft-com:office:word" 
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <title>${isSpanish ? 'Historial de Auditoría' : 'Audit History'}</title>
      <style>
        @page {
          margin: 2cm;
        }
        body { 
          font-family: 'Georgia', serif; 
          color: #1a202c; 
          line-height: 1.6;
        }
        .document-header {
          background: #002147;
          color: white;
          padding: 30px;
          margin-bottom: 30px;
          border-bottom: 4px solid #FF6C0C;
        }
        .document-title {
          font-family: Arial, sans-serif;
          font-size: 28px;
          font-weight: bold;
          margin: 0;
          letter-spacing: -0.5px;
        }
        .document-subtitle {
          font-family: Arial, sans-serif;
          font-size: 14px;
          color: #cbd5e1;
          margin-top: 8px;
        }
        .stats-bar {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 15px 20px;
          margin-bottom: 25px;
          display: flex;
          justify-content: space-around;
        }
        .stat-item {
          text-align: center;
        }
        .stat-number {
          font-family: Arial, sans-serif;
          font-size: 22px;
          font-weight: bold;
          color: #002147;
        }
        .stat-label {
          font-family: Arial, sans-serif;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #64748b;
        }
        .round-header {
          font-family: Arial, sans-serif;
          font-size: 18px;
          font-weight: bold;
          color: white;
          background: #002147;
          padding: 12px 20px;
          margin-top: 25px;
          margin-bottom: 15px;
          border-left: 4px solid #FF6C0C;
        }
        .decision-box {
          margin: 15px 0;
          padding: 15px 20px;
          border-left: 4px solid #002147;
          background: #f0f9ff;
          page-break-inside: avoid;
        }
        .decision-title {
          font-family: Arial, sans-serif;
          font-size: 13px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 8px;
        }
        .decision-value {
          display: inline-block;
          padding: 4px 12px;
          font-weight: bold;
          font-size: 11px;
          border-radius: 3px;
          margin-bottom: 10px;
        }
        .review-box {
          margin: 15px 0;
          padding: 15px 20px;
          border: 1px solid #e2e8f0;
          border-left: 4px solid #0ea5e9;
          background: #f8fafc;
          page-break-inside: avoid;
        }
        .proposal-box {
          margin: 15px 0;
          padding: 15px 20px;
          border: 1px solid #e2e8f0;
          border-left: 4px solid #6366f1;
          background: #eef2ff;
          page-break-inside: avoid;
        }
        .log-item {
          margin: 10px 0;
          padding: 10px 15px;
          border: 1px solid #e2e8f0;
          border-radius: 3px;
          page-break-inside: avoid;
        }
        .log-action {
          font-weight: bold;
          color: #002147;
          font-family: Arial, sans-serif;
          font-size: 13px;
        }
        .log-date {
          color: #64748b;
          font-size: 11px;
          font-family: Arial, sans-serif;
        }
        .log-data {
          font-family: 'Courier New', monospace;
          font-size: 8px;
          color: #94a3b8;
          white-space: pre-wrap;
          margin-top: 8px;
          padding: 8px;
          background: #f8fafc;
          border-radius: 3px;
        }
        .footer-note {
          margin-top: 30px;
          padding-top: 15px;
          border-top: 1px solid #e2e8f0;
          text-align: center;
          font-family: Arial, sans-serif;
          font-size: 10px;
          color: #94a3b8;
        }
      </style>
    </head>
    <body>
      <div class="document-header">
        <div class="document-title">${isSpanish ? 'Historial de Auditoría' : 'Audit History'}</div>
        <div class="document-subtitle">${submissionTitle || ''}</div>
      </div>
      
      <div class="stats-bar">
        <div class="stat-item">
          <div class="stat-number">${rounds.length}</div>
          <div class="stat-label">${isSpanish ? 'Rondas' : 'Rounds'}</div>
        </div>
        <div class="stat-item">
          <div class="stat-number">${auditLogs.length}</div>
          <div class="stat-label">${isSpanish ? 'Eventos' : 'Events'}</div>
        </div>
        <div class="stat-item">
          <div class="stat-number">${peerReviews.length}</div>
          <div class="stat-label">${isSpanish ? 'Revisiones' : 'Reviews'}</div>
        </div>
        <div class="stat-item">
          <div class="stat-number">${metadataProposals.length}</div>
          <div class="stat-label">${isSpanish ? 'Propuestas' : 'Proposals'}</div>
        </div>
      </div>
  `;

  rounds.forEach(round => {
    const roundLogs = sortedLogs.filter(log => 
      log.round === round.roundNumber || (log.round === undefined && round.roundNumber === 1)
    );
    const roundPeerReviews = peerReviews.filter(r => r.round === round.roundNumber);
    const roundProposals = metadataProposals.filter(p => p.round === round.roundNumber);
    
    htmlContent += `
      <div class="round-header">${isSpanish ? 'Ronda' : 'Round'} ${round.roundNumber}</div>
    `;
    
    // Desk Review
    if (round.deskReview) {
      const styles = getDecisionStyles(round.deskReview.decision);
      htmlContent += `
        <div class="decision-box" style="border-left-color: ${styles.border}; background: ${styles.bg};">
          <div class="decision-title" style="color: ${styles.text};">${isSpanish ? 'Desk Review' : 'Desk Review'}</div>
          ${round.deskReview.decision ? `<div class="decision-value" style="background: ${styles.bg}; color: ${styles.text}; border: 1px solid ${styles.border};">${translateDecision(round.deskReview.decision, isSpanish)}</div>` : ''}
          ${round.deskReview.feedback ? `<p>${cleanHtml(round.deskReview.feedback)}</p>` : ''}
        </div>
      `;
    }
    
    // Decisión Final
    if (round.finalDecision) {
      const styles = getDecisionStyles(round.finalDecision.decision);
      htmlContent += `
        <div class="decision-box" style="border-left-color: ${styles.border}; background: ${styles.bg};">
          <div class="decision-title" style="color: ${styles.text};">${isSpanish ? 'Decisión Final' : 'Final Decision'}</div>
          ${round.finalDecision.decision ? `<div class="decision-value" style="background: ${styles.bg}; color: ${styles.text}; border: 1px solid ${styles.border};">${translateDecision(round.finalDecision.decision, isSpanish)}</div>` : ''}
          ${round.finalDecision.feedback ? `<p>${cleanHtml(round.finalDecision.feedback)}</p>` : ''}
        </div>
      `;
    }
    
    // Revisiones de pares
    roundPeerReviews.forEach((review, idx) => {
      htmlContent += `
        <div class="review-box">
          <div class="decision-title" style="color: #0ea5e9;">${isSpanish ? 'Revisión de Pares' : 'Peer Review'} ${idx + 1}</div>
          <p><strong>${isSpanish ? 'Revisor' : 'Reviewer'}:</strong> ${review.reviewerName || '—'}</p>
          ${review.reviewerEmail ? `<p><strong>Email:</strong> ${review.reviewerEmail}</p>` : ''}
          ${review.recommendation ? `<p><strong>${isSpanish ? 'Recomendación' : 'Recommendation'}:</strong> ${translateDecision(review.recommendation, isSpanish)}</p>` : ''}
          ${review.commentsToAuthor ? `<p><strong>${isSpanish ? 'Comentarios al Autor' : 'Comments to Author'}:</strong> ${cleanHtml(review.commentsToAuthor)}</p>` : ''}
          ${review.commentsToEditor ? `<p><strong>${isSpanish ? 'Comentarios al Editor' : 'Comments to Editor'}:</strong> ${cleanHtml(review.commentsToEditor)}</p>` : ''}
        </div>
      `;
    });
    
    // Propuestas de metadatos
    roundProposals.forEach((proposal, idx) => {
      htmlContent += `
        <div class="proposal-box">
          <div class="decision-title" style="color: #6366f1;">${isSpanish ? 'Propuesta de Metadatos' : 'Metadata Proposal'} ${idx + 1}</div>
          <p><strong>${isSpanish ? 'Propuesto por' : 'Proposed by'}:</strong> ${proposal.proposedByEmail || '—'}</p>
          <p><strong>${isSpanish ? 'Estado' : 'Status'}:</strong> ${proposal.status || '—'}</p>
          ${proposal.changes ? `<p><strong>${isSpanish ? 'Campos' : 'Fields'}:</strong> ${proposal.changes.map(c => c.field).join(', ')}</p>` : ''}
        </div>
      `;
    });
    
    // Registro de actividad
    roundLogs.forEach(log => {
      htmlContent += `
        <div class="log-item">
          <div>
            <span class="log-action">${translateAction(log.action, isSpanish)}</span>
            <span class="log-date"> - ${formatDate(log.timestamp, isSpanish)}</span>
          </div>
          <div class="log-data">${JSON.stringify(log, null, 2).replace(/</g, '&lt;')}</div>
        </div>
      `;
    });
  });

  htmlContent += `
      <div class="footer-note">
        ${isSpanish ? 'Documento generado automáticamente por el sistema editorial' : 'Document automatically generated by the editorial system'}
      </div>
    </body></html>
  `;

  const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
  saveAs(blob, `historial_${submissionTitle || 'submission'}.doc`);
};

// ============ EXPORTAR A JSON ============
const exportToJSON = (auditLogs, rounds, peerReviews, metadataProposals, submissionTitle, isSpanish) => {
  const exportData = {
    metadata: {
      title: submissionTitle || '',
      exportedAt: new Date().toISOString(),
      language: isSpanish ? 'es' : 'en',
      version: '2.0',
    },
    statistics: {
      totalRounds: rounds.length,
      totalEvents: auditLogs.length,
      totalPeerReviews: peerReviews.length,
      totalMetadataProposals: metadataProposals.length,
    },
    rounds: rounds.map(round => ({
      roundNumber: round.roundNumber,
      status: round.status,
      deskReview: round.deskReview || null,
      finalDecision: round.finalDecision || null,
      peerReviews: peerReviews
        .filter(r => r.round === round.roundNumber)
        .map(review => ({
          reviewerName: review.reviewerName,
          reviewerEmail: review.reviewerEmail,
          recommendation: review.recommendation,
          scores: review.scores || {},
          commentsToAuthor: review.commentsToAuthor || '',
          commentsToEditor: review.commentsToEditor || '',
          submittedAt: review.submittedAt?.toDate?.() || review.submittedAt || null,
        })),
      metadataProposals: metadataProposals
        .filter(p => p.round === round.roundNumber)
        .map(proposal => ({
          proposedBy: proposal.proposedBy,
          proposedByEmail: proposal.proposedByEmail,
          proposedAt: proposal.proposedAt?.toDate?.() || proposal.proposedAt || null,
          status: proposal.status,
          changes: proposal.changes || [],
          authorResponse: proposal.authorResponse ? {
            accepted: proposal.authorResponse.accepted,
            comments: proposal.authorResponse.comments || '',
            respondedBy: proposal.authorResponse.respondedBy,
            respondedByEmail: proposal.authorResponse.respondedByEmail,
            respondedAt: proposal.authorResponse.respondedAt?.toDate?.() || proposal.authorResponse.respondedAt || null,
          } : null,
        })),
      auditLogs: auditLogs
        .filter(log => log.round === round.roundNumber || (log.round === undefined && round.roundNumber === 1))
        .map(log => ({
          ...log,
          timestamp: log.timestamp?.toDate?.() || log.timestamp || null,
        })),
    })),
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  saveAs(blob, `historial_${submissionTitle || 'submission'}.json`);
};

// ============ COMPONENTE: TARJETA DE REVISOR ============
const ReviewerFeedbackCard = ({ review, index, isSpanish }) => {
  const [expanded, setExpanded] = useState(false);
  
  const recommendationColors = {
    'accept': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'minor-revisions': 'bg-sky-50 text-sky-700 border-sky-200',
    'major-revisions': 'bg-amber-50 text-amber-700 border-amber-200',
    'reject': 'bg-red-50 text-red-700 border-red-200',
  };
  
  return (
    <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden mb-3 transition-shadow hover:shadow-md">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="w-10 h-10 bg-[#002147] text-white rounded flex items-center justify-center font-serif text-base font-bold flex-shrink-0 shadow-inner">
            {review.reviewerName?.charAt(0) || `R${index + 1}`}
          </div>
          <div className="text-left flex-1 min-w-0">
            <span className="font-serif font-bold text-[#002147] text-sm block truncate">
              {review.reviewerName || `${isSpanish ? 'Revisor' : 'Reviewer'} ${index + 1}`}
            </span>
            {review.reviewerEmail && (
              <span className="text-xs text-slate-500 font-mono block truncate">
                {review.reviewerEmail}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {review.recommendation && (
            <span className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest border ${recommendationColors[review.recommendation] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
              {translateDecision(review.recommendation, isSpanish)}
            </span>
          )}
          <div className="text-slate-400">
            {expanded ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
          </div>
        </div>
      </button>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-100 p-6 space-y-6 bg-slate-50">
              
              {review.scores && Object.keys(review.scores).length > 0 && (
                <div>
                  <label className="text-[10px] font-sans font-bold uppercase tracking-widest text-[#FF6C0C] mb-3 block border-b border-slate-200 pb-1">
                    {isSpanish ? 'Rúbrica Cuantitativa' : 'Quantitative Rubric'}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(review.scores).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between bg-white px-4 py-2.5 rounded border border-slate-200 shadow-sm">
                        <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">{key}</span>
                        <span className="text-sm font-bold text-[#002147] bg-slate-100 px-2 py-0.5 rounded">{value}/5</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {review.commentsToAuthor && (
                <div>
                  <label className="text-[10px] font-sans font-bold uppercase tracking-widest text-[#FF6C0C] mb-3 block border-b border-slate-200 pb-1 flex items-center gap-1.5">
                    <Icons.Message />
                    {isSpanish ? 'Comentarios al Autor' : 'Comments to Author'}
                  </label>
                  <div 
                    className="review-content ql-editor read-only prose prose-sm max-w-none font-serif text-slate-700 leading-relaxed bg-white p-5 rounded border border-slate-200 shadow-sm"
                    dangerouslySetInnerHTML={{ __html: review.commentsToAuthor }}
                  />
                </div>
              )}
              
              {review.commentsToEditor && (
                <div>
                  <label className="text-[10px] font-sans font-bold uppercase tracking-widest text-amber-600 mb-3 block border-b border-amber-200 pb-1 flex items-center gap-1.5">
                    <Icons.Lock />
                    {isSpanish ? 'Comentarios Confidenciales al Editor' : 'Confidential Comments to Editor'}
                  </label>
                  <div 
                    className="review-content ql-editor read-only prose prose-sm max-w-none font-serif text-amber-900 leading-relaxed bg-[#fff9ed] p-5 rounded border border-amber-200 shadow-sm"
                    dangerouslySetInnerHTML={{ __html: review.commentsToEditor }}
                  />
                </div>
              )}
              
              <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
                {review.reviewerFileUrl ? (
                  <a
                    href={review.reviewerFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white bg-[#002147] hover:bg-[#00152e] px-4 py-2 rounded transition-colors"
                  >
                    <Icons.File />
                    {isSpanish ? 'Ver Documento del Revisor' : 'View Reviewer File'}
                    <Icons.ExternalLink />
                  </a>
                ) : <span />}
                
                {review.submittedAt && (
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                    <Icons.Calendar />
                    {formatDate(review.submittedAt, isSpanish)}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============ COMPONENTE: DESK REVIEW ============
const DeskReviewCard = ({ deskReview, isSpanish }) => {
  const [expanded, setExpanded] = useState(true);
  
  return (
    <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-100 text-[#002147] border-b border-slate-200 hover:bg-slate-200 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icons.ClipboardCheck className="w-5 h-5 text-[#FF6C0C]" />
          <span className="font-sans font-bold text-sm uppercase tracking-widest">
            {isSpanish ? 'Desk Review (Evaluación Inicial)' : 'Desk Review'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {deskReview.decision && (
            <span className="px-3 py-1 bg-white text-[#002147] text-[10px] font-bold uppercase tracking-widest rounded border border-slate-300">
              {translateDecision(deskReview.decision, isSpanish)}
            </span>
          )}
          <div className="text-slate-500">
            {expanded ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
          </div>
        </div>
      </button>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="p-6 space-y-5">
              {deskReview.feedback && (
                <div>
                  <label className="text-[10px] font-sans font-bold uppercase tracking-widest text-[#FF6C0C] mb-2 block">
                    {isSpanish ? 'Retroalimentación al Autor' : 'Feedback to Author'}
                  </label>
                  <div 
                    className="review-content ql-editor read-only prose prose-sm max-w-none font-serif text-slate-800 leading-relaxed bg-slate-50 p-4 rounded border border-slate-200"
                    dangerouslySetInnerHTML={{ __html: deskReview.feedback }}
                  />
                </div>
              )}
              
              {deskReview.commentsToEditorial && (
                <div>
                  <label className="text-[10px] font-sans font-bold uppercase tracking-widest text-slate-500 mb-2 block flex items-center gap-1.5">
                    <Icons.Lock />
                    {isSpanish ? 'Notas Internas' : 'Internal Notes'}
                  </label>
                  <div 
                    className="review-content ql-editor read-only prose prose-sm max-w-none font-serif text-slate-600 leading-relaxed bg-slate-100 p-4 rounded border border-slate-200"
                    dangerouslySetInnerHTML={{ __html: deskReview.commentsToEditorial }}
                  />
                </div>
              )}
              
              {deskReview.editorName && (
                <div className="flex items-center gap-2 text-xs font-mono text-slate-500 pt-3 border-t border-slate-100">
                  <Icons.User />
                  {isSpanish ? 'Editor Asignado:' : 'Assigned Editor:'} {deskReview.editorName}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============ COMPONENTE: FINAL DECISION ============
const FinalDecisionCard = ({ decisionData, isSpanish }) => {
  const isAccepted = decisionData.decision === 'accept';
  
  return (
    <div className={`rounded border-2 shadow-sm overflow-hidden mb-6 ${isAccepted ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-[#FF6C0C]'}`}>
      <div className={`px-5 py-4 ${isAccepted ? 'bg-emerald-600' : 'bg-[#FF6C0C]'} text-white flex justify-between items-center`}>
        <div className="flex items-center gap-3">
          <Icons.Gavel className="w-5 h-5" />
          <span className="font-sans font-bold text-sm uppercase tracking-widest">
            {isSpanish ? 'Decisión Final Editorial' : 'Final Editorial Decision'}
          </span>
        </div>
        <span className="px-3 py-1 bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-widest rounded shadow-sm border border-white/30">
          {translateDecision(decisionData.decision, isSpanish)}
        </span>
      </div>
      
      <div className="p-6">
        {decisionData.feedback && (
          <div>
            <label className={`text-[10px] font-sans font-bold uppercase tracking-widest mb-2 block ${isAccepted ? 'text-emerald-700' : 'text-[#FF6C0C]'}`}>
              {isSpanish ? 'Resolución al Autor' : 'Resolution to Author'}
            </label>
            <div 
              className="review-content ql-editor read-only prose prose-sm max-w-none font-serif text-slate-800 leading-relaxed bg-white p-5 rounded border border-slate-200 shadow-sm"
              dangerouslySetInnerHTML={{ __html: decisionData.feedback }}
            />
          </div>
        )}
        
        {decisionData.editorName && (
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 pt-4 mt-4 border-t border-slate-200">
            <Icons.User />
            {isSpanish ? 'Emitido por:' : 'Issued by:'} {decisionData.editorName}
          </div>
        )}
      </div>
    </div>
  );
};

// ============ COMPONENTE: PROPUESTA DE METADATOS ============
const MetadataProposalCard = ({ proposal, isSpanish }) => {
  const [expanded, setExpanded] = useState(false);
  
  const statusColors = {
    'approved': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: isSpanish ? 'Aprobada' : 'Approved' },
    'rejected': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: isSpanish ? 'Rechazada' : 'Rejected' },
    'pending-author': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: isSpanish ? 'Pendiente del Autor' : 'Pending Author' },
  };
  
  const status = statusColors[proposal.status] || { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', label: proposal.status };
  
  return (
    <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 bg-[#002147] text-white rounded flex items-center justify-center flex-shrink-0">
            <Icons.Tag className="w-4 h-4" />
          </div>
          <div className="text-left flex-1 min-w-0">
            <span className="font-serif font-bold text-[#002147] text-sm block">
              {isSpanish ? 'Propuesta de Metadatos' : 'Metadata Proposal'}
            </span>
            {proposal.proposedAt && (
              <span className="text-xs text-slate-500 font-mono block">
                {formatDate(proposal.proposedAt, isSpanish)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest border ${status.bg} ${status.text} ${status.border}`}>
            {status.label}
          </span>
          <div className="text-slate-400">
            {expanded ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
          </div>
        </div>
      </button>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-100 p-6 space-y-6 bg-slate-50">
              
              {proposal.proposedByEmail && (
                <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                  <Icons.User />
                  {isSpanish ? 'Propuesto por:' : 'Proposed by:'} {proposal.proposedByEmail}
                </div>
              )}
              
              {proposal.changes && proposal.changes.map((change, idx) => (
                <div key={idx} className="bg-white rounded border border-slate-200 p-4 shadow-sm">
                  <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider rounded mb-3">
                    {change.field}
                  </span>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-rose-50/50 p-3 rounded border border-rose-100/50">
                      <p className="text-[10px] font-bold text-rose-700/70 uppercase tracking-wider mb-1.5">
                        {isSpanish ? 'Original' : 'Original'}
                      </p>
                      <div className="text-sm font-serif text-slate-500 line-through break-words">
                        {typeof change.currentValue === 'object' 
                          ? JSON.stringify(change.currentValue) 
                          : String(change.currentValue)}
                      </div>
                    </div>
                    <div className="bg-emerald-50/50 p-3 rounded border border-emerald-100/50">
                      <p className="text-[10px] font-bold text-emerald-700/70 uppercase tracking-wider mb-1.5">
                        {isSpanish ? 'Propuesto' : 'Proposed'}
                      </p>
                      <div className="text-sm font-serif text-slate-800 font-medium break-words">
                        {typeof change.proposedValue === 'object' 
                          ? JSON.stringify(change.proposedValue) 
                          : String(change.proposedValue)}
                      </div>
                    </div>
                  </div>
                  
                  {change.reason && (
                    <p className="text-xs text-slate-500 mt-3 font-sans italic border-l-2 border-slate-200 pl-2">
                      "{change.reason}"
                    </p>
                  )}
                </div>
              ))}
              
              {proposal.authorResponse && (
                <div className="bg-white rounded border border-slate-200 p-4 shadow-sm">
                  <label className="text-[10px] font-sans font-bold uppercase tracking-widest text-slate-500 mb-3 block">
                    {isSpanish ? 'Respuesta del Autor' : 'Author Response'}
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                      proposal.authorResponse.accepted 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {proposal.authorResponse.accepted 
                        ? (isSpanish ? 'Aceptada' : 'Accepted') 
                        : (isSpanish ? 'Rechazada' : 'Rejected')}
                    </span>
                    {proposal.authorResponse.respondedByEmail && (
                      <span className="text-xs font-mono text-slate-500">
                        {proposal.authorResponse.respondedByEmail}
                      </span>
                    )}
                  </div>
                  {proposal.authorResponse.comments && (
                    <p className="text-sm font-serif text-slate-600">
                      "{proposal.authorResponse.comments}"
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============ COMPONENTE: RONDA ============
const RoundCard = ({ roundNumber, roundData, isCurrentRound, isSpanish, auditLogs, versions, peerReviews, metadataProposals }) => {
  const [expanded, setExpanded] = useState(isCurrentRound);
  
  const roundLogs = auditLogs.filter(log => log.round === roundNumber || (log.round === undefined && roundNumber === 1));
  const roundVersions = versions.filter(v => v.round === roundNumber);
  const roundPeerReviews = peerReviews.filter(r => r.round === roundNumber);
  const roundMetadataProposals = metadataProposals.filter(p => p.round === roundNumber);
  
  return (
    <div className={`bg-white rounded border shadow-sm mb-6 overflow-hidden ${isCurrentRound ? 'border-l-4 border-[#FF6C0C] border-y-slate-200 border-r-slate-200' : 'border-slate-200'}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 sm:px-8 py-5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded flex items-center justify-center font-serif font-bold text-lg shadow-inner ${
            isCurrentRound ? 'bg-[#002147] text-white' : 'bg-slate-100 text-[#002147]'
          }`}>
            R{roundNumber}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <span className="font-serif font-bold text-[#002147] text-lg sm:text-xl">
                {isSpanish ? 'Ronda' : 'Round'} {roundNumber}
              </span>
              {isCurrentRound && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#FF6C0C] text-white text-[10px] font-bold uppercase tracking-widest rounded">
                  <Icons.Clock />
                  {isSpanish ? 'Fase Actual' : 'Current Phase'}
                </span>
              )}
            </div>
            <span className="text-xs text-slate-500 font-sans tracking-wide uppercase">
              {roundLogs.length} {isSpanish ? 'eventos' : 'events'}
              {roundVersions.length > 0 && ` • ${roundVersions.length} ${isSpanish ? 'versiones' : 'versions'}`}
              {roundPeerReviews.length > 0 && ` • ${roundPeerReviews.length} ${isSpanish ? 'revisiones' : 'reviews'}`}
              {roundMetadataProposals.length > 0 && ` • ${roundMetadataProposals.length} ${isSpanish ? 'propuestas' : 'proposals'}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {roundData.status && (
            <span className="px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest bg-slate-100 text-slate-600 border border-slate-200 hidden sm:inline-block">
              {roundData.status}
            </span>
          )}
          <div className={`p-2 rounded-full ${expanded ? 'bg-slate-100' : ''}`}>
            {expanded ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-200 p-5 sm:p-8 space-y-10 bg-slate-50/50">
              
              {/* DESK REVIEW */}
              {roundData.deskReview && (
                <DeskReviewCard deskReview={roundData.deskReview} isSpanish={isSpanish} />
              )}

              {/* REVISIONES DE PARES */}
              {roundPeerReviews.length > 0 && (
                <div>
                  <h4 className="font-sans font-bold text-[#002147] text-sm uppercase tracking-widest border-b-2 border-[#FF6C0C] pb-2 mb-4 inline-block">
                    {isSpanish ? 'Revisiones de Pares' : 'Peer Reviews'}
                  </h4>
                  <div className="space-y-4">
                    {roundPeerReviews.map((review, idx) => (
                      <ReviewerFeedbackCard
                        key={review.id || idx}
                        review={review}
                        index={idx}
                        isSpanish={isSpanish}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* DECISIÓN FINAL */}
              {roundData.finalDecision && (
                <FinalDecisionCard decisionData={roundData.finalDecision} isSpanish={isSpanish} />
              )}

              {/* PROPUESTAS DE METADATOS */}
              {roundMetadataProposals.length > 0 && (
                <div>
                  <h4 className="font-sans font-bold text-[#002147] text-sm uppercase tracking-widest border-b-2 border-slate-300 pb-2 mb-4 inline-block">
                    {isSpanish ? 'Propuestas de Metadatos' : 'Metadata Proposals'}
                  </h4>
                  <div className="space-y-4">
                    {roundMetadataProposals.map((proposal, idx) => (
                      <MetadataProposalCard
                        key={proposal.id || idx}
                        proposal={proposal}
                        isSpanish={isSpanish}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* VERSIONES */}
              {roundVersions.length > 0 && (
                <div>
                  <h4 className="font-sans font-bold text-[#002147] text-sm uppercase tracking-widest border-b-2 border-[#002147] pb-2 mb-4 inline-block">
                    {isSpanish ? 'Versiones del Manuscrito' : 'Manuscript Versions'}
                  </h4>
                  <div className="space-y-3">
                    {roundVersions.map((version, idx) => (
                      <div key={version.id || idx} className="bg-white rounded p-4 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 text-[#002147]">
                            <Icons.File />
                          </div>
                          <div>
                            <span className="text-sm font-sans font-bold text-[#002147] block">
                              {version.fileName || `Versión ${idx + 1}`}
                            </span>
                            {version.notes && (
                              <span className="text-sm text-slate-600 font-serif mt-1 block">
                                {version.notes.substring(0, 100)}{version.notes.length > 100 ? '...' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        {version.fileUrl && (
                          <a
                            href={version.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 text-[10px] font-bold uppercase tracking-widest text-[#FF6C0C] border border-[#FF6C0C] hover:bg-[#FF6C0C] hover:text-white px-4 py-2 rounded transition-colors self-start sm:self-center"
                          >
                            {isSpanish ? 'Descargar PDF' : 'Download PDF'}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* REGISTRO DE ACTIVIDAD */}
              {roundLogs.length > 0 && (
                <div>
                  <h4 className="font-sans font-bold text-slate-600 text-sm uppercase tracking-widest border-b border-slate-200 pb-2 mb-4 flex items-center gap-2">
                    <Icons.Activity />
                    {isSpanish ? 'Registro de Actividad' : 'Activity Log'}
                  </h4>
                  <div className="bg-white border border-slate-200 rounded shadow-sm divide-y divide-slate-100">
                    {roundLogs
                      .sort((a, b) => {
                        const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
                        const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
                        return dateB - dateA;
                      })
                      .map((log, idx) => (
                        <div key={idx} className="px-5 py-3">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                            <span className="font-mono text-xs text-slate-400 w-32 flex-shrink-0">
                              {formatDate(log.timestamp, isSpanish)}
                            </span>
                            <span className="font-sans text-sm font-bold text-[#002147] flex-1">
                              {translateAction(log.action, isSpanish)}
                            </span>
                            <span className="font-sans text-xs text-slate-500">
                              {log.byEmail || log.by || (isSpanish ? 'Sistema' : 'System')}
                            </span>
                          </div>
                          <LogStructureViewer log={log} isSpanish={isSpanish} />
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============ COMPONENTE PRINCIPAL ============
export const ReviewHistoryTab = ({ submissionId, currentRound, submissionTitle, isSpanish }) => {
  const [rounds, setRounds] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [versions, setVersions] = useState([]);
  const [peerReviews, setPeerReviews] = useState([]);
  const [metadataProposals, setMetadataProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const loadHistory = async () => {
      if (!submissionId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Cargar editorialTasks
        const tasksQuery = query(
          collection(db, 'editorialTasks'),
          where('submissionId', '==', submissionId),
          orderBy('round', 'asc')
        );
        const tasksSnapshot = await getDocs(tasksQuery);

        // Cargar reviewerAssignments (PEER REVIEWS)
        const assignmentsQuery = query(
          collection(db, 'reviewerAssignments'),
          where('submissionId', '==', submissionId),
          where('status', '==', 'submitted')
        );
        const assignmentsSnapshot = await getDocs(assignmentsQuery);
        
        const peerReviewsData = [];
        assignmentsSnapshot.forEach((doc) => {
          const data = doc.data();
          peerReviewsData.push({
            id: doc.id,
            reviewerName: data.reviewerName || '',
            reviewerEmail: data.reviewerEmail || '',
            commentsToAuthor: data.commentsToAuthor || '',
            commentsToEditor: data.commentsToEditor || '',
            recommendation: data.recommendation || '',
            scores: data.scores || {},
            reviewerFileUrl: data.reviewerFileUrl || '',
            round: data.round || 1,
            submittedAt: data.submittedAt || null,
          });
        });
        setPeerReviews(peerReviewsData);

        // Cargar auditLogs (subcollection)
        const auditLogsQuery = query(
          collection(db, 'submissions', submissionId, 'auditLogs'),
          orderBy('timestamp', 'asc')
        );
        const auditLogsSnapshot = await getDocs(auditLogsQuery);
        const logs = [];
        auditLogsSnapshot.forEach((doc) => logs.push({ id: doc.id, ...doc.data() }));
        setAuditLogs(logs);

        // Cargar versiones (subcollection)
        const versionsQuery = query(
          collection(db, 'submissions', submissionId, 'versions'),
          orderBy('uploadedAt', 'asc')
        );
        const versionsSnapshot = await getDocs(versionsQuery);
        const versionsData = [];
        versionsSnapshot.forEach((doc) => {
          const data = doc.data();
          versionsData.push({ id: doc.id, ...data, round: data.round || 1 });
        });
        setVersions(versionsData);

        // Cargar metadataProposals (subcollection)
        let metadataProposalsData = [];
        try {
          const metadataProposalsQuery = query(
            collection(db, 'submissions', submissionId, 'metadataProposals'),
            orderBy('proposedAt', 'desc')
          );
          const metadataProposalsSnapshot = await getDocs(metadataProposalsQuery);
          metadataProposalsSnapshot.forEach((doc) => {
            const data = doc.data();
            metadataProposalsData.push({
              id: doc.id,
              ...data,
              round: data.round || 1,
              proposedAt: data.proposedAt || null,
            });
          });
        } catch (err) {
          console.log('No metadataProposals collection found');
        }
        setMetadataProposals(metadataProposalsData);

        // Cargar roundHistory (subcollection)
        let roundHistoryData = {};
        try {
          const roundHistorySnapshot = await getDocs(
            collection(db, 'submissions', submissionId, 'roundHistory')
          );
          roundHistorySnapshot.forEach((doc) => {
            roundHistoryData[doc.id] = doc.data();
          });
        } catch (err) {
          console.log('No roundHistory collection found');
        }

        // Organizar rondas
        const roundsMap = new Map();

        // Procesar editorialTasks
        tasksSnapshot.forEach((doc) => {
          const data = doc.data();
          const round = data.round || 1;
          
          if (!roundsMap.has(round)) {
            roundsMap.set(round, {
              roundNumber: round,
              status: data.status || 'pending',
              deskReview: null,
              finalDecision: null,
            });
          }
          
          const roundData = roundsMap.get(round);
          
          if (data.deskReviewDecision || data.deskReviewFeedback || data.deskReviewComments) {
            roundData.deskReview = {
              decision: data.deskReviewDecision || null,
              feedback: data.deskReviewFeedback || null,
              commentsToEditorial: data.deskReviewComments || null,
              editorName: data.assignedToName || null,
            };
          }
          
          if (data.finalDecision || data.finalDecisionFeedback) {
            roundData.finalDecision = {
              decision: data.finalDecision || null,
              feedback: data.finalDecisionFeedback || null,
              editorName: data.assignedToName || null,
            };
          }
        });

        // Procesar roundHistory para completar datos
        Object.entries(roundHistoryData).forEach(([docId, historyData]) => {
          const roundMatch = docId.match(/round_(\d+)/);
          if (roundMatch) {
            const roundNumber = parseInt(roundMatch[1]);
            if (!roundsMap.has(roundNumber)) {
              roundsMap.set(roundNumber, {
                roundNumber,
                status: 'completed',
                deskReview: null,
                finalDecision: null,
              });
            }
            
            const roundData = roundsMap.get(roundNumber);
            
            if (!roundData.deskReview && (historyData.deskReviewFeedback || historyData.deskReviewDecision)) {
              roundData.deskReview = {
                decision: historyData.deskReviewDecision || null,
                feedback: historyData.deskReviewFeedback || null,
                commentsToEditorial: historyData.deskReviewComments || null,
                editorName: historyData.deskReviewEditor || null,
              };
            }
            
            if (historyData.finalDecision || historyData.finalDecisionFeedback || historyData.finalFeedback) {
              roundData.finalDecision = {
                decision: historyData.finalDecision || historyData.decision || null,
                feedback: historyData.finalDecisionFeedback || historyData.finalFeedback || historyData.feedback || null,
                editorName: historyData.finalEditor || historyData.editorName || historyData.deskReviewEditor || null,
              };
            }
          }
        });

        if (roundsMap.size === 0) {
          roundsMap.set(1, { roundNumber: 1, status: 'active', deskReview: null, finalDecision: null });
        }

        setRounds(Array.from(roundsMap.values()).sort((a, b) => a.roundNumber - b.roundNumber));
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
      <div className="flex items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-t-[#FF6C0C] border-slate-200 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-600 text-red-800 px-6 py-4 rounded shadow-sm font-sans text-sm font-medium">
        <strong className="block font-bold mb-1">{isSpanish ? 'Error del Sistema' : 'System Error'}</strong>
        {isSpanish ? 'No se pudo cargar el historial: ' : 'Could not load history: '} {error}
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 max-w-6xl mx-auto">
      {/* Header Dashboard Premium */}
      <div className="bg-[#002147] text-white rounded-lg p-6 sm:p-8 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="bg-[#00152e] p-3 rounded-lg border border-[#003b5c]">
              <Icons.ClipboardCheck className="w-8 h-8 text-[#FF6C0C]" />
            </div>
            <div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight mb-1">
                {isSpanish ? 'Historial de Revisión' : 'Review History'}
              </h2>
              <p className="text-slate-400 text-sm font-sans max-w-xl">
                {submissionTitle || submissionId}
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => exportToPDF(auditLogs, rounds, peerReviews, metadataProposals, submissionTitle, isSpanish)} 
              className="flex items-center gap-2 bg-transparent border border-slate-500 hover:border-white hover:bg-white hover:text-[#002147] text-white px-3 py-2 rounded transition-all text-xs font-bold uppercase tracking-widest shadow-sm"
            >
              <Icons.FilePdf /> PDF
            </button>
            <button 
              onClick={() => exportToWord(auditLogs, rounds, peerReviews, metadataProposals, submissionTitle, isSpanish)} 
              className="flex items-center gap-2 bg-transparent border border-slate-500 hover:border-white hover:bg-white hover:text-[#002147] text-white px-3 py-2 rounded transition-all text-xs font-bold uppercase tracking-widest shadow-sm"
            >
              <Icons.DocumentText /> Word
            </button>
            <button 
              onClick={() => exportToExcel(auditLogs, rounds, peerReviews, metadataProposals, submissionTitle, isSpanish)} 
              className="flex items-center gap-2 bg-transparent border border-slate-500 hover:border-white hover:bg-white hover:text-[#002147] text-white px-3 py-2 rounded transition-all text-xs font-bold uppercase tracking-widest shadow-sm"
            >
              <Icons.FileSpreadsheet /> Excel
            </button>
            <button 
              onClick={() => exportToCSV(auditLogs, rounds, peerReviews, metadataProposals, submissionTitle, isSpanish)} 
              className="flex items-center gap-2 bg-transparent border border-slate-500 hover:border-white hover:bg-white hover:text-[#002147] text-white px-3 py-2 rounded transition-all text-xs font-bold uppercase tracking-widest shadow-sm"
            >
              <Icons.Download /> CSV
            </button>
            <button 
              onClick={() => exportToJSON(auditLogs, rounds, peerReviews, metadataProposals, submissionTitle, isSpanish)} 
              className="flex items-center gap-2 bg-transparent border border-slate-500 hover:border-white hover:bg-white hover:text-[#002147] text-white px-3 py-2 rounded transition-all text-xs font-bold uppercase tracking-widest shadow-sm"
            >
              <Icons.Json /> JSON
            </button>
          </div>
        </div>
      </div>

      {/* Lista de rondas */}
      {rounds.length > 0 ? (
        <div className="space-y-6">
          {rounds.map((round) => (
            <RoundCard
              key={round.roundNumber}
              roundNumber={round.roundNumber}
              roundData={round}
              isCurrentRound={round.roundNumber === currentRound}
              isSpanish={isSpanish}
              auditLogs={auditLogs}
              versions={versions}
              peerReviews={peerReviews}
              metadataProposals={metadataProposals}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded border border-slate-200 shadow-sm">
          <Icons.DocumentText className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-500 font-serif text-lg">
            {isSpanish ? 'No se han registrado eventos de revisión aún.' : 'No review events have been recorded yet.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default ReviewHistoryTab;