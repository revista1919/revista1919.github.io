// src/components/AcceptedArticlesPanel.js
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, addDoc, getDoc } from 'firebase/firestore';
import { useLanguage } from '../hooks/useLanguage';
import { FinalMetadataForm } from './FinalMetadataForm';
import { ArticleHistoryView } from './ArticleHistoryView';

const AcceptedArticlesPanel = ({ user }) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  
  const [acceptedSubmissions, setAcceptedSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [showMetadataForm, setShowMetadataForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [historyData, setHistoryData] = useState(null);
  const [generatingHistory, setGeneratingHistory] = useState(false);

  // Cargar submissions ACEPTADOS
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'submissions'),
      where('status', '==', 'accepted')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const submissions = await Promise.all(snapshot.docs.map(async (doc) => {
        const data = doc.data();
        
        // Obtener metadatos finales si existen
        const metadataRef = collection(db, 'submissions', doc.id, 'finalMetadata');
        const metadataSnap = await getDocs(metadataRef);
        const metadata = !metadataSnap.empty ? metadataSnap.docs[0].data() : null;
        
        // Obtener historial si existe
        const historyRef = collection(db, 'submissions', doc.id, 'history');
        const historySnap = await getDocs(historyRef);
        const history = !historySnap.empty ? historySnap.docs[0].data() : null;
        
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
          acceptedAt: data.acceptedAt?.toDate?.() || data.decisionMadeAt?.toDate?.(),
          finalMetadata: metadata,
          hasHistory: !!history
        };
      }));
      
      // Ordenar por fecha de aceptación (más reciente primero)
      submissions.sort((a, b) => (b.acceptedAt || 0) - (a.acceptedAt || 0));
      
      setAcceptedSubmissions(submissions);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleGenerateHistory = async (submission) => {
    setGeneratingHistory(true);
    setSelectedSubmission(submission);
    
    try {
      // Llamar a Cloud Function para generar el historial inmutable
      const response = await fetch('https://us-central1-your-project.cloudfunctions.net/generateArticleHistory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`
        },
        body: JSON.stringify({
          submissionId: submission.id
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setHistoryData(result.history);
        setShowHistory(true);
      } else {
        alert(isSpanish ? 'Error al generar historial' : 'Error generating history');
      }
    } catch (error) {
      console.error('Error:', error);
      alert(isSpanish ? 'Error al generar historial' : 'Error generating history');
    } finally {
      setGeneratingHistory(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-200 border-t-emerald-600 mb-4"></div>
        <p className="text-gray-500">{isSpanish ? 'Cargando artículos aceptados...' : 'Loading accepted articles...'}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
      <h2 className="font-['Playfair_Display'] text-3xl font-bold text-[#0A1929] mb-2">
        {isSpanish ? 'Artículos Aceptados' : 'Accepted Articles'}
      </h2>
      <p className="text-[#5A6B7A] mb-8 border-b border-[#E5E9F0] pb-4">
        {isSpanish 
          ? 'Gestiona los metadatos finales y genera el historial inmutable' 
          : 'Manage final metadata and generate immutable history'}
      </p>

      {acceptedSubmissions.length === 0 ? (
        <div className="text-center py-16 bg-[#F5F7FA] rounded-xl">
          <svg className="w-20 h-20 text-[#C0A86A] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-xl font-['Playfair_Display'] font-bold text-[#0A1929] mb-2">
            {isSpanish ? 'No hay artículos aceptados' : 'No accepted articles yet'}
          </h3>
        </div>
      ) : (
        <div className="space-y-4">
          {acceptedSubmissions.map(sub => (
            <motion.div
              key={sub.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="border border-[#E5E9F0] rounded-xl p-6 bg-white hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-['Playfair_Display'] font-bold text-xl text-[#0A1929] mb-2">
                    {sub.title}
                  </h3>
                  
                  <div className="flex flex-wrap items-center gap-4 text-sm text-[#5A6B7A]">
                    <span className="font-mono bg-[#F5F7FA] px-2 py-1 rounded">
                      {sub.submissionId}
                    </span>
                    <span>
                      {isSpanish ? 'Aceptado:' : 'Accepted:'} {sub.acceptedAt?.toLocaleDateString()}
                    </span>
                    <span className={`px-2 py-1 rounded-full ${
                      sub.hasHistory 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {sub.hasHistory 
                        ? (isSpanish ? 'Historial generado' : 'History generated')
                        : (isSpanish ? 'Pendiente de historial' : 'Pending history')}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setSelectedSubmission(sub);
                      setShowMetadataForm(true);
                    }}
                    className="px-4 py-2 bg-[#0A1929] hover:bg-[#1E2F40] text-white font-['Playfair_Display'] font-bold rounded-xl transition-colors text-sm"
                  >
                    {isSpanish ? 'EDITAR METADATOS' : 'EDIT METADATA'}
                  </button>
                  
                  {!sub.hasHistory && (
                    <button
                      onClick={() => handleGenerateHistory(sub)}
                      disabled={generatingHistory}
                      className="px-4 py-2 bg-[#C0A86A] hover:bg-[#A58D4F] text-white font-['Playfair_Display'] font-bold rounded-xl transition-colors text-sm disabled:bg-[#E5E9F0] disabled:text-[#5A6B7A]"
                    >
                      {generatingHistory && selectedSubmission?.id === sub.id ? (
                        <span className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          {isSpanish ? 'GENERANDO...' : 'GENERATING...'}
                        </span>
                      ) : (
                        isSpanish ? 'GENERAR HISTORIAL' : 'GENERATE HISTORY'
                      )}
                    </button>
                  )}
                  
                  {sub.hasHistory && (
                    <button
                      onClick={() => {
                        setHistoryData(sub.finalMetadata?.history);
                        setShowHistory(true);
                      }}
                      className="px-4 py-2 border border-[#C0A86A] text-[#C0A86A] hover:bg-[#FBF9F3] font-['Playfair_Display'] font-bold rounded-xl transition-colors text-sm"
                    >
                      {isSpanish ? 'VER HISTORIAL' : 'VIEW HISTORY'}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal para editar metadatos finales */}
      <AnimatePresence>
        {showMetadataForm && selectedSubmission && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setShowMetadataForm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <FinalMetadataForm
                submission={selectedSubmission}
                user={user}
                onClose={() => {
                  setShowMetadataForm(false);
                  setSelectedSubmission(null);
                }}
                onSuccess={() => {
                  setShowMetadataForm(false);
                  setSelectedSubmission(null);
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal para ver historial */}
      <AnimatePresence>
        {showHistory && historyData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowHistory(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <ArticleHistoryView
                history={historyData}
                onClose={() => setShowHistory(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AcceptedArticlesPanel;