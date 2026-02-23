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
  deleteDoc
} from 'firebase/firestore';
import { useLanguage } from './useLanguage';

export const useReviewerAssignment = (user) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { language } = useLanguage();
  const isSpanish = language === 'es';

  const getReviewerAssignments = useCallback(async (editorialTaskId) => {
    setLoading(true);
    setError(null);
    try {
      if (!editorialTaskId) {
        return { success: false, error: 'Editorial task ID is required' };
      }

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
          dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : data.dueDate,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
          submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate() : data.submittedAt
        };
      });
      return { success: true, assignments };
    } catch (err) {
      console.error('Error getting reviewer assignments:', err);
      const errorMessage = err.code === 'permission-denied' 
        ? (isSpanish ? 'No tienes permisos para ver estas asignaciones' : 'You do not have permission to view these assignments')
        : err.message;
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [isSpanish]);

  const getReviewerAssignmentById = useCallback(async (assignmentId) => {
    setLoading(true);
    setError(null);
    try {
      if (!assignmentId) {
        return { success: false, error: 'Assignment ID is required' };
      }

      const docRef = doc(db, 'reviewerAssignments', assignmentId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return { 
          success: true, 
          assignment: { 
            id: docSnap.id, 
            ...data,
            dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : data.dueDate,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
            submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate() : data.submittedAt
          } 
        };
      } else {
        return { success: false, error: 'Assignment not found' };
      }
    } catch (err) {
      console.error('Error getting reviewer assignment:', err);
      const errorMessage = err.code === 'permission-denied' 
        ? (isSpanish ? 'No tienes permisos para ver esta asignación' : 'You do not have permission to view this assignment')
        : err.message;
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [isSpanish]);

  const getReviewerAssignmentsByEmail = useCallback(async (email) => {
    setLoading(true);
    setError(null);
    try {
      if (!email) {
        return { success: false, error: 'Email is required' };
      }

      const q = query(
        collection(db, 'reviewerAssignments'),
        where('reviewerEmail', '==', email.toLowerCase().trim()),
        where('status', 'in', ['pending', 'in-progress', 'submitted'])
      );
      
      const snapshot = await getDocs(q);
      const assignments = [];
      
      for (const docSnap of snapshot.docs) {
        const assignmentData = docSnap.data();
        
        const assignment = { 
          id: docSnap.id, 
          ...assignmentData,
          dueDate: assignmentData.dueDate?.toDate ? assignmentData.dueDate.toDate() : assignmentData.dueDate,
          createdAt: assignmentData.createdAt?.toDate ? assignmentData.createdAt.toDate() : assignmentData.createdAt,
          updatedAt: assignmentData.updatedAt?.toDate ? assignmentData.updatedAt.toDate() : assignmentData.updatedAt,
          submittedAt: assignmentData.submittedAt?.toDate ? assignmentData.submittedAt.toDate() : assignmentData.submittedAt
        };
        
        try {
          const submissionSnap = await getDoc(doc(db, 'submissions', assignment.submissionId));
          if (submissionSnap.exists()) {
            assignment.submission = { 
              id: submissionSnap.id, 
              ...submissionSnap.data(),
              createdAt: submissionSnap.data().createdAt?.toDate ? submissionSnap.data().createdAt.toDate() : submissionSnap.data().createdAt
            };
          }
        } catch (submissionError) {
          console.warn('Error fetching submission:', submissionError);
          assignment.submission = null;
        }
        
        assignments.push(assignment);
      }
      
      return { success: true, assignments };
    } catch (err) {
      console.error('Error getting reviewer assignments by email:', err);
      const errorMessage = err.code === 'permission-denied' 
        ? (isSpanish ? 'No tienes permisos para ver estas asignaciones' : 'You do not have permission to view these assignments')
        : err.message;
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [isSpanish]);

  const autoSaveReview = useCallback(async (assignmentId, reviewData) => {
    try {
      if (!assignmentId) {
        return { success: false, error: 'Assignment ID is required' };
      }

      if (!user) {
        return { success: false, error: isSpanish ? 'Debes iniciar sesión' : 'You must be logged in' };
      }

      console.log('Auto-saving review for assignment:', assignmentId);
      const assignmentRef = doc(db, 'reviewerAssignments', assignmentId);
      
      // Verificar permisos antes de auto-guardar
      const assignmentSnap = await getDoc(assignmentRef);
      if (!assignmentSnap.exists()) {
        return { success: false, error: 'Assignment not found' };
      }

      const assignment = assignmentSnap.data();
      const hasPermission = checkReviewerPermission(assignment, user);
      
      if (!hasPermission) {
        return { success: false, error: isSpanish ? 'No tienes permiso para modificar esta revisión' : 'You do not have permission to modify this review' };
      }

      if (assignment.status === 'submitted') {
        return { success: false, error: isSpanish ? 'No puedes modificar una revisión ya enviada' : 'Cannot modify a submitted review' };
      }

      // Limpiar datos antes de guardar
      const cleanData = {
        ...reviewData,
        commentsToAuthor: reviewData.commentsToAuthor?.trim() || '',
        commentsToEditor: reviewData.commentsToEditor?.trim() || '',
        lastAutoSave: serverTimestamp()
      };

      await updateDoc(assignmentRef, cleanData);
      console.log('Auto-save successful');
      return { success: true };
    } catch (err) {
      console.error('Error auto-saving review:', err);
      return { 
        success: false, 
        error: err.code === 'permission-denied' 
          ? (isSpanish ? 'Error de permisos al auto-guardar' : 'Permission error while auto-saving')
          : err.message 
      };
    }
  }, [user, isSpanish]);

  // Función auxiliar para verificar permisos del revisor
  const checkReviewerPermission = (assignment, user) => {
    if (!user || !assignment) return false;
    
    const userEmail = user.email?.toLowerCase().trim();
    const assignmentEmail = assignment.reviewerEmail?.toLowerCase().trim();
    
    return (
      (assignment.reviewerUid && assignment.reviewerUid === user.uid) ||
      (assignment.reviewerEmail && userEmail === assignmentEmail)
    );
  };

  // Función para actualizar deadline de manera segura
  const completeDeadline = async (assignmentId, reviewerEmail) => {
    try {
      if (!assignmentId) return { success: false, error: 'Assignment ID required' };

      const deadlinesQuery = query(
        collection(db, 'deadlines'),
        where('targetId', '==', assignmentId),
        where('type', '==', 'review-submission'),
        limit(1)
      );
      
      const deadlinesSnapshot = await getDocs(deadlinesQuery);
      
      if (deadlinesSnapshot.empty) {
        console.log('No deadline found for assignment:', assignmentId);
        return { success: true, message: 'No deadline to update' };
      }

      const deadlineDoc = deadlinesSnapshot.docs[0];
      const deadlineData = deadlineDoc.data();
      const deadlineRef = doc(db, 'deadlines', deadlineDoc.id);
      
      // Verificar que el deadline pertenece al revisor correcto
      if (deadlineData.reviewerEmail?.toLowerCase().trim() !== reviewerEmail?.toLowerCase().trim()) {
        console.log('Deadline belongs to different reviewer, skipping');
        return { success: true, message: 'Deadline not assigned to this reviewer' };
      }

      // Verificar que el deadline no esté ya completado
      if (deadlineData.status === 'completed') {
        console.log('Deadline already completed');
        return { success: true, message: 'Deadline already completed' };
      }

      await updateDoc(deadlineRef, {
        status: 'completed',
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      console.log('Deadline completed successfully');
      return { success: true };
    } catch (err) {
      console.error('Error completing deadline:', err);
      // No fallar si el deadline no se puede actualizar
      return { 
        success: false, 
        error: err.message,
        skipped: true 
      };
    }
  };

  // Función para actualizar tarea editorial de manera segura
  const updateEditorialTask = async (taskId, submissionId, assignmentId) => {
    try {
      if (!taskId) return { success: false, error: 'Task ID required' };

      const taskRef = doc(db, 'editorialTasks', taskId);
      const taskSnap = await getDoc(taskRef);
      
      if (!taskSnap.exists()) {
        console.log('Editorial task not found:', taskId);
        return { success: true, message: 'Task not found' };
      }

      const taskData = taskSnap.data();
      
      // Verificar que esta asignación no haya sido contada ya
      const reviewsSubmitted = taskData.reviewsSubmitted || 0;
      const reviewerIds = taskData.reviewerIds || [];
      
      if (!reviewerIds.includes(assignmentId)) {
        // Agregar el ID de esta revisión a la lista si no existe
        const newReviewerIds = [...reviewerIds, assignmentId];
        const newSubmittedCount = reviewsSubmitted + 1;
        
        const taskUpdates = {
          reviewsSubmitted: newSubmittedCount,
          reviewerIds: newReviewerIds,
          updatedAt: serverTimestamp()
        };
        
        if (newSubmittedCount >= (taskData.requiredReviewers || 2)) {
          taskUpdates.status = 'awaiting-decision';
        }
        
        await updateDoc(taskRef, taskUpdates);
        console.log('Editorial task updated successfully');
      } else {
        console.log('Review already counted for this task');
      }

      return { success: true };
    } catch (err) {
      console.error('Error updating editorial task:', err);
      // No fallar si la tarea no se puede actualizar
      return { 
        success: false, 
        error: err.message,
        skipped: true 
      };
    }
  };

  const submitReview = useCallback(async (assignmentId, reviewData) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Starting submitReview for assignment:', assignmentId);
      
      // Validaciones iniciales
      if (!user) {
        throw new Error(isSpanish ? 'Debes iniciar sesión' : 'You must be logged in');
      }

      if (!assignmentId) {
        throw new Error(isSpanish ? 'ID de asignación requerido' : 'Assignment ID required');
      }

      // Obtener la asignación
      const assignmentRef = doc(db, 'reviewerAssignments', assignmentId);
      const assignmentSnap = await getDoc(assignmentRef);
      
      if (!assignmentSnap.exists()) {
        throw new Error(isSpanish ? 'Asignación no encontrada' : 'Assignment not found');
      }

      const assignment = assignmentSnap.data();
      console.log('Assignment data:', {
        reviewerUid: assignment.reviewerUid,
        reviewerEmail: assignment.reviewerEmail,
        status: assignment.status
      });
      
      // Verificar permisos
      const hasPermission = checkReviewerPermission(assignment, user);
      
      console.log('Permission check:', {
        hasPermission,
        userUid: user.uid,
        assignmentUid: assignment.reviewerUid,
        userEmail: user.email,
        assignmentEmail: assignment.reviewerEmail
      });
      
      if (!hasPermission) {
        throw new Error(isSpanish ? 'No tienes permiso para enviar esta revisión' : 'You do not have permission to submit this review');
      }

      // Verificar estado
      if (assignment.status === 'submitted') {
        throw new Error(isSpanish ? 'Esta revisión ya fue enviada' : 'This review has already been submitted');
      }

      // Validar datos de la revisión
      const { scores, commentsToAuthor, commentsToEditor, recommendation } = reviewData;
      
      if (!scores || typeof scores !== 'object' || Object.keys(scores).length === 0) {
        throw new Error(isSpanish ? 'Debes completar la evaluación con puntuaciones' : 'You must complete the evaluation with scores');
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

      // Validar valores de scores
      const validScores = {};
      for (const [key, value] of Object.entries(scores)) {
        const numValue = Number(value);
        if (isNaN(numValue) || numValue < 1 || numValue > 5) {
          throw new Error(isSpanish 
            ? `Puntuación inválida para ${key}. Debe ser entre 1 y 5` 
            : `Invalid score for ${key}. Must be between 1 and 5`);
        }
        validScores[key] = numValue;
      }

      console.log('Attempting to update assignment...');
      
      // Actualizar la asignación principal
      try {
        await updateDoc(assignmentRef, {
          scores: validScores,
          commentsToAuthor: commentsToAuthor.trim(),
          commentsToEditor: commentsToEditor.trim(),
          recommendation,
          status: 'submitted',
          submittedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        console.log('Assignment update successful');
      } catch (updateError) {
        console.error('Assignment update failed:', updateError);
        throw new Error(isSpanish 
          ? 'Error al actualizar la asignación. Intenta de nuevo.' 
          : 'Error updating assignment. Please try again.');
      }

      // Actualizar deadline (opcional - no detiene el flujo si falla)
      if (assignment.reviewerEmail) {
        const deadlineResult = await completeDeadline(assignmentId, assignment.reviewerEmail);
        if (!deadlineResult.success && !deadlineResult.skipped) {
          console.warn('Deadline update issue:', deadlineResult.error);
          // No lanzamos error, solo registramos
        }
      }

      // Actualizar tarea editorial (opcional - no detiene el flujo si falla)
      if (assignment.editorialTaskId) {
        const taskResult = await updateEditorialTask(
          assignment.editorialTaskId, 
          assignment.submissionId,
          assignmentId
        );
        if (!taskResult.success && !taskResult.skipped) {
          console.warn('Editorial task update issue:', taskResult.error);
          // No lanzamos error, solo registramos
        }
      }

      return { 
        success: true,
        message: isSpanish ? 'Revisión enviada exitosamente' : 'Review submitted successfully'
      };

    } catch (err) {
      console.error('Error submitting review:', err);
      
      let errorMessage = err.message;
      
      if (err.code === 'permission-denied') {
        errorMessage = isSpanish 
          ? 'No tienes permisos para realizar esta acción. Verifica que estás asignado como revisor.' 
          : 'You do not have permission to perform this action. Verify you are assigned as a reviewer.';
      } else if (err.code === 'not-found') {
        errorMessage = isSpanish 
          ? 'La asignación no existe o fue eliminada' 
          : 'Assignment not found or was deleted';
      } else if (err.code === 'unavailable') {
        errorMessage = isSpanish 
          ? 'Error de conexión. Intenta de nuevo.' 
          : 'Connection error. Please try again.';
      }
      
      setError(errorMessage);
      return { success: false, error: errorMessage };
      
    } finally {
      setLoading(false);
    }
  }, [user, isSpanish]);

  const createReviewerAssignment = useCallback(async (assignmentData) => {
    setLoading(true);
    setError(null);
    try {
      // Validaciones
      if (!assignmentData.editorialTaskId) {
        throw new Error('editorialTaskId is required');
      }
      if (!assignmentData.submissionId) {
        throw new Error('submissionId is required');
      }
      if (!assignmentData.reviewerEmail) {
        throw new Error('reviewerEmail is required');
      }

      const newAssignment = {
        ...assignmentData,
        reviewerEmail: assignmentData.reviewerEmail.toLowerCase().trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'reviewerAssignments'), newAssignment);
      return { success: true, id: docRef.id };
    } catch (err) {
      console.error('Error creating reviewer assignment:', err);
      const errorMessage = err.code === 'permission-denied' 
        ? (isSpanish ? 'No tienes permisos para crear asignaciones' : 'You do not have permission to create assignments')
        : err.message;
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [isSpanish]);

  const updateReviewerAssignment = useCallback(async (assignmentId, updateData) => {
    setLoading(true);
    setError(null);
    try {
      if (!assignmentId) {
        throw new Error('Assignment ID is required');
      }

      const assignmentRef = doc(db, 'reviewerAssignments', assignmentId);
      
      // Verificar que la asignación existe
      const assignmentSnap = await getDoc(assignmentRef);
      if (!assignmentSnap.exists()) {
        throw new Error('Assignment not found');
      }

      // Verificar permisos para actualizar
      const assignment = assignmentSnap.data();
      const hasPermission = checkReviewerPermission(assignment, user) || 
                           user?.roles?.some(r => ['Director General', 'Editor en Jefe', 'Editor de Sección'].includes(r));
      
      if (!hasPermission) {
        throw new Error(isSpanish ? 'No tienes permiso para actualizar esta asignación' : 'You do not have permission to update this assignment');
      }

      await updateDoc(assignmentRef, {
        ...updateData,
        updatedAt: serverTimestamp()
      });
      return { success: true };
    } catch (err) {
      console.error('Error updating reviewer assignment:', err);
      const errorMessage = err.code === 'permission-denied' 
        ? (isSpanish ? 'No tienes permisos para actualizar' : 'You do not have permission to update')
        : err.message;
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [user, isSpanish]);

  const deleteReviewerAssignment = useCallback(async (assignmentId) => {
    setLoading(true);
    setError(null);
    try {
      if (!assignmentId) {
        throw new Error('Assignment ID is required');
      }

      // Solo admins pueden eliminar asignaciones
      const isAdmin = user?.roles?.some(r => ['Director General', 'Editor en Jefe'].includes(r));
      
      if (!isAdmin) {
        throw new Error(isSpanish ? 'No tienes permiso para eliminar asignaciones' : 'You do not have permission to delete assignments');
      }

      await deleteDoc(doc(db, 'reviewerAssignments', assignmentId));
      return { success: true };
    } catch (err) {
      console.error('Error deleting reviewer assignment:', err);
      const errorMessage = err.code === 'permission-denied' 
        ? (isSpanish ? 'No tienes permisos para eliminar' : 'You do not have permission to delete')
        : err.message;
      setError(errorMessage);
      return { success: false, error: errorMessage };
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
    submitReview,
    createReviewerAssignment,
    updateReviewerAssignment,
    deleteReviewerAssignment
  };
};