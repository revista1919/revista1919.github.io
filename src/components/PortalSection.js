 import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
   import Papa from 'papaparse';
   import NewsUploadSection from './NewsUploadSection';
   import ReactQuill, { Quill } from 'react-quill';
   import 'react-quill/dist/quill.snow.css';
   import ImageResize from 'quill-image-resize-module-react';
   import { debounce } from 'lodash';
   import { useTranslation } from 'react-i18next';

   Quill.register('modules/imageResize', ImageResize);

   const ASSIGNMENTS_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS1BhqyalgqRIACNtlt1C0cDSBqBXCtPABA8WnXFOnbDXkLauCpLjelu9GHv7i1XLvPY346suLE9Lag/pub?gid=0&single=true&output=csv';
   const RUBRIC_CSV_BASE = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS1BhqyalgqRIACNtlt1C0cDSBqBXCtPABA8WnXFOnbDXkLauCpLjelu9GHv7i1XLvPY346suLE9Lag/pub';
   const RUBRIC_SHEET1_CSV = `${RUBRIC_CSV_BASE}?gid=0&single=true&output=csv`; // Revisor 1
   const RUBRIC_SHEET2_CSV = `${RUBRIC_CSV_BASE}?gid=1438370398&single=true&output=csv`; // Revisor 2
   const RUBRIC_SHEET3_CSV = `${RUBRIC_CSV_BASE}?gid=1972050001&single=true&output=csv`; // Editor
   const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwfqkILujerrCJ1tR15WbIl7CgRYFNaQJs9ubLH9SqsEQbo0OcKrtEtFKbrUKwzF6cY/exec'; // Reemplaza con la URL del GAS que crearás

   const CRITERIA = {
     'Revisor 1': [
       { id: 'Gramática y ortografía', label: 'Gramática y ortografía', desc: 'Muchos errores graves, difícil de leer. / Algunos errores, comprensible. / Muy pocos errores, texto limpio.' },
       { id: 'Claridad y coherencia', label: 'Claridad y coherencia', desc: 'Confuso, incoherente. / A veces confuso pero entendible. / Claro, preciso y coherente.' },
       { id: 'Estructura y organización', label: 'Estructura y organización', desc: 'Desordenado, sin partes claras. / Con partes presentes pero débiles. / Introducción, desarrollo y conclusión bien diferenciados.' },
       { id: 'Citación y referencias', label: 'Citación y referencias', desc: 'Sin fuentes o mal citadas. / Fuentes presentes pero con errores. / Fuentes confiables y bien citadas.' },
     ],
     'Revisor 2': [
       { id: 'Relevancia del tema', label: 'Relevancia del tema', desc: 'Tema irrelevante o fuera de contexto. / Tema válido pero superficial. / Tema pertinente y atractivo.' },
       { id: 'Rigor en el uso de fuentes', label: 'Rigor en el uso de fuentes', desc: 'Sin fuentes o poco confiables. / Pocas fuentes, algunas dudosas. / Fuentes variadas, confiables y bien usadas.' },
       { id: 'Originalidad y creatividad', label: 'Originalidad y creatividad', desc: 'Repite información sin análisis. / Combina ideas sin mucha elaboración. / Aporta ideas propias y reflexiones originales.' },
       { id: 'Calidad de los argumentos', label: 'Calidad de los argumentos', desc: 'Confusos, sin pruebas o incoherentes. / Claros pero débiles. / Sólidos, bien fundamentados y convincentes.' },
     ],
     'Editor': [
       { id: 'Grado de modificaciones', label: 'Grado de modificaciones', desc: 'Requirió demasiadas correcciones, casi reescribir. / Necesitó varias correcciones, pero manejables. / Solo ajustes menores.' },
       { id: 'Calidad final del texto', label: 'Calidad final del texto', desc: 'Aún con cambios, sigue débil o poco claro. / Texto aceptable, aunque mejorable. / Texto sólido, claro y publicable.' },
       { id: 'Aporte global del ensayo', label: 'Aporte global del ensayo', desc: 'Poca relevancia o repetitivo. / Interesante, aunque no destaca. / Muy valioso, innovador o inspirador.' },
       { id: 'Potencial motivador', label: 'Potencial motivador (opcional)', desc: 'No motiva ni aporta al espíritu de la revista. / Puede motivar a algunos estudiantes. / Inspira, invita a reflexionar y dialogar.' },
       { id: 'Decisión final', label: 'Decisión final', desc: 'Rechazar. / Aceptar con cambios mayores. / Aceptar (con o sin cambios menores).', isDecision: true },
     ],
   };

