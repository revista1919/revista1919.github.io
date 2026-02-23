// src/hooks/useReviewerAssignment.js (VERSIÓN CORREGIDA - COMPLETA)
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
  orderBy,
  limit 
} from 'firebase/firestore';
import { useLanguage } from './useLanguage';

export const useReviewerAssignment = (user) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { language } = useLanguage();
  const isSpanish = language === 'es';

  const getReviewerAssignments = useCallback(async (editorialTaskId) => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'reviewerAssignments'),
        where('editorialTaskId', '==', editorialTaskId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const assignments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      return { success: true, assignments };
    } catch (err) {
      console.error('Error getting reviewer assignments:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const getReviewerAssignmentById = useCallback(async (assignmentId) => {
    setLoading(true);
    try {
      const docRef = doc(db, 'reviewerAssignments', assignmentId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { success: true, assignment: { id: docSnap.id, ...docSnap.data() } };
      } else {
        return { success: false, error: 'Assignment not found' };
      }
    } catch (err) {
      console.error('Error getting reviewer assignment:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const getReviewerAssignmentsByEmail = useCallback(async (email) => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'reviewerAssignments'),
        where('reviewerEmail', '==', email),
        where('status', 'in', ['pending', 'in-progress', 'submitted'])
      );
      const snapshot = await getDocs(q);
      const assignments = [];
      
      for (const docSnap of snapshot.docs) {
        const assignment = { id: docSnap.id, ...docSnap.data() };
        // Obtener el submission asociado
        const submissionSnap = await getDoc(doc(db, 'submissions', assignment.submissionId));
        if (submissionSnap.exists()) {
          assignment.submission = { id: submissionSnap.id, ...submissionSnap.data() };
        }
        assignments.push(assignment);
      }
      
      return { success: true, assignments };
    } catch (err) {
      console.error('Error getting reviewer assignments by email:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const autoSaveReview = useCallback(async (assignmentId, reviewData) => {
    try {
      const assignmentRef = doc(db, 'reviewerAssignments', assignmentId);
      await updateDoc(assignmentRef, {
        ...reviewData,
        lastAutoSave: serverTimestamp()
      });
      return { success: true };
    } catch (err) {
      console.error('Error auto-saving review:', err);
      return { success: false, error: err.message };
    }
  }, []);

  const submitReview = useCallback(async (assignmentId, reviewData) => {
    setLoading(true);
    setError(null);
    try {
      const assignmentRef = doc(db, 'reviewerAssignments', assignmentId);
      const assignmentSnap = await getDoc(assignmentRef);
      
      if (!assignmentSnap.exists()) {
        throw new Error(isSpanish ? 'Asignación no encontrada' : 'Assignment not found');
      }

      const assignment = assignmentSnap.data();
      
      if (assignment.reviewerUid && assignment.reviewerUid !== user?.uid) {
        throw new Error(isSpanish ? 'No tienes permiso para enviar esta revisión' : 'You do not have permission to submit this review');
      }

      if (assignment.status === 'submitted') {
        throw new Error(isSpanish ? 'Esta revisión ya fue enviada' : 'This review has already been submitted');
      }

      // Validar que todos los campos requeridos estén presentes
      const { scores, commentsToAuthor, commentsToEditor, recommendation } = reviewData;
      
      if (!scores || Object.keys(scores).length === 0) {
        throw new Error(isSpanish ? 'Debes completar la evaluación' : 'You must complete the evaluation');
      }
      
      if (!commentsToAuthor || commentsToAuthor.replace(/<[^>]*>/g, '').trim() === '') {
        throw new Error(isSpanish ? 'Los comentarios para el autor son requeridos' : 'Comments for author are required');
      }
      
      if (!commentsToEditor || commentsToEditor.replace(/<[^>]*>/g, '').trim() === '') {
        throw new Error(isSpanish ? 'Los comentarios confidenciales son requeridos' : 'Confidential comments are required');
      }
      
      if (!recommendation) {
        throw new Error(isSpanish ? 'Debes seleccionar una recomendación' : 'You must select a recommendation');
      }

      await updateDoc(assignmentRef, {
        ...reviewData,
        status: 'submitted',
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // --- CORREGIDO: Usar sintaxis modular de Firebase v9 ---
      // Actualizar el deadline asociado
      const deadlinesQuery = query(
        collection(db, 'deadlines'),
        where('targetId', '==', assignmentId),
        where('type', '==', 'review-submission'),
        limit(1)
      );
      
      const deadlinesSnapshot = await getDocs(deadlinesQuery);
      
      if (!deadlinesSnapshot.empty) {
        await updateDoc(doc(db, 'deadlines', deadlinesSnapshot.docs[0].id), {
          status: 'completed',
          completedAt: serverTimestamp()
        });
      }

      // Actualizar la tarea editorial
      const taskRef = doc(db, 'editorialTasks', assignment.editorialTaskId);
      const taskSnap = await getDoc(taskRef);
      
      if (taskSnap.exists()) {
        const taskData = taskSnap.data();
        const currentSubmitted = taskData.reviewsSubmitted || 0;
        const newSubmittedCount = currentSubmitted + 1;
        
        await updateDoc(taskRef, {
          reviewsSubmitted: newSubmittedCount,
          updatedAt: serverTimestamp()
        });
        
        // Si ya se alcanzó el mínimo de revisiones, cambiar el estado de la tarea
        if (newSubmittedCount >= (taskData.requiredReviewers || 2)) {
          await updateDoc(taskRef, {
            status: 'awaiting-decision',
            updatedAt: serverTimestamp()
          });
        }
      }

      return { success: true };
    } catch (err) {
      console.error('Error submitting review:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [user, isSpanish]);

  return {
    loading,
    error,
    getReviewerAssignments,
    getReviewerAssignmentById,
    getReviewerAssignmentsByEmail,
    autoSaveReview,
    submitReview
  };
};