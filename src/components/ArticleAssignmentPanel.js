// src/components/ArticleAssignmentPanel.js
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useLanguage } from '../hooks/useLanguage';
import { useArticleAssignment } from '../hooks/useArticleAssignment';

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
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 max-w-7xl mx-auto font-serif">
      <h2 className="font-['Playfair_Display'] text-4xl font-bold text-[#0A1929] mb-2 tracking-tight">
        {isSpanish ? 'Recepción Editorial' : 'Editorial Reception'}
      </h2>
      <p className="text-[#5A6B7A] font-['Lora'] text-lg mb-8 border-b border-[#E5E9F0] pb-4">
        {isSpanish ? 'Asignación de artículos a Editores de Sección' : 'Article assignment to Section Editors'}
      </p>

      {error && (
        <div className="bg-[#FEF2F2] border-l-4 border-[#991B1B] text-[#991B1B] p-4 rounded-lg mb-6 font-['Lora']">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Lista de artículos recibidos */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="font-['Playfair_Display'] text-lg font-semibold text-[#0A1929] border-b-2 border-[#C0A86A] pb-2 mb-4">
            {isSpanish ? 'Artículos Recibidos' : 'Received Articles'} ({submissions.length})
          </h3>
          {submissions.length === 0 ? (
            <div className="bg-[#F5F7FA] rounded-xl p-8 text-center border border-[#E5E9F0]">
              <p className="text-[#5A6B7A] font-['Lora'] italic">
                {isSpanish ? 'No hay artículos pendientes de asignación' : 'No articles pending assignment'}
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {submissions.map(sub => (
                <motion.div
                  key={sub.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => setSelectedSubmission(sub)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedSubmission?.id === sub.id
                      ? 'border-[#C0A86A] bg-[#FBF9F3]'
                      : 'border-[#E5E9F0] hover:border-[#C0A86A] bg-white hover:shadow-md'
                  }`}
                >
                  <h4 className="font-['Playfair_Display'] font-bold text-[#0A1929] mb-2 line-clamp-2">
                    {isSpanish ? sub.title : sub.titleEn || sub.title}
                  </h4>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-[#5A6B7A]">{sub.submissionId?.slice(0, 8)}</span>
                    <span className="px-2 py-1 bg-[#E8F0FE] text-[#1E4A7A] rounded-full">
                      {sub.area}
                    </span>
                  </div>
                  <p className="text-xs text-[#5A6B7A] mt-2 truncate">
                    {sub.authorName}
                  </p>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Panel de trabajo */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {selectedSubmission ? (
              <motion.div
                key="assignment"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6 max-h-[600px] overflow-y-auto pr-2"
              >
                {/* ENCABEZADO con título e IDs */}
                <div className="bg-gradient-to-r from-[#0A1929] to-[#1E2F40] text-white rounded-xl p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="inline-block px-3 py-1 bg-[#C0A86A] text-[#0A1929] text-xs font-bold rounded-full mb-3">
                        {selectedSubmission.submissionId || 'Sin ID'}
                      </span>
                      <h2 className="font-['Playfair_Display'] text-2xl font-bold mb-2">
                        {isSpanish ? selectedSubmission.title : selectedSubmission.titleEn || selectedSubmission.title}
                      </h2>
                      <p className="text-[#E5E9F0] text-sm">
                        {isSpanish ? 'Área:' : 'Area:'} {selectedSubmission.area || '—'} • 
                        {isSpanish ? ' Recibido:' : ' Received:'} {
                          selectedSubmission.createdAt 
                            ? new Date(selectedSubmission.createdAt).toLocaleDateString() 
                            : '—'
                        }
                      </p>
                    </div>
                    <a 
                      href={selectedSubmission.driveFolderUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors text-sm whitespace-nowrap"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {isSpanish ? 'Ver archivos en Drive' : 'View files in Drive'}
                    </a>
                  </div>
                </div>

                {/* CHECKLIST DE REQUISITOS FORMALES */}
                <div className="bg-[#F5F7FA] rounded-xl p-6 border border-[#E5E9F0]">
                  <h3 className="font-['Playfair_Display'] font-bold text-[#0A1929] text-lg mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-[#C0A86A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
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
                        className={`p-3 rounded-lg border ${
                          formChecklist[item.key]
                            ? 'bg-green-50 border-green-200 text-green-700'
                            : 'bg-red-50 border-red-200 text-red-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {formChecklist[item.key] ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                          <span className="text-xs font-medium">{item.label}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* INFORMACIÓN DEL AUTOR PRINCIPAL */}
                <div className="bg-[#F5F7FA] rounded-xl p-6 border border-[#E5E9F0]">
                  <h3 className="font-['Playfair_Display'] font-bold text-[#0A1929] text-lg mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-[#C0A86A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    {isSpanish ? 'Autor Principal' : 'Corresponding Author'}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-[#5A6B7A] uppercase tracking-wider mb-1">
                        {isSpanish ? 'Nombre' : 'Name'}
                      </label>
                      <p className="text-[#0A1929] font-medium">{selectedSubmission.authorName || '—'}</p>
                    </div>
                    <div>
                      <label className="block text-xs text-[#5A6B7A] uppercase tracking-wider mb-1">
                        Email
                      </label>
                      <p className="text-[#0A1929] font-medium">{selectedSubmission.authorEmail || '—'}</p>
                    </div>
                    <div>
                      <label className="block text-xs text-[#5A6B7A] uppercase tracking-wider mb-1">
                        ORCID
                      </label>
                      <p className="text-[#0A1929] font-medium">{selectedSubmission.authors?.[0]?.orcid || '—'}</p>
                    </div>
                    <div>
                      <label className="block text-xs text-[#5A6B7A] uppercase tracking-wider mb-1">
                        {isSpanish ? 'Institución' : 'Institution'}
                      </label>
                      <p className="text-[#0A1929] font-medium">{selectedSubmission.authors?.[0]?.institution || '—'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs text-[#5A6B7A] uppercase tracking-wider mb-1">
                        {isSpanish ? 'Contribución' : 'Contribution'}
                      </label>
                      <p className="text-[#0A1929] font-medium">{selectedSubmission.authors?.[0]?.contribution || '—'}</p>
                    </div>
                  </div>
                </div>

                {/* RESUMEN (Abstract) - Bilingüe */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#F5F7FA] rounded-xl p-6 border border-[#E5E9F0]">
                    <h3 className="font-['Playfair_Display'] font-bold text-[#0A1929] text-lg mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5 text-[#C0A86A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {isSpanish ? 'Resumen' : 'Abstract'} (ES)
                    </h3>
                    <p className="text-[#0A1929] text-sm leading-relaxed whitespace-pre-wrap">
                      {selectedSubmission.abstract || '—'}
                    </p>
                  </div>
                  <div className="bg-[#F5F7FA] rounded-xl p-6 border border-[#E5E9F0]">
                    <h3 className="font-['Playfair_Display'] font-bold text-[#0A1929] text-lg mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5 text-[#C0A86A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {isSpanish ? 'Resumen' : 'Abstract'} (EN)
                    </h3>
                    <p className="text-[#0A1929] text-sm leading-relaxed whitespace-pre-wrap">
                      {selectedSubmission.abstractEn || selectedSubmission.abstract || '—'}
                    </p>
                  </div>
                </div>

                {/* PALABRAS CLAVE Y FINANCIAMIENTO */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#F5F7FA] rounded-xl p-6 border border-[#E5E9F0]">
                    <h3 className="font-['Playfair_Display'] font-bold text-[#0A1929] text-lg mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5 text-[#C0A86A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l5 5a2 2 0 01.586 1.414V19a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
                      </svg>
                      {isSpanish ? 'Palabras Clave' : 'Keywords'}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {(isSpanish ? selectedSubmission.keywords : selectedSubmission.keywordsEn || selectedSubmission.keywords)?.map((keyword, index) => (
                        <span key={index} className="px-3 py-1 bg-white border border-[#C0A86A] text-[#0A1929] rounded-full text-sm">
                          {keyword}
                        </span>
                      )) || '—'}
                    </div>
                  </div>
                  <div className="bg-[#F5F7FA] rounded-xl p-6 border border-[#E5E9F0]">
                    <h3 className="font-['Playfair_Display'] font-bold text-[#0A1929] text-lg mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5 text-[#C0A86A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {isSpanish ? 'Financiamiento' : 'Funding'}
                    </h3>
                    {selectedSubmission.funding?.hasFunding ? (
                      <div className="space-y-2">
                        <p className="text-[#0A1929] font-medium">{selectedSubmission.funding.sources || '—'}</p>
                        <p className="text-sm text-[#5A6B7A]">Grant: {selectedSubmission.funding.grantNumbers || '—'}</p>
                      </div>
                    ) : (
                      <p className="text-[#5A6B7A] italic">{isSpanish ? 'Sin financiamiento' : 'No funding'}</p>
                    )}
                  </div>
                </div>

                {/* CONFLICTO DE INTERESES Y DISPONIBILIDAD */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#F5F7FA] rounded-xl p-6 border border-[#E5E9F0]">
                    <h3 className="font-['Playfair_Display'] font-bold text-[#0A1929] text-lg mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5 text-[#C0A86A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      {isSpanish ? 'Conflicto de Intereses' : 'Conflict of Interest'}
                    </h3>
                    <p className="text-[#0A1929]">{selectedSubmission.conflictOfInterest || '—'}</p>
                  </div>
                  <div className="bg-[#F5F7FA] rounded-xl p-6 border border-[#E5E9F0]">
                    <h3 className="font-['Playfair_Display'] font-bold text-[#0A1929] text-lg mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5 text-[#C0A86A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                      </svg>
                      {isSpanish ? 'Disponibilidad de Datos' : 'Data Availability'}
                    </h3>
                    <p className="text-[#0A1929]">
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
                <div className="mt-8 pt-6 border-t-2 border-[#E5E9F0]">
                  <h3 className="font-['Playfair_Display'] font-bold text-[#0A1929] text-lg mb-4">
                    {isSpanish ? 'Asignar a Editor de Sección' : 'Assign to Section Editor'}
                  </h3>
                  
                  {/* Búsqueda de editor */}
                  <div className="relative mb-4">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder={isSpanish ? 'Buscar editor por nombre, email o institución...' : 'Search editor by name, email or institution...'}
                      className="w-full p-4 pl-12 bg-[#F5F7FA] border border-[#E5E9F0] rounded-xl focus:ring-2 focus:ring-[#C0A86A] focus:border-transparent font-['Lora']"
                    />
                    <svg className="w-5 h-5 text-[#5A6B7A] absolute left-4 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>

                  {/* Lista de editores */}
                  <div className="max-h-80 overflow-y-auto space-y-2 border border-[#E5E9F0] rounded-xl p-2 mb-4">
                    {filteredEditors.length === 0 ? (
                      <p className="text-center text-[#5A6B7A] py-8 font-['Lora'] italic">
                        {searchTerm 
                          ? (isSpanish ? 'No hay resultados' : 'No results')
                          : (isSpanish ? 'No hay editores de sección disponibles' : 'No section editors available')}
                      </p>
                    ) : (
                      filteredEditors.map(editor => (
                        <motion.div
                          key={editor.uid}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          onClick={() => setSelectedEditor(editor.uid)}
                          className={`p-4 rounded-xl cursor-pointer transition-all ${
                            selectedEditor === editor.uid
                              ? 'bg-[#FBF9F3] border-2 border-[#C0A86A]'
                              : 'bg-[#F5F7FA] hover:bg-[#E8F0FE] border-2 border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#0A1929] rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-xl font-['Playfair_Display'] font-bold text-white">
                                {editor.displayName?.charAt(0) || '?'}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-['Playfair_Display'] font-bold text-[#0A1929] truncate">
                                {editor.displayName}
                              </div>
                              <div className="text-sm text-[#5A6B7A] font-['Lora'] truncate">
                                {editor.email}
                              </div>
                              {editor.institution && (
                                <div className="text-xs text-[#5A6B7A] mt-1 font-['Lora']">
                                  {editor.institution}
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>

                  {/* Notas de asignación */}
                  <div className="mb-4">
                    <label className="block font-['Playfair_Display'] font-semibold text-[#0A1929] mb-3">
                      {isSpanish ? 'Notas para el editor (opcional)' : 'Notes for the editor (optional)'}
                    </label>
                    <textarea
                      value={assignmentNotes}
                      onChange={(e) => setAssignmentNotes(e.target.value)}
                      rows="3"
                      className="w-full p-4 bg-[#F5F7FA] border border-[#E5E9F0] rounded-xl focus:ring-2 focus:ring-[#C0A86A] focus:border-transparent font-['Lora'] text-sm"
                      placeholder={isSpanish ? 'Ej: Revisar especialmente la metodología...' : 'E.g.: Pay special attention to the methodology...'}
                    />
                  </div>

                  {/* Botón de asignación */}
                  <button
                    onClick={handleAssign}
                    disabled={loading || isAssigning || !selectedEditor}
                    className="w-full py-4 bg-[#0A1929] hover:bg-[#1E2F40] text-white font-['Playfair_Display'] font-bold rounded-xl transition-all disabled:bg-[#E5E9F0] disabled:text-[#5A6B7A]"
                  >
                    {loading || isAssigning ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
                className="flex flex-col items-center justify-center h-96 bg-[#F5F7FA] rounded-xl border-2 border-dashed border-[#E5E9F0]"
              >
                <svg className="w-16 h-16 text-[#C0A86A] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-[#5A6B7A] text-lg font-['Lora'] italic">
                  {isSpanish 
                    ? 'Selecciona un artículo para verificar requisitos y asignar' 
                    : 'Select an article to verify requirements and assign'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ArticleAssignmentPanel;