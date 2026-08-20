// src/components/ReviewHistoryTab.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useLanguage } from '../hooks/useLanguage';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// ============ ICONOS SVG ============
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
  ChevronRight: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>,
  Code: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
  Tag: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>,
};

// ============ TRADUCCIONES ============
const translations = {
  es: {
    submissionCreated: 'Envío Creado',
    assignedToEditor: 'Asignado a Editor',
    peerReviewStarted: 'Revisión por Pares Iniciada',
    reviewSubmitted: 'Revisión Enviada',
    reviewAdded: 'Revisión Agregada',
    editorNotified: 'Editor Notificado',
    newRoundCreated: 'Nueva Ronda Creada',
    authorRevision: 'Revisión del Autor',
    readyToPublish: 'Listo para Publicar',
    metadataUpdated: 'Metadatos Actualizados',
    externalReviewerInvited: 'Revisor Externo Invitado',
    externalReviewerOnboarded: 'Revisor Externo Registrado',
    metadataChangesProposed: 'Cambios de Metadatos Propuestos',
    metadataProposalEmailSent: 'Email de Propuesta Enviado',
    metadataProposalResponseNotified: 'Respuesta de Propuesta Notificada',
    publicationReadyComplete: 'Publicación Completada',
    certificateGenerated: 'Certificado Generado',
    proceededToDecision: 'Procedió a Decisión',
    reviewerCopyCreated: 'Copia de Revisor Creada',
    additionalReviewerAccepted: 'Revisor Adicional Aceptado',
    date: 'Fecha',
    action: 'Acción',
    round: 'Ronda',
    performedBy: 'Realizado por',
    details: 'Detalles',
    recommendation: 'Recomendación',
    notes: 'Notas',
    file: 'Archivo',
    auditHistory: 'Historial de Auditoría',
    feedbackHistory: 'Historial de Retroalimentaciones',
    noHistory: 'No hay historial disponible',
    loading: 'Cargando historial...',
    error: 'Error al cargar el historial',
    current: 'Actual',
    events: 'eventos',
    versions: 'versiones',
    reviews: 'revisiones',
    deskReview: 'Desk Review',
    peerReviews: 'Revisiones de Pares',
    manuscriptVersions: 'Versiones del Manuscrito',
    activityLog: 'Registro de Actividad',
    roundTitle: 'Ronda',
    finalDecision: 'Decisión Final',
    feedbackToAuthor: 'Retroalimentación al Autor',
    internalNotes: 'Notas Internas',
    commentsToAuthor: 'Comentarios al Autor',
    confidentialComments: 'Comentarios Confidenciales al Editor',
    viewMarkedDocument: 'Ver documento marcado',
    quantitativeRubric: 'Rúbrica Cuantitativa',
    system: 'Sistema',
    export: 'Exportar',
    excel: 'Excel',
    pdf: 'PDF',
    word: 'Word',
    csv: 'CSV',
    fullLogDetails: 'Detalles completos del registro',
    rawData: 'Datos crudos',
    showRawData: 'Ver datos crudos',
    hideRawData: 'Ocultar datos crudos',
    logDetails: 'Detalles del Registro',
    accept: 'Aceptar',
    reject: 'Rechazar',
    minorRevision: 'Revisión Menor',
    minorRevisions: 'Revisiones Menores',
    majorRevision: 'Revisión Mayor',
    majorRevisions: 'Revisiones Mayores',
    revisionRequired: 'Enviar a Pares',
    performedByLabel: 'Realizado por',
    reviewerLabel: 'Revisor',
    nameLabel: 'Nombre',
    recommendationLabel: 'Recomendación',
  },
  en: {
    submissionCreated: 'Submission Created',
    assignedToEditor: 'Assigned to Editor',
    peerReviewStarted: 'Peer Review Started',
    reviewSubmitted: 'Review Submitted',
    reviewAdded: 'Review Added',
    editorNotified: 'Editor Notified',
    newRoundCreated: 'New Round Created',
    authorRevision: 'Author Revision',
    readyToPublish: 'Ready to Publish',
    metadataUpdated: 'Metadata Updated',
    externalReviewerInvited: 'External Reviewer Invited',
    externalReviewerOnboarded: 'External Reviewer Onboarded',
    metadataChangesProposed: 'Metadata Changes Proposed',
    metadataProposalEmailSent: 'Proposal Email Sent',
    metadataProposalResponseNotified: 'Proposal Response Notified',
    publicationReadyComplete: 'Publication Ready Complete',
    certificateGenerated: 'Certificate Generated',
    proceededToDecision: 'Proceeded to Decision',
    reviewerCopyCreated: 'Reviewer Copy Created',
    additionalReviewerAccepted: 'Additional Reviewer Accepted',
    date: 'Date',
    action: 'Action',
    round: 'Round',
    performedBy: 'Performed by',
    details: 'Details',
    recommendation: 'Recommendation',
    notes: 'Notes',
    file: 'File',
    auditHistory: 'Audit History',
    feedbackHistory: 'Feedback History',
    noHistory: 'No history available',
    loading: 'Loading history...',
    error: 'Error loading history',
    current: 'Current',
    events: 'events',
    versions: 'versions',
    reviews: 'reviews',
    deskReview: 'Desk Review',
    peerReviews: 'Peer Reviews',
    manuscriptVersions: 'Manuscript Versions',
    activityLog: 'Activity Log',
    roundTitle: 'Round',
    finalDecision: 'Final Decision',
    feedbackToAuthor: 'Feedback to Author',
    internalNotes: 'Internal Notes',
    commentsToAuthor: 'Comments to Author',
    confidentialComments: 'Confidential Comments to Editor',
    viewMarkedDocument: 'View marked document',
    quantitativeRubric: 'Quantitative Rubric',
    system: 'System',
    export: 'Export',
    excel: 'Excel',
    pdf: 'PDF',
    word: 'Word',
    csv: 'CSV',
    fullLogDetails: 'Full log details',
    rawData: 'Raw data',
    showRawData: 'Show raw data',
    hideRawData: 'Hide raw data',
    logDetails: 'Log Details',
    accept: 'Accept',
    reject: 'Reject',
    minorRevision: 'Minor Revision',
    minorRevisions: 'Minor Revisions',
    majorRevision: 'Major Revision',
    majorRevisions: 'Major Revisions',
    revisionRequired: 'Send to Review',
    performedByLabel: 'Performed by',
    reviewerLabel: 'Reviewer',
    nameLabel: 'Name',
    recommendationLabel: 'Recommendation',
  }
};

