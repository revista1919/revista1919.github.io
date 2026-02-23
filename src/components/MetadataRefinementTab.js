// src/components/MetadataRefinementTab.js
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../hooks/useLanguage';
import { useMetadataRefinement } from '../hooks/useMetadataRefinement';
import { doc, onSnapshot, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export const MetadataRefinementTab = ({ submission, user, onComplete }) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  const { 
    loading, 
    proposeChanges, 
    applyApprovedChanges, 
    markAsReadyForPublication  // Nueva función
  } = useMetadataRefinement(user);
  
  const [proposedChanges, setProposedChanges] = useState([]);
  const [currentField, setCurrentField] = useState('');
  const [fieldValue, setFieldValue] = useState('');
  const [fieldReason, setFieldReason] = useState('');
  const [requiresConsent, setRequiresConsent] = useState(true);
  
  // Estado para el historial de propuestas
  const [proposals, setProposals] = useState([]);
  const [selectedProposal, setSelectedProposal] = useState(null);

  // Cargar historial de propuestas
  useEffect(() => {
    if (!submission?.id) return;

    const proposalsRef = collection(db, 'submissions', submission.id, 'metadataProposals');
    const q = query(proposalsRef, orderBy('proposedAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedProposals = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        proposedAt: doc.data().proposedAt?.toDate?.() || null,
        authorResponse: doc.data().authorResponse ? {
          ...doc.data().authorResponse,
          respondedAt: doc.data().authorResponse.respondedAt?.toDate?.() || null
        } : null
      }));
      setProposals(loadedProposals);
    });

    return () => unsubscribe();
  }, [submission?.id]);

  const fields = [ /* ... (tu array de fields, igual que antes) */ ];

  const getCurrentValue = (fieldName) => {
    return submission.currentMetadata?.[fieldName] || submission.originalSubmission?.[fieldName] || '';
  };

  const handleAddChange = () => {
    if (!currentField || !fieldValue.trim() || !fieldReason.trim()) {
      alert(isSpanish ? 'Completa todos los campos' : 'Complete all fields');
      return;
    }

    const field = fields.find(f => f.name === currentField);
    const currentValue = getCurrentValue(currentField);

    setProposedChanges([
      ...proposedChanges,
      {
        field: currentField,
        currentValue,
        proposedValue: fieldValue,
        reason: fieldReason,
        requiresAuthorConsent: requiresConsent && field.requiresConsent
      }
    ]);

    // Reset
    setCurrentField('');
    setFieldValue('');
    setFieldReason('');
    setRequiresConsent(true);
  };

  const handleRemoveChange = (index) => {
    setProposedChanges(proposedChanges.filter((_, i) => i !== index));
  };

  const handleSubmitProposal = async () => {
    if (proposedChanges.length === 0) {
      alert(isSpanish ? 'Agrega al menos un cambio' : 'Add at least one change');
      return;
    }

    const result = await proposeChanges(submission.id, proposedChanges);
    if (result.success) {
      setProposedChanges([]);
      alert(isSpanish ? 'Propuesta enviada' : 'Proposal sent');
    }
  };

  const handleApplyApprovedChanges = async (proposalId) => {
    const result = await applyApprovedChanges(submission.id, proposalId);
    if (result.success) {
      alert(isSpanish ? 'Cambios aplicados' : 'Changes applied');
    }
  };

  const handleMarkAsReady = async () => {
    if (window.confirm(isSpanish 
      ? '¿Estás seguro de marcar este artículo como listo para publicación? El Director General será notificado.'
      : 'Are you sure you want to mark this article as ready for publication? The General Director will be notified.')) {
      const result = await markAsReadyForPublication(submission.id);
      if (result.success) {
        onComplete?.();
      }
    }
  };

  const getStatusBadge = (proposal) => {
    const baseClasses = "px-2 py-1 text-xs rounded-full font-medium";
    
    if (proposal.status === 'pending-author') {
      return <span className={`${baseClasses} bg-yellow-100 text-yellow-700`}>Pendiente de autor</span>;
    }
    if (proposal.status === 'approved') {
      return <span className={`${baseClasses} bg-green-100 text-green-700`}>Aprobada</span>;
    }
    if (proposal.status === 'rejected') {
      return <span className={`${baseClasses} bg-red-100 text-red-700`}>Rechazada</span>;
    }
    return null;
  };

  // Si el artículo ya está listo para publicación
  if (submission.publicationReady) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
        <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <h3 className="text-xl font-bold text-green-800 mb-2">
          {isSpanish ? '¡Listo para publicación!' : 'Ready for publication!'}
        </h3>
        <p className="text-green-600">
          {isSpanish 
            ? 'Este artículo ha sido marcado como listo y está pendiente de la revisión final del Director.'
            : 'This article has been marked as ready and is pending final review by the Director.'}
        </p>
        {submission.publicationReadyAt && (
          <p className="text-sm text-gray-500 mt-4">
            {isSpanish ? 'Marcado el: ' : 'Marked on: '}
            {new Date(submission.publicationReadyAt.seconds * 1000).toLocaleDateString()}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Banner COPE */}
      <div className="bg-purple-50 border-l-4 border-purple-500 p-4">
        <p className="text-purple-700 text-sm">
          <strong>COPE Guidelines:</strong> {isSpanish 
            ? 'Los cambios sustanciales en metadatos requieren consentimiento del autor.'
            : 'Substantial changes to metadata require author consent.'}
        </p>
      </div>

      {/* Formulario para nueva propuesta */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-bold mb-4">
          {isSpanish ? '➕ Nueva propuesta de cambios' : '➕ New change proposal'}
        </h3>
        
        {/* Lista de cambios propuestos en esta sesión */}
        {proposedChanges.length > 0 && (
          <div className="bg-blue-50 rounded-lg p-4 mb-4">
            <h4 className="font-bold mb-3">
              {isSpanish ? 'Cambios a enviar:' : 'Changes to send:'}
            </h4>
            <div className="space-y-2">
              {proposedChanges.map((change, idx) => (
                <div key={idx} className="flex items-start justify-between bg-white p-3 rounded border border-blue-200">
                  <div className="flex-1">
                    <p className="font-medium">{change.field}</p>
                    <p className="text-sm text-gray-600">
                      <span className="line-through">{JSON.stringify(change.currentValue)}</span>
                      {' → '}
                      <span className="text-green-600">{JSON.stringify(change.proposedValue)}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Razón: {change.reason}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveChange(idx)}
                    className="text-red-500 hover:text-red-700 ml-2"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Formulario para agregar un cambio */}
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isSpanish ? 'Campo' : 'Field'}
            </label>
            <select
              value={currentField}
              onChange={(e) => {
                setCurrentField(e.target.value);
                setFieldValue(getCurrentValue(e.target.value));
              }}
              className="w-full p-2 border rounded-lg"
            >
              <option value="">{isSpanish ? 'Seleccionar...' : 'Select...'}</option>
              {fields.map(f => (
                <option key={f.name} value={f.name}>{f.label}</option>
              ))}
            </select>
          </div>

          {currentField && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isSpanish ? 'Valor actual' : 'Current value'}
                </label>
                <div className="p-2 bg-gray-100 rounded-lg text-sm">
                  {JSON.stringify(getCurrentValue(currentField))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isSpanish ? 'Nuevo valor' : 'New value'}
                </label>
                {fields.find(f => f.name === currentField)?.type === 'textarea' ? (
                  <textarea
                    value={fieldValue}
                    onChange={(e) => setFieldValue(e.target.value)}
                    rows={4}
                    className="w-full p-2 border rounded-lg"
                  />
                ) : (
                  <input
                    type="text"
                    value={fieldValue}
                    onChange={(e) => setFieldValue(e.target.value)}
                    className="w-full p-2 border rounded-lg"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isSpanish ? 'Razón del cambio' : 'Reason for change'}
                </label>
                <textarea
                  value={fieldReason}
                  onChange={(e) => setFieldReason(e.target.value)}
                  rows={2}
                  placeholder={isSpanish ? 'Explica por qué este cambio mejora el artículo...' : 'Explain why this change improves the article...'}
                  className="w-full p-2 border rounded-lg"
                />
              </div>

              <button
                onClick={handleAddChange}
                className="py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {isSpanish ? '➕ Agregar a propuesta' : '➕ Add to proposal'}
              </button>
            </>
          )}
        </div>

        {/* Botón para enviar propuesta */}
        {proposedChanges.length > 0 && (
          <button
            onClick={handleSubmitProposal}
            disabled={loading}
            className="w-full mt-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {isSpanish ? 'ENVIANDO...' : 'SENDING...'}
              </span>
            ) : (
              isSpanish ? '📨 ENVIAR PROPUESTA AL AUTOR' : '📨 SEND PROPOSAL TO AUTHOR'
            )}
          </button>
        )}
      </div>

      {/* Historial de propuestas */}
      {proposals.length > 0 && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-bold mb-4">
            {isSpanish ? '📜 Historial de propuestas' : '📜 Proposal history'}
          </h3>
          
          <div className="space-y-4">
            {proposals.map((proposal) => (
              <div key={proposal.id} className="bg-white rounded-lg border p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm text-gray-500">
                      {isSpanish ? 'Propuesto por: ' : 'Proposed by: '}
                      <span className="font-medium text-gray-700">{proposal.proposedByEmail}</span>
                    </p>
                    <p className="text-xs text-gray-400">
                      {proposal.proposedAt?.toLocaleString()}
                    </p>
                  </div>
                  {getStatusBadge(proposal)}
                </div>

                <div className="space-y-2 mb-3">
                  {proposal.changes.map((change, idx) => (
                    <div key={idx} className="text-sm border-l-2 border-gray-200 pl-3">
                      <p className="font-medium">{change.field}</p>
                      <p className="text-xs text-gray-500">{change.reason}</p>
                    </div>
                  ))}
                </div>

                {proposal.authorResponse && (
                  <div className={`mt-2 p-2 rounded text-sm ${
                    proposal.authorResponse.accepted ? 'bg-green-50' : 'bg-red-50'
                  }`}>
                    <p className="font-medium">
                      {proposal.authorResponse.accepted 
                        ? (isSpanish ? '✅ Autor aprobó' : '✅ Author approved')
                        : (isSpanish ? '❌ Autor rechazó' : '❌ Author rejected')}
                    </p>
                    {proposal.authorResponse.comments && (
                      <p className="text-xs mt-1 italic">"{proposal.authorResponse.comments}"</p>
                    )}
                  </div>
                )}

                {/* Botón para aplicar cambios si está aprobada */}
                {proposal.status === 'approved' && (
                  <button
                    onClick={() => handleApplyApprovedChanges(proposal.id)}
                    disabled={loading}
                    className="mt-3 w-full py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    {isSpanish ? 'Aplicar estos cambios' : 'Apply these changes'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botón para marcar como listo para publicación */}
      <div className="border-t pt-6 mt-6">
        <button
          onClick={handleMarkAsReady}
          disabled={loading}
          className="w-full py-4 bg-green-700 text-white font-bold rounded-lg hover:bg-green-800 disabled:bg-gray-400 text-lg"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {isSpanish ? 'PROCESANDO...' : 'PROCESSING...'}
            </span>
          ) : (
            isSpanish 
              ? '✅ MARCAR COMO LISTO PARA PUBLICACIÓN' 
              : '✅ MARK AS READY FOR PUBLICATION'
          )}
        </button>
        <p className="text-xs text-gray-500 text-center mt-2">
          {isSpanish 
            ? 'Al marcar como listo, se notificará al Director General para que proceda con la publicación.'
            : 'By marking as ready, the General Director will be notified to proceed with publication.'}
        </p>
      </div>
    </div>
  );
};