// src/components/ArticleAssignmentPanel.js
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useLanguage } from '../hooks/useLanguage';
import { useArticleAssignment } from '../hooks/useArticleAssignment';

// ============ ICONOS SVG PROFESIONALES (Líneas finas, estilo editorial) ============
const Icons = {
  FileText: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  CheckCircle: () => (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  XCircle: () => (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  AlertCircle: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  Search: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  ),
  User: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  DocumentText: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  CurrencyDollar: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  ExclamationTriangle: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  Database: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
    </svg>
  ),
  Tag: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l5 5a2 2 0 01.586 1.414V19a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
    </svg>
  ),
  Download: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
};

const ArticleAssignmentPanel = ({ user }) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [sectionEditors, setSectionEditors] = useState([]);
  const [selectedEditor, setSelectedEditor] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para la verificación de requisitos
  const [formChecklist, setFormChecklist] = useState({
    hasAbstract: false,
    hasKeywords: false,
    hasConflictOfInterest: false,
    hasFundingInfo: false,
    hasAuthorInstitution: false,
    hasOrcid: false,
    hasDriveFiles: false,
    isSpanishEnglish: false
  });

  const { loading, error, getSectionEditors, assignToSectionEditor } = useArticleAssignment(user);

  // Escuchar envíos no asignados (status 'submitted')
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'submissions'),
      where('status', '==', 'submitted'),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const subs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || null
      }));
      setSubmissions(subs);
    }, (error) => {
      console.error('Error listening to submissions:', error);
    });

    return () => unsubscribe();
  }, [user]);

  // Cargar la lista de editores de sección al montar el componente
  useEffect(() => {
    let isMounted = true;
    
    const loadEditors = async () => {
      const result = await getSectionEditors();
      if (isMounted && result.success) {
        setSectionEditors(result.editors);
      }
    };
    
    loadEditors();
    
    return () => {
      isMounted = false;
    };
  }, [getSectionEditors]);

  // Actualizar checklist cuando cambia el submission seleccionado
  useEffect(() => {
    if (selectedSubmission) {
      const sub = selectedSubmission;
      setFormChecklist({
        hasAbstract: !!(sub.abstract || sub.abstractEn),
        hasKeywords: !!(sub.keywords?.length > 0 || sub.keywordsEn?.length > 0),
        hasConflictOfInterest: !!sub.conflictOfInterest,
        hasFundingInfo: sub.funding ? true : false,
        hasAuthorInstitution: !!(sub.authors?.[0]?.institution),
        hasOrcid: !!(sub.authors?.[0]?.orcid),
        hasDriveFiles: !!(sub.driveFolderUrl),
        isSpanishEnglish: !!(sub.abstract && sub.abstractEn) // Tiene ambos idiomas
      });
    }
  }, [selectedSubmission]);

  const handleAssign = async () => {
    if (!selectedSubmission || !selectedEditor) {
      alert(isSpanish ? 'Debes seleccionar un artículo y un editor' : 'You must select an article and an editor');
      return;
    }

    setIsAssigning(true);
    const result = await assignToSectionEditor(selectedSubmission.id, selectedEditor, assignmentNotes);
    if (result.success) {
      // Limpiar selección
      setSelectedSubmission(null);
      setSelectedEditor('');
      setAssignmentNotes('');
      alert(isSpanish ? 'Artículo asignado correctamente' : 'Article assigned successfully');
    }
    setIsAssigning(false);
  };

  // Filtrar editores por búsqueda
  const filteredEditors = sectionEditors.filter(editor => {
    const searchLower = searchTerm.toLowerCase();
    return (
      editor.displayName?.toLowerCase().includes(searchLower) ||
      editor.email?.toLowerCase().includes(searchLower) ||
      editor.institution?.toLowerCase().includes(searchLower)
    );
  });

  // Verificar permisos
  const userRoles = user?.roles || [];
  if (!userRoles.includes('Encargado de Asignación de Artículos') && !userRoles.includes('Director General')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-sans text-slate-800 selection:bg-blue-100">
      
      {/* ===================== TOP NAVIGATION (EDITORIAL RIBBON) ===================== */}
      <header className="bg-[#002B49] text-white sticky top-0 z-40 border-b border-slate-200 shadow-sm">
        <div className="max-w-[1920px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="hidden sm:flex w-9 h-9 items-center justify-center text-white border border-white/20 rounded-sm">
              <Icons.FileText />
            </div>
            <div>
              <p className="text-[10px] font-medium text-white/70 uppercase tracking-[0.15em] mb-0.5">
                {isSpanish ? 'Gestión Editorial' : 'Editorial Management'}
              </p>
              <h1 className="font-serif text-lg sm:text-xl text-white font-normal tracking-wide">
                {isSpanish ? 'Recepción Editorial' : 'Editorial Reception'}
              </h1>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-sm text-white font-medium">
              {user?.displayName || user?.email}
            </p>
            <p className="text-[11px] text-white/60 font-mono mt-0.5">
              {isSpanish ? 'ENCARGADO DE ASIGNACIÓN' : 'ASSIGNMENT MANAGER'}
            </p>
          </div>
        </div>
      </header>

      {/* ===================== MAIN CONTENT WORKSPACE ===================== */}
      <main className="max-w-[1920px] mx-auto px-6 py-6">
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 mb-6 flex items-center gap-3 rounded-sm text-sm">
            <Icons.AlertCircle />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          
          {/* ===================== SIDEBAR: ARTICLE LIST ===================== */}
          <aside className="w-full lg:w-96 flex-shrink-0 bg-white border border-slate-200 flex flex-col rounded-sm shadow-sm">
            
            <div className="bg-[#F8FAFC] border-b border-slate-200 px-5 py-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                {isSpanish ? 'Artículos Recibidos' : 'Received Articles'}
              </h3>
              <span className="text-slate-500 text-[11px] font-mono">
                {submissions.length} {isSpanish ? 'artículos' : 'articles'}
              </span>
            </div>

            <div className="flex-1 max-h-[65vh] lg:max-h-[calc(100vh-210px)] overflow-y-auto custom-scrollbar">
              {submissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                  <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                  </svg>
                  <p className="font-serif text-slate-500 mt-4 text-base">
                    {isSpanish ? 'No hay artículos pendientes.' : 'No articles pending.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {submissions.map(sub => (
                    <div
                      key={sub.id}
                      onClick={() => setSelectedSubmission(sub)}
                      className={`p-5 cursor-pointer transition-colors relative border-b border-slate-50 ${
                        selectedSubmission?.id === sub.id
                          ? 'bg-[#F4F7F9] border-l-4 border-l-[#007398]'
                          : 'bg-white border-l-4 border-l-transparent hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-sm">
                          {sub.submissionId?.slice(0, 8)}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 bg-slate-50 text-slate-600 border border-slate-200 font-bold uppercase tracking-wider rounded-sm">
                          {sub.area || 'General'}
                        </span>
                      </div>
                      
                      <h4 className="font-serif text-[13px] leading-relaxed mb-2 text-[#002B49]">
                        {isSpanish ? sub.title : sub.titleEn || sub.title}
                      </h4>
                      
                      <p className="text-xs text-slate-500 truncate">
                        {sub.authorName || '—'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>

          {/* ===================== MAIN PANEL: WORKSPACE ===================== */}
          <section className="flex-1 min-h-0 min-w-0">
            <AnimatePresence mode="wait">
              {selectedSubmission ? (
                <motion.div
                  key="assignment"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  {/* ENCABEZADO con título e IDs */}
                  <div className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden">
                    <div className="bg-[#002B49] text-white px-6 py-5">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <span className="inline-block px-2.5 py-1 bg-[#007398] text-white text-[10px] font-mono rounded-sm mb-3">
                            {selectedSubmission.submissionId || 'Sin ID'}
                          </span>
                          <h2 className="font-serif text-xl font-normal mb-2 tracking-wide leading-relaxed">
                            {isSpanish ? selectedSubmission.title : selectedSubmission.titleEn || selectedSubmission.title}
                          </h2>
                          <p className="text-white/70 text-xs font-sans">
                            <span>{selectedSubmission.area || '—'}</span>
                            <span className="mx-2">•</span>
                            <span>
                              {selectedSubmission.createdAt 
                                ? new Date(selectedSubmission.createdAt).toLocaleDateString() 
                                : '—'}
                            </span>
                          </p>
                        </div>
                        {selectedSubmission.driveFolderUrl && (
                          <a 
                            href={selectedSubmission.driveFolderUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-sm transition-colors text-xs font-medium whitespace-nowrap ml-4"
                          >
                            <Icons.Download />
                            {isSpanish ? 'Ver en Drive' : 'View in Drive'}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* CHECKLIST DE REQUISITOS FORMALES */}
                  <div className="bg-white border border-slate-200 rounded-sm shadow-sm p-6">
                    <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="text-[#007398]"><Icons.CheckCircle /></span>
                      {isSpanish ? 'Verificación de Requisitos Formales' : 'Formal Requirements Checklist'}
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { key: 'hasAbstract', label: isSpanish ? 'Resumen' : 'Abstract' },
                        { key: 'hasKeywords', label: isSpanish ? 'Palabras clave' : 'Keywords' },
                        { key: 'hasConflictOfInterest', label: isSpanish ? 'Conflicto de intereses' : 'Conflict of interest' },
                        { key: 'hasFundingInfo', label: isSpanish ? 'Financiamiento' : 'Funding' },
                        { key: 'hasAuthorInstitution', label: isSpanish ? 'Institución autor' : 'Author institution' },
                        { key: 'hasOrcid', label: 'ORCID' },
                        { key: 'hasDriveFiles', label: isSpanish ? 'Archivos adjuntos' : 'Attached files' },
                        { key: 'isSpanishEnglish', label: isSpanish ? 'Resumen bilingüe' : 'Bilingual abstract' }
                      ].map(item => (
                        <div 
                          key={item.key}
                          className={`p-3 rounded-sm border text-xs font-medium flex items-center gap-2 ${
                            formChecklist[item.key]
                              ? 'bg-[#EBF4F7] border-[#007398]/20 text-[#004B7F]'
                              : 'bg-red-50 border-red-200 text-red-700'
                          }`}
                        >
                          {formChecklist[item.key] ? (
                            <Icons.CheckCircle />
                          ) : (
                            <Icons.XCircle />
                          )}
                          <span>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* INFORMACIÓN DEL AUTOR PRINCIPAL */}
                  <div className="bg-white border border-slate-200 rounded-sm shadow-sm p-6">
                    <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="text-[#007398]"><Icons.User /></span>
                      {isSpanish ? 'Autor Principal' : 'Corresponding Author'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          {isSpanish ? 'Nombre' : 'Name'}
                        </label>
                        <p className="text-sm text-slate-800 font-medium">{selectedSubmission.authorName || '—'}</p>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Email
                        </label>
                        <p className="text-sm text-slate-800 font-medium">{selectedSubmission.authorEmail || '—'}</p>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          ORCID
                        </label>
                        <p className="text-sm text-slate-800 font-medium">{selectedSubmission.authors?.[0]?.orcid || '—'}</p>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          {isSpanish ? 'Institución' : 'Institution'}
                        </label>
                        <p className="text-sm text-slate-800 font-medium">{selectedSubmission.authors?.[0]?.institution || '—'}</p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          {isSpanish ? 'Contribución' : 'Contribution'}
                        </label>
                        <p className="text-sm text-slate-800 font-medium">{selectedSubmission.authors?.[0]?.contribution || '—'}</p>
                      </div>
                    </div>
                  </div>

                  {/* RESUMEN (Abstract) - Bilingüe */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white border border-slate-200 rounded-sm shadow-sm p-6">
                      <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <span className="text-[#007398]"><Icons.DocumentText /></span>
                        {isSpanish ? 'Resumen' : 'Abstract'} (ES)
                      </h3>
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-serif">
                        {selectedSubmission.abstract || '—'}
                      </p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-sm shadow-sm p-6">
                      <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <span className="text-[#007398]"><Icons.DocumentText /></span>
                        {isSpanish ? 'Resumen' : 'Abstract'} (EN)
                      </h3>
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-serif">
                        {selectedSubmission.abstractEn || selectedSubmission.abstract || '—'}
                      </p>
                    </div>
                  </div>

                  {/* PALABRAS CLAVE Y FINANCIAMIENTO */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white border border-slate-200 rounded-sm shadow-sm p-6">
                      <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <span className="text-[#007398]"><Icons.Tag /></span>
                        {isSpanish ? 'Palabras Clave' : 'Keywords'}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {(isSpanish ? selectedSubmission.keywords : selectedSubmission.keywordsEn || selectedSubmission.keywords)?.map((keyword, index) => (
                          <span key={index} className="px-2.5 py-1 bg-[#F5F7F9] border border-slate-200 text-slate-700 rounded-sm text-xs">
                            {keyword}
                          </span>
                        )) || <span className="text-slate-400 text-sm">—</span>}
                      </div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-sm shadow-sm p-6">
                      <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <span className="text-[#007398]"><Icons.CurrencyDollar /></span>
                        {isSpanish ? 'Financiamiento' : 'Funding'}
                      </h3>
                      {selectedSubmission.funding?.hasFunding ? (
                        <div className="space-y-2">
                          <p className="text-sm text-slate-800 font-medium">{selectedSubmission.funding.sources || '—'}</p>
                          <p className="text-xs text-slate-500">Grant: {selectedSubmission.funding.grantNumbers || '—'}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400 italic">{isSpanish ? 'Sin financiamiento' : 'No funding'}</p>
                      )}
                    </div>
                  </div>

                  {/* CONFLICTO DE INTERESES Y DISPONIBILIDAD */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white border border-slate-200 rounded-sm shadow-sm p-6">
                      <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <span className="text-[#007398]"><Icons.ExclamationTriangle /></span>
                        {isSpanish ? 'Conflicto de Intereses' : 'Conflict of Interest'}
                      </h3>
                      <p className="text-sm text-slate-700 leading-relaxed">{selectedSubmission.conflictOfInterest || '—'}</p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-sm shadow-sm p-6">
                      <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <span className="text-[#007398]"><Icons.Database /></span>
                        {isSpanish ? 'Disponibilidad de Datos' : 'Data Availability'}
                      </h3>
                      <p className="text-sm text-slate-700">
                        {isSpanish 
                          ? (selectedSubmission.dataAvailability === 'available' ? 'Disponible' : 
                             selectedSubmission.dataAvailability === 'upon_request' ? 'Bajo solicitud' : 'No disponible')
                          : (selectedSubmission.dataAvailability === 'available' ? 'Available' : 
                             selectedSubmission.dataAvailability === 'upon_request' ? 'Upon request' : 'Not available')
                        }
                      </p>
                    </div>
                  </div>

                  {/* SECCIÓN DE ASIGNACIÓN */}
                  <div className="bg-white border border-slate-200 rounded-sm shadow-sm p-6 mt-6">
                    <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-4">
                      {isSpanish ? 'Asignar a Editor de Sección' : 'Assign to Section Editor'}
                    </h3>
                    
                    {/* Búsqueda de editor */}
                    <div className="relative mb-4">
                      <div className="flex items-center gap-2 bg-[#F5F7F9] border border-slate-200 px-3 py-2 focus-within:border-[#007398] focus-within:bg-white transition-colors rounded-sm">
                        <span className="text-slate-400"><Icons.Search /></span>
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder={isSpanish ? 'Buscar editor por nombre, email o institución...' : 'Search editor by name, email or institution...'}
                          className="bg-transparent border-none outline-none text-xs w-full text-slate-700 font-medium placeholder-slate-400"
                        />
                      </div>
                    </div>

                    {/* Lista de editores */}
                    <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-1 border border-slate-200 rounded-sm p-1 mb-4">
                      {filteredEditors.length === 0 ? (
                        <p className="text-center text-slate-400 py-8 text-sm">
                          {searchTerm 
                            ? (isSpanish ? 'No hay resultados' : 'No results')
                            : (isSpanish ? 'No hay editores de sección disponibles' : 'No section editors available')}
                        </p>
                      ) : (
                        filteredEditors.map(editor => (
                          <div
                            key={editor.uid}
                            onClick={() => setSelectedEditor(editor.uid)}
                            className={`p-3 rounded-sm cursor-pointer transition-colors ${
                              selectedEditor === editor.uid
                                ? 'bg-[#F4F7F9] border-l-4 border-l-[#007398]'
                                : 'bg-[#F8FAFC] hover:bg-slate-50 border-l-4 border-l-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-[#002B49] rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-sm font-serif font-bold text-white">
                                  {editor.displayName?.charAt(0) || '?'}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-slate-800 truncate">
                                  {editor.displayName}
                                </div>
                                <div className="text-xs text-slate-500 truncate">
                                  {editor.email}
                                </div>
                                {editor.institution && (
                                  <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                                    {editor.institution}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Notas de asignación */}
                    <div className="mb-4">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                        {isSpanish ? 'Notas para el editor (opcional)' : 'Notes for the editor (optional)'}
                      </label>
                      <textarea
                        value={assignmentNotes}
                        onChange={(e) => setAssignmentNotes(e.target.value)}
                        rows="3"
                        className="w-full p-3 bg-[#F5F7F9] border border-slate-200 rounded-sm focus:border-[#007398] focus:bg-white transition-colors outline-none text-xs text-slate-700 placeholder-slate-400 resize-none"
                        placeholder={isSpanish ? 'Ej: Revisar especialmente la metodología...' : 'E.g.: Pay special attention to the methodology...'}
                      />
                    </div>

                    {/* Botón de asignación */}
                    <button
                      onClick={handleAssign}
                      disabled={loading || isAssigning || !selectedEditor}
                      className="w-full py-3 bg-[#002B49] hover:bg-[#003b5c] text-white text-[10px] uppercase tracking-widest font-bold rounded-sm transition-all disabled:bg-slate-200 disabled:text-slate-400"
                    >
                      {loading || isAssigning ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          {isSpanish ? 'ASIGNANDO...' : 'ASSIGNING...'}
                        </span>
                      ) : (
                        isSpanish ? 'ASIGNAR ARTÍCULO' : 'ASSIGN ARTICLE'
                      )}
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="no-selection"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="bg-white border border-slate-200 rounded-sm shadow-sm flex flex-col items-center justify-center py-32 px-8 h-[calc(100vh-210px)]"
                >
                  <div className="w-16 h-16 bg-[#F8FAFC] border border-slate-200 rounded-full flex items-center justify-center mb-6 text-slate-400">
                    <Icons.FileText />
                  </div>
                  <h3 className="text-xl font-serif text-[#002B49] mb-3 text-center tracking-wide">
                    {isSpanish ? 'Área de Trabajo Editorial' : 'Editorial Workspace'}
                  </h3>
                  <div className="w-8 h-[1px] bg-[#007398] mb-4"></div>
                  <p className="text-slate-500 text-center max-w-sm font-sans text-sm leading-relaxed">
                    {isSpanish 
                      ? 'Seleccione un artículo del panel izquierdo para verificar requisitos formales y asignarlo a un Editor de Sección.'
                      : 'Select an article from the left panel to verify formal requirements and assign it to a Section Editor.'}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </div>
      </main>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        
        .overflow-x-auto {
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .overflow-x-auto::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default ArticleAssignmentPanel;