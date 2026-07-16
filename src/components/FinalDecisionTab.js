// src/components/FinalDecisionTab.js
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import ImageResize from 'quill-image-resize-module-react';
import { useLanguage } from '../hooks/useLanguage';
import { useEditorialReview } from '../hooks/useEditorialReview';
import { useAuth } from '../hooks/useAuth';
import { debounce } from 'lodash';

// Registrar módulo de redimensionamiento de imágenes para Quill
if (typeof Quill !== 'undefined') {
  Quill.register('modules/imageResize', ImageResize);
}

// ============ ICONOS SVG PROFESIONALES ============
const Icons = {
  CheckCircle: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  AlertCircle: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Clock: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Eye: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
  FileText: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Users: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  Lock: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
  ChevronDown: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>,
  ChevronUp: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>,
  Send: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>,
  Refresh: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
};

// Componente para bloques de información estilo panel
const InfoBlock = ({ icon: Icon, title, children, className = '' }) => (
  <div className={`bg-white rounded-sm border border-gray-200 shadow-sm ${className}`}>
    <div className="bg-slate-50 px-5 py-3 border-b border-gray-200 flex items-center gap-2">
      {Icon && <span className="text-[#003b5c]"><Icon /></span>}
      <h3 className="font-sans font-bold text-slate-800 text-xs uppercase tracking-wider">
        {title}
      </h3>
    </div>
    <div className="p-5">
      {children}
    </div>
  </div>
);

// Componente para badge de estado
const StatusBadge = ({ status, isSpanish }) => {
  const statusMap = {
    'submitted': { label: isSpanish ? 'Enviada' : 'Submitted', colors: 'bg-blue-50 text-blue-700 border-blue-200' },
    'pending': { label: isSpanish ? 'Pendiente' : 'Pending', colors: 'bg-amber-50 text-amber-700 border-amber-200' },
    'completed': { label: isSpanish ? 'Completada' : 'Completed', colors: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
  };
  
  const badge = statusMap[status] || { label: status, colors: 'bg-slate-100 text-slate-700 border-slate-200' };
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-sm text-[10px] font-sans font-bold uppercase tracking-wider border ${badge.colors}`}>
      {badge.label}
    </span>
  );
};

// Componente para recomendación de revisor
const RecommendationBadge = ({ recommendation, isSpanish }) => {
  const recMap = {
    'accept': { label: isSpanish ? 'Aceptar' : 'Accept', colors: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    'minor-revisions': { label: isSpanish ? 'Revisiones menores' : 'Minor revisions', colors: 'bg-blue-50 text-blue-700 border-blue-200' },
    'major-revisions': { label: isSpanish ? 'Revisiones mayores' : 'Major revisions', colors: 'bg-amber-50 text-amber-700 border-amber-200' },
    'reject': { label: isSpanish ? 'Rechazar' : 'Reject', colors: 'bg-rose-50 text-rose-700 border-rose-200' }
  };
  
  const rec = recMap[recommendation] || { label: recommendation, colors: 'bg-slate-100 text-slate-700 border-slate-200' };
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-sm text-[10px] font-sans font-bold uppercase tracking-wider border ${rec.colors}`}>
      {rec.label}
    </span>
  );
};

