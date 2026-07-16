// src/components/AuthorSubmissionsPanel.js
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth, submitRevision } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  serverTimestamp, 
  addDoc,
  getDoc  // ⭐ AGREGAR: Para obtener documentos individuales
} from 'firebase/firestore';
import { useLanguage } from '../hooks/useLanguage';
import { AuthorMetadataResponseTab } from './AuthorMetadataResponseTab';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
/**
 * Convierte una URL de Google Docs en URL de descarga PDF
 * @param {string} docsUrl - URL del Google Docs
 * @returns {string} URL de exportación PDF
 */
const getDocsExportUrl = (docsUrl) => {
  if (!docsUrl) return null;
  
  // Extraer el ID del documento de la URL
  const match = docsUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://docs.google.com/document/d/${match[1]}/export?format=pdf`;
  }
  
  // Si es una URL de Drive, intentar extraer ID
  const driveMatch = docsUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    return `https://docs.google.com/document/d/${driveMatch[1]}/export?format=pdf`;
  }
  
  return null;
};
/**
 * Convierte una URL de Google Docs en URL de descarga DOCX
 * @param {string} docsUrl - URL del Google Docs
 * @returns {string} URL de exportación DOCX
 */
const getDocsExportDocxUrl = (docsUrl) => {
  if (!docsUrl) return null;
  
  // Extraer el ID del documento de la URL
  const match = docsUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://docs.google.com/document/d/${match[1]}/export?format=docx`;
  }
  
  // Si es una URL de Drive, intentar extraer ID
  const driveMatch = docsUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    return `https://docs.google.com/document/d/${driveMatch[1]}/export?format=docx`;
  }
  
  return null;
};
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
  const [revisionComment, setRevisionComment] = useState('');
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
    alert(isSpanish ? 'Debes seleccionar un archivo y agregar un resumen de cambios' : 'You must select a file and add a summary of changes');
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
            revisionComment: revisionComment, 
            round: selectedSubmission.currentRound || 1
          });

          console.log('✅ Resultado de submitRevision:', result);

          if (result.success) {
            alert(isSpanish ? 'Revisión enviada con éxito' : 'Revision submitted successfully');
            setSelectedSubmission(null);
            setRevisionFile(null);
            setRevisionNotes('');
            setRevisionComment(''); 
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

                        {/* Documentos y Descargas */}
<div className="bg-white p-4 sm:p-6 border border-slate-200 rounded-lg">
  <h4 className="font-bold text-xs tracking-widest text-slate-400 uppercase mb-4 font-['Inter']">
    {isSpanish ? 'Documentos y Descargas' : 'Documents & Downloads'}
  </h4>
  
  <div className="space-y-3">
    
    {/* BOTÓN: DESCARGAR PDF DEL MANUSCRITO */}
    <button
      onClick={async () => {
        try {
          // Determinar qué archivo descargar (PDF formateado > Docs formateado > Original)
          let downloadUrl = null;
          let fileName = 'manuscrito.pdf';
          
          if (sub.formattedPdfFile?.url) {
            downloadUrl = sub.formattedPdfFile.url;
            fileName = `manuscrito_${sub.submissionId || sub.id?.substring(0, 8)}.pdf`;
          } else if (sub.formattedDocsFile?.url) {
            // Exportar Google Docs a PDF
            console.log('📥 Exportando Google Docs a PDF...');
            const fileId = sub.formattedDocsFile.id || sub.formattedDocsFile.url.split('/d/')[1]?.split('/')[0];
            if (fileId) {
              downloadUrl = `https://docs.google.com/document/d/${fileId}/export?format=pdf`;
              fileName = `manuscrito_${sub.submissionId || sub.id?.substring(0, 8)}.pdf`;
            }
          } else if (sub.originalFileUrl) {
            downloadUrl = sub.originalFileUrl;
            fileName = sub.originalFileName || 'manuscrito_original.pdf';
          }
          
          if (downloadUrl) {
            // Crear un link temporal para descarga
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = fileName;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log('✅ Descarga iniciada:', fileName);
          } else {
            alert(isSpanish 
              ? 'No hay documento disponible para descargar' 
              : 'No document available for download');
          }
        } catch (error) {
          console.error('❌ Error descargando:', error);
          alert(isSpanish 
            ? 'Error al descargar el documento' 
            : 'Error downloading document');
        }
      }}
      className="w-full flex items-center gap-3 p-3 bg-[#FBF9F3] hover:bg-[#F5F0E0] transition-colors border-2 border-[#C0A86A] rounded-lg group"
    >
      <span className="text-2xl">📥</span>
      <div className="text-left flex-1 overflow-hidden">
        <p className="text-sm font-bold text-[#0A1929] group-hover:text-[#002147] transition-colors truncate">
          {isSpanish ? 'Descargar manuscrito (PDF)' : 'Download manuscript (PDF)'}
        </p>
        <p className="text-[10px] text-slate-400">
          {sub.formattedPdfFile?.url 
            ? (isSpanish ? 'Versión formateada' : 'Formatted version')
            : sub.formattedDocsFile?.url
            ? (isSpanish ? 'Exportado de Google Docs' : 'Exported from Google Docs')
            : (isSpanish ? 'Documento original' : 'Original document')
          }
        </p>
      </div>
      <svg className="w-5 h-5 text-[#C0A86A] group-hover:text-[#A58D4F] transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    </button>
{/* BOTÓN: DESCARGAR DOCUMENTO FINAL CON REVISIONES (DOCX) */}
{sub.finalReviewDocUrl && (
  <button
    onClick={async () => {
      try {
        console.log('📥 Descargando documento final con revisiones en DOCX...');
        
        const downloadUrl = getDocsExportDocxUrl(sub.finalReviewDocUrl);
        
        if (downloadUrl) {
          const fileName = `revisiones_${sub.submissionId || sub.id?.substring(0, 8)}.docx`;
          
          // Mostrar indicador de descarga
          const downloadingToast = document.createElement('div');
          downloadingToast.className = 'fixed bottom-4 right-4 bg-[#002147] text-white px-4 py-3 rounded-lg shadow-2xl z-50 text-sm font-medium animate-in slide-in-from-right';
          downloadingToast.textContent = isSpanish ? '📥 Descargando documento...' : '📥 Downloading document...';
          document.body.appendChild(downloadingToast);
          
          // Crear un link temporal para descarga
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = fileName;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Eliminar toast después de 3 segundos
          setTimeout(() => {
            downloadingToast.remove();
          }, 3000);
          
          console.log('✅ Descarga de revisiones iniciada:', fileName);
        } else {
          throw new Error('No se pudo generar URL de descarga');
        }
      } catch (error) {
        console.error('❌ Error descargando revisiones:', error);
        
        // Toast de error
        const errorToast = document.createElement('div');
        errorToast.className = 'fixed bottom-4 right-4 bg-red-600 text-white px-4 py-3 rounded-lg shadow-2xl z-50 text-sm font-medium';
        errorToast.textContent = isSpanish 
          ? '❌ Error al descargar. Intenta de nuevo.'
          : '❌ Download error. Please try again.';
        document.body.appendChild(errorToast);
        
        setTimeout(() => {
          errorToast.remove();
        }, 4000);
      }
    }}
    className="w-full flex items-center gap-3 p-3 bg-gradient-to-r from-[#F0F4FF] to-[#E8EEFF] hover:from-[#E0E8FF] hover:to-[#D0DCFF] transition-all border-2 border-[#002147] rounded-lg group shadow-sm hover:shadow-md"
  >
    <span className="text-2xl flex-shrink-0">📝</span>
    <div className="text-left flex-1 overflow-hidden">
      <p className="text-sm font-bold text-[#002147] group-hover:text-[#001A38] transition-colors truncate">
        {isSpanish ? 'Descargar revisiones (DOCX)' : 'Download reviews (DOCX)'}
      </p>
      <p className="text-[10px] text-slate-500">
        {isSpanish 
          ? 'Documento Word con comentarios de revisores' 
          : 'Word document with reviewer comments'}
      </p>
    </div>
    <div className="flex-shrink-0 w-8 h-8 bg-[#002147] rounded-full flex items-center justify-center group-hover:bg-[#001A38] transition-colors">
      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    </div>
  </button>
)}
    {/* BOTÓN: DESCARGAR CONSENTIMIENTO (SOLO SI ES MENOR) */}
    {sub.hasMinorAuthors && sub.consentFiles && sub.consentFiles.length > 0 && (
      <div className="border-t border-slate-200 pt-3">
        <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider mb-2 px-1">
          {isSpanish ? '👶 Consentimientos de menores' : '👶 Minor consent forms'}
        </p>
        {sub.consentFiles.map((consent, idx) => (
          <button
            key={idx}
            onClick={() => {
              if (consent.fileUrl) {
                window.open(consent.fileUrl, '_blank', 'noopener noreferrer');
              } else if (consent.fileId) {
                window.open(`https://drive.google.com/file/d/${consent.fileId}/view`, '_blank', 'noopener noreferrer');
              } else if (consent.method === 'email') {
                alert(isSpanish 
                  ? `Consentimiento para ${consent.author} fue enviado por correo electrónico.` 
                  : `Consent for ${consent.author} was sent by email.`);
              } else {
                alert(isSpanish 
                  ? 'Documento de consentimiento no disponible' 
                  : 'Consent document not available');
              }
            }}
            className="w-full flex items-center gap-2 p-2.5 bg-orange-50 hover:bg-orange-100 transition-colors border border-orange-200 rounded-lg mb-2 text-left"
          >
            <span className="text-lg flex-shrink-0">📋</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[#0A1929] truncate">
                {consent.author || `${isSpanish ? 'Menor' : 'Minor'} ${idx + 1}`}
              </p>
              <p className="text-[10px] text-slate-500">
                {consent.method === 'upload' 
                  ? (isSpanish ? 'Formulario subido' : 'Uploaded form')
                  : consent.method === 'email'
                  ? (isSpanish ? 'Enviado por correo' : 'Sent by email')
                  : consent.method || (isSpanish ? 'Desconocido' : 'Unknown')
                }
              </p>
            </div>
            {consent.fileUrl || consent.fileId ? (
              <svg className="w-4 h-4 text-orange-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            ) : (
              <span className="text-[10px] text-slate-400 flex-shrink-0">
                {isSpanish ? 'No disponible' : 'N/A'}
              </span>
            )}
          </button>
        ))}
      </div>
    )}

    {/* BOTÓN: DESCARGAR AUTORIZACIÓN (SI ES MENOR Y EL USUARIO ES EL TUTOR) */}
    {sub.hasMinorAuthors && sub.minorAuthors && sub.minorAuthors.length > 0 && (
      <div className="border-t border-slate-200 pt-3">
        <p className="text-[10px] font-bold text-[#0A1929] uppercase tracking-wider mb-2 px-1">
          {isSpanish ? '📝 Formularios de autorización' : '📝 Authorization forms'}
        </p>
        <p className="text-[10px] text-slate-500 mb-2 px-1">
          {isSpanish 
            ? 'Descarga el formulario de consentimiento para completar y enviar a contact@revistacienciasestudiantes.com'
            : 'Download the consent form to complete and send to contact@revistacienciasestudiantes.com'
          }
        </p>
        <button
          onClick={() => {
            // Descargar plantilla de consentimiento
            const templateUrl = 'https://www.revistacienciasestudiantes.com/assets/consentimiento-menor.pdf';
            window.open(templateUrl, '_blank', 'noopener noreferrer');
          }}
          className="w-full flex items-center gap-2 p-2.5 bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-200 rounded-lg"
        >
          <span className="text-lg flex-shrink-0">📄</span>
          <div className="text-left flex-1 min-w-0">
            <p className="text-xs font-medium text-[#0A1929]">
              {isSpanish ? 'Plantilla de consentimiento' : 'Consent form template'}
            </p>
            <p className="text-[10px] text-slate-500">PDF</p>
          </div>
          <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>
      </div>
    )}
{/* ============ COMENTARIOS AL EDITOR ============ */}
{sub.editorComment && (
  <div className="bg-white p-4 sm:p-6 border border-slate-200 rounded-lg overflow-hidden">
    <div className="flex items-center gap-2 mb-4">
      <div className="w-8 h-8 bg-[#002147] rounded-lg flex items-center justify-center">
        <svg className="w-4 h-4 text-[#C0A86A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </div>
      <h4 className="font-['Playfair_Display'] font-bold text-sm text-[#002147] uppercase tracking-wider">
        {isSpanish ? 'Tu Mensaje al Editor' : 'Your Message to the Editor'}
      </h4>
    </div>
    
    {/* Contenido del comentario con estilos preservados */}
    <div className="bg-gradient-to-br from-[#F8F9FB] to-[#F0F4F8] border border-[#E5E9F0] rounded-xl p-4 relative">
      {/* Línea decorativa lateral */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#C0A86A] to-[#002147] rounded-l-xl" />
      
      <div className="pl-4">
        <div 
          className="prose prose-sm max-w-none font-['Lora'] text-[#1A2B3C] leading-relaxed
            [&_strong]:text-[#002147] [&_strong]:font-bold
            [&_em]:text-[#C0A86A] [&_em]:italic
            [&_u]:underline [&_u]:decoration-[#C0A86A] [&_u]:decoration-2
            [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1
            [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1
            [&_li]:text-[#1A2B3C] [&_li]:marker:text-[#C0A86A]"
          dangerouslySetInnerHTML={{ __html: sub.editorComment }}
        />
      </div>
    </div>
    
    {/* Footer decorativo */}
    <div className="mt-3 flex items-center gap-2 text-[10px] text-[#5A6B7A] font-mono uppercase tracking-wider">
      <span className="w-2 h-2 bg-[#C0A86A] rounded-full" />
      {isSpanish ? 'Enviado con el manuscrito' : 'Submitted with manuscript'}
    </div>
  </div>
)}
<div className="sm:hidden bg-gradient-to-r from-[#FBF9F3] to-[#F8F9FB] border border-[#C0A86A]/30 rounded-xl p-3">
  <div className="flex items-center gap-2 mb-2">
    <span className="text-lg">💬</span>
    <span className="text-[10px] font-mono font-bold text-[#002147] uppercase tracking-wider">
      {isSpanish ? 'Mensaje al Editor' : 'Message to Editor'}
    </span>
  </div>
  <div 
    className="text-xs font-['Lora'] text-[#1A2B3C] leading-relaxed line-clamp-4"
    dangerouslySetInnerHTML={{ __html: sub.editorComment }}
  />
  <button 
    onClick={() => {/* expandir */}} 
    className="mt-2 text-[10px] text-[#C0A86A] font-mono hover:text-[#002147] transition-colors"
  >
    {isSpanish ? 'Leer más →' : 'Read more →'}
  </button>
</div>
    {/* INDICADOR DE ESTADO DEL DOCUMENTO */}
    {sub.documentStatus && (
      <div className="border-t border-slate-200 pt-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">
          {isSpanish ? 'Estado del documento' : 'Document status'}
        </p>
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-mono ${
          sub.documentStatus === 'processed' 
            ? 'bg-green-100 text-green-700' 
            : sub.documentStatus === 'processing'
            ? 'bg-yellow-100 text-yellow-700'
            : 'bg-red-100 text-red-700'
        }`}>
          {sub.documentStatus === 'processed' && '✓'}
          {sub.documentStatus === 'processing' && '⏳'}
          {sub.documentStatus === 'processing_failed' && '⚠️'}
          {' '}
          {sub.documentStatus === 'processed' 
            ? (isSpanish ? 'Procesado' : 'Processed')
            : sub.documentStatus === 'processing'
            ? (isSpanish ? 'Procesando...' : 'Processing...')
            : (isSpanish ? 'Error' : 'Error')
          }
        </span>
      </div>
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
      {/* Modal para subir revisión - VERSIÓN MEJORADA */}
<AnimatePresence>
  {selectedSubmission && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={() => {
        if (!uploading) {
          setSelectedSubmission(null);
          setRevisionFile(null);
          setRevisionNotes('');
          setRevisionComment('');
        }
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header del modal */}
        <div className="bg-gradient-to-r from-[#0A1929] to-[#1E2F40] p-6 sm:p-8 text-white sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-['Playfair_Display'] text-xl sm:text-2xl font-bold mb-1">
                {isSpanish ? 'Subir Versión Revisada' : 'Upload Revised Version'}
              </h3>
              <p className="text-[#E5E9F0] text-sm font-['Lora']">
                {selectedSubmission.title}
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedSubmission(null);
                setRevisionFile(null);
                setRevisionNotes('');
                setRevisionComment('');
              }}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              disabled={uploading}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 bg-[#C0A86A] text-[#0A1929] text-xs font-bold rounded-full font-mono">
              {isSpanish ? `Ronda ${selectedSubmission.currentRound || 1} → ${(selectedSubmission.currentRound || 1) + 1}` : `Round ${selectedSubmission.currentRound || 1} → ${(selectedSubmission.currentRound || 1) + 1}`}
            </span>
            <span className="px-3 py-1 bg-white/15 text-white text-xs rounded-full font-mono">
              {selectedSubmission.submissionId}
            </span>
          </div>
        </div>

        {/* Cuerpo del modal */}
        <div className="p-6 sm:p-8 space-y-8">
          
          {/* ============ 1. ARCHIVO ============ */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#F0F4F8] rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-[#0A1929]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h4 className="font-['Playfair_Display'] font-bold text-[#0A1929] text-sm uppercase tracking-wide">
                  {isSpanish ? '1. Archivo Revisado' : '1. Revised File'}
                </h4>
                <p className="text-[10px] text-[#5A6B7A] font-mono">
                  {isSpanish ? 'PDF o Word (.doc, .docx) — Máx. 10MB' : 'PDF or Word (.doc, .docx) — Max. 10MB'}
                </p>
              </div>
            </div>
            
            <div className="bg-[#F5F7FA] border-2 border-dashed border-[#E5E9F0] hover:border-[#C0A86A] rounded-2xl p-6 transition-colors">
              <input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileChange}
                className="w-full text-sm text-[#546E7A] file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-[#C0A86A] file:text-white hover:file:bg-[#A58D4F] file:cursor-pointer file:transition-colors"
                disabled={uploading}
              />
              
              {revisionFile && (
                <div className="mt-4 flex items-center gap-3 bg-white rounded-xl p-3 border border-[#E5E9F0]">
                  <span className="text-2xl">📄</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#0A1929] truncate font-['Lora']">
                      {revisionFile.name}
                    </p>
                    <p className="text-xs text-[#5A6B7A]">
                      {(revisionFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                  <button
                    onClick={() => setRevisionFile(null)}
                    className="text-[#B22234] hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                    disabled={uploading}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* ============ 2. NOTAS BREVES PARA EL EDITOR ============ */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#F0F4F8] rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-[#0A1929]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <h4 className="font-['Playfair_Display'] font-bold text-[#0A1929] text-sm uppercase tracking-wide">
                  {isSpanish ? '2. Resumen de Cambios' : '2. Summary of Changes'}
                </h4>
                <p className="text-[10px] text-[#5A6B7A] font-mono">
                  {isSpanish ? 'Breve descripción de los cambios realizados' : 'Brief description of changes made'}
                </p>
              </div>
            </div>
            
            <textarea
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              rows="4"
              className="w-full p-4 bg-[#F5F7FA] border border-[#E5E9F0] rounded-2xl focus:ring-2 focus:ring-[#C0A86A] focus:border-transparent font-['Lora'] text-sm resize-none"
              placeholder={isSpanish 
                ? 'Ej: Se corrigieron los errores metodológicos señalados por el Revisor 1. Se actualizó la sección de resultados con nuevos datos. Se mejoró la discusión según las sugerencias del Revisor 2...' 
                : 'Ex: Corrected methodological errors pointed out by Reviewer 1. Updated results section with new data. Improved discussion based on Reviewer 2 suggestions...'}
              disabled={uploading}
            />
          </section>

          {/* ============ 3. COMENTARIO DETALLADO AL EDITOR (QUILL) ============ */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#F0F4F8] rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-[#0A1929]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <div>
                <h4 className="font-['Playfair_Display'] font-bold text-[#0A1929] text-sm uppercase tracking-wide">
                  {isSpanish ? '3. Comentario Detallado al Editor' : '3. Detailed Comment to Editor'}
                </h4>
                <p className="text-[10px] text-[#5A6B7A] font-mono">
                  {isSpanish ? 'Explica cómo incorporaste las revisiones, justifica cambios de autoría, etc.' : 'Explain how you incorporated revisions, justify authorship changes, etc.'}
                </p>
              </div>
            </div>
            
            <div className="border border-[#E5E9F0] rounded-2xl overflow-hidden bg-white focus-within:border-[#C0A86A] focus-within:ring-2 focus-within:ring-[#C0A86A]/20 transition-all">
              <ReactQuill
                theme="snow"
                value={revisionComment}
                onChange={setRevisionComment}
                placeholder={isSpanish 
                  ? 'Escribe aquí un comentario detallado para el editor...\n\nPuedes:\n• Explicar cómo respondiste a cada revisión\n• Justificar cambios en la lista de autores\n• Señalar mejoras adicionales\n• Incluir enlaces a repositorios o datos complementarios\n• Usar negritas, cursivas, listas y URLs' 
                  : 'Write a detailed comment for the editor here...\n\nYou can:\n• Explain how you responded to each review\n• Justify changes in the author list\n• Point out additional improvements\n• Include links to repositories or supplementary data\n• Use bold, italics, lists and URLs'}
                modules={{
                  toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['blockquote', 'code-block'],
                    ['link', 'image'],
                    ['clean']
                  ]
                }}
                formats={[
                  'header',
                  'bold', 'italic', 'underline', 'strike',
                  'list', 'bullet',
                  'blockquote', 'code-block',
                  'link', 'image'
                ]}
                className="font-['Lora'] text-sm"
                style={{ height: '300px' }}
                readOnly={uploading}
              />
            </div>
            
            {/* Mini-guía de formato */}
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#5A6B7A] bg-[#F5F7FA] px-2 py-1 rounded-full">
                <span className="font-bold">B</span> {isSpanish ? 'Negrita' : 'Bold'}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#5A6B7A] bg-[#F5F7FA] px-2 py-1 rounded-full">
                <span className="italic">I</span> {isSpanish ? 'Cursiva' : 'Italic'}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#5A6B7A] bg-[#F5F7FA] px-2 py-1 rounded-full">
                🔗 URLs
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#5A6B7A] bg-[#F5F7FA] px-2 py-1 rounded-full">
                📋 {isSpanish ? 'Listas' : 'Lists'}
              </span>
            </div>
          </section>

          {/* ============ BOTONES DE ACCIÓN ============ */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 border-t border-[#E5E9F0]">
            <button
              onClick={handleSubmitRevision}
              disabled={uploading || !revisionFile || !revisionNotes.trim()}
              className="flex-1 py-4 bg-gradient-to-r from-[#0A1929] to-[#1E2F40] hover:from-[#1E2F40] hover:to-[#0A1929] disabled:from-[#E5E9F0] disabled:to-[#E5E9F0] disabled:text-[#5A6B7A] text-white font-['Playfair_Display'] font-bold rounded-xl transition-all text-sm sm:text-base shadow-lg hover:shadow-xl disabled:shadow-none flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {isSpanish ? 'SUBIENDO REVISIÓN...' : 'UPLOADING REVISION...'}
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  {isSpanish ? 'ENVIAR VERSIÓN REVISADA' : 'SUBMIT REVISED VERSION'}
                </>
              )}
            </button>
            
            <button
              onClick={() => {
                if (revisionNotes.trim() || revisionComment.trim() || revisionFile) {
                  const confirmDiscard = window.confirm(
                    isSpanish 
                      ? '¿Estás seguro? Perderás todos los cambios no guardados.' 
                      : 'Are you sure? You will lose all unsaved changes.'
                  );
                  if (!confirmDiscard) return;
                }
                setSelectedSubmission(null);
                setRevisionFile(null);
                setRevisionNotes('');
                setRevisionComment('');
              }}
              disabled={uploading}
              className="flex-1 py-4 border-2 border-[#0A1929] text-[#0A1929] font-['Playfair_Display'] font-bold rounded-xl hover:bg-[#0A1929] hover:text-white transition-all text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSpanish ? 'CANCELAR' : 'CANCEL'}
            </button>
          </div>
          
          {/* Indicador de campos requeridos */}
          <p className="text-center text-[10px] font-mono text-[#5A6B7A]">
            * {isSpanish ? 'Archivo y resumen de cambios son obligatorios' : 'File and change summary are required'}
          </p>
        </div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
    </div>
  );
};

export default AuthorSubmissionsPanel;