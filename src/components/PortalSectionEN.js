import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Papa from 'papaparse';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { debounce } from 'lodash';
import NewsUploadSection from './NewsUploadSectionEN';
import TaskSection from './TaskSectionEN';
import AssignSection from './AssignSectionEN';
import { useTranslation } from 'react-i18next';
import DirectorPanel from './DirectorPanelEN';

const ASSIGNMENTS_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS_RFrrfaVQHftZUhvJ1LVz0i_Tju-6PlYI8tAu5hLNLN21u8M7KV-eiruomZEcMuc_sxLZ1rXBhX1O/pub?output=csv';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby2B1OUt3TMqaed6Vz-iamUPn4gHhKXG2RRxiy8Nt6u69Cg-2kSze2XQ-NywX5QrNfy/exec';
const RUBRIC_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzehxU_O7GkzfiCqCsSdnFwvA_Mhtfr_vSZjqVsBo3yx8ZEpr9Qur4NHPI09tyH1AZe/exec';

const RUBRIC_CSV1 = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS1BhqyalgqRIACNtlt1C0cDSBqBXCtPABA8WnXFOnbDXkLauCpLjelu9GHv7i1XLvPY346suLE9Lag/pub?gid=0&single=true&output=csv';
const RUBRIC_CSV2 = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS1BhqyalgqRIACNtlt1C0cDSBqBXCtPABA8WnXFOnbDXkLauCpLjelu9GHv7i1XLvPY346suLE9Lag/pub?gid=1438370398&single=true&output=csv';
const RUBRIC_CSV3 = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS1BhqyalgqRIACNtlt1C0cDSBqBXCtPABA8WnXFOnbDXkLauCpLjelu9GHv7i1XLvPY346suLE9Lag/pub?gid=1972050001&single=true&output=csv';

