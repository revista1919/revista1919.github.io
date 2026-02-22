import { useState, useCallback } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, getDoc, query, where, getDocs } from 'firebase/firestore';
import { useLanguage } from './useLanguage';

// Función para generar hash único en el navegador
const generateInviteHash = () => {
  // 20 bytes aleatorios (160 bits) es suficiente para invitaciones
  const array = new Uint8Array(20);
  window.crypto.getRandomValues(array);
  
  // Convertir a hexadecimal
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

export const useReviewerInvitation = (user) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { language } = useLanguage();
  const isSpanish = language === 'es';

  const sendInvitation = useCallback(async ({ 
    editorialReviewId, 
    submissionId, 
    round = 1, 
    reviewerEmail, 
    reviewerName,
    expiresInDays = 7
  }) => {
    if (!user) {
      setError(isSpanish ? 'Usuario no autenticado' : 'User not authenticated');
      return { success: false, error: 'Usuario no autenticado' };
    }

    setLoading(true);
    setError(null);

    try {
      // Verificar permisos de editor
      const userRoles = user.roles || [];
      const isEditor = userRoles.includes('Director General') || userRoles.includes('Editor en Jefe');
      if (!isEditor) {
        throw new Error(isSpanish ? 'No tienes permiso para invitar revisores' : 'You do not have permission to invite reviewers');
      }

      // Validar email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(reviewerEmail)) {
        throw new Error(isSpanish ? 'Email de revisor inválido' : 'Invalid reviewer email');
      }

      // Verificar si ya se invitó a este revisor para esta ronda
      const invitationsRef = collection(db, 'reviewerInvitations');
      const q = query(
        invitationsRef,
        where('editorialReviewId', '==', editorialReviewId),
        where('reviewerEmail', '==', reviewerEmail),
        where('round', '==', round)
      );
      const existingInvites = await getDocs(q);

      if (!existingInvites.empty) {
        throw new Error(isSpanish ? 'Este revisor ya ha sido invitado para esta ronda' : 'This reviewer has already been invited for this round');
      }

      const inviteHash = generateInviteHash();
      
      // Calcular fecha de expiración (en el cliente por ahora)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      const invitationData = {
        editorialReviewId,
        submissionId,
        round,
        reviewerEmail,
        reviewerName: reviewerName || '',
        inviteHash,
        status: 'pending',
        conflictOfInterest: null,
        respondedAt: null,
        expiresAt: expiresAt.toISOString(), // Guardar como string ISO por ahora
        createdAt: serverTimestamp(),
        invitedBy: user.uid
      };

      const docRef = await addDoc(collection(db, 'reviewerInvitations'), invitationData);

      // Log para pruebas - aquí irá el envío de email real después
      const inviteLink = `/reviewer-response?hash=${inviteHash}&lang=${isSpanish ? 'es' : 'en'}`;
      console.log(`[INVITE] Enlace de invitación generado: ${inviteLink}`);
      console.log(`[INVITE] Email del revisor: ${reviewerEmail}`);

      setLoading(false);
      return { 
        success: true, 
        invitationId: docRef.id,
        inviteHash,
        inviteLink
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

      // Verificar si la invitación ha expirado (necesitaríamos un cálculo con serverTimestamp)
      // Esto es más fácil de hacer en el backend, pero podemos hacer una comprobación básica aquí si guardamos expiresAt como fecha.

      return { 
        success: true, 
        found: true,
        invitationId: invitationDoc.id,
        data: invitationData 
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

      const updateData = {
        status: accept ? 'accepted' : 'declined',
        conflictOfInterest: conflictOfInterest || null,
        respondedAt: serverTimestamp()
      };

      await updateDoc(invitationRef, updateData);

      setLoading(false);
      return { success: true, newStatus: updateData.status };

    } catch (err) {
      console.error('Error responding to invitation:', err);
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  }, [isSpanish]);

  return {
    loading,
    error,
    sendInvitation,
    getInvitationByHash,
    respondToInvitation
  };
};