// src/components/ReviewHistoryTab.js
import React, { useState, useEffect, useCallback } from 'react';
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
    'external_reviewer_invited': isSpanish ? 'Revisor Externo Invitado' : 'External Reviewer Invited',
    'external_reviewer_onboarded': isSpanish ? 'Revisor Externo Registrado' : 'External Reviewer Onboarded',
  };
  return translations[action] || action;
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

// ============ FORMATEAR DETALLES DEL LOG ============
const formatLogDetails = (log, isSpanish) => {
  const { action, details, by, byEmail, to, toEmail, timestamp, round, recommendation, notes, fileName } = log;
  const lines = [];
  
  if (by && by !== 'system') {
    lines.push({ label: isSpanish ? 'Realizado por' : 'Performed by', value: byEmail || by });
  }
  
  if (details && typeof details === 'object') {
    if (details.reviewerEmail) {
      lines.push({ label: isSpanish ? 'Revisor' : 'Reviewer', value: details.reviewerEmail });
    }
    if (details.reviewerName) {
      lines.push({ label: isSpanish ? 'Nombre' : 'Name', value: details.reviewerName });
    }
  }
  
  if (recommendation) {
    lines.push({ label: isSpanish ? 'Recomendación' : 'Recommendation', value: translateDecision(recommendation, isSpanish) });
  }
  
  return lines;
};

// ============ FUNCIÓN PARA EXPORTAR A EXCEL DIRECTO ============
const exportToExcel = (auditLogs, rounds, submissionTitle, isSpanish) => {
  const data = [];
  
  auditLogs
    .sort((a, b) => {
      const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
      const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
      return dateA - dateB;
    })
    .forEach(log => {
      const details = formatLogDetails(log, isSpanish);
      const detailMap = {};
      details.forEach(d => {
        detailMap[d.label] = d.value;
      });
      
      data.push({
        [isSpanish ? 'Fecha' : 'Date']: formatDate(log.timestamp, isSpanish),
        [isSpanish ? 'Acción' : 'Action']: translateAction(log.action, isSpanish),
        [isSpanish ? 'Ronda' : 'Round']: log.round || '1',
        [isSpanish ? 'Realizado por' : 'Performed by']: log.by === 'system' ? (isSpanish ? 'Sistema' : 'System') : (log.byEmail || log.by || ''),
        [isSpanish ? 'Email' : 'Email']: log.byEmail || log.toEmail || '',
        [isSpanish ? 'Detalles' : 'Details']: detailMap[isSpanish ? 'Detalles' : 'Details'] || '',
        [isSpanish ? 'Recomendación' : 'Recommendation']: log.recommendation ? translateDecision(log.recommendation, isSpanish) : '',
        [isSpanish ? 'Notas' : 'Notes']: log.notes || '',
        [isSpanish ? 'Archivo' : 'File']: log.fileName || '',
      });
    });

  const ws = XLSX.utils.json_to_sheet(data);
  
  const colWidths = [
    { wch: 25 }, { wch: 30 }, { wch: 8 }, { wch: 25 },
    { wch: 30 }, { wch: 40 }, { wch: 20 }, { wch: 30 }, { wch: 30 },
  ];
  ws['!cols'] = colWidths;
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, isSpanish ? 'Historial' : 'History');
  
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `historial_${submissionTitle || 'submission'}.xlsx`);
};

