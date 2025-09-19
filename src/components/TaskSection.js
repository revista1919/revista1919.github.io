import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Papa from 'papaparse';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import ImageResize from 'quill-image-resize-module-react';
import { debounce } from 'lodash';

Quill.register('modules/imageResize', ImageResize);

// Función de compresión de imágenes
const compressImage = (file, maxWidth = 800, quality = 0.6) => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      let { width, height } = img;
      
      // Calcular nuevas dimensiones manteniendo ratio
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxWidth) {
          width = (width * maxWidth) / height;
          height = maxWidth;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Limpiar canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Dibujar imagen comprimida
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convertir a base64 con calidad reducida
      canvas.toBlob(
        (blob) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve(reader.result);
          };
          reader.readAsDataURL(blob);
        },
        'image/jpeg',
        quality
      );
    };
    
    img.src = file;
  });
};

// Hook personalizado para compresión de imágenes
const useImageCompression = () => {
  const compress = useCallback(async (base64Data) => {
    try {
      // Extraer el blob de la data URL
      const [, data] = base64Data.split(',');
      const byteString = atob(data);
      const byteArray = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i++) {
        byteArray[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: 'image/jpeg' });
      
      // Comprimir
      const compressed = await compressImage(blob, 600, 0.5);
      return compressed;
    } catch (error) {
      console.warn('Error comprimiendo imagen:', error);
      return base64Data; // Fallback al original
    }
  }, []);
  
  return { compress };
};

const USERS_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv';
const TASKS_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSCEOtMwYPu0_kn1hmQi0qT6FZq6HRF09WtuDSqOxBNgMor_FyRRtc6_YVKHQQhWJCy-mIa2zwP6uAU/pub?output=csv';
const TASK_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxMo7aV_vz_3mOCUWKpcqnWmassUdApD_KfAHROTdgd_MDDiaXikgVV0OZ5qVYmhZgd/exec';

const AREAS = {
  RRSS: 'Redes Sociales',
  WEB: 'Desarrollo Web',
};

const getAreaColumns = (area) => {
  if (area === AREAS.RRSS) {
    return { taskCol: 0, nameCol: 1, completedCol: 2, commentCol: 3 };
  } else {
    return { taskCol: 4, nameCol: 5, completedCol: 6, commentCol: 7 };
  }
};

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // Aumentado para dar más tiempo
const REQUEST_TIMEOUT = 30000; // Aumentado significativamente
const MAX_PAYLOAD_SIZE = 50000; // Límite estricto para Google Sheets

const base64EncodeUnicode = (str) => {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
};

const sanitizeInput = (input) => {
  if (!input) return '';
  return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
              .replace(/on\w+="[^"]*"/gi, '')
              .replace(/<[^>]*javascript:.*?>/gi, '')
              .replace(/\s+/g, ' ')
              .trim();
};

