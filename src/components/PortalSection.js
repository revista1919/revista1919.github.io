import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Papa from 'papaparse';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { debounce } from 'lodash';
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
const criteria = {
  'Revisor 1': [
    {
      key: 'gramatica',
      name: 'Gramática y ortografía',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'Muchos errores graves, difícil de leer.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'Algunos errores, pero comprensible.' },
        2: { label: '2 = Excelente ✅', desc: 'Muy pocos errores, texto limpio.' }
      }
    },
    {
      key: 'claridad',
      name: 'Claridad y coherencia',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'Confuso, incoherente.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'A veces confuso pero comprensible.' },
        2: { label: '2 = Excelente ✅', desc: 'Claro, preciso y coherente.' }
      }
    },
    {
      key: 'estructura',
      name: 'Estructura y organización',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'Desorganizado, sin secciones claras.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'Secciones presentes pero con débiles.' },
        2: { label: '2 = Excelente ✅', desc: 'Introducción, desarrollo y conclusión bien diferenciados.' }
      }
    },
    {
      key: 'citacion',
      name: 'Citación y referencias',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'Sin fuentes o mal citadas.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'Fuentes presentes pero con errores.' },
        2: { label: '2 = Excelente ✅', desc: 'Fuentes confiables, bien citadas.' }
      }
    }
  ],
  'Revisor 2': [
    {
      key: 'relevancia',
      name: 'Relevancia del tema',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'Tema irrelevante o fuera de contexto.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'Tema válido pero superficial.' },
        2: { label: '2 = Excelente ✅', desc: 'Tema relevante e interesante.' }
      }
    },
    {
      key: 'rigor',
      name: 'Rigor en el uso de fuentes',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'Sin fuentes o poco confiables.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'Pocas fuentes, algunas cuestionables.' },
        2: { label: '2 = Excelente ✅', desc: 'Fuentes variadas, confiables y bien usadas.' }
      }
    },
    {
      key: 'originalidad',
      name: 'Originalidad y creatividad',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'Repite información sin análisis.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'Combina ideas con poca elaboración.' },
        2: { label: '2 = Excelente ✅', desc: 'Aporta ideas originales y reflexiones.' }
      }
    },
    {
      key: 'argumentos',
      name: 'Calidad de los argumentos',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'Confusos, no respaldados o incoherentes.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'Claros pero débiles.' },
        2: { label: '2 = Excelente ✅', desc: 'Sólidos, bien respaldados y convincentes.' }
      }
    }
  ],
  'Editor': [
    {
      key: 'modificaciones',
      name: 'Grado de modificaciones',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'Requerió correcciones extensas, casi reescrito.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'Necesitó varias correcciones manejables.' },
        2: { label: '2 = Excelente ✅', desc: 'Solo ajustes menores.' }
      }
    },
    {
      key: 'calidad',
      name: 'Calidad final del texto',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'Aún débil o poco claro después de cambios.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'Texto aceptable, aunque mejorable.' },
        2: { label: '2 = Excelente ✅', desc: 'Texto sólido, claro y publicable.' }
      }
    },
    {
      key: 'aporte',
      name: 'Aporte global del ensayo',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'Poca relevancia o repetitivo.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'Interesante, pero no sobresaliente.' },
        2: { label: '2 = Excelente ✅', desc: 'Altamente valioso, innovador o inspirador.' }
      }
    },
    {
      key: 'potencial',
      name: 'Potencial motivador',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'No motiva ni contribuye al espíritu de la revista.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'Puede motivar a algunos estudiantes.' },
        2: { label: '2 = Excelente ✅', desc: 'Inspira, fomenta la reflexión y el diálogo.' }
      }
    },
    {
      key: 'decision',
      name: 'Decisión final',
      levels: {
        0: { label: '0 = Rechazar', desc: 'Rechazar.' },
        1: { label: '1 = Aceptar con cambios mayores', desc: 'Aceptar con cambios mayores.' },
        2: { label: '2 = Aceptar (con o sin cambios menores)', desc: 'Aceptar (con o sin cambios menores).' }
      }
    }
  ]
};
const getDecisionText = (percent) => {
  if (percent >= 85) return 'Aceptar sin cambios.';
  if (percent >= 70) return 'Aceptar con cambios menores.';
  if (percent >= 50) return 'Revisión mayor requerida antes de publicar.';
  return 'Rechazar.';
};
const getTotal = (scores, crits) => crits.reduce((sum, c) => sum + (scores[c.key] || 0), 0);
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
    <div className="bg-white p-4 rounded-lg shadow-md mb-6">
      <h3 className="text-xl font-bold text-gray-800 mb-4">Calendario de Plazos</h3>
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
export default function PortalSection({ user, onClose }) {
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
  const [currentQuillType, setCurrentQuillType] = useState({});
  const feedbackQuillRefs = useRef({});
  const reportQuillRefs = useRef({});
  useEffect(() => {
    if (!user) {
      console.log('Null user, clearing PortalSection states');
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
  // Fetch user mapping if name looks like email
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
                setError(''); // Clear error if mapping successful
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
          const isAuthor = data.some((row) => row['Autor'] === effectiveName);
          let parsedAssignments = [];
          if (isAuthor) {
            parsedAssignments = data
              .filter((row) => row['Autor'] === effectiveName)
              .map((row) => ({
                id: row['Nombre Artículo'],
                'Nombre Artículo': row['Nombre Artículo'] || 'Sin título',
                Estado: row['Estado'],
                role: 'Autor',
                feedbackEditor: row['Feedback 3'] || 'No hay feedback del editor aún.',
                isCompleted: !!row['Feedback 3'],
                Plazo: row['Plazo'] || null,
              }));
          } else {
            parsedAssignments = data
              .filter((row) => {
                if (row['Revisor 1'] === effectiveName) return true;
                if (row['Revisor 2'] === effectiveName) return true;
                if (row['Editor'] === effectiveName) return true;
                return false;
              })
              .map((row) => {
                const role = row['Revisor 1'] === effectiveName ? 'Revisor 1' : row['Revisor 2'] === effectiveName ? 'Revisor 2' : 'Editor';
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
          }
          setAssignments(parsedAssignments);
          parsedAssignments.forEach((assignment) => {
            if (!isAuthor) {
              const link = assignment['Link Artículo'];
              setVote((prev) => ({ ...prev, [link]: assignment.vote }));
              setFeedback((prev) => ({ ...prev, [link]: assignment.feedback }));
              setReport((prev) => ({ ...prev, [link]: assignment.report }));
              setRubricScores((prev) => ({ ...prev, [link]: assignment.scores }));
            }
          });
          // Create calendar events
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
      console.log('Error en fetchAssignments: usuario inválido', { user, effectiveName });
      setError('Usuario no definido o información incompleta');
      setLoading(false);
      return;
    }
    console.log('Cargando asignaciones para usuario:', { uid: user.uid, name: effectiveName, role: user.role });
    fetchAssignments();
  }, [user, effectiveName]);
  const isAuthor = assignments.length > 0 && assignments[0].role === 'Autor';
  const isChief = user?.role && user.role.split(';').map(r => r.trim()).includes('Editor en Jefe');
  const isDirector = user?.role && user.role.split(';').map(r => r.trim()).includes('Director General');
  const isRrss = user?.role && user.role.split(';').map(r => r.trim()).includes('Encargado de Redes Sociales');
  const isWebDev = user?.role && user.role.split(';').map(r => r.trim()).includes('Responsable de Desarrollo Web');
  console.log('Datos del usuario:', user);
  console.log('Roles del usuario:', user?.role);
  console.log('isDirector:', isDirector);
  console.log('isChief:', isChief);
  const pendingAssignments = useMemo(() =>
    isAuthor
      ? assignments.filter((a) => !a.feedbackEditor || !['Aceptado', 'Rechazado'].includes(a.Estado))
      : assignments.filter((a) => !a.isCompleted),
    [assignments, isAuthor]
  );
  const completedAssignments = useMemo(() =>
    isAuthor
      ? assignments.filter((a) => a.feedbackEditor && ['Aceptado', 'Rechazado'].includes(a.Estado))
      : assignments.filter((a) => a.isCompleted),
    [assignments, isAuthor]
  );
  // Resto del código permanece igual...
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
        className="text-gray-800 bg-gray-50 p-4 rounded-md border border-gray-200 leading-relaxed break-words overflow-hidden"
      >
        <div className="mb-4" dangerouslySetInnerHTML={{ __html: tutorialText }} />
      </motion.div>
    );
  };
  const RubricViewer = ({ roleKey, scores, onChange, readOnly = false }) => {
    const crits = criteria[roleKey];
    if (!crits) return null;
    const total = getTotal(scores, crits);
    const max = crits.length * 2;
    const roleDisplay = roleKey === 'Revisor 1' ? 'Revisor 1 (Forma, Estilo y Técnica)' : roleKey === 'Revisor 2' ? 'Revisor 2 (Contenido y Originalidad)' : 'Editor (Síntesis y Decisión Final)';
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-4 rounded-lg shadow-md mb-6 overflow-hidden"
      >
        <h5 className="font-semibold mb-4 text-gray-800 border-b pb-2 break-words">{roleDisplay} - Total: {total} / {max}</h5>
        {crits.map((c) => (
          <div key={c.key} className="mb-4 p-3 bg-gray-50 rounded-md">
            <h6 className="font-medium mb-2 text-gray-700 break-words">{c.name}</h6>
            <div className="flex space-x-1 mb-2">
              {Object.entries(c.levels).map(([val, info]) => (
                <motion.button
                  key={val}
                  type="button"
                  onClick={() => !readOnly && onChange && onChange(c.key, parseInt(val))}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`flex-1 py-2 px-3 rounded text-xs font-medium transition-colors break-words ${
                    scores[c.key] == val
                      ? 'bg-blue-500 text-white shadow-md'
                      : readOnly
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  disabled={readOnly}
                >
                  {info.label}
                </motion.button>
              ))}
            </div>
            <p className={`text-xs italic ${readOnly ? 'text-gray-500' : 'text-blue-600'} break-words`}>
              {c.levels[scores[c.key] || 0].desc}
            </p>
          </div>
        ))}
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
        ['link', 'image'],
        [{ 'align': ['', 'center', 'right', 'justify'] }],
        [{ 'size': ['small', false, 'large'] }],
        ['clean']
      ]
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
        deleteImageBack: {
          key: 'backspace',
          handler: function(range) {
            if (!range) return true;
            const editor = this.quill;
            const imageResize = editor.getModule('imageResize');
            let isImage = false;
            let deleteIndex = range.index;
            let deleteLength = 1;
            if (range.length === 0) {
              const [leaf] = editor.getLeaf(range.index - 1);
              if (leaf && leaf.domNode && leaf.domNode.tagName === 'IMG') {
                isImage = true;
                deleteIndex = range.index - 1;
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
                return false;
              }
            }
            return true;
          },
        },
        deleteImageDel: {
          key: 'delete',
          handler: function(range) {
            if (!range) return true;
            const editor = this.quill;
            const imageResize = editor.getModule('imageResize');
            let isImage = false;
            let deleteIndex = range.index;
            let deleteLength = 1;
            if (range.length === 0) {
              const [leaf] = editor.getLeaf(range.index);
              if (leaf && leaf.domNode && leaf.domNode.tagName === 'IMG') {
                isImage = true;
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
                return false;
              }
            }
            return true;
          },
        },
        enterAfterImage: {
          key: 'enter',
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
          setCurrentQuillType((prev) => ({ ...prev, [link]: type }));
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
  const encodeBody = (html) => {
    return base64EncodeUnicode(sanitizeInput(html));
  };
  const decodeBody = (encoded) => {
    if (!encoded) return <p className="text-gray-600 break-words">No hay contenido disponible.</p>;
    try {
      const html = base64DecodeUnicode(encoded);
      return <div className="ql-editor break-words leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />;
    } catch (err) {
      console.error('Error al decodificar contenido:', err);
      return <p className="text-gray-600 break-words">Error al decodificar contenido.</p>;
    }
  };
  const handleImageModalSubmit = (link) => {
    const type = currentQuillType[link] || 'feedback';
    const quillRef = type === 'feedback' ? feedbackQuillRefs.current[link] : reportQuillRefs.current[link];
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
  const AssignmentCard = ({ assignment, onClick, index }) => {
    const role = assignment.role;
    const nombre = assignment['Nombre Artículo'];
    const isAuthorCard = role === 'Autor';
    const statusColor = isAuthorCard
      ? (assignment.feedbackEditor && ['Aceptado', 'Rechazado'].includes(assignment.Estado)
        ? 'bg-green-100 text-green-800'
        : 'bg-yellow-100 text-yellow-800')
      : (assignment.isCompleted ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800');
    // Calcular porcentaje solo si no es autor
    let percent = 0;
    if (!isAuthorCard) {
      const total = role !== 'Editor'
        ? getTotal(assignment.scores || {}, criteria[role] || [])
        : getTotal(assignment.scores || {}, criteria['Editor'] || []);
      const max = (criteria[role] || criteria['Editor'] || []).length * 2;
      percent = max > 0 ? (total / max) * 100 : 0;
    }
    return (
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: index * 0.1 }}
        whileHover={{ scale: 1.02, boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}
        className="bg-white p-6 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-200 h-full flex flex-col justify-between"
        onClick={onClick}
      >
        <div>
          <h4 className="text-xl font-bold text-gray-800 mb-2 break-words">{nombre}</h4>
          <p className="text-sm text-gray-600 mb-3 break-words">Rol: {role}</p>
          {assignment.Plazo && (
            <p className="text-sm text-gray-600 mb-3 break-words">Plazo: {new Date(assignment.Plazo).toLocaleDateString()}</p>
          )}
          <div className="flex items-center justify-between mb-4">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
              {isAuthorCard
                ? (assignment.feedbackEditor && ['Aceptado', 'Rechazado'].includes(assignment.Estado)
                  ? 'Archivado'
                  : 'En Revisión')
                : (assignment.isCompleted ? 'Completado' : 'Pendiente')}
            </span>
            {!isAuthorCard && (
              <span className="text-sm font-medium text-gray-700">
                {percent.toFixed(0)}% Puntaje
              </span>
            )}
          </div>
          <p className="text-gray-500 text-sm break-words">{assignment.Estado || 'Sin estado'}</p>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-200">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Ver Detalles
          </motion.button>
        </div>
      </motion.div>
    );
  };
  const renderFullAssignment = (assignment) => {
    const link = assignment['Link Artículo'];
    const role = assignment.role;
    const nombre = assignment['Nombre Artículo'];
    const isPending = isAuthor ? (!assignment.feedbackEditor || !['Aceptado', 'Rechazado'].includes(assignment.Estado)) : !assignment.isCompleted;
    const isAuth = role === 'Autor';
    const handleRenderRubric = () => {
      if (isAuth) return null;
      if (isPending) {
        if (role === 'Editor') {
          const rev1Total = getTotal(assignment.rev1Scores, criteria['Revisor 1']);
          const rev2Total = getTotal(assignment.rev2Scores, criteria['Revisor 2']);
          const revPercent = ((rev1Total + rev2Total) / 16) * 100;
          const editorTotal = getTotal(rubricScores[link] || {}, criteria['Editor']);
          const overallTotal = rev1Total + rev2Total + editorTotal;
          const overallPercent = (overallTotal / 26) * 100;
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="space-y-4">
              <div className="flex items-center justify-between">
                <h5 className="text-lg font-semibold text-gray-800">Rúbrica del Revisor 1</h5>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={() => toggleFeedback(link, 'rubric1')}
                  className="text-blue-600 hover:underline text-sm flex items-center"
                >
                  {expandedFeedback[link]?.rubric1 ? 'Ocultar' : 'Mostrar'}
                  <svg className={`w-4 h-4 ml-1 transform ${expandedFeedback[link]?.rubric1 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </motion.button>
              </div>
              <AnimatePresence>
                {expandedFeedback[link]?.rubric1 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    <RubricViewer roleKey="Revisor 1" scores={assignment.rev1Scores} readOnly />
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex items-center justify-between">
                <h5 className="text-lg font-semibold text-gray-800">Rúbrica del Revisor 2</h5>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={() => toggleFeedback(link, 'rubric2')}
                  className="text-blue-600 hover:underline text-sm flex items-center"
                >
                  {expandedFeedback[link]?.rubric2 ? 'Ocultar' : 'Mostrar'}
                  <svg className={`w-4 h-4 ml-1 transform ${expandedFeedback[link]?.rubric2 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </motion.button>
              </div>
              <AnimatePresence>
                {expandedFeedback[link]?.rubric2 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    <RubricViewer roleKey="Revisor 2" scores={assignment.rev2Scores} readOnly />
                  </motion.div>
                )}
              </AnimatePresence>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-yellow-50 rounded-md">
                <p className="font-medium break-words">Implicación de los Revisores: {revPercent.toFixed(1)}% - {getDecisionText(revPercent)}</p>
              </motion.div>
              <RubricViewer
                roleKey="Editor"
                scores={rubricScores[link] || {}}
                onChange={(key, val) => handleRubricChange(link, key, val)}
              />
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-green-50 rounded-md">
                <p className="font-medium break-words">Decisión General Sugerida: {overallPercent.toFixed(1)}% - {getDecisionText(overallPercent)}</p>
              </motion.div>
            </motion.div>
          );
        } else {
          return (
            <RubricViewer
              roleKey={role}
              scores={rubricScores[link] || {}}
              onChange={(key, val) => handleRubricChange(link, key, val)}
            />
          );
        }
      } else {
        if (role === 'Editor') {
          const rev1Total = getTotal(assignment.rev1Scores, criteria['Revisor 1']);
          const rev2Total = getTotal(assignment.rev2Scores, criteria['Revisor 2']);
          const revPercent = ((rev1Total + rev2Total) / 16) * 100;
          const editorTotal = getTotal(assignment.scores, criteria['Editor']);
          const overallTotal = rev1Total + rev2Total + editorTotal;
          const overallPercent = (overallTotal / 26) * 100;
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="space-y-4">
              <div className="flex items-center justify-between">
                <h5 className="text-lg font-semibold text-gray-800">Rúbrica del Revisor 1</h5>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={() => toggleFeedback(link, 'rubric1')}
                  className="text-blue-600 hover:underline text-sm flex items-center"
                >
                  {expandedFeedback[link]?.rubric1 ? 'Ocultar' : 'Mostrar'}
                  <svg className={`w-4 h-4 ml-1 transform ${expandedFeedback[link]?.rubric1 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </motion.button>
              </div>
              <AnimatePresence>
                {expandedFeedback[link]?.rubric1 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    <RubricViewer roleKey="Revisor 1" scores={assignment.rev1Scores} readOnly />
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex items-center justify-between">
                <h5 className="text-lg font-semibold text-gray-800">Rúbrica del Revisor 2</h5>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={() => toggleFeedback(link, 'rubric2')}
                  className="text-blue-600 hover:underline text-sm flex items-center"
                >
                  {expandedFeedback[link]?.rubric2 ? 'Ocultar' : 'Mostrar'}
                  <svg className={`w-4 h-4 ml-1 transform ${expandedFeedback[link]?.rubric2 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </motion.button>
              </div>
              <AnimatePresence>
                {expandedFeedback[link]?.rubric2 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    <RubricViewer roleKey="Revisor 2" scores={assignment.rev2Scores} readOnly />
                  </motion.div>
                )}
              </AnimatePresence>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-yellow-50 rounded-md">
                <p className="font-medium break-words">Implicación de los Revisores: {revPercent.toFixed(1)}% - {getDecisionText(revPercent)}</p>
              </motion.div>
              <RubricViewer roleKey="Editor" scores={assignment.scores} readOnly />
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-green-50 rounded-md">
                <p className="font-medium break-words">Decisión General: {overallPercent.toFixed(1)}% - {getDecisionText(overallPercent)}</p>
              </motion.div>
            </motion.div>
          );
        } else {
          return <RubricViewer roleKey={role} scores={assignment.scores} readOnly />;
        }
      }
    };
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white p-6 rounded-xl shadow-lg space-y-6 w-full"
      >
        <div className="flex justify-between items-start">
          <div>
            <h4 className="text-2xl font-bold text-gray-800 mb-2 break-words">{nombre}</h4>
            <p className="text-gray-600 break-words">Rol: {role} | Estado: {assignment.Estado || 'Sin estado'}</p>
            {assignment.Plazo && (
              <p className="text-gray-600 break-words">Plazo: {new Date(assignment.Plazo).toLocaleDateString()}</p>
            )}
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            onClick={() => setSelectedAssignment(null)}
            className="text-blue-600 hover:underline flex items-center text-sm"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Volver a la Lista
          </motion.button>
        </div>
        {isAuth ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="space-y-6">
            {assignment.feedbackEditor && ['Aceptado', 'Rechazado'].includes(assignment.Estado) ? (
              <>
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="p-4 bg-green-50 rounded-md border-l-4 border-green-400">
                  <h5 className="text-lg font-semibold text-green-800 mb-2">Estado Final: {assignment.Estado}</h5>
                </motion.div>
                <h5 className="text-lg font-semibold text-gray-800">Feedback del Editor</h5>
                <div className="bg-gray-50 p-4 rounded-md border border-gray-200 max-h-48 overflow-y-auto leading-relaxed">
                  {decodeBody(assignment.feedbackEditor)}
                </div>
              </>
            ) : (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-6 bg-yellow-50 rounded-md border-l-4 border-yellow-400 text-center">
                <h5 className="text-xl font-semibold text-yellow-800 mb-2">Artículo en Revisión</h5>
                <p className="text-yellow-700 text-lg">Tu artículo "{assignment['Nombre Artículo']}" está actualmente bajo revisión por evaluadores y el editor.</p>
                <p className="text-yellow-600 mt-2">Recibirás una notificación con la decisión final y el feedback una vez que el proceso se complete.</p>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <div className="space-y-2">
                <motion.a
                  whileHover={{ scale: 1.05 }}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm mb-2"
                >
                  Abrir en Google Drive
                </motion.a>
                <motion.iframe
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8 }}
                  src={link ? link.replace('/edit', '/preview') : ''}
                  className="w-full h-[350px] lg:h-[500px] rounded-xl shadow border border-gray-200"
                  title="Vista Previa del Artículo"
                  sandbox="allow-same-origin allow-scripts"
                  loading="lazy"
                />
              </div>
              {handleRenderRubric()}
            </div>
            <div className="lg:col-span-1 space-y-6">
              {role === 'Editor' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700 break-words">Feedback del Revisor 1</label>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      onClick={() => toggleFeedback(link, 'feedback1')}
                      className="text-blue-600 hover:underline text-sm flex items-center"
                    >
                      {expandedFeedback[link]?.feedback1 ? 'Ocultar' : 'Mostrar'}
                      <svg className={`w-4 h-4 ml-1 transform ${expandedFeedback[link]?.feedback1 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </motion.button>
                  </div>
                  <AnimatePresence>
                    {expandedFeedback[link]?.feedback1 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-gray-50 p-4 rounded-md border border-gray-200 max-h-48 overflow-y-auto"
                      >
                        {decodeBody(assignment.feedback1)}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700 break-words">Feedback del Revisor 2</label>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      onClick={() => toggleFeedback(link, 'feedback2')}
                      className="text-blue-600 hover:underline text-sm flex items-center"
                    >
                      {expandedFeedback[link]?.feedback2 ? 'Ocultar' : 'Mostrar'}
                      <svg className={`w-4 h-4 ml-1 transform ${expandedFeedback[link]?.feedback2 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </motion.button>
                  </div>
                  <AnimatePresence>
                    {expandedFeedback[link]?.feedback2 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-gray-50 p-4 rounded-md border border-gray-200 max-h-48 overflow-y-auto"
                      >
                        {decodeBody(assignment.feedback2)}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700 break-words">Informe del Revisor 1</label>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      onClick={() => toggleFeedback(link, 'informe1')}
                      className="text-blue-600 hover:underline text-sm flex items-center"
                    >
                      {expandedFeedback[link]?.informe1 ? 'Ocultar' : 'Mostrar'}
                      <svg className={`w-4 h-4 ml-1 transform ${expandedFeedback[link]?.informe1 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </motion.button>
                  </div>
                  <AnimatePresence>
                    {expandedFeedback[link]?.informe1 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-gray-50 p-4 rounded-md border border-gray-200 max-h-48 overflow-y-auto"
                      >
                        {decodeBody(assignment.informe1)}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700 break-words">Informe del Revisor 2</label>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      onClick={() => toggleFeedback(link, 'informe2')}
                      className="text-blue-600 hover:underline text-sm flex items-center"
                    >
                      {expandedFeedback[link]?.informe2 ? 'Ocultar' : 'Mostrar'}
                      <svg className={`w-4 h-4 ml-1 transform ${expandedFeedback[link]?.informe2 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </motion.button>
                  </div>
                  <AnimatePresence>
                    {expandedFeedback[link]?.informe2 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-gray-50 p-4 rounded-md border border-gray-200 max-h-48 overflow-y-auto"
                      >
                        {decodeBody(assignment.informe2)}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
              {isPending ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="space-y-6">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleTutorial(link)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
                  >
                    {tutorialVisible[link] ? 'Ocultar Tutorial' : 'Ver Tutorial'}
                  </motion.button>
                  <AnimatePresence>
                    {tutorialVisible[link] && <Tutorial role={role} />}
                  </AnimatePresence>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 break-words">
                      {role === 'Editor' ? 'Feedback Final al Autor' : 'Feedback al Autor'}
                    </label>
                    <ReactQuill
                      ref={(el) => (feedbackQuillRefs.current[link] = el)}
                      value={feedback[link] || ''}
                      onChange={debouncedSetFeedback(link)}
                      modules={modules}
                      formats={formats}
                      placeholder={role === 'Editor' ? 'Escribe feedback final sensible, sintetizando opiniones de revisores y tuyas.' : 'Escribe tu feedback aquí...'}
                      className="border rounded-md text-gray-800 bg-white h-48"
                      id={`feedback-${link}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 break-words">Informe al Editor</label>
                    <ReactQuill
                      ref={(el) => (reportQuillRefs.current[link] = el)}
                      value={report[link] || ''}
                      onChange={debouncedSetReport(link)}
                      modules={modules}
                      formats={formats}
                      placeholder="Escribe tu informe aquí..."
                      className="border rounded-md text-gray-800 bg-white h-48"
                      id={`report-${link}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 break-words">Voto</label>
                    <div className="flex space-x-4">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleVote(link, 'si')}
                        className={`px-4 py-2 rounded-md ${vote[link] === 'si' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} transition-colors text-sm`}
                      >
                        Sí
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleVote(link, 'no')}
                        className={`px-4 py-2 rounded-md ${vote[link] === 'no' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} transition-colors text-sm`}
                      >
                        No
                      </motion.button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleSubmitRubric(link, role)}
                      disabled={!isRubricComplete(link, role)}
                      className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      Enviar Rúbrica
                    </motion.button>
                    {rubricStatus[link] && (
                      <p className={`text-sm mt-2 ${rubricStatus[link].includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                        {rubricStatus[link]}
                      </p>
                    )}
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleSubmit(link, role, feedback[link], report[link], vote[link])}
                    disabled={!vote[link] || !feedback[link] || !report[link]}
                    className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    Enviar Revisión (Feedback, Informe, Voto)
                  </motion.button>
                  {submitStatus[link] && (
                    <p className={`text-sm mt-2 ${submitStatus[link].includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                      {submitStatus[link]}
                    </p>
                  )}
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="space-y-6">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleTutorial(link)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
                  >
                    {tutorialVisible[link] ? 'Ocultar Tutorial' : 'Ver Tutorial'}
                  </motion.button>
                  <AnimatePresence>
                    {tutorialVisible[link] && <Tutorial role={role} />}
                  </AnimatePresence>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 break-words">Feedback Enviado</label>
                    <div className="bg-gray-50 p-4 rounded-md border border-gray-200 max-h-48 overflow-y-auto">
                      {decodeBody(feedback[link] || 'Sin feedback.')}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 break-words">Informe Enviado</label>
                    <div className="bg-gray-50 p-4 rounded-md border border-gray-200 max-h-48 overflow-y-auto">
                      {decodeBody(report[link] || 'Sin informe.')}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 break-words">Voto Enviado</label>
                    <p className="text-sm text-gray-600">{vote[link] ? vote[link].charAt(0).toUpperCase() + vote[link].slice(1) : 'No enviado'}</p>
                  </div>
                </motion.div>
              )}
              <AnimatePresence>
                {showImageModal[link] && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                  >
                    <motion.div
                      initial={{ y: 50, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full"
                    >
                      <h4 className="text-lg font-semibold mb-4">{isEditingImage[link] ? 'Editar Imagen' : 'Insertar Imagen'}</h4>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">URL de la Imagen</label>
                          <input
                            type="text"
                            name="url"
                            value={imageData[link]?.url || ''}
                            onChange={(e) => handleImageDataChange(link, e)}
                            className="mt-1 block w-full border rounded-md p-2 text-sm"
                            placeholder="https://example.com/image.jpg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Ancho (px o %)</label>
                          <input
                            type="text"
                            name="width"
                            value={imageData[link]?.width || ''}
                            onChange={(e) => handleImageDataChange(link, e)}
                            className="mt-1 block w-full border rounded-md p-2 text-sm"
                            placeholder="auto o 300px"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Alto (px o %)</label>
                          <input
                            type="text"
                            name="height"
                            value={imageData[link]?.height || ''}
                            onChange={(e) => handleImageDataChange(link, e)}
                            className="mt-1 block w-full border rounded-md p-2 text-sm"
                            placeholder="auto o 200px"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Alineación</label>
                          <select
                            name="align"
                            value={imageData[link]?.align || 'left'}
                            onChange={(e) => handleImageDataChange(link, e)}
                            className="mt-1 block w-full border rounded-md p-2 text-sm"
                          >
                            <option value="left">Izquierda</option>
                            <option value="center">Centro</option>
                            <option value="right">Derecha</option>
                            <option value="justify">Justificado</option>
                          </select>
                        </div>
                      </div>
                      <div className="mt-6 flex justify-end space-x-2">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setShowImageModal((prev) => ({ ...prev, [link]: false }))}
                          className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 text-sm"
                        >
                          Cancelar
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleImageModalSubmit(link)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                        >
                          {isEditingImage[link] ? 'Actualizar' : 'Insertar'}
                        </motion.button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </motion.div>
    );
  };
  // Director-specific functions for buttons
  const handleAddArticleClick = () => {
    // This function will be passed to DirectorPanel to trigger the add modal
    // We don't need to implement it here as it's handled in DirectorPanel
  };
  const handleRebuildClick = () => {
    // This function will be passed to DirectorPanel to trigger the rebuild action
    // We don't need to implement it here as it's handled in DirectorPanel
  };
  if (!user || !effectiveName || !user.role) {
    console.log('Usuario inválido:', user);
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-gray-100 p-4 md:p-8 flex items-center justify-center"
      >
        <div className="text-center text-gray-600 bg-white p-6 rounded-lg shadow-md">
          <p className="text-lg mb-4">Error: Información del usuario incompleta. Por favor inicia sesión nuevamente.</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              console.log('Botón Cerrar Sesión clickeado en PortalSection');
              onLogout();
            }}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm"
          >
            Cerrar Sesión
          </motion.button>
        </div>
      </motion.div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-4 md:p-8"
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800">
            {isAuthor && !isDirector && !isChief ? 'Mis Artículos' :
             isDirector ? 'Panel del Director General' :
             isChief ? 'Panel del Editor en Jefe' : 'Panel de Revisión'}
          </h2>
          <div className="flex items-center space-x-4">
            {user?.image ? (
              <motion.img
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                src={user.image}
                alt={`Perfil de ${effectiveName || 'Usuario'}`}
                className="w-10 h-10 rounded-full object-cover border-2 border-gray-300"
                onError={(e) => (e.target.style.display = 'none')} // Hide on error
              />
            ) : (
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center"
              >
                <span className="text-gray-600 text-sm">{effectiveName?.charAt(0) || 'U'}</span>
              </motion.div>
            )}
            <span className="text-gray-600">Bienvenido, {effectiveName || 'Usuario'}</span>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onLogout}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm"
            >
              Cerrar Sesión
            </motion.button>
          </div>
        </div>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-100 text-red-700 p-4 rounded-md mb-6"
          >
            {error}
          </motion.div>
        )}
        <CalendarComponent
          events={calendarEvents}
          onSelectEvent={(event) => setSelectedEvent(event.resource)}
        />
        {selectedEvent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-4">
                <h5 className="font-bold text-lg">Detalles del Evento</h5>
                <button onClick={() => setSelectedEvent(null)} className="text-gray-500 hover:text-gray-700">×</button>
              </div>
              {renderFullAssignment(selectedEvent)}
            </div>
          </div>
        )}
        {isDirector && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6"
          >
            <NewsUploadSection />
          </motion.div>
        )}
        {isDirector && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-6 bg-white rounded-xl shadow-lg p-4"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-800">Panel del Director General</h3>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsDirectorPanelExpanded(!isDirectorPanelExpanded)}
                className="bg-gray-200 text-gray-800 px-3 py-1 rounded-md hover:bg-gray-300 text-sm flex items-center space-x-2"
              >
                <span>{isDirectorPanelExpanded ? 'Minimizar' : 'Expandir'}</span>
                <svg className={`w-4 h-4 transform ${isDirectorPanelExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </motion.button>
            </div>
            <div className="mt-4 flex space-x-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  console.log('Botón agregar artículo clickeado');
                  document.dispatchEvent(new CustomEvent('openAddArticleModal'));
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors font-medium flex items-center space-x-2"
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
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors font-medium flex items-center space-x-2"
                style={{ display: 'inline-flex !important', visibility: 'visible !important' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Actualizar Página</span>
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
          </motion.div>
        )}
        {isChief && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-6 bg-white rounded-xl shadow-lg p-4"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-800">Panel del Editor en Jefe</h3>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsChiefEditorPanelExpanded(!isChiefEditorPanelExpanded)}
                className="bg-gray-200 text-gray-800 px-3 py-1 rounded-md hover:bg-gray-300 text-sm flex items-center space-x-2"
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
        )}
        {(isRrss || isWebDev) && !isDirector && !isChief && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mb-6 bg-white rounded-xl shadow-lg p-4"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-800">Mis Tareas en {isRrss ? 'Redes Sociales' : 'Desarrollo Web'}</h3>
            </div>
            <TaskSection user={user} />
          </motion.div>
        )}
        {(pendingAssignments.length > 0 || completedAssignments.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mb-6"
          >
            <div className="flex space-x-4 border-b">
              <motion.button
                whileHover={{ y: -2 }}
                onClick={() => setActiveTab('assignments')}
                className={`pb-2 px-4 text-sm font-medium transition-all duration-300 ${activeTab === 'assignments' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
              >
                {isAuthor ? 'Artículos en Revisión' : 'Asignaciones Pendientes'} ({pendingAssignments.length})
              </motion.button>
              <motion.button
                whileHover={{ y: -2 }}
                onClick={() => setActiveTab('completed')}
                className={`pb-2 px-4 text-sm font-medium transition-all duration-300 ${activeTab === 'completed' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
              >
                {isAuthor ? 'Artículos Archivados' : 'Asignaciones Completadas'} ({completedAssignments.length})
              </motion.button>
            </div>
          </motion.div>
        )}
        <ErrorBoundary>
          {(isChief || isDirector) && activeTab === 'asignar' && <AssignSection user={user} />}
          {(pendingAssignments.length > 0 || completedAssignments.length > 0 || isChief || isDirector) && (
            <>
              {loading ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-center items-center h-32"
                >
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
                  <p className="ml-4 text-gray-600">Cargando asignaciones...</p>
                </motion.div>
              ) : selectedAssignment ? (
                renderFullAssignment(selectedAssignment)
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {(() => {
                    const currentAssignments = activeTab === 'assignments' ? pendingAssignments : completedAssignments;
                    if (currentAssignments.length === 0) {
                      return (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="col-span-full text-center p-12 bg-white rounded-xl shadow-lg"
                        >
                          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          <h3 className="mt-4 text-xl font-semibold text-gray-800">No hay asignaciones {activeTab === 'assignments' ? 'pendientes' : 'completadas'} en este momento.</h3>
                          <p className="mt-2 text-gray-600">¡Mantente atento, nuevas oportunidades vendrán pronto!</p>
                        </motion.div>
                      );
                    }
                    return currentAssignments.map((assignment, index) => (
                      <AssignmentCard
                        key={assignment.id}
                        assignment={assignment}
                        onClick={() => setSelectedAssignment(assignment)}
                        index={index}
                      />
                    ));
                  })()}
                </div>
              )}
            </>
          )}
        </ErrorBoundary>
      </div>
    </motion.div>
  );
}