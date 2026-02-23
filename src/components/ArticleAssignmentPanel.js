// src/components/ArticleAssignmentPanel.js
import React, { useState, useEffect, useCallback } from 'react';
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

  const { loading, error, getUnassignedSubmissions, getSectionEditors, assignToSectionEditor } = useArticleAssignment(user);

  // CORRECCIÓN 1: Memoizar la función loadEditors
  const loadEditors = useCallback(async () => {
    const result = await getSectionEditors();
    if (result.success) {
      setSectionEditors(result.editors);
    }
  }, [getSectionEditors]); // getSectionEditors sigue siendo una dependencia

  // CORRECCIÓN 2: Separar la carga de editores en un useEffect independiente
  // con una referencia para evitar el bucle infinito
  useEffect(() => {
    let isMounted = true;
    
    const loadEditorsIfNeeded = async () => {
      const result = await getSectionEditors();
      if (isMounted && result.success) {
        setSectionEditors(result.editors);
      }
    };
    
    loadEditorsIfNeeded();
    
    return () => {
      isMounted = false;
    };
  }, []); // <-- QUITAMOS getSectionEditors de las dependencias

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
        isSpanishEnglish: !!(sub.abstract && sub.abstractEn)
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
            {isSpanish ? 'Artículos Recibidos' : 'Received Articles'}
          </h3>
          {submissions.length === 0 ? (
            <div className="bg-[#F5F7FA] rounded-xl p-8 text-center border border-[#E5E9F0]">
              <p className="text-[#5A6B7A] font-['Lora'] italic">
                {isSpanish ? 'No hay artículos pendientes de asignación' : 'No articles pending assignment'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
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
                    {sub.title}
                  </h4>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-[#5A6B7A]">{sub.submissionId?.slice(0, 8)}</span>
                    <span className="px-2 py-1 bg-[#E8F0FE] text-[#1E4A7A] rounded-full">
                      {sub.area}
                    </span>
                  </div>
                  <p className="text-xs text-[#5A6B7A] mt-2">
                    {isSpanish ? 'Autor:' : 'Author:'} {sub.authorName}
                  </p>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Panel de asignación */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {selectedSubmission ? (
              <motion.div
                key="assignment"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* Detalles del artículo */}
                <div className="bg-[#F5F7FA] rounded-xl p-6 border border-[#E5E9F0]">
                  <h3 className="font-['Playfair_Display'] text-2xl font-bold text-[#0A1929] mb-3">
                    {selectedSubmission.title}
                  </h3>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="px-3 py-1 bg-[#0A1929] text-white text-xs rounded-full">
                      {selectedSubmission.submissionId}
                    </span>
                    <span className="px-3 py-1 bg-[#C0A86A] text-white text-xs rounded-full">
                      {selectedSubmission.area}
                    </span>
                  </div>
                  <p className="text-sm text-[#5A6B7A] mb-4 line-clamp-3">
                    {selectedSubmission.abstract}
                  </p>
                  <a 
                    href={selectedSubmission.driveFolderUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-[#C0A86A] hover:text-[#A58D4F] font-medium transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {isSpanish ? 'Ver documentos en Drive' : 'View documents in Drive'}
                  </a>
                </div>

                {/* Búsqueda y selección de editor */}
                <div>
                  <label className="block font-['Playfair_Display'] font-semibold text-[#0A1929] mb-3">
                    {isSpanish ? 'Asignar a Editor de Sección' : 'Assign to Section Editor'}
                  </label>
                  
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
                    ? 'Selecciona un artículo para asignar' 
                    : 'Select an article to assign'}
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