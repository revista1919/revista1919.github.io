import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EyeIcon, EyeSlashIcon, LockClosedIcon, ArrowRightOnRectangleIcon, UserIcon } from '@heroicons/react/24/outline';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
  auth,
  db,
  doc,
  setDoc,
  getDoc
} from '../firebase';

export default function LoginSection({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [currentUser, setCurrentUser] = useState(null);

  // ========== NEW STATES FOR CORRUPTION AND TIMEOUT HANDLING ==========
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [corruptedSession, setCorruptedSession] = useState(false);
  const timeoutRef = useRef(null);
  const MAX_LOADING_TIME = 15000; // 15 seconds max
  // =====================================================================

  useEffect(() => {
    if (!auth) {
      setMessage({ text: 'Configuration error', type: 'error' });
      return;
    }

    // ========== START SAFETY TIMEOUT ==========
    timeoutRef.current = setTimeout(() => {
      console.error('LoginSection loading timeout - possible corruption');
      setLoadingTimeout(true);
    }, MAX_LOADING_TIME);
    // ==========================================

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // ========== CLEAR TIMEOUT ON RESPONSE ==========
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      // ================================================

      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));

          // ========== CHECK IF DOCUMENT EXISTS ==========
          if (!userDoc.exists()) {
            console.error('Authenticated user but no Firestore document');
            setCorruptedSession(true);
            return;
          }
          // ==============================================

          const userData = {
            uid: user.uid,
            email: user.email,
            firstName: userDoc.data()?.firstName || '',
            lastName: userDoc.data()?.lastName || '',
            displayName: userDoc.data()?.displayName || user.email,
            roles: userDoc.data()?.roles || ['Author'],
            description: userDoc.data()?.description || { es: '', en: '' },
            interests: userDoc.data()?.interests || { es: '', en: '' },
            imageUrl: userDoc.data()?.imageUrl || '',
            social: userDoc.data()?.social || {},
            publicEmail: userDoc.data()?.publicEmail || null
          };

          // ========== VERIFY MINIMUM DATA INTEGRITY ==========
          if (!userData.uid || !userData.email) {
            console.error('Corrupted user data detected in LoginSection');
            setCorruptedSession(true);
            return;
          }
          // ====================================================

          setMessage({ text: `Welcome, ${userData.displayName}!`, type: 'success' });
          setCurrentUser(userData);
          if (onLogin) onLogin(userData);
        } catch (error) {
          console.error('Error loading user data:', error);
          setCorruptedSession(true);
        }
      } else {
        setMessage({ text: '', type: '' });
        setCurrentUser(null);
      }
    });

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      unsubscribe();
    };
  }, [onLogin]);

  // ========== FORCE SESSION RESET FUNCTION ==========
  const forceResetSession = async () => {
    try {
      // Clear any corrupted local state
      localStorage.removeItem('userSession');
      sessionStorage.clear();

      // Sign out from Firebase
      if (auth.currentUser) {
        await signOut(auth);
      }

      // Reset all states
      setCurrentUser(null);
      setCorruptedSession(false);
      setLoadingTimeout(false);
      setMessage({
        text: 'Session reset. Please sign in again. If the problem persists, contact contact@revistacienciasestudiantes.com',
        type: 'info'
      });
    } catch (error) {
      console.error('Error resetting session:', error);
      setMessage({
        text: 'Error resetting session. Please reload the page manually or contact contact@revistacienciasestudiantes.com',
        type: 'error'
      });
    }
  };
  // ==================================================

  const validateInputs = () => {
    let isValid = true;
    const newErrors = { firstName: '', lastName: '', email: '', password: '' };
    const normalizedEmail = email.trim().toLowerCase();

    if (!isLogin) {
      if (!firstName.trim()) {
        newErrors.firstName = 'First name required';
        isValid = false;
      }
      if (!lastName.trim()) {
        newErrors.lastName = 'Last name required';
        isValid = false;
      }
    }

    if (!email) {
      newErrors.email = 'Email required';
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      newErrors.email = 'Invalid email format';
      isValid = false;
    }

    if (!password) {
      newErrors.password = 'Password required';
      isValid = false;
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSignUp = async () => {
    if (!validateInputs()) return;

    setIsLoading(true);
    setMessage({ text: '', type: '' });
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      const user = userCredential.user;

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName: `${firstName.trim()} ${lastName.trim()}`,
        roles: ['Author'],
        description: { es: '', en: '' },
        interests: { es: '', en: '' },
        imageUrl: '',
        social: {},
        publicEmail: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setMessage({ text: 'Account created! Now sign in.', type: 'success' });
      setIsLogin(true);
      setEmail('');
      setPassword('');
      setFirstName('');
      setLastName('');
      setErrors({ firstName: '', lastName: '', email: '', password: '' });
    } catch (error) {
      let errorText = 'Error creating account';
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorText = 'This email is already registered.';
          break;
        case 'auth/weak-password':
          errorText = 'Weak password.';
          break;
        case 'auth/invalid-email':
          errorText = 'Invalid email';
          break;
        default:
          errorText = error.message;
      }
      setMessage({ text: errorText, type: 'error' });
    }

    setIsLoading(false);
  };

  const handleLogin = async () => {
    if (!validateInputs()) return;

    setIsLoading(true);
    setMessage({ text: '', type: '' });
    const normalizedEmail = email.trim().toLowerCase();

    try {
      await signInWithEmailAndPassword(auth, normalizedEmail, password);
    } catch (error) {
      let errorText = 'Error signing in';
      switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
          errorText = 'Incorrect email or password';
          break;
        case 'auth/invalid-email':
          errorText = 'Invalid email';
          break;
        default:
          errorText = error.message;
      }
      setMessage({ text: errorText, type: 'error' });
    }

    setIsLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setMessage({ text: 'Enter your email first', type: 'error' });
      return;
    }

    setIsLoading(true);
    setMessage({ text: '', type: '' });

    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      setMessage({ text: 'Recovery email sent. Check your inbox (including spam).', type: 'success' });
    } catch (error) {
      let errorText = 'Error sending recovery email';
      switch (error.code) {
        case 'auth/invalid-email':
          errorText = 'Invalid email format';
          break;
        case 'auth/user-not-found':
          errorText = 'No account with this email. Create an account first.';
          break;
        default:
          errorText = error.message;
      }
      setMessage({ text: errorText, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setMessage({ text: 'Session closed', type: 'success' });
      setCurrentUser(null);
      setEmail('');
      setPassword('');
      setIsLogin(true);
      if (onLogin) onLogin(null);
    } catch (error) {
      setMessage({ text: 'Error signing out', type: 'error' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLogin) {
      await handleLogin();
    } else {
      await handleSignUp();
    }
  };

  // ========== CORRUPTED SESSION OR TIMEOUT SCREEN ==========
  // THIS GOES FIRST, before any other return
  if (corruptedSession || loadingTimeout) {
    return (
      <div className="max-w-md mx-auto py-12 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border-2 border-red-200 p-8 text-center space-y-6 shadow-lg"
        >
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto border border-red-200">
            <svg className="h-10 w-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>

          <div>
            <h3 className="text-2xl font-serif font-bold text-gray-900 mb-2">
              {loadingTimeout ? 'Loading Timeout' : 'Corrupted Session Detected'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {loadingTimeout
                ? 'Loading is taking too long. This may be due to connection issues or corrupted data.'
                : 'Your session data appears to be corrupted. This prevents you from accessing the portal correctly.'}
            </p>
            <p className="text-xs text-gray-500 mb-6">
              If the problem persists, please report the error to:{' '}
              <a
                href="mailto:contact@revistacienciasestudiantes.com"
                className="text-[#007398] underline font-bold"
              >
                contact@revistacienciasestudiantes.com
              </a>
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={forceResetSession}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-4 text-xs uppercase font-black tracking-[0.2em] transition-colors"
            >
              Reset Session
            </button>

            <button
              onClick={() => {
                setCorruptedSession(false);
                setLoadingTimeout(false);
                setIsLogin(true);
                setEmail('');
                setPassword('');
                setFirstName('');
                setLastName('');
              }}
              className="w-full border-2 border-gray-300 text-gray-700 py-4 text-xs uppercase font-black tracking-[0.2em] hover:bg-gray-50 transition-colors"
            >
              Create New Account
            </button>
          </div>
        </motion.div>
      </div>
    );
  }
  // =============================================================

  // ========== LOGGED IN USER SCREEN ==========
  if (currentUser) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-md mx-auto py-12 px-6">
        <div className="bg-white border-2 border-black p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto border border-gray-200">
            <UserIcon className="h-10 w-10 text-gray-400" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#007398] mb-1">Active Session</p>
            <h3 className="text-2xl font-serif font-bold text-gray-900">{currentUser.displayName}</h3>
            <p className="text-sm text-gray-500 font-mono">{currentUser.roles.join('; ')}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full py-3 border border-red-200 text-red-600 text-xs uppercase font-black tracking-widest hover:bg-red-50 transition-colors"
          >
            <ArrowRightOnRectangleIcon className="h-4 w-4" /> Sign Out
          </button>
          <AnimatePresence>
            {message.text && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`mt-6 p-4 text-[11px] font-medium leading-relaxed border-l-4 ${
                  message.type === 'error' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-green-50 border-green-500 text-green-700'
                }`}
              >
                {message.text}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  }
  // ==============================================

  // ========== LOADING SCREEN WITH ESCAPE BUTTON ==========
  // REPLACE YOUR EXISTING "if (isLoading && !currentUser)" BLOCK WITH THIS:
  if (isLoading && !currentUser) {
    return (
      <div className="max-w-md mx-auto py-12 px-6">
        <div className="bg-white border-2 border-black p-8 text-center space-y-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#007398] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>

          {/* Escape button to exit infinite loading */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-3">
              Is loading taking too long?
            </p>
            <button
              onClick={() => {
                setLoadingTimeout(true);
                setCorruptedSession(true);
              }}
              className="text-xs text-red-600 hover:text-red-800 underline font-bold"
            >
              Force exit loading screen
            </button>
          </div>
        </div>
      </div>
    );
  }
  // ==========================================================

  // ========== LOGIN/REGISTRATION FORM (YOUR ORIGINAL CODE) ==========
  return (
    <div className="max-w-md mx-auto py-16 px-6">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white border border-gray-200 p-8 shadow-sm relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-[#007398]" />
        <div className="text-center mb-10">
          <h2 className="text-3xl font-serif font-bold text-gray-900 mb-2">
            {isLogin ? 'Editorial Access' : 'Author Registration'}
          </h2>
          <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">
            National Journal of Sciences
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <>
              <div>
                <label className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-1.5 block">First Name</label>
                <input
                  type="text"
                  className="w-full bg-gray-50 border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-[#007398] focus:bg-white transition-all"
                  placeholder="Your first name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={isLoading}
                />
                {errors.firstName && <p className="mt-1 text-[11px] text-red-700">{errors.firstName}</p>}
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-1.5 block">Last Name</label>
                <input
                  type="text"
                  className="w-full bg-gray-50 border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-[#007398] focus:bg-white transition-all"
                  placeholder="Your last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={isLoading}
                />
                {errors.lastName && <p className="mt-1 text-[11px] text-red-700">{errors.lastName}</p>}
              </div>
            </>
          )}
          <div>
            <label className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-1.5 block">Email</label>
            <input
              type="email"
              className="w-full bg-gray-50 border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-[#007398] focus:bg-white transition-all"
              placeholder="example@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
            {errors.email && <p className="mt-1 text-[11px] text-red-700">{errors.email}</p>}
          </div>
          <div>
            <div className="flex justify-between items-end mb-1.5">
              <label className="text-[10px] uppercase font-bold tracking-widest text-gray-500 block">Password</label>
              {isLogin && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-[9px] uppercase font-bold text-[#007398] hover:underline"
                  disabled={isLoading || !email}
                >
                  Forgot your password?
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="w-full bg-gray-50 border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-[#007398] focus:bg-white transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                disabled={isLoading}
              >
                {showPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-[11px] text-red-700">{errors.password}</p>}
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-black text-white py-4 text-xs uppercase font-black tracking-[0.2em] hover:bg-[#007398] transition-colors flex items-center justify-center gap-3 disabled:bg-gray-400"
          >
            {isLoading ? (
              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>{isLogin ? 'Sign In' : 'Create Account'}</>
            )}
          </button>
        </form>
        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-xs text-gray-500 hover:text-black transition-colors"
            disabled={isLoading}
          >
            {isLogin ? (
              <>First time here? <span className="font-bold text-[#007398]">Create your account</span></>
            ) : (
              <>Already have an account? <span className="font-bold text-[#007398]">Sign in</span></>
            )}
          </button>
        </div>
        <AnimatePresence>
          {message.text && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`mt-6 p-4 text-[11px] font-medium leading-relaxed border-l-4 ${
                message.type === 'error' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-green-50 border-green-500 text-green-700'
              }`}
            >
              {message.text}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}