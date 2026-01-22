import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { motion, AnimatePresence } from 'framer-motion';
import { EyeIcon, EyeSlashIcon, LockClosedIcon, UserIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
  auth
} from '../firebase';

const USERS_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv';

export default function LoginSection({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({ email: '', password: '' });
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    if (!auth) {
      console.error('Error: auth is not defined. Check firebase.js');
      setMessage({ text: 'Configuration error. Contact the team.', type: 'error' });
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const normalizedEmail = user.email.toLowerCase();
        const csvUser = users.find(u =>
          u.Correo?.toLowerCase() === normalizedEmail ||
          u['E-mail']?.toLowerCase() === normalizedEmail
        );

        if (!csvUser) {
          setMessage({ text: 'This email is not authorized. Are you an author or team member? If so, contact us by email.', type: 'error' });
          await signOut(auth).catch((err) => console.error('Error signing out:', err));
          setCurrentUser(null);
          return;
        }

        const userData = {
          uid: user.uid,
          email: user.email,
          name: csvUser?.Nombre || user.email,
          role: csvUser?.['Rol en la Revista'] || 'User'
        };

        setMessage({ text: `Welcome, ${userData.name}!`, type: 'success' });
        setCurrentUser(userData);
        if (onLogin) onLogin(userData);
      } else {
        setMessage({ text: '', type: '' });
        setCurrentUser(null);
      }
    });

    return () => unsubscribe();
  }, [onLogin, users]);

  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(USERS_CSV, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Error loading CSV: ${response.status}`);
        
        const csvText = await response.text();
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          delimiter: ',',
          transform: (value) => value?.toString().trim(),
          complete: ({ data }) => {
            const validUsers = data.filter(user =>
              user.Correo &&
              typeof user.Correo === 'string' &&
              user.Correo.includes('@') &&
              user.Correo.includes('.')
            );
            setUsers(validUsers);
            console.log(`✅ ${validUsers.length} authorized users loaded from CSV`);
            setIsLoading(false);
          },
          error: (err) => {
            console.error('CSV Error:', err);
            setMessage({ text: 'Error loading the user list', type: 'error' });
            setIsLoading(false);
          },
        });
      } catch (err) {
        console.error('Fetch error:', err);
        setMessage({ text: 'Error loading the user list', type: 'error' });
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const validateInputs = () => {
    let isValid = true;
    const newErrors = { email: '', password: '' };
    const normalizedEmail = email.trim().toLowerCase();

    if (!email) {
      newErrors.email = 'Email is required';
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      newErrors.email = 'Invalid email format';
      isValid = false;
    } else {
      const userFromCSV = users.find(user =>
        user.Correo?.trim().toLowerCase() === normalizedEmail ||
        user['E-mail']?.trim().toLowerCase() === normalizedEmail
      );
      if (!userFromCSV) {
        newErrors.email = 'This email is not authorized';
        isValid = false;
      }
    }

    if (!password) {
      newErrors.password = 'Password is required';
      isValid = false;
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters long';
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
      console.log('✅ User created:', user.uid);
      setMessage({ text: `Password created for ${user.email}! You can now sign in.`, type: 'success' });

      setEmail('');
      setPassword('');
      setIsLogin(true);
      setErrors({ email: '', password: '' });
    } catch (error) {
      console.error('Signup error:', error.code, error.message);
      let errorText = 'Error creating account';

      switch (error.code) {
        case 'auth/email-already-in-use':
          errorText = 'This email is already registered. Try signing in or use "Forgot password".';
          break;
        case 'auth/weak-password':
          errorText = 'Password is too weak. It must be at least 6 characters.';
          break;
        case 'auth/invalid-email':
          errorText = 'Invalid email';
          break;
        case 'auth/too-many-requests':
          errorText = 'Too many attempts. Try again later.';
          break;
        default:
          errorText = error.message || 'Unknown error';
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
      const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      const user = userCredential.user;

      const csvUser = users.find(u =>
        u.Correo?.toLowerCase() === user.email.toLowerCase() ||
        u['E-mail']?.toLowerCase() === user.email.toLowerCase()
      );

      const userData = {
        uid: user.uid,
        email: user.email,
        name: csvUser?.Nombre || user.email,
        role: csvUser?.['Rol en la Revista'] || 'User'
      };

      setMessage({ text: `Welcome, ${userData.name}!`, type: 'success' });
      if (onLogin) onLogin(userData);
    } catch (error) {
      console.error('Login error:', error.code, error.message);
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
        case 'auth/too-many-requests':
          errorText = 'Too many attempts. Try again later.';
          break;
        default:
          errorText = error.message || 'Unknown error';
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

    const normalizedEmail = email.trim().toLowerCase();
    const userFromCSV = users.find(user =>
      user.Correo?.trim().toLowerCase() === normalizedEmail ||
      user['E-mail']?.trim().toLowerCase() === normalizedEmail
    );

    if (!userFromCSV) {
      setMessage({ text: 'This email is not authorized on the list', type: 'error' });
      return;
    }

    setIsLoading(true);
    setMessage({ text: '', type: '' });

    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      console.log('✅ Password reset email sent to:', normalizedEmail);
      setMessage({ text: 'Check your email (including spam/junk) to reset your password. It may take a few minutes.', type: 'success' });
    } catch (error) {
      console.error('Forgot password error:', error.code, error.message);
      let errorText = 'Error sending password reset email';

      switch (error.code) {
        case 'auth/invalid-email':
          errorText = 'Invalid email format';
          break;
        case 'auth/user-not-found':
          errorText = 'No account registered with this email. Use "Create Password" first.';
          break;
        case 'auth/too-many-requests':
          errorText = 'Too many attempts. Wait 10–15 minutes.';
          break;
        case 'auth/missing-email':
          errorText = 'Email is missing';
          break;
        default:
          errorText += ` (${error.message})`;
      }

      setMessage({ text: errorText, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setMessage({ text: 'Successfully signed out', type: 'success' });
      setCurrentUser(null);
      setEmail('');
      setPassword('');
      setIsLogin(true);
      if (onLogin) onLogin(null);
    } catch (error) {
      console.error('Logout error:', error);
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

  if (currentUser) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-md mx-auto py-12 px-6">
        <div className="bg-white border-2 border-black p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto border border-gray-200">
            <UserIcon className="h-10 w-10 text-gray-400" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#007398] mb-1">Session Active</p>
            <h3 className="text-2xl font-serif font-bold text-gray-900">{currentUser.name}</h3>
            <p className="text-sm text-gray-500 font-mono">{currentUser.role}</p>
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

  if (isLoading && users.length === 0) {
    return (
      <div className="max-w-md mx-auto py-12 px-6">
        <div className="bg-white border-2 border-black p-8 text-center space-y-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#007398] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading user list...</p>
        </div>
      </div>
    );
  }

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
          <div>
            <label className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-1.5 block">Email</label>
            <div className="relative">
              <input
                type="email"
                className="w-full bg-gray-50 border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-[#007398] focus:bg-white transition-all"
                placeholder="example@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
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
            disabled={isLoading || users.length === 0}
            className="w-full bg-black text-white py-4 text-xs uppercase font-black tracking-[0.2em] hover:bg-[#007398] transition-colors flex items-center justify-center gap-3 disabled:bg-gray-400"
          >
            {isLoading ? (
              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>{isLogin ? 'Sign In' : 'Set Password'}</>
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
              <>First time here? <span className="font-bold text-[#007398]">Create your password</span></>
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
      <p className="mt-8 text-center text-[10px] text-gray-400 uppercase tracking-widest leading-loose">
        Editorial Management System <br />
        For journal users only.
        {process.env.NODE_ENV === 'development' && <br />}
        {process.env.NODE_ENV === 'development' && `${users.length} authorized users`}
      </p>
    </div>
  );
}
