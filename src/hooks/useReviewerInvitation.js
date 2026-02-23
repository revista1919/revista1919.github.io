// src/hooks/useReviewerInvitation.js (VERSIÓN CORREGIDA - COMPLETA)
import { useState, useCallback } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  query, 
  where, 
  getDocs, 
  getDoc,
  limit // <-- IMPORTANTE: Añadir limit para las consultas
} from 'firebase/firestore';
import { useLanguage } from './useLanguage';
import { useAuth } from './useAuth'; // <-- Importar useAuth para obtener el usuario

// Función para generar hash único en el navegador
const generateInviteHash = () => {
  const array = new Uint8Array(20);
  window.crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
};

export const useReviewerInvitation = () => { // <-- ELIMINADO: user como parámetro
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { language } = useLanguage();
  const { user } = useAuth(); // <-- AÑADIDO: Obtener usuario del hook
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
      return { success: false, error: isSpanish ? 'Usuario no autenticado' : 'User not authenticated' };
    }

    setLoading(true);
    setError(null);

    try {
      const userRoles = user.roles || [];
      const isEditor = userRoles.includes('Director General') || 
                       userRoles.includes('Editor en Jefe') || 
                       userRoles.includes('Editor de Sección');
      
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
          where('round', '==', round),
          limit(1)
        );
      } else if (editorialTaskId) {
        q = query(
          invitationsRef,
          where('editorialTaskId', '==', editorialTaskId),
          where('reviewerEmail', '==', reviewerEmail),
          where('round', '==', round),
          limit(1)
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
        expiresAt: expiresAt, // <-- IMPORTANTE: Guardar como Date, Firestore lo convierte automáticamente
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

  // ==================== CORREGIDO: getInvitationByHash ====================
  const getInvitationByHash = useCallback(async (hash) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 Buscando invitación con hash:', hash);
      
      const invitationsRef = collection(db, 'reviewerInvitations');
      
      // IMPORTANTE: Usar limit(1) para optimizar
      const q = query(
        invitationsRef, 
        where('inviteHash', '==', hash),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.log('❌ No se encontró invitación con ese hash');
        return { 
          success: false, 
          found: false, 
          error: isSpanish ? 'Invitación no válida' : 'Invalid invitation' 
        };
      }

      const invitationDoc = querySnapshot.docs[0];
      const invitationData = invitationDoc.data();

      // Verificar expiración
      const now = new Date();
      
      // Manejar expiresAt correctamente (puede ser Timestamp o Date)
      let expiresAt = invitationData.expiresAt;
      if (expiresAt && typeof expiresAt.toDate === 'function') {
        expiresAt = expiresAt.toDate();
      }
      
      if (expiresAt && expiresAt < now) {
        console.log('⏰ Invitación expirada');
        return { 
          success: false, 
          found: false, 
          error: isSpanish ? 'Esta invitación ha expirado' : 'This invitation has expired' 
        };
      }

      // Obtener datos del submission asociado (opcional, para mostrar más info)
      let submission = null;
      if (invitationData.submissionId) {
        try {
          // Intentar obtener el submission, pero si falla, continuar sin él
          const submissionDoc = await getDoc(doc(db, 'submissions', invitationData.submissionId));
          if (submissionDoc.exists()) {
            submission = {
              id: submissionDoc.id,
              title: submissionDoc.data().title,
              abstract: submissionDoc.data().abstract,
              area: submissionDoc.data().area
            };
          }
        } catch (subError) {
          console.warn('⚠️ No se pudo obtener el submission:', subError.message);
          // No fallamos la operación principal por esto
        }
      }

      console.log('✅ Invitación encontrada:', invitationDoc.id);

      return {
        success: true,
        found: true,
        invitationId: invitationDoc.id,
        data: { 
          id: invitationDoc.id, 
          ...invitationData,
          submission, // Añadir datos del submission si se obtuvieron
          expiresAt: expiresAt // Asegurar que sea Date
        }
      };

    } catch (err) {
      console.error('❌ Error getting invitation by hash:', err);
      
      // Mensaje de error más amigable según el código
      let errorMessage = err.message;
      if (err.code === 'permission-denied') {
        errorMessage = isSpanish 
          ? 'No tienes permiso para acceder a esta invitación' 
          : 'You do not have permission to access this invitation';
      } else if (err.code === 'unavailable' || err.code === 'deadline-exceeded') {
        errorMessage = isSpanish 
          ? 'Servicio no disponible. Intenta nuevamente.' 
          : 'Service unavailable. Please try again.';
      } else if (err.code === 'not-found') {
        errorMessage = isSpanish 
          ? 'Invitación no encontrada' 
          : 'Invitation not found';
      }
      
      setError(errorMessage);
      setLoading(false);
      return { 
        success: false, 
        error: errorMessage 
      };
    } finally {
      setLoading(false);
    }
  }, [isSpanish]);

  // ==================== CORREGIDO: respondToInvitation ====================
  // ==================== CORREGIDO: respondToInvitation ====================
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
    
    // Verificar expiración
    let expiresAt = invitationData.expiresAt;
    if (expiresAt && typeof expiresAt.toDate === 'function') {
      expiresAt = expiresAt.toDate();
    }
    
    const now = new Date();
    if (expiresAt && expiresAt < now) {
      throw new Error(isSpanish ? 'Esta invitación ha expirado' : 'This invitation has expired');
    }

    if (invitationData.status !== 'pending') {
      throw new Error(isSpanish ? 'Esta invitación ya ha sido procesada' : 'This invitation has already been processed');
    }

    const updatePayload = {
      status: accept ? 'accepted' : 'declined',
      conflictOfInterest: conflictOfInterest || null,
      respondedAt: serverTimestamp(),
      // --- ¡IMPORTANTE! Incluir el inviteHash para que las reglas permitan la actualización ---
      inviteHash: invitationData.inviteHash
    };

    // Si el usuario está autenticado, guardar su UID
    if (user) {
      updatePayload.reviewerUid = user.uid;
      updatePayload.reviewerEmail = user.email || invitationData.reviewerEmail;
    } else {
      updatePayload.respondedAnonymously = true;
    }

    // Actualizar la invitación
    await updateDoc(invitationRef, updatePayload);

    console.log(`✅ Invitación ${invitationId} respondida: ${accept ? 'aceptada' : 'rechazada'}`);

    setLoading(false);
    return { 
      success: true, 
      newStatus: updatePayload.status 
    };

  } catch (err) {
    console.error('❌ Error responding to invitation:', err);
    
    let errorMessage = err.message;
    if (err.code === 'permission-denied') {
      errorMessage = isSpanish 
        ? 'No tienes permiso para responder esta invitación' 
        : 'You do not have permission to respond to this invitation';
    }
    
    setError(errorMessage);
    setLoading(false);
    return { success: false, error: errorMessage };
  }
}, [user, isSpanish]);
  // ==================== NUEVA FUNCIÓN: checkExistingResponse ====================
  const checkExistingResponse = useCallback(async (email, submissionId, round) => {
    setLoading(true);
    
    try {
      // Esta función solo debe llamarse cuando el usuario está autenticado (editor)
      if (!user) {
        return { hasResponded: false };
      }
      
      const invitationsRef = collection(db, 'reviewerInvitations');
      const q = query(
        invitationsRef,
        where('reviewerEmail', '==', email),
        where('submissionId', '==', submissionId),
        where('round', '==', round),
        where('status', 'in', ['accepted', 'declined']),
        limit(1)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return { hasResponded: false };
      }
      
      const invitation = snapshot.docs[0].data();
      
      return {
        hasResponded: true,
        status: invitation.status,
        respondedAt: invitation.respondedAt?.toDate?.() || invitation.respondedAt
      };
      
    } catch (err) {
      console.error('Error checking existing response:', err);
      return { hasResponded: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    loading,
    error,
    sendInvitation,
    getInvitationByHash,
    respondToInvitation,
    checkExistingResponse // <-- EXPORTAR nueva función
  };
};