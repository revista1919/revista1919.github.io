// src/components/AuthorSubmissionsPanel.js (VERSIÓN CORREGIDA)
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { useLanguage } from '../hooks/useLanguage';

const SUBMISSION_STATES = {
  'submitted': { 
    es: 'Enviado', 
    en: 'Submitted',
    color: 'bg-blue-100 text-blue-700',
    icon: '📤',
    description: { 
      es: 'Tu artículo ha sido recibido y está en espera de revisión editorial',
      en: 'Your article has been received and is awaiting editorial review'
    }
  },
  'in-desk-review': { 
    es: 'En revisión editorial', 
    en: 'In desk review',
    color: 'bg-purple-100 text-purple-700',
    icon: '🔍',
    description: { 
      es: 'Un editor está revisando tu artículo',
      en: 'An editor is reviewing your article'
    }
  },
  'desk-review-rejected': { 
    es: 'Rechazado en revisión editorial', 
    en: 'Rejected in desk review',
    color: 'bg-red-100 text-red-700',
    icon: '❌',
    description: { 
      es: 'El artículo no pasó la revisión editorial inicial',
      en: 'The article did not pass initial editorial review'
    }
  },
  'in-reviewer-selection': { 
    es: 'Seleccionando revisores', 
    en: 'Selecting reviewers',
    color: 'bg-yellow-100 text-yellow-700',
    icon: '👥',
    description: { 
      es: 'El equipo editorial está seleccionando revisores para tu artículo',
      en: 'The editorial team is selecting reviewers for your article'
    }
  },
  'awaiting-reviewer-responses': { 
    es: 'Esperando respuesta de revisores', 
    en: 'Awaiting reviewer responses',
    color: 'bg-orange-100 text-orange-700',
    icon: '⏳',
    description: { 
      es: 'Los revisores están decidiendo si aceptan revisar tu artículo',
      en: 'Reviewers are deciding whether to accept reviewing your article'
    }
  },
  'in-peer-review': { 
    es: 'En revisión por pares', 
    en: 'In peer review',
    color: 'bg-indigo-100 text-indigo-700',
    icon: '📝',
    description: { 
      es: 'Los revisores están evaluando tu artículo',
      en: 'Reviewers are evaluating your article'
    }
  },
  'minor-revision-required': { 
    es: 'Revisiones menores requeridas', 
    en: 'Minor revisions required',
    color: 'bg-yellow-100 text-yellow-700',
    icon: '✏️',
    description: { 
      es: 'Se requieren cambios menores antes de la aceptación',
      en: 'Minor changes are required before acceptance'
    }
  },
  'major-revision-required': { 
    es: 'Revisiones mayores requeridas', 
    en: 'Major revisions required',
    color: 'bg-orange-100 text-orange-700',
    icon: '🔄',
    description: { 
      es: 'Se requieren cambios sustanciales y una nueva revisión',
      en: 'Substantial changes and re-review are required'
    }
  },
  'awaiting-revision': { 
    es: 'Esperando tu revisión', 
    en: 'Awaiting your revision',
    color: 'bg-blue-100 text-blue-700',
    icon: '⏰',
    description: { 
      es: 'Por favor, sube la versión revisada de tu artículo',
      en: 'Please upload the revised version of your article'
    }
  },
  'accepted': { 
    es: 'Aceptado', 
    en: 'Accepted',
    color: 'bg-green-100 text-green-700',
    icon: '✅',
    description: { 
      es: '¡Tu artículo ha sido aceptado para publicación!',
      en: 'Your article has been accepted for publication!'
    }
  },
  'rejected': { 
    es: 'Rechazado', 
    en: 'Rejected',
    color: 'bg-red-100 text-red-700',
    icon: '❌',
    description: { 
      es: 'El artículo no ha sido aceptado para publicación',
      en: 'The article has not been accepted for publication'
    }
  }
};

