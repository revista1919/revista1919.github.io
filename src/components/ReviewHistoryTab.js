// src/components/ReviewHistoryTab.js
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useLanguage } from '../hooks/useLanguage';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// ============ ICONOS SVG PROFESIONALES ============
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
  Code: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
  Tag: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>,
  FileJson: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7v10M8 7a2 2 0 100-4 2 2 0 000 4zm0 10a2 2 0 100 4 2 2 0 000-4zm8-10v10m0-10a2 2 0 100-4 2 2 0 000 4zm0 10a2 2 0 100 4 2 2 0 000-4z" /></svg>,
};

// ============ TRADUCCIONES ============
const translateAction = (action, isSpanish) => {
  const translations = {
    'submission_created': isSpanish ? 'Envío Creado' : 'Submission Created',
    'assigned_to_section_editor': isSpanish ? 'Asignado a Editor de Sección' : 'Assigned to Section Editor',
    'peer_review_started': isSpanish ? 'Revisión por Pares Iniciada' : 'Peer Review Started',
    'review_submitted': isSpanish ? 'Revisión Enviada' : 'Review Submitted',
    'review_added_to_submission': isSpanish ? 'Revisión Agregada al Manuscrito' : 'Review Added to Submission',
    'editor_notified_new_round': isSpanish ? 'Editor Notificado de Nueva Ronda' : 'Editor Notified of New Round',
    'new_round_created_with_new_task': isSpanish ? 'Nueva Ronda de Revisión Creada' : 'New Review Round Created',
    'revision_submitted': isSpanish ? 'Revisión del Autor Enviada' : 'Author Revision Submitted',
    'marked_ready_for_publication': isSpanish ? 'Marcado Listo para Publicación' : 'Marked Ready for Publication',
    'metadata_changes_applied': isSpanish ? 'Cambios de Metadatos Aplicados' : 'Metadata Changes Applied',
    'external_reviewer_invited': isSpanish ? 'Revisor Externo Invitado' : 'External Reviewer Invited',
    'external_reviewer_onboarded': isSpanish ? 'Revisor Externo Registrado' : 'External Reviewer Onboarded',
    'metadata_changes_proposed': isSpanish ? 'Cambios de Metadatos Propuestos' : 'Metadata Changes Proposed',
    'metadata_proposal_email_sent': isSpanish ? 'Email de Propuesta de Metadatos Enviado' : 'Metadata Proposal Email Sent',
    'metadata_proposal_response_notified': isSpanish ? 'Respuesta de Propuesta Notificada' : 'Proposal Response Notified',
    'proceeded_to_decision': isSpanish ? 'Procedió a Decisión Final' : 'Proceeded to Final Decision',
    'publication_ready_complete': isSpanish ? 'Proceso de Publicación Completado' : 'Publication Process Completed',
    'certificate_generated': isSpanish ? 'Certificado Generado' : 'Certificate Generated',
    'reviewer_copy_created': isSpanish ? 'Copia para Revisor Creada' : 'Reviewer Copy Created',
    'additional_reviewer_accepted': isSpanish ? 'Revisor Adicional Aceptó' : 'Additional Reviewer Accepted',
  };
  return translations[action] || (typeof action === 'string' ? action.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : action);
};

