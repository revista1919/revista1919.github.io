import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Papa from 'papaparse';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { debounce } from 'lodash';
import { ReviewerWorkspace } from './Workspace';
import NewsUploadSection from './NewsUploadSection';
import TaskSection from './TaskSection';
import AssignSection from './AssignSection';
import { useTranslation } from 'react-i18next';
import DirectorPanel from './DirectorPanel';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const ASSIGNMENTS_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS_RFrrfaVQHftZUhvJ1LVz0i_Tju-6PlYI8tAu5hLNLN21u8M7KV-eiruomZEcMuc_sxLZ1rXBhX1O/pub?output=csv';
const USERS_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS_RFrrfaVQHftZUhvJ1LVz0i_Tju-6PlYI8tAu5hLNLN21u8M7KV-eiruomZEcMuc_sxLZ1rXBhX1O/pub?gid=0&output=csv'; // Ajusta el gid si es necesario para la hoja de usuarios/team
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby2B1OUt3TMqaed6Vz-iamUPn4gHhKXG2RRxiy8Nt6u69Cg-2kSze2XQ-NywX5QrNfy/exec';
const RUBRIC_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzehxU_O7GkzfiCqCsSdnFwvA_Mhtfr_vSZjqVsBo3yx8ZEpr9Qur4NHPI09tyH1AZe/exec';
const RUBRIC_CSV1 = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS1BhqyalgqRIACNtlt1C0cDSBqBXCtPABA8WnXFOnbDXkLauCpLjelu9GHv7i1XLvPY346suLE9Lag/pub?gid=0&single=true&output=csv';
const RUBRIC_CSV2 = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS1BhqyalgqRIACNtlt1C0cDSBqBXCtPABA8WnXFOnbDXkLauCpLjelu9GHv7i1XLvPY346suLE9Lag/pub?gid=1438370398&single=true&output=csv';
const RUBRIC_CSV3 = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS1BhqyalgqRIACNtlt1C0cDSBqBXCtPABA8WnXFOnbDXkLauCpLjelu9GHv7i1XLvPY346suLE9Lag/pub?gid=1972050001&single=true&output=csv';



const getDecisionText = (percent) => {
  if (percent >= 85) return 'Aceptar sin cambios.';
  if (percent >= 70) return 'Aceptar con cambios menores.';
  if (percent >= 50) return 'Revisión mayor requerida antes de publicar.';
  return 'Rechazar.';
};

const base64EncodeUnicode = (str) => {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
};

const base64DecodeUnicode = (str) => {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
};

const sanitizeInput = (input) => {
  if (!input) return '';
  return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
              .replace(/on\w+="[^"]*"/gi, '')
              .replace(/\s+/g, ' ')
              .trim();
};

class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return <div className="text-red-600 text-center p-4">Ocurrió un error. Por favor recargue la página.</div>;
    }
    return this.props.children;
  }
}

const localizer = momentLocalizer(moment);

function CalendarComponent({ events, onSelectEvent }) {
  return (
    <div className="bg-white border border-gray-200 p-8 rounded-sm shadow-sm mb-6">
      <h3 className="font-serif text-2xl font-bold text-gray-900 mb-4">Calendario de Plazos</h3>
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 600 }}
        onSelectEvent={onSelectEvent}
        views={['month', 'week', 'day', 'agenda']}
        popup
        selectable
        className="rounded-lg border border-gray-200"
        messages={{
          next: "Siguiente",
          previous: "Anterior",
          today: "Hoy",
          month: "Mes",
          week: "Semana",
          day: "Día",
          agenda: "Agenda",
          date: "Fecha",
          time: "Hora",
          event: "Evento",
          noEventsInRange: "No hay eventos en este rango",
          showMore: total => `+ Ver más (${total})`
        }}
      />
    </div>
  );
}

/** * DISEÑO MODERNIZADO: Rúbrica estilo formulario de revisión por pares
 */
