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
  getDoc
} from 'firebase/firestore';
import { useLanguage } from '../hooks/useLanguage';
import { AuthorMetadataResponseTab } from './AuthorMetadataResponseTab';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

/**
 * Convierte una URL de Google Docs en URL de descarga PDF
 */
const getDocsExportUrl = (docsUrl) => {
  if (!docsUrl) return null;
  const match = docsUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return `https://docs.google.com/document/d/${match[1]}/export?format=pdf`;
  const driveMatch = docsUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) return `https://docs.google.com/document/d/${driveMatch[1]}/export?format=pdf`;
  return null;
};

/**
 * Convierte una URL de Google Docs en URL de descarga DOCX
 */
const getDocsExportDocxUrl = (docsUrl) => {
  if (!docsUrl) return null;
  const match = docsUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return `https://docs.google.com/document/d/${match[1]}/export?format=docx`;
  const driveMatch = docsUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) return `https://docs.google.com/document/d/${driveMatch[1]}/export?format=docx`;
  return null;
};

// ============ ICONOS SVG PROFESIONALES (Base Diseño B) ============
const Icons = {
  Check: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  Clock: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Document: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  Download: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  ),
  Edit: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  Cross: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  Message: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  ),
  Search: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  ChevronDown: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
  User: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  Warning: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  Upload: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  ),
  Plus: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  )
};

