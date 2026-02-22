// src/hooks/useEditorialReview.js
import { useState, useCallback } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, getDoc, query, where, getDocs } from 'firebase/firestore';
import { useLanguage } from './useLanguage';

export const useEditorialReview = (user) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { language } = useLanguage();
  const isSpanish = language === 'es';

  const startDeskReview = useCallback(async (submissionId) => {
    if (!user) {
      setError(isSpanish ? 'Usuario no autenticado' : 'User not authenticated');
      return { success: false, error: 'Usuario no autenticado' };
    }

    setLoading(true);
    setError(null);

    try {
      // Verificar que el usuario sea editor (Director o Editor en Jefe)
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

      // Actualizar el estado del envío
      const submissionRef = doc(db, 'submissions', submissionId);
      await updateDoc(submissionRef, {
        status: 'in-editorial-review',
        updatedAt: serverTimestamp()
      });

      setLoading(false);
      return { success: true, reviewId: docRef.id, data: newReview };

    } catch (err) {
      console.error('Error starting desk review:', err);
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  }, [user, isSpanish]);

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
      if (reviewData.editorUid !== user.uid) {
        throw new Error(isSpanish ? 'No eres el editor asignado a esta revisión' : 'You are not the editor assigned to this review');
      }

      const { decision, feedbackToAuthor, commentsToEditorial } = decisionData;
      let newSubmissionStatus = 'submitted'; // Por defecto

      // Mapear la decisión al nuevo estado del envío
      switch (decision) {
        case 'reject':
          newSubmissionStatus = 'rejected';
          break;
        case 'minor-revision':
          newSubmissionStatus = 'revision-required';
          break;
        case 'revision-required':
          newSubmissionStatus = 'in-reviewer-selection'; // Nuevo estado: buscando revisores
          break;
        case 'accept':
          newSubmissionStatus = 'accepted';
          break;
        default:
          newSubmissionStatus = 'in-editorial-review';
      }

      // Actualizar la revisión editorial
      await updateDoc(reviewRef, {
        decision,
        feedbackToAuthor: feedbackToAuthor || '',
        commentsToEditorial: commentsToEditorial || '',
        status: 'completed',
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Actualizar el estado del envío
      const submissionRef = doc(db, 'submissions', reviewData.submissionId);
      await updateDoc(submissionRef, {
        status: newSubmissionStatus,
        updatedAt: serverTimestamp()
      });

      setLoading(false);
      return { 
        success: true, 
        newSubmissionStatus,
        submissionId: reviewData.submissionId
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
    submitDeskReviewDecision
  };
};