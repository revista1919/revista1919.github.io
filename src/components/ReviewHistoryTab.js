// src/components/ReviewHistoryTab.js
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useLanguage } from '../hooks/useLanguage';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// ============ ICONOS SVG (Estilo editorial consistente) ============
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
  Tag: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>,
  Code: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
  Json: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
};

// ============ TRADUCCIONES ============
const translations = {
  actions: {
    es: {
      'submission_created': 'Envío Creado',
      'assigned_to_section_editor': 'Asignado a Editor',
      'peer_review_started': 'Revisión por Pares Iniciada',
      'review_submitted': 'Revisión Enviada',
      'review_added_to_submission': 'Revisión Agregada',
      'editor_notified_new_round': 'Editor Notificado',
      'new_round_created_with_new_task': 'Nueva Ronda Creada',
      'revision_submitted': 'Revisión del Autor',
      'marked_ready_for_publication': 'Listo para Publicar',
      'metadata_changes_applied': 'Metadatos Actualizados',
      'external_reviewer_invited': 'Revisor Externo Invitado',
      'external_reviewer_onboarded': 'Revisor Externo Registrado',
      'metadata_changes_proposed': 'Cambios de Metadatos Propuestos',
      'metadata_proposal_email_sent': 'Correo de Propuesta de Metadatos Enviado',
      'metadata_proposal_response_notified': 'Respuesta de Propuesta de Metadatos Notificada',
      'proceeded_to_decision': 'Avanzó a Decisión Final',
      'publication_ready_complete': 'Publicación Lista Completada',
      'certificate_generated': 'Certificado Generado',
      'reviewer_copy_created': 'Copia para Revisor Creada',
      'additional_reviewer_accepted': 'Revisor Adicional Aceptado',
    },
    en: {
      'submission_created': 'Submission Created',
      'assigned_to_section_editor': 'Assigned to Editor',
      'peer_review_started': 'Peer Review Started',
      'review_submitted': 'Review Submitted',
      'review_added_to_submission': 'Review Added',
      'editor_notified_new_round': 'Editor Notified',
      'new_round_created_with_new_task': 'New Round Created',
      'revision_submitted': 'Author Revision',
      'marked_ready_for_publication': 'Ready to Publish',
      'metadata_changes_applied': 'Metadata Updated',
      'external_reviewer_invited': 'External Reviewer Invited',
      'external_reviewer_onboarded': 'External Reviewer Onboarded',
      'metadata_changes_proposed': 'Metadata Changes Proposed',
      'metadata_proposal_email_sent': 'Metadata Proposal Email Sent',
      'metadata_proposal_response_notified': 'Metadata Proposal Response Notified',
      'proceeded_to_decision': 'Proceeded to Final Decision',
      'publication_ready_complete': 'Publication Ready Complete',
      'certificate_generated': 'Certificate Generated',
      'reviewer_copy_created': 'Reviewer Copy Created',
      'additional_reviewer_accepted': 'Additional Reviewer Accepted',
    }
  },
  decisions: {
    es: {
      'accept': 'Aceptar', 'reject': 'Rechazar',
      'minor-revision': 'Revisión Menor', 'minor-revisions': 'Revisiones Menores',
      'major-revision': 'Revisión Mayor', 'major-revisions': 'Revisiones Mayores',
      'revision-required': 'Enviar a Pares',
    },
    en: {
      'accept': 'Accept', 'reject': 'Reject',
      'minor-revision': 'Minor Revision', 'minor-revisions': 'Minor Revisions',
      'major-revision': 'Major Revision', 'major-revisions': 'Major Revisions',
      'revision-required': 'Send to Review',
    }
  }
};

const translateAction = (action, isSpanish) => {
  return translations.actions[isSpanish ? 'es' : 'en'][action] || action;
};

const translateDecision = (decision, isSpanish) => {
  if (!decision) return '—';
  return translations.decisions[isSpanish ? 'es' : 'en'][decision] || decision;
};

