// src/components/ReviewerWorkspacePage.js
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
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const isSpanish = language === 'es';

  useEffect(() => {
    const checkAccess = async () => {
      if (!assignmentId) {
        setError(isSpanish ? 'ID de asignación no válido' : 'Invalid assignment ID');
        setLoading(false);
        return;
      }

      if (!user) {
        // Usuario no autenticado, redirigir al login
        navigate('/login');
        return;
      }

      try {
        // Obtener la asignación para verificar permisos
        const assignmentDoc = await getDoc(doc(db, 'reviewerAssignments', assignmentId));
        
        if (!assignmentDoc.exists()) {
          setError(isSpanish ? 'Asignación no encontrada' : 'Assignment not found');
          setLoading(false);
          return;
        }

        const assignmentData = assignmentDoc.data();
        setAssignment({ id: assignmentDoc.id, ...assignmentData });

        // Verificar que el usuario sea el revisor asignado
        if (assignmentData.reviewerEmail !== user.email) {
          // Verificar si es editor (puede ver en modo read-only)
          const userRoles = user.roles || [];
          const isEditor = userRoles.includes('Director General') || 
                           userRoles.includes('Editor en Jefe') || 
                           userRoles.includes('Editor de Sección');
          
          if (!isEditor) {
            setError(isSpanish ? 'No tienes permiso para acceder a esta revisión' : 'You do not have permission to access this review');
            setLoading(false);
            return;
          }
        }

        setLoading(false);
      } catch (err) {
        console.error('Error checking access:', err);
        setError(isSpanish ? 'Error al verificar acceso' : 'Error checking access');
        setLoading(false);
      }
    };

    checkAccess();
  }, [assignmentId, user, navigate, isSpanish]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">{isSpanish ? 'Cargando...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

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

  // Verificar si el usuario es editor (vista read-only)
  const userRoles = user?.roles || [];
  const isEditor = userRoles.includes('Director General') || 
                   userRoles.includes('Editor en Jefe') || 
                   userRoles.includes('Editor de Sección');
  
  const isAssignedReviewer = assignment?.reviewerEmail === user?.email;
  const readOnly = isEditor && !isAssignedReviewer;

  return (
    <ReviewerWorkspace 
      assignmentId={assignmentId} 
      onClose={() => navigate('/login')}
      readOnly={readOnly}
    />
  );
};

export default ReviewerWorkspacePage;