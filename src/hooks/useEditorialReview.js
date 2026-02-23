// src/hooks/useEditorialReview.js (VERSIÓN VERIFICADA)
import { useState, useCallback } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, getDoc, query, where, getDocs } from 'firebase/firestore';
import { useLanguage } from './useLanguage';

export const useEditorialReview = (user) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { language } = useLanguage();
  const isSpanish = language === 'es';

  /**
   * Inicia una nueva revisión editorial (desk review)
   */
  const startDeskReview = useCallback(async (submissionId) => {
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
        throw new Error(isSpanish ? 'No tienes permiso para iniciar una revisión editorial' : 'You do not have permission to start an editorial review');
      }

      // Verificar si ya existe una revisión editorial activa para este envío en la ronda 1
      const reviewsRef = collection(db, 'editorialReviews');
      const q = query(
        reviewsRef,
        where('submissionId', '==', submissionId),
        where('round', '==', 1),
        where('status', 'in', ['pending', 'in-progress'])
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // Ya existe una revisión en curso
        const existingReview = querySnapshot.docs[0];
        setLoading(false);
        return {
          success: true,
          existing: true,
          reviewId: existingReview.id,
          data: existingReview.data()
        };
      }

      // Crear una nueva revisión editorial
      const newReview = {
        submissionId,
        round: 1,
        status: 'pending',
        editorUid: user.uid,
        decision: null,
        feedbackToAuthor: '',
        commentsToEditorial: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        completedAt: null
      };

      const docRef = await addDoc(collection(db, 'editorialReviews'), newReview);

      setLoading(false);
      return { success: true, reviewId: docRef.id, data: newReview };

    } catch (err) {
      console.error('Error starting desk review:', err);
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  }, [user, isSpanish]);

  /**
   * Guarda la decisión de la revisión editorial en Firestore.
   * La Cloud Function `onEditorialReviewUpdated` se encarga del resto.
   */
  const submitDeskReviewDecision = useCallback(async (reviewId, decisionData) => {
    if (!user) {
      setError(isSpanish ? 'Usuario no autenticado' : 'User not authenticated');
      return { success: false, error: 'Usuario no autenticado' };
    }

    setLoading(true);
    setError(null);

    try {
      const reviewRef = doc(db, 'editorialReviews', reviewId);
      const reviewSnap = await getDoc(reviewRef);

      if (!reviewSnap.exists()) {
        throw new Error(isSpanish ? 'Revisión editorial no encontrada' : 'Editorial review not found');
      }

      const reviewData = reviewSnap.data();
      
      // Verificar que el editor que guarda es el mismo que inició la revisión (o tiene permisos)
      if (reviewData.editorUid !== user.uid) {
        // Podríamos permitir que Directores Generales también editen
        const userRoles = user.roles || [];
        const isGeneralDirector = userRoles.includes('Director General');
        
        if (!isGeneralDirector) {
          throw new Error(isSpanish ? 'No eres el editor asignado a esta revisión' : 'You are not the editor assigned to this review');
        }
      }

      const { decision, feedbackToAuthor, commentsToEditorial } = decisionData;

      // Validar que se haya seleccionado una decisión
      if (!decision) {
        throw new Error(isSpanish ? 'Debes seleccionar una decisión' : 'You must select a decision');
      }

      // Actualizar SOLO el documento de la revisión editorial en Firestore.
      // ¡No actualizamos el estado del envío aquí! Eso lo hará la Cloud Function.
      await updateDoc(reviewRef, {
        decision,
        feedbackToAuthor: feedbackToAuthor || '',
        commentsToEditorial: commentsToEditorial || '',
        status: 'completed',
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setLoading(false);
      return {
        success: true,
        message: isSpanish ? 'Decisión guardada. Procesando...' : 'Decision saved. Processing...'
      };

    } catch (err) {
      console.error('Error submitting desk review decision:', err);
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  }, [user, isSpanish]);

  return {
    loading,
    error,
    startDeskReview,
    submitDeskReviewDecision  // <--- AHORA SÍ ESTÁ EXPORTADA
  };
};