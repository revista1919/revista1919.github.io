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
// =============================================

// ========== ELEGANT PRE-ORCID EMAIL MODAL ==========
const PreOrcidEmailModal = ({ isOpen, onClose, onConfirm, isLoading }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    onConfirm(email.trim().toLowerCase());
  };

  const handleClose = () => {
    setEmail('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1a1a1a]/70 backdrop-blur-md font-['Inter',sans-serif]"
      onClick={handleClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="bg-[#FCFCFC] border border-gray-200 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] max-w-md w-full p-10 relative overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Decorative top line */}
        <div className="absolute top-0 left-0 w-full h-1 bg-[#A6CE39]" />

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-[#002147] transition-colors duration-300 p-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center mb-10">
          {/* Icon square */}
          <div className="w-16 h-16 bg-[#F5F5F0] border border-gray-200 flex items-center justify-center mx-auto mb-6">
            <OrcidIcon className="w-8 h-8" />
          </div>

          <p className="text-[10px] uppercase tracking-[0.25em] font-semibold text-[#002147] mb-3">
            The National Review of Sciences for Students
          </p>
          <h3 className="font-['Lora',serif] text-2xl text-[#1a1a1a] mb-4 leading-tight font-medium">
            Sign in with ORCID
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed max-w-sm mx-auto">
            You will be redirected to ORCID to authenticate. First, we need your email address to keep you informed about your submissions and reviews.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#002147] mb-3 block">
              Email address
            </label>
            <div className="relative">
              <EnvelopeIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.name@institution.edu"
                className="w-full bg-[#FAFAF8] border border-gray-300 pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:border-[#002147] focus:ring-1 focus:ring-[#002147]/20 focus:bg-white transition-all duration-300 placeholder:text-gray-400"
                autoFocus
                disabled={isLoading}
              />
            </div>
            {error && (
              <p className="mt-2 text-[10px] text-[#8B0000] font-bold uppercase tracking-wider">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || !email}
            className="w-full bg-[#A6CE39] hover:bg-[#96BB32] text-white py-4 text-[10px] uppercase font-bold tracking-[0.25em] transition-colors duration-300 flex items-center justify-center gap-3 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 border-2 border-white/30 border-t-white animate-spin" />
                Connecting to ORCID...
              </>
            ) : (
              <>
                <OrcidIcon className="h-4 w-4" />
                Continue to ORCID
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleClose}
            className="w-full text-center text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400 hover:text-[#002147] transition-colors duration-300 py-2"
            disabled={isLoading}
          >
            Cancel
          </button>
        </form>

        <p className="text-[10px] text-gray-500 text-center mt-6 leading-relaxed border-t border-gray-200 pt-6">
          By continuing, you will be redirected to the official ORCID website to authenticate your academic identity.
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

  // ========== STATES FOR PRE-ORCID MODAL ==========
  const [showPreOrcidModal, setShowPreOrcidModal] = useState(false);
  const [preOrcidEmail, setPreOrcidEmail] = useState('');
  const [isOrcidLoading, setIsOrcidLoading] = useState(false);
  // ================================================

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
            orcid: userDoc.data()?.orcid || ''
          };

          if (!userData.uid || !userData.email) {
            console.error('Corrupted user data detected');
            setCorruptedSession(true);
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

  // ========== STEP 1: OPEN PRE-ORCID EMAIL MODAL ==========
  const handleOrcidButtonClick = () => {
    setShowPreOrcidModal(true);
  };

  // ========== STEP 2: RECEIVE EMAIL AND PROCEED TO ORCID ==========
  const handlePreOrcidConfirm = async (emailFromModal) => {
    setPreOrcidEmail(emailFromModal);
    setShowPreOrcidModal(false);
    setIsOrcidLoading(true);

    // Small delay for smooth modal close animation before opening popup
    setTimeout(async () => {
      try {
        const provider = new OAuthProvider('oidc.orcid');
        provider.addScope('/authenticate');

        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const additionalInfo = getAdditionalUserInfo(result);
        const profile = additionalInfo?.profile || {};

        const orcidId = profile?.sub || '';

        console.log('✅ User authenticated with ORCID:', user.uid);
        console.log('✅ ORCID iD:', orcidId);
        console.log('✅ Email provided by user:', emailFromModal);

        // ========== SAVE TO FIRESTORE WITH USER'S EMAIL ==========
        const userData = {
          uid: user.uid,
          email: emailFromModal, // ← Email the user entered
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
          emailSource: 'user-provided', // Indicates email was given by user
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await setDoc(doc(db, 'users', user.uid), userData, { merge: true });

        setMessage({
          text: `Welcome, ${userData.displayName || 'Author'}!`,
          type: 'success'
        });

        setCurrentUser(userData);
        setIsOrcidLoading(false);
        if (onLogin) onLogin(userData);

      } catch (error) {
        console.error('❌ Error signing in with ORCID:', error);
        setIsOrcidLoading(false);

        let errorText = 'Error signing in with ORCID';
        if (error.code === 'auth/popup-closed-by-user') {
          errorText = 'ORCID window closed. Please try again.';
        } else if (error.code === 'auth/operation-not-allowed') {
          errorText = 'ORCID is not enabled. Contact the administrator.';
        } else if (error.code === 'auth/cancelled-popup-request') {
          errorText = 'Request cancelled. Please try again.';
        }

        setMessage({ text: errorText, type: 'error' });
      }
    }, 300); // 300ms delay for smooth animation
  };

  // ========== CANCEL PRE-ORCID MODAL ==========
  const handlePreOrcidCancel = () => {
    setShowPreOrcidModal(false);
    setPreOrcidEmail('');
  };
  // ===========================================

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

  // ========== RENDER MESSAGE COMPONENT ==========
  const renderMessage = () => {
    if (!message.text) return null;
    
    const isError = message.type === 'error';
    const isSuccess = message.type === 'success';
    const isInfo = message.type === 'info';
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={`mt-6 p-4 text-[10px] uppercase tracking-[0.15em] font-bold leading-relaxed border-l-4 ${
          isError 
            ? 'bg-[#8B0000]/5 border-[#8B0000] text-[#8B0000]' 
            : isSuccess
            ? 'bg-[#002147]/5 border-[#002147] text-[#002147]'
            : 'bg-gray-100 border-gray-400 text-gray-600'
        }`}
      >
        {message.text}
      </motion.div>
    );
  };
  // ==========================================

  // ========== CORRUPTED SESSION OR TIMEOUT SCREEN ==========
  if (corruptedSession || loadingTimeout) {
    return (
      <div className="max-w-md mx-auto py-12 px-6 font-['Inter',sans-serif]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="bg-[#FCFCFC] border border-gray-200 border-t-4 border-t-[#8B0000] p-10 text-center shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)]"
        >
          <div className="w-16 h-16 bg-[#8B0000]/5 border border-[#8B0000]/20 flex items-center justify-center mx-auto mb-6">
            <svg className="h-8 w-8 text-[#8B0000]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>

          <div>
            <h3 className="text-2xl font-['Lora',serif] text-[#1a1a1a] mb-4 leading-tight font-medium">
              {loadingTimeout ? 'Loading Timeout' : 'Corrupted Session Detected'}
            </h3>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              {loadingTimeout
                ? 'Loading is taking too long. This may be due to connection issues or corrupted data.'
                : 'Your session data appears to be corrupted. This prevents you from accessing the portal correctly.'}
            </p>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed">
              If the problem persists, please report the error to:{' '}
              <a
                href="mailto:contact@revistacienciasestudiantes.com"
                className="text-[#002147] underline font-bold hover:text-[#8B0000] transition-colors duration-300"
              >
                contact@revistacienciasestudiantes.com
              </a>
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={forceResetSession}
              className="w-full bg-[#8B0000] hover:bg-[#6B0000] text-white py-4 text-[10px] uppercase font-bold tracking-[0.25em] transition-colors duration-300"
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
              className="w-full border border-gray-300 text-[#1a1a1a] py-4 text-[10px] uppercase font-bold tracking-[0.25em] hover:bg-gray-50 transition-colors duration-300"
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
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="max-w-md mx-auto py-12 px-6 font-['Inter',sans-serif]"
      >
        <div className="bg-[#FCFCFC] border border-gray-200 border-t-4 border-t-[#002147] p-10 text-center shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)]">
          <div className="w-20 h-20 bg-[#F5F5F0] border border-gray-200 flex items-center justify-center mx-auto mb-6">
            {currentUser.imageUrl ? (
              <img 
                src={currentUser.imageUrl} 
                alt={currentUser.displayName} 
                className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500" 
              />
            ) : (
              <UserIcon className="h-8 w-8 text-gray-400" />
            )}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] font-semibold text-[#002147] mb-3">
              Active Session
            </p>
            <h3 className="text-2xl font-['Lora',serif] text-[#002147] mb-3 font-medium">
              {currentUser.displayName}
            </h3>
            {currentUser.orcid && (
              <a
                href={`https://orcid.org/${currentUser.orcid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#F5F5F0] border border-gray-200 text-[10px] text-gray-600 hover:border-[#A6CE39] hover:bg-white transition-colors duration-300 font-semibold tracking-wider"
              >
                <OrcidIcon className="h-3 w-3" />
                {currentUser.orcid}
              </a>
            )}
            <p className="text-sm text-gray-500 font-mono mt-3">
              {currentUser.roles.join('; ')}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="mt-8 flex items-center justify-center gap-2 w-full py-4 border border-[#8B0000] text-[#8B0000] text-[10px] uppercase font-bold tracking-[0.25em] hover:bg-[#8B0000] hover:text-white transition-colors duration-300"
          >
            <ArrowRightOnRectangleIcon className="h-4 w-4" /> Sign Out
          </button>
          {renderMessage()}
        </div>
      </motion.div>
    );
  }
  // ==============================================

  // ========== ORCID LOADING SCREEN ==========
  if (isOrcidLoading) {
    return (
      <div className="max-w-md mx-auto py-12 px-6 font-['Inter',sans-serif]">
        <div className="bg-[#FCFCFC] border border-gray-200 p-12 text-center shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)]">
          <OrcidIcon className="h-12 w-12 mx-auto mb-6" />
          <div className="animate-spin h-8 w-8 border-2 border-transparent border-t-[#A6CE39] mx-auto mb-6"></div>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#002147] mb-3">
            Connecting to ORCID...
          </p>
          <p className="text-xs text-gray-500 mb-6">
            A pop-up window will open for authentication.
          </p>

          <div className="pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-3">
              Didn't see the pop-up?
            </p>
            <button
              onClick={() => {
                setIsOrcidLoading(false);
                setMessage({ text: 'Sign in cancelled.', type: 'info' });
              }}
              className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#8B0000] hover:text-[#6B0000] transition-colors duration-300"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }
  // ===========================================

  // ========== LOADING SCREEN WITH ESCAPE BUTTON ==========
  if (isLoading && !currentUser) {
    return (
      <div className="max-w-md mx-auto py-12 px-6 font-['Inter',sans-serif]">
        <div className="bg-[#FCFCFC] border border-gray-200 p-12 text-center shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)]">
          <div className="animate-spin h-8 w-8 border-2 border-transparent border-t-[#002147] mx-auto mb-6"></div>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#002147] mb-3">
            Loading...
          </p>

          <div className="pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-3">
              Is loading taking too long?
            </p>
            <button
              onClick={() => {
                setLoadingTimeout(true);
                setCorruptedSession(true);
              }}
              className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#8B0000] hover:text-[#6B0000] transition-colors duration-300"
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
    <>
      <div className="max-w-md mx-auto py-16 px-6 font-['Inter',sans-serif]">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="bg-[#FCFCFC] border border-gray-200 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] relative overflow-hidden"
        >
          {/* Decorative top line */}
          <div className="absolute top-0 left-0 w-full h-1 bg-[#002147]" />
          
          <div className="p-10">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-['Lora',serif] text-[#1a1a1a] mb-4 leading-tight font-medium">
                {isLogin ? 'Editorial Access' : 'Author Registration'}
              </h2>
              <div className="w-16 h-px bg-[#002147]/30 mx-auto mb-4"></div>
              <p className="text-[10px] text-[#002147]/70 uppercase tracking-[0.3em] font-semibold">
                The National Review of Sciences for Students
              </p>
            </div>

            {/* ========== ORCID BUTTON (OPENS MODAL FIRST) ========== */}
            <div className="mb-8">
              <button
                type="button"
                onClick={handleOrcidButtonClick}
                disabled={isLoading}
                className="w-full bg-[#A6CE39] hover:bg-[#96BB32] text-white py-4 text-[10px] uppercase font-bold tracking-[0.25em] transition-colors duration-300 flex items-center justify-center gap-3 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <OrcidIcon className="h-4 w-4" />
                Sign in with ORCID
              </button>
            </div>

            {/* ========== SEPARATOR ========== */}
            <div className="relative mb-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-[#FCFCFC] px-4 text-[10px] uppercase tracking-[0.25em] font-semibold text-gray-500">
                  or with email
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {!isLogin && (
                <>
                  <div>
                    <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#002147] mb-3 block">
                      First Name
                    </label>
                    <input
                      type="text"
                      className="w-full bg-[#FAFAF8] border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:border-[#002147] focus:ring-1 focus:ring-[#002147]/20 focus:bg-white transition-all duration-300"
                      placeholder="Your first name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      disabled={isLoading}
                    />
                    {errors.firstName && (
                      <p className="mt-1 text-[10px] font-bold text-[#8B0000] uppercase tracking-wider">
                        {errors.firstName}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#002147] mb-3 block">
                      Last Name
                    </label>
                    <input
                      type="text"
                      className="w-full bg-[#FAFAF8] border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:border-[#002147] focus:ring-1 focus:ring-[#002147]/20 focus:bg-white transition-all duration-300"
                      placeholder="Your last name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      disabled={isLoading}
                    />
                    {errors.lastName && (
                      <p className="mt-1 text-[10px] font-bold text-[#8B0000] uppercase tracking-wider">
                        {errors.lastName}
                      </p>
                    )}
                  </div>
                </>
              )}
              
              <div>
                <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#002147] mb-3 block">
                  Email
                </label>
                <input
                  type="email"
                  className="w-full bg-[#FAFAF8] border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:border-[#002147] focus:ring-1 focus:ring-[#002147]/20 focus:bg-white transition-all duration-300"
                  placeholder="example@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
                {errors.email && (
                  <p className="mt-1 text-[10px] font-bold text-[#8B0000] uppercase tracking-wider">
                    {errors.email}
                  </p>
                )}
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#002147] block">
                    Password
                  </label>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 hover:text-[#002147] transition-colors duration-300"
                      disabled={isLoading || !email}
                    >
                      Forgot your password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="w-full bg-[#FAFAF8] border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:border-[#002147] focus:ring-1 focus:ring-[#002147]/20 focus:bg-white transition-all duration-300 pr-12"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#002147] transition-colors duration-300"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-[10px] font-bold text-[#8B0000] uppercase tracking-wider">
                    {errors.password}
                  </p>
                )}
              </div>
              
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#002147] hover:bg-[#001A3A] text-white py-4 text-[10px] uppercase font-bold tracking-[0.25em] transition-colors duration-300 flex items-center justify-center gap-3 disabled:bg-gray-400 mt-4"
              >
                {isLoading ? (
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <>{isLogin ? 'Sign In' : 'Create Account'}</>
                )}
              </button>
            </form>
            
            <div className="mt-8 pt-6 border-t border-gray-200 text-center">
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500 hover:text-[#002147] transition-colors duration-300"
                disabled={isLoading}
              >
                {isLogin ? (
                  <>First time here? <span className="text-[#002147] underline underline-offset-4">Create your account</span></>
                ) : (
                  <>Already have an account? <span className="text-[#002147] underline underline-offset-4">Sign in</span></>
                )}
              </button>
            </div>
            {renderMessage()}
          </div>
        </motion.div>
      </div>

      {/* ========== PRE-ORCID MODAL (OUTSIDE FORM) ========== */}
      <AnimatePresence>
        {showPreOrcidModal && (
          <PreOrcidEmailModal
            isOpen={showPreOrcidModal}
            onClose={handlePreOrcidCancel}
            onConfirm={handlePreOrcidConfirm}
            isLoading={false}
          />
        )}
      </AnimatePresence>
      {/* ==================================================== */}
    </>
  );
}