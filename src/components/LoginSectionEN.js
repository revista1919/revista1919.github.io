import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EyeIcon, EyeSlashIcon, ArrowRightOnRectangleIcon, UserIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
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
  getDoc,
  updateDoc,
  OAuthProvider,
  signInWithPopup,
  getAdditionalUserInfo
} from '../firebase';

// ========== ORCID LOGO COMPONENT ==========
const OrcidIcon = ({ className = "h-5 w-5" }) => (
  <svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="128" cy="128" r="120" fill="#A6CE39" />
    <g fill="#FFFFFF">
      <rect x="71" y="78" width="17" height="102" />
      <circle cx="79.5" cy="56" r="11" />
      <path d="M103 78 v102 h41.5 c28.2 0 51-22.8 51-51 s-22.8-51-51-51 H103 zm17 17 h24.5 c18.8 0 34 15.2 34 34 s-15.2 34-34 34 H120 V95 z" fillRule="evenodd" />
    </g>
  </svg>
);

// ========== ELEGANT EMAIL MODAL FOR ORCID ==========
const OrcidEmailModal = ({ user, onComplete, onCancel }) => {
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        email: email.trim().toLowerCase(),
        emailPending: false,
        emailVerified: true,
        emailUpdatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      onComplete(email.trim().toLowerCase());
    } catch (err) {
      console.error('Error saving email:', err);
      setError('Error saving. Please try again.');
    }
    setSaving(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="bg-white rounded-none border border-gray-200 shadow-2xl max-w-md w-full p-10 relative overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Decorative top line */}
        <div className="absolute top-0 left-0 w-full h-1 bg-[#A6CE39]" />

        <div className="text-center mb-8">
          {/* Icon circle */}
          <div className="w-16 h-16 bg-stone-50 border border-stone-200 rounded-full flex items-center justify-center mx-auto mb-5">
            <EnvelopeIcon className="w-7 h-7 text-stone-500" />
          </div>

          <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#A6CE39] mb-2">
            The National Review of Sciences for Students
          </p>
          <h3 className="font-serif text-2xl font-bold text-gray-900 mb-3">
            Email Address
          </h3>
          <p className="text-sm text-gray-500 leading-relaxed max-w-sm mx-auto">
            Your ORCID account does not include a public email. We need one to send you notifications about your submissions, reviews, and portal updates.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-[10px] uppercase font-bold tracking-widest text-gray-400 mb-1.5 block">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.name@institution.edu"
              className="w-full bg-gray-50 border border-gray-200 px-4 py-3.5 text-sm focus:outline-none focus:border-[#A6CE39] focus:bg-white transition-all placeholder:text-gray-300"
              autoFocus
            />
            {error && (
              <p className="mt-2 text-[11px] text-red-600 font-medium">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-gray-900 text-white py-4 text-xs uppercase font-black tracking-[0.2em] hover:bg-[#A6CE39] transition-colors flex items-center justify-center gap-3 disabled:bg-gray-300"
          >
            {saving ? (
              <>
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              'Save & Continue'
            )}
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors py-2 font-medium"
          >
            Skip for now
          </button>
        </form>

        <p className="text-[10px] text-gray-400 text-center mt-6 leading-relaxed">
          You can change your email later from the profile section of the editorial portal.
        </p>
      </motion.div>
    </motion.div>
  );
};
// =====================================================

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

  // ========== STATES FOR ORCID EMAIL MODAL ==========
  const [showOrcidEmailModal, setShowOrcidEmailModal] = useState(false);
  const [pendingOrcidUser, setPendingOrcidUser] = useState(null);
  // ==================================================

  // ========== STATES FOR CORRUPTION AND TIMEOUT HANDLING ==========
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [corruptedSession, setCorruptedSession] = useState(false);
  const timeoutRef = useRef(null);
  const MAX_LOADING_TIME = 15000; // 15 seconds max
  // =================================================================

  useEffect(() => {
    if (!auth) {
      setMessage({ text: 'Configuration error', type: 'error' });
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (!currentUser) {
      timeoutRef.current = setTimeout(() => {
        console.error('LoginSection loading timeout - possible corruption');
        setLoadingTimeout(true);
        timeoutRef.current = null;
      }, MAX_LOADING_TIME);
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));

          if (!userDoc.exists()) {
            console.error('Authenticated user but no Firestore document');
            setCorruptedSession(true);
            return;
          }

          const userData = {
            uid: user.uid,
            email: userDoc.data()?.email || user.email || '',
            firstName: userDoc.data()?.firstName || '',
            lastName: userDoc.data()?.lastName || '',
            displayName: userDoc.data()?.displayName || user.email || '',
            roles: userDoc.data()?.roles || ['Author'],
            description: userDoc.data()?.description || { es: '', en: '' },
            interests: userDoc.data()?.interests || { es: '', en: '' },
            imageUrl: userDoc.data()?.imageUrl || '',
            social: userDoc.data()?.social || {},
            publicEmail: userDoc.data()?.publicEmail || null,
            orcid: userDoc.data()?.orcid || '',
            emailPending: userDoc.data()?.emailPending || false
          };

          if (!userData.uid) {
            console.error('Corrupted user data - missing UID');
            setCorruptedSession(true);
            return;
          }

          // If email is pending (ORCID without email), show modal
          if (userData.emailPending && !userData.email) {
            setPendingOrcidUser(userData);
            setShowOrcidEmailModal(true);
            setCorruptedSession(false);
            setLoadingTimeout(false);
            return;
          }

          setCorruptedSession(false);
          setLoadingTimeout(false);
          
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
        setCorruptedSession(false);
        setLoadingTimeout(false);
      }
    });

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      unsubscribe();
    };
  }, [onLogin]);

  // ========== FORCE SESSION RESET FUNCTION ==========
  const forceResetSession = async () => {
    try {
      localStorage.removeItem('userSession');
      sessionStorage.clear();

      if (auth.currentUser) {
        await signOut(auth);
      }

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
        emailPending: false,
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

  // ========== ORCID SIGN IN (CLEAN VERSION) ==========
  const signInWithOrcid = async () => {
    setIsLoading(true);
    setMessage({ text: '', type: '' });

    try {
      const provider = new OAuthProvider('oidc.orcid');
      provider.addScope('/authenticate');

      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const additionalInfo = getAdditionalUserInfo(result);
      const profile = additionalInfo?.profile || {};

      const orcidId = profile?.sub || '';

      console.log('User authenticated with ORCID:', user.uid);
      console.log('ORCID iD:', orcidId);

      // Save to Firestore (email pending)
      const userData = {
        uid: user.uid,
        email: '',
        firstName: profile?.given_name || '',
        lastName: profile?.family_name || '',
        displayName: profile?.name || '',
        roles: ['Author'],
        description: { es: '', en: '' },
        interests: { es: '', en: '' },
        imageUrl: profile?.picture || '',
        social: {},
        publicEmail: null,
        orcid: orcidId,
        emailPending: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'users', user.uid), userData, { merge: true });

      // Show email modal
      setPendingOrcidUser(userData);
      setShowOrcidEmailModal(true);

    } catch (error) {
      console.error('Error signing in with ORCID:', error);

      let errorText = 'Error signing in with ORCID';
      if (error.code === 'auth/popup-closed-by-user') {
        errorText = 'Window closed. Please try again.';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorText = 'ORCID is not enabled. Contact the administrator.';
      }

      setMessage({ text: errorText, type: 'error' });
      setIsLoading(false);
    }
  };
  // ===================================================

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
      <>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-md mx-auto py-12 px-6">
          <div className="bg-white border-2 border-black p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto border border-gray-200">
              {currentUser.imageUrl ? (
                <img src={currentUser.imageUrl} alt={currentUser.displayName} className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <UserIcon className="h-10 w-10 text-gray-400" />
              )}
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#007398] mb-1">Active Session</p>
              <h3 className="text-2xl font-serif font-bold text-gray-900">{currentUser.displayName}</h3>
              {currentUser.orcid && (
                <a
                  href={`https://orcid.org/${currentUser.orcid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[#A6CE39] hover:underline mt-1"
                >
                  <OrcidIcon className="h-4 w-4" />
                  {currentUser.orcid}
                </a>
              )}
              <p className="text-sm text-gray-500 font-mono mt-2">{currentUser.roles.join('; ')}</p>
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

        {/* ========== ORCID EMAIL MODAL ========== */}
        <AnimatePresence>
          {showOrcidEmailModal && pendingOrcidUser && (
            <OrcidEmailModal
              user={pendingOrcidUser}
              onComplete={(email) => {
                setShowOrcidEmailModal(false);
                setIsLoading(false);
                const updatedUser = { ...pendingOrcidUser, email, emailPending: false };
                setCurrentUser(updatedUser);
                setMessage({
                  text: `Welcome, ${updatedUser.displayName || 'Author'}!`,
                  type: 'success'
                });
                if (onLogin) onLogin(updatedUser);
              }}
              onCancel={() => {
                setShowOrcidEmailModal(false);
                setIsLoading(false);
                setCurrentUser(pendingOrcidUser);
                setMessage({
                  text: `Welcome, ${pendingOrcidUser.displayName || 'Author'}! You can add your email in your profile later.`,
                  type: 'info'
                });
                if (onLogin) onLogin(pendingOrcidUser);
              }}
            />
          )}
        </AnimatePresence>
        {/* ====================================== */}
      </>
    );
  }
  // ==============================================

  // ========== LOADING SCREEN WITH ESCAPE BUTTON ==========
  if (isLoading && !currentUser) {
    return (
      <div className="max-w-md mx-auto py-12 px-6">
        <div className="bg-white border-2 border-black p-8 text-center space-y-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#007398] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>

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

  // ========== LOGIN/REGISTRATION FORM ==========
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
            The National Review of Sciences for Students
          </p>
        </div>

        {/* ========== ORCID BUTTON ========== */}
        <div className="mb-6">
          <button
            type="button"
            onClick={signInWithOrcid}
            disabled={isLoading}
            className="w-full bg-[#A6CE39] hover:bg-[#8FB832] text-white py-4 text-xs uppercase font-black tracking-[0.2em] transition-colors flex items-center justify-center gap-3 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-sm"
          >
            {isLoading ? (
              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <OrcidIcon className="h-5 w-5" />
                Sign in with ORCID
              </>
            )}
          </button>
        </div>

        {/* ========== SEPARATOR ========== */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-4 text-gray-400 font-bold tracking-widest">or with email</span>
          </div>
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