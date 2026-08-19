// src/components/AuthorMetadataResponseTab.js
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, 
  XCircle, 
  Info, 
  ChevronRight,
  AlertCircle,
  FileText,
  ShieldCheck,
  Tag,
  Code
} from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { useMetadataRefinement } from '../hooks/useMetadataRefinement';
import { onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

// ================= ICONOS SVG INTERNOS =================
const Icons = {
  Document: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  History: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  ArrowDown: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
};

// ================= FUNCIÓN DE FORMATEO CORREGIDA =================
const formatKeywords = (value, isSpanish) => {
  if (!value || (Array.isArray(value) && value.length === 0)) {
    return <span className="text-slate-400 italic font-serif text-sm">[{isSpanish ? 'Sin valor' : 'No value'}]</span>;
  }
  
  const keywords = Array.isArray(value) ? value : [value];
  
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {keywords.map((kw, idx) => (
        <span key={idx} className="inline-block bg-slate-50 border border-slate-200 px-2.5 py-1 text-xs font-serif text-slate-700 rounded-full">
          {String(kw)}
        </span>
      ))}
    </div>
  );
};

const formatSpecializedCodes = (value, isSpanish) => {
  if (!value || (Array.isArray(value) && value.length === 0)) {
    return <span className="text-slate-400 italic font-serif text-sm">[{isSpanish ? 'Sin valor' : 'No value'}]</span>;
  }
  
  const codes = Array.isArray(value) ? value : String(value).split(';').map(c => c.trim()).filter(Boolean);
  
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {codes.map((code, idx) => (
        <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 text-white rounded-sm text-xs font-mono font-bold">
          <Code size={12} />
          {String(code)}
        </span>
      ))}
    </div>
  );
};

const formatAuthors = (value, isSpanish) => {
  if (!value || (Array.isArray(value) && value.length === 0)) {
    return <span className="text-slate-400 italic font-serif text-sm">[{isSpanish ? 'Sin valor' : 'No value'}]</span>;
  }
  
  const authors = Array.isArray(value) ? value : [value];
  
  return (
    <ul className="list-disc list-inside space-y-1">
      {authors.map((author, idx) => (
        <li key={idx} className="font-serif text-sm text-slate-700 leading-relaxed">
          {typeof author === 'object' 
            ? `${author.firstName || ''} ${author.lastName || ''}`.trim() || author.name || JSON.stringify(author)
            : String(author)}
        </li>
      ))}
    </ul>
  );
};

