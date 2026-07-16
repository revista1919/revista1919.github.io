import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
  updateEmail,
  updatePassword,
  fetchSignInMethodsForEmail,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  OAuthProvider,
  getAdditionalUserInfo
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  query,
  collection
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

/* ==============================
   CONFIG
============================== */

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyArr3LE_hQLZG0L5m9JND2OWVL8elnSyWk",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "usuarios-rnce.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "usuarios-rnce",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "usuarios-rnce.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "688242139131",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:688242139131:web:3a98663545e73110c3f55e",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-K90MKB7BDP"
};

/* ==============================
   INIT
============================== */

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

/* ==============================
   GOOGLE PROVIDER
============================== */

export const googleProvider = new GoogleAuthProvider();

/* ==============================
   CLOUD FUNCTIONS (CALLABLE)
============================== */

export const translateTextCF = httpsCallable(functions, 'translateText');
export const updateRole = httpsCallable(functions, 'updateRole');
export const getUserInvitations = httpsCallable(functions, 'getUserInvitations');

/* ==============================
   FUNCIONES DE RECLAMACIÓN DE PERFIL
============================== */

/**
 * Verifica si existe un perfil anónimo que pueda ser reclamado
 * @param {Object} data - Datos para la verificación
 * @param {string} data.email - Email del usuario a verificar
 * @returns {Promise<Object>} Resultado de la verificación
 */
export const checkAnonymousProfile = async (data) => {
  try {
    const checkFunction = httpsCallable(functions, 'checkAnonymousProfile');
    const result = await checkFunction(data);
    return result.data;
  } catch (error) {
    console.error('Error en checkAnonymousProfile:', error);
    throw error;
  }
};

/**
 * Reclama un perfil anónimo y lo asocia al usuario autenticado
 * @param {Object} data - Datos para el reclamo
 * @param {string} data.anonymousUid - UID del perfil anónimo
 * @param {string} data.claimHash - Hash de verificación
 * @param {string} data.anonymousName - Nombre del perfil anónimo
 * @returns {Promise<Object>} Resultado del reclamo
 */
export const claimAnonymousProfile = async (data) => {
  try {
    const claimFunction = httpsCallable(functions, 'claimAnonymousProfile');
    const result = await claimFunction(data);
    return result.data;
  } catch (error) {
    console.error('Error en claimAnonymousProfile:', error);
    throw error;
  }
};

/* ==============================
   🔥 HTTP FUNCTION – IMGBB UPLOAD
============================== */

const IMGBB_FUNCTION_URL =
  "https://uploadimagetoimgbbcallable-ggqsq2kkua-uc.a.run.app";

// CAMBIA la función HTTP por callable
export const uploadImageToImgBB = async ({ base64, fileName }) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Usuario no autenticado");
  
  // Usar función callable en lugar de fetch
  const uploadFunction = httpsCallable(functions, 'uploadImageToImgBBCallable');
  
  const cleanBase64 = base64.includes("base64,")
    ? base64.split("base64,")[1]
    : base64;
  
  const result = await uploadFunction({
    imageBase64: cleanBase64,
    name: fileName
  });
  
  return result.data;
};

/* ==============================
   SUBMIT ARTICLE
============================== */

export const submitArticle = async (data) => {
  const token = await auth.currentUser.getIdToken();
  
  const response = await fetch('https://submitarticle-ggqsq2kkua-uc.a.run.app', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }
  
  return response.json();
};

/* ==============================
   SUBMIT REVISION
============================== */

export const submitRevision = async (data) => {
  const token = await auth.currentUser.getIdToken();
  
  const response = await fetch('https://submitrevision-ggqsq2kkua-uc.a.run.app', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }
  
  return response.json();
};

/* ==============================
   FUNCIONES AUXILIARES
============================== */

/**
 * Función para generar slugs (útil para UIDs y URLs)
 * @param {string} text - Texto a convertir en slug
 * @returns {string} Slug generado
 */
export const generateSlug = (text) => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 50);
};

/* ==============================
   EXPORTS
============================== */

export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
  updateEmail,
  updatePassword,
  fetchSignInMethodsForEmail,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  OAuthProvider,
  getAdditionalUserInfo,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  query,
  collection
};

export default app;