// src/components/AuthorMetadataResponseTab.js
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../hooks/useLanguage';
import { useMetadataRefinement } from '../hooks/useMetadataRefinement';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export const AuthorMetadataResponseTab = ({ submission, user, onResponded }) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  const { loading, respondToProposal } = useMetadataRefinement(user);
  
  const [proposal, setProposal] = useState(null);
  const [responseComments, setResponseComments] = useState('');

  useEffect(() => {
    if (!submission?.id) return;

    const unsub = onSnapshot(doc(db, 'submissions', submission.id), (doc) => {
      const data = doc.data();
      if (data?.metadataRefinement?.status === 'pending-author') {
        setProposal(data.metadataRefinement);
      } else {
        setProposal(null);
      }
    });

    return () => unsub();
  }, [submission?.id]);

  if (!proposal) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <p className="text-gray-500">
          {isSpanish 
            ? 'No hay propuestas de cambio de metadatos pendientes.' 
            : 'No pending metadata change proposals.'}
        </p>
      </div>
    );
  }

  const handleAccept = async () => {
    const result = await respondToProposal(submission.id, true, responseComments);
    if (result.success) {
      onResponded?.();
    }
  };

  const handleReject = async () => {
    const result = await respondToProposal(submission.id, false, responseComments);
    if (result.success) {
      onResponded?.();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6"
    >
      <h3 className="text-xl font-bold text-yellow-800 mb-4">
        {isSpanish ? '📝 Propuesta de cambios en metadatos' : '📝 Metadata Change Proposal'}
      </h3>
      
      <p className="text-yellow-700 mb-6">
        {isSpanish 
          ? 'El editor ha propuesto los siguientes cambios a los metadatos de tu artículo. Por favor, revísalos y acepta o rechaza según corresponda.'
          : 'The editor has proposed the following changes to your article metadata. Please review and accept or reject accordingly.'}
      </p>

      <div className="space-y-4 mb-6">
        {proposal.changes.map((change, idx) => (
          <div key={idx} className="bg-white p-4 rounded-lg border border-yellow-200">
            <p className="font-medium text-gray-700 mb-2">
              {change.field}:
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-gray-50 p-2 rounded">
                <span className="text-gray-500 block mb-1">{isSpanish ? 'Actual:' : 'Current:'}</span>
                <span className="line-through text-gray-600">{JSON.stringify(change.currentValue)}</span>
              </div>
              <div className="bg-green-50 p-2 rounded">
                <span className="text-green-600 block mb-1">{isSpanish ? 'Propuesto:' : 'Proposed:'}</span>
                <span className="text-green-700">{JSON.stringify(change.proposedValue)}</span>
              </div>
            </div>
            {change.reason && (
              <p className="text-xs text-gray-500 mt-2">
                <strong>{isSpanish ? 'Razón:' : 'Reason:'}</strong> {change.reason}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {isSpanish ? 'Comentarios (opcional)' : 'Comments (optional)'}
        </label>
        <textarea
          value={responseComments}
          onChange={(e) => setResponseComments(e.target.value)}
          rows={4}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400"
          placeholder={isSpanish 
            ? 'Si tienes alguna observación sobre los cambios propuestos...' 
            : 'If you have any comments about the proposed changes...'}
        />
      </div>

      <div className="flex gap-4">
        <button
          onClick={handleAccept}
          disabled={loading}
          className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {isSpanish ? 'PROCESANDO...' : 'PROCESSING...'}
            </span>
          ) : (
            isSpanish ? '✅ ACEPTAR CAMBIOS' : '✅ ACCEPT CHANGES'
          )}
        </button>
        
        <button
          onClick={handleReject}
          disabled={loading}
          className="flex-1 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 font-medium"
        >
          {isSpanish ? '❌ RECHAZAR' : '❌ REJECT'}
        </button>
      </div>
    </motion.div>
  );
};