// Función para subir archivo a Drive (deberías tenerla en firebase.js)
const uploadRevisionToDrive = async (submissionId, file, notes) => {
  // Esta función debería llamar a una Cloud Function
  // Por ahora, simulamos que funciona
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        fileUrl: 'https://drive.google.com/file/d/example/view',
        fileName: file.name
      });
    }, 2000);
  });
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

  // Cargar envíos del usuario actual
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    console.log('Cargando envíos para usuario:', user.uid);

    const q = query(
      collection(db, 'submissions'),
      where('authorUID', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const submissionsList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
          deskReviewCompletedAt: data.deskReviewCompletedAt?.toDate?.(),
          decisionMadeAt: data.decisionMadeAt?.toDate?.()
        };
      });
      
      // Ordenar por fecha de creación (más reciente primero)
      submissionsList.sort((a, b) => b.createdAt - a.createdAt);
      
      setSubmissions(submissionsList);
      setLoading(false);
    }, (error) => {
      console.error('Error loading submissions:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

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
      alert(isSpanish ? 'Debes seleccionar un archivo y agregar notas' : 'You must select a file and add notes');
      return;
    }

    setUploading(true);
    try {
      // Aquí llamarías a tu Cloud Function para subir a Drive
      const uploadResult = await uploadRevisionToDrive(
        selectedSubmission.id,
        revisionFile,
        revisionNotes
      );

      if (uploadResult.success) {
        // Actualizar el submission en Firestore
        const submissionRef = doc(db, 'submissions', selectedSubmission.id);
        
        // Crear registro de nueva versión en subcolección
        const versionRef = collection(submissionRef, 'versions');
        await addDoc(versionRef, {
          version: (selectedSubmission.currentRound || 1) + 1,
          fileUrl: uploadResult.fileUrl,
          fileName: uploadResult.fileName,
          fileSize: revisionFile.size,
          notes: revisionNotes,
          type: 'revision',
          uploadedAt: serverTimestamp(),
          uploadedBy: user.uid
        });

        // Actualizar el documento principal
        await updateDoc(submissionRef, {
          status: 'in-desk-review',
          currentRound: (selectedSubmission.currentRound || 1) + 1,
          lastRevisionAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // Registrar en audit log
        await addDoc(collection(submissionRef, 'auditLogs'), {
          action: 'revision_submitted',
          round: (selectedSubmission.currentRound || 1) + 1,
          notes: revisionNotes,
          fileName: uploadResult.fileName,
          by: user.uid,
          byEmail: user.email,
          timestamp: serverTimestamp()
        });

        alert(isSpanish ? 'Revisión enviada con éxito' : 'Revision submitted successfully');
        setSelectedSubmission(null);
        setRevisionFile(null);
        setRevisionNotes('');
      }
    } catch (error) {
      console.error('Error submitting revision:', error);
      alert(isSpanish ? 'Error al enviar la revisión' : 'Error submitting revision');
    } finally {
      setUploading(false);
    }
  };

  const getStatusBadge = (status) => {
    const state = SUBMISSION_STATES[status] || SUBMISSION_STATES.submitted;
    return (
      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${state.color}`}>
        <span className="text-lg">{state.icon}</span>
        <span className="text-sm font-medium">{state[language]}</span>
      </div>
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
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-200 border-t-emerald-600 mb-4"></div>
        <p className="text-gray-500">{isSpanish ? 'Cargando tus envíos...' : 'Loading your submissions...'}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="font-['Playfair_Display'] text-3xl font-bold text-[#0A1929]">
            {isSpanish ? 'Mis Envíos' : 'My Submissions'}
          </h2>
          <p className="text-[#5A6B7A] mt-1">
            {isSpanish 
              ? `Tienes ${submissions.length} ${submissions.length === 1 ? 'envío' : 'envíos'}`
              : `You have ${submissions.length} ${submissions.length === 1 ? 'submission' : 'submissions'}`}
          </p>
        </div>
        <button
          onClick={() => window.location.href = '/submit'}
          className="px-6 py-3 bg-[#C0A86A] hover:bg-[#A58D4F] text-white font-['Playfair_Display'] font-bold rounded-xl transition-colors"
        >
          {isSpanish ? '+ NUEVO ENVÍO' : '+ NEW SUBMISSION'}
        </button>
      </div>

      {submissions.length === 0 ? (
        <div className="text-center py-16 bg-[#F5F7FA] rounded-xl">
          <svg className="w-20 h-20 text-[#C0A86A] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-xl font-['Playfair_Display'] font-bold text-[#0A1929] mb-2">
            {isSpanish ? 'No tienes envíos' : 'No submissions yet'}
          </h3>
          <p className="text-[#5A6B7A] mb-6">
            {isSpanish 
              ? 'Comienza enviando tu primer artículo' 
              : 'Start by submitting your first article'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {submissions.map(sub => (
            <motion.div
              key={sub.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="border border-[#E5E9F0] rounded-xl overflow-hidden"
            >
              {/* Cabecera del envío (siempre visible) */}
              <div 
                className="p-6 bg-white cursor-pointer hover:bg-[#F5F7FA] transition-colors"
                onClick={() => setExpandedSubmission(expandedSubmission === sub.id ? null : sub.id)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-['Playfair_Display'] font-bold text-xl text-[#0A1929]">
                        {sub.title}
                      </h3>
                      {getStatusBadge(sub.status)}
                    </div>
                    
                    <div className="flex items-center gap-6 text-sm text-[#5A6B7A]">
                      <span className="font-mono bg-[#F5F7FA] px-2 py-1 rounded">
                        {sub.submissionId}
                      </span>
                      <span>
                        {isSpanish ? 'Enviado:' : 'Submitted:'} {sub.createdAt?.toLocaleDateString()}
                      </span>
                      <span>
                        {isSpanish ? 'Ronda:' : 'Round:'} {sub.currentRound || 1}
                      </span>
                    </div>
                  </div>
                  
                  <svg 
                    className={`w-5 h-5 text-[#5A6B7A] transition-transform ${
                      expandedSubmission === sub.id ? 'rotate-180' : ''
                    }`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Detalles expandibles */}
              <AnimatePresence>
                {expandedSubmission === sub.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-[#E5E9F0] bg-[#F5F7FA] p-6"
                  >
                    {/* Descripción del estado actual */}
                    <div className="mb-6 p-4 bg-white rounded-lg border border-[#E5E9F0]">
                      <p className="text-[#0A1929]">
                        {SUBMISSION_STATES[sub.status]?.description[language]}
                      </p>
                    </div>

                    {/* Timeline de progreso (solo para estados activos) */}
                    {!['accepted', 'rejected', 'desk-review-rejected'].includes(sub.status) && (
                      <div className="mb-6">
                        <h4 className="font-['Playfair_Display'] font-semibold text-[#0A1929] mb-3">
                          {isSpanish ? 'Progreso' : 'Progress'}
                        </h4>
                        <div className="flex items-center gap-1">
                          {['submitted', 'in-desk-review', 'in-reviewer-selection', 'in-peer-review', 'accepted'].map((step, index) => {
                            const currentStep = getTimelineStep(sub.status);
                            const isCompleted = index < currentStep;
                            const isCurrent = index === currentStep;
                            
                            return (
                              <div key={step} className="flex-1">
                                <div className={`h-2 rounded-full ${
                                  isCompleted ? 'bg-green-500' :
                                  isCurrent ? 'bg-[#C0A86A]' :
                                  'bg-gray-200'
                                }`} />
                                <p className={`text-xs mt-1 text-center ${
                                  isCurrent ? 'text-[#C0A86A] font-bold' : 'text-gray-500'
                                }`}>
                                  {SUBMISSION_STATES[step]?.[language]}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Feedback del editor (si existe) */}
                    {sub.deskReviewFeedback && (
                      <div className="mb-6 p-4 bg-[#FBF9F3] border border-[#C0A86A] rounded-lg">
                        <h4 className="font-['Playfair_Display'] font-semibold text-[#0A1929] mb-2">
                          {isSpanish ? 'Feedback del editor:' : 'Editor feedback:'}
                        </h4>
                        <p className="text-[#5A6B7A]">{sub.deskReviewFeedback}</p>
                      </div>
                    )}

                    {/* Decisiones finales */}
                    {sub.finalDecision && (
                      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h4 className="font-['Playfair_Display'] font-semibold text-[#0A1929] mb-2">
                          {isSpanish ? 'Decisión final:' : 'Final decision:'}
                        </h4>
                        <p className="text-[#5A6B7A]">
                          {sub.finalDecision === 'accept' && (isSpanish ? 'Aceptado' : 'Accepted')}
                          {sub.finalDecision === 'reject' && (isSpanish ? 'Rechazado' : 'Rejected')}
                          {sub.finalDecision === 'major-revision' && (isSpanish ? 'Requiere revisión mayor' : 'Major revision required')}
                          {sub.finalDecision === 'minor-revision' && (isSpanish ? 'Requiere revisión menor' : 'Minor revision required')}
                        </p>
                        {sub.finalFeedback && (
                          <p className="text-[#5A6B7A] mt-2 italic">"{sub.finalFeedback}"</p>
                        )}
                      </div>
                    )}

                    {/* Enlaces a documentos */}
                    <div className="flex gap-4 mb-6">
                      {sub.driveFolderUrl && (
                        <a
                          href={sub.driveFolderUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-[#C0A86A] hover:text-[#A58D4F] text-sm transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          {isSpanish ? 'Ver carpeta en Drive' : 'View Drive folder'}
                        </a>
                      )}
                      {sub.originalFileUrl && (
                        <a
                          href={sub.originalFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-[#C0A86A] hover:text-[#A58D4F] text-sm transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          {isSpanish ? 'Ver manuscrito original' : 'View original manuscript'}
                        </a>
                      )}
                    </div>

                    {/* Botón para subir revisión si es necesario */}
                    {(sub.status === 'minor-revision-required' || 
                      sub.status === 'major-revision-required' || 
                      sub.status === 'awaiting-revision') && (
                      <button
                        onClick={() => setSelectedSubmission(sub)}
                        className="w-full py-4 bg-[#C0A86A] hover:bg-[#A58D4F] text-white font-['Playfair_Display'] font-bold rounded-xl transition-colors"
                      >
                        {isSpanish ? 'SUBIR VERSIÓN REVISADA' : 'UPLOAD REVISED VERSION'}
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal para subir revisión */}
      <AnimatePresence>
        {selectedSubmission && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedSubmission(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl max-w-2xl w-full p-8"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="font-['Playfair_Display'] text-2xl font-bold text-[#0A1929] mb-2">
                {isSpanish ? 'Subir Versión Revisada' : 'Upload Revised Version'}
              </h3>
              <p className="text-[#5A6B7A] mb-2">
                {selectedSubmission.title}
              </p>
              <p className="text-sm text-[#C0A86A] mb-6">
                {isSpanish ? `Ronda ${selectedSubmission.currentRound || 1} → Ronda ${(selectedSubmission.currentRound || 1) + 1}` : `Round ${selectedSubmission.currentRound || 1} → Round ${(selectedSubmission.currentRound || 1) + 1}`}
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block font-['Playfair_Display'] font-semibold text-[#0A1929] mb-3">
                    {isSpanish ? 'Archivo (PDF o Word)' : 'File (PDF or Word)'}
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleFileChange}
                    className="w-full p-4 bg-[#F5F7FA] border border-[#E5E9F0] rounded-xl file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#C0A86A] file:text-white hover:file:bg-[#A58D4F]"
                  />
                  {revisionFile && (
                    <p className="mt-2 text-sm text-green-600">
                      ✓ {revisionFile.name} ({(revisionFile.size / 1024).toFixed(2)} KB)
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-['Playfair_Display'] font-semibold text-[#0A1929] mb-3">
                    {isSpanish ? 'Notas para el editor' : 'Notes for the editor'}
                  </label>
                  <textarea
                    value={revisionNotes}
                    onChange={(e) => setRevisionNotes(e.target.value)}
                    rows="5"
                    className="w-full p-4 bg-[#F5F7FA] border border-[#E5E9F0] rounded-xl focus:ring-2 focus:ring-[#C0A86A] focus:border-transparent"
                    placeholder={isSpanish 
                      ? 'Explica los cambios realizados en esta versión...' 
                      : 'Explain the changes made in this version...'}
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={handleSubmitRevision}
                    disabled={uploading || !revisionFile || !revisionNotes.trim()}
                    className="flex-1 py-4 bg-[#C0A86A] hover:bg-[#A58D4F] disabled:bg-[#E5E9F0] disabled:text-[#5A6B7A] text-white font-['Playfair_Display'] font-bold rounded-xl transition-all"
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
                    className="flex-1 py-4 border-2 border-[#0A1929] text-[#0A1929] font-['Playfair_Display'] font-bold rounded-xl hover:bg-[#0A1929] hover:text-white transition-colors"
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