// ============ UTILIDADES DE TRADUCCIÓN ============
const translateAction = (action, isSpanish) => {
  const t = translations[isSpanish ? 'es' : 'en'];
  const actionMap = {
    'submission_created': t.submissionCreated,
    'assigned_to_section_editor': t.assignedToEditor,
    'peer_review_started': t.peerReviewStarted,
    'review_submitted': t.reviewSubmitted,
    'review_added_to_submission': t.reviewAdded,
    'editor_notified_new_round': t.editorNotified,
    'new_round_created_with_new_task': t.newRoundCreated,
    'revision_submitted': t.authorRevision,
    'marked_ready_for_publication': t.readyToPublish,
    'metadata_changes_applied': t.metadataUpdated,
    'external_reviewer_invited': t.externalReviewerInvited,
    'external_reviewer_onboarded': t.externalReviewerOnboarded,
    'metadata_changes_proposed': t.metadataChangesProposed,
    'metadata_proposal_email_sent': t.metadataProposalEmailSent,
    'metadata_proposal_response_notified': t.metadataProposalResponseNotified,
    'publication_ready_complete': t.publicationReadyComplete,
    'certificate_generated': t.certificateGenerated,
    'proceeded_to_decision': t.proceededToDecision,
    'reviewer_copy_created': t.reviewerCopyCreated,
    'additional_reviewer_accepted': t.additionalReviewerAccepted,
  };
  return actionMap[action] || action;
};