const RubricViewer = ({ roleKey, scores, onChange, readOnly = false }) => {
  const crits = criteria[roleKey];
  if (!crits) return null;
  const total = getTotal(scores, crits);
  const max = crits.length * 2;
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-8"
    >
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h5 className="font-serif text-lg font-bold text-gray-900 uppercase tracking-tight">
          Protocolo de Evaluación: {roleKey}
        </h5>
        <div className="text-sm font-mono font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded">
          SCORE: {total} / {max}
        </div>
      </div>
     
      <div className="p-6 space-y-8">
        {crits.map((c) => (
          <div key={c.key} className="border-b border-gray-100 last:border-0 pb-6">
            <div className="flex justify-between items-start mb-4">
              <h6 className="font-sans font-bold text-xs uppercase tracking-widest text-gray-500">{c.name}</h6>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(c.levels).map(([val, info]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => !readOnly && onChange && onChange(c.key, parseInt(val))}
                  className={`relative p-4 text-left border rounded-md transition-all duration-200 ${
                    scores[c.key] == val
                    ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                  } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <span className={`block text-xs font-bold mb-1 ${scores[c.key] == val ? 'text-blue-700' : 'text-gray-400'}`}>
                    NIVEL {val}
                  </span>
                  <p className="text-sm text-gray-800 leading-snug">{info.label.split('=')[1]}</p>
                  {scores[c.key] == val && (
                    <motion.div layoutId="check" className="absolute top-2 right-2 text-blue-600">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293l-4 4a1 1 0 01-1.414 0l-2-2a1 1 0 111.414-1.414L9 10.586l3.293-3.293a1 1 0 011.414 1.414z"/></svg>
                    </motion.div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

/**
 * TARJETA DE ASIGNACIÓN: Estilo Card Editorial
 */
const AssignmentCard = ({ assignment, onClick, index }) => {
  const role = assignment.role;
  const isAuthorCard = role === 'Autor';
  const isCompleted = isAuthorCard
    ? (assignment.feedbackEditor && ['Aceptado', 'Rechazado'].includes(assignment.Estado))
    : assignment.isCompleted;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -4 }}
      onClick={onClick}
      className="group bg-white border border-gray-200 p-6 flex flex-col h-full hover:border-blue-400 transition-all cursor-pointer relative"
    >
      <div className="flex justify-between items-start mb-4">
        <span className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-blue-600">
          {role}
        </span>
        <div className={`w-2 h-2 rounded-full ${isCompleted ? 'bg-green-500' : 'bg-amber-400 animate-pulse'}`} />
      </div>
     
      <h4 className="font-serif text-xl font-bold text-gray-900 group-hover:text-blue-800 transition-colors mb-4 line-clamp-2">
        {assignment['Nombre Artículo']}
      </h4>
      <div className="mt-auto pt-4 border-t border-gray-50 space-y-2">
        <div className="flex justify-between text-xs text-gray-500 font-sans">
          <span>PLAZO</span>
          <span className="font-bold">{assignment.Plazo ? new Date(assignment.Plazo).toLocaleDateString() : 'SIN FECHA'}</span>
        </div>
        <div className="flex justify-between text-xs text-gray-500 font-sans">
          <span>ESTADO</span>
          <span className={`font-bold ${isCompleted ? 'text-green-700' : 'text-amber-700'}`}>
            {isCompleted ? 'FINALIZADO' : 'PENDIENTE'}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default function PortalSection({ user, onLogout }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({});
  const [report, setReport] = useState({});
  const [vote, setVote] = useState({});
  const [rubricScores, setRubricScores] = useState({});
  const [tutorialVisible, setTutorialVisible] = useState({});
  const [submitStatus, setSubmitStatus] = useState({});
  const [rubricStatus, setRubricStatus] = useState({});
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('assignments');
  const [showImageModal, setShowImageModal] = useState({});
  const [isEditingImage, setIsEditingImage] = useState({});
  const [imageData, setImageData] = useState({});
  const [editingRange, setEditingRange] = useState({});
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [expandedFeedback, setExpandedFeedback] = useState({});
  const [isDirectorPanelExpanded, setIsDirectorPanelExpanded] = useState(false);
  const [isChiefEditorPanelExpanded, setIsChiefEditorPanelExpanded] = useState(false);
  const [effectiveName, setEffectiveName] = useState(user?.name || '');
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const feedbackQuillRefs = useRef({});
  const reportQuillRefs = useRef({});

  useEffect(() => {
    if (!user) {
      setAssignments([]);
      setFeedback({});
      setReport({});
      setVote({});
      setRubricScores({});
      setTutorialVisible({});
      setSubmitStatus({});
      setRubricStatus({});
      setError('');
      setActiveTab('assignments');
      setShowImageModal({});
      setIsEditingImage({});
      setImageData({});
      setEditingRange({});
      setSelectedAssignment(null);
      setExpandedFeedback({});
      setIsDirectorPanelExpanded(false);
      setIsChiefEditorPanelExpanded(false);
      setEffectiveName('');
      setCalendarEvents([]);
      setSelectedEvent(null);
    }
  }, [user]);

  // Mapeo de correo → nombre real
  useEffect(() => {
    const fetchUserMapping = async () => {
      if (user && user.name && user.name.includes('@')) {
        setError('Advertencia: Tu nombre parece ser una dirección de correo electrónico. Intentando mapear al nombre real desde CSV...');
        try {
          const csvText = await fetchWithRetry(USERS_CSV);
          Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: ({ data }) => {
              const mapping = data.find(row => row['Correo']?.trim().toLowerCase() === user.name.trim().toLowerCase());
              if (mapping && mapping['Nombre']) {
                setEffectiveName(mapping['Nombre'].trim());
                setError('');
              } else {
                setError('No se encontró mapeo de correo a nombre. Por favor, contacta al administrador.');
              }
            },
            error: (err) => {
              console.error('Error parsing users CSV:', err);
              setError('Error al cargar mapeo de usuarios.');
            },
          });
        } catch (err) {
          console.error('Error fetching users CSV:', err);
          setError('Error al conectar para mapeo de usuarios.');
        }
      } else if (user && user.name) {
        setEffectiveName(user.name);
      }
    };
    fetchUserMapping();
  }, [user]);

  const fetchRubrics = async () => {
    try {
      const [csv1Text, csv2Text, csv3Text] = await Promise.all([
        fetch(RUBRIC_CSV1, { cache: 'no-store' }).then(r => r.text()),
        fetch(RUBRIC_CSV2, { cache: 'no-store' }).then(r => r.text()),
        fetch(RUBRIC_CSV3, { cache: 'no-store' }).then(r => r.text())
      ]);
      const parseData = (csvText) => Papa.parse(csvText, { header: true, skipEmptyLines: true }).data;
      const data1 = parseData(csv1Text);
      const scoresMap1 = {};
      data1.forEach(row => {
        const name = row['Nombre del Artículo']?.trim();
        if (name) {
          scoresMap1[name] = {
            gramatica: parseInt(row['Gramática y ortografía']) || 0,
            claridad: parseInt(row['Claridad y coherencia']) || 0,
            estructura: parseInt(row['Estructura y organización']) || 0,
            citacion: parseInt(row['Citación y referencias']) || 0
          };
        }
      });
      const data2 = parseData(csv2Text);
      const scoresMap2 = {};
      data2.forEach(row => {
        const name = row['Nombre del Artículo']?.trim();
        if (name) {
          scoresMap2[name] = {
            relevancia: parseInt(row['Relevancia del tema']) || 0,
            rigor: parseInt(row['Rigor en el uso de fuentes']) || 0,
            originalidad: parseInt(row['Originalidad y creatividad']) || 0,
            argumentos: parseInt(row['Calidad de los argumentos']) || 0
          };
        }
      });
      const data3 = parseData(csv3Text);
      const scoresMap3 = {};
      data3.forEach(row => {
        const name = row['Nombre del Artículo']?.trim();
        if (name) {
          scoresMap3[name] = {
            modificaciones: parseInt(row['Grado de modificaciones']) || 0,
            calidad: parseInt(row['Calidad final del texto']) || 0,
            aporte: parseInt(row['Aporte global del ensayo']) || 0,
            potencial: parseInt(row['Potencial motivador']) || 0,
            decision: parseInt(row['Decisión final']) || 0
          };
        }
      });
      return { scoresMap1, scoresMap2, scoresMap3 };
    } catch (err) {
      console.error('Error fetching rubrics:', err);
      return { scoresMap1: {}, scoresMap2: {}, scoresMap3: {} };
    }
  };

  const fetchWithRetry = async (url, retries = 3, timeout = 10000) => {
    for (let i = 0; i < retries; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        return response.text();
      } catch (err) {
        if (i === retries - 1) throw err;
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  };

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const [csvText, rubrics] = await Promise.all([
        fetchWithRetry(ASSIGNMENTS_CSV),
        fetchRubrics()
      ]);
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        delimiter: ',',
        transform: (value) => value.trim(),
        complete: ({ data }) => {
          const normalizedEffectiveName = effectiveName.trim().toLowerCase();
          // Fetch author assignments
          const authorRows = data.filter(row => {
            const autores = row['Autor'] || '';
            return autores
              .split(';')
              .map(a => a.trim().toLowerCase())
              .includes(normalizedEffectiveName);
          });
          const authorAssignments = authorRows.map(row => ({
            id: row['Nombre Artículo'],
            'Nombre Artículo': row['Nombre Artículo'] || 'Sin título',
            Estado: row['Estado'],
            role: 'Autor',
            feedbackEditor: row['Feedback 3'] || 'No hay feedback del editor aún.',
            isCompleted: !!row['Feedback 3'],
            Plazo: row['Plazo'] || null,
          }));
          // Fetch reviewer/editor assignments
          const reviewerRows = data
            .filter(row => {
              return row['Revisor 1']?.trim() === effectiveName ||
                     row['Revisor 2']?.trim() === effectiveName ||
                     row['Editor']?.trim() === effectiveName;
            });
          const reviewerAssignments = reviewerRows.map(row => {
            const role = row['Revisor 1']?.trim() === effectiveName ? 'Revisor 1'
                      : row['Revisor 2']?.trim() === effectiveName ? 'Revisor 2'
                      : 'Editor';
            const num = role === 'Revisor 1' ? 1 : role === 'Revisor 2' ? 2 : 3;
            const assignment = {
              id: row['Nombre Artículo'],
              'Nombre Artículo': row['Nombre Artículo'] || 'Sin título',
              'Link Artículo': row['Link Artículo'],
              Estado: row['Estado'],
              role,
              feedback: row[`Feedback ${num}`] || '',
              report: row[`Informe ${num}`] || '',
              vote: row[`Voto ${num}`] || '',
              feedback1: row['Feedback 1'] || 'No hay feedback del Revisor 1.',
              feedback2: row['Feedback 2'] || 'No hay feedback del Revisor 2.',
              informe1: row['Informe 1'] || 'No hay informe del Revisor 1.',
              informe2: row['Informe 2'] || 'No hay informe del Revisor 2.',
              isCompleted: !!row[`Feedback ${num}`] && !!row[`Informe ${num}`] && !!row[`Voto ${num}`],
              Plazo: row['Plazo'] || null,
            };
            const name = assignment.id;
            if (role === 'Revisor 1') {
              assignment.scores = rubrics.scoresMap1[name] || { gramatica: 0, claridad: 0, estructura: 0, citacion: 0 };
            } else if (role === 'Revisor 2') {
              assignment.scores = rubrics.scoresMap2[name] || { relevancia: 0, rigor: 0, originalidad: 0, argumentos: 0 };
            } else {
              assignment.rev1Scores = rubrics.scoresMap1[name] || { gramatica: 0, claridad: 0, estructura: 0, citacion: 0 };
              assignment.rev2Scores = rubrics.scoresMap2[name] || { relevancia: 0, rigor: 0, originalidad: 0, argumentos: 0 };
              assignment.scores = rubrics.scoresMap3[name] || { modificaciones: 0, calidad: 0, aporte: 0, potencial: 0, decision: 0 };
            }
            return assignment;
          });
          // Combine: reviewer/editor first, then author
          const parsedAssignments = [...reviewerAssignments, ...authorAssignments];
          setAssignments(parsedAssignments);
          // Inicializar estados locales
          parsedAssignments.forEach(assignment => {
            if (assignment.role !== 'Autor') {
              const link = assignment['Link Artículo'];
              setVote(prev => ({ ...prev, [link]: assignment.vote }));
              setFeedback(prev => ({ ...prev, [link]: assignment.feedback }));
              setReport(prev => ({ ...prev, [link]: assignment.report }));
              setRubricScores(prev => ({ ...prev, [link]: assignment.scores }));
            }
          });
          // Eventos del calendario
          const events = parsedAssignments
            .filter(ass => ass.Plazo)
            .map(ass => ({
              title: `${ass['Nombre Artículo']} - ${ass.role}`,
              start: new Date(ass.Plazo),
              end: new Date(ass.Plazo),
              allDay: true,
              resource: ass,
            }));
          setCalendarEvents(events);
          setLoading(false);
          if (parsedAssignments.length === 0 && !loading) {
            setError(`No se encontraron asignaciones para '${effectiveName}'. Si esperas asignaciones, por favor verifica los detalles de tu cuenta o contacta al administrador.`);
          }
        },
        error: (err) => {
          console.error('Error al parsear CSV:', err);
          setError('Error al cargar asignaciones');
          setLoading(false);
        },
      });
    } catch (err) {
      console.error('Error al cargar asignaciones:', err);
      setError('Error al conectar al servidor');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || !effectiveName || !user.role) {
      setError('Usuario no definido o información incompleta');
      setLoading(false);
      return;
    }
    fetchAssignments();
  }, [user, effectiveName]);

  // Roles del usuario
  const userRoles = user?.role ? user.role.split(';').map(r => r.trim()) : [];
  const isAuthor = assignments.length > 0 && assignments[0].role === 'Autor';
  const isChief = userRoles.includes('Editor en Jefe');
  const isDirector = userRoles.includes('Director General');
  const isRrss = userRoles.includes('Encargado de Redes Sociales');
  const isWebDev = userRoles.includes('Responsable de Desarrollo Web');
  // Solo usuarios con rol superior a "Autor" ven el calendario
  const canSeeCalendar = isChief || isDirector || isRrss || isWebDev || assignments.some(a => a.role !== 'Autor');

  const pendingAssignments = useMemo(() =>
    isAuthor
      ? assignments.filter(a => !a.feedbackEditor || !['Aceptado', 'Rechazado'].includes(a.Estado))
      : assignments.filter(a => !a.isCompleted),
    [assignments, isAuthor]
  );

  const completedAssignments = useMemo(() =>
    isAuthor
      ? assignments.filter(a => a.feedbackEditor && ['Aceptado', 'Rechazado'].includes(a.Estado))
      : assignments.filter(a => a.isCompleted),
    [assignments, isAuthor]
  );

  const handleVote = (link, value) => {
    setVote((prev) => ({ ...prev, [link]: value }));
  };

  const handleRubricChange = (link, key, value) => {
    setRubricScores((prev) => ({
      ...prev,
      [link]: { ...prev[link], [key]: value }
    }));
  };

  const getRequiredKeys = (role) => {
    switch (role) {
      case 'Revisor 1': return ['gramatica', 'claridad', 'estructura', 'citacion'];
      case 'Revisor 2': return ['relevancia', 'rigor', 'originalidad', 'argumentos'];
      case 'Editor': return ['modificaciones', 'calidad', 'aporte', 'potencial', 'decision'];
      default: return [];
    }
  };

  const isRubricComplete = (link, role) => {
    const rubric = rubricScores[link] || {};
    const required = getRequiredKeys(role);
    return required.every(key => rubric[key] !== undefined && rubric[key] !== null);
  };

  const handleSubmitRubric = async (link, role) => {
    const articleName = assignments.find(a => a['Link Artículo'] === link)['Nombre Artículo'];
    const rubric = rubricScores[link] || {};
    const requiredKeys = getRequiredKeys(role);
    const missingKeys = requiredKeys.filter(key => rubric[key] === undefined || rubric[key] === null || isNaN(rubric[key]));
    if (missingKeys.length > 0) {
      setRubricStatus((prev) => ({ ...prev, [link]: `Error: Rúbrica incompleta. Faltante o inválido: ${missingKeys.join(', ')}` }));
      return;
    }
    const rubricData = {
      articleName: articleName.trim(),
      role,
      rubric
    };
    try {
      let success = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const response = await fetch(RUBRIC_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(rubricData),
          });
          success = true;
          break;
        } catch (err) {
          console.warn(`Intento ${attempt} fallido para rúbrica:`, err);
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }
      if (success) {
        setRubricStatus((prev) => ({ ...prev, [link]: 'Rúbrica enviada con éxito' }));
        await fetchAssignments();
      } else {
        setRubricStatus((prev) => ({ ...prev, [link]: 'Error al enviar rúbrica después de 3 intentos' }));
      }
    } catch (err) {
      console.error('Error general al enviar rúbrica:', err);
      setRubricStatus((prev) => ({ ...prev, [link]: `Error: ${err.message}` }));
    }
  };

  const handleSubmit = async (link, role, feedbackText, reportText, voteValue) => {
    const encodedFeedback = base64EncodeUnicode(sanitizeInput(feedbackText || ''));
    const encodedReport = base64EncodeUnicode(sanitizeInput(reportText || ''));
    const mainData = {
      link,
      role,
      vote: voteValue || '',
      feedback: encodedFeedback,
      report: encodedReport,
    };
    try {
      let mainSuccess = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(mainData),
          });
          mainSuccess = true;
          break;
        } catch (err) {
          console.warn(`Intento ${attempt} fallido para datos principales:`, err);
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }
      if (mainSuccess) {
        setSubmitStatus((prev) => ({ ...prev, [link]: 'Datos principales enviados con éxito' }));
        await fetchAssignments();
      } else {
        setSubmitStatus((prev) => ({ ...prev, [link]: 'Error al enviar datos principales después de 3 intentos' }));
      }
    } catch (err) {
      console.error('Error general al enviar datos principales:', err);
      setSubmitStatus((prev) => ({ ...prev, [link]: `Error: ${err.message}` }));
    }
  };

  const toggleTutorial = (link) => {
    setTutorialVisible((prev) => ({ ...prev, [link]: !prev[link] }));
  };

  const toggleFeedback = (link, type) => {
    setExpandedFeedback((prev) => ({
      ...prev,
      [link]: { ...prev[link], [type]: !prev[link]?.[type] }
    }));
  };

  const getTutorialText = (role) => {
    if (role === "Revisor 1") {
      return 'Como Revisor 1, tu rol es revisar aspectos técnicos como gramática, ortografía, citación de fuentes, detección de contenido generado por IA, coherencia lógica y estructura general del artículo. Proporciona comentarios detallados en el documento de Google Drive para sugerir mejoras. Asegúrate de que el lenguaje sea claro y académico. Debes proporcionar feedback al autor en la caja correspondiente. Además, debes enviar un informe resumido explicando tus observaciones para guiar al editor. Finalmente, en la caja de voto, ingresa "si" si apruebas el artículo, y "no" si lo rechazas.';
    } else if (role === "Revisor 2") {
      return 'Como Revisor 2, enfócate en el contenido sustantivo: verifica la precisión de las fuentes, la seriedad y originalidad del tema, la relevancia de los argumentos y la contribución al campo de estudio. Evalúa si el artículo es innovador y bien respaldado. Deja comentarios en el documento de Google Drive. Debes proporcionar feedback al autor en la caja correspondiente. Además, debes enviar un informe resumido explicando tus observaciones para guiar al editor. Finalmente, en la caja de voto, ingresa "si" si apruebas el artículo, y "no" si lo rechazas.';
    } else if (role === "Editor") {
      return `Como Editor, tu responsabilidad es revisar el feedback y los informes de los revisores, integrarlos con tu propia evaluación, y escribir un feedback final sensible y constructivo para el autor. Edita el texto directamente si es necesario y decide el estado final del artículo. Usa el documento de Google Drive para ediciones. Debes proporcionar feedback al autor sintetizando el feedback de los revisores. Tu mensaje debe ser preciso y sensible, sin desanimar al autor. Para esto, usa la técnica "sandwich". Si no sabes qué es, consulta <a href="https://www.santanderopenacademy.com/es/blog/tecnica-sandwich.html" style="color: blue;">aquí</a>. Basado en estudios psicológicos, como aquellos que indican que el feedback mejora el rendimiento solo en el 30% de los casos si no se maneja bien, asegúrate de que la crítica sea específica, accionable y no diluida por comentarios positivos para maximizar la efectividad. Puedes complementar con el modelo SBI (Situación-Comportamiento-Impacto) para mayor claridad: describe la situación, el comportamiento observado y su impacto. Luego, envía tu informe con los cambios realizados, que debe ser preciso y académico. Finalmente, en la caja de voto, ingresa "si" si apruebas el artículo, y "no" si lo rechazas.`;
    }
    return "";
  };

  const Tutorial = ({ role }) => {
    const tutorialText = getTutorialText(role);
    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="text-gray-800 bg-gray-50 p-4 rounded-md border border-gray-200 leading-relaxed break-words overflow-hidden font-sans text-sm"
      >
        <div className="mb-4" dangerouslySetInnerHTML={{ __html: tutorialText }} />
      </motion.div>
    );
  };

  const debouncedSetFeedback = useCallback(
    (link) => debounce((value) => {
      setFeedback((prev) => ({ ...prev, [link]: value }));
    }, 300),
    []
  );

  const debouncedSetReport = useCallback(
    (link) => debounce((value) => {
      setReport((prev) => ({ ...prev, [link]: value }));
    }, 300),
    []
  );

  const modules = useMemo(() => ({
    toolbar: {
      container: [
        ['bold', 'italic', 'underline', 'strike', 'blockquote'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        ['link', 'image', 'custom-image'],
        [{ 'align': ['', 'center', 'right', 'justify'] }],
        [{ 'size': ['small', false, 'large'] }],
        ['clean']
      ],
      handlers: {
        'custom-image': (value, link) => {
          setIsEditingImage((prev) => ({ ...prev, [link]: false }));
          setImageData((prev) => ({ ...prev, [link]: { url: '', width: '', height: '', align: 'left' } }));
          setShowImageModal((prev) => ({ ...prev, [link]: true }));
        }
      }
    },
    imageResize: {
      parchment: ReactQuill.Quill.import('parchment'),
      modules: ['Resize', 'DisplaySize'],
      handleStyles: {
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        border: 'none',
        color: 'white',
      },
      displayStyles: {
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        border: 'none',
        color: 'white',
      },
    },
    keyboard: {
      bindings: {
        deleteImage: {
          key: ['Delete', 'Backspace'],
          handler: function(range) {
            if (!range) {
              console.log('No hay selección activa para eliminar');
              return true;
            }
            const editor = this.quill;
            const imageResize = editor.getModule('imageResize');
            let isImage = false;
            let deleteIndex = range.index;
            let deleteLength = 1;
            if (range.length === 0) {
              const [leaf] = editor.getLeaf(range.index);
              if (leaf && leaf.domNode && leaf.domNode.tagName === 'IMG') {
                isImage = true;
              } else {
                if (this.key === 'Backspace') {
                  const [prevLeaf] = editor.getLeaf(range.index - 1);
                  if (prevLeaf && prevLeaf.domNode && prevLeaf.domNode.tagName === 'IMG') {
                    isImage = true;
                    deleteIndex = range.index - 1;
                  }
                } else if (this.key === 'Delete') {
                  const [nextLeaf] = editor.getLeaf(range.index);
                  if (nextLeaf && nextLeaf.domNode && nextLeaf.domNode.tagName === 'IMG') {
                    isImage = true;
                    deleteIndex = range.index;
                  }
                }
              }
            } else if (range.length === 1) {
              const [leaf] = editor.getLeaf(range.index);
              if (leaf && leaf.domNode && leaf.domNode.tagName === 'IMG') {
                isImage = true;
              }
            }
            if (isImage) {
              try {
                if (imageResize) {
                  imageResize.hide();
                }
                editor.deleteText(deleteIndex, deleteLength, ReactQuill.Quill.sources.USER);
                return false;
              } catch (err) {
                console.error('Error al eliminar imagen:', err);
                setSubmitStatus((prev) => ({ ...prev, [link]: 'Error al eliminar imagen' }));
                return false;
              }
            }
            return true;
          },
        },
        enterAfterImage: {
          key: 'Enter',
          handler: function(range) {
            if (!range) return true;
            const editor = this.quill;
            const [leaf] = editor.getLeaf(range.index);
            if (leaf && leaf.domNode && leaf.domNode.tagName === 'IMG') {
              try {
                editor.insertText(range.index + 1, '\n', ReactQuill.Quill.sources.USER);
                editor.setSelection(range.index + 2, ReactQuill.Quill.sources.SILENT);
                return false;
              } catch (err) {
                console.error('Error al insertar nueva línea después de imagen:', err);
                setSubmitStatus((prev) => ({ ...prev, [link]: 'Error al agregar texto después de imagen' }));
                return false;
              }
            }
            return true;
          },
        },
      },
    },
  }), []);

  useEffect(() => {
    const setupCustomButton = (quillRef, link, type) => {
      if (quillRef.current) {
        const editor = quillRef.current.getEditor();
        const toolbar = editor.getModule('toolbar');
        toolbar.addHandler('custom-image', () => {
          setIsEditingImage((prev) => ({ ...prev, [link]: false }));
          setImageData((prev) => ({ ...prev, [link]: { url: '', width: '', height: '', align: 'left' } }));
          setShowImageModal((prev) => ({ ...prev, [link]: true }));
        });
        const button = document.createElement('button');
        button.className = 'ql-custom-image';
        button.innerHTML = '<svg viewBox="0 0 18 18"><rect class="ql-stroke" x="3" y="4" width="12" height="10" rx="2" ry="2"></rect></svg>';
        button.title = 'Insertar Imagen Manualmente';
        const toolbarElement = document.querySelector(`#${type}-${link} .ql-toolbar`);
        if (toolbarElement && !toolbarElement.querySelector('.ql-custom-image')) {
          toolbarElement.appendChild(button);
        }
      }
    };
    Object.keys(feedbackQuillRefs.current).forEach(link => {
      setupCustomButton(feedbackQuillRefs.current[link], link, 'feedback');
    });
    Object.keys(reportQuillRefs.current).forEach(link => {
      setupCustomButton(reportQuillRefs.current[link], link, 'report');
    });
  }, [feedbackQuillRefs.current, reportQuillRefs.current]);

  const formats = useMemo(() => [
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet',
    'link', 'image',
    'align',
    'size'
  ], []);

  const decodeBody = (encoded) => {
    if (!encoded) return <p className="text-gray-600 font-sans text-sm break-words">No hay contenido disponible.</p>;
    try {
      const html = base64DecodeUnicode(encoded);
      return <div className="ql-editor break-words leading-relaxed font-sans text-sm text-gray-800" dangerouslySetInnerHTML={{ __html: html }} />;
    } catch (err) {
      console.error('Error al decodificar contenido:', err);
      return <p className="text-gray-600 font-sans text-sm break-words">Error al decodificar contenido.</p>;
    }
  };

  const handleImageModalSubmit = (link) => {
    const quillRef = feedbackQuillRefs.current[link] || reportQuillRefs.current[link];
    if (!quillRef) return;
    const editor = quillRef.getEditor();
    let { url, width, height, align } = imageData[link] || {};
    if (!url) {
      setSubmitStatus((prev) => ({ ...prev, [link]: 'La URL de la imagen es requerida.' }));
      return;
    }
    if (width && width !== 'auto' && !width.match(/%|px$/)) width += 'px';
    if (height && height !== 'auto' && !height.match(/%|px$/)) height += 'px';
    if (isEditingImage[link]) {
      if (editingRange[link]) {
        editor.setSelection(editingRange[link].index, 1, 'silent');
        const [leaf] = editor.getLeaf(editingRange[link].index);
        if (leaf && leaf.domNode.tagName === 'IMG') {
          if (width) leaf.domNode.style.width = width;
          if (height) leaf.domNode.style.height = height;
          editor.format('align', align, 'user');
        }
        editor.blur();
      }
    } else {
      const range = editor.getSelection() || { index: editor.getLength() };
      editor.insertText(range.index, '\n', 'user');
      editor.insertEmbed(range.index + 1, 'image', url, 'user');
      editor.setSelection(range.index + 2, 'silent');
      const [leaf] = editor.getLeaf(range.index + 1);
      if (leaf && leaf.domNode.tagName === 'IMG') {
        if (width) leaf.domNode.style.width = width;
        if (height) leaf.domNode.style.height = height;
        editor.setSelection(range.index + 1, 1, 'silent');
        editor.format('align', align, 'user');
        editor.setSelection(range.index + 2, 'silent');
      }
    }
    setShowImageModal((prev) => ({ ...prev, [link]: false }));
    setIsEditingImage((prev) => ({ ...prev, [link]: false }));
    setImageData((prev) => ({ ...prev, [link]: { url: '', width: '', height: '', align: 'left' } }));
    setEditingRange((prev) => ({ ...prev, [link]: null }));
  };

  const handleImageDataChange = (link, e) => {
    const { name, value } = e.target;
    setImageData((prev) => ({
      ...prev,
      [link]: { ...prev[link], [name]: value }
    }));
  };

  

  const tabs = [
    { id: 'assignments', label: 'MIS ASIGNACIONES' },
    { id: 'completed', label: 'COMPLETADAS' },
    { id: 'calendar', label: 'CALENDARIO ACADÉMICO', hidden: !canSeeCalendar },
    { id: 'director', label: 'PANEL DIRECTIVO', hidden: !isDirector },
    { id: 'chief', label: 'PANEL EDITOR JEFE', hidden: !isChief },
    { id: 'tasks', label: 'MIS TAREAS', hidden: !isRrss && !isWebDev },
    { id: 'news', label: 'PUBLICAR NOTICIAS', hidden: !isDirector },
  ];

  const currentAssignments = activeTab === 'assignments' ? pendingAssignments : completedAssignments;

  if (!user || !effectiveName || !user.role) {
    console.log('Usuario inválido:', user);
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-[#fafafa] p-4 md:p-8 flex items-center justify-center"
      >
        <div className="text-center text-gray-600 bg-white p-6 rounded-lg shadow-md">
          <p className="text-lg font-sans mb-4">Error: Información del usuario incompleta. Por favor inicia sesión nuevamente.</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              console.log('Botón Cerrar Sesión clickeado en PortalSection');
              onLogout();
            }}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm font-sans font-bold uppercase tracking-widest"
          >
            Cerrar Sesión
          </motion.button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 bg-[#fafafa] min-h-screen">
      {/* Header del Portal */}
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between border-b border-gray-900 pb-8">
        <div>
          <h1 className="font-serif text-5xl font-bold text-gray-900 tracking-tighter mb-2">
            Portal Editorial
          </h1>
          <div className="flex items-center space-x-3">
            <p className="text-gray-500 font-sans tracking-widest uppercase text-xs">
              Sesión activa:
            </p>
            {user?.image ? (
              <motion.img
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                src={user.image}
                alt={`Perfil de ${effectiveName || 'Usuario'}`}
                className="w-6 h-6 rounded-full object-cover border-2 border-gray-300"
                onError={(e) => (e.target.style.display = 'none')} // Hide on error
              />
            ) : (
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center border-2 border-gray-300"
              >
                <span className="text-gray-600 text-xs font-sans">{effectiveName?.charAt(0) || 'U'}</span>
              </motion.div>
            )}
            <span className="font-bold text-gray-800 font-sans text-xs uppercase tracking-widest">{effectiveName}</span>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="mt-4 md:mt-0 text-xs font-bold uppercase tracking-widest px-6 py-2 border border-gray-900 hover:bg-gray-900 hover:text-white transition-all"
        >
          Cerrar Sesión
        </button>
      </header>
      {/* Navegación Estilo Editorial */}
      <nav className="flex flex-wrap gap-8 mb-12 border-b border-gray-200">
        {tabs.filter(t => !t.hidden).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-4 text-xs font-bold uppercase tracking-widest transition-all relative ${
              activeTab === tab.id ? 'text-blue-700' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-700" />
            )}
          </button>
        ))}
      </nav>
      <main>
        <AnimatePresence mode="wait">
          {activeTab === 'assignments' || activeTab === 'completed' ? (
            <motion.section
              key="assignments"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            >
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-100 text-red-700 p-6 rounded-md mb-8 font-sans text-sm"
                >
                  {error}
                </motion.div>
              )}
              {loading ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-center items-center h-32"
                >
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
                  <p className="ml-4 text-gray-600 font-sans text-sm">Cargando asignaciones...</p>
                </motion.div>
              ) : currentAssignments.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center p-12 bg-white rounded-md border border-gray-200 shadow-sm"
                >
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <h3 className="mt-4 font-serif text-xl font-bold text-gray-900">No hay asignaciones {activeTab === 'assignments' ? 'pendientes' : 'completadas'} en este momento.</h3>
                  <p className="mt-2 text-gray-600 font-sans text-sm">Manténgase atento para nuevas oportunidades.</p>
                </motion.div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {currentAssignments.map((ass, idx) => (
                    <AssignmentCard
                      key={ass.id}
                      assignment={ass}
                      index={idx}
                      onClick={() => setSelectedAssignment(ass)}
                    />
                  ))}
                </div>
              )}
            </motion.section>
          ) : activeTab === 'calendar' ? (
            <motion.div
              key="calendar"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-white border border-gray-200 p-8 rounded-sm shadow-sm"
            >
              <CalendarComponent events={calendarEvents} onSelectEvent={(e) => setSelectedAssignment(e.resource)} />
            </motion.div>
          ) : activeTab === 'director' ? (
            <motion.div
              key="director"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-white border border-gray-200 p-8 rounded-sm shadow-sm"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-serif text-2xl font-bold text-gray-900">Panel del Director General</h3>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsDirectorPanelExpanded(!isDirectorPanelExpanded)}
                  className="bg-gray-200 text-gray-800 px-3 py-1 rounded-md hover:bg-gray-300 text-sm font-sans font-bold uppercase tracking-widest flex items-center space-x-2"
                >
                  <span>{isDirectorPanelExpanded ? 'Minimizar' : 'Expandir'}</span>
                  <svg className={`w-4 h-4 transform ${isDirectorPanelExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </motion.button>
              </div>
              <AnimatePresence>
                {isDirectorPanelExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-4 space-y-6 overflow-hidden"
                  >
                    <DirectorPanel user={user} />
                    <TaskSection user={user} />
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="mt-4 flex space-x-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    console.log('Botón agregar artículo clickeado');
                    document.dispatchEvent(new CustomEvent('openAddArticleModal'));
                  }}
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors font-sans text-sm font-bold uppercase tracking-widest flex items-center space-x-2"
                  style={{ display: 'inline-flex !important', visibility: 'visible !important' }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Agregar Artículo</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    console.log('Botón actualizar página clickeado');
                    document.dispatchEvent(new CustomEvent('rebuildPage'));
                  }}
                  className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 transition-colors font-sans text-sm font-bold uppercase tracking-widest flex items-center space-x-2"
                  style={{ display: 'inline-flex !important', visibility: 'visible !important' }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Actualizar Página</span>
                </motion.button>
              </div>
            </motion.div>
          ) : activeTab === 'chief' ? (
            <motion.div
              key="chief"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-white border border-gray-200 p-8 rounded-sm shadow-sm"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-serif text-2xl font-bold text-gray-900">Panel del Editor en Jefe</h3>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsChiefEditorPanelExpanded(!isChiefEditorPanelExpanded)}
                  className="bg-gray-200 text-gray-800 px-3 py-1 rounded-md hover:bg-gray-300 text-sm font-sans font-bold uppercase tracking-widest flex items-center space-x-2"
                >
                  <span>{isChiefEditorPanelExpanded ? 'Minimizar' : 'Expandir'}</span>
                  <svg className={`w-4 h-4 transform ${isChiefEditorPanelExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </motion.button>
              </div>
              <AnimatePresence>
                {isChiefEditorPanelExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-4 space-y-6 overflow-hidden"
                  >
                    <AssignSection user={user} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : activeTab === 'tasks' ? (
            <motion.div
              key="tasks"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-white border border-gray-200 p-8 rounded-sm shadow-sm"
            >
              <h3 className="font-serif text-2xl font-bold text-gray-900 mb-4">Mis Tareas en {isRrss ? 'Redes Sociales' : 'Desarrollo Web'}</h3>
              <TaskSection user={user} />
            </motion.div>
          ) : activeTab === 'news' ? (
            <motion.div
              key="news"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-white border border-gray-200 p-8 rounded-sm shadow-sm"
            >
              <h3 className="font-serif text-2xl font-bold text-gray-900 mb-4">Publicar Noticias</h3>
              <NewsUploadSection />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>
      {/* MODAL DE DETALLE (Overlay Editorial) */}
      <AnimatePresence>
        {selectedAssignment && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-white/95 backdrop-blur-sm overflow-y-auto px-4 py-12"
          >
            <div className="max-w-4xl mx-auto">
              <button
                onClick={() => setSelectedAssignment(null)}
                className="mb-8 font-sans font-bold text-xs uppercase tracking-widest flex items-center hover:text-blue-600"
              >
                ← Volver al Portal
              </button>
              <header className="mb-12">
                <span className="text-xs font-bold text-blue-600 tracking-[0.3em] uppercase">{selectedAssignment.role}</span>
                <h2 className="font-serif text-4xl font-bold text-gray-900 mt-2 mb-4 leading-tight">
                  {selectedAssignment['Nombre Artículo']}
                </h2>
                <div className="h-1 w-24 bg-gray-900" />
              </header>
              {/* Renderizar Rúbrica y Formularios aquí con los nuevos componentes estilizados */}
              <ReviewerWorkspace 
  assignment={selectedAssignment}
  onClose={() => setSelectedAssignment(null)}
  handleSubmitRubric={handleSubmitRubric}
  handleSubmit={handleSubmit}
  handleVote={handleVote}
  rubricScores={rubricScores}
  feedback={feedback}
  report={report}
  vote={vote}
  rubricStatus={rubricStatus}
  submitStatus={submitStatus}
  isPending={isAuthor ? (!selectedAssignment.feedbackEditor || !['Aceptado', 'Rechazado'].includes(selectedAssignment.Estado)) : !selectedAssignment.isCompleted}
  role={selectedAssignment.role}
  link={selectedAssignment['Link Artículo']}
  toggleTutorial={toggleTutorial}
  tutorialVisible={tutorialVisible}
  debouncedSetFeedback={debouncedSetFeedback}
  debouncedSetReport={debouncedSetReport}
  modules={modules}
  formats={formats}
  decodeBody={decodeBody}
  showImageModal={showImageModal}
  imageData={imageData}
  isEditingImage={isEditingImage}
  handleImageDataChange={handleImageDataChange}
  handleImageModalSubmit={handleImageModalSubmit}
  expandedFeedback={expandedFeedback}
  toggleFeedback={toggleFeedback}
  getDecisionText={getDecisionText}
/>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}