// app/[locale]/login/LoginSection.jsx
'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
  auth,
} from '@/lib/firebase';
import Papa from 'papaparse';

const USERS_CSV = process.env.NEXT_PUBLIC_USERS_CSV_URL || '';

export default function LoginSection({ onLogin }) {
  const t = useTranslations('LoginSection');
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({ email: '', password: '' });
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    if (!auth) {
      console.error(t('errors.authNotDefined'));
      setMessage(t('errors.configError'));
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const normalizedEmail = user.email.toLowerCase();
        const csvUser = users.find(
          (u) =>
            u.Correo?.toLowerCase() === normalizedEmail ||
            u['E-mail']?.toLowerCase() === normalizedEmail
        );

        if (!csvUser) {
          setMessage(t('errors.unauthorizedEmail'));
          await signOut(auth).catch((err) => console.error(t('errors.logoutError'), err));
          setCurrentUser(null);
          return;
        }

        const userData = {
          uid: user.uid,
          email: user.email,
          name: csvUser?.Nombre || user.email,
          role: csvUser?.['Rol en la Revista'] || t('defaultRole'),
        };

        setMessage(t('welcomeMessage', { name: userData.name }));
        if (onLogin) onLogin(userData);
      } else {
        setMessage('');
        setCurrentUser(null);
      }
    });

    return () => unsubscribe();
  }, [onLogin, users, t]);

  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(USERS_CSV, { cache: 'no-store' });
        if (!response.ok) throw new Error(t('errors.csvFetchError', { status: response.status }));
        
        const csvText = await response.text();
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          delimiter: ',',
          transform: (value) => value?.toString().trim(),
          complete: ({ data }) => {
            const validUsers = data.filter(
              (user) =>
                user.Correo &&
                typeof user.Correo === 'string' &&
                user.Correo.includes('@') &&
                user.Correo.includes('.')
            );
            setUsers(validUsers);
            console.log(t('usersLoaded', { count: validUsers.length }));
            setIsLoading(false);
          },
          error: (err) => {
            console.error(t('errors.csvParseError'), err);
            setMessage(t('errors.loadUsersError'));
            setIsLoading(false);
          },
        });
      } catch (err) {
        console.error(t('errors.fetchError'), err);
        setMessage(t('errors.connectionError'));
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [t]);

  const validateInputs = () => {
    let isValid = true;
    const newErrors = { email: '', password: '' };
    const normalizedEmail = email.trim().toLowerCase();

    if (!email) {
      newErrors.email = t('errors.emailRequired');
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      newErrors.email = t('errors.invalidEmailFormat');
      isValid = false;
    } else {
      const userFromCSV = users.find(
        (user) =>
          user.Correo?.trim().toLowerCase() === normalizedEmail ||
          user['E-mail']?.trim().toLowerCase() === normalizedEmail
      );
      if (!userFromCSV) {
        newErrors.email = t('errors.unauthorizedEmail');
        isValid = false;
      }
    }

    if (!password) {
      newErrors.password = t('errors.passwordRequired');
      isValid = false;
    } else if (password.length < 6) {
      newErrors.password = t('errors.passwordTooShort');
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSignUp = async () => {
    if (!validateInputs()) return;

    setIsLoading(true);
    setMessage('');
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      const user = userCredential.user;
      console.log(t('userCreated', { uid: user.uid }));
      setMessage(t('passwordCreated', { email: user.email }));

      setEmail('');
      setPassword('');
      setIsLogin(true);
      setErrors({ email: '', password: '' });
    } catch (error) {
      console.error(t('errors.signupError'), error.code, error.message);
      let errorMessage = t('errors.createPasswordError');

      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = t('errors.emailAlreadyInUse');
          break;
        case 'auth/weak-password':
          errorMessage = t('errors.weakPassword');
          break;
        case 'auth/invalid-email':
          errorMessage = t('errors.invalidEmailFormat');
          break;
        case 'auth/too-many-requests':
          errorMessage = t('errors.tooManyRequests');
          break;
        default:
          errorMessage = error.message || t('errors.unknownError');
      }

      setMessage(errorMessage);
    }

    setIsLoading(false);
  };

  const handleLogin = async () => {
    if (!validateInputs()) return;

    setIsLoading(true);
    setMessage('');
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      const user = userCredential.user;

      const csvUser = users.find(
        (u) =>
          u.Correo?.toLowerCase() === user.email.toLowerCase() ||
          u['E-mail']?.toLowerCase() === user.email.toLowerCase()
      );

      const userData = {
        uid: user.uid,
        email: user.email,
        name: csvUser?.Nombre || user.email,
        role: csvUser?.['Rol en la Revista'] || t('defaultRole'),
      };

      setMessage(t('welcomeMessage', { name: userData.name }));
      if (onLogin) onLogin(userData);
    } catch (error) {
      console.error(t('errors.loginError'), error.code, error.message);
      let errorMessage = t('errors.loginFailed');

      switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
          errorMessage = t('errors.invalidCredentials');
          break;
        case 'auth/invalid-email':
          errorMessage = t('errors.invalidEmailFormat');
          break;
        case 'auth/too-many-requests':
          errorMessage = t('errors.tooManyRequests');
          break;
        default:
          errorMessage = error.message || t('errors.unknownError');
      }

      setMessage(errorMessage);
    }

    setIsLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setMessage(t('errors.emailRequiredFirst'));
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const userFromCSV = users.find(
      (user) =>
        user.Correo?.trim().toLowerCase() === normalizedEmail ||
        user['E-mail']?.trim().toLowerCase() === normalizedEmail
    );

    if (!userFromCSV) {
      setMessage(t('errors.unauthorizedEmail'));
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      console.log(t('resetEmailSent', { email: normalizedEmail }));
      setMessage(t('checkEmailForReset'));
    } catch (error) {
      console.error(t('errors.forgotPasswordError'), error.code, error.message);
      let errorMessage = t('errors.resetPasswordError');

      switch (error.code) {
        case 'auth/invalid-email':
          errorMessage = t('errors.invalidEmailFormat');
          break;
        case 'auth/user-not-found':
          errorMessage = t('errors.userNotFound');
          break;
        case 'auth/too-many-requests':
          errorMessage = t('errors.tooManyRequests');
          break;
        case 'auth/missing-email':
          errorMessage = t('errors.missingEmail');
          break;
        default:
          errorMessage = t('errors.resetPasswordErrorWithMessage', { message: error.message });
      }

      setMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setMessage(t('sessionClosed'));
      setCurrentUser(null);
      setEmail('');
      setPassword('');
      setIsLogin(true);
      if (onLogin) onLogin(null);
    } catch (error) {
      console.error(t('errors.logoutError'), error);
      setMessage(t('errors.logoutFailed'));
    }
  };

  const handleSubmit = () => {
    if (isLogin) {
      handleLogin();
    } else {
      handleSignUp();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  if (currentUser) {
    return (
      <div className="flex items-center justify-center py-8 px-2 sm:px-0">
        <div className="w-full max-w-sm p-6 sm:p-8 space-y-6 bg-white rounded-lg shadow-lg text-center">
          <h3 className="text-xl sm:text-2xl font-semibold text-green-600">{t('activeSession')}</h3>
          <p className="text-gray-600 mb-4">
            {t('emailLabel')}: {currentUser.email}
          </p>
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm sm:text-base"
          >
            {t('logout')}
          </button>
          {message && (
            <p
              className={`text-center text-xs sm:text-sm text-green-600`}
            >
              {message}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (isLoading && users.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 px-2 sm:px-0">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('loadingUsers')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-8 px-2 sm:px-0">
      <div className="w-full max-w-sm p-6 sm:p-8 space-y-6 bg-white rounded-lg shadow-lg">
        <h3 className="text-xl sm:text-2xl font-semibold text-center text-gray-800">
          {isLogin ? t('loginTitle') : t('signupTitle')}
        </h3>

        <button
          onClick={() => setIsLogin(!isLogin)}
          className="text-sm text-blue-500 hover:underline text-center w-full"
          disabled={isLoading}
        >
          {isLogin ? t('switchToSignup') : t('switchToLogin')}
        </button>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('emailLabel')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={handleKeyPress}
              className={`w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base ${
                errors.email ? 'border-red-500' : 'border-gray-300'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              placeholder={t('emailPlaceholder')}
              disabled={isLoading}
            />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-gray-700">
              {isLogin ? t('passwordLabel') : t('newPasswordLabel')}
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              className={`w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base ${
                errors.password ? 'border-red-500' : 'border-gray-300'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              placeholder={t('passwordPlaceholder')}
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 top-6"
              disabled={isLoading}
            >
              {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
            </button>
            {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
          </div>

          <button
            onClick={handleSubmit}
            disabled={isLoading || users.length === 0}
            className={`w-full px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base ${
              isLoading || users.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {t('processing')}
              </span>
            ) : isLogin ? t('loginButton') : t('signupButton')
          }
          </button>

          {isLogin && (
            <button
              onClick={handleForgotPassword}
              className="w-full text-sm text-blue-500 hover:underline text-center"
              disabled={isLoading || !email}
            >
              {t('forgotPassword')}
            </button>
          )}

          {message && (
            <p
              className={`text-center text-xs sm:text-sm ${
                message.includes('✅') || message.includes(t('welcomeMessage'))
                  ? 'text-green-600 font-medium'
                  : 'text-red-500'
              }`}
            >
              {message}
            </p>
          )}

          {process.env.NODE_ENV === 'development' && (
            <p className="text-xs text-gray-500 text-center">
              {t('authorizedUsers', { count: users.length })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}