// src/components/AuthorMetadataResponseTab.js
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../hooks/useLanguage';
import { useMetadataRefinement } from '../hooks/useMetadataRefinement';
import { doc, onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

export const AuthorMetadataResponseTab = ({ submission, user, onResponded }) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  const { loading, respondToProposal, error: hookError } = useMetadataRefinement(user);
  
  const [pendingProposals, setPendingProposals] = useState([]);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [responseComments, setResponseComments] = useState('');
  const [localError, setLocalError] = useState(null);
  const [expandedProposal, setExpandedProposal] = useState(null);

  // Mostrar errores del hook
  useEffect(() => {
    if (hookError) {
      setLocalError(hookError);
      setTimeout(() => setLocalError(null), 5000);
    }
  }, [hookError]);

  // Función para formatear valores (especialmente objetos como autores)
  const formatValue = (value) => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'object') {
      // Si es un array de autores
      if (Array.isArray(value)) {
        if (value.length === 0) return '—';
        return value.map(author => {
          if (typeof author === 'object') {
            // Intenta formatear el autor de diferentes maneras
            if (author.firstName && author.lastName) {
              return `${author.lastName}, ${author.firstName}`;
            } else if (author.name) {
              return author.name;
            } else {
              return Object.values(author).join(' ') || 'Autor sin nombre';
            }
          }
          return String(author);
        }).join('; ');
      }
      // Si es un objeto simple
      return JSON.stringify(value);
    }
    return String(value);
  };

  // Cargar propuestas pendientes para este artículo
  useEffect(() => {
    if (!submission?.id) return;

    const proposalsRef = collection(db, 'submissions', submission.id, 'metadataProposals');
    const q = query(
      proposalsRef, 
      where('status', '==', 'pending-author'),
      orderBy('proposedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedProposals = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        proposedAt: doc.data().proposedAt?.toDate?.() || null
      }));
      setPendingProposals(loadedProposals);
      
      // Seleccionar la primera propuesta pendiente por defecto
      if (loadedProposals.length > 0 && !selectedProposal) {
        setSelectedProposal(loadedProposals[0]);
      }
    }, (error) => {
      console.error('Error loading pending proposals:', error);
      setLocalError(isSpanish ? 'Error al cargar propuestas' : 'Error loading proposals');
    });

    return () => unsubscribe();
  }, [submission?.id, isSpanish]);

  const handleAccept = async () => {
    if (!selectedProposal) return;
    
    setLocalError(null);
    const result = await respondToProposal(submission.id, selectedProposal.id, true, responseComments);
    
    if (result.success) {
      setResponseComments('');
      setSelectedProposal(null);
      onResponded?.();
    } else {
      setLocalError(result.error || (isSpanish ? 'Error al aceptar propuesta' : 'Error accepting proposal'));
    }
  };

  const handleReject = async () => {
    if (!selectedProposal) return;
    
    if (!responseComments.trim() && window.confirm(
      isSpanish 
        ? '¿Estás seguro de rechazar sin comentarios? Se recomienda proporcionar una explicación.'
        : 'Are you sure you want to reject without comments? Providing an explanation is recommended.'
    )) {
      // Proceder sin comentarios
    } else if (!responseComments.trim()) {
      return; // No proceder si no hay comentarios y el usuario canceló
    }
    
    setLocalError(null);
    const result = await respondToProposal(submission.id, selectedProposal.id, false, responseComments);
    
    if (result.success) {
      setResponseComments('');
      setSelectedProposal(null);
      onResponded?.();
    } else {
      setLocalError(result.error || (isSpanish ? 'Error al rechazar propuesta' : 'Error rejecting proposal'));
    }
  };

  // Si no hay propuestas pendientes
  if (pendingProposals.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-gray-50 rounded-lg p-8 text-center border border-gray-200"
      >
        <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-gray-500 text-lg">
          {isSpanish 
            ? 'No hay propuestas de cambio de metadatos pendientes.' 
            : 'No pending metadata change proposals.'}
        </p>
        <p className="text-gray-400 text-sm mt-2">
          {isSpanish
            ? 'Los editores te notificarán cuando propongan cambios.'
            : 'Editors will notify you when they propose changes.'}
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Banner COPE */}
      <div className="bg-purple-50 border-l-4 border-purple-500 p-4">
        <p className="text-purple-700 text-sm">
          <strong>COPE Guidelines:</strong> {isSpanish 
            ? 'Como autor, tienes derecho a revisar y aprobar cambios sustanciales en los metadatos de tu artículo.'
            : 'As an author, you have the right to review and approve substantial changes to your article metadata.'}
        </p>
      </div>

      {/* Mensaje de error */}
      <AnimatePresence>
        {localError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-50 border-l-4 border-red-500 p-4"
          >
            <p className="text-red-700 text-sm">❌ {localError}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selector de propuestas (si hay múltiples) */}
      {pendingProposals.length > 1 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-medium text-yellow-800 mb-2">
            {isSpanish ? 'Múltiples propuestas pendientes' : 'Multiple pending proposals'}
          </h4>
          <div className="flex gap-2">
            {pendingProposals.map((prop) => (
              <button
                key={prop.id}
                onClick={() => {
                  setSelectedProposal(prop);
                  setResponseComments('');
                }}
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedProposal?.id === prop.id
                    ? 'bg-yellow-600 text-white'
                    : 'bg-white text-yellow-700 border border-yellow-300 hover:bg-yellow-50'
                }`}
              >
                {prop.proposedAt?.toLocaleDateString?.() || 'Propuesta'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Propuesta seleccionada */}
      {selectedProposal && (
        <motion.div
          key={selectedProposal.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6"
        >
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-xl font-bold text-yellow-800">
              {isSpanish ? '📝 Propuesta de cambios en metadatos' : '📝 Metadata Change Proposal'}
            </h3>
            <span className="bg-yellow-200 text-yellow-800 px-3 py-1 rounded-full text-sm">
              {isSpanish ? 'Requiere tu revisión' : 'Requires your review'}
            </span>
          </div>
          
          <p className="text-yellow-700 mb-6">
            {isSpanish 
              ? 'El editor ha propuesto los siguientes cambios a los metadatos de tu artículo. Por favor, revísalos y acepta o rechaza según corresponda.'
              : 'The editor has proposed the following changes to your article metadata. Please review and accept or reject accordingly.'}
          </p>

          <div className="space-y-4 mb-6">
            {selectedProposal.changes?.map((change, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white p-4 rounded-lg border border-yellow-200 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-2">
                  <p className="font-medium text-gray-700">
                    {change.field}:
                  </p>
                  {change.requiresAuthorConsent && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                      {isSpanish ? 'Requiere consentimiento' : 'Requires consent'}
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="bg-gray-50 p-3 rounded">
                    <span className="text-gray-500 block mb-1 text-xs uppercase">
                      {isSpanish ? 'Actual:' : 'Current:'}
                    </span>
                    <span className="line-through text-gray-600 font-mono text-sm break-words">
                      {formatValue(change.currentValue)}
                    </span>
                  </div>
                  <div className="bg-green-50 p-3 rounded">
                    <span className="text-green-600 block mb-1 text-xs uppercase">
                      {isSpanish ? 'Propuesto:' : 'Proposed:'}
                    </span>
                    <span className="text-green-700 font-mono text-sm break-words">
                      {formatValue(change.proposedValue)}
                    </span>
                  </div>
                </div>
                
                {change.reason && (
                  <div className="mt-3 text-xs bg-blue-50 p-2 rounded">
                    <strong className="text-blue-700 block mb-1">
                      {isSpanish ? 'Razón del cambio:' : 'Reason for change:'}
                    </strong>
                    <p className="text-blue-600">{change.reason}</p>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {isSpanish ? 'Tus comentarios (opcional)' : 'Your comments (optional)'}
            </label>
            <textarea
              value={responseComments}
              onChange={(e) => setResponseComments(e.target.value)}
              rows={4}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
              placeholder={isSpanish 
                ? 'Si tienes alguna observación sobre los cambios propuestos, escríbela aquí...' 
                : 'If you have any comments about the proposed changes, write them here...'}
            />
            <p className="text-xs text-gray-500 mt-1">
              {isSpanish 
                ? '💡 Tus comentarios serán visibles para los editores.'
                : '💡 Your comments will be visible to the editors.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleAccept}
              disabled={loading}
              className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {isSpanish ? 'PROCESANDO...' : 'PROCESSING...'}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span>✅</span>
                  {isSpanish ? 'ACEPTAR CAMBIOS' : 'ACCEPT CHANGES'}
                </span>
              )}
            </button>
            
            <button
              onClick={handleReject}
              disabled={loading}
              className="flex-1 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 font-medium transition-colors"
            >
              <span className="flex items-center justify-center gap-2">
                <span>❌</span>
                {isSpanish ? 'RECHAZAR' : 'REJECT'}
              </span>
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center mt-4">
            {isSpanish 
              ? 'Al aceptar, autorizas los cambios propuestos. Al rechazar, puedes proporcionar comentarios para que el editor los revise.'
              : 'By accepting, you authorize the proposed changes. By rejecting, you can provide comments for the editor to review.'}
          </p>
        </motion.div>
      )}

      {/* Historial de propuestas respondidas */}
      {pendingProposals.length > 0 && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
          <h4 className="font-medium text-gray-700 mb-2">
            {isSpanish ? '📋 Propuestas pendientes:' : '📋 Pending proposals:'}
          </h4>
          <div className="space-y-2">
            {pendingProposals.map((prop) => (
              <div 
                key={prop.id}
                className={`p-2 rounded text-sm cursor-pointer hover:bg-gray-100 transition-colors ${
                  selectedProposal?.id === prop.id ? 'bg-yellow-100 border border-yellow-300' : ''
                }`}
                onClick={() => {
                  setSelectedProposal(prop);
                  setResponseComments('');
                }}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">
                    {isSpanish ? 'Propuesta del ' : 'Proposal from '}
                    {prop.proposedAt?.toLocaleDateString?.() || 'fecha desconocida'}
                  </span>
                  <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded">
                    {prop.changes?.length || 0} {isSpanish ? 'cambios' : 'changes'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {isSpanish ? 'Por: ' : 'By: '}{prop.proposedByEmail}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};