import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
  onAuthStateChanged,
  signOut,
  signInWithPopup,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  linkWithCredential,
  auth,
  googleProvider
} from '../firebase';

const USERS_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv';

export default function LoginSection({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [users, setUsers] = useState([]);
  const [emailKeys, setEmailKeys] = useState([]);
  const [nameKeys, setNameKeys] = useState([]);
  const [roleKeys, setRoleKeys] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errors, setErrors] = useState({ email: '', password: '' });
  const [currentUser, setCurrentUser] = useState(null);
  const [hasPassword, setHasPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState({ old: '', new: '' });

  // Load authorized users from CSV with dynamic key detection
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
            if (data.length === 0) {
              console.error('CSV vacío');
              setMessage('❌ Lista de usuarios vacía. Contacta al admin.');
              setIsLoading(false);
              return;
            }
            const headers = Object.keys(data[0]);
            const detectedEmailKeys = headers.filter(h => h.toLowerCase().includes('correo') || h.toLowerCase().includes('email') || h.toLowerCase().includes('mail'));
            const detectedNameKeys = headers.filter(h => h.toLowerCase().includes('nombre') || h.toLowerCase().includes('name'));
            const detectedRoleKeys = headers.filter(h => h.toLowerCase().includes('rol') || h.toLowerCase().includes('role') || h.toLowerCase().includes('cargo'));
            
            if (detectedEmailKeys.length === 0) {
              console.error('No se detectó columna de email');
              setMessage('❌ No se detectó columna de correos en el CSV. Contacta al admin.');
              setIsLoading(false);
              return;
            }

            console.log('Columnas detectadas:', { email: detectedEmailKeys, name: detectedNameKeys, role: detectedRoleKeys });
            
            const validUsers = data.filter(user => 
              detectedEmailKeys.some(key => 
                user[key] && 
                typeof user[key] === 'string' &&
                user[key].includes('@') && 
                user[key].includes('.')
              )
            );
            
            setUsers(validUsers);
            setEmailKeys(detectedEmailKeys);
            setNameKeys(detectedNameKeys);
            setRoleKeys(detectedRoleKeys);
            console.log(`✅ ${validUsers.length} usuarios autorizados cargados`);
            setIsLoading(false);
          },
          error: (err) => {
            console.error('Error CSV:', err);
            setMessage('❌ Error al cargar lista de usuarios. Revisa la conexión o el enlace del CSV.');
            setIsLoading(false);
          },
        });
      } catch (err) {
        console.error('Error fetch:', err);
        setMessage('❌ Error de conexión al cargar usuarios. Verifica el URL del CSV.');
        setIsLoading(false);
      }
    };
    fetchUsers();
  }, []);

  // Monitor authentication state with strict validation
  useEffect(() => {
    if (!auth) {
      console.error('Error: auth no está definido. Revisa firebase.js');
      setMessage('❌ Error de configuración. Contacta al admin.');
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Wait for CSV to be loaded
        if (users.length === 0 || emailKeys.length === 0) {
          console.warn('CSV no cargado aún, esperando para validar usuario');
          return;
        }

        const normalizedEmail = user.email.toLowerCase();
        const csvUser = users.find(u => 
          emailKeys.some(key => u[key]?.toLowerCase() === normalizedEmail)
        );
        if (!csvUser) {
          console.warn(`Usuario no autorizado: ${user.email}`);
          setMessage('❌ Este correo no está autorizado. Cerrando sesión...');
          try {
            await signOut(auth);
            console.log('Sesión cerrada para usuario no autorizado');
          } catch (err) {
            console.error('Error al cerrar sesión:', err);
          }
          setCurrentUser(null);
          if (onLogin) onLogin(null);
          return;
        }
        const userData = {
          uid: user.uid,
          email: user.email,
          name: nameKeys.length > 0 ? csvUser[nameKeys[0]] || user.email : user.email,
          role: roleKeys.length > 0 ? csvUser[roleKeys[0]] || 'Usuario' : 'Usuario'
        };
        setCurrentUser(user);
        setMessage(`✅ ¡Bienvenido, ${userData.name}!`);
        if (onLogin) onLogin(userData);

        // Check authentication methods for password provider
        try {
          const methods = await fetchSignInMethodsForEmail(auth, user.email);
          setHasPassword(methods.includes('password'));
        } catch (err) {
          console.error('Error fetching sign-in methods:', err);
        }
      } else {
        setCurrentUser(null);
        setMessage('');
        setHasPassword(false);
        if (onLogin) onLogin(null);
      }
    });
    return () => unsubscribe();
  }, [onLogin, users, emailKeys, nameKeys, roleKeys]);

  // Validate email and password inputs
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
      const userFromCSV = users.find(user => 
        emailKeys.some(key => user[key]?.trim().toLowerCase() === normalizedEmail)
      );
      if (!userFromCSV) {
        newErrors.email = 'Este correo no está autorizado';
        isValid = false;
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

  // Handle Google Sign-In with strict validation
  const handleGoogleSignIn = async () => {
    if (!validateInputs()) {
      setMessage('❌ Ingresa un correo autorizado antes de usar Google.');
      return;
    }

    setIsGoogleLoading(true);
    setMessage('');

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      if (user.email.toLowerCase() !== normalizedEmail) {
        await signOut(auth);
        setMessage('❌ El correo seleccionado en Google no coincide con el ingresado.');
        setIsGoogleLoading(false);
        return;
      }

      console.log('✅ Google login exitoso:', user.email);
      // Validation handled in onAuthStateChanged
    } catch (error) {
      console.error('Error Google login:', error);
      let errorMessage = '❌ Error al iniciar con Google';
      switch (error.code) {
        case 'auth/popup-closed-by-user':
          errorMessage = 'Popup cerrado. Intenta de nuevo.';
          break;
        case 'auth/account-exists-with-different-credential':
          errorMessage = 'Cuenta existe con otro método. Usa email/contraseña.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Demasiados intentos. Espera un poco.';
          break;
        default:
          errorMessage = error.message || 'Error desconocido';
      }
      setMessage(errorMessage);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Handle password creation
  const handleSignUp = async () => {
    if (!validateInputs()) return;

    setIsLoading(true);
    setMessage('');

    const normalizedEmail = email.trim().toLowerCase();

    try {
      const methods = await fetchSignInMethodsForEmail(auth, normalizedEmail);
      if (methods.length > 0) {
        setMessage(
          methods.includes('google.com')
            ? '❌ Este correo está registrado con Google. Usa Iniciar con Google o agrega una contraseña desde el panel.'
            : '❌ Este correo ya está registrado. Usa Iniciar Sesión.'
        );
        setIsLoading(false);
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      console.log('✅ Usuario creado:', userCredential.user.uid);
      setMessage('✅ ¡Contraseña creada! Ahora inicia sesión.');
      setEmail('');
      setPassword('');
      setIsLogin(true);
    } catch (error) {
      console.error('Error registro:', error);
      let errorMessage = '❌ Error al crear contraseña';
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'Correo ya registrado. Inicia sesión o usa Google.';
          break;
        case 'auth/weak-password':
          errorMessage = 'Contraseña demasiado débil. Usa al menos 6 caracteres.';
          break;
        default:
          errorMessage = error.message || 'Error desconocido';
      }
      setMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle login
  const handleLogin = async () => {
    if (!validateInputs()) return;

    setIsLoading(true);
    setMessage('');

    const normalizedEmail = email.trim().toLowerCase();

    try {
      const methods = await fetchSignInMethodsForEmail(auth, normalizedEmail);
      if (methods.length === 0) {
        setMessage('❌ No hay cuenta registrada con este correo. Crea una contraseña primero.');
        return;
      }
      if (!methods.includes('password')) {
        setMessage('❌ Este correo está registrado con Google. Usa Iniciar con Google.');
        return;
      }

      await signInWithEmailAndPassword(auth, normalizedEmail, password);
      console.log('✅ Login exitoso');
    } catch (error) {
      console.error('Error login:', error);
      let errorMessage = '❌ Error al iniciar sesión';
      switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
          errorMessage = 'Correo o contraseña incorrectos. Verifica o usa "Olvidé mi contraseña".';
          break;
        case 'auth/user-not-found':
          errorMessage = 'No hay cuenta para este correo. Créala primero.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Demasiados intentos. Espera 10-15 minutos.';
          break;
        default:
          errorMessage = error.message || 'Error desconocido';
      }
      setMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle password reset
  const handleForgotPassword = async () => {
    if (!email) {
      setMessage('❌ Ingresa tu correo primero');
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const userFromCSV = users.find(user => 
      emailKeys.some(key => user[key]?.trim().toLowerCase() === normalizedEmail)
    );

    if (!userFromCSV) {
      setMessage('❌ Este correo no está autorizado');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const methods = await fetchSignInMethodsForEmail(auth, normalizedEmail);
      if (methods.length === 0) {
        setMessage('❌ No hay cuenta registrada con este correo. Crea una contraseña primero.');
        return;
      }
      if (!methods.includes('password')) {
        setMessage('❌ Este correo usa Google. Inicia con Google para agregar una contraseña.');
        return;
      }

      await sendPasswordResetEmail(auth, normalizedEmail);
      setMessage('✅ Revisa tu correo (incluyendo spam) para restablecer la contraseña.');
    } catch (error) {
      console.error('Error forgot password:', error);
      let errorMessage = '❌ Error al enviar correo de recuperación';
      switch (error.code) {
        case 'auth/too-many-requests':
          errorMessage = 'Demasiados intentos. Espera 10-15 minutos.';
          break;
        default:
          errorMessage = error.message || 'Error desconocido';
      }
      setMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle password change/add for logged-in users
  const validatePasswordChange = () => {
    let isValid = true;
    const newErrors = { old: '', new: '' };

    if (hasPassword && !oldPassword) {
      newErrors.old = 'Contraseña actual requerida';
      isValid = false;
    }

    if (!newPassword) {
      newErrors.new = 'Nueva contraseña requerida';
      isValid = false;
    } else if (newPassword.length < 6) {
      newErrors.new = 'Mínimo 6 caracteres';
      isValid = false;
    }

    setPasswordErrors(newErrors);
    return isValid;
  };

  const handlePasswordChange = async () => {
    if (!validatePasswordChange()) return;

    setIsLoading(true);
    setMessage('');

    try {
      if (hasPassword) {
        const credential = EmailAuthProvider.credential(currentUser.email, oldPassword);
        await reauthenticateWithCredential(currentUser, credential);
        await updatePassword(currentUser, newPassword);
        setMessage('✅ Contraseña cambiada exitosamente');
      } else {
        const credential = EmailAuthProvider.credential(currentUser.email, newPassword);
        await linkWithCredential(currentUser, credential);
        setHasPassword(true);
        setMessage('✅ Contraseña agregada exitosamente. Ahora puedes usar email/contraseña.');
      }
      setIsChangingPassword(false);
      setOldPassword('');
      setNewPassword('');
    } catch (error) {
      console.error('Error al cambiar/agregar contraseña:', error);
      let errorMessage = '❌ Error al procesar la contraseña';
      switch (error.code) {
        case 'auth/wrong-password':
          errorMessage = 'Contraseña actual incorrecta';
          break;
        case 'auth/weak-password':
          errorMessage = 'Nueva contraseña demasiado débil';
          break;
        case 'auth/requires-recent-login':
          errorMessage = 'Sesión expirada. Cierra sesión e inicia de nuevo.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Demasiados intentos. Espera 10-15 minutos.';
          break;
        default:
          errorMessage = error.message || 'Error desconocido';
      }
      setMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setMessage('✅ Sesión cerrada correctamente');
      setCurrentUser(null);
      setEmail('');
      setPassword('');
      setIsLogin(true);
      setIsChangingPassword(false);
      setOldPassword('');
      setNewPassword('');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      setMessage('❌ Error al cerrar sesión');
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

  // Render loading state
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

  // Render error if no users loaded
  if (users.length === 0 && !isLoading) {
    return (
      <div className="flex items-center justify-center py-8 px-2 sm:px-0">
        <div className="w-full max-w-sm p-6 sm:p-8 space-y-6 bg-white rounded-lg shadow-lg text-center">
          <h3 className="text-xl sm:text-2xl font-semibold text-red-600">Error</h3>
          <p className="text-gray-600">{message || 'No se pudieron cargar los usuarios autorizados. Contacta al administrador.'}</p>
        </div>
      </div>
    );
  }

  // Render active session with password management
  if (currentUser) {
    return (
      <div className="flex items-center justify-center py-8 px-2 sm:px-0">
        <div className="w-full max-w-sm p-6 sm:p-8 space-y-6 bg-white rounded-lg shadow-lg">
          <h3 className="text-xl sm:text-2xl font-semibold text-center text-green-600">¡Sesión Activa!</h3>
          <p className="text-center text-gray-600 mb-4">Correo: {currentUser.email}</p>
          {!isChangingPassword ? (
            <>
              <button
                onClick={() => setIsChangingPassword(true)}
                className="w-full px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm sm:text-base"
              >
                {hasPassword ? 'Cambiar Contraseña' : 'Agregar Contraseña'}
              </button>
              <button
                onClick={handleLogout}
                className="w-full px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm sm:text-base"
              >
                Cerrar Sesión
              </button>
            </>
          ) : (
            <div className="space-y-4">
              {hasPassword && (
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700">Contraseña Actual</label>
                  <input
                    type={showOldPassword ? 'text' : 'password'}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className={`w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base ${
                      passwordErrors.old ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 top-6"
                  >
                    {showOldPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                  </button>
                  {passwordErrors.old && <p className="mt-1 text-xs text-red-500">{passwordErrors.old}</p>}
                </div>
              )}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700">Nueva Contraseña</label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={`w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base ${
                    passwordErrors.new ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 top-6"
                >
                  {showNewPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
                {passwordErrors.new && <p className="mt-1 text-xs text-red-500">{passwordErrors.new}</p>}
              </div>
              <button
                onClick={handlePasswordChange}
                disabled={isLoading}
                className={`w-full px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isLoading ? 'Procesando...' : 'Confirmar'}
              </button>
              <button
                onClick={() => {
                  setIsChangingPassword(false);
                  setOldPassword('');
                  setNewPassword('');
                  setPasswordErrors({ old: '', new: '' });
                }}
                className="w-full text-sm text-gray-500 hover:underline text-center"
              >
                Cancelar
              </button>
            </div>
          )}
          {message && (
            <p className={`text-center text-xs sm:text-sm ${message.includes('✅') ? 'text-green-600' : 'text-red-500'}`}>
              {message}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Render login/signup form
  return (
    <div className="flex items-center justify-center py-8 px-2 sm:px-0">
      <div className="w-full max-w-sm p-6 sm:p-8 space-y-6 bg-white rounded-lg shadow-lg">
        <h3 className="text-xl sm:text-2xl font-semibold text-center text-gray-800">
          {isLogin ? 'Iniciar Sesión' : 'Crear Contraseña'}
        </h3>
        <button
          onClick={() => setIsLogin(!isLogin)}
          className="text-sm text-blue-500 hover:underline text-center w-full"
          disabled={isLoading || isGoogleLoading}
        >
          {isLogin ? '¿Nuevo? Crea tu contraseña' : 'Ya tienes cuenta? Inicia sesión'}
        </button>
        <div className="space-y-4">
          {isLogin && (
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading || isGoogleLoading || users.length === 0 || !email || errors.email}
              className={`w-full px-4 py-2 text-white bg-red-500 rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm sm:text-base flex items-center justify-center space-x-2 ${
                isLoading || isGoogleLoading || users.length === 0 || !email || errors.email ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.44 1 12.24s.43 3.69 1.18 5.17l2.66-2.32z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 3.2c.86-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span>
                {isGoogleLoading ? (
                  <span className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Procesando...
                  </span>
                ) : (
                  'Iniciar con Google'
                )}
              </span>
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
              } ${isLoading || isGoogleLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              placeholder="correo@ejemplo.com"
              disabled={isLoading || isGoogleLoading}
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
              } ${isLoading || isGoogleLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              placeholder="••••••"
              disabled={isLoading || isGoogleLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 top-6"
              disabled={isLoading || isGoogleLoading}
            >
              {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
            </button>
            {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
          </div>
          <button
            onClick={handleSubmit}
            disabled={isLoading || isGoogleLoading || users.length === 0}
            className={`w-full px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base ${
              isLoading || isGoogleLoading || users.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
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
              disabled={isLoading || isGoogleLoading || !email || errors.email}
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}
          {message && (
            <p className={`text-center text-xs sm:text-sm ${
              message.includes('✅') ? 'text-green-600 font-medium' : 'text-red-500'
            }`}>
              {message}
            </p>
          )}
          {process.env.NODE_ENV === 'development' && (
            <p className="text-xs text-gray-500 text-center">
              {users.length} usuarios autorizados | Columnas email: {emailKeys.join(', ')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}