const criteria = {
  'Reviewer 1': [
    {
      key: 'gramatica',
      name: 'Grammar and spelling',
      levels: {
        0: { label: '0 = Insufficient ❌', desc: 'Many serious errors, difficult to read.' },
        1: { label: '1 = Adequate ⚖️', desc: 'Some errors, understandable.' },
        2: { label: '2 = Excellent ✅', desc: 'Very few errors, clean text.' }
      }
    },
    {
      key: 'claridad',
      name: 'Clarity and coherence',
      levels: {
        0: { label: '0 = Insufficient ❌', desc: 'Confusing, incoherent.' },
        1: { label: '1 = Adequate ⚖️', desc: 'Sometimes confusing but understandable.' },
        2: { label: '2 = Excellent ✅', desc: 'Clear, precise, and coherent.' }
      }
    },
    {
      key: 'estructura',
      name: 'Structure and organization',
      levels: {
        0: { label: '0 = Insufficient ❌', desc: 'Disorganized, without clear parts.' },
        1: { label: '1 = Adequate ⚖️', desc: 'Parts are present but weak.' },
        2: { label: '2 = Excellent ✅', desc: 'Well-differentiated introduction, development, and conclusion.' }
      }
    },
    {
      key: 'citacion',
      name: 'Citation and references',
      levels: {
        0: { label: '0 = Insufficient ❌', desc: 'No sources or poorly cited.' },
        1: { label: '1 = Adequate ⚖️', desc: 'Sources present but with errors.' },
        2: { label: '2 = Excellent ✅', desc: 'Reliable and well-cited sources.' }
      }
    }
  ],
  'Reviewer 2': [
    {
      key: 'relevancia',
      name: 'Topic relevance',
      levels: {
        0: { label: '0 = Insufficient ❌', desc: 'Irrelevant or out-of-context topic.' },
        1: { label: '1 = Adequate ⚖️', desc: 'Valid but superficial topic.' },
        2: { label: '2 = Excellent ✅', desc: 'Relevant and engaging topic.' }
      }
    },
    {
      key: 'rigor',
      name: 'Rigor in the use of sources',
      levels: {
        0: { label: '0 = Insufficient ❌', desc: 'No sources or unreliable ones.' },
        1: { label: '1 = Adequate ⚖️', desc: 'Few sources, some questionable.' },
        2: { label: '2 = Excellent ✅', desc: 'Varied, reliable, and well-used sources.' }
      }
    },
    {
      key: 'originalidad',
      name: 'Originality and creativity',
      levels: {
        0: { label: '0 = Insufficient ❌', desc: 'Repeats information without analysis.' },
        1: { label: '1 = Adequate ⚖️', desc: 'Combines ideas without much elaboration.' },
        2: { label: '2 = Excellent ✅', desc: 'Provides own ideas and original reflections.' }
      }
    },
    {
      key: 'argumentos',
      name: 'Quality of arguments',
      levels: {
        0: { label: '0 = Insufficient ❌', desc: 'Confusing, without evidence, or incoherent.' },
        1: { label: '1 = Adequate ⚖️', desc: 'Clear but weak.' },
        2: { label: '2 = Excellent ✅', desc: 'Solid, well-founded, and convincing.' }
      }
    }
  ],
  'Editor': [
    {
      key: 'modificaciones',
      name: 'Degree of modifications',
      levels: {
        0: { label: '0 = Insufficient ❌', desc: 'Required too many corrections, almost a rewrite.' },
        1: { label: '1 = Adequate ⚖️', desc: 'Needed several corrections, but they were manageable.' },
        2: { label: '2 = Excellent ✅', desc: 'Only minor adjustments.' }
      }
    },
    {
      key: 'calidad',
      name: 'Final quality of the text',
      levels: {
        0: { label: '0 = Insufficient ❌', desc: 'Even with changes, it remains weak or unclear.' },
        1: { label: '1 = Adequate ⚖️', desc: 'Acceptable text, although it could be improved.' },
        2: { label: '2 = Excellent ✅', desc: 'Solid, clear, and publishable text.' }
      }
    },
    {
      key: 'aporte',
      name: 'Overall contribution of the essay',
      levels: {
        0: { label: '0 = Insufficient ❌', desc: 'Little relevance or repetitive.' },
        1: { label: '1 = Adequate ⚖️', desc: 'Interesting, although not outstanding.' },
        2: { label: '2 = Excellent ✅', desc: 'Very valuable, innovative, or inspiring.' }
      }
    },
    {
      key: 'potencial',
      name: 'Motivational potential',
      levels: {
        0: { label: '0 = Insufficient ❌', desc: 'Does not motivate or contribute to the spirit of the journal.' },
        1: { label: '1 = Adequate ⚖️', desc: 'May motivate some students.' },
        2: { label: '2 = Excellent ✅', desc: 'Inspires, invites reflection and dialogue.' }
      }
    },
    {
      key: 'decision',
      name: 'Final decision',
      levels: {
        0: { label: '0 = Reject', desc: 'Reject.' },
        1: { label: '1 = Accept with major changes', desc: 'Accept with major changes.' },
        2: { label: '2 = Accept (with or without minor changes)', desc: 'Accept (with or without minor changes).' }
      }
    }
  ]
};

