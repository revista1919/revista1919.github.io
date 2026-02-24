import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, 
  XCircle, 
  MessageSquare, 
  Info, 
  History, 
  ChevronRight,
  AlertCircle,
  Clock,
  User,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { useMetadataRefinement } from '../hooks/useMetadataRefinement';
import { onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

export const AuthorMetadataResponseTab = ({ submission, user, onResponded }) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  const { loading, respondToProposal, error: hookError } = useMetadataRefinement(user);
  
  const [pendingProposals, setPendingProposals] = useState([]);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [responseComments, setResponseComments] = useState('');
  const [localError, setLocalError] = useState(null);
  const [loadingProposals, setLoadingProposals] = useState(true);

  // Mostrar errores del hook
  useEffect(() => {
    if (hookError) {
      setLocalError(hookError);
      setTimeout(() => setLocalError(null), 5000);
    }
  }, [hookError]);

  // Cargar propuestas pendientes para este artículo
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
      setLocalError(isSpanish ? 'Error al cargar propuestas' : 'Error loading proposals');
      setLoadingProposals(false);
    });

    return () => unsubscribe();
  }, [submission?.id, isSpanish]);

  const handleResponse = async (isAccepted) => {
    if (!selectedProposal) return;
    
    if (!isAccepted && !responseComments.trim()) {
      const confirmReject = window.confirm(
        isSpanish 
          ? '¿Deseas agregar un comentario para explicar el rechazo? Es altamente recomendado para el proceso editorial.'
          : 'Would you like to add a comment to explain the rejection? It is highly recommended for the editorial process.'
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

  const formatValue = (value) => {
    if (value === null || value === undefined || value === '') return <span className="text-gray-400 italic">none</span>;
    if (Array.isArray(value)) {
      return value.map((v, i) => (
        <span key={i} className="inline-block bg-slate-100 rounded px-2 py-0.5 m-0.5 border border-slate-200 text-xs sm:text-sm">
          {typeof v === 'object' ? (v.lastName ? `${v.lastName}, ${v.firstName}` : JSON.stringify(v)) : String(v)}
        </span>
      ));
    }
    return String(value);
  };

  const ChangeCard = ({ change, index }) => (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all border-l-4 border-l-indigo-500"
    >
      <div className="p-3 sm:p-4 bg-slate-50/50 border-b border-slate-100 flex flex-wrap gap-2 justify-between items-center">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 break-words">
          {change.field.replace(/([A-Z])/g, ' $1').trim()}
        </span>
        {change.requiresAuthorConsent && (
          <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase whitespace-nowrap">
            <ShieldCheck size={12} /> {isSpanish ? 'Requiere Consentimiento' : 'Requires Consent'}
          </span>
        )}
      </div>
      
      <div className="p-3 sm:p-5 space-y-4">
        {/* Versión móvil: stacked */}
        <div className="block md:hidden space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">{isSpanish ? 'Original' : 'Original'}</span>
            <div className="p-3 bg-red-50/30 rounded-lg border border-red-100/50 text-slate-600 line-through decoration-red-300 text-xs sm:text-sm break-words">
              {formatValue(change.currentValue)}
            </div>
          </div>
          
          <div className="flex justify-center">
            <ChevronRight className="text-slate-300 rotate-90" />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-emerald-600 uppercase font-semibold">{isSpanish ? 'Propuesto' : 'Proposed'}</span>
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 text-emerald-900 font-medium text-xs sm:text-sm break-words">
              {formatValue(change.proposedValue)}
            </div>
          </div>
        </div>

        {/* Versión desktop: grid */}
        <div className="hidden md:grid md:grid-cols-[1fr,40px,1fr] gap-4 items-center">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">{isSpanish ? 'Original' : 'Original'}</span>
            <div className="p-3 bg-red-50/30 rounded-lg border border-red-100/50 text-slate-600 line-through decoration-red-300 text-sm break-words">
              {formatValue(change.currentValue)}
            </div>
          </div>

          <div className="flex justify-center">
            <ChevronRight className="text-slate-300 group-hover:text-indigo-400 transition-colors" />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-emerald-600 uppercase font-semibold">{isSpanish ? 'Propuesto' : 'Proposed'}</span>
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 text-emerald-900 font-medium text-sm break-words">
              {formatValue(change.proposedValue)}
            </div>
          </div>
        </div>
      </div>

      {change.reason && (
        <div className="px-3 sm:px-5 pb-4">
          <div className="flex gap-2 items-start bg-indigo-50/50 p-3 rounded-lg border border-indigo-100">
            <Info size={16} className="text-indigo-500 mt-0.5 shrink-0" />
            <p className="text-xs text-indigo-800 italic break-words">
              <span className="font-semibold not-italic mr-1">{isSpanish ? 'Razón:' : 'Reason:'}</span>
              "{change.reason}"
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );

  if (loadingProposals) return (
    <div className="flex flex-col items-center justify-center p-10 sm:p-20 space-y-4">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
      </div>
      <p className="text-slate-500 animate-pulse font-medium text-sm sm:text-base">
        {isSpanish ? 'Sincronizando propuestas...' : 'Syncing proposals...'}
      </p>
    </div>
  );

  if (pendingProposals.length === 0) return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-8 sm:p-12 text-center"
    >
      <div className="bg-slate-50 w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
        <CheckCircle size={32} className="text-slate-300 sm:w-10 sm:h-10" />
      </div>
      <h3 className="text-lg sm:text-xl font-semibold text-slate-800 mb-2">
        {isSpanish ? '¡Todo al día!' : 'Everything is up to date!'}
      </h3>
      <p className="text-sm sm:text-base text-slate-500 max-w-sm mx-auto">
        {isSpanish 
          ? 'No hay propuestas de cambios en los metadatos pendientes de tu revisión en este momento.' 
          : 'There are no metadata change proposals pending your review at this time.'}
      </p>
    </motion.div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto space-y-6 sm:space-y-8 pb-8 sm:pb-12 px-4 sm:px-0"
    >
      {/* Header - optimizado para móvil */}
      <header className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start justify-between bg-gradient-to-br from-indigo-900 to-slate-900 rounded-xl sm:rounded-2xl p-5 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-2 w-full sm:w-auto">
          <div className="inline-flex items-center gap-2 bg-indigo-500/30 backdrop-blur-md px-3 py-1 rounded-full border border-indigo-400/30 text-[10px] sm:text-xs font-bold uppercase tracking-widest">
            <ShieldCheck size={12} className="sm:w-3.5 sm:h-3.5" /> COPE Compliance
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-serif">
            {isSpanish ? 'Revisión de Metadatos' : 'Metadata Review'}
          </h2>
          <p className="text-indigo-200 max-w-xl text-xs sm:text-sm leading-relaxed">
            {isSpanish 
              ? 'Como autor, tienes el control final sobre la integridad de tu artículo. Revisa cuidadosamente los cambios sugeridos por el equipo editorial.' 
              : 'As an author, you have final control over your article\'s integrity. Carefully review the changes suggested by the editorial team.'}
          </p>
        </div>
        <div className="relative z-10 bg-white/10 backdrop-blur-md rounded-xl p-3 sm:p-4 border border-white/20 w-full sm:w-auto sm:min-w-[200px]">
          <div className="flex items-center gap-3">
            <div className="bg-amber-400 p-1.5 sm:p-2 rounded-lg text-amber-900">
              <Clock size={16} className="sm:w-5 sm:h-5" />
            </div>
            <div>
              <p className="text-[8px] sm:text-[10px] text-indigo-300 uppercase font-bold tracking-tighter">Pendientes</p>
              <p className="text-lg sm:text-xl font-bold">{pendingProposals.length}</p>
            </div>
          </div>
          <p className="text-[9px] sm:text-[11px] text-indigo-200 italic mt-2">
            {isSpanish ? 'Última actualización hoy' : 'Last updated today'}
          </p>
        </div>
        <div className="absolute -right-10 -bottom-10 w-48 sm:w-64 h-48 sm:h-64 bg-indigo-500/10 rounded-full blur-3xl"></div>
      </header>

      {/* Proposal Selector - horizontal scroll en móvil */}
      {pendingProposals.length > 1 && (
        <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
          {pendingProposals.map((prop, idx) => (
            <button
              key={prop.id}
              onClick={() => setSelectedProposal(prop)}
              className={`flex-shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2 sm:py-3 rounded-xl transition-all border ${
                selectedProposal?.id === prop.id 
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' 
                : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
              }`}
            >
              <History size={14} className="sm:w-4 sm:h-4" />
              <div className="text-left">
                <p className="text-[8px] sm:text-[10px] opacity-70 uppercase font-bold">{isSpanish ? 'Propuesta' : 'Proposal'} #{pendingProposals.length - idx}</p>
                <p className="text-xs sm:text-sm font-semibold whitespace-nowrap">{prop.proposedAt?.toLocaleDateString()}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Main Review Area - stacked en móvil */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        
        {/* Left Col: Changes List */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <AnimatePresence mode="wait">
            {selectedProposal && (
              <motion.div
                key={selectedProposal.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm sm:text-base">
                    <MessageSquare size={16} className="text-indigo-600 sm:w-5 sm:h-5" />
                    {isSpanish ? 'Cambios Sugeridos' : 'Suggested Changes'} 
                    <span className="bg-slate-200 text-slate-600 text-[10px] sm:text-xs px-2 py-0.5 rounded-full">
                      {selectedProposal.changes?.length}
                    </span>
                  </h3>
                </div>

                <div className="space-y-3 sm:space-y-4">
                  {selectedProposal.changes?.map((change, idx) => (
                    <ChangeCard key={idx} change={change} index={idx} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Col: Actions & Feedback - sticky en desktop, normal en móvil */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-6 space-y-4 sm:space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm">
              <h4 className="font-bold text-slate-800 mb-3 sm:mb-4 flex items-center gap-2 text-xs sm:text-sm uppercase tracking-wider">
                <User size={14} className="text-slate-400 sm:w-4 sm:h-4" />
                {isSpanish ? 'Origen de Propuesta' : 'Proposal Source'}
              </h4>
              <div className="space-y-3 mb-4 sm:mb-6">
                <div className="flex items-center gap-3 p-2 sm:p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold uppercase text-sm">
                    {selectedProposal?.proposedByEmail?.charAt(0)}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs sm:text-sm font-bold text-slate-700 truncate">{selectedProposal?.proposedByEmail}</p>
                    <p className="text-[8px] sm:text-[10px] text-slate-500 uppercase">{isSpanish ? 'Editor Asignado' : 'Assigned Editor'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="text-xs font-bold text-slate-500 uppercase mb-2 block">{isSpanish ? 'Tus Comentarios' : 'Your Comments'}</span>
                  <textarea
                    value={responseComments}
                    onChange={(e) => setResponseComments(e.target.value)}
                    rows={4}
                    className="w-full p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-xs sm:text-sm"
                    placeholder={isSpanish ? 'Opcional: Aclara dudas o justifica el rechazo...' : 'Optional: Clarify doubts or justify rejection...'}
                  />
                </label>

                {localError && (
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="flex items-center gap-2 p-2 sm:p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-600 text-[10px] sm:text-xs font-medium"
                  >
                    <AlertCircle size={12} className="sm:w-3.5 sm:h-3.5" /> {localError}
                  </motion.div>
                )}

                <div className="grid grid-cols-1 gap-2 sm:gap-3">
                  <button
                    onClick={() => handleResponse(true)}
                    disabled={loading}
                    className="w-full py-3 sm:py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 group text-sm sm:text-base"
                  >
                    {loading ? (
                      <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle size={16} className="sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" />
                        {isSpanish ? 'ACEPTAR CAMBIOS' : 'ACCEPT CHANGES'}
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={() => handleResponse(false)}
                    disabled={loading}
                    className="w-full py-3 sm:py-4 bg-white hover:bg-rose-50 border border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-200 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm sm:text-base"
                  >
                    <XCircle size={16} className="sm:w-5 sm:h-5" />
                    {isSpanish ? 'RECHAZAR PROPUESTA' : 'REJECT PROPOSAL'}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-3 sm:p-4 bg-amber-50 border border-amber-100 rounded-xl">
              <p className="text-[10px] sm:text-[11px] text-amber-800 leading-relaxed">
                <strong>{isSpanish ? 'Importante:' : 'Note:'}</strong> {isSpanish 
                  ? 'Al aceptar, los metadatos se actualizarán inmediatamente en la base de datos de producción.' 
                  : 'Upon acceptance, metadata will be immediately updated in the production database.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};