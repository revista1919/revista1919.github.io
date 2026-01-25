import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Papa from 'papaparse';
import ReactQuill from 'react-quill';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList, CheckCircle2, Clock, Plus, User,
  Globe, Share2, X, Calendar, Layout, ChevronRight, AlertCircle
} from 'lucide-react';
import 'react-quill/dist/quill.snow.css';

// URLs
const USERS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv';
const TASKS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSCEOtMwYPu0_kn1hmQi0qT6FZq6HRF09WtuDSqOxBNgMor_FyRRtc6_YVKHQQhWJCy-mIa2zwP6uAU/pub?output=csv';
const TASK_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxMo7aV_vz_3mOCUWKpcqnWmassUdApD_KfAHROTdgd_MDDiaXikgVV0OZ5qVYmhZgd/exec';

const AREAS = {
  RRSS: 'Redes Sociales',
  WEB: 'Desarrollo Web',
};

function formatDate(dateStr) {
  if (!dateStr) return 'Sin plazo';
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return dateStr;
  }
}

export default function ModernTaskSection({ user }) {
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

  // Load Data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [uRes, tRes] = await Promise.all([
        fetch(USERS_CSV_URL).then(r => r.text()),
        fetch(TASKS_CSV_URL).then(r => r.text())
      ]);
      setUsers(Papa.parse(uRes, { header: true, skipEmptyLines: true }).data);
      setTasks(
        Papa.parse(tRes, { header: true, skipEmptyLines: true }).data.map((t, i) => ({
          ...t,
          rowIndex: i,
        }))
      );
    } catch (e) {
      console.error(e);
      setError('Error al cargar datos');
    }
    setLoading(false);
  };

  // Business Logic
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
            assignedName: conf.name || 'Equipo General',
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

  const canCompleteTask = useCallback((task) => {
    return !isDirector && (task.assignedName === user.name || task.assignedName === 'Equipo General');
  }, [isDirector, user.name]);

  const decodeBody = (encoded) => {
    if (!encoded) return '';
    try {
      return decodeURIComponent(escape(atob(encoded)));
    } catch (e) {
      return encoded;
    }
  };

  // Handle Assign Task
  const handleAssignTask = async () => {
    if (!taskContent.trim()) {
      setSubmitStatus({ type: 'error', msg: 'La tarea no puede estar vacía' });
      return;
    }
    setSubmitStatus({ type: 'info', msg: 'Asignando tarea...' });

    const encodedTask = btoa(unescape(encodeURIComponent(taskContent)));
    const payload = {
      action: 'assign',
      area: selectedArea,
      task: encodedTask,
      assignedTo: selectedAssignee,
      plazo: deadline,
    };

    try {
      await fetch(TASK_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(payload),
      });

      setSubmitStatus({ type: 'success', msg: '¡Tarea asignada correctamente!' });
      setTimeout(() => {
        setShowAssignModal(false);
        setTaskContent('');
        setSelectedAssignee('');
        setDeadline('');
        loadData();
        setSubmitStatus({ type: '', msg: '' });
      }, 1800);
    } catch (e) {
      setSubmitStatus({ type: 'error', msg: 'Error al asignar tarea' });
    }
  };

  // Handle Complete Task
  const handleCompleteTask = async () => {
    if (!commentContent.trim()) {
      setSubmitStatus({ type: 'error', msg: 'El comentario es obligatorio' });
      return;
    }
    setSubmitStatus({ type: 'info', msg: 'Completando tarea...' });

    const encodedComment = btoa(unescape(encodeURIComponent(commentContent)));
    const payload = {
      action: 'complete',
      area: selectedTask.area,
      row: selectedTask.rowIndex + 2,
      comment: encodedComment,
    };

    try {
      await fetch(TASK_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(payload),
      });

      setSubmitStatus({ type: 'success', msg: '¡Tarea completada!' });
      setTimeout(() => {
        setShowCompleteModal(false);
        setCommentContent('');
        setSelectedTask(null);
        loadData();
        setSubmitStatus({ type: '', msg: '' });
      }, 1800);
    } catch (e) {
      setSubmitStatus({ type: 'error', msg: 'Error al completar tarea' });
    }
  };

  const quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link'],
      ['clean'],
    ],
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-slate-200 border-t-sky-600 rounded-full"
        />
        <p className="mt-6 text-xs font-bold tracking-[0.4em] text-slate-400">CARGANDO TAREAS</p>
      </div>
    );
  }

  if (error) return <div className="text-red-500 text-center py-10">{error}</div>;

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 font-sans">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between mb-14 gap-8">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-sky-100 text-sky-600 p-3 rounded-2xl">
              <Layout size={24} />
            </div>
            <div>
              <p className="text-sky-600 text-xs font-bold tracking-widest">EDITORIAL WORKSPACE</p>
              <h1 className="text-4xl font-serif text-slate-800 font-medium tracking-tight">Panel de Tareas</h1>
            </div>
          </div>
        </div>

        {isDirector && (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowAssignModal(true)}
            className="flex items-center gap-3 bg-slate-900 hover:bg-sky-700 text-white px-8 py-4 rounded-3xl text-sm font-bold uppercase tracking-widest transition-all shadow-xl"
          >
            <Plus size={18} />
            Nueva Tarea
          </motion.button>
        )}
      </header>

      {/* Modern Tabs */}
      <div className="flex gap-3 mb-12 bg-slate-100/70 w-fit p-1.5 rounded-3xl border border-slate-200">
        {[
          { id: 'pending', label: 'Pendientes', icon: Clock, count: filteredTasks.filter(t => !t.completed).length },
          { id: 'completed', label: 'Completadas', icon: CheckCircle2, count: filteredTasks.filter(t => t.completed).length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-3 px-7 py-3.5 rounded-2xl text-sm font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-white shadow text-sky-700'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
            <span className="px-3 py-0.5 text-xs rounded-full bg-slate-200 text-slate-600 font-medium">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Task Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <AnimatePresence mode="popLayout">
          {filteredTasks
            .filter((t) => (activeTab === 'pending' ? !t.completed : t.completed))
            .map((task) => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border border-slate-100 rounded-3xl p-8 hover:shadow-xl hover:border-sky-200 transition-all group flex flex-col min-h-[420px]"
              >
                {/* Area Badge */}
                <div className="flex justify-between items-start mb-6">
                  <span className={`text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full ${
                    task.area === AREAS.RRSS 
                      ? 'bg-indigo-50 text-indigo-700' 
                      : 'bg-fuchsia-50 text-fuchsia-700'
                  }`}>
                    {task.area}
                  </span>
                  {task.completed ? (
                    <CheckCircle2 className="text-emerald-500" size={24} />
                  ) : (
                    <div className="relative">
                      <div className="absolute w-3 h-3 bg-sky-400 rounded-full animate-ping"></div>
                      <div className="w-3 h-3 bg-sky-500 rounded-full"></div>
                    </div>
                  )}
                </div>

                {/* Task Content */}
                <div className="font-serif text-[15px] leading-relaxed text-slate-700 mb-8 line-clamp-5">
                  <div dangerouslySetInnerHTML={{ __html: decodeBody(task.taskText) }} />
                </div>

                {/* Footer Info */}
                <div className="mt-auto pt-6 border-t border-slate-100">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400 font-medium">Plazo</span>
                    <span className="font-semibold text-slate-700">{formatDate(task.plazo)}</span>
                  </div>

                  <div className="mt-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-slate-800 rounded-2xl flex items-center justify-center text-white text-sm font-bold">
                        {task.assignedName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-medium">ASIGNADO A</p>
                        <p className="font-semibold text-slate-700">{task.assignedName}</p>
                      </div>
                    </div>

                    {!task.completed && canCompleteTask(task) && (
                      <button
                        onClick={() => {
                          setSelectedTask(task);
                          setCommentContent('');
                          setShowCompleteModal(true);
                        }}
                        className="bg-sky-50 hover:bg-sky-600 hover:text-white p-3 rounded-2xl transition-all"
                      >
                        <ChevronRight size={20} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
        </AnimatePresence>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {/* Assign Modal */}
        {showAssignModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-lg"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl p-10 relative"
            >
              <button
                onClick={() => setShowAssignModal(false)}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>

              <h3 className="text-3xl font-serif mb-8">Nueva Tarea</h3>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-9">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2">ÁREA</label>
                  <select value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)} className="w-full px-5 py-3.5 bg-slate-50 rounded-2xl focus:ring-2 ring-sky-500 outline-none">
                    <option value={AREAS.RRSS}>{AREAS.RRSS}</option>
                    <option value={AREAS.WEB}>{AREAS.WEB}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2">ASIGNAR A</label>
                  <select value={selectedAssignee} onChange={(e) => setSelectedAssignee(e.target.value)} className="w-full px-5 py-3.5 bg-slate-50 rounded-2xl focus:ring-2 ring-sky-500 outline-none">
                    <option value="">Equipo General</option>
                    {users
                      .filter(u => u['Rol en la Revista']?.includes(selectedArea === AREAS.RRSS ? 'Redes Sociales' : 'Desarrollo Web'))
                      .map(u => (
                        <option key={u.Nombre} value={u.Nombre}>{u.Nombre}</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2">PLAZO</label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-5 py-3.5 bg-slate-50 rounded-2xl focus:ring-2 ring-sky-500 outline-none"
                  />
                </div>
              </div>

              <div className="mb-10">
                <label className="block text-xs font-bold text-slate-500 mb-2">DESCRIPCIÓN</label>
                <div className="border border-slate-200 rounded-3xl overflow-hidden">
                  <ReactQuill
                    theme="snow"
                    value={taskContent}
                    onChange={setTaskContent}
                    modules={quillModules}
                    className="min-h-[160px]"
                    placeholder="Describe la tarea..."
                  />
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div className={`text-sm font-medium ${submitStatus.type === 'error' ? 'text-red-500' : 'text-emerald-600'}`}>
                  {submitStatus.msg}
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setShowAssignModal(false)} className="px-8 py-3 text-slate-500 font-medium">
                    Cancelar
                  </button>
                  <button
                    onClick={handleAssignTask}
                    disabled={!taskContent.trim()}
                    className="bg-slate-900 hover:bg-sky-700 disabled:bg-slate-400 text-white px-10 py-3.5 rounded-2xl font-semibold transition-all"
                  >
                    Asignar Tarea
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Complete Modal */}
        {showCompleteModal && selectedTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-lg"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl p-10 relative"
            >
              <button onClick={() => setShowCompleteModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>

              <h3 className="text-2xl font-serif mb-2">Completar Tarea</h3>
              <p className="text-sky-600 mb-6">{selectedTask.area}</p>

              <div className="mb-8">
                <label className="text-xs font-bold text-slate-500 mb-2 block">TAREA ORIGINAL</label>
                <div className="bg-slate-50 p-5 rounded-2xl text-slate-700" dangerouslySetInnerHTML={{ __html: decodeBody(selectedTask.taskText) }} />
              </div>

              <div className="mb-8">
                <label className="block text-xs font-bold text-slate-500 mb-2">TU COMENTARIO</label>
                <div className="border border-slate-200 rounded-3xl overflow-hidden">
                  <ReactQuill
                    theme="snow"
                    value={commentContent}
                    onChange={setCommentContent}
                    modules={quillModules}
                    className="min-h-[140px]"
                    placeholder="¿Qué se realizó?"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div className={`text-sm font-medium ${submitStatus.type === 'error' ? 'text-red-500' : 'text-emerald-600'}`}>
                  {submitStatus.msg}
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setShowCompleteModal(false)} className="px-8 py-3 text-slate-500 font-medium">
                    Cancelar
                  </button>
                  <button
                    onClick={handleCompleteTask}
                    disabled={!commentContent.trim()}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white px-10 py-3.5 rounded-2xl font-semibold transition-all"
                  >
                    Marcar como Completada
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}