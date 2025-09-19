import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Papa from 'papaparse';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import ImageResize from 'quill-image-resize-module-react';
import { debounce } from 'lodash';
Quill.register('modules/imageResize', ImageResize);
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
const RETRY_DELAY = 1000;
const REQUEST_TIMEOUT = 15000;
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
  // Referencias para los editores de Quill
  const taskEditorRef = useRef(null);
  const commentEditorsRef = useRef({});
  useEffect(() => {
    // Añadir estilos CSS críticos para solucionar problemas de Quill
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
      }
      
      /* Fix para contenedores de Quill */
      .ql-container {
        overflow: visible !important;
        position: relative !important;
        font-family: inherit !important;
      }
      
      .ql-editor {
        min-height: 100% !important;
        padding: 12px !important;
        line-height: 1.5 !important;
        font-size: 14px !important;
        outline: none !important;
        white-space: pre-wrap !important;
        overflow-y: auto !important;
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
      }
      
      /* Fix para input de links */
      .ql-link-tooltip .ql-preview {
        display: none !important;
      }
      
      /* Fix para problemas de focus */
      .ql-editor:focus {
        outline: none !important;
      }
      
      /* Fix para imágenes */
      .ql-editor img {
        max-width: 100% !important;
        height: auto !important;
        border-radius: 4px !important;
        display: block !important;
        margin: 8px auto !important;
      }
      
      /* Fix para modales pequeños */
      .modal-content .ql-container {
        max-height: 300px !important;
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
  const fetchWithRetry = async (url, options, retries = MAX_RETRIES) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
      const response = await fetch(url, {
        ...options,
        mode: 'no-cors',
        headers: { 
          'Content-Type': 'application/json',
          // Headers adicionales para mejor compatibilidad
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        signal: controller.signal,
        // Configurar keepalive para mejor manejo de conexiones
        keepalive: true
      });
      clearTimeout(timeoutId);
      return { success: true };
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('Request timed out');
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
        mode: 'cors' // Cambiar a cors para CSV público
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
        mode: 'cors' // Cambiar a cors para CSV público
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
  // Configurar referencias de editores con mejor manejo
  useEffect(() => {
    const setupEditor = (editor, spellcheck = true) => {
      if (editor && editor.root) {
        editor.root.setAttribute('spellcheck', spellcheck ? 'true' : 'false');
        editor.root.setAttribute('lang', 'es');
        editor.root.setAttribute('contenteditable', 'true');
        // Prevenir problemas de focus
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
  }, [commentContent]); // Re-run cuando cambien los comentarios
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
  const encodeBody = useCallback((html, editorRef = null) => {
    try {
      if (!html || html.trim() === '') return '';
     
      // Limpiar y procesar el HTML directamente
      let cleanedHtml = html;
     
      // Sanitizar primero
      cleanedHtml = sanitizeInput(cleanedHtml);
     
      // Si hay imágenes, procesarlas con mejor manejo
      if (cleanedHtml.includes('<img')) {
        // Crear un clon del contenido para procesar
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = cleanedHtml;
        const images = tempDiv.querySelectorAll('img');
        
        if (images.length > 0) {
          console.log(`Procesando ${images.length} imagenes...`);
          
          images.forEach((img, index) => {
            try {
              // Comprimir dimensiones si es muy grande
              let imgWidth = img.naturalWidth || img.width;
              let imgHeight = img.naturalHeight || img.height;
              
              // Limitar tamaño máximo para Google Sheets
              const maxDimension = 800;
              if (imgWidth > maxDimension || imgHeight > maxDimension) {
                const ratio = Math.min(maxDimension / imgWidth, maxDimension / imgHeight);
                imgWidth = Math.floor(imgWidth * ratio);
                imgHeight = Math.floor(imgHeight * ratio);
              }
              
              // Estilos optimizados para Google Sheets
              let style = `max-width:100%;height:auto;border-radius:4px;display:block;margin:8px auto;width:${imgWidth}px;height:${imgHeight}px;`;
              
              // Asegurar que las imágenes sean responsive
              style += 'max-width:100% !important;box-sizing:border-box !important;';
              
              img.setAttribute('style', style);
              img.setAttribute('loading', 'lazy');
              img.setAttribute('alt', `Imagen ${index + 1} de la tarea`);
              
              // Optimizar src si es data URL
              if (img.src.startsWith('data:image')) {
                console.log(`Optimizando imagen ${index + 1}...`);
                // Para data URLs muy grandes, podríamos necesitar compresión
                // pero por ahora solo mantenemos el original
              }
            } catch (imgError) {
              console.warn(`Error procesando imagen ${index}:`, imgError);
            }
          });
        }
        
        cleanedHtml = tempDiv.innerHTML;
      }
     
      // Verificar tamaño antes de codificar
      if (cleanedHtml.length > 45000) {
        console.warn('Contenido muy grande, truncando...');
        // Truncar inteligentemente
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = cleanedHtml;
        const allText = tempDiv.textContent || tempDiv.innerText || '';
        if (allText.length > 40000) {
          // Mantener las primeras 20000 chars y agregar aviso
          const truncated = allText.substring(0, 20000) + '\n\n... (contenido truncado por límite de tamaño)';
          cleanedHtml = `<p>${truncated.replace(/\n/g, '<br>')}</p>`;
        }
      }
     
      // Codificar en base64 con mejor manejo de errores
      const encoder = new TextEncoder();
      const bytes = encoder.encode(cleanedHtml);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const encoded = btoa(binary);
      
      console.log(`Contenido codificado: ${encoded.length} caracteres`);
      return encoded;
     
    } catch (err) {
      console.error('Error encoding body:', err);
      // Fallback más robusto
      try {
        // Intentar con encodeURIComponent primero
        const uriEncoded = encodeURIComponent(html);
        const base64 = btoa(uriEncoded);
        return base64;
      } catch (fallbackErr) {
        console.error('Error en fallback encoding:', fallbackErr);
        // Último recurso: codificar como texto plano
        return base64EncodeUnicode(html.substring(0, 20000)); // Limitar tamaño
      }
    }
  }, []);
  const decodeBody = useCallback((body) => {
    if (!body) return <p className="text-gray-600">Sin contenido.</p>;
    try {
      // Mejorar el decoding
      let decoded;
      try {
        decoded = decodeURIComponent(escape(atob(body)));
      } catch (e1) {
        // Fallback para diferentes encodings
        try {
          decoded = atob(body);
        } catch (e2) {
          decoded = body; // Último recurso
        }
      }
      
      // Sanitizar el HTML decodificado
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
      return <p className="text-red-600">Error al mostrar contenido: {err.message}</p>;
    }
  }, []);
  const handleAssignTask = async () => {
    if (!taskContent.trim()) {
      setSubmitStatus({ assign: 'La tarea no puede estar vacía' });
      return;
    }
   
    setSubmitStatus({ assign: 'Enviando...' });
   
    console.log('Task HTML original:', taskContent.substring(0, 200));
   
    const encodedTask = encodeBody(taskContent, taskEditorRef);
    console.log('Encoded task length:', encodedTask.length);
   
    if (!encodedTask || encodedTask.length === 0) {
      setSubmitStatus({ assign: 'Error: No se pudo procesar el contenido de la tarea' });
      return;
    }
   
    const data = {
      action: 'assign',
      area: selectedArea,
      task: encodedTask,
      assignedTo: selectedAssignee || '',
    };
    
    console.log('Datos finales a enviar:', {
      area: data.area,
      taskLength: data.task.length,
      hasImages: taskContent.includes('<img'),
      assignedTo: data.assignedTo
    });
    
    try {
      const result = await fetchWithRetry(TASK_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(data),
        // Configurar mejor el body para no-cors
        credentials: 'omit'
      });
      
      console.log('Resultado del envío:', result);
      
      setSubmitStatus({ assign: '¡Tarea asignada exitosamente! 🎉' });
      setShowAssignModal(false);
      setTaskContent('');
      setSelectedAssignee('');
      // Refetch con delay para asegurar que se guarde
      setTimeout(() => fetchTasks(), 1000);
    } catch (err) {
      console.error('Error assigning task:', err);
      setSubmitStatus({ assign: `Error al asignar tarea: ${err.message}` });
    }
  };
  const handleCompleteTask = async (task) => {
    const comment = commentContent[task.rowIndex] || '';
    if (!comment.trim()) {
      setSubmitStatus({ complete: 'El comentario no puede estar vacío' });
      return;
    }
   
    setSubmitStatus({ complete: 'Enviando...' });
   
    console.log(`Comment HTML original for task ${task.rowIndex}:`, comment.substring(0, 200));
   
    const commentEditor = commentEditorsRef.current[task.rowIndex];
    const encodedComment = encodeBody(comment, commentEditor);
    console.log(`Encoded comment length for task ${task.rowIndex}:`, encodedComment.length);
   
    if (!encodedComment || encodedComment.length === 0) {
      setSubmitStatus({ complete: 'Error: No se pudo procesar el comentario' });
      return;
    }
   
    const data = {
      action: 'complete',
      area: task.area,
      row: task.rowIndex + 2,
      comment: encodedComment,
    };
    
    console.log('Datos finales para completar tarea:', {
      area: data.area,
      row: data.row,
      commentLength: data.comment.length,
      hasImages: comment.includes('<img')
    });
    
    try {
      const result = await fetchWithRetry(TASK_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(data),
        credentials: 'omit'
      });
      
      console.log('Resultado del completado:', result);
      
      setSubmitStatus({ complete: '¡Tarea completada exitosamente! 🎉' });
      setCommentContent((prev) => ({ ...prev, [task.rowIndex]: '' }));
      // Refetch con delay
      setTimeout(() => fetchTasks(), 1000);
    } catch (err) {
      console.error('Error completing task:', err);
      setSubmitStatus({ complete: `Error al completar tarea: ${err.message}` });
    }
  };
  // Funciones debounced mejoradas
  const debouncedHandleCommentChange = useCallback(
    debounce((rowIndex, value) => {
      console.log(`Comment change for row ${rowIndex}:`, value.substring(0, 100));
      setCommentContent((prev) => ({ ...prev, [rowIndex]: value }));
    }, 500), // Aumentar delay para mejor performance
    []
  );
  
  const debouncedSetTaskContent = useCallback(
    debounce((value) => {
      console.log('Task content change:', value.substring(0, 100));
      setTaskContent(value);
    }, 500),
    []
  );
  
  // Módulos de Quill optimizados
  const modules = useMemo(() => ({
    toolbar: {
      container: [
        ['bold', 'italic', 'underline', 'strike', 'blockquote'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['link', 'image'],
        [{ 'align': ['', 'center', 'right', 'justify'] }],
        [{ 'size': ['small', false, 'large'] }],
        ['clean']
      ],
      handlers: {
        // Handler personalizado para links
        'link': function(value) {
          if (value) {
            const href = prompt('Enter the URL:');
            if (href) {
              const range = this.quill.getSelection();
              this.quill.format('link', href, 'user');
            }
          } else {
            this.quill.format('link', false);
          }
        }
      }
    },
    imageResize: {
      parchment: Quill.import('parchment'),
      modules: ['Resize', 'DisplaySize', 'Toolbar'],
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
      // Limitar tamaño máximo de imágenes
      onImageResize: (img, height, width) => {
        if (width > 800) {
          const ratio = 800 / width;
          height = Math.round(height * ratio);
          width = 800;
        }
        if (height > 800) {
          const ratio = 800 / height;
          width = Math.round(width * ratio);
          height = 800;
        }
        return { height, width };
      }
    },
    clipboard: {
      matchVisual: false,
    }
  }), []);
  
  const formats = [
    'header', 'font', 'size',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'link', 'image', 'color', 'background', 'align'
  ];
  
  const canCompleteTask = (task) => {
    if (isDirector) return false;
    if (!isAssignee) return false;
    return task.assignedName === user.name || task.assignedName === '';
  };
  
  // Componente Quill para tareas con mejores props
  const TaskQuillEditor = React.forwardRef(({ value, onChange, placeholder, className }, ref) => {
    const quillRef = useRef(null);
    const containerRef = useRef(null);
    
    useEffect(() => {
      if (quillRef.current && ref) {
        ref.current = quillRef.current.getEditor();
        taskEditorRef.current = quillRef.current.getEditor();
      }
    }, [ref]);
   
    // Fix para problemas de focus y typing
    useEffect(() => {
      const handleKeyDown = (e) => {
        // Prevenir comportamientos no deseados
        if (e.key === 'Enter' && e.shiftKey) {
          e.preventDefault();
        }
      };
      
      const editorRoot = containerRef.current?.querySelector('.ql-editor');
      if (editorRoot) {
        editorRoot.addEventListener('keydown', handleKeyDown);
        editorRoot.addEventListener('input', () => {
          // Force focus maintenance
          if (document.activeElement !== editorRoot) {
            editorRoot.focus();
          }
        });
      }
      
      return () => {
        if (editorRoot) {
          editorRoot.removeEventListener('keydown', handleKeyDown);
        }
      };
    }, []);
   
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
          bounds={'.modal-content'} // Para modales
          preserveWhitespace={true}
          // Props adicionales para mejor UX
          readOnly={false}
          tabIndex={0}
        />
      </div>
    );
  });
  
  TaskQuillEditor.displayName = 'TaskQuillEditor';
  
  // Componente Quill para comentarios
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
   
    // Fix para problemas de focus
    useEffect(() => {
      const handleFocus = () => {
        const editorRoot = containerRef.current?.querySelector('.ql-editor');
        if (editorRoot) {
          editorRoot.focus();
        }
      };
      
      const container = containerRef.current;
      if (container) {
        container.addEventListener('click', handleFocus);
      }
      
      return () => {
        if (container) {
          container.removeEventListener('click', handleFocus);
        }
      };
    }, []);
   
    return (
      <div ref={containerRef} className="w-full h-full relative">
        <ReactQuill
          ref={quillRef}
          value={value}
          onChange={(content, delta, source, editor) => {
            // Mejorar el handling de cambios
            if (source === 'user') {
              onChange(rowIndex, content, delta, source, editor);
            }
          }}
          modules={modules}
          formats={formats}
          placeholder={placeholder}
          className={`w-full h-full ${className || ''}`}
          theme="snow"
          bounds={document.body} // Usar body para evitar conflictos
          preserveWhitespace={true}
          readOnly={false}
          tabIndex={0}
        />
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
                <div className="min-h-[8rem] border rounded-md overflow-hidden relative">
                  <CommentQuillEditor
                    value={commentContent[task.rowIndex] || ''}
                    onChange={(rowIndex, content, delta, source, editor) => {
                      debouncedHandleCommentChange(rowIndex, content);
                    }}
                    rowIndex={task.rowIndex}
                    placeholder="Comentario sobre lo realizado... (puedes agregar imágenes)"
                    className="h-[200px] text-gray-800 bg-white"
                  />
                </div>
                <button
                  onClick={() => handleCompleteTask(task)}
                  className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 text-sm font-medium disabled:opacity-50"
                  disabled={!commentContent[task.rowIndex]?.trim()}
                  aria-label="Marcar tarea como completada"
                >
                  Marcar Completado
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
      
      {/* Modal de asignación mejorado */}
      {showAssignModal && isDirector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col relative modal-content">
            {/* Header del modal */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
              <h3 className="font-bold text-lg text-gray-800 mb-2">Asignar Nueva Tarea</h3>
              <p className="text-sm text-gray-600">Describe la tarea y selecciona al responsable</p>
            </div>
            
            {/* Contenido del modal */}
            <div className="flex-grow overflow-y-auto p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <select
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value)}
                  className="p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  aria-label="Seleccionar área de la tarea"
                >
                  <option value={AREAS.RRSS}>{AREAS.RRSS}</option>
                  <option value={AREAS.WEB}>{AREAS.WEB}</option>
                </select>
                
                <select
                  value={selectedAssignee}
                  onChange={(e) => setSelectedAssignee(e.target.value)}
                  className="p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  aria-label="Seleccionar asignado"
                >
                  <option value="">Todos los {selectedArea === AREAS.RRSS ? 'RRSS' : 'Web'}</option>
                  {(selectedArea === AREAS.RRSS ? rrssUsers : webUsers).map((u) => (
                    <option key={u.Nombre} value={u.Nombre}>
                      {u.Nombre}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="min-h-[12rem] border border-gray-300 rounded-md overflow-hidden">
                <TaskQuillEditor
                  value={taskContent}
                  onChange={debouncedSetTaskContent}
                  placeholder="Describe la tarea detalladamente... (puedes agregar imágenes y enlaces)"
                  className="h-[250px]"
                  ref={taskEditorRef}
                />
              </div>
              
              <div className="text-xs text-gray-500">
                💡 Puedes usar <strong>formato rico</strong>, agregar <strong>imágenes</strong> y <strong>enlaces</strong>. 
                El contenido se guardará automáticamente en Google Sheets.
              </div>
            </div>
            
            {/* Footer del modal */}
            <div className="sticky bottom-0 pt-4 pb-4 px-4 bg-white border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setTaskContent('');
                  setSelectedAssignee('');
                }}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors text-sm font-medium"
                aria-label="Cancelar asignación de tarea"
              >
                Cancelar
              </button>
              <button
                onClick={handleAssignTask}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!taskContent.trim()}
                aria-label="Asignar tarea"
              >
                {submitStatus.assign === 'Enviando...' ? 'Enviando...' : 'Asignar Tarea'}
              </button>
            </div>
            
            {submitStatus.assign && (
              <div className="px-4 pb-4">
                <p
                  className={`text-sm ${
                    submitStatus.assign?.includes('Error') || submitStatus.assign?.includes('Error') 
                      ? 'text-red-600' 
                      : submitStatus.assign?.includes('exitosa') 
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
        <div className="mt-4 p-3 rounded-md border ${
          submitStatus.complete?.includes('Error') 
            ? 'border-red-300 bg-red-50 text-red-700' 
            : 'border-green-300 bg-green-50 text-green-700'
        }">
          <p className="text-sm">{submitStatus.complete}</p>
        </div>
      )}
    </div>
  );
}