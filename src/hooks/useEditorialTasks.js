// src/hooks/useEditorialTasks.js (VERSIÓN VERIFICADA)
import { useState, useCallback } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, getDoc, addDoc, updateDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { useLanguage } from './useLanguage';

export const TASK_STATES = {
  PENDING: 'pending',
  DESK_REVIEW_IN_PROGRESS: 'desk-review-in-progress',
  REVIEWER_SELECTION: 'reviewer-selection',
  AWAITING_REVIEWER_RESPONSES: 'awaiting-reviewer-responses',
  REVIEWS_IN_PROGRESS: 'reviews-in-progress',
  REVIEWS_COMPLETED: 'reviews-completed',
  AWAITING_DECISION: 'awaiting-decision',
  COMPLETED: 'completed',
  REVISION_REQUESTED: 'revision-requested'
};

export const useEditorialTasks = (user) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { language } = useLanguage();
  const isSpanish = language === 'es';

  const getMyTasks = useCallback(async () => {
    if (!user) return { success: false, error: 'No user' };
    setLoading(true);
    try {
      const q = query(
        collection(db, 'editorialTasks'),
        where('assignedTo', '==', user.uid),
        where('status', 'not-in', [TASK_STATES.COMPLETED]),
        orderBy('assignedAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const tasks = [];
      for (const docSnap of snapshot.docs) {
        const taskData = docSnap.data();
        const submissionSnap = await getDoc(doc(db, 'submissions', taskData.submissionId));
        
        // Contar revisiones para esta tarea
        const reviewsQuery = query(
          collection(db, 'reviewerAssignments'),
          where('editorialTaskId', '==', docSnap.id)
        );
        const reviewsSnap = await getDocs(reviewsQuery);
        
        tasks.push({
          id: docSnap.id,
          ...taskData,
          submission: submissionSnap.exists() ? { id: submissionSnap.id, ...submissionSnap.data() } : null,
          reviewStats: {
            total: reviewsSnap.size,
            accepted: reviewsSnap.docs.filter(d => d.data().status !== 'declined').length,
            submitted: reviewsSnap.docs.filter(d => d.data().status === 'submitted').length
          }
        });
      }
      return { success: true, tasks };
    } catch (err) {
      console.error('Error getting tasks:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [user]);

  const getTaskById = useCallback(async (taskId) => {
    setLoading(true);
    try {
      const taskSnap = await getDoc(doc(db, 'editorialTasks', taskId));
      if (!taskSnap.exists()) throw new Error('Task not found');
      const taskData = taskSnap.data();
      const submissionSnap = await getDoc(doc(db, 'submissions', taskData.submissionId));
      
      // Obtener revisiones
      const reviewsQuery = query(
        collection(db, 'reviewerAssignments'),
        where('editorialTaskId', '==', taskId)
      );
      const reviewsSnap = await getDocs(reviewsQuery);
      const reviews = reviewsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      return {
        success: true,
        task: {
          id: taskSnap.id,
          ...taskData,
          submission: submissionSnap.exists() ? { id: submissionSnap.id, ...submissionSnap.data() } : null,
          reviews
        }
      };
    } catch (err) {
      console.error('Error getting task:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Inicia la revisión editorial y GUARDA el ID de la review en la tarea
   */
  const startDeskReview = useCallback(async (taskId) => {
    if (!user) return { success: false, error: 'No user' };
    setLoading(true);
    try {
      const taskRef = doc(db, 'editorialTasks', taskId);
      const taskSnap = await getDoc(taskRef);
      if (!taskSnap.exists()) throw new Error('Task not found');
      if (taskSnap.data().assignedTo !== user.uid) throw new Error('Not authorized');

      // Crear la editorialReview (con editorialTaskId)
      const reviewData = {
        submissionId: taskSnap.data().submissionId,
        editorialTaskId: taskId,  // <--- GUARDAR EL ID DE LA TAREA EN LA REVIEW
        round: 1,
        status: 'in-progress',
        editorUid: user.uid,
        decision: null,
        feedbackToAuthor: '',
        commentsToEditorial: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      const reviewRef = await addDoc(collection(db, 'editorialReviews'), reviewData);

      // Actualizar la tarea con el ID de la review
      await updateDoc(taskRef, {
        status: TASK_STATES.DESK_REVIEW_IN_PROGRESS,
        editorialReviewId: reviewRef.id,  // <--- GUARDAR EL ID DE LA REVIEW EN LA TAREA
        updatedAt: serverTimestamp()
      });

      return { success: true, reviewId: reviewRef.id };
    } catch (err) {
      console.error('Error starting desk review:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [user]);

  const makeFinalDecision = useCallback(async (taskId, decisionData) => {
    if (!user) return { success: false, error: 'No user' };
    setLoading(true);
    try {
      const taskRef = doc(db, 'editorialTasks', taskId);
      const taskSnap = await getDoc(taskRef);
      if (!taskSnap.exists()) throw new Error('Task not found');

      const { decision, feedbackToAuthor, commentsToEditorial } = decisionData;

      // Actualizar submission
      const submissionRef = doc(db, 'submissions', taskSnap.data().submissionId);
      let submissionStatus;
      if (decision === 'accept') {
        submissionStatus = 'accepted';
      } else if (decision === 'reject') {
        submissionStatus = 'rejected';
      } else if (decision === 'major-revision') {
        submissionStatus = 'major-revision-required';
      } else if (decision === 'minor-revision') {
        submissionStatus = 'minor-revision-required';
      }

      await updateDoc(submissionRef, {
        status: submissionStatus,
        finalDecision: decision,
        finalFeedback: feedbackToAuthor,
        decisionMadeBy: user.uid,
        decisionMadeAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Actualizar tarea
      await updateDoc(taskRef, {
        status: TASK_STATES.COMPLETED,
        finalDecision: decision,
        finalFeedbackToAuthor: feedbackToAuthor,
        finalComments: commentsToEditorial,
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      return { success: true };
    } catch (err) {
      console.error('Error making final decision:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    loading,
    error,
    getMyTasks,
    getTaskById,
    startDeskReview,
    makeFinalDecision,
    TASK_STATES
  };
};