const translateDecision = (decision, isSpanish) => {
  const t = translations[isSpanish ? 'es' : 'en'];
  const decisionMap = {
    'accept': t.accept,
    'reject': t.reject,
    'minor-revision': t.minorRevision,
    'minor-revisions': t.minorRevisions,
    'major-revision': t.majorRevision,
    'major-revisions': t.majorRevisions,
    'revision-required': t.revisionRequired,
  };
  return decisionMap[decision] || decision || '—';
};

const formatDate = (timestamp, isSpanish) => {
  if (!timestamp) return '—';
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(isSpanish ? 'es-ES' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// ============ FUNCIÓN PARA NORMALIZAR CAMPOS DINÁMICOS ============
const normalizeLogFields = (log) => {
  const fields = {};
  
  Object.entries(log).forEach(([key, value]) => {
    if (key === 'id' || key === 'timestamp' || key === 'action' || key === 'round') return;
    
    if (value !== null && value !== undefined && value !== '') {
      if (typeof value === 'object' && !Array.isArray(value)) {
        // Si es un timestamp de Firebase
        if (value.seconds && value.nanoseconds !== undefined) {
          fields[key] = value;
        } else {
          // Objeto anidado
          fields[key] = value;
        }
      } else {
        fields[key] = value;
      }
    }
  });
  
  return fields;
};

// ============ FUNCIÓN PARA FORMATEAR VALORES ============
const formatValue = (value) => {
  if (value === null || value === undefined) return '—';
  
  if (typeof value === 'object') {
    // Timestamp de Firebase
    if (value.seconds && value.nanoseconds !== undefined) {
      const date = value.toDate();
      return date.toLocaleString();
    }
    
    // Array
    if (Array.isArray(value)) {
      if (value.length === 0) return '[]';
      return value.map((item, idx) => {
        if (typeof item === 'object') {
          return JSON.stringify(item, null, 2);
        }
        return String(item);
      }).join(', ');
    }
    
    // Objeto genérico
    return JSON.stringify(value, null, 2);
  }
  
  return String(value);
};

// ============ EXPORTACIONES ============
const exportToExcel = (allData, submissionTitle, isSpanish) => {
  const t = translations[isSpanish ? 'es' : 'en'];
  const data = [];
  
  allData.forEach(round => {
    // Exportar audit logs de la ronda
    round.auditLogs.forEach(log => {
      const row = {
        [t.round]: round.roundNumber,
        [t.date]: formatDate(log.timestamp, isSpanish),
        [t.action]: translateAction(log.action, isSpanish),
        [t.performedBy]: log.byEmail || log.by || t.system,
      };
      
      // Agregar todos los campos dinámicos
      const fields = normalizeLogFields(log);
      Object.entries(fields).forEach(([key, value]) => {
        row[key] = formatValue(value);
      });
      
      data.push(row);
    });
    
    // Exportar desk review
    if (round.deskReview) {
      const deskRow = {
        [t.round]: round.roundNumber,
        [t.action]: t.deskReview,
        [t.date]: formatDate(round.deskReview.completedAt, isSpanish),
      };
      Object.entries(round.deskReview).forEach(([key, value]) => {
        if (key !== 'completedAt') {
          deskRow[key] = formatValue(value);
        }
      });
      data.push(deskRow);
    }
    
    // Exportar decisión final
    if (round.finalDecision) {
      const finalRow = {
        [t.round]: round.roundNumber,
        [t.action]: t.finalDecision,
        [t.date]: formatDate(round.finalDecision.completedAt, isSpanish),
      };
      Object.entries(round.finalDecision).forEach(([key, value]) => {
        if (key !== 'completedAt') {
          finalRow[key] = formatValue(value);
        }
      });
      data.push(finalRow);
    }
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, isSpanish ? 'Historial' : 'History');
  
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `historial_${submissionTitle || 'submission'}.xlsx`);
};

const exportToPDF = (allData, submissionTitle, isSpanish) => {
  const t = translations[isSpanish ? 'es' : 'en'];
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPosition = margin;

  const checkPageBreak = (neededSpace) => {
    if (yPosition + neededSpace > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }
  };

  // Título
  doc.setFontSize(20);
  doc.setTextColor(0, 33, 71);
  doc.setFont('helvetica', 'bold');
  doc.text(t.auditHistory, margin, yPosition);
  yPosition += 8;
  
  if (submissionTitle) {
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text(submissionTitle, margin, yPosition);
    yPosition += 12;
  }

  allData.forEach(round => {
    checkPageBreak(30);
    
    // Encabezado de ronda
    doc.setFillColor(0, 33, 71);
    doc.rect(margin, yPosition - 6, pageWidth - 2 * margin, 10, 'F');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(`${t.roundTitle} ${round.roundNumber}`, margin + 5, yPosition + 1);
    yPosition += 15;
    
    // Desk Review
    if (round.deskReview) {
      checkPageBreak(20);
      doc.setFontSize(11);
      doc.setTextColor(0, 33, 71);
      doc.setFont('helvetica', 'bold');
      doc.text(t.deskReview, margin, yPosition);
      yPosition += 6;
      
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'normal');
      Object.entries(round.deskReview).forEach(([key, value]) => {
        checkPageBreak(10);
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        const formattedValue = formatValue(value).substring(0, 100);
        doc.text(`${label}: ${formattedValue}`, margin + 10, yPosition);
        yPosition += 5;
      });
      yPosition += 8;
    }
    
    // Decisión final
    if (round.finalDecision) {
      checkPageBreak(20);
      doc.setFontSize(11);
      doc.setTextColor(5, 150, 105);
      doc.setFont('helvetica', 'bold');
      doc.text(t.finalDecision, margin, yPosition);
      yPosition += 6;
      
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'normal');
      Object.entries(round.finalDecision).forEach(([key, value]) => {
        checkPageBreak(10);
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        const formattedValue = formatValue(value).substring(0, 100);
        doc.text(`${label}: ${formattedValue}`, margin + 10, yPosition);
        yPosition += 5;
      });
      yPosition += 8;
    }
    
    // Audit logs
    round.auditLogs.forEach(log => {
      checkPageBreak(30);
      
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.text(translateAction(log.action, isSpanish), margin, yPosition);
      
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.text(formatDate(log.timestamp, isSpanish), pageWidth - margin, yPosition, { align: 'right' });
      yPosition += 5;
      
      const fields = normalizeLogFields(log);
      Object.entries(fields).forEach(([key, value]) => {
        checkPageBreak(8);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.setFont('helvetica', 'bold');
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        doc.text(label.toUpperCase(), margin + 5, yPosition);
        
        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'normal');
        const valueStr = formatValue(value).substring(0, 80);
        doc.text(valueStr, margin + 50, yPosition);
        yPosition += 4;
      });
      
      yPosition += 6;
    });
    
    yPosition += 10;
  });

  // Pie de página
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`${i} / ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  doc.save(`historial_${submissionTitle || 'submission'}.pdf`);
};

const exportToCSV = (allData, submissionTitle, isSpanish) => {
  const t = translations[isSpanish ? 'es' : 'en'];
  const rows = [];
  
  allData.forEach(round => {
    round.auditLogs.forEach(log => {
      const row = {
        [t.round]: round.roundNumber,
        [t.date]: formatDate(log.timestamp, isSpanish),
        [t.action]: translateAction(log.action, isSpanish),
        [t.performedBy]: log.byEmail || log.by || t.system,
      };
      
      const fields = normalizeLogFields(log);
      Object.entries(fields).forEach(([key, value]) => {
        row[key] = formatValue(value);
      });
      
      rows.push(row);
    });
  });

  if (rows.length === 0) return;
  
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map(row => headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `historial_${submissionTitle || 'submission'}.csv`);
};

const exportToWord = (allData, submissionTitle, isSpanish) => {
  const t = translations[isSpanish ? 'es' : 'en'];
  
  let htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" 
          xmlns:w="urn:schemas-microsoft-com:office:word" 
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <title>${t.auditHistory}</title>
      <style>
        body { font-family: 'Georgia', serif; color: #1a202c; margin: 40px; }
        h1 { font-family: Arial, sans-serif; font-size: 24px; color: #002147; border-bottom: 3px solid #002147; padding-bottom: 10px; }
        .subtitle { color: #64748b; font-size: 12px; margin-bottom: 30px; }
        .round-header { font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; color: white; background: #002147; padding: 10px; margin-top: 20px; }
        .section { margin: 15px 0; padding: 10px; border-left: 4px solid #002147; background: #f8fafc; }
        .section-title { font-weight: bold; color: #002147; margin-bottom: 8px; }
        .log-item { margin: 10px 0; padding: 10px; border: 1px solid #e2e8f0; background: white; }
        .log-action { font-weight: bold; color: #1e293b; }
        .log-date { color: #64748b; font-size: 10px; float: right; }
        .field-row { display: flex; margin: 4px 0; }
        .field-label { font-weight: bold; color: #94a3b8; width: 150px; font-size: 10px; text-transform: uppercase; }
        .field-value { color: #334155; font-size: 11px; flex: 1; word-break: break-word; }
      </style>
    </head>
    <body>
      <h1>${t.auditHistory}</h1>
      ${submissionTitle ? `<div class="subtitle">${submissionTitle}</div>` : ''}
  `;

  allData.forEach(round => {
    htmlContent += `<div class="round-header">${t.roundTitle} ${round.roundNumber}</div>`;
    
    if (round.deskReview) {
      htmlContent += `
        <div class="section">
          <div class="section-title">${t.deskReview}</div>
          ${Object.entries(round.deskReview).map(([key, value]) => `
            <div class="field-row">
              <span class="field-label">${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</span>
              <span class="field-value">${formatValue(value)}</span>
            </div>
          `).join('')}
        </div>
      `;
    }
    
    if (round.finalDecision) {
      htmlContent += `
        <div class="section">
          <div class="section-title">${t.finalDecision}</div>
          ${Object.entries(round.finalDecision).map(([key, value]) => `
            <div class="field-row">
              <span class="field-label">${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</span>
              <span class="field-value">${formatValue(value)}</span>
            </div>
          `).join('')}
        </div>
      `;
    }
    
    round.auditLogs.forEach(log => {
      const fields = normalizeLogFields(log);
      htmlContent += `
        <div class="log-item">
          <div>
            <span class="log-action">${translateAction(log.action, isSpanish)}</span>
            <span class="log-date">${formatDate(log.timestamp, isSpanish)}</span>
          </div>
          ${Object.entries(fields).map(([key, value]) => `
            <div class="field-row">
              <span class="field-label">${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</span>
              <span class="field-value">${formatValue(value)}</span>
            </div>
          `).join('')}
        </div>
      `;
    });
  });

  htmlContent += '</body></html>';

  const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
  saveAs(blob, `historial_${submissionTitle || 'submission'}.doc`);
};

// ============ COMPONENTE: VISOR DE DATOS CRUDOS ============
const RawDataViewer = ({ data, isSpanish }) => {
  const [showRaw, setShowRaw] = useState(false);
  const t = translations[isSpanish ? 'es' : 'en'];
  
  return (
    <div className="mt-2">
      <button
        onClick={() => setShowRaw(!showRaw)}
        className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
      >
        <Icons.Code className="w-3 h-3" />
        {showRaw ? t.hideRawData : t.showRawData}
      </button>
      
      <AnimatePresence>
        {showRaw && (
          <motion.pre
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-2 p-3 bg-slate-900 text-slate-300 text-xs rounded-sm overflow-x-auto font-mono max-h-64 overflow-y-auto"
          >
            {JSON.stringify(data, null, 2)}
          </motion.pre>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============ COMPONENTE: TARJETA DE LOG DINÁMICO ============
const DynamicLogCard = ({ log, isSpanish }) => {
  const [expanded, setExpanded] = useState(false);
  const t = translations[isSpanish ? 'es' : 'en'];
  
  const fields = useMemo(() => normalizeLogFields(log), [log]);
  const fieldEntries = Object.entries(fields);
  
  // Determinar color según acción
  const actionColor = useMemo(() => {
    const action = log.action || '';
    if (action.includes('reject') || action.includes('desk')) return 'bg-red-50 border-red-200';
    if (action.includes('accept') || action.includes('complete') || action.includes('ready')) return 'bg-emerald-50 border-emerald-200';
    if (action.includes('review') || action.includes('revision')) return 'bg-sky-50 border-sky-200';
    if (action.includes('metadata')) return 'bg-purple-50 border-purple-200';
    if (action.includes('reviewer') || action.includes('assign')) return 'bg-amber-50 border-amber-200';
    return 'bg-white border-slate-200';
  }, [log.action]);
  
  const actionDotColor = useMemo(() => {
    const action = log.action || '';
    if (action.includes('reject') || action.includes('desk')) return 'bg-red-500';
    if (action.includes('accept') || action.includes('complete') || action.includes('ready')) return 'bg-emerald-500';
    if (action.includes('review') || action.includes('revision')) return 'bg-sky-500';
    if (action.includes('metadata')) return 'bg-purple-500';
    if (action.includes('reviewer') || action.includes('assign')) return 'bg-amber-500';
    return 'bg-slate-400';
  }, [log.action]);
  
  return (
    <div className={`border rounded-sm overflow-hidden ${actionColor} transition-all hover:shadow-sm`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/50 transition-colors"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${actionDotColor}`}></span>
          <span className="font-sans font-bold text-slate-700 text-xs sm:text-sm truncate">
            {translateAction(log.action, isSpanish)}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] text-slate-400 font-sans">
            {formatDate(log.timestamp, isSpanish)}
          </span>
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
            <div className="px-3 pb-3 pt-1 space-y-2">
              {fieldEntries.length > 0 ? (
                <div className="space-y-1.5">
                  {fieldEntries.map(([key, value]) => {
                    const isComplexValue = typeof value === 'object' && value !== null;
                    const displayValue = isComplexValue 
                      ? (Array.isArray(value) 
                          ? `${value.length} elemento(s)` 
                          : '{ objeto }')
                      : formatValue(value);
                    
                    return (
                      <div key={key} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 bg-white/60 rounded-sm px-2 py-1.5">
                        <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider sm:w-28 flex-shrink-0 pt-0.5">
                          {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </span>
                        <span className="text-xs text-slate-700 font-sans flex-1 break-words">
                          {isComplexValue ? (
                            <details>
                              <summary className="cursor-pointer text-slate-500 hover:text-slate-700 text-xs">
                                {displayValue}
                              </summary>
                              <pre className="mt-1 p-2 bg-slate-50 rounded-sm text-[10px] overflow-x-auto font-mono">
                                {JSON.stringify(value, null, 2)}
                              </pre>
                            </details>
                          ) : (
                            displayValue
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  {isSpanish ? 'Sin campos adicionales' : 'No additional fields'}
                </p>
              )}
              
              <RawDataViewer data={log} isSpanish={isSpanish} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============ COMPONENTE: TARJETA DE RONDA ============
const RoundCard = ({ roundNumber, roundData, isCurrentRound, isSpanish }) => {
  const [expanded, setExpanded] = useState(isCurrentRound);
  const t = translations[isSpanish ? 'es' : 'en'];
  
  const deskReview = roundData.deskReview;
  const finalDecision = roundData.finalDecision;
  const auditLogs = roundData.auditLogs || [];
  
  return (
    <div className={`bg-white rounded-sm border-2 shadow-sm mb-4 ${isCurrentRound ? 'border-[#002147]' : 'border-slate-200'}`}>
      {/* Encabezado de ronda */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 sm:px-5 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-serif font-bold text-sm ${
            isCurrentRound ? 'bg-[#002147] text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            R{roundNumber}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-serif font-bold text-slate-800 text-sm sm:text-base">
                {t.roundTitle} {roundNumber}
              </span>
              {isCurrentRound && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#002147] text-white text-[10px] font-bold uppercase tracking-wider rounded-full">
                  {t.current}
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400 font-sans">
              {auditLogs.length} {t.events}
              {deskReview && ` · Desk Review`}
              {finalDecision && ` · ${t.finalDecision}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {expanded ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
        </div>
      </button>

      {/* Contenido expandido */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-200 p-3 sm:p-5 space-y-4">
              
              {/* Desk Review */}
              {deskReview && (
                <div className="border border-[#002147]/20 rounded-sm overflow-hidden">
                  <div className="bg-[#002147] text-white px-3 py-2 flex items-center gap-2">
                    <Icons.ClipboardCheck className="w-4 h-4" />
                    <span className="font-serif font-bold text-xs uppercase tracking-wider">
                      {t.deskReview}
                    </span>
                  </div>
                  <div className="p-3 space-y-2 bg-slate-50/50">
                    {Object.entries(deskReview).map(([key, value]) => (
                      <div key={key} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
                        <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider sm:w-28 flex-shrink-0">
                          {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </span>
                        <span className="text-xs text-slate-700 flex-1">
                          {formatValue(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Decisión Final */}
              {finalDecision && (
                <div className="border border-emerald-200 rounded-sm overflow-hidden">
                  <div className="bg-emerald-600 text-white px-3 py-2 flex items-center gap-2">
                    <Icons.CheckCircle className="w-4 h-4" />
                    <span className="font-serif font-bold text-xs uppercase tracking-wider">
                      {t.finalDecision}
                    </span>
                  </div>
                  <div className="p-3 space-y-2 bg-emerald-50/50">
                    {Object.entries(finalDecision).map(([key, value]) => (
                      <div key={key} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
                        <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider sm:w-28 flex-shrink-0">
                          {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </span>
                        <span className="text-xs text-slate-700 flex-1">
                          {formatValue(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Audit Logs */}
              {auditLogs.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Icons.Activity className="w-4 h-4 text-slate-400" />
                    <h4 className="font-serif font-bold text-slate-700 text-xs uppercase tracking-wider">
                      {t.activityLog} ({auditLogs.length})
                    </h4>
                  </div>
                  <div className="space-y-1.5">
                    {auditLogs
                      .sort((a, b) => {
                        const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
                        const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
                        return dateB - dateA;
                      })
                      .map((log, idx) => (
                        <DynamicLogCard key={idx} log={log} isSpanish={isSpanish} />
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const t = translations[isSpanish ? 'es' : 'en'];
  
  useEffect(() => {
    const loadHistory = async () => {
      if (!submissionId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // 1. Cargar roundHistory (subcollection principal)
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

        // 2. Cargar auditLogs (subcollection)
        let auditLogsData = [];
        try {
          const auditLogsQuery = query(
            collection(db, 'submissions', submissionId, 'auditLogs'),
            orderBy('timestamp', 'asc')
          );
          const auditLogsSnapshot = await getDocs(auditLogsQuery);
          auditLogsSnapshot.forEach((doc) => {
            auditLogsData.push({ id: doc.id, ...doc.data() });
          });
        } catch (err) {
          console.log('No auditLogs collection found');
        }

        // 3. Organizar por rondas
        const roundsMap = new Map();

        // Función para obtener o crear ronda
        const getOrCreateRound = (roundNumber) => {
          if (!roundsMap.has(roundNumber)) {
            roundsMap.set(roundNumber, {
              roundNumber,
              deskReview: null,
              finalDecision: null,
              auditLogs: [],
            });
          }
          return roundsMap.get(roundNumber);
        };

        // Procesar roundHistory
        Object.entries(roundHistoryData).forEach(([docId, data]) => {
          const roundMatch = docId.match(/round_(\d+)/i);
          const roundNumber = roundMatch ? parseInt(roundMatch[1]) : (data.round || 1);
          const roundData = getOrCreateRound(roundNumber);
          
          // Desk Review
          if (data.deskReviewFeedback || data.deskReviewDecision || data.deskReviewComments) {
            roundData.deskReview = {
              feedback: data.deskReviewFeedback || data.deskReviewComments || null,
              decision: data.deskReviewDecision || null,
              editor: data.deskReviewEditor || null,
              completedAt: data.deskReviewCompletedAt || null,
            };
          }
          
          // Decisión Final
          if (data.finalFeedback || data.finalDecision) {
            roundData.finalDecision = {
              feedback: data.finalFeedback || null,
              decision: data.finalDecision || null,
              editor: data.finalEditor || null,
              completedAt: data.finalCompletedAt || null,
            };
          }
        });

        // Procesar auditLogs
        auditLogsData.forEach(log => {
          const roundNumber = log.round || 1;
          const roundData = getOrCreateRound(roundNumber);
          roundData.auditLogs.push(log);
        });

        // Si no hay rondas, crear una por defecto
        if (roundsMap.size === 0) {
          getOrCreateRound(1);
        }

        // Ordenar y establecer
        const sortedRounds = Array.from(roundsMap.values()).sort((a, b) => a.roundNumber - b.roundNumber);
        setRounds(sortedRounds);
      } catch (err) {
        console.error('Error loading review history:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [submissionId]);

  const handleExport = (format) => {
    switch (format) {
      case 'excel':
        exportToExcel(rounds, submissionTitle, isSpanish);
        break;
      case 'pdf':
        exportToPDF(rounds, submissionTitle, isSpanish);
        break;
      case 'word':
        exportToWord(rounds, submissionTitle, isSpanish);
        break;
      case 'csv':
        exportToCSV(rounds, submissionTitle, isSpanish);
        break;
      default:
        break;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-10 h-10 border-4 border-t-[#002147] border-slate-200 rounded-full animate-spin mb-4"></div>
        <p className="text-sm text-slate-500 font-sans">{t.loading}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm font-sans text-sm font-medium">
        {t.error}: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Encabezado editorial con exportaciones */}
      <div className="bg-[#002147] text-white rounded-sm p-4 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-sm flex items-center justify-center">
              <Icons.ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-lg sm:text-xl font-bold">
                {t.feedbackHistory}
              </h3>
              <p className="text-slate-300 text-sm mt-0.5 font-sans">
                {submissionTitle || submissionId}
              </p>
            </div>
          </div>
          
          {/* Botones de exportación */}
          <div className="flex gap-1.5 flex-wrap">
            <button 
              onClick={() => handleExport('excel')} 
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-sm transition-colors text-[10px] font-bold uppercase tracking-wider"
              title="Excel"
            >
              <Icons.FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </button>
            <button 
              onClick={() => handleExport('pdf')} 
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-sm transition-colors text-[10px] font-bold uppercase tracking-wider"
              title="PDF"
            >
              <Icons.FilePdf className="w-3.5 h-3.5" />
              PDF
            </button>
            <button 
              onClick={() => handleExport('word')} 
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-sm transition-colors text-[10px] font-bold uppercase tracking-wider"
              title="Word"
            >
              <Icons.DocumentText className="w-3.5 h-3.5" />
              Word
            </button>
            <button 
              onClick={() => handleExport('csv')} 
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-sm transition-colors text-[10px] font-bold uppercase tracking-wider"
              title="CSV"
            >
              <Icons.Download className="w-3.5 h-3.5" />
              CSV
            </button>
          </div>
        </div>
      </div>

      {/* Lista de rondas */}
      {rounds.length > 0 ? (
        <div className="space-y-3">
          {rounds.map((round) => (
            <RoundCard
              key={round.roundNumber}
              roundNumber={round.roundNumber}
              roundData={round}
              isCurrentRound={round.roundNumber === currentRound}
              isSpanish={isSpanish}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-sm border border-slate-200">
          <Icons.DocumentText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-serif">{t.noHistory}</p>
        </div>
      )}
    </div>
  );
};

export default ReviewHistoryTab;