const getDecisionText = (percent) => {
  if (percent >= 85) return 'Accept without changes.';
  if (percent >= 70) return 'Accept with minor changes.';
  if (percent >= 50) return 'Major revision before publishing.';
  return 'Reject.';
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
      return <div className="text-red-600 text-center p-4">An error occurred. Please reload the page.</div>;
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
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [expandedFeedback, setExpandedFeedback] = useState({});
  const [isDirectorPanelExpanded, setIsDirectorPanelExpanded] = useState(false);
  const [isChiefEditorPanelExpanded, setIsChiefEditorPanelExpanded] = useState(false);
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
          const isUserAuthor = data.some((row) => row['Autor'] === user.name);
          let parsedAssignments = [];
          if (isUserAuthor) {
            parsedAssignments = data
              .filter((row) => row['Autor'] === user.name)
              .map((row) => ({
                id: row['Nombre Artículo'],
                'Nombre Artículo': row['Nombre Artículo'] || 'Untitled',
                Estado: row['Estado'],
                role: 'Author',
                feedbackEditor: row['Feedback 3'] || 'No feedback from the editor yet.',
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
                const role = row['Revisor 1'] === user.name ? 'Reviewer 1' : row['Revisor 2'] === user.name ? 'Reviewer 2' : 'Editor';
                const num = role === 'Reviewer 1' ? 1 : role === 'Reviewer 2' ? 2 : 3;
                const assignment = {
                  id: row['Nombre Artículo'],
                  'Nombre Artículo': row['Nombre Artículo'] || 'Untitled',
                  'Link Artículo': row['Link Artículo'],
                  Estado: row['Estado'],
                  role,
                  feedback: row[`Feedback ${num}`] || '',
                  report: row[`Informe ${num}`] || '',
                  vote: row[`Voto ${num}`] || '',
                  feedback1: row['Feedback 1'] || 'No feedback from Reviewer 1.',
                  feedback2: row['Feedback 2'] || 'No feedback from Reviewer 2.',
                  informe1: row['Informe 1'] || 'No report from Reviewer 1.',
                  informe2: row['Informe 2'] || 'No report from Reviewer 2.',
                  isCompleted: !!row[`Feedback ${num}`] && !!row[`Informe ${num}`] && !!row[`Voto ${num}`],
                };

                const name = assignment.id;
                if (role === 'Reviewer 1') {
                  assignment.scores = rubrics.scoresMap1[name] || { gramatica: 0, claridad: 0, estructura: 0, citacion: 0 };
                } else if (role === 'Reviewer 2') {
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
            if (!isUserAuthor) {
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
          console.error('Error parsing CSV:', err);
          setError('Error loading assignments');
          setLoading(false);
        },
      });
    } catch (err) {
      console.error('Error loading assignments:', err);
      setError('Error connecting to the server');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || !user.name || !user.role) {
      console.log('Error in fetchAssignments: invalid user', { user });
      setError('User not defined or incomplete information');
      setLoading(false);
      return;
    }
    console.log('Loading assignments for user:', { uid: user.uid, name: user.name, role: user.role });
    fetchAssignments();
  }, [user]);

  const isAuthor = assignments.length > 0 && assignments[0].role === 'Author';
  const isChief = user?.role && user.role.split(';').map(r => r.trim()).includes('Chief Editor');
  const isDirector = user?.role && user.role.split(';').map(r => r.trim()).includes('General Director');
  const isRrss = user?.role && user.role.split(';').map(r => r.trim()).includes('Social Media Manager');
  const isWebDev = user?.role && user.role.split(';').map(r => r.trim()).includes('Web Development Manager');
  console.log('User data:', user);
  console.log('User roles:', user?.role);
  console.log('isDirector:', isDirector);
  console.log('isChief:', isChief);
  
  const pendingAssignments = useMemo(() => 
    isAuthor 
      ? assignments.filter((a) => !a.feedbackEditor || !['Accepted', 'Rejected'].includes(a.Estado))
      : assignments.filter((a) => !a.isCompleted), 
    [assignments, isAuthor]
  );
  
  const completedAssignments = useMemo(() => 
    isAuthor 
      ? assignments.filter((a) => a.feedbackEditor && ['Accepted', 'Rejected'].includes(a.Estado))
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
      case 'Reviewer 1': return ['gramatica', 'claridad', 'estructura', 'citacion'];
      case 'Reviewer 2': return ['relevancia', 'rigor', 'originalidad', 'argumentos'];
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
      setRubricStatus((prev) => ({ ...prev, [link]: `Error: Rubric incomplete. Missing or invalid: ${missingKeys.join(', ')}` }));
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
          console.warn(`Attempt ${attempt} failed for rubric:`, err);
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }

      if (success) {
        setRubricStatus((prev) => ({ ...prev, [link]: 'Rubric sent successfully' }));
        await fetchAssignments();
      } else {
        setRubricStatus((prev) => ({ ...prev, [link]: 'Error sending rubric after 3 attempts' }));
      }
    } catch (err) {
      console.error('General error sending rubric:', err);
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
          console.warn(`Attempt ${attempt} failed for main data:`, err);
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }

      if (mainSuccess) {
        setSubmitStatus((prev) => ({ ...prev, [link]: 'Main data sent successfully' }));
        await fetchAssignments();
      } else {
        setSubmitStatus((prev) => ({ ...prev, [link]: 'Error sending main data after 3 attempts' }));
      }
    } catch (err) {
      console.error('General error sending main data:', err);
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
    if (role === "Reviewer 1") {
      return 'As Reviewer 1, your role is to check technical aspects like grammar, spelling, source citation, detection of AI-generated content, logical coherence, and the overall structure of the article. Leave detailed comments in the Google Drive document to suggest improvements. Ensure the language is clear and academic. You must leave your feedback for the author in the corresponding box. You also need to leave a summary report explaining your observations to guide the editor. Finally, in the vote box, you must put "yes" if you approve the article, and "no" if you reject it.';
    } else if (role === "Reviewer 2") {
      return 'As Reviewer 2, focus on the substantive content: verify the accuracy of sources, the seriousness and originality of the topic, the relevance of the arguments, and the contribution to the field of study. Evaluate whether the article is innovative and well-founded. Leave comments in the Google Drive document. You must leave your feedback for the author in the corresponding box. You also need to leave a summary report explaining your observations to guide the editor. Finally, in the vote box, you must put "yes" if you approve the article, and "no" if you reject it.';
    } else if (role === "Editor") {
      return `As the Editor, your responsibility is to review the feedback and reports from the reviewers, integrate them with your own evaluation, and write a final, sensitive, and constructive feedback for the author. Correct the text directly if necessary and decide the final status of the article. Use the Google Drive document for edits. You must leave feedback for the author synthesizing what the reviewers provided. Your duty is to ensure the message is accurate and sensitive, without discouraging the author. For this, you should use the "sandwich" technique. If you don't know what it is, you should look it up. Then, leave your report with the changes made; they must be precise and academic. Finally, in the vote box, you must put "yes" if you approve the article, and "no" if you reject it.`;
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
    const roleDisplay = roleKey === 'Reviewer 1' ? 'Reviewer 1 (Form, Style, and Technique)' : roleKey === 'Reviewer 2' ? 'Reviewer 2 (Content and Originality)' : 'Editor (Synthesis and Final Decision)';

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
              console.log('No active selection to delete');
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
                setSubmitStatus((prev) => ({ ...prev, [link]: 'Error deleting the image' }));
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
                setSubmitStatus((prev) => ({ ...prev, [link]: 'Error adding text after the image' }));
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
    <div
      className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 cursor-pointer border border-gray-200 h-full flex flex-col justify-between"
      onClick={onClick}
    >
      <div>
        <h4 className="text-xl font-bold text-gray-800 mb-2 break-words">{nombre}</h4>
        <p className="text-sm text-gray-600 mb-3 break-words">Rol: {role}</p>
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
          <p className="text-gray-600 break-words">Rol: {role} | Estado: {assignment.Estado || 'Sin estado'}</p>
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

      {isAuth ? (
  <div className="space-y-6">
    {assignment.feedbackEditor && ['Aceptado', 'Rechazado'].includes(assignment.Estado) ? (
      <>
        <div className="p-4 bg-green-50 rounded-md border-l-4 border-green-400">
          <h5 className="text-lg font-semibold text-green-800 mb-2">Estado Final: {assignment.Estado}</h5>
        </div>
        <h5 className="text-lg font-semibold text-gray-800">Retroalimentación del Editor</h5>
        <div className="bg-gray-50 p-4 rounded-md border border-gray-200 max-h-48 overflow-y-auto leading-relaxed">
          {decodeBody(assignment.feedbackEditor)}
        </div>
      </>
    ) : (
      <div className="p-6 bg-yellow-50 rounded-md border-l-4 border-yellow-400 text-center">
        <h5 className="text-xl font-semibold text-yellow-800 mb-2">Artículo en Revisión</h5>
        <p className="text-yellow-700 text-lg">Su artículo "{assignment['Nombre Artículo']}" está actualmente bajo revisión por los evaluadores y el editor.</p>
        <p className="text-yellow-600 mt-2">Recibirá una notificación con la decisión final y retroalimentación una vez completado el proceso.</p>
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
                Abrir en Google Drive
              </a>
              <iframe
                src={link ? link.replace('/edit', '/preview') : ''}
                className="w-full h-[350px] lg:h-[500px] rounded-xl shadow border border-gray-200"
                title="Vista previa del artículo"
                sandbox="allow-same-origin allow-scripts"
              />
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
    </div>
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
if (!user || !user.name || !user.role) {
  console.log('Usuario inválido:', user);
  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 flex items-center justify-center">
      <div className="text-center text-gray-600 bg-white p-6 rounded-lg shadow-md">
        <p className="text-lg mb-4">Error: Información del usuario incompleta. Por favor, inicia sesión nuevamente.</p>
        <button
  onClick={() => {
    console.log('Botón Cerrar Sesión clickeado en PortalSection');
    onLogout();
  }}
  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm"
>
  Cerrar Sesión
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
    {isAuthor && !isDirector && !isChief ? 'Mis Artículos' :
     isDirector ? 'Panel del Director General' :
     isChief ? 'Panel del Editor en Jefe' : 'Panel de Revisión'}
  </h2>
  <div className="flex items-center space-x-4">
    {user?.image ? (
      <img
        src={user.image}
        alt={`${user?.name || 'Usuario'}'s profile`}
        className="w-10 h-10 rounded-full object-cover border-2 border-gray-300"
        onError={(e) => (e.target.style.display = 'none')} // Hide on error
      />
    ) : (
      <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
        <span className="text-gray-600 text-sm">{user?.name?.charAt(0) || 'U'}</span>
      </div>
    )}
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
        
     {/* News Upload Section only for Director General */}
        {isDirector && (
          <div className="mb-6">
            <NewsUploadSection />
          </div>
        )}
        
        {/* Director Panel */}
        {isDirector && (
          <div className="mb-6 bg-white rounded-lg shadow-md p-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-800">Panel del Director General</h3>
              <button
                onClick={() => setIsDirectorPanelExpanded(!isDirectorPanelExpanded)}
                className="bg-gray-200 text-gray-800 px-3 py-1 rounded-md hover:bg-gray-300 text-sm flex items-center space-x-2"
              >
                <span>{isDirectorPanelExpanded ? 'Minimizar' : 'Expandir'}</span>
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
                <span>Agregar Artículo</span>
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
                <span>Actualizar Página</span>
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
        {/* Chief Editor Panel */}
        {isChief && (
          <div className="mb-6 bg-white rounded-lg shadow-md p-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-800">Panel del Editor en Jefe</h3>
              <button
                onClick={() => setIsChiefEditorPanelExpanded(!isChiefEditorPanelExpanded)}
                className="bg-gray-200 text-gray-800 px-3 py-1 rounded-md hover:bg-gray-300 text-sm flex items-center space-x-2"
              >
                <span>{isChiefEditorPanelExpanded ? 'Minimizar' : 'Expandir'}</span>
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
        
        {/* Task Section for Encargado de Redes Sociales and Responsable de Desarrollo Web */}
        {(isRrss || isWebDev) && !isDirector && !isChief && (
          <div className="mb-6 bg-white rounded-lg shadow-md p-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-800">Mis Tareas en {isRrss ? 'Redes Sociales' : 'Desarrollo Web'}</h3>
            </div>
            <TaskSection user={user} />
          </div>
        )}
        
        {/* Assignments and Tabs for all users with assignments */}
        {(pendingAssignments.length > 0 || completedAssignments.length > 0) && (
          <div className="mb-6">
            <div className="flex space-x-4 border-b">
              <button
                onClick={() => setActiveTab('assignments')}
                className={`pb-2 px-4 text-sm font-medium ${activeTab === 'assignments' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
              >
                {isAuthor ? 'Artículos en Revisión' : 'Asignaciones Pendientes'} ({pendingAssignments.length})
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`pb-2 px-4 text-sm font-medium ${activeTab === 'completed' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
              >
                {isAuthor ? 'Artículos Archivados' : 'Asignaciones Completadas'} ({completedAssignments.length})
              </button>
            </div>
          </div>
        )}
        
        <ErrorBoundary>
          {(isChief || isDirector) && activeTab === 'asignar' && <AssignSection user={user} />}
          {(pendingAssignments.length > 0 || completedAssignments.length > 0 || isChief || isDirector) && (
            <>
              {loading ? (
                <div className="text-center text-gray-600">Cargando asignaciones...</div>
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
