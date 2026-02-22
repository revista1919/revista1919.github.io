// src/hooks/useReviewerInvitation.js
import { useState, useCallback } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, getDocs, getDoc } from 'firebase/firestore';
import { useLanguage } from './useLanguage';

// Función para generar hash único en el navegador
const generateInviteHash = () => {
  const array = new Uint8Array(20);
  window.crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
};

export const useReviewerInvitation = (user) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { language } = useLanguage();
  const isSpanish = language === 'es';

  const sendInvitation = useCallback(async ({
    editorialTaskId,
    editorialReviewId,
    submissionId,
    round = 1,
    reviewerEmail,
    reviewerName,
    reviewerUid = null,
    expiresInDays = 7
  }) => {
    if (!user) {
      setError(isSpanish ? 'Usuario no autenticado' : 'User not authenticated');
      return { success: false, error: 'Usuario no autenticado' };
    }

    setLoading(true);
    setError(null);

    try {
      const userRoles = user.roles || [];
      const isEditor = userRoles.includes('Director General') || userRoles.includes('Editor en Jefe') || userRoles.includes('Editor de Sección');
      if (!isEditor) {
        throw new Error(isSpanish ? 'No tienes permiso para invitar revisores' : 'You do not have permission to invite reviewers');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(reviewerEmail)) {
        throw new Error(isSpanish ? 'Email de revisor inválido' : 'Invalid reviewer email');
      }

      const invitationsRef = collection(db, 'reviewerInvitations');
      let q;
      
      if (editorialReviewId) {
        q = query(
          invitationsRef,
          where('editorialReviewId', '==', editorialReviewId),
          where('reviewerEmail', '==', reviewerEmail),
          where('round', '==', round)
        );
      } else if (editorialTaskId) {
        q = query(
          invitationsRef,
          where('editorialTaskId', '==', editorialTaskId),
          where('reviewerEmail', '==', reviewerEmail),
          where('round', '==', round)
        );
      } else {
        throw new Error(isSpanish ? 'Se requiere editorialReviewId o editorialTaskId' : 'editorialReviewId or editorialTaskId is required');
      }

      const existingInvites = await getDocs(q);

      if (!existingInvites.empty) {
        throw new Error(isSpanish ? 'Este revisor ya ha sido invitado para esta ronda' : 'This reviewer has already been invited for this round');
      }

      const inviteHash = generateInviteHash();

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      const invitationData = {
        editorialTaskId: editorialTaskId || null,
        editorialReviewId: editorialReviewId || null,
        submissionId,
        round,
        reviewerEmail,
        reviewerName: reviewerName || '',
        reviewerUid,
        inviteHash,
        status: 'pending',
        conflictOfInterest: null,
        expiresAt: expiresAt,
        createdAt: serverTimestamp(),
        invitedBy: user.uid,
        invitedByEmail: user.email || ''
      };

      const docRef = await addDoc(collection(db, 'reviewerInvitations'), invitationData);

      setLoading(false);
      return {
        success: true,
        invitationId: docRef.id,
        inviteHash
      };

    } catch (err) {
      console.error('Error sending reviewer invitation:', err);
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  }, [user, isSpanish]);

  const getInvitationByHash = useCallback(async (hash) => {
    setLoading(true);
    setError(null);
    try {
      const invitationsRef = collection(db, 'reviewerInvitations');
      const q = query(invitationsRef, where('inviteHash', '==', hash));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return { success: false, found: false, error: isSpanish ? 'Invitación no válida' : 'Invalid invitation' };
      }

      const invitationDoc = querySnapshot.docs[0];
      const invitationData = invitationDoc.data();

      const now = new Date();
      if (invitationData.expiresAt && invitationData.expiresAt.toDate() < now) {
        return { success: false, found: false, error: isSpanish ? 'Esta invitación ha expirado' : 'This invitation has expired' };
      }

      return {
        success: true,
        found: true,
        invitationId: invitationDoc.id,
        data: { id: invitationDoc.id, ...invitationData }
      };

    } catch (err) {
      console.error('Error getting invitation by hash:', err);
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [isSpanish]);

  const respondToInvitation = useCallback(async (invitationId, response) => {
    setLoading(true);
    setError(null);
    try {
      const { accept, conflictOfInterest } = response;
      const invitationRef = doc(db, 'reviewerInvitations', invitationId);
      const invitationSnap = await getDoc(invitationRef);

      if (!invitationSnap.exists()) {
        throw new Error(isSpanish ? 'Invitación no encontrada' : 'Invitation not found');
      }

      const invitationData = invitationSnap.data();
      if (invitationData.status !== 'pending') {
        throw new Error(isSpanish ? 'Esta invitación ya ha sido procesada' : 'This invitation has already been processed');
      }

      const updatePayload = {
        status: accept ? 'accepted' : 'declined',
        conflictOfInterest: conflictOfInterest || null,
        respondedAt: serverTimestamp()
      };

      if (user) {
        updatePayload.reviewerUid = user.uid;
        updatePayload.reviewerEmail = user.email || invitationData.reviewerEmail;
      }

      await updateDoc(invitationRef, updatePayload);

      setLoading(false);
      return { success: true, newStatus: updatePayload.status };

    } catch (err) {
      console.error('Error responding to invitation:', err);
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  }, [user, isSpanish]);

  return {
    loading,
    error,
    sendInvitation,
    getInvitationByHash,
    respondToInvitation
  };
};