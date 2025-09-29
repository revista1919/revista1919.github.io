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
  const taskEditorRef = useRef(null);
  const commentEditorsRef = useRef({});

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
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
      .ql-modal {
        z-index: 10001 !important;
      }
      .ql-toolbar {
        z-index: 10002 !important;
        position: sticky !important;
        top: 0 !important;
        background: white !important;
        border-bottom: 1px solid #ddd !important;
      }
      .ql-link-tooltip .ql-preview {
        display: none !important;
      }
      .ql-editor:focus {
        outline: none !important;
      }
      .ql-editor img {
        max-width: 100% !important;
        height: auto !important;
        border-radius: 4px !important;
        display: block !important;
        margin: 8px auto !important;
      }
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
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        signal: controller.signal,
        keepalive: true
      });
      clearTimeout(timeoutId);
      // Note: With no-cors, response body cannot be read, so we can't check response.ok
      return response;
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
        mode: 'no-cors'
      });
      // Note: Cannot read response body with no-cors mode
      // If you need to parse the CSV, the server must allow CORS or you need a proxy
      setError('Cannot read response body with no-cors mode');
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Error al cargar usuarios: ' + err.message);
    }
  };

  const fetchTasks = async () => {
    try {
      const response = await fetch(TASKS_CSV, { 
        cache: 'no-store',
        mode: 'no-cors'
      });
      // Note: Cannot read response body with no-cors mode
      setError('Cannot read response body with no-cors mode');
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

  const uploadImage = async (file) => {
    try {
      const reader = new FileReader();
      return new Promise((resolve, reject) => {
        reader.onload = async (e) => {
          const base64 = e.target.result.split(',')[1];
          const mime = file.type;
          const name = file.name;
          try {
            const response = await fetchWithRetry(TASK_SCRIPT_URL, {
              method: 'POST',
              mode: 'no-cors',
              body: JSON.stringify({
                action: 'upload_image',
                data: base64,
                mime: mime,
                name: name
              }),
            });
            // Note: Cannot read response body with no-cors mode
            reject(new Error('Cannot read response body with no-cors mode'));
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    } catch (err) {
      console.error('Error uploading image:', err);
      return null;
    }
  };

  const encodeBody = useCallback((html, editorRef = null) => {
    try {
      if (!html || html.trim() === '') return '';
      let cleanedHtml = html;
      cleanedHtml = sanitizeInput(cleanedHtml);
      if (cleanedHtml.includes('<img')) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = cleanedHtml;
        const images = tempDiv.querySelectorAll('img');
        
        if (images.length > 0) {
          console.log(`Procesando ${images.length} imagenes...`);
          images.forEach((img, index) => {
            try {
              let style = `max-width:100%;height:auto;border-radius:4px;display:block;margin:8px auto;`;
              style += 'max-width:100% !important;box-sizing:border-box !important;';
              img.setAttribute('style', style);
              img.setAttribute('loading', 'lazy');
              img.setAttribute('alt', `Imagen ${index + 1} de la tarea`);
            } catch (imgError) {
              console.warn(`Error procesando imagen ${index}:`, imgError);
            }
          });
        }
        cleanedHtml = tempDiv.innerHTML;
      }
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
      try {
        const uriEncoded = encodeURIComponent(html);
        const base64 = btoa(uriEncoded);
        return base64;
      } catch (fallbackErr) {
        console.error('Error en fallback encoding:', fallbackErr);
        return base64EncodeUnicode(html); 
      }
    }
  }, []);

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
      const response = await fetchWithRetry(TASK_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(data),
      });
      // Note: Cannot read response body with no-cors mode
      setSubmitStatus({ assign: '¡Tarea asignada exitosamente! 🎉' });
      setShowAssignModal(false);
      setTaskContent('');
      setSelectedAssignee('');
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
      const response = await fetchWithRetry(TASK_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(data),
      });
      // Note: Cannot read response body with no-cors mode
      setSubmitStatus({ complete: '¡Tarea completada exitosamente! 🎉' });
      setCommentContent((prev) => ({ ...prev, [task.rowIndex]: '' }));
      setTimeout(() => fetchTasks(), 1000);
    } catch (err) {
      console.error('Error completing task:', err);
      setSubmitStatus({ complete: `Error al completar tarea: ${err.message}` });
    }
  };

  const debouncedHandleCommentChange = useCallback(
    debounce((rowIndex, value) => {
      console.log(`Comment change for row ${rowIndex}:`, value.substring(0, 100));
      setCommentContent((prev) => ({ ...prev, [rowIndex]: value }));
    }, 500),
    []
  );

  const debouncedSetTaskContent = useCallback(
    debounce((value) => {
      console.log('Task content change:', value.substring(0, 100));
      setTaskContent(value);
    }, 500),
    []
  );

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
        },
        'image': function() {
          const input = document.createElement('input');
          input.setAttribute('type', 'file');
          input.setAttribute('accept', 'image/*');
          input.click();
          input.onchange = async () => {
            if (input.files && input.files[0]) {
              const file = input.files[0];
              const url = await uploadImage(file);
              if (url) {
                const range = this.quill.getSelection(true);
                this.quill.insertEmbed(range.index, 'image', url, 'user');
                this.quill.setSelection(range.index + 1, 'silent');
              }
            }
          };
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

  const TaskQuillEditor = React.forwardRef(({ value, onChange, placeholder, className }, ref) => {
    const quillRef = useRef(null);
    const containerRef = useRef(null);
    
    useEffect(() => {
      if (quillRef.current && ref) {
        ref.current = quillRef.current.getEditor();
        taskEditorRef.current = quillRef.current.getEditor();
      }
    }, [ref]);
   
    useEffect(() => {
      const handleKeyDown = (e) => {
        if (e.key === 'Enter' && e.shiftKey) {
          e.preventDefault();
        }
      };
      
      const editorRoot = containerRef.current?.querySelector('.ql-editor');
      if (editorRoot) {
        editorRoot.addEventListener('keydown', handleKeyDown);
        editorRoot.addEventListener('input', () => {
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
          bounds={'.modal-content'}
          preserveWhitespace={true}
          readOnly={false}
          tabIndex={0}
        />
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
            className="bg-white p-4 sm:p-6 rounded-lg shadow-md border border-gray-200 w-full overflow-hidden box-border"
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
              <div className="mt-4 space-y-4 w-full">
                <div className="min-h-[8rem] border rounded-md overflow-hidden w-full">
                  <CommentQuillEditor
                    value={commentContent[task.rowIndex] || ''}
                    onChange={(rowIndex, content, delta, source, editor) => {
                      debouncedHandleCommentChange(rowIndex, content);
                    }}
                    rowIndex={task.rowIndex}
                    placeholder="Comentario sobre lo realizado... (para imágenes, usa el botón de imagen para evitar problemas de tamaño)"
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
              <div className="min-h-[12rem] border border-gray-300 rounded-md overflow-hidden w-full">
                <TaskQuillEditor
                  value={taskContent}
                  onChange={debouncedSetTaskContent}
                  placeholder="Describe la tarea detalladamente... (para imágenes, usa el botón de imagen para evitar problemas de tamaño)"
                  className="h-[250px]"
                  ref={taskEditorRef}
                />
              </div>
              <div className="text-xs text-gray-500">
                💡 Puedes usar <strong>formato rico</strong>, agregar <strong>imágenes</strong> y <strong>enlaces</strong>. 
                El contenido se guardará automáticamente en Google Sheets.
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