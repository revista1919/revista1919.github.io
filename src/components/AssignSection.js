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
const USERS_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS_RFrrfaVQHftZUhvJ1LVz0i_Tju-6PlYI8tAu5hLNLN21u8M7KV-eiruomZEcMuc_sxLZ1rXBhX1O/pub?gid=0&output=csv'; // Adjust the gid if necessary for the users/team sheet
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby2B1OUt3TMqaed6Vz-iamUPn4gHhKXG2RRxiy8Nt6u69Cg-2kSze2XQ-NywX5QrNfy/exec';
const RUBRIC_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzehxU_O7GkzfiCqCsSdnFwvA_Mhtfr_vSZjqVsBo3yx8ZEpr9Qur4NHPI09tyH1AZe/exec';
const RUBRIC_CSV1 = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS1BhqyalgqRIACNtlt1C0cDSBqBXCtPABA8WnXFOnbDXkLauCpLjelu9GHv7i1XLvPY346suLE9Lag/pub?gid=0&single=true&output=csv';
const RUBRIC_CSV2 = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS1BhqyalgqRIACNtlt1C0cDSBqBXCtPABA8WnXFOnbDXkLauCpLjelu9GHv7i1XLvPY346suLE9Lag/pub?gid=1438370398&single=true&output=csv';
const RUBRIC_CSV3 = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS1BhqyalgqRIACNtlt1C0cDSBqBXCtPABA8WnXFOnbDXkLauCpLjelu9GHv7i1XLvPY346suLE9Lag/pub?gid=1972050001&single=true&output=csv';



const getDecisionText = (percent) => {
  if (percent >= 85) return 'Accept without changes.';
  if (percent >= 70) return 'Accept with minor changes.';
  if (percent >= 50) return 'Major revision required before publishing.';
  return 'Reject.';
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
      return <div className="text-red-600 text-center p-4">An error occurred. Please reload the page.</div>;
    }
    return this.props.children;
  }
}

const localizer = momentLocalizer(moment);

function CalendarComponent({ events, onSelectEvent }) {
  return (
    <div className="bg-white border-0 sm:border border-gray-200 p-2 sm:p-4 md:p-8 rounded-sm shadow-sm mb-6 overflow-hidden">
      <h3 className="font-serif text-2xl font-bold text-gray-900 mb-4">Deadline Calendar</h3>
      <div className="h-[300px] sm:h-[400px] md:h-[600px]">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          onSelectEvent={onSelectEvent}
          views={['month', 'week', 'day', 'agenda']}
          popup
          selectable
          className="rounded-lg border-0 sm:border border-gray-200 overflow-hidden"
          messages={{
            next: "Next",
            previous: "Previous",
            today: "Today",
            month: "Month",
            week: "Week",
            day: "Day",
            agenda: "Agenda",
            date: "Date",
            time: "Time",
            event: "Event",
            noEventsInRange: "No events in this range",
            showMore: total => `+ Show more (${total})`
          }}
        />
      </div>
    </div>
  );
}

/** * MODERNIZED DESIGN: Rubric peer review form style
 */
