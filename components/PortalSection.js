'use client'; // Required for Next.js client-side interactivity

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Papa from 'papaparse';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { debounce } from 'lodash';
import NewsUploadSection from './NewsUploadSection';
import TaskSection from './TaskSection';
import AssignSection from './AssignSection';
import DirectorPanel from './DirectorPanel';
import { useTranslations } from 'next-intl';

// Constants
const ASSIGNMENTS_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS_RFrrfaVQHftZUhvJ1LVz0i_Tju-6PlYI8tAu5hLNLN21u8M7KV-eiruomZEcMuc_sxLZ1rXBhX1O/pub?output=csv';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby2B1OUt3TMqaed6Vz-iamUPn4gHhKXG2RRxiy8Nt6u69Cg-2kSze2XQ-NywX5QrNfy/exec';
const RUBRIC_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzehxU_O7GkzfiCqCsSdnFwvA_Mhtfr_vSZjqVsBo3yx8ZEpr9Qur4NHPI09tyH1AZe/exec';

const RUBRIC_CSV1 = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS1BhqyalgqRIACNtlt1C0cDSBqBXCtPABA8WnXFOnbDXkLauCpLjelu9GHv7i1XLvPY346suLE9Lag/pub?gid=0&single=true&output=csv';
const RUBRIC_CSV2 = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS1BhqyalgqRIACNtlt1C0cDSBqBXCtPABA8WnXFOnbDXkLauCpLjelu9GHv7i1XLvPY346suLE9Lag/pub?gid=1438370398&single=true&output=csv';
const RUBRIC_CSV3 = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS1BhqyalgqRIACNtlt1C0cDSBqBXCtPABA8WnXFOnbDXkLauCpLjelu9GHv7i1XLvPY346suLE9Lag/pub?gid=1972050001&single=true&output=csv';

