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
  Send: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>,
  Tag: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>,
  Code: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
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

// ============ FUNCIÓN DE FORMATEO CORREGIDA ============
// ✅ VERSIÓN SIMPLIFICADA (recomendada)
const formatKeywords = (keywords, isSpanish) => {
  if (!keywords || (Array.isArray(keywords) && keywords.length === 0)) {
    return <span className="text-slate-400 italic font-sans text-xs">—</span>;
  }
  
  const keywordArray = Array.isArray(keywords) ? keywords : [keywords];
  
  return (
    <div className="flex flex-wrap gap-1.5">
      {keywordArray.map((kw, idx) => (
        <span key={idx} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-sans border border-slate-200">
          {typeof kw === 'string' ? kw : kw.term || kw.name || String(kw)}
        </span>
      ))}
    </div>
  );
};

const formatAuthors = (authors, isSpanish) => {
  if (!authors || (Array.isArray(authors) && authors.length === 0)) {
    return <span className="text-slate-400 italic font-sans text-xs">—</span>;
  }
  
  const authorArray = Array.isArray(authors) ? authors : [authors];
  
  return (
    <div className="space-y-2">
      {authorArray.map((author, idx) => {
        if (typeof author === 'object' && author !== null) {
          const fullName = `${author.firstName || ''} ${author.lastName || ''}`.trim() || author.name || 'Autor sin nombre';
          return (
            <div key={idx} className="flex items-center gap-2 text-sm">
              <span className="font-serif text-slate-800">{fullName}</span>
              {author.email && <span className="text-xs text-slate-400 font-mono">({author.email})</span>}
              {author.orcid && <span className="text-xs text-[#003b5c] font-mono">ORCID: {author.orcid}</span>}
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
};

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

  // ============ FORMATEO CORREGIDO PARA TODOS LOS CAMPOS ============
  const formatValue = (value, fieldName = '') => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-slate-400 italic font-sans text-xs">—</span>;
    }
    
    // Palabras clave (ES/EN)
    if (fieldName === 'keywords' || fieldName === 'keywordsEs' || fieldName === 'keywordsEn') {
      return formatKeywords(value, isSpanish);
    }
    
    // Autores
    if (fieldName === 'authors') {
      return formatAuthors(value, isSpanish);
    }
    
    // Códigos especializados
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
    
    // Objetos
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        return value.map((item, idx) => {
          if (typeof item === 'object' && item !== null) {
            return <span key={idx} className="block mb-1 font-serif text-slate-700">{JSON.stringify(item)}</span>;
          }
          return <span key={idx} className="block mb-1 font-serif text-slate-700">{String(item)}</span>;
        });
      }
      // Timestamp de Firebase
      if (value.seconds !== undefined) {
        return new Date(value.seconds * 1000).toLocaleString();
      }
      return <span className="font-serif text-slate-700">{JSON.stringify(value)}</span>;
    }
    
    return <span className="font-serif text-slate-700">{String(value)}</span>;
  };

  const fields = [
    { name: 'title', label: isSpanish ? 'Título' : 'Title', type: 'text', requiresConsent: true },
    { name: 'titleEn', label: isSpanish ? 'Título (Inglés)' : 'Title (English)', type: 'text', requiresConsent: true },
    { name: 'abstract', label: isSpanish ? 'Resumen' : 'Abstract', type: 'textarea', requiresConsent: true },
    { name: 'abstractEn', label: isSpanish ? 'Resumen (Inglés)' : 'Abstract (English)', type: 'textarea', requiresConsent: true },
    { name: 'keywordsEs', label: isSpanish ? 'Palabras Clave (ES)' : 'Keywords (ES)', type: 'keywords', requiresConsent: true },
    { name: 'keywordsEn', label: isSpanish ? 'Palabras Clave (EN)' : 'Keywords (EN)', type: 'keywords', requiresConsent: true },
    { name: 'keywordsVocabulario', label: isSpanish ? 'Vocabulario Controlado' : 'Controlled Vocabulary', type: 'text', requiresConsent: true },
    { name: 'specializedCodes', label: isSpanish ? 'Códigos Especializados' : 'Specialized Codes', type: 'text', requiresConsent: true },
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
    // Soporte para keywords legacy
    if (fieldName === 'keywordsEs' && submission.keywords?.length > 0) {
      return submission.keywords;
    }
    if (fieldName === 'keywordsEn' && submission.keywords?.length > 0) {
      return submission.keywords;
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
            ? 'El proceso de revisión de metadatos ha concluido.'
            : 'The metadata review process has concluded.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 font-sans">
      
      {/* Banner COPE */}
      <div className="bg-white border-l-4 border-[#003b5c] border-y border-r border-slate-200 rounded-sm p-5 shadow-sm flex gap-4 items-start">
        <div className="mt-0.5 text-[#003b5c]"><Icons.ShieldCheck /></div>
        <div>
          <h4 className="font-sans font-bold text-xs text-slate-800 uppercase tracking-wider mb-1">
            {isSpanish ? 'Directrices Éticas (COPE)' : 'Ethical Guidelines (COPE)'}
          </h4>
          <p className="text-slate-600 text-sm leading-relaxed">
            {isSpanish 
              ? 'Toda alteración sustancial requiere el consentimiento explícito del autor.'
              : 'Any substantial alteration requires explicit author consent.'}
          </p>
        </div>
      </div>

      {localError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-sm text-sm font-medium flex items-center gap-2">
          <Icons.Warning /> {localError}
        </div>
      )}

      {/* SECCIÓN 1: Metadatos actuales */}
      <InfoBlock icon={Icons.DocumentText} title={isSpanish ? 'Registro Bibliográfico Actual' : 'Current Bibliographic Record'}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{isSpanish ? 'Título Principal' : 'Main Title'}</p>
            <div className="font-serif text-sm text-slate-800 leading-snug">{formatValue(submission.title, 'title')}</div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{isSpanish ? 'Título (EN)' : 'Title (EN)'}</p>
            <div className="font-serif text-sm text-slate-800 leading-snug">{formatValue(submission.titleEn, 'titleEn')}</div>
          </div>
          <div className="md:col-span-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Abstract / Resumen</p>
            <div className="font-serif text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-sm border border-slate-100">{formatValue(submission.abstract, 'abstract')}</div>
          </div>
          <div className="md:col-span-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Abstract / Resumen (EN)</p>
            <div className="font-serif text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-sm border border-slate-100">{formatValue(submission.abstractEn, 'abstractEn')}</div>
          </div>
          
          {/* Palabras clave ES */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              <Icons.Tag className="inline w-3 h-3 mr-1" />
              {isSpanish ? 'Palabras Clave (ES)' : 'Keywords (ES)'}
            </p>
            {formatKeywords(submission.keywordsEs || submission.keywords, isSpanish)}
          </div>
          
          {/* Palabras clave EN */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              <Icons.Tag className="inline w-3 h-3 mr-1" />
              {isSpanish ? 'Palabras Clave (EN)' : 'Keywords (EN)'}
            </p>
            {formatKeywords(submission.keywordsEn || submission.keywords, isSpanish)}
          </div>
          
          {/* Vocabulario controlado */}
          {submission.keywordsVocabulario && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                {isSpanish ? 'Vocabulario Controlado' : 'Controlled Vocabulary'}
              </p>
              <span className="px-3 py-1 bg-[#003b5c] text-white rounded-sm text-xs font-sans font-bold">
                {submission.keywordsVocabulario}
              </span>
            </div>
          )}
          
          {/* Códigos especializados */}
          {submission.specializedCodes && submission.specializedCodes.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                <Icons.Code className="inline w-3 h-3 mr-1" />
                {isSpanish ? 'Códigos Especializados' : 'Specialized Codes'}
              </p>
              {formatValue(submission.specializedCodes, 'specializedCodes')}
            </div>
          )}
          
          <div className="md:col-span-2 pt-4 border-t border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{isSpanish ? 'Registro de Autoría' : 'Authorship Record'}</p>
            <div className="font-sans text-sm text-slate-800">{formatAuthors(submission.authors, isSpanish)}</div>
          </div>
        </div>
      </InfoBlock>

      {/* SECCIÓN 2: Formulario de Nueva Propuesta */}
      <InfoBlock icon={Icons.Edit} title={isSpanish ? 'Formular Ajustes de Metadatos' : 'Formulate Metadata Adjustments'}>
        
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
                              {formatValue(change.currentValue, change.field)}
                            </div>
                          </div>
                          <div className="bg-emerald-50/50 p-3 rounded-sm border border-emerald-100/50 relative">
                            <p className="text-[10px] font-bold text-emerald-700/70 uppercase tracking-wider mb-1.5">{isSpanish ? 'Propuesto' : 'Proposed'}</p>
                            <div className="text-sm font-serif text-slate-800 font-medium break-words">
                              {formatValue(change.proposedValue, change.field)}
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
                  const val = getCurrentValue(e.target.value);
                  setFieldValue(typeof val === 'string' ? val : Array.isArray(val) ? val.join('; ') : '');
                }}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-sm focus:ring-2 focus:ring-[#003b5c] focus:border-transparent font-sans text-sm text-slate-800"
              >
                <option value="">{isSpanish ? '-- Seleccione un campo --' : '-- Select a field --'}</option>
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
                    {formatValue(getCurrentValue(currentField), currentField)}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    {isSpanish ? 'Valor Corregido' : 'Corrected Value'}
                  </label>
                  <textarea
                    value={fieldValue}
                    onChange={(e) => setFieldValue(e.target.value)}
                    rows={5}
                    className="w-full p-3 bg-white border border-slate-300 rounded-sm focus:ring-2 focus:ring-[#003b5c] focus:border-transparent font-serif text-sm text-slate-800"
                  />
                  <p className="text-[10px] text-slate-500 mt-2 font-sans">
                    {currentField.includes('keywords')
                      ? (isSpanish ? 'Separe términos con punto y coma (;).' : 'Separate terms with semicolons (;).')
                      : currentField === 'authors'
                        ? (isSpanish ? 'Formato: Apellido, Nombre; Apellido2, Nombre2.' : 'Format: LastName, FirstName; LastName2, FirstName2.')
                        : currentField === 'specializedCodes'
                          ? (isSpanish ? 'Separe códigos con punto y coma (;).' : 'Separate codes with semicolons (;).')
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
                    className="w-full p-3 bg-white border border-slate-300 rounded-sm focus:ring-2 focus:ring-[#003b5c] focus:border-transparent font-sans text-sm text-slate-800"
                  />
                </div>

                <div className="md:col-span-2 flex items-center justify-between gap-4 pt-4 border-t border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requiresConsent}
                      onChange={(e) => setRequiresConsent(e.target.checked)}
                      className="w-4 h-4 text-[#003b5c]"
                    />
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      {isSpanish ? 'Requerir validación del autor' : 'Require author validation'}
                    </span>
                  </label>

                  <button
                    onClick={handleAddChange}
                    className="px-6 py-2.5 bg-slate-800 text-white text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-slate-700 transition-colors flex items-center gap-2"
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

                <div className="p-4 space-y-4">
                  {proposal.changes.map((change, idx) => (
                    <div key={idx} className="bg-slate-50/50 p-3 rounded-sm border border-slate-100">
                      <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        {fields.find(f => f.name === change.field)?.label || change.field}
                      </p>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="text-sm font-serif text-slate-500 line-through bg-white p-2 border border-slate-200 rounded-sm">
                          {formatValue(change.currentValue, change.field)}
                        </div>
                        <div className="text-sm font-serif text-slate-800 font-medium bg-white p-2 border border-emerald-200 rounded-sm">
                          {formatValue(change.proposedValue, change.field)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {proposal.status === 'approved' && (
                  <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end">
                    <button
                      onClick={() => handleApplyApprovedChanges(proposal.id)}
                      disabled={loading}
                      className="px-6 py-2 bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-emerald-700 transition-colors"
                    >
                      {loading ? (isSpanish ? 'APLICANDO...' : 'APPLYING...') : (isSpanish ? 'Ejecutar Cambios' : 'Execute Changes')}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </InfoBlock>
      )}

      {/* SECCIÓN FINAL */}
      <div className="pt-8 border-t border-slate-200">
        <div className="max-w-2xl mx-auto text-center">
          <button
            onClick={handleMarkAsReady}
            disabled={loading}
            className="w-full py-4 bg-[#003b5c] hover:bg-sky-900 text-white text-sm font-bold uppercase tracking-widest rounded-sm transition-colors shadow-md disabled:bg-slate-300 flex items-center justify-center gap-3"
          >
            <Icons.CheckCircle />
            {isSpanish ? 'Aprobar Metadatos para Publicación Final' : 'Approve Metadata for Final Publication'}
          </button>
        </div>
      </div>
    </div>
  );
};