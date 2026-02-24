// src/components/AuthorSubmissionsPanel.js
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth, submitRevision } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { useLanguage } from '../hooks/useLanguage';
import { AuthorMetadataResponseTab } from './AuthorMetadataResponseTab';

const OXFORD_COLORS = {
  darkBlue: '#002147',
  gold: '#C0A86A',
  black: '#050505',
  softGray: '#F8F9FB',
  border: '#E5E9F0'
};

const SUBMISSION_STATES = {
  'submitted': { 
    es: 'Enviado', 
    en: 'Submitted',
    color: 'bg-blue-50 text-blue-800',
    icon: '◈',
    description: { 
      es: 'Tu artículo ha sido recibido y está en espera de revisión editorial',
      en: 'Your article has been received and is awaiting editorial review'
    }
  },
  'in-desk-review': { 
    es: 'En revisión editorial', 
    en: 'In desk review',
    color: 'bg-purple-50 text-purple-800',
    icon: '⌬',
    description: { 
      es: 'Un editor está revisando tu artículo',
      en: 'An editor is reviewing your article'
    }
  },
  'desk-review-rejected': { 
    es: 'Rechazado en revisión editorial', 
    en: 'Rejected in desk review',
    color: 'bg-red-50 text-red-800',
    icon: '✕',
    description: { 
      es: 'El artículo no pasó la revisión editorial inicial',
      en: 'The article did not pass initial editorial review'
    }
  },
  'in-reviewer-selection': { 
    es: 'Seleccionando revisores', 
    en: 'Selecting reviewers',
    color: 'bg-amber-50 text-amber-800',
    icon: '⚇',
    description: { 
      es: 'El equipo editorial está seleccionando revisores para tu artículo',
      en: 'The editorial team is selecting reviewers for your article'
    }
  },
  'awaiting-reviewer-responses': { 
    es: 'Esperando respuesta de revisores', 
    en: 'Awaiting reviewer responses',
    color: 'bg-orange-50 text-orange-800',
    icon: '⌛',
    description: { 
      es: 'Los revisores están decidiendo si aceptan revisar tu artículo',
      en: 'Reviewers are deciding whether to accept reviewing your article'
    }
  },
  'in-peer-review': { 
    es: 'En revisión por pares', 
    en: 'In peer review',
    color: 'bg-indigo-50 text-indigo-800',
    icon: '✎',
    description: { 
      es: 'Los revisores están evaluando tu artículo',
      en: 'Reviewers are evaluating your article'
    }
  },
  'awaiting-editor-decision': {
    es: 'Esperando decisión del editor', 
    en: 'Awaiting editor decision',
    color: 'bg-violet-50 text-violet-800',
    icon: '⚖️',
    description: { 
      es: 'Las revisiones están completadas. El editor tomará una decisión final pronto',
      en: 'Reviews are complete. The editor will make a final decision soon'
    }
  },
  'revisions-requested': { 
    es: 'Revisiones solicitadas', 
    en: 'Revisions requested',
    color: 'bg-amber-50 text-amber-800',
    icon: '✎',
    description: { 
      es: 'El editor ha solicitado cambios en tu artículo. Por favor, sube una versión revisada.',
      en: 'The editor has requested changes to your article. Please upload a revised version.'
    }
  },
  'minor-revision-required': { 
    es: 'Revisiones menores requeridas', 
    en: 'Minor revisions required',
    color: 'bg-yellow-50 text-yellow-800',
    icon: '✎',
    description: { 
      es: 'Se requieren cambios menores antes de la aceptación',
      en: 'Minor changes are required before acceptance'
    }
  },
  'major-revision-required': { 
    es: 'Revisiones mayores requeridas', 
    en: 'Major revisions required',
    color: 'bg-orange-50 text-orange-800',
    icon: '🔄',
    description: { 
      es: 'Se requieren cambios sustanciales y una nueva revisión',
      en: 'Substantial changes and re-review are required'
    }
  },
  'awaiting-revision': { 
    es: 'Esperando tu revisión', 
    en: 'Awaiting your revision',
    color: 'bg-blue-50 text-blue-800',
    icon: '⏳',
    description: { 
      es: 'Por favor, sube la versión revisada de tu artículo',
      en: 'Please upload the revised version of your article'
    }
  },
  'accepted': { 
    es: 'Aceptado', 
    en: 'Accepted',
    color: 'bg-emerald-50 text-emerald-800',
    icon: '✓',
    description: { 
      es: '¡Tu artículo ha sido aceptado para publicación!',
      en: 'Your article has been accepted for publication!'
    }
  },
  'rejected': { 
    es: 'Rechazado', 
    en: 'Rejected',
    color: 'bg-red-50 text-red-800',
    icon: '✕',
    description: { 
      es: 'El artículo no ha sido aceptado para publicación',
      en: 'The article has not been accepted for publication'
    }
  },
  'metadata_refinement_pending': {
    es: 'Revisando metadatos', 
    en: 'Reviewing metadata',
    color: 'bg-teal-50 text-teal-800',
    icon: '📋',
    description: { 
      es: 'El editor ha propuesto cambios en los metadatos. Por favor, revísalos.',
      en: 'The editor has proposed metadata changes. Please review them.'
    }
  }
};

