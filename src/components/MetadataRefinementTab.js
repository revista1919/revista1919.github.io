// src/components/MetadataRefinementTab.js
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../hooks/useLanguage';
import { useMetadataRefinement } from '../hooks/useMetadataRefinement';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export const MetadataRefinementTab = ({ submission, user, onComplete }) => {
  const { language } = useLanguage();
  const isSpanish = language === 'es';
  const { loading, proposeChanges, applyApprovedChanges } = useMetadataRefinement(user);
  
  const [proposedChanges, setProposedChanges] = useState([]);
  const [currentField, setCurrentField] = useState('');
  const [fieldValue, setFieldValue] = useState('');
  const [fieldReason, setFieldReason] = useState('');
  const [requiresConsent, setRequiresConsent] = useState(true);
  const [refinementStatus, setRefinementStatus] = useState(null);

  // Escuchar cambios en metadataRefinement
  useEffect(() => {
    if (!submission?.id) return;

    const unsub = onSnapshot(doc(db, 'submissions', submission.id), (doc) => {
      const data = doc.data();
      if (data?.metadataRefinement) {
        setRefinementStatus(data.metadataRefinement);
      }
    });

    return () => unsub();
  }, [submission?.id]);

  const fields = [
    { name: 'title', label: 'Título', type: 'text', requiresConsent: true },
    { name: 'titleEn', label: 'Title (English)', type: 'text', requiresConsent: true },
    { name: 'abstract', label: 'Resumen', type: 'textarea', requiresConsent: true },
    { name: 'abstractEn', label: 'Abstract', type: 'textarea', requiresConsent: true },
    { name: 'keywords', label: 'Palabras clave', type: 'keywords', requiresConsent: true },
    { name: 'keywordsEn', label: 'Keywords', type: 'keywords', requiresConsent: true },
    { name: 'authors', label: 'Autores', type: 'authors', requiresConsent: true },
    { name: 'dataAvailability', label: 'Disponibilidad de datos', type: 'text', requiresConsent: false },
    { name: 'dataAvailabilityEn', label: 'Data Availability', type: 'text', requiresConsent: false },
    { name: 'codeAvailability', label: 'Disponibilidad de código', type: 'text', requiresConsent: false },
    { name: 'codeAvailabilityEn', label: 'Code Availability', type: 'text', requiresConsent: false },
    { name: 'acknowledgments', label: 'Agradecimientos', type: 'textarea', requiresConsent: false }
  ];

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

    // Resetear
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
    }
  };

  const handleApplyChanges = async () => {
    const result = await applyApprovedChanges(submission.id);
    if (result.success) {
      onComplete?.();
    }
  };

  // Renderizar según el estado
  const renderContent = () => {
    // Si no hay propuesta
    if (!refinementStatus) {
      return (
        <div className="space-y-6">
          {/* Lista de cambios propuestos */}
          {proposedChanges.length > 0 && (
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-bold mb-3">
                {isSpanish ? 'Cambios propuestos:' : 'Proposed changes:'}
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
                      {change.requiresAuthorConsent && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded mt-1 inline-block">
                          {isSpanish ? 'Requiere consentimiento del autor' : 'Requires author consent'}
                        </span>
                      )}
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

          {/* Formulario para agregar cambio */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="font-bold mb-4">
              {isSpanish ? 'Agregar cambio propuesto' : 'Add proposed change'}
            </h4>
            
            <div className="space-y-4">
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

                  {fields.find(f => f.name === currentField)?.requiresConsent && (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="requiresConsent"
                        checked={requiresConsent}
                        onChange={(e) => setRequiresConsent(e.target.checked)}
                        className="rounded"
                      />
                      <label htmlFor="requiresConsent" className="text-sm">
                        {isSpanish 
                          ? 'Este cambio requiere consentimiento del autor (recomendado para cambios sustanciales)' 
                          : 'This change requires author consent (recommended for substantial changes)'}
                      </label>
                    </div>
                  )}

                  <button
                    onClick={handleAddChange}
                    className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {isSpanish ? 'Agregar a propuesta' : 'Add to proposal'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Botón para enviar propuesta */}
          {proposedChanges.length > 0 && (
            <button
              onClick={handleSubmitProposal}
              disabled={loading}
              className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {isSpanish ? 'ENVIANDO...' : 'SENDING...'}
                </span>
              ) : (
                isSpanish ? 'ENVIAR PROPUESTA AL AUTOR' : 'SEND PROPOSAL TO AUTHOR'
              )}
            </button>
          )}
        </div>
      );
    }

    // Si hay propuesta pendiente con el autor
    if (refinementStatus.status === 'pending-author') {
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h4 className="font-bold text-yellow-800 mb-4">
            {isSpanish ? '⏳ Esperando respuesta del autor' : '⏳ Awaiting author response'}
          </h4>
          <p className="text-yellow-700 mb-4">
            {isSpanish 
              ? 'Los siguientes cambios han sido propuestos al autor:' 
              : 'The following changes have been proposed to the author:'}
          </p>
          <div className="space-y-3">
            {refinementStatus.changes?.map((change, idx) => (
              <div key={idx} className="bg-white p-3 rounded border border-yellow-200">
                <p className="font-medium">{change.field}</p>
                <p className="text-sm">
                  <span className="line-through text-gray-500">{JSON.stringify(change.currentValue)}</span>
                  {' → '}
                  <span className="text-green-600">{JSON.stringify(change.proposedValue)}</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">Razón: {change.reason}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-yellow-600 mt-4">
            {isSpanish 
              ? 'Recibirás una notificación cuando el autor responda.' 
              : 'You will be notified when the author responds.'}
          </p>
        </div>
      );
    }

    // Si el autor aprobó y está pendiente de aplicar
    if (refinementStatus.status === 'pending-editor' && refinementStatus.authorResponse?.accepted) {
      return (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h4 className="font-bold text-green-800 mb-4">
            {isSpanish ? '✅ Autor aprobó los cambios' : '✅ Author approved the changes'}
          </h4>
          <div className="bg-white p-4 rounded border border-green-200 mb-4">
            <p className="text-sm text-gray-600 mb-2">
              {isSpanish ? 'Comentarios del autor:' : 'Author comments:'}
            </p>
            <p className="italic">{refinementStatus.authorResponse.comments || (isSpanish ? 'Sin comentarios' : 'No comments')}</p>
          </div>
          <button
            onClick={handleApplyChanges}
            disabled={loading}
            className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {isSpanish ? 'APLICANDO...' : 'APPLYING...'}
              </span>
            ) : (
              isSpanish ? 'APLICAR CAMBIOS' : 'APPLY CHANGES'
            )}
          </button>
        </div>
      );
    }

    // Si el autor rechazó
    if (refinementStatus.status === 'rejected') {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h4 className="font-bold text-red-800 mb-4">
            {isSpanish ? '❌ Autor rechazó los cambios' : '❌ Author rejected the changes'}
          </h4>
          <div className="bg-white p-4 rounded border border-red-200">
            <p className="text-sm text-gray-600 mb-2">
              {isSpanish ? 'Comentarios del autor:' : 'Author comments:'}
            </p>
            <p className="italic">{refinementStatus.authorResponse?.comments || (isSpanish ? 'Sin comentarios' : 'No comments')}</p>
          </div>
        </div>
      );
    }

    // Si ya están aprobados
    if (refinementStatus.status === 'approved') {
      return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h4 className="font-bold text-blue-800 mb-4">
            {isSpanish ? '✨ Cambios aplicados' : '✨ Changes applied'}
          </h4>
          <p className="text-blue-700">
            {isSpanish 
              ? 'Los cambios han sido aplicados exitosamente a los metadatos del artículo.'
              : 'Changes have been successfully applied to the article metadata.'}
          </p>
        </div>
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner COPE */}
      <div className="bg-purple-50 border-l-4 border-purple-500 p-4">
        <p className="text-purple-700 text-sm">
          <strong>COPE Guidelines:</strong> {isSpanish 
            ? 'Los cambios sustanciales en metadatos (título, resumen, palabras clave, autores) requieren consentimiento del autor antes de ser aplicados.'
            : 'Substantial changes to metadata (title, abstract, keywords, authors) require author consent before being applied.'}
        </p>
      </div>

      {renderContent()}
    </div>
  );
};