export const FinalDecisionTab = ({ task, reviewers, onSubmitDecision, loading: externalLoading }) => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { submitDeskReviewDecision, loading: hookLoading } = useEditorialReview(user);
  const isSpanish = language === 'es';
  
  const [decision, setDecision] = useState('');
  const [feedback, setFeedback] = useState('');
  const [internalComments, setInternalComments] = useState('');
  const [selectedReview, setSelectedReview] = useState(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
const [localError, setLocalError] = useState('');  
  const quillRef = useRef(null);
  const internalQuillRef = useRef(null);

  const loading = externalLoading || hookLoading || localLoading;

  // Configuración del editor Quill para feedback al autor
  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      ['blockquote', 'code-block'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      ['link', 'image'],
      ['clean']
    ],
    imageResize: {
      parchment: Quill.import('parchment'),
      modules: ['Resize', 'DisplaySize']
    }
  };

  const quillFormats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'blockquote', 'code-block',
    'list', 'bullet', 'indent',
    'link', 'image'
  ];

  // Manejar cambio en el editor Quill con debounce para rendimiento
  const handleFeedbackChange = debounce((value) => {
    setFeedback(value);
    if (value.trim().length > 0) {
      setFeedbackError('');
    }
  }, 300);

  const handleInternalCommentsChange = debounce((value) => {
    setInternalComments(value);
  }, 300);

  const handleSubmit = async () => {
    if (!decision) {
      alert(isSpanish ? 'Selecciona una decisión' : 'Select a decision');
      return;
    }

    // Validar que el feedback no esté vacío
    const cleanFeedback = feedback.replace(/<[^>]*>/g, '').trim();
    if (!cleanFeedback) {
      setFeedbackError(isSpanish ? 'El feedback para el autor es obligatorio' : 'Feedback to author is required');
      // Enfocar el editor Quill
      if (quillRef.current) {
        quillRef.current.focus();
      }
      return;
    }

    if (!task?.editorialReviewId) {
      console.error('No editorialReviewId found in task:', task);
      alert(isSpanish 
        ? 'Error: No se encontró el ID de la revisión editorial' 
        : 'Error: Editorial review ID not found');
      return;
    }

    setLocalLoading(true);
    try {
      const result = await submitDeskReviewDecision(task.editorialReviewId, {
        decision,
        feedbackToAuthor: feedback,
        commentsToEditorial: internalComments,
        submissionId: task.submissionId,
        editorialTaskId: task.id
      });

      console.log('✅ Decisión guardada:', result);
      
      if (onSubmitDecision) {
        await onSubmitDecision(task.id, { 
          decision, 
          feedbackToAuthor: feedback, 
          commentsToEditorial: internalComments 
        });
      }

      setDecision('');
      setFeedback('');
      setInternalComments('');
      setFeedbackError('');
      
      // Resetear editores Quill
      if (quillRef.current) {
        const quill = quillRef.current.getEditor();
        quill.setContents([]);
      }
      if (internalQuillRef.current) {
        const quill = internalQuillRef.current.getEditor();
        quill.setContents([]);
      }
      
    } catch (error) {
      console.error('❌ Error al guardar decisión:', error);
      alert(isSpanish 
        ? `Error al guardar la decisión: ${error.message}` 
        : `Error saving decision: ${error.message}`);
    } finally {
      setLocalLoading(false);
    }
  };

  // Función para obtener el texto plano del contenido HTML de Quill
  const getPlainText = (html) => {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };

  return (
    <div className="space-y-8 font-sans">
      
      {/* Banner de Flujo de Revisiones */}
      {(decision === 'major-revision' || decision === 'minor-revision') && (
        <div className="bg-white border-l-4 border-[#003b5c] border-y border-r border-slate-200 rounded-sm p-5 shadow-sm flex gap-4 items-start">
          <div className="mt-0.5 text-[#003b5c]"><Icons.Refresh /></div>
          <div>
            <h4 className="font-sans font-bold text-xs text-slate-800 uppercase tracking-wider mb-1">
              {isSpanish ? 'Flujo de Revisiones Solicitadas' : 'Revision Request Flow'}
            </h4>
            <p className="text-slate-600 text-sm leading-relaxed">
              {isSpanish 
                ? 'Al guardar esta decisión, el estado del artículo cambiará a "revisions-requested". El autor recibirá una notificación y podrá subir una versión revisada. El sistema quedará en espera de la respuesta del autor.'
                : 'When saving this decision, the article status will change to "revisions-requested". The author will receive a notification and can upload a revised version. The system will await the author\'s response.'}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-sm font-sans font-bold uppercase tracking-wider border border-slate-200">
                {isSpanish ? 'Estado actual:' : 'Current state:'} {task?.submission?.status || '—'}
              </span>
              <Icons.ArrowRight className="text-slate-400" />
              <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-sm font-sans font-bold uppercase tracking-wider border border-amber-200">
                {isSpanish ? '→ revisions-requested' : '→ revisions-requested'}
              </span>
              <Icons.ArrowRight className="text-slate-400" />
              <span className="bg-purple-50 text-purple-700 px-3 py-1 rounded-sm font-sans font-bold uppercase tracking-wider border border-purple-200">
                {isSpanish ? 'Esperando autor' : 'Awaiting author'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Estado de Espera de Revisiones */}
      {task?.submission?.status === 'revisions-requested' && (
        <div className="bg-white border-l-4 border-amber-500 border-y border-r border-slate-200 rounded-sm p-5 shadow-sm flex gap-4 items-start">
          <div className="mt-0.5 text-amber-500"><Icons.Clock /></div>
          <div>
            <h4 className="font-sans font-bold text-xs text-slate-800 uppercase tracking-wider mb-1">
              {isSpanish ? 'Esperando Revisión del Autor' : 'Awaiting Author Revision'}
            </h4>
            <p className="text-slate-600 text-sm leading-relaxed">
              {isSpanish 
                ? 'Este artículo está actualmente en espera de que el autor suba una versión revisada. El sistema notificará automáticamente cuando se reciba la nueva versión.'
                : 'This article is currently awaiting the author to upload a revised version. The system will automatically notify when the new version is received.'}
            </p>
            {task.submissionRevision?.requestedAt && (
              <p className="text-xs text-slate-500 font-sans mt-2">
                {isSpanish ? 'Solicitado el:' : 'Requested on:'} {new Date(task.submissionRevision.requestedAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}

      {localError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-sm text-sm font-medium flex items-center gap-2">
          <Icons.AlertCircle /> {localError}
        </div>
      )}

      {/* SECCIÓN 1: Resumen de Revisiones */}
      <InfoBlock icon={Icons.FileText} title={isSpanish ? 'Resumen de Revisiones' : 'Review Summary'}>
        <div className="space-y-4">
          {reviewers?.filter(r => r.status === 'submitted').map((r) => (
            <div key={r.id} className="border border-slate-200 rounded-sm overflow-hidden shadow-sm">
              {/* Header del revisor */}
              <div 
                className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => setSelectedReview(selectedReview?.id === r.id ? null : r)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#003b5c] rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {r.reviewerName?.charAt(0) || 'R'}
                  </div>
                  <div>
                    <p className="font-sans font-medium text-slate-800 text-sm">{r.reviewerName}</p>
                    <p className="text-xs text-slate-500">{r.reviewerEmail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <RecommendationBadge recommendation={r.recommendation} isSpanish={isSpanish} />
                  <StatusBadge status={r.status} isSpanish={isSpanish} />
                  <span className="text-slate-400">
                    {selectedReview?.id === r.id ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
                  </span>
                </div>
              </div>

              {/* Detalles expandibles */}
              <AnimatePresence>
                {selectedReview?.id === r.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-4 space-y-4"
                  >
                    {/* Puntuaciones */}
                    {r.scores && Object.keys(r.scores).length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                          {isSpanish ? 'Puntuaciones' : 'Scores'}
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {Object.entries(r.scores).map(([key, value]) => (
                            <div key={key} className="flex justify-between items-center bg-slate-50 px-3 py-1.5 rounded-sm border border-slate-100">
                              <span className="text-xs text-slate-600 font-sans capitalize">{key}:</span>
                              <span className="font-bold text-slate-800 text-sm">{value}/2</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Comentarios al autor */}
                    {r.commentsToAuthor && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                          {isSpanish ? 'Comentarios para el Autor' : 'Comments for Author'}
                        </p>
                        <div 
                          className="prose prose-sm max-w-none font-serif text-slate-700 bg-slate-50 p-4 rounded-sm border border-slate-100"
                          dangerouslySetInnerHTML={{ __html: r.commentsToAuthor }}
                        />
                      </div>
                    )}

                    {/* Comentarios confidenciales */}
                    {r.commentsToEditor && (
                      <div className="bg-amber-50/50 p-4 rounded-sm border border-amber-200">
                        <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <Icons.Lock /> {isSpanish ? 'Confidencial (Solo Editorial)' : 'Confidential (Editorial Only)'}
                        </p>
                        <div 
                          className="prose prose-sm max-w-none font-serif text-slate-700 italic"
                          dangerouslySetInnerHTML={{ __html: r.commentsToEditor }}
                        />
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}

          {(!reviewers || reviewers.filter(r => r.status === 'submitted').length === 0) && (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Icons.Users className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-slate-500 font-sans text-sm">
                {isSpanish ? 'No hay revisiones completadas aún' : 'No completed reviews yet'}
              </p>
            </div>
          )}
        </div>
      </InfoBlock>

      {/* SECCIÓN 2: Decisión Final */}
      <InfoBlock icon={Icons.CheckCircle} title={isSpanish ? 'Decisión Final' : 'Final Decision'}>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'accept', label: isSpanish ? 'Aceptar' : 'Accept', icon: 'check', colors: 'hover:border-emerald-500' },
            { value: 'minor-revision', label: isSpanish ? 'Revisiones Menores' : 'Minor Revisions', icon: 'edit', colors: 'hover:border-blue-500' },
            { value: 'major-revision', label: isSpanish ? 'Revisiones Mayores' : 'Major Revisions', icon: 'refresh', colors: 'hover:border-amber-500' },
            { value: 'reject', label: isSpanish ? 'Rechazar' : 'Reject', icon: 'x', colors: 'hover:border-rose-500' }
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setDecision(opt.value)}
              className={`p-4 rounded-sm border-2 font-sans font-bold text-xs uppercase tracking-wider transition-all ${
                decision === opt.value
                  ? 'border-[#003b5c] bg-sky-50 text-[#003b5c] shadow-sm'
                  : `border-slate-200 bg-white text-slate-600 hover:bg-slate-50 ${opt.colors}`
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </InfoBlock>

      {/* SECCIÓN 3: Feedback para el Autor con Quill */}
      <InfoBlock icon={Icons.Eye} title={isSpanish ? 'Feedback para el Autor' : 'Feedback to Author'}>
        <div className="space-y-2">
          <div className={`border ${feedbackError ? 'border-rose-300' : 'border-slate-200'} rounded-sm overflow-hidden`}>
            <ReactQuill
              ref={quillRef}
              theme="snow"
              modules={quillModules}
              formats={quillFormats}
              onChange={handleFeedbackChange}
              placeholder={isSpanish 
                ? 'Sintetiza las revisiones y comunica tu decisión final al autor. Si solicitas revisiones, sé específico sobre los cambios requeridos...' 
                : 'Synthesize the reviews and communicate your final decision to the author. If requesting revisions, be specific about required changes...'}
              className="font-serif text-sm"
              style={{ minHeight: '180px' }}
            />
          </div>
          {feedbackError && (
            <p className="text-xs text-rose-600 font-sans font-medium flex items-center gap-1">
              <Icons.AlertCircle /> {feedbackError}
            </p>
          )}
          <p className="text-[10px] text-slate-500 font-sans">
            {isSpanish 
              ? 'Utilice el editor para formatear el mensaje. El autor recibirá este contenido en su totalidad.'
              : 'Use the editor to format the message. The author will receive this content in full.'}
          </p>
        </div>
      </InfoBlock>

      {/* SECCIÓN 4: Comentarios Internos con Quill */}
      <InfoBlock icon={Icons.Lock} title={isSpanish ? 'Comentarios Internos (Solo Editorial)' : 'Internal Comments (Editorial Only)'}>
        <div>
          <div className="border border-slate-200 rounded-sm overflow-hidden">
            <ReactQuill
              ref={internalQuillRef}
              theme="snow"
              modules={quillModules}
              formats={quillFormats}
              onChange={handleInternalCommentsChange}
              placeholder={isSpanish 
                ? 'Notas para el equipo editorial (no visible para el autor)...' 
                : 'Notes for the editorial team (not visible to the author)...'}
              className="font-serif text-sm"
              style={{ minHeight: '120px' }}
            />
          </div>
          <p className="text-[10px] text-slate-500 font-sans mt-2">
            <Icons.Lock className="inline w-3 h-3 mr-1" />
            {isSpanish 
              ? 'Estos comentarios son confidenciales y solo serán visibles para el equipo editorial.'
              : 'These comments are confidential and only visible to the editorial team.'}
          </p>
        </div>
      </InfoBlock>

      {/* SECCIÓN FINAL: Botón de Acción */}
      <div className="pt-8 border-t border-slate-200">
        <div className="max-w-2xl mx-auto text-center">
          <button
            onClick={handleSubmit}
            disabled={loading || !decision}
            className={`w-full py-4 text-white text-sm font-bold uppercase tracking-widest rounded-sm transition-colors shadow-md disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed flex items-center justify-center gap-3 ${
              decision === 'major-revision' || decision === 'minor-revision'
                ? 'bg-[#003b5c] hover:bg-sky-900'
                : 'bg-[#003b5c] hover:bg-sky-900'
            }`}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Icons.Send />
            )}
            {loading 
              ? (isSpanish ? 'PROCESANDO...' : 'PROCESSING...')
              : decision === 'major-revision' || decision === 'minor-revision'
                ? (isSpanish ? 'SOLICITAR REVISIONES AL AUTOR' : 'REQUEST AUTHOR REVISIONS')
                : (isSpanish ? 'GUARDAR DECISIÓN FINAL' : 'SAVE FINAL DECISION')
            }
          </button>
          <p className="text-xs text-slate-500 font-sans mt-3">
            {isSpanish 
              ? 'La decisión final y el feedback serán registrados en el sistema y notificados al autor.'
              : 'The final decision and feedback will be recorded in the system and notified to the author.'}
          </p>
        </div>
      </div>

    </div>
  );
};

// Definir el icono de flecha que falta (ArrowRight)
const IconsWithArrow = {
  ...Icons,
  ArrowRight: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
};

// Actualizar el objeto Icons con ArrowRight
Object.assign(Icons, { ArrowRight: IconsWithArrow.ArrowRight });