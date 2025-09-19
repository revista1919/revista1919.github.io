import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
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

// Configuración de Firebase (usa variables de entorno o valores por defecto)
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyArr3LE_hQLZG0L5m9JND2OWVL8elnSyWk",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "usuarios-rnce.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "usuarios-rnce",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "usuarios-rnce.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "688242139131",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:688242139131:web:3a98663545e73110c3f55e",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-K90MKB7BDP"
};

// Debug: Log de configuración
if (process.env.NODE_ENV === 'development') {
  console.log('🔥 Firebase Config:', {
    apiKey: firebaseConfig.apiKey ? 'CONFIGURED' : 'MISSING',
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
  });
}

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Analytics solo si está soportado
let analytics = null;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
    console.log('🔍 Analytics inicializado');
  } else {
    console.log('🔍 Analytics no soportado en este entorno');
  }
}).catch((err) => {
  console.error('Error inicializando Analytics:', err);
});

// Inicializar Auth
export const auth = getAuth(app);

// Debug: Verificar auth
if (process.env.NODE_ENV === 'development') {
  console.log('🔥 Auth inicializado:', !!auth);
}

// Exportar funciones
export { 
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
};

export default app;