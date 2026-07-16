// src/components/MetadataRefinementTab.js
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../hooks/useLanguage';
import { useMetadataRefinement } from '../hooks/useMetadataRefinement';
import { doc, onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

// ============ ICONOS SVG PROFESIONALES ============
const Icons = {
  CheckCircle: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  ShieldCheck: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  Warning: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  DocumentText: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Edit: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  History: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Plus: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
  Cross: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  ArrowRight: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>,
  Send: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
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

export const MetadataRefinementTab = ({ submission, user, onComplete }) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  const { 
    loading, 
    proposeChanges, 
    applyApprovedChanges, 
    markAsReadyForPublication,
    error: hookError
  } = useMetadataRefinement(user);
  
  const [proposedChanges, setProposedChanges] = useState([]);
  const [currentField, setCurrentField] = useState('');
  const [fieldValue, setFieldValue] = useState('');
  const [fieldReason, setFieldReason] = useState('');
  const [requiresConsent, setRequiresConsent] = useState(true);
  const [localError, setLocalError] = useState(null);
  const [proposals, setProposals] = useState([]);

  useEffect(() => {
    if (hookError) {
      setLocalError(hookError);
      setTimeout(() => setLocalError(null), 5000);
    }
  }, [hookError]);

  const formatValue = (value, fieldName = '') => {
    if (value === null || value === undefined) return <span className="text-slate-400 italic font-sans text-xs">—</span>;
    
    if ((fieldName === 'keywords' || fieldName === 'keywordsEn') && Array.isArray(value)) {
        return (
            <div className="flex flex-wrap gap-1.5">
                {value.length === 0 ? <span className="text-slate-400 italic text-xs">—</span> : 
                    value.map((kw, idx) => {
                        const match = typeof kw === 'string' ? kw.match(/^([A-Za-z0-9.]+):\s*(.+)/) : null;
                        if (match) {
                            return (
                                <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 text-slate-700 rounded-sm text-xs shadow-sm font-sans">
                                    <code className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-sm text-slate-500 font-mono">{match[1]}</code>
                                    <span>{match[2]}</span>
                                </span>
                            );
                        }
                        return (
                            <span key={idx} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-sm text-xs font-sans border border-slate-200">
                                {typeof kw === 'string' ? kw : kw.term || String(kw)}
                            </span>
                        );
                    })
                }
            </div>
        );
    }
    
    if (typeof value === 'object') {
        if (Array.isArray(value)) {
            if (value.length === 0) return <span className="text-slate-400 italic font-sans text-xs">—</span>;
            return value.map((item, idx) => {
                if (typeof item === 'object') {
                    if (item.firstName && item.lastName) {
                        return <span key={idx} className="block mb-1">{`${item.lastName}, ${item.firstName}`}</span>;
                    } else if (item.name) {
                        return <span key={idx} className="block mb-1">{item.name}</span>;
                    } else if (item.code && item.term) {
                        return <span key={idx} className="block mb-1">{item.code ? `${item.code}: ${item.term}` : item.term}</span>;
                    } else {
                        return <span key={idx} className="block mb-1">{Object.values(item).join(' ') || 'Autor sin nombre'}</span>;
                    }
                }
                return String(item);
            });
        }
        return JSON.stringify(value);
    }
    return String(value);
  };

  const fields = [
    { name: 'title', label: isSpanish ? 'Título' : 'Title', type: 'text', requiresConsent: true },
    { name: 'titleEn', label: isSpanish ? 'Título (Inglés)' : 'Title (English)', type: 'text', requiresConsent: true },
    { name: 'abstract', label: isSpanish ? 'Resumen' : 'Abstract', type: 'textarea', requiresConsent: true },
    { name: 'abstractEn', label: isSpanish ? 'Resumen (Inglés)' : 'Abstract (English)', type: 'textarea', requiresConsent: true },
    { name: 'keywords', label: isSpanish ? 'Palabras Clave' : 'Keywords', type: 'keywords', requiresConsent: true },
    { name: 'keywordsEn', label: isSpanish ? 'Palabras Clave (Inglés)' : 'Keywords (English)', type: 'keywords', requiresConsent: true },
    { name: 'authors', label: isSpanish ? 'Autores' : 'Authors', type: 'textarea', requiresConsent: true },
    { name: 'funding', label: isSpanish ? 'Financiamiento' : 'Funding', type: 'text', requiresConsent: false },
    { name: 'conflictOfInterest', label: isSpanish ? 'Conflicto de Intereses' : 'Conflict of Interest', type: 'textarea', requiresConsent: false },
    { name: 'dataAvailability', label: isSpanish ? 'Disponibilidad de Datos' : 'Data Availability', type: 'textarea', requiresConsent: false }
  ];

  const getCurrentValue = (fieldName) => {
    if (submission.currentMetadata && submission.currentMetadata[fieldName] !== undefined) {
        return submission.currentMetadata[fieldName];
    }
    if (submission.originalSubmission && submission.originalSubmission[fieldName] !== undefined) {
        return submission.originalSubmission[fieldName];
    }
    if (submission[fieldName] !== undefined) {
        return submission[fieldName];
    }
    if (fieldName === 'keywords' && submission.keywordsRaw?.length > 0) {
        return submission.keywordsRaw.map(k => k.code ? `${k.code}: ${k.term}` : k.term);
    }
    if (fieldName === 'keywordsEn' && submission.keywordsRawEn?.length > 0) {
        return submission.keywordsRawEn.map(k => k.code ? `${k.code}: ${k.term}` : k.term);
    }
    if (fieldName === 'keywordsEn' && submission.keywordsRaw?.length > 0) {
        return submission.keywordsRaw.map(k => k.code ? `${k.code}: ${k.term}` : k.term);
    }
    return '';
  };

  useEffect(() => {
    if (!submission?.id) return;
    const proposalsRef = collection(db, 'submissions', submission.id, 'metadataProposals');
    const q = query(proposalsRef, orderBy('proposedAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedProposals = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        proposedAt: doc.data().proposedAt?.toDate?.() || null,
        authorResponse: doc.data().authorResponse ? {
          ...doc.data().authorResponse,
          respondedAt: doc.data().authorResponse.respondedAt?.toDate?.() || null
        } : null
      }));
      setProposals(loadedProposals);
    }, (error) => {
      console.error('Error loading proposals:', error);
      setLocalError(isSpanish ? 'Error al cargar propuestas' : 'Error loading proposals');
    });

    return () => unsubscribe();
  }, [submission?.id, isSpanish]);

  const handleAddChange = () => {
    if (!currentField || !fieldValue.trim() || !fieldReason.trim()) {
      alert(isSpanish ? 'Completa todos los campos obligatorios.' : 'Complete all required fields.');
      return;
    }

    const field = fields.find(f => f.name === currentField);
    const currentValue = getCurrentValue(currentField);

    setProposedChanges([
      ...proposedChanges,
      {
        field: currentField,
        currentValue,
        proposedValue: fieldValue,
        reason: fieldReason,
        requiresAuthorConsent: requiresConsent && (field?.requiresConsent || true)
      }
    ]);

    setCurrentField('');
    setFieldValue('');
    setFieldReason('');
    setRequiresConsent(true);
  };

  const handleRemoveChange = (index) => {
    setProposedChanges(proposedChanges.filter((_, i) => i !== index));
  };

  const handleSubmitProposal = async () => {
    if (proposedChanges.length === 0) {
      alert(isSpanish ? 'Agrega al menos un cambio a la propuesta.' : 'Add at least one change to the proposal.');
      return;
    }

    setLocalError(null);
    const result = await proposeChanges(submission.id, proposedChanges);
    
    if (result.success) {
      setProposedChanges([]);
      alert(isSpanish ? 'Propuesta enviada al autor exitosamente.' : 'Proposal sent to author successfully.');
    } else {
      setLocalError(result.error || (isSpanish ? 'Error al enviar propuesta' : 'Error sending proposal'));
    }
  };

  const handleApplyApprovedChanges = async (proposalId) => {
    setLocalError(null);
    const result = await applyApprovedChanges(submission.id, proposalId);
    
    if (result.success) {
      alert(isSpanish ? 'Cambios aplicados e integrados al manuscrito.' : 'Changes applied and integrated to the manuscript.');
    } else {
      setLocalError(result.error || (isSpanish ? 'Error al aplicar cambios' : 'Error applying changes'));
    }
  };

  const handleMarkAsReady = async () => {
    if (window.confirm(isSpanish 
      ? '¿Confirmar que este artículo posee todos los metadatos correctos y está listo para publicación? Se notificará al Director.'
      : 'Confirm this article has all correct metadata and is ready for publication? The Director will be notified.')) {
      
      setLocalError(null);
      const result = await markAsReadyForPublication(submission.id);
      
      if (result.success) {
        alert(isSpanish ? 'Artículo listado para publicación.' : 'Article listed for publication.');
        onComplete?.();
      } else {
        setLocalError(result.error || (isSpanish ? 'Error al procesar la solicitud.' : 'Error processing request.'));
      }
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'pending-author': { label: isSpanish ? 'Pendiente del Autor' : 'Pending Author', colors: 'bg-amber-50 text-amber-700 border-amber-200' },
      'approved': { label: isSpanish ? 'Aprobada' : 'Approved', colors: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      'rejected': { label: isSpanish ? 'Rechazada' : 'Rejected', colors: 'bg-rose-50 text-rose-700 border-rose-200' }
    };
    const badge = badges[status] || { label: status, colors: 'bg-slate-100 text-slate-700 border-slate-200' };
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-sm text-[10px] font-sans font-bold uppercase tracking-wider border ${badge.colors}`}>
        {badge.label}
      </span>
    );
  };

  // Pantalla de Éxito (Listo para Publicación)
  if (submission.publicationReady) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-sm p-12 text-center shadow-sm">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Icons.CheckCircle className="w-8 h-8 text-emerald-600" />
        </div>
        <h3 className="font-serif text-2xl text-emerald-900 mb-3">
          {isSpanish ? 'Metadatos Consolidados' : 'Metadata Consolidated'}
        </h3>
        <p className="text-emerald-700 font-sans max-w-lg mx-auto leading-relaxed">
          {isSpanish 
            ? 'El proceso de revisión de metadatos ha concluido. El artículo se encuentra en la cola de producción final esperando la aprobación de Dirección.'
            : 'The metadata review process has concluded. The article is in the final production queue awaiting Direction approval.'}
        </p>
        {submission.publicationReadyAt && (
          <div className="mt-6 pt-6 border-t border-emerald-200/50 inline-block">
            <p className="text-[10px] font-sans font-bold uppercase tracking-wider text-emerald-600">
              {isSpanish ? 'Fecha de Consolidación' : 'Consolidation Date'}
            </p>
            <p className="text-emerald-800 font-mono text-sm mt-1">
              {new Date(submission.publicationReadyAt.seconds * 1000).toLocaleString()}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 font-sans">
      
      {/* Banner COPE Institucional */}
      <div className="bg-white border-l-4 border-[#003b5c] border-y border-r border-slate-200 rounded-sm p-5 shadow-sm flex gap-4 items-start">
        <div className="mt-0.5 text-[#003b5c]"><Icons.ShieldCheck /></div>
        <div>
          <h4 className="font-sans font-bold text-xs text-slate-800 uppercase tracking-wider mb-1">
            {isSpanish ? 'Directrices Éticas (COPE)' : 'Ethical Guidelines (COPE)'}
          </h4>
          <p className="text-slate-600 text-sm leading-relaxed">
            {isSpanish 
              ? 'Toda alteración sustancial en los metadatos bibliográficos (especialmente título, resumen y autoría) posterior al envío inicial requiere el consentimiento explícito y documentado del autor de correspondencia.'
              : 'Any substantial alteration to bibliographic metadata (especially title, abstract, and authorship) after initial submission requires explicit and documented consent from the corresponding author.'}
          </p>
        </div>
      </div>

      {localError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-sm text-sm font-medium flex items-center gap-2">
          <Icons.Warning /> {localError}
        </div>
      )}

      {/* SECCIÓN 1: Metadatos actuales (Solo Lectura) */}
      <InfoBlock icon={Icons.DocumentText} title={isSpanish ? 'Registro Bibliográfico Actual' : 'Current Bibliographic Record'}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{isSpanish ? 'Título Principal' : 'Main Title'}</p>
            <div className="font-serif text-sm text-slate-800 leading-snug">{formatValue(submission.title)}</div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{isSpanish ? 'Título Secundario (EN)' : 'Secondary Title (EN)'}</p>
            <div className="font-serif text-sm text-slate-800 leading-snug">{formatValue(submission.titleEn)}</div>
          </div>
          <div className="md:col-span-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Abstract / Resumen</p>
            <div className="font-serif text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-sm border border-slate-100">{formatValue(submission.abstract)}</div>
          </div>
          <div className="md:col-span-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Abstract / Resumen (EN)</p>
            <div className="font-serif text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-sm border border-slate-100">{formatValue(submission.abstractEn)}</div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{isSpanish ? 'Palabras Clave' : 'Keywords'}</p>
            <div>{formatValue(submission.keywords, 'keywords')}</div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{isSpanish ? 'Palabras Clave (EN)' : 'Keywords (EN)'}</p>
            <div>{formatValue(submission.keywordsEn, 'keywordsEn')}</div>
          </div>
          <div className="md:col-span-2 pt-4 border-t border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{isSpanish ? 'Registro de Autoría' : 'Authorship Record'}</p>
            <div className="font-sans text-sm text-slate-800">{formatValue(submission.authors)}</div>
          </div>
        </div>
      </InfoBlock>

      {/* SECCIÓN 2: Formulario de Nueva Propuesta */}
      <InfoBlock icon={Icons.Edit} title={isSpanish ? 'Formular Ajustes de Metadatos' : 'Formulate Metadata Adjustments'}>
        
        {/* Cambios encolados (Staged) */}
        <AnimatePresence>
          {proposedChanges.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8"
            >
              <div className="bg-sky-50 border border-sky-200 rounded-sm p-4">
                <h4 className="font-sans font-bold text-xs text-sky-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Icons.History /> {isSpanish ? 'Ajustes en Cola' : 'Staged Adjustments'}
                </h4>
                <div className="space-y-3">
                  {proposedChanges.map((change, idx) => (
                    <div key={idx} className="bg-white border border-sky-100 p-4 rounded-sm flex items-start gap-4 shadow-sm relative group">
                      <div className="flex-1 min-w-0">
                        <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider rounded-sm mb-2">
                          {fields.find(f => f.name === change.field)?.label || change.field}
                        </span>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
                          <div className="bg-rose-50/50 p-3 rounded-sm border border-rose-100/50">
                            <p className="text-[10px] font-bold text-rose-700/70 uppercase tracking-wider mb-1.5">{isSpanish ? 'Original' : 'Original'}</p>
                            <div className="text-sm font-serif text-slate-500 line-through break-words">
                              {formatValue(change.currentValue)}
                            </div>
                          </div>
                          <div className="bg-emerald-50/50 p-3 rounded-sm border border-emerald-100/50 relative">
                            <div className="absolute -left-3 top-1/2 -translate-y-1/2 text-slate-300 hidden md:block">
                              <Icons.ArrowRight />
                            </div>
                            <p className="text-[10px] font-bold text-emerald-700/70 uppercase tracking-wider mb-1.5">{isSpanish ? 'Propuesto' : 'Proposed'}</p>
                            <div className="text-sm font-serif text-slate-800 font-medium break-words">
                              {formatValue(change.proposedValue)}
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 mt-3 font-sans italic border-l-2 border-slate-200 pl-2">
                          "{change.reason}"
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveChange(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-3 right-3"
                        title={isSpanish ? 'Descartar' : 'Discard'}
                      >
                        <Icons.Cross />
                      </button>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleSubmitProposal}
                    disabled={loading}
                    className="px-6 py-2.5 bg-[#003b5c] text-white text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-sky-900 transition-colors shadow-sm flex items-center gap-2"
                  >
                    {loading ? (isSpanish ? 'PROCESANDO...' : 'PROCESSING...') : (
                      <>
                        <Icons.Send />
                        {isSpanish ? 'Transferir Propuesta al Autor' : 'Transfer Proposal to Author'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Creador de cambios */}
        <div className="bg-slate-50 border border-slate-200 rounded-sm p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2 lg:col-span-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                {isSpanish ? 'Seleccionar Campo' : 'Select Field'}
              </label>
              <select
                value={currentField}
                onChange={(e) => {
                  setCurrentField(e.target.value);
                  setFieldValue(getCurrentValue(e.target.value));
                }}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-sm focus:ring-2 focus:ring-[#003b5c] focus:border-transparent font-sans text-sm text-slate-800"
              >
                <option value="">{isSpanish ? '-- Seleccione un campo a corregir --' : '-- Select a field to correct --'}</option>
                {fields.map(f => (
                  <option key={f.name} value={f.name}>{f.label}</option>
                ))}
              </select>
            </div>

            {currentField && (
              <>
                <div className="md:col-span-2 lg:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    {isSpanish ? 'Valor Existente' : 'Existing Value'}
                  </label>
                  <div className="p-3 bg-slate-100 border border-slate-200 rounded-sm text-sm font-serif text-slate-600 max-h-32 overflow-y-auto">
                    {formatValue(getCurrentValue(currentField))}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    {isSpanish ? 'Valor Corregido' : 'Corrected Value'}
                  </label>
                  {fields.find(f => f.name === currentField)?.type === 'textarea' || fields.find(f => f.name === currentField)?.type === 'keywords' ? (
                    <textarea
                        value={fieldValue}
                        onChange={(e) => setFieldValue(e.target.value)}
                        rows={5}
                        className="w-full p-3 bg-white border border-slate-300 rounded-sm focus:ring-2 focus:ring-[#003b5c] focus:border-transparent font-serif text-sm text-slate-800"
                    />
                  ) : (
                    <input
                        type="text"
                        value={fieldValue}
                        onChange={(e) => setFieldValue(e.target.value)}
                        className="w-full p-3 bg-white border border-slate-300 rounded-sm focus:ring-2 focus:ring-[#003b5c] focus:border-transparent font-serif text-sm text-slate-800"
                    />
                  )}
                  <p className="text-[10px] text-slate-500 mt-2 font-sans">
                    {currentField.includes('keywords')
                        ? (isSpanish ? 'Nota: Separe términos usando punto y coma (;).' : 'Note: Separate terms using semicolons (;).')
                        : currentField === 'authors'
                            ? (isSpanish ? 'Formato estandarizado: Apellido, Nombre; Apellido2, Nombre2.' : 'Standard format: LastName, FirstName; LastName2, FirstName2.')
                            : ''
                    }
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    {isSpanish ? 'Justificación Editorial' : 'Editorial Justification'}
                  </label>
                  <textarea
                    value={fieldReason}
                    onChange={(e) => setFieldReason(e.target.value)}
                    rows={2}
                    placeholder={isSpanish ? 'Detalle la necesidad técnica o estilística del cambio...' : 'Detail the technical or stylistic need for the change...'}
                    className="w-full p-3 bg-white border border-slate-300 rounded-sm focus:ring-2 focus:ring-[#003b5c] focus:border-transparent font-sans text-sm text-slate-800 placeholder:text-slate-400"
                  />
                </div>

                <div className="md:col-span-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={requiresConsent}
                      onChange={(e) => setRequiresConsent(e.target.checked)}
                      className="w-4 h-4 text-[#003b5c] border-slate-300 rounded-sm focus:ring-[#003b5c]"
                    />
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider group-hover:text-[#003b5c] transition-colors">
                      {isSpanish ? 'Requerir validación del autor' : 'Require author validation'}
                    </span>
                  </label>

                  <button
                    onClick={handleAddChange}
                    className="w-full sm:w-auto px-6 py-2.5 bg-slate-800 text-white text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-slate-700 transition-colors shadow-sm flex items-center justify-center gap-2"
                  >
                    <Icons.Plus />
                    {isSpanish ? 'Añadir Corrección' : 'Add Correction'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </InfoBlock>

      {/* SECCIÓN 3: Historial de Propuestas */}
      {proposals.length > 0 && (
        <InfoBlock icon={Icons.History} title={isSpanish ? 'Registro de Auditoría de Metadatos' : 'Metadata Audit Log'}>
          <div className="space-y-6">
            {proposals.map((proposal) => (
              <div key={proposal.id} className="border border-slate-200 rounded-sm bg-white overflow-hidden shadow-sm">
                
                {/* Header de la propuesta */}
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {proposal.proposedAt?.toLocaleString()}
                    </p>
                    <p className="text-sm font-sans text-slate-800 mt-0.5">
                      {isSpanish ? 'Emitido por: ' : 'Issued by: '}
                      <span className="font-medium text-[#003b5c]">{proposal.proposedByEmail}</span>
                    </p>
                  </div>
                  {getStatusBadge(proposal.status)}
                </div>

                {/* Lista de cambios en la propuesta */}
                <div className="p-4 space-y-4">
                  {proposal.changes.map((change, idx) => (
                    <div key={idx} className="bg-slate-50/50 p-3 rounded-sm border border-slate-100">
                      <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        {fields.find(f => f.name === change.field)?.label || change.field}
                      </p>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
                         <div className="text-sm font-serif text-slate-500 line-through bg-white p-2 border border-slate-200 rounded-sm">
                           {formatValue(change.currentValue, change.field)}
                         </div>
                         <div className="text-sm font-serif text-slate-800 font-medium bg-white p-2 border border-emerald-200 rounded-sm shadow-sm relative">
                            <div className="absolute -left-3 top-1/2 -translate-y-1/2 text-slate-300 hidden lg:block"><Icons.ArrowRight /></div>
                            {formatValue(change.proposedValue, change.field)}
                         </div>
                      </div>
                      <p className="text-xs text-slate-500 font-sans italic mt-2">
                        Justificación: {change.reason}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Resolución del autor y acciones */}
                {(proposal.authorResponse || proposal.status === 'approved') && (
                  <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                    {proposal.authorResponse && (
                      <div className={`flex-1 border-l-2 pl-3 ${proposal.authorResponse.accepted ? 'border-emerald-500' : 'border-rose-500'}`}>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          {proposal.authorResponse.accepted 
                            ? (isSpanish ? 'Consentimiento Otorgado' : 'Consent Granted')
                            : (isSpanish ? 'Cambios Declinados' : 'Changes Declined')}
                        </p>
                        {proposal.authorResponse.comments && (
                          <p className="text-sm font-serif text-slate-600 mt-1 italic">
                            "{proposal.authorResponse.comments}"
                          </p>
                        )}
                      </div>
                    )}

                    {proposal.status === 'approved' && (
                      <button
                        onClick={() => handleApplyApprovedChanges(proposal.id)}
                        disabled={loading}
                        className="px-6 py-2 bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-emerald-700 transition-colors shadow-sm disabled:bg-slate-300 whitespace-nowrap"
                      >
                        {loading 
                          ? (isSpanish ? 'APLICANDO...' : 'APPLYING...') 
                          : (isSpanish ? 'Ejecutar Cambios en Sistema' : 'Execute Changes in System')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </InfoBlock>
      )}

      {/* SECCIÓN FINAL: Acción de Cierre */}
      <div className="pt-8 border-t border-slate-200">
        <div className="max-w-2xl mx-auto text-center">
          <button
            onClick={handleMarkAsReady}
            disabled={loading}
            className="w-full py-4 bg-[#003b5c] hover:bg-sky-900 text-white text-sm font-bold uppercase tracking-widest rounded-sm transition-colors shadow-md disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Icons.CheckCircle />
            )}
            {isSpanish ? 'Aprobar Metadatos para Publicación Final' : 'Approve Metadata for Final Publication'}
          </button>
          <p className="text-xs text-slate-500 font-sans mt-3">
            {isSpanish 
              ? 'Al ejecutar esta acción, el manuscrito quedará formalmente bloqueado para ediciones y se transferirá a Dirección General.'
              : 'By executing this action, the manuscript will be formally locked for edits and transferred to the General Direction.'}
          </p>
        </div>
      </div>

    </div>
  );
};