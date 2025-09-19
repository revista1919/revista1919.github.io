import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut 
} from '../firebase';
import { auth, fetchSignInMethodsForEmail } from 'firebase/auth'; // ← FIX: fetch... de firebase/auth directo
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'; // ← NUEVO: Para Google

// ← Opcional: Si usas @react-oauth/google para botón fancy
// import { GoogleLogin } from '@react-oauth/google';

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

  // ← NUEVO: Provider para Google
  const googleProvider = new GoogleAuthProvider();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        const csvUser = users.find(u => 
          u.Correo?.toLowerCase() === user.email.toLowerCase() ||
          u['E-mail']?.toLowerCase() === user.email.toLowerCase()
        );
        // ← NUEVO: Validar contra CSV también para Google
        if (!csvUser) {
          setMessage('❌ Este correo de Google no está autorizado. Contacta al admin.');
          signOut(auth); // Cierra sesión si no autorizado
          return;
        }
        const userData = {
          uid: user.uid,
          email: user.email,
          name: csvUser?.Nombre || user.email,
          role: csvUser?.['Rol en la Revista'] || 'Usuario'
        };
        setMessage(`✅ ¡Bienvenido, ${userData.name}!`);
        if (onLogin) onLogin(userData);
      } else {
        setMessage('');
        setCurrentUser(null);
      }
    });
    return unsubscribe;
  }, [auth, onLogin, users]);

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
            console.log(`✅ ${validUsers.length} usuarios autorizados cargados`);
            setIsLoading(false);
          },
          error: (err) => {
            console.error('Error CSV:', err);
            setMessage('Error al cargar lista de usuarios');
            setIsLoading(false);
          },
        });
      } catch (err) {
        console.error('Error fetch:', err);
        setMessage('Error de conexión');
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
      newErrors.email = 'Correo requerido';
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      newErrors.email = 'Formato de correo inválido';
      isValid = false;
    } else {
      if (!isLogin) {
        const userFromCSV = users.find(user => 
          user.Correo?.trim().toLowerCase() === normalizedEmail ||
          user['E-mail']?.trim().toLowerCase() === normalizedEmail
        );
        if (!userFromCSV) {
          newErrors.email = 'Este correo no está autorizado para crear contraseña';
          isValid = false;
        }
      }
    }

    if (!password) {
      newErrors.password = 'Contraseña requerida';
      isValid = false;
    } else if (password.length < 6) {
      newErrors.password = 'Mínimo 6 caracteres';
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
    const userFromCSV = users.find(user => 
      user.Correo?.trim().toLowerCase() === normalizedEmail ||
      user['E-mail']?.trim().toLowerCase() === normalizedEmail
    );

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      const user = userCredential.user;

      console.log('✅ Usuario creado:', user.uid);
      setMessage(`✅ ¡Contraseña creada para ${userFromCSV?.Nombre || normalizedEmail}! Ahora inicia sesión.`);
      
      setEmail('');
      setPassword('');
      setIsLogin(true);
      setErrors({ email: '', password: '' });
      
    } catch (error) {
      console.error('Error registro:', error);
      let errorMessage = 'Error al crear contraseña';
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'Ya existe una contraseña para este correo. Inicia sesión.';
          break;
        case 'auth/weak-password':
          errorMessage = 'La contraseña es demasiado débil';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Formato de correo inválido';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Demasiados intentos. Intenta más tarde.';
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

      setMessage(`✅ ¡Bienvenido, ${userData.name}!`);
      if (onLogin) onLogin(userData);
      
    } catch (error) {
      console.error('Error login:', error);
      let errorMessage = 'Error al iniciar sesión';
      
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'No hay contraseña creada para este correo. Créala primero.';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Contraseña incorrecta';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Correo inválido';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Demasiados intentos. Intenta más tarde.';
          break;
        default:
          errorMessage = error.message || 'Correo o contraseña incorrectos';
      }
      
      setMessage(`❌ ${errorMessage}`);
    }
    
    setIsLoading(false);
  };

  // ← NUEVO: Handle Google Sign In
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setMessage('');

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      console.log('✅ Google login exitoso:', user.email);

      // ← La validación CSV ya se hace en onAuthStateChanged (arriba)
      // Si pasa, onLogin se llama automáticamente; si no, se cierra y avisa

      setMessage('✅ ¡Login con Google exitoso! Validando acceso...');
      
    } catch (error) {
      console.error('Error Google login:', error);
      let errorMessage = 'Error al iniciar con Google';
      
      switch (error.code) {
        case 'auth/popup-closed-by-user':
          errorMessage = 'Popup cerrado. Intenta de nuevo.';
          break;
        case 'auth/account-exists-with-different-credential':
          errorMessage = 'Cuenta existe con otro método. Usa email/password.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Demasiados intentos. Espera un poco.';
          break;
        default:
          errorMessage = error.message || 'Error desconocido';
      }
      
      setMessage(`❌ ${errorMessage}`);
    }
    
    setIsLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setMessage('Ingresa tu correo primero');
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const userFromCSV = users.find(user => 
      user.Correo?.trim().toLowerCase() === normalizedEmail ||
      user['E-mail']?.trim().toLowerCase() === normalizedEmail
    );

    if (!userFromCSV) {
      setMessage('❌ Este correo no está autorizado en la lista');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const methods = await fetchSignInMethodsForEmail(auth, normalizedEmail); // ← Ahora funciona
      if (methods.length === 0) {
        setMessage('❌ No hay contraseña creada para este correo. Usa "Crear Contraseña" primero.');
        return;
      }
      if (!methods.includes('password')) {
        setMessage('❌ Esta cuenta usa otro método (ej. Google). Contacta al admin.');
        return;
      }

      await sendPasswordResetEmail(auth, normalizedEmail);
      console.log('✅ Email de reset enviado para:', normalizedEmail);
      setMessage('✅ Revisa tu correo (incluyendo spam/junk) para restablecer la contraseña. Puede tardar unos minutos.');
    } catch (error) {
      console.error('Error en forgot password:', error.code, error.message);
      let errorMessage = '❌ Error al enviar correo de recuperación';
      
      switch (error.code) {
        case 'auth/invalid-email':
          errorMessage = 'Formato de correo inválido';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Demasiados intentos. Espera 10-15 minutos.';
          break;
        case 'auth/missing-email':
          errorMessage = 'Falta el correo';
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
      setMessage('Sesión cerrada correctamente');
      setCurrentUser(null);
      setEmail('');
      setPassword('');
      setIsLogin(true);
      if (onLogin) onLogin(null); // ← FIX: Era onLogout, pero prop es onLogin
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      setMessage('Error al cerrar sesión');
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
          <h3 className="text-xl sm:text-2xl font-semibold text-green-600">¡Sesión Activa!</h3>
          <p className="text-gray-600 mb-4">Correo: {currentUser.email}</p>
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm sm:text-base"
          >
            Cerrar Sesión
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

  if (isLoading && users.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 px-2 sm:px-0">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando lista de usuarios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-8 px-2 sm:px-0">
      <div className="w-full max-w-sm p-6 sm:p-8 space-y-6 bg-white rounded-lg shadow-lg">
        <h3 className="text-xl sm:text-2xl font-semibold text-center text-gray-800">
          {isLogin ? 'Iniciar Sesión' : 'Crear Contraseña'}
        </h3>
        <button
          onClick={() => setIsLogin(!isLogin)}
          className="text-sm text-blue-500 hover:underline text-center w-full"
          disabled={isLoading}
        >
          {isLogin ? '¿Nuevo? Crea tu contraseña' : 'Ya tienes cuenta? Inicia sesión'}
        </button>
        <div className="space-y-4">
          {isLogin && (
            // ← NUEVO: Botón Google (simple; para fancy, usa GoogleLogin de @react-oauth/google)
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading || users.length === 0}
              className={`w-full px-4 py-2 text-white bg-red-500 rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm sm:text-base flex items-center justify-center space-x-2 ${
                isLoading || users.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.44 1 12.24s.43 3.69 1.18 5.17l2.66-2.32z" /><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 3.2c.86-2.6 3.3-4.53 6.16-4.53z" /></svg>
              <span>Iniciar con Google</span>
            </button>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">Correo</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={handleKeyPress}
              className={`w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base ${
                errors.email ? 'border-red-500' : 'border-gray-300'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              placeholder="correo@ejemplo.com"
              disabled={isLoading}
            />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
          </div>
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700">
              {isLogin ? 'Contraseña' : 'Nueva Contraseña'}
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
                Procesando...
              </span>
            ) : (
              isLogin ? 'Iniciar Sesión' : 'Crear Contraseña'
            )}
          </button>
          {isLogin && (
            <button
              onClick={handleForgotPassword}
              className="w-full text-sm text-blue-500 hover:underline text-center"
              disabled={isLoading || !email}
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}
          {message && (
            <p className={`text-center text-xs sm:text-sm ${
              message.includes('✅') || message.includes('Bienvenido') 
                ? 'text-green-600 font-medium' 
                : 'text-red-500'
            }`}>
              {message}
            </p>
          )}
          {process.env.NODE_ENV === 'development' && (
            <p className="text-xs text-gray-500 text-center">
              {users.length} usuarios autorizados
            </p>
          )}
        </div>
      </div>
    </div>
  );
}