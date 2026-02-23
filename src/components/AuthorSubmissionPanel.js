// src/components/AuthorSubmissionsPanel.js
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';

const SUBMISSION_STATES = {
  'submitted': { 
    es: 'Enviado', 
    en: 'Submitted',
    color: 'bg-blue-100 text-blue-700',
    icon: '📤'
  },
  'in-desk-review': { 
    es: 'En revisión editorial', 
    en: 'In desk review',
    color: 'bg-purple-100 text-purple-700',
    icon: '🔍'
  },
  'desk-review-rejected': { 
    es: 'Rechazado en revisión editorial', 
    en: 'Rejected in desk review',
    color: 'bg-red-100 text-red-700',
    icon: '❌'
  },
  'in-reviewer-selection': { 
    es: 'Seleccionando revisores', 
    en: 'Selecting reviewers',
    color: 'bg-yellow-100 text-yellow-700',
    icon: '👥'
  },
  'awaiting-reviewer-responses': { 
    es: 'Esperando respuesta de revisores', 
    en: 'Awaiting reviewer responses',
    color: 'bg-orange-100 text-orange-700',
    icon: '⏳'
  },
  'in-peer-review': { 
    es: 'En revisión por pares', 
    en: 'In peer review',
    color: 'bg-indigo-100 text-indigo-700',
    icon: '📝'
  },
  'minor-revision-required': { 
    es: 'Revisiones menores requeridas', 
    en: 'Minor revisions required',
    color: 'bg-yellow-100 text-yellow-700',
    icon: '✏️'
  },
  'major-revision-required': { 
    es: 'Revisiones mayores requeridas', 
    en: 'Major revisions required',
    color: 'bg-orange-100 text-orange-700',
    icon: '🔄'
  },
  'awaiting-revision': { 
    es: 'Esperando tu revisión', 
    en: 'Awaiting your revision',
    color: 'bg-blue-100 text-blue-700',
    icon: '⏰'
  },
  'accepted': { 
    es: 'Aceptado', 
    en: 'Accepted',
    color: 'bg-green-100 text-green-700',
    icon: '✅'
  },
  'rejected': { 
    es: 'Rechazado', 
    en: 'Rejected',
    color: 'bg-red-100 text-red-700',
    icon: '❌'
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

  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'submissions'),
      where('authorUID', '==', user.uid),
      where('status', 'in', Object.keys(SUBMISSION_STATES))
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const submissionsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      }));
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
    if (file && (file.type === 'application/pdf' || 
                 file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                 file.type === 'application/msword')) {
      setRevisionFile(file);
    } else {
      alert(isSpanish ? 'Por favor selecciona un archivo PDF o Word' : 'Please select a PDF or Word file');
    }
  };

  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  const handleSubmitRevision = async () => {
    if (!revisionFile || !revisionNotes) {
      alert(isSpanish ? 'Debes seleccionar un archivo y agregar notas' : 'You must select a file and add notes');
      return;
    }

    setUploading(true);
    try {
      const base64File = await convertToBase64(revisionFile);
      
      // Aquí llamarías a una Cloud Function para subir la revisión
      // Por ahora, solo actualizamos el estado local
      const submissionRef = doc(db, 'submissions', selectedSubmission.id);
      
      // Crear nueva versión
      const versionData = {
        version: (selectedSubmission.currentRound || 1) + 1,
        fileUrl: 'pending', // Se actualizaría con la URL real
        fileName: revisionFile.name,
        fileSize: revisionFile.size,
        type: 'revision',
        notes: revisionNotes,
        uploadedAt: serverTimestamp(),
        uploadedBy: user.uid
      };

      await updateDoc(submissionRef, {
        status: 'in-desk-review',
        currentRound: (selectedSubmission.currentRound || 1) + 1,
        lastRevisionAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Aquí también crearías un registro en una subcolección 'versions'

      alert(isSpanish ? 'Revisión enviada con éxito' : 'Revision submitted successfully');
      setSelectedSubmission(null);
      setRevisionFile(null);
      setRevisionNotes('');
    } catch (error) {
      console.error('Error submitting revision:', error);
      alert(isSpanish ? 'Error al enviar la revisión' : 'Error submitting revision');
    } finally {
      setUploading(false);
    }
  };

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
      <h2 className="font-['Playfair_Display'] text-3xl font-bold text-[#0A1929] mb-2">
        {isSpanish ? 'Mis Envíos' : 'My Submissions'}
      </h2>
      <p className="text-[#5A6B7A] mb-8 border-b border-[#E5E9F0] pb-4">
        {isSpanish 
          ? 'Seguimiento de tus artículos enviados' 
          : 'Track your submitted articles'}
      </p>

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
          <button
            onClick={() => window.location.href = '/submit'}
            className="px-8 py-3 bg-[#C0A86A] hover:bg-[#A58D4F] text-white font-['Playfair_Display'] font-bold rounded-xl transition-colors"
          >
            {isSpanish ? 'ENVIAR ARTÍCULO' : 'SUBMIT ARTICLE'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {submissions.map(sub => (
            <motion.div
              key={sub.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="border border-[#E5E9F0] rounded-xl p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-['Playfair_Display'] font-bold text-xl text-[#0A1929] mb-2">
                    {sub.title}
                  </h3>
                  <p className="text-sm text-[#5A6B7A] mb-2">
                    <span className="font-mono bg-[#F5F7FA] px-2 py-1 rounded">
                      {sub.submissionId}
                    </span>
                  </p>
                </div>
                <span className={`px-4 py-2 rounded-full text-sm font-medium ${SUBMISSION_STATES[sub.status]?.color}`}>
                  {SUBMISSION_STATES[sub.status]?.icon} {SUBMISSION_STATES[sub.status]?.[language]}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                <div>
                  <span className="text-[#5A6B7A]">{isSpanish ? 'Área:' : 'Area:'}</span>
                  <span className="ml-2 text-[#0A1929] font-medium">{sub.area}</span>
                </div>
                <div>
                  <span className="text-[#5A6B7A]">{isSpanish ? 'Ronda:' : 'Round:'}</span>
                  <span className="ml-2 text-[#0A1929] font-medium">{sub.currentRound || 1}</span>
                </div>
                <div>
                  <span className="text-[#5A6B7A]">{isSpanish ? 'Enviado:' : 'Submitted:'}</span>
                  <span className="ml-2 text-[#0A1929] font-medium">
                    {sub.createdAt?.toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Mostrar feedback si existe */}
              {sub.deskReviewFeedback && (
                <div className="mt-4 p-4 bg-[#FBF9F3] border border-[#C0A86A] rounded-lg">
                  <p className="text-sm font-medium text-[#0A1929] mb-1">
                    {isSpanish ? 'Feedback del editor:' : 'Editor feedback:'}
                  </p>
                  <p className="text-sm text-[#5A6B7A]">{sub.deskReviewFeedback}</p>
                </div>
              )}

              {/* Botón para subir revisión si es necesario */}
              {(sub.status === 'minor-revision-required' || sub.status === 'major-revision-required' || sub.status === 'awaiting-revision') && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => setSelectedSubmission(sub)}
                    className="px-6 py-2 bg-[#C0A86A] hover:bg-[#A58D4F] text-white font-['Playfair_Display'] font-bold rounded-lg transition-colors"
                  >
                    {isSpanish ? 'SUBIR REVISIÓN' : 'UPLOAD REVISION'}
                  </button>
                </div>
              )}

              {/* Link a Drive */}
              {sub.driveFolderUrl && (
                <div className="mt-4">
                  <a
                    href={sub.driveFolderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#C0A86A] hover:text-[#A58D4F] flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    {isSpanish ? 'Ver documentos en Drive' : 'View documents in Drive'}
                  </a>
                </div>
              )}
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
              <p className="text-[#5A6B7A] mb-6">
                {selectedSubmission.title}
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block font-['Playfair_Display'] font-semibold text-[#0A1929] mb-3">
                    {isSpanish ? 'Archivo (PDF o Word)' : 'File (PDF or Word)'}
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileChange}
                    className="w-full p-4 bg-[#F5F7FA] border border-[#E5E9F0] rounded-xl"
                  />
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
                      ? 'Explica los cambios realizados...' 
                      : 'Explain the changes made...'}
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={handleSubmitRevision}
                    disabled={uploading || !revisionFile || !revisionNotes}
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
                    onClick={() => setSelectedSubmission(null)}
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