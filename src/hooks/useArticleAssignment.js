// src/hooks/useArticleAssignment.js (CORREGIDO)
import { useState, useCallback } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, getDocs, getDoc } from 'firebase/firestore';
import { useLanguage } from './useLanguage';

export const useArticleAssignment = (user) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { language } = useLanguage();
  const isSpanish = language === 'es';

  /**
   * Asigna un artículo (submission) a un Editor de Sección.
   */
  const assignToSectionEditor = useCallback(async (submissionId, sectionEditorUid, assignmentNotes = '') => {
    if (!user) {
      setError(isSpanish ? 'Usuario no autenticado' : 'User not authenticated');
      return { success: false, error: 'Usuario no autenticado' };
    }

    setLoading(true);
    setError(null);

    try {
      // Verificar que el usuario actual es el Encargado de Asignación
      const userRoles = user.roles || [];
      if (!userRoles.includes('Encargado de Asignación de Artículos') && !userRoles.includes('Director General')) {
        throw new Error(isSpanish ? 'No tienes permiso para asignar artículos' : 'You do not have permission to assign articles');
      }

      // Obtener datos del submission para el email
      const submissionRef = doc(db, 'submissions', submissionId);
      const submissionSnap = await getDoc(submissionRef);
      if (!submissionSnap.exists()) {
        throw new Error(isSpanish ? 'Envío no encontrado' : 'Submission not found');
      }
      const submissionData = submissionSnap.data();

      // Obtener datos del editor de sección para el email
      const sectionEditorRef = doc(db, 'users', sectionEditorUid);
      const sectionEditorSnap = await getDoc(sectionEditorRef);
      if (!sectionEditorSnap.exists()) {
        throw new Error(isSpanish ? 'Editor de sección no encontrado' : 'Section editor not found');
      }
      const sectionEditorData = sectionEditorSnap.data();

      // 1. Crear la tarea editorial (editorialTask) para el Editor de Sección
      const taskData = {
        submissionId,
        submissionTitle: submissionData.title,
        assignedBy: user.uid,
        assignedTo: sectionEditorUid,
        assignedToEmail: sectionEditorData.email,
        assignedToName: sectionEditorData.displayName || `${sectionEditorData.firstName || ''} ${sectionEditorData.lastName || ''}`.trim() || sectionEditorData.email,
        status: 'pending',
        assignmentNotes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        round: 1,
      };

      const taskRef = await addDoc(collection(db, 'editorialTasks'), taskData);

      // 2. Actualizar el estado del submission
      await updateDoc(submissionRef, {
        status: 'desk-review',
        currentEditorialTaskId: taskRef.id,
        updatedAt: serverTimestamp(),
      });

      // 3. Crear un registro de auditoría
      await addDoc(collection(db, 'submissions', submissionId, 'auditLogs'), {
        action: 'assigned_to_section_editor',
        by: user.uid,
        byEmail: user.email,
        to: sectionEditorUid,
        toEmail: sectionEditorData.email,
        notes: assignmentNotes,
        timestamp: serverTimestamp(),
      });

      setLoading(false);
      return {
        success: true,
        taskId: taskRef.id,
        message: isSpanish ? 'Artículo asignado correctamente' : 'Article assigned successfully'
      };

    } catch (err) {
      console.error('Error in assignToSectionEditor:', err);
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  }, [user, isSpanish]);

  /**
   * Obtiene la lista de artículos que están esperando ser asignados (status 'submitted').
   */
  const getUnassignedSubmissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = query(
        collection(db, 'submissions'),
        where('status', '==', 'submitted'),
      );
      const snapshot = await getDocs(q);
      const submissions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || null
      }));
      setLoading(false);
      return { success: true, submissions };
    } catch (err) {
      console.error('Error getting unassigned submissions:', err);
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  }, []); // <-- Sin dependencias porque no usa nada externo

  /**
   * Obtiene la lista de Editores de Sección disponibles.
   */
  const getSectionEditors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = query(
        collection(db, 'users'),
        where('roles', 'array-contains', 'Editor de Sección')
      );
      const snapshot = await getDocs(q);
      const editors = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
        displayName: doc.data().displayName || `${doc.data().firstName || ''} ${doc.data().lastName || ''}`.trim() || doc.data().email,
      }));
      setLoading(false);
      return { success: true, editors };
    } catch (err) {
      console.error('Error getting section editors:', err);
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  }, []); // <-- Sin dependencias porque no usa nada externo

  return {
    loading,
    error,
    assignToSectionEditor,
    getUnassignedSubmissions,
    getSectionEditors,
  };
};