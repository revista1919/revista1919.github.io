// src/hooks/useMetadataRefinement.js
import { useState, useCallback } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, arrayUnion, serverTimestamp, getDoc, collection, addDoc, writeBatch, setDoc } from 'firebase/firestore';
import { useLanguage } from './useLanguage';

export const useMetadataRefinement = (user) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { language } = useLanguage();
  const isSpanish = language === 'es';

  // 1. PROPONER CAMBIOS (Crea un nuevo documento en la subcolección)
  const proposeChanges = useCallback(async (submissionId, changes) => {
    if (!user) {
      setError(isSpanish ? 'Usuario no autenticado' : 'User not authenticated');
      return { success: false, error: 'No autenticado' };
    }

    setLoading(true);
    setError(null);

    try {
      const submissionRef = doc(db, 'submissions', submissionId);
      const submissionSnap = await getDoc(submissionRef);
      
      if (!submissionSnap.exists()) {
        throw new Error(isSpanish ? 'Envío no encontrado' : 'Submission not found');
      }

      const submission = submissionSnap.data();

      const userRoles = user.roles || [];
      const isEditor = userRoles.includes('Director General') || 
                       userRoles.includes('Editor en Jefe') || 
                       userRoles.includes('Editor de Sección');
      
      if (!isEditor) {
        throw new Error(isSpanish ? 'No tienes permiso para proponer cambios' : 'No permission to propose changes');
      }

      // Crear la propuesta como un NUEVO DOCUMENTO en la subcolección
      const proposalRef = doc(collection(db, 'submissions', submissionId, 'metadataProposals'));
      
      const proposal = {
        proposedBy: user.uid,
        proposedByEmail: user.email,
        proposedAt: serverTimestamp(),
        changes: changes.map(c => ({
          field: c.field,
          currentValue: c.currentValue,
          proposedValue: c.proposedValue,
          reason: c.reason,
          requiresAuthorConsent: c.requiresAuthorConsent !== false
        })),
        status: 'pending-author', // Estado inicial
        authorResponse: null
      };

      await setDoc(proposalRef, proposal);

      // Log en auditLogs
      await addDoc(collection(submissionRef, 'auditLogs'), {
        action: 'metadata_changes_proposed',
        proposalId: proposalRef.id,
        changes: changes.map(c => ({ field: c.field, reason: c.reason })),
        by: user.uid,
        byEmail: user.email,
        timestamp: serverTimestamp()
      });

      setLoading(false);
      return { 
        success: true, 
        proposalId: proposalRef.id,
        message: isSpanish ? 'Propuesta enviada al autor' : 'Proposal sent to author'
      };

    } catch (err) {
      console.error('Error proposing changes:', err);
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  }, [user, isSpanish]);

  // 2. RESPONDER A PROPUESTA (Actualiza el documento de la propuesta)
  const respondToProposal = useCallback(async (submissionId, proposalId, accepted, comments = '') => {
    if (!user) {
      setError(isSpanish ? 'Usuario no autenticado' : 'User not authenticated');
      return { success: false, error: 'No autenticado' };
    }

    setLoading(true);
    setError(null);

    try {
      const proposalRef = doc(db, 'submissions', submissionId, 'metadataProposals', proposalId);
      const proposalSnap = await getDoc(proposalRef);
      
      if (!proposalSnap.exists()) {
        throw new Error(isSpanish ? 'Propuesta no encontrada' : 'Proposal not found');
      }

      const proposal = proposalSnap.data();
      
      // Verificar que sea el autor
      const submissionRef = doc(db, 'submissions', submissionId);
      const submissionSnap = await getDoc(submissionRef);
      
      if (!submissionSnap.exists()) {
        throw new Error(isSpanish ? 'Envío no encontrado' : 'Submission not found');
      }
      
      if (submissionSnap.data().authorUID !== user.uid) {
        throw new Error(isSpanish ? 'No eres el autor de este artículo' : 'You are not the author of this article');
      }

      if (proposal.status !== 'pending-author') {
        throw new Error(isSpanish ? 'Esta propuesta ya no está pendiente' : 'This proposal is no longer pending');
      }

      const authorResponse = {
        accepted,
        comments,
        respondedAt: serverTimestamp(),
        respondedBy: user.uid,
        respondedByEmail: user.email
      };

      await updateDoc(proposalRef, {
        authorResponse: authorResponse,
        status: accepted ? 'approved' : 'rejected'
      });

      await addDoc(collection(submissionRef, 'auditLogs'), {
        action: accepted ? 'metadata_changes_accepted' : 'metadata_changes_rejected',
        proposalId,
        comments,
        by: user.uid,
        byEmail: user.email,
        timestamp: serverTimestamp()
      });

      setLoading(false);
      return { success: true };

    } catch (err) {
      console.error('Error responding to proposal:', err);
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  }, [user, isSpanish]);

  // 3. APLICAR CAMBIOS (Usa los cambios de una propuesta APROBADA)
  const applyApprovedChanges = useCallback(async (submissionId, proposalId) => {
    if (!user) {
      setError(isSpanish ? 'Usuario no autenticado' : 'User not authenticated');
      return { success: false, error: 'No autenticado' };
    }

    setLoading(true);
    setError(null);

    try {
      const submissionRef = doc(db, 'submissions', submissionId);
      const proposalRef = doc(db, 'submissions', submissionId, 'metadataProposals', proposalId);
      
      const [submissionSnap, proposalSnap] = await Promise.all([
        getDoc(submissionRef),
        getDoc(proposalRef)
      ]);
      
      if (!submissionSnap.exists() || !proposalSnap.exists()) {
        throw new Error(isSpanish ? 'Envío o propuesta no encontrados' : 'Submission or proposal not found');
      }

      const submission = submissionSnap.data();
      const proposal = proposalSnap.data();

      // Verificar permisos de editor
      const userRoles = user.roles || [];
      const isEditor = userRoles.includes('Director General') || 
                       userRoles.includes('Editor en Jefe') || 
                       userRoles.includes('Editor de Sección');
      
      if (!isEditor) {
        throw new Error(isSpanish ? 'No tienes permiso para aplicar cambios' : 'No permission to apply changes');
      }

      // Verificar que la propuesta esté aprobada
      if (proposal.status !== 'approved') {
        throw new Error(isSpanish ? 'Solo se pueden aplicar propuestas aprobadas' : 'Only approved proposals can be applied');
      }

      const currentMetadata = submission.currentMetadata || submission.originalSubmission || {};
      
      const newVersion = {
        version: (submission.metadataVersions?.length || 0) + 1,
        appliedBy: user.uid,
        appliedByEmail: user.email,
        appliedAt: new Date().toISOString(),
        proposalId: proposalId,
        changes: proposal.changes,
        data: { ...currentMetadata }
      };

      // Aplicar los cambios
      proposal.changes.forEach(change => {
        newVersion.data[change.field] = change.proposedValue;
      });

      // Usar batch para operaciones atómicas
      const batch = writeBatch(db);
      
      batch.update(submissionRef, {
        currentMetadata: newVersion.data,
        updatedAt: serverTimestamp()
      });
      
      batch.update(submissionRef, {
        metadataVersions: arrayUnion(newVersion)
      });
      
      await batch.commit();

      // Log en auditLogs
      await addDoc(collection(submissionRef, 'auditLogs'), {
        action: 'metadata_changes_applied',
        proposalId,
        version: newVersion.version,
        changes: proposal.changes,
        by: user.uid,
        byEmail: user.email,
        timestamp: serverTimestamp()
      });

      setLoading(false);
      return { 
        success: true, 
        version: newVersion.version,
        message: isSpanish ? 'Cambios aplicados exitosamente' : 'Changes applied successfully'
      };

    } catch (err) {
      console.error('Error applying changes:', err);
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  }, [user, isSpanish]);

  // 4. MARCAR COMO LISTO PARA PUBLICACIÓN
  const markAsReadyForPublication = useCallback(async (submissionId) => {
    if (!user) {
      setError(isSpanish ? 'Usuario no autenticado' : 'User not authenticated');
      return { success: false, error: 'No autenticado' };
    }

    setLoading(true);
    setError(null);

    try {
      const submissionRef = doc(db, 'submissions', submissionId);
      const submissionSnap = await getDoc(submissionRef);
      
      if (!submissionSnap.exists()) {
        throw new Error(isSpanish ? 'Envío no encontrado' : 'Submission not found');
      }

      // Verificar permisos de editor
      const userRoles = user.roles || [];
      const isEditor = userRoles.includes('Director General') || 
                       userRoles.includes('Editor en Jefe') || 
                       userRoles.includes('Editor de Sección');
      
      if (!isEditor) {
        throw new Error(isSpanish ? 'No tienes permiso para realizar esta acción' : 'No permission to perform this action');
      }

      // Actualizar el documento principal
      await updateDoc(submissionRef, {
        publicationReady: true,
        publicationReadyAt: serverTimestamp(),
        publicationReadyBy: user.uid,
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(submissionRef, 'auditLogs'), {
        action: 'marked_ready_for_publication',
        by: user.uid,
        byEmail: user.email,
        timestamp: serverTimestamp()
      });

      setLoading(false);
      return { 
        success: true, 
        message: isSpanish ? 'Artículo marcado como listo para publicación' : 'Article marked as ready for publication'
      };

    } catch (err) {
      console.error('Error marking as ready:', err);
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  }, [user, isSpanish]);

  return {
    loading,
    error,
    proposeChanges,
    respondToProposal,
    applyApprovedChanges,
    markAsReadyForPublication
  };
};