const formatDate = (timestamp, isSpanish) => {
  if (!timestamp) return '—';
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString(isSpanish ? 'es-ES' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const formatValue = (value, fieldName = '') => {
  if (value === null || value === undefined || value === '') {
    return <span className="text-slate-400 italic font-sans text-xs">—</span>;
  }

  if (fieldName === 'keywords' || fieldName === 'keywordsEs' || fieldName === 'keywordsEn') {
    const keywords = Array.isArray(value) ? value : [value];
    return (
      <div className="flex flex-wrap gap-1.5">
        {keywords.map((kw, idx) => (
          <span key={idx} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-sans border border-slate-200">
            {typeof kw === 'string' ? kw : kw.term || kw.name || String(kw)}
          </span>
        ))}
      </div>
    );
  }

  if (fieldName === 'authors') {
    const authors = Array.isArray(value) ? value : [value];
    return (
      <div className="space-y-2">
        {authors.map((author, idx) => {
          if (typeof author === 'object' && author !== null) {
            const fullName = `${author.firstName || ''} ${author.lastName || ''}`.trim() || author.name || 'Autor sin nombre';
            return (
              <div key={idx} className="flex items-center gap-2 text-sm flex-wrap">
                <span className="font-serif text-slate-800">{fullName}</span>
                {author.email && <span className="text-xs text-slate-400 font-mono">({author.email})</span>}
                {author.orcid && <span className="text-xs text-[#002147] font-mono">ORCID: {author.orcid}</span>}
                {author.isCorresponding && (
                  <span className="px-2 py-0.5 bg-[#EBF4F7] text-[#004B7F] text-[10px] font-bold uppercase tracking-wider rounded-sm">
                    {isSpanish ? 'Correspondencia' : 'Corresponding'}
                  </span>
                )}
              </div>
            );
          }
          return <span key={idx} className="block font-serif text-slate-800">{String(author)}</span>;
        })}
      </div>
    );
  }

  if (fieldName === 'specializedCodes') {
    const codes = Array.isArray(value) ? value : [value];
    return (
      <div className="flex flex-wrap gap-2">
        {codes.map((code, idx) => (
          <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 text-white rounded-sm text-xs font-mono font-bold">
            <Icons.Code />
            {code}
          </span>
        ))}
      </div>
    );
  }

  if (typeof value === 'object' && value !== null) {
    if (Array.isArray(value)) {
      return (
        <div className="space-y-1">
          {value.map((item, idx) => {
            if (typeof item === 'object' && item !== null) {
              return <div key={idx} className="font-mono text-xs text-slate-700 bg-slate-50 p-1 rounded border border-slate-200">{JSON.stringify(item)}</div>;
            }
            return <span key={idx} className="block font-serif text-slate-700">{String(item)}</span>;
          })}
        </div>
      );
    }
    if (value.seconds !== undefined) {
      return new Date(value.seconds * 1000).toLocaleString();
    }
    return <pre className="font-mono text-xs text-slate-700 bg-slate-50 p-2 rounded border border-slate-200 overflow-x-auto">{JSON.stringify(value, null, 2)}</pre>;
  }

  return <span className="font-serif text-slate-700">{String(value)}</span>;
};

// ============ FUNCIONES DE EXPORTACIÓN ============
const getCleanText = (html) => {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

const exportToExcel = (auditLogs, rounds, submissionTitle, isSpanish) => {
  const data = [];
  
  auditLogs
    .sort((a, b) => {
      const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
      const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
      return dateA - dateB;
    })
    .forEach(log => {
      const row = {
        [isSpanish ? 'Fecha' : 'Date']: formatDate(log.timestamp, isSpanish),
        [isSpanish ? 'Acción' : 'Action']: translateAction(log.action, isSpanish),
        [isSpanish ? 'Ronda' : 'Round']: log.round || '1',
        [isSpanish ? 'Realizado por' : 'Performed by']: log.by === 'system' ? (isSpanish ? 'Sistema' : 'System') : (log.byEmail || log.by || ''),
        [isSpanish ? 'Email' : 'Email']: log.byEmail || log.toEmail || '',
        [isSpanish ? 'Detalles' : 'Details']: JSON.stringify(log.details || {}),
        [isSpanish ? 'Recomendación' : 'Recommendation']: log.recommendation ? translateDecision(log.recommendation, isSpanish) : '',
        [isSpanish ? 'Notas' : 'Notes']: log.notes || '',
        [isSpanish ? 'Archivo' : 'File']: log.fileName || '',
      };
      data.push(row);
    });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, isSpanish ? 'Auditoría' : 'Audit');
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `historial_${submissionTitle || 'submission'}.xlsx`);
};

const exportToPDF = (auditLogs, rounds, submissionTitle, isSpanish) => {
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

  doc.setFontSize(24);
  doc.setTextColor(0, 33, 71); // Oxford Blue
  doc.setFont('helvetica', 'bold');
  doc.text(isSpanish ? 'Historial de Auditoría' : 'Audit History', margin, yPosition);
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

  const sortedLogs = [...auditLogs].sort((a, b) => {
    const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
    const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
    return dateA - dateB;
  });

  rounds.forEach((round, roundIndex) => {
    const roundLogs = sortedLogs.filter(log => 
      log.round === round.roundNumber || (log.round === undefined && round.roundNumber === 1)
    );
    
    if (roundLogs.length === 0 && !round.deskReview && !round.finalDecision && !round.versions?.length && !round.metadataProposals?.length) return;
    
    checkPageBreak(40);
    
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, yPosition - 6, pageWidth - 2 * margin, 12, 'F');
    doc.setFillColor(0, 33, 71);
    doc.rect(margin, yPosition - 6, 4, 12, 'F');
    
    doc.setFontSize(14);
    doc.setTextColor(0, 33, 71);
    doc.setFont('helvetica', 'bold');
    doc.text(`${isSpanish ? 'Ronda' : 'Round'} ${round.roundNumber}`, margin + 10, yPosition + 2);
    yPosition += 15;

    // Desk Review
    if (round.deskReview) {
      checkPageBreak(30);
      doc.setFontSize(11);
      doc.setTextColor(0, 33, 71);
      doc.setFont('helvetica', 'bold');
      doc.text(isSpanish ? 'Desk Review' : 'Desk Review', margin, yPosition);
      yPosition += 6;
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'normal');
      if (round.deskReview.feedback) {
        const cleanText = getCleanText(round.deskReview.feedback);
        const lines = doc.splitTextToSize(cleanText, pageWidth - 2 * margin - 20);
        checkPageBreak(lines.length * 5 + 10);
        doc.text(lines, margin + 10, yPosition);
        yPosition += lines.length * 5 + 5;
      }
      if (round.deskReview.decision) {
        doc.text(`${isSpanish ? 'Decisión' : 'Decision'}: ${translateDecision(round.deskReview.decision, isSpanish)}`, margin + 10, yPosition);
        yPosition += 5;
      }
      yPosition += 10;
    }

    // Peer Reviews
    if (round.peerReviews && round.peerReviews.length > 0) {
      checkPageBreak(30);
      doc.setFontSize(11);
      doc.setTextColor(0, 33, 71);
      doc.setFont('helvetica', 'bold');
      doc.text(isSpanish ? 'Revisiones de Pares' : 'Peer Reviews', margin, yPosition);
      yPosition += 8;
      round.peerReviews.forEach((review, idx) => {
        checkPageBreak(20);
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.text(`${review.reviewerName || (isSpanish ? 'Revisor' : 'Reviewer') + ' ' + (idx + 1)}`, margin + 10, yPosition);
        yPosition += 5;
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'normal');
        doc.text(`${isSpanish ? 'Recomendación' : 'Recommendation'}: ${translateDecision(review.recommendation, isSpanish)}`, margin + 15, yPosition);
        yPosition += 5;
        if (review.commentsToAuthor) {
          const cleanText = getCleanText(review.commentsToAuthor);
          const lines = doc.splitTextToSize(cleanText, pageWidth - 2 * margin - 30);
          checkPageBreak(lines.length * 5 + 10);
          doc.text(lines, margin + 15, yPosition);
          yPosition += lines.length * 5 + 5;
        }
        yPosition += 8;
      });
    }

    // Decisión Final
    if (round.finalDecision) {
      checkPageBreak(30);
      doc.setFontSize(11);
      doc.setTextColor(5, 150, 105);
      doc.setFont('helvetica', 'bold');
      doc.text(isSpanish ? 'Decisión Final' : 'Final Decision', margin, yPosition);
      yPosition += 6;
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'normal');
      if (round.finalDecision.feedback) {
        const cleanText = getCleanText(round.finalDecision.feedback);
        const lines = doc.splitTextToSize(cleanText, pageWidth - 2 * margin - 20);
        checkPageBreak(lines.length * 5 + 10);
        doc.text(lines, margin + 10, yPosition);
        yPosition += lines.length * 5 + 5;
      }
      if (round.finalDecision.decision) {
        doc.text(`${isSpanish ? 'Decisión' : 'Decision'}: ${translateDecision(round.finalDecision.decision, isSpanish)}`, margin + 10, yPosition);
        yPosition += 5;
      }
      yPosition += 10;
    }

    // Metadata Proposals
    if (round.metadataProposals && round.metadataProposals.length > 0) {
      checkPageBreak(30);
      doc.setFontSize(11);
      doc.setTextColor(0, 33, 71);
      doc.setFont('helvetica', 'bold');
      doc.text(isSpanish ? 'Propuestas de Metadatos' : 'Metadata Proposals', margin, yPosition);
      yPosition += 8;
      round.metadataProposals.forEach((proposal, idx) => {
        checkPageBreak(20);
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.text(`${isSpanish ? 'Propuesta' : 'Proposal'} ${idx + 1} - ${translateAction('metadata_changes_proposed', isSpanish)}`, margin + 10, yPosition);
        yPosition += 5;
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'normal');
        proposal.changes.forEach(change => {
          doc.text(`${isSpanish ? 'Campo' : 'Field'}: ${change.field}`, margin + 15, yPosition);
          yPosition += 5;
          doc.text(`${isSpanish ? 'Valor Actual' : 'Current Value'}: ${JSON.stringify(change.currentValue)}`, margin + 15, yPosition);
          yPosition += 5;
          doc.text(`${isSpanish ? 'Valor Propuesto' : 'Proposed Value'}: ${JSON.stringify(change.proposedValue)}`, margin + 15, yPosition);
          yPosition += 5;
          doc.text(`${isSpanish ? 'Razón' : 'Reason'}: ${change.reason}`, margin + 15, yPosition);
          yPosition += 5;
        });
        if (proposal.authorResponse) {
          doc.text(`${isSpanish ? 'Respuesta del Autor' : 'Author Response'}: ${proposal.authorResponse.accepted ? (isSpanish ? 'Aceptada' : 'Accepted') : (isSpanish ? 'Rechazada' : 'Rejected')}`, margin + 15, yPosition);
          yPosition += 5;
        }
        yPosition += 8;
      });
    }

    // Audit Logs
    roundLogs.forEach((log, logIndex) => {
      checkPageBreak(30);
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, 25, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, 25);
      
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.text(translateAction(log.action, isSpanish), margin + 10, yPosition);
      
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.text(formatDate(log.timestamp, isSpanish), pageWidth - margin - 10, yPosition, { align: 'right' });
      yPosition += 6;
      
      doc.text(`${isSpanish ? 'Por' : 'By'}: ${log.byEmail || log.by || 'Sistema'}`, margin + 15, yPosition);
      yPosition += 5;
      
      if (log.details && typeof log.details === 'object' && Object.keys(log.details).length > 0) {
        Object.entries(log.details).forEach(([key, value]) => {
          doc.text(`${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`, margin + 15, yPosition);
          yPosition += 5;
        });
      }
      yPosition += 10;
    });
    
    yPosition += 15;
  });

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
    .map(log => [
      formatDate(log.timestamp, isSpanish),
      translateAction(log.action, isSpanish),
      log.round || '1',
      log.by === 'system' ? (isSpanish ? 'Sistema' : 'System') : (log.byEmail || log.by || ''),
      log.byEmail || log.toEmail || '',
      JSON.stringify(log.details || {}),
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

const exportToWord = (auditLogs, rounds, submissionTitle, isSpanish) => {
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
      <title>${isSpanish ? 'Historial de Auditoría' : 'Audit History'}</title>
      <style>
        body { font-family: 'Georgia', serif; color: #1a202c; }
        h1 { font-family: Arial, sans-serif; font-size: 24px; color: #002147; }
        .round-header { font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; color: #002147; background: #f8fafc; padding: 8px; }
        .log-item { margin: 10px 0; padding: 8px; border: 1px solid #e2e8f0; }
        .log-action { font-weight: bold; color: #1e293b; }
        .log-date { color: #64748b; font-size: 11px; }
        .detail-label { font-weight: bold; color: #94a3b8; font-size: 10px; text-transform: uppercase; }
        .detail-value { color: #334155; }
        .version-item { margin: 10px 0; padding: 8px; border: 1px solid #bfdbfe; background: #eff6ff; }
        .proposal-item { margin: 10px 0; padding: 8px; border: 1px solid #fde68a; background: #fffbeb; }
      </style>
    </head>
    <body>
      <h1>${isSpanish ? 'Historial de Auditoría' : 'Audit History'}</h1>
      <p>${submissionTitle || ''}</p>
  `;

  rounds.forEach(round => {
    const roundLogs = sortedLogs.filter(log => 
      log.round === round.roundNumber || (log.round === undefined && round.roundNumber === 1)
    );
    
    htmlContent += `
      <div class="round-header">${isSpanish ? 'Ronda' : 'Round'} ${round.roundNumber}</div>
    `;
    
    if (round.deskReview) {
      htmlContent += `
        <div class="log-item">
          <div class="log-action">${isSpanish ? 'Desk Review' : 'Desk Review'}</div>
          ${round.deskReview.feedback ? `<p>${getCleanText(round.deskReview.feedback)}</p>` : ''}
          ${round.deskReview.decision ? `<p><strong>${isSpanish ? 'Decisión' : 'Decision'}:</strong> ${translateDecision(round.deskReview.decision, isSpanish)}</p>` : ''}
        </div>
      `;
    }

    if (round.peerReviews && round.peerReviews.length > 0) {
      round.peerReviews.forEach((review, idx) => {
        htmlContent += `
          <div class="log-item">
            <div class="log-action">${review.reviewerName || (isSpanish ? 'Revisor' : 'Reviewer') + ' ' + (idx + 1)}</div>
            ${review.recommendation ? `<p><strong>${isSpanish ? 'Recomendación' : 'Recommendation'}:</strong> ${translateDecision(review.recommendation, isSpanish)}</p>` : ''}
            ${review.commentsToAuthor ? `<p><strong>${isSpanish ? 'Comentarios al Autor' : 'Comments to Author'}:</strong> ${getCleanText(review.commentsToAuthor)}</p>` : ''}
          </div>
        `;
      });
    }

    if (round.finalDecision) {
      htmlContent += `
        <div class="log-item">
          <div class="log-action">${isSpanish ? 'Decisión Final' : 'Final Decision'}</div>
          ${round.finalDecision.feedback ? `<p>${getCleanText(round.finalDecision.feedback)}</p>` : ''}
          ${round.finalDecision.decision ? `<p><strong>${isSpanish ? 'Decisión' : 'Decision'}:</strong> ${translateDecision(round.finalDecision.decision, isSpanish)}</p>` : ''}
        </div>
      `;
    }

    if (round.metadataProposals && round.metadataProposals.length > 0) {
      round.metadataProposals.forEach((proposal, idx) => {
        htmlContent += `
          <div class="proposal-item">
            <div class="log-action">${isSpanish ? 'Propuesta de Metadatos' : 'Metadata Proposal'} ${idx + 1}</div>
            ${proposal.changes.map(change => `
              <p><strong>${isSpanish ? 'Campo' : 'Field'}:</strong> ${change.field}</p>
              <p><strong>${isSpanish ? 'Valor Actual' : 'Current Value'}:</strong> ${JSON.stringify(change.currentValue)}</p>
              <p><strong>${isSpanish ? 'Valor Propuesto' : 'Proposed Value'}:</strong> ${JSON.stringify(change.proposedValue)}</p>
              <p><strong>${isSpanish ? 'Razón' : 'Reason'}:</strong> ${change.reason}</p>
            `).join('')}
            ${proposal.authorResponse ? `<p><strong>${isSpanish ? 'Respuesta del Autor' : 'Author Response'}:</strong> ${proposal.authorResponse.accepted ? (isSpanish ? 'Aceptada' : 'Accepted') : (isSpanish ? 'Rechazada' : 'Rejected')}</p>` : ''}
          </div>
        `;
      });
    }
    
    roundLogs.forEach(log => {
      htmlContent += `
        <div class="log-item">
          <div>
            <span class="log-action">${translateAction(log.action, isSpanish)}</span>
            <span class="log-date"> - ${formatDate(log.timestamp, isSpanish)}</span>
          </div>
          <table>
            <tr><td class="detail-label">${isSpanish ? 'Realizado por' : 'Performed by'}</td><td class="detail-value">${log.byEmail || log.by || 'Sistema'}</td></tr>
            ${Object.entries(log.details || {}).map(([key, value]) => `
              <tr><td class="detail-label">${key}</td><td class="detail-value">${typeof value === 'object' ? JSON.stringify(value) : value}</td></tr>
            `).join('')}
          </table>
        </div>
      `;
    });
  });

  htmlContent += '</body></html>';

  const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
  saveAs(blob, `historial_${submissionTitle || 'submission'}.doc`);
};

const exportToJSON = (allData, submissionTitle, isSpanish) => {
  const json = JSON.stringify(allData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
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
const MetadataProposalCard = ({ proposal, index, isSpanish }) => {
  const [expanded, setExpanded] = useState(true);
  
  const statusColors = {
    'approved': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'pending-author': 'bg-amber-50 text-amber-700 border-amber-200',
    'rejected': 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 text-[#002147] border-b border-slate-200 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icons.Tag className="w-5 h-5 text-[#FF6C0C]" />
          <span className="font-sans font-bold text-sm uppercase tracking-widest">
            {isSpanish ? 'Propuesta de Metadatos' : 'Metadata Proposal'} {index + 1}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {proposal.status && (
            <span className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest border ${statusColors[proposal.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
              {proposal.status === 'approved' ? (isSpanish ? 'Aprobada' : 'Approved') : 
               proposal.status === 'pending-author' ? (isSpanish ? 'Pendiente del Autor' : 'Pending Author') : 
               proposal.status === 'rejected' ? (isSpanish ? 'Rechazada' : 'Rejected') : proposal.status}
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
            <div className="p-6 space-y-6">
              {proposal.changes.map((change, idx) => (
                <div key={idx} className="bg-slate-50/50 p-4 rounded border border-slate-100">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    {change.field}
                  </p>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{isSpanish ? 'Valor Actual' : 'Current Value'}</p>
                      <div className="bg-white p-3 rounded border border-slate-200 text-sm font-serif text-slate-500 line-through">
                        {formatValue(change.currentValue, change.field)}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1.5">{isSpanish ? 'Valor Propuesto' : 'Proposed Value'}</p>
                      <div className="bg-white p-3 rounded border border-emerald-200 text-sm font-serif text-slate-800 font-medium">
                        {formatValue(change.proposedValue, change.field)}
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
                <div className="bg-slate-50 p-4 rounded border border-slate-200">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    {isSpanish ? 'Respuesta del Autor' : 'Author Response'}
                  </p>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${proposal.authorResponse.accepted ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {proposal.authorResponse.accepted ? (isSpanish ? 'Aceptada' : 'Accepted') : (isSpanish ? 'Rechazada' : 'Rejected')}
                    </span>
                    {proposal.authorResponse.respondedByEmail && (
                      <span className="text-xs font-mono text-slate-500">{proposal.authorResponse.respondedByEmail}</span>
                    )}
                  </div>
                  {proposal.authorResponse.comments && (
                    <p className="text-sm font-serif text-slate-700 italic">{proposal.authorResponse.comments}</p>
                  )}
                </div>
              )}
              
              <div className="flex items-center gap-4 text-xs font-mono text-slate-500 pt-4 border-t border-slate-100">
                {proposal.proposedByEmail && (
                  <span className="flex items-center gap-1.5">
                    <Icons.User />
                    {proposal.proposedByEmail}
                  </span>
                )}
                {proposal.proposedAt && (
                  <span className="flex items-center gap-1.5">
                    <Icons.Calendar />
                    {formatDate(proposal.proposedAt, isSpanish)}
                  </span>
                )}
              </div>
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
  const roundProposals = metadataProposals.filter(p => p.round === roundNumber);
  
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
              {roundProposals.length > 0 && ` • ${roundProposals.length} ${isSpanish ? 'propuestas de metadatos' : 'metadata proposals'}`}
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
              {roundProposals.length > 0 && (
                <div>
                  <h4 className="font-sans font-bold text-[#002147] text-sm uppercase tracking-widest border-b-2 border-[#002147] pb-2 mb-4 inline-block">
                    {isSpanish ? 'Propuestas de Metadatos' : 'Metadata Proposals'}
                  </h4>
                  <div className="space-y-3">
                    {roundProposals.map((proposal, idx) => (
                      <MetadataProposalCard
                        key={proposal.id || idx}
                        proposal={proposal}
                        index={idx}
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
                  <div className="bg-white border border-slate-200 rounded shadow-sm">
                    {roundLogs
                      .sort((a, b) => {
                        const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
                        const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
                        return dateB - dateA;
                      })
                      .map((log, idx, arr) => (
                        <div key={idx} className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 px-5 py-3 ${idx !== arr.length - 1 ? 'border-b border-slate-100' : ''}`}>
                          <span className="font-mono text-xs text-slate-400 w-32 flex-shrink-0">
                            {formatDate(log.timestamp, isSpanish)}
                          </span>
                          <span className="font-sans text-sm font-bold text-[#002147] flex-1">
                            {translateAction(log.action, isSpanish)}
                          </span>
                          <span className="font-sans text-xs text-slate-500">
                            {log.byEmail || log.by || 'Sistema'}
                          </span>
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
        const tasksQuery = query(collection(db, 'editorialTasks'), where('submissionId', '==', submissionId), orderBy('round', 'asc'));
        const tasksSnapshot = await getDocs(tasksQuery);

        // Cargar reviewerAssignments (PEER REVIEWS)
        const assignmentsQuery = query(collection(db, 'reviewerAssignments'), where('submissionId', '==', submissionId), where('status', '==', 'submitted'));
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
        const auditLogsQuery = query(collection(db, 'submissions', submissionId, 'auditLogs'), orderBy('timestamp', 'asc'));
        const auditLogsSnapshot = await getDocs(auditLogsQuery);
        const logs = [];
        auditLogsSnapshot.forEach((doc) => logs.push({ id: doc.id, ...doc.data() }));
        setAuditLogs(logs);

        // Cargar versiones (subcollection)
        const versionsQuery = query(collection(db, 'submissions', submissionId, 'versions'), orderBy('uploadedAt', 'asc'));
        const versionsSnapshot = await getDocs(versionsQuery);
        const versionsData = [];
        versionsSnapshot.forEach((doc) => {
          const data = doc.data();
          versionsData.push({ id: doc.id, ...data, round: data.round || 1 });
        });
        setVersions(versionsData);

        // Cargar metadataProposals (subcollection)
        let proposalsData = [];
        try {
          const proposalsSnapshot = await getDocs(collection(db, 'submissions', submissionId, 'metadataProposals'));
          proposalsSnapshot.forEach((doc) => {
            const data = doc.data();
            const proposalRound = data.round || 1;
            proposalsData.push({
              id: doc.id,
              ...data,
              round: proposalRound,
              proposedAt: data.proposedAt || null,
              authorResponse: data.authorResponse || null,
            });
          });
        } catch (err) {
          console.log('No metadataProposals collection found');
        }
        setMetadataProposals(proposalsData);

        // Cargar roundHistory (subcollection)
        let roundHistoryData = {};
        try {
          const roundHistorySnapshot = await getDocs(collection(db, 'submissions', submissionId, 'roundHistory'));
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
          
          // Desk Review
          if (data.deskReviewDecision || data.deskReviewFeedback || data.deskReviewComments) {
            roundData.deskReview = {
              decision: data.deskReviewDecision || null,
              feedback: data.deskReviewFeedback || null,
              commentsToEditorial: data.deskReviewComments || null,
              editorName: data.assignedToName || null,
            };
          }
          
          // Final Decision
          if (data.finalDecision || data.finalDecisionFeedback) {
            roundData.finalDecision = {
              decision: data.finalDecision || null,
              feedback: data.finalDecisionFeedback || null,
              editorName: data.assignedToName || null,
            };
          }
        });

        // Procesar roundHistory para completar/sobrescribir datos
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
            
            // Desk Review from roundHistory (takes precedence)
            if (historyData.deskReviewFeedback || historyData.deskReviewDecision) {
              roundData.deskReview = {
                decision: historyData.deskReviewDecision || null,
                feedback: historyData.deskReviewFeedback || null,
                commentsToEditorial: historyData.deskReviewComments || null,
                editorName: historyData.deskReviewEditor || null,
              };
            }

            // Final Decision from roundHistory (takes precedence)
            if (historyData.finalDecision || historyData.finalFeedback || historyData.decision) {
              roundData.finalDecision = {
                decision: historyData.finalDecision || historyData.decision || null,
                feedback: historyData.finalFeedback || historyData.feedback || null,
                editorName: historyData.finalEditor || historyData.editorName || null,
              };
            }
          }
        });

        // Asignar propuestas de metadatos a las rondas
        proposalsData.forEach(proposal => {
          const roundNumber = proposal.round || 1;
          if (roundsMap.has(roundNumber)) {
            const roundData = roundsMap.get(roundNumber);
            if (!roundData.metadataProposals) {
              roundData.metadataProposals = [];
            }
            roundData.metadataProposals.push(proposal);
          }
        });

        if (roundsMap.size === 0) {
          roundsMap.set(1, { roundNumber: 1, status: 'active', deskReview: null, finalDecision: null, metadataProposals: [] });
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

  const handleExport = (type) => {
    switch (type) {
      case 'json':
        exportToJSON({ rounds, auditLogs, versions, peerReviews, metadataProposals }, submissionTitle, isSpanish);
        break;
      case 'pdf':
        exportToPDF(auditLogs, rounds, submissionTitle, isSpanish);
        break;
      case 'word':
        exportToWord(auditLogs, rounds, submissionTitle, isSpanish);
        break;
      case 'excel':
        exportToExcel(auditLogs, rounds, submissionTitle, isSpanish);
        break;
      case 'csv':
        exportToCSV(auditLogs, rounds, submissionTitle, isSpanish);
        break;
      default:
        break;
    }
  };

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
          
          <div className="flex flex-wrap gap-3">
            <button onClick={() => handleExport('pdf')} className="flex items-center gap-2 bg-transparent border border-slate-500 hover:border-white hover:bg-white hover:text-[#002147] text-white px-4 py-2.5 rounded transition-all text-xs font-bold uppercase tracking-widest shadow-sm">
              <Icons.FilePdf /> PDF
            </button>
            <button onClick={() => handleExport('word')} className="flex items-center gap-2 bg-transparent border border-slate-500 hover:border-white hover:bg-white hover:text-[#002147] text-white px-4 py-2.5 rounded transition-all text-xs font-bold uppercase tracking-widest shadow-sm">
              <Icons.DocumentText /> Word
            </button>
            <button onClick={() => handleExport('excel')} className="flex items-center gap-2 bg-transparent border border-slate-500 hover:border-white hover:bg-white hover:text-[#002147] text-white px-4 py-2.5 rounded transition-all text-xs font-bold uppercase tracking-widest shadow-sm">
              <Icons.FileSpreadsheet /> Excel
            </button>
            <button onClick={() => handleExport('csv')} className="flex items-center gap-2 bg-transparent border border-slate-500 hover:border-white hover:bg-white hover:text-[#002147] text-white px-4 py-2.5 rounded transition-all text-xs font-bold uppercase tracking-widest shadow-sm">
              <Icons.Download /> CSV
            </button>
            <button onClick={() => handleExport('json')} className="flex items-center gap-2 bg-transparent border border-slate-500 hover:border-white hover:bg-white hover:text-[#002147] text-white px-4 py-2.5 rounded transition-all text-xs font-bold uppercase tracking-widest shadow-sm">
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