export default function TaskSection({ user }) {
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedArea, setSelectedArea] = useState(AREAS.RRSS);
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [taskContent, setTaskContent] = useState('');
  const [commentContent, setCommentContent] = useState({});
  const [submitStatus, setSubmitStatus] = useState({});
  const [error, setError] = useState('');
  const [isCompressing, setIsCompressing] = useState({});
  
  // Referencias para los editores de Quill
  const taskEditorRef = useRef(null);
  const commentEditorsRef = useRef({});
  
  const { compress } = useImageCompression();

  useEffect(() => {
    // Estilos CSS mejorados para Quill
    const style = document.createElement('style');
    style.innerHTML = `
      /* Fix para tooltips de Quill */
      .ql-tooltip {
        z-index: 10000 !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        background: white !important;
        border: 1px solid #ccc !important;
        box-shadow: 0 5px 15px rgba(0,0,0,0.1) !important;
        padding: 5px !important;
        border-radius: 4px !important;
        overflow: visible !important;
        max-width: 300px !important;
      }
      
      /* Fix para contenedores de Quill */
      .ql-container {
        overflow: visible !important;
        position: relative !important;
        font-family: inherit !important;
        z-index: 1 !important;
      }
      
      .ql-editor {
        min-height: 100% !important;
        padding: 12px !important;
        line-height: 1.5 !important;
        font-size: 14px !important;
        outline: none !important;
        white-space: pre-wrap !important;
        overflow-y: auto !important;
        position: relative !important;
        z-index: 1 !important;
      }
      
      /* Fix para modales */
      .ql-modal {
        z-index: 10001 !important;
      }
      
      /* Fix para toolbar en modales */
      .ql-toolbar {
        z-index: 10002 !important;
        position: sticky !important;
        top: 0 !important;
        background: white !important;
        border-bottom: 1px solid #ddd !important;
        z-index: 10003 !important;
      }
      
      /* Fix para input de links */
      .ql-link-tooltip .ql-preview {
        display: none !important;
      }
      
      /* Fix para problemas de focus */
      .ql-editor:focus {
        outline: none !important;
      }
      
      /* Fix para imágenes - MUY IMPORTANTE */
      .ql-editor img {
        max-width: 100% !important;
        height: auto !important;
        border-radius: 4px !important;
        display: block !important;
        margin: 8px auto !important;
        max-height: 400px !important;
        box-sizing: border-box !important;
      }
      
      /* Advertencia visual para imágenes grandes */
      .ql-editor img[data-large="true"] {
        border: 2px solid #ef4444 !important;
        position: relative;
      }
      
      .ql-editor img[data-large="true"]:after {
        content: "⚠️ Imagen grande - se comprimirá";
        position: absolute;
        top: -25px;
        left: 0;
        background: #ef4444;
        color: white;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 10px;
      }
      
      /* Fix para modales pequeños */
      .modal-content .ql-container {
        max-height: 300px !important;
      }
      
      /* Loading state para compresión */
      .image-compressing {
        position: relative;
        opacity: 0.7;
      }
      
      .image-compressing::after {
        content: "🗜️ Comprimidiendo...";
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.7);
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 10;
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  const fetchWithRetry = async (url, options, retries = MAX_RETRIES) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
      
      // Headers SIN duplicados - solo lo esencial
      const headers = new Headers();
      headers.append('Content-Type', 'application/json');
      
      const response = await fetch(url, {
        ...options,
        mode: 'no-cors', // MANTENIDO no-cors para el script
        headers,
        signal: controller.signal,
        keepalive: true,
        // Remover credentials para evitar conflictos
      });
      
      clearTimeout(timeoutId);
      return { success: true };
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('Request timed out - payload muy grande');
      }
      if (retries > 0) {
        console.warn(`Retry ${MAX_RETRIES - retries + 1}/${MAX_RETRIES}: ${err.message}`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
        return fetchWithRetry(url, options, retries - 1);
      }
      throw new Error(`Fetch failed after ${MAX_RETRIES} retries: ${err.message}`);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(USERS_CSV, { 
        cache: 'no-store',
        mode: 'cors'
      });
      if (!response.ok) throw new Error(`Failed to fetch users: ${response.status}`);
      const csvText = await response.text();
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true }).data;
      setUsers(parsed);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Error al cargar usuarios: ' + err.message);
    }
  };

  const fetchTasks = async () => {
    try {
      const response = await fetch(TASKS_CSV, { 
        cache: 'no-store',
        mode: 'cors'
      });
      if (!response.ok) throw new Error(`Failed to fetch tasks: ${response.status}`);
      const csvText = await response.text();
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true }).data.map((row, index) => ({
        ...row,
        rowIndex: index,
      }));
      setTasks(parsed);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError('Error al cargar tareas: ' + err.message);
    }
  };

  useEffect(() => {
    Promise.all([fetchUsers(), fetchTasks()])
      .then(() => setLoading(false))
      .catch((err) => {
        console.error('Error in initial fetch:', err);
        setError('Error al inicializar: ' + err.message);
      });
  }, []);

  // Configurar referencias de editores
  useEffect(() => {
    const setupEditor = (editor, spellcheck = true) => {
      if (editor && editor.root) {
        editor.root.setAttribute('spellcheck', spellcheck ? 'true' : 'false');
        editor.root.setAttribute('lang', 'es');
        editor.root.setAttribute('contenteditable', 'true');
        editor.root.addEventListener('focus', () => {
          editor.root.classList.add('ql-focused');
        });
        editor.root.addEventListener('blur', () => {
          editor.root.classList.remove('ql-focused');
        });
      }
    };
    
    if (taskEditorRef.current) {
      setupEditor(taskEditorRef.current);
    }
   
    Object.values(commentEditorsRef.current).forEach(editor => {
      if (editor) {
        setupEditor(editor);
      }
    });
  }, [commentContent]);

  const currentUser = users.find((u) => u.Nombre === user.name);
  const userRoles = currentUser ? currentUser['Rol en la Revista']?.split(';').map((r) => r.trim()) : [];
  const isDirector = userRoles.includes('Director General');
  const isRrss = userRoles.includes('Encargado de Redes Sociales');
  const isWeb = userRoles.includes('Responsable de Desarrollo Web');
  const isAssignee = (isRrss || isWeb) && !isDirector;
  const rrssUsers = users.filter((u) => u['Rol en la Revista']?.includes('Encargado de Redes Sociales'));
  const webUsers = users.filter((u) => u['Rol en la Revista']?.includes('Responsable de Desarrollo Web'));

  const filteredTasks = useMemo(() => {
    return tasks.reduce((areaTasks, task, index) => {
      if (!isDirector && !isAssignee) return areaTasks;
      if (isRrss || isDirector) {
        const taskText = task['Redes sociales'];
        const assignedName = task.Nombre || '';
        const completed = task['Cumplido 1'] === 'si';
        if (taskText && (!assignedName || assignedName === user.name || isDirector)) {
          areaTasks.push({ ...task, area: AREAS.RRSS, taskText, assignedName, completed, comment: task['Comentario 1'], rowIndex: index });
        }
      }
      if (isWeb || isDirector) {
        const taskText = task['Desarrollo Web'];
        const assignedName = task['Nombre.1'] || '';
        const completed = task['Cumplido 2'] === 'si';
        if (taskText && (!assignedName || assignedName === user.name || isDirector)) {
          areaTasks.push({ ...task, area: AREAS.WEB, taskText, assignedName, completed, comment: task['Comentario 2'], rowIndex: index });
        }
      }
      return areaTasks;
    }, []);
  }, [tasks, user.name, isDirector, isRrss, isWeb]);

  const pendingTasks = useMemo(() => filteredTasks.filter((t) => !t.completed), [filteredTasks]);
  const completedTasks = useMemo(() => filteredTasks.filter((t) => t.completed), [filteredTasks]);

  // Función de compresión agresiva de imágenes
  const optimizeImages = useCallback(async (html, editorRef = null) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const images = tempDiv.querySelectorAll('img');
    
    if (images.length === 0) return html;
    
    console.log(`🔄 Procesando ${images.length} imagen(es)...`);
    
    // Procesar imágenes en paralelo pero con límite para no saturar
    const imagePromises = Array.from(images).map(async (img, index) => {
      try {
        if (img.src.startsWith('data:image')) {
          const originalSize = img.src.length;
          console.log(`📸 Imagen ${index + 1}: ${Math.round(originalSize / 1024)}KB`);
          
          // Marcar como en proceso
          img.classList.add('image-compressing');
          
          // Comprimir imagen
          const compressedSrc = await compress(img.src);
          const compressedSize = compressedSrc.length;
          const reduction = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
          
          console.log(`✅ Imagen ${index + 1}: ${Math.round(compressedSize / 1024)}KB (${reduction}% menor)`);
          
          // Actualizar src
          img.src = compressedSrc;
          img.removeAttribute('data-large');
          img.classList.remove('image-compressing');
          
          // Establecer dimensiones fijas para mejor rendimiento
          img.style.maxWidth = '100%';
          img.style.height = 'auto';
          img.style.width = 'auto';
          img.setAttribute('loading', 'lazy');
          img.setAttribute('alt', `Imagen ${index + 1}`);
          
          return true;
        }
        return false;
      } catch (error) {
        console.warn(`⚠️ Error comprimiendo imagen ${index + 1}:`, error);
        img.classList.remove('image-compressing');
        // Marcar como grande para advertencia visual
        img.setAttribute('data-large', 'true');
        return false;
      }
    });
    
    await Promise.all(imagePromises);
    return tempDiv.innerHTML;
  }, [compress]);

  // Encoding ultra-optimizado
  const encodeBody = useCallback(async (html, editorRef = null, isComment = false) => {
    try {
      if (!html || html.trim() === '') return '';
      
      console.log(`📝 ${isComment ? 'Comentario' : 'Tarea'} original: ${html.length} chars`);
      
      let cleanedHtml = sanitizeInput(html);
      
      // OPTIMIZACIÓN 1: Comprimir imágenes SIEMPRE
      if (cleanedHtml.includes('<img')) {
        setIsCompressing(prev => ({ ...prev, [isComment ? 'comment' : 'task']: true }));
        cleanedHtml = await optimizeImages(cleanedHtml, editorRef);
        setIsCompressing(prev => ({ ...prev, [isComment ? 'comment' : 'task']: false }));
      }
      
      console.log(`📦 Después de compresión: ${cleanedHtml.length} chars`);
      
      // OPTIMIZACIÓN 2: Validación estricta de tamaño
      if (cleanedHtml.length > MAX_PAYLOAD_SIZE) {
        console.warn(`🚨 Contenido excede límite (${MAX_PAYLOAD_SIZE} chars). Truncando...`);
        
        // Crear versión de texto plano como fallback
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = cleanedHtml;
        
        // Extraer texto principal
        let textContent = tempDiv.textContent || tempDiv.innerText || '';
        
        // Si aún es muy grande, truncar inteligentemente
        if (textContent.length > MAX_PAYLOAD_SIZE * 0.8) {
          textContent = textContent.substring(0, MAX_PAYLOAD_SIZE * 0.7) + 
                       '\n\n⚠️ [CONTENIDO TRUNCADO - Demasiado grande para Google Sheets]';
          cleanedHtml = `<p>${textContent.replace(/\n/g, '<br>')}</p>`;
          console.log(`✂️ Texto truncado a: ${cleanedHtml.length} chars`);
        } else {
          // Mantener HTML pero remover imágenes grandes
          const images = tempDiv.querySelectorAll('img');
          images.forEach(img => {
            if (img.src.length > 10000) { // Imágenes muy grandes
              img.remove();
              console.log('🗑️ Removida imagen muy grande');
            }
          });
          cleanedHtml = tempDiv.innerHTML;
        }
      }
      
      // OPTIMIZACIÓN 3: Encoding eficiente
      const encoder = new TextEncoder();
      const bytes = encoder.encode(cleanedHtml);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      
      const encoded = btoa(binary);
      console.log(`✅ ${isComment ? 'Comentario' : 'Tarea'} codificado: ${encoded.length} chars (límite: ${MAX_PAYLOAD_SIZE})`);
      
      return encoded;
      
    } catch (err) {
      console.error('❌ Error encoding body:', err);
      
      // FALLBACK ULTRA-ROBUSTO
      try {
        // Intentar encoding simple
        const simpleText = html.replace(/<[^>]*>/g, ' ').substring(0, MAX_PAYLOAD_SIZE * 0.5);
        const encoded = base64EncodeUnicode(simpleText);
        console.log(`🔄 Fallback encoding: ${encoded.length} chars`);
        return encoded;
      } catch (fallbackErr) {
        console.error('❌ Fallback encoding failed:', fallbackErr);
        return ''; // Último recurso
      }
    }
  }, [optimizeImages]);

  const decodeBody = useCallback((body) => {
    if (!body) return <p className="text-gray-600">Sin contenido.</p>;
    try {
      let decoded;
      try {
        decoded = decodeURIComponent(escape(atob(body)));
      } catch (e1) {
        try {
          decoded = atob(body);
        } catch (e2) {
          decoded = body;
        }
      }
      
      const sanitized = decoded.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                              .replace(/on\w+="[^"]*"/gi, '');
      
      return (
        <div 
          className="ql-editor prose max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitized }}
          style={{ 
            lineHeight: '1.6', 
            fontSize: '14px',
            color: '#374151'
          }}
        />
      );
    } catch (err) {
      console.error('Error decoding body:', err);
      return <p className="text-red-600">Error al mostrar contenido</p>;
    }
  }, []);

  const handleAssignTask = async () => {
    if (!taskContent.trim()) {
      setSubmitStatus({ assign: 'La tarea no puede estar vacía' });
      return;
    }
   
    setSubmitStatus({ assign: '🗜️ Comprimiendo imágenes...' });
   
    const encodedTask = await encodeBody(taskContent, taskEditorRef, false);
   
    if (!encodedTask || encodedTask.length === 0) {
      setSubmitStatus({ assign: '❌ Error: No se pudo procesar el contenido' });
      return;
    }
   
    if (encodedTask.length > MAX_PAYLOAD_SIZE) {
      setSubmitStatus({ assign: `❌ Error: Contenido muy grande (${Math.round(encodedTask.length/1024)}KB). Máximo: ${Math.round(MAX_PAYLOAD_SIZE/1024)}KB` });
      return;
    }
   
    setSubmitStatus({ assign: '📤 Enviando a Google Sheets...' });
   
    const data = {
      action: 'assign',
      area: selectedArea,
      task: encodedTask,
      assignedTo: selectedAssignee || '',
    };
    
    console.log('📊 Datos finales:', {
      area: data.area,
      size: `${Math.round(data.task.length/1024)}KB`,
      hasImages: taskContent.includes('<img'),
      assignedTo: data.assignedTo
    });
    
    try {
      await fetchWithRetry(TASK_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      
      setSubmitStatus({ assign: '✅ ¡Tarea asignada exitosamente! 🎉' });
      setShowAssignModal(false);
      setTaskContent('');
      setSelectedAssignee('');
      setTimeout(() => fetchTasks(), 1500);
    } catch (err) {
      console.error('❌ Error assigning task:', err);
      setSubmitStatus({ assign: `❌ Error al asignar: ${err.message}` });
    }
  };

  const handleCompleteTask = async (task) => {
    const comment = commentContent[task.rowIndex] || '';
    if (!comment.trim()) {
      setSubmitStatus({ complete: 'El comentario no puede estar vacío' });
      return;
    }
   
    setSubmitStatus({ complete: '🗜️ Comprimiendo imágenes...' });
    setIsCompressing(prev => ({ ...prev, [task.rowIndex]: true }));
   
    console.log(`💬 Comentario original (${task.rowIndex}): ${comment.length} chars`);
   
    const commentEditor = commentEditorsRef.current[task.rowIndex];
    const encodedComment = await encodeBody(comment, commentEditor, true);
   
    setIsCompressing(prev => ({ ...prev, [task.rowIndex]: false }));
   
    console.log(`💾 Comentario codificado (${task.rowIndex}): ${encodedComment.length} chars`);
   
    if (!encodedComment || encodedComment.length === 0) {
      setSubmitStatus({ complete: '❌ Error: No se pudo procesar el comentario' });
      return;
    }
   
    if (encodedComment.length > MAX_PAYLOAD_SIZE) {
      setSubmitStatus({ complete: `❌ Error: Comentario muy grande (${Math.round(encodedComment.length/1024)}KB). Máximo: ${Math.round(MAX_PAYLOAD_SIZE/1024)}KB` });
      return;
    }
   
    setSubmitStatus({ complete: '📤 Enviando a Google Sheets...' });
   
    const data = {
      action: 'complete',
      area: task.area,
      row: task.rowIndex + 2,
      comment: encodedComment,
    };
    
    console.log('📊 Datos para completar:', {
      area: data.area,
      row: data.row,
      size: `${Math.round(data.comment.length/1024)}KB`,
      hasImages: comment.includes('<img')
    });
    
    try {
      await fetchWithRetry(TASK_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      
      setSubmitStatus({ complete: '✅ ¡Tarea completada exitosamente! 🎉' });
      setCommentContent((prev) => ({ ...prev, [task.rowIndex]: '' }));
      setTimeout(() => fetchTasks(), 1500);
    } catch (err) {
      console.error('❌ Error completing task:', err);
      setSubmitStatus({ complete: `❌ Error al completar: ${err.message}` });
    }
  };

  // Funciones debounced
  const debouncedHandleCommentChange = useCallback(
    debounce((rowIndex, value) => {
      setCommentContent((prev) => ({ ...prev, [rowIndex]: value }));
    }, 500),
    []
  );
  
  const debouncedSetTaskContent = useCallback(
    debounce((value) => {
      setTaskContent(value);
    }, 500),
    []
  );

  // Módulos de Quill
  const modules = useMemo(() => ({
    toolbar: {
      container: [
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['link', 'image'],
        [{ 'align': [] }],
        [{ 'size': ['small', false, 'large'] }],
        ['clean']
      ],
      handlers: {
        'image': function() {
          const input = document.createElement('input');
          input.setAttribute('type', 'file');
          input.setAttribute('accept', 'image/*');
          input.click();
          
          input.onchange = async () => {
            const file = input.files[0];
            if (file && file.size > 1024 * 1024 * 2) { // > 2MB
              alert('⚠️ La imagen es muy grande. Se comprimirá automáticamente, pero intenta usar imágenes más pequeñas.');
            }
            
            if (file) {
              setIsCompressing(prev => ({ ...prev, uploading: true }));
              
              try {
                // Comprimir antes de insertar
                const reader = new FileReader();
                reader.onload = async (e) => {
                  const compressedData = await compress(e.target.result);
                  const range = this.quill.getSelection();
                  
                  // Insertar imagen comprimida
                  this.quill.insertEmbed(range.index, 'image', compressedData);
                  
                  // Mover cursor después de la imagen
                  this.quill.setSelection(range.index + 1);
                };
                reader.readAsDataURL(file);
              } catch (error) {
                console.error('Error comprimiendo imagen al insertar:', error);
                // Fallback: insertar original
                const reader = new FileReader();
                reader.onload = (e) => {
                  const range = this.quill.getSelection();
                  this.quill.insertEmbed(range.index, 'image', e.target.result);
                  this.quill.setSelection(range.index + 1);
                };
                reader.readAsDataURL(file);
              } finally {
                setIsCompressing(prev => ({ ...prev, uploading: false }));
              }
            }
          };
        }
      }
    },
    imageResize: {
      parchment: Quill.import('parchment'),
      modules: ['Resize', 'DisplaySize'],
      handleStyles: { 
        backgroundColor: 'rgba(0, 0, 0, 0.5)', 
        border: 'none', 
        color: 'white',
        cursor: 'move'
      },
      displayStyles: { 
        backgroundColor: 'rgba(0, 0, 0, 0.5)', 
        border: 'none', 
        color: 'white' 
      },
    },
    clipboard: {
      matchVisual: false,
    }
  }), [compress]);

  const formats = [
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet', 'link', 'image', 'align', 'size'
  ];

  const canCompleteTask = (task) => {
    if (isDirector) return false;
    if (!isAssignee) return false;
    return task.assignedName === user.name || task.assignedName === '';
  };

  // Componentes Quill
  const TaskQuillEditor = React.forwardRef(({ value, onChange, placeholder, className }, ref) => {
    const quillRef = useRef(null);
    const containerRef = useRef(null);
    
    useEffect(() => {
      if (quillRef.current && ref) {
        ref.current = quillRef.current.getEditor();
        taskEditorRef.current = quillRef.current.getEditor();
      }
    }, [ref]);
   
    return (
      <div ref={containerRef} className="w-full h-full relative">
        <ReactQuill
          ref={quillRef}
          value={value}
          onChange={onChange}
          modules={modules}
          formats={formats}
          placeholder={placeholder}
          className={`w-full h-full ${className || ''}`}
          theme="snow"
          bounds={'.modal-content'}
          preserveWhitespace={true}
          readOnly={false}
          tabIndex={0}
        />
        {isCompressing.task && (
          <div className="absolute inset-0 bg-blue-50 bg-opacity-75 flex items-center justify-center rounded-md z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-blue-600">Comprimidiendo imágenes...</p>
            </div>
          </div>
        )}
      </div>
    );
  });

  TaskQuillEditor.displayName = 'TaskQuillEditor';

  const CommentQuillEditor = React.forwardRef(({ value, onChange, rowIndex, placeholder, className }, ref) => {
    const quillRef = useRef(null);
    const containerRef = useRef(null);
    
    useEffect(() => {
      if (quillRef.current && rowIndex) {
        const editor = quillRef.current.getEditor();
        commentEditorsRef.current[rowIndex] = editor;
        if (ref) ref.current = editor;
      }
    }, [rowIndex, ref]);
   
    return (
      <div ref={containerRef} className="w-full h-full relative">
        <ReactQuill
          ref={quillRef}
          value={value}
          onChange={(content, delta, source, editor) => {
            if (source === 'user') {
              onChange(rowIndex, content, delta, source, editor);
            }
          }}
          modules={modules}
          formats={formats}
          placeholder={placeholder}
          className={`w-full h-full ${className || ''}`}
          theme="snow"
          bounds={document.body}
          preserveWhitespace={true}
          readOnly={false}
          tabIndex={0}
        />
        {isCompressing[rowIndex] && (
          <div className="absolute inset-0 bg-green-50 bg-opacity-75 flex items-center justify-center rounded-md z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
              <p className="text-sm text-green-600">Comprimidiendo imágenes...</p>
            </div>
          </div>
        )}
        {isCompressing.uploading && (
          <div className="absolute inset-0 bg-yellow-50 bg-opacity-75 flex items-center justify-center rounded-md z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 mx-auto mb-2"></div>
              <p className="text-sm text-yellow-600">Subiendo imagen...</p>
            </div>
          </div>
        )}
      </div>
    );
  });

  CommentQuillEditor.displayName = 'CommentQuillEditor';

  if (loading) return <div className="text-center p-4 text-gray-600">Cargando tareas...</div>;
  if (error) return <div className="text-red-600 text-center p-4">{error}</div>;
  if (!isDirector && !isAssignee) return null;
  
  return (
    <div className="pt-4 space-y-6">
      {isDirector && (
        <button
          onClick={() => setShowAssignModal(true)}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
          aria-label="Asignar nueva tarea"
        >
          Asignar Nueva Tarea
        </button>
      )}
      
      <div className="flex space-x-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('pending')}
          className={`pb-2 px-4 text-sm font-medium transition-colors ${
            activeTab === 'pending' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-blue-600'
          }`}
          aria-label="Ver tareas pendientes"
        >
          Pendientes ({pendingTasks.length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`pb-2 px-4 text-sm font-medium transition-colors ${
            activeTab === 'completed' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-blue-600'
          }`}
          aria-label="Ver tareas completadas"
        >
          Completadas ({completedTasks.length})
        </button>
      </div>
      
      <div className="grid gap-6">
        {(activeTab === 'pending' ? pendingTasks : completedTasks).map((task) => (
          <div
            key={`${task.area}-${task.rowIndex}`}
            className="bg-white p-6 rounded-lg shadow-md border border-gray-200"
          >
            <h3 className="font-bold text-lg text-gray-800 mb-2">
              {task.area} - {task.assignedName || 'Todos'}
            </h3>
            <div className="text-gray-600 mb-4 prose max-w-none">
              {decodeBody(task.taskText)}
            </div>
            
            {task.completed && (
              <div className="mt-2 text-green-600 bg-green-50 p-3 rounded-md">
                <span className="font-medium">Completado:</span>{' '}
                <div className="mt-2 prose max-w-none">{decodeBody(task.comment)}</div>
              </div>
            )}
            
            {!task.completed && canCompleteTask(task) && (
              <div className="mt-4 space-y-4">
                <div className="min-h-[8rem] border rounded-md overflow-hidden relative" style={{ minHeight: '200px' }}>
                  <CommentQuillEditor
                    value={commentContent[task.rowIndex] || ''}
                    onChange={(rowIndex, content) => debouncedHandleCommentChange(rowIndex, content)}
                    rowIndex={task.rowIndex}
                    placeholder="Comentario sobre lo realizado... (imágenes se comprimirán automáticamente)"
                    className="h-full text-gray-800 bg-white"
                  />
                </div>
                <div className="text-xs text-gray-500 text-center">
                  📸 Las imágenes se comprimen automáticamente para optimizar el guardado
                </div>
                <button
                  onClick={() => handleCompleteTask(task)}
                  className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 text-sm font-medium disabled:opacity-50"
                  disabled={!commentContent[task.rowIndex]?.trim() || isCompressing[task.rowIndex]}
                  aria-label="Marcar tarea como completada"
                >
                  {isCompressing[task.rowIndex] ? '🗜️ Procesando...' : '✅ Marcar Completado'}
                </button>
              </div>
            )}
          </div>
        ))}
        
        {(activeTab === 'pending' ? pendingTasks : completedTasks).length === 0 && (
          <div className="text-center text-gray-600 py-8">
            No hay tareas {activeTab === 'pending' ? 'pendientes' : 'completadas'}.
          </div>
        )}
      </div>
      
      {/* Modal de asignación */}
      {showAssignModal && isDirector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col relative modal-content">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
              <h3 className="font-bold text-lg text-gray-800 mb-2">Asignar Nueva Tarea</h3>
              <p className="text-sm text-gray-600">Describe la tarea y selecciona al responsable</p>
            </div>
            
            <div className="flex-grow overflow-y-auto p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <select
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value)}
                  className="p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value={AREAS.RRSS}>{AREAS.RRSS}</option>
                  <option value={AREAS.WEB}>{AREAS.WEB}</option>
                </select>
                
                <select
                  value={selectedAssignee}
                  onChange={(e) => setSelectedAssignee(e.target.value)}
                  className="p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">Todos los {selectedArea === AREAS.RRSS ? 'RRSS' : 'Web'}</option>
                  {(selectedArea === AREAS.RRSS ? rrssUsers : webUsers).map((u) => (
                    <option key={u.Nombre} value={u.Nombre}>
                      {u.Nombre}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="min-h-[12rem] border border-gray-300 rounded-md overflow-hidden" style={{ minHeight: '250px' }}>
                <TaskQuillEditor
                  value={taskContent}
                  onChange={debouncedSetTaskContent}
                  placeholder="Describe la tarea detalladamente... (imágenes se comprimen automáticamente)"
                  className="h-full"
                  ref={taskEditorRef}
                />
              </div>
              
              <div className="text-xs text-gray-500 space-y-1">
                <p>💡 <strong>Formato rico</strong>: Usa negritas, listas, enlaces</p>
                <p>📸 <strong>Imágenes</strong>: Se comprimen automáticamente (máx. 600px, 50% calidad)</p>
                <p>⚠️ <strong>Límite</strong>: {Math.round(MAX_PAYLOAD_SIZE/1024)}KB por tarea</p>
              </div>
            </div>
            
            <div className="sticky bottom-0 pt-4 pb-4 px-4 bg-white border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setTaskContent('');
                  setSelectedAssignee('');
                }}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleAssignTask}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                disabled={!taskContent.trim() || isCompressing.task}
              >
                {isCompressing.task ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Procesando...
                  </>
                ) : (
                  'Asignar Tarea'
                )}
              </button>
            </div>
            
            {submitStatus.assign && (
              <div className="px-4 pb-4">
                <p
                  className={`text-sm ${
                    submitStatus.assign.includes('Error') || submitStatus.assign.includes('❌')
                      ? 'text-red-600' 
                      : submitStatus.assign.includes('exitosa') || submitStatus.assign.includes('✅')
                      ? 'text-green-600' 
                      : 'text-blue-600'
                  }`}
                >
                  {submitStatus.assign}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {submitStatus.complete && (
        <div className={`mt-4 p-3 rounded-md border ${
          submitStatus.complete.includes('Error') || submitStatus.complete.includes('❌')
            ? 'border-red-300 bg-red-50 text-red-700' 
            : 'border-green-300 bg-green-50 text-green-700'
        }`}>
          <p className="text-sm">{submitStatus.complete}</p>
        </div>
      )}
    </div>
  );
}