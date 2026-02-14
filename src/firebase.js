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
  getRedirectResult
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

/* ==============================
   🔥 HTTP FUNCTION – IMGBB UPLOAD
============================== */

const IMGBB_FUNCTION_URL =
  "https://uploadimagetoimgbb-ggqsq2kkua-uc.a.run.app";

export const uploadImageToImgBB = async ({ base64, fileName }) => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  const token = await user.getIdToken();

  // Limpiar prefijo si viene como data:image/...;base64,xxxx
  const cleanBase64 = base64.includes("base64,")
    ? base64.split("base64,")[1]
    : base64;

  const response = await fetch(IMGBB_FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      imageBase64: cleanBase64,
      name: fileName
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Error subiendo imagen");
  }

  return data;
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
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  query,
  collection
};

export default app;
