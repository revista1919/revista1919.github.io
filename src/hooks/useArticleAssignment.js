// src/hooks/useArticleAssignment.js (CORREGIDO Y ACTUALIZADO)
import { useState, useCallback } from 'react';
import { db, functions } from '../firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  query, 
  where, 
  getDocs, 
  getDoc 
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
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
   * Devuelve un artículo al autor para correcciones.
   * Actualiza el estado del submission y envía notificaciones por correo.
   */
  const returnArticleToAuthor = useCallback(async (submissionId, reasons) => {
    if (!user) {
      setError(isSpanish ? 'Usuario no autenticado' : 'User not authenticated');
      return { success: false, error: 'Usuario no autenticado' };
    }

    if (!reasons || reasons.length === 0) {
      setError(isSpanish ? 'Debes especificar al menos una razón de devolución' : 'You must specify at least one return reason');
      return { success: false, error: 'No reasons provided' };
    }

    setLoading(true);
    setError(null);

    try {
      // Verificar que el usuario actual es el Encargado de Asignación
      const userRoles = user.roles || [];
      if (!userRoles.includes('Encargado de Asignación de Artículos') && !userRoles.includes('Director General')) {
        throw new Error(isSpanish ? 'No tienes permiso para devolver artículos' : 'You do not have permission to return articles');
      }

      // Obtener datos del submission
      const submissionRef = doc(db, 'submissions', submissionId);
      const submissionSnap = await getDoc(submissionRef);
      if (!submissionSnap.exists()) {
        throw new Error(isSpanish ? 'Envío no encontrado' : 'Submission not found');
      }
      const submissionData = submissionSnap.data();

      // Verificar que el artículo esté en estado 'submitted'
      if (submissionData.status !== 'submitted') {
        throw new Error(isSpanish 
          ? 'El artículo no está en estado de envío inicial' 
          : 'The article is not in the initial submission state');
      }

      // 1. Actualizar el estado del submission
      await updateDoc(submissionRef, {
        status: 'returned_to_author',
        returnReasons: reasons,
        returnedAt: serverTimestamp(),
        returnedBy: user.uid,
        returnedByEmail: user.email,
        returnCount: (submissionData.returnCount || 0) + 1,
        updatedAt: serverTimestamp(),
      });

      // 2. Crear un registro de auditoría
      await addDoc(collection(db, 'submissions', submissionId, 'auditLogs'), {
        action: 'returned_to_author',
        by: user.uid,
        byEmail: user.email,
        reasons: reasons,
        timestamp: serverTimestamp(),
      });

      // 3. Enviar notificaciones por correo
      await sendReturnNotifications(submissionId, submissionData, reasons);

      setLoading(false);
      return {
        success: true,
        message: isSpanish 
          ? 'Artículo devuelto al autor correctamente. Se han enviado notificaciones por correo.' 
          : 'Article returned to author successfully. Email notifications have been sent.',
      };

    } catch (err) {
      console.error('Error in returnArticleToAuthor:', err);
      setError(err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  }, [user, isSpanish]);

  /**
   * Función auxiliar para enviar notificaciones de devolución por correo.
   * (Esta función se ejecuta en el cliente y prepara los datos)
   */
  const sendReturnNotifications = async (submissionId, submissionData, reasons) => {
    try {
      // Determinar idioma del manuscrito
      const manuscriptLang = submissionData.paperLanguage || 'es';
      
      // Obtener correos de autores
      const authorEmails = [];
      const correspondingEmail = submissionData.authorEmail || 
        submissionData.correspondingAuthor?.email;
      
      if (correspondingEmail) {
        authorEmails.push(correspondingEmail);
      }
      
      // Agregar correos de coautores
      if (submissionData.authors && Array.isArray(submissionData.authors)) {
        submissionData.authors.forEach(author => {
          if (author.email && author.email !== correspondingEmail) {
            authorEmails.push(author.email);
          }
        });
      }
      
      // Preparar datos para la notificación
      const notificationData = {
        submissionId,
        title: submissionData.title,
        titleEn: submissionData.titleEn,
        authorName: submissionData.authorName,
        authorEmail: correspondingEmail,
        allAuthorEmails: authorEmails,
        reasons,
        manuscriptLang,
        returnedBy: user?.displayName || user?.email,
        returnedByEmail: user?.email,
        timestamp: new Date().toISOString(),
      };
      
      // Aquí se podría llamar a una Cloud Function para enviar los correos
      // o directamente usar la colección 'mail' para encolar los correos
      
      // Encolar correo para el autor de correspondencia
      if (correspondingEmail) {
        await addDoc(collection(db, 'mail'), {
          to: [correspondingEmail],
          message: {
            subject: manuscriptLang === 'es'
              ? `📝 Artículo devuelto para correcciones - ${submissionData.submissionId}`
              : `📝 Article returned for corrections - ${submissionData.submissionId}`,
            html: generateReturnEmailTemplate(submissionData, reasons, manuscriptLang),
            text: 'Artículo devuelto para correcciones'
          },
          createdAt: serverTimestamp(),
        });
      }
      
      // Encolar correos para coautores (solo notificación informativa)
      const coauthorEmails = authorEmails.filter(email => email !== correspondingEmail);
      for (const coauthorEmail of coauthorEmails) {
        await addDoc(collection(db, 'mail'), {
          to: [coauthorEmail],
          message: {
            subject: manuscriptLang === 'es'
              ? `📝 Información sobre el artículo "${submissionData.title}"`
              : `📝 Information about the article "${submissionData.titleEn || submissionData.title}"`,
            html: generateCoauthorNotificationTemplate(submissionData, reasons, manuscriptLang),
            text: 'Notificación sobre artículo'
          },
          createdAt: serverTimestamp(),
        });
      }
      
    } catch (error) {
      console.error('Error sending return notifications:', error);
      // No lanzamos el error para que la devolución del artículo no falle
      // si hay problemas con las notificaciones
    }
  };

  /**
   * Genera la plantilla HTML del correo de devolución para el autor principal.
   */
  const generateReturnEmailTemplate = (submissionData, reasons, lang) => {
    const reasonsList = reasons.map(reason => `<li>${reason}</li>`).join('');
    const submissionId = submissionData.submissionId || 'N/A';
    const title = lang === 'es' ? submissionData.title : (submissionData.titleEn || submissionData.title);
    
    if (lang === 'es') {
      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
          <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center;">
            <h2 style="margin: 0; font-size: 20px;">📝 Artículo Devuelto para Correcciones</h2>
          </div>
          <div style="background-color: white; padding: 30px; margin-top: 20px; border-radius: 5px;">
            <h3 style="color: #1f2937; margin-bottom: 20px;">"${title}"</h3>
            <p><strong>ID de envío:</strong> ${submissionId}</p>
            <p><strong>Fecha de devolución:</strong> ${new Date().toLocaleDateString('es-CL')}</p>
            
            <div style="margin: 20px 0;">
              <h4 style="color: #dc2626; margin-bottom: 10px;">Correcciones solicitadas:</h4>
              <ul style="list-style-type: disc; padding-left: 20px;">
                ${reasonsList}
              </ul>
            </div>
            
            <div style="margin: 20px 0; padding: 15px; background-color: #fef2f2; border-left: 4px solid #dc2626;">
              <h4 style="margin-top: 0;">Instrucciones:</h4>
              <ol style="padding-left: 20px;">
                <li>Revise cuidadosamente cada punto mencionado</li>
                <li>Realice las correcciones necesarias en su manuscrito</li>
                <li>Vuelva a enviar el artículo corregido a través del portal</li>
              </ol>
            </div>
            
            <p>Si tiene preguntas sobre las correcciones solicitadas, puede responder a este correo.</p>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="https://www.revistacienciasestudiantes.com/es/login" 
                 style="background-color: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 3px; font-weight: bold;">
                ACCEDER AL PORTAL
              </a>
            </div>
          </div>
          <p style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px;">
            Revista Nacional de las Ciencias para Estudiantes
          </p>
        </div>
      `;
    } else {
      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
          <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center;">
            <h2 style="margin: 0; font-size: 20px;">📝 Article Returned for Corrections</h2>
          </div>
          <div style="background-color: white; padding: 30px; margin-top: 20px; border-radius: 5px;">
            <h3 style="color: #1f2937; margin-bottom: 20px;">"${title}"</h3>
            <p><strong>Submission ID:</strong> ${submissionId}</p>
            <p><strong>Return date:</strong> ${new Date().toLocaleDateString('en-US')}</p>
            
            <div style="margin: 20px 0;">
              <h4 style="color: #dc2626; margin-bottom: 10px;">Requested corrections:</h4>
              <ul style="list-style-type: disc; padding-left: 20px;">
                ${reasonsList}
              </ul>
            </div>
            
            <div style="margin: 20px 0; padding: 15px; background-color: #fef2f2; border-left: 4px solid #dc2626;">
              <h4 style="margin-top: 0;">Instructions:</h4>
              <ol style="padding-left: 20px;">
                <li>Carefully review each point mentioned</li>
                <li>Make the necessary corrections to your manuscript</li>
                <li>Resubmit the corrected article through the portal</li>
              </ol>
            </div>
            
            <p>If you have questions about the requested corrections, you can reply to this email.</p>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="https://www.revistacienciasestudiantes.com/en/login" 
                 style="background-color: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 3px; font-weight: bold;">
                ACCESS PORTAL
              </a>
            </div>
          </div>
          <p style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px;">
            The National Review of Sciences for Students
          </p>
        </div>
      `;
    }
  };

  /**
   * Genera la plantilla HTML del correo de notificación para coautores.
   */
  const generateCoauthorNotificationTemplate = (submissionData, reasons, lang) => {
    const reasonsList = reasons.map(reason => `<li>${reason}</li>`).join('');
    const submissionId = submissionData.submissionId || 'N/A';
    const title = lang === 'es' ? submissionData.title : (submissionData.titleEn || submissionData.title);
    const correspondingName = submissionData.authorName || 'the corresponding author';
    
    if (lang === 'es') {
      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
          <div style="background-color: #6b7280; color: white; padding: 20px; text-align: center;">
            <h2 style="margin: 0; font-size: 18px;">📋 Información sobre Artículo</h2>
          </div>
          <div style="background-color: white; padding: 30px; margin-top: 20px; border-radius: 5px;">
            <h3 style="color: #1f2937; margin-bottom: 20px;">"${title}"</h3>
            <p><strong>ID de envío:</strong> ${submissionId}</p>
            
            <p>Le informamos que el artículo ha sido devuelto al autor de correspondencia para realizar correcciones.</p>
            
            <div style="margin: 20px 0;">
              <h4 style="color: #6b7280; margin-bottom: 10px;">Correcciones solicitadas:</h4>
              <ul style="list-style-type: disc; padding-left: 20px;">
                ${reasonsList}
              </ul>
            </div>
            
            <p>El autor de correspondencia (${correspondingName}) ha sido notificado y se encargará de realizar las correcciones y reenviar el artículo.</p>
          </div>
        </div>
      `;
    } else {
      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
          <div style="background-color: #6b7280; color: white; padding: 20px; text-align: center;">
            <h2 style="margin: 0; font-size: 18px;">📋 Article Information</h2>
          </div>
          <div style="background-color: white; padding: 30px; margin-top: 20px; border-radius: 5px;">
            <h3 style="color: #1f2937; margin-bottom: 20px;">"${title}"</h3>
            <p><strong>Submission ID:</strong> ${submissionId}</p>
            
            <p>We inform you that the article has been returned to the corresponding author for corrections.</p>
            
            <div style="margin: 20px 0;">
              <h4 style="color: #6b7280; margin-bottom: 10px;">Requested corrections:</h4>
              <ul style="list-style-type: disc; padding-left: 20px;">
                ${reasonsList}
              </ul>
            </div>
            
            <p>The corresponding author (${correspondingName}) has been notified and will handle the corrections and resubmission.</p>
          </div>
        </div>
      `;
    }
  };

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
  }, []);

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
  }, []);

  /**
   * Obtiene el número de WhatsApp del autor de correspondencia.
   */
  const getAuthorPhone = useCallback(async (submissionId) => {
    try {
      const submissionRef = doc(db, 'submissions', submissionId);
      const submissionSnap = await getDoc(submissionRef);
      
      if (!submissionSnap.exists()) {
        return { success: false, error: 'Submission not found' };
      }
      
      const submissionData = submissionSnap.data();
      const phone = submissionData.correspondingAuthor?.phone || 
                    submissionData.correspondingAuthorPhone || 
                    submissionData.authors?.find(a => a.isCorresponding)?.phone;
      
      return { success: true, phone: phone || null };
    } catch (err) {
      console.error('Error getting author phone:', err);
      return { success: false, error: err.message };
    }
  }, []);

  return {
    loading,
    error,
    assignToSectionEditor,
    returnArticleToAuthor,
    getUnassignedSubmissions,
    getSectionEditors,
    getAuthorPhone,
  };
};