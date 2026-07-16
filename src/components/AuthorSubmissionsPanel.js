// src/components/AuthorSubmissionsPanel.js
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, submitRevision } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot
} from 'firebase/firestore';
import { useLanguage } from '../hooks/useLanguage';
import { AuthorMetadataResponseTab } from './AuthorMetadataResponseTab';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

// ================= ICONOS SVG ELEGANTES =================
const Icons = {
  Document: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Inbox: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>,
  Users: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  Alert: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  Check: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" /></svg>,
  ArrowLeft: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
  Download: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  Clock: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Tag: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>,
  Globe: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Database: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2 1.5 3.5 4 4.5s5.5 1 8 0 4-2.5 4-4.5V7c0 2-1.5 3.5-4 4.5S10.5 12.5 8 11.5 4 9 4 7zm0 5c0 2 1.5 3.5 4 4.5s5.5 1 8 0 4-2.5 4-4.5M4 7c0 2 1.5 3.5 4 4.5S13.5 12.5 16 11.5 20 9 20 7 18.5 3.5 16 2.5 10.5 1.5 8 2.5 4 5 4 7z" /></svg>,
  Shield: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  Robot: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  Money: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  User: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Email: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  Building: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  Key: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>,
  File: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
  Send: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>,
  
  Search: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>,
  
  XCircle: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  
  Edit: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.89 1.147l-3.148.868a.375.375 0 01-.465-.465l.868-3.148a4.5 4.5 0 011.147-1.89L16.862 4.487zM16.862 4.487L19.5 7.125" /></svg>,
  
  Scale: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5v15.75m0 0h3.75M12 20.25H8.25M5.25 7.5h13.5M5.25 7.5l-2.25 6.75a2.25 2.25 0 004.5 0L5.25 7.5zm13.5 0l-2.25 6.75a2.25 2.25 0 004.5 0L18.75 7.5zM12 4.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" /></svg>,
  
  Refresh: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>,
  
  CheckBadge: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" /></svg>
};

// ================= FUNCIONES UTILITARIAS =================
const decodeBase64IfNeeded = (text) => {
  if (!text || typeof text !== 'string') return text;
  if (text.trim() === '') return text;
  const tryDecodeBase64 = (str) => {
    try {
      const decoded = atob(str);
      const isText = /^[\x20-\x7E\r\n\t]*$/.test(decoded) || /<[^>]*>/.test(decoded);
      if (!isText || decoded.length === 0) return null;
      return decoded;
    } catch (e) { return null; }
  };
  const cleanText = text.trim();
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (base64Regex.test(cleanText) && cleanText.length % 4 === 0) {
    const decoded = tryDecodeBase64(cleanText);
    if (decoded !== null) return decoded;
  }
  return text;
};

const getDocsExportUrl = (docsUrl) => {
  if (!docsUrl) return null;
  const match = docsUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return `https://docs.google.com/document/d/${match[1]}/export?format=pdf`;
  const driveMatch = docsUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) return `https://docs.google.com/document/d/${driveMatch[1]}/export?format=pdf`;
  return null;
};

const getDocsExportDocxUrl = (docsUrl) => {
  if (!docsUrl) return null;
  const match = docsUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return `https://docs.google.com/document/d/${match[1]}/export?format=docx`;
  const driveMatch = docsUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) return `https://docs.google.com/document/d/${driveMatch[1]}/export?format=docx`;
  return null;
};

// ================= ESTADOS DE ENVÍO =================
// ================= ESTADOS DE ENVÍO =================
const SUBMISSION_STATES = {
  'submitted': { 
    es: 'Enviado', en: 'Submitted', 
    color: 'bg-slate-50 text-slate-700 border-slate-200', 
    icon: <Icons.Send />, 
    description: { es: 'Manuscrito recibido. En espera de asignación editorial.', en: 'Manuscript received. Awaiting editorial assignment.' } 
  },
  'in-editorial-review': { 
    es: 'Revisión Editorial', en: 'Desk Review', 
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200', 
    icon: <Icons.Search />, 
    description: { es: 'Evaluación preliminar por el comité editorial.', en: 'Preliminary evaluation by the editorial committee.' } 
  },
  'desk-review-rejected': { 
    es: 'Rechazo Editorial', en: 'Desk Reject', 
    color: 'bg-rose-50 text-rose-700 border-rose-200', 
    icon: <Icons.XCircle />, 
    description: { es: 'El manuscrito no superó los criterios iniciales de la revista.', en: 'The manuscript did not meet the initial criteria of the journal.' } 
  },
  'in-reviewer-selection': { 
    es: 'Asignando Revisores', en: 'Assigning Reviewers', 
    color: 'bg-sky-50 text-sky-700 border-sky-200', 
    icon: <Icons.Users />, 
    description: { es: 'El equipo editorial está identificando pares evaluadores idóneos.', en: 'The editorial team is identifying suitable peer reviewers.' } 
  },
  'awaiting-reviewer-responses': { 
    es: 'Invitaciones Enviadas', en: 'Invitations Sent', 
    color: 'bg-blue-50 text-blue-700 border-blue-200', 
    icon: <Icons.Clock />, 
    description: { es: 'Esperando confirmación de los revisores invitados.', en: 'Awaiting confirmation from invited reviewers.' } 
  },
  'in-peer-review': { 
    es: 'Revisión por Pares', en: 'Peer Review', 
    color: 'bg-purple-50 text-purple-700 border-purple-200', 
    icon: <Icons.Edit />, 
    description: { es: 'Evaluación científica en curso por pares ciegos.', en: 'Scientific evaluation in progress by blind peers.' } 
  },
  'awaiting-editor-decision': { 
    es: 'Decisión Pendiente', en: 'Pending Decision', 
    color: 'bg-violet-50 text-violet-700 border-violet-200', 
    icon: <Icons.Scale />, 
    description: { es: 'Dictámenes recibidos. El editor está formulando la resolución final.', en: 'Reviews received. The editor is formulating the final resolution.' } 
  },
  'revisions-requested': { 
    es: 'Requiere Revisiones', en: 'Revisions Required', 
    color: 'bg-amber-50 text-amber-700 border-amber-300', 
    icon: <Icons.Edit />, 
    description: { es: 'Se requiere una versión corregida del manuscrito. Por favor, revise las indicaciones.', en: 'A corrected version of the manuscript is required. Please review the instructions.' } 
  },
  'minor-revision-required': { 
    es: 'Revisión Menor', en: 'Minor Revision', 
    color: 'bg-amber-50 text-amber-700 border-amber-300', 
    icon: <Icons.Edit />, 
    description: { es: 'Ajustes menores requeridos antes de la aceptación final.', en: 'Minor adjustments required before final acceptance.' } 
  },
  'major-revision-required': { 
    es: 'Revisión Mayor', en: 'Major Revision', 
    color: 'bg-orange-50 text-orange-700 border-orange-300', 
    icon: <Icons.Refresh />, 
    description: { es: 'Se requieren modificaciones sustanciales y una nueva ronda de revisión.', en: 'Substantial modifications and a new round of review are required.' } 
  },
  'awaiting-revision': { 
    es: 'Esperando Corrección', en: 'Awaiting Correction', 
    color: 'bg-amber-50 text-amber-700 border-amber-300', 
    icon: <Icons.Clock />, 
    description: { es: 'Aguardando la versión corregida por parte del autor.', en: 'Awaiting the corrected version from the author.' } 
  },
  'accepted': { 
    es: 'Aceptado', en: 'Accepted', 
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200', 
    icon: <Icons.CheckBadge />, 
    description: { es: 'Manuscrito aceptado formalmente para publicación. ¡Felicitaciones!', en: 'Manuscript formally accepted for publication. Congratulations!' } 
  },
  'rejected': { 
    es: 'Rechazado', en: 'Rejected', 
    color: 'bg-red-50 text-red-700 border-red-200', 
    icon: <Icons.XCircle />, 
    description: { es: 'El manuscrito ha sido declinado tras el proceso de revisión.', en: 'The manuscript has been declined after the review process.' } 
  },
  'metadata_refinement_pending': { 
    es: 'Ajuste de Metadatos', en: 'Metadata Refinement', 
    color: 'bg-teal-50 text-teal-700 border-teal-200', 
    icon: <Icons.Tag />, 
    description: { es: 'El editor ha propuesto cambios en los metadatos. Requiere su revisión y aprobación.', en: 'The editor has proposed metadata changes. Requires your review and approval.' } 
  }
};

