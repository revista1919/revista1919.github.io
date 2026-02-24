// src/components/AuthorSubmissionsPanel.js
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth, submitRevision } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { useLanguage } from '../hooks/useLanguage';
import { AuthorMetadataResponseTab } from './AuthorMetadataResponseTab';

// Paleta de colores Premium Oxford
const COLORS = {
  oxfordBlue: '#0A192F',
  midnight: '#020617',
  gold: '#C5A059',
  goldHover: '#B08D48',
  silver: '#E2E8F0',
  textSlate: '#94A3B8'
};

const SUBMISSION_STATES = {
  'submitted': { 
    es: 'Recibido', en: 'Submitted',
    color: 'bg-slate-800 text-slate-200 border-slate-700',
    icon: '◈',
    description: { es: 'Tu obra ha entrado en nuestros registros y espera revisión.', en: 'Your work has been registered and awaits review.' }
  },
  'in-desk-review': { 
    es: 'Revisión Editorial', en: 'Desk Review',
    color: 'bg-blue-900/30 text-blue-300 border-blue-800',
    icon: '✒',
    description: { es: 'Un editor de mesa está evaluando la calidad inicial.', en: 'A desk editor is evaluating initial quality.' }
  },
  'desk-review-rejected': { 
    es: 'No pasa Revisión Editorial', en: 'Desk Review Rejected',
    color: 'bg-red-900/30 text-red-400 border-red-800',
    icon: '✕',
    description: { es: 'En esta ocasión no podemos proceder con la revisión.', en: 'On this occasion we cannot proceed with review.' }
  },
  'in-reviewer-selection': { 
    es: 'Seleccionando Pares', en: 'Selecting Reviewers',
    color: 'bg-amber-900/20 text-amber-400 border-amber-800/50',
    icon: '⚖',
    description: { es: 'El equipo editorial está seleccionando revisores.', en: 'The editorial team is selecting reviewers.' }
  },
  'awaiting-reviewer-responses': { 
    es: 'Esperando Respuesta', en: 'Awaiting Responses',
    color: 'bg-orange-900/30 text-orange-400 border-orange-800',
    icon: '⌛',
    description: { es: 'Esperando confirmación de los revisores.', en: 'Waiting for reviewer confirmation.' }
  },
  'in-peer-review': { 
    es: 'Revisión por Pares', en: 'Peer Review',
    color: 'bg-amber-900/20 text-amber-400 border-amber-800/50',
    icon: '⚖',
    description: { es: 'Expertos en el área están analizando tu manuscrito.', en: 'Experts in the field are analyzing your manuscript.' }
  },
  'awaiting-editor-decision': {
    es: 'Esperando Decisión', en: 'Awaiting Decision',
    color: 'bg-purple-900/30 text-purple-400 border-purple-800',
    icon: '⚜',
    description: { es: 'Las revisiones están completadas. El editor tomará una decisión final pronto.', en: 'Reviews are complete. The editor will make a final decision soon.' }
  },
  'revisions-requested': { 
    es: 'Revisiones Solicitadas', en: 'Revisions Requested',
    color: 'bg-orange-900/30 text-orange-400 border-orange-800',
    icon: '📝',
    description: { es: 'Tu obra requiere ajustes para alcanzar la excelencia.', en: 'Your work requires adjustments to achieve excellence.' }
  },
  'minor-revision-required': { 
    es: 'Revisiones Menores', en: 'Minor Revisions',
    color: 'bg-yellow-900/30 text-yellow-400 border-yellow-800',
    icon: '✎',
    description: { es: 'Se requieren cambios menores antes de la aceptación.', en: 'Minor changes are required before acceptance.' }
  },
  'major-revision-required': { 
    es: 'Revisiones Mayores', en: 'Major Revisions',
    color: 'bg-orange-900/30 text-orange-400 border-orange-800',
    icon: '🔄',
    description: { es: 'Se requieren cambios sustanciales y una nueva revisión.', en: 'Substantial changes and re-review are required.' }
  },
  'awaiting-revision': { 
    es: 'Esperando tu Revisión', en: 'Awaiting Revision',
    color: 'bg-blue-900/30 text-blue-300 border-blue-800',
    icon: '⏳',
    description: { es: 'Por favor, sube la versión revisada.', en: 'Please upload the revised version.' }
  },
  'accepted': { 
    es: 'Aceptado', en: 'Accepted',
    color: 'bg-emerald-900/30 text-emerald-400 border-emerald-800',
    icon: '★',
    description: { es: 'Felicidades. Tu contribución ha sido aceptada.', en: 'Congratulations. Your contribution has been accepted.' }
  },
  'rejected': { 
    es: 'No aceptado', en: 'Rejected',
    color: 'bg-red-900/30 text-red-400 border-red-800',
    icon: '✕',
    description: { es: 'En esta ocasión no podemos proceder con la publicación.', en: 'On this occasion we cannot proceed with publication.' }
  },
  'metadata_refinement_pending': {
    es: 'Revisando Metadatos', en: 'Reviewing Metadata',
    color: 'bg-teal-900/30 text-teal-400 border-teal-800',
    icon: '📋',
    description: { es: 'El editor ha propuesto cambios en los metadatos. Por favor, revísalos.', en: 'The editor has proposed metadata changes. Please review them.' }
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
      <div className="mb-6 p-4 bg-[#0A192F] text-green-400 rounded-sm font-mono text-xs overflow-auto max-h-60 border border-slate-800">
        <h4 className="font-bold text-white mb-2">🔧 DEBUG INFO</h4>
        <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
      </div>
    );
  };

  if (!user) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-[#0A192F]/30 border border-slate-800 p-12 text-center">
          <p className="text-slate-400 font-serif italic">
            {isSpanish ? 'Inicia sesión para ver tus envíos' : 'Log in to view your submissions'}
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex flex-col items-center justify-center p-20 space-y-4 bg-[#0A192F]/30 border border-slate-800">
          <div className="w-12 h-12 border-4 border-[#C5A059]/20 border-t-[#C5A059] rounded-full animate-spin" />
          <span className="font-serif italic text-slate-400">{isSpanish ? 'Consultando archivos...' : 'Consulting archives...'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-8 md:space-y-10">
      <DebugPanel />
      
      {/* Header Sección - Adaptado para móvil */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b border-slate-800 pb-6 md:pb-8 gap-4 sm:gap-0">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-white tracking-tight italic">
            {isSpanish ? 'Gabinete del Autor' : 'Author\'s Cabinet'}
          </h1>
          <p className="text-slate-500 mt-2 font-light tracking-widest uppercase text-[10px] md:text-xs">
            {isSpanish ? 'Seguimiento de Manuscritos y Correspondencia' : 'Manuscript Tracking & Correspondence'}
          </p>
        </div>
        <button
          onClick={() => window.location.href = '/submit'}
          className="w-full sm:w-auto px-6 md:px-8 py-3 bg-[#C5A059] hover:bg-[#B08D48] text-[#0A192F] font-bold text-xs md:text-sm tracking-widest transition-all duration-300 shadow-lg shadow-black/20 text-center"
        >
          {isSpanish ? 'NUEVO ENVÍO' : 'NEW SUBMISSION'}
        </button>
      </header>

      {submissions.length === 0 ? (
        <div className="text-center py-16 md:py-24 bg-[#0A192F]/30 border border-slate-800 rounded-sm">
          <p className="font-serif italic text-slate-500 text-base md:text-lg">
            {isSpanish ? 'No se encuentran obras registradas en su gabinete.' : 'No registered works found in your cabinet.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:gap-6">
          {submissions.map((sub) => (
            <SubmissionCard 
              key={sub.id}
              sub={sub}
              isExpanded={expandedSubmission === sub.id}
              onToggle={() => {
                console.log('📌 Expandiendo envío:', sub.id, sub.title);
                setExpandedSubmission(expandedSubmission === sub.id ? null : sub.id);
              }}
              language={language}
              user={user}
              onOpenRevision={() => {
                console.log('📤 Abriendo modal de revisión para:', sub.id);
                setSelectedSubmission(sub);
              }}
              hasPendingMetadata={hasPendingMetadataProposals(sub)}
            />
          ))}
        </div>
      )}

      {/* Modal de Revisión (Premium Glassmorphism) - Adaptado para móvil */}
      <AnimatePresence>
        {selectedSubmission && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/90 backdrop-blur-md"
            onClick={() => setSelectedSubmission(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0A192F] border border-slate-800 p-5 md:p-8 max-w-2xl w-full shadow-2xl mx-3 md:mx-0 max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-xl md:text-2xl font-serif text-[#C5A059] mb-2 italic">{isSpanish ? 'Subir Versión Revisada' : 'Upload Revised Version'}</h3>
              <p className="text-slate-400 text-xs md:text-sm mb-4 md:mb-6 uppercase tracking-wider break-words">Ref: {selectedSubmission.title}</p>
              
              <div className="space-y-4 md:space-y-6">
                <div className="border-2 border-dashed border-slate-700 p-6 md:p-10 text-center hover:border-[#C5A059] transition-colors group">
                  <input 
                    type="file" 
                    id="rev-file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleFileChange} 
                    className="hidden" 
                  />
                  <label htmlFor="rev-file" className="cursor-pointer block">
                    <span className="block text-2xl md:text-3xl mb-2 group-hover:scale-110 transition-transform">📄</span>
                    <span className="text-slate-300 font-medium text-sm md:text-base break-all">
                      {revisionFile ? revisionFile.name : (isSpanish ? 'Click para seleccionar archivo (PDF/Word)' : 'Click to select file (PDF/Word)')}
                    </span>
                  </label>
                </div>

                <textarea
                  value={revisionNotes}
                  onChange={(e) => setRevisionNotes(e.target.value)}
                  placeholder={isSpanish ? "Notas para el editor sobre los cambios realizados..." : "Notes for the editor about the changes made..."}
                  className="w-full bg-black/40 border border-slate-800 p-3 md:p-4 text-white placeholder-slate-600 focus:border-[#C5A059] outline-none h-24 md:h-32 transition-all text-sm"
                />

                <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 md:gap-4">
                  <button 
                    onClick={() => {
                      setSelectedSubmission(null);
                      setRevisionFile(null);
                      setRevisionNotes('');
                    }}
                    className="w-full sm:w-auto px-4 md:px-6 py-2 md:py-2 text-slate-500 hover:text-white transition-colors text-sm"
                  >
                    {isSpanish ? 'Cancelar' : 'Cancel'}
                  </button>
                  <button 
                    disabled={uploading || !revisionFile || !revisionNotes.trim()}
                    onClick={handleSubmitRevision}
                    className="w-full sm:w-auto px-6 md:px-10 py-2 md:py-2 bg-[#C5A059] text-black font-bold disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                  >
                    {uploading ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        {isSpanish ? 'Enviando...' : 'Sending...'}
                      </span>
                    ) : (isSpanish ? 'Enviar Revisión' : 'Submit Revision')}
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

// Subcomponente: SubmissionCard - COMPLETAMENTE ADAPTADO PARA MÓVIL
const SubmissionCard = ({ sub, isExpanded, onToggle, language, user, onOpenRevision, hasPendingMetadata }) => {
  const isSpanish = language === 'es';
  const state = SUBMISSION_STATES[sub.status] || SUBMISSION_STATES.submitted;

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

  return (
    <motion.div 
      layout
      className={`group border transition-all duration-500 ${
        isExpanded ? 'border-slate-700 bg-[#0A192F]' : 'border-slate-800 bg-black/40 hover:border-slate-600'
      }`}
    >
      {/* Cabecera del envío - Adaptada para móvil */}
      <div 
        className="p-4 md:p-6 cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4"
        onClick={onToggle}
      >
        <div className="space-y-2 w-full sm:w-auto">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] md:text-xs px-2 md:px-3 py-1 border rounded-full font-bold tracking-tighter uppercase ${state.color}`}>
              {state.icon} {state[language]}
            </span>
            <span className="text-slate-600 font-mono text-[8px] md:text-[10px] tracking-widest">
              {sub.id.substring(0,8).toUpperCase()}
            </span>
            {hasPendingMetadata && (
              <span className="bg-teal-900/30 text-teal-400 border border-teal-800 text-[8px] md:text-[10px] px-2 py-1 rounded-full animate-pulse">
                {isSpanish ? `📋 ${sub.pendingProposals.length} pendiente(s)` : `📋 ${sub.pendingProposals.length} pending`}
              </span>
            )}
          </div>
          <h2 className="text-lg md:text-xl font-serif text-slate-100 group-hover:text-[#C5A059] transition-colors duration-300 italic break-words pr-8 sm:pr-0">
            {sub.title}
          </h2>
          <div className="flex items-center gap-3 text-xs text-slate-500 sm:hidden">
            <span className="font-mono bg-black/40 px-2 py-1 rounded">
              {sub.submissionId || sub.id.substring(0,6)}
            </span>
            <span>
              {sub.createdAt?.toLocaleDateString?.() || new Date(sub.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        
        <div className="flex items-center justify-between w-full sm:w-auto gap-4 sm:gap-6">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest italic">{isSpanish ? 'Enviado' : 'Submitted'}</p>
            <p className="text-sm text-slate-300 font-serif">{sub.createdAt?.toLocaleDateString?.() || new Date(sub.createdAt).toLocaleDateString()}</p>
          </div>
          <div className={`w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-full border border-slate-800 transition-transform duration-500 ${
            isExpanded ? 'rotate-180 bg-slate-800' : ''
          }`}>
            <span className="text-slate-400 text-[10px] md:text-xs">▼</span>
          </div>
        </div>
      </div>

      {/* Detalles expandibles */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-slate-800"
          >
            <div className="p-4 md:p-8 space-y-6 md:space-y-8 bg-gradient-to-b from-[#0A192F] to-black">
              
              {/* Descripción del estado actual */}
              <div className="p-4 bg-black/40 border-l-2 border-[#C5A059]">
                <p className="text-slate-300 text-sm leading-relaxed">
                  {state.description[language]}
                </p>
              </div>

              {/* Timeline Épico - Adaptado para móvil (scroll horizontal si es necesario) */}
              {!['accepted', 'rejected', 'desk-review-rejected'].includes(sub.status) && (
                <div className="relative pt-8 pb-4 overflow-x-auto">
                  <div className="absolute top-4 left-0 w-full h-[1px] bg-slate-800" />
                  <div className="relative flex justify-between min-w-[500px] md:min-w-0 px-2">
                    {['submitted', 'in-desk-review', 'in-reviewer-selection', 'in-peer-review', 'accepted'].map((step, idx) => {
                      const currentIdx = getTimelineStep(sub.status);
                      const isDone = idx <= currentIdx;
                      return (
                        <div key={step} className="flex flex-col items-center gap-2 relative z-10">
                          <div className={`w-2 h-2 md:w-3 md:h-3 rounded-full border-2 transition-all duration-700 ${
                            isDone ? 'bg-[#C5A059] border-[#C5A059] shadow-[0_0_10px_#C5A059]' : 'bg-black border-slate-700'
                          }`} />
                          <span className={`text-[8px] md:text-[10px] uppercase tracking-tighter font-bold whitespace-nowrap ${
                            isDone ? 'text-slate-200' : 'text-slate-600'
                          }`}>
                            {SUBMISSION_STATES[step]?.[language]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Contenido Dinámico - Stack en móvil, grid en desktop */}
              <div className="grid md:grid-cols-2 gap-6 md:gap-8">
                <div className="space-y-4">
                  <h4 className="font-serif text-[#C5A059] italic border-b border-slate-800 pb-2 text-sm md:text-base">
                    {isSpanish ? 'Estado de la Obra' : 'Manuscript Status'}
                  </h4>
                  
                  {/* Feedback del editor (si existe) */}
                  {sub.deskReviewFeedback && (
                    <div className="p-4 bg-black/40 border-l-2 border-[#C5A059]">
                      <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">
                        {isSpanish ? 'Nota de la Editorial' : 'Editorial Note'}
                      </p>
                      <p className="text-slate-300 italic text-sm font-serif">"{sub.deskReviewFeedback}"</p>
                    </div>
                  )}

                  {/* Botón de revisión */}
                  {(sub.status === 'revisions-requested' || 
                    sub.status === 'minor-revision-required' || 
                    sub.status === 'major-revision-required' || 
                    sub.status === 'awaiting-revision') && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onOpenRevision(); }}
                      className="w-full py-3 md:py-3 border border-[#C5A059] text-[#C5A059] hover:bg-[#C5A059] hover:text-black transition-all font-bold tracking-widest text-xs uppercase"
                    >
                      {isSpanish ? 'Subir Revisión Ahora' : 'Upload Revision Now'}
                    </button>
                  )}

                  {/* Enlaces a documentos - Responsive */}
                  <div className="flex flex-col sm:flex-row flex-wrap gap-3">
                    {sub.driveFolderUrl && (
                      <a
                        href={sub.driveFolderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-[#C5A059] hover:text-[#B08D48] text-xs transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        {isSpanish ? 'Drive' : 'Drive'}
                      </a>
                    )}
                    {sub.originalFileUrl && (
                      <a
                        href={sub.originalFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-[#C5A059] hover:text-[#B08D48] text-xs transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        {isSpanish ? 'Original' : 'Original'}
                      </a>
                    )}
                    {sub.immutableHistoryId && (
                      <a
                        href={`/history/${sub.immutableHistoryId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 text-xs transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {isSpanish ? 'Historia' : 'History'}
                      </a>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-serif text-[#C5A059] italic border-b border-slate-800 pb-2 text-sm md:text-base">
                    {isSpanish ? 'Metadatos y Calidad' : 'Metadata & Quality'}
                  </h4>
                  <AuthorMetadataResponseTab submission={sub} user={user} />
                </div>
              </div>

              {/* Revisiones de pares */}
              {sub.reviews && sub.reviews.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-serif text-[#C5A059] italic border-b border-slate-800 pb-2 text-sm md:text-base">
                    {isSpanish ? 'Revisiones Recibidas' : 'Reviews Received'}
                  </h4>
                  <div className="space-y-3">
                    {sub.reviews.map((review, idx) => (
                      <div key={review.id || idx} className="bg-black/40 p-4 border border-slate-800">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mb-3">
                          <span className="text-xs text-slate-400">
                            {isSpanish ? `Revisión ${idx + 1}` : `Review ${idx + 1}`}
                            {review.round && review.round > 1 && (
                              <span className="ml-2 text-[10px] bg-purple-900/30 text-purple-400 px-2 py-0.5 rounded-full">
                                {isSpanish ? `Ronda ${review.round}` : `Round ${review.round}`}
                              </span>
                            )}
                          </span>
                          <span className={`text-[10px] px-2 py-1 rounded-full ${
                            review.recommendation === 'accept' ? 'bg-emerald-900/30 text-emerald-400' :
                            review.recommendation === 'minor-revision' ? 'bg-blue-900/30 text-blue-300' :
                            review.recommendation === 'major-revision' ? 'bg-orange-900/30 text-orange-400' :
                            'bg-red-900/30 text-red-400'
                          }`}>
                            {review.recommendation === 'accept' && (isSpanish ? 'Aceptar' : 'Accept')}
                            {review.recommendation === 'minor-revision' && (isSpanish ? 'Menores' : 'Minor')}
                            {review.recommendation === 'major-revision' && (isSpanish ? 'Mayores' : 'Major')}
                            {review.recommendation === 'reject' && (isSpanish ? 'Rechazar' : 'Reject')}
                          </span>
                        </div>
                        
                        {/* Comentarios para el autor */}
                        {review.commentsToAuthor && (
                          <div className="text-sm text-slate-300 mt-2">
                            <p className="font-medium text-[#C5A059] mb-1 text-xs">
                              {isSpanish ? 'Comentarios:' : 'Comments:'}
                            </p>
                            <div className="bg-black/60 p-3 rounded-sm text-xs" 
                                 dangerouslySetInnerHTML={{ __html: review.commentsToAuthor.replace(/\n/g, '<br/>') }} />
                          </div>
                        )}
                        
                        {/* Fecha de envío */}
                        {review.submittedAt && (
                          <p className="text-[10px] text-slate-500 mt-3">
                            {isSpanish ? 'Recibido:' : 'Received:'}{' '}
                            {review.submittedAt.toDate ? 
                              review.submittedAt.toDate().toLocaleDateString() : 
                              new Date(review.submittedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Decisiones finales */}
              {sub.finalDecision && (
                <div className="p-4 bg-blue-900/20 border border-blue-800">
                  <h4 className="font-serif text-blue-400 italic mb-2 text-sm">
                    {isSpanish ? 'Decisión final:' : 'Final decision:'}
                  </h4>
                  <p className="text-slate-300 text-sm">
                    {sub.finalDecision === 'accept' && (isSpanish ? 'Aceptado' : 'Accepted')}
                    {sub.finalDecision === 'reject' && (isSpanish ? 'Rechazado' : 'Rejected')}
                    {sub.finalDecision === 'major-revision' && (isSpanish ? 'Requiere revisión mayor' : 'Major revision required')}
                    {sub.finalDecision === 'minor-revision' && (isSpanish ? 'Requiere revisión menor' : 'Minor revision required')}
                  </p>
                  {sub.finalFeedback && (
                    <p className="text-slate-400 mt-2 italic text-sm">"{sub.finalFeedback}"</p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AuthorSubmissionsPanel;