const SUBMISSION_STATES = {
  'submitted': { 
    es: 'Enviado', 
    en: 'Submitted',
    color: 'bg-slate-100 text-slate-700 border-slate-300',
    icon: 'Document',
    description: { 
      es: 'Tu artículo ha sido recibido y está en espera de revisión editorial',
      en: 'Your article has been received and is awaiting editorial review'
    }
  },
  'in-desk-review': { 
    es: 'En revisión editorial', 
    en: 'In desk review',
    color: 'bg-sky-50 text-sky-800 border-sky-200',
    icon: 'Search',
    description: { 
      es: 'Un editor está revisando tu artículo',
      en: 'An editor is reviewing your article'
    }
  },
  'desk-review-rejected': { 
    es: 'Rechazado en revisión editorial', 
    en: 'Rejected in desk review',
    color: 'bg-red-50 text-red-800 border-red-200',
    icon: 'Cross',
    description: { 
      es: 'El artículo no pasó la revisión editorial inicial',
      en: 'The article did not pass initial editorial review'
    }
  },
  'in-reviewer-selection': { 
    es: 'Seleccionando revisores', 
    en: 'Selecting reviewers',
    color: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    icon: 'Search',
    description: { 
      es: 'El equipo editorial está seleccionando revisores para tu artículo',
      en: 'The editorial team is selecting reviewers for your article'
    }
  },
  'awaiting-reviewer-responses': { 
    es: 'Esperando respuesta de revisores', 
    en: 'Awaiting reviewer responses',
    color: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: 'Clock',
    description: { 
      es: 'Los revisores están decidiendo si aceptan revisar tu artículo',
      en: 'Reviewers are deciding whether to accept reviewing your article'
    }
  },
  'in-peer-review': { 
    es: 'En revisión por pares', 
    en: 'In peer review',
    color: 'bg-blue-50 text-blue-800 border-blue-200',
    icon: 'Edit',
    description: { 
      es: 'Los revisores están evaluando tu artículo',
      en: 'Reviewers are evaluating your article'
    }
  },
  'awaiting-editor-decision': {
    es: 'Esperando decisión del editor', 
    en: 'Awaiting editor decision',
    color: 'bg-purple-50 text-purple-800 border-purple-200',
    icon: 'Clock',
    description: { 
      es: 'Las revisiones están completadas. El editor tomará una decisión final pronto',
      en: 'Reviews are complete. The editor will make a final decision soon'
    }
  },
  'revisions-requested': { 
    es: 'Revisiones solicitadas', 
    en: 'Revisions requested',
    color: 'bg-amber-100 text-amber-900 border-amber-300',
    icon: 'Edit',
    description: { 
      es: 'El editor ha solicitado cambios en tu artículo. Por favor, sube una versión revisada.',
      en: 'The editor has requested changes to your article. Please upload a revised version.'
    }
  },
  'minor-revision-required': { 
    es: 'Revisiones menores requeridas', 
    en: 'Minor revisions required',
    color: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    icon: 'Edit',
    description: { 
      es: 'Se requieren cambios menores antes de la aceptación',
      en: 'Minor changes are required before acceptance'
    }
  },
  'major-revision-required': { 
    es: 'Revisiones mayores requeridas', 
    en: 'Major revisions required',
    color: 'bg-orange-50 text-orange-800 border-orange-200',
    icon: 'Edit',
    description: { 
      es: 'Se requieren cambios sustanciales y una nueva revisión',
      en: 'Substantial changes and re-review are required'
    }
  },
  'awaiting-revision': { 
    es: 'Esperando tu revisión', 
    en: 'Awaiting your revision',
    color: 'bg-rose-50 text-rose-800 border-rose-200',
    icon: 'Clock',
    description: { 
      es: 'Por favor, sube la versión revisada de tu artículo',
      en: 'Please upload the revised version of your article'
    }
  },
  'accepted': { 
    es: 'Aceptado', 
    en: 'Accepted',
    color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    icon: 'Check',
    description: { 
      es: '¡Tu artículo ha sido aceptado para publicación!',
      en: 'Your article has been accepted for publication!'
    }
  },
  'rejected': { 
    es: 'Rechazado', 
    en: 'Rejected',
    color: 'bg-red-50 text-red-800 border-red-200',
    icon: 'Cross',
    description: { 
      es: 'El artículo no ha sido aceptado para publicación',
      en: 'The article has not been accepted for publication'
    }
  },
  'metadata_refinement_pending': {
    es: 'Revisando metadatos', 
    en: 'Reviewing metadata',
    color: 'bg-teal-50 text-teal-800 border-teal-200',
    icon: 'Document',
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

    const reviewsListeners = new Map();
    const proposalsListeners = new Map();

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`📥 [AuthorSubmissionsPanel] Recibidos ${snapshot.docs.length} envíos de Firestore`);
      
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

      const baseSubmissionsList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
          deskReviewCompletedAt: data.deskReviewCompletedAt?.toDate?.(),
          decisionMadeAt: data.decisionMadeAt?.toDate?.(),
          reviews: [],
          pendingProposals: []
        };
      });

      baseSubmissionsList.sort((a, b) => b.createdAt - a.createdAt);
      
      setSubmissions(baseSubmissionsList);
      setLoading(false);

      baseSubmissionsList.forEach(sub => {
        if (sub.metadataRefinement) {
          console.log(`🔍 [MetadataRefinement] Envío ${sub.id} tiene metadataRefinement:`, sub.metadataRefinement);
        } else {
          console.log(`🔍 [MetadataRefinement] Envío ${sub.id} NO tiene campo metadataRefinement`);
        }
      });

      reviewsListeners.forEach((unsub) => unsub());
      reviewsListeners.clear();
      proposalsListeners.forEach((unsub) => unsub());
      proposalsListeners.clear();

      snapshot.docs.forEach(doc => {
        const submissionId = doc.id;
        
        console.log(`🔧 Configurando listeners para envío: ${submissionId}`);

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

        const proposalsQuery = query(
          collection(db, 'submissions', submissionId, 'metadataProposals'),
          where('status', '==', 'pending-author')
        );

        const unsubscribeProposals = onSnapshot(proposalsQuery, (proposalsSnapshot) => {
          const pendingCount = proposalsSnapshot.docs.length;
          console.log(`📋 [MetadataProposals] ${pendingCount} propuestas pendientes para ${submissionId}`);
          
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
    const IconComponent = Icons[state.icon] || Icons.Document;
    return (
      <span className={`inline-flex items-center gap-1.5 text-[10px] sm:text-xs px-2.5 py-1 font-sans font-bold uppercase tracking-wider border rounded-sm ${state.color}`}>
        <IconComponent /> {state[language]}
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

  const hasPendingMetadataProposals = (submission) => {
    const hasProposals = submission.pendingProposals?.length > 0;
    if (hasProposals) {
      console.log(`✅ [hasPendingMetadataProposals] Envío ${submission.id} tiene ${submission.pendingProposals.length} propuestas`);
    }
    return hasProposals;
  };

  const DebugPanel = () => {
    if (process.env.NODE_ENV !== 'development') return null;
    
    return (
      <div className="mb-6 p-4 bg-gray-900 text-green-400 rounded-sm font-mono text-xs overflow-auto max-h-60 border border-gray-700">
        <h4 className="font-bold text-white mb-2">🔧 DEBUG INFO</h4>
        <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
      </div>
    );
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center bg-white border border-gray-200 rounded-sm shadow-sm mt-10">
        <p className="text-slate-600 font-sans">
          {isSpanish ? 'Inicia sesión para ver tus envíos' : 'Log in to view your submissions'}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <div className="w-8 h-8 border-2 border-t-[#003b5c] border-slate-200 rounded-full animate-spin"></div>
        <p className="font-sans text-sm tracking-widest uppercase text-slate-500">
          {isSpanish ? 'Consultando los archivos de la Revista...' : 'Consulting the Journal archives...'}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 font-sans">
      <DebugPanel />
      
      {/* Header Institucional */}
      <div className="bg-[#003b5c] px-8 py-10 text-left border-b border-gray-200 rounded-sm shadow-sm mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <p className="uppercase text-xs font-bold tracking-widest text-sky-200 mb-2">
            {isSpanish ? 'Gestión Editorial' : 'Editorial Management'}
          </p>
          <h1 className="font-serif text-3xl text-white">
            {isSpanish ? 'Panel de Autor' : 'Author Dashboard'}
          </h1>
        </div>
        <button
          onClick={() => window.location.href = '/submit'}
          className="px-6 py-2.5 bg-white text-[#003b5c] text-sm font-bold uppercase tracking-wider border border-transparent hover:bg-slate-50 transition-colors rounded-sm shadow-sm flex items-center gap-2"
        >
          <Icons.Plus />
          {isSpanish ? 'Nuevo Envío' : 'New Submission'}
        </button>
      </div>

      {submissions.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 border border-gray-200 rounded-sm">
          <Icons.Document className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="font-sans text-sm text-slate-500">
            {isSpanish ? 'No se han encontrado manuscritos en su registro.' : 'No manuscripts found in your record.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {submissions.map((sub) => (
            <motion.div
              key={sub.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white border transition-colors duration-300 rounded-sm ${expandedSubmission === sub.id ? 'border-[#003b5c] shadow-md' : 'border-gray-200 shadow-sm'}`}
            >
              {/* Tarjeta - Cabecera */}
              <div 
                onClick={() => {
                  console.log('📌 Expandiendo envío:', sub.id, sub.title);
                  setExpandedSubmission(expandedSubmission === sub.id ? null : sub.id);
                }}
                className="p-6 cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group"
              >
                {expandedSubmission === sub.id && (
                  <div className="absolute top-0 left-0 w-1 h-full bg-[#003b5c]" />
                )}
                
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded-sm border border-slate-200">
                      ID: {sub.id.substring(0,8)}
                    </span>
                    {getStatusBadge(sub.status)}
                    {hasPendingMetadataProposals(sub) && (
                      <span className="bg-amber-100 border border-amber-300 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider flex items-center gap-1">
                        <Icons.Warning /> {isSpanish ? `Acción (${sub.pendingProposals.length})` : `Action (${sub.pendingProposals.length})`}
                      </span>
                    )}
                  </div>
                  <h3 className="font-serif text-xl font-semibold text-slate-900 group-hover:text-[#003b5c] transition-colors leading-tight break-words">
                    {sub.title}
                  </h3>
                </div>

                <div className="flex items-center gap-6 flex-shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-0.5">
                      {isSpanish ? 'Enviado' : 'Submitted'}
                    </p>
                    <p className="text-sm font-medium text-slate-700">
                      {sub.createdAt?.toLocaleDateString()}
                    </p>
                  </div>
                  <div className="w-8 h-8 flex items-center justify-center text-slate-400 group-hover:text-[#003b5c] transition-colors">
                    <motion.div animate={{ rotate: expandedSubmission === sub.id ? 180 : 0 }}>
                      <Icons.ChevronDown />
                    </motion.div>
                  </div>
                </div>
              </div>

              {/* Contenido Expandido */}
              <AnimatePresence>
                {expandedSubmission === sub.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-gray-200 bg-gray-50"
                  >
                    <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                      
                      {/* Columna Principal (2/3) */}
                      <div className="lg:col-span-2 space-y-6">
                        
                        {/* Estado Actual */}
                        <section className="bg-white p-6 border border-gray-200 rounded-sm">
                          <h4 className="font-sans font-bold text-sm text-slate-800 uppercase tracking-wider mb-2 border-b border-gray-100 pb-2">
                            {isSpanish ? 'Estado Actual' : 'Current Status'}
                          </h4>
                          <p className="text-slate-600 text-sm leading-relaxed mt-3">
                            {SUBMISSION_STATES[sub.status]?.description[language]}
                          </p>
                        </section>

                        {/* Línea de Tiempo */}
                        {!['accepted', 'rejected', 'desk-review-rejected'].includes(sub.status) && (
                          <section className="bg-white p-6 border border-gray-200 rounded-sm">
                            <h4 className="font-sans font-bold text-sm text-slate-800 uppercase tracking-wider mb-6 border-b border-gray-100 pb-2">
                              {isSpanish ? 'Progreso del Manuscrito' : 'Manuscript Progress'}
                            </h4>
                            <div className="relative pt-2">
                              <div className="absolute top-5 left-4 right-4 h-0.5 bg-gray-200 z-0"></div>
                              
                              <div className="relative z-10 flex justify-between overflow-x-auto">
                                {['submitted', 'in-desk-review', 'in-peer-review', 'accepted'].map((step, idx) => {
                                  const currentStep = getTimelineStep(sub.status);
                                  const isCompleted = idx < currentStep;
                                  const isCurrent = idx === currentStep;
                                  
                                  return (
                                    <div key={step} className="flex flex-col items-center flex-shrink-0 px-2">
                                      <div className={`w-6 h-6 rounded-sm border-2 flex items-center justify-center transition-colors bg-white ${
                                        isCurrent ? 'border-[#003b5c] text-[#003b5c] ring-4 ring-[#003b5c]/10' : 
                                        isCompleted ? 'border-sky-600 text-sky-600 bg-sky-50' : 
                                        'border-gray-300 text-gray-300'
                                      }`}>
                                        {isCompleted ? <Icons.Check /> : <span className="text-[10px] font-bold">{idx + 1}</span>}
                                      </div>
                                      <span className={`mt-3 text-[10px] font-bold uppercase tracking-wider text-center ${
                                        isCurrent ? 'text-[#003b5c]' : 'text-slate-400'
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
                        <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
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
                          <div className="bg-white p-6 border-l-4 border-[#003b5c] border-y border-r border-gray-200 rounded-sm">
                            <h4 className="font-sans font-bold text-sm text-slate-800 uppercase tracking-wider mb-3">
                              {isSpanish ? 'Feedback del Editor' : 'Editor Feedback'}
                            </h4>
                            <p className="text-slate-600 text-sm">{sub.deskReviewFeedback}</p>
                          </div>
                        )}

                        {/* Revisiones de pares */}
                        {sub.reviews && sub.reviews.length > 0 && (
                          <div className="bg-white p-6 border border-gray-200 rounded-sm">
                            <h4 className="font-sans font-bold text-sm text-slate-800 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">
                              {isSpanish ? 'Revisiones de Pares' : 'Peer Reviews'}
                            </h4>
                            <div className="space-y-6">
                              {sub.reviews.map((review, idx) => (
                                <div key={review.id || idx} className="border border-gray-200 bg-gray-50 rounded-sm p-5">
                                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                    <div className="flex items-center gap-2">
                                      <span className="font-sans font-bold text-sm text-slate-800">
                                        {isSpanish ? `Revisión ${idx + 1}` : `Review ${idx + 1}`}
                                      </span>
                                      {review.round && review.round > 1 && (
                                        <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-700 px-2 py-0.5 rounded-sm">
                                          {isSpanish ? `Ronda ${review.round}` : `Round ${review.round}`}
                                        </span>
                                      )}
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 border rounded-sm ${
                                      review.recommendation === 'accept' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                      review.recommendation === 'minor-revision' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                      review.recommendation === 'major-revision' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                      'bg-red-50 text-red-700 border-red-200'
                                    }`}>
                                      {review.recommendation === 'accept' && (isSpanish ? 'Aceptar' : 'Accept')}
                                      {review.recommendation === 'minor-revision' && (isSpanish ? 'Revisiones menores' : 'Minor revisions')}
                                      {review.recommendation === 'major-revision' && (isSpanish ? 'Revisiones mayores' : 'Major revisions')}
                                      {review.recommendation === 'reject' && (isSpanish ? 'Rechazar' : 'Reject')}
                                    </span>
                                  </div>
                                  
                                  {/* Puntuaciones de revisores - CONSERVADO COMPLETO */}
                                  {review.scores && Object.keys(review.scores).length > 0 && (
                                    <div className="mb-3 flex flex-wrap gap-2 text-[10px] sm:text-xs">
                                      {Object.entries(review.scores).map(([key, value]) => {
                                        const traducciones = {
                                          originality: isSpanish ? 'Originalidad' : 'Originality',
                                          methodology: isSpanish ? 'Metodología' : 'Methodology',
                                          clarity: isSpanish ? 'Claridad' : 'Clarity',
                                          relevance: isSpanish ? 'Relevancia' : 'Relevance',
                                          overall: isSpanish ? 'General' : 'Overall'
                                        };
                                        return (
                                          <div key={key} className="bg-white border border-gray-200 px-2.5 py-1 rounded-sm shadow-sm">
                                            <span className="font-medium text-slate-600">
                                              {traducciones[key] || key}:
                                            </span>{' '}
                                            <span className="font-bold text-[#003b5c]">{value}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                  
                                  {/* Comentarios para el autor */}
                                  {review.commentsToAuthor && (
                                    <div className="bg-white border border-gray-200 p-4 rounded-sm text-sm font-serif text-slate-700 leading-relaxed" 
                                         dangerouslySetInnerHTML={{ __html: review.commentsToAuthor.replace(/\n/g, '<br/>') }} />
                                  )}
                                  
                                  {/* Comentarios para el editor */}
                                  {review.commentsToEditor && (
                                    <div className="mt-3 pt-3 border-t border-gray-200">
                                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                        {isSpanish ? 'Comentarios al Editor' : 'Comments to Editor'}
                                      </p>
                                      <p className="text-xs text-slate-500 italic">
                                        {review.commentsToEditor}
                                      </p>
                                    </div>
                                  )}
                                  
                                  {/* Comentarios generales */}
                                  {review.generalComments && (
                                    <div className="mt-3 pt-3 border-t border-gray-200">
                                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                                        {isSpanish ? 'Comentarios Generales' : 'General Comments'}
                                      </p>
                                      <p className="text-xs text-slate-500 italic">
                                        {review.generalComments}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Decisiones finales */}
                        {sub.finalDecision && (
                          <div className="bg-sky-50 border border-sky-200 p-6 rounded-sm">
                            <h4 className="font-sans font-bold text-sm text-sky-900 uppercase tracking-wider mb-2">
                              {isSpanish ? 'Decisión final:' : 'Final decision:'}
                            </h4>
                            <p className="text-slate-700 text-sm">
                              {sub.finalDecision === 'accept' && (isSpanish ? 'Aceptado' : 'Accepted')}
                              {sub.finalDecision === 'reject' && (isSpanish ? 'Rechazado' : 'Rejected')}
                              {sub.finalDecision === 'major-revision' && (isSpanish ? 'Requiere revisión mayor' : 'Major revision required')}
                              {sub.finalDecision === 'minor-revision' && (isSpanish ? 'Requiere revisión menor' : 'Minor revision required')}
                            </p>
                            {sub.finalFeedback && (
                              <p className="text-slate-600 mt-2 italic text-sm">"{sub.finalFeedback}"</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Columna Lateral (1/3) */}
                      <div className="space-y-6">
                        
                        {/* Detalles del envío */}
                        <div className="bg-white border border-gray-200 rounded-sm">
                          <div className="bg-[#003b5c] px-4 py-3 border-b border-[#003b5c]">
                            <h4 className="font-sans font-bold text-xs text-white uppercase tracking-wider">
                              {isSpanish ? 'Detalles' : 'Details'}
                            </h4>
                          </div>
                          <div className="p-4 space-y-4 text-sm">
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                                {isSpanish ? 'Fecha de envío' : 'Submission date'}
                              </p>
                              <p className="text-slate-800 font-medium">
                                {sub.createdAt?.toLocaleDateString()}
                              </p>
                            </div>
                            
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                                {isSpanish ? 'Ronda actual' : 'Current round'}
                              </p>
                              <p className="text-slate-800 font-medium">
                                {sub.currentRound || 1}
                              </p>
                            </div>

                            {sub.submissionId && (
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">ID</p>
                                <p className="text-slate-800 font-mono text-xs break-all bg-slate-50 border border-slate-200 px-2 py-1 rounded-sm mt-1">
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
                            <div className="p-4 pt-0">
                              <button
                                onClick={() => {
                                  console.log('📤 Abriendo modal de revisión para:', sub.id);
                                  setSelectedSubmission(sub);
                                }}
                                className="w-full py-2.5 bg-[#003b5c] text-white font-sans font-bold text-sm uppercase tracking-wider hover:bg-sky-900 transition-colors rounded-sm shadow-sm flex items-center justify-center gap-2"
                              >
                                <Icons.Upload /> {isSpanish ? 'Subir Versión Revisada' : 'Upload Revised Version'}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Documentos y Descargas */}
                        <div className="bg-white border border-gray-200 rounded-sm">
                          <div className="bg-slate-50 px-4 py-3 border-b border-gray-200">
                            <h4 className="font-sans font-bold text-xs text-slate-700 uppercase tracking-wider">
                              {isSpanish ? 'Documentos y Descargas' : 'Documents & Downloads'}
                            </h4>
                          </div>
                          
                          <div className="p-3 space-y-2">
                            
                            {/* DESCARGAR PDF DEL MANUSCRITO */}
                            <button
                              onClick={async () => {
                                try {
                                  let downloadUrl = null;
                                  let fileName = 'manuscrito.pdf';
                                  
                                  if (sub.formattedPdfFile?.url) {
                                    downloadUrl = sub.formattedPdfFile.url;
                                    fileName = `manuscrito_${sub.submissionId || sub.id?.substring(0, 8)}.pdf`;
                                  } else if (sub.formattedDocsFile?.url) {
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
                                    alert(isSpanish ? 'No hay documento disponible para descargar' : 'No document available for download');
                                  }
                                } catch (error) {
                                  console.error('❌ Error descargando:', error);
                                  alert(isSpanish ? 'Error al descargar el documento' : 'Error downloading document');
                                }
                              }}
                              className="w-full flex items-center justify-between p-3 border border-gray-200 hover:border-[#003b5c] hover:bg-slate-50 transition-colors rounded-sm group text-left"
                            >
                              <div className="flex items-center gap-3">
                                <Icons.Document className="text-slate-400 group-hover:text-[#003b5c]" />
                                <div>
                                  <p className="text-sm font-semibold text-slate-800 group-hover:text-[#003b5c]">
                                    {isSpanish ? 'Descargar manuscrito (PDF)' : 'Download manuscript (PDF)'}
                                  </p>
                                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                                    {sub.formattedPdfFile?.url ? 'FORMATEADO' : sub.formattedDocsFile?.url ? 'GOOGLE DOCS' : 'ORIGINAL'}
                                  </p>
                                </div>
                              </div>
                              <Icons.Download className="text-slate-300 group-hover:text-[#003b5c]" />
                            </button>

                            {/* DESCARGAR DOCUMENTO FINAL CON REVISIONES (DOCX) */}
                            {sub.finalReviewDocUrl && (
                              <button
                                onClick={async () => {
                                  try {
                                    console.log('📥 Descargando documento final con revisiones en DOCX...');
                                    
                                    const downloadUrl = getDocsExportDocxUrl(sub.finalReviewDocUrl);
                                    
                                    if (downloadUrl) {
                                      const fileName = `revisiones_${sub.submissionId || sub.id?.substring(0, 8)}.docx`;
                                      
                                      const downloadingToast = document.createElement('div');
                                      downloadingToast.className = 'fixed bottom-4 right-4 bg-[#003b5c] text-white px-4 py-3 rounded-sm shadow-2xl z-50 text-sm font-medium animate-in slide-in-from-right';
                                      downloadingToast.textContent = isSpanish ? '📥 Descargando documento...' : '📥 Downloading document...';
                                      document.body.appendChild(downloadingToast);
                                      
                                      const link = document.createElement('a');
                                      link.href = downloadUrl;
                                      link.download = fileName;
                                      link.target = '_blank';
                                      link.rel = 'noopener noreferrer';
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                      
                                      setTimeout(() => {
                                        downloadingToast.remove();
                                      }, 3000);
                                      
                                      console.log('✅ Descarga de revisiones iniciada:', fileName);
                                    } else {
                                      throw new Error('No se pudo generar URL de descarga');
                                    }
                                  } catch (error) {
                                    console.error('❌ Error descargando revisiones:', error);
                                    
                                    const errorToast = document.createElement('div');
                                    errorToast.className = 'fixed bottom-4 right-4 bg-red-600 text-white px-4 py-3 rounded-sm shadow-2xl z-50 text-sm font-medium';
                                    errorToast.textContent = isSpanish ? '❌ Error al descargar. Intenta de nuevo.' : '❌ Download error. Please try again.';
                                    document.body.appendChild(errorToast);
                                    
                                    setTimeout(() => {
                                      errorToast.remove();
                                    }, 4000);
                                  }
                                }}
                                className="w-full flex items-center justify-between p-3 border border-gray-200 hover:border-[#003b5c] hover:bg-slate-50 transition-colors rounded-sm group text-left"
                              >
                                <div className="flex items-center gap-3">
                                  <Icons.Edit className="text-slate-400 group-hover:text-[#003b5c]" />
                                  <div>
                                    <p className="text-sm font-semibold text-slate-800 group-hover:text-[#003b5c]">
                                      {isSpanish ? 'Descargar revisiones (DOCX)' : 'Download reviews (DOCX)'}
                                    </p>
                                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                                      {isSpanish ? 'Documento Word con comentarios' : 'Word document with comments'}
                                    </p>
                                  </div>
                                </div>
                                <Icons.Download className="text-slate-300 group-hover:text-[#003b5c]" />
                              </button>
                            )}

                            {/* CONSENTIMIENTOS PARA MENORES - CONSERVADO COMPLETO */}
                            {sub.hasMinorAuthors && sub.consentFiles && sub.consentFiles.length > 0 && (
                              <div className="pt-2 mt-2 border-t border-gray-200">
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
                                    className="w-full flex items-center gap-2 p-2.5 bg-orange-50 hover:bg-orange-100 transition-colors border border-orange-200 rounded-sm mb-1 text-left"
                                  >
                                    <Icons.User className="text-orange-600 w-4 h-4 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium text-slate-800 truncate">
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
                                      <Icons.Download className="w-4 h-4 text-orange-600 flex-shrink-0" />
                                    ) : (
                                      <span className="text-[10px] text-slate-400 flex-shrink-0">
                                        {isSpanish ? 'No disponible' : 'N/A'}
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* FORMULARIOS DE AUTORIZACIÓN PARA MENORES - CONSERVADO COMPLETO */}
                            {sub.hasMinorAuthors && sub.minorAuthors && sub.minorAuthors.length > 0 && (
                              <div className="pt-2 mt-2 border-t border-gray-200">
                                <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-2 px-1">
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
                                    const templateUrl = 'https://www.revistacienciasestudiantes.com/assets/consentimiento-menor.pdf';
                                    window.open(templateUrl, '_blank', 'noopener noreferrer');
                                  }}
                                  className="w-full flex items-center gap-2 p-2.5 bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-200 rounded-sm"
                                >
                                  <Icons.Document className="text-slate-400 flex-shrink-0 w-4 h-4" />
                                  <div className="text-left flex-1 min-w-0">
                                    <p className="text-xs font-medium text-slate-800">
                                      {isSpanish ? 'Plantilla de consentimiento' : 'Consent form template'}
                                    </p>
                                    <p className="text-[10px] text-slate-500">PDF</p>
                                  </div>
                                  <Icons.Download className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                </button>
                              </div>
                            )}

                            {/* INDICADOR DE ESTADO DEL DOCUMENTO - CONSERVADO COMPLETO */}
                            {sub.documentStatus && (
                              <div className="pt-2 mt-2 border-t border-gray-200">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">
                                  {isSpanish ? 'Estado del documento' : 'Document status'}
                                </p>
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[10px] font-mono font-bold border ${
                                  sub.documentStatus === 'processed' 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                    : sub.documentStatus === 'processing'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-red-50 text-red-700 border-red-200'
                                }`}>
                                  {sub.documentStatus === 'processed' && <Icons.Check />}
                                  {sub.documentStatus === 'processing' && <Icons.Clock />}
                                  {sub.documentStatus === 'processing_failed' && <Icons.Warning />}
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

                        {/* COMENTARIOS AL EDITOR - CONSERVADO COMPLETO */}
                        {sub.editorComment && (
                          <div className="bg-white border border-gray-200 rounded-sm">
                            <div className="bg-slate-50 px-4 py-3 border-b border-gray-200">
                              <h4 className="font-sans font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                <Icons.Message className="text-[#003b5c]" />
                                {isSpanish ? 'Tu Mensaje al Editor' : 'Your Message to the Editor'}
                              </h4>
                            </div>
                            <div className="p-4">
                              <div className="bg-gradient-to-br from-[#F8F9FB] to-[#F0F4F8] border border-[#E5E9F0] rounded-sm p-4 relative">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#003b5c] rounded-l-sm" />
                                <div className="pl-4">
                                  <div 
                                    className="prose prose-sm max-w-none font-serif text-[#1A2B3C] leading-relaxed
                                      [&_strong]:text-[#003b5c] [&_strong]:font-bold
                                      [&_em]:text-[#003b5c] [&_em]:italic
                                      [&_u]:underline [&_u]:decoration-[#003b5c] [&_u]:decoration-2
                                      [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1
                                      [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1
                                      [&_li]:text-[#1A2B3C] [&_li]:marker:text-[#003b5c]"
                                    dangerouslySetInnerHTML={{ __html: sub.editorComment }}
                                  />
                                </div>
                              </div>
                              <div className="mt-3 flex items-center gap-2 text-[10px] text-[#5A6B7A] font-mono uppercase tracking-wider">
                                <span className="w-2 h-2 bg-[#003b5c] rounded-full" />
                                {isSpanish ? 'Enviado con el manuscrito' : 'Submitted with manuscript'}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal para subir revisión - CONSERVADO COMPLETO CON CONFIRMACIÓN */}
      <AnimatePresence>
        {selectedSubmission && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => {
              if (!uploading) {
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
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-sm w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-300"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="bg-[#003b5c] p-6 text-white sticky top-0 z-10 border-b border-[#002147]">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-sans font-bold text-lg uppercase tracking-wider mb-1">
                      {isSpanish ? 'Subir Versión Revisada' : 'Upload Revised Version'}
                    </h3>
                    <p className="text-sky-200 text-sm font-serif truncate max-w-lg">
                      {selectedSubmission.title}
                    </p>
                  </div>
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
                    className="p-2 hover:bg-white/10 rounded-sm transition-colors text-sky-200 hover:text-white"
                  >
                    <Icons.Cross />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 bg-white text-[#003b5c] text-xs font-bold rounded-sm font-mono">
                    {isSpanish ? `Ronda ${selectedSubmission.currentRound || 1} → ${(selectedSubmission.currentRound || 1) + 1}` : `Round ${selectedSubmission.currentRound || 1} → ${(selectedSubmission.currentRound || 1) + 1}`}
                  </span>
                  <span className="px-3 py-1 bg-white/15 text-white text-xs rounded-sm font-mono">
                    {selectedSubmission.submissionId}
                  </span>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-8 space-y-8">
                
                {/* 1. Archivo */}
                <section>
                  <h4 className="font-sans font-bold text-sm text-slate-800 uppercase tracking-wider mb-3 border-b border-gray-200 pb-2">
                    {isSpanish ? '1. Archivo Revisado' : '1. Revised File'} <span className="text-red-600">*</span>
                  </h4>
                  <p className="text-[10px] text-[#5A6B7A] font-mono mb-3">
                    {isSpanish ? 'PDF o Word (.doc, .docx) — Máx. 10MB' : 'PDF or Word (.doc, .docx) — Max. 10MB'}
                  </p>
                  <div className="bg-slate-50 border border-dashed border-gray-300 hover:border-[#003b5c] p-6 rounded-sm transition-colors text-center">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={handleFileChange}
                      className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-sm file:border file:border-gray-300 file:text-sm file:font-bold file:uppercase file:tracking-wider file:bg-white file:text-slate-700 hover:file:bg-slate-50 cursor-pointer mx-auto"
                      disabled={uploading}
                    />
                    
                    {revisionFile && (
                      <div className="mt-4 inline-flex items-center gap-3 bg-white border border-gray-200 px-4 py-2 rounded-sm text-sm">
                        <Icons.Document className="text-[#003b5c]" />
                        <div className="text-left">
                          <p className="font-medium text-slate-700 text-sm">{revisionFile.name}</p>
                          <p className="text-xs text-slate-500">{(revisionFile.size / 1024).toFixed(2)} KB</p>
                        </div>
                        <button 
                          onClick={() => setRevisionFile(null)} 
                          className="text-slate-400 hover:text-red-600 ml-2"
                          disabled={uploading}
                        >
                          <Icons.Cross />
                        </button>
                      </div>
                    )}
                  </div>
                </section>

                {/* 2. Resumen de Cambios */}
                <section>
                  <h4 className="font-sans font-bold text-sm text-slate-800 uppercase tracking-wider mb-3 border-b border-gray-200 pb-2">
                    {isSpanish ? '2. Resumen de Cambios' : '2. Summary of Changes'} <span className="text-red-600">*</span>
                  </h4>
                  <p className="text-[10px] text-[#5A6B7A] font-mono mb-3">
                    {isSpanish ? 'Breve descripción de los cambios realizados' : 'Brief description of changes made'}
                  </p>
                  <textarea
                    value={revisionNotes}
                    onChange={(e) => setRevisionNotes(e.target.value)}
                    rows="4"
                    className="w-full p-4 border border-gray-300 rounded-sm focus:ring-2 focus:ring-[#003b5c] focus:outline-none text-sm font-sans resize-none"
                    placeholder={isSpanish 
                      ? 'Ej: Se corrigieron los errores metodológicos señalados por el Revisor 1. Se actualizó la sección de resultados con nuevos datos...' 
                      : 'Ex: Corrected methodological errors pointed out by Reviewer 1. Updated results section with new data...'}
                    disabled={uploading}
                  />
                </section>

                {/* 3. Comentario Detallado (Quill) */}
                <section>
                  <h4 className="font-sans font-bold text-sm text-slate-800 uppercase tracking-wider mb-3 border-b border-gray-200 pb-2">
                    {isSpanish ? '3. Comentario Detallado al Editor' : '3. Detailed Comment to Editor'}
                  </h4>
                  <p className="text-[10px] text-[#5A6B7A] font-mono mb-3">
                    {isSpanish ? 'Explica cómo incorporaste las revisiones, justifica cambios de autoría, etc.' : 'Explain how you incorporated revisions, justify authorship changes, etc.'}
                  </p>
                  <div className="border border-gray-300 rounded-sm bg-white focus-within:border-[#003b5c] focus-within:ring-2 focus-within:ring-[#003b5c]/20 transition-all">
                    <ReactQuill
                      theme="snow"
                      value={revisionComment}
                      onChange={setRevisionComment}
                      placeholder={isSpanish 
                        ? 'Escribe aquí un comentario detallado para el editor...\n\nPuedes:\n• Explicar cómo respondiste a cada revisión\n• Justificar cambios en la lista de autores\n• Señalar mejoras adicionales\n• Incluir enlaces a repositorios o datos complementarios' 
                        : 'Write a detailed comment for the editor here...\n\nYou can:\n• Explain how you responded to each review\n• Justify changes in the author list\n• Point out additional improvements\n• Include links to repositories or supplementary data'}
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
                      className="font-serif text-sm"
                      style={{ height: '300px' }}
                      readOnly={uploading}
                    />
                  </div>
                  
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#5A6B7A] bg-slate-100 px-2 py-1 rounded-sm border border-slate-200">
                      <span className="font-bold">B</span> {isSpanish ? 'Negrita' : 'Bold'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#5A6B7A] bg-slate-100 px-2 py-1 rounded-sm border border-slate-200">
                      <span className="italic">I</span> {isSpanish ? 'Cursiva' : 'Italic'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#5A6B7A] bg-slate-100 px-2 py-1 rounded-sm border border-slate-200">
                      🔗 URLs
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#5A6B7A] bg-slate-100 px-2 py-1 rounded-sm border border-slate-200">
                      📋 {isSpanish ? 'Listas' : 'Lists'}
                    </span>
                  </div>
                </section>

                {/* Acciones */}
                <div className="pt-6 border-t border-gray-200 flex flex-col-reverse sm:flex-row justify-end gap-3">
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
                    className="px-6 py-2.5 border border-gray-300 text-slate-700 font-sans font-bold text-sm uppercase tracking-wider rounded-sm hover:bg-gray-50 transition-colors"
                  >
                    {isSpanish ? 'Cancelar' : 'Cancel'}
                  </button>
                  <button
                    onClick={handleSubmitRevision}
                    disabled={uploading || !revisionFile || !revisionNotes.trim()}
                    className="px-6 py-2.5 bg-[#003b5c] text-white font-sans font-bold text-sm uppercase tracking-wider rounded-sm hover:bg-sky-900 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2 shadow-sm"
                  >
                    {uploading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {isSpanish ? 'Subiendo...' : 'Uploading...'}
                      </>
                    ) : (
                      <>
                        <Icons.Upload />
                        {isSpanish ? 'Enviar Versión Revisada' : 'Submit Revised Version'}
                      </>
                    )}
                  </button>
                </div>
                
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