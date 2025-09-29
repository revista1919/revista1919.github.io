import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Papa from 'papaparse';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import ImageResize from 'quill-image-resize-module-react';
import { debounce } from 'lodash';
Quill.register('modules/imageResize', ImageResize);

// For local CSV files, assume they are imported or embedded
// Replace these with actual CSV content or file paths in your project
const USERS_CSV = `Name,Role in the Magazine
John Doe,General Director;Social Media Manager
Jane Smith,Web Development Manager
...`; // Add your CSV content here

const TASKS_CSV = `Social Media,Name,Completed 1,Comment 1,Web Development,Name.1,Completed 2,Comment 2
Task 1,John Doe,yes,Comment 1,Task 2,Jane Smith,no,Comment 2
...`; // Add your CSV content here

const TASK_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxMo7aV_vz_3mOCUWKpcqnWmassUdApD_KfAHROTdgd_MDDiaXikgVV0OZ5qVYmhZgd/exec';
const AREAS = {
  SM: 'Social Media',
  WD: 'Web Development',
};

const getAreaColumns = (area) => {
  if (area === AREAS.SM) {
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
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
};

const sanitizeInput = (input) => {
  if (!input) return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
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
  const [selectedArea, setSelectedArea] = useState(AREAS.SM);
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
          'Cache-Control': 'no-cache',
        },
        signal: controller.signal,
        keepalive: true,
      });
      clearTimeout(timeoutId);
      // Note: With 'no-cors', response body can't be read, so we assume success
      return { ok: true };
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

  const parseUsers = () => {
    try {
      const parsed = Papa.parse(USERS_CSV, { header: true, skipEmptyLines: true }).data;
      setUsers(parsed);
    } catch (err) {
      console.error('Error parsing users:', err);
      setError('Error loading users: ' + err.message);
    }
  };

  const parseTasks = () => {
    try {
      const parsed = Papa.parse(TASKS_CSV, { header: true, skipEmptyLines: true }).data.map(
        (row, index) => ({
          ...row,
          rowIndex: index,
        })
      );
      setTasks(parsed);
    } catch (err) {
      console.error('Error parsing tasks:', err);
      setError('Error loading tasks: ' + err.message);
    }
  };

  useEffect(() => {
    Promise.all([parseUsers(), parseTasks()])
      .then(() => setLoading(false))
      .catch((err) => {
        console.error('Error in initial parse:', err);
        setError('Error initializing: ' + err.message);
      });
  }, []);

  useEffect(() => {
    const setupEditor = (editor, spellcheck = true) => {
      if (editor && editor.root) {
        editor.root.setAttribute('spellcheck', spellcheck ? 'true' : 'false');
        editor.root.setAttribute('lang', 'en');
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

    Object.values(commentEditorsRef.current).forEach((editor) => {
      if (editor) {
        setupEditor(editor);
      }
    });
  }, [commentContent]);

  const currentUser = users.find((u) => u.Name === user.name);
  const userRoles = currentUser
    ? currentUser['Role in the Magazine']?.split(';').map((r) => r.trim())
    : [];
  const isDirector = userRoles.includes('General Director');
  const isSM = userRoles.includes('Social Media Manager');
  const isWD = userRoles.includes('Web Development Manager');
  const isAssignee = (isSM || isWD) && !isDirector;
  const smUsers = users.filter((u) =>
    u['Role in the Magazine']?.includes('Social Media Manager')
  );
  const wdUsers = users.filter((u) =>
    u['Role in the Magazine']?.includes('Web Development Manager')
  );

  const filteredTasks = useMemo(() => {
    return tasks.reduce((areaTasks, task, index) => {
      if (!isDirector && !isAssignee) return areaTasks;
      if (isSM || isDirector) {
        const taskText = task['Social Media'];
        const assignedName = task.Name || '';
        const completed = task['Completed 1'] === 'yes';
        if (taskText && (!assignedName || assignedName === user.name || isDirector)) {
          areaTasks.push({
            ...task,
            area: AREAS.SM,
            taskText,
            assignedName,
            completed,
            comment: task['Comment 1'],
            rowIndex: index,
          });
        }
      }
      if (isWD || isDirector) {
        const taskText = task['Web Development'];
        const assignedName = task['Name.1'] || '';
        const completed = task['Completed 2'] === 'yes';
        if (taskText && (!assignedName || assignedName === user.name || isDirector)) {
          areaTasks.push({
            ...task,
            area: AREAS.WD,
            taskText,
            assignedName,
            completed,
            comment: task['Comment 2'],
            rowIndex: index,
          });
        }
      }
      return areaTasks;
    }, []);
  }, [tasks, user.name, isDirector, isSM, isWD]);

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
              body: JSON.stringify({
                action: 'upload_image',
                data: base64,
                mime: mime,
                name: name,
              }),
            });
            // With no-cors, we can't read response body, so assume success
            resolve('https://placeholder-image-url.com'); // Replace with actual URL logic if needed
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

  const encodeBody = useCallback(
    (html, editorRef = null) => {
      try {
        if (!html || html.trim() === '') return '';

        let cleanedHtml = sanitizeInput(html);

        if (cleanedHtml.includes('<img')) {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = cleanedHtml;
          const images = tempDiv.querySelectorAll('img');

          if (images.length > 0) {
            console.log(`Processing ${images.length} images...`);
            images.forEach((img, index) => {
              try {
                let style = `max-width:100%;height:auto;border-radius:4px;display:block;margin:8px auto;`;
                style += 'max-width:100% !important;box-sizing:border-box !important;';
                img.setAttribute('style', style);
                img.setAttribute('loading', 'lazy');
                img.setAttribute('alt', `Image ${index + 1} of the task`);
              } catch (imgError) {
                console.warn(`Error processing image ${index}:`, imgError);
              }
            });
            cleanedHtml = tempDiv.innerHTML;
          }
        }

        const encoded = base64EncodeUnicode(cleanedHtml);
        console.log(`Encoded content: ${encoded.length} characters`);
        return encoded;
      } catch (err) {
        console.error('Error encoding body:', err);
        try {
          const uriEncoded = encodeURIComponent(html);
          return btoa(uriEncoded);
        } catch (fallbackErr) {
          console.error('Error in fallback encoding:', fallbackErr);
          return base64EncodeUnicode(html);
        }
      }
    },
    []
  );

  const decodeBody = useCallback((body) => {
    if (!body) return <p className="text-gray-600">No content.</p>;
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

      const sanitized = decoded
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+="[^"]*"/gi, '');

      return (
        <div
          className="ql-editor prose max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitized }}
          style={{ lineHeight: '1.6', fontSize: '14px', color: '#374151' }}
        />
      );
    } catch (err) {
      console.error('Error decoding body:', err);
      return <p className="text-red-600">Error displaying content: {err.message}</p>;
    }
  }, []);

  const handleAssignTask = async () => {
    if (!taskContent.trim()) {
      setSubmitStatus({ assign: 'The task cannot be empty' });
      return;
    }

    setSubmitStatus({ assign: 'Sending...' });

    const encodedTask = encodeBody(taskContent, taskEditorRef);
    if (!encodedTask || encodedTask.length === 0) {
      setSubmitStatus({ assign: 'Error: Could not process the task content' });
      return;
    }

    const data = {
      action: 'assign',
      area: selectedArea,
      task: encodedTask,
      assignedTo: selectedAssignee || '',
    };

    try {
      await fetchWithRetry(TASK_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(data),
      });

      setSubmitStatus({ assign: 'Task assigned successfully! 🎉' });
      setShowAssignModal(false);
      setTaskContent('');
      setSelectedAssignee('');
      setTimeout(() => parseTasks(), 1000);
    } catch (err) {
      console.error('Error assigning task:', err);
      setSubmitStatus({ assign: `Error assigning task: ${err.message}` });
    }
  };

  const handleCompleteTask = async (task) => {
    const comment = commentContent[task.rowIndex] || '';
    if (!comment.trim()) {
      setSubmitStatus({ complete: 'The comment cannot be empty' });
      return;
    }

    setSubmitStatus({ complete: 'Sending...' });

    const commentEditor = commentEditorsRef.current[task.rowIndex];
    const encodedComment = encodeBody(comment, commentEditor);
    if (!encodedComment || encodedComment.length === 0) {
      setSubmitStatus({ complete: 'Error: Could not process the comment' });
      return;
    }

    const data = {
      action: 'complete',
      area: task.area,
      row: task.rowIndex + 2,
      comment: encodedComment,
    };

    try {
      await fetchWithRetry(TASK_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(data),
      });

      setSubmitStatus({ complete: 'Task completed successfully! 🎉' });
      setCommentContent((prev) => ({ ...prev, [task.rowIndex]: '' }));
      setTimeout(() => parseTasks(), 1000);
    } catch (err) {
      console.error('Error completing task:', err);
      setSubmitStatus({ complete: `Error completing task: ${err.message}` });
    }
  };

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

  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
          ['bold', 'italic', 'underline', 'strike', 'blockquote'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['link', 'image'],
          [{ align: ['', 'center', 'right', 'justify'] }],
          [{ size: ['small', false, 'large'] }],
          ['clean'],
        ],
        handlers: {
          link: function (value) {
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
          image: function () {
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
          },
        },
      },
      imageResize: {
        parchment: Quill.import('parchment'),
        modules: ['Resize', 'DisplaySize', 'Toolbar'],
        handleStyles: {
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          border: 'none',
          color: 'white',
          cursor: 'move',
        },
        displayStyles: {
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          border: 'none',
          color: 'white',
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
        },
      },
      clipboard: {
        matchVisual: false,
      },
    }),
    []
  );

  const formats = [
    'header',
    'font',
    'size',
    'bold',
    'italic',
    'underline',
    'strike',
    'blockquote',
    'list',
    'bullet',
    'indent',
    'link',
    'image',
    'color',
    'background',
    'align',
  ];

  const canCompleteTask = (task) => {
    if (isDirector) return false;
    if (!isAssignee) return false;
    return task.assignedName === user.name || task.assignedName === '';
  };

  const TaskQuillEditor = React.forwardRef(
    ({ value, onChange, placeholder, className }, ref) => {
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
    }
  );

  TaskQuillEditor.displayName = 'TaskQuillEditor';

  const CommentQuillEditor = React.forwardRef(
    ({ value, onChange, rowIndex, placeholder, className }, ref) => {
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
    }
  );

  CommentQuillEditor.displayName = 'CommentQuillEditor';

  if (loading) return <div className="text-center p-4 text-gray-600">Loading tasks...</div>;
  if (error) return <div className="text-red-600 text-center p-4">{error}</div>;
  if (!isDirector && !isAssignee) return null;

  return (
    <div className="pt-4 space-y-6">
      {isDirector && (
        <button
          onClick={() => setShowAssignModal(true)}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
          aria-label="Assign new task"
        >
          Assign New Task
        </button>
      )}

      <div className="flex space-x-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('pending')}
          className={`pb-2 px-4 text-sm font-medium transition-colors ${
            activeTab === 'pending'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-blue-600'
          }`}
          aria-label="View pending tasks"
        >
          Pending ({pendingTasks.length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`pb-2 px-4 text-sm font-medium transition-colors ${
            activeTab === 'completed'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-blue-600'
          }`}
          aria-label="View completed tasks"
        >
          Completed ({completedTasks.length})
        </button>
      </div>

      <div className="grid gap-6">
        {(activeTab === 'pending' ? pendingTasks : completedTasks).map((task) => (
          <div
            key={`${task.area}-${task.rowIndex}`}
            className="bg-white p-4 sm:p-6 rounded-lg shadow-md border border-gray-200 w-full overflow-hidden box-border"
          >
            <h3 className="font-bold text-lg text-gray-800 mb-2">
              {task.area} - {task.assignedName || 'All'}
            </h3>
            <div className="text-gray-600 mb-4 prose max-w-none">
              {decodeBody(task.taskText)}
            </div>

            {task.completed && (
              <div className="mt-2 text-green-600 bg-green-50 p-3 rounded-md">
                <span className="font-medium">Completed:</span>{' '}
                <div className="mt-2 prose max-w-none">{decodeBody(task.comment)}</div>
              </div>
            )}

            {!task.completed && canCompleteTask(task) && (
              <div className="mt-4 space-y-4 w-full">
                <div className="min-h-[8rem] border rounded-md overflow-hidden w-full">
                  <CommentQuillEditor
                    value={commentContent[task.rowIndex] || ''}
                    onChange={(rowIndex, content) => {
                      debouncedHandleCommentChange(rowIndex, content);
                    }}
                    rowIndex={task.rowIndex}
                    placeholder="Comment on what was done... (for images, use the image button to avoid size issues)"
                    className="h-[200px] text-gray-800 bg-white"
                  />
                </div>
                <button
                  onClick={() => handleCompleteTask(task)}
                  className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 text-sm font-medium disabled:opacity-50"
                  disabled={!commentContent[task.rowIndex]?.trim()}
                  aria-label="Mark task as completed"
                >
                  Mark Completed
                </button>
              </div>
            )}
          </div>
        ))}

        {(activeTab === 'pending' ? pendingTasks : completedTasks).length === 0 && (
          <div className="text-center text-gray-600 py-8">
            No {activeTab === 'pending' ? 'pending' : 'completed'} tasks.
          </div>
        )}
      </div>

      {showAssignModal && isDirector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col relative modal-content">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
              <h3 className="font-bold text-lg text-gray-800 mb-2">Assign New Task</h3>
              <p className="text-sm text-gray-600">Describe the task and select the assignee</p>
            </div>

            <div className="flex-grow overflow-y-auto p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <select
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value)}
                  className="p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  aria-label="Select task area"
                >
                  <option value={AREAS.SM}>{AREAS.SM}</option>
                  <option value={AREAS.WD}>{AREAS.WD}</option>
                </select>

                <select
                  value={selectedAssignee}
                  onChange={(e) => setSelectedAssignee(e.target.value)}
                  className="p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  aria-label="Select assignee"
                >
                  <option value="">All {selectedArea === AREAS.SM ? 'SM' : 'WD'}</option>
                  {(selectedArea === AREAS.SM ? smUsers : wdUsers).map((u) => (
                    <option key={u.Name} value={u.Name}>
                      {u.Name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-h-[12rem] border border-gray-300 rounded-md overflow-hidden w-full">
                <TaskQuillEditor
                  value={taskContent}
                  onChange={debouncedSetTaskContent}
                  placeholder="Describe the task in detail... (for images, use the image button to avoid size issues)"
                  className="h-[250px]"
                  ref={taskEditorRef}
                />
              </div>

              <div className="text-xs text-gray-500">
                💡 You can use <strong>rich formatting</strong>, add <strong>images</strong> and{' '}
                <strong>links</strong>. The content will be saved automatically in Google Sheets.
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
                aria-label="Cancel task assignment"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignTask}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!taskContent.trim()}
                aria-label="Assign task"
              >
                {submitStatus.assign === 'Sending...' ? 'Sending...' : 'Assign Task'}
              </button>
            </div>

            {submitStatus.assign && (
              <div className="px-4 pb-4">
                <p
                  className={`text-sm ${
                    submitStatus.assign?.includes('Error')
                      ? 'text-red-600'
                      : submitStatus.assign?.includes('success')
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
        <div
          className={`mt-4 p-3 rounded-md border ${
            submitStatus.complete?.includes('Error')
              ? 'border-red-300 bg-red-50 text-red-700'
              : 'border-green-300 bg-green-50 text-green-700'
          }`}
        >
          <p className="text-sm">{submitStatus.complete}</p>
        </div>
      )}
    </div>
  );
}