const AuthorSubmissionsPanel = ({ user }) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [revisionFile, setRevisionFile] = useState(null);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedSubmission, setExpandedSubmission] = useState(null);
  const [debugInfo, setDebugInfo] = useState({});

  // LOG DE DEPURACIÓN: Verificar props iniciales
  useEffect(() => {
    console.log('🔍 [AuthorSubmissionsPanel] Montado con user:', user?.uid);
    if (user) {
      console.log('🔍 Email del usuario:', user.email);
      console.log('🔍 Roles:', user.roles);
    }
  }, [user]);

  // Cargar envíos del usuario actual con LOGS EXTENSIVOS
  useEffect(() => {
    if (!user?.uid) {
      console.log('⚠️ [AuthorSubmissionsPanel] No hay usuario autenticado');
      setLoading(false);
      return;
    }

    console.log('🚀 [AuthorSubmissionsPanel] Iniciando carga de envíos para:', user.uid);

    const q = query(
      collection(db, 'submissions'),
      where('authorUID', '==', user.uid)
    );

    // MAPAS para almacenar los listeners
    const reviewsListeners = new Map();
    const proposalsListeners = new Map();

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`📥 [AuthorSubmissionsPanel] Recibidos ${snapshot.docs.length} envíos de Firestore`);
      
      // LOG DETALLADO: Cada envío recibido
      snapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`  📄 Envío ${index + 1}:`, {
          id: doc.id,
          title: data.title,
          status: data.status,
          hasMetadataRefinement: !!data.metadataRefinement,
          metadataRefinementStatus: data.metadataRefinement?.status,
          authorUID: data.authorUID,
          createdAt: data.createdAt?.toDate?.() || data.createdAt
        });
      });

      // 1. PRIMERO: Crear la lista base de submissions
      const baseSubmissionsList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
          deskReviewCompletedAt: data.deskReviewCompletedAt?.toDate?.(),
          decisionMadeAt: data.decisionMadeAt?.toDate?.(),
          reviews: [], // Inicializar vacío
          pendingProposals: [] // Inicializar vacío
        };
      });

      // Ordenar por fecha
      baseSubmissionsList.sort((a, b) => b.createdAt - a.createdAt);
      
      // 2. ACTUALIZAR EL ESTADO CON LA LISTA BASE
      setSubmissions(baseSubmissionsList);
      setLoading(false);

      // 3. LOG: Verificar si hay metadataRefinement
      baseSubmissionsList.forEach(sub => {
        if (sub.metadataRefinement) {
          console.log(`🔍 [MetadataRefinement] Envío ${sub.id} tiene metadataRefinement:`, sub.metadataRefinement);
        } else {
          console.log(`🔍 [MetadataRefinement] Envío ${sub.id} NO tiene campo metadataRefinement`);
        }
      });

      // 4. CONFIGURAR LISTENERS PARA SUBCOLECCIONES
      
      // Limpiar listeners anteriores
      reviewsListeners.forEach((unsub) => unsub());
      reviewsListeners.clear();
      proposalsListeners.forEach((unsub) => unsub());
      proposalsListeners.clear();

      // Por cada submission, crear listeners
      snapshot.docs.forEach(doc => {
        const submissionId = doc.id;
        
        console.log(`🔧 Configurando listeners para envío: ${submissionId}`);

        // Listener para reviews
        const reviewsQuery = query(
          collection(db, 'submissions', submissionId, 'reviews')
        );

        const unsubscribeReviews = onSnapshot(reviewsQuery, (reviewsSnapshot) => {
          console.log(`📬 [Reviews] ${reviewsSnapshot.docs.length} reviews cargadas para ${submissionId}`);
          
          const reviews = reviewsSnapshot.docs.map(reviewDoc => ({
            id: reviewDoc.id,
            ...reviewDoc.data(),
            submittedAt: reviewDoc.data().submittedAt?.toDate?.() || reviewDoc.data().submittedAt
          }));
          
          setSubmissions(prevSubs => 
            prevSubs.map(sub => 
              sub.id === submissionId 
                ? { ...sub, reviews: reviews }
                : sub
            )
          );
        }, (error) => {
          console.error(`❌ Error loading reviews for ${submissionId}:`, error);
        });

        reviewsListeners.set(submissionId, unsubscribeReviews);

        // Listener para metadataProposals pendientes
        const proposalsQuery = query(
          collection(db, 'submissions', submissionId, 'metadataProposals'),
          where('status', '==', 'pending-author')
        );

        const unsubscribeProposals = onSnapshot(proposalsQuery, (proposalsSnapshot) => {
          const pendingCount = proposalsSnapshot.docs.length;
          console.log(`📋 [MetadataProposals] ${pendingCount} propuestas pendientes para ${submissionId}`);
          
          // LOG DETALLADO: Cada propuesta
          proposalsSnapshot.docs.forEach((propDoc, idx) => {
            const propData = propDoc.data();
            console.log(`  📝 Propuesta ${idx + 1}:`, {
              id: propDoc.id,
              proposedBy: propData.proposedBy,
              proposedByEmail: propData.proposedByEmail,
              proposedAt: propData.proposedAt?.toDate?.() || propData.proposedAt,
              changesCount: propData.changes?.length || 0,
              status: propData.status
            });
          });

          const pendingProposals = proposalsSnapshot.docs.map(propDoc => ({
            id: propDoc.id,
            ...propDoc.data(),
            proposedAt: propDoc.data().proposedAt?.toDate?.() || propDoc.data().proposedAt
          }));
          
          setSubmissions(prevSubs => 
            prevSubs.map(sub => 
              sub.id === submissionId 
                ? { ...sub, pendingProposals: pendingProposals }
                : sub
            )
          );

          // Actualizar debugInfo
          setDebugInfo(prev => ({
            ...prev,
            [submissionId]: {
              ...prev[submissionId],
              pendingProposalsCount: pendingCount,
              pendingProposals: pendingProposals.map(p => ({
                id: p.id,
                proposedBy: p.proposedByEmail,
                changes: p.changes?.map(c => c.field)
              }))
            }
          }));
        }, (error) => {
          console.error(`❌ Error loading proposals for ${submissionId}:`, error);
        });

        proposalsListeners.set(submissionId, unsubscribeProposals);
      });
    }, (error) => {
      console.error('❌ Error loading submissions:', error);
      setLoading(false);
    });

    // Cleanup
    return () => {
      console.log('🧹 [AuthorSubmissionsPanel] Limpiando listeners');
      unsubscribe();
      reviewsListeners.forEach((unsub) => unsub());
      reviewsListeners.clear();
      proposalsListeners.forEach((unsub) => unsub());
      proposalsListeners.clear();
    };
  }, [user]);

  // LOG DE DEPURACIÓN: Verificar estado de submissions cada vez que cambia
  useEffect(() => {
    console.log('🔄 [State] Submissions actualizadas:', submissions.length);
    submissions.forEach(sub => {
      const hasPending = sub.pendingProposals?.length > 0;
      const hasMetadataField = !!sub.metadataRefinement;
      console.log(`  📊 ${sub.title?.substring(0, 30)}...`, {
        id: sub.id,
        status: sub.status,
        pendingProposals: sub.pendingProposals?.length || 0,
        hasMetadataRefinementField: hasMetadataField,
        metadataRefinementStatus: sub.metadataRefinement?.status,
        mostrarTab: hasPending ? 'SÍ (por propuestas)' : 'NO'
      });
    });
  }, [submissions]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword'
      ];
      if (validTypes.includes(file.type)) {
        setRevisionFile(file);
        console.log('📁 Archivo seleccionado:', file.name, file.type, file.size);
      } else {
        alert(isSpanish ? 'Por favor selecciona un archivo PDF o Word' : 'Please select a PDF or Word file');
      }
    }
  };

  const handleSubmitRevision = async () => {
    if (!revisionFile || !revisionNotes.trim()) {
      alert(isSpanish ? 'Debes seleccionar un archivo y agregar notas' : 'You must select a file and add notes');
      return;
    }

    setUploading(true);
    console.log('📤 Iniciando subida de revisión para:', selectedSubmission?.id);
    
    try {
      const reader = new FileReader();
      
      const filePromise = new Promise((resolve, reject) => {
        reader.onload = async () => {
          try {
            const base64 = reader.result;
            console.log('📄 Archivo convertido a base64, tamaño:', base64.length);
            
            const result = await submitRevision({
              submissionId: selectedSubmission.id,
              fileBase64: base64,
              fileName: revisionFile.name,
              notes: revisionNotes,
              round: selectedSubmission.currentRound || 1
            });

            console.log('✅ Resultado de submitRevision:', result);

            if (result.success) {
              alert(isSpanish ? 'Revisión enviada con éxito' : 'Revision submitted successfully');
              setSelectedSubmission(null);
              setRevisionFile(null);
              setRevisionNotes('');
            } else {
              throw new Error(result.error || 'Error al subir revisión');
            }
            
            resolve();
          } catch (error) {
            console.error('❌ Error en proceso de subida:', error);
            reject(error);
          }
        };
        
        reader.onerror = () => {
          console.error('❌ Error leyendo archivo');
          reject(new Error('Error leyendo archivo'));
        };
        reader.readAsDataURL(revisionFile);
      });

      await filePromise;

    } catch (error) {
      console.error('❌ Error submitting revision:', error);
      alert(isSpanish ? 'Error al enviar la revisión: ' + error.message : 'Error submitting revision: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const getStatusBadge = (status) => {
    const state = SUBMISSION_STATES[status] || SUBMISSION_STATES.submitted;
    return (
      <span className={`text-[10px] sm:text-xs px-2 py-0.5 sm:px-3 sm:py-1 font-bold uppercase tracking-tighter rounded-full ${state.color}`}>
        {state.icon} {state[language]}
      </span>
    );
  };

  const getTimelineStep = (status) => {
    const steps = [
      'submitted',
      'in-desk-review',
      'in-reviewer-selection',
      'awaiting-reviewer-responses',
      'in-peer-review',
      'accepted'
    ];
    return steps.indexOf(status);
  };

  // Verificar si hay propuestas pendientes (AHORA USA pendingProposals)
  const hasPendingMetadataProposals = (submission) => {
    const hasProposals = submission.pendingProposals?.length > 0;
    if (hasProposals) {
      console.log(`✅ [hasPendingMetadataProposals] Envío ${submission.id} tiene ${submission.pendingProposals.length} propuestas`);
    }
    return hasProposals;
  };

  // Panel de depuración (solo visible en desarrollo)
  const DebugPanel = () => {
    if (process.env.NODE_ENV !== 'development') return null;
    
    return (
      <div className="mb-6 p-4 bg-gray-900 text-green-400 rounded-lg font-mono text-xs overflow-auto max-h-60">
        <h4 className="font-bold text-white mb-2">🔧 DEBUG INFO</h4>
        <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
      </div>
    );
  };

  if (!user) {
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-12 text-center">
        <p className="text-gray-500">
          {isSpanish ? 'Inicia sesión para ver tus envíos' : 'Log in to view your submissions'}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 sm:p-20 space-y-4">
        <div className="w-12 h-12 border-4 border-t-[#002147] border-[#C0A86A]/20 rounded-full animate-spin"></div>
        <p className="font-['Playfair_Display'] italic text-slate-500">
          {isSpanish ? 'Consultando los archivos de la Revista Nacional...' : 'Consulting the National Journal archives...'}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6 space-y-6 sm:space-y-8 animate-in fade-in duration-700">
      <DebugPanel />
      
      {/* Header Épico - Responsive */}
      <header className="flex flex-col md:flex-row md:items-end justify-between border-b-2 border-[#002147] pb-4 sm:pb-6 mb-6 sm:mb-10">
        <div>
          <h1 className="font-['Playfair_Display'] text-3xl sm:text-4xl md:text-5xl font-black text-[#050505] tracking-tight">
            {isSpanish ? 'Escritorio del' : 'Author'}{' '}
            <span className="text-[#002147]">{isSpanish ? 'Autor' : 'Desk'}</span>
          </h1>
          <p className="text-slate-500 mt-1 sm:mt-2 font-['Inter'] uppercase tracking-widest text-[10px] sm:text-xs font-bold">
            {isSpanish 
              ? 'Revista Nacional de las Ciencias para Estudiantes — Gestión Editorial'
              : 'National Student Science Journal — Editorial Management'}
          </p>
        </div>
        <button
          onClick={() => window.location.href = '/submit'}
          className="mt-4 md:mt-0 px-6 sm:px-8 py-2 sm:py-3 bg-[#002147] text-white font-bold hover:bg-[#050505] transition-all transform hover:-translate-y-1 shadow-lg flex items-center gap-2 sm:gap-3 group text-sm sm:text-base"
        >
          <span className="text-lg sm:text-xl group-hover:rotate-90 transition-transform">+</span>
          {isSpanish ? 'INICIAR NUEVO ENVÍO' : 'START NEW SUBMISSION'}
        </button>
      </header>

      {submissions.length === 0 ? (
        <div className="text-center py-16 sm:py-24 bg-[#F8F9FB] border-2 border-dashed border-slate-200 rounded-lg">
          <p className="font-['Playfair_Display'] text-xl sm:text-2xl text-slate-400 italic">
            {isSpanish ? 'No se han encontrado manuscritos en su registro.' : 'No manuscripts found in your record.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-6">
          {submissions.map((sub) => (
            <motion.div
              key={sub.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`bg-white border ${expandedSubmission === sub.id ? 'border-[#C0A86A] shadow-2xl' : 'border-slate-200 shadow-sm'} transition-all duration-500 rounded-lg overflow-hidden`}
            >
              {/* Card Header - Totalmente Responsive */}
              <div 
                onClick={() => {
                  console.log('📌 Expandiendo envío:', sub.id, sub.title);
                  setExpandedSubmission(expandedSubmission === sub.id ? null : sub.id);
                }}
                className="p-4 sm:p-6 cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 relative overflow-hidden group"
              >
                {expandedSubmission === sub.id && (
                  <div className="absolute top-0 left-0 w-1 h-full bg-[#002147]" />
                )}
                
                <div className="flex-1 w-full sm:w-auto">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
                    <span className="text-[8px] sm:text-[10px] font-bold tracking-widest text-[#C0A86A] uppercase">
                      ID: {sub.id.substring(0,8)}
                    </span>
                    {getStatusBadge(sub.status)}
                    {hasPendingMetadataProposals(sub) && (
                      <span className="bg-yellow-100 text-yellow-700 text-[8px] sm:text-xs px-2 py-0.5 rounded-full animate-pulse">
                        {isSpanish ? `✏️ ${sub.pendingProposals.length}` : `✏️ ${sub.pendingProposals.length}`}
                      </span>
                    )}
                  </div>
                  <h3 className="font-['Playfair_Display'] text-lg sm:text-xl md:text-2xl font-bold text-[#050505] group-hover:text-[#002147] transition-colors break-words pr-8 sm:pr-0">
                    {sub.title}
                  </h3>
                  
                  {/* Info móvil */}
                  <div className="flex items-center gap-3 mt-2 sm:hidden text-xs text-slate-500">
                    <span>{sub.createdAt?.toLocaleDateString()}</span>
                    <span>{isSpanish ? 'Ronda:' : 'Round:'} {sub.currentRound || 1}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="text-right hidden sm:block">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                      {isSpanish ? 'Última actualización' : 'Last updated'}
                    </p>
                    <p className="text-xs sm:text-sm font-['Inter'] text-slate-700">
                      {sub.createdAt?.toLocaleDateString()}
                    </p>
                  </div>
                  <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-slate-200 flex items-center justify-center transition-all flex-shrink-0 ${
                    expandedSubmission === sub.id 
                      ? 'rotate-180 bg-[#002147] text-white' 
                      : 'group-hover:bg-slate-50'
                  }`}>
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="sm:w-3 sm:h-3">
                      <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Contenido Expandido - Totalmente Responsive */}
              <AnimatePresence>
                {expandedSubmission === sub.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-slate-100"
                  >
                    <div className="p-4 sm:p-6 md:p-8 bg-[#F8F9FB] grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
                      
                      {/* Columna Principal (2/3 en desktop) */}
                      <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                        {/* Descripción del estado actual */}
                        <section className="bg-white p-4 sm:p-6 shadow-sm border border-slate-200 rounded-lg">
                          <h4 className="font-['Playfair_Display'] font-bold text-base sm:text-lg mb-3 sm:mb-4 flex items-center gap-2">
                            <span className="text-[#C0A86A]">I.</span> 
                            {isSpanish ? 'Estado Actual' : 'Current Status'}
                          </h4>
                          <p className="text-slate-600 text-sm sm:text-base">
                            {SUBMISSION_STATES[sub.status]?.description[language]}
                          </p>
                        </section>

                        {/* Timeline Design - Solo mostrar si aplica */}
                        {!['accepted', 'rejected', 'desk-review-rejected'].includes(sub.status) && (
                          <section className="bg-white p-4 sm:p-6 shadow-sm border border-slate-200 rounded-lg">
                            <h4 className="font-['Playfair_Display'] font-bold text-base sm:text-lg mb-4 sm:mb-6 flex items-center gap-2">
                              <span className="text-[#C0A86A]">II.</span> 
                              {isSpanish ? 'Progreso del Manuscrito' : 'Manuscript Progress'}
                            </h4>
                            
                            {/* Timeline Responsive - Versión móvil horizontal con scroll */}
                            <div className="relative">
                              <div className="absolute top-4 left-0 w-full h-[1px] bg-slate-200 z-0 hidden sm:block" />
                              <div className="flex sm:justify-between overflow-x-auto sm:overflow-visible pb-2 sm:pb-0 gap-4 sm:gap-0">
                                {['submitted', 'in-desk-review', 'in-peer-review', 'accepted'].map((step, idx) => {
                                  const currentStep = getTimelineStep(sub.status);
                                  const isCompleted = idx < currentStep;
                                  const isCurrent = idx === currentStep;
                                  
                                  return (
                                    <div key={step} className="relative z-10 flex flex-col items-center flex-shrink-0">
                                      <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center transition-all text-xs sm:text-sm ${
                                        isCurrent 
                                          ? 'bg-[#002147] border-[#002147] text-white scale-110 sm:scale-125 shadow-lg' 
                                          : isCompleted
                                          ? 'bg-emerald-500 border-emerald-500 text-white'
                                          : 'bg-white border-slate-200 text-slate-300'
                                      }`}>
                                        {isCompleted ? '✓' : idx + 1}
                                      </div>
                                      <span className={`text-[8px] sm:text-[10px] mt-1 sm:mt-2 font-bold uppercase tracking-tighter whitespace-nowrap ${
                                        isCurrent ? 'text-[#002147]' : 'text-slate-400'
                                      }`}>
                                        {SUBMISSION_STATES[step]?.[language]}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </section>
                        )}

                        {/* Metadata Tab */}
                        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                          {console.log(`🎯 Renderizando AuthorMetadataResponseTab para ${sub.id} con ${sub.pendingProposals?.length || 0} propuestas`)}
                          <AuthorMetadataResponseTab
                            submission={sub}
                            user={user}
                            onResponded={() => {
                              console.log('✅ Propuesta respondida para:', sub.id);
                            }}
                          />
                        </div>

                        {/* Feedback del editor */}
                        {sub.deskReviewFeedback && (
                          <div className="bg-white p-4 sm:p-6 border border-slate-200 rounded-lg">
                            <h4 className="font-['Playfair_Display'] font-bold text-base sm:text-lg mb-3">
                              {isSpanish ? 'Feedback del Editor' : 'Editor Feedback'}
                            </h4>
                            <p className="text-slate-600 text-sm sm:text-base">{sub.deskReviewFeedback}</p>
                          </div>
                        )}

                        {/* Revisiones de pares */}
                        {sub.reviews && sub.reviews.length > 0 && (
                          <div className="bg-white p-4 sm:p-6 border border-slate-200 rounded-lg">
                            <h4 className="font-['Playfair_Display'] font-bold text-base sm:text-lg mb-4">
                              {isSpanish ? 'Revisiones de Pares' : 'Peer Reviews'}
                            </h4>
                            <div className="space-y-4">
                              {sub.reviews.map((review, idx) => (
                                <div key={review.id || idx} className="border border-slate-200 rounded-lg p-4">
                                  <div className="flex flex-wrap items-center gap-2 justify-between mb-3">
                                    <span className="font-medium text-xs sm:text-sm text-slate-500">
                                      {isSpanish ? `Revisión ${idx + 1}` : `Review ${idx + 1}`}
                                      {review.round && review.round > 1 && (
                                        <span className="ml-2 text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                                          {isSpanish ? `Ronda ${review.round}` : `Round ${review.round}`}
                                        </span>
                                      )}
                                    </span>
                                    <span className={`text-[10px] px-2 py-1 rounded-full ${
                                      review.recommendation === 'accept' ? 'bg-green-100 text-green-700' :
                                      review.recommendation === 'minor-revision' ? 'bg-blue-100 text-blue-700' :
                                      review.recommendation === 'major-revision' ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-red-100 text-red-700'
                                    }`}>
                                      {review.recommendation === 'accept' && (isSpanish ? 'Aceptar' : 'Accept')}
                                      {review.recommendation === 'minor-revision' && (isSpanish ? 'Revisiones menores' : 'Minor revisions')}
                                      {review.recommendation === 'major-revision' && (isSpanish ? 'Revisiones mayores' : 'Major revisions')}
                                      {review.recommendation === 'reject' && (isSpanish ? 'Rechazar' : 'Reject')}
                                    </span>
                                  </div>
                                  
                                  {/* Puntuaciones */}
                                  {review.scores && Object.keys(review.scores).length > 0 && (
                                    <div className="mb-3 flex flex-wrap gap-2 text-[10px] sm:text-xs">
                                      {Object.entries(review.scores).map(([key, value]) => (
                                        <div key={key} className="bg-slate-50 px-2 py-1 rounded">
                                          <span className="font-medium text-slate-600">
                                            {key === 'originality' && (isSpanish ? 'Originalidad:' : 'Originality:')}
                                            {key === 'methodology' && (isSpanish ? 'Metodología:' : 'Methodology:')}
                                            {key === 'clarity' && (isSpanish ? 'Claridad:' : 'Clarity:')}
                                            {key === 'relevance' && (isSpanish ? 'Relevancia:' : 'Relevance:')}
                                            {key === 'overall' && (isSpanish ? 'General:' : 'Overall:')}
                                          </span>{' '}
                                          <span className="font-bold text-[#0A1929]">{value}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  
                                  {/* Comentarios */}
                                  {review.commentsToAuthor && (
                                    <div className="text-xs sm:text-sm text-slate-600 mt-2">
                                      <p className="font-medium text-[#0A1929] mb-1">
                                        {isSpanish ? 'Comentarios:' : 'Comments:'}
                                      </p>
                                      <div className="bg-slate-50 p-3 rounded-lg text-xs sm:text-sm" 
                                           dangerouslySetInnerHTML={{ __html: review.commentsToAuthor.replace(/\n/g, '<br/>') }} />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Decisiones finales */}
                        {sub.finalDecision && (
                          <div className="bg-blue-50 p-4 sm:p-6 border border-blue-200 rounded-lg">
                            <h4 className="font-['Playfair_Display'] font-bold text-base sm:text-lg mb-2">
                              {isSpanish ? 'Decisión final:' : 'Final decision:'}
                            </h4>
                            <p className="text-slate-700 text-sm sm:text-base">
                              {sub.finalDecision === 'accept' && (isSpanish ? 'Aceptado' : 'Accepted')}
                              {sub.finalDecision === 'reject' && (isSpanish ? 'Rechazado' : 'Rejected')}
                              {sub.finalDecision === 'major-revision' && (isSpanish ? 'Requiere revisión mayor' : 'Major revision required')}
                              {sub.finalDecision === 'minor-revision' && (isSpanish ? 'Requiere revisión menor' : 'Minor revision required')}
                            </p>
                            {sub.finalFeedback && (
                              <p className="text-slate-600 mt-2 italic text-sm sm:text-base">"{sub.finalFeedback}"</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Columna Sidebar (1/3 en desktop) */}
                      <div className="space-y-4">
                        <div className="bg-[#002147] text-white p-4 sm:p-6 shadow-xl rounded-lg">
                          <h4 className="font-['Playfair_Display'] text-lg sm:text-xl mb-4">
                            {isSpanish ? 'Detalles' : 'Details'}
                          </h4>
                          
                          <div className="space-y-3 text-sm">
                            <div>
                              <p className="text-blue-200 text-xs uppercase tracking-wider">
                                {isSpanish ? 'Fecha de envío' : 'Submission date'}
                              </p>
                              <p className="text-white font-medium">
                                {sub.createdAt?.toLocaleDateString()}
                              </p>
                            </div>
                            
                            <div>
                              <p className="text-blue-200 text-xs uppercase tracking-wider">
                                {isSpanish ? 'Ronda actual' : 'Current round'}
                              </p>
                              <p className="text-white font-medium">
                                {sub.currentRound || 1}
                              </p>
                            </div>

                            {sub.submissionId && (
                              <div>
                                <p className="text-blue-200 text-xs uppercase tracking-wider">ID</p>
                                <p className="text-white font-mono text-xs break-all">
                                  {sub.submissionId}
                                </p>
                              </div>
                            )}
                          </div>
                          
                          {/* Botón de acción según estado */}
                          {(sub.status === 'revisions-requested' || 
                            sub.status === 'minor-revision-required' || 
                            sub.status === 'major-revision-required' || 
                            sub.status === 'awaiting-revision') && (
                            <button
                              onClick={() => {
                                console.log('📤 Abriendo modal de revisión para:', sub.id);
                                setSelectedSubmission(sub);
                              }}
                              className="w-full mt-6 py-3 bg-[#C0A86A] text-white font-bold text-xs sm:text-sm tracking-widest hover:bg-white hover:text-[#002147] transition-all rounded-lg"
                            >
                              {isSpanish ? 'SUBIR VERSIÓN REVISADA' : 'UPLOAD REVISED VERSION'}
                            </button>
                          )}
                        </div>

                        {/* Documentos */}
                        <div className="bg-white p-4 sm:p-6 border border-slate-200 rounded-lg">
                          <h4 className="font-bold text-xs tracking-widest text-slate-400 uppercase mb-4 font-['Inter']">
                            {isSpanish ? 'Documentos' : 'Documents'}
                          </h4>
                          
                          {/* Links a documentos */}
                          <div className="space-y-2">
                            {sub.originalFileUrl && (
                              <a
                                href={sub.originalFileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-200 rounded-lg"
                              >
                                <span className="text-xl sm:text-2xl">📄</span>
                                <div className="overflow-hidden">
                                  <p className="text-xs font-bold text-slate-700 truncate">
                                    {sub.fileName || (isSpanish ? 'manuscrito_original.pdf' : 'original_manuscript.pdf')}
                                  </p>
                                  <p className="text-[10px] text-slate-400">
                                    {isSpanish ? 'Ver documento' : 'View document'}
                                  </p>
                                </div>
                              </a>
                            )}
                            
                            {sub.driveFolderUrl && (
                              <a
                                href={sub.driveFolderUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-200 rounded-lg"
                              >
                                <span className="text-xl sm:text-2xl">📁</span>
                                <div className="overflow-hidden">
                                  <p className="text-xs font-bold text-slate-700 truncate">
                                    Google Drive
                                  </p>
                                  <p className="text-[10px] text-slate-400">
                                    {isSpanish ? 'Ver carpeta' : 'View folder'}
                                  </p>
                                </div>
                              </a>
                            )}
                            
                            {sub.immutableHistoryId && (
                              <a
                                href={`/history/${sub.immutableHistoryId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-200 rounded-lg"
                              >
                                <span className="text-xl sm:text-2xl">📜</span>
                                <div className="overflow-hidden">
                                  <p className="text-xs font-bold text-slate-700 truncate">
                                    {isSpanish ? 'Historial inmutable' : 'Immutable history'}
                                  </p>
                                  <p className="text-[10px] text-slate-400">
                                    {isSpanish ? 'Ver historial' : 'View history'}
                                  </p>
                                </div>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal para subir revisión - Responsive */}
      <AnimatePresence>
        {selectedSubmission && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
            onClick={() => setSelectedSubmission(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 md:p-8"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="font-['Playfair_Display'] text-xl sm:text-2xl font-bold text-[#0A1929] mb-2">
                {isSpanish ? 'Subir Versión Revisada' : 'Upload Revised Version'}
              </h3>
              <p className="text-[#5A6B7A] mb-2 text-sm sm:text-base break-words">
                {selectedSubmission.title}
              </p>
              <p className="text-xs sm:text-sm text-[#C0A86A] mb-4 sm:mb-6">
                {isSpanish ? `Ronda ${selectedSubmission.currentRound || 1} → Ronda ${(selectedSubmission.currentRound || 1) + 1}` : `Round ${selectedSubmission.currentRound || 1} → Round ${(selectedSubmission.currentRound || 1) + 1}`}
              </p>

              <div className="space-y-4 sm:space-y-6">
                <div>
                  <label className="block font-['Playfair_Display'] font-semibold text-[#0A1929] mb-2 text-sm sm:text-base">
                    {isSpanish ? 'Archivo (PDF o Word)' : 'File (PDF or Word)'}
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleFileChange}
                    className="w-full p-3 sm:p-4 bg-[#F5F7FA] border border-[#E5E9F0] rounded-xl text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-[#C0A86A] file:text-white hover:file:bg-[#A58D4F]"
                  />
                  {revisionFile && (
                    <p className="mt-2 text-xs sm:text-sm text-green-600 break-words">
                      ✓ {revisionFile.name} ({(revisionFile.size / 1024).toFixed(2)} KB)
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-['Playfair_Display'] font-semibold text-[#0A1929] mb-2 text-sm sm:text-base">
                    {isSpanish ? 'Notas para el editor' : 'Notes for the editor'}
                  </label>
                  <textarea
                    value={revisionNotes}
                    onChange={(e) => setRevisionNotes(e.target.value)}
                    rows="4"
                    className="w-full p-3 sm:p-4 bg-[#F5F7FA] border border-[#E5E9F0] rounded-xl focus:ring-2 focus:ring-[#C0A86A] focus:border-transparent text-sm"
                    placeholder={isSpanish 
                      ? 'Explica los cambios realizados en esta versión...' 
                      : 'Explain the changes made in this version...'}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <button
                    onClick={handleSubmitRevision}
                    disabled={uploading || !revisionFile || !revisionNotes.trim()}
                    className="flex-1 py-3 sm:py-4 bg-[#C0A86A] hover:bg-[#A58D4F] disabled:bg-[#E5E9F0] disabled:text-[#5A6B7A] text-white font-['Playfair_Display'] font-bold rounded-xl transition-all text-sm sm:text-base"
                  >
                    {uploading ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {isSpanish ? 'SUBIENDO...' : 'UPLOADING...'}
                      </span>
                    ) : (
                      isSpanish ? 'ENVIAR REVISIÓN' : 'SUBMIT REVISION'
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedSubmission(null);
                      setRevisionFile(null);
                      setRevisionNotes('');
                    }}
                    className="flex-1 py-3 sm:py-4 border-2 border-[#0A1929] text-[#0A1929] font-['Playfair_Display'] font-bold rounded-xl hover:bg-[#0A1929] hover:text-white transition-colors text-sm sm:text-base"
                  >
                    {isSpanish ? 'CANCELAR' : 'CANCEL'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AuthorSubmissionsPanel;