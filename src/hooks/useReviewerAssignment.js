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
  limit,
  writeBatch
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
      const assignments = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : data.dueDate
        };
      });
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
        const data = docSnap.data();
        return { 
          success: true, 
          assignment: { 
            id: docSnap.id, 
            ...data,
            dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : data.dueDate
          } 
        };
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
        const assignmentData = docSnap.data();
        
        const assignment = { 
          id: docSnap.id, 
          ...assignmentData,
          dueDate: assignmentData.dueDate?.toDate ? assignmentData.dueDate.toDate() : assignmentData.dueDate
        };
        
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
      if (!user) {
        throw new Error(isSpanish ? 'Debes iniciar sesión' : 'You must be logged in');
      }

      const assignmentRef = doc(db, 'reviewerAssignments', assignmentId);
      const assignmentSnap = await getDoc(assignmentRef);
      
      if (!assignmentSnap.exists()) {
        throw new Error(isSpanish ? 'Asignación no encontrada' : 'Assignment not found');
      }

      const assignment = assignmentSnap.data();
      
      const userEmail = user.email?.toLowerCase().trim();
      const assignmentEmail = assignment.reviewerEmail?.toLowerCase().trim();
      
      const hasPermission = (
        (assignment.reviewerUid && assignment.reviewerUid === user.uid) ||
        (assignment.reviewerEmail && userEmail === assignmentEmail)
      );
      
      if (!hasPermission) {
        throw new Error(isSpanish ? 'No tienes permiso para enviar esta revisión' : 'You do not have permission to submit this review');
      }

      if (assignment.status === 'submitted') {
        throw new Error(isSpanish ? 'Esta revisión ya fue enviada' : 'This review has already been submitted');
      }

      const { scores, commentsToAuthor, commentsToEditor, recommendation } = reviewData;
      
      if (!scores || Object.keys(scores).length === 0) {
        throw new Error(isSpanish ? 'Debes completar la evaluación' : 'You must complete the evaluation');
      }
      
      const cleanCommentsToAuthor = commentsToAuthor?.replace(/<[^>]*>/g, '').trim() || '';
      const cleanCommentsToEditor = commentsToEditor?.replace(/<[^>]*>/g, '').trim() || '';
      
      if (!cleanCommentsToAuthor) {
        throw new Error(isSpanish ? 'Los comentarios para el autor son requeridos' : 'Comments for author are required');
      }
      
      if (!cleanCommentsToEditor) {
        throw new Error(isSpanish ? 'Los comentarios confidenciales son requeridos' : 'Confidential comments are required');
      }
      
      if (!recommendation) {
        throw new Error(isSpanish ? 'Debes seleccionar una recomendación' : 'You must select a recommendation');
      }

      const batch = writeBatch(db);

      batch.update(assignmentRef, {
        scores,
        commentsToAuthor,
        commentsToEditor,
        recommendation,
        status: 'submitted',
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      const deadlinesQuery = query(
        collection(db, 'deadlines'),
        where('targetId', '==', assignmentId),
        where('type', '==', 'review-submission'),
        limit(1)
      );
      
      const deadlinesSnapshot = await getDocs(deadlinesQuery);
      
      if (!deadlinesSnapshot.empty) {
        batch.update(doc(db, 'deadlines', deadlinesSnapshot.docs[0].id), {
          status: 'completed',
          completedAt: serverTimestamp()
        });
      }

      const taskRef = doc(db, 'editorialTasks', assignment.editorialTaskId);
      const taskSnap = await getDoc(taskRef);
      
      if (taskSnap.exists()) {
        const taskData = taskSnap.data();
        const currentSubmitted = taskData.reviewsSubmitted || 0;
        const newSubmittedCount = currentSubmitted + 1;
        
        const taskUpdates = {
          reviewsSubmitted: newSubmittedCount,
          updatedAt: serverTimestamp()
        };
        
        if (newSubmittedCount >= (taskData.requiredReviewers || 2)) {
          taskUpdates.status = 'awaiting-decision';
        }
        
        batch.update(taskRef, taskUpdates);
      }

      await batch.commit();

      return { success: true };
    } catch (err) {
      console.error('Error submitting review:', err);
      
      if (err.code === 'permission-denied') {
        setError(isSpanish 
          ? 'No tienes permisos para realizar esta acción' 
          : 'You do not have permission to perform this action');
      } else {
        setError(err.message);
      }
      
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [user, isSpanish]);

  const createReviewerAssignment = useCallback(async (assignmentData) => {
    setLoading(true);
    try {
      const newAssignment = {
        ...assignmentData,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'reviewerAssignments'), newAssignment);
      return { success: true, id: docRef.id };
    } catch (err) {
      console.error('Error creating reviewer assignment:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const updateReviewerAssignment = useCallback(async (assignmentId, updateData) => {
    setLoading(true);
    try {
      const assignmentRef = doc(db, 'reviewerAssignments', assignmentId);
      await updateDoc(assignmentRef, {
        ...updateData,
        updatedAt: serverTimestamp()
      });
      return { success: true };
    } catch (err) {
      console.error('Error updating reviewer assignment:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getReviewerAssignments,
    getReviewerAssignmentById,
    getReviewerAssignmentsByEmail,
    autoSaveReview,
    submitReview,
    createReviewerAssignment,
    updateReviewerAssignment
  };
};