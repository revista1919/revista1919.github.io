import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Papa from 'papaparse';
import ReactQuill from 'react-quill';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardList, CheckCircle2, Clock, Plus, User, Globe, Share2, X } from 'lucide-react';
import 'react-quill/dist/quill.snow.css';
// URLs de Configuración
const USERS_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRcXoR3CjwKFIXSuY5grX1VE2uPQB3jf4XjfQf6JWfX9zJNXV4zaWmDiF2kQXSK03qe2hQrUrVAhviz/pub?output=csv';
const TASKS_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSCEOtMwYPu0_kn1hmQi0qT6FZq6HRF09WtuDSqOxBNgMor_FyRRtc6_YVKHQQhWJCy-mIa2zwP6uAU/pub?output=csv';
const TASK_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxMo7aV_vz_3mOCUWKpcqnWmassUdApD_KfAHROTdgd_MDDiaXikgVV0OZ5qVYmhZgd/exec';
const AREAS = {
  RRSS: 'Redes Sociales',
  WEB: 'Desarrollo Web',
};
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
  const [deadline, setDeadline] = useState('');
  const [commentContent, setCommentContent] = useState('');
  const [submitStatus, setSubmitStatus] = useState({ type: '', msg: '' });
  const [error, setError] = useState('');
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
      setError('Error al cargar datos');
    }
    setLoading(false);
  };
  // --- Lógica de Negocio y Permisos ---
  const currentUserData = users.find((u) => u.Nombre === user.name);
  const roles = currentUserData?.['Rol en la Revista']?.split(';').map((r) => r.trim()) || [];
  const isDirector = roles.includes('Director General');
  const director = useMemo(() => users.find((u) => u['Rol en la Revista']?.includes('Director General')), [users]);
  const directorEmail = director?.Correo;
  const directorName = director?.Nombre || user.name; // Fallback si no encontrado
  const filteredTasks = useMemo(() => {
    return tasks.reduce((acc, task, index) => {
      const areasConfig = [
        {
          key: 'Redes sociales',
          name: task.Nombre,
          completed: task['Cumplido 1'] === 'si',
          comment: task['Comentario 1'],
          assignDate: task['Assignment Date 1'],
          deadline: task['Deadline 1'],
          completeDate: task['Completion Date 1'],
          area: AREAS.RRSS,
        },
        {
          key: 'Desarrollo Web',
          name: task['Nombre.1'],
          completed: task['Cumplido 2'] === 'si',
          comment: task['Comentario 2'],
          assignDate: task['Assignment Date 2'],
          deadline: task['Deadline 2'],
          completeDate: task['Completion Date 2'],
          area: AREAS.WEB,
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
            deadline: conf.deadline,
            completeDate: conf.completeDate,
            rowIndex: index,
          });
        }
      });
      return acc;
    }, []);
  }, [tasks, user.name, isDirector]);
  const canCompleteTask = useCallback(
    (task) => {
      return !isDirector && (task.assignedName === user.name || task.assignedName === 'Equipo General');
    },
    [isDirector, user.name]
  );
  // --- ENVÍO DE TAREA + NOTIFICACIÓN ---
  const handleAssignTask = async () => {
    if (!taskContent.trim()) {
      setSubmitStatus({ type: 'error', msg: 'La tarea no puede estar vacía' });
      return;
    }
    setSubmitStatus({ type: 'info', msg: 'Procesando asignación y envío de notificación...' });
    const assigneeObj = users.find((u) => u.Nombre === selectedAssignee);
    const targetEmail = assigneeObj?.Correo || '';
    const encodedTask = btoa(unescape(encodeURIComponent(taskContent)));
    const payload = {
      action: 'assign',
      area: selectedArea,
      task: encodedTask,
      assignedTo: selectedAssignee,
      deadline: deadline,
      notifyEmail: targetEmail,
      directorName: directorName,
    };
    try {
      await fetch(TASK_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(payload),
      });
      setSubmitStatus({ type: 'success', msg: 'Tarea asignada. Se ha enviado un aviso por correo.' });
      setTimeout(() => {
        setShowAssignModal(false);
        setTaskContent('');
        setDeadline('');
        setSelectedAssignee('');
        loadData();
        setSubmitStatus({ type: '', msg: '' });
      }, 2000);
    } catch (e) {
      setSubmitStatus({ type: 'error', msg: 'Error en la conexión: ' + e.message });
    }
  };
  // --- COMPLETAR TAREA + NOTIFICACIÓN ---
  const handleCompleteTask = async () => {
    if (!commentContent.trim()) {
      setSubmitStatus({ type: 'error', msg: 'El comentario no puede estar vacío' });
      return;
    }
    setSubmitStatus({ type: 'info', msg: 'Procesando completado y envío de notificación...' });
    const encodedComment = btoa(unescape(encodeURIComponent(commentContent)));
    const encodedTask = btoa(unescape(encodeURIComponent(selectedTask.taskText))); // Ensure encoded
    const payload = {
      action: 'complete',
      area: selectedTask.area,
      row: selectedTask.rowIndex + 2,
      comment: encodedComment,
      notifyEmail: directorEmail,
      task: encodedTask,
      assignedTo: user.name,
    };
    try {
      await fetch(TASK_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(payload),
      });
      setSubmitStatus({ type: 'success', msg: 'Tarea completada. Se ha enviado un aviso al director.' });
      setTimeout(() => {
        setShowCompleteModal(false);
        setCommentContent('');
        setSelectedTask(null);
        loadData();
        setSubmitStatus({ type: '', msg: '' });
      }, 2000);
    } catch (e) {
      setSubmitStatus({ type: 'error', msg: 'Error en la conexión: ' + e.message });
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
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-[#007398] rounded-full animate-spin" />
        <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-gray-400">Sincronizando Tareas</p>
      </div>
    );
  }
  if (error) return <div className="text-red-600 text-center p-4">{error}</div>;
  return (
    <div className="max-w-6xl mx-auto py-8 px-4 font-sans text-gray-900">
      {/* Header Estilo Editorial */}
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between border-b border-gray-200 pb-6 gap-6">
        <div>
          <h2 className="text-3xl font-serif text-gray-800">Panel de Tareas</h2>
          <p className="text-xs uppercase tracking-[0.2em] text-[#007398] font-bold mt-1">Gestión de Áreas RRSS y Web</p>
        </div>
        {isDirector && (
          <button
            onClick={() => setShowAssignModal(true)}
            className="flex items-center gap-2 bg-[#007398] text-white px-6 py-2.5 rounded-sm text-[11px] font-bold uppercase tracking-widest hover:bg-[#005a77] transition-all shadow-lg shadow-[#007398]/20"
          >
            <Plus size={14} /> Nueva Tarea
          </button>
        )}
      </header>
      {/* Tabs Modernos */}
      <div className="flex gap-8 mb-8 border-b border-gray-100">
        {[
          { id: 'pending', label: 'Pendientes', icon: Clock, count: filteredTasks.filter((t) => !t.completed).length },
          { id: 'completed', label: 'Completadas', icon: CheckCircle2, count: filteredTasks.filter((t) => t.completed).length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 pb-4 text-[11px] font-bold uppercase tracking-[0.15em] transition-all relative ${
              activeTab === tab.id ? 'text-[#007398]' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
            <span className="ml-1 bg-gray-100 px-2 py-0.5 rounded-full text-[9px]">{tab.count}</span>
            {activeTab === tab.id && <motion.div layoutId="tabLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#007398]" />}
          </button>
        ))}
      </div>
      {/* Grid de Tareas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredTasks
            .filter((t) => (activeTab === 'pending' ? !t.completed : t.completed))
            .map((task) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group bg-white border border-gray-200 p-6 hover:border-[#007398] transition-all flex flex-col h-full rounded-sm shadow-sm"
              >
                <div className="flex justify-between items-start mb-4">
                  <span
                    className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-sm ${
                      task.area === AREAS.RRSS ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                    }`}
                  >
                    {task.area}
                  </span>
                  <div className="text-gray-300 group-hover:text-[#007398] transition-colors">
                    {task.area === AREAS.RRSS ? <Share2 size={16} /> : <Globe size={16} />}
                  </div>
                </div>
                <div className="flex-1 font-serif text-sm leading-relaxed text-gray-700 mb-6 overflow-hidden">
                  <div dangerouslySetInnerHTML={{ __html: decodeBody(task.taskText) }} />
                </div>
                {task.assignDate && (
                  <p className="text-[10px] text-gray-500 mb-1">Asignada el: {task.assignDate}</p>
                )}
                {task.deadline && (
                  <p className="text-[10px] text-red-600 mb-1">Plazo: {task.deadline}</p>
                )}
                {task.completed && task.completeDate && (
                  <p className="text-[10px] text-green-600 mb-1">Completada el: {task.completeDate}</p>
                )}
                {task.completed && task.comment && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <span className="text-[10px] uppercase tracking-wide text-gray-500 font-bold">Comentario:</span>
                    <div className="text-sm mt-2 font-serif text-gray-600" dangerouslySetInnerHTML={{ __html: decodeBody(task.comment) }} />
                  </div>
                )}
                <div className="pt-4 border-t border-gray-50 flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                      <User size={12} className="text-gray-500" />
                    </div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter italic">{task.assignedName}</span>
                  </div>
                  {!task.completed && canCompleteTask(task) && (
                    <button
                      onClick={() => {
                        setSelectedTask(task);
                        setCommentContent('');
                        setShowCompleteModal(true);
                      }}
                      className="text-[10px] font-bold uppercase text-[#007398] hover:underline"
                    >
                      Completar
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
        </AnimatePresence>
      </div>
      {/* Modal de Asignación */}
      <AnimatePresence>
        {showAssignModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-md" onClick={() => setShowAssignModal(false)} />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white w-full max-w-2xl shadow-2xl rounded-sm p-8 max-h-[90vh] overflow-y-auto"
            >
              <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" onClick={() => setShowAssignModal(false)}>
                <X size={20} />
              </button>
              <h3 className="text-2xl font-serif mb-6">Asignar Nueva Tarea</h3>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Área</label>
                  <select
                    value={selectedArea}
                    onChange={(e) => setSelectedArea(e.target.value)}
                    className="w-full border-b border-gray-200 py-2 focus:border-[#007398] outline-none text-sm transition-all"
                  >
                    <option value={AREAS.RRSS}>{AREAS.RRSS}</option>
                    <option value={AREAS.WEB}>{AREAS.WEB}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Asignado</label>
                  <select
                    value={selectedAssignee}
                    onChange={(e) => setSelectedAssignee(e.target.value)}
                    className="w-full border-b border-gray-200 py-2 focus:border-[#007398] outline-none text-sm transition-all"
                  >
                    <option value="">Equipo General</option>
                    {users
                      .filter((u) =>
                        u['Rol en la Revista']?.includes(selectedArea === AREAS.RRSS ? 'Encargado de Redes Sociales' : 'Responsable de Desarrollo Web')
                      )
                      .map((u) => (
                        <option key={u.Nombre} value={u.Nombre}>
                          {u.Nombre}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="mb-6">
                <label className="block text-[10px] font-bold uppercase text-gray-400 tracking-widest mb-3">Plazo (opcional)</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full border-b border-gray-200 py-2 focus:border-[#007398] outline-none text-sm transition-all"
                />
              </div>
              <div className="mb-12">
                <label className="block text-[10px] font-bold uppercase text-gray-400 tracking-widest mb-3">Descripción</label>
                <div className="h-48 border border-gray-100 rounded-sm">
                  <ReactQuill
                    theme="snow"
                    value={taskContent}
                    onChange={setTaskContent}
                    modules={quillModules}
                    className="h-full font-serif text-sm"
                    placeholder="Describe la tarea detalladamente..."
                  />
                </div>
              </div>
              {submitStatus.msg && (
                <span
                  className={`block mb-4 text-[10px] font-bold uppercase tracking-widest ${
                    submitStatus.type === 'error' ? 'text-red-500' : submitStatus.type === 'success' ? 'text-green-500' : 'text-gray-400'
                  }`}
                >
                  {submitStatus.msg}
                </span>
              )}
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-900 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAssignTask}
                  disabled={!taskContent.trim()}
                  className="bg-[#007398] text-white px-8 py-3 rounded-sm text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-[#005a77] transition-all disabled:opacity-50"
                >
                  Asignar
                </button>
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-md" onClick={() => setShowCompleteModal(false)} />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white w-full max-w-2xl shadow-2xl rounded-sm p-8 max-h-[90vh] overflow-y-auto"
            >
              <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" onClick={() => setShowCompleteModal(false)}>
                <X size={20} />
              </button>
              <h3 className="text-2xl font-serif mb-6">Completar Tarea: {selectedTask?.area}</h3>
              <div className="mb-4 font-serif text-sm text-gray-700">
                <span className="block text-[10px] font-bold uppercase text-gray-400 tracking-widest mb-2">Descripción</span>
                <div dangerouslySetInnerHTML={{ __html: decodeBody(selectedTask?.taskText) }} />
              </div>
              {selectedTask?.assignDate && (
                <p className="text-[10px] text-gray-500 mb-1">Asignada el: {selectedTask.assignDate}</p>
              )}
              {selectedTask?.deadline && (
                <p className="text-[10px] text-red-600 mb-4">Plazo: {selectedTask.deadline}</p>
              )}
              <div className="mb-12">
                <label className="block text-[10px] font-bold uppercase text-gray-400 tracking-widest mb-3">Comentario</label>
                <div className="h-48 border border-gray-100 rounded-sm">
                  <ReactQuill
                    theme="snow"
                    value={commentContent}
                    onChange={setCommentContent}
                    modules={quillModules}
                    className="h-full font-serif text-sm"
                    placeholder="Describe lo realizado..."
                  />
                </div>
              </div>
              {submitStatus.msg && (
                <span
                  className={`block mb-4 text-[10px] font-bold uppercase tracking-widest ${
                    submitStatus.type === 'error' ? 'text-red-500' : submitStatus.type === 'success' ? 'text-green-500' : 'text-gray-400'
                  }`}
                >
                  {submitStatus.msg}
                </span>
              )}
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => setShowCompleteModal(false)}
                  className="px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-900 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCompleteTask}
                  disabled={!commentContent.trim()}
                  className="bg-[#007398] text-white px-8 py-3 rounded-sm text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-[#005a77] transition-all disabled:opacity-50"
                >
                  Completar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}