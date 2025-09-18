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
const REQUEST_TIMEOUT = 10000;

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

  const fetchWithRetry = async (url, options, retries = MAX_RETRIES) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
      const response = await fetch(url, {
        ...options,
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
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
      const response = await fetch(USERS_CSV, { cache: 'no-store' });
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
      const response = await fetch(TASKS_CSV, { cache: 'no-store' });
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
    if (taskEditorRef.current) {
      taskEditorRef.current.root.setAttribute('spellcheck', 'true');
      taskEditorRef.current.root.setAttribute('lang', 'es');
    }
    
    // Configurar editores de comentarios
    Object.values(commentEditorsRef.current).forEach(editor => {
      if (editor) {
        editor.root.setAttribute('spellcheck', 'true');
        editor.root.setAttribute('lang', 'es');
      }
    });
  }, []);

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

  const encodeBody = (html) => {
    try {
      if (!html || html.trim() === '') return '';
      
      // Limpiar y procesar el HTML directamente
      let cleanedHtml = html;
      
      // Sanitizar primero
      cleanedHtml = sanitizeInput(cleanedHtml);
      
      // Si hay imágenes, procesarlas
      if (cleanedHtml.includes('<img')) {
        // Obtener el HTML real del editor si está disponible
        let currentHtml = cleanedHtml;
        
        // Para el editor de tareas
        if (taskEditorRef.current) {
          try {
            currentHtml = taskEditorRef.current.root.innerHTML;
          } catch (e) {
            console.warn('No se pudo obtener HTML del editor de tareas:', e);
          }
        }
        
        // Para editores de comentarios
        const commentEditor = commentEditorsRef.current[html]; // Usar un identificador único
        if (commentEditor) {
          try {
            currentHtml = commentEditor.root.innerHTML;
          } catch (e) {
            console.warn('No se pudo obtener HTML del editor de comentarios:', e);
          }
        }
        
        // Procesar imágenes para asegurar estilos correctos
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = currentHtml;
        const images = tempDiv.querySelectorAll('img');
        
        images.forEach((img, index) => {
          const parent = img.parentElement;
          // Obtener alineación si es posible
          let align = 'left';
          
          // Intentar obtener alineación del editor correspondiente
          const editor = taskEditorRef.current || commentEditor;
          if (editor) {
            try {
              const imgIndex = editor.getIndex(img);
              const formats = editor.getFormat(imgIndex);
              align = formats.align || 'left';
            } catch (e) {
              console.warn(`No se pudo obtener formato para imagen ${index}:`, e);
            }
          }
          
          let style = 'max-width:100%;height:auto;border-radius:4px;margin:8px 0;display:block;';
          
          switch (align) {
            case 'center':
              style += 'margin-left:auto;margin-right:auto;';
              break;
            case 'right':
              style += 'float:right;margin-left:8px;margin-right:0;';
              if (parent) parent.style.overflow = 'hidden';
              break;
            case 'justify':
              style += 'width:100%;margin-left:0;margin-right:0;';
              break;
            case 'left':
            default:
              style += 'float:left;margin-right:8px;margin-left:0;';
              if (parent) parent.style.overflow = 'hidden';
              break;
          }
          
          // Preservar dimensiones si están establecidas
          if (img.style.width) style += `width:${img.style.width};`;
          if (img.style.height) style += `height:${img.style.height};`;
          
          img.setAttribute('style', style);
          img.setAttribute('loading', 'lazy'); // Buena práctica
          img.setAttribute('alt', 'Imagen de la tarea'); // Accesibilidad
        });
        
        // Obtener el HTML procesado
        cleanedHtml = tempDiv.innerHTML;
      }
      
      // Codificar en base64
      const encoder = new TextEncoder();
      const bytes = encoder.encode(cleanedHtml);
      let binary = '';
      bytes.forEach(b => binary += String.fromCharCode(b));
      return btoa(binary);
      
    } catch (err) {
      console.error('Error encoding body:', err);
      // Fallback: intentar codificar el HTML original sin procesar
      try {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(html);
        let binary = '';
        bytes.forEach(b => binary += String.fromCharCode(b));
        return btoa(binary);
      } catch (fallbackErr) {
        console.error('Error en fallback encoding:', fallbackErr);
        return base64EncodeUnicode(html); // Último recurso
      }
    }
  };

  const decodeBody = (body) => {
    if (!body) return <p className="text-gray-600">Sin contenido.</p>;
    try {
      const decoded = decodeURIComponent(escape(atob(body)));
      return <div className="ql-editor" dangerouslySetInnerHTML={{ __html: decoded }} />;
    } catch (err) {
      console.error('Error decoding body:', err);
      return <p className="text-red-600">Error al mostrar contenido.</p>;
    }
  };

  const handleAssignTask = async () => {
    if (!taskContent.trim()) {
      setSubmitStatus({ assign: 'La tarea no puede estar vacía' });
      return;
    }
    
    setSubmitStatus({ assign: 'Enviando...' });
    
    console.log('Task HTML original:', taskContent); // Debug
    
    const encodedTask = encodeBody(taskContent);
    console.log('Encoded task length:', encodedTask.length); // Debug
    console.log('Encoded task preview:', encodedTask.substring(0, 100)); // Debug
    
    if (!encodedTask) {
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
      await fetchWithRetry(TASK_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      setSubmitStatus({ assign: '¡Tarea asignada exitosamente! 🎉' });
      setShowAssignModal(false);
      setTaskContent('');
      setSelectedAssignee('');
      await fetchTasks();
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
    
    console.log(`Comment HTML original for task ${task.rowIndex}:`, comment); // Debug
    
    const encodedComment = encodeBody(comment);
    console.log(`Encoded comment length for task ${task.rowIndex}:`, encodedComment.length); // Debug
    
    if (!encodedComment) {
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
      await fetchWithRetry(TASK_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      setSubmitStatus({ complete: '¡Tarea completada exitosamente! 🎉' });
      setCommentContent((prev) => ({ ...prev, [task.rowIndex]: '' }));
      await fetchTasks();
    } catch (err) {
      console.error('Error completing task:', err);
      setSubmitStatus({ complete: `Error al completar tarea: ${err.message}` });
    }
  };

  const handleCommentChange = useCallback(
    debounce((rowIndex, value) => {
      setCommentContent((prev) => ({ ...prev, [rowIndex]: value }));
    }, 150),
    []
  );

  const modules = useMemo(() => ({
    toolbar: [
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link', 'image'],
      [{ align: ['', 'center', 'right', 'justify'] }],
      [{ size: ['small', false, 'large'] }],
      ['clean'],
    ],
    imageResize: {
      parchment: Quill.import('parchment'),
      modules: ['Resize', 'DisplaySize', 'Toolbar'],
      handleStyles: { backgroundColor: 'rgba(0, 0, 0, 0.5)', border: 'none', color: 'white' },
      displayStyles: { backgroundColor: 'rgba(0, 0, 0, 0.5)', border: 'none', color: 'white' },
    },
  }), []);

  const formats = ['bold', 'italic', 'underline', 'strike', 'blockquote', 'list', 'bullet', 'link', 'image', 'align', 'size'];

  const canCompleteTask = (task) => {
    if (isDirector) return false;
    if (!isAssignee) return false;
    return task.assignedName === user.name || task.assignedName === '';
  };

  // Renderizar Quill para tareas con referencia
  const TaskQuillEditor = ({ value, onChange, placeholder, className }) => {
    const quillRef = useRef(null);
    
    useEffect(() => {
      if (quillRef.current) {
        taskEditorRef.current = quillRef.current.getEditor();
      }
    }, []);
    
    return (
      <ReactQuill
        ref={quillRef}
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        className={className}
      />
    );
  };

  // Renderizar Quill para comentarios con referencia
  const CommentQuillEditor = ({ value, onChange, rowIndex, placeholder, className }) => {
    const quillRef = useRef(null);
    
    useEffect(() => {
      if (quillRef.current) {
        commentEditorsRef.current[rowIndex] = quillRef.current.getEditor();
      }
    }, [rowIndex]);
    
    return (
      <ReactQuill
        ref={quillRef}
        value={value}
        onChange={(value) => onChange(rowIndex, value)}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        className={className}
      />
    );
  };

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
            <div className="text-gray-600 mb-4">{decodeBody(task.taskText)}</div>
            {task.completed && (
              <div className="mt-2 text-green-600 bg-green-50 p-3 rounded-md">
                <span className="font-medium">Completado:</span> {decodeBody(task.comment)}
              </div>
            )}
            {!task.completed && canCompleteTask(task) && (
              <div className="mt-4 space-y-4">
                <div className="min-h-[8rem] border rounded-md overflow-auto">
                  <CommentQuillEditor
                    value={commentContent[task.rowIndex] || ''}
                    onChange={handleCommentChange}
                    rowIndex={task.rowIndex}
                    placeholder="Comentario sobre lo realizado..."
                    className="h-full text-gray-800 bg-white"
                  />
                </div>
                <button
                  onClick={() => handleCompleteTask(task)}
                  className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 text-sm font-medium"
                  aria-label="Marcar tarea como completada"
                >
                  Marcar Completado
                </button>
              </div>
            )}
          </div>
        ))}
        {(activeTab === 'pending' ? pendingTasks : completedTasks).length === 0 && (
          <div className="text-center text-gray-600">No hay tareas {activeTab === 'pending' ? 'pendientes' : 'completadas'}.</div>
        )}
      </div>
      {showAssignModal && isDirector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
            <h3 className="font-bold text-lg text-gray-800 mb-4">Asignar Tarea</h3>
            <div className="flex-grow space-y-4 overflow-y-auto">
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                aria-label="Seleccionar área de la tarea"
              >
                <option value={AREAS.RRSS}>{AREAS.RRSS}</option>
                <option value={AREAS.WEB}>{AREAS.WEB}</option>
              </select>
              <select
                value={selectedAssignee}
                onChange={(e) => setSelectedAssignee(e.target.value)}
                className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                aria-label="Seleccionar asignado"
              >
                <option value="">Todos</option>
                {(selectedArea === AREAS.RRSS ? rrssUsers : webUsers).map((u) => (
                  <option key={u.Nombre} value={u.Nombre}>
                    {u.Nombre}
                  </option>
                ))}
              </select>
              <div className="min-h-[10rem] border rounded-md overflow-auto">
                <TaskQuillEditor
                  value={taskContent}
                  onChange={setTaskContent}
                  placeholder="Describe la tarea..."
                  className="h-full text-gray-800 bg-white"
                />
              </div>
            </div>
            <div className="sticky bottom-0 pt-4 bg-white flex justify-end space-x-2">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors text-sm font-medium"
                aria-label="Cancelar asignación de tarea"
              >
                Cancelar
              </button>
              <button
                onClick={handleAssignTask}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                disabled={!taskContent.trim()}
                aria-label="Asignar tarea"
              >
                Asignar
              </button>
            </div>
            {submitStatus.assign && (
              <p
                className={`mt-2 text-sm ${
                  submitStatus.assign?.includes('Error') ? 'text-red-600' : 'text-green-600'
                }`}
              >
                {submitStatus.assign}
              </p>
            )}
          </div>
        </div>
      )}
      {submitStatus.complete && (
        <p
          className={`mt-4 text-sm ${
            submitStatus.complete?.includes('Error') ? 'text-red-600' : 'text-green-600'
          }`}
        >
          {submitStatus.complete}
        </p>
      )}
    </div>
  );
}