const criteria = {
  'Revisor 1': [
    {
      key: 'gramatica',
      name: 'rubric.grammar',
      levels: {
        0: { label: 'rubric.levels.grammar.0', desc: 'rubric.levels.grammar.0' },
        1: { label: 'rubric.levels.grammar.1', desc: 'rubric.levels.grammar.1' },
        2: { label: 'rubric.levels.grammar.2', desc: 'rubric.levels.grammar.2' }
      }
    },
    {
      key: 'claridad',
      name: 'rubric.clarity',
      levels: {
        0: { label: 'rubric.levels.clarity.0', desc: 'rubric.levels.clarity.0' },
        1: { label: 'rubric.levels.clarity.1', desc: 'rubric.levels.clarity.1' },
        2: { label: 'rubric.levels.clarity.2', desc: 'rubric.levels.clarity.2' }
      }
    },
    {
      key: 'estructura',
      name: 'rubric.structure',
      levels: {
        0: { label: 'rubric.levels.structure.0', desc: 'rubric.levels.structure.0' },
        1: { label: 'rubric.levels.structure.1', desc: 'rubric.levels.structure.1' },
        2: { label: 'rubric.levels.structure.2', desc: 'rubric.levels.structure.2' }
      }
    },
    {
      key: 'citacion',
      name: 'rubric.citation',
      levels: {
        0: { label: 'rubric.levels.citation.0', desc: 'rubric.levels.citation.0' },
        1: { label: 'rubric.levels.citation.1', desc: 'rubric.levels.citation.1' },
        2: { label: 'rubric.levels.citation.2', desc: 'rubric.levels.citation.2' }
      }
    }
  ],
  'Revisor 2': [
    {
      key: 'relevancia',
      name: 'rubric.relevance',
      levels: {
        0: { label: 'rubric.levels.relevance.0', desc: 'rubric.levels.relevance.0' },
        1: { label: 'rubric.levels.relevance.1', desc: 'rubric.levels.relevance.1' },
        2: { label: 'rubric.levels.relevance.2', desc: 'rubric.levels.relevance.2' }
      }
    },
    {
      key: 'rigor',
      name: 'rubric.rigor',
      levels: {
        0: { label: 'rubric.levels.rigor.0', desc: 'rubric.levels.rigor.0' },
        1: { label: 'rubric.levels.rigor.1', desc: 'rubric.levels.rigor.1' },
        2: { label: 'rubric.levels.rigor.2', desc: 'rubric.levels.rigor.2' }
      }
    },
    {
      key: 'originalidad',
      name: 'rubric.originality',
      levels: {
        0: { label: 'rubric.levels.originality.0', desc: 'rubric.levels.originality.0' },
        1: { label: 'rubric.levels.originality.1', desc: 'rubric.levels.originality.1' },
        2: { label: 'rubric.levels.originality.2', desc: 'rubric.levels.originality.2' }
      }
    },
    {
      key: 'argumentos',
      name: 'rubric.arguments',
      levels: {
        0: { label: 'rubric.levels.arguments.0', desc: 'rubric.levels.arguments.0' },
        1: { label: 'rubric.levels.arguments.1', desc: 'rubric.levels.arguments.1' },
        2: { label: 'rubric.levels.arguments.2', desc: 'rubric.levels.arguments.2' }
      }
    }
  ],
  'Editor': [
    {
      key: 'modificaciones',
      name: 'rubric.modifications',
      levels: {
        0: { label: 'rubric.levels.modifications.0', desc: 'rubric.levels.modifications.0' },
        1: { label: 'rubric.levels.modifications.1', desc: 'rubric.levels.modifications.1' },
        2: { label: 'rubric.levels.modifications.2', desc: 'rubric.levels.modifications.2' }
      }
    },
    {
      key: 'calidad',
      name: 'rubric.final_quality',
      levels: {
        0: { label: 'rubric.levels.final_quality.0', desc: 'rubric.levels.final_quality.0' },
        1: { label: 'rubric.levels.final_quality.1', desc: 'rubric.levels.final_quality.1' },
        2: { label: 'rubric.levels.final_quality.2', desc: 'rubric.levels.final_quality.2' }
      }
    },
    {
      key: 'aporte',
      name: 'rubric.contribution',
      levels: {
        0: { label: 'rubric.levels.contribution.0', desc: 'rubric.levels.contribution.0' },
        1: { label: 'rubric.levels.contribution.1', desc: 'rubric.levels.contribution.1' },
        2: { label: 'rubric.levels.contribution.2', desc: 'rubric.levels.contribution.2' }
      }
    },
    {
      key: 'potencial',
      name: 'rubric.motivational_potential',
      levels: {
        0: { label: 'rubric.levels.motivational_potential.0', desc: 'rubric.levels.motivational_potential.0' },
        1: { label: 'rubric.levels.motivational_potential.1', desc: 'rubric.levels.motivational_potential.1' },
        2: { label: 'rubric.levels.motivational_potential.2', desc: 'rubric.levels.motivational_potential.2' }
      }
    },
    {
      key: 'decision',
      name: 'rubric.final_decision',
      levels: {
        0: { label: 'rubric.levels.final_decision.0', desc: 'rubric.levels.final_decision.0' },
        1: { label: 'rubric.levels.final_decision.1', desc: 'rubric.levels.final_decision.1' },
        2: { label: 'rubric.levels.final_decision.2', desc: 'rubric.levels.final_decision.2' }
      }
    }
  ]
};

const getDecisionText = (percent, language) => {
  if (percent >= 85) return translate('decision.accept_no_changes', language);
  if (percent >= 70) return translate('decision.accept_minor_changes', language);
  if (percent >= 50) return translate('decision.major_revision', language);
  return translate('decision.reject', language);
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
      return <div className="text-red-600 text-center p-4">{translate('error_boundary', this.props.language)}</div>;
    }
    return this.props.children;
  }
}

