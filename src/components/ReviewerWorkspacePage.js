// src/components/ReviewerWorkspacePage.js (VERSIÓN CORREGIDA - COMPLETA)
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { ReviewerWorkspace } from './ReviewerWorkspace';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const ReviewerWorkspacePage = () => {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [permissions, setPermissions] = useState({ isEditor: false, isAssignedReviewer: false });
  const isSpanish = language === 'es';

  useEffect(() => {
    let isMounted = true;

    const checkAccess = async () => {
      // --- Validación 1: Esperar a que el estado de autenticación esté listo ---
      if (authLoading) {
        // Aún estamos verificando la sesión, esperamos.
        return;
      }

      // --- Validación 2: Usuario no autenticado ---
      if (!user) {
        console.log('Usuario no autenticado, redirigiendo a /login');
        navigate('/login', { replace: true });
        return;
      }

      // --- Validación 3: ID de asignación válido ---
      if (!assignmentId) {
        if (isMounted) {
          setError(isSpanish ? 'ID de asignación no válido' : 'Invalid assignment ID');
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // --- Paso 1: Obtener la asignación para verificar permisos ---
        const assignmentDoc = await getDoc(doc(db, 'reviewerAssignments', assignmentId));
        
        if (!assignmentDoc.exists()) {
          if (isMounted) {
            setError(isSpanish ? 'Asignación no encontrada' : 'Assignment not found');
            setLoading(false);
          }
          return;
        }

        const assignmentData = { id: assignmentDoc.id, ...assignmentDoc.data() };
        
        // --- Paso 2: Verificar permisos (con datos ya disponibles) ---
        const userRoles = user.roles || [];
        
        const isAssignedReviewer = assignmentData.reviewerEmail?.toLowerCase() === user.email?.toLowerCase();
        const isEditor = userRoles.includes('Director General') || 
                         userRoles.includes('Editor en Jefe') || 
                         userRoles.includes('Editor de Sección');

        // Guardar permisos y asignación para el renderizado
        if (isMounted) {
          setAssignment(assignmentData);
          setPermissions({ isEditor, isAssignedReviewer });
        }

        // --- Paso 3: Validar si tiene permiso para continuar ---
        if (!isAssignedReviewer && !isEditor) {
          // No es el revisor asignado ni es editor, no tiene permiso.
          if (isMounted) {
            setError(isSpanish ? 'No tienes permiso para acceder a esta revisión' : 'You do not have permission to access this review');
            setLoading(false);
          }
          return;
        }

        // Si todo está bien, se queda en loading false y muestra el componente.
        if (isMounted) {
          setLoading(false);
        }

      } catch (err) {
        console.error('Error checking access:', err);
        if (isMounted) {
          setError(isSpanish ? 'Error al verificar acceso' : 'Error checking access');
          setLoading(false);
        }
      }
    };

    checkAccess();

    return () => {
      isMounted = false;
    };
  }, [assignmentId, user, authLoading, navigate, isSpanish]);

  // --- Renderizado Condicional ---
  
  // 1. Cargando autenticación o datos principales
  if (authLoading || loading) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">{isSpanish ? 'Cargando...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  // 2. Error
  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 rounded-2xl p-8 max-w-md text-center"
        >
          <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-2xl font-bold text-red-700 mb-2">
            {isSpanish ? 'Error de acceso' : 'Access Error'}
          </h2>
          <p className="text-red-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors"
          >
            {isSpanish ? 'Volver al inicio' : 'Go to home'}
          </button>
        </motion.div>
      </div>
    );
  }

  // 3. Todo bien, renderizar el workspace. Si no hay asignación (por si acaso), mostrar error.
  if (!assignment) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <p>{isSpanish ? 'Error al cargar la asignación.' : 'Error loading assignment.'}</p>
      </div>
    );
  }

  // Determinar el modo de solo lectura basado en los permisos guardados
  const readOnly = permissions.isEditor && !permissions.isAssignedReviewer;

  return (
    <ReviewerWorkspace 
      assignmentId={assignmentId} 
      onClose={() => navigate('/')}
      readOnly={readOnly}
    />
  );
};

export default ReviewerWorkspacePage;