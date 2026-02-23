// src/hooks/useMetadataRefinement.js
import { useState, useCallback } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, arrayUnion, serverTimestamp, getDoc, collection, addDoc } from 'firebase/firestore';
import { useLanguage } from './useLanguage';

export const useMetadataRefinement = (user) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { language } = useLanguage();
  const isSpanish = language === 'es';

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
        status: 'pending-author',
        authorResponse: null
      };

      await updateDoc(submissionRef, {
        'metadataRefinement': proposal,
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(submissionRef, 'auditLogs'), {
        action: 'metadata_changes_proposed',
        changes: changes.map(c => ({ field: c.field, reason: c.reason })),
        by: user.uid,
        byEmail: user.email,
        timestamp: serverTimestamp()
      });

      setLoading(false);
      return { 
        success: true, 
        message: isSpanish ? 'Propuesta enviada al autor' : 'Proposal sent to author'
      };

    } catch (err) {
      console.error('Error proposing changes:', err);
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  }, [user, isSpanish]);

  const respondToProposal = useCallback(async (submissionId, accepted, comments = '') => {
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
      
      if (submission.authorUID !== user.uid) {
        throw new Error(isSpanish ? 'No eres el autor de este artículo' : 'You are not the author of this article');
      }

      if (!submission.metadataRefinement || submission.metadataRefinement.status !== 'pending-author') {
        throw new Error(isSpanish ? 'No hay propuesta pendiente' : 'No pending proposal');
      }

      const authorResponse = {
        accepted,
        comments,
        respondedAt: serverTimestamp(),
        respondedBy: user.uid,
        respondedByEmail: user.email
      };

      await updateDoc(submissionRef, {
        'metadataRefinement.authorResponse': authorResponse,
        'metadataRefinement.status': accepted ? 'pending-editor' : 'rejected',
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(submissionRef, 'auditLogs'), {
        action: accepted ? 'metadata_changes_accepted' : 'metadata_changes_rejected',
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

  const applyApprovedChanges = useCallback(async (submissionId) => {
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
      const proposal = submission.metadataRefinement;

      if (!proposal.authorResponse?.accepted) {
        throw new Error(isSpanish ? 'El autor no ha aprobado los cambios' : 'Author has not approved the changes');
      }

      const userRoles = user.roles || [];
      const isEditor = userRoles.includes('Director General') || 
                       userRoles.includes('Editor en Jefe') || 
                       userRoles.includes('Editor de Sección');
      
      if (!isEditor) {
        throw new Error(isSpanish ? 'No tienes permiso para aplicar cambios' : 'No permission to apply changes');
      }

      const currentMetadata = submission.currentMetadata || submission.originalSubmission;
      
      const newVersion = {
        version: (submission.metadataVersions?.length || 0) + 1,
        approvedBy: user.uid,
        approvedByEmail: user.email,
        approvedAt: serverTimestamp(),
        changes: proposal.changes,
        data: { ...currentMetadata }
      };

      proposal.changes.forEach(change => {
        if (change.requiresAuthorConsent !== false) {
          newVersion.data[change.field] = change.proposedValue;
        }
      });

      await updateDoc(submissionRef, {
        metadataVersions: arrayUnion(newVersion),
        currentMetadata: newVersion.data,
        'metadataRefinement.status': 'approved',
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(submissionRef, 'auditLogs'), {
        action: 'metadata_changes_applied',
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

  return {
    loading,
    error,
    proposeChanges,
    respondToProposal,
    applyApprovedChanges
  };
};