export default function PortalSection({ user, onLogout, language = 'es' }) {
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
  const feedbackQuillRefs = useRef({});
  const reportQuillRefs = useRef({});

  useEffect(() => {
    if (!user) {
      console.log('Usuario nulo, limpiando estados de PortalSection');
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
    }
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
        const name = row[translate('article_title', language)]?.trim();
        if (name) {
          scoresMap1[name] = {
            gramatica: parseInt(row[translate('rubric.grammar', language)]) || 0,
            claridad: parseInt(row[translate('rubric.clarity', language)]) || 0,
            estructura: parseInt(row[translate('rubric.structure', language)]) || 0,
            citacion: parseInt(row[translate('rubric.citation', language)]) || 0
          };
        }
      });

      const data2 = parseData(csv2Text);
      const scoresMap2 = {};
      data2.forEach(row => {
        const name = row[translate('article_title', language)]?.trim();
        if (name) {
          scoresMap2[name] = {
            relevancia: parseInt(row[translate('rubric.relevance', language)]) || 0,
            rigor: parseInt(row[translate('rubric.rigor', language)]) || 0,
            originalidad: parseInt(row[translate('rubric.originality', language)]) || 0,
            argumentos: parseInt(row[translate('rubric.arguments', language)]) || 0
          };
        }
      });

      const data3 = parseData(csv3Text);
      const scoresMap3 = {};
      data3.forEach(row => {
        const name = row[translate('article_title', language)]?.trim();
        if (name) {
          scoresMap3[name] = {
            modificaciones: parseInt(row[translate('rubric.modifications', language)]) || 0,
            calidad: parseInt(row[translate('rubric.final_quality', language)]) || 0,
            aporte: parseInt(row[translate('rubric.contribution', language)]) || 0,
            potencial: parseInt(row[translate('rubric.motivational_potential', language)]) || 0,
            decision: parseInt(row[translate('rubric.final_decision', language)]) || 0
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
                id: row[translate('article_title', language)] || translate('no_title', language),
                [translate('article_title', language)]: row[translate('article_title', language)] || translate('no_title', language),
                Estado: row['Estado'],
                role: 'Autor',
                feedbackEditor: row['Feedback 3'] || translate('no_editor_feedback', language),
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
                  id: row[translate('article_title', language)],
                  [translate('article_title', language)]: row[translate('article_title', language)] || translate('no_title', language),
                  'Link Artículo': row['Link Artículo'],
                  Estado: row['Estado'],
                  role,
                  feedback: row[`Feedback ${num}`] || '',
                  report: row[`Informe ${num}`] || '',
                  vote: row[`Voto ${num}`] || '',
                  feedback1: row['Feedback 1'] || translate('no_reviewer1_feedback', language),
                  feedback2: row['Feedback 2'] || translate('no_reviewer2_feedback', language),
                  informe1: row['Informe 1'] || translate('no_reviewer1_report', language),
                  informe2: row['Informe 2'] || translate('no_reviewer2_report', language),
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
          console.error(translate('error_loading_assignments', language), err);
          setError(translate('error_loading_assignments', language));
          setLoading(false);
        },
      });
    } catch (err) {
      console.error(translate('error_connecting_server', language), err);
      setError(translate('error_connecting_server', language));
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || !user.name || !user.role) {
      console.log(translate('error_user_invalid', language), { user });
      setError(translate('error_user_invalid', language));
      setLoading(false);
      return;
    }
    console.log('Cargando asignaciones para usuario:', { uid: user.uid, name: user.name, role: user.role });
    fetchAssignments();
  }, [user, language]);

  const isAuthor = assignments.length > 0 && assignments[0].role === 'Autor';
  const isChief = user?.role && user.role.split(';').map(r => r.trim()).includes('Editor en Jefe');
  const isDirector = user?.role && user.role.split(';').map(r => r.trim()).includes('Director General');
  const isRrss = user?.role && user.role.split(';').map(r => r.trim()).includes('Encargado de Redes Sociales');
  const isWebDev = user?.role && user.role.split(';').map(r => r.trim()).includes('Responsable de Desarrollo Web');
  console.log('User data:', user);
  console.log('User roles:', user?.role);
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
    const articleName = assignments.find(a => a['Link Artículo'] === link)[translate('article_title', language)];
    const rubric = rubricScores[link] || {};

    const requiredKeys = getRequiredKeys(role);
    const missingKeys = requiredKeys.filter(key => rubric[key] === undefined || rubric[key] === null || isNaN(rubric[key]));
    if (missingKeys.length > 0) {
      setRubricStatus((prev) => ({ ...prev, [link]: translate('rubric_incomplete', language, { keys: missingKeys.join(', ') }) }));
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
        setRubricStatus((prev) => ({ ...prev, [link]: translate('rubric_submitted', language) }));
        await fetchAssignments();
      } else {
        setRubricStatus((prev) => ({ ...prev, [link]: translate('rubric_submission_error', language) }));
      }
    } catch (err) {
      console.error('Error general al enviar rúbrica:', err);
      setRubricStatus((prev) => ({ ...prev, [link]: translate('error_generic', language, { message: err.message }) }));
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
        setSubmitStatus((prev) => ({ ...prev, [link]: translate('data_submitted', language) }));
        await fetchAssignments();
      } else {
        setSubmitStatus((prev) => ({ ...prev, [link]: translate('data_submission_error', language) }));
      }
    } catch (err) {
      console.error('Error general al enviar datos principales:', err);
      setSubmitStatus((prev) => ({ ...prev, [link]: translate('error_generic', language, { message: err.message }) }));
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
    return translate(`tutorial.${role.toLowerCase().replace(' ', '')}`, language);
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
    const roleDisplay = translate(
      roleKey === 'Revisor 1' ? 'rubric.revisor1_form' :
      roleKey === 'Revisor 2' ? 'rubric.revisor2_content' : 'rubric.editor_synthesis',
      language
    );

    return (
      <div className="bg-white p-4 rounded-lg shadow-md mb-6 overflow-hidden">
        <h5 className="font-semibold mb-4 text-gray-800 border-b pb-2 break-words">
          {roleDisplay} - Total: {total} / {max}
        </h5>
        {crits.map((c) => (
          <div key={c.key} className="mb-4 p-3 bg-gray-50 rounded-md">
            <h6 className="font-medium mb-2 text-gray-700 break-words">{translate(c.name, language)}</h6>
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
                  {translate(info.label, language).split(' = ')[1]}
                </button>
              ))}
            </div>
            <p className={`text-xs italic ${readOnly ? 'text-gray-500' : 'text-blue-600'} break-words`}>
              {translate(c.levels[scores[c.key] || 0].desc, language)}
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
                console.error(translate('error_deleting_image', language), err);
                setSubmitStatus((prev) => ({ ...prev, [link]: translate('error_deleting_image', language) }));
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
                console.error(translate('error_inserting_after_image', language), err);
                setSubmitStatus((prev) => ({ ...prev, [link]: translate('error_inserting_after_image', language) }));
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
        button.title = translate('insert_image_manually', language);
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
  }, [feedbackQuillRefs.current, reportQuillRefs.current, language]);

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
    if (!encoded) return <p className="text-gray-600 break-words">{translate('no_content', language)}</p>;
    try {
      const html = base64DecodeUnicode(encoded);
      return <div className="ql-editor break-words leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />;
    } catch (err) {
      console.error(translate('error_decoding', language), err);
      return <p className="text-gray-600 break-words">{translate('error_decoding', language)}</p>;
    }
  };

  const handleImageModalSubmit = (link) => {
    const quillRef = feedbackQuillRefs.current[link] || reportQuillRefs.current[link];
    if (!quillRef) return;
    const editor = quillRef.getEditor();
    let { url, width, height, align } = imageData[link] || {};
    if (!url) {
      setSubmitStatus((prev) => ({ ...prev, [link]: translate('image_url_required', language) }));
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
    const nombre = assignment[translate('article_title', language)];
    const isAuthorCard = role === 'Autor';

    const statusColor = isAuthorCard
      ? (assignment.feedbackEditor && ['Aceptado', 'Rechazado'].includes(assignment.Estado)
        ? 'bg-green-100 text-green-800'
        : 'bg-yellow-100 text-yellow-800')
      : (assignment.isCompleted ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800');

    let percent = 0;
    if (!isAuthorCard) {
      const total = role !== 'Editor'
        ? getTotal(assignment.scores || {}, criteria[role] || [])
        : getTotal(assignment.scores || {}, criteria['Editor'] || []);
      const max = (criteria[role] || criteria['Editor'] || []).length * 2;
      percent = max > 0 ? (total / max) * 100 : 0;
    }

    return (
      <div
        className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 cursor-pointer border border-gray-200 h-full flex flex-col justify-between"
        onClick={onClick}
      >
        <div>
          <h4 className="text-xl font-bold text-gray-800 mb-2 break-words">{nombre}</h4>
          <p className="text-sm text-gray-600 mb-3 break-words">{translate('role', language, { role })}</p>
          <div className="flex items-center justify-between mb-4">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
              {isAuthorCard
                ? (assignment.feedbackEditor && ['Aceptado', 'Rechazado'].includes(assignment.Estado)
                  ? translate('archived', language)
                  : translate('in_review', language))
                : (assignment.isCompleted ? translate('completed', language) : translate('pending', language))}
            </span>
            {!isAuthorCard && (
              <span className="text-sm font-medium text-gray-700">
                {translate('score', language, { percent: percent.toFixed(0) })}
              </span>
            )}
          </div>
          <p className="text-gray-500 text-sm break-words">{translate('status', language, { status: assignment.Estado || translate('no_status', language) })}</p>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-200">
          <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium">
            {translate('view_details', language)}
          </button>
        </div>
      </div>
    );
  };

  const renderFullAssignment = (assignment) => {
    const link = assignment['Link Artículo'];
    const role = assignment.role;
    const nombre = assignment[translate('article_title', language)];
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
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h5 className="text-lg font-semibold text-gray-800">{translate('reviewer1_rubric', language)}</h5>
                <button
                  onClick={() => toggleFeedback(link, 'rubric1')}
                  className="text-blue-600 hover:underline text-sm flex items-center"
                >
                  {expandedFeedback[link]?.rubric1 ? translate('hide', language) : translate('show', language)}
                  <svg className={`w-4 h-4 ml-1 transform ${expandedFeedback[link]?.rubric1 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              {expandedFeedback[link]?.rubric1 && (
                <RubricViewer roleKey="Revisor 1" scores={assignment.rev1Scores} readOnly />
              )}
              <div className="flex items-center justify-between">
                <h5 className="text-lg font-semibold text-gray-800">{translate('reviewer2_rubric', language)}</h5>
                <button
                  onClick={() => toggleFeedback(link, 'rubric2')}
                  className="text-blue-600 hover:underline text-sm flex items-center"
                >
                  {expandedFeedback[link]?.rubric2 ? translate('hide', language) : translate('show', language)}
                  <svg className={`w-4 h-4 ml-1 transform ${expandedFeedback[link]?.rubric2 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              {expandedFeedback[link]?.rubric2 && (
                <RubricViewer roleKey="Revisor 2" scores={assignment.rev2Scores} readOnly />
              )}
              <div className="p-4 bg-yellow-50 rounded-md">
                <p className="font-medium break-words">
                  {translate('reviewers_implication', language, { percent: revPercent.toFixed(1), decision: getDecisionText(revPercent, language) })}
                </p>
              </div>
              <RubricViewer
                roleKey="Editor"
                scores={rubricScores[link] || {}}
                onChange={(key, val) => handleRubricChange(link, key, val)}
              />
              <div className="p-4 bg-green-50 rounded-md">
                <p className="font-medium break-words">
                  {translate('suggested_decision', language, { percent: overallPercent.toFixed(1), decision: getDecisionText(overallPercent, language) })}
                </p>
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
                <h5 className="text-lg font-semibold text-gray-800">{translate('reviewer1_rubric', language)}</h5>
                <button
                  onClick={() => toggleFeedback(link, 'rubric1')}
                  className="text-blue-600 hover:underline text-sm flex items-center"
                >
                  {expandedFeedback[link]?.rubric1 ? translate('hide', language) : translate('show', language)}
                  <svg className={`w-4 h-4 ml-1 transform ${expandedFeedback[link]?.rubric1 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              {expandedFeedback[link]?.rubric1 && (
                <RubricViewer roleKey="Revisor 1" scores={assignment.rev1Scores} readOnly />
              )}
              <div className="flex items-center justify-between">
                <h5 className="text-lg font-semibold text-gray-800">{translate('reviewer2_rubric', language)}</h5>
                <button
                  onClick={() => toggleFeedback(link, 'rubric2')}
                  className="text-blue-600 hover:underline text-sm flex items-center"
                >
                  {expandedFeedback[link]?.rubric2 ? translate('hide', language) : translate('show', language)}
                  <svg className={`w-4 h-4 ml-1 transform ${expandedFeedback[link]?.rubric2 ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              {expandedFeedback[link]?.rubric2 && (
                <RubricViewer roleKey="Revisor 2" scores={assignment.rev2Scores} readOnly />
              )}
              <div className="p-4 bg-yellow-50 rounded-md">
                <p className="font-medium break-words">
                  {translate('reviewers_implication', language, { percent: revPercent.toFixed(1), decision: getDecisionText(revPercent, language) })}
                </p>
              </div>
              <RubricViewer roleKey="Editor" scores={assignment.scores} readOnly />
              <div className="p-4 bg-green-50 rounded-md">
                <p className="font-medium break-words">
                  {translate('general_decision', language, { percent: overallPercent.toFixed(1), decision: getDecisionText(overallPercent, language) })}
                </p>
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
            <p className="text-gray-600 break-words">
              {translate('role', language, { role })} | {translate('status', language, { status: assignment.Estado || translate('no_status', language) })}
            </p>
          </div>
          <button
            onClick={() => setSelectedAssignment(null)}
            className="text-blue-600 hover:underline flex items-center text-sm"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            {translate('back_to_list', language)}
          </button>
        </div>

        {isAuth ? (
          <div className="space-y-6">
            {assignment.feedbackEditor && ['Aceptado', 'Rechazado'].includes(assignment.Estado) ? (
              <>
                <div className="p-4 bg-green-50 rounded-md border-l-4 border-green-400">
                  <h5 className="text-lg font-semibold text-green-800 mb-2">{translate('final_status', language, { status: assignment.Estado })}</h5>
                </div>
                <h5 className="text-lg font-semibold text-gray-800">{translate('editor_feedback', language)}</h5>
                <div className="bg-gray-50 p-4 rounded-md border border-gray-200 max-h-48 overflow-y-auto leading-relaxed">
                  {decodeBody(assignment.feedbackEditor)}
                </div>
              </>
            ) : (
              <div className="p-6 bg-yellow-50 rounded-md border-l-4 border-yellow-400 text-center">
                <h5 className="text-xl font-semibold text-yellow-800 mb-2">{translate('in_review', language)}</h5>
                <p className="text-yellow-700 text-lg">{translate('article_in_review', language, { title: assignment[translate('article_title', language)] })}</p>
                <p className="text-yellow-600 mt-2">{translate('notification_pending', language)}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <div className="space-y-2">
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm mb-2"
                >
                  {translate('open_in_drive', language)}
                </a>
                <iframe
                  src={link ? link.replace('/edit', '/preview') : ''}
                  className="w-full h-[350px] lg:h-[500px] rounded-xl shadow border border-gray-200"
                  title={translate('article_preview', language)}
                  sandbox="allow-same-origin allow-scripts"
                />
              </div>
              {handleRenderRubric()}
            </div>
            <div className="lg:col-span-1 space-y-6">
              {role === 'Editor' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700 break-words">{translate('feedback_reviewer1', language)}</label>
                    <button
                      onClick={() => toggleFeedback(link, 'feedback1')}
                      className="text-blue-600 hover:underline text-sm flex items-center"
                    >
                      {expandedFeedback[link]?.feedback1 ? translate('hide', language) : translate('show', language)}
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
                    <label className="block text-sm font-medium text-gray-700 break-words">{translate('feedback_reviewer2', language)}</label>
                    <button
                      onClick={() => toggleFeedback(link, 'feedback2')}
                      className="text-blue-600 hover:underline text-sm flex items-center"
                    >
                      {expandedFeedback[link]?.feedback2 ? translate('hide', language) : translate('show', language)}
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
                    <label className="block text-sm font-medium text-gray-700 break-words">{translate('report_reviewer1', language)}</label>
                    <button
                      onClick={() => toggleFeedback(link, 'informe1')}
                      className="text-blue-600 hover:underline text-sm flex items-center"
                    >
                      {expandedFeedback[link]?.informe1 ? translate('hide', language) : translate('show', language)}
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
                    <label className="block text-sm font-medium text-gray-700 break-words">{translate('report_reviewer2', language)}</label>
                    <button
                      onClick={() => toggleFeedback(link, 'informe2')}
                      className="text-blue-600 hover:underline text-sm flex items-center"
                    >
                      {expandedFeedback[link]?.informe2 ? translate('hide', language) : translate('show', language)}
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
                    {tutorialVisible[link] ? translate('hide_tutorial', language) : translate('show_tutorial', language)}
                  </button>
                  {tutorialVisible[link] && <Tutorial role={role} />}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 break-words">
                      {role === 'Editor' ? translate('final_feedback', language) : translate('feedback_to_author', language)}
                    </label>
                    <ReactQuill
                      ref={(el) => (feedbackQuillRefs.current[link] = el)}
                      value={feedback[link] || ''}
                      onChange={debouncedSetFeedback(link)}
                      modules={modules}
                      formats={formats}
                      placeholder={role === 'Editor' ? translate('final_feedback_placeholder', language) : translate('feedback_placeholder', language)}
                      className="border rounded-md text-gray-800 bg-white h-48"
                      id={`feedback-${link}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 break-words">{translate('report_to_editor', language)}</label>
                    <ReactQuill
                      ref={(el) => (reportQuillRefs.current[link] = el)}
                      value={report[link] || ''}
                      onChange={debouncedSetReport(link)}
                      modules={modules}
                      formats={formats}
                      placeholder={translate('report_placeholder', language)}
                      className="border rounded-md text-gray-800 bg-white h-48"
                      id={`report-${link}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 break-words">{translate('vote', language)}</label>
                    <div className="flex space-x-4">
                      <button
                        onClick={() => handleVote(link, 'si')}
                        className={`px-4 py-2 rounded-md ${vote[link] === 'si' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} transition-colors text-sm`}
                      >
                        {translate('yes', language)}
                      </button>
                      <button
                        onClick={() => handleVote(link, 'no')}
                        className={`px-4 py-2 rounded-md ${vote[link] === 'no' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'} transition-colors text-sm`}
                      >
                        {translate('no', language)}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <button
                      onClick={() => handleSubmitRubric(link, role)}
                      disabled={!isRubricComplete(link, role)}
                      className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      {translate('submit_rubric', language)}
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
                    {translate('submit_revision', language)}
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
                    {tutorialVisible[link] ? translate('hide_tutorial', language) : translate('show_tutorial', language)}
                  </button>
                  {tutorialVisible[link] && <Tutorial role={role} />}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 break-words">{translate('feedback_submitted', language)}</label>
                    <div className="bg-gray-50 p-4 rounded-md border border-gray-200 max-h-48 overflow-y-auto">
                      {decodeBody(feedback[link] || translate('no_feedback', language))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 break-words">{translate('report_submitted', language)}</label>
                    <div className="bg-gray-50 p-4 rounded-md border border-gray-200 max-h-48 overflow-y-auto">
                      {decodeBody(report[link] || translate('no_report', language))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 break-words">{translate('vote_submitted', language)}</label>
                    <p className="text-sm text-gray-600">{vote[link] ? vote[link].charAt(0).toUpperCase() + vote[link].slice(1) : translate('not_submitted', language)}</p>
                  </div>
                </div>
              )}

              {showImageModal[link] && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
                    <h4 className="text-lg font-semibold mb-4">{isEditingImage[link] ? translate('edit_image', language) : translate('insert_image', language)}</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">{translate('image_url', language)}</label>
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
                        <label className="block text-sm font-medium text-gray-700">{translate('width', language)}</label>
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
                        <label className="block text-sm font-medium text-gray-700">{translate('height', language)}</label>
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
                        <label className="block text-sm font-medium text-gray-700">{translate('alignment', language)}</label>
                        <select
                          name="align"
                          value={imageData[link]?.align || 'left'}
                          onChange={(e) => handleImageDataChange(link, e)}
                          className="mt-1 block w-full border rounded-md p-2 text-sm"
                        >
                          <option value="left">{translate('left', language)}</option>
                          <option value="center">{translate('center', language)}</option>
                          <option value="right">{translate('right', language)}</option>
                          <option value="justify">{translate('justify', language)}</option>
                        </select>
                      </div>
                    </div>
                    <div className="mt-6 flex justify-end space-x-2">
                      <button
                        onClick={() => setShowImageModal((prev) => ({ ...prev, [link]: false }))}
                        className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 text-sm"
                      >
                        {translate('cancel', language)}
                      </button>
                      <button
                        onClick={() => handleImageModalSubmit(link)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                      >
                        {isEditingImage[link] ? translate('update', language) : translate('insert', language)}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!user || !user.name || !user.role) {
    console.log(translate('error_user_invalid', language), user);
    return (
      <div className="min-h-screen bg-gray-100 p-4 md:p-8 flex items-center justify-center">
        <div className="text-center text-gray-600 bg-white p-6 rounded-lg shadow-md">
          <p className="text-lg mb-4">{translate('error_user_invalid', language)}</p>
          <button
            onClick={() => {
              console.log('Botón Cerrar Sesión clickeado en PortalSection');
              onLogout();
            }}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm"
          >
            {translate('logout', language)}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800">
            {isAuthor && !isDirector && !isChief ? translate('my_articles', language) :
             isDirector ? translate('director_panel', language) :
             isChief ? translate('chief_editor_panel', language) : translate('review_panel', language)}
          </h2>
          <div className="flex items-center space-x-4">
            {user?.image ? (
              <img
                src={user.image}
                alt={translate('profile_alt', language, { name: user?.name || 'Usuario' })}
                className="w-10 h-10 rounded-full object-cover border-2 border-gray-300"
                onError={(e) => (e.target.style.display = 'none')}
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                <span className="text-gray-600 text-sm">{user?.name?.charAt(0) || 'U'}</span>
              </div>
            )}
            <span className="text-gray-600">{translate('welcome', language, { name: user?.name || 'Usuario' })}</span>
            <button
              onClick={onLogout}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm"
            >
              {translate('logout', language)}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded-md mb-6">
            {error}
          </div>
        )}

        {isDirector && (
          <div className="mb-6">
            <NewsUploadSection />
          </div>
        )}

        {isDirector && (
          <div className="mb-6 bg-white rounded-lg shadow-md p-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-800">{translate('director_panel', language)}</h3>
              <button
                onClick={() => setIsDirectorPanelExpanded(!isDirectorPanelExpanded)}
                className="bg-gray-200 text-gray-800 px-3 py-1 rounded-md hover:bg-gray-300 text-sm flex items-center space-x-2"
              >
                <span>{isDirectorPanelExpanded ? translate('minimize', language) : translate('expand', language)}</span>
                <svg className={`w-4 h-4 transform ${isDirectorPanelExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            <div className="mt-4 flex space-x-4">
              <button
                onClick={() => {
                  console.log('Add article button clicked');
                  document.dispatchEvent(new CustomEvent('openAddArticleModal'));
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors font-medium flex items-center space-x-2"
                style={{ display: 'inline-flex !important', visibility: 'visible !important' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>{translate('add_article', language)}</span>
              </button>
              <button
                onClick={() => {
                  console.log('Rebuild page button clicked');
                  document.dispatchEvent(new CustomEvent('rebuildPage'));
                }}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors font-medium flex items-center space-x-2"
                style={{ display: 'inline-flex !important', visibility: 'visible !important' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{translate('rebuild_page', language)}</span>
              </button>
            </div>
            {isDirectorPanelExpanded && (
              <div className="mt-4 space-y-6">
                <DirectorPanel user={user} />
                <TaskSection user={user} />
              </div>
            )}
          </div>
        )}

        {isChief && (
          <div className="mb-6 bg-white rounded-lg shadow-md p-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-800">{translate('chief_editor_panel', language)}</h3>
              <button
                onClick={() => setIsChiefEditorPanelExpanded(!isChiefEditorPanelExpanded)}
                className="bg-gray-200 text-gray-800 px-3 py-1 rounded-md hover:bg-gray-300 text-sm flex items-center space-x-2"
              >
                <span>{isChiefEditorPanelExpanded ? translate('minimize', language) : translate('expand', language)}</span>
                <svg className={`w-4 h-4 transform ${isChiefEditorPanelExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            {isChiefEditorPanelExpanded && (
              <div className="mt-4 space-y-6">
                <AssignSection user={user} />
              </div>
            )}
          </div>
        )}

        {(isRrss || isWebDev) && !isDirector && !isChief && (
          <div className="mb-6 bg-white rounded-lg shadow-md p-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-800">
                {isRrss ? translate('social_media_tasks', language) : translate('web_dev_tasks', language)}
              </h3>
            </div>
            <TaskSection user={user} />
          </div>
        )}

        {(pendingAssignments.length > 0 || completedAssignments.length > 0) && (
          <div className="mb-6">
            <div className="flex space-x-4 border-b">
              <button
                onClick={() => setActiveTab('assignments')}
                className={`pb-2 px-4 text-sm font-medium ${activeTab === 'assignments' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
              >
                {isAuthor ? translate('articles_in_review', language, { count: pendingAssignments.length }) : translate('pending_assignments', language, { count: pendingAssignments.length })}
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`pb-2 px-4 text-sm font-medium ${activeTab === 'completed' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
              >
                {isAuthor ? translate('archived_articles', language, { count: completedAssignments.length }) : translate('completed_assignments', language, { count: completedAssignments.length })}
              </button>
            </div>
          </div>
        )}

        <ErrorBoundary language={language}>
          {(isChief || isDirector) && activeTab === 'asignar' && <AssignSection user={user} />}
          {(pendingAssignments.length > 0 || completedAssignments.length > 0 || isChief || isDirector) && (
            <>
              {loading ? (
                <div className="text-center text-gray-600">{translate('loading_assignments', language)}</div>
              ) : selectedAssignment ? (
                renderFullAssignment(selectedAssignment)
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {(activeTab === 'assignments' ? pendingAssignments : completedAssignments).map((assignment) => (
                    <AssignmentCard
                      key={assignment.id}
                      assignment={assignment}
                      onClick={() => setSelectedAssignment(assignment)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}