export default function PortalSection({ user, onLogout }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({});
  const [report, setReport] = useState({});
  const [vote, setVote] = useState({});
  const [tutorialVisible, setTutorialVisible] = useState({});
  const [submitStatus, setSubmitStatus] = useState({});
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('assignments');
  const [showImageModal, setShowImageModal] = useState({});
  const [isEditingImage, setIsEditingImage] = useState({});
  const [imageData, setImageData] = useState({});
  const [editingRange, setEditingRange] = useState({});
  const [completedPanelOpen, setCompletedPanelOpen] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(null);
  const [rubricScores, setRubricScores] = useState({ rev1: {}, rev2: {}, editor: {} });
  const [localRubric, setLocalRubric] = useState({});
  const feedbackQuillRefs = useRef({});
  const reportQuillRefs = useRef({});

  const roleMap = { 'Revisor 1': 'rev1', 'Revisor 2': 'rev2', 'Editor': 'editor' };

  const getMaxScore = (role) => role === 'Editor' ? 10 : 8;

  const fetchAssignments = async () => {
    try {
      const response = await fetch(ASSIGNMENTS_CSV, { cache: 'no-store' });
      if (!response.ok) throw new Error('Error al cargar el archivo CSV');
      const csvText = await response.text();
      return new Promise((resolve, reject) => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          delimiter: ',',
          transform: (value) => value.trim(),
          complete: ({ data }) => {
            console.log('Parsed assignments data:', data);
            const isAuthor = data.some((row) => row['Autor'] === user.name);
            let parsedAssignments = [];
            if (isAuthor) {
              parsedAssignments = data
                .filter((row) => row['Autor'] === user.name)
                .map((row) => {
                  const num = 3; // Editor feedback
                  return {
                    id: row['Nombre Artículo'],
                    'Nombre Artículo': row['Nombre Artículo'] || 'Sin título',
                    Estado: row['Estado'],
                    role: 'Autor',
                    feedbackEditor: row['Feedback 3'] || 'Sin retroalimentación del editor aún.',
                    isCompleted: !!row['Feedback 3'],
                  };
                });
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
                  return {
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
                });
            }
            setAssignments(parsedAssignments);
            parsedAssignments.forEach((assignment) => {
              if (!isAuthor) {
                setVote((prev) => ({ ...prev, [assignment['Link Artículo']]: assignment.vote }));
                setFeedback((prev) => ({ ...prev, [assignment['Link Artículo']]: assignment.feedback }));
                setReport((prev) => ({ ...prev, [assignment['Link Artículo']]: assignment.report }));
              }
            });
            resolve();
          },
          error: (err) => {
            console.error('Error al parsear CSV:', err);
            reject(new Error('Error al cargar asignaciones'));
          },
        });
      });
    } catch (err) {
      console.error('Error al cargar asignaciones:', err);
      throw new Error('Error al conectar con el servidor');
    }
  };

  const fetchRubrics = async () => {
    try {
      const [sheet1Res, sheet2Res, sheet3Res] = await Promise.all([
        fetch(RUBRIC_SHEET1_CSV, { cache: 'no-store' }),
        fetch(RUBRIC_SHEET2_CSV, { cache: 'no-store' }),
        fetch(RUBRIC_SHEET3_CSV, { cache: 'no-store' }),
      ]);
      if (!sheet1Res.ok || !sheet2Res.ok || !sheet3Res.ok) throw new Error('Error al cargar hojas de rúbrica');
      const [sheet1Text, sheet2Text, sheet3Text] = await Promise.all([
        sheet1Res.text(),
        sheet2Res.text(),
        sheet3Res.text(),
      ]);
      const parseRubricSheet = (text, criteria) => {
        const data = Papa.parse(text, { header: true, skipEmptyLines: true }).data;
        const scores = {};
        data.forEach((row) => {
          const articleName = row['Nombre del Artículo']?.trim();
          if (articleName) {
            scores[articleName] = { total: 0 };
            criteria.forEach((c) => {
              const score = parseInt(row[c.id]) || 0;
              scores[articleName][c.id] = score;
              scores[articleName].total += score;
            });
          }
        });
        return scores;
      };
      const rev1Scores = parseRubricSheet(sheet1Text, CRITERIA['Revisor 1']);
      const rev2Scores = parseRubricSheet(sheet2Text, CRITERIA['Revisor 2']);
      const editorScores = parseRubricSheet(sheet3Text, CRITERIA['Editor']);
      setRubricScores({ rev1: rev1Scores, rev2: rev2Scores, editor: editorScores });
    } catch (err) {
      console.error('Error al cargar rúbricas:', err);
      // No throw, continue without rubric scores
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await fetchAssignments();
        await fetchRubrics();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user.name]);

  const isAuthor = assignments.length > 0 && assignments[0].role === 'Autor';

  const pendingAssignments = useMemo(() => assignments.filter((a) => !a.isCompleted), [assignments]);
  const completedAssignments = useMemo(() => assignments.filter((a) => a.isCompleted), [assignments]);
  const selectedAssignment = completedAssignments.find((a) => a.id === selectedAssignmentId);

  const handleVote = (link, value) => {
    setVote((prev) => ({ ...prev, [link]: value }));
  };

  const handleRubricChange = useCallback((link, criterionId, score) => {
    setLocalRubric((prev) => {
      const current = prev[link] || {};
      const newScores = { ...current, [criterionId]: score };
      const criteria = CRITERIA[assignments.find(a => a['Link Artículo'] === link)?.role || 'Revisor 1'];
      const total = criteria.reduce((sum, c) => sum + (newScores[c.id] || 0), 0);
      return { ...prev, [link]: { ...newScores, total } };
    });
  }, [assignments]);

  const getRubricScoresForAssignment = (assignment) => {
    const roleKey = roleMap[assignment.role];
    return rubricScores[roleKey]?.[assignment.id] || {};
  };

  const getRevScoresForEditor = (articleName) => ({
    rev1: rubricScores.rev1[articleName] || { total: 0 },
    rev2: rubricScores.rev2[articleName] || { total: 0 },
  });

  const getDecisionRecommendation = (rev1Total, rev2Total) => {
    const avg = ((rev1Total + rev2Total) / 16) * 100;
    if (avg >= 85) return 'Aceptar sin cambios';
    if (avg >= 70) return 'Aceptar con cambios menores';
    if (avg >= 50) return 'Revisión mayor antes de publicar';
    return 'Rechazar';
  };

  const handleSubmit = async (link, role, feedbackText, reportText, voteValue) => {
    const articleName = assignments.find(a => a['Link Artículo'] === link)?.id;
    const rubricData = localRubric[link] || getRubricScoresForAssignment(assignments.find(a => a['Link Artículo'] === link));
    const data = {
      link,
      role,
      vote: voteValue || '',
      feedback: encodeBody(feedbackText || ''),
      report: encodeBody(reportText || ''),
      articleName,
      rubric: JSON.stringify(rubricData),
    };

    console.log('Sending assignment data:', data);

    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      console.log('Assignment request sent (no-cors, assuming success)');
      setSubmitStatus((prev) => ({ ...prev, [link]: 'Enviado exitosamente (CORS workaround applied)' }));
      // Clear local rubric after submit
      setLocalRubric((prev) => { const newPrev = { ...prev }; delete newPrev[link]; return newPrev; });
      await fetchAssignments();
      await fetchRubrics();
    } catch (err) {
      console.error('Error al enviar datos:', err);
      setSubmitStatus((prev) => ({ ...prev, [link]: 'Error al enviar: ' + err.message }));
    }
  };

  const toggleTutorial = (link) => {
    setTutorialVisible((prev) => ({ ...prev, [link]: !prev[link] }));
  };

  const getTutorialText = (role) => {
    if (role === "Revisor 1") {
      return 'Como Revisor 1, tu rol es revisar aspectos técnicos como gramática, ortografía, citación de fuentes, detección de contenido generado por IA, coherencia lógica y estructura general del artículo. Deja comentarios detallados en el documento de Google Drive para sugerir mejoras. Asegúrate de que el lenguaje sea claro y académico. Debes dejar tu retroalimentación al autor en la casilla correspondiente. Además debes dejar un informe resumido explicando tu observaciones para guiar al editor. Por último, en la casilla de voto debes poner "sí" si apruebas el artículo, y "no" si lo rechazas. Además, completa la rúbrica de evaluación para Forma, estilo y técnica (máx. 8 pts).===';
    } else if (role === "Revisor 2") {
      return 'Como Revisor 2, enfócate en el contenido sustantivo: verifica la precisión de las fuentes, la seriedad y originalidad del tema, la relevancia de los argumentos, y la contribución al campo de estudio. Evalúa si el artículo es innovador y bien fundamentado. Deja comentarios en el documento de Google Drive. Debes dejar tu retroalimentación al autor en la casilla correspondiente. Además debes dejar un informe resumido explicando tu observaciones para guiar al editor. Por último, en la casilla de voto debes poner "sí" si apruebas el artículo, y "no" si lo rechazas. Además, completa la rúbrica de evaluación para Contenido y originalidad (máx. 8 pts).===';
    } else if (role === "Editor") {
      return `Como Editor, tu responsabilidad es revisar las retroalimentaciones e informes de los revisores, integrarlas con tu propia evaluación, y redactar una retroalimentación final sensible y constructiva para el autor. Corrige directamente el texto si es necesario y decide el estado final del artículo. Usa el documento de Google Drive para ediciones. Debes dejar una retroalimentación al autor sintetizando las que dejaron los revisores. Tu deber es que el mensaje sea acertado y sensible, sin desmotivar al autor. Para esto debes usar la técnica del "sándwich". Si no sabes qué es, entra aquí[](https://www.santanderopenacademy.com/es/blog/tecnica-sandwich.html). Luego deja tu informe con los cambios realizados, deben ser precisos y académicos. Por último, en la casilla de voto debes poner "sí" si apruebas el artículo, y "no" si lo rechazas. Además, completa la rúbrica de Síntesis y decisión final (máx. 10 pts), considerando los puntajes de los revisores.===`;
    }
    return "";
  };

  const Tutorial = ({ role }) => {
    const tutorialText = getTutorialText(role);
    return (
      <div className="text-gray-800 bg-gray-50 p-4 rounded-md border border-gray-200 leading-relaxed">
        {decodeBody(tutorialText)}
      </div>
    );
  };

  const RubricForm = ({ role, link, scores, onChange }) => {
    const criteria = CRITERIA[role];
    const total = scores.total || criteria.reduce((sum, c) => sum + (scores[c.id] || 0), 0);
    const max = getMaxScore(role);

    const getScoreClass = (current, target) => {
      if (current === target) {
        return target === 0 ? 'bg-red-500 text-white' : target === 1 ? 'bg-yellow-500 text-white' : 'bg-green-500 text-white';
      }
      return 'bg-gray-100 text-gray-700 hover:bg-gray-200';
    };

    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Rúbrica de Evaluación</label>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 p-2 text-left">Criterio</th>
                <th className="border border-gray-300 p-2 text-center">0 ❌</th>
                <th className="border border-gray-300 p-2 text-center">1 ⚖️</th>
                <th className="border border-gray-300 p-2 text-center">2 ✅</th>
              </tr>
            </thead>
            <tbody>
              {criteria.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="border border-gray-300 p-2">
                    <div className="font-medium text-sm">{c.label}</div>
                    <div className="mt-1 space-y-1 text-xs">
                      {c.desc.split('/').map((level, i) => (
                        <div
                          key={i}
                          className={`p-1 rounded ${
                            i === 0 ? 'bg-red-50 text-red-700' : i === 1 ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'
                          }`}
                        >
                          {level.trim()}
                        </div>
                      ))}
                    </div>
                  </td>
                  {[0, 1, 2].map((s) => (
                    <td key={s} className="border border-gray-300 p-1">
                      <button
                        onClick={() => onChange(link, c.id, s)}
                        className={`w-full px-2 py-1 rounded text-xs font-medium ${getScoreClass(scores[c.id], s)}`}
                      >
                        {s} {s === 0 ? '❌' : s === 1 ? '⚖️' : '✅'}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="bg-blue-50">
                <td className="border border-gray-300 p-2 font-semibold">Total</td>
                <td colSpan={3} className="border border-gray-300 p-2 text-right font-semibold text-lg">
                  {total} / {max}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const RevScoresDisplay = ({ revScores, role }) => (
    <div className="space-y-4">
      <h6 className="font-semibold text-gray-800">{role}: {revScores.total}/8</h6>
      <table className="w-full border-collapse border border-gray-300 text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-1">Criterio</th>
            <th className="border p-1">Puntaje</th>
          </tr>
        </thead>
        <tbody>
          {CRITERIA[role === 'rev1' ? 'Revisor 1' : 'Revisor 2'].map((c) => (
            <tr key={c.id} className="hover:bg-gray-50">
              <td className="border p-1 font-medium">{c.label}</td>
              <td className="border p-1 text-center font-semibold text-lg px-2">
                {revScores[c.id] || 0} {revScores[c.id] === 0 ? '❌' : revScores[c.id] === 1 ? '⚖️' : '✅'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const RubricSummary = ({ role, scores }) => {
    const total = scores.total || 0;
    const max = getMaxScore(role);
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Resumen Rúbrica</label>
        <div className="bg-gray-50 p-3 rounded-md border">
          <p className="text-sm font-semibold">Total: {total} / {max}</p>
        </div>
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
    toolbar: [
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['link', 'image'],
      [{ 'align': ['', 'center', 'right', 'justify'] }],
      [{ 'size': ['small', false, 'large'] }],
      ['clean']
    ],
    imageResize: {
      parchment: Quill.import('parchment'),
      modules: ['Resize', 'DisplaySize', 'Toolbar'],
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
              setSubmitStatus((prev) => ({ ...prev, [this.quill.link]: 'No hay selección activa para eliminar' }));
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
                editor.deleteText(deleteIndex, deleteLength, Quill.sources.USER);
                return false;
              } catch (err) {
                console.error('Error deleting image:', err);
                setSubmitStatus((prev) => ({ ...prev, [this.quill.link]: 'Error al eliminar la imagen' }));
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
                editor.insertText(range.index + 1, '\n', Quill.sources.USER);
                editor.setSelection(range.index + 2, Quill.sources.SILENT);
                return false;
              } catch (err) {
                console.error('Error inserting new line after image:', err);
                setSubmitStatus((prev) => ({ ...prev, [this.quill.link]: 'Error al añadir texto después de la imagen' }));
                return false;
              }
            }
            return true;
          },
        },
      },
    },
  }), []);

  const formats = useMemo(() => [
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet',
    'link', 'image',
    'align',
    'size'
  ], []);

  const sanitizeInput = useCallback((input) => {
    if (!input) return '';
    return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/on\w+="[^"]*"/gi, '')
                .replace(/\s+/g, ' ')
                .trim();
  }, []);

  const encodeBody = (html) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const encodeNode = (node, parentAlign = '') => {
        if (node.nodeType === 3) return node.textContent;
        let children = Array.from(node.childNodes).map(n => encodeNode(n, getAlign(node) || parentAlign)).join('');
        if (node.tagName === 'STRONG' || node.tagName === 'B') {
          return '*' + children + '*';
        } else if (node.tagName === 'EM' || node.tagName === 'I') {
          return '/' + children + '/';
        } else if (node.tagName === 'U') {
          return '$' + children + '$';
        } else if (node.tagName === 'S' || node.tagName === 'STRIKE') {
          return '~' + children + '~';
        } else if (node.tagName === 'A') {
          return children + '(' + node.href + ')';
        } else if (node.tagName === 'IMG') {
          let width = node.getAttribute('width') || node.style.width || 'auto';
          let height = node.getAttribute('height') || node.style.height || 'auto';
          const align = getAlign(node) || parentAlign || 'left';
          if (width !== 'auto' && !width.match(/%|px$/)) width += 'px';
          if (height !== 'auto' && !height.match(/%|px$/)) height += 'px';
          return `[img:${node.src},${width},${height},${align}]`;
        } else if (node.tagName === 'SPAN') {
          let size = '';
          if (node.classList.contains('ql-size-small')) size = 'small';
          else if (node.classList.contains('ql-size-large')) size = 'big';
          if (size) {
            return `[size:${size}]` + children + '[/size]';
          }
          return children;
        } else if (node.tagName === 'P' || node.tagName === 'DIV') {
          const align = getAlign(node);
          let size = '';
          let innerChildren = children;
          if (node.childNodes.length === 1 && node.childNodes[0].tagName === 'SPAN' && node.childNodes[0].classList) {
            const span = node.childNodes[0];
            if (span.classList.contains('ql-size-small')) size = 'small';
            else if (span.classList.contains('ql-size-large')) size = 'big';
            if (size) {
              innerChildren = Array.from(span.childNodes).map(n => encodeNode(n, align)).join('');
            }
          }
          if (!size) size = 'normal';
          let params = [];
          if (size !== 'normal') params.push(size);
          if (align) params.push(align);
          let prefix = '';
          if (params.length > 0) {
            prefix = '(' + params.join(',') + ')';
          }
          return prefix + innerChildren + '===';
        } else if (node.tagName === 'BR') {
          return '===';
        } else if (node.tagName === 'UL') {
          const items = Array.from(node.childNodes)
            .filter(n => n.tagName === 'LI')
            .map(li => '- ' + encodeNode(li, parentAlign));
          return items.join('===') + '===';
        } else if (node.tagName === 'OL') {
          let counter = 1;
          const items = Array.from(node.childNodes)
            .filter(n => n.tagName === 'LI')
            .map(li => (counter++) + '. ' + encodeNode(li, parentAlign));
          return items.join('===') + '===';
        } else if (node.tagName === 'LI') {
          return children;
        }
        return children;
      };
      let encoded = Array.from(doc.body.childNodes).map(n => encodeNode(n)).join('');
      return sanitizeInput(encoded.replace(/===+/g, '==='));
    } catch (err) {
      console.error('Error encoding body:', err);
      return '';
    }
  };

  const getAlign = (node) => {
    if (node.style && node.style.textAlign) return node.style.textAlign;
    if (node.classList) {
      if (node.classList.contains('ql-align-center')) return 'center';
      if (node.classList.contains('ql-align-right')) return 'right';
      if (node.classList.contains('ql-align-justify')) return 'justify';
    }
    return '';
  };

  const isLikelyImageUrl = (url) => {
    if (!url) return false;
    const u = url.toLowerCase();
    return (
      /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/.test(u) ||
      /googleusercontent|gstatic|ggpht|google\.(com|cl).*\/(img|images|url)/.test(u) ||
      /^data:image\/[a-zA-Z+]+;base64,/.test(u)
    );
  };

  const normalizeUrl = (u) => {
    let url = (u || "").trim();
    if (/^https?:[^/]/i.test(url)) {
      url = url.replace(/^https?:/i, (m) => m + "//");
    }
    return url;
  };

  const decodeBody = (body) => {
    if (!body) return <p className="text-gray-600">Sin contenido disponible.</p>;
    const paragraphs = String(body)
      .split("===")
      .filter((p) => p.trim() !== "");
    const content = [];
    let i = 0;
    while (i < paragraphs.length) {
      let p = paragraphs[i].trim();
      if (p.startsWith('- ')) {
        const items = [];
        while (i < paragraphs.length && paragraphs[i].trim().startsWith('- ')) {
          const itemText = paragraphs[i].trim().slice(2);
          items.push(renderParagraph(itemText));
          i++;
        }
        content.push(
          <ul key={content.length} className="mb-4 list-disc pl-6">
            {items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ul>
        );
        continue;
      } else if (/^\d+\.\s/.test(p)) {
        const items = [];
        while (i < paragraphs.length && /^\d+\.\s/.test(paragraphs[i].trim())) {
          const itemText = paragraphs[i].trim().replace(/^\d+\.\s/, '');
          items.push(renderParagraph(itemText));
          i++;
        }
        content.push(
          <ol key={content.length} className="mb-4 list-decimal pl-6">
            {items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ol>
        );
        continue;
      } else {
        content.push(
          <div
            key={content.length}
            className="mb-4 leading-relaxed break-words"
            style={{ clear: "both" }}
          >
            {renderParagraph(p)}
          </div>
        );
        i++;
      }
    }
    return content;
  };

  const renderParagraph = (p) => {
    let text = p.trim();
    const placeholders = [];
    const TOK = (i) => `__TOK${i}__`;

    let align = "left";
    let size = "normal";
    if (text.startsWith('(')) {
      const endIdx = text.indexOf(')');
      if (endIdx !== -1) {
        const paramStr = text.slice(1, endIdx);
        const params = paramStr.split(',').map(p => p.trim());
        params.forEach(p => {
          if (['small', 'big', 'normal'].includes(p)) size = p;
          if (['left', 'center', 'right', 'justify'].includes(p)) align = p;
        });
        text = text.slice(endIdx + 1).trim();
      }
    }

    const imgPattern = /\[img:([^\]]*?)(?:,(\d*(?:px|%)?|auto))?(?:,(\d*(?:px|%)?|auto))?(?:,(left|center|right|justify))?\]/gi;
    text = text.replace(imgPattern, (_, url, width = "auto", height = "auto", imgAlign = "left") => {
      if (width !== "auto" && width && !width.match(/%|px$/)) width += 'px';
      if (height !== "auto" && height && !height.match(/%|px$/)) height += 'px';
      const id = placeholders.length;
      placeholders.push({ type: "image", url: normalizeUrl(url), width, height, align: imgAlign });
      return TOK(id);
    });

    const linkPattern = /\b([^\s(]+)\((https?:\/\/[^\s)]+)\)/gi;
    text = text.replace(linkPattern, (_, word, url) => {
      const id = placeholders.length;
      placeholders.push({ type: "link", word, url });
      return TOK(id);
    });

    const urlPattern = /(?:https?:\/\/[^\s)]+|^data:image\/[a-zA-Z+]+;base64,[^\s)]+)/gi;
    text = text.replace(urlPattern, (u) => {
      if (placeholders.some((ph) => ph.url === u)) return u;
      const id = placeholders.length;
      placeholders.push({ type: isLikelyImageUrl(u) ? "image" : "url", url: u });
      return TOK(id);
    });

    text = text.replace(/\[size:([^\]]+)\](.*?)\[\/size\]/gs, (_, sz, content) => {
      const id = placeholders.length;
      placeholders.push({ type: "size", size: sz, content });
      return TOK(id);
    });

    text = text.replace(/<<ESC_(\d+)>>/g, (_, code) => String.fromCharCode(Number(code)));

    const styledContent = renderStyledText(text, placeholders);

    let fontSizeStyle;
    if (size === 'small') fontSizeStyle = '0.75em';
    else if (size === 'big') fontSizeStyle = '1.5em';
    else fontSizeStyle = 'inherit';

    const alignStyle = {
      textAlign: align,
      fontSize: fontSizeStyle,
      width: '100%',
      display: 'block',
      margin: align === 'center' ? '0 auto' : '0',
    };

    return (
      <div style={alignStyle}>
        {styledContent}
      </div>
    );
  };

  const renderStyledText = (text, placeholders) => {
    text = text.replace(/\\([*/_$~])/g, (_, char) => `<<ESC_${char.charCodeAt(0)}>>`);

    const parts = text.split(/(__TOK\d+__)/g);
    const out = [];
    let buf = "";
    let bold = false;
    let italic = false;
    let underline = false;
    let strike = false;
    let key = 0;

    for (const part of parts) {
      if (/^__TOK\d+__$/.test(part)) {
        if (buf) {
          out.push(
            <span
              key={key++}
              style={{
                fontWeight: bold ? "bold" : "normal",
                fontStyle: italic ? "italic" : "normal",
                textDecoration: `${underline ? "underline" : ""} ${strike ? "line-through" : ""}`.trim(),
              }}
            >
              {buf}
            </span>
          );
          buf = "";
        }
        const idx = Number(part.match(/\d+/)[0]);
        const ph = placeholders[idx];
        if (!ph) continue;
        if (ph.type === "link") {
          out.push(
            <a
              key={key++}
              href={normalizeUrl(ph.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline hover:text-blue-800 transition-colors duration-200"
            >
              {ph.word}
            </a>
          );
        } else if (ph.type === "image") {
          let imgStyle = {
            width: ph.width !== 'auto' ? ph.width : '100%',
            height: ph.height !== 'auto' ? ph.height : 'auto',
            display: 'block',
            marginLeft: ph.align === 'center' ? 'auto' : '0',
            marginRight: ph.align === 'center' ? 'auto' : '0',
            float: ph.align === 'left' || ph.align === 'right' ? ph.align : 'none',
            maxWidth: '100%',
            marginTop: '8px',
            marginBottom: '8px',
          };
          if (ph.align === 'justify') {
            imgStyle = {
              ...imgStyle,
              width: '100%',
              marginLeft: '0',
              marginRight: '0',
              float: 'none',
            };
          }
          out.push(
            <img
              key={key++}
              src={normalizeUrl(ph.url)}
              alt="Imagen"
              className="max-w-full h-auto rounded-md"
              style={imgStyle}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = "https://via.placeholder.com/800x450?text=Imagen+no-disponible";
              }}
            />
          );
        } else if (ph.type === "url") {
          out.push(
            <a
              key={key++}
              href={normalizeUrl(ph.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline hover:text-blue-800 transition-colors duration-200"
            >
              {ph.url}
            </a>
          );
        } else if (ph.type === "size") {
          let fontSizeStyle;
          if (ph.size === 'small') fontSizeStyle = '0.75em';
          else if (ph.size === 'big') fontSizeStyle = '1.5em';
          else fontSizeStyle = 'inherit';
          out.push(
            <span key={key++} style={{ fontSize: fontSizeStyle }}>
              {renderStyledText(ph.content, placeholders)}
            </span>
          );
        }
        continue;
      }
      for (const ch of part) {
        if (ch === "*") {
          if (buf) {
            out.push(
              <span
                key={key++}
                style={{
                  fontWeight: bold ? "bold" : "normal",
                  fontStyle: italic ? "italic" : "normal",
                  textDecoration: `${underline ? "underline" : ""} ${strike ? "line-through" : ""}`.trim(),
                }}
              >
                {buf}
              </span>
            );
            buf = "";
          }
          bold = !bold;
        } else if (ch === "/") {
          if (buf) {
            out.push(
              <span
                key={key++}
                style={{
                  fontWeight: bold ? "bold" : "normal",
                  fontStyle: italic ? "italic" : "normal",
                  textDecoration: `${underline ? "underline" : ""} ${strike ? "line-through" : ""}`.trim(),
                }}
              >
                {buf}
              </span>
            );
            buf = "";
          }
          italic = !italic;
        } else if (ch === "$") {
          if (buf) {
            out.push(
              <span
                key={key++}
                style={{
                  fontWeight: bold ? "bold" : "normal",
                  fontStyle: italic ? "italic" : "normal",
                  textDecoration: `${underline ? "underline" : ""} ${strike ? "line-through" : ""}`.trim(),
                }}
              >
                {buf}
              </span>
            );
            buf = "";
          }
          underline = !underline;
        } else if (ch === "~") {
          if (buf) {
            out.push(
              <span
                key={key++}
                style={{
                  fontWeight: bold ? "bold" : "normal",
                  fontStyle: italic ? "italic" : "normal",
                  textDecoration: `${underline ? "underline" : ""} ${strike ? "line-through" : ""}`.trim(),
                }}
              >
                {buf}
              </span>
            );
            buf = "";
          }
          strike = !strike;
        } else {
          buf += ch;
        }
      }
    }
    if (buf) {
      out.push(
        <span
          key={key++}
          style={{
            fontWeight: bold ? "bold" : "normal",
            fontStyle: italic ? "italic" : "normal",
            textDecoration: `${underline ? "underline" : ""} ${strike ? "line-through" : ""}`.trim(),
          }}
        >
          {buf}
        </span>
      );
    }
    return out;
  };

  const setupQuillEditor = (quillRef, link, type) => {
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();
      editor.root.setAttribute('spellcheck', 'true');
      editor.root.setAttribute('lang', 'es');
      editor.theme.tooltip.hide();

      let attempts = 0;
      const maxAttempts = 5;
      const interval = 100;

      const addButtons = () => {
        const imageResize = editor.getModule('imageResize');
        if (imageResize && imageResize.toolbar && typeof imageResize.toolbar.appendChild === 'function') {
          const buttonContainer = document.createElement('span');
          buttonContainer.className = 'ql-formats';
          buttonContainer.innerHTML = `
            <button type="button" title="Eliminar imagen" class="ql-delete-image">
              <svg viewBox="0 0 18 18">
                <line class="ql-stroke" x1="3" x2="15" y1="3" y2="15"></line>
                <line class="ql-stroke" x1="3" x2="15" y1="15" y2="3"></line>
              </svg>
            </button>
            <button type="button" title="Editar imagen" class="ql-edit-image">
              <svg viewBox="0 0 18 18">
                <polygon class="ql-fill ql-stroke" points="6 10 4 12 2 10 4 8"></polygon>
                <path class="ql-stroke" d="M8.09,13.91A4.6,4.6,0,0,0,9,14,5,5,0,1,0,4,9"></path>
              </svg>
            </button>
          `;
          imageResize.toolbar.appendChild(buttonContainer);

          buttonContainer.querySelector('.ql-delete-image').onclick = () => {
            const range = editor.getSelection();
            if (range) {
              let isImage = false;
              let deleteIndex = range.index;
              let deleteLength = 1;
              const [leaf] = editor.getLeaf(range.index);
              if (leaf && leaf.domNode && leaf.domNode.tagName === 'IMG') {
                isImage = true;
              } else {
                const [prevLeaf] = editor.getLeaf(range.index - 1);
                if (prevLeaf && prevLeaf.domNode && prevLeaf.domNode.tagName === 'IMG') {
                  isImage = true;
                  deleteIndex = range.index - 1;
                } else {
                  const [nextLeaf] = editor.getLeaf(range.index);
                  if (nextLeaf && nextLeaf.domNode && nextLeaf.domNode.tagName === 'IMG') {
                    isImage = true;
                    deleteIndex = range.index;
                  }
                }
              }
              if (isImage) {
                try {
                  editor.deleteText(deleteIndex, deleteLength, Quill.sources.USER);
                  imageResize.hide();
                } catch (err) {
                  console.error('Error al eliminar imagen:', err);
                  setSubmitStatus((prev) => ({ ...prev, [link]: 'Error al eliminar la imagen' }));
                }
              } else {
                setSubmitStatus((prev) => ({ ...prev, [link]: 'Selecciona una imagen para eliminar' }));
              }
            } else {
              setSubmitStatus((prev) => ({ ...prev, [link]: 'No hay selección activa para eliminar' }));
            }
          };

          buttonContainer.querySelector('.ql-edit-image').onclick = () => {
            const range = editor.getSelection();
            if (range) {
              const [leaf] = editor.getLeaf(range.index);
              if (leaf && leaf.domNode && leaf.domNode.tagName === 'IMG') {
                const img = leaf.domNode;
                const formats = editor.getFormat(range.index, 1);
                setImageData((prev) => ({
                  ...prev,
                  [link]: {
                    url: img.src,
                    width: img.style.width || img.width + 'px',
                    height: img.style.height || img.height + 'px',
                    align: formats.align || 'left'
                  }
                }));
                setEditingRange((prev) => ({ ...prev, [link]: range }));
                setIsEditingImage((prev) => ({ ...prev, [link]: true }));
                setShowImageModal((prev) => ({ ...prev, [link]: true }));
              } else {
                setSubmitStatus((prev) => ({ ...prev, [link]: 'Selecciona una imagen para editar' }));
              }
            }
          };
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(addButtons, interval);
        } else {
          console.warn('No se pudo añadir los botones: imageResize.toolbar no está disponible');
        }
      };

      addButtons();
    }
  };

  const handleImageModalSubmit = (link) => {
    const editor = (feedbackQuillRefs.current[link] || reportQuillRefs.current[link]).getEditor();
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

  const renderAssignment = (assignment, isPending) => {
    const link = assignment['Link Artículo'];
    const role = assignment.role;
    const nombre = assignment['Nombre Artículo'];
    const isAuth = role === 'Autor';
    const articleName = assignment.id;
    const currentScores = localRubric[link] || getRubricScoresForAssignment(assignment);
    const revScores = role === 'Editor' ? getRevScoresForEditor(articleName) : null;
    const recommendation = role === 'Editor' && revScores ? getDecisionRecommendation(revScores.rev1.total, revScores.rev2.total) : null;

    return (
      <div key={assignment.id} className="bg-white p-6 rounded-lg shadow-md space-y-4">
        <h4 className="text-lg font-semibold text-gray-800">{nombre}</h4>
        {!isAuth && (
          <div className="space-y-4">
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              Abrir en Google Drive
            </a>
            <iframe
              src={link.replace('/edit', '/preview')}
              className="w-full h-[300px] sm:h-[500px] rounded-xl shadow border border-gray-200"
              title="Vista previa del artículo"
              sandbox="allow-same-origin allow-scripts"
            ></iframe>
          </div>
        )}
        <p className="text-gray-600">Estado: {assignment.Estado}</p>
        {!isAuth && <p className="text-gray-600">Rol: {role}</p>}
        {isAuth ? (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Retroalimentación del Editor</label>
            <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
              {decodeBody(assignment.feedbackEditor)}
            </div>
          </div>
        ) : (
          <>
            {role === 'Editor' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Retroalimentación de Revisor 1</label>
                  <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                    {decodeBody(assignment.feedback1)}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Retroalimentación de Revisor 2</label>
                  <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                    {decodeBody(assignment.feedback2)}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Informe de Revisor 1</label>
                  <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                    {decodeBody(assignment.informe1)}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Informe de Revisor 2</label>
                  <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                    {decodeBody(assignment.informe2)}
                  </div>
                </div>
              </div>
            )}
            {isPending ? (
              <div className="space-y-4">
                <button
                  onClick={() => toggleTutorial(link)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
                >
                  {tutorialVisible[link] ? 'Ocultar Tutorial' : 'Ver Tutorial'}
                </button>
                {tutorialVisible[link] && <Tutorial role={role} />}
                {role === 'Editor' && revScores && (
                  <div className="grid md:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-md">
                    <RevScoresDisplay revScores={revScores.rev1} role="rev1" />
                    <RevScoresDisplay revScores={revScores.rev2} role="rev2" />
                    <div className="md:col-span-2 p-3 bg-white rounded-md border">
                      <p className="font-semibold">Promedio de revisores: {((revScores.rev1.total + revScores.rev2.total) / 16 * 100).toFixed(0)}%</p>
                      <p className="text-sm text-gray-600">Recomendación: <span className="font-medium">{recommendation}</span></p>
                    </div>
                  </div>
                )}
                <RubricForm
                  role={role}
                  link={link}
                  scores={currentScores}
                  onChange={handleRubricChange}
                />
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    {role === 'Editor' ? 'Retroalimentación Final al Autor' : 'Retroalimentación al Autor'}
                  </label>
                  <ReactQuill
                    ref={(el) => (feedbackQuillRefs.current[link] = el)}
                    value={feedback[link] || ''}
                    onChange={debouncedSetFeedback(link)}
                    modules={modules}
                    formats={formats}
                    placeholder={role === 'Editor' ? 'Redacta una retroalimentación final sensible, sintetizando las opiniones de los revisores y la tuya.' : 'Escribe tu retroalimentación aquí...'}
                    className="border rounded-md text-gray-800 bg-white"
                    onFocus={() => setupQuillEditor(feedbackQuillRefs.current[link], link, 'feedback')}
                  />
                  <button
                    onClick={() => {
                      setIsEditingImage((prev) => ({ ...prev, [link]: false }));
                      setImageData((prev) => ({ ...prev, [link]: { url: '', width: '', height: '', align: 'left' } }));
                      setShowImageModal((prev) => ({ ...prev, [link]: true }));
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                  >
                    Insertar Imagen Manualmente
                  </button>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Informe al Editor</label>
                  <ReactQuill
                    ref={(el) => (reportQuillRefs.current[link] = el)}
                    value={report[link] || ''}
                    onChange={debouncedSetReport(link)}
                    modules={modules}
                    formats={formats}
                    placeholder="Escribe tu informe aquí..."
                    className="border rounded-md text-gray-800 bg-white"
                    onFocus={() => setupQuillEditor(reportQuillRefs.current[link], link, 'report')}
                  />
                  <button
                    onClick={() => {
                      setIsEditingImage((prev) => ({ ...prev, [link]: false }));
                      setImageData((prev) => ({ ...prev, [link]: { url: '', width: '', height: '', align: 'left' } }));
                      setShowImageModal((prev) => ({ ...prev, [link]: true }));
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                  >
                    Insertar Imagen Manualmente
                  </button>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Voto</label>
                  <div className="flex space-x-4">
                    <button
                      onClick={() => handleVote(link, 'si')}
                      className={`px-4 py-2 rounded-md ${vote[link] === 'si' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-800'} focus:outline-none focus:ring-2 focus:ring-green-500`}
                    >
                      Sí
                    </button>
                    <button
                      onClick={() => handleVote(link, 'no')}
                      className={`px-4 py-2 rounded-md ${vote[link] === 'no' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-800'} focus:outline-none focus:ring-2 focus:ring-red-500`}
                    >
                      No
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => handleSubmit(link, role, feedback[link] || '', report[link] || '', vote[link] || '')}
                  className="w-full px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Enviar
                </button>
                {submitStatus[link] && (
                  <p className={`text-center text-sm ${submitStatus[link].includes('Error') ? 'text-red-500' : 'text-green-500'}`}>
                    {submitStatus[link]}
                  </p>
                )}
                {showImageModal[link] && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                      <h5 className="text-lg font-semibold mb-4">{isEditingImage[link] ? 'Editar Imagen' : 'Insertar Imagen'}</h5>
                      <input
                        type="text"
                        name="url"
                        value={imageData[link]?.url || ''}
                        onChange={(e) => handleImageDataChange(link, e)}
                        placeholder="URL de la imagen"
                        className="w-full px-4 py-2 border rounded-md mb-2"
                        disabled={isEditingImage[link]}
                      />
                      <input
                        type="text"
                        name="width"
                        value={imageData[link]?.width || ''}
                        onChange={(e) => handleImageDataChange(link, e)}
                        placeholder="Ancho (ej: 300px o 50%)"
                        className="w-full px-4 py-2 border rounded-md mb-2"
                      />
                      <input
                        type="text"
                        name="height"
                        value={imageData[link]?.height || ''}
                        onChange={(e) => handleImageDataChange(link, e)}
                        placeholder="Alto (ej: 200px o auto)"
                        className="w-full px-4 py-2 border rounded-md mb-2"
                      />
                      <select
                        name="align"
                        value={imageData[link]?.align || 'left'}
                        onChange={(e) => handleImageDataChange(link, e)}
                        className="w-full px-4 py-2 border rounded-md mb-4"
                      >
                        <option value="left">Izquierda</option>
                        <option value="center">Centro</option>
                        <option value="right">Derecha</option>
                        <option value="justify">Justificado</option>
                      </select>
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => setShowImageModal((prev) => ({ ...prev, [link]: false }))}
                          className="px-4 py-2 bg-gray-300 rounded-md"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleImageModalSubmit(link)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md"
                        >
                          {isEditingImage[link] ? 'Actualizar' : 'Insertar'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <RubricSummary role={role} scores={getRubricScoresForAssignment(assignment)} />
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    {role === 'Editor' ? 'Retroalimentación Final al Autor' : 'Retroalimentación al Autor'}
                  </label>
                  <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                    {decodeBody(assignment.feedback)}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Informe al Editor</label>
                  <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                    {decodeBody(assignment.report)}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Voto</label>
                  <p className="text-gray-600">{assignment.vote || 'Sin voto'}</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  if (loading) {
    return <p className="text-center text-gray-600">Cargando asignaciones...</p>;
  }

  if (error) {
    return (
      <div className="text-center space-y-4 bg-gray-50 p-6 rounded-lg shadow-sm">
        <h3 className="text-xl font-medium text-gray-800">Bienvenido, {user.name}</h3>
        <p className="text-gray-600">Rol: {user.role}</p>
        <p className="text-red-500">{error}</p>
        <button
          onClick={() => {
            setError('');
            const loadData = async () => {
              setLoading(true);
              try {
                await fetchAssignments();
                await fetchRubrics();
              } catch (err) {
                setError(err.message);
              } finally {
                setLoading(false);
              }
            };
            loadData();
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
        >
          Reintentar
        </button>
        <button
          onClick={onLogout}
          className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
        >
          Cerrar Sesión
        </button>
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="text-center space-y-4 bg-gray-50 p-6 rounded-lg shadow-sm">
        <h3 className="text-xl font-medium text-gray-800">Bienvenido, {user.name}</h3>
        <p className="text-gray-600">Rol: {user.role}</p>
        <p className="text-gray-600">No tienes asignaciones actualmente.</p>
        <button
          onClick={onLogout}
          className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
        >
          Cerrar Sesión
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-0 relative">
      <div className="text-center space-y-2">
        <h3 className="text-xl font-medium text-gray-800">Bienvenido, {user.name}</h3>
        <p className="text-gray-600">Rol: {user.role}</p>
        {completedAssignments.length > 0 && (
          <button
            onClick={() => setCompletedPanelOpen(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm mr-4"
          >
            Ver artículos revisados
          </button>
        )}
        {!isAuthor && (
          <button
            onClick={async () => {
              await fetchAssignments();
              await fetchRubrics();
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm mr-4"
          >
            Actualizar Asignaciones
          </button>
        )}
        <button
          onClick={onLogout}
          className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
        >
          Cerrar Sesión
        </button>
      </div>
      {!isAuthor && (
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab('assignments')}
            className={`px-4 py-2 rounded-md ${activeTab === 'assignments' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
          >
            Asignaciones
          </button>
          {user.role.includes('Editor') && (
            <button
              onClick={() => setActiveTab('news')}
              className={`px-4 py-2 rounded-md ${activeTab === 'news' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
            >
              Subir Noticia
            </button>
          )}
        </div>
      )}
      {(activeTab === 'assignments' || isAuthor) && (
        <div>
          {selectedAssignment ? (
            <div className="space-y-4">
              <button
                onClick={() => setSelectedAssignmentId(null)}
                className="text-blue-600 flex items-center hover:underline"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
                Volver a asignaciones pendientes
              </button>
              {renderAssignment(selectedAssignment, false)}
            </div>
          ) : (
            <div className="space-y-6">
              {pendingAssignments.length === 0 ? (
                <p className="text-center text-gray-600">No tienes asignaciones pendientes.</p>
              ) : (
                pendingAssignments.map((assignment) => renderAssignment(assignment, true))
              )}
            </div>
          )}
        </div>
      )}
      {activeTab === 'news' && !isAuthor && user.role.includes('Editor') && <NewsUploadSection />}
      {completedPanelOpen && (
        <div
          className={`fixed left-0 top-0 h-full w-full lg:w-80 bg-white shadow-2xl z-50 overflow-y-auto transform ${completedPanelOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out`}
        >
          <div className="p-4 flex justify-between items-center border-b">
            <h4 className="text-lg font-semibold text-gray-800">Artículos Revisados</h4>
            <button
              onClick={() => setCompletedPanelOpen(false)}
              className="text-gray-600 hover:text-gray-800 focus:outline-none"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="divide-y">
            {completedAssignments.map((a) => (
              <div
                key={a.id}
                className="p-4 cursor-pointer hover:bg-blue-50 transition-colors"
                onClick={() => {
                  setSelectedAssignmentId(a.id);
                  setCompletedPanelOpen(false);
                }}
              >
                <p className="text-gray-800 truncate">{a['Nombre Artículo']}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}