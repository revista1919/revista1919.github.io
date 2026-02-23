// src/hooks/useAuth.js (VERSIÓN MEJORADA)
import { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // <-- AÑADIDO: para manejar errores

  useEffect(() => {
    let isMounted = true; // <-- AÑADIDO: para evitar actualizaciones en componentes desmontados

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!isMounted) return;

      if (firebaseUser) {
        try {
          // Obtener datos adicionales del usuario desde Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          const userData = userDoc.exists() ? userDoc.data() : {};
          
          if (isMounted) {
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName || userData.displayName || '',
              photoURL: firebaseUser.photoURL || userData.imageUrl || '',
              roles: userData.roles || [],
              ...userData
            });
            setError(null);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          if (isMounted) {
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName || '',
              photoURL: firebaseUser.photoURL || '',
              roles: []
            });
            setError(error.message);
          }
        }
      } else {
        if (isMounted) {
          setUser(null);
          setError(null);
        }
      }
      
      if (isMounted) {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return { user, loading, error }; // <-- AÑADIDO: devolver error también
};