const translateDecision = (decision, isSpanish) => {
  const translations = {
    'accept': isSpanish ? 'Aceptar' : 'Accept',
    'reject': isSpanish ? 'Rechazar' : 'Reject',
    'minor-revision': isSpanish ? 'Revisión Menor' : 'Minor Revision',
    'minor-revisions': isSpanish ? 'Revisiones Menores' : 'Minor Revisions',
    'major-revision': isSpanish ? 'Revisión Mayor' : 'Major Revision',
    'major-revisions': isSpanish ? 'Revisiones Mayores' : 'Major Revisions',
    'revision-required': isSpanish ? 'Requiere Revisión' : 'Revision Required',
    'accept-with-minor': isSpanish ? 'Aceptar con Cambios Menores' : 'Accept with Minor Changes',
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

// ============ FUNCIÓN PARA FORMATEAR VALORES DINÁMICOS ============
const formatValue = (value, label = '') => {
  if (value === null || value === undefined || value === '') {
    return <span className="text-slate-400 italic">—</span>;
  }
  
  if (typeof value === 'object' && value !== null) {
    if (value.toDate) {
      return <span className="font-mono text-xs">{value.toDate().toLocaleString()}</span>;
    }
    if (value.seconds !== undefined) {
      return <span className="font-mono text-xs">{new Date(value.seconds * 1000).toLocaleString()}</span>;
    }
    if (Array.isArray(value)) {
      return (
        <div className="space-y-2">
          {value.map((item, idx) => (
            <div key={idx} className="bg-slate-50 p-3 rounded border border-slate-200">
              {typeof item === 'object' ? (
                <div className="space-y-1">
                  {Object.entries(item).map(([key, val]) => (
                    <div key={key} className="flex items-start gap-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase min-w-[80px] pt-0.5">{key}:</span>
                      <span className="text-sm text-slate-700">{formatValue(val)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-sm">{String(item)}</span>
              )}
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-1">
        {Object.entries(value).map(([key, val]) => (
          <div key={key} className="flex items-start gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase min-w-[80px] pt-0.5">{key}:</span>
            <span className="text-sm text-slate-700">{formatValue(val)}</span>
          </div>
        ))}
      </div>
    );
  }
  
  return <span className="text-sm">{String(value)}</span>;
};

// ============ EXPORTACIÓN A JSON ============
const exportToJSON = (auditLogs, rounds, peerReviews, versions, submissionTitle, isSpanish) => {
  const exportData = {
    submissionTitle: submissionTitle || '',
    exportedAt: new Date().toISOString(),
    rounds: rounds.map(round => ({
      roundNumber: round.roundNumber,
      status: round.status || 'unknown',
      deskReview: round.deskReview ? {
        decision: round.deskReview.decision || null,
        feedback: round.deskReview.feedback || '',
        commentsToEditorial: round.deskReview.commentsToEditorial || '',
        editorName: round.deskReview.editorName || ''
      } : null,
      finalDecision: round.finalDecision ? {
        decision: round.finalDecision.decision || null,
        feedback: round.finalDecision.feedback || '',
        editorName: round.finalDecision.editorName || ''
      } : null,
      peerReviews: peerReviews.filter(r => r.round === round.roundNumber).map(review => ({
        reviewerName: review.reviewerName || '',
        reviewerEmail: review.reviewerEmail || '',
        recommendation: review.recommendation || '',
        scores: review.scores || {},
        commentsToAuthor: review.commentsToAuthor || '',
        commentsToEditor: review.commentsToEditor || '',
        submittedAt: review.submittedAt ? (review.submittedAt.toDate ? review.submittedAt.toDate().toISOString() : review.submittedAt) : null
      })),
      versions: versions.filter(v => v.round === round.roundNumber).map(version => ({
        fileName: version.fileName || '',
        notes: version.notes || '',
        uploadedAt: version.uploadedAt ? (version.uploadedAt.toDate ? version.uploadedAt.toDate().toISOString() : version.uploadedAt) : null
      })),
      auditLogs: auditLogs.filter(log => log.round === round.roundNumber || (log.round === undefined && round.roundNumber === 1)).map(log => ({
        action: log.action || '',
        by: log.by || '',
        byEmail: log.byEmail || '',
        timestamp: log.timestamp ? (log.timestamp.toDate ? log.timestamp.toDate().toISOString() : log.timestamp) : null,
        ...log.details ? { details: log.details } : {},
        ...log.changes ? { changes: log.changes } : {},
        ...log.recommendation ? { recommendation: log.recommendation } : {},
        ...log.notes ? { notes: log.notes } : {},
        ...log.fileName ? { fileName: log.fileName } : {}
      }))
    }))
  };
  
  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  saveAs(blob, `historial_${submissionTitle || 'submission'}.json`);
};

// ============ EXPORTACIÓN A EXCEL ============
const exportToExcel = (auditLogs, rounds, peerReviews, versions, submissionTitle, isSpanish) => {
  const data = [];
  
  // Hoja de auditoría
  auditLogs
    .sort((a, b) => {
      const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
      const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
      return dateA - dateB;
    })
    .forEach(log => {
      data.push({
        'Fecha': formatDate(log.timestamp, isSpanish),
        'Acción': translateAction(log.action, isSpanish),
        'Ronda': log.round || '1',
        'Realizado por': log.by === 'system' ? (isSpanish ? 'Sistema' : 'System') : (log.byEmail || log.by || ''),
        'Email': log.byEmail || log.toEmail || '',
        'Detalles': JSON.stringify(log.details || log.changes || ''),
        'Recomendación': log.recommendation ? translateDecision(log.recommendation, isSpanish) : '',
        'Notas': log.notes || '',
        'Archivo': log.fileName || '',
      });
    });

  const ws = XLSX.utils.json_to_sheet(data);
  
  // Hoja de decisiones
  const decisionsData = [];
  rounds.forEach(round => {
    if (round.deskReview) {
      decisionsData.push({
        'Ronda': round.roundNumber,
        'Tipo': isSpanish ? 'Desk Review' : 'Desk Review',
        'Decisión': translateDecision(round.deskReview.decision, isSpanish),
        'Feedback': round.deskReview.feedback || '',
        'Editor': round.deskReview.editorName || ''
      });
    }
    if (round.finalDecision) {
      decisionsData.push({
        'Ronda': round.roundNumber,
        'Tipo': isSpanish ? 'Decisión Final' : 'Final Decision',
        'Decisión': translateDecision(round.finalDecision.decision, isSpanish),
        'Feedback': round.finalDecision.feedback || '',
        'Editor': round.finalDecision.editorName || ''
      });
    }
  });
  const wsDecisions = XLSX.utils.json_to_sheet(decisionsData);
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, isSpanish ? 'Auditoría' : 'Audit');
  XLSX.utils.book_append_sheet(wb, wsDecisions, isSpanish ? 'Decisiones' : 'Decisions');
  
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `historial_${submissionTitle || 'submission'}.xlsx`);
};

// ============ EXPORTACIÓN A CSV ============
const exportToCSV = (auditLogs, submissionTitle, isSpanish) => {
  const headers = [
    'Fecha', 'Acción', 'Ronda', 'Realizado por', 'Email', 
    'Detalles', 'Recomendación', 'Notas', 'Archivo'
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
      log.by === 'system' ? (isSpanish ? 'Sistema' : 'System') : (log.byEmail || log.by || ''),
      log.byEmail || log.toEmail || '',
      JSON.stringify(log.details || log.changes || ''),
      log.recommendation ? translateDecision(log.recommendation, isSpanish) : '',
      log.notes || '',
      log.fileName || '',
    ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `historial_${submissionTitle || 'submission'}.csv`);
};

// ============ EXPORTACIÓN A PDF ============
const exportToPDF = (auditLogs, rounds, peerReviews, versions, submissionTitle, isSpanish) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = margin;

  const checkPageBreak = (neededSpace) => {
    if (yPosition + neededSpace > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }
  };

  // Header
  doc.setFontSize(24);
  doc.setTextColor(0, 33, 71);
  doc.setFont('helvetica', 'bold');
  doc.text(isSpanish ? 'Historial de Revisión Completo' : 'Complete Review History', margin, yPosition);
  
  yPosition += 10;
  doc.setDrawColor(0, 33, 71);
  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  
  yPosition += 8;
  
  if (submissionTitle) {
    doc.setFontSize(12);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text(submissionTitle, margin, yPosition);
    yPosition += 15;
  }

  rounds.forEach((round, roundIndex) => {
    checkPageBreak(40);
    
    // Round Header
    doc.setFillColor(0, 33, 71);
    doc.rect(margin, yPosition - 6, pageWidth - 2 * margin, 12, 'F');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(`${isSpanish ? 'Ronda' : 'Round'} ${round.roundNumber}`, margin + 10, yPosition + 2);
    yPosition += 15;

    // Desk Review
    if (round.deskReview) {
      checkPageBreak(50);
      doc.setFontSize(12);
      doc.setTextColor(0, 33, 71);
      doc.setFont('helvetica', 'bold');
      doc.text(isSpanish ? 'Desk Review' : 'Desk Review', margin, yPosition);
      yPosition += 7;
      
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'normal');
      
      if (round.deskReview.decision) {
        doc.text(`${isSpanish ? 'Decisión' : 'Decision'}: ${translateDecision(round.deskReview.decision, isSpanish)}`, margin + 10, yPosition);
        yPosition += 6;
      }
      
      if (round.deskReview.feedback) {
        const cleanText = round.deskReview.feedback.replace(/<[^>]*>/g, '');
        const lines = doc.splitTextToSize(cleanText, pageWidth - 2 * margin - 20);
        checkPageBreak(lines.length * 5 + 10);
        doc.text(lines, margin + 10, yPosition);
        yPosition += lines.length * 5 + 5;
      }
      yPosition += 10;
    }

    // Peer Reviews
    const roundPeerReviews = peerReviews.filter(r => r.round === round.roundNumber);
    if (roundPeerReviews.length > 0) {
      checkPageBreak(30);
      doc.setFontSize(12);
      doc.setTextColor(0, 33, 71);
      doc.setFont('helvetica', 'bold');
      doc.text(isSpanish ? 'Revisiones de Pares' : 'Peer Reviews', margin, yPosition);
      yPosition += 8;
      
      roundPeerReviews.forEach((review, idx) => {
        checkPageBreak(40);
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.text(`${isSpanish ? 'Revisor' : 'Reviewer'} ${idx + 1}: ${review.reviewerName || 'N/A'}`, margin + 10, yPosition);
        yPosition += 6;
        
        if (review.recommendation) {
          doc.setFontSize(9);
          doc.setTextColor(71, 85, 105);
          doc.setFont('helvetica', 'normal');
          doc.text(`${isSpanish ? 'Recomendación' : 'Recommendation'}: ${translateDecision(review.recommendation, isSpanish)}`, margin + 15, yPosition);
          yPosition += 6;
        }
        
        if (review.commentsToAuthor) {
          const cleanComments = review.commentsToAuthor.replace(/<[^>]*>/g, '');
          const lines = doc.splitTextToSize(cleanComments, pageWidth - 2 * margin - 25);
          checkPageBreak(lines.length * 5 + 5);
          doc.text(lines, margin + 15, yPosition);
          yPosition += lines.length * 5 + 5;
        }
        yPosition += 8;
      });
    }

    // Final Decision
    if (round.finalDecision) {
      checkPageBreak(40);
      doc.setFillColor(255, 108, 12);
      doc.rect(margin, yPosition - 6, pageWidth - 2 * margin, 12, 'F');
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text(isSpanish ? 'Decisión Final' : 'Final Decision', margin + 10, yPosition + 2);
      yPosition += 15;
      
      if (round.finalDecision.decision) {
        doc.setFontSize(10);
        doc.setTextColor(71, 85, 105);
        doc.setFont('helvetica', 'bold');
        doc.text(`${isSpanish ? 'Decisión' : 'Decision'}: ${translateDecision(round.finalDecision.decision, isSpanish)}`, margin + 10, yPosition);
        yPosition += 6;
      }
      
      if (round.finalDecision.feedback) {
        const cleanText = round.finalDecision.feedback.replace(/<[^>]*>/g, '');
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.setFont('helvetica', 'normal');
        const lines = doc.splitTextToSize(cleanText, pageWidth - 2 * margin - 20);
        checkPageBreak(lines.length * 5 + 10);
        doc.text(lines, margin + 10, yPosition);
        yPosition += lines.length * 5 + 5;
      }
      yPosition += 10;
    }

    // Audit Logs
    const roundLogs = auditLogs.filter(log => log.round === round.roundNumber || (log.round === undefined && round.roundNumber === 1));
    if (roundLogs.length > 0) {
      checkPageBreak(30);
      doc.setFontSize(12);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'bold');
      doc.text(isSpanish ? 'Registro de Actividad' : 'Activity Log', margin, yPosition);
      yPosition += 8;
      
      roundLogs
        .sort((a, b) => {
          const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
          const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
          return dateA - dateB;
        })
        .forEach((log, idx) => {
          checkPageBreak(25);
          
          doc.setFontSize(10);
          doc.setTextColor(30, 41, 59);
          doc.setFont('helvetica', 'bold');
          doc.text(translateAction(log.action, isSpanish), margin + 10, yPosition);
          
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.setFont('helvetica', 'normal');
          doc.text(formatDate(log.timestamp, isSpanish), pageWidth - margin - 10, yPosition, { align: 'right' });
          
          yPosition += 6;
          
          if (log.byEmail || log.by) {
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(`${isSpanish ? 'Por' : 'By'}: ${log.byEmail || log.by}`, margin + 15, yPosition);
            yPosition += 5;
          }
          
          if (log.details) {
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            const detailsStr = JSON.stringify(log.details);
            const lines = doc.splitTextToSize(detailsStr, pageWidth - 2 * margin - 25);
            checkPageBreak(lines.length * 4 + 5);
            doc.text(lines, margin + 15, yPosition);
            yPosition += lines.length * 4 + 3;
          }
          
          if (log.changes) {
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            const changesStr = JSON.stringify(log.changes);
            const lines = doc.splitTextToSize(changesStr, pageWidth - 2 * margin - 25);
            checkPageBreak(lines.length * 4 + 5);
            doc.text(lines, margin + 15, yPosition);
            yPosition += lines.length * 4 + 3;
          }
          
          yPosition += 8;
        });
    }
    
    yPosition += 20;
  });

  // Footer
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    const footerText = isSpanish 
      ? 'Documento generado automáticamente por el sistema editorial' 
      : 'Document automatically generated by the editorial system';
    doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });
    doc.text(`${i} / ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  }

  doc.save(`historial_${submissionTitle || 'submission'}.pdf`);
};

// ============ EXPORTACIÓN A WORD ============
const exportToWord = (auditLogs, rounds, peerReviews, versions, submissionTitle, isSpanish) => {
  const sortedLogs = [...auditLogs].sort((a, b) => {
    const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
    const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
    return dateA - dateB;
  });

  let htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" 
          xmlns:w="urn:schemas-microsoft-com:office:word" 
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <title>${isSpanish ? 'Historial de Revisión' : 'Review History'}</title>
      <style>
        body { font-family: 'Georgia', serif; color: #1a202c; }
        h1 { font-family: Arial, sans-serif; font-size: 24px; color: #002147; }
        .round-header { font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; color: #ffffff; background: #002147; padding: 10px; }
        .decision-header { font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; color: #ffffff; background: #FF6C0C; padding: 8px; }
        .log-item { margin: 10px 0; padding: 8px; border: 1px solid #e2e8f0; }
        .log-action { font-weight: bold; color: #1e293b; }
        .log-date { color: #64748b; font-size: 11px; }
        .detail-label { font-weight: bold; color: #94a3b8; font-size: 10px; text-transform: uppercase; }
        .detail-value { color: #334155; }
        .version-item { margin: 10px 0; padding: 8px; border: 1px solid #bfdbfe; background: #eff6ff; }
        .review-item { margin: 10px 0; padding: 10px; border: 1px solid #e2e8f0; background: #f8fafc; }
      </style>
    </head>
    <body>
      <h1>${isSpanish ? 'Historial de Revisión Completo' : 'Complete Review History'}</h1>
      <p>${submissionTitle || ''}</p>
  `;

  rounds.forEach(round => {
    const roundLogs = sortedLogs.filter(log => 
      log.round === round.roundNumber || (log.round === undefined && round.roundNumber === 1)
    );
    const roundPeerReviews = peerReviews.filter(r => r.round === round.roundNumber);
    const roundVersions = versions.filter(v => v.round === round.roundNumber);
    
    htmlContent += `
      <div class="round-header">${isSpanish ? 'Ronda' : 'Round'} ${round.roundNumber}</div>
    `;
    
    // Desk Review
    if (round.deskReview) {
      htmlContent += `
        <div class="decision-header">${isSpanish ? 'Desk Review' : 'Desk Review'}</div>
        ${round.deskReview.decision ? `<p><strong>${isSpanish ? 'Decisión' : 'Decision'}:</strong> ${translateDecision(round.deskReview.decision, isSpanish)}</p>` : ''}
        ${round.deskReview.feedback ? `<p>${round.deskReview.feedback.replace(/<[^>]*>/g, '')}</p>` : ''}
        ${round.deskReview.commentsToEditorial ? `<p><strong>${isSpanish ? 'Notas Internas' : 'Internal Notes'}:</strong> ${round.deskReview.commentsToEditorial.replace(/<[^>]*>/g, '')}</p>` : ''}
      `;
    }
    
    // Peer Reviews
    roundPeerReviews.forEach((review, idx) => {
      htmlContent += `
        <div class="review-item">
          <div class="log-action">${isSpanish ? 'Revisor' : 'Reviewer'} ${idx + 1}: ${review.reviewerName || 'N/A'}</div>
          ${review.recommendation ? `<p><strong>${isSpanish ? 'Recomendación' : 'Recommendation'}:</strong> ${translateDecision(review.recommendation, isSpanish)}</p>` : ''}
          ${review.commentsToAuthor ? `<p><strong>${isSpanish ? 'Comentarios al Autor' : 'Comments to Author'}:</strong> ${review.commentsToAuthor.replace(/<[^>]*>/g, '')}</p>` : ''}
          ${review.commentsToEditor ? `<p><strong>${isSpanish ? 'Comentarios al Editor' : 'Comments to Editor'}:</strong> ${review.commentsToEditor.replace(/<[^>]*>/g, '')}</p>` : ''}
        </div>
      `;
    });
    
    // Final Decision
    if (round.finalDecision) {
      htmlContent += `
        <div class="decision-header">${isSpanish ? 'Decisión Final' : 'Final Decision'}</div>
        ${round.finalDecision.decision ? `<p><strong>${isSpanish ? 'Decisión' : 'Decision'}:</strong> ${translateDecision(round.finalDecision.decision, isSpanish)}</p>` : ''}
        ${round.finalDecision.feedback ? `<p>${round.finalDecision.feedback.replace(/<[^>]*>/g, '')}</p>` : ''}
      `;
    }
    
    // Versions
    if (roundVersions.length > 0) {
      roundVersions.forEach((version, vIdx) => {
        htmlContent += `
          <div class="version-item">
            <div class="log-action">${isSpanish ? 'Versión' : 'Version'} ${vIdx + 1}</div>
            ${version.fileName ? `<p><strong>${isSpanish ? 'Archivo' : 'File'}:</strong> ${version.fileName}</p>` : ''}
            ${version.notes ? `<p><strong>${isSpanish ? 'Notas' : 'Notes'}:</strong> ${version.notes}</p>` : ''}
          </div>
        `;
      });
    }
    
    // Audit Logs
    roundLogs.forEach(log => {
      htmlContent += `
        <div class="log-item">
          <div>
            <span class="log-action">${translateAction(log.action, isSpanish)}</span>
            <span class="log-date"> - ${formatDate(log.timestamp, isSpanish)}</span>
          </div>
          ${log.byEmail ? `<p><span class="detail-label">${isSpanish ? 'Por' : 'By'}:</span> <span class="detail-value">${log.byEmail}</span></p>` : ''}
          ${log.details ? `<p><span class="detail-label">${isSpanish ? 'Detalles' : 'Details'}:</span> <span class="detail-value">${JSON.stringify(log.details)}</span></p>` : ''}
          ${log.changes ? `<p><span class="detail-label">${isSpanish ? 'Cambios' : 'Changes'}:</span> <span class="detail-value">${JSON.stringify(log.changes)}</span></p>` : ''}
          ${log.recommendation ? `<p><span class="detail-label">${isSpanish ? 'Recomendación' : 'Recommendation'}:</span> <span class="detail-value">${translateDecision(log.recommendation, isSpanish)}</span></p>` : ''}
        </div>
      `;
    });
  });

  htmlContent += '</body></html>';

  const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
  saveAs(blob, `historial_${submissionTitle || 'submission'}.doc`);
};

// ============ COMPONENTE: TARJETA DE REVISOR ============
const ReviewerFeedbackCard = ({ review, index, isSpanish }) => {
  const [expanded, setExpanded] = useState(false);
  
  const recommendationColors = {
    'accept': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'minor-revisions': 'bg-sky-50 text-sky-700 border-sky-200',
    'minor-revision': 'bg-sky-50 text-sky-700 border-sky-200',
    'major-revisions': 'bg-amber-50 text-amber-700 border-amber-200',
    'major-revision': 'bg-amber-50 text-amber-700 border-amber-200',
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
            {isSpanish ? 'Desk Review (Evaluación Inicial)' : 'Desk Review (Initial Evaluation)'}
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
                    {isSpanish ? 'Notas Internas del Equipo Editorial' : 'Internal Editorial Notes'}
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

// ============ COMPONENTE: METADATA PROPOSAL ============
const MetadataProposalCard = ({ log, isSpanish }) => {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icons.Tag className="w-4 h-4 text-[#FF6C0C]" />
          <span className="font-sans font-bold text-sm text-[#002147]">
            {isSpanish ? 'Propuesta de Metadatos' : 'Metadata Proposal'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-500">
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
            className="overflow-hidden"
          >
            <div className="border-t border-slate-100 p-5 space-y-4 bg-slate-50">
              {log.changes && Array.isArray(log.changes) && (
                <div className="space-y-3">
                  {log.changes.map((change, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded p-4">
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          {change.field || `Change ${idx + 1}`}
                        </span>
                        {change.reason && (
                          <span className="text-xs text-slate-500 italic max-w-xs text-right">
                            "{change.reason}"
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {log.byEmail && (
                <div className="flex items-center gap-2 text-xs font-mono text-slate-500 pt-2 border-t border-slate-200">
                  <Icons.User />
                  {log.byEmail}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============ COMPONENTE: AUDIT LOG ITEM ============
const AuditLogItem = ({ log, isSpanish, index }) => {
  const [expanded, setExpanded] = useState(false);
  
  // Extraer todas las claves dinámicamente
  const logKeys = Object.entries(log).filter(([key]) => 
    !['id', 'action', 'timestamp', 'round'].includes(key)
  );
  
  const isMetadataProposal = log.action === 'metadata_changes_proposed';
  
  return (
    <div className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
            log.action?.includes('review') ? 'bg-sky-500' :
            log.action?.includes('metadata') ? 'bg-purple-500' :
            log.action?.includes('decision') ? 'bg-orange-500' :
            log.action?.includes('publication') ? 'bg-emerald-500' : 'bg-slate-400'
          }`}></span>
          <div className="text-left flex-1 min-w-0">
            <span className="font-sans font-bold text-sm text-[#002147] block">
              {translateAction(log.action, isSpanish)}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              {formatDate(log.timestamp, isSpanish)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {log.byEmail && (
            <span className="text-xs text-slate-500 font-mono hidden sm:block">
              {log.byEmail}
            </span>
          )}
          {expanded ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
        </div>
      </button>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-100 p-5 bg-slate-50">
              {isMetadataProposal && log.changes ? (
                <MetadataProposalCard log={log} isSpanish={isSpanish} />
              ) : (
                <div className="space-y-3">
                  {logKeys.map(([key, value]) => {
                    if (value === null || value === undefined) return null;
                    
                    return (
                      <div key={key} className="flex items-start gap-3">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[100px] pt-1">
                          {key}:
                        </span>
                        <div className="flex-1 bg-white border border-slate-200 rounded p-3">
                          {formatValue(value)}
                        </div>
                      </div>
                    );
                  })}
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
const RoundCard = ({ roundNumber, roundData, isCurrentRound, isSpanish, auditLogs, versions, peerReviews }) => {
  const [expanded, setExpanded] = useState(isCurrentRound);
  
  const roundLogs = auditLogs.filter(log => log.round === roundNumber || (log.round === undefined && roundNumber === 1));
  const roundVersions = versions.filter(v => v.round === roundNumber);
  const roundPeerReviews = peerReviews.filter(r => r.round === roundNumber);
  
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
              {roundData.deskReview && ` • Desk Review`}
              {roundData.finalDecision && ` • ${isSpanish ? 'Decisión Final' : 'Final Decision'}`}
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
                <div>
                  <h4 className="font-sans font-bold text-[#002147] text-sm uppercase tracking-widest border-b-2 border-[#FF6C0C] pb-2 mb-4 inline-block">
                    <Icons.ClipboardCheck className="inline w-4 h-4 mr-2" />
                    {isSpanish ? 'Desk Review' : 'Desk Review'}
                  </h4>
                  <DeskReviewCard deskReview={roundData.deskReview} isSpanish={isSpanish} />
                </div>
              )}

              {/* REVISIONES DE PARES */}
              {roundPeerReviews.length > 0 && (
                <div>
                  <h4 className="font-sans font-bold text-[#002147] text-sm uppercase tracking-widest border-b-2 border-[#FF6C0C] pb-2 mb-4 inline-block">
                    <Icons.User className="inline w-4 h-4 mr-2" />
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
                <div>
                  <h4 className="font-sans font-bold text-[#002147] text-sm uppercase tracking-widest border-b-2 border-[#FF6C0C] pb-2 mb-4 inline-block">
                    <Icons.Gavel className="inline w-4 h-4 mr-2" />
                    {isSpanish ? 'Decisión Final' : 'Final Decision'}
                  </h4>
                  <FinalDecisionCard decisionData={roundData.finalDecision} isSpanish={isSpanish} />
                </div>
              )}

              {/* VERSIONES */}
              {roundVersions.length > 0 && (
                <div>
                  <h4 className="font-sans font-bold text-[#002147] text-sm uppercase tracking-widest border-b-2 border-[#002147] pb-2 mb-4 inline-block">
                    <Icons.File className="inline w-4 h-4 mr-2" />
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
                              {version.fileName || `${isSpanish ? 'Versión' : 'Version'} ${idx + 1}`}
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
                    {isSpanish ? 'Registro de Actividad Completo' : 'Complete Activity Log'}
                  </h4>
                  <div className="space-y-2">
                    {roundLogs
                      .sort((a, b) => {
                        const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
                        const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
                        return dateB - dateA;
                      })
                      .map((log, idx) => (
                        <AuditLogItem
                          key={log.id || idx}
                          log={log}
                          isSpanish={isSpanish}
                          index={idx}
                        />
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

        // Cargar reviewerAssignments
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

        // Cargar auditLogs
        const auditLogsQuery = query(
          collection(db, 'submissions', submissionId, 'auditLogs'),
          orderBy('timestamp', 'asc')
        );
        const auditLogsSnapshot = await getDocs(auditLogsQuery);
        const logs = [];
        auditLogsSnapshot.forEach((doc) => {
          const data = doc.data();
          logs.push({ 
            id: doc.id, 
            ...data,
            // Normalizar timestamp
            timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : data.timestamp
          });
        });
        setAuditLogs(logs);

        // Cargar versiones
        const versionsQuery = query(
          collection(db, 'submissions', submissionId, 'versions'),
          orderBy('uploadedAt', 'asc')
        );
        const versionsSnapshot = await getDocs(versionsQuery);
        const versionsData = [];
        versionsSnapshot.forEach((doc) => {
          const data = doc.data();
          versionsData.push({ 
            id: doc.id, 
            ...data, 
            round: data.round || 1,
            uploadedAt: data.uploadedAt?.toDate ? data.uploadedAt.toDate() : data.uploadedAt
          });
        });
        setVersions(versionsData);

        // Cargar roundHistory
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
              finalDecision: null
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
                finalDecision: null
              });
            }
            
            const roundData = roundsMap.get(roundNumber);
            
            // Desk Review desde roundHistory
            if (historyData.deskReviewFeedback || historyData.deskReviewDecision) {
              roundData.deskReview = {
                decision: historyData.deskReviewDecision || null,
                feedback: historyData.deskReviewFeedback || null,
                commentsToEditorial: historyData.deskReviewComments || null,
                editorName: historyData.deskReviewEditor || null,
              };
            }

            // Final Decision desde roundHistory
            if (historyData.finalDecision || historyData.finalFeedback) {
              roundData.finalDecision = {
                decision: historyData.finalDecision || historyData.decision || null,
                feedback: historyData.finalFeedback || historyData.feedback || null,
                editorName: historyData.finalEditor || historyData.editorName || null,
              };
            }
          }
        });

        if (roundsMap.size === 0) {
          roundsMap.set(1, { 
            roundNumber: 1, 
            status: 'active', 
            deskReview: null, 
            finalDecision: null 
          });
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
        <div className="absolute bottom-0 left-1/4 w-32 h-32 bg-[#FF6C0C] opacity-10 rounded-full blur-2xl pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="bg-[#00152e] p-3 rounded-lg border border-[#003b5c]">
              <Icons.ClipboardCheck className="w-8 h-8 text-[#FF6C0C]" />
            </div>
            <div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight mb-1">
                {isSpanish ? 'Historial de Revisión Completo' : 'Complete Review History'}
              </h2>
              <p className="text-slate-400 text-sm font-sans max-w-xl">
                {submissionTitle || submissionId}
              </p>
              <p className="text-slate-500 text-xs font-sans mt-2">
                {rounds.length} {isSpanish ? 'rondas' : 'rounds'} • {auditLogs.length} {isSpanish ? 'eventos' : 'events'} • {peerReviews.length} {isSpanish ? 'revisiones' : 'reviews'}
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={() => exportToJSON(auditLogs, rounds, peerReviews, versions, submissionTitle, isSpanish)} 
              className="flex items-center gap-2 bg-transparent border border-slate-500 hover:border-white hover:bg-white hover:text-[#002147] text-white px-4 py-2.5 rounded transition-all text-xs font-bold uppercase tracking-widest shadow-sm"
              title="JSON"
            >
              <Icons.FileJson /> JSON
            </button>
            <button 
              onClick={() => exportToPDF(auditLogs, rounds, peerReviews, versions, submissionTitle, isSpanish)} 
              className="flex items-center gap-2 bg-transparent border border-slate-500 hover:border-white hover:bg-white hover:text-[#002147] text-white px-4 py-2.5 rounded transition-all text-xs font-bold uppercase tracking-widest shadow-sm"
            >
              <Icons.FilePdf /> PDF
            </button>
            <button 
              onClick={() => exportToWord(auditLogs, rounds, peerReviews, versions, submissionTitle, isSpanish)} 
              className="flex items-center gap-2 bg-transparent border border-slate-500 hover:border-white hover:bg-white hover:text-[#002147] text-white px-4 py-2.5 rounded transition-all text-xs font-bold uppercase tracking-widest shadow-sm"
            >
              <Icons.DocumentText /> Word
            </button>
            <button 
              onClick={() => exportToExcel(auditLogs, rounds, peerReviews, versions, submissionTitle, isSpanish)} 
              className="flex items-center gap-2 bg-transparent border border-slate-500 hover:border-white hover:bg-white hover:text-[#002147] text-white px-4 py-2.5 rounded transition-all text-xs font-bold uppercase tracking-widest shadow-sm"
            >
              <Icons.FileSpreadsheet /> Excel
            </button>
            <button 
              onClick={() => exportToCSV(auditLogs, submissionTitle, isSpanish)} 
              className="flex items-center gap-2 bg-transparent border border-slate-500 hover:border-white hover:bg-white hover:text-[#002147] text-white px-4 py-2.5 rounded transition-all text-xs font-bold uppercase tracking-widest shadow-sm"
            >
              <Icons.Download /> CSV
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