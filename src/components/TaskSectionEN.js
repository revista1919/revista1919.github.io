import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Papa from 'papaparse';
import ReactQuill from 'react-quill';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardList, CheckCircle2, Clock, Plus, User, Globe, Share2, X, Calendar, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import 'react-quill/dist/quill.snow.css';

// URLs de Configuración
const USERS_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv';

const TASKS_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSCEOtMwYPu0_kn1hmQi0qT6FZq6HRF09WtuDSqOxBNgMor_FyRRtc6_YVKHQQhWJCy-mIa2zwP6uAU/pub?output=csv';

const TASK_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxMo7aV_vz_3mOCUWKpcqnWmassUdApD_KfAHROTdgd_MDDiaXikgVV0OZ5qVYmhZgd/exec';

const AREAS = {
  RRSS: 'Social Media',
  WEB: 'Web Development',
};

const AREA_MAP_TO_ES = {
  'Social Media': 'Redes Sociales',
  'Web Development': 'Desarrollo Web',
};

const ROLE_MAP = {
  'Social Media': 'Encargado de Redes Sociales',
  'Web Development': 'Responsable de Desarrollo Web',
};

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } catch (e) {
    return dateStr;
  }
}

export default function ModernTaskSectionEN({ user }) {
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedArea, setSelectedArea] = useState(AREAS.RRSS);
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [taskContent, setTaskContent] = useState('');
  const [commentContent, setCommentContent] = useState('');
  const [deadline, setDeadline] = useState('');
  const [submitStatus, setSubmitStatus] = useState({ type: '', msg: '' });
  const [error, setError] = useState('');
  const [expandedComments, setExpandedComments] = useState(new Set());

  // --- Lógica de Carga y Datos ---
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [uRes, tRes] = await Promise.all([fetch(USERS_CSV_URL).then((r) => r.text()), fetch(TASKS_CSV_URL).then((r) => r.text())]);
      setUsers(Papa.parse(uRes, { header: true, skipEmptyLines: true }).data);
      setTasks(
        Papa.parse(tRes, { header: true, skipEmptyLines: true }).data.map((t, i) => ({
          ...t,
          rowIndex: i,
        }))
      );
    } catch (e) {
      console.error(e);
      setError('Error loading data');
    }
    setLoading(false);
  };

  // --- Lógica de Negocio y Permisos ---
  const currentUserData = users.find((u) => u.Nombre === user.name);
  const roles = currentUserData?.['Rol en la Revista']?.split(';').map((r) => r.trim()) || [];
  const isDirector = roles.includes('Director General');

  const filteredTasks = useMemo(() => {
    return tasks.reduce((acc, task, index) => {
      const areasConfig = [
        { 
          key: 'Redes sociales', 
          name: task.Nombre, 
          completed: task['Cumplido 1'] === 'si', 
          comment: task['Comentario 1'], 
          area: AREAS.RRSS,
          assignDate: task['Fecha Asignación 1'],
          completeDate: task['Fecha Completado 1'],
          plazo: task['Plazo 1']
        },
        { 
          key: 'Desarrollo Web', 
          name: task['Nombre.1'], 
          completed: task['Cumplido 2'] === 'si', 
          comment: task['Comentario 2'], 
          area: AREAS.WEB,
          assignDate: task['Fecha Asignación 2'],
          completeDate: task['Fecha Completado 2'],
          plazo: task['Plazo 2']
        },
      ];
      areasConfig.forEach((conf) => {
        if (task[conf.key] && (isDirector || conf.name === user.name || !conf.name)) {
          acc.push({
            id: `${index}-${conf.area}`,
            area: conf.area,
            taskText: task[conf.key],
            assignedName: conf.name || 'General Team',
            completed: conf.completed,
            comment: conf.comment,
            assignDate: conf.assignDate,
            completeDate: conf.completeDate,
            plazo: conf.plazo,
            rowIndex: index,
          });
        }
      });
      return acc;
    }, []);
  }, [tasks, user.name, isDirector]);

  const canCompleteTask = useCallback(
    (task) => {
      return !isDirector && (task.assignedName === user.name || task.assignedName === 'General Team');
    },
    [isDirector, user.name]
  );

  // --- ENVÍO DE TAREA ---
  const handleAssignTask = async () => {
    if (!taskContent.trim()) {
      setSubmitStatus({ type: 'error', msg: 'The task cannot be empty' });
      return;
    }
    setSubmitStatus({ type: 'info', msg: 'Processing assignment...' });
    const encodedTask = btoa(unescape(encodeURIComponent(taskContent)));
    const payload = {
      action: 'assign',
      area: AREA_MAP_TO_ES[selectedArea],
      task: encodedTask,
      assignedTo: selectedAssignee,
      plazo: deadline,
      lang: 'en'
    };
    try {
      await fetch(TASK_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(payload),
      });
      setSubmitStatus({ type: 'success', msg: 'Task assigned.' });
      setTimeout(() => {
        setShowAssignModal(false);
        setTaskContent('');
        setSelectedAssignee('');
        setDeadline('');
        loadData();
        setSubmitStatus({ type: '', msg: '' });
      }, 2000);
    } catch (e) {
      setSubmitStatus({ type: 'error', msg: 'Connection error: ' + e.message });
    }
  };

  // --- COMPLETAR TAREA ---
  const handleCompleteTask = async () => {
    if (!commentContent.trim()) {
      setSubmitStatus({ type: 'error', msg: 'The comment cannot be empty' });
      return;
    }
    setSubmitStatus({ type: 'info', msg: 'Processing completion...' });
    const encodedComment = btoa(unescape(encodeURIComponent(commentContent)));
    const payload = {
      action: 'complete',
      area: AREA_MAP_TO_ES[selectedTask.area],
      row: selectedTask.rowIndex + 2,
      comment: encodedComment,
      lang: 'en'
    };
    try {
      await fetch(TASK_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(payload),
      });
      setSubmitStatus({ type: 'success', msg: 'Task completed.' });
      setTimeout(() => {
        setShowCompleteModal(false);
        setCommentContent('');
        setSelectedTask(null);
        loadData();
        setSubmitStatus({ type: '', msg: '' });
      }, 2000);
    } catch (e) {
      setSubmitStatus({ type: 'error', msg: 'Connection error: ' + e.message });
    }
  };

  const decodeBody = (encoded) => {
    if (!encoded) return '';
    try {
      return decodeURIComponent(escape(atob(encoded)));
    } catch (e) {
      return encoded;
    }
  };

  const quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link'],
      ['clean'],
    ],
  };

  const toggleExpandComment = (taskId) => {
    const newSet = new Set(expandedComments);
    if (newSet.has(taskId)) {
      newSet.delete(taskId);
    } else {
      newSet.add(taskId);
    }
    setExpandedComments(newSet);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="w-10 h-10 border-2 border-slate-200 border-t-[#007398] rounded-full mb-4" />
        <span className="text-[10px] font-bold tracking-[0.3em] text-slate-400 uppercase">Synchronizing Workspace</span>
      </div>
    );
  }

  if (error) return <div className="text-red-600 text-center p-4">{error}</div>;

  return (
    <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 font-sans text-slate-900 antialiased">
      {/* Header Estilo Dashboard */}
      <header className="relative mb-16 flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-slate-100 pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-sky-50 text-sky-600 rounded-lg">
              <ClipboardList size={20} />
            </div>
            <span className="text-[10px] font-bold tracking-[.2em] text-[#007398] uppercase italic">Editorial Management</span>
          </div>
          <h2 className="text-4xl font-serif font-medium text-slate-800 tracking-tight">Task Panel</h2>
        </div>
        {isDirector && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowAssignModal(true)}
            className="flex items-center gap-3 bg-[#007398] text-white px-8 py-4 rounded-2xl text-[12px] font-bold uppercase tracking-widest hover:bg-[#005a77] transition-all shadow-2xl shadow-slate-200"
          >
            <Plus size={16} /> New Task
          </motion.button>
        )}
      </header>

      {/* Tabs Estilo "Pill" */}
      <div className="flex gap-4 mb-12 p-1 bg-slate-100/50 w-fit rounded-2xl border border-slate-100">
        {[
          { id: 'pending', label: 'Pending', icon: Clock, count: filteredTasks.filter((t) => !t.completed).length },
          { id: 'completed', label: 'Completed', icon: CheckCircle2, count: filteredTasks.filter((t) => t.completed).length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-3 px-6 py-3 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all ${
              activeTab === tab.id ? 'bg-white text-[#007398] shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
            <span className={`ml-2 px-2 py-0.5 rounded-md text-[9px] ${activeTab === tab.id ? 'bg-sky-50 text-[#007398]' : 'bg-slate-200 text-slate-500'}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Grid de Tareas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <AnimatePresence mode="popLayout">
          {filteredTasks
            .filter((t) => (activeTab === 'pending' ? !t.completed : t.completed))
            .map((task) => {
              const isExpanded = expandedComments.has(task.id);
              return (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="group relative bg-white border border-slate-100 p-8 hover:border-[#007398]/20 transition-all rounded-[32px] shadow-sm hover:shadow-xl hover:shadow-[#007398]/5 flex flex-col min-h-[400px]"
                >
                  {/* Status Dot */}
                  <div className="absolute top-8 right-8">
                    {!task.completed ? (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#007398] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#007398]"></span>
                      </span>
                    ) : (
                      <CheckCircle2 size={16} className="text-green-500" />
                    )}
                  </div>
                  <div className="mb-6">
                    <span
                      className={`text-[9px] font-black uppercase tracking-[.2em] px-3 py-1.5 rounded-lg inline-block mb-4 ${
                        task.area === AREAS.RRSS ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                      }`}
                    >
                      {task.area}
                    </span>
                    <div className="font-serif text-lg leading-snug text-slate-700 group-hover:text-slate-900 transition-colors line-clamp-4 overflow-hidden">
                      <div dangerouslySetInnerHTML={{ __html: decodeBody(task.taskText) }} />
                    </div>
                  </div>
                  {/* Sección de Fechas */}
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-medium flex items-center gap-1.5">
                        <Calendar size={12} /> Assigned:
                      </span>
                      <span className="font-bold text-slate-700">{formatDate(task.assignDate)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-medium flex items-center gap-1.5">
                        <Calendar size={12} /> Deadline:
                      </span>
                      <span className={`font-bold ${!task.completed ? 'text-rose-500' : 'text-slate-400'}`}>{formatDate(task.plazo)}</span>
                    </div>
                    {task.completed && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-medium flex items-center gap-1.5">
                          <Calendar size={12} /> Completed:
                        </span>
                        <span className="font-bold text-green-600">{formatDate(task.completeDate)}</span>
                      </div>
                    )}
                  </div>
                  {task.completed && task.comment && (
                    <div className="mt-auto pt-6 border-t border-slate-50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">Comment:</span>
                        <button
                          onClick={() => toggleExpandComment(task.id)}
                          className="text-[10px] text-[#007398] hover:underline flex items-center gap-1"
                        >
                          {isExpanded ? 'See less' : 'Expand'} {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      </div>
                      <div
                        className={`bg-slate-50 p-4 rounded-2xl italic text-xs text-slate-500 font-serif overflow-hidden ${
                          isExpanded ? '' : 'line-clamp-3'
                        }`}
                        dangerouslySetInnerHTML={{ __html: decodeBody(task.comment) }}
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-4 mt-auto">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#007398] flex items-center justify-center text-[10px] text-white font-bold">
                        {task.assignedName.charAt(0)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 uppercase tracking-tighter font-bold">Assigned to</span>
                        <span className="text-[11px] font-bold text-slate-700">{task.assignedName}</span>
                      </div>
                    </div>
                    {!task.completed && canCompleteTask(task) && (
                      <button
                        onClick={() => {
                          setSelectedTask(task);
                          setCommentContent('');
                          setShowCompleteModal(true);
                        }}
                        className="p-2 bg-sky-50 text-[#007398] rounded-xl hover:bg-[#007398] hover:text-white transition-all"
                      >
                        <ChevronDown size={18} className="rotate-[-90deg]" />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
        </AnimatePresence>
      </div>

      {/* Modal de Asignación */}
      <AnimatePresence>
        {showAssignModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 backdrop-blur-xl bg-slate-900/20"
          >
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="bg-white w-full max-w-3xl rounded-[40px] p-8 sm:p-12 shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <button
                className="absolute top-4 right-4 sm:top-8 sm:right-8 p-2 hover:bg-slate-100 rounded-full transition-all"
                onClick={() => setShowAssignModal(false)}
              >
                <X size={20} />
              </button>
              <h3 className="text-2xl sm:text-3xl font-serif mb-8 text-slate-800">Assign New Task</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Area</label>
                  <select
                    value={selectedArea}
                    onChange={(e) => setSelectedArea(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 ring-[#007398]/20 outline-none"
                  >
                    <option value={AREAS.RRSS}>{AREAS.RRSS}</option>
                    <option value={AREAS.WEB}>{AREAS.WEB}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Assigned to</label>
                  <select
                    value={selectedAssignee}
                    onChange={(e) => setSelectedAssignee(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 ring-[#007398]/20 outline-none"
                  >
                    <option value="">General Team</option>
                    {users
                      .filter((u) =>
                        u['Rol en la Revista']?.includes(ROLE_MAP[selectedArea])
                      )
                      .map((u) => (
                        <option key={u.Nombre} value={u.Nombre}>
                          {u.Nombre}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Deadline (optional)</label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 ring-[#007398]/20 outline-none"
                  />
                </div>
              </div>
              <div className="mb-10">
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 mb-3">Description</label>
                <div className="rounded-3xl overflow-hidden border border-slate-100">
                  <ReactQuill
                    theme="snow"
                    value={taskContent}
                    onChange={setTaskContent}
                    modules={quillModules}
                    className="h-40 sm:h-48 font-serif text-sm"
                    placeholder="Describe the task in detail..."
                  />
                </div>
              </div>
              <div className="flex items-center justify-between mt-8 sm:mt-12">
                <span
                  className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 ${
                    submitStatus.type === 'error' ? 'text-red-500' : submitStatus.type === 'success' ? 'text-green-500' : 'text-gray-400'
                  }`}
                >
                  {submitStatus.msg && <AlertCircle size={14} />}
                  {submitStatus.msg}
                </span>
                <div className="flex gap-4">
                  <button
                    onClick={() => setShowAssignModal(false)}
                    className="px-6 sm:px-8 py-3 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAssignTask}
                    disabled={!taskContent.trim()}
                    className="bg-[#007398] text-white px-8 sm:px-10 py-3 sm:py-4 rounded-2xl text-[11px] font-black uppercase tracking-[.2em] shadow-xl shadow-slate-200 hover:bg-[#005a77] transition-all disabled:opacity-50"
                  >
                    Assign
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Completado */}
      <AnimatePresence>
        {showCompleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 backdrop-blur-xl bg-slate-900/20"
          >
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="bg-white w-full max-w-3xl rounded-[40px] p-8 sm:p-12 shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <button
                className="absolute top-4 right-4 sm:top-8 sm:right-8 p-2 hover:bg-slate-100 rounded-full transition-all"
                onClick={() => setShowCompleteModal(false)}
              >
                <X size={20} />
              </button>
              <h3 className="text-2xl sm:text-3xl font-serif mb-8 text-slate-800">Complete Task: {selectedTask?.area}</h3>
              <div className="mb-4 font-serif text-sm text-slate-700">
                <span className="block text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-2">Description</span>
                <div dangerouslySetInnerHTML={{ __html: decodeBody(selectedTask?.taskText) }} />
              </div>
              <div className="mb-10">
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 mb-3">Comment</label>
                <div className="rounded-3xl overflow-hidden border border-slate-100">
                  <ReactQuill
                    theme="snow"
                    value={commentContent}
                    onChange={setCommentContent}
                    modules={quillModules}
                    className="h-40 sm:h-48 font-serif text-sm"
                    placeholder="Describe what was done..."
                  />
                </div>
              </div>
              <div className="flex items-center justify-between mt-8 sm:mt-12">
                <span
                  className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 ${
                    submitStatus.type === 'error' ? 'text-red-500' : submitStatus.type === 'success' ? 'text-green-500' : 'text-gray-400'
                  }`}
                >
                  {submitStatus.msg && <AlertCircle size={14} />}
                  {submitStatus.msg}
                </span>
                <div className="flex gap-4">
                  <button
                    onClick={() => setShowCompleteModal(false)}
                    className="px-6 sm:px-8 py-3 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCompleteTask}
                    disabled={!commentContent.trim()}
                    className="bg-[#007398] text-white px-8 sm:px-10 py-3 sm:py-4 rounded-2xl text-[11px] font-black uppercase tracking-[.2em] shadow-xl shadow-slate-200 hover:bg-[#005a77] transition-all disabled:opacity-50"
                  >
                    Complete
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .ql-container.ql-snow { border: none !important; font-family: 'Georgia', serif; font-size: 16px; }
        .ql-toolbar.ql-snow { border: none !important; background: #f8fafc; border-bottom: 1px solid #f1f5f9 !important; padding: 12px !important; }
        .ql-editor.ql-blank::before { color: #cbd5e1 !important; font-style: normal !important; }
      `}</style>
    </div>
  );
}