const RubricViewer = ({ roleKey, scores, onChange, readOnly = false }) => {
  const crits = criteria[roleKey];
  if (!crits) return null;
  const total = getTotal(scores, crits);
  const max = crits.length * 2;
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="bg-white border-0 sm:border border-gray-200 rounded-lg overflow-hidden mb-8"
    >
      <div className="bg-gray-50 px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 border-b border-gray-200 flex justify-between items-center">
        <h5 className="font-serif text-lg font-bold text-gray-900 uppercase tracking-tight break-words">
          Evaluation Protocol: {roleKey}
        </h5>
        <div className="text-sm font-mono font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded">
          SCORE: {total} / {max}
        </div>
      </div>
     
      <div className="p-2 sm:p-4 md:p-6 space-y-4 md:space-y-8">
        {crits.map((c) => (
          <div key={c.key} className="border-b border-gray-100 last:border-0 pb-6">
            <div className="flex justify-between items-start mb-4">
              <h6 className="font-sans font-bold text-xs uppercase tracking-widest text-gray-500 break-words">{c.name}</h6>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                    LEVEL {val}
                  </span>
                  <p className="text-sm text-gray-800 leading-snug break-words">{info.label.split('=')[1]}</p>
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
 * ASSIGNMENT CARD: Editorial Card Style
 */
const AssignmentCard = ({ assignment, onClick, index }) => {
  const role = assignment.role;
  const isAuthorCard = role === 'Author';
  const isCompleted = isAuthorCard
    ? (assignment.feedbackEditor && ['Accepted', 'Rejected'].includes(assignment.Status))
    : assignment.isCompleted;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -4 }}
      onClick={onClick}
      className="group bg-white border-0 sm:border border-gray-200 p-2 sm:p-4 md:p-6 flex flex-col h-full hover:border-blue-400 transition-all cursor-pointer relative overflow-hidden"
    >
      <div className="flex justify-between items-start mb-4">
        <span className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-blue-600 break-words">
          {role}
        </span>
        <div className={`w-2 h-2 rounded-full ${isCompleted ? 'bg-green-500' : 'bg-amber-400 animate-pulse'}`} />
      </div>
     
      <h4 className="font-serif text-xl font-bold text-gray-900 group-hover:text-blue-800 transition-colors mb-4 line-clamp-2 break-words">
        {assignment['Article Name']}
      </h4>
      <div className="mt-auto pt-4 border-t border-gray-50 space-y-2">
        <div className="flex justify-between text-xs text-gray-500 font-sans">
          <span>DEADLINE</span>
          <span className="font-bold break-words">{assignment.Deadline ? new Date(assignment.Deadline).toLocaleDateString() : 'NO DATE'}</span>
        </div>
        <div className="flex justify-between text-xs text-gray-500 font-sans">
          <span>STATUS</span>
          <span className={`font-bold break-words ${isCompleted ? 'text-green-700' : 'text-amber-700'}`}>
            {isCompleted ? 'COMPLETED' : 'PENDING'}
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

  // Email mapping → real name
  useEffect(() => {
    const fetchUserMapping = async () => {
      if (user && user.name && user.name.includes('@')) {
        setError('Warning: Your name appears to be an email address. Attempting to map to real name from CSV...');
        try {
          const csvText = await fetchWithRetry(USERS_CSV);
          Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: ({ data }) => {
              const mapping = data.find(row => row['Email']?.trim().toLowerCase() === user.name.trim().toLowerCase());
              if (mapping && mapping['Name']) {
                setEffectiveName(mapping['Name'].trim());
                setError('');
              } else {
                setError('No email to name mapping found. Please contact the administrator.');
              }
            },
            error: (err) => {
              console.error('Error parsing users CSV:', err);
              setError('Error loading user mapping.');
            },
          });
        } catch (err) {
          console.error('Error fetching users CSV:', err);
          setError('Error connecting for user mapping.');
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
        const name = row['Article Name']?.trim();
        if (name) {
          scoresMap1[name] = {
            grammar: parseInt(row['Grammar and spelling']) || 0,
            clarity: parseInt(row['Clarity and coherence']) || 0,
            structure: parseInt(row['Structure and organization']) || 0,
            citation: parseInt(row['Citation and references']) || 0
          };
        }
      });
      const data2 = parseData(csv2Text);
      const scoresMap2 = {};
      data2.forEach(row => {
        const name = row['Article Name']?.trim();
        if (name) {
          scoresMap2[name] = {
            relevance: parseInt(row['Topic relevance']) || 0,
            rigor: parseInt(row['Rigor in source usage']) || 0,
            originality: parseInt(row['Originality and creativity']) || 0,
            arguments: parseInt(row['Quality of arguments']) || 0
          };
        }
      });
      const data3 = parseData(csv3Text);
      const scoresMap3 = {};
      data3.forEach(row => {
        const name = row['Article Name']?.trim();
        if (name) {
          scoresMap3[name] = {
            modifications: parseInt(row['Degree of modifications']) || 0,
            quality: parseInt(row['Final text quality']) || 0,
            contribution: parseInt(row['Global essay contribution']) || 0,
            potential: parseInt(row['Motivational potential']) || 0,
            decision: parseInt(row['Final decision']) || 0
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
            const authors = row['Author'] || '';
            return authors
              .split(';')
              .map(a => a.trim().toLowerCase())
              .includes(normalizedEffectiveName);
          });
          const authorAssignments = authorRows.map(row => ({
            id: row['Article Name'],
            'Article Name': row['Article Name'] || 'Untitled',
            Status: row['Status'],
            role: 'Author',
            feedbackEditor: row['Feedback 3'] || 'No feedback from the editor yet.',
            isCompleted: !!row['Feedback 3'],
            Deadline: row['Deadline'] || null,
          }));
          // Fetch reviewer/editor assignments
          const reviewerRows = data
            .filter(row => {
              return row['Reviewer 1']?.trim() === effectiveName ||
                     row['Reviewer 2']?.trim() === effectiveName ||
                     row['Editor']?.trim() === effectiveName;
            });
          const reviewerAssignments = reviewerRows.map(row => {
            const role = row['Reviewer 1']?.trim() === effectiveName ? 'Reviewer 1'
                      : row['Reviewer 2']?.trim() === effectiveName ? 'Reviewer 2'
                      : 'Editor';
            const num = role === 'Reviewer 1' ? 1 : role === 'Reviewer 2' ? 2 : 3;
            const assignment = {
              id: row['Article Name'],
              'Article Name': row['Article Name'] || 'Untitled',
              'Article Link': row['Article Link'],
              Status: row['Status'],
              role,
              feedback: row[`Feedback ${num}`] || '',
              report: row[`Report ${num}`] || '',
              vote: row[`Vote ${num}`] || '',
              feedback1: row['Feedback 1'] || 'No feedback from Reviewer 1.',
              feedback2: row['Feedback 2'] || 'No feedback from Reviewer 2.',
              report1: row['Report 1'] || 'No report from Reviewer 1.',
              report2: row['Report 2'] || 'No report from Reviewer 2.',
              isCompleted: !!row[`Feedback ${num}`] && !!row[`Report ${num}`] && !!row[`Vote ${num}`],
              Deadline: row['Deadline'] || null,
            };
            const name = assignment.id;
            if (role === 'Reviewer 1') {
              assignment.scores = rubrics.scoresMap1[name] || { grammar: 0, clarity: 0, structure: 0, citation: 0 };
            } else if (role === 'Reviewer 2') {
              assignment.scores = rubrics.scoresMap2[name] || { relevance: 0, rigor: 0, originality: 0, arguments: 0 };
            } else {
              assignment.rev1Scores = rubrics.scoresMap1[name] || { grammar: 0, clarity: 0, structure: 0, citation: 0 };
              assignment.rev2Scores = rubrics.scoresMap2[name] || { relevance: 0, rigor: 0, originality: 0, arguments: 0 };
              assignment.scores = rubrics.scoresMap3[name] || { modifications: 0, quality: 0, contribution: 0, potential: 0, decision: 0 };
            }
            return assignment;
          });
          // Combine: reviewer/editor first, then author
          const parsedAssignments = [...reviewerAssignments, ...authorAssignments];
          setAssignments(parsedAssignments);
          // Initialize local states
          parsedAssignments.forEach(assignment => {
            if (assignment.role !== 'Author') {
              const link = assignment['Article Link'];
              setVote(prev => ({ ...prev, [link]: assignment.vote }));
              setFeedback(prev => ({ ...prev, [link]: assignment.feedback }));
              setReport(prev => ({ ...prev, [link]: assignment.report }));
              setRubricScores(prev => ({ ...prev, [link]: assignment.scores }));
            }
          });
          // Calendar events
          const events = parsedAssignments
            .filter(ass => ass.Deadline)
            .map(ass => ({
              title: `${ass['Article Name']} - ${ass.role}`,
              start: new Date(ass.Deadline),
              end: new Date(ass.Deadline),
              allDay: true,
              resource: ass,
            }));
          setCalendarEvents(events);
          setLoading(false);
          if (parsedAssignments.length === 0 && !loading) {
            setError(`No assignments found for '${effectiveName}'. If you expect assignments, please check your account details or contact the administrator.`);
          }
        },
        error: (err) => {
          console.error('Error parsing CSV:', err);
          setError('Error loading assignments');
          setLoading(false);
        },
      });
    } catch (err) {
      console.error('Error loading assignments:', err);
      setError('Error connecting to server');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || !effectiveName || !user.role) {
      setError('User not defined or incomplete information');
      setLoading(false);
      return;
    }
    fetchAssignments();
  }, [user, effectiveName]);

  // User roles
  const userRoles = user?.role ? user.role.split(';').map(r => r.trim()) : [];
  const isAuthor = assignments.length > 0 && assignments[0].role === 'Author';
  const isChief = userRoles.includes('Chief Editor');
  const isDirector = userRoles.includes('General Director');
  const isRrss = userRoles.includes('Social Media Manager');
  const isWebDev = userRoles.includes('Web Development Manager');
  // Only users with role higher than "Author" see the calendar
  const canSeeCalendar = isChief || isDirector || isRrss || isWebDev || assignments.some(a => a.role !== 'Author');

  const pendingAssignments = useMemo(() =>
    isAuthor
      ? assignments.filter(a => !a.feedbackEditor || !['Accepted', 'Rejected'].includes(a.Status))
      : assignments.filter(a => !a.isCompleted),
    [assignments, isAuthor]
  );

  const completedAssignments = useMemo(() =>
    isAuthor
      ? assignments.filter(a => a.feedbackEditor && ['Accepted', 'Rejected'].includes(a.Status))
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
      case 'Reviewer 1': return ['grammar', 'clarity', 'structure', 'citation'];
      case 'Reviewer 2': return ['relevance', 'rigor', 'originality', 'arguments'];
      case 'Editor': return ['modifications', 'quality', 'contribution', 'potential', 'decision'];
      default: return [];
    }
  };

  const isRubricComplete = (link, role) => {
    const rubric = rubricScores[link] || {};
    const required = getRequiredKeys(role);
    return required.every(key => rubric[key] !== undefined && rubric[key] !== null);
  };

  const handleSubmitRubric = async (link, role) => {
    const articleName = assignments.find(a => a['Article Link'] === link)['Article Name'];
    const rubric = rubricScores[link] || {};
    const requiredKeys = getRequiredKeys(role);
    const missingKeys = requiredKeys.filter(key => rubric[key] === undefined || rubric[key] === null || isNaN(rubric[key]));
    if (missingKeys.length > 0) {
      setRubricStatus((prev) => ({ ...prev, [link]: `Error: Incomplete rubric. Missing or invalid: ${missingKeys.join(', ')}` }));
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
        setRubricStatus((prev) => ({ ...prev, [link]: 'Rubric submitted successfully' }));
        await fetchAssignments();
      } else {
        setRubricStatus((prev) => ({ ...prev, [link]: 'Error submitting rubric after 3 attempts' }));
      }
    } catch (err) {
      console.error('General error submitting rubric:', err);
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
        setSubmitStatus((prev) => ({ ...prev, [link]: 'Main data submitted successfully' }));
        await fetchAssignments();
      } else {
        setSubmitStatus((prev) => ({ ...prev, [link]: 'Error submitting main data after 3 attempts' }));
      }
    } catch (err) {
      console.error('General error submitting main data:', err);
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
      return 'As Reviewer 1, your role is to review technical aspects such as grammar, spelling, source citation, detection of AI-generated content, logical coherence, and overall article structure. Provide detailed comments in the Google Drive document to suggest improvements. Ensure the language is clear and academic. You must provide feedback to the author in the corresponding box. Additionally, you must submit a summary report explaining your observations to guide the editor. Finally, in the vote box, enter "yes" if you approve the article, and "no" if you reject it.';
    } else if (role === "Reviewer 2") {
      return 'As Reviewer 2, focus on substantive content: verify the accuracy of sources, the seriousness and originality of the topic, the relevance of arguments, and the contribution to the field of study. Evaluate if the article is innovative and well-supported. Leave comments in the Google Drive document. You must provide feedback to the author in the corresponding box. Additionally, you must submit a summary report explaining your observations to guide the editor. Finally, in the vote box, enter "yes" if you approve the article, and "no" if you reject it.';
    } else if (role === "Editor") {
      return `As Editor, your responsibility is to review the feedback and reports from the reviewers, integrate them with your own evaluation, and write a final sensitive and constructive feedback for the author. Edit the text directly if necessary and decide the final status of the article. Use the Google Drive document for editions. You must provide feedback to the author synthesizing the reviewers' feedback. Your message should be precise and sensitive, without discouraging the author. For this, use the "sandwich" technique. If you don't know what it is, consult <a href="https://www.santanderopenacademy.com/en/blog/sandwich-technique.html" style="color: blue;">here</a>. Based on psychological studies, such as those indicating that feedback improves performance only in 30% of cases if not handled well, ensure the criticism is specific, actionable, and not diluted by positive comments to maximize effectiveness. You can complement with the SBI model (Situation-Behavior-Impact) for greater clarity: describe the situation, the observed behavior, and its impact. Then, submit your report with the changes made, which should be precise and academic. Finally, in the vote box, enter "yes" if you approve the article, and "no" if you reject it.`;
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
                setSubmitStatus((prev) => ({ ...prev, [link]: 'Error deleting image' }));
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
                setSubmitStatus((prev) => ({ ...prev, [link]: 'Error adding text after image' }));
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
        button.title = 'Insert Image Manually';
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
    if (!encoded) return <p className="text-gray-600 font-sans text-sm break-words">No content available.</p>;
    try {
      const html = base64DecodeUnicode(encoded);
      return <div className="ql-editor break-words leading-relaxed font-sans text-sm text-gray-800" dangerouslySetInnerHTML={{ __html: html }} />;
    } catch (err) {
      console.error('Error decoding content:', err);
      return <p className="text-gray-600 font-sans text-sm break-words">Error decoding content.</p>;
    }
  };

  const handleImageModalSubmit = (link) => {
    const quillRef = feedbackQuillRefs.current[link] || reportQuillRefs.current[link];
    if (!quillRef) return;
    const editor = quillRef.getEditor();
    let { url, width, height, align } = imageData[link] || {};
    if (!url) {
      setSubmitStatus((prev) => ({ ...prev, [link]: 'The image URL is required.' }));
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
    { id: 'assignments', label: 'MY ASSIGNMENTS' },
    { id: 'completed', label: 'COMPLETED' },
    { id: 'calendar', label: 'ACADEMIC CALENDAR', hidden: !canSeeCalendar },
    { id: 'director', label: 'DIRECTOR PANEL', hidden: !isDirector },
    { id: 'chief', label: 'CHIEF EDITOR PANEL', hidden: !isChief },
    { id: 'tasks', label: 'MY TASKS', hidden: !isRrss && !isWebDev },
    { id: 'news', label: 'PUBLISH NEWS', hidden: !isDirector },
  ];

  const currentAssignments = activeTab === 'assignments' ? pendingAssignments : completedAssignments;

  if (!user || !effectiveName || !user.role) {
    console.log('Invalid user:', user);
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-[#fafafa] p-4 md:p-8 flex items-center justify-center"
      >
        <div className="text-center text-gray-600 bg-white p-6 rounded-lg shadow-md">
          <p className="text-lg font-sans mb-4">Error: Incomplete user information. Please log in again.</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              console.log('Log Out button clicked in PortalSection');
              onLogout();
            }}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm font-sans font-bold uppercase tracking-widest"
          >
            Log Out
          </motion.button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-6 sm:py-12 bg-[#fafafa] min-h-screen">
      {/* Portal Header */}
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between border-b border-gray-900 pb-8">
        <div>
          <h1 className="font-serif text-5xl font-bold text-gray-900 tracking-tighter mb-2 break-words">
            Editorial Portal
          </h1>
          <div className="flex items-center space-x-3">
            <p className="text-gray-500 font-sans tracking-widest uppercase text-xs break-words">
              Active session:
            </p>
            {user?.image ? (
              <motion.img
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                src={user.image}
                alt={`Profile of ${effectiveName || 'User'}`}
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
            <span className="font-bold text-gray-800 font-sans text-xs uppercase tracking-widest break-words">{effectiveName}</span>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="mt-4 md:mt-0 text-xs font-bold uppercase tracking-widest px-6 py-2 border border-gray-900 hover:bg-gray-900 hover:text-white transition-all"
        >
          Log Out
        </button>
      </header>
      {/* Editorial Style Navigation */}
      <nav className="flex flex-wrap gap-4 md:gap-8 mb-12 border-b border-gray-200">
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
                  className="bg-red-100 text-red-700 p-6 rounded-md mb-8 font-sans text-sm break-words"
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
                  <p className="ml-4 text-gray-600 font-sans text-sm break-words">Loading assignments...</p>
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
                  <h3 className="mt-4 font-serif text-xl font-bold text-gray-900 break-words">No {activeTab === 'assignments' ? 'pending' : 'completed'} assignments at this time.</h3>
                  <p className="mt-2 text-gray-600 font-sans text-sm break-words">Stay tuned for new opportunities.</p>
                </motion.div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
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
              className="bg-white border-0 sm:border border-gray-200 p-2 sm:p-4 md:p-8 rounded-sm shadow-sm overflow-hidden"
            >
              <CalendarComponent events={calendarEvents} onSelectEvent={(e) => setSelectedAssignment(e.resource)} />
            </motion.div>
          ) : activeTab === 'director' ? (
            <motion.div
              key="director"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-white border-0 sm:border border-gray-200 p-2 sm:p-4 md:p-8 rounded-sm shadow-sm overflow-hidden"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-serif text-2xl font-bold text-gray-900 break-words">General Director Panel</h3>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsDirectorPanelExpanded(!isDirectorPanelExpanded)}
                  className="bg-gray-200 text-gray-800 px-3 py-1 rounded-md hover:bg-gray-300 text-sm font-sans font-bold uppercase tracking-widest flex items-center space-x-2"
                >
                  <span>{isDirectorPanelExpanded ? 'Minimize' : 'Expand'}</span>
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
              <div className="mt-4 flex space-x-4 flex-wrap gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    console.log('Add article button clicked');
                    document.dispatchEvent(new CustomEvent('openAddArticleModal'));
                  }}
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors font-sans text-sm font-bold uppercase tracking-widest flex items-center space-x-2"
                  style={{ display: 'inline-flex !important', visibility: 'visible !important' }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add Article</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    console.log('Update page button clicked');
                    document.dispatchEvent(new CustomEvent('rebuildPage'));
                  }}
                  className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 transition-colors font-sans text-sm font-bold uppercase tracking-widest flex items-center space-x-2"
                  style={{ display: 'inline-flex !important', visibility: 'visible !important' }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Update Page</span>
                </motion.button>
              </div>
            </motion.div>
          ) : activeTab === 'chief' ? (
            <motion.div
              key="chief"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-white border-0 sm:border border-gray-200 p-4 sm:p-6 md:p-10 rounded-sm shadow-sm overflow-hidden"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-serif text-2xl font-bold text-gray-900 break-words">Chief Editor Panel</h3>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsChiefEditorPanelExpanded(!isChiefEditorPanelExpanded)}
                  className="bg-gray-200 text-gray-800 px-3 py-1 rounded-md hover:bg-gray-300 text-sm font-sans font-bold uppercase tracking-widest flex items-center space-x-2"
                >
                  <span>{isChiefEditorPanelExpanded ? 'Minimize' : 'Expand'}</span>
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
              className="bg-white border-0 sm:border border-gray-200 p-2 sm:p-4 md:p-8 rounded-sm shadow-sm overflow-hidden"
            >
              <h3 className="font-serif text-2xl font-bold text-gray-900 mb-4 break-words">My Tasks in {isRrss ? 'Social Media' : 'Web Development'}</h3>
              <TaskSection user={user} />
            </motion.div>
          ) : activeTab === 'news' ? (
            <motion.div
              key="news"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-white border-0 sm:border border-gray-200 p-2 sm:p-4 md:p-8 rounded-sm shadow-sm overflow-hidden"
            >
              <h3 className="font-serif text-2xl font-bold text-gray-900 mb-4 break-words">Publish News</h3>
              <NewsUploadSection />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>
      {/* DETAIL MODAL (Editorial Overlay) */}
      <AnimatePresence>
        {selectedAssignment && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-white/95 backdrop-blur-sm overflow-y-auto px-2 py-6 sm:px-4 sm:py-12"
          >
            <div className="max-w-4xl mx-auto">
              <button
                onClick={() => setSelectedAssignment(null)}
                className="mb-8 font-sans font-bold text-xs uppercase tracking-widest flex items-center hover:text-blue-600"
              >
                ← Back to Portal
              </button>
              <header className="mb-12">
                <span className="text-xs font-bold text-blue-600 tracking-[0.3em] uppercase break-words">{selectedAssignment.role}</span>
                <h2 className="font-serif text-4xl font-bold text-gray-900 mt-2 mb-4 leading-tight break-words">
                  {selectedAssignment['Article Name']}
                </h2>
                <div className="h-1 w-24 bg-gray-900" />
              </header>
              {/* Render Rubric and Forms here with the new stylized components */}
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
  isPending={isAuthor ? (!selectedAssignment.feedbackEditor || !['Accepted', 'Rejected'].includes(selectedAssignment.Status)) : !selectedAssignment.isCompleted}
  role={selectedAssignment.role}
  link={selectedAssignment['Article Link']}
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