// ============ FUNCIÓN PARA EXPORTAR A PDF DIRECTO ============
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
  doc.setTextColor(0, 59, 92);
  doc.setFont('helvetica', 'bold');
  doc.text(isSpanish ? 'Historial de Auditoría' : 'Audit History', margin, yPosition);
  
  yPosition += 10;
  
  doc.setDrawColor(0, 59, 92);
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
    
    if (roundLogs.length === 0 && !round.deskReview && !round.finalDecision && !round.versions?.length) return;
    
    checkPageBreak(40);
    
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, yPosition - 6, pageWidth - 2 * margin, 12, 'F');
    
    doc.setFillColor(0, 59, 92);
    doc.rect(margin, yPosition - 6, 4, 12, 'F');
    
    doc.setFontSize(14);
    doc.setTextColor(0, 59, 92);
    doc.setFont('helvetica', 'bold');
    const roundTitle = `${isSpanish ? 'Ronda' : 'Round'} ${round.roundNumber}`;
    doc.text(roundTitle, margin + 10, yPosition + 2);
    
    yPosition += 15;

    // Mostrar versiones del manuscrito
    if (round.versions && round.versions.length > 0) {
      round.versions.forEach((version, vIdx) => {
        checkPageBreak(30);
        
        doc.setFontSize(11);
        doc.setTextColor(59, 130, 246);
        doc.setFont('helvetica', 'bold');
        const versionTitle = `${isSpanish ? 'Versión' : 'Version'} ${version.version || vIdx + 1}`;
        doc.text(versionTitle, margin, yPosition);
        
        yPosition += 6;
        
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.setFont('helvetica', 'normal');
        
        if (version.fileName) {
          doc.text(`${isSpanish ? 'Archivo' : 'File'}: ${version.fileName}`, margin + 10, yPosition);
          yPosition += 5;
        }
        
        if (version.uploadedAt) {
          doc.text(`${isSpanish ? 'Subido' : 'Uploaded'}: ${formatDate(version.uploadedAt, isSpanish)}`, margin + 10, yPosition);
          yPosition += 5;
        }
        
        if (version.notes) {
          const cleanNotes = version.notes.replace(/<[^>]*>/g, '');
          const lines = doc.splitTextToSize(cleanNotes, pageWidth - 2 * margin - 20);
          checkPageBreak(lines.length * 5 + 10);
          doc.text(lines, margin + 10, yPosition);
          yPosition += lines.length * 5 + 5;
        }
        
        if (version.revisionComment) {
          const cleanComment = version.revisionComment.replace(/<[^>]*>/g, '');
          const lines = doc.splitTextToSize(cleanComment, pageWidth - 2 * margin - 20);
          checkPageBreak(lines.length * 5 + 10);
          doc.text(lines, margin + 10, yPosition);
          yPosition += lines.length * 5 + 5;
        }
        
        yPosition += 10;
      });
    }

    if (round.deskReview) {
      checkPageBreak(30);
      
      doc.setFontSize(11);
      doc.setTextColor(0, 59, 92);
      doc.setFont('helvetica', 'bold');
      doc.text(isSpanish ? 'Desk Review' : 'Desk Review', margin, yPosition);
      
      yPosition += 6;
      
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'normal');
      
      if (round.deskReview.feedback) {
        const cleanText = round.deskReview.feedback.replace(/<[^>]*>/g, '');
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
        const cleanText = round.finalDecision.feedback.replace(/<[^>]*>/g, '');
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

    roundLogs.forEach((log, logIndex) => {
      const details = formatLogDetails(log, isSpanish);
      const estimatedHeight = details.length * 15 + 20;
      
      checkPageBreak(estimatedHeight);
      
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, details.length * 15 + 15, 'F');
      
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, details.length * 15 + 15);
      
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.text(translateAction(log.action, isSpanish), margin + 10, yPosition);
      
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.text(formatDate(log.timestamp, isSpanish), pageWidth - margin - 10, yPosition, { align: 'right' });
      
      yPosition += 8;
      
      details.forEach(detail => {
        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184);
        doc.setFont('helvetica', 'bold');
        doc.text(detail.label.toUpperCase(), margin + 15, yPosition);
        
        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'normal');
        const valueLines = doc.splitTextToSize(String(detail.value), pageWidth - 2 * margin - 40);
        doc.text(valueLines, margin + 50, yPosition);
        
        yPosition += valueLines.length * 4 + 2;
      });
      
      yPosition += 12;
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