// ================= COMPONENTE PRINCIPAL =================
const AuthorSubmissionsPanel = ({ user }) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estado para el Portal (Modal de pantalla completa)
  const [activePortal, setActivePortal] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Estados para el formulario de revisión
  const [revisionComment, setRevisionComment] = useState('');
  const [revisionFile, setRevisionFile] = useState(null);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [uploading, setUploading] = useState(false);

  // ================= CARGA DE DATOS =================
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'submissions'), where('authorUID', '==', user.uid));
    const reviewsListeners = new Map();
    const proposalsListeners = new Map();

    const unsubscribe = onSnapshot(q, (snapshot) => {
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
      }).sort((a, b) => b.createdAt - a.createdAt);

      setSubmissions(baseSubmissionsList);
      setLoading(false);

      // Limpiar listeners anteriores
      reviewsListeners.forEach(unsub => unsub());
      reviewsListeners.clear();
      proposalsListeners.forEach(unsub => unsub());
      proposalsListeners.clear();

      snapshot.docs.forEach(doc => {
        const submissionId = doc.id;
        
        // Listener Revisiones
        const reviewsQuery = query(collection(db, 'submissions', submissionId, 'reviews'));
        const unsubReviews = onSnapshot(reviewsQuery, (reviewsSnap) => {
          const reviews = reviewsSnap.docs.map(r => ({ 
            id: r.id, 
            ...r.data(), 
            submittedAt: r.data().submittedAt?.toDate?.() || r.data().submittedAt 
          }));
          setSubmissions(prev => prev.map(sub => 
            sub.id === submissionId ? { ...sub, reviews } : sub
          ));
          // Actualizar portal activo si está abierto
          setActivePortal(prev => {
            if (prev?.id === submissionId) {
              return { ...prev, reviews };
            }
            return prev;
          });
        });
        reviewsListeners.set(submissionId, unsubReviews);

        // Listener Propuestas de metadatos
        const proposalsQuery = query(
          collection(db, 'submissions', submissionId, 'metadataProposals'), 
          where('status', '==', 'pending-author')
        );
        const unsubProposals = onSnapshot(proposalsQuery, (propsSnap) => {
          const pendingProposals = propsSnap.docs.map(p => ({ 
            id: p.id, 
            ...p.data(),
            proposedAt: p.data().proposedAt?.toDate?.() || p.data().proposedAt
          }));
          setSubmissions(prev => prev.map(sub => 
            sub.id === submissionId ? { ...sub, pendingProposals } : sub
          ));
          // Actualizar portal activo si está abierto
          setActivePortal(prev => {
            if (prev?.id === submissionId) {
              return { ...prev, pendingProposals };
            }
            return prev;
          });
        });
        proposalsListeners.set(submissionId, unsubProposals);
      });
    }, (error) => {
      console.error('Error loading submissions:', error);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      reviewsListeners.forEach(unsub => unsub());
      proposalsListeners.forEach(unsub => unsub());
    };
  }, [user]);

  // ================= FUNCIONES AUXILIARES =================
  const hasPendingMetadataProposals = (submission) => {
    return submission?.pendingProposals?.length > 0;
  };

  const needsRevisionUpload = (status) => {
    return ['revisions-requested', 'minor-revision-required', 'major-revision-required', 'awaiting-revision'].includes(status);
  };

  const requiresAction = (sub) => {
    return needsRevisionUpload(sub?.status) || hasPendingMetadataProposals(sub);
  };

  const handleOpenPortal = (sub) => {
    setActivePortal(sub);
    // Enrutamiento inteligente al abrir
    if (requiresAction(sub)) {
      setActiveTab('tasks');
    } else {
      setActiveTab('overview');
    }
  };

  const handleClosePortal = () => {
    if (uploading) return;
    setActivePortal(null);
    setRevisionFile(null);
    setRevisionNotes('');
    setRevisionComment('');
  };

  const getTimelineStep = (status) => {
    const steps = [
      'submitted',
      'in-editorial-review',
      'in-reviewer-selection',
      'awaiting-reviewer-responses',
      'in-peer-review',
      'awaiting-editor-decision',
      'accepted'
    ];
    const idx = steps.indexOf(status);
    return idx >= 0 ? idx : 0;
  };

  // ================= MANEJO DE ARCHIVOS Y REVISIÓN =================
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
    try {
      const reader = new FileReader();
      const filePromise = new Promise((resolve, reject) => {
        reader.onload = async () => {
          try {
            const result = await submitRevision({
              submissionId: activePortal.id,
              fileBase64: reader.result,
              fileName: revisionFile.name,
              notes: revisionNotes,
              revisionComment: revisionComment,
              round: activePortal.currentRound || 1
            });
            if (result.success) {
              alert(isSpanish ? 'Revisión enviada con éxito' : 'Revision submitted successfully');
              setRevisionFile(null);
              setRevisionNotes('');
              setRevisionComment('');
              setActiveTab('overview');
            } else {
              throw new Error(result.error || 'Error al subir revisión');
            }
            resolve();
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = () => reject(new Error('Error leyendo archivo'));
        reader.readAsDataURL(revisionFile);
      });
      await filePromise;
    } catch (error) {
      console.error('Error submitting revision:', error);
      alert(isSpanish ? 'Error al enviar la revisión: ' + error.message : 'Error submitting revision: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadManuscript = () => {
    let downloadUrl = null;
    let fileName = 'manuscrito.pdf';
    
    if (activePortal.formattedPdfFile?.url) {
      downloadUrl = activePortal.formattedPdfFile.url;
      fileName = `manuscrito_${activePortal.submissionId || activePortal.id?.substring(0, 8)}.pdf`;
    } else if (activePortal.formattedDocsFile?.url) {
      const fileId = activePortal.formattedDocsFile.id || activePortal.formattedDocsFile.url.split('/d/')[1]?.split('/')[0];
      if (fileId) {
        downloadUrl = `https://docs.google.com/document/d/${fileId}/export?format=pdf`;
        fileName = `manuscrito_${activePortal.submissionId || activePortal.id?.substring(0, 8)}.pdf`;
      }
    } else if (activePortal.originalFileUrl) {
      downloadUrl = activePortal.originalFileUrl;
      fileName = activePortal.originalFileName || 'manuscrito_original.pdf';
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
    } else {
      alert(isSpanish ? 'No hay documento disponible para descargar' : 'No document available for download');
    }
  };

  const handleDownloadConsent = (consent) => {
    if (consent.fileUrl) {
      window.open(consent.fileUrl, '_blank', 'noopener noreferrer');
    } else if (consent.fileId) {
      window.open(`https://drive.google.com/file/d/${consent.fileId}/view`, '_blank', 'noopener noreferrer');
    } else if (consent.method === 'email') {
      alert(isSpanish 
        ? `Consentimiento para ${consent.author} fue enviado por correo electrónico.` 
        : `Consent for ${consent.author} was sent by email.`);
    } else {
      alert(isSpanish ? 'Documento de consentimiento no disponible' : 'Consent document not available');
    }
  };

  // ================= RENDERIZADO =================
  if (!user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center p-8 bg-white border border-slate-200 shadow-sm max-w-md">
          <Icons.Shield />
          <p className="mt-4 text-slate-500 font-serif italic">
            {isSpanish ? 'Inicie sesión para acceder a sus expedientes.' : 'Log in to access your records.'}
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-6">
        <div className="w-10 h-10 border-2 border-t-[#003b5c] border-slate-200 rounded-full animate-spin"></div>
        <p className="font-serif italic text-slate-500 text-lg">
          {isSpanish ? 'Accediendo a los expedientes editoriales...' : 'Accessing editorial records...'}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in duration-700">
      
      {/* ===================== ESCRITORIO (DASHBOARD) ===================== */}
      <header className="mb-12 border-b border-slate-200 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="font-serif text-4xl sm:text-5xl text-[#003b5c] mb-2 leading-tight">
            {isSpanish ? 'Expedientes de Autor' : 'Author Records'}
          </h1>
          <p className="text-slate-500 font-sans uppercase tracking-widest text-xs font-bold flex items-center gap-2">
            <span className="w-4 h-px bg-[#C0A86A]"></span>
            {isSpanish ? 'Gestor de Manuscritos — Revista Nacional de Ciencias para Estudiantes' : 'Manuscript Manager — National Student Science Journal'}
          </p>
        </div>
        <button
          onClick={() => window.location.href = isSpanish ? '/login/submit' : '/en/login/submit'}
          className="bg-[#003b5c] hover:bg-[#002840] text-white px-8 py-3.5 text-sm font-bold uppercase tracking-widest transition-colors shadow-sm flex items-center justify-center gap-3 group"
        >
          <span className="text-lg leading-none group-hover:rotate-90 transition-transform">+</span>
          {isSpanish ? 'Iniciar Nuevo Envío' : 'Start New Submission'}
        </button>
      </header>

      {submissions.length === 0 ? (
        <div className="text-center py-24 bg-slate-50 border-2 border-dashed border-slate-200">
          <Icons.File />
          <p className="font-serif text-2xl text-slate-400 italic mt-4">
            {isSpanish ? 'No posee manuscritos en curso.' : 'No manuscripts in progress.'}
          </p>
          <p className="text-slate-400 text-sm mt-2">
            {isSpanish ? 'Inicie un nuevo envío para comenzar.' : 'Start a new submission to begin.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {submissions.map((sub) => {
            const hasAction = requiresAction(sub);
            const statusInfo = SUBMISSION_STATES[sub.status] || SUBMISSION_STATES.submitted;

            return (
              <motion.div
                key={sub.id}
                whileHover={{ y: -4 }}
                onClick={() => handleOpenPortal(sub)}
                className={`group cursor-pointer bg-white border ${
                  hasAction 
                    ? 'border-amber-300 shadow-md ring-1 ring-amber-300' 
                    : 'border-slate-200 shadow-sm hover:border-[#003b5c] hover:shadow-md'
                } transition-all flex flex-col h-full`}
              >
                {/* Banner de Acción Requerida */}
                {hasAction && (
                  <div className="bg-amber-50 px-4 py-2 border-b border-amber-200 flex items-center gap-2">
                    <span className="text-amber-600"><Icons.Alert /></span>
                    <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                      {isSpanish ? 'Acción Requerida' : 'Action Required'}
                    </span>
                  </div>
                )}

                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                      ID: {sub.submissionId || sub.id.substring(0,8)}
                    </span>
                    <span className={`text-[10px] px-2.5 py-1 uppercase font-bold tracking-wider border ${statusInfo.color}`}>
                      {statusInfo[language]}
                    </span>
                  </div>

                  <h3 className="font-serif text-xl text-slate-800 group-hover:text-[#003b5c] transition-colors leading-snug mb-4 flex-1 line-clamp-3">
                    {sub.title}
                  </h3>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-sans">
                    <span className="flex items-center gap-1.5">
                      <Icons.Clock />
                      {sub.createdAt?.toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1 group-hover:text-[#003b5c] transition-colors font-bold uppercase tracking-wider">
                      {isSpanish ? 'Abrir' : 'Open'} <Icons.Check />
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ===================== PORTAL DEL MANUSCRITO (PANTALLA COMPLETA) ===================== */}
      <AnimatePresence>
        {activePortal && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 bg-[#F8F9FB] flex flex-col overflow-hidden"
          >
            {/* Header del Portal */}
            <div className="bg-[#003b5c] text-white px-4 sm:px-6 py-4 flex items-center justify-between shadow-md z-10 shrink-0">
              <div className="flex items-center gap-4 sm:gap-6 overflow-hidden">
                <button 
                  onClick={handleClosePortal}
                  className="hover:bg-white/10 p-2 -ml-2 rounded-full transition-colors flex-shrink-0"
                  title={isSpanish ? 'Volver al Escritorio' : 'Back to Desk'}
                >
                  <Icons.ArrowLeft />
                </button>
                <div className="min-w-0">
                  <p className="text-[10px] font-mono text-sky-200 uppercase tracking-widest mb-1">
                    ID: {activePortal.submissionId || activePortal.id.substring(0,8)}
                  </p>
                  <h2 className="font-serif text-base sm:text-lg font-bold truncate">
                    {activePortal.title}
                  </h2>
                </div>
              </div>
              
              <div className="hidden sm:block">
                <span className="text-xs px-3 py-1.5 uppercase font-bold tracking-wider bg-white/10 text-white border border-white/20">
                  {SUBMISSION_STATES[activePortal.status]?.[language]}
                </span>
              </div>
            </div>

            {/* Navegación por Pestañas */}
            <div className="bg-white border-b border-slate-200 px-4 sm:px-6 shrink-0 shadow-sm z-10">
              <div className="max-w-6xl mx-auto flex gap-4 sm:gap-8 overflow-x-auto hide-scrollbar">
                {[
                  { id: 'overview', label: isSpanish ? 'Resumen' : 'Overview', icon: Icons.Document },
                  { id: 'submission', label: isSpanish ? 'Envío Completo' : 'Full Submission', icon: Icons.Database },
                  { id: 'documents', label: isSpanish ? 'Documentos' : 'Documents', icon: Icons.Download },
                  { id: 'reviews', label: isSpanish ? 'Revisiones' : 'Reviews', icon: Icons.Users },
                  { id: 'tasks', label: isSpanish ? 'Acciones' : 'Actions', icon: Icons.Alert, alert: requiresAction(activePortal) }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-3 sm:py-4 flex items-center gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider whitespace-nowrap border-b-2 transition-colors relative ${
                      activeTab === tab.id 
                        ? 'border-[#003b5c] text-[#003b5c]' 
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <tab.icon />
                    {tab.label}
                    {tab.alert && (
                      <span className="absolute top-2 sm:top-3 -right-2 w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Área de Contenido con Scroll */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10">
              <div className="max-w-4xl mx-auto">
                
                {/* ---------------- PESTAÑA: RESUMEN ---------------- */}
                {activeTab === 'overview' && (
                  <div className="space-y-8 animate-in fade-in">
                    
                    {/* Estado del Expediente */}
                    <div className="bg-white p-6 sm:p-8 border border-slate-200 shadow-sm">
                      <h3 className="font-sans font-bold text-xs uppercase tracking-widest text-slate-400 mb-4">
                        {isSpanish ? 'Estado del Expediente' : 'Record Status'}
                      </h3>
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-slate-50 flex items-center justify-center border border-slate-100 flex-shrink-0 text-[#003b5c]">
  {SUBMISSION_STATES[activePortal.status]?.icon}
</div>
                        <div>
                          <p className="font-serif text-xl sm:text-2xl text-[#003b5c]">
                            {SUBMISSION_STATES[activePortal.status]?.[language]}
                          </p>
                          <p className="text-slate-600 font-sans text-sm mt-1">
                            {SUBMISSION_STATES[activePortal.status]?.description[language]}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Timeline de Progreso */}
                    {!['accepted', 'rejected', 'desk-review-rejected'].includes(activePortal.status) && (
                      <div className="bg-white p-6 sm:p-8 border border-slate-200 shadow-sm">
                        <h3 className="font-sans font-bold text-xs uppercase tracking-widest text-slate-400 mb-6">
                          {isSpanish ? 'Progreso del Manuscrito' : 'Manuscript Progress'}
                        </h3>
                        <div className="relative">
                          <div className="absolute top-4 left-0 w-full h-[1px] bg-slate-200 z-0 hidden sm:block" />
                          <div className="flex sm:justify-between overflow-x-auto sm:overflow-visible pb-2 sm:pb-0 gap-4 sm:gap-0">
                            {['submitted', 'in-editorial-review', 'in-reviewer-selection', 'awaiting-reviewer-responses', 'in-peer-review', 'awaiting-editor-decision', 'accepted'].map((step, idx) => {
                              const currentStep = getTimelineStep(activePortal.status);
                              const isCompleted = idx < currentStep;
                              const isCurrent = idx === currentStep;
                              
                              return (
                                <div key={step} className="relative z-10 flex flex-col items-center flex-shrink-0">
                                  <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center transition-all text-xs ${
                                    isCurrent 
                                      ? 'bg-[#003b5c] border-[#003b5c] text-white scale-110 sm:scale-125 shadow-lg' 
                                      : isCompleted
                                      ? 'bg-emerald-500 border-emerald-500 text-white'
                                      : 'bg-white border-slate-200 text-slate-300'
                                  }`}>
                                    {isCompleted ? '✓' : idx + 1}
                                  </div>
                                  <span className={`text-[8px] sm:text-[10px] mt-1 sm:mt-2 font-bold uppercase tracking-tighter whitespace-nowrap ${
                                    isCurrent ? 'text-[#003b5c]' : 'text-slate-400'
                                  }`}>
                                    {SUBMISSION_STATES[step]?.[language] || step}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Feedback del Editor / Decisiones Finales */}
                    {activePortal.finalDecision && (
                      <div className={`p-6 sm:p-8 border shadow-sm ${
                        activePortal.finalDecision === 'accept' ? 'bg-emerald-50 border-emerald-200' :
                        activePortal.finalDecision === 'reject' ? 'bg-rose-50 border-rose-200' :
                        'bg-amber-50 border-amber-200'
                      }`}>
                        <h3 className="font-sans font-bold text-xs uppercase tracking-widest text-slate-500 mb-4">
                          {isSpanish ? 'Resolución Editorial Final' : 'Final Editorial Resolution'}
                        </h3>
                        {activePortal.finalFeedback && (
                          <div className="prose prose-sm max-w-none font-serif text-slate-800 leading-relaxed" 
                               dangerouslySetInnerHTML={{ __html: activePortal.finalFeedback }} />
                        )}
                      </div>
                    )}

                    {activePortal.deskReviewFeedback && !activePortal.finalDecision && (
                      <div className="bg-white p-6 sm:p-8 border border-slate-200 shadow-sm border-l-4 border-l-indigo-400">
                        <h3 className="font-sans font-bold text-xs uppercase tracking-widest text-slate-400 mb-4">
                          {isSpanish ? 'Nota del Comité Editorial' : 'Note from Editorial Committee'}
                        </h3>
                        <p className="font-serif text-slate-700 leading-relaxed">
                          {activePortal.deskReviewFeedback}
                        </p>
                      </div>
                    )}

                    {/* Datos Básicos */}
                    <div className="bg-white p-6 sm:p-8 border border-slate-200 shadow-sm">
                      <h3 className="font-sans font-bold text-xs uppercase tracking-widest text-slate-400 mb-4">
                        {isSpanish ? 'Información General' : 'General Information'}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {isSpanish ? 'Fecha de envío' : 'Submission date'}
                          </p>
                          <p className="font-serif text-slate-700">{activePortal.createdAt?.toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {isSpanish ? 'Ronda actual' : 'Current round'}
                          </p>
                          <p className="font-serif text-slate-700">{activePortal.currentRound || 1}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {isSpanish ? 'Área temática' : 'Thematic area'}
                          </p>
                          <p className="font-serif text-slate-700">{activePortal.area || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {isSpanish ? 'Idioma' : 'Language'}
                          </p>
                          <p className="font-serif text-slate-700">
                            {activePortal.paperLanguage === 'es' ? 'Español' : 'English'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ---------------- PESTAÑA: ENVÍO COMPLETO ---------------- */}
                {activeTab === 'submission' && (
                  <div className="space-y-8 animate-in fade-in">
                    <h2 className="font-serif text-2xl sm:text-3xl text-[#003b5c] mb-2">
                      {isSpanish ? 'Expediente Completo del Manuscrito' : 'Complete Manuscript Record'}
                    </h2>
                    <p className="text-slate-500 font-sans text-sm mb-6">
                      {isSpanish 
                        ? 'Todos los datos registrados en el sistema para este envío.' 
                        : 'All data registered in the system for this submission.'}
                    </p>

                    {/* 1. DATOS DE IDENTIFICACIÓN */}
                    <section className="bg-white p-6 sm:p-8 border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 bg-[#003b5c] text-white flex items-center justify-center">
                          <Icons.Key />
                        </div>
                        <h3 className="font-sans font-bold text-xs uppercase tracking-widest text-slate-600">
                          {isSpanish ? 'Identificación del Envío' : 'Submission Identification'}
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        {[
                          { label: 'Submission ID', value: activePortal.submissionId },
                          { label: 'Request ID', value: activePortal.requestId },
                          { label: 'Author UID', value: activePortal.authorUID || activePortal.uid }
                        ].map((item, idx) => (
                          <div key={idx} className="bg-slate-50 p-3 border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.label}</p>
                            <p className="font-mono text-xs text-slate-700 break-all">{item.value || '—'}</p>
                          </div>
                        ))}
                      </div>
                    </section>

                    {/* 2. DATOS DEL AUTOR */}
                    <section className="bg-white p-6 sm:p-8 border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 bg-[#003b5c] text-white flex items-center justify-center">
                          <Icons.User />
                        </div>
                        <h3 className="font-sans font-bold text-xs uppercase tracking-widest text-slate-600">
                          {isSpanish ? 'Autor Principal' : 'Main Author'}
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        {[
                          { label: isSpanish ? 'Nombre' : 'Name', value: activePortal.authorName },
                          { label: 'Email', value: activePortal.authorEmail }
                        ].map((item, idx) => (
                          <div key={idx} className="bg-slate-50 p-3 border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.label}</p>
                            <p className="font-serif text-slate-700 break-all">{item.value || '—'}</p>
                          </div>
                        ))}
                      </div>
                    </section>

                    {/* 3. DATOS DEL ARTÍCULO */}
                    <section className="bg-white p-6 sm:p-8 border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 bg-[#003b5c] text-white flex items-center justify-center">
                          <Icons.Document />
                        </div>
                        <h3 className="font-sans font-bold text-xs uppercase tracking-widest text-slate-600">
                          {isSpanish ? 'Datos del Artículo' : 'Article Data'}
                        </h3>
                      </div>
                      <div className="space-y-4">
                        <div className="bg-slate-50 p-3 border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {isSpanish ? 'Título' : 'Title'}
                          </p>
                          <p className="font-serif text-slate-700 mt-1">{activePortal.title || '—'}</p>
                        </div>
                        {activePortal.titleEn && (
                          <div className="bg-slate-50 p-3 border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {isSpanish ? 'Título (Inglés)' : 'Title (English)'}
                            </p>
                            <p className="font-serif text-slate-700 mt-1 italic">{activePortal.titleEn}</p>
                          </div>
                        )}
                        <div className="bg-slate-50 p-3 border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {isSpanish ? 'Resumen' : 'Abstract'}
                          </p>
                          <p className="font-serif text-slate-700 mt-1 text-sm leading-relaxed">
                            {activePortal.abstract || '—'}
                          </p>
                        </div>
                        {activePortal.abstractEn && (
                          <div className="bg-slate-50 p-3 border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {isSpanish ? 'Resumen (Inglés)' : 'Abstract (English)'}
                            </p>
                            <p className="font-serif text-slate-700 mt-1 text-sm leading-relaxed italic">
                              {activePortal.abstractEn}
                            </p>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-slate-50 p-3 border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {isSpanish ? 'Área' : 'Area'}
                            </p>
                            <p className="font-sans text-slate-700 text-sm">{activePortal.area || '—'}</p>
                          </div>
                          <div className="bg-slate-50 p-3 border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {isSpanish ? 'Tipo de Artículo' : 'Article Type'}
                            </p>
                            <p className="font-sans text-slate-700 text-sm">{activePortal.articleType || '—'}</p>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* 4. PALABRAS CLAVE */}
                    {activePortal.keywords && activePortal.keywords.length > 0 && (
                      <section className="bg-white p-6 sm:p-8 border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-8 h-8 bg-[#003b5c] text-white flex items-center justify-center">
                            <Icons.Tag />
                          </div>
                          <h3 className="font-sans font-bold text-xs uppercase tracking-widest text-slate-600">
                            {isSpanish ? 'Palabras Clave' : 'Keywords'}
                          </h3>
                          {activePortal.keywordsVocabulario && (
                            <span className="text-[10px] bg-slate-100 px-2 py-0.5 font-mono text-slate-500">
                              {activePortal.keywordsVocabulario}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {activePortal.keywords.map((kw, idx) => (
                            <span key={idx} className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-xs font-mono text-slate-600">
                              {kw}
                            </span>
                          ))}
                        </div>
                        {activePortal.keywordsEn && activePortal.keywordsEn.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {activePortal.keywordsEn.map((kw, idx) => (
                              <span key={idx} className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-xs font-mono text-slate-500 italic">
                                {kw}
                              </span>
                            ))}
                          </div>
                        )}
                      </section>
                    )}

                    {/* 5. AUTORES */}
                    {activePortal.authors && activePortal.authors.length > 0 && (
                      <section className="bg-white p-6 sm:p-8 border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-8 h-8 bg-[#003b5c] text-white flex items-center justify-center">
                            <Icons.Users />
                          </div>
                          <h3 className="font-sans font-bold text-xs uppercase tracking-widest text-slate-600">
                            {isSpanish ? 'Autores' : 'Authors'} ({activePortal.authors.length})
                          </h3>
                        </div>
                        <div className="space-y-3">
                          {activePortal.authors.map((author, idx) => (
                            <div key={idx} className="bg-slate-50 p-4 border border-slate-100">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <span className="font-serif font-bold text-slate-800">
                                  {author.firstName} {author.lastName}
                                </span>
                                {author.isCorresponding && (
                                  <span className="text-[9px] bg-[#003b5c] text-white px-2 py-0.5 uppercase tracking-wider">
                                    {isSpanish ? 'Correspondencia' : 'Corresponding'}
                                  </span>
                                )}
                                {author.isMinor && (
                                  <span className="text-[9px] bg-orange-100 text-orange-700 px-2 py-0.5 uppercase tracking-wider">
                                    {isSpanish ? 'Menor' : 'Minor'}
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                <div>
                                  <span className="text-slate-400">{isSpanish ? 'Email:' : 'Email:'} </span>
                                  <span className="text-slate-600">{author.email || '—'}</span>
                                </div>
                                <div>
                                  <span className="text-slate-400">{isSpanish ? 'Institución:' : 'Institution:'} </span>
                                  <span className="text-slate-600">{author.institution || '—'}</span>
                                </div>
                                <div>
                                  <span className="text-slate-400">ORCID: </span>
                                  <span className="text-slate-600 font-mono">{author.orcid || '—'}</span>
                                </div>
                              </div>
                              {author.contribution && (
                                <p className="text-xs text-slate-500 mt-2 italic">
                                  {author.contribution}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* 6. FINANCIAMIENTO Y CONFLICTOS */}
                    <section className="bg-white p-6 sm:p-8 border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 bg-[#003b5c] text-white flex items-center justify-center">
                          <Icons.Money />
                        </div>
                        <h3 className="font-sans font-bold text-xs uppercase tracking-widest text-slate-600">
                          {isSpanish ? 'Financiamiento y Conflictos' : 'Funding and Conflicts'}
                        </h3>
                      </div>
                      <div className="space-y-3">
                        <div className="bg-slate-50 p-3 border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {isSpanish ? '¿Tiene financiamiento?' : 'Has funding?'}
                          </p>
                          <p className="font-sans text-slate-700 text-sm">
                            {activePortal.funding?.hasFunding 
                              ? (isSpanish ? 'Sí' : 'Yes') 
                              : (isSpanish ? 'No' : 'No')}
                          </p>
                        </div>
                        {activePortal.funding?.hasFunding && (
                          <>
                            <div className="bg-slate-50 p-3 border border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                {isSpanish ? 'Fuentes' : 'Sources'}
                              </p>
                              <p className="font-sans text-slate-700 text-sm">{activePortal.funding.sources || '—'}</p>
                            </div>
                            <div className="bg-slate-50 p-3 border border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                {isSpanish ? 'Números de subvención' : 'Grant numbers'}
                              </p>
                              <p className="font-mono text-slate-700 text-sm">{activePortal.funding.grantNumbers || '—'}</p>
                            </div>
                          </>
                        )}
                        {activePortal.conflictOfInterest && (
                          <div className="bg-slate-50 p-3 border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {isSpanish ? 'Conflicto de intereses' : 'Conflict of interest'}
                            </p>
                            <p className="font-sans text-slate-700 text-sm">{activePortal.conflictOfInterest}</p>
                          </div>
                        )}
                      </div>
                    </section>

                    {/* 7. DISPONIBILIDAD DE DATOS Y CÓDIGO */}
                    {(activePortal.dataAvailability || activePortal.codeAvailability) && (
                      <section className="bg-white p-6 sm:p-8 border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-8 h-8 bg-[#003b5c] text-white flex items-center justify-center">
                            <Icons.Database />
                          </div>
                          <h3 className="font-sans font-bold text-xs uppercase tracking-widest text-slate-600">
                            {isSpanish ? 'Disponibilidad de Datos y Código' : 'Data and Code Availability'}
                          </h3>
                        </div>
                        <div className="space-y-3">
                          {activePortal.dataAvailability && (
                            <div className="bg-slate-50 p-3 border border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                {isSpanish ? 'Datos' : 'Data'}
                              </p>
                              <p className="font-sans text-slate-700 text-sm">{activePortal.dataAvailability}</p>
                            </div>
                          )}
                          {activePortal.codeAvailability && (
                            <div className="bg-slate-50 p-3 border border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                {isSpanish ? 'Código' : 'Code'}
                              </p>
                              <p className="font-sans text-slate-700 text-sm">{activePortal.codeAvailability}</p>
                            </div>
                          )}
                        </div>
                      </section>
                    )}

                    {/* 8. ÉTICA */}
                    <section className="bg-white p-6 sm:p-8 border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 bg-[#003b5c] text-white flex items-center justify-center">
                          <Icons.Shield />
                        </div>
                        <h3 className="font-sans font-bold text-xs uppercase tracking-widest text-slate-600">
                          {isSpanish ? 'Ética' : 'Ethics'}
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-slate-50 p-3 border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {isSpanish ? '¿Requiere aprobación ética?' : 'Requires ethics approval?'}
                          </p>
                          <p className="font-sans text-slate-700 text-sm">
                            {activePortal.requiresEthicsApproval 
                              ? (isSpanish ? 'Sí' : 'Yes') 
                              : (isSpanish ? 'No' : 'No')}
                          </p>
                        </div>
                        {activePortal.requiresEthicsApproval && activePortal.ethicsCommitteeName && (
                          <div className="bg-slate-50 p-3 border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {isSpanish ? 'Comité de ética' : 'Ethics committee'}
                            </p>
                            <p className="font-sans text-slate-700 text-sm">{activePortal.ethicsCommitteeName}</p>
                          </div>
                        )}
                      </div>
                    </section>

                    {/* 9. USO DE IA */}
                    {activePortal.aiUsed && (
                      <section className="bg-white p-6 sm:p-8 border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-8 h-8 bg-[#003b5c] text-white flex items-center justify-center">
                            <Icons.Robot />
                          </div>
                          <h3 className="font-sans font-bold text-xs uppercase tracking-widest text-slate-600">
                            {isSpanish ? 'Uso de Inteligencia Artificial' : 'AI Usage'}
                          </h3>
                        </div>
                        {activePortal.aiTools && activePortal.aiTools.length > 0 && (
                          <div className="space-y-3">
                            {activePortal.aiTools.map((tool, idx) => (
                              <div key={idx} className="bg-slate-50 p-3 border border-slate-100">
                                <p className="font-sans font-bold text-slate-700 text-sm">{tool.name}</p>
                                <div className="grid grid-cols-2 gap-2 mt-1 text-xs">
                                  <div>
                                    <span className="text-slate-400">{isSpanish ? 'Versión:' : 'Version:'} </span>
                                    <span className="text-slate-600">{tool.version || '—'}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400">{isSpanish ? 'Propósito:' : 'Purpose:'} </span>
                                    <span className="text-slate-600">{tool.purpose || '—'}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    )}

                    {/* 10. COMENTARIO AL EDITOR */}
                    {activePortal.editorComment && (
                      <section className="bg-white p-6 sm:p-8 border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-8 h-8 bg-[#003b5c] text-white flex items-center justify-center">
                            <Icons.Email />
                          </div>
                          <h3 className="font-sans font-bold text-xs uppercase tracking-widest text-slate-600">
                            {isSpanish ? 'Comentario al Editor' : 'Comment to Editor'}
                          </h3>
                        </div>
                        <div className="bg-slate-50 p-4 border border-slate-100">
                          <div className="prose prose-sm max-w-none font-serif text-slate-700 leading-relaxed"
                               dangerouslySetInnerHTML={{ __html: activePortal.editorComment }} />
                        </div>
                      </section>
                    )}

                    {/* 11. INFORMACIÓN DE ARCHIVOS */}
                    <section className="bg-white p-6 sm:p-8 border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 bg-[#003b5c] text-white flex items-center justify-center">
                          <Icons.File />
                        </div>
                        <h3 className="font-sans font-bold text-xs uppercase tracking-widest text-slate-600">
                          {isSpanish ? 'Archivos y Documentos' : 'Files and Documents'}
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        {activePortal.originalFileName && (
                          <div className="bg-slate-50 p-3 border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {isSpanish ? 'Archivo Original' : 'Original File'}
                            </p>
                            <p className="font-mono text-xs text-slate-700 break-all">{activePortal.originalFileName}</p>
                          </div>
                        )}
                        {activePortal.originalFileSize && (
                          <div className="bg-slate-50 p-3 border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {isSpanish ? 'Tamaño' : 'Size'}
                            </p>
                            <p className="font-mono text-xs text-slate-700">
                              {(activePortal.originalFileSize / 1024).toFixed(2)} KB
                            </p>
                          </div>
                        )}
                        <div className="bg-slate-50 p-3 border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {isSpanish ? 'Estado del documento' : 'Document status'}
                          </p>
                          <span className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-mono ${
                            activePortal.documentStatus === 'processed' 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {activePortal.documentStatus === 'processed' 
                              ? (isSpanish ? 'Procesado' : 'Processed')
                              : (isSpanish ? 'Enviado' : 'Submitted')}
                          </span>
                        </div>
                      </div>
                    </section>
                  </div>
                )}

                {/* ---------------- PESTAÑA: DOCUMENTOS ---------------- */}
                {activeTab === 'documents' && (
                  <div className="space-y-6 animate-in fade-in">
                    <h2 className="font-serif text-2xl sm:text-3xl text-[#003b5c] mb-6">
                      {isSpanish ? 'Repositorio de Archivos' : 'File Repository'}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Manuscrito Principal */}
                      <div className="bg-white p-6 border border-slate-200 shadow-sm flex flex-col">
                        <div className="flex-1">
                          <span className="inline-block px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-widest mb-3">
                            {isSpanish ? 'Manuscrito Principal' : 'Main Manuscript'}
                          </span>
                          <h4 className="font-serif text-lg text-slate-800 mb-2">
                            {isSpanish ? 'Versión Actual' : 'Current Version'}
                          </h4>
                          <p className="text-xs text-slate-500 font-sans mb-6">
                            {activePortal.formattedPdfFile?.url 
                              ? (isSpanish ? 'PDF Formateado' : 'Formatted PDF')
                              : activePortal.formattedDocsFile?.url
                              ? (isSpanish ? 'Google Docs' : 'Google Docs')
                              : (isSpanish ? 'Documento Original' : 'Original Document')}
                          </p>
                        </div>
                        <button 
                          onClick={handleDownloadManuscript}
                          className="w-full py-2.5 border border-[#003b5c] text-[#003b5c] hover:bg-[#003b5c] hover:text-white transition-colors text-xs font-bold uppercase tracking-wider flex justify-center items-center gap-2"
                        >
                          <Icons.Download /> {isSpanish ? 'Descargar PDF' : 'Download PDF'}
                        </button>
                      </div>

                      {/* Docx de Revisiones */}
                      {activePortal.finalReviewDocUrl && (
                        <div className="bg-white p-6 border border-slate-200 shadow-sm flex flex-col border-l-4 border-l-[#C0A86A]">
                          <div className="flex-1">
                            <span className="inline-block px-2 py-1 bg-[#C0A86A]/20 text-[#8B7745] text-[10px] font-bold uppercase tracking-widest mb-3">
                              {isSpanish ? 'Anotaciones de Pares' : 'Peer Annotations'}
                            </span>
                            <h4 className="font-serif text-lg text-slate-800 mb-2">
                              {isSpanish ? 'Documento de Trabajo' : 'Working Document'}
                            </h4>
                            <p className="text-xs text-slate-500 font-sans mb-6">
                              {isSpanish ? 'Contiene comentarios directos de revisores (DOCX).' : 'Contains direct reviewer comments (DOCX).'}
                            </p>
                          </div>
                          <button 
                            onClick={() => window.open(getDocsExportDocxUrl(activePortal.finalReviewDocUrl), '_blank')}
                            className="w-full py-2.5 bg-[#003b5c] text-white hover:bg-[#002840] transition-colors text-xs font-bold uppercase tracking-wider flex justify-center items-center gap-2"
                          >
                            <Icons.Download /> {isSpanish ? 'Descargar DOCX' : 'Download DOCX'}
                          </button>
                        </div>
                      )}

                      {/* Consentimientos de menores */}
                      {activePortal.hasMinorAuthors && activePortal.consentFiles && activePortal.consentFiles.length > 0 && (
                        <div className="bg-white p-6 border border-slate-200 shadow-sm md:col-span-2">
                          <span className="inline-block px-2 py-1 bg-orange-100 text-orange-700 text-[10px] font-bold uppercase tracking-widest mb-4">
                            {isSpanish ? 'Consentimientos de Menores' : 'Minor Consent Forms'}
                          </span>
                          <div className="space-y-2">
                            {activePortal.consentFiles.map((consent, idx) => (
                              <div key={idx} className="flex items-center justify-between bg-slate-50 p-3 border border-slate-100">
                                <div className="flex items-center gap-2">
                                  <Icons.File />
                                  <div>
                                    <p className="text-sm font-medium text-slate-700">
                                      {consent.author || `${isSpanish ? 'Menor' : 'Minor'} ${idx + 1}`}
                                    </p>
                                    <p className="text-[10px] text-slate-400">
                                      {consent.method === 'upload' 
                                        ? (isSpanish ? 'Formulario subido' : 'Uploaded form')
                                        : (isSpanish ? 'Enviado por correo' : 'Sent by email')}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleDownloadConsent(consent)}
                                  className="text-[#003b5c] hover:text-[#C0A86A] transition-colors p-1"
                                >
                                  <Icons.Download />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ---------------- PESTAÑA: REVISIONES DE PARES ---------------- */}
                {activeTab === 'reviews' && (
                  <div className="space-y-6 animate-in fade-in">
                    <h2 className="font-serif text-2xl sm:text-3xl text-[#003b5c] mb-6">
                      {isSpanish ? 'Dictámenes de Revisión por Pares' : 'Peer Review Reports'}
                    </h2>
                    
                    {!activePortal.reviews || activePortal.reviews.length === 0 ? (
                      <div className="bg-white p-12 border border-slate-200 shadow-sm text-center">
                        <Icons.Users />
                        <p className="text-slate-500 italic font-serif mt-4">
                          {isSpanish 
                            ? 'Aún no se han recibido dictámenes de los pares revisores.' 
                            : 'No peer review reports have been received yet.'}
                        </p>
                      </div>
                    ) : (
                      activePortal.reviews.map((review, idx) => (
                        <div key={review.id || idx} className="bg-white border border-slate-200 shadow-sm p-6 sm:p-8 mb-6">
                          <div className="flex flex-wrap justify-between items-center mb-6 pb-4 border-b border-slate-100">
                            <h3 className="font-sans font-bold text-sm text-slate-400 uppercase tracking-widest">
                              {isSpanish ? `Dictamen #${idx + 1}` : `Review #${idx + 1}`} 
                              {review.round && review.round > 1 && (
                                <span className="ml-2 text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5">
                                  {isSpanish ? `Ronda ${review.round}` : `Round ${review.round}`}
                                </span>
                              )}
                            </h3>
                            {review.recommendation && (
                              <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                                review.recommendation === 'accept' ? 'bg-emerald-100 text-emerald-700' :
                                review.recommendation === 'minor-revision' ? 'bg-blue-100 text-blue-700' :
                                review.recommendation === 'major-revision' ? 'bg-amber-100 text-amber-700' :
                                'bg-rose-100 text-rose-700'
                              }`}>
                                {review.recommendation === 'accept' && (isSpanish ? 'Aceptar' : 'Accept')}
                                {review.recommendation === 'minor-revision' && (isSpanish ? 'Rev. Menor' : 'Minor Rev.')}
                                {review.recommendation === 'major-revision' && (isSpanish ? 'Rev. Mayor' : 'Major Rev.')}
                                {review.recommendation === 'reject' && (isSpanish ? 'Rechazar' : 'Reject')}
                              </span>
                            )}
                          </div>
                          
                          {/* Puntuaciones */}
                          {review.scores && Object.keys(review.scores).length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-6">
                              {Object.entries(review.scores).map(([key, val]) => (
                                <div key={key} className="text-center">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                    {key === 'originality' && (isSpanish ? 'Originalidad' : 'Originality')}
                                    {key === 'methodology' && (isSpanish ? 'Metodología' : 'Methodology')}
                                    {key === 'clarity' && (isSpanish ? 'Claridad' : 'Clarity')}
                                    {key === 'relevance' && (isSpanish ? 'Relevancia' : 'Relevance')}
                                    {key === 'overall' && (isSpanish ? 'General' : 'Overall')}
                                  </p>
                                  <p className="font-serif text-xl text-[#003b5c] font-bold">{val}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Comentarios */}
                          {review.commentsToAuthor && (
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                                {isSpanish ? 'Comentarios para el Autor' : 'Comments to Author'}
                              </p>
                              <div className="prose prose-sm max-w-none font-serif text-slate-700 leading-relaxed bg-slate-50 p-6 border border-slate-100"
                                   dangerouslySetInnerHTML={{ 
                                     __html: decodeBase64IfNeeded(review.commentsToAuthor).replace(/\n/g, '<br/>') 
                                   }} />
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* ---------------- PESTAÑA: CENTRO DE ACCIÓN ---------------- */}
                {activeTab === 'tasks' && (
                  <div className="space-y-10 animate-in fade-in">
                    <h2 className="font-serif text-2xl sm:text-3xl text-[#003b5c] mb-2">
                      {isSpanish ? 'Centro de Acción Requerida' : 'Required Action Center'}
                    </h2>
                    <p className="text-slate-500 font-sans text-sm mb-8">
                      {isSpanish 
                        ? 'Gestione las correcciones y aprobaciones solicitadas por el comité editorial.' 
                        : 'Manage corrections and approvals requested by the editorial committee.'}
                    </p>

                    {/* Tarea: Metadatos */}
                    {hasPendingMetadataProposals(activePortal) && (
                      <div className="bg-white border-2 border-amber-300 shadow-md">
                        <div className="bg-amber-50 px-6 py-4 border-b border-amber-200 flex items-center gap-3">
                          <span className="text-amber-700"><Icons.Document /></span>
                          <h3 className="font-bold text-amber-900 text-sm uppercase tracking-wider">
                            {isSpanish ? 'Tarea: Autorizar Cambios de Metadatos' : 'Task: Authorize Metadata Changes'}
                          </h3>
                        </div>
                        <div className="p-6">
                          <AuthorMetadataResponseTab
                            submission={activePortal}
                            user={user}
                            onResponded={() => {}}
                          />
                        </div>
                      </div>
                    )}

                    {/* Tarea: Subir Revisión */}
                    {needsRevisionUpload(activePortal.status) && (
                      <div className="bg-white border-2 border-[#003b5c] shadow-md">
                        <div className="bg-[#003b5c] text-white px-6 py-4 flex items-center gap-3">
                          <Icons.Inbox />
                          <h3 className="font-bold text-sm uppercase tracking-wider">
                            {isSpanish ? 'Tarea: Subir Manuscrito Corregido' : 'Task: Upload Corrected Manuscript'}
                          </h3>
                        </div>
                        
                        <div className="p-6 sm:p-8 space-y-8">
                          {/* Carga de Archivo */}
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                              1. {isSpanish ? 'Archivo Revisado' : 'Revised File'}
                            </label>
                            <p className="text-[10px] text-slate-400 mb-2">
                              {isSpanish ? 'PDF o Word (.doc, .docx) — Máx. 10MB' : 'PDF or Word (.doc, .docx) — Max. 10MB'}
                            </p>
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                              onChange={handleFileChange}
                              disabled={uploading}
                              className="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-6 file:border-0 file:text-xs file:font-bold file:uppercase file:tracking-wider file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 file:cursor-pointer file:transition-colors bg-white border border-slate-200 p-2"
                            />
                            {revisionFile && (
                              <div className="mt-3 flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs p-2 border border-emerald-200">
                                <Icons.Check />
                                <span className="font-mono">{revisionFile.name}</span>
                                <span className="text-emerald-500">
                                  ({(revisionFile.size / 1024).toFixed(2)} KB)
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Notas Breves */}
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                              2. {isSpanish ? 'Resumen Ejecutivo de Cambios' : 'Executive Summary of Changes'}
                            </label>
                            <textarea
                              value={revisionNotes}
                              onChange={(e) => setRevisionNotes(e.target.value)}
                              rows="3"
                              disabled={uploading}
                              placeholder={isSpanish 
                                ? 'Describa brevemente las alteraciones realizadas en respuesta a las revisiones...' 
                                : 'Briefly describe the changes made in response to the reviews...'}
                              className="w-full p-4 bg-white border border-slate-200 focus:ring-2 focus:ring-[#003b5c] focus:border-transparent font-serif text-sm text-slate-800 resize-none"
                            />
                          </div>

                          {/* Carta al Editor */}
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                              3. {isSpanish ? 'Carta Detallada de Respuesta' : 'Detailed Response Letter'}
                            </label>
                            <div className="border border-slate-200 bg-white">
                              <ReactQuill
                                theme="snow"
                                value={revisionComment}
                                onChange={setRevisionComment}
                                placeholder={isSpanish 
                                  ? 'Explique cómo respondió a cada revisión, justifique cambios de autoría, etc.' 
                                  : 'Explain how you responded to each review, justify authorship changes, etc.'}
                                modules={{
                                  toolbar: [
                                    [{ 'header': [1, 2, 3, false] }],
                                    ['bold', 'italic', 'underline', 'strike'],
                                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                                    ['blockquote', 'code-block'],
                                    ['link'],
                                    ['clean']
                                  ]
                                }}
                                formats={[
                                  'header', 'bold', 'italic', 'underline', 'strike',
                                  'list', 'bullet', 'blockquote', 'code-block', 'link'
                                ]}
                                readOnly={uploading}
                                style={{ height: '250px' }}
                              />
                            </div>
                          </div>

                          {/* Botón de Envío */}
                          <div className="pt-6 border-t border-slate-100 flex justify-end">
                            <button
                              onClick={handleSubmitRevision}
                              disabled={uploading || !revisionFile || !revisionNotes.trim()}
                              className="bg-[#003b5c] hover:bg-[#002840] disabled:bg-slate-300 disabled:text-slate-500 text-white px-8 py-4 text-xs font-bold uppercase tracking-widest transition-colors shadow-sm flex items-center justify-center gap-3 w-full sm:w-auto"
                            >
                              {uploading ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  {isSpanish ? 'PROCESANDO...' : 'PROCESSING...'}
                                </>
                              ) : (
                                <>
                                  <Icons.Download />
                                  {isSpanish ? 'ENVIAR VERSIÓN CORREGIDA' : 'SUBMIT CORRECTED VERSION'}
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Sin tareas pendientes */}
                    {/* Sin tareas pendientes */}
{!hasPendingMetadataProposals(activePortal) && !needsRevisionUpload(activePortal.status) && (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white border border-slate-200 shadow-sm"
  >
    <div className="p-10 sm:p-16 text-center">
      {/* Icono decorativo */}
      <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 bg-emerald-50 border border-emerald-200 mb-8">
        <Icons.CheckBadge />
      </div>
      
      {/* Título */}
      <h3 className="font-serif text-2xl sm:text-3xl text-[#003b5c] mb-4">
        {isSpanish ? 'Expediente al Día' : 'Record Up to Date'}
      </h3>
      
      {/* Línea decorativa */}
      <div className="w-16 h-px bg-[#C0A86A] mx-auto mb-6"></div>
      
      {/* Mensaje */}
      <p className="font-sans text-sm sm:text-base text-slate-500 max-w-lg mx-auto leading-relaxed">
        {isSpanish 
          ? 'El expediente se encuentra al día. No se requieren acciones de su parte en este momento. El comité editorial le notificará cuando haya novedades.'
          : 'The record is up to date. No actions are required on your part at this time. The editorial committee will notify you when there are updates.'}
      </p>
      
      {/* Información adicional */}
      <div className="mt-8 inline-flex items-center gap-2 text-xs text-slate-400 font-sans">
        <Icons.Clock />
        <span>
          {isSpanish 
            ? `Última actualización: ${activePortal.updatedAt?.toLocaleDateString?.() || activePortal.createdAt?.toLocaleDateString?.() || '—'}`
            : `Last updated: ${activePortal.updatedAt?.toLocaleDateString?.() || activePortal.createdAt?.toLocaleDateString?.() || '—'}`}
        </span>
      </div>
    </div>
  </motion.div>
)}
                  </div>
                )}

              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AuthorSubmissionsPanel;