export const AuthorMetadataResponseTab = ({ submission, user, onResponded }) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  const { loading, respondToProposal, error: hookError } = useMetadataRefinement(user);
  
  const [pendingProposals, setPendingProposals] = useState([]);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [responseComments, setResponseComments] = useState('');
  const [localError, setLocalError] = useState(null);
  const [loadingProposals, setLoadingProposals] = useState(true);

  useEffect(() => {
    if (hookError) {
      setLocalError(hookError);
      setTimeout(() => setLocalError(null), 5000);
    }
  }, [hookError]);

  useEffect(() => {
    if (!submission?.id) {
      setLoadingProposals(false);
      return;
    }

    const proposalsRef = collection(db, 'submissions', submission.id, 'metadataProposals');
    const q = query(
      proposalsRef, 
      where('status', '==', 'pending-author'),
      orderBy('proposedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedProposals = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        proposedAt: doc.data().proposedAt?.toDate?.() || null
      }));
      
      setPendingProposals(loadedProposals);
      setLoadingProposals(false);
      
      if (loadedProposals.length > 0 && !selectedProposal) {
        setSelectedProposal(loadedProposals[0]);
      }
    }, (error) => {
      setLocalError(isSpanish ? 'Error al consultar el registro de enmiendas.' : 'Error consulting amendment records.');
      setLoadingProposals(false);
    });

    return () => unsubscribe();
  }, [submission?.id, isSpanish]);

  const handleResponse = async (isAccepted) => {
    if (!selectedProposal) return;
    
    if (!isAccepted && !responseComments.trim()) {
      const confirmReject = window.confirm(
        isSpanish 
          ? '¿Desea omitir las observaciones? Se requiere encarecidamente una justificación académica para denegar la enmienda editorial.'
          : 'Do you wish to skip observations? An academic justification is strongly required to deny the editorial amendment.'
      );
      if (!confirmReject) return;
    }

    const result = await respondToProposal(submission.id, selectedProposal.id, isAccepted, responseComments);
    
    if (result.success) {
      setResponseComments('');
      setSelectedProposal(null);
      onResponded?.();
    } else {
      setLocalError(result.error);
    }
  };

  // ================= FORMATEO CORREGIDO =================
  const formatValue = (value, fieldName = '') => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-slate-400 italic font-serif text-sm">[{isSpanish ? 'Sin valor' : 'No value'}]</span>;
    }
    
    // Keywords libres (ES/EN) - SIN códigos, solo términos
    if (fieldName === 'keywords' || fieldName === 'keywordsEs' || fieldName === 'keywordsEn') {
      return formatKeywords(value, isSpanish);
    }
    
    // Códigos especializados - CAMPO SEPARADO
    if (fieldName === 'specializedCodes') {
      return formatSpecializedCodes(value, isSpanish);
    }
    
    // Vocabulario controlado - Campo simple
    if (fieldName === 'keywordsVocabulario') {
      return (
        <span className="px-3 py-1 bg-[#003b5c] text-white rounded-sm text-xs font-sans font-bold">
          {String(value)}
        </span>
      );
    }
    
    // Autores
    if (fieldName === 'authors') {
      return formatAuthors(value, isSpanish);
    }
    
    // Arrays genéricos
    if (Array.isArray(value)) {
      return (
        <ul className="list-disc list-inside space-y-1">
          {value.map((v, i) => (
            <li key={i} className="font-serif text-sm text-slate-700 leading-relaxed">
              {typeof v === 'object' ? JSON.stringify(v) : String(v)}
            </li>
          ))}
        </ul>
      );
    }
    
    // Valor simple
    return <span className="font-serif text-sm leading-relaxed text-slate-800">{String(value)}</span>;
  };

  // ================= TARJETA DE CAMBIO =================
  const ChangeCard = ({ change, index }) => {
    // Determinar el label del campo
    const fieldLabels = {
      'title': isSpanish ? 'Título' : 'Title',
      'titleEn': isSpanish ? 'Título (Inglés)' : 'Title (English)',
      'abstract': isSpanish ? 'Resumen' : 'Abstract',
      'abstractEn': isSpanish ? 'Resumen (Inglés)' : 'Abstract (English)',
      'keywords': isSpanish ? 'Palabras Clave' : 'Keywords',
      'keywordsEs': isSpanish ? 'Palabras Clave (ES)' : 'Keywords (ES)',
      'keywordsEn': isSpanish ? 'Palabras Clave (EN)' : 'Keywords (EN)',
      'keywordsVocabulario': isSpanish ? 'Vocabulario Controlado' : 'Controlled Vocabulary',
      'specializedCodes': isSpanish ? 'Códigos Especializados' : 'Specialized Codes',
      'authors': isSpanish ? 'Autores' : 'Authors',
      'funding': isSpanish ? 'Financiamiento' : 'Funding',
      'conflictOfInterest': isSpanish ? 'Conflicto de Intereses' : 'Conflict of Interest',
      'dataAvailability': isSpanish ? 'Disponibilidad de Datos' : 'Data Availability',
    };
    
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className="bg-white border border-slate-200 shadow-sm relative overflow-hidden"
      >
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#C0A86A] to-[#003b5c]"></div>
        
        <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex flex-wrap gap-3 justify-between items-center pl-6">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#C0A86A] rounded-full"></span>
            <span className="text-xs font-bold uppercase tracking-widest text-[#003b5c]">
              {fieldLabels[change.field] || change.field}
            </span>
          </div>
          {change.requiresAuthorConsent && (
            <span className="flex items-center gap-1.5 text-[10px] font-bold bg-amber-50 text-amber-800 px-3 py-1 uppercase tracking-wider border border-amber-200">
              <ShieldCheck size={14} className="text-amber-600" />
              {isSpanish ? 'Requiere su autorización' : 'Requires your authorization'}
            </span>
          )}
        </div>
        
        <div className="p-5 sm:p-6 pl-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 md:gap-6 items-stretch">
            
            <div className="space-y-2">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest border-b border-slate-100 pb-1.5 block">
                {isSpanish ? 'Registro Actual' : 'Current Record'}
              </span>
              <div className="p-4 bg-rose-50/20 border border-rose-100/30 text-slate-500 line-through decoration-rose-300/40 h-full min-h-[60px]">
                {formatValue(change.currentValue, change.field)}
              </div>
            </div>

            <div className="flex justify-center items-center py-2 md:py-0">
              <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
                <ChevronRight size={16} className="hidden md:block" />
                <Icons.ArrowDown />
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] text-[#003b5c] uppercase font-bold tracking-widest border-b border-[#C0A86A]/30 pb-1.5 block">
                {isSpanish ? 'Enmienda Propuesta' : 'Proposed Amendment'}
              </span>
              <div className="p-4 bg-blue-50/20 border border-blue-100/40 text-[#003b5c] font-medium h-full min-h-[60px] shadow-inner">
                {formatValue(change.proposedValue, change.field)}
              </div>
            </div>
          </div>

          {change.reason && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex gap-3 items-start bg-slate-50 p-4 border border-slate-100">
                <Info size={16} className="text-[#C0A86A] shrink-0 mt-0.5" />
                <div>
                  <p className="font-sans font-bold text-[10px] uppercase tracking-widest text-slate-400 mb-1">
                    {isSpanish ? 'Justificación Editorial' : 'Editorial Justification'}
                  </p>
                  <p className="text-sm font-serif text-slate-600 italic leading-relaxed">
                    "{change.reason}"
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  if (loadingProposals) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        <div className="w-10 h-10 border-2 border-t-[#003b5c] border-slate-200 rounded-full animate-spin"></div>
        <p className="font-serif italic text-slate-500 text-lg">
          {isSpanish ? 'Consultando el registro de enmiendas...' : 'Consulting amendment records...'}
        </p>
      </div>
    );
  }

  if (pendingProposals.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }}
        className="text-center py-12 sm:py-16"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-emerald-50 border border-emerald-200 mb-6">
          <CheckCircle size={36} className="text-emerald-600 sm:w-10 sm:h-10" />
        </div>
        <h3 className="font-serif text-xl sm:text-2xl text-[#003b5c] mb-3">
          {isSpanish ? 'Registro Actualizado' : 'Record Up to Date'}
        </h3>
        <p className="font-sans text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
          {isSpanish 
            ? 'El registro bibliográfico no presenta enmiendas pendientes de su revisión.'
            : 'The bibliographic record has no amendments pending your review.'}
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      
      {pendingProposals.length > 1 && (
        <div className="flex gap-1 sm:gap-2 overflow-x-auto pb-2 border-b-2 border-slate-200">
          {pendingProposals.map((prop, idx) => (
            <button
              key={prop.id}
              onClick={() => setSelectedProposal(prop)}
              className={`flex-shrink-0 flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3 transition-all border-b-2 -mb-[2px] ${
                selectedProposal?.id === prop.id 
                  ? 'border-[#003b5c] text-[#003b5c] bg-slate-50' 
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
              }`}
            >
              <FileText size={16} className="flex-shrink-0" />
              <div className="text-left">
                <p className="text-[10px] font-bold uppercase tracking-widest">
                  {isSpanish ? 'Resolución' : 'Resolution'} #{pendingProposals.length - idx}
                </p>
                <p className="font-serif text-sm whitespace-nowrap">
                  {prop.proposedAt?.toLocaleDateString()}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        <div className="lg:col-span-2 space-y-6">
          <AnimatePresence mode="wait">
            {selectedProposal && (
              <motion.div
                key={selectedProposal.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between border-b border-[#003b5c] pb-4">
                  <div>
                    <h3 className="font-serif text-2xl text-[#003b5c]">
                      {isSpanish ? 'Detalle de la Enmienda' : 'Amendment Details'}
                    </h3>
                    <p className="font-sans text-xs font-bold uppercase tracking-widest text-[#C0A86A] mt-1">
                      {selectedProposal.changes?.length || 0} {isSpanish ? 'campos afectados' : 'affected fields'}
                    </p>
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-2 text-[10px] font-mono text-slate-400 bg-slate-50 px-3 py-1 border border-slate-200">
                    <Icons.History />
                    {selectedProposal.proposedAt?.toLocaleDateString()}
                  </span>
                </div>

                <div className="space-y-5">
                  {selectedProposal.changes?.map((change, idx) => (
                    <ChangeCard key={idx} change={change} index={idx} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="lg:col-span-1 lg:sticky lg:top-6">
          <div className="bg-white border border-slate-200 shadow-sm">
            
            <div className="bg-[#003b5c] px-5 py-4 flex items-center gap-2">
              <ShieldCheck size={16} className="text-[#C0A86A] flex-shrink-0" />
              <h4 className="font-sans font-bold text-xs uppercase tracking-widest text-white">
                {isSpanish ? 'Su Decisión' : 'Your Decision'}
              </h4>
            </div>
            
            <div className="p-5 sm:p-6 space-y-6">
              
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                  {isSpanish ? 'Emitido por' : 'Issued by'}
                </p>
                <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100">
                  <div className="w-10 h-10 bg-white border border-slate-200 flex items-center justify-center text-[#003b5c] font-serif text-lg font-bold flex-shrink-0">
                    {selectedProposal?.proposedByEmail?.charAt(0).toUpperCase() || 'E'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#003b5c] truncate">
                      {isSpanish ? 'Comité Editorial' : 'Editorial Committee'}
                    </p>
                    <p className="text-xs text-slate-500 font-mono truncate">
                      {selectedProposal?.proposedByEmail || '—'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {isSpanish ? 'Sus Observaciones' : 'Your Observations'}
                  <span className="text-slate-300 ml-1 font-normal">({isSpanish ? 'Opcional' : 'Optional'})</span>
                </label>
                <textarea
                  value={responseComments}
                  onChange={(e) => setResponseComments(e.target.value)}
                  rows={4}
                  className="w-full p-4 bg-slate-50 border border-slate-200 focus:ring-1 focus:ring-[#003b5c] focus:border-[#003b5c] transition-all font-serif text-sm text-slate-800 resize-none placeholder:text-slate-400"
                  placeholder={isSpanish 
                    ? 'Exponga aquí sus razones en caso de denegar los cambios propuestos...' 
                    : 'State your reasons here if denying the proposed changes...'}
                />
              </div>

              {localError && (
                <motion.div 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-serif flex items-start gap-2"
                >
                  <AlertCircle size={14} className="shrink-0 mt-0.5" /> 
                  {localError}
                </motion.div>
              )}

              <div className="space-y-3 pt-4 border-t border-slate-100">
                <button
                  onClick={() => handleResponse(true)}
                  disabled={loading}
                  className="w-full py-3.5 bg-[#003b5c] hover:bg-[#002840] disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold uppercase tracking-widest text-xs transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      {isSpanish ? 'Autorizar Enmiendas' : 'Authorize Amendments'}
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => handleResponse(false)}
                  disabled={loading}
                  className="w-full py-3.5 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-slate-600 hover:text-rose-700 font-bold uppercase tracking-widest text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <XCircle size={16} />
                  {isSpanish ? 'Denegar Modificaciones' : 'Deny Modifications'}
                </button>
              </div>

              <div className="bg-amber-50/80 border border-amber-200/60 p-4">
                <p className="text-[10px] text-amber-800 uppercase font-bold tracking-widest mb-1.5 flex items-center gap-1.5">
                  <ShieldCheck size={12} className="text-amber-600" />
                  {isSpanish ? 'Aviso Importante' : 'Important Notice'}
                </p>
                <p className="text-xs text-amber-900/80 font-serif leading-relaxed">
                  {isSpanish 
                    ? 'Al autorizar estas modificaciones, los metadatos de su manuscrito se actualizarán permanentemente.'
                    : 'By authorizing these modifications, your manuscript\'s metadata will be permanently updated.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};