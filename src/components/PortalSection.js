import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Papa from 'papaparse';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { debounce } from 'lodash';
import NewsUploadSection from './NewsUploadSection';
import TaskSection from './TaskSection';
import AssignSection from './AssignSection'; // Added import
import { useTranslation } from 'react-i18next';

const ASSIGNMENTS_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS_RFrrfaVQHftZUhvJ1LVz0i_Tju-6PlYI8tAu5hLNLN21u8M7KV-eiruomZEcMuc_sxLZ1rXBhX1O/pub?output=csv';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwrW8Nu1wpvM8pJmGHLxuR0NAbXhQEnhRRABe5W0B5LPhHT5jIJS-8DO8t_T4AYJv6j/exec';
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
        1: { label: '1 = Adecuado ⚖️', desc: 'Algunos errores, comprensible.' },
        2: { label: '2 = Excelente ✅', desc: 'Muy pocos errores, texto limpio.' }
      }
    },
    {
      key: 'claridad',
      name: 'Claridad y coherencia',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'Confuso, incoherente.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'A veces confuso pero entendible.' },
        2: { label: '2 = Excelente ✅', desc: 'Claro, preciso y coherente.' }
      }
    },
    {
      key: 'estructura',
      name: 'Estructura y organización',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'Desordenado, sin partes claras.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'Con partes presentes pero débiles.' },
        2: { label: '2 = Excelente ✅', desc: 'Introducción, desarrollo y conclusión bien diferenciados.' }
      }
    },
    {
      key: 'citacion',
      name: 'Citación y referencias',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'Sin fuentes o mal citadas.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'Fuentes presentes pero con errores.' },
        2: { label: '2 = Excelente ✅', desc: 'Fuentes confiables y bien citadas.' }
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
        2: { label: '2 = Excelente ✅', desc: 'Tema pertinente y atractivo.' }
      }
    },
    {
      key: 'rigor',
      name: 'Rigor en el uso de fuentes',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'Sin fuentes o poco confiables.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'Pocas fuentes, algunas dudosas.' },
        2: { label: '2 = Excelente ✅', desc: 'Fuentes variadas, confiables y bien usadas.' }
      }
    },
    {
      key: 'originalidad',
      name: 'Originalidad y creatividad',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'Repite información sin análisis.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'Combina ideas sin mucha elaboración.' },
        2: { label: '2 = Excelente ✅', desc: 'Aporta ideas propias y reflexiones originales.' }
      }
    },
    {
      key: 'argumentos',
      name: 'Calidad de los argumentos',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'Confusos, sin pruebas o incoherentes.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'Claros pero débiles.' },
        2: { label: '2 = Excelente ✅', desc: 'Sólidos, bien fundamentados y convincentes.' }
      }
    }
  ],
  'Editor': [
    {
      key: 'modificaciones',
      name: 'Grado de modificaciones',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'Requirió demasiadas correcciones, casi reescribir.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'Necesitó varias correcciones, pero manejables.' },
        2: { label: '2 = Excelente ✅', desc: 'Solo ajustes menores.' }
      }
    },
    {
      key: 'calidad',
      name: 'Calidad final del texto',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'Aún con cambios, sigue débil o poco claro.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'Texto aceptable, aunque mejorable.' },
        2: { label: '2 = Excelente ✅', desc: 'Texto sólido, claro y publicable.' }
      }
    },
    {
      key: 'aporte',
      name: 'Aporte global del ensayo',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'Poca relevancia o repetitivo.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'Interesante, aunque no destaca.' },
        2: { label: '2 = Excelente ✅', desc: 'Muy valioso, innovador o inspirador.' }
      }
    },
    {
      key: 'potencial',
      name: 'Potencial motivador',
      levels: {
        0: { label: '0 = Insuficiente ❌', desc: 'No motiva ni aporta al espíritu de la revista.' },
        1: { label: '1 = Adecuado ⚖️', desc: 'Puede motivar a algunos estudiantes.' },
        2: { label: '2 = Excelente ✅', desc: 'Inspira, invita a reflexionar y dialogar.' }
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
  if (percent >= 50) return 'Revisión mayor antes de publicar.';
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
      return <div className="text-red-600 text-center p-4">Ocurrió un error. Por favor, recarga la página.</div>;
    }
    return this.props.children;
  }
}

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
  const [completedPanelOpen, setCompletedPanelOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [expandedFeedback, setExpandedFeedback] = useState({});
  const feedbackQuillRefs = useRef({});
  const reportQuillRefs = useRef({});

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
          const isAuthor = data.some((row) => row['Autor'] === user.name);
          let parsedAssignments = [];
          if (isAuthor) {
            parsedAssignments = data
              .filter((row) => row['Autor'] === user.name)
              .map((row) => ({
                id: row['Nombre Artículo'],
                'Nombre Artículo': row['Nombre Artículo'] || 'Sin título',
                Estado: row['Estado'],
                role: 'Autor',
                feedbackEditor: row['Feedback 3'] || 'Sin retroalimentación del editor aún.',
                isCompleted: !!row['Feedback 3'],
              }));
          } else {
            parsedAssignments = data
              .filter((row) => {
                if (row['Revisor 1'] === user.name) return true;
                if (row['Revisor 2'] === user.name) return true;
                if (row['Editor'] === user.name) return true;
                return false;
              })
              .map((row) => {
                const role = row['Revisor 1'] === user.name ? 'Revisor 1' : row['Revisor 2'] === user.name ? 'Revisor 2' : 'Editor';
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
                  feedback1: row['Feedback 1'] || 'Sin retroalimentación de Revisor 1.',
                  feedback2: row['Feedback 2'] || 'Sin retroalimentación de Revisor 2.',
                  informe1: row['Informe 1'] || 'Sin informe de Revisor 1.',
                  informe2: row['Informe 2'] || 'Sin informe de Revisor 2.',
                  isCompleted: !!row[`Feedback ${num}`] && !!row[`Informe ${num}`] && !!row[`Voto ${num}`],
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
          setLoading(false);
        },
        error: (err) => {
          console.error('Error al parsear CSV:', err);
          setError('Error al cargar asignaciones');
          setLoading(false);
        },
      });
    } catch (err) {
      console.error('Error al cargar asignaciones:', err);
      setError('Error al conectar con el servidor');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || !user.name) {
      setError('Usuario no definido');
      setLoading(false);
      return;
    }
    fetchAssignments();
  }, [user?.name]);

  const isAuthor = assignments.length > 0 && assignments[0].role === 'Autor';
  const isChief = user?.roles && user.roles.split(';').map(r => r.trim()).includes('Editor en Jefe');

  const pendingAssignments = useMemo(() => assignments.filter((a) => !a.isCompleted), [assignments]);
  const completedAssignments = useMemo(() => assignments.filter((a) => a.isCompleted), [assignments]);

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
      setRubricStatus((prev) => ({ ...prev, [link]: `Error: Rúbrica incompleta. Faltan o inválidos: ${missingKeys.join(', ')}` }));
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
        setRubricStatus((prev) => ({ ...prev, [link]: 'Rúbrica enviada exitosamente' }));
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
        setSubmitStatus((prev) => ({ ...prev, [link]: 'Datos principales enviados exitosamente' }));
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
      return 'Como Revisor 1, tu rol es revisar aspectos técnicos como gramática, ortografía, citación de fuentes, detección de contenido generado por IA, coherencia lógica y estructura general del artículo. Deja comentarios detallados en el documento de Google Drive para sugerir mejoras. Asegúrate de que el lenguaje sea claro y académico. Debes dejar tu retroalimentación al autor en la casilla correspondiente. Además debes dejar un informe resumido explicando tu observaciones para guiar al editor. Por último, en la casilla de voto debes poner "sí" si apruebas el artículo, y "no" si lo rechazas.';
    } else if (role === "Revisor 2") {
      return 'Como Revisor 2, enfócate en el contenido sustantivo: verifica la precisión de las fuentes, la seriedad y originalidad del tema, la relevancia de los argumentos, y la contribución al campo de estudio. Evalúa si el artículo es innovador y bien fundamentado. Deja comentarios en el documento de Google Drive. Debes dejar tu retroalimentación al autor in la casilla correspondiente. Además debes dejar un informe resumido explicando tu observaciones para guiar al editor. Por último, en la casilla de voto debes poner "sí" si apruebas el artículo, y "no" si lo rechazas.';
    } else if (role === "Editor") {
      return `Como Editor, tu responsabilidad es revisar las retroalimentaciones e informes de los revisores, integrarlas con tu propia evaluación, y redactar una retroalimentación final sensible y constructiva para el autor. Corrige directamente el texto si es necesario y decide el estado final del artículo. Usa el documento de Google Drive para ediciones. Debes dejar una retroalimentación al autor sintetizando las que dejaron los revisores. Tu deber es que el mensaje sea acertado y sensible, sin desmotivar al autor. Para esto debes usar la técnica del "sándwich". Si no sabes qué es, entra aqu . Luego deja tu informe con los cambios realizados, deben ser precisos y académicos. Por último, en la casilla de voto debes poner "sí" si apruebas el artículo, y "no" si lo rechazas.`;
    }
    return "";
  };

  const Tutorial = ({ role }) => {
    const tutorialText = getTutorialText(role);
    return (
      <div className="text-gray-800 bg-gray-50 p-4 rounded-md border border-gray-200 leading-relaxed break-words">
        <p className="mb-4">{tutorialText}</p>
      </div>
    );
  };

  const RubricViewer = ({ roleKey, scores, onChange, readOnly = false }) => {
    const crits = criteria[roleKey];
    if (!crits) return null;
    const total = getTotal(scores, crits);
    const max = crits.length * 2;
    const roleDisplay = roleKey === 'Revisor 1' ? 'Revisor 1 (Forma, estilo y técnica)' : roleKey === 'Revisor 2' ? 'Revisor 2 (Contenido y originalidad)' : 'Editor (Síntesis y decisión final)';

    return (
      <div className="bg-white p-4 rounded-lg shadow-md mb-6 overflow-hidden">
        <h5 className="font-semibold mb-4 text-gray-800 border-b pb-2 break-words">{roleDisplay} - Total: {total} / {max}</h5>
        {crits.map((c) => (
          <div key={c.key} className="mb-4 p-3 bg-gray-50 rounded-md">
            <h6 className="font-medium mb-2 text-gray-700 break-words">{c.name}</h6>
            <div className="flex space-x-1 mb-2">
              {Object.entries(c.levels).map(([val, info]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => !readOnly && onChange && onChange(c.key, parseInt(val))}
                  className={`flex-1 py-2 px-3 rounded text-xs font-medium transition-colors break-words ${
                    scores[c.key] == val
                      ? 'bg-blue-500 text-white shadow-md'
                      : readOnly
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  disabled={readOnly}
                >
                  {info.label.split(' = ')[1]}
                </button>
              ))}
            </div>
            <p className={`text-xs italic ${readOnly ? 'text-gray-500' : 'text-blue-600'} break-words`}>
              {c.levels[scores[c.key] || 0].desc}
            </p>
          </div>
        ))}
      </div>
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
                console.error('Error deleting image:', err);
                setSubmitStatus((prev) => ({ ...prev, [link]: 'Error al eliminar la imagen' }));
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
                console.error('Error inserting new line after image:', err);
                setSubmitStatus((prev) => ({ ...prev, [link]: 'Error al añadir texto después de la imagen' }));
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

  const encodeBody = (html) => {
    return base64EncodeUnicode(sanitizeInput(html));
  };

  const decodeBody = (encoded) => {
    if (!encoded) return <p className="text-gray-600 break-words">Sin contenido disponible.</p>;
    try {
      const html = base64DecodeUnicode(encoded);
      return <div className="ql-editor break-words leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />;
    } catch (err) {
      console.error('Error decoding body:', err);
      return <p className="text-gray-600 break-words">Error al decodificar contenido.</p>;
    }
  };

  const handleImageModalSubmit = (link) => {
    const quillRef = feedbackQuillRefs.current[link] || reportQuillRefs.current[link];
    if (!quillRef) return;
    const editor = quillRef.getEditor();
    let { url, width, height, align } = imageData[link] || {};
    if (!url) {
      setSubmitStatus((prev) => ({ ...prev, [link]: 'La URL de la imagen es obligatoria.' }));
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

  const AssignmentCard = ({ assignment, onClick }) => {
    const role = assignment.role;
    const nombre = assignment['Nombre Artículo'];
    const total = role !== 'Editor' ? getTotal(assignment.scores || {}, criteria[role] || []) : getTotal(assignment.scores || {}, criteria['Editor'] || []);
    const max = (criteria[role] || criteria['Editor'] || []).length * 2;
    const percent = total / max * 100;
    const statusColor = assignment.isCompleted ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';

    return (
      <div
        className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 cursor-pointer border border-gray-200 h-full flex flex-col justify-between"
        onClick={onClick}
      >
        <div>
          <h4 className="text-xl font-bold text-gray-800 mb-2 break-words">{nombre}</h4>
          <p className="text-sm text-gray-600 mb-3 break-words">Rol: {role}</p>
          <div className="flex items-center justify-between mb-4">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
              {assignment.isCompleted ? 'Completado' : 'Pendiente'}
            </span>
            <span className="text-sm font-medium text-gray-700">{percent.toFixed(0)}% Puntaje</span>
          </div>
          <p className="text-gray-500 text-sm break-words">{assignment.Estado || 'Sin estado'}</p>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-200">
          <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium">
            Ver Detalles
          </button>
        </div>
      </div>
    );
  };

  const renderFullAssignment = (assignment) => {
    const link = assignment['Link Artículo'];
    const role = assignment.role;
    const nombre = assignment['Nombre Artículo'];
    const isPending = !assignment.isCompleted;
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
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h5 className="text-lg font-semibold text-gray-800">Rúbrica de Revisor 1</h5>
                <button
                  onClick={() => toggleFeedback(link, 'rubric1')}
                  className="text-blue-600 hover:underline text-sm flex items-center"
                >
                  {expandedFeedback[link]?.rubric1 ? 'Ocultar' : 'Mostrar'}
                  <svg className={`w-4 h-4 ml-1 transform ${expandedFeedback[link]?.rubric1 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              {expandedFeedback[link]?.rubric1 && (
                <RubricViewer roleKey="Revisor 1" scores={assignment.rev1Scores} readOnly />
              )}
              <div className="flex items-center justify-between">
                <h5 className="text-lg font-semibold text-gray-800">Rúbrica de Revisor 2</h5>
                <button
                  onClick={() => toggleFeedback(link, 'rubric2')}
                  className="text-blue-600 hover:underline text-sm flex items-center"
                >
                  {expandedFeedback[link]?.rubric2 ? 'Ocultar' : 'Mostrar'}
                  <svg className={`w-4 h-4 ml-1 transform ${expandedFeedback[link]?.rubric2 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              {expandedFeedback[link]?.rubric2 && (
                <RubricViewer roleKey="Revisor 2" scores={assignment.rev2Scores} readOnly />
              )}
              <div className="p-4 bg-yellow-50 rounded-md">
                <p className="font-medium break-words">Implicación de revisores: {revPercent.toFixed(1)}% - {getDecisionText(revPercent)}</p>
              </div>
              <RubricViewer
                roleKey="Editor"
                scores={rubricScores[link] || {}}
                onChange={(key, val) => handleRubricChange(link, key, val)}
              />
              <div className="p-4 bg-green-50 rounded-md">
                <p className="font-medium break-words">Decisión general sugerida: {overallPercent.toFixed(1)}% - {getDecisionText(overallPercent)}</p>
              </div>
            </div>
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
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h5 className="text-lg font-semibold text-gray-800">Rúbrica de Revisor 1</h5>
                <button
                  onClick={() => toggleFeedback(link, 'rubric1')}
                  className="text-blue-600 hover:underline text-sm flex items-center"
                >
                  {expandedFeedback[link]?.rubric1 ? 'Ocultar' : 'Mostrar'}
                  <svg className={`w-4 h-4 ml-1 transform ${expandedFeedback[link]?.rubric1 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              {expandedFeedback[link]?.rubric1 && (
                <RubricViewer roleKey="Revisor 1" scores={assignment.rev1Scores} readOnly />
              )}
              <div className="flex items-center justify-between">
                <h5 className="text-lg font-semibold text-gray-800">Rúbrica de Revisor 2</h5>
                <button
                  onClick={() => toggleFeedback(link, 'rubric2')}
                  className="text-blue-600 hover:underline text-sm flex items-center"
                >
                  {expandedFeedback[link]?.rubric2 ? 'Ocultar' : 'Mostrar'}
                  <svg className={`w-4 h-4 ml-1 transform ${expandedFeedback[link]?.rubric2 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              {expandedFeedback[link]?.rubric2 && (
                <RubricViewer roleKey="Revisor 2" scores={assignment.rev2Scores} readOnly />
              )}
              <div className="p-4 bg-yellow-50 rounded-md">
                <p className="font-medium break-words">Implicación de revisores: {revPercent.toFixed(1)}% - {getDecisionText(revPercent)}</p>
              </div>
              <RubricViewer roleKey="Editor" scores={assignment.scores} readOnly />
              <div className="p-4 bg-green-50 rounded-md">
                <p className="font-medium break-words">Decisión general: {overallPercent.toFixed(1)}% - {getDecisionText(overallPercent)}</p>
              </div>
            </div>
          );
        } else {
          return <RubricViewer roleKey={role} scores={assignment.scores} readOnly />;
        }
      }
    };

    return (
      <div className="bg-white p-6 rounded-lg shadow-md space-y-6 w-full">
        <div className="flex justify-between items-start">
          <div>
            <h4 className="text-2xl font-bold text-gray-800 mb-2 break-words">{nombre}</h4>
            <p className="text-gray-600 break-words">Rol: {role} | Estado: {assignment.Estado}</p>
          </div>
          <button
            onClick={() => setSelectedAssignment(null)}
            className="text-blue-600 hover:underline flex items-center text-sm"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Volver a lista
          </button>
        </div>
        {!isAuth && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <div className="space-y-2">
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm mb-2"
                >
                  Abrir en Google Drive
                </a>
                <iframe
                  src={link ? link.replace('/edit', '/preview') : ''}
                  className="w-full h-[350px] lg:h-[500px] rounded-xl shadow border border-gray-200"
                  title="Vista previa del artículo"
                  sandbox="allow-same-origin allow-scripts"
                ></iframe>
              </div>
              {handleRenderRubric()}
            </div>
            <div className="lg:col-span-1 space-y-6">
              {role === 'Editor' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700 break-words">Retroalimentación de Revisor 1</label>
                    <button
                      onClick={() => toggleFeedback(link, 'feedback1')}
                      className="text-blue-600 hover:underline text-sm flex items-center"
                    >
                      {expandedFeedback[link]?.feedback1 ? 'Ocultar' : 'Mostrar'}
                      <svg className={`w-4 h-4 ml-1 transform ${expandedFeedback[link]?.feedback1 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  {expandedFeedback[link]?.feedback1 && (
                    <div className="bg-gray-50 p-4 rounded-md border border-gray-200 max-h-48 overflow-y-auto">
                      {decodeBody(assignment.feedback1)}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700 break-words">Retroalimentación de Revisor 2</label>
                    <button
                      onClick={() => toggleFeedback(link, 'feedback2')}
                      className="text-blue-600 hover:underline text-sm flex items-center"
                    >
                      {expandedFeedback[link]?.feedback2 ? 'Ocultar' : 'Mostrar'}
                      <svg className={`w-4 h-4 ml-1 transform ${expandedFeedback[link]?.feedback2 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  {expandedFeedback[link]?.feedback2 && (
                    <div className="bg-gray-50 p-4 rounded-md border border-gray-200 max-h-48 overflow-y-auto">
                      {decodeBody(assignment.feedback2)}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700 break-words">Informe de Revisor 1</label>
                    <button
                      onClick={() => toggleFeedback(link, 'informe1')}
                      className="text-blue-600 hover:underline text-sm flex items-center"
                    >
                      {expandedFeedback[link]?.informe1 ? 'Ocultar' : 'Mostrar'}
                      <svg className={`w-4 h-4 ml-1 transform ${expandedFeedback[link]?.informe1 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  {expandedFeedback[link]?.informe1 && (
                    <div className="bg-gray-50 p-4 rounded-md border border-gray-200 max-h-48 overflow-y-auto">
                      {decodeBody(assignment.informe1)}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700 break-words">Informe de Revisor 2</label>
                    <button
                      onClick={() => toggleFeedback(link, 'informe2')}
                      className="text-blue-600 hover:underline text-sm flex items-center"
                    >
                      {expandedFeedback[link]?.informe2 ? 'Ocultar' : 'Mostrar'}
                      <svg className={`w-4 h-4 ml-1 transform ${expandedFeedback[link]?.informe2 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  {expandedFeedback[link]?.informe2 && (
                    <div className="bg-gray-50 p-4 rounded-md border border-gray-200 max-h-48 overflow-y-auto">
                      {decodeBody(assignment.informe2)}
                    </div>
                  )}
                </div>
              )}
              {isPending ? (
                <div className="space-y-6">
                  <button
                    onClick={() => toggleTutorial(link)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
                  >
                    {tutorialVisible[link] ? 'Ocultar Tutorial' : 'Ver Tutorial'}
                  </button>
                  {tutorialVisible[link] && <Tutorial role={role} />}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 break-words">
                      {role === 'Editor' ? 'Retroalimentación Final al Autor' : 'Retroalimentación al Autor'}
                    </label>
                    <ReactQuill
                      ref={(el) => (feedbackQuillRefs.current[link] = el)}
                      value={feedback[link] || ''}
                      onChange={debouncedSetFeedback(link)}
                      modules={modules}
                      formats={formats}
                      placeholder={role === 'Editor' ? 'Redacta una retroalimentación final sensible, sintetizando las opiniones de los revisores y la tuya.' : 'Escribe tu retroalimentación aquí...'}
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
                      <button
                        onClick={() => handleVote(link, 'si')}
                        className={`px-4 py-2 rounded-md ${vote[link] === 'si' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} transition-colors text-sm`}
                      >
                        Sí
                      </button>
                      <button
                        onClick={() => handleVote(link, 'no')}
                        className={`px-4 py-2 rounded-md ${vote[link] === 'no' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} transition-colors text-sm`}
                      >
                        No
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <button
                      onClick={() => handleSubmitRubric(link, role)}
                      disabled={!isRubricComplete(link, role)}
                      className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      Enviar Rúbrica
                    </button>
                    {rubricStatus[link] && (
                      <p className={`text-sm mt-2 ${rubricStatus[link].includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                        {rubricStatus[link]}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleSubmit(link, role, feedback[link], report[link], vote[link])}
                    disabled={!vote[link] || !feedback[link] || !report[link]}
                    className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    Enviar Revisión (Feedback, Informe, Voto)
                  </button>
                  {submitStatus[link] && (
                    <p className={`text-sm mt-2 ${submitStatus[link].includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                      {submitStatus[link]}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <button
                    onClick={() => toggleTutorial(link)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
                  >
                    {tutorialVisible[link] ? 'Ocultar Tutorial' : 'Ver Tutorial'}
                  </button>
                  {tutorialVisible[link] && <Tutorial role={role} />}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 break-words">Retroalimentación Enviada</label>
                    <div className="bg-gray-50 p-4 rounded-md border border-gray-200 max-h-48 overflow-y-auto">
                      {decodeBody(feedback[link] || 'Sin retroalimentación.')}
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
                </div>
              )}
              {showImageModal[link] && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
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
                      <button
                        onClick={() => setShowImageModal((prev) => ({ ...prev, [link]: false }))}
                        className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 text-sm"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleImageModalSubmit(link)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                      >
                        {isEditingImage[link] ? 'Actualizar' : 'Insertar'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {isAuth && (
          <div className="space-y-6">
            <h5 className="text-lg font-semibold text-gray-800">Retroalimentación del Editor</h5>
            <div className="bg-gray-50 p-4 rounded-md border border-gray-200 max-h-48 overflow-y-auto">
              {decodeBody(assignment.feedbackEditor)}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800">
            {isAuthor ? 'Mis Artículos' : 'Panel de Revisión'}
          </h2>
          <div className="flex items-center space-x-4">
            <span className="text-gray-600">Bienvenido, {user?.name || 'Usuario'}</span>
            <button
              onClick={onLogout}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded-md mb-6">
            {error}
          </div>
        )}
        {!isAuthor && (
          <div className="mb-6">
            <NewsUploadSection />
          </div>
        )}
        <div className="mb-6">
          <div className="flex space-x-4 border-b">
            <button
              onClick={() => setActiveTab('assignments')}
              className={`pb-2 px-4 text-sm font-medium ${activeTab === 'assignments' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
            >
              Asignaciones Pendientes ({pendingAssignments.length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`pb-2 px-4 text-sm font-medium ${activeTab === 'completed' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
            >
              Asignaciones Completadas ({completedAssignments.length})
            </button>
            {isChief && (
              <button
                onClick={() => setActiveTab('asignar')}
                className={`pb-2 px-4 text-sm font-medium ${activeTab === 'asignar' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
              >
                Asignar Artículos
              </button>
            )}
          </div>
        </div>
        <ErrorBoundary>
          {!isAuthor && <TaskSection user={user} />}
          {isChief && activeTab === 'asignar' && <AssignSection user={user} />}
        </ErrorBoundary>
        {loading ? (
          <div className="text-center text-gray-600">Cargando asignaciones...</div>
        ) : selectedAssignment ? (
          renderFullAssignment(selectedAssignment)
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {(activeTab === 'assignments' ? pendingAssignments : completedAssignments).map((assignment) => (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                onClick={() => setSelectedAssignment(assignment)}
              />
            ))}
          </div>
        )}
        {pendingAssignments.length === 0 && activeTab === 'assignments' && !loading && !selectedAssignment && (
          <div className="text-center text-gray-600">No hay asignaciones pendientes.</div>
        )}
        {completedAssignments.length === 0 && activeTab === 'completed' && !loading && !selectedAssignment && (
          <div className="text-center text-gray-600">No hay asignaciones completadas.</div>
        )}
      </div>
    </div>
  );
}