// ============ FUNCIÓN PARA EXPORTAR A CSV ============
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
  saveAs(blob, `historial_${submissionTitle || 'submission'}.csv`);
};

// ============ FUNCIÓN PARA EXPORTAR A WORD ============
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
        h1 { font-family: Arial, sans-serif; font-size: 24px; color: #003b5c; }
        .round-header { font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; color: #003b5c; background: #f8fafc; padding: 8px; }
        .log-item { margin: 10px 0; padding: 8px; border: 1px solid #e2e8f0; }
        .log-action { font-weight: bold; color: #1e293b; }
        .log-date { color: #64748b; font-size: 11px; }
        .detail-label { font-weight: bold; color: #94a3b8; font-size: 10px; text-transform: uppercase; }
        .detail-value { color: #334155; }
        .version-item { margin: 10px 0; padding: 8px; border: 1px solid #bfdbfe; background: #eff6ff; }
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
    
    // Versiones del manuscrito
    if (round.versions && round.versions.length > 0) {
      round.versions.forEach((version, vIdx) => {
        htmlContent += `
          <div class="version-item">
            <div class="log-action">${isSpanish ? 'Versión' : 'Version'} ${version.version || vIdx + 1}</div>
            ${version.fileName ? `<p><strong>${isSpanish ? 'Archivo' : 'File'}:</strong> ${version.fileName}</p>` : ''}
            ${version.uploadedAt ? `<p><strong>${isSpanish ? 'Subido' : 'Uploaded'}:</strong> ${formatDate(version.uploadedAt, isSpanish)}</p>` : ''}
            ${version.notes ? `<p><strong>${isSpanish ? 'Notas del Autor' : 'Author Notes'}:</strong> ${version.notes.replace(/<[^>]*>/g, '')}</p>` : ''}
            ${version.revisionComment ? `<p><strong>${isSpanish ? 'Comentario de Revisión' : 'Revision Comment'}:</strong> ${version.revisionComment.replace(/<[^>]*>/g, '')}</p>` : ''}
          </div>
        `;
      });
    }
    
    if (round.deskReview) {
      htmlContent += `
        <div class="log-item">
          <div class="log-action">${isSpanish ? 'Desk Review' : 'Desk Review'}</div>
          ${round.deskReview.feedback ? `<p>${round.deskReview.feedback.replace(/<[^>]*>/g, '')}</p>` : ''}
        </div>
      `;
    }
    
    roundLogs.forEach(log => {
      const details = formatLogDetails(log, isSpanish);
      htmlContent += `
        <div class="log-item">
          <div>
            <span class="log-action">${translateAction(log.action, isSpanish)}</span>
            <span class="log-date"> - ${formatDate(log.timestamp, isSpanish)}</span>
          </div>
          <table>
            ${details.map(d => `
              <tr>
                <td class="detail-label">${d.label}</td>
                <td class="detail-value">${d.value}</td>
              </tr>
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
    <div className="bg-white rounded-sm border border-slate-200 shadow-sm overflow-hidden">
      {/* Encabezado del revisor */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 sm:px-5 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 bg-[#003b5c] text-white rounded-sm flex items-center justify-center font-serif text-base font-bold flex-shrink-0">
            {review.reviewerName?.charAt(0) || `R${index + 1}`}
          </div>
          <div className="text-left flex-1 min-w-0">
            <span className="font-serif font-bold text-slate-800 text-sm block truncate">
              {review.reviewerName || `${isSpanish ? 'Revisor' : 'Reviewer'} ${index + 1}`}
            </span>
            {review.reviewerEmail && (
              <span className="text-xs text-slate-400 font-mono block truncate">
                {review.reviewerEmail}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {review.recommendation && (
            <span className={`px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider border ${recommendationColors[review.recommendation] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
              {translateDecision(review.recommendation, isSpanish)}
            </span>
          )}
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
            <div className="border-t border-slate-100 p-4 sm:p-5 space-y-4 bg-slate-50/30">
              {/* Scores */}
              {review.scores && Object.keys(review.scores).length > 0 && (
                <div>
                  <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                    {isSpanish ? 'Rúbrica Cuantitativa' : 'Quantitative Rubric'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(review.scores).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between bg-white px-3 py-2 rounded-sm border border-slate-100">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">{key}</span>
                        <span className="text-xs font-bold text-[#003b5c]">{value}/5</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Comentarios al autor */}
              {review.commentsToAuthor && (
                <div>
                  <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-500 mb-1.5 block flex items-center gap-1">
                    <Icons.Message />
                    {isSpanish ? 'Comentarios al Autor' : 'Comments to Author'}
                  </label>
                  <div 
                    className="review-content ql-editor read-only prose prose-sm max-w-none font-serif text-slate-700 leading-relaxed bg-white p-3 rounded-sm border border-slate-100"
                    dangerouslySetInnerHTML={{ __html: review.commentsToAuthor }}
                  />
                </div>
              )}
              
              {/* Comentarios confidenciales */}
              {review.commentsToEditor && (
                <div>
                  <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-amber-600 mb-1.5 block flex items-center gap-1">
                    <Icons.Lock />
                    {isSpanish ? 'Comentarios Confidenciales al Editor' : 'Confidential Comments to Editor'}
                  </label>
                  <div 
                    className="review-content ql-editor read-only prose prose-sm max-w-none font-serif text-amber-800 leading-relaxed bg-amber-50/50 p-3 rounded-sm border border-amber-100"
                    dangerouslySetInnerHTML={{ __html: review.commentsToEditor }}
                  />
                </div>
              )}
              
              {/* Documento del revisor */}
              {review.reviewerFileUrl && (
                <a
                  href={review.reviewerFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#003b5c] hover:text-[#e86125] transition-colors"
                >
                  <Icons.File />
                  {isSpanish ? 'Ver documento marcado' : 'View marked document'}
                  <Icons.ExternalLink />
                </a>
              )}
              
              {/* Fecha */}
              {review.submittedAt && (
                <div className="pt-2 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-400">
                  <Icons.Calendar />
                  {formatDate(review.submittedAt, isSpanish)}
                </div>
              )}
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
    <div className="bg-white rounded-sm border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 sm:px-5 py-3 bg-[#003b5c] text-white"
      >
        <div className="flex items-center gap-2">
          <Icons.ClipboardCheck className="w-5 h-5" />
          <span className="font-serif font-bold text-sm uppercase tracking-wider">
            {isSpanish ? 'Desk Review' : 'Desk Review'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {deskReview.decision && (
            <span className="px-2 py-0.5 bg-white/15 text-white text-[10px] font-bold uppercase tracking-wider rounded-sm">
              {translateDecision(deskReview.decision, isSpanish)}
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
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="p-4 sm:p-5 space-y-4">
              {deskReview.feedback && (
                <div>
                  <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                    {isSpanish ? 'Retroalimentación al Autor' : 'Feedback to Author'}
                  </label>
                  <div 
                    className="review-content ql-editor read-only prose prose-sm max-w-none font-serif text-slate-700 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: deskReview.feedback }}
                  />
                </div>
              )}
              
              {deskReview.commentsToEditorial && (
                <div className="border-t border-slate-100 pt-3">
                  <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-amber-600 mb-1.5 block flex items-center gap-1">
                    <Icons.Lock />
                    {isSpanish ? 'Notas Internas' : 'Internal Notes'}
                  </label>
                  <div 
                    className="review-content ql-editor read-only prose prose-sm max-w-none font-serif text-slate-600 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: deskReview.commentsToEditorial }}
                  />
                </div>
              )}
              
              {deskReview.editorName && (
                <div className="flex items-center gap-2 text-xs text-slate-500 pt-2 border-t border-slate-100">
                  <Icons.User />
                  {deskReview.editorName}
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
  const [expandedLogs, setExpandedLogs] = useState({});
  
  const roundLogs = auditLogs.filter(log => log.round === roundNumber || (log.round === undefined && roundNumber === 1));
  const roundVersions = versions.filter(v => v.round === roundNumber);
  const roundPeerReviews = peerReviews.filter(r => r.round === roundNumber);
  
  return (
    <div className={`bg-white rounded-sm border-2 shadow-sm mb-4 ${isCurrentRound ? 'border-[#003b5c]' : 'border-slate-200'}`}>
      {/* Encabezado de ronda */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-serif font-bold text-sm ${
            isCurrentRound ? 'bg-[#003b5c] text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            R{roundNumber}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-serif font-bold text-slate-800 text-sm sm:text-base">
                {isSpanish ? 'Ronda' : 'Round'} {roundNumber}
              </span>
              {isCurrentRound && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#003b5c] text-white text-[10px] font-bold uppercase tracking-wider rounded-full">
                  <Icons.Clock />
                  {isSpanish ? 'Actual' : 'Current'}
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400 font-sans">
              {roundLogs.length} {isSpanish ? 'eventos' : 'events'}
              {roundVersions.length > 0 && ` · ${roundVersions.length} ${isSpanish ? 'versiones' : 'versions'}`}
              {roundPeerReviews.length > 0 && ` · ${roundPeerReviews.length} ${isSpanish ? 'revisiones' : 'reviews'}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {roundData.status && (
            <span className="px-2 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
              {roundData.status}
            </span>
          )}
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
            <div className="border-t border-slate-200 p-4 sm:p-6 space-y-8">
              
              {/* ============ DESK REVIEW (SEPARADO) ============ */}
              {roundData.deskReview && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-1 h-5 bg-[#003b5c] rounded-full"></span>
                    <h4 className="font-serif font-bold text-slate-800 text-sm uppercase tracking-wider">
                      {isSpanish ? 'Desk Review' : 'Desk Review'}
                    </h4>
                  </div>
                  <DeskReviewCard deskReview={roundData.deskReview} isSpanish={isSpanish} />
                </div>
              )}

              {/* ============ REVISIONES DE PARES (SEPARADO) ============ */}
              {roundPeerReviews.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-1 h-5 bg-sky-500 rounded-full"></span>
                    <h4 className="font-serif font-bold text-slate-800 text-sm uppercase tracking-wider">
                      {isSpanish ? 'Revisiones de Pares' : 'Peer Reviews'} ({roundPeerReviews.length})
                    </h4>
                  </div>
                  <div className="space-y-3">
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

              {/* ============ VERSIONES ============ */}
              {roundVersions.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-1 h-5 bg-blue-500 rounded-full"></span>
                    <h4 className="font-serif font-bold text-slate-800 text-sm uppercase tracking-wider">
                      {isSpanish ? 'Versiones del Manuscrito' : 'Manuscript Versions'} ({roundVersions.length})
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {roundVersions.map((version, idx) => (
                      <div key={version.id || idx} className="bg-blue-50/30 rounded-sm p-3 border border-blue-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icons.File />
                          <div>
                            <span className="text-sm font-serif text-slate-700 block">{version.fileName || `Versión ${idx + 1}`}</span>
                            {version.notes && (
                              <span className="text-xs text-slate-500 italic">{version.notes.substring(0, 80)}...</span>
                            )}
                          </div>
                        </div>
                        {version.fileUrl && (
                          <a
                            href={version.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold uppercase tracking-wider text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            <Icons.ExternalLink />
                            {isSpanish ? 'Ver' : 'View'}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ============ REGISTRO DE ACTIVIDAD ============ */}
              {roundLogs.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-1 h-5 bg-purple-500 rounded-full"></span>
                    <h4 className="font-serif font-bold text-slate-800 text-sm uppercase tracking-wider">
                      <Icons.Activity className="inline w-4 h-4 mr-1" />
                      {isSpanish ? 'Registro de Actividad' : 'Activity Log'} ({roundLogs.length})
                    </h4>
                  </div>
                  <div className="space-y-1.5">
                    {roundLogs
                      .sort((a, b) => {
                        const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
                        const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
                        return dateB - dateA;
                      })
                      .map((log, idx) => (
                        <div key={idx} className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-sm text-xs">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            log.action.includes('review') ? 'bg-sky-500' :
                            log.action.includes('desk') ? 'bg-[#003b5c]' :
                            log.action.includes('revision') ? 'bg-amber-500' : 'bg-slate-400'
                          }`}></span>
                          <span className="font-sans font-bold text-slate-700 flex-shrink-0">
                            {translateAction(log.action, isSpanish)}
                          </span>
                          <span className="text-slate-400 flex-1 truncate">
                            {formatDate(log.timestamp, isSpanish)}
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

        // Cargar reviewerAssignments (PEER REVIEWS - separado)
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

        // Cargar roundHistory (subcollection - NUEVO SISTEMA)
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
            });
          }
          
          const roundData = roundsMap.get(round);
          
          // Desk Review (separado de peer reviews)
          if (data.deskReviewDecision || data.deskReviewFeedback || data.deskReviewComments) {
            roundData.deskReview = {
              decision: data.deskReviewDecision || null,
              feedback: data.deskReviewFeedback || null,
              commentsToEditorial: data.deskReviewComments || null,
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
              });
            }
            
            const roundData = roundsMap.get(roundNumber);
            if (!roundData.deskReview && historyData.deskReviewFeedback) {
              roundData.deskReview = {
                decision: historyData.deskReviewDecision || null,
                feedback: historyData.deskReviewFeedback || null,
                commentsToEditorial: historyData.deskReviewComments || null,
                editorName: historyData.deskReviewEditor || null,
              };
            }
          }
        });

        if (roundsMap.size === 0) {
          roundsMap.set(1, { roundNumber: 1, status: 'active', deskReview: null });
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
      {/* Encabezado editorial */}
      <div className="bg-[#003b5c] text-white rounded-sm p-4 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Icons.ClipboardCheck className="w-6 h-6" />
            <div>
              <h3 className="font-serif text-lg sm:text-xl font-bold">
                {isSpanish ? 'Historial de Retroalimentaciones' : 'Feedback History'}
              </h3>
              <p className="text-sky-200 text-sm mt-1 font-sans">
                {submissionTitle || submissionId}
              </p>
            </div>
          </div>
          
          {/* Botones de exportación */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => exportToExcel(auditLogs, rounds, submissionTitle, isSpanish)} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-sm transition-colors text-xs font-bold uppercase tracking-wider">
              <Icons.FileSpreadsheet /> Excel
            </button>
            <button onClick={() => exportToPDF(auditLogs, rounds, submissionTitle, isSpanish)} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-sm transition-colors text-xs font-bold uppercase tracking-wider">
              <Icons.FilePdf /> PDF
            </button>
            <button onClick={() => exportToWord(auditLogs, rounds, submissionTitle, isSpanish)} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-sm transition-colors text-xs font-bold uppercase tracking-wider">
              <Icons.DocumentText /> Word
            </button>
            <button onClick={() => exportToCSV(auditLogs, rounds, submissionTitle, isSpanish)} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-sm transition-colors text-xs font-bold uppercase tracking-wider">
              <Icons.Download /> CSV
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
              versions={versions}
              peerReviews={peerReviews}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-sm border border-slate-200">
          <Icons.DocumentText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-serif">
            {isSpanish ? 'No hay historial disponible.' : 'No history available.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default ReviewHistoryTab;