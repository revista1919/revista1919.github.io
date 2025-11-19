import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
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
  const [message, setMessage] = useState('');
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({ email: '', password: '' });
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    if (!auth) {
      console.error('Error: auth no está definido. Revisa firebase.js');
      setMessage('❌ Error in settings. Contact the team.');
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const normalizedEmail = user.email.toLowerCase();
        const csvUser = users.find(u =>
          u.Correo?.toLowerCase() === normalizedEmail ||
          u['E-mail']?.toLowerCase() === normalizedEmail
        );

        if (!csvUser) {
          setMessage('❌ This email direction is not authorized. ¿Are you an author or a member or the team? If yes, contact us by email.');
          await signOut(auth).catch((err) => console.error('Error al cerrar sesión:', err));
          setCurrentUser(null);
          return;
        }

        const userData = {
          uid: user.uid,
          email: user.email,
          name: csvUser?.Nombre || user.email,
          role: csvUser?.['Rol en la Revista'] || 'User'
        };

        setMessage(`✅ ¡Welcome, ${userData.name}!`);
        if (onLogin) onLogin(userData);
      } else {
        setMessage('');
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
        if (!response.ok) throw new Error(`Error al cargar CSV: ${response.status}`);
        
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
            console.error('Error CSV:', err);
            setMessage('Error loading user list');
            setIsLoading(false);
          },
        });
      } catch (err) {
        console.error('Error fetch:', err);
        setMessage('Error loading user list');
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const validateInputs = () => {
    let isValid = true;
    const newErrors = { email: '', password: '' };
    const normalizedEmail = email.trim().toLowerCase();

    // Validar email
    if (!email) {
      newErrors.email = 'Email required';
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

    // Validar contraseña
    if (!password) {
      newErrors.password = 'Password is required';
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
    setMessage('');
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      const user = userCredential.user;
      console.log('✅ Usuario creado:', user.uid);
      setMessage(`✅ ¡Pawword created for ${user.email}! Now Log in.`);

      // Limpiar formulario
      setEmail('');
      setPassword('');
      setIsLogin(true);
      setErrors({ email: '', password: '' });
    } catch (error) {
      console.error('Error registro:', error.code, error.message);
      let errorMessage = 'Error creating account';

      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'This email is already registered. Try logging in or use "Forgot my password".';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password too weak. Must be at least 6 characters.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many attempts. Try again later.';
          break;
        default:
          errorMessage = error.message || 'Error desconocido';
      }

      setMessage(`❌ ${errorMessage}`);
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

      const csvUser = users.find(u =>
        u.Correo?.toLowerCase() === user.email.toLowerCase() ||
        u['E-mail']?.toLowerCase() === user.email.toLowerCase()
      );

      const userData = {
        uid: user.uid,
        email: user.email,
        name: csvUser?.Nombre || user.email,
        role: csvUser?.['Rol en la Revista'] || 'Usuario'
      };

      setMessage(`✅ ¡Welcome, ${userData.name}!`);
      if (onLogin) onLogin(userData);
    } catch (error) {
      console.error('Error login:', error.code, error.message);
      let errorMessage = 'Error logging in';

      switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
          errorMessage = 'Incorrect email or password';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many attempts. Try again later.';
          break;
        default:
          errorMessage = error.message || 'Unknown error';
      }

      setMessage(`❌ ${errorMessage}`);
    }

    setIsLoading(false);
  };

  const handleForgotPassword = async () => {
  if (!email) {
    setMessage('Enter your email first');
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const userFromCSV = users.find(user =>
    user.Correo?.trim().toLowerCase() === normalizedEmail ||
    user['E-mail']?.trim().toLowerCase() === normalizedEmail
  );

  if (!userFromCSV) {
    setMessage('❌ This email is not authorized in the list');
    return;
  }

  setIsLoading(true);
  setMessage('');

  try {
    await sendPasswordResetEmail(auth, normalizedEmail);
    console.log('✅ Reset email sent to:', normalizedEmail);
    setMessage('✅ Check your email (including spam/junk) to reset your password. It may take a few minutes.');
  } catch (error) {
    console.error('Error in forgot password:', error.code, error.message);
    let errorMessage = '❌ Error sending recovery email';

    switch (error.code) {
      case 'auth/invalid-email':
        errorMessage = 'Invalid email format';
        break;
      case 'auth/user-not-found':
        errorMessage = 'No account registered for this email. Use "Create Password" first.';
        break;
      case 'auth/too-many-requests':
        errorMessage = 'Too many attempts. Please wait 10–15 minutes.';
        break;
      case 'auth/missing-email':
        errorMessage = 'Email is missing';
        break;
      default:
        errorMessage += ` (${error.message})`;
    }

    setMessage(errorMessage);
  } finally {
    setIsLoading(false);
  }
};

const handleLogout = async () => {
  try {
    await signOut(auth);
    setMessage('Logged out successfully');
    setCurrentUser(null);
    setEmail('');
    setPassword('');
    setIsLogin(true);
    if (onLogin) onLogin(null);
  } catch (error) {
    console.error('Error logging out:', error);
    setMessage('Error logging out');
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

// Logged-in screen
if (currentUser) {
  return (
    <div className="flex items-center justify-center py-8 px-2 sm:px-0">
      <div className="w-full max-w-sm p-6 sm:p-8 space-y-6 bg-white rounded-lg shadow-lg text-center">
        <h3 className="text-xl sm:text-2xl font-semibold text-green-600">Active Session!</h3>
        <p className="text-gray-600 mb-4">Email: {currentUser.email}</p>
        <button
          onClick={handleLogout}
          className="w-full px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm sm:text-base"
        >
          Log Out
        </button>
        {message && (
          <p className={`text-center text-xs sm:text-sm text-green-600`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

// Initial loading screen
if (isLoading && users.length === 0) {
  return (
    <div className="flex items-center justify-center py-8 px-2 sm:px-0">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading user list...</p>
      </div>
    </div>
  );
}

// Main form
return (
  <div className="flex items-center justify-center py-8 px-2 sm:px-0">
    <div className="w-full max-w-sm p-6 sm:p-8 space-y-6 bg-white rounded-lg shadow-lg">
      <h3 className="text-xl sm:text-2xl font-semibold text-center text-gray-800">
        {isLogin ? 'Log In' : 'Create Password'}
      </h3>

      <button
        onClick={() => setIsLogin(!isLogin)}
        className="text-sm text-blue-500 hover:underline text-center w-full"
        disabled={isLoading}
      >
        {isLogin ? 'New? Create your password' : 'Already have an account? Log in'}
      </button>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyPress={handleKeyPress}
            className={`w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base ${
              errors.email ? 'border-red-500' : 'border-gray-300'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            placeholder="email@example.com"
            disabled={isLoading}
          />
          {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
        </div>

        <div className="relative">
          <label className="block text-sm font-medium text-gray-700">
            {isLogin ? 'Password' : 'New Password'}
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={handleKeyPress}
            className={`w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base ${
              errors.password ? 'border-red-500' : 'border-gray-300'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            placeholder="••••••"
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
              Processing...
            </span>
          ) : (
            isLogin ? 'Log In' : 'Create Password'
          )}
        </button>

        {isLogin && (
          <button
            onClick={handleForgotPassword}
            className="w-full text-sm text-blue-500 hover:underline text-center"
            disabled={isLoading || !email}
          >
            Forgot your password?
          </button>
        )}

        {message && (
          <p className={`text-center text-xs sm:text-sm ${
            message.includes('✅') || message.includes('Welcome')
              ? 'text-green-600 font-medium'
              : 'text-red-500'
          }`}>
            {message}
          </p>
        )}

        {process.env.NODE_ENV === 'development' && (
          <p className="text-xs text-gray-500 text-center">
            {users.length} authorized users
          </p>
        )}
      </div>
    </div>
  </div>
);
}
