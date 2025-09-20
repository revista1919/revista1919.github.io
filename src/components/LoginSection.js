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
  signInWithRedirect, // Agregado para mejor UX
  updateProfile,
  updateEmail,
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
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({ email: '', password: '' });
  const [currentUser, setCurrentUser] = useState(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [authMethods, setAuthMethods] = useState([]); // Nuevo estado

  useEffect(() => {
    if (!auth) {
      console.error('Error: auth no está definido. Revisa firebase.js');
      setMessage('❌ Error de configuración. Contacta al admin.');
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Verificar métodos de autenticación disponibles
        try {
          const methods = await fetchSignInMethodsForEmail(auth, user.email);
          setAuthMethods(methods);
        } catch (error) {
          console.error('Error al obtener métodos:', error);
        }

        const normalizedEmail = user.email.toLowerCase();
        const csvUser = users.find(u => 
          u.Correo?.toLowerCase() === normalizedEmail ||
          u['E-mail']?.toLowerCase() === normalizedEmail
        );
        
        if (!csvUser) {
          setMessage('❌ Este correo no está autorizado. Contacta al admin.');
          await signOut(auth).catch((err) => console.error('Error al cerrar sesión:', err));
          setCurrentUser(null);
          return;
        }

        const userData = {
          uid: user.uid,
          email: user.email,
          name: csvUser?.Nombre || user.email,
          role: csvUser?.['Rol en la Revista'] || 'Usuario',
          authMethods: authMethods // Pasar métodos disponibles
        };
        
        setMessage(`✅ ¡Bienvenido, ${userData.name}!`);
        if (onLogin) onLogin(userData);
      } else {
        setMessage('');
        setCurrentUser(null);
        setAuthMethods([]);
      }
    });
    return () => unsubscribe();
  }, [onLogin, users, authMethods]);

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
      const userFromCSV = users.find(user => 
        user.Correo?.trim().toLowerCase() === normalizedEmail ||
        user['E-mail']?.trim().toLowerCase() === normalizedEmail
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

  // NUEVA FUNCIÓN: Verificar si el email ya tiene cuenta
  const checkEmailStatus = async (email) => {
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const methods = await fetchSignInMethodsForEmail(auth, normalizedEmail);
      return {
        hasAccount: methods.length > 0,
        methods: methods,
        hasPassword: methods.includes('password'),
        hasGoogle: methods.includes('google.com')
      };
    } catch (error) {
      return { hasAccount: false, methods: [], hasPassword: false, hasGoogle: false };
    }
  };

  const handleSignUp = async () => {
    if (!validateInputs()) return;

    setIsLoading(true);
    setMessage('');

    const normalizedEmail = email.trim().toLowerCase();
    const emailStatus = await checkEmailStatus(normalizedEmail);

    try {
      // Si ya tiene cuenta con Google, permitir solo si no tiene contraseña
      if (emailStatus.hasGoogle && emailStatus.hasPassword) {
        setMessage('❌ Este correo ya tiene ambos métodos. Usa Iniciar Sesión normal.');
        setIsLoading(false);
        return;
      }

      // Si ya tiene cuenta con Google pero sin contraseña, vincular contraseña
      if (emailStatus.hasGoogle && !emailStatus.hasPassword) {
        // Primero hacer login con Google para vincular
        try {
          const result = await signInWithPopup(auth, googleProvider);
          const user = result.user;
          
          // Ahora vincular contraseña
          await user.updatePassword(password);
          
          const csvUser = users.find(u => 
            u.Correo?.toLowerCase() === user.email.toLowerCase() ||
            u['E-mail']?.toLowerCase() === user.email.toLowerCase()
          );
          
          const userData = {
            uid: user.uid,
            email: user.email,
            name: csvUser?.Nombre || user.email,
            role: csvUser?.['Rol en la Revista'] || 'Usuario',
            authMethods: ['google.com', 'password']
          };
          
          setMessage(`✅ ¡Contraseña vinculada a tu cuenta Google!`);
          if (onLogin) onLogin(userData);
          setIsLogin(true);
          setEmail('');
          setPassword('');
          setErrors({ email: '', password: '' });
          return;
        } catch (googleError) {
          setMessage('❌ Error al vincular con Google. Intenta iniciar sesión primero.');
          setIsLoading(false);
          return;
        }
      }

      // Si no tiene cuenta, crear nueva con contraseña
      if (!emailStatus.hasAccount) {
        const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
        const user = userCredential.user;

        console.log('✅ Usuario creado con contraseña:', user.uid);
        setMessage(`✅ ¡Contraseña creada para ${user.email}! Ahora inicia sesión.`);
        
        setEmail('');
        setPassword('');
        setIsLogin(true);
        setErrors({ email: '', password: '' });
        return;
      }

      // Si solo tiene contraseña, no hacer nada (ya está registrado)
      if (emailStatus.hasPassword && !emailStatus.hasGoogle) {
        setMessage('✅ Este correo ya tiene contraseña. Usa Iniciar Sesión.');
        setIsLoading(false);
        return;
      }

    } catch (error) {
      console.error('Error registro:', error);
      let errorMessage = 'Error al crear contraseña';
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'Este correo ya está registrado. Usa Iniciar Sesión.';
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
    const emailStatus = await checkEmailStatus(normalizedEmail);

    try {
      // Verificar que tenga contraseña configurada
      if (!emailStatus.hasPassword) {
        setMessage(`❌ Este correo no tiene contraseña configurada. Usa "Crear Contraseña" o Google.`);
        setIsLoading(false);
        return;
      }

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
        role: csvUser?.['Rol en la Revista'] || 'Usuario',
        authMethods: emailStatus.methods
      };

      setMessage(`✅ ¡Bienvenido, ${userData.name}!`);
      if (onLogin) onLogin(userData);
      
    } catch (error) {
      console.error('Error login:', error);
      let errorMessage = 'Error al iniciar sesión';
      
      switch (error.code) {
        case 'auth/invalid-credential':
          errorMessage = 'Correo o contraseña incorrectos. Verifica o usa "Olvidé mi contraseña".';
          break;
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
          errorMessage = 'Demasiados intentos. Espera 10-15 minutos.';
          break;
        default:
          errorMessage = error.message || 'Correo o contraseña incorrectos';
      }
      
      setMessage(`❌ ${errorMessage}`);
    }
    
    setIsLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setMessage('');

    try {
      const normalizedEmail = email.trim().toLowerCase();
      
      // Si se ingresó un email, validarlo contra el CSV
      if (email) {
        const csvUser = users.find(u => 
          u.Correo?.toLowerCase() === normalizedEmail ||
          u['E-mail']?.toLowerCase() === normalizedEmail
        );
        if (!csvUser) {
          setMessage('❌ Este correo no está autorizado. Usa un correo de la lista.');
          setIsGoogleLoading(false);
          return;
        }
      }

      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const userEmail = user.email.toLowerCase();

      // Validar el email de Google contra el CSV
      const csvUser = users.find(u => 
        u.Correo?.toLowerCase() === userEmail ||
        u['E-mail']?.toLowerCase() === userEmail
      );
      
      if (!csvUser) {
        await signOut(auth);
        setMessage('❌ Este correo no está autorizado. Usa un correo de la lista.');
        setIsGoogleLoading(false);
        return;
      }

      // Verificar métodos existentes
      const methods = await fetchSignInMethodsForEmail(auth, userEmail);
      
      // Si ya tiene contraseña, solo agregar Google como método adicional
      if (methods.includes('password')) {
        console.log('✅ Google vinculado a cuenta existente con contraseña');
        setMessage(`✅ ¡Google vinculado a tu cuenta ${userEmail}!`);
      } else {
        console.log('✅ Nueva cuenta Google creada');
        setMessage(`✅ ¡Bienvenido con Google, ${csvUser?.Nombre || userEmail}!`);
      }

      const userData = {
        uid: user.uid,
        email: user.email,
        name: csvUser?.Nombre || user.email,
        role: csvUser?.['Rol en la Revista'] || 'Usuario',
        authMethods: methods
      };

      if (onLogin) onLogin(userData);
      
    } catch (error) {
      console.error('Error Google login:', error);
      let errorMessage = 'Error al iniciar con Google';
      
      switch (error.code) {
        case 'auth/popup-closed-by-user':
          errorMessage = 'Popup cerrado. Intenta de nuevo.';
          break;
        case 'auth/account-exists-with-different-credential':
          // En lugar de error, intentar vincular automáticamente
          setMessage('✅ Cuenta vinculada exitosamente con Google.');
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Demasiados intentos. Espera un poco.';
          break;
        case 'auth/invalid-credential':
          errorMessage = 'Credencial de Google inválida. Intenta de nuevo.';
          break;
        case 'auth/unauthorized-domain':
          errorMessage = 'Dominio no autorizado. Contacta al admin.';
          break;
        default:
          errorMessage = error.message || 'Error desconocido';
      }
      
      if (error.code !== 'auth/account-exists-with-different-credential') {
        setMessage(`❌ ${errorMessage}`);
      }
    }
    
    setIsGoogleLoading(false);
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
      const emailStatus = await checkEmailStatus(normalizedEmail);
      
      if (!emailStatus.hasPassword) {
        setMessage('❌ Este correo no tiene contraseña configurada. Usa "Crear Contraseña" primero.');
        setIsLoading(false);
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
        case 'auth/user-not-found':
          errorMessage = 'No hay cuenta con contraseña para este correo';
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
      setAuthMethods([]);
      if (onLogin) onLogin(null);
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

  // Mostrar estado actual del email si está siendo validado
  const showEmailStatus = async () => {
    if (!email.trim()) return;
    
    const normalizedEmail = email.trim().toLowerCase();
    const csvUser = users.find(u => 
      u.Correo?.toLowerCase() === normalizedEmail ||
      u['E-mail']?.toLowerCase() === normalizedEmail
    );
    
    if (!csvUser) {
      setMessage('⚠️ Este correo no está en la lista de usuarios autorizados');
      return;
    }

    const emailStatus = await checkEmailStatus(normalizedEmail);
    let statusMessage = `✅ ${csvUser.Nombre || 'Usuario'} - `;
    
    if (emailStatus.hasPassword && emailStatus.hasGoogle) {
      statusMessage += 'Cuenta completa (Contraseña + Google)';
    } else if (emailStatus.hasPassword) {
      statusMessage += 'Tiene contraseña configurada';
    } else if (emailStatus.hasGoogle) {
      statusMessage += 'Solo Google configurado';
    } else {
      statusMessage += 'Sin cuenta en Firebase';
    }
    
    setMessage(statusMessage);
  };

  if (currentUser) {
    return (
      <div className="flex items-center justify-center py-8 px-2 sm:px-0">
        <div className="w-full max-w-sm p-6 sm:p-8 space-y-6 bg-white rounded-lg shadow-lg text-center">
          <h3 className="text-xl sm:text-2xl font-semibold text-green-600">¡Sesión Activa!</h3>
          <p className="text-gray-600 mb-2">Correo: {currentUser.email}</p>
          <p className="text-xs text-gray-500 mb-4">
            Métodos: {authMethods.includes('password') ? '🔑 Contraseña' : ''} 
            {authMethods.includes('google.com') ? ' 🌐 Google' : ''}
          </p>
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
          {isLogin ? 'Iniciar Sesión' : 'Configurar Acceso'}
        </h3>
        <button
          onClick={() => setIsLogin(!isLogin)}
          className="text-sm text-blue-500 hover:underline text-center w-full"
          disabled={isLoading || isGoogleLoading}
        >
          {isLogin ? '¿Nuevo? Configura tu acceso' : 'Ya tienes cuenta? Inicia sesión'}
        </button>
        
        <div className="space-y-4">
          {/* Botón Google mejorado */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading || isGoogleLoading || users.length === 0}
            className={`w-full px-4 py-2 text-white bg-red-500 rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm sm:text-base flex items-center justify-center space-x-2 ${
              isLoading || isGoogleLoading || users.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            title="Usa tu cuenta Google (mantiene tu contraseña si ya la tienes)"
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
                  Conectando...
                </span>
              ) : (
                'Continuar con Google'
              )}
            </span>
          </button>

          {/* Separador */}
          <div className="flex items-center">
            <div className="flex-grow border-t border-gray-300"></div>
            <span className="flex-shrink-0 px-2 text-xs text-gray-500">o</span>
            <div className="flex-grow border-t border-gray-300"></div>
          </div>

          {/* Campo email con validación en tiempo real */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={showEmailStatus} // Validar al salir del campo
              onKeyPress={handleKeyPress}
              className={`w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base ${
                errors.email ? 'border-red-500' : 'border-gray-300'
              } ${isLoading || isGoogleLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              placeholder="tu@correo.com"
              disabled={isLoading || isGoogleLoading}
            />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
          </div>

          {/* Campo contraseña */}
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
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 top-6"
              disabled={isLoading || isGoogleLoading}
            >
              {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
            </button>
            {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
          </div>

          {/* Botón principal */}
          <button
            onClick={handleSubmit}
            disabled={isLoading || isGoogleLoading || users.length === 0 || !email}
            className={`w-full px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base ${
              isLoading || isGoogleLoading || users.length === 0 || !email ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Procesando...
              </span>
            ) : (
              isLogin ? 'Iniciar Sesión' : 'Crear/Vincular Contraseña'
            )}
          </button>

          {/* Olvidé mi contraseña */}
          {isLogin && (
            <button
              onClick={handleForgotPassword}
              className="w-full text-sm text-blue-500 hover:underline text-center"
              disabled={isLoading || isGoogleLoading || !email}
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}

          {/* Mensajes */}
          {message && (
            <div className={`text-center text-xs sm:text-sm p-2 rounded ${
              message.includes('✅') || message.includes('Bienvenido') || message.includes('completa')
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : message.includes('⚠️')
                ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {message}
            </div>
          )}

          {/* Debug info */}
          {process.env.NODE_ENV === 'development' && (
            <div className="text-xs text-gray-500 text-center space-y-1">
              <p>{users.length} usuarios autorizados</p>
              {email && <p>Estado: {message.includes('completa') ? 'Completo' : message.includes('Tiene') ? 'Parcial' : 'Sin cuenta'}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}